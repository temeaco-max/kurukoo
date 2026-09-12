import { Check, Loader2, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchDeliveryCandidates, selectDeliveryCandidate, type EconomicParticipant } from "@/lib/kurukoo-api";

function label(value: string) {
  return value.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DeliveryCandidatePicker({ requestId, enabled = true, onSelected }: { requestId: string; enabled?: boolean; onSelected?: () => void }) {
  const [candidates, setCandidates] = useState<EconomicParticipant[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    void fetchDeliveryCandidates(requestId)
      .then((items) => { if (!cancelled) setCandidates(items); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Verified provider options are unavailable right now."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled, requestId]);

  async function choose(candidate: EconomicParticipant) {
    const providerPhone = candidate.providerPhone?.trim();
    if (!providerPhone || busy) return;
    setBusy(providerPhone);
    setError("");
    try {
      await selectDeliveryCandidate(requestId, providerPhone);
      setSelected(providerPhone);
      onSelected?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The provider could not be selected.");
    } finally {
      setBusy("");
    }
  }

  if (!enabled) return null;
  if (loading) return <section className="mt-3 rounded-xl border border-border bg-elevated/25 p-4" aria-label="Verified provider options"><div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Loader2 className="size-3.5 animate-spin" />Checking verified provider options…</div></section>;
  if (error && !candidates.length) return <section className="mt-3 rounded-xl border border-border bg-elevated/25 p-4" aria-label="Verified provider options"><p className="text-[11px] text-muted-foreground">{error}</p></section>;
  if (!candidates.length) return null;

  return <section className="mt-3 rounded-xl border border-primary/20 bg-brand-tint/10 p-4" aria-label="Verified provider options">
    <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary"/><div className="min-w-0 flex-1"><p className="text-[12.5px] font-semibold">Verified provider options</p><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">These are provider candidates returned by the canonical dispatch service. Selecting one records your choice; it does not claim acceptance or completion until the provider returns that evidence.</p>
      <div className="mt-3 space-y-2">{candidates.slice(0, 8).map((candidate, index) => { const phone = candidate.providerPhone?.trim() || ""; const isSelected = selected === phone; const isBusy = busy === phone; return <div key={String(candidate.id ?? phone ?? `${candidate.capability}-${index}`)} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-3"><div className="flex min-w-0 items-center gap-2"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-elevated"><UserRound className="size-3.5"/></span><div className="min-w-0"><p className="truncate text-[11.5px] font-medium">{phone || "Provider identity withheld"}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{candidate.capability ? label(candidate.capability) : "Eligible provider"}{candidate.status ? ` · ${label(candidate.status)}` : ""}</p></div></div>{phone ? <button type="button" disabled={Boolean(busy) || isSelected} onClick={() => void choose(candidate)} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-[10.5px] font-medium disabled:opacity-50">{isBusy ? <Loader2 className="size-3 animate-spin"/> : isSelected ? <Check className="size-3"/> : null}{isBusy ? "Selecting…" : isSelected ? "Selected" : "Select"}</button> : null}</div>; })}</div>
      {error ? <p className="mt-2 text-[10.5px] text-destructive">{error}</p> : null}
    </div></div>
  </section>;
}
