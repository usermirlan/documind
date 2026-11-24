import NewPresentation from "@/components/NewPresentation";
import { api } from "@/lib/api";
import { getDict } from "@/lib/locale";
import { requireToken } from "@/lib/session";
import type { Doc } from "@/lib/types";

export default async function NewPresentationPage() {
  const token = await requireToken("/app/presentations/new");
  const [docs, d] = await Promise.all([api<Doc[]>("/api/documents", { token }), getDict()]);
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-10">
      <div>
        <h1 className="font-serif text-3xl font-semibold">{d.pres.new.replace("+ ", "")}</h1>
        <p className="mt-1 text-dim">{d.pres.lead}</p>
      </div>
      <NewPresentation docs={docs} />
    </main>
  );
}
