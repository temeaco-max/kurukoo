import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, CircleAlert, Coins, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { AskKurukoo } from "@/components/kurukoo/ask-kurukoo";
import { Panel } from "@/components/kurukoo/ui";

export const Route = createFileRoute("/usage")({
  head: () => ({
    meta: [
      { title: "Usage — Kurukoo" },
      {
        name: "description",
        content: "Review the authenticated usage state available to your Kurukoo account.",
      },
    ],
  }),
  component: UsagePage,
});

function UsagePage() {
  return (
    <>
      <PageHeader
        title="Usage"
        eyebrow="Account / Usage"
        subtitle="Usage is a quiet account surface: current consumption, Points activity and AI/channel metering belong here when the canonical readers are available."
      />
      <Panel className="border-dashed p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-elevated">
            <CircleAlert className="size-4" />
          </span>
          <div>
            <p className="text-[15px] font-medium">
              Usage data is not exposed to this frontend yet.
            </p>
            <p className="mt-1.5 text-[11.5px] leading-5 text-muted-foreground">
              No totals, Points balance, AI usage, channel usage or conversion values are invented.
              Once the canonical authenticated usage reader is exposed, this surface can render it
              without creating a parallel metering system.
            </p>
          </div>
        </div>
      </Panel>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Panel className="p-4">
          <Coins className="size-4 text-muted-foreground" />
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Points
          </p>
          <p className="mt-1 text-[17px] font-semibold">Unavailable</p>
          <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
            Points are not money and no balance is assumed.
          </p>
        </Panel>
        <Panel className="p-4">
          <MessageCircle className="size-4 text-muted-foreground" />
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            AI / channel usage
          </p>
          <p className="mt-1 text-[17px] font-semibold">Unavailable</p>
          <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
            Metered usage belongs to the canonical usage owner.
          </p>
        </Panel>
        <Panel className="p-4">
          <BarChart3 className="size-4 text-muted-foreground" />
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            History
          </p>
          <p className="mt-1 text-[17px] font-semibold">Unavailable</p>
          <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
            No duplicate usage ledger is created here.
          </p>
        </Panel>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <AskKurukoo prompt="Explain my current Kurukoo usage and Points state using only verified account data." />
        <Link
          to="/subscriptions"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[11px] font-medium"
        >
          Subscriptions <ArrowRight className="size-3.5" />
        </Link>
        <Link
          to="/settings"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[11px] font-medium"
        >
          Account settings <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </>
  );
}
