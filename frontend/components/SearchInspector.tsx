"use client";

import { useState, useTransition } from "react";
import { search } from "@/app/actions";
import type { Hit } from "@/lib/types";
import { useI18n } from "./I18n";

export default function SearchInspector() {
  const { d } = useI18n();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) start(async () => { const r = await search(q); if (r.ok) { setHits(r.data); setError(null); } else setError(r.error); }); }}
        className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={d.search.placeholder} aria-label={d.search.placeholder}
          className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2.5 outline-none focus:border-accent" />
        <button disabled={pending} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-50">{d.search.run}</button>
      </form>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      {hits?.length === 0 && <p className="text-dim">{d.search.none}</p>}
      <ol className="flex flex-col gap-3">
        {hits?.map((h, i) => (
          <li key={h.chunk_id} className="rounded-xl border border-line bg-card p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="cite !m-0">{i + 1}</span>
              <span className="font-medium">{h.filename}</span>
              <span className="text-dim">· {h.page}</span>
              <span className="ml-auto flex gap-1.5">
                <span className={`rounded px-1.5 py-0.5 ${h.semantic_rank ? "bg-accent-soft text-accent" : "bg-sunk text-dim"}`}>{d.search.semantic} #{h.semantic_rank ?? "—"}</span>
                <span className={`rounded px-1.5 py-0.5 ${h.lexical_rank ? "bg-mark/60 text-ink" : "bg-sunk text-dim"}`}>{d.search.lexical} #{h.lexical_rank ?? "—"}</span>
                <span className="rounded bg-sunk px-1.5 py-0.5 font-mono text-dim">RRF {h.score.toFixed(4)}</span>
              </span>
            </div>
            <p className="line-clamp-4 font-serif leading-relaxed text-ink/85">{h.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
