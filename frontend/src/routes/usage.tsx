import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Coins, History, LoaderCircle, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Panel, StatusPill } from "@/components/kurukoo/ui";

export const Route = createFileRoute("/usage")({
  head: () => ({ meta: [{ title: "Usage — Kurukoo" }, { name: "description", content: "Review Kurukoo Points and measured channel usage for your account." }] }),
  component: UsagePage,
});

type Usage = {
  points: { enabled: boolean; balance: number | null; label: string; symbol: string; history: Array<{ id: number; amount: number; type: string; description: string }> };
  channelUsage: { events: number; units: number; estimatedCostMinor: number; pricedEvents: number; unpricedEvents: number };
  subscriptionTier: string | null;
  country: string;
};

function UsagePage() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/usage", { credentials: "include" }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : `Usage request failed (${response.status})`);
      if (!cancelled) setUsage(payload as Usage);
    }).catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Usage is unavailable."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return <div className="space-y-8 pb-10">
    <PageHeader title="Usage" subtitle="A quiet account view of measured Kurukoo activity. Points are network units, not money, and channel usage is reported separately." />
    {loading ? <Panel className="p-6"><LoaderCircle className="size-5 animate-spin text-primary" /></Panel> : error ? <Panel className="border-destructive/20 bg-destructive/5 p-5"><p className="text-[13px] font-medium">Usage could not load</p><p className="mt-1 text-[11.5px] text-muted-foreground">{error}</p></Panel> : usage ? <>
      <section className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-elevated"><Coins className="size-[18px]" /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Points</p><h2 className="mt-1 text-[26px] font-semibold tracking-tight">{usage.points.enabled ? `${usage.points.balance ?? 0} ${usage.points.symbol}` : "Not enabled"}</h2><p className="mt-1 text-[11.5px] text-muted-foreground">{usage.points.enabled ? usage.points.label : `The Points economy is not enabled for ${usage.country.toUpperCase()} on this deployment.`}</p></div><StatusPill tone={usage.points.enabled ? "green" : "blue"}>{usage.points.enabled ? "Available" : "Unavailable"}</StatusPill></div><p className="mt-5 text-[11.5px] leading-5 text-muted-foreground">Points remain distinct from subscription charges, wallet payments and other monetary transactions.</p></Panel>
        <Panel className="p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-elevated"><BarChart3 className="size-[18px]" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Channel usage</p><h2 className="mt-1 text-[26px] font-semibold tracking-tight">{usage.channelUsage.units.toLocaleString()} units</h2><p className="mt-1 text-[11.5px] text-muted-foreground">{usage.channelUsage.events.toLocaleString()} recorded events</p></div></div><div className="mt-5 grid grid-cols-2 gap-px overflow-hidden border border-border bg-border"><div className="bg-background p-3"><p className="text-[10px] text-muted-foreground">Priced events</p><p className="mt-1 text-[13px] font-medium">{usage.channelUsage.pricedEvents}</p></div><div className="bg-background p-3"><p className="text-[10px] text-muted-foreground">Unpriced events</p><p className="mt-1 text-[13px] font-medium">{usage.channelUsage.unpricedEvents}</p></div></div><p className="mt-3 text-[10.5px] leading-5 text-muted-foreground">Estimated connector cost is only shown when a provider has supplied a cost estimate; it is not treated as a user charge.</p></Panel>
      </section>

      <section><div className="mb-4 flex items-center gap-2"><History className="size-4 text-muted-foreground" /><div><h2 className="text-[17px] font-semibold">Points activity</h2><p className="mt-0.5 text-[11.5px] text-muted-foreground">Canonical earn and spend history where the Points economy is enabled.</p></div></div>{usage.points.enabled && usage.points.history.length ? <div className="border-y border-border"><ul className="divide-y divide-border">{usage.points.history.map((item) => <li key={item.id} className="flex items-start gap-3 px-1 py-4 sm:px-2"><span className="mt-0.5 grid size-8 place-items-center rounded-lg bg-elevated text-[10px] font-semibold">{item.amount > 0 ? "+" : "−"}</span><div className="min-w-0 flex-1"><p className="text-[12.5px] font-medium">{item.description}</p><p className="mt-0.5 text-[10.5px] text-muted-foreground">{item.type.replace(/[_-]/g, " ")}</p></div><span className="text-[12px] font-semibold">{item.amount > 0 ? "+" : ""}{item.amount} {usage.points.symbol}</span></li>)}</ul></div> : <Panel className="p-5"><p className="text-[12.5px] font-medium">No Points activity recorded</p><p className="mt-1 text-[11.5px] text-muted-foreground">The empty state reflects the canonical Points ledger; it does not imply a monetary balance.</p></Panel>}</section>

      <Panel className="p-5"><div className="flex items-start gap-3"><MessageCircle className="mt-0.5 size-4 text-muted-foreground" /><div><p className="text-[12.5px] font-semibold">Need to change something?</p><p className="mt-1 text-[11.5px] leading-5 text-muted-foreground">Ask Kurukoo about your plan, usage or a specific transaction. Consequential account changes still go through their canonical surfaces.</p><div className="mt-3 flex flex-wrap gap-3"><Link to="/chat" className="text-[11px] font-medium hover:text-primary">Ask Kurukoo →</Link><Link to="/subscriptions" className="text-[11px] font-medium hover:text-primary">Subscriptions →</Link></div></div></div></Panel>
    </> : null}
  </div>;
}
