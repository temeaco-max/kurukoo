import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Clock3, MessageCircle, ShieldCheck, Sparkles, Users } from "lucide-react";
import { AskKurukoo } from "@/components/kurukoo/ask-kurukoo";
import { useKurukoo } from "@/lib/kurukoo-store";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function WorkspaceHome() {
  const { work } = useKurukoo();
  const active = work.filter((item) => item.stage !== "done").slice(0, 5);
  const needsYou = active.filter((item) => item.stage === "needs_you");

  return (
    <div className="min-w-0 space-y-8 pb-10 md:space-y-10">
      <section className="relative overflow-hidden border-b border-border/80 pb-8 pt-1 md:pb-10">
        <div className="pointer-events-none absolute -right-28 -top-32 size-[390px] rounded-full bg-brand-tint/30 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span className="grid size-5 place-items-center rounded-full bg-primary/10 text-primary"><Sparkles className="size-3" /></span>
            Your field
          </div>
          <h1 className="mt-4 max-w-3xl text-[40px] font-semibold leading-[.96] tracking-[-0.055em] sm:text-[48px] md:text-[62px]">
            {greeting()}.<br /><span className="text-muted-foreground/75">Wake up. Get going.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[14px] leading-7 text-muted-foreground">Kurukoo keeps the things you hand over in view, brings you back when a decision matters, and keeps useful context close without making you manage the machinery.</p>

          <div className="mt-7 max-w-3xl">
            <AskKurukoo prompt="What needs your attention?" className="min-h-11 rounded-xl bg-primary px-4 text-primary-foreground hover:bg-primary/90" />
            <p className="mt-2 text-[10.5px] text-muted-foreground">Start with the outcome. Kurukoo works out the route.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-px overflow-hidden border border-border/80 bg-border/80 md:grid-cols-3" aria-label="Your field shortcuts">
        <Link to="/chat" className="group bg-background p-5 transition-colors hover:bg-surface">
          <MessageCircle className="size-4 text-muted-foreground" />
          <p className="mt-8 text-[14px] font-semibold">Continue with Kurukoo</p>
          <p className="mt-1.5 text-[11.5px] leading-5 text-muted-foreground">Keep the conversation moving or start something new in your own words.</p>
          <span className="mt-5 inline-flex items-center gap-1 text-[10.5px] font-medium">Open Chat / Voice <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span>
        </Link>
        <Link to="/work" className="group bg-background p-5 transition-colors hover:bg-surface">
          <CheckCircle2 className="size-4 text-muted-foreground" />
          <p className="mt-8 text-[14px] font-semibold">Active work</p>
          <p className="mt-1.5 text-[11.5px] leading-5 text-muted-foreground">{active.length ? `${active.length} active ${active.length === 1 ? "item" : "items"}${needsYou.length ? ` · ${needsYou.length} need${needsYou.length === 1 ? "s" : ""} you` : ""}.` : "Nothing is currently in motion."}</p>
          <span className="mt-5 inline-flex items-center gap-1 text-[10.5px] font-medium">Open Work <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span>
        </Link>
        <Link to="/memory" className="group bg-background p-5 transition-colors hover:bg-surface">
          <ShieldCheck className="size-4 text-muted-foreground" />
          <p className="mt-8 text-[14px] font-semibold">Trusted context</p>
          <p className="mt-1.5 text-[11.5px] leading-5 text-muted-foreground">Review what Kurukoo remembers. Context can improve continuity; it never becomes permission by itself.</p>
          <span className="mt-5 inline-flex items-center gap-1 text-[10.5px] font-medium">Review Memory <ArrowRight className="size-3.5" /></span>
        </Link>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <section className="overflow-hidden border border-border/80">
          <div className="flex items-end justify-between gap-4 border-b border-border/80 px-5 py-5">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Today’s flow</p><h2 className="mt-1.5 text-[18px] font-semibold tracking-[-0.02em]">What is moving</h2></div>
            <Link to="/activity" className="text-[10.5px] font-medium text-muted-foreground hover:text-foreground">View Activity</Link>
          </div>
          {active.length ? <div className="divide-y divide-border/70">{active.map((item) => <Link key={item.id} to="/work/$workId" params={{ workId: item.id }} className="group flex items-start gap-3.5 px-5 py-4 transition-colors hover:bg-surface"><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-elevated"><Clock3 className="size-3.5 text-primary" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{item.title}</span><span className="mt-0.5 block truncate text-[11px] leading-5 text-muted-foreground">{item.detail}</span></span><span className="hidden shrink-0 pt-1 text-[10px] text-muted-foreground sm:block">{item.updated}</span><ArrowRight className="mt-1 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" /></Link>)}</div> : <div className="px-5 py-9"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Nothing in motion</p><h3 className="mt-2 text-[22px] font-semibold tracking-tight">Tell Kurukoo what you want to move forward.</h3><div className="mt-5"><AskKurukoo prompt="I want to get something done today." /></div></div>}
        </section>

        <aside className="space-y-4">
          <section className="border border-border/80 bg-surface p-5">
            <div className="flex items-center gap-2"><Users className="size-4 text-muted-foreground" /><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">People & continuity</p></div>
            <h2 className="mt-3 text-[18px] font-semibold">Keep people close when they matter.</h2>
            <p className="mt-1.5 text-[11.5px] leading-5 text-muted-foreground">Contacts, messages and trusted people remain connected to the same conversation and work history.</p>
            <div className="mt-4 flex flex-wrap gap-2"><Link to="/connect" className="text-[10.5px] font-medium hover:text-primary">Connect <ArrowRight className="ml-0.5 inline size-3" /></Link><Link to="/activity" className="text-[10.5px] font-medium hover:text-primary">Activity <ArrowRight className="ml-0.5 inline size-3" /></Link></div>
          </section>

          <section className="border border-border/80 p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Agent-assisted next steps</p>
            {needsYou.length ? <div className="mt-3 space-y-3">{needsYou.slice(0, 3).map((item) => <Link key={item.id} to="/work/$workId" params={{ workId: item.id }} className="block border-l-2 border-primary pl-3 transition-colors hover:text-primary"><p className="text-[12px] font-medium">{item.title}</p><p className="mt-0.5 text-[10.5px] leading-5 text-muted-foreground">{item.detail}</p></Link>)}</div> : <p className="mt-3 text-[11.5px] leading-5 text-muted-foreground">No decision is waiting right now. When a consequential step needs you, Kurukoo will bring it here and keep the underlying Work item available.</p>}
            <Link to="/agents" className="mt-4 inline-flex items-center gap-1 text-[10.5px] font-medium hover:text-primary">View agents <ArrowRight className="size-3.5" /></Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
