import { notFound } from "next/navigation";
import Chat from "@/components/Chat";
import { api, ApiError } from "@/lib/api";
import { requireToken } from "@/lib/session";
import type { Chat as ChatT, Doc } from "@/lib/types";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await requireToken(`/app/c/${id}`);
  let chat: ChatT;
  try {
    chat = await api<ChatT>(`/api/chats/${id}`, { token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const docs = await api<Doc[]>("/api/documents", { token });
  return <Chat key={chat.id} chat={chat} docs={docs} />;
}
