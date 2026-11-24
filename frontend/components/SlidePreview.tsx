import type { CSSProperties, ReactElement } from "react";
import { DECK_THEMES, onColor } from "@/lib/themes";
import type { SlideData } from "@/lib/types";

// Slide is 13.333" wide: 1in = 7.5cqw, 1pt = 0.1042cqw (container query units)
const pt = (n: number) => `${(n * 0.1042).toFixed(3)}cqw`;
const inch = (n: number) => `${(n * 7.5).toFixed(3)}cqw`;

export default function SlidePreview({ slide, style, n, total, deckTitle }: { slide: SlideData; style: string; n: number; total: number; deckTitle: string }) {
  const t = DECK_THEMES[style] ?? DECK_THEMES.modern;
  const darkSlide = ["title", "conclusion", "thanks"].includes(slide.type) || !!t.darkContent;
  const fg = darkSlide ? t.onDark : t.text;
  const card: CSSProperties = { background: t.surface, borderRadius: inch(t.radius * 1.2) };
  const titleStyle: CSSProperties = { fontFamily: t.head, fontWeight: 700, color: fg, fontSize: pt((slide.title?.length ?? 0) > 40 ? 28 : 34), lineHeight: 1.1 };
  const body: CSSProperties = { fontFamily: t.body, color: fg };
  const badge = (label: string | number, fill = t.primary, d = 0.55, size = 14): ReactElement => (
    <span style={{ width: inch(d), height: inch(d), minWidth: inch(d), borderRadius: "50%", background: fill, color: onColor(fill), fontSize: pt(size), fontWeight: 700, display: "grid", placeItems: "center" }}>{label}</span>
  );

  let content: ReactElement;
  switch (slide.type) {
    case "title":
    case "thanks": {
      const center = slide.type === "thanks";
      content = (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          <span style={{ position: "absolute", borderRadius: "50%", background: t.primary, width: inch(center ? 4.6 : 6.2), height: inch(center ? 4.6 : 6.2), ...(center ? { left: inch(-1.6), bottom: inch(-1.4) } : { right: inch(-1.6), top: inch(-1.2) }) }} />
          <span style={{ position: "absolute", borderRadius: "50%", background: t.accent, width: inch(center ? 3.2 : 3.6), height: inch(center ? 3.2 : 3.6), ...(center ? { right: inch(-0.8), top: inch(-1) } : { right: inch(-0.6), bottom: inch(-0.1) }) }} />
          <div style={{ position: "absolute", left: inch(center ? 1.5 : 0.65), right: inch(center ? 1.5 : 4.6), top: "30%", textAlign: center ? "center" : "left" }}>
            <div style={{ ...titleStyle, fontSize: pt(center ? 44 : (slide.title?.length ?? 0) < 45 ? 44 : 36) }}>{slide.title}</div>
            {slide.subtitle && <div style={{ ...body, fontSize: pt(20), marginTop: inch(0.3) }}>{slide.subtitle}</div>}
          </div>
        </div>
      );
      break;
    }
    case "agenda":
      content = (
        <div style={{ display: "grid", gridTemplateColumns: (slide.bullets?.length ?? 0) > 3 ? "1fr 1fr" : "1fr", gap: inch(0.2), columnGap: inch(0.5) }}>
          {slide.bullets?.map((b, i) => (
            <div key={i} style={{ ...card, display: "flex", alignItems: "center", gap: inch(0.25), padding: inch(0.22) }}>
              {badge(String(i + 1).padStart(2, "0"), t.primary, 0.6, 14)}
              <span style={{ ...body, fontSize: pt(18) }}>{b}</span>
            </div>
          ))}
        </div>
      );
      break;
    case "comparison":
      content = (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: inch(0.5) }}>
          {[slide.left, slide.right].map((c, i) => c && (
            <div key={i} style={{ ...card, padding: inch(0.35) }}>
              <div style={{ background: i ? t.accent : t.primary, color: onColor(i ? t.accent : t.primary), borderRadius: 999, textAlign: "center", fontFamily: t.head, fontWeight: 700, fontSize: pt(18), padding: inch(0.12) }}>{c.heading}</div>
              <ul style={{ ...body, fontSize: pt(17), marginTop: inch(0.3), paddingLeft: inch(0.3), listStyle: "disc" }}>
                {c.points.map((p, j) => <li key={j} style={{ marginBottom: inch(0.12) }}>{p}</li>)}
              </ul>
            </div>
          ))}
        </div>
      );
      break;
    case "stats":
      content = (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${slide.stats?.length ?? 1}, 1fr)`, gap: inch(0.4), marginTop: inch(0.25) }}>
            {slide.stats?.map((s, i) => (
              <div key={i} style={{ ...card, padding: inch(0.35), textAlign: "center", minHeight: inch(3) }}>
                <div style={{ fontFamily: t.head, fontWeight: 700, color: i % 2 ? t.accent : t.primary, fontSize: pt(s.value.length <= 5 ? 56 : 42), marginTop: inch(0.4) }}>{s.value}</div>
                <div style={{ ...body, color: t.muted, fontSize: pt(15), marginTop: inch(0.2) }}>{s.label}</div>
              </div>
            ))}
          </div>
          {slide.subtitle && <div style={{ ...body, color: t.muted, fontStyle: "italic", fontSize: pt(15), marginTop: inch(0.35) }}>{slide.subtitle}</div>}
        </div>
      );
      break;
    case "timeline":
      content = (
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${slide.events?.length ?? 1}, 1fr)`, marginTop: inch(0.6) }}>
          <span style={{ position: "absolute", left: 0, right: 0, top: inch(1.27), height: 2, background: t.muted }} />
          {slide.events?.map((e, i, arr) => (
            <div key={i} style={{ textAlign: "center", padding: `0 ${inch(0.08)}` }}>
              <div style={{ fontFamily: t.head, fontWeight: 700, color: t.darkContent ? t.accent : t.primary, fontSize: pt(20), height: inch(1.05), display: "flex", alignItems: "flex-end", justifyContent: "center" }}>{e.when}</div>
              <span style={{ display: "inline-block", width: inch(0.34), height: inch(0.34), borderRadius: "50%", background: i === arr.length - 1 ? t.accent : t.primary, marginTop: inch(0.05) }} />
              <div style={{ ...body, fontSize: pt(14), marginTop: inch(0.25) }}>{e.text}</div>
            </div>
          ))}
        </div>
      );
      break;
    case "process":
      content = (
        <div style={{ display: "flex", gap: inch(0.45), marginTop: inch(0.2) }}>
          {slide.steps?.map((s, i, arr) => (
            <div key={i} style={{ ...card, flex: 1, padding: inch(0.3), minHeight: inch(4) }}>
              {badge(i + 1, i === arr.length - 1 ? t.accent : t.primary, 0.7, 18)}
              <div style={{ fontFamily: t.head, fontWeight: 700, color: fg, fontSize: pt(18), marginTop: inch(0.5) }}>{s.title}</div>
              <div style={{ ...body, color: t.muted, fontSize: pt(14), marginTop: inch(0.12) }}>{s.text}</div>
            </div>
          ))}
        </div>
      );
      break;
    case "chart": {
      const c = slide.chart!;
      const max = Math.max(...c.values, 1);
      const total = c.values.reduce((a, b) => a + b, 0) || 1;
      let acc = 0;
      const pie = c.values.map((v, i) => { const from = (acc / total) * 360; acc += v; return `${t.chart[i % t.chart.length]} ${from}deg ${(acc / total) * 360}deg`; }).join(", ");
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
                  <span style={{ width: "70%", height: `${(v / max) * 80}%`, background: i === topIdx ? t.accent : t.primary, marginTop: inch(0.05) }} />
                  <span style={{ ...body, fontSize: pt(12), marginTop: inch(0.08), textAlign: "center" }}>{c.labels[i]}</span>
                </div>
              ))
            )}
          </div>
          {slide.takeaway && (
            <div style={{ ...card, flex: 1, display: "flex", alignItems: "center", padding: inch(0.35), fontFamily: t.head, fontWeight: 700, color: fg, fontSize: pt(19) }}>{slide.takeaway}</div>
          )}
        </div>
      );
      break;
    }
    case "quote":
      content = (
        <div style={{ ...card, position: "absolute", left: inch(0.65), right: inch(0.65), top: inch(1), bottom: inch(1.1), padding: `${inch(1)} ${inch(1.3)}` }}>
          <div style={{ position: "absolute", left: inch(0.5), top: inch(0.1), fontFamily: t.head, fontSize: pt(110), color: t.accent, lineHeight: 1 }}>“</div>
          <div style={{ fontFamily: t.head, fontStyle: "italic", color: fg, fontSize: pt((slide.quote?.length ?? 0) < 120 ? 28 : 22), marginTop: inch(0.5) }}>{slide.quote}</div>
          {slide.author && <div style={{ ...body, color: t.muted, fontWeight: 700, fontSize: pt(17), marginTop: inch(0.5) }}>— {slide.author}</div>}
        </div>
      );
      break;
    case "conclusion":
      content = (
        <div>
          {slide.bullets?.map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: inch(0.3), marginBottom: inch(0.3) }}>
              {badge("✓", t.accent, 0.55, 15)}
              <span style={{ ...body, fontSize: pt(19) }}>{b}</span>
            </div>
          ))}
          {slide.takeaway && (
            <span style={{ display: "inline-block", marginTop: inch(0.4), background: t.primary, color: onColor(t.primary), borderRadius: 999, padding: `${inch(0.15)} ${inch(0.35)}`, fontWeight: 700, fontFamily: t.body, fontSize: pt(17) }}>{slide.takeaway}</span>
          )}
        </div>
      );
      break;
    default: // bullets
      content = slide.takeaway ? (
        <div style={{ display: "flex", gap: inch(0.6) }}>
          <ul style={{ ...body, flex: 1.6, fontSize: pt(19), paddingLeft: inch(0.3), listStyle: "disc" }}>
            {slide.bullets?.map((b, i) => <li key={i} style={{ marginBottom: inch(0.15) }}>{b}</li>)}
          </ul>
          <div style={{ ...card, background: t.primary, flex: 1, display: "flex", alignItems: "center", padding: inch(0.45), minHeight: inch(4), color: onColor(t.primary), fontFamily: t.head, fontWeight: 700, fontStyle: "italic", fontSize: pt(22) }}>{slide.takeaway}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: inch(0.15) }}>
          {slide.bullets?.map((b, i) => (
            <div key={i} style={{ ...card, display: "flex", alignItems: "center", gap: inch(0.3), padding: `${inch(0.18)} ${inch(0.22)}` }}>
              {badge(i + 1, i === 0 ? t.accent : t.primary, 0.5, 13)}
              <span style={{ ...body, fontSize: pt(18) }}>{b}</span>
            </div>
          ))}
        </div>
      );
  }

  const full = ["title", "thanks", "quote"].includes(slide.type);
  return (
    <div style={{ containerType: "inline-size" }} className="w-full">
      <div style={{ position: "relative", aspectRatio: "16 / 9", background: darkSlide ? t.dark : t.bg, overflow: "hidden" }}>
        {full ? content : (
          <div style={{ position: "absolute", left: inch(0.65), right: inch(0.65), top: inch(0.45), bottom: inch(0.7) }}>
            <div style={{ ...titleStyle, height: inch(0.95), display: "flex", alignItems: "center" }}>{slide.title}</div>
            <div style={{ marginTop: inch(0.35) }}>{content}</div>
          </div>
        )}
        {!["title", "thanks"].includes(slide.type) && (
          <div style={{ position: "absolute", left: inch(0.65), right: inch(0.65), bottom: inch(0.22), display: "flex", justifyContent: "space-between", fontFamily: t.body, fontSize: pt(11), color: darkSlide ? t.onDark : t.muted }}>
            <span>{deckTitle}</span><span>{n} / {total}</span>
          </div>
        )}
      </div>
    </div>
  );
}
