import "server-only";
import { getLocale } from "./locale";
import { getToken } from "./session";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

/** Forward a browser request to the API with the session token (kept in an httpOnly cookie). */
export async function forward(path: string, init: RequestInit & { duplex?: "half" } = {}): Promise<Response> {
  const token = await getToken();
  if (!token) return Response.json({ detail: "unauthorized" }, { status: 401 });
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept-Language", await getLocale());
  const res = await fetch(`${API_URL}${path}`, { ...init, headers, cache: "no-store" });
  // pass the body through untouched so SSE and files stream to the browser
  const out = new Headers();
  for (const h of ["content-type", "content-disposition", "cache-control"]) {
    const v = res.headers.get(h);
    if (v) out.set(h, v);
  }
  return new Response(res.body, { status: res.status, headers: out });
}
