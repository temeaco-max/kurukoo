import { ArrowUpRight, Cookie, FileText, LockKeyhole, Scale, ShieldCheck, Bot } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel } from "@/components/kurukoo/ui";

export const Route = createFileRoute("/legal")({
  head: () => ({
    meta: [
      { title: "Legal & policies — Kurukoo" },
      { name: "description", content: "Kurukoo's legal, privacy, safety, security, cookie and AI policy centre." },
    ],
  }),
  component: LegalHub,
});

const groups = [
  {
    title: "Service agreement",
    items: [
      ["terms", "Terms of Service", "Accounts, requests, providers, businesses, content, payments and responsibilities.", FileText],
      ["ai-terms", "AI Terms", "AI, voice, automation, actions, memory, third-party models and your control.", Bot],
      ["acceptable-use", "Acceptable Use", "Prohibited, abusive, deceptive and unsafe uses of Kurukoo.", ShieldCheck],
    ] as const,
  },
  {
    title: "Privacy & safety",
    items: [
      ["privacy", "Privacy Policy", "Personal information, location, memory, communications, rights and deletion.", LockKeyhole],
      ["cookies", "Cookie Policy", "Session, security, preference and optional measurement technologies.", Cookie],
      ["safety", "Safety & Trust", "Evidence, availability, location, consequential actions and user control.", ShieldCheck],
      ["community-guidelines", "Community Guidelines", "Topics, replies, reports, moderation and public community context.", Scale],
    ] as const,
  },
  {
    title: "Compliance & platform policies",
    items: [
      ["compliance", "Compliance", "Regulatory boundaries, external activation and evidence requirements.", Scale],
      ["data-retention", "Data Retention", "Retention, expiry, deletion and export rules based on the current repository policy.", FileText],
      ["security", "Security", "Identity, authorisation, secrets, privacy, location and auditability principles.", LockKeyhole],
      ["points", "Points & Network Units", "Closed-loop points, payment boundaries and regulatory guardrails.", Scale],
      ["advertising", "Advertising Policy", "Sponsored discovery, disclosure, campaign approval and relevance.", FileText],
    ] as const,
  },
];

function LegalHub() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <section className="max-w-4xl">
        <p className="text-[12px] font-medium text-muted-foreground">Trust, legal & policy</p>
        <h1 className="mt-2 text-[44px] font-semibold leading-[1.01] tracking-[-0.05em] md:text-[60px]">The legal foundation around Kurukoo.</h1>
        <p className="mt-5 max-w-3xl text-[16px] leading-7 text-muted-foreground">A single place to understand the rules, safeguards and policy boundaries that sit underneath Kurukoo's conversational, discovery and fulfilment experiences.</p>
      </section>
      <Panel className="mt-8 border-primary/15 bg-brand-tint/10 p-5 md:p-6">
        <p className="text-[13px] font-semibold">Publication status</p>
        <p className="mt-1.5 text-[12.5px] leading-6 text-muted-foreground">These pages turn the current Kurukoo product decisions into user-facing policy surfaces. They are not a substitute for jurisdiction-specific legal advice. Final contractual wording, controller/entity details, statutory notices and regulated-product assessments must be approved before binding public launch.</p>
      </Panel>
      <div className="mt-10 space-y-8">
        {groups.map((group) => (
          <section key={group.title}>
            <div className="mb-4"><p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">Policy family</p><h2 className="mt-1.5 text-[22px] font-semibold tracking-tight">{group.title}</h2></div>
            <div className="grid gap-3 md:grid-cols-2">
              {group.items.map(([slug, title, body, Icon]) => (
                <Link key={slug} to={slug === "ai-terms" ? "/ai-terms" : "/legal/$section"} params={slug === "ai-terms" ? undefined : { section: slug }} className="group">
                  <Panel className="h-full p-5 transition-colors group-hover:bg-elevated/50">
                    <span className="grid size-9 place-items-center rounded-xl bg-elevated text-muted-foreground"><Icon className="size-4" /></span>
                    <h3 className="mt-4 text-[15px] font-semibold">{title}</h3>
                    <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{body}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-[11.5px] font-medium">Read policy <ArrowUpRight className="size-3.5" /></span>
                  </Panel>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="mt-10 grid gap-3 md:grid-cols-3">
        <Panel className="p-5"><p className="text-[13.5px] font-semibold">Privacy request</p><p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">Ask about your data, access, export or deletion.</p><Link to="/contact" className="mt-3 inline-flex text-[11.5px] font-medium underline">Contact</Link></Panel>
        <Panel className="p-5"><p className="text-[13.5px] font-semibold">Something unsafe?</p><p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">Use the safety policy and the product's reporting controls.</p><Link to="/legal/$section" params={{ section: "safety" }} className="mt-3 inline-flex text-[11.5px] font-medium underline">Safety & trust</Link></Panel>
        <Panel className="p-5"><p className="text-[13.5px] font-semibold">Understand the product</p><p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">Help explains how these policies appear in everyday use.</p><Link to="/help" className="mt-3 inline-flex text-[11.5px] font-medium underline">Open Help</Link></Panel>
      </div>
      <p className="mt-8 pb-6 text-[11px] text-muted-foreground">Repository policy set last reviewed July 2026. Dates, legal entity/controller details and jurisdiction-specific notices must come from final approved legal documents.</p>
    </div>
  );
}