import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { ArrowUpRight, BookOpen, MessageCircle, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
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

type Guide = { slug: string; title: string; category: string; excerpt: string };

const ideas = [
  ["Ask for a price check", "Compare what you have been quoted before you commit.", "/chat?prompt=Help%20me%20check%20a%20price%20I%20was%20quoted"],
  ["Plan the week", "Turn a loose plan into reminders and a work list.", "/chat?prompt=Help%20me%20plan%20my%20week"],
  ["Find someone reliable", "Describe the job and let Kurukoo look for the right route.", "/chat?prompt=Help%20me%20find%20someone%20for%20a%20job"],
  ["Follow up on a request", "Return to an existing request instead of starting again.", "/chat?prompt=Help%20me%20follow%20up%20on%20an%20open%20request"],
] as const;

function HelpPage() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const [q, setQ] = useState("");
  const [guides, setGuides] = useState<Guide[]>([]);
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/resources")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("guides"))))
      .then((payload: { resources?: Guide[] }) => {
        if (!cancelled) setGuides(Array.isArray(payload.resources) ? payload.resources : []);
      })
      .catch(() => {
        if (!cancelled) setGuides([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const normalized = q.trim().toLowerCase();
  const list = sections.filter(
    ([title, note, body]) =>
      !normalized || `${title} ${note} ${body}`.toLowerCase().includes(normalized),
  );
  const visibleGuides = guides.filter(
    (guide) =>
      !normalized || `${guide.title} ${guide.category} ${guide.excerpt}`.toLowerCase().includes(normalized),
  );
  if (pathname !== "/help" && pathname !== "/help/") {
    return <Outlet />;
  }
  return (
    <div className="w-full">
      <section className="max-w-3xl">
        <p className="text-[12px] font-medium text-muted-foreground">Help centre</p>
        <h1 className="mt-2 max-w-3xl font-serif text-[40px] leading-[1.02] tracking-[-0.045em] md:text-[48px]">
          Find the answer, or just ask.
        </h1>
        <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-muted-foreground">
          Learn how to use Kurukoo, read the guides, find the right surface, or take a
          question straight into Conversation.
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
      <section className="mt-10" aria-labelledby="help-guides">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">GUIDES</p>
            <h2 id="help-guides" className="mt-1.5 text-[20px] font-semibold tracking-tight">
              Guides that explain how Kurukoo actually works
            </h2>
            <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              Short, practical writing on requests, identity, memory, channels, payments and
              evidence. Read one, or ask about it in the same conversation.
            </p>
          </div>
          <AskKurukoo prompt="Show me the guide that matches what I am trying to do." />
        </div>
        {visibleGuides.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleGuides.map((guide) => (
              <Link
                key={guide.slug}
                to="/help/guides/$slug"
                params={{ slug: guide.slug }}
                className="group rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-primary/30"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-elevated text-muted-foreground">
                    <BookOpen className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-primary">
                      {guide.category}
                    </p>
                    <h3 className="mt-1 text-[14px] font-semibold leading-snug">{guide.title}</h3>
                    <p className="mt-1.5 line-clamp-3 text-[11.5px] leading-relaxed text-muted-foreground">
                      {guide.excerpt}
                    </p>
                  </div>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <Panel className="mt-4">
            <p className="text-[13px] text-muted-foreground">
              {normalized
                ? "No guides match that search yet."
                : "Guides are being prepared. You can ask Kurukoo directly in the meantime."}
            </p>
          </Panel>
        )}
      </section>

      <section className="mt-10" aria-labelledby="help-ideas">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">IDEAS</p>
        <h2 id="help-ideas" className="mt-1.5 text-[20px] font-semibold tracking-tight">
          Things people ask Kurukoo to handle
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {ideas.map(([title, body, to]) => (
            <Link
              key={title}
              to={to}
              className="rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-primary/30"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand-ink">
                  <Sparkles className="size-4" />
                </span>
                <div>
                  <h3 className="text-[14px] font-semibold">{title}</h3>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
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
