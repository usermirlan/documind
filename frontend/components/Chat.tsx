"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { deleteChat, refreshChats, updateChat } from "@/app/actions";
import type { Chat as ChatT, Doc, Message, Source } from "@/lib/types";
import Answer from "./Answer";
import { useI18n } from "./I18n";

type Live = { question: string; text: string; sources: Source[]; error: string | null; phase: "search" | "write" | "done" };
type Selected = { sources: Source[]; n: number; q?: string } | null;

/** Mark the question's words in the cited passage so the reader sees why it matched. */
function Highlight({ text, q }: { text: string; q?: string }) {
  const words = (q ?? "").toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? [];
  if (!words.length) return <>{text}</>;
  // prefix match tolerates Kyrgyz/Russian endings (күн ~ күндөр)
  const stems = [...new Set(words.map((w) => w.slice(0, Math.max(4, w.length - 2))))];
  const re = new RegExp(`(${stems.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})[\\p{L}]*`, "giu");
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    out.push(text.slice(last, m.index), <mark key={m.index} className="rounded bg-mark px-0.5">{m[0]}</mark>);
    last = m.index! + m[0].length;
  }
  out.push(text.slice(last));
  return <>{out}</>;
}

function parseSSE(buffer: string): { events: { event: string; data: any }[]; rest: string } {
  const events = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const block of parts) {
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    try { events.push({ event, data: JSON.parse(data) }); } catch { /* ignore keep-alives */ }
  }
  return { events, rest };
}

