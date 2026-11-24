"""Summaries and presentations. Generation runs in the background; clients poll the resource."""

from __future__ import annotations

import re
from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..deps import current_user, not_found
from ..i18n import t
from ..models import Document, Presentation, Summary, User
from ..presentations.builder import build_pptx
from ..presentations.schema import LANGS, STYLES, Outline
from ..presentations.service import generate_outline, generate_slides
from ..services.summaries import generate_summary

router = APIRouter(prefix="/api", tags=["studio"])


def _run(background: BackgroundTasks, fn, *args) -> None:
    if settings.ingest_inline:
        fn(*args)
    else:
        background.add_task(fn, *args)


def _ready_docs(db: Session, user: User, ids: list[str]) -> list[Document]:
    docs = [d for d in (db.get(Document, i) for i in dict.fromkeys(ids)) if d and d.user_id == user.id]
    if not docs:
        raise not_found()
    if any(d.status != "ready" for d in docs):
        raise HTTPException(409, t("Документ али даяр эмес"))
    return docs


# ---------------------------------------------------------------- summaries

class SummaryIn(BaseModel):
    document_id: str
    length: Literal["short", "detailed"] = "short"
    lang: Literal["ky", "ru", "en"] = "ky"


class SummaryOut(BaseModel):
    id: str
    document_id: str
    filename: str
    length: str
    lang: str
    status: str
    error: str | None
    data: dict
    created_at: str


def _summary_out(s: Summary) -> SummaryOut:
    return SummaryOut(id=s.id, document_id=s.document_id, filename=s.document.filename, length=s.length, lang=s.lang,
                      status=s.status, error=s.error, data=s.data or {}, created_at=s.created_at.isoformat())


