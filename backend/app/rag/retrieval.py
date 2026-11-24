"""Hybrid retrieval: semantic (pgvector cosine) + lexical (Postgres full-text),
fused with Reciprocal Rank Fusion. Lexical search catches exact names, numbers
and rare terms that embeddings blur; semantic search catches paraphrases."""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session

from .embeddings import get_embedder

CANDIDATES = 20
RRF_K = 60

# very common question words in ky / ru / en that only add noise to keyword search
STOPWORDS = set("""
эмне кандай кайсы канча качан кайда ким эмнеге барбы жокпу жана менен үчүн деп бул ал ошол
что как какой какая какие когда где кто почему зачем это и в во на с со по для о об ли не
what how which when where who why the a an of to in on for is are and or
""".split())


@dataclass
class Hit:
    chunk_id: int
    document_id: str
    filename: str
    page: int
    text: str
    score: float
    semantic_rank: int | None
    lexical_rank: int | None

    def to_dict(self) -> dict:
        return asdict(self)


def _or_query(q: str) -> str | None:
    words = [w for w in re.findall(r"\w+", q.lower()) if len(w) > 1 and w not in STOPWORDS]
    # prefix match (":*") gives cheap tolerance to Kyrgyz/Russian suffixes
    return " | ".join(f"{w}:*" for w in dict.fromkeys(words)) or None


def _scope(user_id: int, doc_ids: list[str] | None) -> tuple[str, dict]:
    sql = "d.user_id = :uid AND d.status = 'ready' AND d.embed_model = :model"
    params: dict = {"uid": user_id}
    if doc_ids:
        sql += " AND d.id = ANY(:ids)"
        params["ids"] = list(doc_ids)
    return sql, params


def retrieve(db: Session, user_id: int, query: str, doc_ids: list[str] | None = None, k: int = 6) -> list[Hit]:
    embedder = get_embedder()
    where, params = _scope(user_id, doc_ids)
    params["model"] = embedder.name
    qvec = embedder.embed_query(query)

    semantic = db.execute(text(f"""
        SELECT c.id FROM chunks c JOIN documents d ON d.id = c.document_id
        WHERE {where}
        ORDER BY c.embedding <=> CAST(:qvec AS vector)
        LIMIT {CANDIDATES}
    """), {**params, "qvec": str(qvec)}).scalars().all()

    lexical: list[int] = []
    tsq = _or_query(query)
    if tsq:
        lexical = db.execute(text(f"""
            SELECT c.id FROM chunks c JOIN documents d ON d.id = c.document_id
            WHERE {where} AND c.tsv @@ to_tsquery('simple', :tsq)
            ORDER BY ts_rank_cd(c.tsv, to_tsquery('simple', :tsq)) DESC
            LIMIT {CANDIDATES}
        """), {**params, "tsq": tsq}).scalars().all()

    scores: dict[int, float] = {}
    sem_rank = {cid: i + 1 for i, cid in enumerate(semantic)}
    lex_rank = {cid: i + 1 for i, cid in enumerate(lexical)}
    for ranks in (sem_rank, lex_rank):
        for cid, r in ranks.items():
            scores[cid] = scores.get(cid, 0.0) + 1.0 / (RRF_K + r)
    top = sorted(scores, key=scores.get, reverse=True)[:k]
    if not top:
        return []

    rows = db.execute(text("""
        SELECT c.id, c.document_id, d.filename, c.page, c.text
        FROM chunks c JOIN documents d ON d.id = c.document_id WHERE c.id = ANY(:ids)
    """), {"ids": top}).all()
    by_id = {r.id: r for r in rows}
    return [
        Hit(cid, by_id[cid].document_id, by_id[cid].filename, by_id[cid].page, by_id[cid].text,
            round(scores[cid], 5), sem_rank.get(cid), lex_rank.get(cid))
        for cid in top
    ]
