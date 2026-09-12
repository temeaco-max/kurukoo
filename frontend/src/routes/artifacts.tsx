import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, FileText, FolderOpen, Link2, MessageSquare } from "lucide-react";
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

  useEffect(() => {
    void fetchConnectedResources()
      .then(setResources)
      .catch(() => setResources([]))
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
        <p className="mt-3 text-[14px] font-medium">Your library is empty.</p>
        <p className="mx-auto mt-1.5 max-w-md text-[11.5px] leading-relaxed text-muted-foreground">Ask Kurukoo to create, find or organise something. When there is a real outcome to keep, it can live here without taking the place of your conversation.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link to="/chat" search={{ prompt: "Help me create or find something useful" } as never} className={actionClass("primary")}><MessageSquare className="mr-1.5 size-3.5" />Ask Kurukoo</Link>
          <Link to="/work" className={actionClass()}>See Work <ArrowUpRight className="ml-1 size-3.5" /></Link>
        </div>
      </div>
    </section>

    {resources.length ? <section>
      <SectionHeader title="Connected sources" subtitle={`${resources.length} connected resource${resources.length === 1 ? "" : "s"} available to support your work.`} />
      <Panel className="p-4"><div className="flex flex-wrap gap-2">{resources.map((resource) => <span key={resource.id} className="inline-flex items-center gap-1.5 border border-border px-2.5 py-1.5 text-[10px]"><DirectoryStateBadge state={resource.state === "active" || resource.state === "connected" ? "available" : "not-connected"} />{resource.vendor || resource.label}</span>)}</div><div className="mt-4 flex flex-wrap gap-2"><Link to="/integrations" className={actionClass()}>Connect another service <ArrowUpRight className="ml-1 size-3.5" /></Link><Link to="/connect" className={actionClass()}>View connections</Link></div></Panel>
    </section> : loading ? <section className="border-y border-border py-6 text-[11px] text-muted-foreground">Checking connected sources…</section> : null}

    <section className="grid gap-6 border-t border-border pt-6 sm:grid-cols-3">
      <div><FileText className="size-4 text-primary" /><p className="mt-2 text-[12px] font-medium">Made by Kurukoo</p><p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">Briefs, drafts, reports and other generated work.</p></div>
      <div><Link2 className="size-4 text-primary" /><p className="mt-2 text-[12px] font-medium">Found for you</p><p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">Useful links, offers, quotes and discovery evidence.</p></div>
      <div><FolderOpen className="size-4 text-primary" /><p className="mt-2 text-[12px] font-medium">Saved from elsewhere</p><p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">Authorised files and context from connected services.</p></div>
    </section>

    <div className="pt-1"><AskKurukoo prompt="Help me find or create something useful for what I'm working on." /></div>
  </div>;
}
