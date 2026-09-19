import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BriefcaseBusiness,
  HandCoins,
  Package,
  Sparkles,
  Store,
  Users,
  Zap,
} from "lucide-react";
import { FAQSection } from "@/components/kurukoo/faq-section";
import { AskKurukoo } from "@/components/kurukoo/ask-kurukoo";
import { CommerceOutcomes } from "@/components/kurukoo/commerce-outcomes";

export const Route = createFileRoute("/opportunities")({
  head: () => ({
    meta: [
      { title: "Opportunities — Kurukoo" },
      {
        name: "description",
        content:
          "Find work, offer services, sell, create, partner and participate through Kurukoo.",
      },
    ],
  }),
  component: Opportunities,
});

const paths = [
  [
    "Find work",
    "Discover paid work, gigs and useful opportunities.",
    BriefcaseBusiness,
    "/explore/work",
    "Show me work and gigs that fit what I can do.",
  ],
  [
    "Offer a service",
    "Make a real capability easier to discover and turn relevant demand into work.",
    HandCoins,
    "/providers",
    "I want to offer a service.",
  ],
  [
    "Offer delivery",
    "Make delivery capability discoverable when people need something moved.",
    Package,
    "/providers",
    "I want to offer delivery.",
  ],
  [
    "Sell something",
    "Put an item or offer in front of people looking for it.",
    Store,
    "/businesses",
    "Help me sell something.",
  ],
  [
    "Create and share",
    "Turn useful ideas, recommendations and community knowledge into something people can use.",
    Sparkles,
    "/creators",
    "I want to become a creator.",
  ],
  [
    "Promote a business",
    "Reach relevant discovery with clear commercial disclosure.",
    Zap,
    "/advertising",
    "Help me promote something.",
  ],
] as const;

function Opportunities() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 pb-10">
      <header className="max-w-3xl">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">
          OPPORTUNITIES
        </p>
        <h1 className="mt-2 font-serif text-[40px] leading-[1.02] tracking-[-0.045em] md:text-[52px]">
          Find a way to take part
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted-foreground">
          Kurukoo connects people who need something with people, businesses and creators who can
          help make it happen.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <AskKurukoo prompt="Show me opportunities that fit what I can offer." />
          <Link
            to="/explore"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border px-4 text-[12px] font-medium hover:bg-elevated"
          >
            Explore <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </header>

      <section
        className="rounded-[22px] border border-border bg-surface p-5 md:p-6"
        aria-labelledby="launch-business"
      >
        <div className="max-w-3xl">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">
            BUSINESS LAUNCH
          </p>
          <h2
            id="launch-business"
            className="mt-1.5 font-serif text-[28px] leading-tight tracking-[-0.035em]"
          >
            Have an idea? Kurukoo can help turn it into something people can use.
          </h2>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
            The Business Launch journey is designed as one outcome: work out what you need,
            coordinate the right setup and providers, create the business surface, and keep the next
            steps moving. Where integrations or partner services are involved, Kurukoo keeps the
            handoff and commercial relationship clear.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <AskKurukoo
            prompt="Help me launch my business from scratch."
            className="min-h-9 bg-primary text-primary-foreground hover:bg-primary/90"
          />
          <Link
            to="/businesses"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[11.5px] font-medium hover:bg-elevated"
          >
            Business tools <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </section>

      <CommerceOutcomes />

      <section aria-labelledby="opportunity-paths">
        <div className="mb-4">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">
            WAYS TO PARTICIPATE
          </p>
          <h2
            id="opportunity-paths"
            className="mt-1.5 font-serif text-[28px] leading-tight tracking-[-0.035em]"
          >
            Start with what you can do
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {paths.map(([title, body, Icon, to, prompt]) => (
            <article
              key={title}
              className="rounded-[19px] border border-border bg-surface p-4 transition-colors hover:bg-elevated/45"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-brand-tint text-brand-ink">
                <Icon className="size-4" />
              </span>
              <h3 className="mt-4 text-[14.5px] font-semibold">{title}</h3>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">{body}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to={to}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-[11px] font-medium hover:bg-background"
                >
                  Open <ArrowRight className="size-3.5" />
                </Link>
                <AskKurukoo prompt={prompt} className="min-h-8 px-3 text-[11px]" />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[22px] border border-border bg-elevated/35 p-5 md:p-6">
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="text-[14px] font-semibold">Start with what you can offer</p>
            <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-muted-foreground">
              You do not need to know Kurukoo's categories. Describe what you can offer or what you
              want to achieve; supported opportunities can then move into the same request and work
              flow used elsewhere in Kurukoo.
            </p>
          </div>
        </div>
      </section>
      <FAQSection
        title="Opportunities questions"
        items={[
          {
            question: "What can I use Opportunities for?",
            answer:
              "Discover work, offer services or delivery, sell something, create useful content, or promote a relevant business or offer.",
          },
          {
            question: "Do I need to choose a category first?",
            answer:
              "No. You can start in Chat and describe the outcome you want. Explore simply gives you useful starting points.",
          },
          {
            question: "Does appearing here guarantee a job?",
            answer:
              "No. Discovery is not a guarantee of demand, availability, price or fulfilment. Supported requests still follow the appropriate verification and approval flow.",
          },
        ]}
      />
    </div>
  );
}
