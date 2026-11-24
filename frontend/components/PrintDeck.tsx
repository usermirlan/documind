"use client";

import { useEffect } from "react";
import type { Presentation } from "@/lib/types";
import { useI18n } from "./I18n";
import SlidePreview from "./SlidePreview";

/** One slide per PDF page (13.333in × 7.5in); opens the browser's print dialog once images are in. */
export default function PrintDeck({ p, imageBase }: { p: Presentation; imageBase: string }) {
  const { d } = useI18n();
  useEffect(() => {
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(".print-slide img"));
    Promise.all(imgs.map((i) => (i.complete ? Promise.resolve() : new Promise((r) => { i.onload = i.onerror = r; }))))
      .then(() => setTimeout(() => window.print(), 300));
  }, []);
  return (
    <div className="bg-sunk print:bg-white">
      <p className="no-print mx-auto max-w-3xl px-5 py-4 text-center text-sm text-dim">{d.ed.printHint}</p>
      <div className="flex flex-col items-center gap-6 pb-10 print:gap-0 print:pb-0">
        {p.slides.map((s, i) => (
          <div key={i} className="print-slide w-full max-w-5xl shadow-lg print:max-w-none print:shadow-none">
            <SlidePreview slide={s} style={p.style} n={i + 1} total={p.slides.length} deckTitle={p.title}
              imageSrc={s.image_id ? imageBase + s.image_id : null} imageState={s.image_id ? (p.images?.[s.image_id] === "pending" ? "pending" : "ready") : undefined} />
          </div>
        ))}
      </div>
    </div>
  );
}
