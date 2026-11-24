import type { SlideData } from "./types";

/** Immutable set by dotted path: setPath(slide, "stats.1.value", "42%"). */
export function setPath(slide: SlideData, path: string, value: string): SlideData {
  const keys = path.split(".");
  const root: Record<string, unknown> = structuredClone(slide) as Record<string, unknown>;
  let cur: Record<string, unknown> | unknown[] = root;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    const next = (cur as Record<string, unknown>)[k];
    if (next === undefined || next === null) return slide;
    cur = next as Record<string, unknown>;
  }
  (cur as Record<string, unknown>)[keys[keys.length - 1]] = value;
  return root as SlideData;
}
