import type { Dict } from "./i18n";

export function ago(iso: string | null, d: Dict): string {
  if (!iso) return "";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.max(s, 1)} ${d.ago.sec}`;
  if (s < 3600) return `${Math.round(s / 60)} ${d.ago.min}`;
  if (s < 86400) return `${Math.round(s / 3600)} ${d.ago.hour}`;
  return new Date(iso).toLocaleDateString(d.ago.intl, { day: "numeric", month: "short" });
}

export function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
