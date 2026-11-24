import { notFound } from "next/navigation";
import PrintDeck from "@/components/PrintDeck";
import { api } from "@/lib/api";
import { requireToken } from "@/lib/session";
import type { Presentation } from "@/lib/types";

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await requireToken(`/app/presentations/${id}/print`);
  const p = await api<Presentation>(`/api/presentations/${id}`, { token }).catch(() => null);
  if (!p || !p.slides.length) notFound();
  return <PrintDeck p={p} imageBase={`/api/img/${p.id}/`} />;
}
