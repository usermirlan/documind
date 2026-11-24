# DocuMind

**An AI studio for your documents:** chat with them, summarize them, and generate professional PowerPoint decks from a topic or a document.

**Chat with your documents.** Upload a PDF, Word file or text and ask questions. DocuMind retrieves the relevant passages, the LLM answers only from them, and every claim is cited with file and page; clicking a citation opens that page.

![Chat: the answer streams in, citations open the source passage](docs/screenshots/chat.jpg)

## Features

- **Gamma-style decks:** slides stream in live; free keyless AI images (Pollinations) with a local gradient fallback; Lucide icons; click-to-edit text with autosave; per-slide AI actions (rewrite, shorter, longer, simpler, more visual, new image, custom) and deck-wide AI edits; fullscreen present mode; public share links; PPTX with pictures and PDF export.
- **AI presentation generator:** from a topic or from documents; language (Kyrgyz/Russian/English), 5–15 slides, 6 styles, optional audience. Two steps: an editable outline, then full slide content with speaker notes. 11 slide types (title, agenda, bullets, comparison, stats, timeline, chart, process, quote, conclusion, thanks). Real, editable `.pptx` built with python-pptx — native PowerPoint charts, slide numbers, notes; no image APIs. Live HTML preview in the same style.
- **Summaries:** short or detailed summary, key points, dates, names, numbers and action items with page references; large documents are condensed map-reduce style to fit free-tier limits.

- **Documents:** PDF (page-aware), DOCX (incl. tables), TXT, MD; background ingestion with live status.
- **Hybrid retrieval:** pgvector semantic search + Postgres full-text search fused with Reciprocal Rank Fusion. Semantic search catches paraphrases and cross-language questions; lexical search catches exact names, numbers and rare terms.
- **Grounded, cited answers:** the model must cite `[n]` and say when the sources don't contain the answer.
- **Streaming** over Server-Sent Events, with a stop button.
- **Chat history** with follow-up context; chats can be scoped to selected documents.
- **Retrieval inspector** showing semantic and lexical ranks for any query.
- **Kyrgyz and Russian UI**; answers follow the question's language.
- **One-click demo** with bundled sample documents.

## Stack

FastAPI · SQLAlchemy 2 · Alembic · PostgreSQL 16 + pgvector · fastembed (local multilingual model) or Gemini embeddings · any OpenAI-compatible LLM (Groq by default) · Next.js 16 · React 19 · Tailwind 4 · python-pptx · pytest on real Postgres (27 tests).

## Run

```bash
cp .env.example .env    # set SECRET_KEY and LLM_API_KEY (free Groq key)
docker compose up --build
```

App: http://localhost:3200 · API docs: http://localhost:8200/docs

## Deploy

Render free plan (`render.yaml`) + Neon (pgvector) + Vercel. Production uses Gemini embeddings because the free 512 MB instance can't hold the local model.
