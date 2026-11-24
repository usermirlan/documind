"""OpenAI-compatible chat API client (Groq by default; Ollama, OpenAI, etc. work too).

Two entry points: `stream_chat` for the chat UI and `complete_json` for structured
generation (outlines, slides, summaries). Temporary errors (429/5xx/timeouts) are retried.
"""

from __future__ import annotations

import json
import logging
import re
import time
from collections.abc import Iterator

import httpx

from .config import settings
from .i18n import t

log = logging.getLogger("documind.llm")
RETRYABLE = {408, 409, 429, 500, 502, 503, 504}


class LLMError(Exception):
    """User-facing failure of the language model call."""


def _require_key() -> None:
    if not settings.llm_api_key:
        raise LLMError(t("AI ачкычы жок: серверде LLM_API_KEY коюңуз"))


def _body(messages: list[dict], **extra) -> dict:
    body = {"model": settings.llm_model, "messages": messages, "temperature": extra.pop("temperature", 0.2), **extra}
    if "gpt-oss" in settings.llm_model:
        body.setdefault("reasoning_effort", "low")  # keep the token budget for the answer itself
    return body


def _url() -> str:
    return settings.llm_base_url.rstrip("/") + "/chat/completions"


def _headers() -> dict:
    return {"Authorization": f"Bearer {settings.llm_api_key}"}


def stream_chat(messages: list[dict]) -> Iterator[str]:
    """Yield text deltas."""
    _require_key()
    try:
        with httpx.Client(timeout=httpx.Timeout(90, connect=10)) as client, \
                client.stream("POST", _url(), json=_body(messages, stream=True), headers=_headers()) as r:
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


def _extract_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```\w*\s*|\s*```$", "", text)
    try:
        return json.loads(text)
    except ValueError:
        m = re.search(r"\{.*\}", text, re.S)
        if m:
            return json.loads(m.group(0))
        raise


def complete_json(system: str, user: str, *, max_tokens: int = 4000, attempts: int = 4) -> dict:
    """One JSON object from the model. Retries temporary HTTP errors and malformed JSON."""
    _require_key()
    messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    json_mode = True
    last_error = ""
    for attempt in range(attempts):
        extra = {"max_tokens": max_tokens, "temperature": 0.4}
        if json_mode:
            extra["response_format"] = {"type": "json_object"}
        try:
            with httpx.Client(timeout=httpx.Timeout(120, connect=10)) as client:
                r = client.post(_url(), json=_body(messages, **extra), headers=_headers())
        except httpx.HTTPError as e:
            last_error = str(e)
            time.sleep(2 * (attempt + 1))
            continue
        if r.status_code == 400 and json_mode and "response_format" in r.text:
            json_mode = False  # provider without JSON mode: fall back to plain text + extraction
            continue
        if r.status_code in RETRYABLE:
            last_error = f"{r.status_code} {r.text[:200]}"
            wait = float(r.headers.get("retry-after") or 0) or 3 * (attempt + 1)
            log.warning("LLM %s, retrying in %.0fs", r.status_code, wait)
            time.sleep(min(wait, 30))
            continue
        if r.status_code != 200:
            raise LLMError(t("AI кызматы ката берди: {error}", error=f"{r.status_code} {r.text[:200]}"))
        try:
            return _extract_json(r.json()["choices"][0]["message"]["content"] or "")
        except (ValueError, KeyError, IndexError, TypeError) as e:
            last_error = f"invalid JSON: {e}"
            messages = messages[:2] + [{"role": "user", "content": user + "\n\nReturn ONLY one valid JSON object."}]
    raise LLMError(t("AI кызматы ката берди: {error}", error=last_error[:300]))


def stream_json(system: str, user: str, *, max_tokens: int = 6000) -> Iterator[str]:
    """Stream the raw text of a JSON answer (JSON mode when the provider supports it)."""
    _require_key()
    messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    for json_mode in (True, False):
        extra = {"max_tokens": max_tokens, "temperature": 0.5, "stream": True}
        if json_mode:
            extra["response_format"] = {"type": "json_object"}
        try:
            with httpx.Client(timeout=httpx.Timeout(120, connect=10)) as client, \
                    client.stream("POST", _url(), json=_body(messages, **extra), headers=_headers()) as r:
                if r.status_code == 400 and json_mode:
                    continue  # provider can't stream JSON mode: plain streaming
                if r.status_code != 200:
                    raise LLMError(t("AI кызматы ката берди: {error}", error=f"{r.status_code} {r.read()[:200]!r}"))
                for line in r.iter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        return
                    try:
                        delta = json.loads(data)["choices"][0]["delta"].get("content")
                    except (ValueError, KeyError, IndexError):
                        continue
                    if delta:
                        yield delta
                return
        except httpx.HTTPError as e:
            raise LLMError(t("AI кызматы жооп берген жок: {error}", error=e)) from e


class ArrayStreamParser:
    """Pull complete objects out of the `"<key>": [ {...}, {...}` array of a streaming JSON text."""

    def __init__(self, key: str = "slides"):
        self.key = f'"{key}"'
        self.buf = ""
        self.pos = -1      # index just after '[' once found
        self.depth = 0
        self.start = -1
        self.in_str = False
        self.esc = False

    def feed(self, chunk: str) -> list[dict]:
        self.buf += chunk
        out: list[dict] = []
        if self.pos < 0:
            k = self.buf.find(self.key)
            if k < 0:
                return out
            b = self.buf.find("[", k)
            if b < 0:
                return out
            self.pos = b + 1
        i = self.pos
        while i < len(self.buf):
            ch = self.buf[i]
            if self.in_str:
                if self.esc:
                    self.esc = False
                elif ch == "\\":
                    self.esc = True
                elif ch == '"':
                    self.in_str = False
            elif ch == '"':
                self.in_str = True
            elif ch == "{":
                if self.depth == 0:
                    self.start = i
                self.depth += 1
            elif ch == "}":
                self.depth -= 1
                if self.depth == 0 and self.start >= 0:
                    try:
                        out.append(json.loads(self.buf[self.start:i + 1]))
                    except ValueError:
                        pass
                    self.start = -1
            i += 1
        self.pos = i
        return out
