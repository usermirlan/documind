import { forward } from "@/lib/proxy";

export async function GET(_: Request, { params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  return forward(`/api/documents/${encodeURIComponent(docId)}/file`);
}
