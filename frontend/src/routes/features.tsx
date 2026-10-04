import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, MessageCircle, Radar, ShieldCheck, Users, Workflow } from "lucide-react";
import { AskKurukoo } from "@/components/kurukoo/ask-kurukoo";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — Kurukoo" },
      {
        name: "description",
        content:
          "Tell Kurukoo what you need. Let it check, explain, organise, diagnose, monitor or safely act — and coordinate people when needed.",
      },
      { property: "og:title", content: "Features — Kurukoo" },
      {
        property: "og:description",
        content: "What Kurukoo can do from one conversation: help directly, find useful things, keep things moving, get help when needed.",
      },
    ],
  }),
  component: FeaturesPage,
});

const helpDirectly = [
  [
    MessageCircle,
    "Ask Kurukoo",
    "Describe the problem or goal naturally. Kurukoo keeps the useful context together and works out what to do next.",
    "/chat",
    "Start a conversation",
  ],
  [
    CheckCircle2,
    "Check your technology",
    "Ask Kurukoo to check supported phones, tablets, computers, TVs, networks and connected devices. It uses only information and controls actually available to it.",
    "/chat?prompt=Check%20my%20device",
    "Ask for a device check",
  ],
  [
    Radar,
    "Find useful things",
    "Find services, people, places, products, events and opportunities that can help with what you are trying to do.",
    "/discover",
    "Explore Discover",
  ],
  [
    Workflow,
    "Keep things moving",
    "Turn conversations into reminders, tasks, follow-ups and ongoing work without starting again.",
    "/work",
    "Explore work",
  ],
] as const;

const coordination = [
  [
    "Requests",
    "Turn a need into an explicit request and keep its progress, decisions and outcome together.",
    "/activity",
    "See your Requests",
  ],
  [
    "People and services",
    "When a human or external service is needed, Kurukoo can coordinate the appropriate participant when a supported path exists.",
    "/network",
    "Explore the network",
  ],
  [
    "Remember what matters",
    "Keep useful preferences and context connected to your relationship with Kurukoo when you choose to.",
    "/field",
    "Manage Memory",
  ],
  [
    "Stay connected",
    "Use Chat and supported channels to receive updates and continue the same work when you return.",
    "/chat",
    "Continue in Chat",
  ],
] as const;

function FeaturesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 pb-10">
      <header className="max-w-3xl">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">
          WHAT KURUKOO CAN DO
        </p>
        <h1 className="mt-2 font-serif text-[40px] leading-[1.02] tracking-[-0.045em] md:text-[52px]">
          Tell Kurukoo what you need. Let it help.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted-foreground">
          Kurukoo helps you get things done. Tell it what you need, want, notice, or are worried
          about. It works out what it can do, takes appropriate action, gets help when needed, keeps
          you informed, and remembers what matters.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <AskKurukoo prompt="Show me what Kurukoo can do." />
          <Link
            to="/how-it-works"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border px-4 text-[12px] font-medium hover:bg-elevated"
          >
            See how it helps
          </Link>
        </div>
      </header>

      <section aria-labelledby="lifecycle">
        <div className="mb-4">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">
            FROM NEED TO OUTCOME
          </p>
          <h2 id="lifecycle" className="mt-1.5 font-serif text-[28px] tracking-[-0.035em]">
            You start with the outcome. Kurukoo works out the route.
          </h2>
        </div>
        <ol className="grid gap-3 md:grid-cols-3">
          {[
            ["01", "Tell it", "Use your own words. You do not need to choose a category first."],
            ["02", "Let it work", "Kurukoo uses the information, tools, services, devices or people available to help."],
            ["03", "Know what happened", "Kurukoo gives you the result, what it still needs, or the next useful step."],
          ].map(([n, title, body]) => (
            <li key={n} className="rounded-2xl border border-border bg-surface p-5">
              <span className="text-[11px] font-semibold text-primary">{n}</span>
              <h3 className="mt-2 text-[15px] font-semibold">{title}</h3>
              <p className="mt-1.5 text-[12.5px] leading-6 text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="help-directly">
        <div className="mb-4">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">
            HELP DIRECTLY
          </p>
          <h2 id="help-directly" className="mt-1.5 font-serif text-[28px] tracking-[-0.035em]">
            Sometimes Kurukoo can solve the problem with you.
          </h2>
          <p className="mt-2 max-w-2xl text-[12.5px] leading-6 text-muted-foreground">
            When the available device, service or connected resource gives Kurukoo what it needs,
            it can check, explain, organise, diagnose, monitor or safely act instead of sending you
            somewhere else first.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {helpDirectly.map(([Icon, title, body, to, label]) => (
            <article key={title} className="rounded-2xl border border-border bg-surface p-5">
              <h3 className="text-[15px] font-semibold">{title}</h3>
              <p className="mt-1.5 text-[12.5px] leading-6 text-muted-foreground">{body}</p>
              <Link to={to} className="mt-3 inline-flex text-[12px] font-medium text-primary">
                {label} →
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="get-help">
        <div className="mb-4">
          <h2 id="get-help" className="font-serif text-[28px] tracking-[-0.035em]">
            If Kurukoo cannot do it alone, it can help find who can.
          </h2>
          <p className="mt-2 max-w-2xl text-[12.5px] leading-6 text-muted-foreground">
            A request can move from direct assistance to another person, business, service, agent or
            physical participant without making you repeat the whole story.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {coordination.map(([title, body, to, label]) => (
            <article key={title} className="rounded-2xl border border-border bg-surface p-5">
              <h3 className="text-[15px] font-semibold">{title}</h3>
              <p className="mt-1.5 text-[12.5px] leading-6 text-muted-foreground">{body}</p>
              <Link to={to} className="mt-3 inline-flex text-[12px] font-medium text-primary">
                {label} →
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="font-serif text-[24px] tracking-[-0.03em]">
          Kurukoo tells you what it knows and what it could not do.
        </h2>
        <p className="mt-2 max-w-2xl text-[12.5px] leading-6 text-muted-foreground">
          Important actions can require your permission. External providers, device access, payment,
          delivery and other consequential outcomes are only presented as completed when the relevant
          state and evidence exist.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-[12px] font-medium text-primary">
          <Link to="/help">Safety &amp; permissions</Link>
          <Link to="/field">Memory</Link>
          <Link to="/how-it-works">How it works</Link>
        </div>
      </section>
    </div>
  );
}
