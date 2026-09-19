import { createFileRoute } from "@tanstack/react-router";
import { Download, FileText, Shield, Zap, Target, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader, EmptyState } from "@/components/app-shell";
import { Panel, SectionHeader } from "@/components/kurukoo/ui";
import {
  fetchAuditTimeline,
  exportTrustAudit,
  type AuditEntry,
  type AuditTimeline,
} from "@/lib/trust-api";
import { useKurukoo } from "@/lib/kurukoo-store";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Activity & audit — Kurukoo" },
      {
        name: "description",
        content: "See everything Kurukoo has done, is doing, and plans to do.",
      },
    ],
  }),
  component: AuditPage,
});

const kindIcon = (kind: string) => {
  switch (kind) {
    case "intent":
      return <Zap className="size-4 text-primary" />;
    case "request":
      return <Target className="size-4 text-accent" />;
    case "goal":
      return <Shield className="size-4 text-primary" />;
    case "action":
      return <FileText className="size-4 text-muted-foreground" />;
    case "outcome":
      return <CheckCircle2 className="size-4 text-[var(--color-success)]" />;
    default:
      return <FileText className="size-4 text-muted-foreground" />;
  }
};

const kindLabel: Record<string, string> = {
  intent: "Intent",
  request: "Request",
  goal: "Goal",
  action: "Action",
  outcome: "Outcome",
  evidence: "Evidence",
};

function AuditPage() {
  const { send } = useKurukoo();
  const [timeline, setTimeline] = useState<AuditTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAuditTimeline(100)
      .then((r) => {
        if (!cancelled) setTimeline(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load audit timeline");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleExport() {
    try {
      const blob = await exportTrustAudit();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "kurukoo-audit-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not export audit");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity & audit"
        subtitle="A complete timeline of what you asked Kurukoo, what it planned, and what happened."
        action={
          <button
            type="button"
            onClick={handleExport}
            disabled={!timeline || timeline.entries.length === 0}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[12px] text-muted-foreground hover:bg-elevated disabled:opacity-40"
          >
            <Download className="size-3.5" /> Export
          </button>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-elevated" />
          ))}
        </div>
      ) : error ? (
        <Panel className="p-6">
          <p className="text-[14px] text-destructive">{error}</p>
        </Panel>
      ) : !timeline || timeline.entries.length === 0 ? (
        <EmptyState
          title="No activity yet"
          body="Your requests, goals and actions will appear here as Kurukoo works through them."
        />
      ) : (
        <Panel className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <SectionHeader title="Timeline" subtitle={`${timeline.total} total entries`} />
          </div>
          <ul className="divide-y divide-border/70">
            {timeline.entries.map((entry: AuditEntry) => (
              <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-elevated">
                  {kindIcon(entry.kind ?? "")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13.5px] font-medium">{entry.title}</p>
                    <span className="shrink-0 rounded-full bg-elevated px-2 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                      {kindLabel[entry.kind ?? ""] || entry.kind}
                    </span>
                  </div>
                  {entry.description && (
                    <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">
                      {entry.description}
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-[10.5px] text-muted-foreground">
                    <span>
                      {entry.occurredAt ? new Date(entry.occurredAt).toLocaleString() : ""}
                    </span>
                    {entry.actor && <span>· {entry.actor}</span>}
                    <span
                      className={`inline-flex items-center gap-1 ${entry.status === "completed" || entry.status === "success" ? "text-[var(--color-success)]" : ""}`}
                    >
                      · {entry.status}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel className="p-4">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          This timeline is built from Kurukoo's existing event stores — intents, requests, goals,
          actions and outcomes. It does not create a new engine. For questions about what Kurukoo
          did on your behalf, ask in{" "}
          <button
            type="button"
            onClick={() => send("Explain my recent activity")}
            className="text-primary hover:underline"
          >
            Chat
          </button>
          .
        </p>
      </Panel>
    </div>
  );
}
