"""Turn an uploaded file into a list of (page_number, text). Pages are 1-based."""

import io
import re

from ..i18n import t


class ParseError(Exception):
    pass


SUPPORTED = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
    "text/markdown": "txt",
}
EXTENSIONS = {".pdf": "pdf", ".docx": "docx", ".txt": "txt", ".md": "txt"}


def detect_kind(filename: str, mime: str | None) -> str | None:
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return EXTENSIONS.get(ext) or SUPPORTED.get((mime or "").split(";")[0])


def _clean(text: str) -> str:
    text = text.replace("\x00", "")
    text = re.sub(r"-\n(?=\w)", "", text)          # words hyphenated across lines
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def parse(data: bytes, kind: str) -> list[tuple[int, str]]:
    if kind == "pdf":
        from pypdf import PdfReader

        try:
            reader = PdfReader(io.BytesIO(data))
            pages = [(i + 1, _clean(p.extract_text() or "")) for i, p in enumerate(reader.pages)]
        except Exception as e:  # noqa: BLE001 - pypdf raises many types
            raise ParseError(t("PDF окулбай калды: {error}", error=e)) from e
    elif kind == "docx":
        from docx import Document as Docx

        try:
            doc = Docx(io.BytesIO(data))
        except Exception as e:  # noqa: BLE001
            raise ParseError(t("DOCX окулбай калды: {error}", error=e)) from e
        parts = [p.text for p in doc.paragraphs]
        for table in doc.tables:
            for row in table.rows:
                parts.append(" | ".join(c.text.strip() for c in row.cells))
        pages = [(1, _clean("\n\n".join(parts)))]
    else:
        for enc in ("utf-8", "cp1251", "latin-1"):
            try:
                text = data.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        pages = [(1, _clean(text))]
    pages = [(n, txt) for n, txt in pages if txt]
    if not pages:
        raise ParseError(t("Документтен текст табылган жок (сканерленген PDF болушу мүмкүн)"))
    return pages
