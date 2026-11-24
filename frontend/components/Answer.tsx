"use client";

import { Fragment, type ReactNode } from "react";

/** Minimal, safe Markdown for model answers: paragraphs, lists, headings, **bold**, `code`
 *  and [n] citations rendered as buttons. Everything is a React text node — no HTML injection. */
function inline(text: string, onCite: (n: number) => void, active?: number): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[\d+\](?:\[\d+\])*)/g;
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={key++} className="rounded bg-sunk px-1 font-mono text-[.85em]">{tok.slice(1, -1)}</code>);
    else
      for (const n of tok.match(/\d+/g)!.map(Number))
        out.push(
          <button key={key++} type="button" className="cite font-sans" aria-pressed={active === n} onClick={() => onCite(n)}>
            {n}
          </button>,
        );
    last = m.index! + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Answer({ text, onCite, active, streaming }: { text: string; onCite: (n: number) => void; active?: number; streaming?: boolean }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <div className={`flex flex-col gap-3 font-serif text-[17px] leading-relaxed ${streaming ? "streaming" : ""}`}>
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim());
        if (lines.length && lines.every((l) => /^\s*[-*•]\s+/.test(l)))
          return (
            <ul key={i} className="ml-5 list-disc space-y-1">
              {lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*•]\s+/, ""), onCite, active)}</li>)}
            </ul>
          );
        if (lines.length && lines.every((l) => /^\s*\d+[.)]\s+/.test(l)))
          return (
            <ol key={i} className="ml-5 list-decimal space-y-1">
              {lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*\d+[.)]\s+/, ""), onCite, active)}</li>)}
            </ol>
          );
        const heading = /^#{1,4}\s+/.test(block);
        const body = lines.map((l, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(l.replace(/^#{1,4}\s+/, ""), onCite, active)}
          </Fragment>
        ));
        return heading ? <h3 key={i} className="font-sans text-base font-semibold">{body}</h3> : <p key={i}>{body}</p>;
      })}
    </div>
  );
}
