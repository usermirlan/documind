import Documents from "@/components/Documents";
import { api } from "@/lib/api";
import { getDict } from "@/lib/locale";
import { requireToken } from "@/lib/session";
import type { Doc } from "@/lib/types";

export default async function DocumentsPage() {
  const token = await requireToken();
  const [docs, d] = await Promise.all([api<Doc[]>("/api/documents", { token }), getDict()]);
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-10">
      <div>
        <h1 className="font-serif text-3xl font-semibold">{d.docs.title}</h1>
        <p className="mt-1 text-dim">{d.docs.lead}</p>
      </div>
      <Documents initial={docs} maxMb={Number(process.env.MAX_FILE_MB ?? 10)} />
    </main>
  );
}
