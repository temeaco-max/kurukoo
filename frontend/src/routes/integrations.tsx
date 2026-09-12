import { ExternalLink, Plus, Search, ShieldCheck, X } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FAQSection } from "@/components/kurukoo/faq-section";
import { actionClass } from "@/components/kurukoo/primitives";
import { getKurukooAuthState } from "@/lib/kurukoo-auth";
import { integrationCategories, integrations, type Integration } from "@/lib/integration-catalog";
import { getIntegrationStatus, startIntegrationConnection, type IntegrationConnectionState } from "@/lib/kurukoo-integrations";

export const Route = createFileRoute("/integrations")({
  head: () => ({ meta: [{ title: "Integrations — Kurukoo" }, { name: "description", content: "Connect the tools, channels and services that can help Kurukoo get a job done." }] }),
  component: IntegrationsPage,
});

type ModalState = { integration: Integration; status?: IntegrationConnectionState; message?: string; authorizationUrl?: string } | null;

function statusLabel(integration: Integration, state?: IntegrationConnectionState) {
  if (integration.status === "native") return "Built in";
  if (integration.status === "planned") return "Coming soon";
  if (state?.connected) return "Connected";
  if (state?.configured && state?.enabled) return "Ready to connect";
  if (state?.configured === false) return "Not configured";
  return "Available";
}

function statusTone(integration: Integration, state?: IntegrationConnectionState) {
  if (integration.status === "native" || state?.connected) return "bg-brand-tint text-brand-ink";
  return "bg-elevated text-muted-foreground";
}

function IntegrationCard({ integration, state, onAdd }: { integration: Integration; state?: IntegrationConnectionState; onAdd: (integration: Integration) => void }) {
  const Icon = integration.icon;
  const connected = Boolean(state?.connected);
  const disabled = integration.status === "planned";
  return <article className="group relative flex min-h-[178px] flex-col border border-border bg-surface p-5 transition hover:border-foreground/20 hover:shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <span className="grid size-11 shrink-0 place-items-center bg-elevated text-foreground"><Icon className="size-5" /></span>
      <button type="button" onClick={() => onAdd(integration)} aria-label={`${disabled ? "View" : "Add"} ${integration.name}`} className="grid size-9 place-items-center border border-border bg-background text-muted-foreground transition hover:border-foreground/30 hover:text-foreground">
        {disabled ? <ExternalLink className="size-4" /> : connected ? <span className="text-[10px] font-semibold">✓</span> : <Plus className="size-4" />}
      </button>
    </div>
    <div className="mt-4 flex-1">
      <div className="flex flex-wrap items-center gap-2"><h3 className="text-[14.5px] font-semibold tracking-[-0.01em]"><Link to="/integrations/$integrationId" params={{ integrationId: integration.slug }} className="hover:underline">{integration.name}</Link></h3><span className={`px-2 py-1 text-[9px] font-medium ${statusTone(integration, state)}`}>{statusLabel(integration, state)}</span></div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">{integration.description}</p>
    </div>
    <div className="mt-4 flex flex-wrap gap-1.5">{integration.capabilities.slice(0, 3).map((capability) => <span key={capability} className="bg-elevated/70 px-2 py-1 text-[9px] text-muted-foreground">{capability}</span>)}</div>
  </article>;
}

