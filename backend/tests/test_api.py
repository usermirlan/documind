import json

from app.rag import answer

from .conftest import FIXTURES, auth, upload

RU = {"Accept-Language": "ru"}


def sse(body: str) -> list[tuple[str, object]]:
    out = []
    for block in body.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines())
        out.append((lines["event"], json.loads(lines["data"])))
    return out


def test_auth(client):
    h = auth(client)
    assert client.get("/api/auth/me", headers=h).json()["email"] == "a@test.kg"
    assert client.get("/api/documents").status_code == 401
    bad = {"email": "a@test.kg", "password": "wrongpass"}
    assert client.post("/api/auth/login", json=bad, headers=RU).json()["detail"] == "Неверный email или пароль"


def test_upload_ingests_with_pages(client):
    h = auth(client)
    r = upload(client, h)
    assert r.status_code == 201, r.text
    doc = r.json()
    assert doc["status"] == "ready" and doc["pages"] == 3 and doc["chunks_count"] >= 3
    chunks = client.get(f"/api/documents/{doc['id']}/chunks?page=2", headers=h).json()
    assert chunks and all(c["page"] == 2 for c in chunks)
    f = client.get(f"/api/documents/{doc['id']}/file", headers=h)
    assert f.headers["content-type"] == "application/pdf" and f.content.startswith(b"%PDF")


def test_upload_validation(client):
    h = auth(client)
    assert upload(client, h, "virus.exe", "application/octet-stream", b"MZ").status_code == 415
    assert upload(client, h, "empty.txt", "text/plain", b"").status_code == 422
    r = upload(client, h, "broken.pdf", "application/pdf", b"%PDF-garbage")
    assert r.status_code == 201 and r.json()["status"] == "error"


def test_users_are_isolated(client):
    a, b = auth(client, "a@test.kg"), auth(client, "b@test.kg")
    doc = upload(client, a).json()
    assert client.get(f"/api/documents/{doc['id']}", headers=b).status_code == 404
    assert client.get(f"/api/documents/{doc['id']}/file", headers=b).status_code == 404
    assert client.post("/api/search", json={"query": "эс алуу"}, headers=b).json() == []
    chat = client.post("/api/chats", json={"document_ids": [doc["id"]]}, headers=b).json()
    assert chat["document_ids"] == []  # foreign ids are dropped


def test_hybrid_search_finds_the_right_page(client):
    h = auth(client)
    upload(client, h)
    upload(client, h, "policy-ru.md", "text/markdown")
    hits = client.post("/api/search", json={"query": "Канча күн жылдык эс алуу берилет?"}, headers=h).json()
    assert hits[0]["page"] == 2 and "28" in hits[0]["text"]
    assert hits[0]["semantic_rank"] and hits[0]["lexical_rank"]
    hits = client.post("/api/search", json={"query": "компенсация интернета 1500 сомов"}, headers=h).json()
    assert hits[0]["filename"] == "policy-ru.md"


def test_search_can_be_scoped_to_documents(client):
    h = auth(client)
    pdf = upload(client, h).json()
    md = upload(client, h, "policy-ru.md", "text/markdown").json()
    hits = client.post("/api/search", json={"query": "интернет", "document_ids": [pdf["id"]]}, headers=h).json()
    assert all(x["document_id"] == pdf["id"] for x in hits)
    assert md["id"] not in {x["document_id"] for x in hits}


def test_ask_streams_sources_tokens_and_saves(client, monkeypatch):
    h = auth(client)
    upload(client, h)
    seen = {}

    def fake_stream(messages):
        seen["messages"] = messages
        yield "Жылына 28 күн "
        yield "[1]."

    monkeypatch.setattr(answer, "stream_chat", fake_stream)
    chat = client.post("/api/chats", json={}, headers=h).json()
    r = client.post(f"/api/chats/{chat['id']}/ask", json={"question": "Жылдык эс алуу канча күн?"}, headers=h)
    events = sse(r.text)
    kinds = [e for e, _ in events]
    assert kinds[0] == "sources" and kinds[-1] == "done" and kinds.count("token") == 2
    sources = events[0][1]
    assert sources[0]["n"] == 1 and sources[0]["page"] == 2
    assert "[1] (handbook.pdf, p. 2)" in seen["messages"][-1]["content"]

    saved = client.get(f"/api/chats/{chat['id']}", headers=h).json()
    assert saved["title"] == "Жылдык эс алуу канча күн?"
    assert [m["role"] for m in saved["messages"]] == ["user", "assistant"]
    assert saved["messages"][1]["content"] == "Жылына 28 күн [1]." and saved["messages"][1]["sources"]

    # the follow-up gets the history
    r = client.post(f"/api/chats/{chat['id']}/ask", json={"question": "Аны бөлүүгө болобу?"}, headers=h)
    assert sse(r.text)[-1][0] == "done"
    assert seen["messages"][1] == {"role": "user", "content": "Жылдык эс алуу канча күн?"}


def test_ask_errors_are_events(client):
    h = auth(client)
    chat = client.post("/api/chats", json={}, headers=h).json()
    r = client.post(f"/api/chats/{chat['id']}/ask", json={"question": "Салам"}, headers={**h, **RU})
    assert sse(r.text) == [("error", {"message": "Нет готовых документов. Сначала загрузите документ."})]
    upload(client, h)
    r = client.post(f"/api/chats/{chat['id']}/ask", json={"question": "эс алуу"}, headers=h)  # no LLM key in tests
    events = sse(r.text)
    assert events[0][0] == "sources" and events[-1] == ("error", {"message": "AI ачкычы жок: серверде LLM_API_KEY коюңуз"})


def test_delete_document_removes_chunks(client):
    h = auth(client)
    doc = upload(client, h).json()
    assert client.delete(f"/api/documents/{doc['id']}", headers=h).status_code == 204
    assert client.post("/api/search", json={"query": "эс алуу"}, headers=h).json() == []
    assert (FIXTURES / "handbook.pdf").exists()


def test_samples_are_added_once(client):
    h = auth(client)
    first = client.post("/api/documents/samples", headers=h).json()
    assert len(first) == 2 and all(d["status"] == "ready" for d in first)
    assert client.post("/api/documents/samples", headers=h).json() == []
