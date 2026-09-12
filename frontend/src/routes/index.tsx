import { ArrowUpRight, Bell, BookOpen, CheckCircle2, Focus, Sparkles } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Composer } from "@/components/kurukoo/composer";
import { HomeForYou } from "@/components/kurukoo/home-for-you";
import { HomePromotionCarousel } from "@/components/kurukoo/home-promotion-carousel";
import { DailyPicksStrip } from "@/components/kurukoo/daily-picks";
import { QuickRepliesPanel } from "@/components/kurukoo/quick-replies";
import { SurveyPromptCard } from "@/components/kurukoo/survey-prompt";
import { ArtistBookingCard } from "@/components/kurukoo/artist-booking";
import { Panel, ContextIconTile } from "@/components/kurukoo/ui";
import { PulseControl } from "@/components/kurukoo/pulse-control";
import { fetchProactiveFeed, type ProactiveOpportunity } from "@/lib/kurukoo-api";
import { useKurukoo } from "@/lib/kurukoo-store";

const description = "Your Everyday AI that gets things done.";
export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Kurukoo — Your Everyday AI that gets things done" }, { name: "description", content: description }] }),
  component: HomePage,
});

function SectionAction({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to as never} className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:opacity-80">{children}<ArrowUpRight className="size-3.5" /></Link>;
}
function HomeHorizonIllustration() {
  return <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 overflow-hidden opacity-25"><div className="absolute right-[16%] top-4 size-14 rounded-full bg-[var(--primary)]/55 blur-[2px]" /><div className="absolute bottom-1 left-[46%] h-16 w-48 rounded-[50%] border border-[var(--brand-ink)]/35" /></div>;
}
function ActiveRequest({ id, title, detail, updated, needsYou = false }: { id: string; title: string; detail: string; updated: string; needsYou?: boolean }) {
  return <Link to="/work/$workId" params={{ workId: id }} className="group flex items-center gap-3 px-4 py-3.5 hover:bg-elevated/70"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-elevated text-muted-foreground">{needsYou ? <Bell className="size-4" /> : <CheckCircle2 className="size-4" />}</span><div className="min-w-0 flex-1"><p className="truncate text-[13.5px] font-medium group-hover:text-primary">{title}</p><p className="truncate text-[12px] text-muted-foreground">{detail}</p></div><span className="hidden shrink-0 text-[11px] text-muted-foreground sm:block">{updated}</span><ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" /></Link>;
}
function RadarCard({ item }: { item: ProactiveOpportunity }) {
  return <Link to={item.ctaLink as never} className="group flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)] transition-colors hover:bg-elevated"><ContextIconTile><Focus className="size-4" /></ContextIconTile><div className="min-w-0 flex-1"><p className="text-[13.5px] font-medium">{item.title}</p><p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{item.subtitle}</p><span className="mt-3 inline-flex rounded-full border border-border px-2.5 py-1 text-[10.5px] font-medium">{item.ctaText}</span></div><ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-60 transition-transform group-hover:translate-x-0.5" /></Link>;
}

