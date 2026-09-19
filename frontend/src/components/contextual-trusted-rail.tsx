import { useRouterState, Link } from "@tanstack/react-router";
import { ArrowRight, Bell, Briefcase, Brain, ChevronLeft, ChevronRight, Compass, ExternalLink, MapPin, MessageSquare, ShieldCheck, Sparkles, Target, Users, Wallet, Zap } from "lucide-react";
import { useEffect, useState, type ReactNode, type ComponentType } from "react";
import { cn } from "@/lib/utils";
import { useKurukoo } from "@/lib/kurukoo-store";
import { fetchAuthenticatedAd, fetchPulseReadiness, type AuthenticatedAd, type PulseReadiness } from "@/lib/kurukoo-api";

type Icon = ComponentType<{ className?: string }>;

function Section({ title, icon: Icon, to, children }: { title: string; icon: Icon; to: string; children: ReactNode }) {
  return <section className="trusted-context-card rounded-[18px] bg-elevated/70 p-3.5"><div className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><Icon className="size-3.5 shrink-0 text-muted-foreground"/><h2 className="truncate text-[12.5px] font-semibold">{title}</h2></div><Link to={to as never} className="trusted-context-view text-[10px] font-medium text-muted-foreground hover:text-foreground">View <ArrowRight className="ml-0.5 inline size-3" /></Link></div><div className="mt-2.5">{children}</div></section>;
}

function Row({ icon: Icon, title, detail, to, live = false }: { icon: Icon; title: string; detail: string; to?: string; live?: boolean }) {
  const row = <div className="flex min-w-0 items-center gap-2.5 rounded-xl px-1.5 py-1.5"><span className={cn("grid size-7 shrink-0 place-items-center rounded-full", live ? "bg-brand-tint text-brand-ink" : "bg-elevated text-muted-foreground")}><Icon className="size-3.5"/></span><div className="min-w-0"><p className="truncate text-[11.5px] font-medium">{title}</p><p className="truncate text-[10px] text-muted-foreground">{detail}</p></div></div>;
  return to ? <Link to={to as never} className="block rounded-xl hover:bg-elevated">{row}</Link> : row;
}

function RailAd({ campaign }: { campaign: AuthenticatedAd | null }) {
  if (!campaign) return null;
  return <a href={campaign.clickUrl} className="mt-auto block overflow-hidden rounded-2xl border border-border bg-elevated/55 hover:bg-elevated" rel="nofollow"><div className="p-2.5"><div className="flex items-center justify-between gap-2"><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{campaign.disclosure}</p><ExternalLink className="size-3 text-muted-foreground"/></div>{campaign.image ? <img src={campaign.image} alt="" loading="lazy" width="176" height="70" className="mt-2 h-14 w-full rounded-xl object-cover"/> : null}<p className="mt-2 text-[11.5px] font-semibold leading-4">{campaign.title}</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{campaign.desc}</p><span className="mt-2 inline-flex text-[10.5px] font-medium">{campaign.ctaText}</span></div></a>;
}

