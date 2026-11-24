"use client";

import type { CSSProperties, ReactElement } from "react";
import { DECK_THEMES, onColor } from "@/lib/themes";
import type { SlideData } from "@/lib/types";
import SlideIcon, { hasIcon } from "./SlideIcon";

// Slide is 13.333" wide: 1in = 7.5cqw, 1pt = 0.1042cqw (container query units)
const pt = (n: number) => `${(n * 0.1042).toFixed(3)}cqw`;
const inch = (n: number) => `${(n * 7.5).toFixed(3)}cqw`;
const IMAGE_TYPES = ["title", "bullets", "quote", "conclusion", "agenda", "stats", "process", "thanks"];
const NARROW_PIC = ["process", "stats", "agenda", "comparison", "timeline"];

export type EditFn = (path: string, value: string) => void;
type ImageState = "pending" | "ready" | "fallback" | undefined;

/** Same rule as backend image_side(): where the picture sits, or null. */
export function imageSide(s: SlideData): "left" | "right" | "top" | null {
  if (!s.image_id || s.layout === "none" || !IMAGE_TYPES.includes(s.type)) return null;
  if (s.layout && s.layout !== "auto") return s.layout.replace("image-", "") as "left" | "right" | "top";
  return ({ title: "right", quote: "left", thanks: "top", stats: "top", process: "top" } as Record<string, "left" | "right" | "top">)[s.type] ?? "right";
}

function Editable({ path, value, edit, style, multiline }: { path: string; value: string; edit?: EditFn; style?: CSSProperties; multiline?: boolean }) {
  if (!edit) return <span style={style}>{value}</span>;
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-path={path}
      onKeyDown={(e) => { if (e.key === "Enter" && !multiline) { e.preventDefault(); (e.target as HTMLElement).blur(); } }}
      onBlur={(e) => { const v = e.currentTarget.innerText.replace(/\n+/g, multiline ? "\n" : " ").trim(); if (v !== value) edit(path, v); }}
      className="rounded-[0.3cqw] outline-none hover:outline-2 hover:outline-dashed hover:outline-sky-400/70 focus:outline-2 focus:outline-sky-500"
      style={{ ...style, cursor: "text" }}
    >
      {value}
    </span>
  );
}

