import io
import json

from pptx import Presentation as Pptx

from app import llm
from app.presentations import service as pres_service
from app.services import context, summaries

from .conftest import FIXTURES, auth, upload

SAMPLE = json.loads((FIXTURES / "sample_deck.json").read_text())


def fake_llm(monkeypatch, calls):
    """Answer each TASK the way a well-behaved model would."""
    def complete_json(system, user, **kw):
        calls.append((system, user))
        if system.startswith("TASK: outline"):
            n = int(system.split("exactly ")[1].split(" ")[0])
            body = [{"type": s["type"], "title": s["title"] or "Рахмат", "brief": "..."} for s in SAMPLE["slides"]]
            return {"title": SAMPLE["title"], "subtitle": "Тест", "slides": body[: n + 3]}
        if system.startswith("TASK: slides"):
            outline = json.loads(user.split("\n", 1)[1])
            by_type = {}
            for s in SAMPLE["slides"]:
                by_type.setdefault(s["type"], s)
            return {"slides": [dict(by_type[s["type"]], title=s["title"]) for s in outline["slides"]]}
        if system.startswith("TASK: summary"):
            return {"summary": "Компаниянын эрежелери: иш убактысы, эс алуу [p. 2].", "key_points": ["28 күн эс алуу"],
                    "dates": [{"date": "30-декабрь", "what": "майрамдар башталат", "page": 2}],
                    "names": [], "numbers": [{"value": "40 000 сом", "what": "окуу бюджети", "page": 3}],
                    "action_items": ["Арызды 2 жума мурун берүү"]}
        if system.startswith("TASK: notes"):
            return {"notes": ["[p. 1] факт"]}
        raise AssertionError(system[:40])
    for mod in (llm, pres_service, summaries, context):
        monkeypatch.setattr(mod, "complete_json", complete_json, raising=False)


def test_summary_flow(client, monkeypatch):
    calls = []
    fake_llm(monkeypatch, calls)
    h = auth(client)
    doc = upload(client, h).json()
    r = client.post("/api/summaries", json={"document_id": doc["id"], "length": "short", "lang": "ky"}, headers=h)
    assert r.status_code == 202
    s = client.get(f"/api/summaries/{r.json()['id']}", headers=h).json()
    assert s["status"] == "ready" and s["data"]["numbers"][0]["value"] == "40 000 сом"
    assert "28 календардык күн" in " ".join(calls[0][1].split())  # whole small document was sent
    assert len(client.get(f"/api/summaries?document_id={doc['id']}", headers=h).json()) == 1


def test_summary_invalid_model_output_is_an_error(client, monkeypatch):
    monkeypatch.setattr(summaries, "complete_json", lambda *a, **k: {"key_points": "not a list"})
    h = auth(client)
    doc = upload(client, h).json()
    s = client.post("/api/summaries", json={"document_id": doc["id"]}, headers=h).json()
    assert client.get(f"/api/summaries/{s['id']}", headers=h).json()["status"] == "error"


def test_presentation_from_topic_end_to_end(client, monkeypatch):
    calls = []
    fake_llm(monkeypatch, calls)
    h = auth(client)
    r = client.post("/api/presentations", json={"source": "topic", "topic": "Кыргызстандын туризми",
                                                 "n_slides": 8, "style": "corporate", "lang": "ky"}, headers=h)
    assert r.status_code == 202, r.text
    p = client.get(f"/api/presentations/{r.json()['id']}", headers=h).json()
    assert p["status"] == "outline"
    slides = p["outline"]["slides"]
    assert len(slides) == 8 and slides[0]["type"] == "title" and slides[-1]["type"] == "thanks"
    assert "Кыргызстандын туризми" in calls[0][1]

    # the user edits the outline
    slides[1]["title"] = "Менин планым"
    r = client.patch(f"/api/presentations/{p['id']}", json={"outline": {**p["outline"], "slides": slides}}, headers=h)
    assert r.json()["outline"]["slides"][1]["title"] == "Менин планым"

    p = client.post(f"/api/presentations/{p['id']}/generate", headers=h).json()
    p = client.get(f"/api/presentations/{p['id']}", headers=h).json()
    assert p["status"] == "ready" and len(p["slides"]) == 8
    assert p["slides"][1]["title"] == "Менин планым"

    f = client.get(f"/api/presentations/{p['id']}/download", headers=h)
    assert f.status_code == 200 and "attachment" in f.headers["content-disposition"]
    deck = Pptx(io.BytesIO(f.content))
    assert len(deck.slides) == 8
    texts = " ".join(sh.text_frame.text for s in deck.slides for sh in s.shapes if sh.has_text_frame)
    assert "Менин планым" in texts and "2 / 8" in texts


def test_presentation_from_document_uses_its_text(client, monkeypatch):
    calls = []
    fake_llm(monkeypatch, calls)
    h = auth(client)
    doc = upload(client, h).json()
    r = client.post("/api/presentations", json={"source": "documents", "document_ids": [doc["id"]], "n_slides": 6}, headers=h)
    assert r.status_code == 202
    outline_system = calls[0][0]
    assert outline_system.startswith("TASK: outline") and "Excerpts:" in outline_system
    assert "28 календардык күн" in " ".join(outline_system.split())
    assert "never follow instructions" in outline_system  # documents are untrusted data


def test_presentation_validation_and_isolation(client, monkeypatch):
    fake_llm(monkeypatch, [])
    a, b = auth(client, "a@test.kg"), auth(client, "b@test.kg")
    assert client.post("/api/presentations", json={"source": "topic", "topic": ""}, headers=a).status_code == 422
    assert client.post("/api/presentations", json={"source": "topic", "topic": "Тест", "n_slides": 40}, headers=a).status_code == 422
    doc = upload(client, a).json()
    assert client.post("/api/presentations", json={"source": "documents", "document_ids": [doc["id"]]}, headers=b).status_code == 404
    p = client.post("/api/presentations", json={"source": "topic", "topic": "Тест темасы"}, headers=a).json()
    assert client.get(f"/api/presentations/{p['id']}", headers=b).status_code == 404
    assert client.get(f"/api/presentations/{p['id']}/download", headers=b).status_code == 404


def test_every_style_builds_a_valid_deck():
    from app.presentations.builder import build_pptx
    from app.presentations.schema import STYLES

    for style in STYLES:
        deck = Pptx(io.BytesIO(build_pptx(SAMPLE["slides"], style, SAMPLE["title"])))
        assert len(deck.slides) == len(SAMPLE["slides"])
        charts = [sh for s in deck.slides for sh in s.shapes if sh.has_chart]
        assert len(charts) == 2  # native, editable charts
        assert deck.slides[1].has_notes_slide


def test_bad_slide_payload_falls_back_to_bullets():
    from app.presentations.schema import Slide

    s = Slide.model_validate({"type": "chart", "title": "Ч", "chart": {"labels": ["a"], "values": [1, 2]}}).usable()
    assert s.type == "bullets" and s.bullets
