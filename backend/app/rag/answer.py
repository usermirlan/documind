"""Prompt for grounded, cited answers."""

from __future__ import annotations

from ..llm import LLMError, stream_chat  # noqa: F401 - re-exported for the chat API and tests
from .retrieval import Hit


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
