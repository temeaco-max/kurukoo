import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Action, actionClass } from "@/components/kurukoo/primitives";
import { MarketingPage } from "@/components/kurukoo/marketing";
import { PlanCard } from "@/components/kurukoo/cards";
import { FAQSection } from "@/components/kurukoo/faq-section";
import { AskKurukoo } from "@/components/kurukoo/ask-kurukoo";
import { SectionHeader } from "@/components/kurukoo/ui";
import { plans } from "@/lib/kurukoo-demo";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Plans and pricing — Kurukoo" },
      {
        name: "description",
        content:
          "See Kurukoo plans and understand how access, coordination, payments, advertising and partner value fit together.",
      },
      { property: "og:title", content: "Plans and pricing — Kurukoo" },
      {
        property: "og:description",
        content: "Understand Kurukoo plans and the different ways value moves through the service.",
      },
    ],
  }),
  component: PricingPage,
});
const groups = [
  ["For people", "user"],
  ["For providers", "provider"],
  ["For businesses", "business"],
  ["For creators", "creator"],
] as const;
const valuePaths = [
  [
    "Plans",
    "Access to Kurukoo can be offered through free and paid plans, with options for different ways of using the service.",
    "/subscriptions",
    "Manage subscriptions",
  ],
  [
    "Points",
    "Points are separate from cash payments and can support Kurukoo's coordination work where the applicable plan uses them.",
    "/wallet",
    "See wallet",
  ],
  [
    "Services and purchases",
    "When a supported request involves a provider or business payment, the financial commitment stays visible before approval.",
    "/wallet",
    "Open payment layer",
  ],
  [
    "Advertising",
    "Businesses can use clearly disclosed commercial placements where the advertising service is available.",
    "/advertising",
    "Explore advertising",
  ],
  [
    "Creator revenue",
    "Creators can build useful content and eligible revenue opportunities around their audience.",
    "/creators",
    "Explore creators",
  ],
  [
    "Partners and referrals",
    "Partner and referral relationships can create value around useful discovery without taking control away from the user.",
    "/partners",
    "Explore partners",
  ],
] as const;
function PricingPage() {
  return (
    <MarketingPage>
      <PageHeader
        title="Plans and pricing"
        subtitle="Choose the access that fits you. When money is involved in a request, Kurukoo keeps the service, price and approval visible."
      />
      {groups.map(([label, audience]) => {
        const list = plans.filter((p) => p.audience === audience);
        return list.length ? (
          <section key={audience} className="mt-8 first:mt-0">
            <SectionHeader title={label} />
            <div className="grid gap-3 sm:grid-cols-2">
              {list.map((p) => (
                <PlanCard key={p.id} plan={p} />
              ))}
            </div>
          </section>
        ) : null;
      })}
      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              How value moves
            </p>
            <h2 className="mt-1 text-[24px] font-semibold tracking-tight">
              One service, different kinds of value.
            </h2>
            <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-muted-foreground">
              Access, coordination, transactions and commercial services are kept distinct so you
              can understand what you are paying for and why.
            </p>
          </div>
          <AskKurukoo prompt="Help me understand Kurukoo plans and pricing." />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {valuePaths.map(([title, body, to, cta]) => (
            <div key={title} className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-[14px] font-semibold">{title}</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{body}</p>
              <Link
                to={to as never}
                className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-medium hover:underline"
              >
                {cta}
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </section>
      <section className="mt-10">
        <SectionHeader
          title="Points and money stay separate"
          subtitle="A plan covers access. Points, where applicable, support Kurukoo's coordination work. Provider and business payments remain separate transactions."
        />
        <div className="flex flex-wrap gap-2">
          <Link to="/wallet" className={actionClass("primary")}>
            Open wallet and points
          </Link>
          <Link to="/subscriptions" className={actionClass()}>
            Manage subscription
          </Link>
        </div>
      </section>
      <p className="mt-8 rounded-2xl border border-border bg-elevated/50 px-4 py-3 text-[12px] leading-relaxed text-muted-foreground">
        Live billing, refunds and payouts depend on the relevant payment connection being enabled.
        Kurukoo does not treat an unavailable payment path as active.
      </p>
      <FAQSection
        title="Plans and pricing questions"
        items={[
          {
            question: "Do I need a paid plan to start?",
            answer:
              "Kurukoo can offer different access levels. Check the plan shown for your audience and use Chat or Explore to understand what you can do.",
          },
          {
            question: "Are points the same as money?",
            answer:
              "No. Points and cash transactions are separate. A provider or business payment is a distinct transaction that should remain visible before approval.",
          },
          {
            question: "Can I change my plan?",
            answer:
              "When subscription management is enabled for your account, use Subscriptions to review and manage your plan.",
          },
          {
            question: "Are advertising and partner services included in every plan?",
            answer:
              "No. Commercial services are separate from ordinary product access and depend on the relevant service being available.",
          },
        ]}
      />
    </MarketingPage>
  );
}
