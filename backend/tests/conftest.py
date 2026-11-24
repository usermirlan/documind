import os
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://documind:documind@localhost:5432/documind_test")
os.environ["EMBED_PROVIDER"] = "fake"
os.environ["INGEST_INLINE"] = "1"
os.environ["SECRET_KEY"] = "test-secret-key-long-enough-for-hs256-0123456789"
os.environ["LLM_API_KEY"] = ""
os.environ["IMAGE_PROVIDER"] = "placeholder"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="session", autouse=True)
def schema():
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture(autouse=True)
def clean():
    yield
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE users, documents, chunks, chats, messages, summaries, presentations, slide_images RESTART IDENTITY CASCADE"))


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def auth(client, email="a@test.kg"):
    r = client.post("/api/auth/register", json={"email": email, "name": "Test", "password": "secret123"})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def upload(client, h, name="handbook.pdf", mime="application/pdf", data=None):
    data = data if data is not None else (FIXTURES / name).read_bytes()
    r = client.post("/api/documents", files={"file": (name, data, mime)}, headers=h)
    return r
