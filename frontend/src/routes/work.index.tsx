import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, CheckCircle2, Clock3, ListChecks, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EmptyState, PageHeader } from "@/components/app-shell";
import { WorkItemCard } from "@/components/kurukoo/primitives";
import { Panel } from "@/components/kurukoo/ui";
import { fetchEconomicRequests, isKurukooApiConfigured, type EconomicRequest } from "@/lib/kurukoo-api";
import { useKurukoo, type WorkItem } from "@/lib/kurukoo-store";
import { canonicalWorkItem } from "@/lib/work-projection";

export const Route = createFileRoute("/work/")({
  head: () => ({
    meta: [
      { title: "Work — Kurukoo" },
      { name: "description", content: "Everything Kurukoo is handling for you, and what it needs from you." },
    ],
  }),
  component: WorkPage,
});

function WorkPage() {
  const { work: localWork, advance } = useKurukoo();
  const configured = isKurukooApiConfigured();
  const [requests, setRequests] = useState<EconomicRequest[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState("");

  const refresh = () => {
    if (!configured) return;
    setLoading(true);
    setError("");
    void fetchEconomicRequests()
      .then(setRequests)
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load your requests."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, [configured]);

  const items: WorkItem[] = useMemo(() => (configured ? requests.map(canonicalWorkItem) : localWork), [configured, localWork, requests]);
  const active = items.filter((item) => item.stage !== "done");
  const needsYou = items.filter((item) => item.stage === "needs_you");
  const completed = items.filter((item) => item.stage === "done");

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Work"
        subtitle="The place to see what Kurukoo is doing, what needs you, and what actually happened."
        action={configured ? <button type="button" onClick={refresh} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[12px] font-medium hover:bg-elevated disabled:opacity-50"><RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />Refresh</button> : undefined}
      />

      <section className="relative overflow-hidden rounded-[24px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)] md:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-brand-tint/60 blur-3xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-primary"><Sparkles className="size-3.5" />Kurukoo at work</div>
            <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] md:text-[30px]">You stay in control. Kurukoo carries the work.</h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">Every request has a visible state. You can see what has happened, what is happening now, and exactly where Kurukoo needs your approval.</p>
          </div>
          <Link to="/chat" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[12.5px] font-medium text-primary-foreground hover:opacity-90">Start something new <ArrowRight className="size-4" /></Link>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <Panel className="p-4"><div className="flex items-center gap-2 text-muted-foreground"><ListChecks className="size-4" /><span className="text-[12px]">In progress</span></div><p className="mt-2 text-2xl font-semibold tracking-tight">{active.length}</p><p className="mt-0.5 text-[11.5px] text-muted-foreground">Requests Kurukoo is handling</p></Panel>
        <Panel className="p-4"><div className="flex items-center gap-2 text-muted-foreground"><Clock3 className="size-4" /><span className="text-[12px]">Needs you</span></div><p className="mt-2 text-2xl font-semibold tracking-tight">{needsYou.length}</p><p className="mt-0.5 text-[11.5px] text-muted-foreground">Approvals or decisions waiting</p></Panel>
        <Panel className="p-4"><div className="flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="size-4" /><span className="text-[12px]">Completed</span></div><p className="mt-2 text-2xl font-semibold tracking-tight">{completed.length}</p><p className="mt-0.5 text-[11.5px] text-muted-foreground">Requests with an outcome</p></Panel>
      </div>

      {needsYou.length > 0 ? <section className="rounded-[20px] border border-primary/20 bg-brand-tint/10 p-4 md:p-5"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Clock3 className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-[12px] font-semibold">Your attention is needed</p><p className="mt-1 text-[11.5px] text-muted-foreground">Kurukoo will not commit a consequential action without the approval shown here.</p><div className="mt-3 space-y-2">{needsYou.map((item) => <Link key={item.id} to="/work/$workId" params={{ workId: item.id }} className="flex items-center justify-between gap-3 rounded-xl border border-primary/15 bg-surface px-3 py-3 hover:bg-elevated"><span className="min-w-0 truncate text-[12.5px] font-medium">{item.title}</span><ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" /></Link>)}</div></div></div></section> : null}

      {error ? <div role="alert" className="rounded-xl border border-border bg-elevated/50 px-4 py-3 text-[11px] text-muted-foreground">{error}<button type="button" onClick={refresh} className="ml-2 font-medium underline">Try again</button></div> : null}

      {loading ? <Panel className="p-6 text-center text-[11.5px] text-muted-foreground">Loading your requests…</Panel> : items.length === 0 ? <section className="rounded-[20px] border border-dashed border-border bg-elevated/30 p-6 text-center"><EmptyState title="Nothing in flight" body="Tell Kurukoo what needs doing and this becomes the live place to follow it."/><Link to="/chat" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[12px] font-medium text-primary-foreground">Tell Kurukoo <ArrowRight className="size-3.5" /></Link></section> : <section><div className="mb-3 flex items-end justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Live requests</p><h2 className="mt-1 text-[18px] font-semibold tracking-tight">What Kurukoo is handling</h2></div><span className="text-[11px] text-muted-foreground">{items.length} total</span></div><ul className="space-y-3">{items.map((item) => <li key={item.id}><WorkItemCard item={item} onAdvance={configured ? undefined : advance} /><div className="mt-1 flex justify-end"><Link to="/work/$workId" params={{ workId: item.id }} className="inline-flex items-center gap-1 text-[10.5px] font-medium text-muted-foreground hover:text-foreground">Open request <ArrowUpRight className="size-3.5" /></Link></div></li>)}</ul></section>}

      {!configured ? <section className="rounded-xl border border-dashed border-border bg-elevated/35 px-4 py-3"><p className="text-[10.5px] font-semibold text-foreground">Preview mode</p><p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">This browser can demonstrate the request lifecycle locally. It does not claim that a provider, payment, dispatch or fulfilment event has happened outside this preview.</p></section> : null}
    </div>
  );
}
