"use client";

import { FileText, Play } from "lucide-react";
import { useState } from "react";
import type { Presentation } from "@/lib/types";
import { useI18n } from "./I18n";
import Present from "./Present";
import SlidePreview from "./SlidePreview";

export default function PublicDeck({ p, token }: { p: Presentation; token: string }) {
  const { d } = useI18n();
  const [presenting, setPresenting] = useState<number | null>(null);
  const imageUrl = (iid: string) => `/api/public-img/${token}/${iid}`;
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold">{p.title}</h1>
        <div className="flex gap-2">
          <a href={`/p/${token}/print`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-2 text-sm hover:bg-sunk"><FileText size={16} /> PDF</a>
          <button onClick={() => setPresenting(0)} className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-paper"><Play size={16} /> {d.ed.present}</button>
        </div>
      </div>
      {p.slides.map((s, i) => (
        <button key={i} onClick={() => setPresenting(i)} className="appear overflow-hidden rounded-xl border border-line text-left shadow-[0_20px_50px_-30px_rgba(29,27,23,.5)]">
          <div className="pointer-events-none">
            <SlidePreview slide={s} style={p.style} n={i + 1} total={p.slides.length} deckTitle={p.title}
              imageSrc={s.image_id ? imageUrl(s.image_id) : null} imageState={s.image_id ? p.images?.[s.image_id] : undefined} />
          </div>
        </button>
      ))}
      <p className="text-center text-xs text-dim">{d.ed.madeWith}</p>
      {presenting !== null && <Present slides={p.slides} style={p.style} title={p.title} start={presenting} imageUrl={imageUrl} images={p.images ?? {}} onClose={() => setPresenting(null)} />}
    </main>
  );
}