function ConnectModal({ modal, onClose }: { modal: ModalState; onClose: () => void }) {
  if (!modal) return null;
  const { integration, status, message, authorizationUrl } = modal;
  const Icon = integration.icon;
  const needsLogin = message === "LOGIN_REQUIRED";
  const disabled = integration.status === "planned";
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-black/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="integration-modal-title" className="w-full max-w-md border border-border bg-background p-5 shadow-2xl md:p-6">
      <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center bg-elevated"><Icon className="size-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{integration.category}</p><h2 id="integration-modal-title" className="mt-0.5 text-[17px] font-semibold">{integration.name}</h2></div></div><button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center hover:bg-elevated"><X className="size-4" /></button></div>
      <p className="mt-5 text-[12.5px] leading-relaxed text-muted-foreground">{integration.detail}</p>
      <div className="mt-5 border border-border bg-elevated/45 p-4">
        {needsLogin ? <><p className="text-[13px] font-semibold">Sign in to connect {integration.name}</p><p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">Your connection belongs to your Kurukoo account. Sign in first, then return here to authorise the provider.</p><div className="mt-4"><Link to="/login" className={actionClass("primary")}>Sign in to Kurukoo</Link></div></> : disabled ? <><p className="text-[13px] font-semibold">Not ready to connect yet</p><p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{integration.detail}</p></> : authorizationUrl ? <><p className="text-[13px] font-semibold">Authenticate with {integration.name}</p><p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">Kurukoo has prepared the provider authorization flow. Review the permissions on the provider before approving access.</p><div className="mt-4 flex flex-wrap gap-2"><a href={authorizationUrl} className={actionClass("primary")}><ExternalLink className="size-3.5" /> Authenticate with {integration.name}</a></div></> : integration.setupPath ? <><p className="text-[13px] font-semibold">{integration.connectionLabel}</p><p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{message || "Continue to the supported setup flow. Kurukoo will only treat the connection as active after the relevant service or channel confirms it."}</p><div className="mt-4"><Link to={integration.setupPath} className={actionClass("primary")}>{integration.setupLabel || integration.connectionLabel}</Link></div></> : status?.reason ? <><p className="text-[13px] font-semibold">Connection unavailable</p><p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{status.reason}</p></> : <><p className="text-[13px] font-semibold">No connection flow is configured</p><p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">Kurukoo knows this source and shows it here, but this deployment does not yet expose a direct user authorization flow for it.</p></>}
      </div>
      {status?.connected ? <div className="mt-4 flex items-center gap-2 bg-brand-tint px-3 py-2.5 text-[11px] text-brand-ink"><ShieldCheck className="size-4" /> Connected to this Kurukoo account.</div> : null}
    </section>
  </div>;
}

function IntegrationsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"All" | (typeof integrationCategories)[number]>("All");
  const [states, setStates] = useState<Record<string, IntegrationConnectionState>>({});
  const [modal, setModal] = useState<ModalState>(null);

  useEffect(() => {
    let cancelled = false;
    const liveIntegrations = integrations.filter((integration) => integration.status === "available" && integration.endpoint);
    void Promise.all(liveIntegrations.map(async (integration) => {
      try { const state = await getIntegrationStatus(integration); if (!cancelled) setStates((current) => ({ ...current, [integration.slug]: state })); } catch { /* unavailable deployments remain visibly unconnected */ }
    }));
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => integrations.filter((integration) => {
    const matchesCategory = category === "All" || integration.category === category;
    const text = `${integration.name} ${integration.description} ${integration.category}`.toLowerCase();
    return matchesCategory && (!query.trim() || text.includes(query.trim().toLowerCase()));
  }), [category, query]);

  async function openAdd(integration: Integration) {
    if (integration.status === "planned") { setModal({ integration }); return; }
    const auth = await getKurukooAuthState();
    if (!auth.authenticated) { setModal({ integration, message: "LOGIN_REQUIRED" }); return; }
    if (integration.status === "native" || integration.auth === "channel" || integration.auth === "mcp" || integration.auth === "resource") { setModal({ integration, status: states[integration.slug] }); return; }
    setModal({ integration, status: states[integration.slug], message: "Preparing the provider authorization…" });
    try {
      const status = states[integration.slug] ?? await getIntegrationStatus(integration);
      setStates((current) => ({ ...current, [integration.slug]: status }));
      if (status.connected) { setModal({ integration, status, message: "This source is already connected to your Kurukoo account." }); return; }
      if (!status.configured || status.enabled === false) { setModal({ integration, status }); return; }
      const result = await startIntegrationConnection(integration);
      if (result.authorizationUrl) setModal({ integration, status, authorizationUrl: result.authorizationUrl });
      else setModal({ integration, status, message: "The provider did not return an authorization link." });
    } catch (error) { setModal({ integration, status: states[integration.slug], message: error instanceof Error ? error.message : "The connection could not be started." }); }
  }

  return <div className="mx-auto w-full max-w-6xl space-y-8 pb-10">
    <header className="max-w-3xl"><p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-primary">Integrations</p><h1 className="mt-2 text-[40px] font-semibold leading-[1.02] tracking-[-0.045em] md:text-[52px]">Connect the tools you already use</h1><p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted-foreground">Kurukoo can connect supported services and resources so authorised context can help get a job done. Connections are scoped, visible and under your control. Bring your tools into the flow.</p><div className="mt-5 flex flex-wrap gap-2"><Link to="/connect" className={actionClass("primary")}>Manage connections</Link><Link to="/chat" className={actionClass()}>Use Kurukoo</Link></div></header>
    <section aria-label="Integration directory" className="space-y-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Directory</p><h2 className="mt-1.5 text-[29px] font-semibold tracking-[-0.035em]">Add what Kurukoo needs</h2></div><label className="flex h-10 w-full max-w-sm items-center gap-2 border border-border bg-surface px-3"><Search className="size-4 text-muted-foreground" /><span className="sr-only">Search integrations</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search integrations" className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground" /></label></div><div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Integration categories">{["All", ...integrationCategories].map((item) => <button key={item} type="button" role="tab" aria-selected={category === item} onClick={() => setCategory(item as typeof category)} className={`whitespace-nowrap px-3 py-2 text-[10.5px] font-medium ${category === item ? "bg-foreground text-background" : "bg-elevated text-muted-foreground hover:text-foreground"}`}>{item}</button>)}</div>{integrationCategories.map((group) => { const items = filtered.filter((integration) => integration.category === group); if (!items.length) return null; return <section key={group} aria-labelledby={`integration-group-${group}`}><div className="mb-3"><h3 id={`integration-group-${group}`} className="text-[14px] font-semibold">{group}</h3><p className="mt-0.5 text-[10.5px] text-muted-foreground">{group === "Built into Kurukoo" ? "No external account required." : group === "AI assistants" ? "External conversation surfaces for the same Kurukoo experience." : "Connect only what a request needs."}</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map((integration) => <IntegrationCard key={integration.slug} integration={integration} state={states[integration.slug]} onAdd={openAdd} />)}</div></section>; })}</section>
    <section className="border border-border bg-surface p-5 md:p-6"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center bg-brand-tint text-brand-ink"><ShieldCheck className="size-5" /></span><div><h2 className="text-[15px] font-semibold">You stay in control</h2><p className="mt-1.5 max-w-3xl text-[12.5px] leading-relaxed text-muted-foreground">A connection is a defined doorway into a service. It does not mean unlimited access or automatic permission to act. Important external actions follow the relevant approval and evidence flow.</p></div></div></section>
    <FAQSection items={[{ question: "What happens when I add an integration?", answer: "Kurukoo either opens the relevant provider authorization flow or takes you to the supported setup for that source. You review the provider's permissions before approving access." }, { question: "Does connecting a service give Kurukoo unlimited access?", answer: "No. A connection only exposes the scope supported and authorised by the service and account. Kurukoo does not infer access that the provider has not granted." }, { question: "Can I connect more than one source?", answer: "Yes, where the provider supports it. Connected sources remain separate and are only used when the relevant request can use them." }, { question: "Can I disconnect a service?", answer: "Yes. Open Connections to review active sources and disconnect supported services." }, { question: "Why are some integrations marked coming soon?", answer: "Kurukoo keeps the directory complete without pretending a provider connection is live. A source is only shown as connected after its actual authorization or setup flow confirms it." }]} />
    <ConnectModal modal={modal} onClose={() => setModal(null)} />
  </div>;
}
