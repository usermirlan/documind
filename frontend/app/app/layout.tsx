import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import { requireToken } from "@/lib/session";
import type { ChatSummary } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const token = await requireToken();
  const chats = await api<ChatSummary[]>("/api/chats", { token });
  return (
    <div className="flex h-[calc(100dvh-3.5rem)]">
      <Sidebar chats={chats} />
      <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
