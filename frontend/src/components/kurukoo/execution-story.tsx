import { Check, Circle, FileCheck2, MapPin, MessageCircle, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import type { EconomicRequest } from "@/lib/kurukoo-api";
import { cn } from "@/lib/utils";

const stages = [
  ["request", "Goal"],
  ["discovery", "Options"],
  ["quote", "Decision"],
  ["approval", "Approval"],
  ["payment", "Action"],
  ["fulfilment", "Fulfilment"],
  ["evidence", "Outcome"],
] as const;

type Stage = typeof stages[number][0];

function stageFor(status: string): Stage {
  if (["requested", "awaiting_match", "partially_matched"].includes(status)) return "request";
  if (["matched", "quoting"].includes(status)) return "discovery";
  if (status === "quoted") return "quote";
  if (status === "awaiting_confirmation") return "approval";
  if (["payment_pending", "paid"].includes(status)) return "payment";
  if (["reserved", "in_fulfillment", "fulfilled", "dispatched", "driver_assigned", "arriving", "in_transit"].includes(status)) return "fulfilment";
  if (status === "completed") return "evidence";
  return "request";
}

function label(value: string) {
  return value.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function field(request: EconomicRequest, names: string[]) {
  for (const name of names) {
    const value = request.requirements?.[name];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return "";
}

function EvidencePill({ verified }: { verified: boolean }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9.5px] font-medium", verified ? "bg-brand-tint text-brand-ink" : "bg-elevated text-muted-foreground")}>
    {verified ? <Check className="size-3" /> : <Circle className="size-2.5" />}
    {verified ? "Confirmed by request state" : "Awaiting evidence"}
  </span>;
}

export function ExecutionStory({ request }: { request: EconomicRequest }) {
  const current = stageFor(request.status);
  const currentIndex = stages.findIndex(([key]) => key === current);
  const terminal = ["completed", "cancelled", "abandoned", "disputed", "failed"].includes(request.status);
  const from = field(request, ["pickup", "from", "origin", "pickup_location"]);
  const to = field(request, ["dropoff", "to", "destination", "dropoff_location"]);
  const location = field(request, ["location", "pickup", "pickup_location", "from", "origin"]);
  const provider = field(request, ["provider", "provider_name", "seller", "rider", "driver"]);
  const amount = request.amount != null ? `${request.currency ?? ""} ${request.amount}`.trim() : request.quote ? "Quote returned" : "Not returned";
  const requirements = Object.entries(request.requirements ?? {}).filter(([, value]) => value !== null && value !== undefined && String(value).trim()).slice(0, 4);
  const outcomeVerified = request.status === "completed";

  return <section className="overflow-hidden rounded-[24px] border border-border bg-surface shadow-[var(--shadow-soft)]" aria-label="Execution story">
    <div className="relative overflow-hidden border-b border-border bg-elevated/35 px-5 py-6 sm:px-7 sm:py-7">
      <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-brand-tint/40 blur-3xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-primary"><Sparkles className="size-3.5" /> What Kurukoo is doing</div>
          <h2 className="mt-2 text-[27px] font-semibold tracking-[-0.035em] sm:text-[32px]">From your request to a real outcome.</h2>
          <p className="mt-2 text-[12.5px] leading-6 text-muted-foreground">This is the human-readable story of the request. Live execution controls and canonical state remain underneath it.</p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-full border border-border bg-background px-3 py-1.5 text-[10.5px] font-medium lg:self-auto"><span className="size-1.5 rounded-full bg-primary" />{label(request.status)}</div>
      </div>

      <ol className="relative mt-7 grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-7">
        {stages.map(([key, name], index) => {
          const done = terminal || index < currentIndex;
          const active = index === currentIndex && !terminal;
          return <li key={key} className="min-w-0">
            <div className="flex flex-col gap-2">
              <span className={cn("grid size-8 place-items-center rounded-full border", done ? "border-primary bg-primary text-primary-foreground" : active ? "border-primary bg-background text-primary" : "border-border bg-background text-muted-foreground")}>
                {done ? <Check className="size-3.5" strokeWidth={3} /> : active ? <span className="size-2 rounded-full bg-primary" /> : <Circle className="size-3" />}
              </span>
              <span className={cn("truncate text-[9.5px]", (done || active) ? "font-semibold text-foreground" : "text-muted-foreground")}>{name}</span>
            </div>
          </li>;
        })}
      </ol>
    </div>

    <div className="grid gap-px bg-border md:grid-cols-2">
      <article className="bg-background p-5 sm:p-6">
        <div className="flex items-center gap-2 text-primary"><MessageCircle className="size-4" /><p className="text-[10px] font-bold uppercase tracking-[0.12em]">1 · The goal</p></div>
        <p className="mt-3 text-[18px] font-semibold leading-6">{label(request.skill)}</p>
        <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">Kurukoo is working from the request you created, rather than treating this page as a generic task list.</p>
        <div className="mt-4"><EvidencePill verified /></div>
      </article>

      <article className="bg-background p-5 sm:p-6">
        <div className="flex items-center gap-2 text-primary"><Sparkles className="size-4" /><p className="text-[10px] font-bold uppercase tracking-[0.12em]">2 · What was understood</p></div>
        {requirements.length ? <dl className="mt-3 grid gap-2 sm:grid-cols-2">{requirements.map(([key, value]) => <div key={key} className="rounded-xl bg-elevated/60 px-3 py-2.5"><dt className="text-[9px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{label(key)}</dt><dd className="mt-1 text-[11.5px] leading-5">{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}</dl> : <p className="mt-3 text-[12px] leading-5 text-muted-foreground">No additional requirements were returned by the canonical request.</p>}
        <div className="mt-4"><EvidencePill verified={requirements.length > 0} /></div>
      </article>

      <article className="bg-background p-5 sm:p-6">
        <div className="flex items-center gap-2 text-primary"><MapPin className="size-4" /><p className="text-[10px] font-bold uppercase tracking-[0.12em]">3 · The route</p></div>
        <div className="mt-3 space-y-2">
          {from ? <div className="flex gap-3"><span className="mt-1 size-2 rounded-full border border-primary" /><div><p className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground">From</p><p className="text-[12px]">{from}</p></div></div> : null}
          {to ? <div className="flex gap-3"><span className="mt-1 size-2 rounded-full bg-primary" /><div><p className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground">To</p><p className="text-[12px]">{to}</p></div></div> : null}
          {!from && !to && location ? <p className="text-[12px]">{location}</p> : null}
          {!from && !to && !location ? <p className="text-[12px] text-muted-foreground">Location has not been returned as part of this request.</p> : null}
        </div>
        <div className="mt-4"><EvidencePill verified={Boolean(from || to || location)} /></div>
      </article>

      <article className="bg-background p-5 sm:p-6">
        <div className="flex items-center gap-2 text-primary"><UserRound className="size-4" /><p className="text-[10px] font-bold uppercase tracking-[0.12em]">4 · The decision</p></div>
        <p className="mt-3 text-[15px] font-semibold">{provider || "No provider selected yet"}</p>
        <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">{request.status === "awaiting_confirmation" ? "A consequential decision is waiting for your approval." : request.amount != null || request.quote ? `Commercial information: ${amount}.` : "No confirmed commercial offer has been returned yet."}</p>
        <div className="mt-4 flex flex-wrap gap-2"><EvidencePill verified={Boolean(provider || request.quote || request.amount != null)} /></div>
      </article>

      <article className="bg-background p-5 sm:p-6">
        <div className="flex items-center gap-2 text-primary"><ShieldCheck className="size-4" /><p className="text-[10px] font-bold uppercase tracking-[0.12em]">5 · Your control</p></div>
        <p className="mt-3 text-[15px] font-semibold">{request.status === "awaiting_confirmation" ? "Your approval is the next gate." : "Consequential actions stay behind canonical controls."}</p>
        <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">Kurukoo does not turn context into permission. Approval, payment and completion are separate state transitions.</p>
        <div className="mt-4"><EvidencePill verified={request.status !== "awaiting_confirmation"} /></div>
      </article>

      <article className="bg-background p-5 sm:p-6">
        <div className="flex items-center gap-2 text-primary"><FileCheck2 className="size-4" /><p className="text-[10px] font-bold uppercase tracking-[0.12em]">6 · The outcome</p></div>
        <p className="mt-3 text-[15px] font-semibold">{outcomeVerified ? "Outcome confirmed" : "Outcome not yet confirmed"}</p>
        <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">{outcomeVerified ? "The canonical request is complete. Evidence and follow-up can be reviewed below." : "A provider signal, dispatch event or local execution state is not the same as a confirmed customer outcome."}</p>
        <div className="mt-4"><EvidencePill verified={outcomeVerified} /></div>
      </article>
    </div>

    <div className="flex flex-col gap-3 border-t border-border bg-elevated/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div><p className="text-[11px] font-semibold">Current position</p><p className="mt-0.5 text-[10.5px] text-muted-foreground">{terminal ? "This request has reached a terminal state." : `${label(stages[Math.max(currentIndex, 0)]?.[1] ?? "request")} is the current stage.`}</p></div>
      <span className="inline-flex items-center gap-1.5 text-[10.5px] text-muted-foreground"><span className="size-1.5 rounded-full bg-primary" />Canonical state: {label(request.status)}</span>
    </div>
  </section>;
}
