from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterIn(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    name: str


class TokenOut(BaseModel):
    token: str
    user: UserOut


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    filename: str
    mime: str
    size: int
    status: str
    error: str | None
    pages: int
    chunks_count: int
    created_at: datetime


class ChunkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    page: int
    position: int
    text: str


class ChatIn(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    document_ids: list[str] = Field(default_factory=list, max_length=100)


class ChatPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    document_ids: list[str] | None = Field(default=None, max_length=100)


class ChatSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    document_ids: list[str]
    updated_at: datetime


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    role: str
    content: str
    sources: list[dict]
    created_at: datetime


class ChatOut(ChatSummary):
    messages: list[MessageOut]


class AskIn(BaseModel):
    question: str = Field(min_length=1, max_length=2000)


class SearchIn(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    document_ids: list[str] = Field(default_factory=list)
