import io
import json

from pptx import Presentation as Pptx

from app import llm
from app.presentations import service as pres_service

from .conftest import auth
from .test_studio import SAMPLE, fake_llm

IMG = {0: "mountains of Kyrgyzstan at sunrise", 2: "Issyk-Kul lake shore", 9: "nomad yurt in a valley"}


def deck_json() -> str:
    slides = []
    for i, s in enumerate(SAMPLE["slides"]):
        s = dict(s)
        if i in IMG:
            s["image_prompt"] = IMG[i]
            s["layout"] = "image-left" if i == 2 else "auto"
        if s["type"] == "bullets":
            s["icons"] = ["mountain", "globe", "users", "not-an-icon"]
        slides.append(s)
    return json.dumps({"slides": slides}, ensure_ascii=False)


def make_deck(client, monkeypatch, h):
    fake_llm(monkeypatch, [])
    text = deck_json()
    seen = {"chunks": 0}

    def stream_json(system, user, **kw):
        assert "image_prompt" in system and "icons" in system
        for i in range(0, len(text), 40):
            seen["chunks"] += 1
            yield text[i:i + 40]

    monkeypatch.setattr(pres_service, "stream_json", stream_json)
    p = client.post("/api/presentations", json={"source": "topic", "topic": "Туризм", "n_slides": 13}, headers=h).json()
    client.post(f"/api/presentations/{p['id']}/generate", headers=h)
    return client.get(f"/api/presentations/{p['id']}", headers=h).json(), seen


def test_streamed_generation_saves_slides_icons_and_images(client, monkeypatch):
    h = auth(client)
    p, seen = make_deck(client, monkeypatch, h)
    assert seen["chunks"] > 20 and p["status"] == "ready" and len(p["slides"]) == 13
    bullets = next(s for s in p["slides"] if s["type"] == "bullets")
    assert bullets["icons"] == ["mountain", "globe", "users", ""]  # unknown icons are dropped
    with_img = [s for s in p["slides"] if s.get("image_id")]
    assert len(with_img) == 3
    assert all(p["images"][s["image_id"]] in ("ready", "fallback") for s in with_img)
    r = client.get(f"/api/presentations/{p['id']}/images/{with_img[0]['image_id']}", headers=h)
    assert r.status_code == 200 and r.headers["content-type"] == "image/jpeg" and len(r.content) > 5000

    deck = Pptx(io.BytesIO(client.get(f"/api/presentations/{p['id']}/download", headers=h).content))
    pictures = [sh for s in deck.slides for sh in s.shapes if sh.shape_type == 13]
    assert len(pictures) == 3


def test_slide_ai_action_and_new_image(client, monkeypatch):
    h = auth(client)
    p, _ = make_deck(client, monkeypatch, h)
    calls = []

    def complete_json(system, user, **kw):
        calls.append(user)
        slide = json.loads(user.split("Slide:\n", 1)[1])
        slide["bullets"] = slide["bullets"][:2]
        slide["image_prompt"] = "a new picture of mountains"
        return {"slide": slide}

    monkeypatch.setattr(pres_service, "complete_json", complete_json)
    old_id = p["slides"][2]["image_id"]
    r = client.post(f"/api/presentations/{p['id']}/slides/2/ai", json={"action": "shorter"}, headers=h)
    assert r.status_code == 200, r.text
    s = r.json()["slides"][2]
    assert len(s["bullets"]) == 2 and "concise" in calls[0]
    assert s["image_id"] and s["image_id"] != old_id  # new prompt -> new picture
    assert client.post(f"/api/presentations/{p['id']}/slides/99/ai", json={"action": "rewrite"}, headers=h).status_code == 404


def test_deck_ai_keeps_unchanged_pictures(client, monkeypatch):
    h = auth(client)
    p, _ = make_deck(client, monkeypatch, h)

    def complete_json(system, user, **kw):
        assert system.startswith("TASK: deck") and "more formal" in user
        slides = json.loads(user.split("Slides:\n", 1)[1])
        for s in slides:
            s["title"] = (s.get("title") or "") + "!"
            s.pop("image_id", None)
        return {"slides": slides}

    monkeypatch.setattr(pres_service, "complete_json", complete_json)
    r = client.post(f"/api/presentations/{p['id']}/ai", json={"instruction": "make it more formal"}, headers=h).json()
    assert all(s["title"].endswith("!") for s in r["slides"] if s["title"])
    before = [s.get("image_id") for s in p["slides"]]
    assert [s.get("image_id") for s in r["slides"]] == before


def test_inline_edits_and_validation(client, monkeypatch):
    h = auth(client)
    p, _ = make_deck(client, monkeypatch, h)
    slides = p["slides"]
    slides[1]["title"] = "Жаңы аталыш"
    slides.insert(2, dict(slides[2], image_id="forged-id"))
    r = client.patch(f"/api/presentations/{p['id']}", json={"slides": slides, "title": "Менин деким"}, headers=h).json()
    assert r["title"] == "Менин деким" and r["slides"][1]["title"] == "Жаңы аталыш" and len(r["slides"]) == 14
    assert r["slides"][2]["image_id"] not in ("forged-id", "")  # unknown id replaced by a fresh picture
    bad = client.patch(f"/api/presentations/{p['id']}", json={"slides": [{"type": "nope"}]}, headers=h)
    assert bad.status_code == 422


def test_share_link_is_public_and_revocable(client, monkeypatch):
    h = auth(client)
    p, _ = make_deck(client, monkeypatch, h)
    token = client.post(f"/api/presentations/{p['id']}/share", json={"enabled": True}, headers=h).json()["share_token"]
    pub = client.get(f"/api/public/presentations/{token}")
    assert pub.status_code == 200 and pub.json()["topic"] == "" and len(pub.json()["slides"]) == 13
    img = next(s["image_id"] for s in p["slides"] if s.get("image_id"))
    assert client.get(f"/api/public/presentations/{token}/images/{img}").status_code == 200
    other = auth(client, "b@test.kg")
    assert client.get(f"/api/presentations/{p['id']}", headers=other).status_code == 404
    client.post(f"/api/presentations/{p['id']}/share", json={"enabled": False}, headers=h)
    assert client.get(f"/api/public/presentations/{token}").status_code == 404


def test_stream_parser_handles_split_strings():
    p = llm.ArrayStreamParser("slides")
    text = '{"slides":[{"t":"a } b { c \\" d"},{"t":"e"}]}'
    got = [o for ch in text for o in p.feed(ch)]
    assert got == [{"t": 'a } b { c " d'}, {"t": "e"}]
