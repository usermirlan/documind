"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { addSamples, createChat, deleteDocument, listDocuments } from "@/app/actions";
import { ago, size } from "@/lib/format";
import type { Doc } from "@/lib/types";
import { useI18n } from "./I18n";

const ICON: Record<string, string> = { "application/pdf": "PDF", "text/plain; charset=utf-8": "TXT" };

export default function Documents({ initial, maxMb }: { initial: Doc[]; maxMb: number }) {
  const { d } = useI18n();
  const router = useRouter();
  const [docs, setDocs] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const [over, setOver] = useState(false);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => setDocs(await listDocuments()), []);

  // poll while anything is still being indexed
  useEffect(() => {
    if (!docs.some((x) => x.status === "processing")) return;
    const t = setInterval(refresh, 1500);
    return () => clearInterval(t);
  }, [docs, refresh]);

  async function upload(files: FileList | File[]) {
    setError(null);
    for (const file of Array.from(files)) {
      setUploading((n) => n + 1);
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) setError(`${file.name}: ${typeof body.detail === "string" ? body.detail : res.status}`);
      } catch {
        setError(d.errors.server);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    await refresh();
  }

  const ready = docs.filter((x) => x.status === "ready");

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files); }}
        className={`flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${over ? "border-accent bg-accent-soft" : "border-line bg-card hover:border-accent/60"}`}
      >
        <span className="font-serif text-3xl">⇪</span>
        <span className="font-medium">{uploading ? d.docs.uploading : d.docs.drop}</span>
        <span className="text-sm text-dim">{d.docs.formats(maxMb)}</span>
      </button>
      <input ref={input} type="file" multiple hidden accept=".pdf,.docx,.txt,.md"
        onChange={(e) => { if (e.target.files) upload(e.target.files); e.target.value = ""; }} />
      {error && <p role="alert" className="rounded-lg border border-bad/30 bg-bad/5 px-3 py-2 text-sm text-bad">{error}</p>}

      {docs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-card p-8 text-center">
          <p className="text-dim">{d.docs.empty} {d.docs.samplesHint}</p>
          <button disabled={pending} onClick={() => start(async () => { const r = await addSamples(); if (r.ok) setDocs(await listDocuments()); else setError(r.error); })}
            className="rounded-lg border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-accent-soft disabled:opacity-60">
            {d.docs.samples}
          </button>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          {docs.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
              <span className="grid h-10 w-9 shrink-0 place-items-center rounded-md border border-line bg-paper text-[10px] font-bold text-dim">
                {ICON[doc.mime] ?? (doc.mime.includes("word") ? "DOC" : "FILE")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{doc.filename}</p>
                <p className="text-xs text-dim">
                  {size(doc.size)} · {ago(doc.created_at, d)}
                  {doc.status === "ready" && ` · ${doc.pages} ${d.docs.pages} · ${doc.chunks_count} ${d.docs.chunks}`}
                </p>
                {doc.status === "error" && <p className="mt-1 text-xs text-bad">{doc.error}</p>}
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${doc.status === "ready" ? "bg-accent-soft text-accent" : doc.status === "error" ? "bg-bad/10 text-bad" : "animate-pulse bg-sunk text-dim"}`}>
                {d.docs.status[doc.status]}
              </span>
              <button
                onClick={() => { if (confirm(d.docs.confirmDelete)) start(async () => { await deleteDocument(doc.id); await refresh(); }); }}
                className="text-xs text-dim hover:text-bad">{d.docs.delete}</button>
            </li>
          ))}
        </ul>
      )}

      {ready.length > 0 && (
        <button disabled={pending}
          onClick={() => start(async () => { const r = await createChat(); if (r.ok) router.push(`/app/c/${r.data.id}`); })}
          className="self-start rounded-lg bg-accent px-5 py-3 font-medium text-white hover:brightness-110 disabled:opacity-60">
          {d.docs.ask} →
        </button>
      )}
    </div>
  );
}
