import { useEffect, useState } from "react";
import { CheckCircle2, CircleDashed, Laptop, Layers3, UserRound } from "lucide-react";
import { fetchExecutionOverview, type ExecutionOverview, type LocalExecutionAdapter } from "@/lib/execution-api";

type Mode = { id: "digital" | "physical" | "hybrid" | "assisted"; title: string; description: string; prompt: string };
const icons = { digital: Laptop, physical: UserRound, hybrid: Layers3, assisted: CircleDashed } as const;

export function ExecutionModeBridge() {
  const [overview, setOverview] = useState<ExecutionOverview | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchExecutionOverview().then((data) => {
      if (!cancelled) setOverview(data);
    }).finally(() => {
      if (!cancelled) setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  const modes = (overview?.modes ?? []) as Mode[];
  const adapter: LocalExecutionAdapter | null = overview?.localExecutionAdapter ?? null;
  if (!loaded || !modes.length) return null;

  const isCanada = adapter?.country?.toLowerCase() === "ca";
  const resources = adapter?.executionResources?.length ? adapter.executionResources.join(" · ") : null;

  return <section className="rounded-2xl border border-border bg-surface p-4" aria-label="Execution modes">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[12.5px] font-semibold">Execution route</p><p className="mt-1 text-[10.5px] leading-4 text-muted-foreground">Kurukoo keeps digital, physical, hybrid and user-assisted work on the same execution contract.</p></div><CheckCircle2 className="size-4 shrink-0 text-primary"/></div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">{modes.map((mode) => { const Icon = icons[mode.id] ?? CircleDashed; return <div key={mode.id} className="rounded-xl bg-elevated/45 p-2.5"><div className="flex items-center gap-2"><Icon className="size-3.5 text-primary"/><p className="text-[11.5px] font-medium">{mode.title}</p></div><p className="mt-1 text-[9.5px] leading-4 text-muted-foreground">{mode.description}</p></div>; })}</div>
    {adapter ? <div className="mt-3 rounded-xl border border-border bg-elevated/35 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Local execution</p><p className="mt-1 text-[12px] font-medium">{isCanada ? "Canada local execution" : adapter.name}</p></div><span className="rounded-full bg-background px-2 py-1 text-[9.5px] font-medium">{adapter.status === "configured" ? "Configured" : "Pending activation"}</span></div><p className="mt-2 text-[10px] leading-4 text-muted-foreground">{adapter.strengths.join(" · ")}. {adapter.currency ? `Currency: ${adapter.currency}. ` : ""}{adapter.emergencyNumber ? `Emergency: ${adapter.emergencyNumber}. ` : ""}{resources ? `Resources: ${resources}. ` : ""}External provider or device activation is still required before any live fulfilment claim.</p></div> : null}
  </section>;
}
