import { notFound } from "next/navigation";
import PresentationStudio from "@/components/PresentationStudio";
import { api, ApiError } from "@/lib/api";
import { requireToken } from "@/lib/session";
import type { Presentation } from "@/lib/types";

export default async function PresentationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await requireToken(`/app/presentations/${id}`);
  let p: Presentation;
  try {
    p = await api<Presentation>(`/api/presentations/${id}`, { token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <PresentationStudio key={p.id} initial={p} />
    </main>
  );
}
