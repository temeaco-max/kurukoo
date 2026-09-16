import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, ExternalLink, FileText, FolderOpen, Link2, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { AskKurukoo } from "@/components/kurukoo/ask-kurukoo";
import { actionClass } from "@/components/kurukoo/primitives";
import { DirectoryStateBadge } from "@/components/kurukoo/surface-directory";
import { Panel, SectionHeader } from "@/components/kurukoo/ui";
import { fetchConnectedResources, type ConnectedResource } from "@/lib/kurukoo-api";

export const Route = createFileRoute("/artifacts")({
  head: () => ({ meta: [{ title: "Artifacts — Kurukoo" }, { name: "description", content: "A library of useful things Kurukoo has made, found or saved while helping you." }] }),
  component: ArtifactsPage,
});

function ArtifactsPage() {
  const [resources, setResources] = useState<ConnectedResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetchConnectedResources()
      .then((items) => { setResources(items); setError(""); })
      .catch((cause) => { setResources([]); setError(cause instanceof Error ? cause.message : "Connected sources are unavailable."); })
      .finally(() => setLoading(false));
  }, []);

  return <div className="space-y-8 pb-10">
    <PageHeader title="Artifacts" subtitle="Useful things Kurukoo has made, found or saved while helping you get something done." />

    <section className="border-y border-border py-7">
      <div className="max-w-3xl">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-primary">A library, not another workspace</p>
        <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.04em]">Come back to the things that matter.</h2>
        <p className="mt-2.5 max-w-2xl text-[12.5px] leading-6 text-muted-foreground">Artifacts belong to the conversation or work that created them. They can be briefs, files, evidence, links, quotes or other useful outputs. Nothing appears here unless Kurukoo has a real source or a real generated result.</p>
      </div>
    </section>

    <section>
      <SectionHeader title="Your library" subtitle="Generated or sourced outcomes appear here when they exist." />
      <div className="border-y border-border py-12 text-center">
        <FolderOpen className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-3 text-[14px] font-medium">No saved artifacts yet.</p>
        <p className="mx-auto mt-1.5 max-w-md text-[11.5px] leading-relaxed text-muted-foreground">Ask Kurukoo to create, find or organise something. When there is a real outcome to keep, it can live here without taking the place of your conversation.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link to="/chat" search={{ prompt: "Help me create or find something useful" } as never} className={actionClass("primary")}><MessageSquare className="mr-1.5 size-3.5" />Ask Kurukoo</Link>
          <Link to="/work" className={actionClass()}>See Work <ArrowUpRight className="ml-1 size-3.5" /></Link>
        </div>
      </div>
    </section>

    <section>
      <SectionHeader title="Connected sources" subtitle={loading ? "Checking connected sources…" : error ? "The canonical connection service did not return source state." : resources.length ? `${resources.length} connected resource${resources.length === 1 ? "" : "s"} available to support your work.` : "No connected resources are currently available to this account."} />
      {loading ? <Panel className="p-4"><div className="h-10 animate-pulse bg-elevated" /></Panel> : error ? <Panel className="p-4"><p className="text-[12px] text-muted-foreground">{error}</p><Link to="/connect" className={actionClass()}><ArrowUpRight className="size-3.5" />Open Connections</Link></Panel> : resources.length ? <Panel className="p-4"><div className="grid gap-2 sm:grid-cols-2">{resources.map((resource) => <div key={resource.id} className="flex items-center justify-between gap-3 border border-border px-3 py-2.5"><span className="min-w-0"><span className="block truncate text-[11.5px] font-medium">{resource.label}</span><span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{resource.vendor || resource.kind}{resource.protocol ? ` · ${resource.protocol}` : ""}</span></span><span className="flex shrink-0 items-center gap-2"><DirectoryStateBadge state={resource.state === "active" || resource.state === "connected" ? "available" : "not-connected"} /><Link to="/connect" className="text-muted-foreground hover:text-foreground" aria-label={`Open connection for ${resource.label}`}><ExternalLink className="size-3.5" /></Link></span></div>)}</div><div className="mt-4 flex flex-wrap gap-2"><Link to="/integrations" className={actionClass()}>Connect another service <ArrowUpRight className="ml-1 size-3.5" /></Link><Link to="/connect" className={actionClass()}>View connections</Link></div></Panel> : <Panel className="p-5"><p className="text-[12px] font-medium">No connected source is available yet.</p><p className="mt-1 text-[11px] text-muted-foreground">Connections become useful context for future work, but do not by themselves create an artifact or prove an external outcome.</p><Link to="/connect" className={actionClass("primary")}>Open Connections <ArrowUpRight className="ml-1 size-3.5" /></Link></Panel>}
    </section>

    <section className="grid gap-6 border-t border-border pt-6 sm:grid-cols-3">
      <div><FileText className="size-4 text-primary" /><p className="mt-2 text-[12px] font-medium">Made by Kurukoo</p><p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">Briefs, drafts, reports and other generated work.</p></div>
      <div><Link2 className="size-4 text-primary" /><p className="mt-2 text-[12px] font-medium">Found for you</p><p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">Useful links, offers, quotes and discovery evidence.</p></div>
      <div><FolderOpen className="size-4 text-primary" /><p className="mt-2 text-[12px] font-medium">Saved from elsewhere</p><p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">Authorised files and context from connected services.</p></div>
    </section>

    <div className="pt-1"><AskKurukoo prompt="Help me find or create something useful for what I'm working on." /></div>
  </div>;
}
