import SearchInspector from "@/components/SearchInspector";
import { getDict } from "@/lib/locale";

export default async function SearchPage() {
  const d = await getDict();
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-10">
      <div>
        <h1 className="font-serif text-3xl font-semibold">{d.search.title}</h1>
        <p className="mt-1 leading-relaxed text-dim">{d.search.lead}</p>
      </div>
      <SearchInspector />
    </main>
  );
}
