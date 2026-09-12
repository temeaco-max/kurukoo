export type CartItem = {
  id: string | number;
  name?: string;
  title?: string;
  description?: string;
  price?: number | null;
  amount?: number | null;
  currency?: string | null;
  quantity?: number;
  status?: string;
  seller?: string;
  sellerPhone?: string;
  source?: string;
  provenance?: string;
  externalUrl?: string;
};

export type CartState = {
  items: CartItem[];
  total?: number | null;
  currency?: string | null;
};

const API_BASE = (import.meta.env["VITE_KURUKOO_API_BASE_URL"] ?? "").replace(/\/$/, "");

async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { credentials: "include", ...init });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : `Kurukoo request failed (${response.status})`);
  return payload as T;
}

export async function fetchCart() {
  const payload = await readJson<{ items?: CartItem[]; total?: number | null; currency?: string | null }>("/api/cart");
  return { items: Array.isArray(payload.items) ? payload.items : [], total: payload.total ?? null, currency: payload.currency ?? null } satisfies CartState;
}

export async function removeCartItem(id: string | number) {
  return readJson<{ success: boolean }>(`/api/cart/items/${encodeURIComponent(String(id))}`, { method: "DELETE" });
}

export async function checkoutCart() {
  return readJson<{ success: boolean; orderId?: string; status?: string; requestId?: string; message?: string }>("/api/cart/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}
