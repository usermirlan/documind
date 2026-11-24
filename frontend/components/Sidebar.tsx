"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { createChat } from "@/app/actions";
import { ago } from "@/lib/format";
import type { ChatSummary } from "@/lib/types";
import { useI18n } from "./I18n";

export default function Sidebar({ chats }: { chats: ChatSummary[] }) {
  const { d } = useI18n();
  const path = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();
  const item = (active: boolean) =>
    `block rounded-lg px-3 py-2 text-sm ${active ? "bg-card font-medium shadow-sm ring-1 ring-line" : "text-ink/80 hover:bg-card/70"}`;

  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-4 border-r border-line bg-sunk/60 p-3 md:flex">
      <button
        disabled={pending}
        onClick={() => start(async () => { const r = await createChat(); if (r.ok) router.push(`/app/c/${r.data.id}`); })}
        className="rounded-lg bg-ink px-3 py-2.5 text-sm font-medium text-paper hover:bg-ink/85 disabled:opacity-60"
      >
        + {d.docs.newChat}
      </button>
      <nav className="flex flex-col gap-0.5">
        <Link href="/app" className={item(path === "/app")}>📄 {d.nav.documents}</Link>
        <Link href="/app/search" className={item(path === "/app/search")}>🔎 {d.nav.search}</Link>
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-dim uppercase">{d.docs.chats}</p>
        {chats.length === 0 && <p className="px-3 text-sm text-dim">{d.docs.noChats}</p>}
        <div className="flex flex-col gap-0.5">
          {chats.map((c) => (
            <Link key={c.id} href={`/app/c/${c.id}`} className={item(path === `/app/c/${c.id}`)}>
              <span className="block truncate">{c.title}</span>
              <span className="block text-[11px] text-dim">{ago(c.updated_at, d)}</span>
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
