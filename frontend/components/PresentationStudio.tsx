"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { deletePresentation, generatePresentation, getPresentation, regenerateOutline, savePresentation } from "@/app/actions";
import type { Outline, OutlineSlide, Presentation, SlideType } from "@/lib/types";
import { useI18n } from "./I18n";
import DeckEditor from "./DeckEditor";

const TYPES: SlideType[] = ["title", "agenda", "bullets", "comparison", "stats", "timeline", "chart", "process", "quote", "conclusion", "thanks"];

function Working({ text, hint }: { text: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-card px-6 py-16 text-center">
      <span className="h-10 w-10 animate-spin rounded-full border-4 border-accent-soft border-t-accent" aria-hidden />
      <p className="font-serif text-xl">{text}</p>
      <p className="text-sm text-dim">{hint}</p>
    </div>
  );
}

export default function PresentationStudio({ initial }: { initial: Presentation }) {
  const { d } = useI18n();
  const [p, setP] = useState(initial);
  const [outline, setOutline] = useState<Outline | null>(initial.outline?.slides ? (initial.outline as Outline) : null);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const busy = p.status === "draft_outline";

  const apply = useCallback((next: Presentation) => {
    setP(next);
    if (next.status === "generating") setEditing(false);
    if (next.outline?.slides) setOutline(next.outline as Outline);
  }, []);

  // poll while the model is working
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(async () => {
      const r = await getPresentation(p.id);
      if (r.ok) {
        apply(r.data);
        if (r.data.status === "ready") setEditing(false);
      }
    }, 2000);
    return () => clearInterval(t);
  }, [busy, p.id, apply]);

  const act = (fn: () => Promise<{ ok: true; data: Presentation } | { ok: false; error: string }>) =>
    start(async () => { setMsg(null); const r = await fn(); if (r.ok) apply(r.data); else setMsg(r.error); });

  const setSlide = (i: number, patch: Partial<OutlineSlide>) =>
    setOutline((o) => o && { ...o, slides: o.slides.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const move = (i: number, dir: -1 | 1) =>
    setOutline((o) => {
      if (!o) return o;
      const s = [...o.slides];
      const j = i + dir;
      if (j < 0 || j >= s.length) return o;
      [s[i], s[j]] = [s[j], s[i]];
      return { ...o, slides: s };
    });

  const field = "w-full rounded-lg border border-line bg-card px-3 py-2 outline-none focus:border-accent";
  const btn = "rounded-lg border border-line bg-card px-3.5 py-2 text-sm hover:bg-sunk disabled:opacity-50";
  const showOutline = outline && (p.status === "outline" || editing || (p.status === "error" && !p.slides.length));

  return (
    <div className="flex flex-col gap-6">
      <div className={`flex flex-wrap items-start justify-between gap-4 ${p.status === "ready" && !editing ? "hidden" : ""}`}>
        <div className="min-w-0">
          <h1 className="font-serif text-3xl font-semibold">{p.title}</h1>
          <p className="mt-1 text-sm text-dim">
            {p.source === "topic" ? d.pres.fromTopic : d.pres.fromDocs} · {d.pres.langs[p.lang]} · {d.pres.styles[p.style]} · {d.pres.status[p.status]}
          </p>
        </div>
        <form action={deletePresentation.bind(null, p.id)} onSubmit={(e) => { if (!confirm(d.pres.confirmDelete)) e.preventDefault(); }}>
          <button className="text-sm text-dim hover:text-bad">{d.pres.delete}</button>
        </form>
      </div>

      {p.error && <p role="alert" className="rounded-lg border border-bad/30 bg-bad/5 px-3 py-2 text-sm text-bad">{p.error}</p>}
      {msg && <p role="alert" className="rounded-lg border border-bad/30 bg-bad/5 px-3 py-2 text-sm text-bad">{msg}</p>}

      {p.status === "draft_outline" && <Working text={d.pres.outlining} hint={d.pres.waitHint} />}

      {p.status === "error" && !outline && (
        <button disabled={pending} onClick={() => act(() => regenerateOutline(p.id))} className={`${btn} self-start`}>{d.pres.regenOutline}</button>
      )}

      {!busy && showOutline && outline && (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold">{d.pres.outlineTitle}</h2>
            <p className="text-sm text-dim">{d.pres.outlineLead}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm"><span className="text-dim">{d.pres.deckTitle}</span>
              <input value={outline.title} maxLength={120} onChange={(e) => setOutline({ ...outline, title: e.target.value })} className={field} /></label>
            <label className="flex flex-col gap-1 text-sm"><span className="text-dim">{d.pres.subtitle}</span>
              <input value={outline.subtitle} maxLength={200} onChange={(e) => setOutline({ ...outline, subtitle: e.target.value })} className={field} /></label>
          </div>
          <ol className="flex flex-col gap-2">
            {outline.slides.map((s, i) => (
              <li key={i} className="flex flex-wrap items-start gap-2 rounded-xl border border-line bg-card p-3">
                <span className="mt-2 w-6 text-center font-serif text-lg text-accent">{i + 1}</span>
                <select value={s.type} onChange={(e) => setSlide(i, { type: e.target.value as SlideType })} aria-label="type"
                  className="rounded-lg border border-line bg-paper px-2 py-2 text-sm">
                  {TYPES.map((t) => <option key={t} value={t}>{d.pres.types[t]}</option>)}
                </select>
                <div className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
                  <input value={s.title} maxLength={120} onChange={(e) => setSlide(i, { title: e.target.value })} aria-label={d.pres.deckTitle} className={`${field} font-medium`} />
                  <input value={s.brief} maxLength={400} onChange={(e) => setSlide(i, { brief: e.target.value })} placeholder={d.pres.brief} aria-label={d.pres.brief} className={`${field} text-sm text-dim`} />
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => move(i, -1)} aria-label={d.pres.up} className="rounded-md border border-line px-2 py-1.5 text-sm hover:bg-sunk">↑</button>
                  <button type="button" onClick={() => move(i, 1)} aria-label={d.pres.down} className="rounded-md border border-line px-2 py-1.5 text-sm hover:bg-sunk">↓</button>
                  <button type="button" disabled={outline.slides.length <= 3}
                    onClick={() => setOutline({ ...outline, slides: outline.slides.filter((_, j) => j !== i) })}
                    aria-label={d.pres.remove} className="rounded-md border border-line px-2 py-1.5 text-sm text-bad hover:bg-bad/5 disabled:opacity-40">✕</button>
                </div>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={outline.slides.length >= 20}
              onClick={() => setOutline({ ...outline, slides: [...outline.slides.slice(0, -1), { type: "bullets", title: "…", brief: "" }, ...outline.slides.slice(-1)] })}
              className={btn}>{d.pres.addSlide}</button>
            <button type="button" disabled={pending} onClick={() => act(() => regenerateOutline(p.id))} className={btn}>{d.pres.regenOutline}</button>
            <button type="button" disabled={pending || outline.slides.some((s) => !s.title.trim())}
              onClick={() => act(async () => { const r = await savePresentation(p.id, { outline }); return r.ok ? generatePresentation(p.id) : r; })}
              className="ml-auto rounded-lg bg-accent px-5 py-2.5 font-medium text-white hover:brightness-110 disabled:opacity-50">
              {d.pres.generate}
            </button>
          </div>
        </section>
      )}

      {(p.status === "generating" || (p.status === "ready" && !editing)) && (
        <DeckEditor key={`${p.id}-${p.status}`} initial={p} onEditOutline={() => setEditing(true)} />
      )}
    </div>
  );
}
