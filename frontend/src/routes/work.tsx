import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Clock3, FileCheck2, LockKeyhole, MessageCircle, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchExecutionOverview, type ExecutionOverview } from "@/lib/execution-api";
import { fetchLiveEconomicRequests } from "@/lib/live-economic-requests";
import { canonicalWorkItem } from "@/lib/work-projection";
import { useKurukoo } from "@/lib/kurukoo-store";
import type { WorkItem } from "@/lib/kurukoo-store";

export const Route = createFileRoute("/work")({
  head: () => ({ meta: [{ title: "Work — Kurukoo" }, { name: "description", content: "See what Kurukoo is taking care of, what needs you, and what has been completed." }] }),
  component: WorkPage,
});

function WorkPage() {
  const { work: localWork } = useKurukoo();
  const [overview, setOverview] = useState<ExecutionOverview | null>(null);
  const [canonicalWork, setCanonicalWork] = useState<WorkItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function refreshCanonicalWork() {
    setRefreshing(true);
    try {
      const requests = await fetchLiveEconomicRequests();
      setCanonicalWork(requests.map(canonicalWorkItem));
    } catch {
      setCanonicalWork(null);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void refreshCanonicalWork();
    void fetchExecutionOverview().then(setOverview).catch(() => setOverview(null));
    const timer = window.setInterval(() => void refreshCanonicalWork(), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  const work = canonicalWork ?? localWork;
  const active = work.filter((item) => item.stage !== "done");
  const completed = work.filter((item) => item.stage === "done");
  const needsYou = active.filter((item) => item.stage === "needs_you");
  const latest = active.slice(0, 6);

  return <div className="min-w-0 pb-12">
    <header className="max-w-3xl border-b border-border pb-8 pt-4 md:pt-7">
      <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground"><span className="size-1.5 rounded-full bg-[var(--color-success)]" />{active.length ? `${active.length} ${active.length === 1 ? "thing" : "things"} in motion` : "Ready when you are"}{canonicalWork !== null ? <span className="ml-1 text-[10px] text-muted-foreground/70">· live</span> : null}</div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Work</p>
          <h1 className="mt-1.5 text-[42px] font-semibold leading-[1] tracking-[-0.055em]">Things Kurukoo is taking care of.</h1>
          <p className="mt-4 max-w-2xl text-[14px] leading-6 text-muted-foreground">See what is in motion, what needs a decision from you, and what Kurukoo has actually completed.</p>
        </div>
        <button type="button" onClick={() => void refreshCanonicalWork()} disabled={refreshing} className="hidden shrink-0 items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground sm:inline-flex"><RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} /> {refreshing ? "Refreshing…" : "Refresh"}</button>
      </div>
    </header>

    {needsYou.length ? <section className="border-b border-border py-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><div className="flex items-center gap-2 text-[13px] font-semibold"><LockKeyhole className="size-4 text-primary" />Something needs you</div><p className="mt-1 text-[12px] text-muted-foreground">Kurukoo has reached a consequential step and is waiting for your decision.</p></div><Link to={(`/work/${needsYou[0].id}`) as never} className="inline-flex items-center gap-2 bg-primary px-4 py-2.5 text-[12px] font-medium text-primary-foreground">Review <ArrowRight className="size-3.5" /></Link></div><div className="mt-5 divide-y divide-border border-y border-border">{needsYou.slice(0, 4).map((item) => <Link key={item.id} to={(`/work/${item.id}`) as never} className="flex items-center gap-3 py-3 hover:bg-elevated"><LockKeyhole className="size-4 text-primary" /><span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{item.title}</span><span className="text-[11px] text-muted-foreground">Needs you</span><ArrowRight className="size-3.5 text-muted-foreground" /></Link>)}</div></section> : null}

    <section className="grid grid-cols-3 border-b border-border"><div className="py-5 pr-4"><p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">In motion</p><p className="mt-1 text-3xl font-semibold tracking-[-0.04em]">{active.length}</p></div><div className="border-l border-border px-4 py-5"><p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Waiting for you</p><p className="mt-1 text-3xl font-semibold tracking-[-0.04em]">{needsYou.length}</p></div><div className="border-l border-border pl-4 py-5"><p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Completed</p><p className="mt-1 text-3xl font-semibold tracking-[-0.04em]">{completed.length}</p></div></section>

    {active.length ? <section className="py-8"><div className="mb-4 flex items-end justify-between"><div><h2 className="text-[17px] font-semibold tracking-tight">In motion</h2><p className="mt-1 text-[12px] text-muted-foreground">Open anything to see its current state, next step and available evidence.</p></div><Link to="/chat" search={{ prompt: "Show me what you're taking care of" } as never} className="text-[12px] font-medium text-primary">Ask Kurukoo</Link></div><div className="divide-y divide-border border-y border-border">{latest.map((item) => <Link key={item.id} to={(`/work/${item.id}`) as never} className="group flex gap-4 py-5 hover:bg-elevated/50"><div className="grid size-8 shrink-0 place-items-center border border-border bg-surface">{item.stage === "needs_you" ? <LockKeyhole className="size-3.5 text-primary" /> : <Clock3 className="size-3.5 text-muted-foreground" />}</div><div className="min-w-0 flex-1"><div className="flex items-start gap-4"><div className="min-w-0 flex-1"><h3 className="text-[14px] font-semibold">{item.title}</h3><p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-muted-foreground">{item.detail}</p></div><ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></div><div className="mt-3 flex items-center gap-3 text-[10.5px] text-muted-foreground"><span>{item.stage === "needs_you" ? "Needs you" : item.stage === "understanding" ? "Getting started" : "Working"}</span><span>·</span><span>{item.updated}</span></div></div></Link>)}</div></section> : <section className="border-y border-border py-14 text-center"><Sparkles className="mx-auto size-6 text-muted-foreground" /><h2 className="mt-3 text-[16px] font-semibold">Nothing is being taken care of yet.</h2><p className="mx-auto mt-1 max-w-md text-[12px] leading-5 text-muted-foreground">Tell Kurukoo what you want done. You do not need to work out the route first.</p><Link to="/chat" className="mt-5 inline-flex items-center gap-2 bg-primary px-4 py-2.5 text-[12px] font-medium text-primary-foreground">Tell Kurukoo what needs doing <ArrowRight className="size-3.5" /></Link></section>}

    <section className="grid gap-8 border-t border-border py-8 lg:grid-cols-[1.15fr_.85fr]"><div><div className="flex items-center gap-2"><FileCheck2 className="size-4" /><h2 className="text-[16px] font-semibold">Recent activity</h2></div><p className="mt-1 text-[12px] text-muted-foreground">Completed actions stay tied to the evidence Kurukoo received.</p>{completed.length ? <div className="mt-4 divide-y divide-border border-y border-border">{completed.slice(0, 4).map((item) => <Link key={item.id} to={(`/work/${item.id}`) as never} className="flex items-center gap-3 py-3 hover:bg-elevated"><CheckCircle2 className="size-4 text-[var(--color-success)]" /><span className="min-w-0 flex-1 truncate text-[12px] font-medium">{item.title}</span><span className="text-[10.5px] text-muted-foreground">{item.updated}</span><ArrowRight className="size-3.5 text-muted-foreground" /></Link>)}</div> : <p className="mt-4 border-y border-dashed border-border py-5 text-[11.5px] text-muted-foreground">No completed work to revisit yet.</p>}</div><div className="border-l border-border pl-6"><div className="flex items-center gap-2"><MessageCircle className="size-4" /><h2 className="text-[16px] font-semibold">You stay in control</h2></div><p className="mt-2 text-[12px] leading-5 text-muted-foreground">Kurukoo can work through supported steps, but consequential actions still come back to you for approval. A request is not presented as complete without supporting evidence.</p><div className="mt-5 space-y-3 text-[11.5px]"><div className="flex gap-2"><LockKeyhole className="size-3.5 shrink-0" />Your approval stays yours</div><div className="flex gap-2"><FileCheck2 className="size-3.5 shrink-0" />Evidence stays with the work</div><div className="flex gap-2"><MessageCircle className="size-3.5 shrink-0" />Kurukoo remains the easiest way to ask what is happening</div></div></div></section>

    {overview?.executionLoop?.length ? <section className="border-t border-border pt-7"><p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Behind the scenes</p><h2 className="mt-1 text-[15px] font-semibold">Kurukoo handles the route. You handle the outcome.</h2><p className="mt-2 max-w-2xl text-[11.5px] leading-5 text-muted-foreground">The execution machinery remains available to the product, but you do not need to manage it. Ask Kurukoo when you want to understand a particular step.</p></section> : null}
  </div>;
}
