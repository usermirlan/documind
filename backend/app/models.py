import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, Computed, ForeignKey, Index, Integer, LargeBinary, String, Text
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base, UTCDateTime, utcnow


def new_id() -> str:
    return uuid.uuid4().hex


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(80))
    password_hash: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)

    documents: Mapped[list["Document"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    chats: Mapped[list["Chat"]] = relationship(back_populates="owner", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    mime: Mapped[str] = mapped_column(String(100))
    size: Mapped[int] = mapped_column(Integer)
    data: Mapped[bytes] = mapped_column(LargeBinary, deferred=True)  # the original file
    status: Mapped[str] = mapped_column(String(16), default="processing")  # processing | ready | error
    error: Mapped[str | None] = mapped_column(Text)
    pages: Mapped[int] = mapped_column(Integer, default=0)
    chunks_count: Mapped[int] = mapped_column(Integer, default=0)
    embed_model: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)

    owner: Mapped[User] = relationship(back_populates="documents")
    chunks: Mapped[list["Chunk"]] = relationship(back_populates="document", cascade="all, delete-orphan", passive_deletes=True)


class Chunk(Base):
    __tablename__ = "chunks"

    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    page: Mapped[int] = mapped_column(Integer)  # 1-based; 1 for formats without pages
    text: Mapped[str] = mapped_column(Text)
    # dimension depends on the embedding model, so the column is left unconstrained
    embedding = mapped_column(Vector())
    # 'simple' config: no stemming, works for Kyrgyz, Russian and English alike
    tsv = mapped_column(TSVECTOR, Computed("to_tsvector('simple', text)", persisted=True))

    document: Mapped[Document] = relationship(back_populates="chunks")

    __table_args__ = (Index("ix_chunks_tsv", "tsv", postgresql_using="gin"),)


class Chat(Base):
    __tablename__ = "chats"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    # documents this chat searches; empty list = all of the user's documents
    document_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, onupdate=utcnow)

    owner: Mapped[User] = relationship(back_populates="chats")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="chat", cascade="all, delete-orphan", order_by="Message.id"
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    chat_id: Mapped[str] = mapped_column(ForeignKey("chats.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(16))  # user | assistant
    content: Mapped[str] = mapped_column(Text)
    # for assistant messages: the numbered sources the answer cites
    sources: Mapped[list[dict]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)

    chat: Mapped[Chat] = relationship(back_populates="messages")


class Summary(Base):
    __tablename__ = "summaries"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    length: Mapped[str] = mapped_column(String(16))  # short | detailed
    lang: Mapped[str] = mapped_column(String(5))
    status: Mapped[str] = mapped_column(String(16), default="working")  # working | ready | error
    error: Mapped[str | None] = mapped_column(Text)
    # {summary, key_points[], dates[], names[], numbers[], action_items[]}
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)

    document: Mapped[Document] = relationship()


class Presentation(Base):
    __tablename__ = "presentations"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    source: Mapped[str] = mapped_column(String(16))  # topic | documents
    topic: Mapped[str] = mapped_column(Text, default="")
    document_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    lang: Mapped[str] = mapped_column(String(5))
    style: Mapped[str] = mapped_column(String(20))
    n_slides: Mapped[int] = mapped_column(Integer)
    audience: Mapped[str] = mapped_column(String(200), default="")
    # draft_outline -> outline -> generating -> ready | error
    status: Mapped[str] = mapped_column(String(16), default="draft_outline")
    error: Mapped[str | None] = mapped_column(Text)
    outline: Mapped[dict] = mapped_column(JSON, default=dict)   # {title, subtitle, slides:[{type,title,brief}]}
    slides: Mapped[list[dict]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, onupdate=utcnow)
