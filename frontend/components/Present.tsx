"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SlideData } from "@/lib/types";
import SlidePreview from "./SlidePreview";

type Props = {
  slides: SlideData[]; style: string; title: string; start?: number;
  imageUrl: (id: string) => string; images: Record<string, string>; onClose: () => void;
};

/** Fullscreen slideshow: arrows / space / click to move, Esc to leave. */
export default function Present({ slides, style, title, start = 0, imageUrl, images, onClose }: Props) {
  const [i, setI] = useState(start);
  const box = useRef<HTMLDivElement>(null);
  const go = useCallback((d: number) => setI((x) => Math.min(slides.length - 1, Math.max(0, x + d))), [slides.length]);

  useEffect(() => {
    box.current?.requestFullscreen?.().catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); go(1); }
      else if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); go(-1); }
      else if (e.key === "Home") setI(0);
      else if (e.key === "End") setI(slides.length - 1);
      else if (e.key === "Escape") onClose();
    };
    const onFs = () => { if (!document.fullscreenElement) onClose(); };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [go, onClose, slides.length]);

  const s = slides[i];
  return (
    <div ref={box} className="fixed inset-0 z-[100] flex items-center justify-center bg-black" onClick={() => go(1)}>
      <div className="w-full" style={{ maxWidth: "calc(100vh * 16 / 9)" }}>
        <div key={i} className="animate-[fadeIn_.35s_ease]">
          <SlidePreview slide={s} style={style} n={i + 1} total={slides.length} deckTitle={title}
            imageSrc={s.image_id ? imageUrl(s.image_id) : null} imageState={s.image_id ? (images[s.image_id] as "ready") : undefined} />
        </div>
      </div>
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/80 opacity-0 transition hover:opacity-100" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => go(-1)} aria-label="Previous"><ChevronLeft size={18} /></button>
        <span>{i + 1} / {slides.length}</span>
        <button onClick={() => go(1)} aria-label="Next"><ChevronRight size={18} /></button>
        <button onClick={onClose} aria-label="Close" className="ml-2"><X size={18} /></button>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10"><div className="h-full bg-white/60 transition-all" style={{ width: `${((i + 1) / slides.length) * 100}%` }} /></div>
    </div>
  );
}