function Picture({ src, state, style }: { src?: string | null; state: ImageState; style: CSSProperties }) {
  if (state === "pending" || !src) {
    return (
      <div style={style} className="relative overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300">
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" style={{ ...style, objectFit: "cover" }} draggable={false} />;
}

export default function SlidePreview({
  slide, style, n, total, deckTitle, imageSrc, imageState, editable, onEdit,
}: {
  slide: SlideData; style: string; n: number; total: number; deckTitle: string;
  imageSrc?: string | null; imageState?: ImageState; editable?: boolean; onEdit?: EditFn;
}) {
  const t = DECK_THEMES[style] ?? DECK_THEMES.modern;
  const edit = editable ? onEdit : undefined;
  const side = imageSide(slide);
  const darkSlide = ["title", "conclusion", "thanks"].includes(slide.type) || !!t.darkContent;
  const fg = darkSlide ? t.onDark : t.text;
  const card: CSSProperties = { background: t.surface, borderRadius: inch(t.radius * 1.2) };
  const titleStyle: CSSProperties = { fontFamily: t.head, fontWeight: 700, color: fg, fontSize: pt((slide.title?.length ?? 0) > 40 ? 28 : 34), lineHeight: 1.1 };
  const body: CSSProperties = { fontFamily: t.body, color: fg };
  const icons = slide.icons ?? [];
  const mark = (i: number, label: string | number, fill: string, d = 0.55, size = 14): ReactElement => (
    <span style={{ width: inch(d), height: inch(d), minWidth: inch(d), borderRadius: "50%", background: fill, color: onColor(fill), fontSize: pt(size), fontWeight: 700, display: "grid", placeItems: "center" }}>
      {hasIcon(icons[i]) ? <SlideIcon name={icons[i]} size={inch(d * 0.5)} color={onColor(fill)} /> : label}
    </span>
  );
  const sidePic = side && !["title", "thanks"].includes(slide.type) ? (side === "left" ? "left" : "right") : null;
  const narrow = !!sidePic;

  let content: ReactElement;
  switch (slide.type) {
    case "title": {
      const pic = !!side;
      content = (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          {pic ? (
            <Picture src={imageSrc} state={imageState} style={{ position: "absolute", right: 0, top: 0, width: "50%", height: "100%" }} />
          ) : (
            <>
              <span style={{ position: "absolute", borderRadius: "50%", background: t.primary, width: inch(6.2), height: inch(6.2), right: inch(-1.6), top: inch(-1.2) }} />
              <span style={{ position: "absolute", borderRadius: "50%", background: t.accent, width: inch(3.6), height: inch(3.6), right: inch(-0.6), bottom: inch(-0.1) }} />
            </>
          )}
          <div style={{ position: "absolute", left: inch(0.65), width: pic ? "40%" : "60%", top: "28%" }}>
            <div style={{ ...titleStyle, fontSize: pt((slide.title?.length ?? 0) < 45 ? 44 : 36) }}><Editable path="title" value={slide.title ?? ""} edit={edit} /></div>
            {(slide.subtitle || edit) && <div style={{ ...body, fontSize: pt(20), marginTop: inch(0.3) }}><Editable path="subtitle" value={slide.subtitle ?? ""} edit={edit} /></div>}
          </div>
        </div>
      );
      break;
    }
    case "thanks": {
      const pic = !!side;
      content = (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          {pic ? (
            <>
              <Picture src={imageSrc} state={imageState} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
              <div style={{ position: "absolute", inset: 0, background: t.dark, opacity: 0.62 }} />
            </>
          ) : (
            <>
              <span style={{ position: "absolute", borderRadius: "50%", background: t.primary, width: inch(4.6), height: inch(4.6), left: inch(-1.6), bottom: inch(-1.4) }} />
              <span style={{ position: "absolute", borderRadius: "50%", background: t.accent, width: inch(3.2), height: inch(3.2), right: inch(-0.8), top: inch(-1) }} />
            </>
          )}
          <div style={{ position: "absolute", left: inch(1.5), right: inch(1.5), top: "32%", textAlign: "center" }}>
            <div style={{ ...titleStyle, color: t.onDark, fontSize: pt(44) }}><Editable path="title" value={slide.title ?? ""} edit={edit} /></div>
            {(slide.subtitle || edit) && <div style={{ ...body, color: t.onDark, fontSize: pt(20), marginTop: inch(0.3) }}><Editable path="subtitle" value={slide.subtitle ?? ""} edit={edit} /></div>}
          </div>
        </div>
      );
      break;
    }
    case "agenda":
      content = (
        <div style={{ display: "grid", gridTemplateColumns: (slide.bullets?.length ?? 0) > 3 && !narrow ? "1fr 1fr" : "1fr", gap: inch(0.18), columnGap: inch(0.5) }}>
          {slide.bullets?.map((b, i) => (
            <div key={i} style={{ ...card, display: "flex", alignItems: "center", gap: inch(0.25), padding: inch(0.2) }}>
              {mark(i, String(i + 1).padStart(2, "0"), t.primary, 0.6, 14)}
              <span style={{ ...body, fontSize: pt(18) }}><Editable path={`bullets.${i}`} value={b} edit={edit} /></span>
            </div>
          ))}
        </div>
      );
      break;
    case "comparison":
      content = (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: inch(0.5) }}>
          {(["left", "right"] as const).map((k, i) => { const c = slide[k]; return c && (
            <div key={k} style={{ ...card, padding: inch(0.35) }}>
              <div style={{ background: i ? t.accent : t.primary, color: onColor(i ? t.accent : t.primary), borderRadius: 999, textAlign: "center", fontFamily: t.head, fontWeight: 700, fontSize: pt(18), padding: inch(0.12) }}>
                <Editable path={`${k}.heading`} value={c.heading} edit={edit} />
              </div>
              <ul style={{ ...body, fontSize: pt(17), marginTop: inch(0.3), paddingLeft: inch(0.3), listStyle: "disc" }}>
                {c.points.map((p, j) => <li key={j} style={{ marginBottom: inch(0.12) }}><Editable path={`${k}.points.${j}`} value={p} edit={edit} /></li>)}
              </ul>
            </div>
          ); })}
        </div>
      );
      break;
    case "stats":
      content = (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${slide.stats?.length ?? 1}, 1fr)`, gap: inch(0.35), marginTop: inch(0.25) }}>
            {slide.stats?.map((s, i) => (
              <div key={i} style={{ ...card, padding: inch(0.3), textAlign: "center", minHeight: inch(3) }}>
                {hasIcon(icons[i]) && <div style={{ display: "flex", justifyContent: "center", marginTop: inch(0.1) }}><SlideIcon name={icons[i]} size={inch(0.45)} color={i % 2 ? t.accent : t.primary} /></div>}
                <div style={{ fontFamily: t.head, fontWeight: 700, color: i % 2 ? t.accent : t.primary, fontSize: pt(narrow ? 38 : s.value.length <= 5 ? 56 : 42), marginTop: inch(hasIcon(icons[i]) ? 0.1 : 0.4), whiteSpace: "nowrap" }}>
                  <Editable path={`stats.${i}.value`} value={s.value} edit={edit} />
                </div>
                <div style={{ ...body, color: t.muted, fontSize: pt(15), marginTop: inch(0.2) }}><Editable path={`stats.${i}.label`} value={s.label} edit={edit} /></div>
              </div>
            ))}
          </div>
          {(slide.subtitle || edit) && <div style={{ ...body, color: t.muted, fontStyle: "italic", fontSize: pt(15), marginTop: inch(0.35) }}><Editable path="subtitle" value={slide.subtitle ?? ""} edit={edit} /></div>}
        </div>
      );
      break;
    case "timeline":
      content = (
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${slide.events?.length ?? 1}, 1fr)`, marginTop: inch(0.6) }}>
          <span style={{ position: "absolute", left: 0, right: 0, top: inch(1.27), height: 2, background: t.muted }} />
          {slide.events?.map((e, i, arr) => (
            <div key={i} style={{ textAlign: "center", padding: `0 ${inch(0.08)}` }}>
              <div style={{ fontFamily: t.head, fontWeight: 700, color: t.darkContent ? t.accent : t.primary, fontSize: pt(20), height: inch(1.05), display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                <Editable path={`events.${i}.when`} value={e.when} edit={edit} />
              </div>
              <span style={{ display: "inline-block", width: inch(0.34), height: inch(0.34), borderRadius: "50%", background: i === arr.length - 1 ? t.accent : t.primary, marginTop: inch(0.05) }} />
              <div style={{ ...body, fontSize: pt(14), marginTop: inch(0.25) }}><Editable path={`events.${i}.text`} value={e.text} edit={edit} /></div>
            </div>
          ))}
        </div>
      );
      break;
    case "process":
      content = (
        <div style={{ display: "flex", gap: inch(0.35), marginTop: inch(0.2) }}>
          {slide.steps?.map((s, i, arr) => (
            <div key={i} style={{ ...card, flex: 1, padding: inch(0.25), minHeight: inch(4) }}>
              {mark(i, i + 1, i === arr.length - 1 ? t.accent : t.primary, 0.7, 18)}
              <div style={{ fontFamily: t.head, fontWeight: 700, color: fg, fontSize: pt(narrow ? 15 : 18), marginTop: inch(0.45) }}><Editable path={`steps.${i}.title`} value={s.title} edit={edit} /></div>
              <div style={{ ...body, color: t.muted, fontSize: pt(narrow ? 12.5 : 14), marginTop: inch(0.12) }}><Editable path={`steps.${i}.text`} value={s.text} edit={edit} /></div>
            </div>
          ))}
        </div>
      );
      break;
    case "chart": {
      const c = slide.chart!;
      const max = Math.max(...c.values, 1);
      const sum = c.values.reduce((a, b) => a + b, 0) || 1;
      let acc = 0;
      const pie = c.values.map((v, i) => { const from = (acc / sum) * 360; acc += v; return `${t.chart[i % t.chart.length]} ${from}deg ${(acc / sum) * 360}deg`; }).join(", ");
      const topIdx = c.values.indexOf(max);
      content = (
        <div style={{ display: "flex", gap: inch(0.4), height: inch(4.6) }}>
          <div style={{ flex: slide.takeaway ? 1.6 : 1, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: inch(0.3) }}>
            {c.kind === "pie" ? (
              <div style={{ display: "flex", alignItems: "center", gap: inch(0.5), height: "100%" }}>
                <div style={{ width: inch(3.6), height: inch(3.6), borderRadius: "50%", background: `conic-gradient(${pie})`, WebkitMask: "radial-gradient(circle, transparent 42%, #000 43%)", mask: "radial-gradient(circle, transparent 42%, #000 43%)" }} />
                <div style={{ ...body, fontSize: pt(13) }}>
                  {c.labels.map((l, i) => <div key={i}><span style={{ display: "inline-block", width: inch(0.15), height: inch(0.15), background: t.chart[i % t.chart.length], marginRight: inch(0.1) }} />{l} — {c.values[i]}{c.unit}</div>)}
                </div>
              </div>
            ) : (
              c.values.map((v, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                  <span style={{ ...body, fontSize: pt(13), fontWeight: 700 }}>{v}{c.unit}</span>
                  <span style={{ width: "70%", height: `${(v / max) * 80}%`, background: i === topIdx ? t.accent : t.primary, marginTop: inch(0.05), borderRadius: `${inch(0.06)} ${inch(0.06)} 0 0` }} />
                  <span style={{ ...body, fontSize: pt(12), marginTop: inch(0.08), textAlign: "center" }}>{c.labels[i]}</span>
                </div>
              ))
            )}
          </div>
          {(slide.takeaway || edit) && (
            <div style={{ ...card, flex: 1, display: "flex", alignItems: "center", padding: inch(0.35), fontFamily: t.head, fontWeight: 700, color: fg, fontSize: pt(19) }}>
              <Editable path="takeaway" value={slide.takeaway ?? ""} edit={edit} />
            </div>
          )}
        </div>
      );
      break;
    }
    case "quote":
      content = (
        <div style={{ ...card, position: "absolute", left: 0, right: 0, top: inch(0.55), bottom: inch(0.4), padding: `${inch(1)} ${inch(narrow ? 0.7 : 1.3)}` }}>
          <div style={{ position: "absolute", left: inch(0.4), top: inch(0.05), fontFamily: t.head, fontSize: pt(110), color: t.accent, lineHeight: 1 }}>“</div>
          <div style={{ fontFamily: t.head, fontStyle: "italic", color: fg, fontSize: pt((slide.quote?.length ?? 0) < 120 && !narrow ? 28 : 22), marginTop: inch(0.4) }}>
            <Editable path="quote" value={slide.quote ?? ""} edit={edit} multiline />
          </div>
          {(slide.author || edit) && <div style={{ ...body, color: t.muted, fontWeight: 700, fontSize: pt(17), marginTop: inch(0.5) }}>— <Editable path="author" value={slide.author ?? ""} edit={edit} /></div>}
        </div>
      );
      break;
    case "conclusion":
      content = (
        <div>
          {slide.bullets?.map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: inch(0.3), marginBottom: inch(0.3) }}>
              {mark(i, "✓", t.accent, 0.55, 15)}
              <span style={{ ...body, fontSize: pt(19) }}><Editable path={`bullets.${i}`} value={b} edit={edit} /></span>
            </div>
          ))}
          {(slide.takeaway || edit) && (
            <span style={{ display: "inline-block", marginTop: inch(0.4), background: t.primary, color: onColor(t.primary), borderRadius: 999, padding: `${inch(0.15)} ${inch(0.35)}`, fontWeight: 700, fontFamily: t.body, fontSize: pt(17) }}>
              <Editable path="takeaway" value={slide.takeaway ?? ""} edit={edit} />
            </span>
          )}
        </div>
      );
      break;
    default: // bullets
      content = slide.takeaway && !narrow ? (
        <div style={{ display: "flex", gap: inch(0.6) }}>
          <ul style={{ ...body, flex: 1.6, fontSize: pt(19), paddingLeft: inch(0.3), listStyle: "disc" }}>
            {slide.bullets?.map((b, i) => <li key={i} style={{ marginBottom: inch(0.15) }}><Editable path={`bullets.${i}`} value={b} edit={edit} /></li>)}
          </ul>
          <div style={{ ...card, background: t.primary, flex: 1, display: "flex", alignItems: "center", padding: inch(0.45), minHeight: inch(4), color: onColor(t.primary), fontFamily: t.head, fontWeight: 700, fontStyle: "italic", fontSize: pt(22) }}>
            <Editable path="takeaway" value={slide.takeaway} edit={edit} multiline />
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: inch(0.15) }}>
          {slide.bullets?.map((b, i) => (
            <div key={i} style={{ ...card, display: "flex", alignItems: "center", gap: inch(0.3), padding: `${inch(0.17)} ${inch(0.22)}` }}>
              {mark(i, i + 1, i === 0 ? t.accent : t.primary, 0.5, 13)}
              <span style={{ ...body, fontSize: pt(narrow ? 16 : 18) }}><Editable path={`bullets.${i}`} value={b} edit={edit} /></span>
            </div>
          ))}
          {slide.takeaway && (
            <div style={{ ...card, background: t.primary, color: onColor(t.primary), padding: `${inch(0.2)} ${inch(0.3)}`, fontFamily: t.head, fontWeight: 700, fontStyle: "italic", fontSize: pt(16), marginTop: inch(0.15) }}>
              <Editable path="takeaway" value={slide.takeaway} edit={edit} multiline />
            </div>
          )}
        </div>
      );
  }

  const full = ["title", "thanks"].includes(slide.type);
  const picW = NARROW_PIC.includes(slide.type) ? 3.6 : 5.0;
  const frame: CSSProperties = sidePic === "left"
    ? { left: inch(picW + 0.55), right: inch(0.65) }
    : sidePic === "right" ? { left: inch(0.65), right: inch(picW + 0.55) } : { left: inch(0.65), right: inch(0.65) };
  return (
    <div style={{ containerType: "inline-size" }} className="w-full">
      <div style={{ position: "relative", aspectRatio: "16 / 9", background: darkSlide ? t.dark : t.bg, overflow: "hidden" }}>
        {full ? content : (
          <>
            {sidePic && (
              <Picture src={imageSrc} state={imageState}
                style={{ position: "absolute", top: 0, bottom: 0, width: inch(picW), height: "100%", ...(sidePic === "left" ? { left: 0 } : { right: 0 }) }} />
            )}
            <div style={{ position: "absolute", ...frame, top: inch(0.45), bottom: inch(0.7) }}>
              <div style={{ ...titleStyle, minHeight: inch(0.95), display: "flex", alignItems: "center" }}><Editable path="title" value={slide.title ?? ""} edit={edit} /></div>
              <div style={{ marginTop: inch(0.35), position: "relative", height: `calc(100% - ${inch(1.3)})` }}>{content}</div>
            </div>
          </>
        )}
        {!full && (
          <div style={{ position: "absolute", ...frame, bottom: inch(0.22), display: "flex", justifyContent: "space-between", fontFamily: t.body, fontSize: pt(11), color: darkSlide ? t.onDark : t.muted }}>
            <span>{deckTitle}</span><span>{n} / {total}</span>
          </div>
        )}
      </div>
    </div>
  );
}
