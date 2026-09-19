import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Copy, Eye, FileText, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EmptyState, PageHeader } from "@/components/app-shell";
import { Panel } from "@/components/kurukoo/ui";
import {
  fetchMyTopics,
  removeTopic,
  topicApiConfigured,
  topicStatusLabel,
  type OwnerTopic,
} from "@/lib/topic-lifecycle";

export const Route = createFileRoute("/topics/mine")({
  head: () => ({
    meta: [
      { title: "Your Topics — Kurukoo" },
      {
        name: "description",
        content:
          "Manage your Topic drafts, submissions, published discussions and moderation states.",
      },
    ],
  }),
  component: MyTopicsPage,
});
const states = ["all", "draft", "submitted", "public", "restricted", "removed"] as const;
function pretty(value: string) {
  return value.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function isEditable(status: string) {
  return ["draft", "submitted", "restricted"].includes(status.toLowerCase());
}
function isPublic(status: string) {
  return ["public", "published", "active"].includes(status.toLowerCase());
}
function TopicRow({ topic, onRemoved }: { topic: OwnerTopic; onRemoved: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const publicReady = isPublic(topic.status);
  async function copyLink() {
    if (!publicReady || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/topics/${topic.slug}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }
  async function remove() {
    if (
      !window.confirm(
        "Remove this Topic from public view? Existing followers will no longer receive Topic updates.",
      )
    )
      return;
    setBusy(true);
    try {
      await removeTopic(topic.id);
      onRemoved(topic.id);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to remove this Topic.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="rounded-[18px] border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5 text-[10.5px] text-muted-foreground">
            <span className="rounded-full bg-elevated px-2 py-1 font-medium text-foreground/80">
              {topicStatusLabel(topic.status)}
            </span>
            {topic.category ? (
              <span className="rounded-full bg-elevated px-2 py-1">{pretty(topic.category)}</span>
            ) : null}
            <span className="rounded-full bg-elevated px-2 py-1">{pretty(topic.type)}</span>
          </div>
          <h2 className="mt-3 text-[15px] font-medium leading-snug">{topic.title}</h2>
          <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
            {topic.body}
          </p>
        </div>
        <FileText className="size-4 shrink-0 text-muted-foreground" />
      </div>
      {topic.status.toLowerCase() === "restricted" && topic.moderationNote ? (
        <div className="mt-3 rounded-xl border border-border bg-elevated/50 px-3 py-2.5 text-[11.5px] leading-relaxed">
          <span className="font-medium">Review note:</span> {topic.moderationNote}
        </div>
      ) : null}
      {topic.status.toLowerCase() === "submitted" ? (
        <p className="mt-3 text-[11.5px] text-muted-foreground">
          Submitted for review. Changes send this Topic through review again.
        </p>
      ) : null}
      {topic.status.toLowerCase() === "draft" ? (
        <p className="mt-3 text-[11.5px] text-muted-foreground">
          Draft is private until you submit it for review.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {isEditable(topic.status) ? (
          <Link
            to="/topics/edit/$id"
            params={{ id: topic.id }}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:opacity-90"
          >
            Continue editing <ArrowUpRight className="size-3.5" />
          </Link>
        ) : null}
        {publicReady ? (
          <Link
            to="/topics/$slug"
            params={{ slug: topic.slug }}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[12px] hover:bg-elevated"
          >
            <Eye className="size-3.5" /> View
          </Link>
        ) : null}
        {publicReady ? (
          <button
            type="button"
            onClick={() => void copyLink()}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[12px] hover:bg-elevated"
          >
            <Copy className="size-3.5" /> {copied ? "Copied" : "Share link"}
          </button>
        ) : null}
        {topic.status.toLowerCase() !== "removed" ? (
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] text-muted-foreground hover:bg-elevated hover:text-foreground disabled:opacity-50"
          >
            <Trash2 className="size-3.5" /> {busy ? "Removing…" : "Remove"}
          </button>
        ) : null}
      </div>
    </article>
  );
}
function MyTopicsPage() {
  const [topics, setTopics] = useState<OwnerTopic[]>([]);
  const [filter, setFilter] = useState<(typeof states)[number]>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const filtered = useMemo(
    () =>
      filter === "all" ? topics : topics.filter((topic) => topic.status.toLowerCase() === filter),
    [filter, topics],
  );
  useEffect(() => {
    if (!topicApiConfigured()) {
      setLoading(false);
      setError("Topic management is not available here right now.");
      return;
    }
    void fetchMyTopics()
      .then(setTopics)
      .catch((nextError) =>
        setError(nextError instanceof Error ? nextError.message : "Unable to load your Topics."),
      )
      .finally(() => setLoading(false));
  }, []);
  return (
    <div className="w-full max-w-5xl">
      <PageHeader
        title="Your Topics"
        subtitle="Manage what you have started, submitted and shared with the community."
      />
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link
          to="/topics/create"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-[12.5px] font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="size-4" />
          Create a Topic
        </Link>
        <Link
          to="/topics"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border px-4 text-[12px] hover:bg-elevated"
        >
          Browse Topics
        </Link>
      </div>
      <Panel className="mt-6 p-2">
        <div className="flex flex-wrap gap-1">
          {states.map((state) => (
            <button
              key={state}
              type="button"
              onClick={() => setFilter(state)}
              className={`rounded-lg px-3 py-2 text-[11.5px] ${filter === state ? "bg-elevated font-medium text-foreground" : "text-muted-foreground hover:bg-elevated"}`}
            >
              {state === "all"
                ? "All"
                : state === "submitted"
                  ? "Awaiting review"
                  : state === "public"
                    ? "Published"
                    : pretty(state)}
            </button>
          ))}
        </div>
      </Panel>
      {loading ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="h-44 animate-pulse rounded-[18px] border border-border bg-surface" />
          <div className="h-44 animate-pulse rounded-[18px] border border-border bg-surface" />
        </div>
      ) : error ? (
        <Panel className="mt-4 p-6">
          <p className="text-[13px]">{error}</p>
          {error.toLowerCase().includes("authentication") ? (
            <Link to="/login" className="mt-3 inline-flex underline text-[12px]">
              Sign in to continue
            </Link>
          ) : null}
        </Panel>
      ) : filtered.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {filtered.map((topic) => (
            <TopicRow
              key={topic.id}
              topic={topic}
              onRemoved={(id) =>
                setTopics((items) =>
                  items.map((item) => (item.id === id ? { ...item, status: "removed" } : item)),
                )
              }
            />
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState
            title={
              filter === "all"
                ? "You have not started a Topic yet"
                : `No ${filter === "submitted" ? "Topics awaiting review" : pretty(filter) + " Topics"}`
            }
            body="Drafts can be resumed, submitted Topics are reviewed, and published Topics can be shared with the community."
          />
          <Link
            to="/topics/create"
            className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium underline"
          >
            <Plus className="size-3.5" />
            Start a Topic
          </Link>
        </div>
      )}
      <div className="mt-6 text-[11px] text-muted-foreground">
        Your Topic status and ownership are kept with your account.
      </div>
    </div>
  );
}
