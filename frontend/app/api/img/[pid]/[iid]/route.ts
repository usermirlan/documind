import { forward } from "@/lib/proxy";

export async function GET(_: Request, { params }: { params: Promise<{ pid: string; iid: string }> }) {
  const { pid, iid } = await params;
  return forward(`/api/presentations/${encodeURIComponent(pid)}/images/${encodeURIComponent(iid)}`);
}
