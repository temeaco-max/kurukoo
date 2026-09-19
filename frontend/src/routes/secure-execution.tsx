import { createFileRoute } from "@tanstack/react-router";
import { Monitor, Plus, Square, Play, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader, EmptyState } from "@/components/app-shell";
import { Panel, SectionHeader } from "@/components/kurukoo/ui";
import { Action } from "@/components/kurukoo/primitives";
import {
  fetchExecutionSessions,
  createExecutionSession,
  fetchExecutionActions,
  queueExecutionAction,
  stopExecutionSession,
  type ExecutionSession,
  type ExecutionAction,
  type ActionType,
} from "@/lib/trust-api";

export const Route = createFileRoute("/secure-execution")({
  head: () => ({
    meta: [
      { title: "Secure execution — Kurukoo" },
      {
        name: "description",
        content: "Isolated browser sessions for tasks that need a real browser.",
      },
    ],
  }),
  component: SecureExecutionPage,
});

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    ready: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
    running: "bg-primary/15 text-primary",
    busy: "bg-accent/15 text-accent",
    provider_required: "bg-destructive/15 text-destructive",
    stopped: "bg-elevated text-muted-foreground",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wide ${map[status] || "bg-elevated text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}

function SecureExecutionPage() {
  const [sessions, setSessions] = useState<ExecutionSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [actions, setActions] = useState<ExecutionAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetchExecutionSessions();
      setSessions(r.sessions);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load sessions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!activeId) {
      setActions([]);
      return;
    }
    let cancelled = false;
    fetchExecutionActions(activeId)
      .then((r) => {
        if (!cancelled) setActions(r.actions);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  async function handleCreate() {
    try {
      const r = await createExecutionSession({ ttlMinutes: 30 });
      setActiveId(r.id);
      await load();
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "provider_required")
        setError(
          "Secure execution provider not configured. Set SECURE_EXECUTION_PROVIDER to enable.",
        );
      else setError(e instanceof Error ? e.message : "Could not create session");
    }
  }

  async function handleAction(type: string) {
    if (!activeId) return;
    try {
      await queueExecutionAction(activeId, type as ActionType, {});
      await load();
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "provider_required")
        setError("Provider not configured");
      else setError(e instanceof Error ? e.message : "Could not queue action");
    }
  }

  async function handleStop(id: string) {
    try {
      await stopExecutionSession(id);
      if (activeId === id) setActiveId(null);
      await load();
    } catch {
      setError("Could not stop session");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Secure execution"
        subtitle="Isolated browser sessions for tasks that need a real browser or OS-level action."
        action={
          <Action variant="primary" onClick={handleCreate}>
            <Plus className="size-3.5" /> New session
          </Action>
        }
      />
      {error && (
        <Panel className="p-4">
          <p className="text-[13px] text-destructive">{error}</p>
        </Panel>
      )}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-elevated" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          title="No sessions"
          body="Create a secure execution session. Kurukoo will run browser tasks in an isolated sandbox and report results back."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel className="overflow-hidden p-0">
            <div className="border-b border-border/70 px-4 py-3">
              <SectionHeader title="Sessions" subtitle={`${sessions.length} total`} />
            </div>
            <ul className="divide-y divide-border/70">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-elevated ${activeId === s.id ? "bg-elevated" : ""}`}
                  onClick={() => setActiveId(s.id)}
                >
                  <Monitor className="size-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium">{s.id}</p>
                    <p className="text-[10px] text-muted-foreground">
                      expires {s.expiresAt ? new Date(s.expiresAt).toLocaleString() : "—"}
                    </p>
                  </div>
                  <StatusPill status={s.status} />
                </li>
              ))}
            </ul>
          </Panel>
          <Panel className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
              <SectionHeader
                title="Actions"
                subtitle={activeId ? `Session ${activeId.slice(0, 20)}…` : "Select a session"}
              />
              {activeId && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleAction("navigate")}
                    className="grid size-7 place-items-center rounded-lg hover:bg-elevated"
                    title="Navigate"
                  >
                    <Play className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction("screenshot")}
                    className="grid size-7 place-items-center rounded-lg hover:bg-elevated"
                    title="Screenshot"
                  >
                    <Monitor className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStop(activeId)}
                    className="grid size-7 place-items-center rounded-lg hover:bg-elevated text-destructive"
                    title="Stop"
                  >
                    <Square className="size-3" />
                  </button>
                </div>
              )}
            </div>
            <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
              {actions.length === 0 ? (
                <p className="p-3 text-center text-[12px] text-muted-foreground">
                  No actions yet. Use the toolbar to queue browser actions.
                </p>
              ) : (
                actions.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 rounded-lg bg-elevated/50 px-3 py-2"
                  >
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wide ${a.status === "completed" ? "bg-[var(--color-success)]/15 text-[var(--color-success)]" : a.status === "failed" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}
                    >
                      {a.status}
                    </span>
                    <span className="text-[12px] font-medium">{a.type}</span>
                    {a.error && <AlertCircle className="ml-auto size-3 text-destructive" />}
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      )}
      <Panel className="flex items-start gap-3 p-4">
        <Monitor className="mt-0.5 size-5 shrink-0 text-primary" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Secure execution runs tasks in an isolated sandboxed browser. The Kurukoo-side
          infrastructure (session lifecycle, action queue, audit) is fully functional. The actual
          browser runtime is delegated to a pluggable provider (Browserless,
          Playwright-as-a-service) configured via SECURE_EXECUTION_PROVIDER. Without a provider,
          sessions report "provider_required" so you can enable it when ready.
        </p>
      </Panel>
    </div>
  );
}
