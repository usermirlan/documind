// Mirrors backend/app/presentations/themes.py so the preview looks like the .pptx
export type DeckTheme = {
  head: string; body: string; bg: string; surface: string; text: string; muted: string;
  primary: string; accent: string; dark: string; onDark: string; radius: number; darkContent?: boolean; chart: string[];
};

const css = (f: string) => `"${f}", ${f === "Cambria" ? "Georgia, serif" : "Arial, sans-serif"}`;

export const DECK_THEMES: Record<string, DeckTheme> = {
  minimal: { head: css("Arial"), body: css("Arial"), bg: "#FFFFFF", surface: "#F4F4F5", text: "#18181B", muted: "#6B6B73", primary: "#3F3F46", accent: "#E4572E", dark: "#18181B", onDark: "#FFFFFF", radius: 0.04, chart: ["#3F3F46", "#E4572E", "#A1A1AA", "#52525B", "#F59E0B", "#D4D4D8"] },
  modern: { head: css("Calibri"), body: css("Calibri"), bg: "#FFFFFF", surface: "#F3F0FF", text: "#1E1B2E", muted: "#6B6880", primary: "#6D28D9", accent: "#06B6D4", dark: "#17132B", onDark: "#FFFFFF", radius: 0.16, chart: ["#6D28D9", "#06B6D4", "#A78BFA", "#F472B6", "#34D399", "#FBBF24"] },
  corporate: { head: css("Calibri"), body: css("Calibri"), bg: "#FFFFFF", surface: "#EEF2FB", text: "#1B2340", muted: "#5F6884", primary: "#1E2761", accent: "#F2A900", dark: "#121A42", onDark: "#FFFFFF", radius: 0.06, chart: ["#1E2761", "#F2A900", "#5B6BB5", "#9FB0E0", "#2E8B8B", "#C2C9DD"] },
  education: { head: css("Arial"), body: css("Calibri"), bg: "#FFFFFF", surface: "#FFF1F1", text: "#2B2D42", muted: "#6A6C80", primary: "#F25F5C", accent: "#247BA0", dark: "#2B2D42", onDark: "#FFFFFF", radius: 0.22, chart: ["#F25F5C", "#247BA0", "#FFC857", "#70C1B3", "#50514F", "#B2DBBF"] },
  academic: { head: css("Cambria"), body: css("Calibri"), bg: "#FFFFFF", surface: "#F4EEF1", text: "#231A1F", muted: "#6E6268", primary: "#6D2E46", accent: "#A26769", dark: "#2A1520", onDark: "#FFFFFF", radius: 0.03, chart: ["#6D2E46", "#A26769", "#D5B9B2", "#4A5759", "#B08968", "#8E9AAF"] },
  creative: { head: css("Arial"), body: css("Calibri"), bg: "#0B1F2A", surface: "#12303F", text: "#F1F5F9", muted: "#9FB3C1", primary: "#02C39A", accent: "#FFB703", dark: "#061219", onDark: "#F1F5F9", radius: 0.18, darkContent: true, chart: ["#02C39A", "#FFB703", "#00A8E8", "#FB5607", "#8338EC", "#E9EDF0"] },
};

function lum(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Same rule as the builder: white or near-black, whichever contrasts more. */
export function onColor(fill: string) {
  const l = lum(fill);
  return 1.05 / (l + 0.05) >= (l + 0.05) / (lum("#141414") + 0.05) ? "#FFFFFF" : "#141414";
}
