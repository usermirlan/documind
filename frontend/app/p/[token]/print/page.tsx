import { notFound } from "next/navigation";
import PrintDeck from "@/components/PrintDeck";
import { publicDeck } from "@/lib/public";

export default async function SharedPrint({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await publicDeck(token);
  if (!p) notFound();
  return <PrintDeck p={p} imageBase={`/api/public-img/${token}/`} />;
}
