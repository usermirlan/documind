"""Settings from environment variables; defaults are for local development."""

import os


def _bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).lower() in ("1", "true", "yes")


def _db_url(url: str) -> str:
    """Hosted Postgres (Neon, Render) hands out postgres:// URLs; use the psycopg 3 driver."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


class Settings:
    database_url: str = _db_url(os.environ.get("DATABASE_URL", "postgresql+psycopg://documind:documind@localhost:5432/documind"))
    secret_key: str = os.environ.get("SECRET_KEY", "dev-only-change-me")
    token_ttl_hours: int = int(os.environ.get("TOKEN_TTL_HOURS", "168"))
    cors_origins: list[str] = [o for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",") if o]

    # embeddings: "local" (fastembed, no key), "gemini" (Google AI Studio key), "fake" (tests)
    embed_provider: str = os.environ.get("EMBED_PROVIDER", "local")
    embed_model: str = os.environ.get("EMBED_MODEL", "")
    gemini_api_key: str = os.environ.get("GEMINI_API_KEY", "")

    # answers: any OpenAI-compatible chat API (Groq by default)
    llm_api_key: str = os.environ.get("LLM_API_KEY", "")
    llm_base_url: str = os.environ.get("LLM_BASE_URL", "https://api.groq.com/openai/v1")
    llm_model: str = os.environ.get("LLM_MODEL", "openai/gpt-oss-120b")

    # slide pictures: "pollinations" (free AI images, no key), "placeholder" (local gradients), "none"
    image_provider: str = os.environ.get("IMAGE_PROVIDER", "pollinations")
    pollinations_token: str = os.environ.get("POLLINATIONS_TOKEN", "")  # optional: removes the rate limit
    pollinations_url: str = os.environ.get("POLLINATIONS_URL", "https://image.pollinations.ai/prompt/")
    max_images_per_deck: int = int(os.environ.get("MAX_IMAGES_PER_DECK", "6"))

    max_file_mb: int = int(os.environ.get("MAX_FILE_MB", "10"))
    max_docs_per_user: int = int(os.environ.get("MAX_DOCS_PER_USER", "30"))
    chunk_chars: int = int(os.environ.get("CHUNK_CHARS", "1000"))
    chunk_overlap: int = int(os.environ.get("CHUNK_OVERLAP", "150"))
    top_k: int = int(os.environ.get("TOP_K", "6"))
    # run ingestion inline instead of in a background thread (tests)
    ingest_inline: bool = _bool("INGEST_INLINE")


settings = Settings()
