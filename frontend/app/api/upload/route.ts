import { forward } from "@/lib/proxy";

export async function POST(req: Request) {
  const form = await req.formData();
  return forward("/api/documents", { method: "POST", body: form });
}
