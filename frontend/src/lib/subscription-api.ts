export type SubscriptionLedgerEntry = {
  id: number;
  event_type: string;
  direction: string;
  status: string;
  currency: string;
  gross_minor: number;
  external_reference?: string | null;
  created_at?: string;
  settled_at?: string | null;
  metadata?: Record<string, unknown>;
};

export type SubscriptionState = {
  profile: { subscriptionTier: string | null; country: string | null };
  billing: {
    product_code: string;
    tier: string;
    price_minor: number;
    currency: string;
    next_billing_date: string;
    status: string;
    failure_count: number;
    last_payment_reference?: string | null;
    updated_at?: string;
  } | null;
  provider: {
    tier: string;
    status: string;
    next_billing_date: string;
    leads_this_month?: number;
  } | null;
  billingHistory: SubscriptionLedgerEntry[];
  billingReadiness: boolean;
};

export async function fetchSubscriptionState() {
  const response = await fetch("/api/subscription/state", { credentials: "include" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      typeof payload?.error === "string"
        ? payload.error
        : `Subscription request failed (${response.status})`,
    );
  return payload as SubscriptionState;
}
