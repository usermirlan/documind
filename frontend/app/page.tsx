import Link from "next/link";
import { redirect } from "next/navigation";
import { getDict } from "@/lib/locale";
import { getUser } from "@/lib/session";

export default async function Home() {
  if (await getUser()) redirect("/app");
  const d = await getDict();
  const L = d.landing;
  return (
    <main>
      <section className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 py-16 md:grid-cols-[1.1fr_1fr] md:py-24">
        <div className="flex flex-col gap-6">
          <span className="w-fit rounded-full border border-line bg-card px-3 py-1 text-xs text-dim">{L.badge}</span>
          <h1 className="font-serif text-4xl leading-[1.1] font-semibold tracking-tight md:text-6xl">
            {L.title1} <span className="text-accent italic">{L.title2}</span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-dim">{L.lead}</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/register" className="rounded-lg bg-ink px-5 py-3 font-medium text-paper hover:bg-ink/85">{L.cta}</Link>
            <Link href="/login" className="rounded-lg border border-line bg-card px-5 py-3 font-medium hover:bg-sunk">{d.nav.login}</Link>
          </div>
        </div>
        {/* illustrative chat card */}
        <div aria-hidden className="rounded-2xl border border-line bg-card p-5 shadow-[0_20px_60px_-30px_rgba(29,27,23,.35)]">
          <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-sm text-paper">{L.demoQ}</div>
          <div className="mt-4 max-w-[92%] font-serif text-[17px] leading-relaxed">
            {L.demoA.replace(" [1].", "")} <span className="cite" aria-pressed="true">1</span>.
          </div>
          <div className="mt-4 rounded-xl border border-line bg-paper p-3 text-sm">
            <div className="mb-1.5 flex items-center gap-2 text-xs text-dim">
              <span className="cite">1</span>{L.demoSrc}
            </div>
            <p className="leading-relaxed text-ink/80">
              {L.demoSnippet[0]}<mark className="rounded bg-mark px-0.5">{L.demoSnippet[1]}</mark>{L.demoSnippet[2]}
            </p>
          </div>
        </div>
      </section>
      <section className="border-t border-line bg-card">
        <div className="mx-auto grid max-w-[1200px] gap-8 px-5 py-14 md:grid-cols-3">
          {L.steps.map(([n, title, text]) => (
            <div key={n} className="flex gap-4">
              <span className="font-serif text-4xl text-accent">{n}</span>
              <div>
                <h2 className="font-semibold">{title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-dim">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
