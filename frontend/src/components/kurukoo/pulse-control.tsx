import { Link } from "@tanstack/react-router";
import { MapPin, Navigation, Users, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import {
  activatePulse,
  deactivatePulse,
  fetchPublicPulseProviders,
  fetchPulseReadiness,
  type PulseProvider,
  type PulseReadiness,
} from "@/lib/kurukoo-api";
import { fetchPresenceOverview, type PresenceOverview } from "@/lib/presence-api";
import { cn } from "@/lib/utils";

type PulseControlProps = { compact?: boolean; className?: string; onChanged?: (readiness: PulseReadiness) => void };

export function PulseControl({ compact = false, className, onChanged }: PulseControlProps) {
  const [readiness, setReadiness] = useState<PulseReadiness | null>(null);
  const [providers, setProviders] = useState<PulseProvider[]>([]);
  const [presence, setPresence] = useState<PresenceOverview | null>(null);
  const [skill, setSkill] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void Promise.allSettled([fetchPulseReadiness(), fetchPublicPulseProviders(), fetchPresenceOverview()]).then(([ready, live, people]) => {
        if (cancelled) return;
        if (ready.status === "fulfilled") setReadiness(ready.value);
        if (live.status === "fulfilled") setProviders(live.value);
        else setProviders([]);
        if (people.status === "fulfilled") setPresence(people.value);
        else setPresence(null);
      });
    };
    load();
    const onPulse = () => load();
    window.addEventListener("kurukoo-pulse-updated", onPulse);
    const timer = window.setInterval(load, 30000);
    return () => { cancelled = true; window.removeEventListener("kurukoo-pulse-updated", onPulse); window.clearInterval(timer); };
  }, []);
  const active = Boolean(readiness?.active);
  const eligible = Boolean(readiness?.eligibleToBroadcast);
  const liveCount = providers.length;
  const presenceCounts = presence?.counts;
  const update = (value: PulseReadiness) => { setReadiness(value); onChanged?.(value); window.dispatchEvent(new Event("kurukoo-pulse-updated")); };
  async function start() {
    if (!eligible) { setMessage("Provider readiness is required before a real Go Live session."); return; }
    if (!skill.trim()) { setMessage("Tell Kurukoo what you are available for."); return; }
    if (!navigator.geolocation) { setMessage("Location is required before Go Live."); return; }
    setBusy(true); setMessage("Requesting your location…");
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, maximumAge: 30000, timeout: 10000 }));
      await activatePulse(skill.trim(), position.coords.latitude, position.coords.longitude);
      update(await fetchPulseReadiness()); setMessage("You are live on Nearby Pulse.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to start Nearby Pulse."); }
    finally { setBusy(false); }
  }
  async function stop() {
    setBusy(true);
    try { await deactivatePulse(); update(await fetchPulseReadiness()); setMessage("Nearby Pulse is off."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to stop Nearby Pulse."); }
    finally { setBusy(false); }
  }
  const presenceLabel = presenceCounts
    ? `${presenceCounts.available} available · ${presenceCounts.providers} providers · ${presenceCounts.agents} AI agents`
    : "People, providers and AI agents appear when relationship presence is available.";
  if (compact) return (
    <div className={cn("rounded-xl bg-elevated/50 p-2.5", className)}>
      <div className="flex items-center gap-2">
        <span className={cn("grid size-7 place-items-center rounded-full", active ? "bg-brand-tint text-brand-ink" : "bg-surface text-muted-foreground")}><Zap className="size-3.5" /></span>
        <div className="min-w-0 flex-1"><p className="truncate text-[11.5px] font-medium">{active ? "Live on Nearby Pulse" : "Your availability"}</p><p className="truncate text-[10px] text-muted-foreground">{active ? "Your signal is available to Nearby" : eligible ? `${liveCount} verified provider${liveCount === 1 ? "" : "s"} visible nearby` : "Provider readiness required"}</p></div>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[9.5px] text-muted-foreground"><Users className="size-3" /><span className="truncate">{presenceLabel}</span></div>
      {active ? <button type="button" onClick={() => void stop()} disabled={busy} className="mt-2 min-h-8 w-full rounded-lg border border-border text-[10.5px] font-medium hover:bg-background disabled:opacity-50">{busy ? "Stopping…" : "Stop Go Live"}</button> : <><input value={skill} onChange={(event) => setSkill(event.target.value)} disabled={!eligible || busy} placeholder={eligible ? "e.g. oranges, suya, delivery" : "Provider skill"} className="mt-2 min-h-8 w-full rounded-lg border border-border bg-background px-2.5 text-[10.5px] outline-none disabled:opacity-50" /><button type="button" onClick={() => void start()} disabled={!eligible || busy} className="mt-1.5 min-h-8 w-full rounded-lg bg-primary px-2.5 text-[10.5px] font-medium text-primary-foreground disabled:opacity-50">{busy ? "Starting…" : "Go Live"}</button></>}
      <p className="mt-1.5 text-[9.5px] leading-4 text-muted-foreground" aria-live="polite">{message || readiness?.nudge || "Nearby only shows provider signals returned by the live platform."}</p>
    </div>
  );
  return (
    <div className={cn("rounded-2xl border border-border bg-surface p-4", className)}>
      <div className="flex items-start gap-3"><span className={cn("grid size-9 place-items-center rounded-xl", active ? "bg-brand-tint text-brand-ink" : "bg-elevated text-muted-foreground")}><Zap className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-[13.5px] font-semibold">{active ? "You're live on Nearby Pulse" : "Pulse · local availability"}</p>{active ? <span className="rounded-full bg-brand-tint px-2 py-1 text-[9.5px] font-medium text-brand-ink">Live</span> : null}</div><p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{active ? "Nearby people can discover your available service. Your public position remains approximate and the session expires." : eligible ? `${liveCount} verified provider${liveCount === 1 ? "" : "s"} are currently visible through Nearby. Go Live adds your availability signal to the same local layer.` : "Radar is available for local discovery. Go Live requires provider readiness and verification."}</p></div></div>
      <div className="mt-3 rounded-xl bg-elevated/50 p-3"><div className="flex items-center justify-between gap-3"><p className="text-[11px] font-semibold">Live now</p><Link to="/discover" className="text-[10.5px] font-medium text-primary">Open Nearby</Link></div>{providers.length ? <div className="mt-2 space-y-2">{providers.slice(0, 2).map((provider) => <div key={provider.id} className="flex items-center gap-2.5"><span className="grid size-7 place-items-center rounded-full bg-surface"><Zap className="size-3" /></span><div className="min-w-0 flex-1"><p className="truncate text-[11.5px] font-medium">{provider.name}</p><p className="truncate text-[10px] text-muted-foreground">{provider.skill} · {provider.location || "Approximate area"}</p></div><span className="shrink-0 text-[9.5px] text-brand-ink">Live</span></div>)}</div> : <p className="mt-2 text-[10.5px] leading-4 text-muted-foreground">No verified live provider signals are available right now.</p>}</div>
      <div className="mt-3 rounded-xl border border-border bg-background/50 p-3"><div className="flex items-center gap-2"><Users className="size-3.5 text-muted-foreground" /><p className="text-[11px] font-semibold">Local presence</p></div>{presenceCounts ? <div className="mt-2 grid grid-cols-3 gap-2 text-center"><div><p className="text-[13px] font-semibold">{presenceCounts.human}</p><p className="text-[9.5px] text-muted-foreground">People</p></div><div><p className="text-[13px] font-semibold">{presenceCounts.providers}</p><p className="text-[9.5px] text-muted-foreground">Providers</p></div><div><p className="text-[13px] font-semibold">{presenceCounts.agents}</p><p className="text-[9.5px] text-muted-foreground">AI agents</p></div></div> : <p className="mt-2 text-[10px] text-muted-foreground">Presence is unavailable right now; Nearby provider signals remain separate and truthful.</p>}<p className="mt-2 text-[9.5px] leading-4 text-muted-foreground">Relationship-scoped presence only. Exact locations and phone identifiers are not exposed.</p></div>
      {active ? <div className="mt-3 flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-lg bg-elevated px-2.5 py-2 text-[10.5px] text-muted-foreground"><Navigation className="size-3" /> Live signal · Nearby can surface you</span><button type="button" onClick={() => void stop()} disabled={busy} className="min-h-9 rounded-lg border border-border px-3 text-[11px] font-medium hover:bg-elevated disabled:opacity-50">{busy ? "Stopping…" : "Stop Go Live"}</button></div> : <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={skill} onChange={(event) => setSkill(event.target.value)} disabled={!eligible || busy} placeholder={eligible ? "What are you available for? e.g. oranges, suya, delivery" : "Provider readiness required"} className="min-h-9 flex-1 rounded-lg border border-border bg-background px-3 text-[11.5px] outline-none disabled:opacity-50" /><button type="button" onClick={() => void start()} disabled={!eligible || busy} className="min-h-9 rounded-lg bg-primary px-3 text-[11px] font-medium text-primary-foreground disabled:opacity-50">{busy ? "Starting…" : "Go Live"}</button></div>}
      <p className="mt-2 text-[10.5px] text-muted-foreground" aria-live="polite">{message || readiness?.nudge}</p>
      <Link to="/discover" className="mt-2 inline-flex min-h-9 items-center gap-1 text-[10.5px] font-medium text-muted-foreground hover:text-foreground"><MapPin className="size-3" /> Open Nearby</Link>
    </div>
  );
}
