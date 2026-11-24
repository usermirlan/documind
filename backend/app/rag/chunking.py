"""Split page texts into overlapping chunks that never cross a page boundary,
so every chunk can be cited with an exact page number."""

import re

_SENT = re.compile(r"(?<=[.!?…])\s+")


def _units(text: str) -> list[str]:
    """Paragraphs, and sentences of paragraphs that are too long on their own."""
    out = []
    for para in re.split(r"\n\s*\n", text):
        para = " ".join(para.split())
        if para:
            out.append(para)
    return out


def _split_long(unit: str, size: int) -> list[str]:
    """Break a too-long paragraph into sentences (hard-splitting giant ones on spaces)."""
    if len(unit) <= size:
        return [unit]
    pieces = []
    for sent in _SENT.split(unit):
        while len(sent) > size:
            cut = sent.rfind(" ", 0, size)
            cut = cut if cut > size // 2 else size
            pieces.append(sent[:cut].strip())
            sent = sent[cut:].strip()
        if sent:
            pieces.append(sent)
    return pieces


def _tail(text: str, overlap: int) -> str:
    """Last `overlap` characters, starting at a word boundary."""
    if overlap <= 0 or len(text) <= overlap:
        return text if overlap > 0 else ""
    tail = text[-overlap:]
    sp = tail.find(" ")
    return tail[sp + 1:] if 0 <= sp < len(tail) - 1 else tail


def chunk_pages(pages: list[tuple[int, str]], size: int = 1000, overlap: int = 150) -> list[tuple[int, str]]:
    chunks: list[tuple[int, str]] = []
    for page, text in pages:
        units = [p for u in _units(text) for p in _split_long(u, size)]
        cur = ""
        for u in units:
            if cur and len(cur) + len(u) + 2 > size:
                chunks.append((page, cur))
                cur = _tail(cur, overlap)
                cur = f"{cur}\n\n{u}" if cur and len(cur) + len(u) + 2 <= size else u
            else:
                cur = f"{cur}\n\n{u}" if cur else u
        if cur:
            chunks.append((page, cur))
    return chunks
