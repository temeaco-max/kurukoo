import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { actionClass } from "@/components/kurukoo/primitives";
import { getKurukooAuthState } from "@/lib/kurukoo-auth";
import { getIntegration } from "@/lib/integration-catalog";
import { getIntegrationStatus, startIntegrationConnection } from "@/lib/kurukoo-integrations";

export const Route = createFileRoute("/integrations/$integrationId")({
  head: ({ params }) => {
    const integration = getIntegration(params.integrationId);
    return { meta: [{ title: `${integration?.name ?? "Integration"} — Kurukoo` }, { name: "description", content: integration?.description ?? "Connect a supported Kurukoo integration." }] };
  },
  component: IntegrationDetailPage,
});

function IntegrationDetailPage() {
  const { integrationId } = Route.useParams();
  const integration = getIntegration(integrationId);
  const [message, setMessage] = useState<string | null>(null);
  const [authorizationUrl, setAuthorizationUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!integration) return <div className="mx-auto w-full max-w-5xl py-8"><Link to="/integrations" className="inline-flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Back to integrations</Link><h1 className="mt-8 font-serif text-[40px] tracking-[-0.04em]">Integration not found</h1></div>;
  const Icon = integration.icon;

  async function connect() {
    setBusy(true); setMessage(null); setAuthorizationUrl(null);
    try {
      const auth = await getKurukooAuthState();
      if (!auth.authenticated) { setMessage("Sign in to Kurukoo first, then return here to connect this service."); return; }
      if (integration.status === "planned") { setMessage("This connection is listed in the directory but its provider authorization flow is not live yet."); return; }
      if (integration.endpoint) {
        const status = await getIntegrationStatus(integration);
        if (status.connected) { setMessage("This source is already connected to your Kurukoo account."); return; }
        if (!status.configured || status.enabled === false) { setMessage(status.reason || "This provider is not configured for the current deployment."); return; }
        const result = await startIntegrationConnection(integration);
        if (result.authorizationUrl) setAuthorizationUrl(result.authorizationUrl);
        else setMessage("The provider did not return an authorization link.");
      } else if (integration.setupPath) {
        setMessage("Use the setup action below to continue.");
      } else {
        setMessage("This integration does not expose a direct connection flow yet.");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "The connection could not be started."); } finally { setBusy(false); }
  }

  return <div className="mx-auto w-full max-w-5xl space-y-7 pb-10">
    <Link to="/integrations" className="inline-flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> All integrations</Link>
    <header className="max-w-3xl"><div className="flex items-start gap-4"><span className="grid size-14 shrink-0 place-items-center rounded-[17px] bg-elevated"><Icon className="size-6" /></span><div><p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-primary">{integration.category}</p><h1 className="mt-1 font-serif text-[40px] leading-[1.02] tracking-[-0.045em] md:text-[50px]">{integration.name}</h1><p className="mt-3 text-[15px] leading-7 text-muted-foreground">{integration.description}</p></div></div></header>
    <section className="grid gap-3 md:grid-cols-[1.5fr_1fr]">
      <div className="rounded-[22px] border border-border bg-surface p-5 md:p-6"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">What happens</p><p className="mt-2 text-[13px] leading-6 text-foreground/80">{integration.detail}</p><div className="mt-5 flex flex-wrap gap-2">{integration.capabilities.map((capability) => <span key={capability} className="rounded-full bg-elevated px-2.5 py-1.5 text-[10px] text-muted-foreground">{capability}</span>)}</div></div>
      <div className="rounded-[22px] border border-border bg-elevated/40 p-5 md:p-6"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Connection</p><p className="mt-2 text-[13px] leading-6 text-muted-foreground">{integration.status === "native" ? "This capability is already part of Kurukoo." : integration.status === "planned" ? "The directory is ready, but the provider connection is not live yet." : integration.auth === "oauth" ? "You authenticate with the provider. Kurukoo receives only the authorised connection." : "Follow the provider's supported setup flow."}</p><div className="mt-5 flex flex-wrap gap-2">{integration.endpoint ? <button type="button" disabled={busy} onClick={() => void connect()} className={actionClass("primary")}>{busy ? "Preparing…" : integration.connectionLabel}</button> : integration.setupPath ? <Link to={integration.setupPath} className={actionClass("primary")}>{integration.setupLabel || integration.connectionLabel}</Link> : null}{integration.auth === "mcp" ? <a href="/mcp" className={actionClass()}><ExternalLink className="size-3.5" /> MCP endpoint</a> : null}</div>{authorizationUrl ? <div className="mt-4 rounded-xl border border-primary/20 bg-brand-tint/10 p-3"><p className="text-[11px] leading-relaxed text-muted-foreground">Review the provider permissions, then authenticate.</p><a href={authorizationUrl} className="mt-2 inline-flex items-center gap-2 text-[12px] font-semibold text-brand-ink underline">Authenticate with {integration.name} <ExternalLink className="size-3.5" /></a></div> : null}{message ? <p className="mt-4 rounded-xl bg-background px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">{message}</p> : null}</div>
    </section>
    <section className="rounded-[22px] border border-border bg-surface p-5 md:p-6"><div className="flex items-start gap-3"><span className="grid size-9 place-items-center rounded-xl bg-brand-tint text-brand-ink"><ShieldCheck className="size-4" /></span><div><h2 className="text-[14px] font-semibold">Your access stays scoped</h2><p className="mt-1.5 max-w-3xl text-[11.5px] leading-relaxed text-muted-foreground">Connecting a source does not give Kurukoo unlimited access. Provider permissions, Kurukoo authorization and action approval remain separate controls.</p></div></div></section>
  </div>;
}
