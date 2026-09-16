import { ArrowUpRight, CreditCard, Coins, WalletCards } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { AskKurukoo } from "@/components/kurukoo/ask-kurukoo";
import { actionClass } from "@/components/kurukoo/primitives";
import { Panel } from "@/components/kurukoo/ui";

export const Route = createFileRoute("/wallet")({ head: () => ({ meta: [{ title: "Wallet and points — Kurukoo" }, { name: "description", content: "See Kurukoo points, payments, provider earnings and transaction history in one place." }] }), component: WalletPage });

function Metric({ icon: Icon, label, note }: { icon: typeof Coins; label: string; note: string }) {
  return <Panel className="p-4"><div className="flex items-start justify-between gap-3"><span className="grid size-9 place-items-center rounded-xl bg-elevated text-muted-foreground"><Icon className="size-4" /></span><span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Unavailable</span></div><p className="mt-5 text-[11.5px] text-muted-foreground">{label}</p><p className="mt-1 text-[25px] font-semibold tracking-[-0.03em]">—</p><p className="mt-1 text-[11.5px] text-muted-foreground">{note}</p></Panel>;
}

function WalletPage() {
  return <>
    <PageHeader title="Wallet" subtitle="Points support Kurukoo's coordination work. Money stays separate for approved services and purchases." />
    <Panel className="mb-4 border-dashed p-4">
      <p className="text-[12.5px] leading-relaxed"><span className="font-medium">Wallet data is not connected here yet.</span> Kurukoo will show balances and transaction history only when the canonical points and payment services return them. No example balance or transaction is presented as real account state.</p>
    </Panel>
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric icon={Coins} label="Kurukoo points" note="Canonical points service not connected" />
      <Metric icon={WalletCards} label="Wallet balance" note="Payment balance unavailable" />
      <Metric icon={CreditCard} label="Provider earnings" note="Payout data unavailable" />
    </div>
    <Panel className="mt-4 overflow-hidden p-0">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-[15px] font-medium">Keep value and coordination separate</p><p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">Points and money have separate jobs. When a canonical service is connected, Kurukoo will show the actual state and approval boundary here.</p></div>
        <div className="flex flex-wrap gap-2"><AskKurukoo prompt="Help me understand my Kurukoo points and tell me what is currently available." /><Link to="/subscriptions" className={actionClass()}>Subscription</Link></div>
      </div>
      <div className="grid border-t border-border sm:grid-cols-2"><div className="p-4 sm:border-r sm:border-border"><p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Points</p><p className="mt-2 text-[13.5px] leading-relaxed">Coordination value. No balance is claimed until the canonical points service returns one.</p></div><div className="p-4"><p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Money</p><p className="mt-2 text-[13.5px] leading-relaxed">Approved provider, business or paid transaction state. No payment success is inferred from UI state.</p></div></div>
    </Panel>
    <section className="mt-8 grid gap-3 sm:grid-cols-2">
      <Panel className="p-4"><p className="text-[14px] font-medium">Top-ups and refunds</p><p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">Ask Kurukoo to explain the available path. A top-up or refund is not represented as completed without canonical evidence.</p><div className="mt-3"><AskKurukoo prompt="Help me understand the available top-up or refund path and what approval is required." /></div></Panel>
      <Panel className="p-4"><p className="text-[14px] font-medium">Provider payouts</p><p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">Provider payout state appears when the canonical payout service is connected.</p><div className="mt-3"><AskKurukoo prompt="Explain my provider payout status and what is required to receive a payout." /></div></Panel>
    </section>
    <div className="mt-4 flex justify-end"><Link to="/activity" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted-foreground hover:text-foreground">See Activity <ArrowUpRight className="size-3.5" /></Link></div>
  </>;
}
