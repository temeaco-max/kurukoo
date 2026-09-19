import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, BookOpen, MessageCircle, Search, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Action, actionClass } from "@/components/kurukoo/primitives";
import { AskKurukoo } from "@/components/kurukoo/ask-kurukoo";
import { Panel, SearchField } from "@/components/kurukoo/ui";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help — Kurukoo" },
      {
        name: "description",
        content:
          "Learn how to use Kurukoo, get help with requests, understand Topics, connections, Work and account support.",
      },
      { property: "og:title", content: "Help — Kurukoo" },
      {
        property: "og:description",
        content: "Find the shortest route back to getting something done with Kurukoo.",
      },
    ],
  }),
  component: HelpPage,
});

const sections = [
  [
    "Getting started",
    "Ask plainly",
    "Start with a plain-language request. You do not need to choose the right category first.",
    "/chat",
    "Start with the conversation",
  ],
  [
    "Chat and requests",
    "See what happens next",
    "Understand how a request becomes work, where Kurukoo can coordinate, and where it asks for your decision.",
    "/chat",
    "Open Conversation",
  ],
  [
    "Topics and community",
    "Use useful context",
    "Browse questions, experiences and local discussion, then bring useful context into a Kurukoo conversation.",
    "/topics",
    "Browse Topics",
  ],
  [
    "Work and activity",
    "Keep the trail",
    "Follow a request from the first ask through coordination, approvals, handovers and completion.",
    "/work",
    "Open Work",
  ],
  [
    "Connections",
    "Bring your tools",
    "Connect supported services and resources so authorised context can be used when a request needs it.",
    "/connect",
    "See Connections",
  ],
  [
    "Providers and businesses",
    "Find the right route",
    "Explore people and organisations that can participate in requests, with trust and fulfilment kept distinct from community context.",
    "/providers",
    "Explore Providers",
  ],
];

function HelpPage() {
  const [q, setQ] = useState("");
  const normalized = q.trim().toLowerCase();
  const list = sections.filter(
    ([title, note, body]) =>
      !normalized || `${title} ${note} ${body}`.toLowerCase().includes(normalized),
  );
  return (
    <div className="w-full">
      <section className="max-w-3xl">
        <p className="text-[12px] font-medium text-muted-foreground">Help centre</p>
        <h1 className="mt-2 max-w-3xl font-serif text-[40px] leading-[1.02] tracking-[-0.045em] md:text-[48px]">
          Find the answer, or just ask.
        </h1>
        <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-muted-foreground">
          Learn how to use Kurukoo, find the right surface, or take a question straight into
          Conversation.
        </p>
      </section>
      <div className="mt-8 max-w-2xl">
        <SearchField label="Search help" placeholder="Search help…" value={q} onChange={setQ} />
      </div>
      <Panel className="mt-5 overflow-hidden p-0">
        <div className="grid gap-0 md:grid-cols-[1.15fr_.85fr]">
          <div className="p-5 md:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand-ink">
                <MessageCircle className="size-4.5" />
              </span>
              <div>
                <p className="text-[15px] font-semibold">Ask Kurukoo directly</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  Describe what is confusing you in your own words. Kurukoo can help explain the
                  product or guide you into the right next step.
                </p>
                <div className="mt-3">
                  <AskKurukoo prompt="I need help understanding Kurukoo." />
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-border bg-elevated/35 p-5 md:border-l md:border-t-0 md:p-6">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-4 text-primary" />
              <div>
                <p className="text-[13px] font-semibold">Trust stays visible</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                  Important availability, pricing and commitments follow evidence and approval.
                  Community discussion remains context rather than fulfilment proof.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Panel>
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
              Browse help
            </p>
            <h2 className="mt-1.5 text-[24px] font-semibold tracking-tight">
              Start with the part you need.
            </h2>
          </div>
          <span className="hidden text-[11px] text-muted-foreground sm:inline">
            {list.length} areas
          </span>
        </div>
        {list.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {list.map(([title, note, body, to, cta], index) => (
              <Panel
                key={title}
                className="group flex min-h-[180px] flex-col p-5 transition-colors hover:bg-elevated/45"
              >
                <span className="grid size-9 place-items-center rounded-xl bg-elevated">
                  <BookOpen className="size-4" />
                </span>
                <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  0{index + 1}
                </p>
                <h3 className="mt-1 text-[15px] font-semibold">{title}</h3>
                <p className="mt-1 text-[12.5px] font-medium text-foreground/75">{note}</p>
                <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted-foreground">
                  {body}
                </p>
                <Link
                  to={to as never}
                  className="mt-4 inline-flex items-center gap-1 text-[11.5px] font-medium"
                >
                  {cta}
                  <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Panel>
            ))}
          </div>
        ) : (
          <Panel className="p-6">
            <p className="text-[14px] font-medium">No help areas match “{q}”.</p>
            <button type="button" onClick={() => setQ("")} className="mt-3 text-[12.5px] underline">
              Clear search
            </button>
          </Panel>
        )}
      </section>
      <section className="mt-10 rounded-[24px] border border-border bg-surface p-6 md:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
              Need a human route?
            </p>
            <h2 className="mt-1.5 text-[20px] font-semibold tracking-tight">
              Support should not become another puzzle.
            </h2>
            <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              For account or support issues, use the contact path. For understanding Kurukoo, start
              a conversation or browse How it works.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/contact" className={actionClass()}>
              Contact support
            </Link>
            <Link to="/how-it-works" className={actionClass()}>
              How it works <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
