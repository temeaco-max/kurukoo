import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { AskKurukoo } from "@/components/kurukoo/ask-kurukoo";
import { RecommendationCard, VideoCard } from "@/components/kurukoo/cards";
import { actionClass } from "@/components/kurukoo/primitives";
import { AdSlot, SectionHeader } from "@/components/kurukoo/ui";
import { fetchDailyPick, isKurukooApiConfigured, type DailyPick } from "@/lib/kurukoo-api";
import { entities, entityById, videos } from "@/lib/kurukoo-demo";

export const Route = createFileRoute("/daily-picks")({ head: () => ({ meta: [{ title: "Daily Picks — Kurukoo" }, { name: "description", content: "A short, useful set of providers, businesses, creators and topics for today." }] }), component: DailyPicksPage });

function DailyPicksGrid({ limit = 4 }: { limit?: number }) {
  const picks = entities.filter((e) => e.kind !== "contributor").slice(0, limit);
  return <div className="grid gap-3 sm:grid-cols-2">{picks.map((e) => <RecommendationCard key={e.id} title={e.name} reason={e.tagline} meta={e.location ?? e.kind} to={<Link to="/profile/$entityId" params={{ entityId: e.id }} className="text-[13.5px] underline">View</Link>} />)}<RecommendationCard sponsored title="Autumn boiler service" reason="A sponsored recommendation slot, clearly marked apart from organic picks." meta="Example advertiser" /></div>;
}

function LivePick({ pick }: { pick: DailyPick }) {
  return <section className="rounded-[22px] border border-border bg-surface p-5 md:p-6"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand-ink"><Sparkles className="size-4.5" /></span><div className="min-w-0 flex-1"><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-primary">Live pick</p><h2 className="mt-1.5 font-serif text-[28px] leading-tight tracking-[-0.035em]">{pick.title}</h2><p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">{pick.description}</p><div className="mt-4 flex flex-wrap gap-2"><AskKurukoo prompt={`Tell me more about today's Kurukoo pick: ${pick.title}. If it is suitable, help me make a verified request.`} /><Link to="/explore" className={actionClass()}>Explore <ArrowUpRight className="ml-1 size-3.5" /></Link></div></div></div></section>;
}

function DailyPicksPage() {
  const [pick, setPick] = useState<DailyPick | null>(null);
  const [loading, setLoading] = useState(isKurukooApiConfigured());
  useEffect(() => { if (!isKurukooApiConfigured()) return; void fetchDailyPick().then(setPick).catch(() => setPick(null)).finally(() => setLoading(false)); }, []);
  return <><PageHeader title="Daily Picks" subtitle="A short list worth your attention today." />
    {loading ? <div className="h-32 animate-pulse rounded-[22px] bg-elevated/40" /> : pick ? <LivePick pick={pick} /> : <section className="rounded-[22px] border border-dashed border-border px-5 py-7"><p className="text-[12.5px] font-medium">No live pick is available right now.</p><p className="mt-1 text-[11px] text-muted-foreground">The examples below keep the experience populated while live recommendation inventory is unavailable.</p><button type="button" onClick={() => { setLoading(true); void fetchDailyPick().then(setPick).catch(() => setPick(null)).finally(() => setLoading(false)); }} className="mt-3 inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-[11px] font-medium"><RefreshCw className="size-3.5" /> Try live pick again</button></section>}
    <section className="mt-7"><SectionHeader title="Today's suggestions" subtitle="Example content for the OS surface; live recommendations remain separate." /><DailyPicksGrid /></section>
    <section className="mt-8"><SectionHeader title="Watch today" /><div className="grid gap-4 sm:grid-cols-2">{videos.slice(0, 2).map((v) => <VideoCard key={v.id} video={v} creatorName={entityById(v.creatorId)?.name ?? ""} />)}</div></section>
    <div className="mt-8"><AdSlot placement="Daily Picks" headline="Sponsored placement" body="Advertising slots sit inside Daily Picks but never imitate organic recommendations." advertiser="Example advertiser" /></div>
  </>;
}
