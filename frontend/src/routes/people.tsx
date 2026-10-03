import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, MessageCircle, Search, Sparkles, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Panel } from "@/components/kurukoo/ui";
import { actionClass } from "@/components/kurukoo/primitives";
import { entities } from "@/lib/kurukoo-demo";

export const Route = createFileRoute("/people")({
  head: () => ({
    meta: [
      { title: "People — Kurukoo" },
      {
        name: "description",
        content: "Discover people and personal use cases across the Kurukoo network.",
      },
      { property: "og:title", content: "People — Kurukoo" },
      {
        property: "og:description",
        content: "Discover people, useful context and the things Kurukoo can help you get done.",
      },
    ],
  }),
  component: PeoplePage,
});

function PeoplePage() {
  const [query, setQuery] = useState("");
  const examples = useMemo(() => {
    const people = entities.filter((entity) => entity.kind === "person");
    const q = query.trim().toLowerCase();
    return q
      ? people.filter((person) =>
          `${person.name} ${person.tagline} ${person.location ?? ""}`.toLowerCase().includes(q),
        )
      : people;
  }, [query]);
  return (
    <div className="mx-auto w-full max-w-5xl space-y-9">
      <PageHeader
        title="People"
        subtitle="Kurukoo starts with people. Ask naturally, discover useful options and keep the context around the things that matter to you."
      />
      <Panel className="overflow-hidden border-primary/15 bg-brand-tint/10 p-5 md:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand-ink">
            <Users className="size-5" />
          </span>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-primary">
              For people
            </p>
            <h2 className="mt-1 text-[20px] font-semibold tracking-tight">
              One conversation can lead to discovery, work or a useful next step.
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              Use Explore when you want to look around. Use Nearby when you want to see what is
              happening around you. Use Radar when Kurukoo has a supported signal worth bringing to
              your attention.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/chat" className={actionClass("primary")}>
                Start a conversation
              </Link>
              <Link to="/discover" className={actionClass()}>
                Open Nearby
              </Link>
            </div>
          </div>
        </div>
      </Panel>
      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
              Discover people
            </p>
            <h2 className="mt-1.5 text-[22px] font-semibold tracking-tight">
              Useful connections, not a social feed.
            </h2>
          </div>
          <span className="text-[11px] text-muted-foreground">{examples.length} people</span>
        </div>
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people…"
            aria-label="Search people"
            className="min-h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-[12.5px] outline-none"
          />
        </div>
        {examples.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {examples.map((person) => (
              <Panel key={person.id} className="p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-elevated">
                    <Users className="size-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold">{person.name}</p>
                    <p className="mt-1 text-[12px] text-muted-foreground">{person.tagline}</p>
                    {person.location ? (
                      <p className="mt-1 text-[10.5px] text-muted-foreground">{person.location}</p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to="/profile/$entityId"
                    params={{ entityId: person.id }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-[11.5px] hover:bg-elevated"
                  >
                    View <ArrowUpRight className="size-3.5" />
                  </Link>
                  <Link
                    to="/chat"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-[11.5px] hover:bg-elevated"
                  >
                    <MessageCircle className="size-3.5" />
                    Continue in Chat
                  </Link>
                </div>
              </Panel>
            ))}
          </div>
        ) : (
          <Panel className="p-8 text-center">
            <Sparkles className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-3 text-[14px] font-medium">No people match that search.</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">Try another name or context.</p>
          </Panel>
        )}
      </section>
      <p className="text-center text-[11px] text-muted-foreground">
        Kurukoo keeps people discovery, community Topics and verified provider availability as
        separate sources of context.
      </p>
    </div>
  );
}