function SourceList({ sources, active, onPick }: { sources: Source[]; active?: number; onPick: (n: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {sources.map((s) => (
        <button key={s.n} onClick={() => onPick(s.n)}
          className={`flex max-w-[16rem] items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${active === s.n ? "border-accent bg-accent-soft" : "border-line bg-card hover:border-accent/50"}`}>
          <span className="cite !m-0">{s.n}</span>
          <span className="truncate">{s.filename}</span>
          <span className="shrink-0 text-dim">· {s.page}</span>
        </button>
      ))}
    </div>
  );
}

export default function Chat({ chat, docs }: { chat: ChatT; docs: Doc[] }) {
  const { d } = useI18n();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(chat.messages);
  const [scope, setScope] = useState<string[]>(chat.document_ids);
  const [input, setInput] = useState("");
  const [live, setLive] = useState<Live | null>(null);
  const [selected, setSelected] = useState<Selected>(null);
  const [showPage, setShowPage] = useState(false);
  const [, start] = useTransition();
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const ready = docs.filter((x) => x.status === "ready");
  const busy = live !== null && live.phase !== "done";

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length, live?.text, live?.phase]);
  useEffect(() => () => abort.current?.abort(), []);

  function toggleScope(id: string | null) {
    const next = id === null ? [] : scope.includes(id) ? scope.filter((x) => x !== id) : [...scope, id];
    setScope(next);
    start(async () => { await updateChat(chat.id, { document_ids: next }); });
  }

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    setInput("");
    setSelected(null);
    const now = new Date().toISOString();
    const state: Live = { question, text: "", sources: [], error: null, phase: "search" };
    setLive({ ...state });
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const res = await fetch(`/api/ask/${chat.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }), signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.detail === "string" ? body.detail : d.errors.server);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const parsed = parseSSE(buf + decoder.decode(value, { stream: true }));
        buf = parsed.rest;
        for (const { event, data } of parsed.events) {
          if (event === "sources") { state.sources = data; state.phase = "write"; }
          else if (event === "token") state.text += data.t;
          else if (event === "error") state.error = data.message;
          else if (event === "done") state.phase = "done";
        }
        setLive({ ...state });
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") state.error = (e as Error).message || d.errors.server;
    }
    // fold the finished exchange into the history
    const added: Message[] = [{ id: -Date.now(), role: "user", content: question, sources: [], created_at: now }];
    if (state.text) added.push({ id: -Date.now() - 1, role: "assistant", content: state.text, sources: state.sources, created_at: new Date().toISOString() });
    setMessages((m) => [...m, ...added]);
    setLive(state.error ? { ...state, text: "", phase: "done" } : null);
    abort.current = null;
    if (state.text && state.sources.length) setSelected({ sources: state.sources, n: 1, q: question });
    refreshChats();
    router.refresh();
  }

  const src = selected?.sources.find((s) => s.n === selected.n);
  const srcDoc = src && docs.find((x) => x.id === src.document_id);

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* scope */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-paper px-5 py-2.5 text-xs">
          <span className="mr-1 text-dim">{d.chat.scope}</span>
          <button onClick={() => toggleScope(null)} aria-pressed={scope.length === 0}
            className={`rounded-full border px-2.5 py-1 ${scope.length === 0 ? "border-ink bg-ink text-paper" : "border-line bg-card"}`}>{d.chat.all}</button>
          {ready.map((doc) => (
            <button key={doc.id} onClick={() => toggleScope(doc.id)} aria-pressed={scope.includes(doc.id)}
              className={`max-w-[14rem] truncate rounded-full border px-2.5 py-1 ${scope.includes(doc.id) ? "border-accent bg-accent-soft text-accent" : "border-line bg-card"}`}>
              {doc.filename}
            </button>
          ))}
          <form action={deleteChat.bind(null, chat.id)} className="ml-auto" onSubmit={(e) => { if (!confirm(d.chat.confirmDelete)) e.preventDefault(); }}>
            <button className="text-dim hover:text-bad">{d.chat.delete}</button>
          </form>
        </div>

        {/* messages */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-3xl flex-col gap-8 px-5 py-8">
            {messages.length === 0 && !live && (
              <div className="flex flex-col items-center gap-5 py-10 text-center">
                <p className="max-w-md font-serif text-xl text-dim">{ready.length ? d.chat.empty : d.chat.noDocs}</p>
                {ready.length ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    {d.chat.suggestions.map((s) => (
                      <button key={s} onClick={() => ask(s)} className="rounded-full border border-line bg-card px-3.5 py-1.5 text-sm hover:border-accent/60">{s}</button>
                    ))}
                  </div>
                ) : (
                  <Link href="/app" className="rounded-lg bg-ink px-4 py-2 text-sm text-paper">{d.chat.toDocs}</Link>
                )}
              </div>
            )}
            {messages.map((m, idx) =>
              m.role === "user" ? (
                <div key={m.id} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 whitespace-pre-wrap text-paper">{m.content}</div>
              ) : (
                <div key={m.id} className="flex flex-col gap-3">
                  <Answer text={m.content} active={selected?.sources === m.sources ? selected.n : undefined}
                    onCite={(n) => { setSelected({ sources: m.sources, n, q: messages[idx - 1]?.content }); setShowPage(false); }} />
                  {m.sources.length > 0 && (
                    <SourceList sources={m.sources} active={selected?.sources === m.sources ? selected.n : undefined}
                      onPick={(n) => { setSelected({ sources: m.sources, n, q: messages[idx - 1]?.content }); setShowPage(false); }} />
                  )}
                </div>
              ),
            )}
            {live && (
              <>
                {live.phase !== "done" && (
                  <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 whitespace-pre-wrap text-paper">{live.question}</div>
                )}
                {live.phase === "search" && <p className="animate-pulse text-sm text-dim">{d.chat.thinking}</p>}
                {live.text && (
                  <Answer text={live.text} streaming={live.phase === "write"} onCite={(n) => setSelected({ sources: live.sources, n, q: live.question })} />
                )}
                {live.phase === "write" && live.sources.length > 0 && (
                  <SourceList sources={live.sources} onPick={(n) => setSelected({ sources: live.sources, n, q: live.question })} />
                )}
                {live.error && <p role="alert" className="rounded-lg border border-bad/30 bg-bad/5 px-3 py-2 text-sm text-bad">{live.error}</p>}
              </>
            )}
            <div ref={bottom} />
          </div>
        </div>

        {/* composer */}
        <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="border-t border-line bg-paper px-5 py-4">
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-line bg-card p-2 focus-within:border-accent">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }}
              placeholder={d.chat.placeholder}
              aria-label={d.chat.placeholder}
              rows={1}
              maxLength={2000}
              className="max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-2 outline-none"
            />
            {busy ? (
              <button type="button" onClick={() => abort.current?.abort()} className="rounded-xl border border-line px-4 py-2 text-sm hover:bg-sunk">{d.chat.stop}</button>
            ) : (
              <button disabled={!input.trim() || !ready.length} className="rounded-xl bg-ink px-4 py-2 text-sm font-medium text-paper disabled:opacity-40">{d.chat.send}</button>
            )}
          </div>
        </form>
      </div>

      {/* source viewer */}
      {src && (
        <aside className="absolute inset-y-14 right-0 z-30 flex w-full max-w-md flex-col border-l border-line bg-card shadow-xl lg:static lg:inset-auto lg:w-[28rem] lg:shadow-none">
          <div className="flex items-start justify-between gap-3 border-b border-line p-4">
            <div className="min-w-0">
              <p className="text-xs text-dim">{d.chat.sources} · <span className="cite !ml-0">{src.n}</span></p>
              <p className="truncate font-medium">{src.filename}</p>
              <p className="text-sm text-dim">{d.chat.page(src.page)}</p>
            </div>
            <button onClick={() => setSelected(null)} aria-label={d.chat.close} className="rounded p-1 text-dim hover:bg-sunk">✕</button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            <blockquote className="rounded-xl border-l-4 border-accent bg-paper p-4 font-serif leading-relaxed whitespace-pre-wrap"><Highlight text={src.text} q={selected?.q} /></blockquote>
            {srcDoc?.mime === "application/pdf" && (
              showPage ? (
                <iframe key={`${src.document_id}-${src.page}`} title={src.filename}
                  src={`/api/file/${src.document_id}#page=${src.page}`} className="min-h-[32rem] w-full flex-1 rounded-lg border border-line" />
              ) : (
                <button onClick={() => setShowPage(true)} className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-sunk">📄 {d.chat.openPage}</button>
              )
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
