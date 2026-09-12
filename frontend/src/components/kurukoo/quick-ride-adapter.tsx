import { useEffect, useState } from "react";
import { CarFront, ShieldCheck, Truck } from "lucide-react";
import type { EconomicRequest } from "@/lib/kurukoo-api";

type RideOption = { id: string; label: string; description?: string; passengers?: number };

type Props = { request: EconomicRequest };

function isRide(request: EconomicRequest) {
  return /ride|transport|taxi|car|motor|mobility/i.test(request.skill) || Boolean(request.requirements?.vehicleType || request.requirements?.vehicle_type);
}

function labelStatus(status: string) {
  return status.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function QuickRideAdapter({ request }: Props) {
  const [options, setOptions] = useState<RideOption[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    if (!isRide(request)) return;
    let cancelled = false;
    void fetch("/api/rides/options", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Ride options unavailable");
        return response.json() as Promise<{ success?: boolean; options?: RideOption[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        setAvailable(data.success === true);
        setOptions(Array.isArray(data.options) ? data.options : []);
      })
      .catch(() => {
        if (!cancelled) {
          setAvailable(false);
          setOptions([]);
        }
      });
    return () => { cancelled = true; };
  }, [request]);

  if (!isRide(request)) return null;

  const physical = ["reserved", "in_fulfillment", "fulfilled", "dispatched", "driver_assigned", "arriving", "in_transit", "completed"].includes(request.status);
  const external = "Provider dispatch, payment and device delivery remain external activation boundaries.";

  return (
    <section className="rounded-2xl border border-border bg-surface p-4" aria-label="Quick Ride local fulfilment">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand-ink"><CarFront className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold">Quick Ride · local fulfilment</p>
          <p className="mt-1 text-[10.5px] leading-4 text-muted-foreground">The ride request stays on the canonical Economic Request and dispatch lifecycle. Kurukoo only reports provider/device progress when the connected boundary returns evidence.</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-elevated/55 p-2.5"><p className="text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground">Dispatch</p><p className="mt-1 text-[11.5px] font-medium">{labelStatus(request.status)}</p></div>
        <div className="rounded-xl bg-elevated/55 p-2.5"><p className="text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground">Vehicle options</p><p className="mt-1 text-[11.5px] font-medium">{available === null ? "Checking…" : options.length ? `${options.length} returned` : "Not returned"}</p></div>
        <div className="rounded-xl bg-elevated/55 p-2.5"><p className="text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground">Physical proof</p><p className="mt-1 text-[11.5px] font-medium">{physical ? "Evidence lifecycle active" : "Awaiting fulfilment"}</p></div>
      </div>
      {options.length ? <div className="mt-3 flex flex-wrap gap-1.5">{options.slice(0, 6).map((option) => <span key={option.id} className="inline-flex items-center gap-1 rounded-full bg-elevated px-2.5 py-1 text-[10px]"><Truck className="size-3"/>{option.label}</span>)}</div> : null}
      <div className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-elevated/35 p-2.5"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary"/><p className="text-[10px] leading-4 text-muted-foreground">{available ? "The local ride contract is reachable. A successful options response is not provider acceptance or ride completion." : external}</p></div>
    </section>
  );
}