export function HomePage() {
  const { work, send } = useKurukoo();
  const [opportunities, setOpportunities] = useState<ProactiveOpportunity[]>([]);
  useEffect(() => { void fetchProactiveFeed().then(setOpportunities).catch(() => {}); }, []);
  const active = work.filter((item) => item.stage !== "done");
  const attention = active.filter((item) => item.stage === "needs_you").slice(0, 3);
  const moving = active.filter((item) => item.stage !== "needs_you").slice(0, 3);

  return <div className="min-w-0 space-y-8 pb-8">
    <section aria-labelledby="home-hero-title" className="relative overflow-hidden pt-5 md:pt-9">
      <HomeHorizonIllustration />
      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1.5 text-[11px] text-muted-foreground shadow-[var(--shadow-soft)] backdrop-blur"><span className="grid size-5 place-items-center rounded-full bg-elevated"><Sparkles className="size-3 text-primary" /></span>Kurukoo is ready</div>
        <h1 id="home-hero-title" className="mt-5 text-[42px] font-semibold leading-[.98] tracking-[-0.055em] md:text-[60px]">Tell Kurukoo what needs doing.</h1>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground md:text-[16px]">You say what you want. Kurukoo works out what matters, finds the best route, and keeps you in control when an action needs your approval.</p>
        <div className="mx-auto mt-6 max-w-3xl text-left"><Composer onSend={send} placeholder="What would you like me to get done?" /></div>
        <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[11.5px] text-muted-foreground"><span>Personal</span><span>Digital</span><span>Real-world</span><span>Say “Hey Kurukoo”</span><span>Always show me what happened</span></div>
      </div>
    </section>

    <HomeForYou />

    {active.length > 0 ? <section aria-labelledby="home-working-title" className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
      <Panel className="overflow-hidden p-0"><div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Your actions</p><h2 id="home-working-title" className="mt-1 text-[18px] font-semibold tracking-tight">Things Kurukoo is handling</h2></div><SectionAction to="/work">Open Actions</SectionAction></div><div className="divide-y divide-border/70">{attention.map((item) => <ActiveRequest key={item.id} id={item.id} title={item.title} detail="Needs your attention" updated={item.updated} needsYou />)}{moving.map((item) => <ActiveRequest key={item.id} id={item.id} title={item.title} detail={item.detail} updated={item.updated} />)}</div></Panel>
      {opportunities.length > 0 ? <div className="space-y-3"><div className="px-1"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">I noticed</p><h2 className="mt-1 text-[18px] font-semibold tracking-tight">Something worth your attention</h2></div>{opportunities.slice(0, 2).map((item) => <RadarCard key={item.id} item={item} />)}</div> : <Panel className="flex min-h-[180px] flex-col justify-between p-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Quiet for now</p><h2 className="mt-1 text-[18px] font-semibold">I’m keeping an eye on things.</h2><p className="mt-2 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">When there is something genuinely useful to tell you, it will appear here.</p></div><Link to="/discover" className="text-[12px] font-medium text-primary">Explore what Kurukoo can do <ArrowUpRight className="inline size-3.5" /></Link></Panel>}
    </section> : <section className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]"><Panel className="p-5"><div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-elevated"><Sparkles className="size-5 text-primary" /></span><div><h2 className="text-[18px] font-semibold">Nothing is waiting on you.</h2><p className="mt-1.5 max-w-lg text-[13px] leading-relaxed text-muted-foreground">That means Kurukoo has no active work that needs your attention right now. Start something whenever you’re ready.</p></div></div></Panel>{opportunities.slice(0, 2).map((item) => <RadarCard key={item.id} item={item} />)}</section>}

    <section className="grid gap-4 lg:grid-cols-2">
      <DailyPicksStrip />
      <QuickRepliesPanel />
    </section>

    <section aria-label="Kurukoo ecosystem" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="min-w-0"><PulseControl /></div>
      <HomePromotionCarousel />
      <Panel className="min-h-[132px] p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-[14px] font-semibold">Topics</h2><SectionAction to="/topics">Open</SectionAction></div><p className="text-[12px] leading-relaxed text-muted-foreground">Ideas, conversations and useful knowledge around what people are trying to get done.</p></Panel>
      <Panel className="min-h-[132px] p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-[14px] font-semibold">Resources</h2><SectionAction to="/resources">Open</SectionAction></div><p className="text-[12px] leading-relaxed text-muted-foreground">Guides and useful tools for getting more from Kurukoo.</p><BookOpen className="mt-4 size-4 text-muted-foreground" /></Panel>
    </section>

    <div className="grid gap-4 lg:grid-cols-2">
      <SurveyPromptCard />
      <ArtistBookingCard />
    </div>
  </div>;
}