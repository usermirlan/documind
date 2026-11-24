"use client";

import {
  ChevronDown, ChevronUp, Copy, Download, FileText, ImageOff, ImagePlus, LoaderCircle, PanelLeft, PanelRight,
  Play, Plus, Share2, Sparkles, Trash2, Wand2, X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { deckAI, getPresentation, savePresentation, sharePresentation, slideAI } from "@/app/actions";
import { setPath } from "@/lib/paths";
import type { Presentation, SlideData } from "@/lib/types";
import { useI18n } from "./I18n";
import Present from "./Present";
import SlidePreview from "./SlidePreview";

const STYLES = ["modern", "corporate", "minimal", "education", "academic", "creative"];
const AI_ACTIONS = ["rewrite", "shorter", "longer", "simpler", "visual"] as const;
const PICTURE_TYPES = ["title", "bullets", "quote", "conclusion", "agenda", "stats", "process", "thanks"];

export default function DeckEditor({ initial, onEditOutline }: { initial: Presentation; onEditOutline: () => void }) {
  const { d } = useI18n();
  const e = d.ed;
  const [p, setP] = useState(initial);
  const [slides, setSlides] = useState<SlideData[]>(initial.slides);
  const [cur, setCur] = useState(0);
  const [save, setSave] = useState<"idle" | "dirty" | "saving" | "saved">("idle");
  const [busy, setBusy] = useState<string | null>(null);   // which AI job is running
  const [err, setErr] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [deckPrompt, setDeckPrompt] = useState("");
  const [panel, setPanel] = useState<"none" | "ai" | "share" | "export">("none");
  const [presenting, setPresenting] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const generating = p.status === "generating";
  const pendingImages = Object.values(p.images ?? {}).filter((x) => x === "pending").length;
  const imageUrl = useCallback((iid: string) => `/api/img/${p.id}/${iid}`, [p.id]);

  // follow the model while it writes, and the image queue while it draws
  useEffect(() => {
    if (!generating && !pendingImages) return;
    const t = setInterval(async () => {
      const r = await getPresentation(p.id);
      if (!r.ok) return;
      setP(r.data);
      if (!dirty.current) setSlides(r.data.slides);
    }, generating ? 1200 : 2500);
    return () => clearInterval(t);
  }, [generating, pendingImages, p.id]);

  const persist = useCallback((next: SlideData[]) => {
    dirty.current = true;
    setSave("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSave("saving");
      const r = await savePresentation(p.id, { slides: next });
      dirty.current = false;
      if (r.ok) { setP(r.data); setSlides(r.data.slides); setSave("saved"); } else { setErr(r.error); setSave("idle"); }
    }, 800);
  }, [p.id]);

  const update = (fn: (s: SlideData[]) => SlideData[]) => setSlides((s) => { const next = fn(s); persist(next); return next; });
  const edit = (path: string, value: string) => update((s) => s.map((x, i) => (i === cur ? setPath(x, path, value) : x)));
  const patchCur = (patch: Partial<SlideData>) => update((s) => s.map((x, i) => (i === cur ? { ...x, ...patch } : x)));

  async function runAI(label: string, fn: () => Promise<{ ok: true; data: Presentation } | { ok: false; error: string }>) {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (dirty.current) { await savePresentation(p.id, { slides }); dirty.current = false; }
    setBusy(label);
    setErr(null);
    const r = await fn();
    setBusy(null);
    if (r.ok) { setP(r.data); setSlides(r.data.slides); } else setErr(r.error);
  }

  const s = slides[cur];
  const canPicture = s && PICTURE_TYPES.includes(s.type);
  const tool = "inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm hover:bg-sunk disabled:opacity-40";
  const top = "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium";
  const shareUrl = p.share_token && typeof window !== "undefined" ? `${window.location.origin}/p/${p.share_token}` : "";

  return (
    <div className="flex flex-col gap-4">
      {/* top bar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          defaultValue={p.title}
          aria-label={d.pres.deckTitle}
          onBlur={(ev) => { const v = ev.target.value.trim(); if (v && v !== p.title) start(async () => { const r = await savePresentation(p.id, { title: v }); if (r.ok) setP(r.data); }); }}
          className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 font-serif text-2xl font-semibold outline-none hover:bg-card focus:bg-card"
        />
        <span className="text-xs text-dim">{save === "saving" ? e.saving : save === "saved" ? `✓ ${e.saved}` : ""}</span>
        <select value={p.style} aria-label={d.pres.style} disabled={generating}
          onChange={(ev) => start(async () => { const r = await savePresentation(p.id, { style: ev.target.value }); if (r.ok) setP(r.data); })}
          className="rounded-lg border border-line bg-card px-2.5 py-2 text-sm">
          {STYLES.map((x) => <option key={x} value={x}>{d.pres.styles[x]}</option>)}
        </select>
        <button className={`${top} border border-line bg-card hover:bg-sunk`} disabled={generating} onClick={() => setPanel(panel === "ai" ? "none" : "ai")}><Sparkles size={16} /> {e.aiDeck}</button>
        <button className={`${top} border border-line bg-card hover:bg-sunk`} disabled={generating} onClick={() => setPanel(panel === "share" ? "none" : "share")}><Share2 size={16} /> {e.share}</button>
        <button className={`${top} border border-line bg-card hover:bg-sunk`} disabled={generating} onClick={() => setPanel(panel === "export" ? "none" : "export")}><Download size={16} /> {e.export}</button>
        <button className={`${top} bg-ink text-paper hover:bg-ink/85`} disabled={!slides.length} onClick={() => setPresenting(cur)}><Play size={16} /> {e.present}</button>
      </div>

      {panel === "ai" && (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-card p-3">
          <div className="flex gap-2">
            <input value={deckPrompt} onChange={(ev) => setDeckPrompt(ev.target.value)} placeholder={e.aiDeckPh} maxLength={1000}
              onKeyDown={(ev) => { if (ev.key === "Enter" && deckPrompt.trim()) runAI("deck", () => deckAI(p.id, deckPrompt.trim())); }}
              className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:border-accent" />
            <button disabled={!deckPrompt.trim() || !!busy} onClick={() => runAI("deck", () => deckAI(p.id, deckPrompt.trim()))}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40">{e.apply}</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {e.aiDeckIdeas.map((x) => <button key={x} onClick={() => setDeckPrompt(x)} className="rounded-full border border-line px-2.5 py-1 text-xs hover:bg-sunk">{x}</button>)}
          </div>
        </div>
      )}
      {panel === "share" && (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4">
          <p className="font-medium">{e.shareTitle}</p>
          <p className="text-sm text-dim">{p.share_token ? e.shareOn : e.shareOff}</p>
          {p.share_token ? (
            <div className="flex flex-wrap gap-2">
              <input readOnly value={shareUrl} className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-2 font-mono text-sm" onFocus={(ev) => ev.target.select()} />
              <button className={tool} onClick={() => { navigator.clipboard?.writeText(shareUrl); setCopied(true); }}>{copied ? e.copied : e.copy}</button>
              <button className={tool} onClick={() => start(async () => { const r = await sharePresentation(p.id, false); if (r.ok) setP(r.data); })}>{e.disable}</button>
            </div>
          ) : (
            <button className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white" onClick={() => start(async () => { const r = await sharePresentation(p.id, true); if (r.ok) setP(r.data); })}>{e.enable}</button>
          )}
        </div>
      )}
      {panel === "export" && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-card p-3">
          <a href={`/api/pptx/${p.id}`} className={tool}><Download size={15} /> {e.pptx}</a>
          <a href={`/app/presentations/${p.id}/print`} target="_blank" rel="noopener" className={tool}><FileText size={15} /> {e.pdf}</a>
          <span className="text-xs text-dim">{e.printHint}</span>
        </div>
      )}

      {err && <p role="alert" className="flex items-center justify-between rounded-lg border border-bad/30 bg-bad/5 px-3 py-2 text-sm text-bad">{err}<button onClick={() => setErr(null)}><X size={14} /></button></p>}
      {generating && <p className="flex items-center gap-2 text-sm text-accent"><LoaderCircle size={16} className="animate-spin" /> {e.streaming(slides.length, p.n_slides)}</p>}
      {!generating && pendingImages > 0 && <p className="flex items-center gap-2 text-sm text-dim"><LoaderCircle size={14} className="animate-spin" /> {e.imagesPending(pendingImages)}</p>}

      <div className="flex gap-4">
        {/* thumbnails rail */}
        <div className="hidden w-44 shrink-0 flex-col gap-2 md:flex">
          {slides.map((x, i) => (
            <button key={i} onClick={() => setCur(i)} aria-label={`${i + 1}`} aria-pressed={cur === i}
              className={`appear group relative overflow-hidden rounded-md border-2 text-left ${cur === i ? "border-accent" : "border-transparent hover:border-line"}`}>
              <span className="absolute top-1 left-1 z-10 rounded bg-black/50 px-1 text-[10px] text-white">{i + 1}</span>
              <div className="pointer-events-none">
                <SlidePreview slide={x} style={p.style} n={i + 1} total={slides.length} deckTitle={p.title}
                  imageSrc={x.image_id ? imageUrl(x.image_id) : null} imageState={x.image_id ? p.images?.[x.image_id] : undefined} />
              </div>
            </button>
          ))}
          {generating && Array.from({ length: Math.max(0, p.n_slides - slides.length) }).map((_, i) => (
            <div key={`sk${i}`} className="aspect-video animate-pulse rounded-md bg-sunk" />
          ))}
          {!generating && (
            <button className={`${tool} justify-center`} onClick={() => { update((s2) => [...s2.slice(0, cur + 1), { type: "bullets", title: e.newSlide, bullets: [e.newPoint] }, ...s2.slice(cur + 1)]); setCur(cur + 1); }}>
              <Plus size={14} /> {e.addSlide}
            </button>
          )}
        </div>

        {/* canvas */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {s ? (
            <>
              <div key={cur} className="appear overflow-hidden rounded-xl border border-line shadow-[0_24px_60px_-30px_rgba(29,27,23,.55)]">
                <SlidePreview slide={s} style={p.style} n={cur + 1} total={slides.length} deckTitle={p.title}
                  imageSrc={s.image_id ? imageUrl(s.image_id) : null} imageState={s.image_id ? p.images?.[s.image_id] : undefined}
                  editable={!generating && !busy} onEdit={edit} />
              </div>
              {!generating && <p className="text-xs text-dim">{e.editHint}</p>}

              {!generating && (
                <div className="flex flex-col gap-2 rounded-xl border border-line bg-card p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Wand2 size={16} className="text-accent" />
                    {AI_ACTIONS.map((a) => (
                      <button key={a} className={tool} disabled={!!busy} onClick={() => runAI(a, () => slideAI(p.id, cur, a))}>
                        {busy === a ? <LoaderCircle size={14} className="animate-spin" /> : null}{e[a]}
                      </button>
                    ))}
                    {canPicture && (
                      <button className={tool} disabled={!!busy} onClick={() => runAI("image", () => slideAI(p.id, cur, "image"))}>
                        {busy === "image" ? <LoaderCircle size={14} className="animate-spin" /> : <ImagePlus size={14} />}{s.image_id ? e.newImage : e.addImage}
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input value={custom} onChange={(ev) => setCustom(ev.target.value)} placeholder={e.custom} maxLength={500}
                      onKeyDown={(ev) => { if (ev.key === "Enter" && custom.trim()) { runAI("custom", () => slideAI(p.id, cur, "custom", custom.trim())); setCustom(""); } }}
                      className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-accent" />
                    <button className={tool} disabled={!custom.trim() || !!busy} onClick={() => { runAI("custom", () => slideAI(p.id, cur, "custom", custom.trim())); setCustom(""); }}>
                      {busy === "custom" ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-2">
                    {s.image_id && (
                      <>
                        <span className="text-xs text-dim">{e.layout}:</span>
                        <button className={tool} aria-pressed={s.layout === "image-left"} onClick={() => patchCur({ layout: "image-left" })}><PanelLeft size={14} /> {e.left}</button>
                        <button className={tool} aria-pressed={s.layout === "image-right"} onClick={() => patchCur({ layout: "image-right" })}><PanelRight size={14} /> {e.right}</button>
                        <button className={tool} onClick={() => patchCur({ image_id: "", image_prompt: "", layout: "auto" })}><ImageOff size={14} /> {e.removeImage}</button>
                        <span className="mx-1 h-5 w-px bg-line" />
                      </>
                    )}
                    <button className={tool} disabled={cur === 0} onClick={() => { update((a) => { const b = [...a]; [b[cur - 1], b[cur]] = [b[cur], b[cur - 1]]; return b; }); setCur(cur - 1); }} aria-label={e.up}><ChevronUp size={14} /></button>
                    <button className={tool} disabled={cur === slides.length - 1} onClick={() => { update((a) => { const b = [...a]; [b[cur + 1], b[cur]] = [b[cur], b[cur + 1]]; return b; }); setCur(cur + 1); }} aria-label={e.down}><ChevronDown size={14} /></button>
                    <button className={tool} onClick={() => { update((a) => [...a.slice(0, cur + 1), { ...a[cur], image_id: "" }, ...a.slice(cur + 1)]); setCur(cur + 1); }}><Copy size={14} /> {e.duplicate}</button>
                    <button className={`${tool} text-bad`} disabled={slides.length <= 1} onClick={() => { update((a) => a.filter((_, i) => i !== cur)); setCur(Math.max(0, cur - 1)); }}><Trash2 size={14} /> {e.delete}</button>
                    <button className={`${tool} ml-auto`} onClick={onEditOutline}>{d.pres.editOutline}</button>
                  </div>
                </div>
              )}

              {!generating && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-dim">{e.notes}</span>
                  <textarea key={`n${cur}`} defaultValue={s.notes ?? ""} rows={2} placeholder={e.notesPh} maxLength={1200}
                    onBlur={(ev) => { if (ev.target.value !== (s.notes ?? "")) patchCur({ notes: ev.target.value }); }}
                    className="rounded-lg border border-line bg-card px-3 py-2 outline-none focus:border-accent" />
                </label>
              )}

              {/* mobile thumbnails */}
              <div className="flex gap-2 overflow-x-auto md:hidden">
                {slides.map((x, i) => (
                  <button key={i} onClick={() => setCur(i)} className={`w-28 shrink-0 overflow-hidden rounded border-2 ${cur === i ? "border-accent" : "border-transparent"}`}>
                    <div className="pointer-events-none"><SlidePreview slide={x} style={p.style} n={i + 1} total={slides.length} deckTitle={p.title} imageSrc={x.image_id ? imageUrl(x.image_id) : null} imageState={x.image_id ? p.images?.[x.image_id] : undefined} /></div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="aspect-video animate-pulse rounded-xl bg-sunk" />
          )}
        </div>
      </div>

      {presenting !== null && (
        <Present slides={slides} style={p.style} title={p.title} start={presenting} imageUrl={imageUrl} images={p.images ?? {}} onClose={() => setPresenting(null)} />
      )}
    </div>
  );
}
