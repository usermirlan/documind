"use client";

import { useEffect, useState, useTransition } from "react";
import { createSummary, deleteSummary, getSummary } from "@/app/actions";
import { ago } from "@/lib/format";
import type { Doc, Summary, SummaryData } from "@/lib/types";
import { useI18n } from "./I18n";

function Result({ s }: { s: Summary }) {
  const { d } = useI18n();
  const data = s.data as SummaryData;
  const [copied, setCopied] = useState(false);
  const page = (p?: number | null) => (p ? <span className="ml-1 text-xs text-dim">({d.sum.page(p)})</span> : null);
  const section = "rounded-xl border border-line bg-paper p-4";
  return (
    <div className="flex flex-col gap-4">
      <div className="relative rounded-xl border-l-4 border-accent bg-paper p-5">
        <div className="font-serif text-lg leading-relaxed whitespace-pre-line">{data.summary}</div>
        <button onClick={() => { navigator.clipboard?.writeText(data.summary); setCopied(true); }} className="mt-3 text-xs text-accent hover:underline">
          {copied ? d.sum.copied : d.sum.copy}
        </button>
      </div>
      {data.key_points?.length > 0 && (
        <div className={section}>
          <h3 className="mb-2 font-semibold">{d.sum.keyPoints}</h3>
          <ul className="ml-5 list-disc space-y-1">{data.key_points.map((k, i) => <li key={i}>{k}</li>)}</ul>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {data.dates?.length > 0 && (
          <div className={section}>
            <h3 className="mb-2 font-semibold">📅 {d.sum.dates}</h3>
            <dl className="space-y-1.5 text-sm">{data.dates.map((x, i) => <div key={i} className="flex gap-3"><dt className="w-32 shrink-0 font-medium">{x.date}</dt><dd>{x.what}{page(x.page)}</dd></div>)}</dl>
          </div>
        )}
        {data.numbers?.length > 0 && (
          <div className={section}>
            <h3 className="mb-2 font-semibold">🔢 {d.sum.numbers}</h3>
            <dl className="space-y-1.5 text-sm">{data.numbers.map((x, i) => <div key={i} className="flex gap-3"><dt className="w-32 shrink-0 font-semibold text-accent">{x.value}</dt><dd>{x.what}{page(x.page)}</dd></div>)}</dl>
          </div>
        )}
        {data.names?.length > 0 && (
          <div className={section}>
            <h3 className="mb-2 font-semibold">👤 {d.sum.names}</h3>
            <dl className="space-y-1.5 text-sm">{data.names.map((x, i) => <div key={i} className="flex gap-3"><dt className="w-32 shrink-0 font-medium">{x.name}</dt><dd>{x.role}{page(x.page)}</dd></div>)}</dl>
          </div>
        )}
        {data.action_items?.length > 0 && (
          <div className={section}>
            <h3 className="mb-2 font-semibold">✅ {d.sum.actions}</h3>
            <ul className="ml-5 list-disc space-y-1 text-sm">{data.action_items.map((a, i) => <li key={i}>{a}</li>)}</ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Summaries({ docs, initial }: { docs: Doc[]; initial: Summary[] }) {
  const { d, locale } = useI18n();
  const ready = docs.filter((x) => x.status === "ready");
  const [doc, setDoc] = useState(ready[0]?.id ?? "");
  const [length, setLength] = useState<"short" | "detailed">("short");
  const [lang, setLang] = useState<string>(locale);
  const [list, setList] = useState(initial);
  const [open, setOpen] = useState<string | null>(initial[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const working = list.filter((s) => s.status === "working").map((s) => s.id);

  useEffect(() => {
    if (!working.length) return;
    const t = setInterval(async () => {
      for (const id of working) {
        const r = await getSummary(id);
        if (r.ok && r.data.status !== "working") setList((l) => l.map((s) => (s.id === id ? r.data : s)));
      }
    }, 2000);
    return () => clearInterval(t);
  }, [working.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const field = "rounded-lg border border-line bg-card px-3 py-2.5 outline-none focus:border-accent";
  return (
    <div className="flex flex-col gap-6">
      <form className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-card p-4"
        onSubmit={(e) => { e.preventDefault(); if (!doc) return; start(async () => {
          setError(null);
          const r = await createSummary(doc, length, lang);
          if (r.ok) { setList((l) => [r.data, ...l]); setOpen(r.data.id); } else setError(r.error);
        }); }}>
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm"><span className="text-dim">{d.sum.doc}</span>
          <select value={doc} onChange={(e) => setDoc(e.target.value)} className={field}>
            {ready.map((x) => <option key={x.id} value={x.id}>{x.filename}</option>)}
          </select></label>
        <label className="flex flex-col gap-1 text-sm"><span className="text-dim">{d.sum.length}</span>
          <select value={length} onChange={(e) => setLength(e.target.value as "short" | "detailed")} className={field}>
            <option value="short">{d.sum.short}</option><option value="detailed">{d.sum.detailed}</option>
          </select></label>
        <label className="flex flex-col gap-1 text-sm"><span className="text-dim">{d.sum.lang}</span>
          <select value={lang} onChange={(e) => setLang(e.target.value)} className={field}>
            {["ky", "ru", "en"].map((l) => <option key={l} value={l}>{d.pres.langs[l]}</option>)}
          </select></label>
        <button disabled={!doc || pending} className="rounded-lg bg-accent px-5 py-2.5 font-medium text-white hover:brightness-110 disabled:opacity-40">{d.sum.make}</button>
      </form>
      {!ready.length && <p className="text-dim">{d.pres.noDocs}</p>}
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}

      <div className="flex flex-col gap-3">
        {list.length > 0 && <h2 className="text-sm font-medium text-dim">{d.sum.history}</h2>}
        {list.map((s) => (
          <div key={s.id} className="rounded-2xl border border-line bg-card">
            <button onClick={() => setOpen(open === s.id ? null : s.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
              <span className="min-w-0">
                <span className="block truncate font-medium">{s.filename}</span>
                <span className="text-xs text-dim">{s.length === "short" ? d.sum.short : d.sum.detailed} · {d.pres.langs[s.lang]} · {ago(s.created_at, d)}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${s.status === "ready" ? "bg-accent-soft text-accent" : s.status === "error" ? "bg-bad/10 text-bad" : "animate-pulse bg-sunk text-dim"}`}>
                {s.status === "working" ? d.sum.working : s.status === "ready" ? "✓" : "!"}
              </span>
            </button>
            {open === s.id && (
              <div className="border-t border-line p-4">
                {s.status === "ready" && <Result s={s} />}
                {s.status === "error" && <p className="text-sm text-bad">{s.error}</p>}
                {s.status === "working" && <p className="animate-pulse text-dim">{d.sum.working}</p>}
                <button onClick={() => start(async () => { await deleteSummary(s.id); setList((l) => l.filter((x) => x.id !== s.id)); })}
                  className="mt-4 text-xs text-dim hover:text-bad">{d.sum.delete}</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
