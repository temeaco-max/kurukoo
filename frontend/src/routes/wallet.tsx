import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CreditCard, Coins, WalletCards } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { AskKurukoo } from "@/components/kurukoo/ask-kurukoo";
import { actionClass } from "@/components/kurukoo/primitives";
import { Panel } from "@/components/kurukoo/ui";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — Kurukoo" },
      {
        name: "description",
        content: "Review the canonical financial state available to your Kurukoo account.",
      },
    ],
  }),
  component: WalletPage,
});

function StateCard({
  icon: Icon,
  label,
  title,
  body,
}: {
  icon: typeof Coins;
  label: string;
  title: string;
  body: string;
}) {
  return (
    <Panel className="p-4">
      <span className="grid size-9 place-items-center rounded-xl bg-elevated text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[17px] font-semibold">{title}</p>
      <p className="mt-1.5 text-[11.5px] leading-5 text-muted-foreground">{body}</p>
    </Panel>
  );
}

function WalletPage() {
  return (
    <>
      <PageHeader
        title="Wallet"
        subtitle="Money, Points and subscription billing stay separate. This surface only shows state that can be supported by the canonical account services."
      />
      <Panel className="mb-4 border-dashed p-4">
        <p className="text-[12.5px] font-medium">
          Financial state is not exposed to this frontend yet.
        </p>
        <p className="mt-1.5 text-[11.5px] leading-5 text-muted-foreground">
          The previous wallet figures were illustrative data and have been removed. No balance,
          payment method, payout or transaction is being inferred from the UI.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/chat"
            search={{ query: "Help me understand my current payment and wallet state." } as never}
            className={actionClass()}
          >
            Ask Kurukoo
          </Link>
          <Link to="/subscriptions" className={actionClass()}>
            Subscriptions
          </Link>
          <Link to="/usage" className={actionClass()}>
            Usage
          </Link>
        </div>
      </Panel>
      <div className="grid gap-3 md:grid-cols-3">
        <StateCard
          icon={Coins}
          label="Points"
          title="Not available"
          body="No canonical Points balance is currently exposed through the authenticated frontend contract."
        />
        <StateCard
          icon={WalletCards}
          label="Wallet balance"
          title="Not available"
          body="No money balance is shown until a canonical account balance reader is available."
        />
        <StateCard
          icon={CreditCard}
          label="Payment method"
          title="Not available"
          body="No saved card, bank account or payment method is fabricated here."
        />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Panel className="p-5">
          <p className="text-[14px] font-medium">Payment history</p>
          <p className="mt-1.5 text-[11.5px] leading-5 text-muted-foreground">
            Payment transactions require the canonical commercial ledger reader. Until that reader
            is exposed to the authenticated frontend, there is no history to display here.
          </p>
          <Link
            to="/activity"
            className="mt-4 inline-flex items-center gap-1 text-[10.5px] font-medium"
          >
            Open Activity <ArrowRight className="size-3.5" />
          </Link>
        </Panel>
        <Panel className="p-5">
          <p className="text-[14px] font-medium">Need to make a payment?</p>
          <p className="mt-1.5 text-[11.5px] leading-5 text-muted-foreground">
            Use the relevant Work or checkout flow. A request, quote or checkout step is not
            represented as settled payment until the canonical payment service confirms it.
          </p>
          <AskKurukoo
            prompt="Help me make a payment for an approved Kurukoo request without assuming payment has succeeded."
            className="mt-4"
          />
        </Panel>
      </div>
    </>
  );
}
