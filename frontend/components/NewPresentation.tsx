"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPresentation } from "@/app/actions";
import { DECK_THEMES } from "@/lib/themes";
import type { Doc } from "@/lib/types";
import { useI18n } from "./I18n";

const STYLES = ["modern", "corporate", "minimal", "education", "academic", "creative"];

export default function NewPresentation({ docs }: { docs: Doc[] }) {
  const { d, locale } = useI18n();
  const router = useRouter();
  const ready = docs.filter((x) => x.status === "ready");
  const [source, setSource] = useState<"topic" | "documents">("topic");
  const [topic, setTopic] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [lang, setLang] = useState<string>(locale);
  const [n, setN] = useState(8);
  const [style, setStyle] = useState("modern");
  const [audience, setAudience] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const valid = source === "topic" ? topic.trim().length >= 3 : picked.length > 0;
  const field = "w-full rounded-lg border border-line bg-card px-3 py-2.5 outline-none focus:border-accent";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setError(null);
    start(async () => {
      const r = await createPresentation({ source, topic, document_ids: picked, lang, style, n_slides: n, audience });
      if (r.ok) router.push(`/app/presentations/${r.data.id}`);
      else setError(r.error);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-7">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">{d.pres.source}</legend>
        <div className="flex gap-2">
          {(["topic", "documents"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setSource(s)} aria-pressed={source === s}
              className={`rounded-lg border px-4 py-2 text-sm ${source === s ? "border-ink bg-ink text-paper" : "border-line bg-card hover:bg-sunk"}`}>
              {s === "topic" ? d.pres.fromTopic : d.pres.fromDocs}
            </button>
          ))}
        </div>
        {source === "topic" ? (
          <>
            <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={3} maxLength={1000}
              placeholder={d.pres.topicPh} aria-label={d.pres.topic} className={`${field} resize-y`} />
            <p className="text-xs text-dim">ⓘ {d.pres.topicNote}</p>
          </>
        ) : ready.length === 0 ? (
          <p className="text-sm text-dim">{d.pres.noDocs}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {ready.map((doc) => (
              <button key={doc.id} type="button" aria-pressed={picked.includes(doc.id)}
                onClick={() => setPicked((p) => (p.includes(doc.id) ? p.filter((x) => x !== doc.id) : [...p, doc.id]))}
                className={`max-w-xs truncate rounded-full border px-3 py-1.5 text-sm ${picked.includes(doc.id) ? "border-accent bg-accent-soft text-accent" : "border-line bg-card"}`}>
                {doc.filename}
              </button>
            ))}
          </div>
        )}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{d.pres.lang}</span>
          <select value={lang} onChange={(e) => setLang(e.target.value)} className={field}>
            {["ky", "ru", "en"].map((l) => <option key={l} value={l}>{d.pres.langs[l]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{d.pres.slides}: {n}</span>
          <input type="range" min={5} max={15} value={n} onChange={(e) => setN(Number(e.target.value))} className="mt-3 accent-[var(--color-accent)]" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{d.pres.audience}</span>
          <input value={audience} onChange={(e) => setAudience(e.target.value)} maxLength={200} placeholder={d.pres.audiencePh} className={field} />
        </label>
      </div>

      <fieldset>
        <legend className="mb-3 text-sm font-medium">{d.pres.style}</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {STYLES.map((s) => {
            const t = DECK_THEMES[s];
            return (
              <button key={s} type="button" onClick={() => setStyle(s)} aria-pressed={style === s}
                className={`overflow-hidden rounded-xl border-2 text-left transition ${style === s ? "border-accent" : "border-line hover:border-accent/40"}`}>
                <div className="relative h-20 overflow-hidden" style={{ background: t.dark }}>
                  <span className="absolute -top-6 -right-4 h-20 w-20 rounded-full" style={{ background: t.primary }} />
                  <span className="absolute -right-2 bottom-1 h-9 w-9 rounded-full" style={{ background: t.accent }} />
                  <span className="absolute bottom-3 left-3 text-sm font-bold" style={{ color: t.onDark, fontFamily: t.head }}>Aa Бб Үү</span>
                </div>
                <div className="flex items-center justify-between bg-card px-3 py-2 text-sm">
                  {d.pres.styles[s]}
                  <span className="flex gap-1">{t.chart.slice(0, 3).map((c) => <span key={c} className="h-3 w-3 rounded-full" style={{ background: c }} />)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </fieldset>

      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <button disabled={!valid || pending} className="self-start rounded-lg bg-accent px-6 py-3 font-medium text-white hover:brightness-110 disabled:opacity-40">
        {pending ? "…" : d.pres.makeOutline}
      </button>
    </form>
  );
}
