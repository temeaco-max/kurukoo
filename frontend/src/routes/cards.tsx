import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Plus, Snowflake, ShieldCheck, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader, EmptyState } from "@/components/app-shell";
import { Panel, SectionHeader } from "@/components/kurukoo/ui";
import { Action } from "@/components/kurukoo/primitives";
import {
  fetchCards,
  createCard,
  freezeCard,
  cancelCard,
  fetchProtectionClaims,
  type VirtualCard,
  type PurchaseProtection,
} from "@/lib/trust-api";

export const Route = createFileRoute("/cards")({
  head: () => ({
    meta: [
      { title: "One-time cards — Kurukoo" },
      {
        name: "description",
        content: "Virtual cards with single-use tokens and purchase protection.",
      },
    ],
  }),
  component: CardsPage,
});

function CardsPage() {
  const [cards, setCards] = useState<VirtualCard[]>([]);
  const [claims, setClaims] = useState<PurchaseProtection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [spendLimit, setSpendLimit] = useState("");
  const [merchantLock, setMerchantLock] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([fetchCards(), fetchProtectionClaims()]);
      setCards(c.cards);
      setClaims(p.claims);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load cards");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCreate() {
    const amount = Number(spendLimit);
    if (!amount || amount <= 0) {
      setError("Enter a valid spend limit in pence");
      return;
    }
    try {
      const input: {
        spendLimitMinor: number;
        currency: string;
        merchantLock?: string;
        expiresInHours?: number;
      } = { spendLimitMinor: amount, currency: "GBP" };
      if (merchantLock.trim()) input.merchantLock = merchantLock.trim();
      await createCard(input);
      setSpendLimit("");
      setMerchantLock("");
      setShowAdd(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create card");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="One-time cards"
        subtitle="Virtual cards with single-use tokens and purchase protection."
        action={
          <Action variant="primary" onClick={() => setShowAdd((v) => !v)}>
            <Plus className="size-3.5" /> New card
          </Action>
        }
      />
      {error && (
        <Panel className="p-4">
          <p className="text-[13px] text-destructive">{error}</p>
        </Panel>
      )}
      {showAdd && (
        <Panel className="p-4 space-y-3">
          <p className="text-[12px] text-muted-foreground">
            Create a virtual card with a spend limit. Optionally lock it to a specific merchant.
            Each card generates a single-use token at checkout.
          </p>
          <input
            value={spendLimit}
            onChange={(e) => setSpendLimit(e.target.value)}
            placeholder="Spend limit (pence, e.g. 5000 = £50)"
            inputMode="numeric"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none"
          />
          <input
            value={merchantLock}
            onChange={(e) => setMerchantLock(e.target.value)}
            placeholder="Merchant lock (optional)"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none"
          />
          <div className="flex gap-2">
            <Action variant="primary" onClick={handleCreate}>
              Create card
            </Action>
            <Action onClick={() => setShowAdd(false)}>Cancel</Action>
          </div>
        </Panel>
      )}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-elevated" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <EmptyState
          title="No cards yet"
          body="Create a virtual card for secure checkout. Each card is single-use and covered by purchase protection."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map((card) => (
            <Panel key={card.id} className="relative overflow-hidden p-5">
              <div className="absolute -right-6 -top-6 size-24 rounded-full bg-primary/10" />
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="size-5 text-primary" />
                  <span className="text-[13px] font-semibold">•••• {card.last4}</span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wide ${card.status === "active" ? "bg-[var(--color-success)]/15 text-[var(--color-success)]" : card.status === "frozen" ? "bg-accent/15 text-accent" : "bg-elevated text-muted-foreground"}`}
                >
                  {card.status}
                </span>
              </div>
              <p className="mt-3 text-[20px] font-semibold tracking-tight">
                £{(card.spendLimitMinor / 100).toFixed(2)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {card.currency}
                {card.merchantLock ? ` · locked to ${card.merchantLock}` : " · any merchant"} ·
                expires {card.expiresAt ? new Date(card.expiresAt).toLocaleDateString() : "—"}
              </p>
              <div className="mt-3 flex gap-2">
                {card.status === "active" && (
                  <Action onClick={() => freezeCard(card.id).then(() => load())}>
                    <Snowflake className="size-3" /> Freeze
                  </Action>
                )}
                <Action
                  onClick={() => {
                    if (confirm("Cancel this card?")) cancelCard(card.id).then(() => load());
                  }}
                >
                  Cancel
                </Action>
              </div>
            </Panel>
          ))}
        </div>
      )}
      {claims.length > 0 && (
        <Panel className="overflow-hidden p-0">
          <div className="border-b border-border/70 px-4 py-3">
            <SectionHeader
              title="Purchase protection claims"
              subtitle={`${claims.length} claims`}
            />
          </div>
          <ul className="divide-y divide-border/70">
            {claims.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <AlertTriangle
                  className={`size-4 shrink-0 ${c.status === "approved" ? "text-[var(--color-success)]" : c.status === "denied" ? "text-destructive" : "text-accent"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">
                    £{(c.amountMinor / 100).toFixed(2)} · {c.reason}
                  </p>{" "}
                  <p className="text-[11px] text-muted-foreground">
                    Order {c.orderRef} · {c.status} ·{" "}
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <Panel className="flex items-start gap-3 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Cards are single-use virtual tokens. Eligible purchases are covered by purchase
          protection. Real card issuance is delegated to a configured payment provider (Stripe
          Issuing or equivalent).
        </p>
      </Panel>
    </div>
  );
}
