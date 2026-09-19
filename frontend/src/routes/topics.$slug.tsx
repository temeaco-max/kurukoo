import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowUpRight,
  BellOff,
  BellRing,
  Check,
  Copy,
  Flag,
  MessageCircle,
  RefreshCw,
  Share2,
  ShieldCheck,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { EmptyState, PageHeader } from "@/components/app-shell";
import { AdSlot } from "@/components/kurukoo/ui";
import { IntegrationGap } from "@/components/kurukoo/primitives";
import {
  fetchCanonicalTopic,
  fetchTopicRelationship,
  followCanonicalTopic,
  reportCanonicalTopic,
  setTopicNotificationPreference,
  submitCanonicalReply,
  unfollowCanonicalTopic,
  type CanonicalTopic,
  type CanonicalTopicRelationship,
} from "@/lib/kurukoo-api";
import { fetchTopicChatContext, reportTopicReply, typeGuidance } from "@/lib/topic-lifecycle";
import { useKurukoo } from "@/lib/kurukoo-store";

export const Route = createFileRoute("/topics/$slug")({
  head: () => ({
    meta: [
      { title: "Topic — Kurukoo" },
      {
        name: "description",
        content:
          "Community context, moderated discussion and useful Kurukoo pathways around one subject.",
      },
      { property: "og:title", content: "Kurukoo Topic" },
      {
        property: "og:description",
        content: "Public community context, moderated discussion and useful Kurukoo pathways.",
      },
    ],
  }),
  component: TopicPage,
});
function pretty(value: string) {
  return value.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function isPublic(topic: CanonicalTopic) {
  return (
    topic.publishedAt !== null ||
    ["public", "published", "active"].includes(topic.status.toLowerCase())
  );
}
function TopicShare({ topic }: { topic: CanonicalTopic }) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const path = `/topics/${topic.slug}`;
  async function copyLink() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(
        typeof window === "undefined" ? path : `${window.location.origin}${path}`,
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }
  async function share() {
    if (!isPublic(topic)) return;
    const url = typeof window === "undefined" ? path : `${window.location.origin}${path}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: topic.title, text: topic.body, url });
        setShared(true);
        window.setTimeout(() => setShared(false), 1600);
      } catch {
        /* ignore */
      }
    } else await copyLink();
  }
  if (!isPublic(topic)) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => void share()}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[12px] font-medium hover:bg-elevated"
      >
        <Share2 className="size-3.5" />
        {shared ? "Shared" : "Share"}
      </button>
      <button
        type="button"
        onClick={() => void copyLink()}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[12px] text-muted-foreground hover:bg-elevated"
      >
        <Copy className="size-3.5" />
        {copied ? "Link copied" : "Copy link"}
      </button>
      {copied ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Check className="size-3.5" />
          Ready to share
        </span>
      ) : null}
    </div>
  );
}

function TopicPage() {
  const { slug } = Route.useParams();
  const { send } = useKurukoo();
  const navigate = useNavigate();
  const [topic, setTopic] = useState<CanonicalTopic | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState("");
  const [relationship, setRelationship] = useState<CanonicalTopicRelationship | null>(null);
  const [relationshipAvailable, setRelationshipAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  async function load(refresh = false) {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const next = await fetchCanonicalTopic(slug);
      setTopic(next);
      try {
        setRelationship(await fetchTopicRelationship(next.id));
        setRelationshipAvailable(true);
      } catch {
        setRelationship(null);
        setRelationshipAvailable(false);
      }
    } catch (error) {
      setTopic(null);
      setStatus(error instanceof Error ? error.message : "This Topic is unavailable.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }
  useEffect(() => {
    void load();
  }, [slug]);
  async function handleReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!topic || !reply.trim()) return;
    setStatus("Submitting for review…");
    try {
      await submitCanonicalReply(topic.id, reply.trim());
      setReply("");
      setStatus("Reply submitted for review. It will appear after moderation.");
      await load(true);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to submit reply");
    }
  }
  async function handleReplyReport(id: string) {
    const reason = window.prompt(
      "Why does this reply need review? For example: safety, privacy, harassment, impersonation, or misinformation.",
    );
    if (!reason?.trim()) return;
    try {
      await reportTopicReply(id, reason.trim());
      setStatus("Reply reported for review.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to report reply");
    }
  }
  async function handleFollow() {
    if (!topic || !relationshipAvailable) return;
    setBusy(true);
    try {
      if (relationship) {
        await unfollowCanonicalTopic(topic.id);
        setRelationship(null);
      } else setRelationship(await followCanonicalTopic(topic.id));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to update Topic follow status");
    } finally {
      setBusy(false);
    }
  }
  async function handleMute() {
    if (!topic || !relationship) return;
    setBusy(true);
    try {
      setRelationship(
        await setTopicNotificationPreference(
          topic.id,
          relationship.notificationPreference === "muted" ? "all" : "muted",
        ),
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to update Topic updates");
    } finally {
      setBusy(false);
    }
  }
  async function handleReport() {
    if (!topic) return;
    const reason = window.prompt("Why does this Topic need review?");
    if (!reason?.trim()) return;
    try {
      await reportCanonicalTopic(topic.id, reason.trim());
      setStatus("Topic reported for review.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to report Topic");
    }
  }
  async function askKurukoo() {
    if (!topic) return;
    try {
      const context = await fetchTopicChatContext(slug);
      send(
        `Use this canonical Topic as community context. Do not treat it as fulfilment proof. Help me understand what is useful, what is uncertain, and whether there is a verified next step.\nTitle: ${context.title}\nType: ${context.type}\nCategory: ${context.category ?? "none"}\nLocation: ${[context.city, context.lga].filter(Boolean).join(" · ") || "none"}\nBody: ${context.body}`,
      );
    } catch {
      send(
        `Help me understand the community context around this Topic: ${topic.title}. Separate what is useful from what is uncertain, and tell me what verified next step I could take.`,
      );
    }
    navigate({ to: "/chat" });
  }
  if (loading)
    return (
      <div
        className="h-96 animate-pulse rounded-[24px] border border-border bg-surface"
        aria-label="Loading Topic"
      />
    );
  if (!topic)
    return (
      <>
        <PageHeader title="Topic" />
        <EmptyState
          title="Topic not found"
          body={status || "Browse public Topics to find community context."}
        />
        <Link to="/topics" className="mt-4 inline-flex items-center gap-1.5 underline text-[14px]">
          <ArrowLeft className="size-3.5" /> All Topics
        </Link>
      </>
    );
  const following = Boolean(relationship);
  const muted = relationship?.notificationPreference === "muted";
  const locality = [topic.city, topic.lga].filter(Boolean).join(" · ");
  return (
    <div className="w-full max-w-4xl">
      <Link
        to="/topics"
        className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Topics
      </Link>
      <section className="mt-4 max-w-3xl">
        <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
          <span className="rounded-full bg-elevated px-2 py-1 font-medium text-foreground/80">
            {pretty(topic.type)}
          </span>
          {topic.category ? (
            <span className="rounded-full bg-elevated px-2 py-1">{pretty(topic.category)}</span>
          ) : null}
          {locality ? <span className="rounded-full bg-elevated px-2 py-1">{locality}</span> : null}
        </div>
        <h1 className="mt-3 font-serif text-[40px] leading-[1.04] tracking-[-0.045em] md:text-[52px]">
          {topic.title}
        </h1>
        <p className="mt-4 text-[15.5px] leading-relaxed text-muted-foreground">
          Shared by {topic.authorLabel}. Community context can inform people, but it does not verify
          providers, prices, stock, availability, booking, payment or delivery.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {relationshipAvailable ? (
            <button
              type="button"
              onClick={() => void handleFollow()}
              disabled={busy}
              className="inline-flex min-h-9 items-center rounded-lg border border-border px-3.5 text-[12.5px] font-medium hover:bg-elevated disabled:opacity-50"
            >
              {following ? "Following" : "Follow Topic"}
            </button>
          ) : null}
          {following ? (
            <button
              type="button"
              onClick={() => void handleMute()}
              disabled={busy}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[12px] text-muted-foreground hover:bg-elevated disabled:opacity-50"
            >
              {muted ? <BellRing className="size-3.5" /> : <BellOff className="size-3.5" />}
              {muted ? "Unmute updates" : "Mute updates"}
            </button>
          ) : null}
          <span className="text-[11.5px] text-muted-foreground">
            {topic.replyCount} {topic.replyCount === 1 ? "moderated reply" : "moderated replies"}
          </span>
          <TopicShare topic={topic} />
        </div>
      </section>
      <section className="mt-6 rounded-[20px] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-elevated">
            <ShieldCheck className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium">{pretty(topic.type)} · community context</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
              {typeGuidance(topic.type)} Community content remains separate from Kurukoo's verified
              fulfilment layer.
            </p>
          </div>
        </div>
        {topic.type === "poll" ? (
          <p className="mt-3 text-[11.5px] text-muted-foreground">
            Voting is not shown because the canonical Topic service does not currently provide vote
            persistence.
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void askKurukoo()}
          className="mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[12.5px] font-medium text-primary-foreground hover:opacity-90"
        >
          Ask Kurukoo about this Topic <ArrowUpRight className="size-3.5" />
        </button>
      </section>
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-medium text-muted-foreground">Community discussion</p>
            <h2 className="mt-1 text-[20px] font-semibold tracking-tight">
              What people are saying
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[12px] text-muted-foreground hover:bg-elevated disabled:opacity-50"
          >
            <RefreshCw className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} /> Refresh
          </button>
        </div>
        <div className="space-y-3">
          <article className="rounded-[18px] border border-border bg-surface p-5">
            <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
              <MessageCircle className="size-3.5" /> Topic statement · {topic.authorLabel}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-[14.5px] leading-relaxed">{topic.body}</p>
            <p className="mt-3 text-[11.5px] text-muted-foreground">
              Community statement · not independently verified
            </p>
          </article>
          {topic.replies?.length ? (
            topic.replies.map((item) => (
              <article key={item.id} className="rounded-[18px] border border-border bg-surface p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
                    <MessageCircle className="size-3.5" /> {item.authorLabel}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleReplyReport(item.id)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-elevated"
                    aria-label="Report reply"
                  >
                    <Flag className="size-3.5" />
                  </button>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed">{item.body}</p>
                <p className="mt-3 text-[11.5px] text-muted-foreground">
                  Moderated reply · community context
                </p>
              </article>
            ))
          ) : (
            <div className="rounded-[18px] border border-dashed border-border p-5 text-[13px] text-muted-foreground">
              No moderated replies yet. This stays quiet rather than being padded with synthetic
              activity.
            </div>
          )}
        </div>
      </section>
      <section className="mt-6 rounded-[20px] border border-border bg-surface p-5">
        <div className="flex items-start gap-3">
          <MessageCircle className="mt-0.5 size-4 text-muted-foreground" />
          <div>
            <p className="text-[13px] font-medium">Add useful context</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Replies are reviewed before they become public. Do not post private contact details,
              precise addresses or unsupported claims.
            </p>
          </div>
        </div>
        <form onSubmit={handleReply} className="mt-4">
          <textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="What have you learned, experienced or discovered?"
            className="w-full resize-y rounded-xl border border-border bg-background p-3 text-[13px] outline-none ring-primary/30 placeholder:text-muted-foreground focus:ring-2"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11.5px] text-muted-foreground" aria-live="polite">
              {status}
            </span>
            <button
              type="submit"
              disabled={!reply.trim()}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3.5 text-[12.5px] font-medium hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
            >
              Submit reply for review <ArrowUpRight className="size-3.5" />
            </button>
          </div>
        </form>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void handleReport()}
            className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground"
          >
            <Flag className="size-3.5" /> Report Topic
          </button>
          <TopicShare topic={topic} />
        </div>
      </section>
      {topic.relatedResources?.length ? (
        <section className="mt-8">
          <p className="text-[12px] font-medium text-muted-foreground">Editorial context</p>
          <h2 className="mt-1 text-[20px] font-semibold tracking-tight">
            Related Kurukoo resources
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {topic.relatedResources.map((resource) => (
              <Link
                key={resource.slug}
                to="/explore"
                className="rounded-[18px] border border-border bg-surface p-4 hover:bg-elevated/50"
              >
                <p className="text-[14px] font-medium">{resource.title}</p>
                <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                  Explore Kurukoo for the relevant discovery context.
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      <div className="mt-8">
        <AdSlot
          placement="Topic feed"
          headline="Relevant sponsored discovery"
          body="Sponsored placements stay visually separate from community discussion and are not evidence of availability."
          advertiser="Sponsored placement"
        />
      </div>
      <IntegrationGap>
        Topic discussion is community context. Kurukoo's verified discovery and fulfilment layers
        remain the source of truth for real-world action.
      </IntegrationGap>
    </div>
  );
}
