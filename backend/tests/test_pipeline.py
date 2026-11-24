from app.rag.chunking import chunk_pages
from app.rag.parsing import ParseError, detect_kind, parse

from .conftest import FIXTURES


def test_detect_kind():
    assert detect_kind("a.PDF", None) == "pdf"
    assert detect_kind("notes", "text/plain") == "txt"
    assert detect_kind("x.exe", "application/octet-stream") is None


def test_parse_pdf_keeps_pages():
    pages = parse((FIXTURES / "handbook.pdf").read_bytes(), "pdf")
    assert [p for p, _ in pages] == [1, 2, 3]
    assert "28 календардык күн" in " ".join(pages[1][1].split())


def test_parse_text_and_bad_files():
    assert parse("Привет\r\n\r\nмир".encode("cp1251"), "txt")[0][1].startswith("Привет")
    for data, kind in [(b"   ", "txt"), (b"not a pdf", "pdf")]:
        try:
            parse(data, kind)
        except ParseError:
            continue
        raise AssertionError(kind)


def test_chunks_respect_size_overlap_and_pages():
    para = " ".join(f"Сүйлөм номер {i} бул жерде." for i in range(200))
    chunks = chunk_pages([(1, para), (2, "Кыска бет.")], size=300, overlap=60)
    assert all(len(c) <= 300 for _, c in chunks)
    assert chunks[-1] == (2, "Кыска бет.")
    first, second = chunks[0][1], chunks[1][1]
    assert second[:20] in first  # overlap carries context across the boundary
    assert {p for p, _ in chunks} == {1, 2}
