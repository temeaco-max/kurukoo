import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Panel } from "@/components/kurukoo/ui";
import { actionClass } from "@/components/kurukoo/primitives";

export const Route = createFileRoute("/api-docs")({
  head: () => ({
    meta: [
      { title: "API reference — Kurukoo" },
      {
        name: "description",
        content:
          "The Kurukoo API: resource-oriented URLs, JSON responses, and explicit economic and delivery boundaries.",
      },
    ],
  }),
  component: ApiDocsPage,
});

const SECTIONS: Array<{
  id: string;
  tag: string;
  title: string;
  body: string;
  code: string | null;
  schema?: Array<[string, string]>;
}> = [
  {
    id: "getting-started",
    tag: "Reference",
    title: "Getting started",
    body: "The Kurukoo API exposes supported platform resources through resource-oriented URLs, form-encoded request bodies and JSON responses. Integrations should verify the current environment and access boundary before treating an endpoint as available.",
    code: "GET https://api.kurukoo.com/v1/health",
  },
  {
    id: "authentication",
    tag: "Security boundary",
    title: "Authentication",
    body: "API keys authenticate approved requests. Manage keys through the relevant Kurukoo Dashboard boundary, limit their scope, and keep them out of client-side code, source control and any public surface.",
    code: "Authorization: Bearer KURUKOO_SECRET_KEY",
  },
  {
    id: "rate-limits",
    tag: "Operational boundary",
    title: "Rate limits & recovery",
    body: "Build integrations to handle response codes, retry only when the response semantics allow it, and show a clear recovery state rather than assuming delivery or completion. Current limits and availability belong to the executing environment.",
    code: null,
  },
  {
    id: "profiles",
    tag: "Resource",
    title: "Profiles",
    body: "Retrieve details about a specific profile only through an authorized integration path and only where the corresponding consent and access boundaries are satisfied.",
    code: "GET /v1/profiles/+2348012345678",
    schema: [
      ["phone", "String · E.164 format"],
      ["name", "String"],
      ["credits", "Integer"],
      ["tier", '"base" | "plus" | "business"'],
    ],
  },
  {
    id: "skills",
    tag: "Resource",
    title: "Skills",
    body: "Capabilities are governed by their canonical eligibility, policy and readiness state. An integration should surface unavailable or incomplete state rather than infer a matching outcome.",
    code: null,
  },
  {
    id: "messaging",
    tag: "Lifecycle",
    title: "Messaging",
    body: "Message preparation, channel delivery and receipt evidence are distinct stages. Treat a channel as active only when its configured adapter and observed delivery state permit it.",
    code: null,
  },
  {
    id: "payments",
    tag: "Economic boundary",
    title: "Payments",
    body: "Preparation, provider confirmation, settlement and recovery are separate economic states. Client experiences must not label an action paid or settled until the canonical evidence is available.",
    code: null,
  },
];

function ApiDocsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <section>
        <p className="text-[12px] font-medium text-muted-foreground">Developers</p>
        <h1 className="mt-2 max-w-4xl font-serif text-[40px] leading-[1.03] tracking-[-0.045em] md:text-[54px]">
          Kurukoo API reference.
        </h1>
        <p className="mt-5 max-w-3xl text-[15px] leading-7 text-muted-foreground">
          Resource-oriented endpoints, explicit boundaries, and truthful states. Integrations should
          surface what the platform actually confirms — never an assumed outcome.
        </p>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="API sections" className="hidden lg:block">
          <ul className="sticky top-24 space-y-1.5 text-[12.5px]">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="grid gap-4">
          {SECTIONS.map((section) => (
            <Panel key={section.id} className="scroll-mt-24 p-6">
              <div id={section.id} />
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                {section.tag}
              </p>
              <h2 className="mt-1.5 text-[19px] font-semibold tracking-tight">{section.title}</h2>
              <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
                {section.body}
              </p>
              {section.code && (
                <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-elevated/40 p-3 text-[12px] leading-relaxed">
                  <code>{section.code}</code>
                </pre>
              )}
              {section.schema && (
                <dl className="mt-4 grid gap-2 text-[12px]">
                  {section.schema.map(([name, type]) => (
                    <div key={name} className="flex items-baseline gap-3">
                      <dt className="font-mono font-semibold">{name}</dt>
                      <dd className="text-muted-foreground">{type}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </Panel>
          ))}
        </div>
      </section>

      <section className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-elevated/30 p-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
            Need integration guidance?
          </p>
          <h2 className="mt-1.5 text-[19px] font-semibold tracking-tight">
            Start with the request and the boundary you need to preserve.
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/chat" className={actionClass("primary")}>
            Open Web Chat <ArrowUpRight className="size-3.5" />
          </Link>
          <Link to="/contact" className={actionClass()}>
            Contact partnerships
          </Link>
        </div>
      </section>
    </div>
  );
}
