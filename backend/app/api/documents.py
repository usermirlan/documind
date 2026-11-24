from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Response, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session, undefer

from ..config import settings
from ..db import get_db
from ..deps import current_user, not_found
from ..i18n import lang_var, t
from ..models import Chunk, Document, User
from ..rag.ingest import ingest
from ..rag.parsing import detect_kind
from ..schemas import ChunkOut, DocumentOut

router = APIRouter(prefix="/api/documents", tags=["documents"])

MIME = {"pdf": "application/pdf", "txt": "text/plain; charset=utf-8",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}


def own_document(document_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Document:
    doc = db.get(Document, document_id)
    if doc is None or doc.user_id != user.id:
        raise not_found()
    return doc


@router.get("", response_model=list[DocumentOut])
def list_documents(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Document).where(Document.user_id == user.id).order_by(Document.created_at.desc())).all()


@router.post("", response_model=DocumentOut, status_code=201)
async def upload(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    filename = (file.filename or "document").replace("\\", "/").rsplit("/", 1)[-1][:255]
    kind = detect_kind(filename, file.content_type)
    if kind is None:
        raise HTTPException(415, t("Бул файл түрү колдоого алынбайт. PDF, DOCX, TXT же MD жүктөңүз."))
    limit = settings.max_file_mb * 1024 * 1024
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(413, t("Файл өтө чоң (эң көп {mb} МБ)", mb=settings.max_file_mb))
    if not data:
        raise HTTPException(422, t("Файл бош"))
    count = db.scalar(select(func.count()).select_from(Document).where(Document.user_id == user.id))
    if count >= settings.max_docs_per_user:
        raise HTTPException(409, t("Документтердин чегине жеттиңиз ({max})", max=settings.max_docs_per_user))

    doc = Document(user_id=user.id, filename=filename, mime=MIME[kind], size=len(data), data=data)
    db.add(doc)
    db.commit()
    if settings.ingest_inline:
        ingest(doc.id, lang_var.get())
        db.refresh(doc)
    else:
        background.add_task(ingest, doc.id, lang_var.get())
    return doc


SAMPLES = Path(__file__).resolve().parent.parent / "samples"


@router.post("/samples", response_model=list[DocumentOut], status_code=201)
def add_samples(background: BackgroundTasks, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """One click demo: add the bundled sample documents (skips ones the user already has)."""
    have = set(db.scalars(select(Document.filename).where(Document.user_id == user.id)))
    added = []
    for path in sorted(SAMPLES.iterdir()):
        kind = detect_kind(path.name, None)
        if kind is None or path.name in have:
            continue
        data = path.read_bytes()
        doc = Document(user_id=user.id, filename=path.name, mime=MIME[kind], size=len(data), data=data)
        db.add(doc)
        added.append(doc)
    db.commit()
    for doc in added:
        if settings.ingest_inline:
            ingest(doc.id, lang_var.get())
            db.refresh(doc)
        else:
            background.add_task(ingest, doc.id, lang_var.get())
    return added


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(doc: Document = Depends(own_document)):
    return doc


@router.delete("/{document_id}", status_code=204)
def delete_document(doc: Document = Depends(own_document), db: Session = Depends(get_db)):
    db.delete(doc)
    db.commit()


@router.get("/{document_id}/file")
def document_file(document_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    doc = db.scalar(select(Document).options(undefer(Document.data)).where(Document.id == document_id))
    if doc is None or doc.user_id != user.id:
        raise not_found()
    return Response(
        doc.data,
        media_type=doc.mime,
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{quote(doc.filename)}",
            "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/{document_id}/chunks", response_model=list[ChunkOut])
def document_chunks(page: int | None = None, doc: Document = Depends(own_document), db: Session = Depends(get_db)):
    q = select(Chunk).where(Chunk.document_id == doc.id).order_by(Chunk.position)
    if page is not None:
        q = q.where(Chunk.page == page)
    return db.scalars(q).all()


