import { Bell, CheckCircle2, ExternalLink, MessageCircle, Radio, Sparkles } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, EmptyState } from "@/components/app-shell";
import { Action } from "@/components/kurukoo/primitives";
import { ContextIconTile, Panel, Rows, StatusPill, Tabs } from "@/components/kurukoo/ui";
import { EconomicActivity } from "@/components/kurukoo/economic-activity";
import { fetchChatHistory } from "@/lib/kurukoo-api";
import { fetchFollowedTopics, topicApiConfigured, type FollowedTopic } from "@/lib/topic-lifecycle";
import { useKurukoo } from "@/lib/kurukoo-store";

export const Route = createFileRoute("/activity")({
  head: () => ({ meta: [{ title: "Activity — Kurukoo" }, { name: "description", content: "A quiet history of what changed and what needs you." }] }),
  component: ActivityPage,
});

const tabs = ["Needs you", "Actions", "Replies", "Following", "System"] as const;
type ActivityConversation = { id: string; title?: string | null; channel?: string; updated_at?: string };
type ActivityMessage = { id: number; sender: string; content: string; conversation_id?: string | null; conversationId?: string | null; created_at?: string; createdAt?: string };

function formatWhen(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const delta = Date.now() - date.getTime();
  if (delta >= 0 && delta < 60_000) return "Just now";
  if (delta >= 0 && delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta >= 0 && delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function sourceLabel(value?: string | null) {
  return value ? value.replace(/[_-]/g, " ") : "";
}

function openConversation(id: string) {
  localStorage.setItem("kurukoo-open-conversation", id);
}

function NotificationSource({ notification }: { notification: { link?: string | null; objectType?: string | null; canonicalAction?: string | null; conversationId?: string | null } }) {
  const source = sourceLabel(notification.objectType);
  const action = sourceLabel(notification.canonicalAction);
  if (!source && !action && !notification.link && !notification.conversationId) return null;
  return <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
    {source || action ? <span>{[source, action].filter(Boolean).join(" · ")}</span> : null}
    {notification.link ? <a href={notification.link} className="inline-flex items-center gap-1 font-medium text-foreground transition-colors hover:text-primary">Open source <ExternalLink className="size-3" /></a> : notification.conversationId ? <Link to="/chat" onClick={() => openConversation(notification.conversationId!)} className="inline-flex items-center gap-1 font-medium text-foreground transition-colors hover:text-primary">Open conversation <MessageCircle className="size-3" /></Link> : null}
  </div>;
}

function ActivityPage() {
  const { notifications, markRead } = useKurukoo();
  const [tab, setTab] = useState<string>(tabs[0]);
  const [followedTopics, setFollowedTopics] = useState<FollowedTopic[]>([]);
  const [topicFollowingError, setTopicFollowingError] = useState("");
  const [conversations, setConversations] = useState<ActivityConversation[]>([]);
  const [conversationMessages, setConversationMessages] = useState<ActivityMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    if (!topicApiConfigured()) { setFollowedTopics([]); setTopicFollowingError("Topic updates require the canonical service connection."); return; }
    void fetchFollowedTopics().then((items) => { setFollowedTopics(items); setTopicFollowingError(""); }).catch((error) => { setFollowedTopics([]); setTopicFollowingError(error instanceof Error ? error.message : "Unable to load Topic updates."); });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true); setHistoryError("");
    void fetchChatHistory(undefined, 100).then((data) => {
      if (cancelled) return;
      setConversations((data.conversations ?? []) as ActivityConversation[]);
      setConversationMessages((data.messages ?? []) as ActivityMessage[]);
    }).catch((error) => {
      if (cancelled) return;
      setConversations([]); setConversationMessages([]);
      setHistoryError(error instanceof Error ? error.message : "Unable to load your conversation activity.");
    }).finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const replyItems = useMemo(() => {
    const latestByConversation = new Map<string, ActivityMessage>();
    for (const message of conversationMessages) {
      const conversationId = message.conversationId ?? message.conversation_id;
      if (!conversationId || !message.content?.trim()) continue;
      const current = latestByConversation.get(conversationId);
      const currentTime = current?.createdAt ?? current?.created_at ?? "";
      const messageTime = message.createdAt ?? message.created_at ?? "";
      if (!current || messageTime >= currentTime) latestByConversation.set(conversationId, message);
    }
    return conversations.map((conversation) => ({ conversation, latest: latestByConversation.get(conversation.id) }))
      .filter(({ latest }) => Boolean(latest))
      .sort((a, b) => new Date(b.conversation.updated_at ?? "").getTime() - new Date(a.conversation.updated_at ?? "").getTime());
  }, [conversations, conversationMessages]);

  const pending = notifications.filter((n) => n.needsConfirmation);
  const unread = notifications.filter((n) => !n.read).length;
  const systemUpdates = notifications.filter((n) => !n.needsConfirmation);
  const recentNotifications = notifications.slice(0, 4);

  return <div className="space-y-8 pb-10">
    <PageHeader title="What changed" subtitle="A quiet history of replies, decisions and important updates. Kurukoo will surface something here when it matters." />
    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-5 p-5 sm:p-7">
        <div className="flex items-start justify-between gap-5">
          <div className="flex items-start gap-3.5"><ContextIconTile className="size-11 rounded-2xl bg-elevated/80"><Radio className="size-[18px]" /></ContextIconTile><div><p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Personal updates</p><h2 className="mt-1 text-[23px] font-semibold tracking-tight">{pending.length ? `${pending.length} decision${pending.length === 1 ? "" : "s"} waiting` : "You are up to date"}</h2><p className="mt-1.5 max-w-xl text-[13.5px] leading-5 text-muted-foreground">{unread ? `${unread} unread update${unread === 1 ? "" : "s"}.` : "There is nothing you need to check right now."}</p></div></div>
          <StatusPill tone={pending.length ? "peach" : "green"}>{pending.length ? "Needs you" : "Caught up"}</StatusPill>
        </div>
        {recentNotifications.length ? <div className="grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2">{recentNotifications.map((n) => <div key={n.id} className="bg-background p-4"><div className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-primary" /><span className="text-[11px] font-medium">{n.title}</span><span className="ml-auto text-[10px] text-muted-foreground">{n.when}</span></div><p className="mt-2 line-clamp-2 text-[12px] leading-5 text-muted-foreground">{n.body}</p><NotificationSource notification={n} /></div>)}</div> : null}
      </div>
      <Tabs items={tabs} value={tab} onChange={setTab} />
    </Panel>
    <section>
      {tab === "Needs you" ? pending.length === 0 ? <EmptyState title="Nothing waiting on you" body="When Kurukoo reaches a consequential step that needs your decision, it will appear here." /> : <Rows>{pending.map((n) => <li key={n.id} className="px-4 py-5 sm:px-5"><div className="flex items-start gap-3"><ContextIconTile><CheckCircle2 className="size-[17px]" /></ContextIconTile><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-[15px] font-medium">{n.title}</p><StatusPill tone="peach">Needs approval</StatusPill></div><p className="mt-1 text-[13.5px] leading-5 text-muted-foreground">{n.body}</p><NotificationSource notification={n} /><div className="mt-3"><Action onClick={() => markRead(n.id)}>Mark as seen</Action></div></div></div></li>)}</Rows> : null}
      {tab === "Actions" ? <EconomicActivity /> : null}
      {tab === "Replies" ? historyLoading ? <Panel className="p-5"><div className="h-4 w-36 animate-pulse rounded bg-elevated" /><div className="mt-3 h-3 w-64 animate-pulse rounded bg-elevated" /></Panel> : historyError ? <EmptyState title="Conversation activity unavailable" body={historyError} /> : replyItems.length ? <Rows>{replyItems.map(({ conversation, latest }) => <li key={conversation.id}><Link to="/chat" onClick={() => openConversation(conversation.id)} className="group flex items-center gap-3 px-4 py-4 transition-colors hover:bg-elevated sm:px-5"><ContextIconTile><MessageCircle className="size-[17px]" /></ContextIconTile><span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-medium group-hover:text-primary">{conversation.title || "Kurukoo conversation"}</span><span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{latest?.content}</span></span><span className="shrink-0 text-[11px] text-muted-foreground">{formatWhen(conversation.updated_at)}</span></Link></li>)}</Rows> : <EmptyState title="No conversation updates yet" body="Your conversations stay in Chat. This view only helps you pick up where something changed." /> : null}
      {tab === "Following" ? topicFollowingError ? <EmptyState title="Topic updates unavailable" body={topicFollowingError} /> : followedTopics.length ? <Rows>{followedTopics.map((item) => <li key={item.topic.id}><Link to="/topics/$slug" params={{ slug: item.topic.slug }} className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-elevated sm:px-5"><ContextIconTile><Sparkles className="size-[17px]" /></ContextIconTile><span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-medium">{item.topic.title}</span><span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{item.topic.replyCount} moderated {item.topic.replyCount === 1 ? "reply" : "replies"} · Updates {item.relationship.notificationPreference === "muted" ? "off" : "on"}</span></span></Link></li>)}</Rows> : <EmptyState title="No Topic follows yet" body="Follow a Topic to keep its updates attached to your Activity surface." /> : null}
      {tab === "System" ? systemUpdates.length ? <Rows>{systemUpdates.map((n) => <li key={n.id} className="px-4 py-5 sm:px-5"><div className="flex items-start gap-3"><ContextIconTile><Bell className="size-[17px]" /></ContextIconTile><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-[15px] font-medium">{n.title}</p>{!n.read ? <StatusPill tone="blue">Unread</StatusPill> : null}</div><p className="mt-1 text-[13.5px] leading-5 text-muted-foreground">{n.body}</p><NotificationSource notification={n} />{!n.read ? <div className="mt-3"><Action onClick={() => markRead(n.id)}>Mark as read</Action></div> : null}<p className="mt-1.5 text-[10.5px] text-muted-foreground">{n.when}</p></div></div></li>)}</Rows> : <EmptyState title="No system updates" body="Account, security and billing events will appear here when their connected event source provides them." /> : null}
    </section>
  </div>;
}
