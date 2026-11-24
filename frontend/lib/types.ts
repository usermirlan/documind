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

export type SlideType = "title" | "agenda" | "bullets" | "comparison" | "stats" | "timeline" | "chart" | "process" | "quote" | "conclusion" | "thanks";
export type OutlineSlide = { type: SlideType; title: string; brief: string };
export type Outline = { title: string; subtitle: string; slides: OutlineSlide[] };
export type SlideData = {
  type: SlideType; title?: string; subtitle?: string; bullets?: string[]; takeaway?: string;
  left?: { heading: string; points: string[] }; right?: { heading: string; points: string[] };
  stats?: { value: string; label: string }[]; events?: { when: string; text: string }[];
  steps?: { title: string; text: string }[];
  chart?: { kind: "bar" | "column" | "pie" | "line"; labels: string[]; values: number[]; unit?: string };
  quote?: string; author?: string; notes?: string;
  layout?: "auto" | "image-left" | "image-right" | "image-top" | "none";
  image_prompt?: string; image_id?: string; icons?: string[];
};
export type Presentation = {
  id: string; title: string; source: "topic" | "documents"; topic: string; document_ids: string[];
  lang: "ky" | "ru" | "en"; style: string; n_slides: number; audience: string;
  status: "draft_outline" | "outline" | "generating" | "ready" | "error"; error: string | null;
  outline: Outline | Record<string, never>; slides: SlideData[]; created_at: string; updated_at: string;
  images: Record<string, "pending" | "ready" | "fallback">; share_token: string | null;
};
export type SummaryData = {
  summary: string; key_points: string[];
  dates: { date: string; what: string; page?: number | null }[];
  names: { name: string; role: string; page?: number | null }[];
  numbers: { value: string; what: string; page?: number | null }[];
  action_items: string[];
};
export type Summary = {
  id: string; document_id: string; filename: string; length: "short" | "detailed"; lang: string;
  status: "working" | "ready" | "error"; error: string | null; data: SummaryData | Record<string, never>; created_at: string;
};
