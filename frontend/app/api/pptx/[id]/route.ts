import { forward } from "@/lib/proxy";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forward(`/api/presentations/${encodeURIComponent(id)}/download`);
}