@router.post("/summaries", response_model=SummaryOut, status_code=202)
def create_summary(data: SummaryIn, background: BackgroundTasks, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _ready_docs(db, user, [data.document_id])
    s = Summary(user_id=user.id, document_id=data.document_id, length=data.length, lang=data.lang)
    db.add(s)
    db.commit()
    _run(background, generate_summary, s.id)
    db.refresh(s)
    return _summary_out(s)


@router.get("/summaries", response_model=list[SummaryOut])
def list_summaries(document_id: str | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    q = select(Summary).where(Summary.user_id == user.id).order_by(Summary.created_at.desc()).limit(50)
    if document_id:
        q = q.where(Summary.document_id == document_id)
    return [_summary_out(s) for s in db.scalars(q)]


@router.get("/summaries/{summary_id}", response_model=SummaryOut)
def get_summary(summary_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    s = db.get(Summary, summary_id)
    if s is None or s.user_id != user.id:
        raise not_found()
    return _summary_out(s)


@router.delete("/summaries/{summary_id}", status_code=204)
def delete_summary(summary_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    s = db.get(Summary, summary_id)
    if s is None or s.user_id != user.id:
        raise not_found()
    db.delete(s)
    db.commit()


# ---------------------------------------------------------------- presentations

class PresentationIn(BaseModel):
    source: Literal["topic", "documents"]
    topic: str = Field(default="", max_length=1000)
    document_ids: list[str] = Field(default_factory=list, max_length=10)
    lang: Literal[LANGS] = "ky"  # type: ignore[valid-type]
    style: Literal[STYLES] = "modern"  # type: ignore[valid-type]
    n_slides: int = Field(default=8, ge=5, le=15)
    audience: str = Field(default="", max_length=200)

    @model_validator(mode="after")
    def check_source(self):
        if self.source == "topic" and len(self.topic.strip()) < 3:
            raise ValueError("topic is required")
        if self.source == "documents" and not self.document_ids:
            raise ValueError("document_ids is required")
        return self


class PresentationPatch(BaseModel):
    outline: Outline | None = None
    style: Literal[STYLES] | None = None  # type: ignore[valid-type]


class PresentationOut(BaseModel):
    id: str
    title: str
    source: str
    topic: str
    document_ids: list[str]
    lang: str
    style: str
    n_slides: int
    audience: str
    status: str
    error: str | None
    outline: dict
    slides: list[dict]
    created_at: str
    updated_at: str


def _pres_out(p: Presentation) -> PresentationOut:
    return PresentationOut(id=p.id, title=p.title, source=p.source, topic=p.topic, document_ids=p.document_ids,
                           lang=p.lang, style=p.style, n_slides=p.n_slides, audience=p.audience, status=p.status,
                           error=p.error, outline=p.outline or {}, slides=p.slides or [],
                           created_at=p.created_at.isoformat(), updated_at=p.updated_at.isoformat())


def own_presentation(presentation_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Presentation:
    p = db.get(Presentation, presentation_id)
    if p is None or p.user_id != user.id:
        raise not_found()
    return p


@router.post("/presentations", response_model=PresentationOut, status_code=202)
def create_presentation(data: PresentationIn, background: BackgroundTasks, user: User = Depends(current_user), db: Session = Depends(get_db)):
    ids: list[str] = []
    title = data.topic.strip()[:200]
    if data.source == "documents":
        docs = _ready_docs(db, user, data.document_ids)
        ids = [d.id for d in docs]
        title = title or docs[0].filename.rsplit(".", 1)[0]
    p = Presentation(user_id=user.id, title=title or "Presentation", source=data.source, topic=data.topic.strip(),
                     document_ids=ids, lang=data.lang, style=data.style, n_slides=data.n_slides,
                     audience=data.audience.strip())
    db.add(p)
    db.commit()
    _run(background, generate_outline, p.id)
    db.refresh(p)
    return _pres_out(p)


@router.get("/presentations", response_model=list[PresentationOut])
def list_presentations(user: User = Depends(current_user), db: Session = Depends(get_db)):
    q = select(Presentation).where(Presentation.user_id == user.id).order_by(Presentation.updated_at.desc()).limit(50)
    return [_pres_out(p) for p in db.scalars(q)]


@router.get("/presentations/{presentation_id}", response_model=PresentationOut)
def get_presentation(p: Presentation = Depends(own_presentation)):
    return _pres_out(p)


@router.patch("/presentations/{presentation_id}", response_model=PresentationOut)
def patch_presentation(data: PresentationPatch, p: Presentation = Depends(own_presentation), db: Session = Depends(get_db)):
    if data.outline is not None:
        p.outline = data.outline.model_dump()
        p.title = data.outline.title
        p.n_slides = len(data.outline.slides)
    if data.style is not None:
        p.style = data.style
    db.commit()
    return _pres_out(p)


@router.post("/presentations/{presentation_id}/outline", response_model=PresentationOut, status_code=202)
def regenerate_outline(background: BackgroundTasks, p: Presentation = Depends(own_presentation), db: Session = Depends(get_db)):
    p.status, p.error, p.outline, p.slides = "draft_outline", None, {}, []
    db.commit()
    _run(background, generate_outline, p.id)
    db.refresh(p)
    return _pres_out(p)


@router.post("/presentations/{presentation_id}/generate", response_model=PresentationOut, status_code=202)
def generate(background: BackgroundTasks, p: Presentation = Depends(own_presentation), db: Session = Depends(get_db)):
    if not p.outline.get("slides"):
        raise HTTPException(409, t("Адегенде план түзүлүшү керек"))
    p.status, p.error = "generating", None
    db.commit()
    _run(background, generate_slides, p.id)
    db.refresh(p)
    return _pres_out(p)


@router.get("/presentations/{presentation_id}/download")
def download(p: Presentation = Depends(own_presentation)):
    if not p.slides:
        raise HTTPException(409, t("Презентация али даяр эмес"))
    data = build_pptx(p.slides, p.style, p.title)
    name = (re.sub(r"[^\w\- ]+", "", p.title, flags=re.U).strip() or "presentation")[:80] + ".pptx"
    return Response(
        data,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(name)}"},
    )


@router.delete("/presentations/{presentation_id}", status_code=204)
def delete_presentation(p: Presentation = Depends(own_presentation), db: Session = Depends(get_db)):
    db.delete(p)
    db.commit()
