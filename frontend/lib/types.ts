export type User = { id: number; email: string; name: string };

export type Doc = {
  id: string;
  filename: string;
  mime: string;
  size: number;
  status: "processing" | "ready" | "error";
  error: string | null;
  pages: number;
  chunks_count: number;
  created_at: string;
};

export type Source = { n: number; document_id: string; filename: string; page: number; text: string };

export type Message = { id: number; role: "user" | "assistant"; content: string; sources: Source[]; created_at: string };

export type ChatSummary = { id: string; title: string; document_ids: string[]; updated_at: string };
export type Chat = ChatSummary & { messages: Message[] };

export type Hit = {
  chunk_id: number; document_id: string; filename: string; page: number; text: string;
  score: number; semantic_rank: number | null; lexical_rank: number | null;
};
