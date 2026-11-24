import "server-only";
import type { Presentation } from "./types";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

export async function publicDeck(token: string): Promise<Presentation | null> {
  const res = await fetch(`${API_URL}/api/public/presentations/${encodeURIComponent(token)}`, { cache: "no-store" });
  return res.ok ? ((await res.json()) as Presentation) : null;
}
