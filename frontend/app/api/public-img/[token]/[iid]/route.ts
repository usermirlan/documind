const API_URL = process.env.API_URL ?? "http://localhost:8000";

// shared decks: no session needed, the share token is the permission
export async function GET(_: Request, { params }: { params: Promise<{ token: string; iid: string }> }) {
  const { token, iid } = await params;
  const res = await fetch(`${API_URL}/api/public/presentations/${encodeURIComponent(token)}/images/${encodeURIComponent(iid)}`, { cache: "no-store" });
  return new Response(res.body, { status: res.status, headers: { "content-type": res.headers.get("content-type") ?? "image/jpeg", "cache-control": "public, max-age=86400" } });
}
