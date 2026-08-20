import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Auth from "@/lib/_core/auth";
import { getApiBaseUrl } from "@/constants/oauth";

const STORAGE_KEY = "kurukoo.mobile.offline-queue.v1";

type QueueKind = "chat" | "task" | "mutation";

type QueueItem = {
  id: string;
  kind: QueueKind;
  endpoint: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  payload: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: string;
  attempts: number;
};

async function readQueue(): Promise<QueueItem[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(Boolean) as QueueItem[] : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueueItem[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 100)));
}

export async function enqueueOfflineMutation(input: Omit<QueueItem, "id" | "createdAt" | "attempts" | "idempotencyKey"> & { idempotencyKey?: string }): Promise<QueueItem> {
  const item: QueueItem = {
    ...input,
    id: `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
    attempts: 0,
    idempotencyKey: input.idempotencyKey || `mobile:${input.kind}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
  };
  const queue = await readQueue();
  queue.push(item);
  await writeQueue(queue);
  return item;
}

export async function queueChatMessage(input: { message: string; conversationId?: string; contextAction?: Record<string, string | undefined> }): Promise<QueueItem> {
  return enqueueOfflineMutation({ kind: "chat", endpoint: "/api/chat/stream", method: "POST", payload: input });
}

export async function queueTaskUpdate(input: { endpoint: string; payload: Record<string, unknown>; method?: "POST" | "PUT" | "PATCH" | "DELETE"; idempotencyKey?: string }): Promise<QueueItem> {
  return enqueueOfflineMutation({ kind: "task", endpoint: input.endpoint, method: input.method || "POST", payload: input.payload, idempotencyKey: input.idempotencyKey });
}

export async function getOfflineQueue(): Promise<QueueItem[]> {
  return readQueue();
}

async function send(item: QueueItem): Promise<boolean> {
  const token = await Auth.getSessionToken();
  try {
    const response = await fetch(`${getApiBaseUrl()}${item.endpoint}`, {
      method: item.method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Idempotency-Key": item.idempotencyKey,
      },
      body: item.method === "DELETE" ? undefined : JSON.stringify(item.payload),
    });
    return response.ok || response.status === 409;
  } catch {
    return false;
  }
}

export async function drainOfflineQueue(): Promise<{ processed: number; remaining: number }> {
  const queue = await readQueue();
  if (!queue.length) return { processed: 0, remaining: 0 };
  const remaining: QueueItem[] = [];
  let processed = 0;
  for (const item of queue) {
    const ok = await send(item);
    if (ok) processed += 1;
    else remaining.push({ ...item, attempts: item.attempts + 1 });
  }
  await writeQueue(remaining);
  return { processed, remaining: remaining.length };
}

export async function clearOfflineQueue(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
