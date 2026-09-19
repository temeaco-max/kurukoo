import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  Compass,
  FileText,
  MessageCircle,
  Mic,
  Search,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { FAQSection } from "@/components/kurukoo/faq-section";
import { AskKurukoo } from "@/components/kurukoo/ask-kurukoo";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How Kurukoo works — everyday AI that gets things done" },
      {
        name: "description",
        content:
          "See how Kurukoo turns everyday requests into coordinated work, from your first message to the finished result.",
      },
      { property: "og:title", content: "How Kurukoo works" },
      {
        property: "og:description",
        content: "Start with an outcome, review the next step and keep the work connected.",
      },
    ],
  }),
  component: HowItWorksPage,
});

const lifecycle = [
  [
    MessageCircle,
    "Tell Kurukoo",
    "Type what you need or use voice when available. You can also start from Explore when you already know the kind of job.",
  ],
  [
    Search,
    "Kurukoo works out the next step",
    "Your request is organised around the outcome, with the relevant details kept together so you do not have to repeat yourself.",
  ],
  [
    Compass,
    "Find the right path",
    "Kurukoo can use the relevant capability, provider, business, community context or connected source when that route is available.",
  ],
  [
    ShieldCheck,
    "Review what matters",
    "Important options, evidence, timing, price and permissions are brought back to you before a commitment is made.",
  ],
  [
    Workflow,
    "Let the work move",
    "Approved requests can become connected work, keeping progress, messages, requirements and next steps together.",
  ],
  [
    Check,
    "Keep the result",
    "Useful completed work can remain in Activity and Memory so future requests can start with relevant context.",
  ],
] as const;

const starts = [
  [
    MessageCircle,
    "Chat",
    "Ask for something, continue a request or bring useful context into the conversation.",
    "/chat",
    "Open Chat",
  ],
  [
    Mic,
    "Voice",
    "Speak naturally when voice is available and let the conversation become the task.",
    "/chat",
    "Start with Chat",
  ],
  [
    Compass,
    "Explore",
    "Choose a goal such as food, groceries, mobility, repairs, work, selling, health, events, community or safety.",
    "/explore",
    "Explore goals",
  ],
  [
    Search,
    "Nearby",
    "Discover useful people, places, businesses, offers, events and opportunities around you.",
    "/discover",
    "See Nearby",
  ],
] as const;

const audiences = [
  ["People", "/people"],
  ["Providers", "/providers"],
  ["Businesses", "/businesses"],
  ["Creators", "/creators"],
  ["Contributors", "/contributors"],
  ["Partners", "/partners"],
  ["Advertisers", "/advertising"],
  ["Local agents", "/agents"],
] as const;

function HowItWorksPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 pb-10">
      <header className="max-w-3xl">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">
          HOW IT WORKS
        </p>
        <h1 className="mt-2 font-serif text-[40px] leading-[1.02] tracking-[-0.045em] md:text-[52px]">
          From a simple request to useful work
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted-foreground">
          Kurukoo is built around the thing you want finished. Start with the outcome, let Kurukoo
          organise the path, and stay in control of the decisions that matter.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <AskKurukoo prompt="Show me how Kurukoo can help with something I need to get done." />
          <Link
            to="/explore"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border px-4 text-[12px] font-medium hover:bg-elevated"
          >
            Explore <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </header>

      <section aria-labelledby="examples">
        <div className="mb-4">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">
            START WITH THE OUTCOME
          </p>
          <h2 id="examples" className="mt-1.5 font-serif text-[28px] tracking-[-0.035em]">
            Ask for the thing, not the process
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            [
              "Find me a plumber who can come this week.",
              "Kurukoo can organise the request around timing, location and the provider you need.",
            ],
            [
              "Get three quotes for moving a two-bed flat.",
              "Kurukoo can help structure a comparison instead of making you repeat the same request.",
            ],
            [
              "Plan my day around these appointments.",
              "Kurukoo can work from the context you provide and keep related actions together.",
            ],
          ].map(([q, b]) => (
            <article key={q} className="rounded-[19px] border border-border bg-surface p-4">
              <p className="text-[14px] font-medium leading-relaxed">“{q}”</p>
              <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">{b}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="flow">
        <div className="mb-4">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">
            THE FLOW
          </p>
          <h2 id="flow" className="mt-1.5 font-serif text-[28px] tracking-[-0.035em]">
            One connected journey
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {lifecycle.map(([Icon, title, body], i) => (
            <article key={title} className="rounded-[19px] border border-border bg-surface p-4">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-brand-tint text-brand-ink">
                  <Icon className="size-4" />
                </span>
                <span className="text-[10px] font-semibold text-muted-foreground">0{i + 1}</span>
              </div>
              <h3 className="mt-4 text-[14.5px] font-semibold">{title}</h3>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="start">
        <div className="mb-4">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">
            WAYS TO USE KURUKOO
          </p>
          <h2 id="start" className="mt-1.5 font-serif text-[28px] tracking-[-0.035em]">
            Start where the job makes sense
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {starts.map(([Icon, title, body, to, label]) => (
            <article key={title} className="rounded-[19px] border border-border bg-surface p-4">
              <span className="grid size-9 place-items-center rounded-xl bg-elevated">
                <Icon className="size-4" />
              </span>
              <h3 className="mt-4 text-[14.5px] font-semibold">{title}</h3>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">{body}</p>
              <Link
                to={to}
                className="mt-4 inline-flex items-center gap-1.5 text-[11.5px] font-medium"
              >
                {label}
                <ArrowRight className="size-3.5" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="connections"
        className="rounded-[22px] border border-border bg-elevated/35 p-5 md:p-6"
      >
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">
          CONNECTIONS
        </p>
        <h2 id="connections" className="mt-1.5 font-serif text-[28px] tracking-[-0.035em]">
          Bring authorised sources into the flow
        </h2>
        <p className="mt-3 max-w-3xl text-[12.5px] leading-relaxed text-muted-foreground">
          Connect is where supported external sources and services can be authorised. When a
          connection is genuinely available and you grant permission, Kurukoo can use the
          information or actions that service exposes. Availability depends on the underlying
          integration and your account.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/connect"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-[11.5px] font-medium text-primary-foreground"
          >
            See Connect
            <ArrowRight className="size-3.5" />
          </Link>
          <Link
            to="/resources"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border px-3.5 text-[11.5px] font-medium"
          >
            View guides
          </Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[17px] border border-border bg-surface p-4">
            <FileText className="size-4 text-primary" />
            <p className="mt-3 text-[13px] font-semibold">Sources</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              Use authorised information without manually moving it between tools.
            </p>
          </div>
          <div className="rounded-[17px] border border-border bg-surface p-4">
            <MessageCircle className="size-4 text-primary" />
            <p className="mt-3 text-[13px] font-semibold">Communication</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              Supported communication services can become part of an approved action.
            </p>
          </div>
          <div className="rounded-[17px] border border-border bg-surface p-4">
            <ShieldCheck className="size-4 text-primary" />
            <p className="mt-3 text-[13px] font-semibold">Your permission</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              You control which accounts are connected and what permissions are granted.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[22px] border border-border bg-surface p-5">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">
            AFTER APPROVAL
          </p>
          <h2 className="mt-1.5 font-serif text-[27px]">The request becomes work</h2>
          <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
            Supported requests move into Work, where progress, requirements, commercial steps,
            messages and outcomes remain connected. Activity keeps important updates visible.
          </p>
          <div className="mt-4 flex gap-2">
            <Link
              to="/work"
              className="rounded-xl border border-border px-3 py-2 text-[11.5px] font-medium"
            >
              Open Work
            </Link>
            <Link
              to="/activity"
              className="rounded-xl border border-border px-3 py-2 text-[11.5px] font-medium"
            >
              See Activity
            </Link>
          </div>
        </div>
        <div className="rounded-[22px] border border-border bg-surface p-5">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">
            CONTINUITY
          </p>
          <h2 className="mt-1.5 font-serif text-[27px]">Useful context stays useful</h2>
          <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
            Where supported, relevant history and approved context can remain connected so the next
            request starts with what is already known.
          </p>
          <div className="mt-4 flex gap-2">
            <Link
              to="/memory"
              className="rounded-xl border border-border px-3 py-2 text-[11.5px] font-medium"
            >
              Open Memory
            </Link>
            <Link
              to="/chat"
              className="rounded-xl border border-border px-3 py-2 text-[11.5px] font-medium"
            >
              Continue in Chat
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="audiences">
        <div className="mb-4">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">
            WHO IT SERVES
          </p>
          <h2 id="audiences" className="mt-1.5 font-serif text-[28px] tracking-[-0.035em]">
            Different people, different outcomes
          </h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {audiences.map(([label, to]) => (
            <Link
              key={label}
              to={to}
              className="group rounded-[17px] border border-border bg-surface p-4 hover:bg-elevated"
            >
              <p className="text-[13px] font-semibold">{label}</p>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                See the relevant ways Kurukoo can be used.
              </p>
              <ArrowRight className="mt-3 size-3.5 text-muted-foreground group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </section>

      <FAQSection
        title="How Kurukoo works — questions"
        items={[
          {
            question: "Do I have to know what service I need?",
            answer:
              "No. Describe the outcome you want. Kurukoo is designed to help organise the next step.",
          },
          {
            question: "Can I use voice?",
            answer:
              "Voice is available where the relevant voice experience and account access are enabled. Text Chat remains available as the universal starting point.",
          },
          {
            question: "Does Kurukoo act without asking me?",
            answer:
              "Important commitments and approvals remain under your control. Automated work is bounded by the permissions and capabilities available to the request.",
          },
          {
            question: "Can community information be used to fulfil a request?",
            answer:
              "Community context can help you decide, but it is not itself proof of provider availability, price or fulfilment.",
          },
          {
            question: "What happens after something is completed?",
            answer:
              "Supported work can remain connected in Work and Activity, with useful approved context available for future requests.",
          },
        ]}
      />
    </div>
  );
}
