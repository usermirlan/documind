import Summaries from "@/components/Summaries";
import { api } from "@/lib/api";
import { getDict } from "@/lib/locale";
import { requireToken } from "@/lib/session";
import type { Doc, Summary } from "@/lib/types";

export default async function SummariesPage() {
  const token = await requireToken("/app/summaries");
  const [docs, list, d] = await Promise.all([
    api<Doc[]>("/api/documents", { token }), api<Summary[]>("/api/summaries", { token }), getDict(),
  ]);
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-10">
      <div>
        <h1 className="font-serif text-3xl font-semibold">{d.sum.title}</h1>
        <p className="mt-1 text-dim">{d.sum.lead}</p>
      </div>
      <Summaries docs={docs} initial={list} />
    </main>
  );
}
