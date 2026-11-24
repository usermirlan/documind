"""Ingestion pipeline: parse -> chunk -> embed -> store. Runs in a background thread."""

import logging
import time

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from ..config import settings
from ..db import SessionLocal
from ..i18n import lang_var, t
from ..models import Chunk, Document
from .chunking import chunk_pages
from .embeddings import get_embedder
from .parsing import detect_kind, parse

log = logging.getLogger("documind.ingest")


def ingest(document_id: str, lang: str = "ky") -> None:
    """Process one document. Errors are stored on the document, never raised."""
    token = lang_var.set(lang)
    started = time.perf_counter()
    with SessionLocal() as db:
        doc = db.get(Document, document_id)
        if doc is None:
            return
        try:
            pages = parse(doc.data, detect_kind(doc.filename, doc.mime) or "txt")
            pieces = chunk_pages(pages, settings.chunk_chars, settings.chunk_overlap)
            embedder = get_embedder()
            vectors = embedder.embed_documents([text for _, text in pieces])
            db.execute(delete(Chunk).where(Chunk.document_id == doc.id))
            db.add_all(
                Chunk(document_id=doc.id, position=i, page=page, text=text, embedding=vec)
                for i, ((page, text), vec) in enumerate(zip(pieces, vectors, strict=True))
            )
            doc.pages = max(p for p, _ in pages)
            doc.chunks_count = len(pieces)
            doc.embed_model = embedder.name
            doc.status, doc.error = "ready", None
            db.commit()
            log.info("ingested %s: %d chunks in %.1fs", doc.filename, len(pieces), time.perf_counter() - started)
        except Exception as e:  # noqa: BLE001 - shown to the user on the document card
            db.rollback()
            log.exception("ingest failed for %s", document_id)
            db.execute(update(Document).where(Document.id == document_id).values(status="error", error=str(e)[:1000]))
            db.commit()
        finally:
            lang_var.reset(token)


def resume_pending(db: Session) -> list[str]:
    """Documents left in 'processing' by a restart (free hosts sleep and restart often)."""
    return list(db.scalars(select(Document.id).where(Document.status == "processing")))
