import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Search,
  UserRound,
  MessageCircle,
  Phone,
  BriefcaseBusiness,
  HeartHandshake,
} from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState, PageHeader } from "@/components/app-shell";
import { AIProviderDirectory } from "@/components/kurukoo/ai-provider-directory";
import { ContactRow } from "@/components/kurukoo/cards";
import { actionClass } from "@/components/kurukoo/primitives";
import {
  Avatar,
  Badge,
  ContextIconTile,
  Panel,
  Rows,
  StatusPill,
  Tabs,
} from "@/components/kurukoo/ui";
import { entities } from "@/lib/kurukoo-demo";
import { useKurukoo } from "@/lib/kurukoo-store";

export const Route = createFileRoute("/contacts")({
  head: () => ({
    meta: [
      { title: "Contacts — Kurukoo" },
      {
        name: "description",
        content:
          "People, AI providers, businesses and providers you can work with through Kurukoo.",
      },
    ],
  }),
  component: ContactsPage,
});
const tabs = ["Recent", "Favourites", "All"] as const;
function ContactActions({ name }: { name: string }) {
  const { send } = useKurukoo();
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={() =>
          send(
            `Start a conversation with ${name}. Keep the existing relationship context and tell me the useful next step.`,
          )
        }
        aria-label={`Message ${name}`}
        className="grid size-8 place-items-center rounded-lg hover:bg-elevated"
      >
        <MessageCircle className="size-3.5" />
      </button>
      <Link
        to="/calls"
        aria-label={`Call ${name}`}
        className="grid size-8 place-items-center rounded-lg hover:bg-elevated"
      >
        <Phone className="size-3.5" />
      </Link>
      <Link
        to="/work"
        aria-label={`Start work with ${name}`}
        className="grid size-8 place-items-center rounded-lg hover:bg-elevated"
      >
        <BriefcaseBusiness className="size-3.5" />
      </Link>
    </div>
  );
}
function ContactsPage() {
  const [tab, setTab] = useState<string>(tabs[0]);
  const [query, setQuery] = useState("");
  const { contacts } = useKurukoo();
  const demo = entities.filter((e) => ["provider", "business", "person"].includes(e.kind));
  const filtered = useMemo(() => {
    const base =
      tab === "Favourites" ? demo.slice(0, 1) : tab === "Recent" ? demo.slice(0, 3) : demo;
    const q = query.trim().toLowerCase();
    return q
      ? base.filter((e) =>
          `${e.name} ${e.kind} ${e.tagline} ${e.topics.join(" ")}`.toLowerCase().includes(q),
        )
      : base;
  }, [demo, query, tab]);
  return (
    <div className="space-y-7">
      <PageHeader
        title="Contacts"
        subtitle="People and providers you can bring back into a conversation or piece of work."
      />
      <section className="grid gap-3 sm:grid-cols-3">
        <Panel className="p-4">
          <div className="flex items-center gap-2">
            <ContextIconTile className="size-8 rounded-lg">
              <UserRound className="size-4" />
            </ContextIconTile>
            <div>
              <p className="text-[11px] text-muted-foreground">Relationships</p>
              <p className="text-[18px] font-semibold">{contacts.length}</p>
            </div>
          </div>
          <p className="mt-2 text-[10.5px] text-muted-foreground">People reached through work</p>
        </Panel>
        <Panel className="p-4">
          <div className="flex items-center gap-2">
            <ContextIconTile className="size-8 rounded-lg">
              <HeartHandshake className="size-4" />
            </ContextIconTile>
            <div>
              <p className="text-[11px] text-muted-foreground">Known providers</p>
              <p className="text-[18px] font-semibold">{demo.length}</p>
            </div>
          </div>
          <p className="mt-2 text-[10.5px] text-muted-foreground">Human providers and businesses</p>
        </Panel>
        <Panel className="p-4">
          <div className="flex items-center gap-2">
            <ContextIconTile className="size-8 rounded-lg">
              <MessageCircle className="size-4" />
            </ContextIconTile>
            <div>
              <p className="text-[11px] text-muted-foreground">AI providers</p>
              <p className="text-[18px] font-semibold">8</p>
            </div>
          </div>
          <p className="mt-2 text-[10.5px] text-muted-foreground">Available inside Kurukoo</p>
        </Panel>
      </section>
      <AIProviderDirectory compact />
      <Panel className="overflow-hidden p-0">
        <div className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <label htmlFor="contact-search" className="sr-only">
              Search contacts
            </label>
            <input
              id="contact-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people, providers and businesses"
              className="min-h-11 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-[14px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
        <Tabs items={tabs} value={tab} onChange={setTab} />
      </Panel>
      {contacts.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <ContextIconTile className="size-8 rounded-lg">
              <UserRound className="size-4" />
            </ContextIconTile>
            <div>
              <h2 className="text-[16px] font-semibold">Reached through Kurukoo</h2>
              <p className="text-[12px] text-muted-foreground">
                Reopen the relationship without losing the work context.
              </p>
            </div>
          </div>
          <Rows>
            {contacts.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                <Avatar name={c.name} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{c.name}</span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">
                    Last touch · {c.lastTouch}
                  </span>
                </span>
                <ContactActions name={c.name} />
              </li>
            ))}
          </Rows>
        </section>
      ) : null}
      <section>
        <div className="mb-3 flex items-end justify-between gap-3 px-1">
          <div>
            <h2 className="text-[17px] font-semibold">People & places</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Start a conversation, call or create work from a known relationship.
            </p>
          </div>
          <Badge tone="quiet">{filtered.length}</Badge>
        </div>
        {filtered.length === 0 ? (
          <EmptyState title="No contacts found" body="Try a different name or clear the search." />
        ) : (
          <Rows>
            {filtered.map((e) => (
              <ContactRow key={e.id} entity={e} right={<ContactActions name={e.name} />} />
            ))}
          </Rows>
        )}
      </section>
      <div className="flex flex-wrap gap-2">
        <Link to="/providers" className={actionClass()}>
          Find providers
        </Link>
        <Link to="/messages" className={actionClass()}>
          Open messages
        </Link>
        <Link to="/work" className={actionClass("primary")}>
          Open Work
        </Link>
      </div>
    </div>
  );
}
