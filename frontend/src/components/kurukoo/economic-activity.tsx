import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Clock3, Loader2, ShieldCheck } from "lucide-react";
import { fetchEconomicRequests, type EconomicRequest } from "@/lib/kurukoo-api";
import { EmptyState } from "@/components/app-shell";
import { Panel, Rows, StatusPill } from "@/components/kurukoo/ui";

function label(status: string) {
  return status.replace(/[_-]/g, " ");
}

function tone(status: string): "green" | "peach" | "blue" | "neutral" {
  const value = status.toLowerCase();
  if (["completed", "confirmed", "fulfilled", "settled"].some((item) => value.includes(item))) return "green";
  if (["awaiting", "pending", "requested", "quoted", "approval", "payment"].some((item) => value.includes(item))) return "peach";
  if (["cancelled", "failed", "rejected", "expired"].some((item) => value.includes(item))) return "neutral";
  return "blue";
}

export function EconomicActivity() {
  const [requests, setRequests] = useState<EconomicRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetchEconomicRequests().then((items) => {
      if (!cancelled) setRequests(items.slice(0, 8));
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Economic activity is unavailable.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <Panel className="p-5"><div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading active requests…</div></Panel>;
  if (error) return <EmptyState title="Action history unavailable" body={error} />;
  if (!requests.length) return <EmptyState title="No actions yet" body="When Kurukoo turns a request into an economic action, its canonical state will appear here." />;

  return <Rows>{requests.map((request) => {
    const status = request.status || "unknown";
    const completed = ["completed", "confirmed", "fulfilled", "settled"].some((item) => status.toLowerCase().includes(item));
    return <li key={request.id} className="px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-elevated">{completed ? <CheckCircle2 className="size-4" /> : <Clock3 className="size-4" />}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><p className="text-[13px] font-semibold">{request.skill || "Kurukoo action"}</p><StatusPill tone={tone(status)}>{label(status)}</StatusPill></div>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{completed ? "The canonical request reports a completed state." : "This action is still governed by its canonical execution state."}</p>
          {request.amount != null ? <p className="mt-1 text-[10.5px] text-muted-foreground">Amount returned by the platform: {request.currency ?? ""} {request.amount}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2"><Link to="/work/$workId" params={{ workId: request.id }} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-[10.5px] font-medium">Open action <ArrowRight className="size-3.5" /></Link><span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><ShieldCheck className="size-3.5" />Evidence stays canonical</span></div>
        </div>
      </div>
    </li>;
  })}</Rows>;
}
