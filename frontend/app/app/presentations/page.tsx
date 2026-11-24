import Link from "next/link";
import SlidePreview from "@/components/SlidePreview";
import { api } from "@/lib/api";
import { ago } from "@/lib/format";
import { getDict } from "@/lib/locale";
import { requireToken } from "@/lib/session";
import type { Presentation } from "@/lib/types";

export default async function PresentationsPage() {
  const token = await requireToken("/app/presentations");
  const [list, d] = await Promise.all([api<Presentation[]>("/api/presentations", { token }), getDict()]);
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold">{d.pres.title}</h1>
          <p className="mt-1 max-w-2xl text-dim">{d.pres.lead}</p>
        </div>
        <Link href="/app/presentations/new" className="rounded-lg bg-accent px-4 py-2.5 font-medium text-white hover:brightness-110">{d.pres.new}</Link>
      </div>
      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-card p-10 text-center text-dim">{d.pres.empty}</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <Link key={p.id} href={`/app/presentations/${p.id}`} className="group overflow-hidden rounded-2xl border border-line bg-card transition hover:border-accent/60 hover:shadow-md">
              <div className="pointer-events-none border-b border-line">
                <SlidePreview
                  slide={p.slides[0] ?? { type: "title", title: p.title, subtitle: (p.outline as { subtitle?: string }).subtitle ?? "" }}
                  style={p.style} n={1} total={p.slides.length || p.n_slides} deckTitle={p.title} />
              </div>
              <div className="p-4">
                <p className="truncate font-medium">{p.title}</p>
                <p className="mt-0.5 text-xs text-dim">
                  {d.pres.styles[p.style]} · {p.slides.length || p.n_slides} · {d.pres.langs[p.lang]} · {ago(p.updated_at, d)}
                </p>
                <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${p.status === "ready" ? "bg-accent-soft text-accent" : p.status === "error" ? "bg-bad/10 text-bad" : "bg-sunk text-dim"}`}>
                  {d.pres.status[p.status]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