function PulseControl({ readiness, onChange }: { readiness: PulseReadiness | null; onChange: (value: PulseReadiness) => void }) {
  const [skill, setSkill] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const can = Boolean(readiness?.eligibleToBroadcast);
  async function goLive() {
    if (!can) return;
    if (!skill.trim()) { setMessage("Add what you can help with."); return; }
    if (!navigator.geolocation) { setMessage("Location is required before Go Live."); return; }
    setBusy(true); setMessage("Getting location…");
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, maximumAge: 30000, timeout: 10000 }));
      const { activatePulse } = await import("@/lib/kurukoo-api");
      await activatePulse(skill.trim(), position.coords.latitude, position.coords.longitude);
      onChange(await fetchPulseReadiness());
      window.dispatchEvent(new Event("kurukoo-pulse-updated"));
      setMessage("Available on Nearby Pulse.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not start availability."); }
    finally { setBusy(false); }
  }
  async function stop() {
    setBusy(true);
    try {
      const { deactivatePulse } = await import("@/lib/kurukoo-api");
      await deactivatePulse(); onChange(await fetchPulseReadiness()); window.dispatchEvent(new Event("kurukoo-pulse-updated")); setMessage("Availability off.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not stop availability."); }
    finally { setBusy(false); }
  }
  return <div className="rounded-xl bg-elevated/50 p-2.5"><div className="flex items-center gap-2"><span className={cn("grid size-7 place-items-center rounded-full", readiness?.active ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-surface text-muted-foreground")}><Zap className="size-3.5"/></span><div className="min-w-0 flex-1"><p className="text-[11.5px] font-medium">{readiness?.active ? "Available" : "Not available"}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{readiness?.active ? "Visible on Nearby Pulse" : can ? "Set what you can help with." : "Provider readiness required."}</p></div></div>{readiness?.active ? <button type="button" onClick={() => void stop()} disabled={busy} className="mt-2.5 min-h-8 w-full rounded-lg border border-border px-2.5 text-[10.5px] font-medium hover:bg-background disabled:opacity-50">{busy ? "Stopping…" : "Turn off"}</button> : <><input value={skill} onChange={(event) => setSkill(event.target.value)} disabled={!can || busy} placeholder={can ? "e.g. repairs, delivery" : "Provider skill"} className="mt-2.5 min-h-8 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-[10.5px] outline-none disabled:opacity-50"/><button type="button" onClick={() => void goLive()} disabled={!can || busy} className="mt-1.5 min-h-8 w-full rounded-lg bg-primary px-2.5 text-[10.5px] font-medium text-primary-foreground disabled:opacity-50">{busy ? "Starting…" : "Go live"}</button></>}<p className="mt-1.5 text-[9.5px] leading-4 text-muted-foreground" aria-live="polite">{message || readiness?.nudge}</p></div>;
}

export function ContextualTrustedRail({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { work, memory, notifications } = useKurukoo();
  const [readiness, setReadiness] = useState<PulseReadiness | null>(null);
  const [ad, setAd] = useState<AuthenticatedAd | null>(null);
  const [trustedProfile, setTrustedProfile] = useState<{ location: string; role: string } | null>(null);
  const focus = work.find((item) => item.stage !== "done");
  const unread = notifications.filter((item) => !item.read).length;
  const trustedLocation = trustedProfile?.location || "Hackney, London";
  const trustedRole = trustedProfile?.role || "Phone Technician";

  useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      try {
        const response = await fetch("/api/profile", { credentials: "include", headers: { Accept: "application/json" } });
        if (!response.ok) return;
        const payload = (await response.json()) as { profile?: { location?: string; primary_lga?: string; primary_state?: string }; skills?: Array<{ skill?: string }> };
        if (cancelled) return;
        const profileLocation = payload.profile?.location?.trim();
        const lga = payload.profile?.primary_lga?.trim();
        const state = payload.profile?.primary_state?.trim();
        const roleSkill = payload.skills?.map((item) => String(item.skill || "").trim()).find(Boolean);
        const role = roleSkill === "phone_repair" ? "Phone Technician" : roleSkill === "design" ? "Design Lead" : roleSkill ? roleSkill.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "";
        const location = profileLocation && state && !profileLocation.toLowerCase().includes(state.toLowerCase()) ? `${profileLocation}, ${state}` : profileLocation || [lga, state].filter(Boolean).join(", ");
        setTrustedProfile({ location, role });
      } catch {
        if (!cancelled) setTrustedProfile(null);
      }
    };
    void loadProfile();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => void fetchPulseReadiness().then((value) => { if (!cancelled) setReadiness(value); }).catch(() => { if (!cancelled) setReadiness(null); });
    load(); window.addEventListener("kurukoo-pulse-updated", load); const timer = window.setInterval(load, 30000);
    return () => { cancelled = true; window.removeEventListener("kurukoo-pulse-updated", load); window.clearInterval(timer); };
  }, []);
  useEffect(() => { if (!open) return; void fetchAuthenticatedAd("context-rail").then(setAd).catch(() => setAd(null)); }, [open, pathname]);

  const defaultContent = <>
    <section className="trusted-context-card rounded-[18px] bg-elevated/70 p-3.5"><h2 className="text-[12.5px] font-semibold">Trusted</h2><div className="mt-2.5"><Row icon={Sparkles} title="Home" detail={trustedLocation} to="/perch"/><Row icon={Briefcase} title="Work" detail={focus?.title ?? trustedRole} to="/work"/><Row icon={Brain} title="Memory" detail={memory.length ? `${memory.length} saved memories` : "Personal continuity"} to="/memory"/></div></section>
    <Section title="Nearby pulse" icon={MapPin} to="/discover"><Row icon={MapPin} title="Nearby" detail="People, places and local activity" to="/discover"/><PulseControl readiness={readiness} onChange={setReadiness}/></Section>
    <Section title="Safety state" icon={ShieldCheck} to="/trust"><div className="safety-state-card"><span className="safety-state-icon"><ShieldCheck className="size-4"/></span><div><p className="text-[11.5px] font-semibold">All good</p><p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">Your safety controls are available when you need them.</p></div></div></Section>
    <Section title="Current focus" icon={Target} to="/work">{focus ? <Row icon={Target} title={focus.title} detail={focus.stage === "needs_you" ? "Needs you" : "In progress"} to={`/work/${focus.id}`} /> : <Row icon={MessageSquare} title="Nothing in motion" detail="Start with Ask Kurukoo" to="/chat"/>}</Section>
    <Section title="Activity summary" icon={Bell} to="/activity"><div className="activity-summary-grid"><div><strong>{work.filter((item) => item.stage === "done").length}</strong><span>Tasks completed</span></div><div><strong>{work.filter((item) => item.stage !== "done").length}</strong><span>In motion</span></div></div><Link to="/activity" className="mt-3 inline-flex items-center text-[10px] font-medium text-muted-foreground hover:text-foreground">View activity <ArrowRight className="ml-1 size-3"/></Link></Section>
    {ad ? <RailAd campaign={ad}/> : null}
  </>;

  const chatContent = <><Section title="Conversation context" icon={MessageSquare} to="/chat"><Row icon={MessageSquare} title="Current conversation" detail="Continue where you left off" to="/chat"/><Row icon={Sparkles} title="Assistant" detail="Ask Kurukoo" to="/chat"/></Section><Section title="Current Work" icon={Briefcase} to="/work">{focus ? <Row icon={Target} title={focus.title} detail="In progress" to={`/work/${focus.id}`} /> : <Row icon={MessageSquare} title="No active Work" detail="Start from this conversation" to="/chat"/>}</Section><Section title="Voice" icon={Sparkles} to="/chat"><Row icon={Sparkles} title="Voice" detail="Use the Chat composer for voice" to="/chat"/></Section>{ad ? <RailAd campaign={ad}/> : null}</>;
  const workContent = <><Section title="Work context" icon={Briefcase} to="/work">{focus ? <Row icon={Target} title={focus.title} detail={focus.stage === "needs_you" ? "Needs you" : "In progress"} to={`/work/${focus.id}`} /> : <Row icon={Briefcase} title="No active Work" detail="Start from Chat" to="/chat"/>}</Section><Section title="Safety state" icon={ShieldCheck} to="/trust"><Row icon={ShieldCheck} title="Permissions" detail="Review before consequential action" to="/trust"/></Section><Section title="Communication" icon={MessageSquare} to="/messages"><Row icon={Bell} title={unread ? `${unread} unread` : "Caught up"} detail="Activity and messages" to="/activity"/></Section>{ad ? <RailAd campaign={ad}/> : null}</>;
  const nearbyContent = <><Section title="Nearby pulse" icon={MapPin} to="/discover"><PulseControl readiness={readiness} onChange={setReadiness}/><Row icon={MapPin} title="Local discovery" detail="Freshness and availability stay explicit" to="/discover"/></Section><Section title="Trusted context" icon={Brain} to="/memory"><Row icon={Briefcase} title="Work" detail={focus?.title ?? "No active Work"} to="/work"/><Row icon={Brain} title="Memory" detail="Private continuity" to="/memory"/></Section>{ad ? <RailAd campaign={ad}/> : null}</>;
  const content = pathname.startsWith("/chat") ? chatContent : pathname.startsWith("/work") ? workContent : pathname.startsWith("/discover") ? nearbyContent : defaultContent;
  const compact = [{ label: "Field", to: "/perch", Icon: Sparkles }, { label: "Work", to: "/work", Icon: Briefcase }, { label: "Memory", to: "/memory", Icon: Brain }, { label: "Nearby", to: "/discover", Icon: MapPin }, { label: "Trust", to: "/trust", Icon: ShieldCheck }, { label: "Activity", to: "/activity", Icon: Bell }, { label: "Wallet", to: "/wallet", Icon: Wallet }];

  return <aside aria-label="Trusted context rail" className={cn("relative min-h-0 h-full hidden overflow-visible border-l border-border bg-surface py-4 lg:flex lg:flex-col", open ? "w-[224px] px-3" : "w-[48px] px-1.5")}><button type="button" onClick={() => onOpenChange(!open)} aria-label={open ? "Close trusted context" : "Open trusted context"} title={open ? "Close trusted context" : "Open trusted context"} className="absolute left-[-15px] top-5 z-[80] grid size-7 place-items-center rounded-full border border-border bg-surface text-muted-foreground shadow-[var(--shadow-soft)] hover:bg-elevated">{open ? <ChevronRight className="size-4"/> : <ChevronLeft className="size-4"/>}</button>{open ? <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">{content}</div> : <div className="flex flex-col items-center gap-2 pt-8">{compact.map(({ label, to, Icon }) => <Link key={label} to={to as never} title={label} aria-label={label} className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-elevated hover:text-foreground"><Icon className="size-4"/></Link>)}</div>}</aside>;
}
