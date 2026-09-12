import { Link } from "@tanstack/react-router";
import { AlertTriangle, Brain, CheckCircle2, FileCheck2, MessageCircle, Network, RefreshCw, ShieldCheck, ShoppingBag, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchCanonicalMemoryFacts, fetchEconomicCoordination, fetchEconomicExecution } from "@/lib/kurukoo-api";
import { fetchTrustOverview, type AuditEntry } from "@/lib/trust-api";

type Coordination = Awaited<ReturnType<typeof fetchEconomicCoordination>>;
type Execution = Awaited<ReturnType<typeof fetchEconomicExecution>>;

export function ContinuityContext({ requestId, status }: { requestId: string; status: string }) {
  const [memoryCount, setMemoryCount] = useState<number | null>(null);
  const [coordination, setCoordination] = useState<Coordination | null>(null);
  const [execution, setExecution] = useState<Execution>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    void Promise.allSettled([
      fetchCanonicalMemoryFacts(),
      fetchEconomicCoordination(requestId),
      fetchEconomicExecution(requestId),
      fetchTrustOverview(),
    ]).then((results) => {
      if (cancelled) return;
      const [memory, network, run, trust] = results;
      if (memory.status === "fulfilled") setMemoryCount(memory.value.length);
      if (network.status === "fulfilled") setCoordination(network.value);
      if (run.status === "fulfilled") setExecution(run.value);
      if (trust.status === "fulfilled") setAudit((trust.value.audit.timeline ?? []).filter((entry) => entry.requestId === requestId));
      setError(results.every((result) => result.status === "rejected"));
    });
    return () => { cancelled = true; };
  }, [requestId]);

  const participants = coordination?.participants ?? [];
  const offer = coordination?.offer;
  const latestExecution = execution[execution.length - 1];
  const executionState = latestExecution?.status ?? status;
  const normalized = executionState.toLowerCase();
  const recoveryNeeded = /failed|blocked|error|cancelled|expired/.test(normalized);
  const participantLabel = useMemo(() => {
    if (!participants.length) return "No verified participants yet";
    const visible = participants.slice(0, 3).map((participant) => participant.capability || participant.providerPhone || participant.role || "Participant");
    return `${visible.join(", ")}${participants.length > 3 ? ` +${participants.length - 3}` : ""}`;
  }, [participants]);
  const commercialLabel = offer ? (offer.priceMinor != null ? `${offer.currency ?? ""} ${(offer.priceMinor / 100).toFixed(2)}`.trim() : offer.status || "Offer linked") : "No offer yet";

  return <section className="rounded-2xl border border-border bg-surface p-4" aria-label="Work continuity context">
    <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Network className="size-4 text-primary"/><h2 className="text-[15px] font-semibold">Continuous OS context</h2></div><p className="mt-1 text-[11.5px] leading-5 text-muted-foreground">Memory, trust, network participants, communications, commerce, execution state and evidence stay attached to this Work item.</p></div>{error ? <AlertTriangle className="size-4 shrink-0 text-muted-foreground" aria-label="Some continuity sources are unavailable"/> : null}</div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <Link to="/memory" className="rounded-xl bg-elevated/60 p-3 hover:bg-elevated"><div className="flex items-center gap-2"><Brain className="size-3.5"/><span className="text-[10px] font-semibold uppercase tracking-[0.08em]">Memory</span></div><p className="mt-2 text-[12px] font-medium">{memoryCount == null ? "Unavailable" : `${memoryCount} active detail${memoryCount === 1 ? "" : "s"}`}</p><p className="mt-1 text-[9.5px] leading-4 text-muted-foreground">Context, not consent.</p></Link>
      <Link to="/providers" className="rounded-xl bg-elevated/60 p-3 hover:bg-elevated"><div className="flex items-center gap-2"><Users className="size-3.5"/><span className="text-[10px] font-semibold uppercase tracking-[0.08em]">Network</span></div><p className="mt-2 truncate text-[12px] font-medium">{participantLabel}</p><p className="mt-1 text-[9.5px] leading-4 text-muted-foreground">Verified coordination participants.</p></Link>
      <Link to="/safety" className="rounded-xl bg-elevated/60 p-3 hover:bg-elevated"><div className="flex items-center gap-2"><ShieldCheck className="size-3.5"/><span className="text-[10px] font-semibold uppercase tracking-[0.08em]">Trust</span></div><p className="mt-2 text-[12px] font-medium">{audit.length ? `${audit.length} audit entr${audit.length === 1 ? "y" : "ies"}` : "Audit linked"}</p><p className="mt-1 text-[9.5px] leading-4 text-muted-foreground">Approval remains yours.</p></Link>
      <Link to="/cart" className="rounded-xl bg-elevated/60 p-3 hover:bg-elevated"><div className="flex items-center gap-2"><ShoppingBag className="size-3.5"/><span className="text-[10px] font-semibold uppercase tracking-[0.08em]">Commerce</span></div><p className="mt-2 text-[12px] font-medium">{commercialLabel}</p><p className="mt-1 text-[9.5px] leading-4 text-muted-foreground">Offer and purchase context stays separate from execution proof.</p></Link>
      <div className="rounded-xl bg-elevated/60 p-3"><div className="flex items-center gap-2"><FileCheck2 className="size-3.5"/><span className="text-[10px] font-semibold uppercase tracking-[0.08em]">Execution</span></div><p className="mt-2 text-[12px] font-medium">{executionState.replace(/[_-]/g, " ")}</p><p className="mt-1 text-[9.5px] leading-4 text-muted-foreground">Evidence stays tied to the request.</p></div>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[10.5px] text-muted-foreground"><Link to="/agents" className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 hover:bg-elevated"><Network className="size-3"/>My Agents</Link><Link to="/contacts" className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 hover:bg-elevated"><Users className="size-3"/>Contacts</Link><Link to="/messages" className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 hover:bg-elevated"><MessageCircle className="size-3"/>Messages</Link><Link to="/businesses" className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 hover:bg-elevated">Businesses</Link><Link to="/providers" className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 hover:bg-elevated">Providers</Link></div>
    <div className="mt-4 border-t border-border pt-3">{recoveryNeeded ? <div className="flex items-start gap-2 rounded-xl bg-elevated/60 p-3"><RefreshCw className="mt-0.5 size-3.5 shrink-0"/><div><p className="text-[11px] font-semibold">Recovery is part of the same Work item.</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">The current execution state is {executionState.replace(/[_-]/g, " ")}. Use the canonical controls below to retry, cancel or resolve the request; no success is inferred.</p></div></div> : <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"/><p className="text-[10px] leading-4 text-muted-foreground">This request remains the source of truth. Discovery, coordination, communication, commerce, approval, execution, evidence and recovery return here rather than creating separate task records.</p></div>}</div>
  </section>;
}
