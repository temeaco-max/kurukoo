import { ArrowRight, CheckCircle2, MapPin, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchDiscoveryEntities, isKurukooApiConfigured, type DiscoveryEntity } from "@/lib/kurukoo-api";
import { CapabilityPills, DirectoryStateBadge } from "@/components/kurukoo/surface-directory";

function pretty(value: string) {
  return value.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function evidence(entity: DiscoveryEntity) {
  if (entity.liveNow) return "Live now";
  if (entity.available === true) return "Availability returned";
  if (entity.evidence) return pretty(entity.evidence);
  return "Source attributed";
}

export function ChatDiscovery({ query, onReview }: { query: string; onReview: (prompt: string) => void }) {
  const [results, setResults] = useState<DiscoveryEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const configured = isKurukooApiConfigured();
  const cleanQuery = useMemo(() => query.trim().replace(/^find\s+(me\s+)?/i, "").replace(/[?.!]$/g, ""), [query]);

  useEffect(() => {
    if (!configured || !cleanQuery) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    void fetchDiscoveryEntities({ q: cleanQuery, radius: 5000 })
      .then((items) => { if (!cancelled) setResults(items.slice(0, 4)); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Discovery is unavailable right now."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [cleanQuery, configured]);

  if (!cleanQuery) return null;

  if (!configured) {
    return <section className="rounded-2xl border border-border bg-elevated/35 px-4 py-4" aria-label="Discovery preview">
      <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface"><Search className="size-4 text-muted-foreground" /></span><div><p className="text-[12.5px] font-semibold">Options come next</p><p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">This preview can understand the job, but it is not connected to live provider discovery. Nothing here is being presented as a real match.</p></div></div>
    </section>;
  }

  return <section className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)]" aria-label="Discovery options">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /><p className="text-[12.5px] font-semibold">Suitable options</p></div><p className="mt-1 text-[11px] text-muted-foreground">Kurukoo found these from its connected discovery sources. Review one before anything is requested.</p></div><span className="rounded-full bg-elevated px-2.5 py-1 text-[10px] text-muted-foreground">{loading ? "Checking…" : `${results.length} found`}</span></div>
    {error ? <p className="mt-3 rounded-xl bg-elevated px-3 py-2.5 text-[11px] text-muted-foreground">{error}</p> : null}
    {!loading && !error && !results.length ? <div className="mt-3 rounded-xl border border-dashed border-border px-3 py-4"><p className="text-[12px] font-medium">No suitable result returned yet.</p><p className="mt-1 text-[11px] text-muted-foreground">That does not mean nobody can help. Kurukoo needs a connected, source-attributed route before it can recommend one.</p></div> : null}
    <div className="mt-3 space-y-2">{results.map((entity) => <article key={entity.id} className="rounded-xl border border-border bg-background p-3"><div className="flex items-start gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-lg bg-elevated"><ShieldCheck className="size-4 text-primary" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><h3 className="text-[12.5px] font-semibold">{entity.name}</h3><DirectoryStateBadge state={entity.liveNow ? "live" : entity.available === true ? "available" : "not-connected"} /></div><p className="mt-0.5 text-[10.5px] text-muted-foreground">{pretty(entity.category ?? entity.kind)}{entity.location ? ` · ${entity.location}` : ""}</p><div className="mt-1.5 flex flex-wrap items-center gap-2 text-[9.5px] text-muted-foreground"><span>{evidence(entity)}</span>{entity.freshness ? <span>· {entity.freshness}</span> : null}{entity.source ? <span>· {pretty(entity.source)}</span> : null}</div>{entity.description ? <p className="mt-2 line-clamp-2 text-[10.5px] leading-relaxed text-muted-foreground">{entity.description}</p> : null}{entity.skills?.length ? <div className="mt-2"><CapabilityPills items={entity.skills} limit={3} /></div> : null}</div></div><div className="mt-3 flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1 text-[9.5px] text-muted-foreground"><MapPin className="size-3" />Context only until you approve the next step</span><button type="button" onClick={() => onReview(`I want to review ${entity.name}${entity.location ? ` in ${entity.location}` : ""} for my request. Show me the evidence, price, availability and exactly what would happen before I approve anything.`)} className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-[10.5px] font-medium text-primary-foreground">Review option <ArrowRight className="size-3" /></button></div></article>)}</div>
    {results.length ? <p className="mt-3 flex items-center gap-1.5 text-[9.5px] text-muted-foreground"><CheckCircle2 className="size-3 text-primary" />No option is treated as selected until you explicitly approve the next step.</p> : null}
  </section>;
}
