"""Embedding providers behind one small interface.

- local:  fastembed (ONNX) running in-process; multilingual, no API key
- gemini: Google's gemini-embedding-001 over REST (free tier key from AI Studio)
- fake:   deterministic hashed bag-of-words, for tests and offline demos
"""

from __future__ import annotations

import hashlib
import math
import os
import re
from functools import lru_cache
from typing import Protocol

import httpx

from ..config import settings
from ..i18n import t


class EmbeddingError(Exception):
    pass


class Embedder(Protocol):
    name: str

    def embed_documents(self, texts: list[str]) -> list[list[float]]: ...

    def embed_query(self, text: str) -> list[float]: ...


def _normalize(v: list[float]) -> list[float]:
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / n for x in v]


class FakeEmbedder:
    dim = 256

    def __init__(self):
        self.name = "fake-hash-256"

    def _one(self, text: str) -> list[float]:
        v = [0.0] * self.dim
        for w in re.findall(r"\w+", text.lower()):
            v[int(hashlib.md5(w.encode()).hexdigest(), 16) % self.dim] += 1.0
        return _normalize(v)

    def embed_documents(self, texts):
        return [self._one(x) for x in texts]

    def embed_query(self, text):
        return self._one(text)


class LocalEmbedder:
    def __init__(self, model: str):
        from fastembed import TextEmbedding

        self.name = f"fastembed:{model}"
        # FASTEMBED_CACHE_PATH lets the Docker image ship the model instead of downloading at runtime
        self._model = TextEmbedding(model, cache_dir=os.environ.get("FASTEMBED_CACHE_PATH"))

    def embed_documents(self, texts):
        return [_normalize(v.tolist()) for v in self._model.embed(texts, batch_size=32)]

    def embed_query(self, text):
        return self.embed_documents([text])[0]


class GeminiEmbedder:
    URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:batchEmbedContents"
    BATCH = 100

    def __init__(self, model: str, api_key: str, dim: int = 768):
        if not api_key:
            raise EmbeddingError(t("GEMINI_API_KEY коюлган жок"))
        self.model, self.key, self.dim = model, api_key, dim
        self.name = f"gemini:{model}:{dim}"

    def _batch(self, texts: list[str], task: str) -> list[list[float]]:
        out: list[list[float]] = []
        with httpx.Client(timeout=60) as client:
            for i in range(0, len(texts), self.BATCH):
                body = {"requests": [
                    {"model": f"models/{self.model}", "content": {"parts": [{"text": x}]},
                     "taskType": task, "outputDimensionality": self.dim}
                    for x in texts[i:i + self.BATCH]
                ]}
                try:
                    r = client.post(self.URL.format(model=self.model), json=body, headers={"x-goog-api-key": self.key})
                except httpx.HTTPError as e:
                    raise EmbeddingError(t("Embedding кызматы жооп берген жок: {error}", error=e)) from e
                if r.status_code != 200:
                    raise EmbeddingError(t("Embedding кызматы ката берди: {error}", error=f"{r.status_code} {r.text[:200]}"))
                # truncated (non-3072) Gemini vectors are not unit length: normalize for cosine
                out += [_normalize(e["values"]) for e in r.json()["embeddings"]]
        return out

    def embed_documents(self, texts):
        return self._batch(texts, "RETRIEVAL_DOCUMENT")

    def embed_query(self, text):
        return self._batch([text], "RETRIEVAL_QUERY")[0]


DEFAULT_MODELS = {
    "local": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    "gemini": "gemini-embedding-001",
}


@lru_cache(maxsize=1)
def get_embedder() -> Embedder:
    provider = settings.embed_provider
    model = settings.embed_model or DEFAULT_MODELS.get(provider, "")
    if provider == "fake":
        return FakeEmbedder()
    if provider == "gemini":
        return GeminiEmbedder(model, settings.gemini_api_key)
    if provider == "local":
        return LocalEmbedder(model)
    raise EmbeddingError(f"Unknown EMBED_PROVIDER: {provider}")
