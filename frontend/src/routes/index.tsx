import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Bell, BookOpen, Building2, CreditCard, ExternalLink, Focus, KeyRound, Lock, Monitor, ShoppingBag } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Composer } from "@/components/kurukoo/composer";
import { AIProviderDirectory } from "@/components/kurukoo/ai-provider-directory";
import { HomeForYou } from "@/components/kurukoo/home-for-you";
import { HomePromotionCarousel } from "@/components/kurukoo/home-promotion-carousel";
import { Panel, ContextIconTile } from "@/components/kurukoo/ui";
import { PulseControl } from "@/components/kurukoo/pulse-control";
import { fetchAuthenticatedAd, fetchProactiveFeed, type AuthenticatedAd, type ProactiveOpportunity } from "@/lib/kurukoo-api";
import { useKurukoo } from "@/lib/kurukoo-store";

const description = "Your personal workspace for getting useful things done with Kurukoo.";
export const Route = createFileRoute("/")({ head: () => ({ meta: [{ title: "Everyday AI OS for real life" }, { name: "description", content: description }] }), component: HomePage });
function SectionAction({ to, children }: { to: string; children: ReactNode }) { return <Link to={to as never} className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:opacity-80">{children}<ArrowUpRight className="size-3.5" /></Link>; }
function CardHeader({ title, count }: { title: string; count?: number }) { return <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4"><h2 className="min-w-0 text-[14px] font-semibold tracking-tight">{title}</h2>{count !== undefined ? <span className="grid min-w-6 place-items-center rounded-full bg-elevated px-1.5 py-1 text-[10.5px] text-muted-foreground">{count}</span> : null}</div>; }
function IconTile({ children, className }: { children: ReactNode; className?: string }) { return <ContextIconTile className={className}>{children}</ContextIconTile>; }
function HomeHorizonIllustration() { return <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 overflow-hidden opacity-35"><div className="absolute right-[13%] top-2 size-11 rounded-full bg-[var(--primary)]/60 blur-[1px]" /><div className="absolute bottom-3 left-[47%] h-16 w-40 rounded-[50%] border border-[var(--brand-ink)]/40" /><Building2 className="absolute bottom-4 right-[32%] size-9 text-muted-foreground/40" /></div>; }
function ActiveHomeRequest({ title, detail, timing, needsYou = false }: { title: string; detail: string; timing: string; needsYou?: boolean }) { return <div className="flex min-w-0 items-center gap-2.5 px-3.5 py-2.5"><span className="grid size-7 shrink-0 place-items-center rounded-[10px] bg-brand-tint text-brand-ink">{needsYou ? <Bell className="size-3.5" /> : <ShoppingBag className="size-3.5" />}</span><div className="min-w-0 flex-1"><p className="truncate text-[13px] font-medium">{title}</p><p className="truncate text-[11.5px] text-muted-foreground">{detail}</p><p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">{timing}</p></div></div>; }
function OpportunityCard({ item }: { item: ProactiveOpportunity }) { return <Link to={item.ctaLink as never} className="flex items-center gap-3 px-4 py-3.5 hover:bg-elevated"><IconTile className="bg-elevated text-muted-foreground"><Focus className="size-4" /></IconTile><div className="min-w-0 flex-1"><p className="truncate text-[13.5px] font-medium">{item.title}</p><p className="truncate text-[11.5px] text-muted-foreground">{item.subtitle}</p></div><span className="shrink-0 rounded-full border border-border px-3 py-1.5 text-[10.5px]">{item.ctaText}</span></Link>; }
function SponsoredDeskCard({ campaign }: { campaign: AuthenticatedAd | null }) { if (!campaign) return null; return <a href={campaign.clickUrl} rel="nofollow" className="block rounded-[18px] border border-border bg-elevated/45 p-4 hover:bg-elevated"><div className="flex items-center justify-between gap-2"><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{campaign.disclosure}</p><ExternalLink className="size-3 text-muted-foreground" /></div><div className="mt-3 flex items-start gap-3">{campaign.image ? <img src={campaign.image} alt="" loading="lazy" width="88" height="60" className="size-[88px] shrink-0 rounded-xl object-cover" /> : null}<div className="min-w-0"><p className="text-[13.5px] font-semibold">{campaign.title}</p><p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{campaign.desc}</p><span className="mt-2 inline-flex text-[10.5px] font-medium">{campaign.ctaText}</span></div></div></a>; }

export function HomePage() {
  const { work, send } = useKurukoo();
  const [opportunities, setOpportunities] = useState<ProactiveOpportunity[]>([]);
  const [deskAd, setDeskAd] = useState<AuthenticatedAd | null>(null);
  useEffect(() => { void Promise.all([fetchProactiveFeed().then(setOpportunities).catch(() => {}), fetchAuthenticatedAd("desk-content").then(setDeskAd).catch(() => {})]); }, []);
  const active = work.filter((item) => item.stage !== "done");
  const attention = active.filter((item) => item.stage === "needs_you").slice(0, 3);
  const moving = active.filter((item) => item.stage !== "needs_you").slice(0, 3);

  return <div className="min-w-0 space-y-5">
    <section aria-labelledby="home-hero-title" className="relative overflow-hidden pb-2 pt-4 md:pt-6">
      <HomeHorizonIllustration />
      <div className="relative z-10 max-w-4xl">
        <p className="mb-1 text-[13px] font-medium text-muted-foreground">Your everyday, moving forward.</p>
        <h1 id="home-hero-title" className="font-serif text-[40px] leading-[1.02] tracking-[-0.045em]">Tell Kurukoo what needs doing</h1>
        <div className="mt-5 max-w-[920px]"><Composer onSend={send} placeholder="What needs your attention?" /></div>
      </div>
    </section>

    {deskAd ? <SponsoredDeskCard campaign={deskAd} /> : null}

    <HomeForYou />

    <div className="grid min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,.65fr)_minmax(0,.9fr)_minmax(0,1.08fr)]">
      <Panel className="overflow-hidden p-0"><CardHeader title="What needs your attention" count={attention.length} />{attention.length ? <div className="divide-y divide-border/70">{attention.map((item) => <ActiveHomeRequest key={item.id} title={item.title} detail={item.detail} timing={item.updated} needsYou />)}</div> : <div className="px-4 py-5 text-[12px] text-muted-foreground">Nothing needs your attention.</div>}<div className="border-t border-border/60 px-4 py-3"><SectionAction to="/activity">Open Activity</SectionAction></div></Panel>
      <Panel className="overflow-hidden p-0"><CardHeader title="What’s moving" count={moving.length} /><div className="pb-1">{moving.length ? moving.map((item) => <div key={item.id} className="flex items-start gap-2.5 px-4 py-2.5"><span className="grid size-7 place-items-center rounded-full bg-elevated"><Focus className="size-3.5" /></span><div className="min-w-0 flex-1"><p className="text-[13px] font-medium">{item.title}</p><p className="text-[11.5px] text-muted-foreground">{item.detail}</p></div><span className="ml-auto text-[10.5px] text-muted-foreground">{item.updated}</span></div>) : <div className="px-4 py-5 text-[12px] text-muted-foreground">Nothing is moving.</div>}</div><div className="px-4 py-3"><SectionAction to="/work">Open Work</SectionAction></div></Panel>
      <Panel className="overflow-hidden p-0"><CardHeader title="Radar" count={opportunities.slice(0, 2).length} />{opportunities.slice(0, 2).length ? opportunities.slice(0, 2).map((item) => <OpportunityCard key={item.id} item={item} />) : <div className="px-4 py-5 text-[12px] text-muted-foreground">Radar is quiet.</div>}<div className="px-4 py-3"><SectionAction to="/discover">Open Nearby</SectionAction></div></Panel>
    </div>

    <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="min-w-0"><PulseControl /></div>
      <HomePromotionCarousel />
      <Panel className="min-h-[116px] p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-[14px] font-semibold">Topics</h2><SectionAction to="/topics">Open</SectionAction></div><p className="text-[12px] text-muted-foreground">Community discussion.</p></Panel>
      <Panel className="min-h-[116px] p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-[14px] font-semibold">Wallet</h2><SectionAction to="/wallet">Open</SectionAction></div><p className="text-[12px] text-muted-foreground">Points and money.</p></Panel>
    </div>

    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2"><AIProviderDirectory compact /></div>
      <div className="space-y-4">
        <Panel className="p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-[14px] font-semibold">Explore</h2><SectionAction to="/explore">Open</SectionAction></div><p className="text-[12px] text-muted-foreground">People, places, services and opportunities.</p></Panel>
        <Link to="/resources" className="group block rounded-[18px] border border-border bg-surface p-4 hover:bg-elevated"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-elevated"><BookOpen className="size-4" /></span><div><h2 className="text-[14px] font-semibold">Resources</h2><p className="text-[11.5px] text-muted-foreground">Guides for getting more from Kurukoo.</p></div><ArrowUpRight className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></div></Link>
      </div>
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      <Panel className="overflow-hidden p-0">
        <div className="border-b border-border/70 px-4 py-3"><h2 className="text-[14px] font-semibold">Secure</h2></div>
        <div className="divide-y divide-border/70">
          <Link to="/audit" className="flex items-center gap-3 px-4 py-3 hover:bg-elevated"><Lock className="size-4 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="text-[13px] font-medium">Activity & audit</p><p className="text-[11.5px] text-muted-foreground">What you asked, planned and done</p></div><ArrowUpRight className="size-4 text-muted-foreground" /></Link>
          <Link to="/credentials" className="flex items-center gap-3 px-4 py-3 hover:bg-elevated"><KeyRound className="size-4 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="text-[13px] font-medium">Secure credentials</p><p className="text-[11.5px] text-muted-foreground">Secrets Kurukoo can use but never see</p></div><ArrowUpRight className="size-4 text-muted-foreground" /></Link>
          <Link to="/cards" className="flex items-center gap-3 px-4 py-3 hover:bg-elevated"><CreditCard className="size-4 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="text-[13px] font-medium">One-time cards</p><p className="text-[11.5px] text-muted-foreground">Virtual cards with purchase protection</p></div><ArrowUpRight className="size-4 text-muted-foreground" /></Link>
          <Link to="/secure-execution" className="flex items-center gap-3 px-4 py-3 hover:bg-elevated"><Monitor className="size-4 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="text-[13px] font-medium">Secure execution</p><p className="text-[11.5px] text-muted-foreground">Isolated browser sessions</p></div><ArrowUpRight className="size-4 text-muted-foreground" /></Link>
        </div>
      </Panel>
    </div>
  </div>;
}
