import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, CreditCard, History, LoaderCircle, Receipt, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { PlanCard } from "@/components/kurukoo/cards";
import { Panel, StatusPill, Tabs } from "@/components/kurukoo/ui";
import { plans } from "@/lib/kurukoo-demo";
import { fetchSubscriptionState, type SubscriptionState } from "@/lib/subscription-api";

export const Route = createFileRoute("/subscriptions")({
  head: () => ({ meta: [{ title: "Subscriptions — Kurukoo" }, { name: "description", content: "View your Kurukoo plan, billing state and subscription history." }] }),
  component: SubscriptionsPage,
});

const tabs = ["You", "Providers", "Businesses", "Creators"] as const;
const money = (minor: number, currency: string) => new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(minor / 100);
const when = (value?: string | null) => value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

function SubscriptionsPage() {
  const [tab, setTab] = useState<string>(tabs[0]);
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [changing, setChanging] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchSubscriptionState().then((next) => { if (!cancelled) setState(next); }).catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Subscription state is unavailable."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const audience = tab === "You" ? "user" : tab === "Providers" ? "provider" : tab === "Businesses" ? "business" : "creator";
  const selectedPlans = plans.filter((p) => p.audience === audience);
  const currentTier = state?.billing?.tier ?? state?.provider?.tier ?? state?.profile.subscriptionTier ?? null;
  const currentBilling = state?.billing ?? null;
  const history = useMemo(() => state?.billingHistory ?? [], [state]);

  async function choosePlan(planId: string) {
    if (audience !== "user") { setActionMessage("This account surface can display the plan catalogue for this audience; provider/business subscription mutations use their existing canonical flows."); return; }
    const country = state?.profile.country || "ng";
    if (!window.confirm(`Continue with the ${planId} plan using the canonical subscription checkout?`)) return;
    setChanging(planId); setActionMessage("");
    try {
      const response = await fetch("/api/subscription/upgrade", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: planId, country }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload?.message === "string" ? payload.message : typeof payload?.error === "string" ? payload.error : `Subscription change failed (${response.status})`);
      setActionMessage(typeof payload?.message === "string" ? payload.message : "Subscription updated.");
      setState(await fetchSubscriptionState());
    } catch (cause) { setActionMessage(cause instanceof Error ? cause.message : "Subscription change could not be completed."); }
    finally { setChanging(null); }
  }

  return <div className="space-y-8 pb-10">
    <PageHeader title="Subscriptions" subtitle="Your plan is an account entitlement. Billing events and other payments stay visible as separate records." />
    <Tabs items={tabs} value={tab} onChange={setTab} />

    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Panel className="p-5 sm:p-6">
        <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-elevated"><ShieldCheck className="size-[18px]" /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Your subscription</p><h2 className="mt-1.5 text-[22px] font-semibold tracking-tight">{currentTier || "No active paid tier recorded"}</h2><p className="mt-1 text-[12px] text-muted-foreground">{currentBilling ? `${currentBilling.status.replace(/[_-]/g, " ")} · ${currentBilling.product_code}` : state?.provider ? `${state.provider.status.replace(/[_-]/g, " ")} provider tier` : "No recurring billing record is currently attached to this account."}</p></div>{currentBilling ? <StatusPill tone={currentBilling.status === "active" ? "green" : "peach"}>{currentBilling.status.replace(/[_-]/g, " ")}</StatusPill> : null}</div>
        {loading ? <div className="mt-6 h-24 animate-pulse bg-elevated" /> : error ? <p className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-[12px] text-muted-foreground">{error}</p> : <div className="mt-6 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2"><div className="bg-background p-4"><p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Billing cycle</p><p className="mt-1 text-[13px] font-medium">{currentBilling ? "Monthly" : "Not recorded"}</p></div><div className="bg-background p-4"><p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Next charge</p><p className="mt-1 text-[13px] font-medium">{currentBilling ? when(currentBilling.next_billing_date) : "Not scheduled"}</p></div><div className="bg-background p-4"><p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Payment method</p><p className="mt-1 text-[13px] font-medium">{currentBilling?.last_payment_reference ? `Reference ${currentBilling.last_payment_reference}` : "Selected during checkout"}</p></div><div className="bg-background p-4"><p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Billing readiness</p><p className="mt-1 text-[13px] font-medium">{currentBilling ? "Recurring state recorded" : "No recurring state recorded"}</p></div></div>}
        {actionMessage ? <p className="mt-4 rounded-xl border border-border bg-elevated/50 p-3 text-[11.5px] leading-5 text-muted-foreground" role="status">{actionMessage}</p> : null}
      </Panel>
      <Panel className="p-5 sm:p-6"><div className="flex items-center gap-2"><CreditCard className="size-4" /><p className="text-[12px] font-semibold">Account controls</p></div><p className="mt-2 text-[11.5px] leading-5 text-muted-foreground">Changing a paid plan is a consequential action. Kurukoo sends it through the authenticated subscription service and only refreshes the page from the resulting canonical state.</p><Link to="/usage" className="mt-4 inline-flex items-center gap-1 text-[11px] font-medium hover:text-primary">View Usage <span aria-hidden="true">→</span></Link></Panel>
    </section>

    <section>
      <div className="mb-4"><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Plans</p><h2 className="mt-1 text-[20px] font-semibold">Available {tab.toLowerCase()} plans</h2></div>
      <div className="grid gap-3 sm:grid-cols-2">{selectedPlans.map((p) => <div key={p.id} className="relative"><PlanCard plan={p} /><button type="button" onClick={() => void choosePlan(p.id)} disabled={changing !== null} className="absolute bottom-4 right-4 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[11.5px] font-medium text-primary-foreground disabled:opacity-50">{changing === p.id ? <LoaderCircle className="size-3.5 animate-spin" /> : null}{currentTier?.toLowerCase() === p.id.toLowerCase() ? "Current plan" : "Choose plan"}</button></div>)}</div>
    </section>

    <section>
      <div className="mb-4 flex items-end gap-2"><History className="size-4 text-muted-foreground" /><div><h2 className="text-[17px] font-semibold">Billing history</h2><p className="mt-0.5 text-[11.5px] text-muted-foreground">Subscription charges and refunds recorded in the commercial ledger.</p></div></div>
      {history.length ? <div className="overflow-x-auto border border-border"><table className="w-full min-w-[680px] text-left"><thead className="border-b border-border bg-elevated/50"><tr>{["Date","Event","Plan","Amount","Status","Reference"].map((label) => <th key={label} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{history.map((entry) => <tr key={entry.id}><td className="px-4 py-3 text-[11.5px]">{when(entry.created_at)}</td><td className="px-4 py-3 text-[11.5px]">{entry.event_type.replace(/_/g, " ")}</td><td className="px-4 py-3 text-[11.5px]">{String(entry.metadata?.plan ?? entry.metadata?.tier ?? "Subscription")}</td><td className="px-4 py-3 text-[11.5px]">{money(Number(entry.gross_minor || 0), entry.currency)}</td><td className="px-4 py-3"><StatusPill tone={entry.status === "settled" ? "green" : entry.status === "failed" ? "peach" : "blue"}>{entry.status}</StatusPill></td><td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{entry.external_reference || "—"}</td></tr>)}</tbody></table></div> : <Panel className="p-5"><div className="flex items-start gap-3"><Receipt className="mt-0.5 size-4 text-muted-foreground" /><div><p className="text-[13px] font-medium">No subscription billing events recorded</p><p className="mt-1 text-[11.5px] leading-5 text-muted-foreground">This is a truthful empty state; it does not imply that a charge, invoice or recurring payment exists.</p></div></div></Panel>}
    </section>

    <Panel className="p-5"><p className="text-[12.5px] font-semibold">Payments stay separate</p><p className="mt-1.5 text-[11.5px] leading-5 text-muted-foreground">Provider services, purchases, Points and other account transactions are not folded into this subscription history. Use the existing Wallet and Points surfaces for those records.</p><div className="mt-3 flex flex-wrap gap-3"><Link to="/wallet" className="text-[11px] font-medium hover:text-primary">Open Wallet →</Link><Link to="/points" className="text-[11px] font-medium hover:text-primary">Open Points →</Link></div></Panel>
  </div>;
}
