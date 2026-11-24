"""Prompting and streaming the answer from an OpenAI-compatible chat API."""

from __future__ import annotations

import json
from collections.abc import Iterator

import httpx

from ..config import settings
from ..i18n import t
from .retrieval import Hit


class LLMError(Exception):
    pass


SYSTEM = """You are DocuMind, an assistant that answers questions strictly from the user's documents.

Rules:
- Use ONLY the numbered sources below. Never use outside knowledge.
- After every claim, cite the source number(s) in square brackets, e.g. [1] or [2][3].
- If the sources do not contain the answer, say so plainly and do not guess.
- Answer in the same language as the question (Kyrgyz, Russian or English).
- Be concise and well structured; use short lists when they help."""


def build_messages(question: str, hits: list[Hit], history: list[dict]) -> list[dict]:
    sources = "\n\n".join(
        f"[{i}] ({h.filename}, p. {h.page})\n{h.text}" for i, h in enumerate(hits, 1)
    )
    msgs = [{"role": "system", "content": SYSTEM}]
    msgs += history[-6:]  # short memory for follow-up questions
    msgs.append({"role": "user", "content": f"Sources:\n\n{sources}\n\nQuestion: {question}"})
    return msgs


def stream_chat(messages: list[dict]) -> Iterator[str]:
    """Yield text deltas. Raises LLMError with a user-facing message."""
    if not settings.llm_api_key:
        raise LLMError(t("AI ачкычы жок: серверде LLM_API_KEY коюңуз"))
    url = settings.llm_base_url.rstrip("/") + "/chat/completions"
    body = {"model": settings.llm_model, "messages": messages, "temperature": 0.2, "stream": True}
    headers = {"Authorization": f"Bearer {settings.llm_api_key}"}
    try:
        with httpx.Client(timeout=httpx.Timeout(60, connect=10)) as client, \
                client.stream("POST", url, json=body, headers=headers) as r:
            if r.status_code != 200:
                raise LLMError(t("AI кызматы ката берди: {error}", error=f"{r.status_code} {r.read()[:200]!r}"))
            for line in r.iter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    delta = json.loads(data)["choices"][0]["delta"].get("content")
                except (ValueError, KeyError, IndexError):
                    continue
                if delta:
                    yield delta
    except httpx.HTTPError as e:
        raise LLMError(t("AI кызматы жооп берген жок: {error}", error=e)) from e
