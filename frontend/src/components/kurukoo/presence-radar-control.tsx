import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  activatePulse,
  deactivatePulse,
  fetchPulseReadiness,
  type PulseReadiness,
} from "@/lib/kurukoo-api";

export function PresenceRadarControl() {
  const [on, setOn] = useState(false);
  const [readiness, setReadiness] = useState<PulseReadiness | null>(null);
  const [open, setOpen] = useState(false);
  const [skill, setSkill] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const readRadar = () => setOn(window.localStorage.getItem("kurukoo-nearby-radar") === "on");
    readRadar();
    window.addEventListener("storage", readRadar);
    window.addEventListener("kurukoo-radar-updated", readRadar);
    return () => {
      window.removeEventListener("storage", readRadar);
      window.removeEventListener("kurukoo-radar-updated", readRadar);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchPulseReadiness()
      .then((value) => {
        if (!cancelled) {
          setReadiness(value);
          if (value.active) {
            setOn(true);
            window.localStorage.setItem("kurukoo-nearby-radar", "on");
          }
        }
      })
      .catch(() => {
        if (!cancelled) setReadiness(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const live = Boolean(readiness?.active);
  const eligible = Boolean(readiness?.eligibleToBroadcast);

  async function start() {
    if (!eligible) return;
    if (!skill.trim()) {
      setMessage("Tell Kurukoo what you are available for.");
      return;
    }
    if (!navigator.geolocation) {
      setMessage("Location is required before Go Live.");
      return;
    }
    setBusy(true);
    setMessage("Requesting your location…");
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          maximumAge: 30000,
          timeout: 10000,
        }),
      );
      await activatePulse(skill.trim(), position.coords.latitude, position.coords.longitude);
      const next = await fetchPulseReadiness();
      setReadiness(next);
      setOn(true);
      window.localStorage.setItem("kurukoo-nearby-radar", "on");
      window.dispatchEvent(new Event("kurukoo-radar-updated"));
      window.dispatchEvent(new Event("kurukoo-pulse-updated"));
      setMessage("You are live on Nearby Pulse.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start Nearby Pulse");
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    try {
      await deactivatePulse();
      const next = await fetchPulseReadiness();
      setReadiness(next);
      setOn(false);
      window.localStorage.setItem("kurukoo-nearby-radar", "off");
      window.dispatchEvent(new Event("kurukoo-radar-updated"));
      window.dispatchEvent(new Event("kurukoo-pulse-updated"));
      setMessage("Nearby Pulse is off.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to stop Nearby Pulse");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative hidden sm:block">
      <button
        type="button"
        aria-pressed={on}
        aria-expanded={open}
        aria-controls="kurukoo-radar-panel"
        aria-label={on ? "Radar on" : "Radar off"}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "radar-toggle inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10.5px] font-medium transition-colors",
          on
            ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "border-border bg-surface text-muted-foreground hover:bg-elevated",
        )}
      >
        <span className="radar-toggle-icon relative grid size-4 shrink-0 place-items-center rounded-full">
          <span
            className={cn(
              "radar-wave block size-1.5 rounded-full",
              on
                ? "bg-emerald-500 animate-pulse shadow-[0_0_0_4px_rgba(34,197,94,0.14)]"
                : "bg-muted-foreground/40",
            )}
          />
        </span>
        <span>
          <strong>Radar</strong>
          <small className="ml-1.5 text-[9px] text-muted-foreground">{on ? "On" : "Off"}</small>
        </span>
        <ChevronRight
          className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-90")}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div
          id="kurukoo-radar-panel"
          role="dialog"
          aria-label="Nearby Radar controls"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-2xl border border-border bg-surface p-3 shadow-[var(--shadow-lift)]"
        >
          <p className="text-[11px] font-semibold">
            {live ? "Nearby Pulse is live" : "Nearby Pulse"}
          </p>
          <p className="mt-1 text-[10.5px] leading-4 text-muted-foreground">
            {live
              ? "Your availability is visible on Nearby Pulse."
              : eligible
                ? "Choose what you are available for, then let nearby people discover you."
                : "Radar is available for local attention. Go Live requires current account readiness."}
          </p>
          {live ? (
            <button
              type="button"
              onClick={() => void stop()}
              disabled={busy}
              className="mt-3 min-h-8 w-full rounded-lg border border-border text-[10.5px] font-medium hover:bg-elevated disabled:opacity-50"
            >
              {busy ? "Stopping…" : "Stop Go Live"}
            </button>
          ) : (
            <>
              <input
                value={skill}
                onChange={(event) => setSkill(event.target.value)}
                disabled={!eligible || busy}
                placeholder={eligible ? "e.g. delivery, repairs" : "Provider skill"}
                className="mt-3 min-h-8 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-[10.5px] outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => void start()}
                disabled={!eligible || busy}
                className="mt-1.5 min-h-8 w-full rounded-lg bg-primary text-[10.5px] font-medium text-primary-foreground disabled:opacity-50"
              >
                {busy ? "Starting…" : "Go Live"}
              </button>
            </>
          )}
          <p className="mt-1.5 text-[9.5px] leading-4 text-muted-foreground" aria-live="polite">
            {message || readiness?.nudge}
          </p>
        </div>
      ) : null}
    </div>
  );
}
