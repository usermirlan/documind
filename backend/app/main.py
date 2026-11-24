import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import auth, chats, documents, studio
from .config import settings
from .db import SessionLocal
from .i18n import lang_var, pick_lang

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

if settings.secret_key == "dev-only-change-me" and settings.cors_origins and settings.cors_origins[0].startswith("https"):
    raise RuntimeError("Set SECRET_KEY in production")


def _resume_ingestion() -> None:
    from .presentations.images import resume_all
    from .rag.ingest import ingest, resume_pending

    resume_all()

    with SessionLocal() as db:
        ids = resume_pending(db)
    for doc_id in ids:
        ingest(doc_id)


@asynccontextmanager
async def lifespan(_: FastAPI):
    if not settings.ingest_inline:
        threading.Thread(target=_resume_ingestion, daemon=True).start()
    yield


app = FastAPI(
    title="DocuMind API",
    version="1.0.0",
    description="Chat with your documents: hybrid retrieval (pgvector + full-text) and cited, streamed answers.",
    lifespan=lifespan,
)


class LanguageMiddleware:
    """Request language from Accept-Language (pure ASGI so the context var reaches handlers)."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = dict(scope.get("headers") or [])
        token = lang_var.set(pick_lang(headers.get(b"accept-language", b"").decode("latin-1")))
        try:
            await self.app(scope, receive, send)
        finally:
            lang_var.reset(token)


app.add_middleware(LanguageMiddleware)
app.add_middleware(
    CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)
for r in (auth.router, documents.router, chats.router, studio.router):
    app.include_router(r)


@app.get("/api/health", tags=["meta"])
def health():
    return {"ok": True}
