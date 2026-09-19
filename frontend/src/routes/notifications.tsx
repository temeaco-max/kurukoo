import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, BellOff, Eye, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { useKurukoo } from "@/lib/kurukoo-store";
import { Panel } from "@/components/kurukoo/ui";
import { fetchFollowedTopics, topicApiConfigured, type FollowedTopic } from "@/lib/topic-lifecycle";
import { setTopicNotificationPreference } from "@/lib/kurukoo-api";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Kurukoo" },
      { name: "description", content: "Manage Topic update preferences and attention in Kurukoo." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { notifications, markRead } = useKurukoo();
  const [items, setItems] = useState<FollowedTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    if (!topicApiConfigured()) {
      setError(
        "Topic notifications use the canonical Kurukoo service, which is not configured in this environment.",
      );
      setLoading(false);
      return;
    }
    try {
      setItems(await fetchFollowedTopics());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load Topic updates.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function toggle(item: FollowedTopic) {
    const next = item.relationship.notificationPreference === "muted" ? "all" : "muted";
    setBusyId(item.topic.id);
    try {
      await setTopicNotificationPreference(item.topic.id, next);
      setItems((current) =>
        current.map((entry) =>
          entry.topic.id === item.topic.id
            ? { ...entry, relationship: { ...entry.relationship, notificationPreference: next } }
            : entry,
        ),
      );
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Unable to update Topic notifications.",
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="w-full max-w-4xl">
      <PageHeader
        title="Notifications"
        subtitle="Control the Topic updates you have chosen to receive."
      />
      <Panel className="mt-6 p-4">
        <div className="flex items-start gap-3">
          <Bell className="mt-0.5 size-4 text-muted-foreground" />
          <div>
            <p className="text-[13px] font-medium">Topic updates</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
              Following a Topic keeps you connected to its canonical community updates. Mute turns
              those updates off without unfollowing the Topic.
            </p>
          </div>
        </div>
      </Panel>
      {notifications.length ? (
        <section className="mt-6">
          <h2 className="text-[16px] font-semibold">Attention & updates</h2>
          <div className="mt-3 space-y-2">
            {notifications.map((item) => (
              <article key={item.id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-elevated">
                    <Bell className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium">{item.title}</p>
                      {item.needsConfirmation ? (
                        <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[9.5px] font-medium text-brand-ink">
                          Needs you
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                      {item.body}
                    </p>
                    <p className="mt-1.5 text-[9.5px] text-muted-foreground">{item.when}</p>
                  </div>
                  {!item.read ? (
                    <button
                      type="button"
                      onClick={() => markRead(item.id)}
                      className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-[10.5px] hover:bg-elevated"
                    >
                      Mark read
                    </button>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Read</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {loading ? (
        <div className="mt-4 h-40 animate-pulse rounded-[18px] border border-border bg-surface" />
      ) : error ? (
        <Panel className="mt-4 p-5">
          <p className="text-[12.5px] text-muted-foreground">{error}</p>
          <Link to="/login" className="mt-3 inline-flex text-[12px] underline">
            Sign in
          </Link>
        </Panel>
      ) : items.length ? (
        <div className="mt-4 space-y-3">
          {items.map((item) => {
            const muted = item.relationship.notificationPreference === "muted";
            return (
              <article
                key={item.topic.id}
                className="rounded-[18px] border border-border bg-surface p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-elevated">
                    <MessageCircle className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium">{item.topic.title}</p>
                    <p className="mt-1 text-[11.5px] text-muted-foreground">
                      Updates: {muted ? "Off" : "On"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link
                    to="/topics/$slug"
                    params={{ slug: item.topic.slug }}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[11.5px] hover:bg-elevated"
                  >
                    <Eye className="size-3.5" />
                    View Topic
                  </Link>
                  <button
                    type="button"
                    onClick={() => void toggle(item)}
                    disabled={busyId === item.topic.id}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[11.5px] text-muted-foreground hover:bg-elevated disabled:opacity-50"
                  >
                    {muted ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />}
                    {muted ? "Turn updates on" : "Mute updates"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Panel className="mt-4 p-6">
          <p className="text-[14px] font-medium">No Topic updates yet</p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
            Follow Topics you care about and their update preferences will appear here.
          </p>
          <Link to="/topics" className="mt-4 inline-flex text-[12.5px] font-medium underline">
            Explore Topics
          </Link>
        </Panel>
      )}
      <p className="mt-5 text-[11px] text-muted-foreground">
        Kurukoo does not fabricate notifications. This surface only reflects canonical Topic
        relationships and preferences.
      </p>
    </div>
  );
}
