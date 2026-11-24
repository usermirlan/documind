"""Slide pictures: free AI images from Pollinations, with a local gradient as the fallback.

The anonymous Pollinations tier accepts about one request per 15 seconds, so images
are fetched one at a time in a background thread and appear in the deck as they land.
If the service is slow or down, the slide gets a generated gradient so no card is empty."""

from __future__ import annotations

import io
import logging
import random
import threading
import time
import uuid
from urllib.parse import quote

import httpx
from sqlalchemy import select

from ..config import settings
from ..db import SessionLocal
from ..models import Presentation, SlideImage
from .schema import IMAGE_TYPES
from .themes import THEMES

log = logging.getLogger("documind.images")

STYLE_HINT = ", professional editorial photography, cinematic soft light, high detail, no text, no letters, no watermark"
_running: set[str] = set()
_running_lock = threading.Lock()
_rate_lock = threading.Lock()
_last_request = 0.0


def _spacing() -> float:
    return 1.5 if settings.pollinations_token else 16.0


def fetch_pollinations(prompt: str, seed: int) -> bytes:
    global _last_request
    with _rate_lock:  # one request at a time, spaced for the anonymous rate limit
        wait = _last_request + _spacing() - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        params = {"width": 1280, "height": 720, "model": "flux", "seed": seed, "nologo": "true", "private": "true"}
        headers = {"Authorization": f"Bearer {settings.pollinations_token}"} if settings.pollinations_token else {}
        try:
            r = httpx.get(settings.pollinations_url + quote(prompt + STYLE_HINT), params=params,
                          headers=headers, timeout=httpx.Timeout(90, connect=10), follow_redirects=True)
        finally:
            _last_request = time.monotonic()
    if r.status_code != 200 or not r.headers.get("content-type", "").startswith("image/") or len(r.content) < 5000:
        raise RuntimeError(f"pollinations {r.status_code} {r.headers.get('content-type')} {len(r.content)}B")
    return r.content


def placeholder(prompt: str, style: str, seed: int) -> bytes:
    """A soft abstract gradient in the deck's colors (Pillow ships with python-pptx)."""
    from PIL import Image, ImageDraw, ImageFilter

    t = THEMES.get(style, THEMES["modern"])
    rnd = random.Random(seed or hash(prompt))
    w, h = 1280, 720

    def rgb(hx):
        return tuple(int(hx[i:i + 2], 16) for i in (0, 2, 4))

    a, b, c = rgb(t.dark), rgb(t.primary), rgb(t.accent)
    # diagonal two-color gradient from blended linear masks (fast, no per-pixel Python)
    g = Image.linear_gradient("L")
    mask = Image.blend(g.rotate(90).resize((w, h)), g.resize((w, h)), 0.35)
    img = Image.composite(Image.new("RGB", (w, h), b), Image.new("RGB", (w, h), a), mask)
    blobs = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(blobs)
    for i in range(6):
        r = rnd.randint(120, 360)
        cx, cy = rnd.randint(0, w), rnd.randint(0, h)
        col = c if i % 2 else b
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(*col, rnd.randint(70, 150)))
    blobs = blobs.filter(ImageFilter.GaussianBlur(70))
    img = Image.alpha_composite(img.convert("RGBA"), blobs).convert("RGB")
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85)
    return buf.getvalue()


def attach_images(p: Presentation) -> bool:
    """Give image-worthy slides an image record (pending). Returns True if anything new was queued."""
    if settings.image_provider == "none":
        return False
    with SessionLocal() as db:
        known = {i.id for i in db.scalars(select(SlideImage).where(SlideImage.presentation_id == p.id))}
    slides = [dict(s) for s in p.slides]
    used = sum(1 for s in slides if s.get("image_id"))
    changed = False
    new_rows = []
    for i, s in enumerate(slides):
        if s.get("type") not in IMAGE_TYPES or not s.get("image_prompt"):
            continue
        if s.get("image_id") in known:
            continue
        if used >= settings.max_images_per_deck:
            s["image_prompt"] = ""
            changed = True
            continue
        row = SlideImage(id=uuid.uuid4().hex, presentation_id=p.id, prompt=s["image_prompt"],
                         seed=random.randint(1, 10**6))
        new_rows.append(row)
        s["image_id"] = row.id
        used += 1
        changed = True
    if new_rows:
        with SessionLocal() as db:
            db.add_all(new_rows)
            db.commit()
    if changed:
        p.slides = slides
    return bool(new_rows)


def _process(presentation_id: str) -> None:
    try:
        while True:
            with SessionLocal() as db:
                img = db.scalar(select(SlideImage).where(SlideImage.presentation_id == presentation_id,
                                                         SlideImage.status == "pending").order_by(SlideImage.created_at))
                if img is None:
                    return
                p = db.get(Presentation, presentation_id)
                style = p.style if p else "modern"
                prompt, seed, img_id = img.prompt, img.seed, img.id
            data, source, status = None, "", "ready"
            if settings.image_provider == "pollinations":
                for attempt in range(2):
                    try:
                        data, source = fetch_pollinations(prompt, seed + attempt), "pollinations"
                        break
                    except Exception as e:  # noqa: BLE001 - network, rate limit, bad payload
                        log.warning("image %s attempt %d failed: %s", img_id, attempt + 1, e)
            if data is None:
                data, source, status = placeholder(prompt, style, seed), "placeholder", "fallback"
            with SessionLocal() as db:
                row = db.get(SlideImage, img_id)
                if row is not None:
                    row.data, row.source, row.status, row.mime = data, source, status, "image/jpeg"
                    db.commit()
    finally:
        with _running_lock:
            _running.discard(presentation_id)


def process_async(presentation_id: str, inline: bool = False) -> None:
    """Start (at most one) background worker for this deck's pending images."""
    with _running_lock:
        if presentation_id in _running:
            return
        _running.add(presentation_id)
    if inline:
        _process(presentation_id)
    else:
        threading.Thread(target=_process, args=(presentation_id,), daemon=True).start()


def resume_all() -> None:
    with SessionLocal() as db:
        ids = set(db.scalars(select(SlideImage.presentation_id).where(SlideImage.status == "pending")))
    for pid in ids:
        process_async(pid)
