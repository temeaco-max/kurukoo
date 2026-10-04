import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, MessageCircle, Package, Plug, Users } from "lucide-react";

export const Route = createFileRoute("/developers")({
  head: () => ({
    meta: [
      { title: "Developers — Kurukoo" },
      {
        name: "description",
        content:
          "Build around a conversation-first operating system through governed capabilities, canonical conversation, identity, request, provider and evidence boundaries.",
      },
      { property: "og:title", content: "Developers — Kurukoo" },
      {
        property: "og:description",
        content: "Use the canonical owner, not a shortcut: conversation, authorization and evidence stay canonical.",
      },
    ],
  }),
  component: DevelopersPage,
});

const pathways = [
  [
    MessageCircle,
    "Conversations",
    "Create contextual experiences that hand people back to Kurukoo without creating a second conversational identity.",
    "/chat",
    "Open Web Chat",
  ],
  [
    Package,
    "Requests",
    "Represent objectives as durable requests with explicit lifecycle, authorization and evidence.",
    "/activity",
    "Review request states",
  ],
  [
    BookOpen,
    "Capabilities",
    "Discover and compose Kurukoo capabilities without bypassing policy or truth boundaries.",
    "/capabilities",
    "Explore capabilities",
  ],
  [
    Users,
    "Connections",
    "Connect channels, devices and external services through one owner-scoped relationship.",
    "/connect",
    "Review connections",
  ],
] as const;

function DevelopersPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 pb-10">
      <header className="max-w-3xl">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">DEVELOPERS</p>
        <h1 className="mt-2 font-serif text-[40px] leading-[1.02] tracking-[-0.045em] md:text-[52px]">
          Build around a conversation-first operating system.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted-foreground">
          Kurukoo exposes governed capabilities through canonical conversation, identity, request,
          provider, agent, connection and evidence boundaries.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to="/api-docs"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-[12px] font-medium text-primary-foreground"
          >
            Explore API guidance
          </Link>
          <Link
            to="/chat"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border px-4 text-[12px] font-medium hover:bg-elevated"
          >
            Start in Web Chat
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-surface p-6">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">
          INTEGRATION BRIEF
        </p>
        <h2 className="mt-1.5 font-serif text-[24px] tracking-[-0.03em]">
          Use the canonical owner, not a shortcut.
        </h2>
        <dl className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <dt className="text-[13px] font-semibold">Conversation</dt>
            <dd className="mt-1 text-[12.5px] leading-6 text-muted-foreground">
              Preserves the user's context and return path.
            </dd>
          </div>
          <div>
            <dt className="text-[13px] font-semibold">Authorization</dt>
            <dd className="mt-1 text-[12.5px] leading-6 text-muted-foreground">
              Separates eligibility, consent and action.
            </dd>
          </div>
          <div>
            <dt className="text-[13px] font-semibold">Evidence</dt>
            <dd className="mt-1 text-[12.5px] leading-6 text-muted-foreground">
              Confirms provider, payment or delivery only when observed.
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="pathways">
        <div className="mb-4">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">
            DURABLE PRODUCT OBJECTS
          </p>
          <h2 id="pathways" className="mt-1.5 font-serif text-[28px] tracking-[-0.035em]">
            Compose around what stays true as work moves.
          </h2>
          <p className="mt-2 max-w-2xl text-[12.5px] leading-6 text-muted-foreground">
            Each pathway preserves a distinct product owner while returning people to the same
            Kurukoo relationship.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {pathways.map(([Icon, title, body, to, label]) => (
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

      <section id="api-access" className="rounded-2xl border border-border bg-surface p-6">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">
          GOVERNANCE IS PART OF THE PLATFORM
        </p>
        <h2 className="mt-1.5 font-serif text-[24px] tracking-[-0.03em]">
          Powerful integrations keep their boundaries visible.
        </h2>
        <p className="mt-2 max-w-2xl text-[12.5px] leading-6 text-muted-foreground">
          API consumers do not receive a shortcut around authentication, consent, payment, provider
          verification, execution authorization or evidence. Kurukoo keeps those boundaries canonical
          so integrations can remain useful without becoming unsafe or misleading.
        </p>
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-[12.5px] leading-6 text-muted-foreground">
          <li>Confirm the current supported capability and access path.</li>
          <li>Keep secrets outside browsers and public source control.</li>
          <li>Reflect pending, unavailable and recovery states as reported.</li>
        </ul>
        <Link
          to="/api-docs"
          className="mt-5 inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border px-4 text-[12px] font-medium hover:bg-elevated"
        >
          Read API reference
        </Link>
      </section>
    </div>
  );
}
