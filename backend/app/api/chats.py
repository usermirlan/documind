import json
from collections.abc import Iterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import SessionLocal, get_db, utcnow
from ..deps import current_user, not_found
from ..i18n import t
from ..models import Chat, Document, Message, User
from ..rag import answer
from ..rag.embeddings import EmbeddingError
from ..rag.retrieval import retrieve
from ..schemas import AskIn, ChatIn, ChatOut, ChatPatch, ChatSummary, SearchIn

router = APIRouter(prefix="/api", tags=["chats"])


def own_chat(chat_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Chat:
    chat = db.get(Chat, chat_id)
    if chat is None or chat.user_id != user.id:
        raise not_found()
    return chat


def _own_doc_ids(db: Session, user: User, ids: list[str]) -> list[str]:
    if not ids:
        return []
    owned = set(db.scalars(select(Document.id).where(Document.user_id == user.id, Document.id.in_(ids))))
    return [i for i in dict.fromkeys(ids) if i in owned]


@router.get("/chats", response_model=list[ChatSummary])
def list_chats(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Chat).where(Chat.user_id == user.id).order_by(Chat.updated_at.desc())).all()


@router.post("/chats", response_model=ChatOut, status_code=201)
def create_chat(data: ChatIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    chat = Chat(user_id=user.id, title=(data.title or "").strip() or t("Жаңы маек"),
                document_ids=_own_doc_ids(db, user, data.document_ids))
    db.add(chat)
    db.commit()
    return chat


@router.get("/chats/{chat_id}", response_model=ChatOut)
def get_chat(chat: Chat = Depends(own_chat)):
    return chat


@router.patch("/chats/{chat_id}", response_model=ChatOut)
def patch_chat(data: ChatPatch, chat: Chat = Depends(own_chat), user: User = Depends(current_user), db: Session = Depends(get_db)):
    if data.title is not None:
        chat.title = data.title.strip()
    if data.document_ids is not None:
        chat.document_ids = _own_doc_ids(db, user, data.document_ids)
    db.commit()
    return chat


@router.delete("/chats/{chat_id}", status_code=204)
def delete_chat(chat: Chat = Depends(own_chat), db: Session = Depends(get_db)):
    db.delete(chat)
    db.commit()


@router.post("/search")
def search(data: SearchIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Retrieval inspector: what the model would see for this query, with both rankings."""
    try:
        hits = retrieve(db, user.id, data.query, _own_doc_ids(db, user, data.document_ids) or None, settings.top_k)
    except EmbeddingError as e:
        raise HTTPException(502, str(e)) from e
    return [h.to_dict() for h in hits]


def _sse(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/chats/{chat_id}/ask")
def ask(data: AskIn, chat: Chat = Depends(own_chat), user: User = Depends(current_user)):
    """Server-Sent Events: `sources`, then many `token`, then `done` (or `error`)."""
    question = data.question.strip()
    if not question:
        raise HTTPException(422, t("Суроо бош"))
    chat_id, user_id = chat.id, user.id

    # Starlette iterates this generator in a thread with a copy of the request context,
    # so the language set by LanguageMiddleware is still visible inside.
    def events() -> Iterator[str]:
        with SessionLocal() as db:
            c = db.get(Chat, chat_id)
            history = [{"role": m.role, "content": m.content} for m in c.messages]
            db.add(Message(chat_id=c.id, role="user", content=question, sources=[]))
            if not history and c.title in ("Жаңы маек", "Новый чат"):
                c.title = question[:80]
            db.commit()

            # follow-ups ("and the second one?") retrieve better with the previous question attached
            prev = next((h["content"] for h in reversed(history) if h["role"] == "user"), "")
            try:
                hits = retrieve(db, user_id, f"{prev}\n{question}" if prev else question, c.document_ids or None, settings.top_k)
            except EmbeddingError as e:
                yield _sse("error", {"message": str(e)})
                return
            if not hits:
                yield _sse("error", {"message": t("Даяр документ жок. Адегенде документ жүктөңүз.")})
                return
            sources = [
                {"n": i, "document_id": h.document_id, "filename": h.filename, "page": h.page, "text": h.text}
                for i, h in enumerate(hits, 1)
            ]
            yield _sse("sources", sources)

            parts: list[str] = []
            try:
                for delta in answer.stream_chat(answer.build_messages(question, hits, history)):
                    parts.append(delta)
                    yield _sse("token", {"t": delta})
            except answer.LLMError as e:
                yield _sse("error", {"message": str(e)})
                return
            msg = Message(chat_id=c.id, role="assistant", content="".join(parts), sources=sources)
            db.add(msg)
            c.updated_at = utcnow()
            db.commit()
            yield _sse("done", {"message_id": msg.id, "title": c.title})

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
