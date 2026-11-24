import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicDeck from "@/components/PublicDeck";
import { publicDeck } from "@/lib/public";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const p = await publicDeck((await params).token);
  return { title: p ? `${p.title} — DocuMind` : "DocuMind", robots: { index: false } };
}

export default async function SharedDeck({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await publicDeck(token);
  if (!p) notFound();
  return <PublicDeck p={p} token={token} />;
}
