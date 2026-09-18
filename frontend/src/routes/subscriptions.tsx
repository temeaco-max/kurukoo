import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CircleAlert, CreditCard, ReceiptText } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { PlanCard } from "@/components/kurukoo/cards";
import { Panel, Tabs } from "@/components/kurukoo/ui";
import { plans } from "@/lib/kurukoo-demo";

export const Route = createFileRoute("/subscriptions")({
  head: () => ({ meta: [{ title: "Subscriptions — Kurukoo" }, { name: "description", content: "Review Kurukoo plans and the authenticated subscription state available to your account." }] }),
  component: SubscriptionsPage,
});

const tabs = ["You", "Providers", "Businesses", "Creators"] as const;

function SubscriptionsPage() {
  const [tab, setTab] = useState<string>(tabs[0]);
  const audience = tab === "You" ? "user" : tab === "Providers" ? "provider" : tab === "Businesses" ? "business" : "creator";
  const selectedPlans = plans.filter((plan) => plan.audience === audience);
  return <>
    <PageHeader title="Subscriptions / Plans" subtitle="Plan definitions remain available as product information. Billing state is shown only when the canonical account and commercial services expose it." />
    <Tabs items={tabs} value={tab} onChange={setTab} />
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{selectedPlans.map((plan) => <PlanCard key={plan.id} plan={plan} />)}</div>

    <Panel className="mt-6 border-dashed p-5">
      <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-elevated"><CircleAlert className="size-4" /></span><div><p className="text-[15px] font-medium">Your subscription</p><p className="mt-1.5 text-[11.5px] leading-5 text-muted-foreground">Current plan, billing cycle, next charge, payment method and cancellation state are not exposed by the current authenticated frontend reader. Nothing below is inferred from a plan card.</p></div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[['Current plan', 'Not available'], ['Billing cycle', 'Not available'], ['Next charge', 'Not available'], ['Payment method', 'Not available']].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-surface p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-1.5 text-[12.5px] font-medium">{value}</p></div>)}
      </div>
      <div className="mt-4 flex flex-wrap gap-2"><Link to="/chat" search={{ query: "Help me review or change my Kurukoo subscription." } as never} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[11px] font-medium text-primary-foreground">Ask Kurukoo <ArrowRight className="size-3.5" /></Link><Link to="/usage" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[11px] font-medium">Usage</Link></div>
    </Panel>

    <div className="mt-6 grid gap-3 md:grid-cols-2">
      <Panel className="p-5"><div className="flex items-center gap-2"><ReceiptText className="size-4" /><p className="text-[14px] font-medium">Billing history</p></div><p className="mt-1.5 text-[11.5px] leading-5 text-muted-foreground">Renewals, charges, plan changes and receipts require a canonical user-scoped commercial ledger reader. No invoice or charge is fabricated here.</p></Panel>
      <Panel className="p-5"><div className="flex items-center gap-2"><CreditCard className="size-4" /><p className="text-[14px] font-medium">Payment history</p></div><p className="mt-1.5 text-[11.5px] leading-5 text-muted-foreground">Payment transactions are separate from Points and subscription plan definitions. The authenticated reader is not exposed to this frontend yet.</p></Panel>
    </div>
  </>;
}
