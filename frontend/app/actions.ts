"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { api, ApiError } from "@/lib/api";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n";
import { getDict } from "@/lib/locale";
import { getToken, TOKEN_COOKIE } from "@/lib/session";
import type { Chat, Doc, Hit, Outline, Presentation, Summary, User } from "@/lib/types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function fail(e: unknown): Promise<{ ok: false; error: string }> {
  return { ok: false, error: e instanceof ApiError ? e.message : (await getDict()).errors.server };
}

async function token(): Promise<string> {
  const t = await getToken();
  if (!t) redirect("/login");
  return t;
}

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function authenticate(_: unknown, form: FormData): Promise<{ error?: string }> {
  const mode = form.get("mode") === "register" ? "register" : "login";
  const body: Record<string, string> = { email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") };
  if (mode === "register") body.name = String(form.get("name") ?? "");
  let res: { token: string; user: User };
  try {
    res = await api(`/api/auth/${mode}`, { method: "POST", body });
  } catch (e) {
    return { error: (await fail(e)).error };
  }
  (await cookies()).set(TOKEN_COOKIE, res.token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7,
  });
  const next = String(form.get("next") || "/app");
  redirect(next.startsWith("/") ? next : "/app");
}

export async function logout() {
  (await cookies()).delete(TOKEN_COOKIE);
  redirect("/");
}

export async function listDocuments(): Promise<Doc[]> {
  return api<Doc[]>("/api/documents", { token: await token() });
}

export async function addSamples(): Promise<Result<Doc[]>> {
  try {
    const docs = await api<Doc[]>("/api/documents/samples", { method: "POST", token: await token() });
    revalidatePath("/app");
    return { ok: true, data: docs };
  } catch (e) {
    return await fail(e);
  }
}

export async function deleteDocument(id: string) {
  await api(`/api/documents/${id}`, { method: "DELETE", token: await token() });
  revalidatePath("/app");
}

export async function createChat(documentIds: string[] = []): Promise<Result<Chat>> {
  try {
    const chat = await api<Chat>("/api/chats", { method: "POST", token: await token(), body: { document_ids: documentIds } });
    revalidatePath("/app", "layout");
    return { ok: true, data: chat };
  } catch (e) {
    return await fail(e);
  }
}

export async function updateChat(id: string, patch: { title?: string; document_ids?: string[] }): Promise<Result<Chat>> {
  try {
    const chat = await api<Chat>(`/api/chats/${id}`, { method: "PATCH", token: await token(), body: patch });
    revalidatePath("/app", "layout");
    return { ok: true, data: chat };
  } catch (e) {
    return await fail(e);
  }
}

export async function deleteChat(id: string) {
  await api(`/api/chats/${id}`, { method: "DELETE", token: await token() });
  revalidatePath("/app", "layout");
  redirect("/app");
}

export async function refreshChats() {
  revalidatePath("/app", "layout");
}

export async function search(query: string, documentIds: string[] = []): Promise<Result<Hit[]>> {
  try {
    return { ok: true, data: await api<Hit[]>("/api/search", { method: "POST", token: await token(), body: { query, document_ids: documentIds } }) };
  } catch (e) {
    return await fail(e);
  }
}

// ---- presentations ---------------------------------------------------------

export type NewPresentation = {
  source: "topic" | "documents"; topic: string; document_ids: string[];
  lang: string; style: string; n_slides: number; audience: string;
};

async function call<T>(path: string, method = "GET", body?: unknown): Promise<Result<T>> {
  try {
    return { ok: true, data: await api<T>(path, { method, token: await token(), body }) };
  } catch (e) {
    return await fail(e);
  }
}

export async function createPresentation(input: NewPresentation) {
  const r = await call<Presentation>("/api/presentations", "POST", input);
  if (r.ok) revalidatePath("/app/presentations");
  return r;
}
export const getPresentation = async (id: string) => call<Presentation>(`/api/presentations/${id}`);
export const savePresentation = async (id: string, patch: { outline?: Outline; style?: string }) =>
  call<Presentation>(`/api/presentations/${id}`, "PATCH", patch);
export const generatePresentation = async (id: string) => call<Presentation>(`/api/presentations/${id}/generate`, "POST");
export const regenerateOutline = async (id: string) => call<Presentation>(`/api/presentations/${id}/outline`, "POST");

export async function deletePresentation(id: string) {
  await api(`/api/presentations/${id}`, { method: "DELETE", token: await token() });
  revalidatePath("/app/presentations");
  redirect("/app/presentations");
}

// ---- summaries -------------------------------------------------------------

export async function createSummary(document_id: string, length: string, lang: string) {
  return call<Summary>("/api/summaries", "POST", { document_id, length, lang });
}
export const getSummary = async (id: string) => call<Summary>(`/api/summaries/${id}`);
export const listSummaries = async () => call<Summary[]>("/api/summaries");
export async function deleteSummary(id: string) {
  await api(`/api/summaries/${id}`, { method: "DELETE", token: await token() });
}
