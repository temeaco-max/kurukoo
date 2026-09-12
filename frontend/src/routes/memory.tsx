import { createFileRoute } from "@tanstack/react-router";
import { Brain, Search, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EmptyState, PageHeader } from "@/components/app-shell";
import { Avatar } from "@/components/kurukoo/ui";
import { fetchCanonicalMemoryFacts, revokeCanonicalMemoryFact, type CanonicalMemoryFact } from "@/lib/kurukoo-api";

export const Route = createFileRoute("/memory")({
  head: () => ({
    meta: [
      { title: "Memory — Kurukoo" },
      { name: "description", content: "Review what Kurukoo remembers so you do not have to repeat yourself." },
    ],
  }),
  component: MemoryPage,
});

function MemoryPage() {
  const [facts, setFacts] = useState<CanonicalMemoryFact[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setFacts(await fetchCanonicalMemoryFacts());
    } catch (cause) {
      setFacts([]);
      setError(cause instanceof Error ? cause.message : "Unable to load your memory.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? facts.filter((fact) => `${fact.field} ${fact.value} ${fact.provenance ?? ""}`.toLowerCase().includes(q)) : facts;
  }, [facts, query]);

  async function remove(id: number) {
    if (!window.confirm("Remove this detail from your active Kurukoo memory?")) return;
    setBusyId(id);
    try {
      await revokeCanonicalMemoryFact(id);
      setFacts((items) => items.filter((fact) => fact.id !== id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to remove this memory detail.");
    } finally {
      setBusyId(null);
    }
  }

  return <div className="space-y-8 pb-10">
    <PageHeader title="Memory" subtitle="The useful things Kurukoo remembers so you do not have to repeat yourself. Review or remove anything here whenever you like." />

    <section className="border-y border-border py-6">
      <div className="flex items-start gap-3.5">
        <span className="grid size-10 shrink-0 place-items-center bg-elevated"><Brain className="size-[18px]" /></span>
        <div className="max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Quiet intelligence</p>
          <h2 className="mt-1.5 text-[22px] font-semibold tracking-tight">Memory stays in the background.</h2>
          <p className="mt-1.5 text-[13px] leading-6 text-muted-foreground">Kurukoo uses retained context to make future conversations more useful. It never turns memory into permission to take a consequential action.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2">
        <div className="bg-background p-4"><ShieldCheck className="size-4 text-muted-foreground" /><p className="mt-2 text-[12.5px] font-medium">Context, not consent</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Remembering a preference does not authorise a purchase, booking or other consequential action.</p></div>
        <div className="bg-background p-4"><SlidersHorizontal className="size-4 text-muted-foreground" /><p className="mt-2 text-[12.5px] font-medium">You can remove it</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Removing a detail stops it being used as retained context; it does not rewrite past conversations or external systems.</p></div>
      </div>
    </section>

    <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="text-[17px] font-semibold">Remembered details</h2><p className="mt-0.5 text-[12px] text-muted-foreground">{visible.length} of {facts.length} active details</p></div>
        <label className="relative block sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><span className="sr-only">Search memory</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search memory" className="h-10 w-full border border-border bg-background pl-9 pr-3 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
      </div>

      {loading ? <div className="h-40 animate-pulse border border-border bg-surface" /> : error ? <EmptyState title="Memory could not load" body={error} /> : visible.length === 0 ? <EmptyState title={facts.length ? "No matching memory" : "Nothing remembered yet"} body={facts.length ? "Try another search term." : "Useful details can appear here as the canonical Kurukoo memory service records them."} /> : <div className="border-y border-border"><ul className="divide-y divide-border">{visible.map((fact) => <li key={fact.id} className="flex items-start gap-3 px-1 py-5 sm:px-2"><Avatar name={fact.field} size={36} /><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{fact.field.replace(/[_-]/g, " ")}</p><p className="mt-1 text-[14px] font-medium">{fact.value}</p><p className="mt-1.5 text-[10.5px] text-muted-foreground">{fact.provenance ? `Source: ${fact.provenance}` : "Source recorded by Kurukoo"}{fact.observedAt ? ` · Observed ${new Date(fact.observedAt).toLocaleDateString()}` : ""}</p></div><button type="button" onClick={() => void remove(fact.id)} disabled={busyId === fact.id} className="shrink-0 border border-border px-2.5 py-2 text-[10.5px] text-muted-foreground hover:bg-elevated disabled:opacity-50">{busyId === fact.id ? "Removing…" : "Remove"}</button></li>)}</ul></div>}
    </section>

    <p className="text-[10.5px] text-muted-foreground">Your active memory is owner-scoped by the canonical Kurukoo memory service.</p>
  </div>;
}
