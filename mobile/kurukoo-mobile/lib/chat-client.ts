import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: number | string;
  role: ChatRole;
  content: string;
  createdAt?: string;
};

export type ChatStreamEvent =
  | { type: "conversation"; conversationId?: string; messageId?: number | string; assistantMessageId?: number | string }
  | { type: "delta"; text?: string }
  | { type: "done"; fullReply?: string; conversationId?: string; assistantMessageId?: number | string; diagnostics?: Record<string, unknown>; cardData?: unknown }
  | { type: "error"; error?: string; message?: string }
  | { type: string; [key: string]: unknown };

function endpoint(path: string) {
  return `${getApiBaseUrl()}${path}`;
}

async function requestHeaders(): Promise<Record<string, string>> {
  const token = await Auth.getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(typeof payload?.error === "string" ? payload.error : `Chat request failed (${response.status})`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return payload as T;
}

export async function loadChatMessages(conversationId?: string): Promise<{ messages: ChatMessage[]; conversationId?: string }> {
  const query = new URLSearchParams({ limit: "50" });
  if (conversationId) query.set("conversationId", conversationId);
  const response = await fetch(endpoint(`/api/chat/messages?${query.toString()}`), {
    credentials: "include",
    headers: await requestHeaders(),
  });
  if (response.status === 401) return { messages: [], conversationId };
  const payload = await parseJsonResponse<{ messages?: ChatMessage[]; conversationId?: string }>(response);
  return { messages: Array.isArray(payload.messages) ? payload.messages : [], conversationId: payload.conversationId ?? conversationId };
}

export async function streamChatMessage(input: {
  message: string;
  conversationId?: string;
  contextAction?: Record<string, string | undefined>;
  onEvent: (event: ChatStreamEvent) => void;
  signal?: AbortSignal;
}): Promise<{ conversationId?: string; assistantMessageId?: number | string; reply: string; diagnostics?: Record<string, unknown>; cardData?: unknown }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  Object.assign(headers, await requestHeaders());
  const response = await fetch(endpoint("/api/chat/stream"), {
    method: "POST",
    credentials: "include",
    headers,
    signal: input.signal,
    body: JSON.stringify({
      message: input.message.trim(),
      conversationId: input.conversationId,
      channel: "mobile",
      contextAction: input.contextAction,
    }),
  });
  if (!response.ok || !response.body) {
    await parseJsonResponse(response);
    throw new Error(`Chat stream failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let conversationId = input.conversationId;
  let reply = "";
  let assistantMessageId: number | string | undefined;
  let diagnostics: Record<string, unknown> | undefined;
  let cardData: unknown;

  const consume = (chunk: string) => {
    buffer += chunk;
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const data = frame.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
      if (!data || data === "[DONE]") continue;
      try {
        const event = JSON.parse(data) as ChatStreamEvent;
        input.onEvent(event);
        const record = event as Record<string, unknown>;
        if (event.type === "conversation" && typeof record.conversationId === "string") conversationId = record.conversationId;
        if ((event.type === "conversation" || event.type === "done") && (typeof record.assistantMessageId === "number" || typeof record.assistantMessageId === "string")) assistantMessageId = record.assistantMessageId;
        if (event.type === "delta" && typeof record.text === "string") reply += record.text;
        if (event.type === "done") {
          if (typeof record.conversationId === "string") conversationId = record.conversationId;
          if (typeof record.fullReply === "string") reply = record.fullReply;
          if (record.diagnostics && typeof record.diagnostics === "object") diagnostics = record.diagnostics as Record<string, unknown>;
          cardData = record.cardData;
        }
      } catch {
        input.onEvent({ type: "error", error: "The Chat response was not readable." });
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    consume(decoder.decode(value, { stream: true }));
  }
  consume(decoder.decode());
  return { conversationId, assistantMessageId, reply, diagnostics, cardData };
}

export async function loadChatFeedback(messageIds: Array<number | string>): Promise<Record<string, "up" | "down">> {
  const ids = messageIds.filter((id) => Number.isSafeInteger(Number(id)) && Number(id) > 0).join(",");
  if (!ids) return {};
  const response = await fetch(endpoint(`/api/chat/feedback?messageIds=${encodeURIComponent(ids)}`), { credentials: "include", headers: await requestHeaders() });
  if (response.status === 401) return {};
  const payload = await parseJsonResponse<{ feedback?: Array<{ messageId: number; rating: "up" | "down" }> }>(response);
  return Object.fromEntries((payload.feedback || []).map((item) => [String(item.messageId), item.rating]));
}

export async function saveChatFeedback(messageId: number | string, rating: "up" | "down"): Promise<void> {
  const response = await fetch(endpoint("/api/chat/feedback"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", ...(await requestHeaders()) }, body: JSON.stringify({ messageId: Number(messageId), rating }) });
  await parseJsonResponse(response);
}
