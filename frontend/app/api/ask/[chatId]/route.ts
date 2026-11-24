import { forward } from "@/lib/proxy";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params;
  const res = await forward(`/api/chats/${encodeURIComponent(chatId)}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await req.text(),
    signal: req.signal, // the user pressing "stop" closes the upstream request too
  });
  res.headers.set("X-Accel-Buffering", "no");
  return res;
}
