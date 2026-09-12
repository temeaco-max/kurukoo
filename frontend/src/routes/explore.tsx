import { ArrowUpRight, Compass, Search } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { AskKurukoo } from "@/components/kurukoo/ask-kurukoo";

export const Route = createFileRoute("/explore")({ head: () => ({ meta: [{ title: "Explore — Kurukoo" }, { name: "description", content: "Authenticated Explore bridge. Discovery now lives on the public Discover surface." }] }), component: ExplorePage });

function ExplorePage() {
  const initial = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("query")?.trim() ?? "";
  const [q, setQ] = useState(initial);
  const discoverHref = q.trim() ? `/discover?query=${encodeURIComponent(q.trim())}` : "/discover";
  return <div className="mx-auto w-full max-w-4xl space-y-8">
    <PageHeader eyebrow="Kurukoo OS" title="Explore" subtitle="Explore is now part of Discover. This authenticated surface keeps the OS shell in place while sending discovery into the single public Discover experience." />
    <section className="border-y border-border py-8">
      <div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center bg-brand-tint text-brand-ink"><Compass className="size-5"/></span><div><p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary">One discovery surface</p><h2 className="mt-1.5 text-[30px] font-semibold tracking-[-0.04em]">Nearby context + useful ideas.</h2><p className="mt-3 max-w-2xl text-[13px] leading-6 text-muted-foreground">The former Explore content — outcomes, opportunities, nearby context, commerce ideas and community context — now lives together on Discover so there is one clear place to look and one clear route into Chat / Voice.</p></div></div>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><input aria-label="Search Discover" value={q} onChange={(e)=>setQ(e.target.value)} placeholder="What are you looking for?" className="min-h-11 w-full border border-border bg-background pl-10 pr-3 text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring"/></div><Link to={discoverHref as never} className="inline-flex min-h-11 items-center justify-center gap-1.5 bg-primary px-4 text-[11.5px] font-medium text-primary-foreground">Open Discover <ArrowUpRight className="size-3.5"/></Link></div>
    </section>
    <div className="flex flex-wrap items-center gap-3"><AskKurukoo prompt={q ? `Help me with ${q}.` : "Help me decide what to do next."}/><Link to="/chat" className="text-[11.5px] font-medium text-muted-foreground hover:text-foreground">Open Chat / Voice</Link></div>
  </div>;
}
