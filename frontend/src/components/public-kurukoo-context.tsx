import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Bot,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Pause,
  Play,
  Plus,
  Search,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AuthMode } from "@/components/kurukoo/auth";
import {
  fetchCanonicalTopics,
  fetchSponsoredAds,
  type CanonicalTopic,
  type SponsoredAd,
} from "@/lib/kurukoo-api";
import { fetchCommunityStats, type CommunityStats } from "@/lib/community-topics-api";
import { getStoredKurukooRole, type KurukooRoleId } from "@/lib/kurukoo-personas";

const guideScenes = {
  general: [
    [
      "I need someone to fix my phone.",
      "Say what you need in plain language and start from there.",
      "Start with the need",
    ],
    [
      "Repair · location · options",
      "Kurukoo brings relevant options and context into view when available.",
      "See useful options",
    ],
    [
      "Example option · details when known",
      "Review what is known, then decide what you want to do.",
      "You decide",
    ],
    [
      "Request confirmed with your approval.",
      "The request stays connected to the work and follow-up.",
      "Keep it moving",
    ],
  ],
  provider: [
    [
      "I can repair iPhones this week.",
      "Tell Kurukoo what you genuinely provide and where you can help.",
      "Describe your service",
    ],
    [
      "Phone repair · location · availability",
      "Your eligible capability can become discoverable when you are ready.",
      "Be discoverable",
    ],
    [
      "A request needs your attention.",
      "Review the work, coordinate with the customer and keep the request moving.",
      "Manage work",
    ],
    [
      "Go Live is on.",
      "Nearby discovery reflects your current availability rather than a permanent promise.",
      "Stay current",
    ],
  ],
  contributor: [
    [
      "I know a useful local place.",
      "Share practical knowledge that helps the network become more useful.",
      "Share knowledge",
    ],
    [
      "A local Topic is gaining replies.",
      "Community context can help people understand what is happening around them.",
      "Add context",
    ],
    [
      "A contribution task is ready.",
      "Keep contribution work connected to the same Kurukoo relationship.",
      "Take part",
    ],
    [
      "Useful information added.",
      "The contribution can remain connected to the relevant task or conversation.",
      "Keep contributing",
    ],
  ],
  partner: [
    [
      "Connect our service to Kurukoo.",
      "Start with the capability or service you want to bring into the network.",
      "Start a connection",
    ],
    [
      "Capability · authorised connection",
      "Explore the supported connection path and its boundaries.",
      "See the path",
    ],
    [
      "A network demand signal appears.",
      "Understand where the service can add useful value before acting.",
      "Find demand",
    ],
    [
      "The partnership is moving.",
      "Keep coordination, work and authorised integrations connected.",
      "Keep it moving",
    ],
  ],
  advertiser: [
    [
      "Reach people who are ready for this.",
      "Start from relevant demand rather than a generic audience.",
      "Find relevance",
    ],
    [
      "Local demand · useful moment",
      "Explore the contexts where people are already looking or deciding.",
      "See the context",
    ],
    [
      "Sponsored discovery",
      "Commercial placements stay clearly labelled and separate from organic results.",
      "Stay transparent",
    ],
    [
      "A relevant offer is shown.",
      "Measure the useful outcome without turning the experience into an uncontrolled feed.",
      "Create value",
    ],
  ],
} as const;
const roleGuide: Record<KurukooRoleId, keyof typeof guideScenes> = {
  seeker: "general",
  provider: "provider",
  business: "general",
  creator: "general",
  contributor: "contributor",
  partner: "partner",
  advertiser: "advertiser",
  "local-agent": "general",
};

function SearchBox() {
  return (
    <form
      action="/explore"
      method="get"
      className="rounded-xl border border-border bg-surface p-2.5 shadow-[var(--shadow-soft)]"
    >
      <label htmlFor="public-context-search" className="sr-only">
        Search Kurukoo
      </label>
      <div className="flex items-center gap-2">
        <Search className="size-4 shrink-0 text-primary" />
        <input
          id="public-context-search"
          name="query"
          placeholder="Search Kurukoo"
          className="min-w-0 flex-1 bg-transparent text-[11.5px] outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          className="grid size-7 shrink-0 place-items-center rounded-lg bg-elevated text-muted-foreground hover:text-foreground"
          aria-label="Search"
        >
          <ArrowUpRight className="size-3.5" />
        </button>
      </div>
    </form>
  );
}

function PublicGuideCarousel({
  scenes,
  resourceSlug,
  roleLabel,
}: {
  scenes: readonly (readonly [string, string, string])[];
  resourceSlug: string;
  roleLabel?: string;
}) {
  const [slide, setSlide] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => setSlide(0), [scenes]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setSlide((value) => (value + 1) % scenes.length), 4200);
    return () => window.clearInterval(timer);
  }, [playing, scenes]);
  const scene = scenes[slide] ?? scenes[0]!;
  return (
    <div className="overflow-hidden rounded-[22px] border border-border bg-foreground text-background shadow-[var(--shadow-lift)]">
      <div className="relative aspect-[9/13] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_74%_18%,color-mix(in_oklch,var(--brand-tint)_70%,transparent),transparent_30%),linear-gradient(145deg,var(--foreground),color-mix(in_oklch,var(--foreground)_78%,var(--primary)))]" />
        <div className="absolute inset-x-3 top-3 flex items-center justify-between">
          <span className="rounded-full bg-background/15 px-2 py-1 text-[9px] font-semibold tracking-wide text-background/80 backdrop-blur">
            KURUKOO · VISUAL GUIDE
          </span>
          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            aria-label={playing ? "Pause guide" : "Play guide"}
            className="grid size-7 place-items-center rounded-full bg-background/15 backdrop-blur"
          >
            {playing ? <Pause className="size-3" /> : <Play className="ml-0.5 size-3" />}
          </button>
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground via-foreground/35 to-transparent px-3 pb-3 pt-24">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-background/55">
            {roleLabel ?? "Kurukoo"}
          </p>
          <p className="mt-1.5 text-[16px] font-semibold leading-tight text-background">
            {scene[0]}
          </p>
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-background/75">{scene[1]}</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[9.5px] font-semibold text-background">{scene[2]}</span>
            <div className="flex gap-1">
              {scenes.map((item, dot) => (
                <button
                  type="button"
                  key={item[0]}
                  onClick={() => setSlide(dot)}
                  aria-label={`Show guide step ${dot + 1}`}
                  className="h-1.5 w-6 overflow-hidden rounded-full bg-background/20"
                >
                  <span
                    className={
                      dot === slide
                        ? "block h-full w-full rounded-full bg-primary"
                        : "block h-full w-0"
                    }
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-background/10 px-3 py-2.5 text-background/65">
        <Link
          to="/resources/$slug"
          params={{ slug: resourceSlug }}
          className="min-w-0 truncate text-[9.5px] font-medium hover:text-background"
        >
          Read the guide
        </Link>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => setSlide((value) => (value - 1 + scenes.length) % scenes.length)}
            aria-label="Previous guide step"
            className="grid size-6 place-items-center rounded-full bg-background/10"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setSlide((value) => (value + 1) % scenes.length)}
            aria-label="Next guide step"
            className="grid size-6 place-items-center rounded-full bg-background/10"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

const activityItems = [
  ["Request", "A verified local provider is found", "example"],
  ["Explore", "A useful place is surfaced nearby", "example"],
  ["Opportunity", "A collaboration is surfaced proactively", "example"],
  ["Work", "A task moves into coordination", "example"],
  ["Topic", "A new discussion starts nearby", "example"],
  ["Creator", "A useful local guide is published", "example"],
] as const;
function PublicActivityFeed({
  signedIn,
  onOpenAuth,
}: {
  signedIn: boolean;
  onOpenAuth?: (mode: AuthMode) => void;
}) {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(
      () => setOffset((value) => (value + 1) % activityItems.length),
      3200,
    );
    return () => window.clearInterval(timer);
  }, []);
  const items = Array.from(
    { length: 4 },
    (_, index) => activityItems[(offset + index) % activityItems.length] ?? activityItems[0],
  );
  return (
    <section className="rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Zap className="size-[15px] text-primary" />
          <h2 className="text-[13px] font-semibold">Recent</h2>
        </div>
        <Link
          to={signedIn ? "/activity" : "/login"}
          onClick={(event) => {
            if (!signedIn) {
              event.preventDefault();
              onOpenAuth?.("login");
            }
          }}
          className="text-[9px] text-muted-foreground hover:text-foreground hover:underline"
        >
          My Activity
        </Link>
      </div>
      <p className="mt-1 text-[9.5px] text-muted-foreground">
        A preview of the kinds of updates Kurukoo can surface.
      </p>
      <div className="mt-2.5 space-y-2.5 overflow-hidden">
        {items.map(([type, text, time]) => (
          <div key={`${type}-${text}`} className="flex gap-2">
            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
            <p className="text-[10.5px] leading-snug">
              <span className="font-semibold">{type}</span> · {text}{" "}
              <span className="text-muted-foreground">· {time}</span>
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PublicRailAd() {
  const [ad, setAd] = useState<SponsoredAd | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchSponsoredAds()
      .then((campaigns) => {
        if (!cancelled) setAd(campaigns[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setAd(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!ad) return null;
  return (
    <a
      href={ad.clickUrl}
      rel="nofollow"
      aria-label="Sponsored promotion"
      className="relative block overflow-hidden rounded-2xl border border-border bg-surface"
    >
      {ad.image ? (
        <img
          src={ad.image}
          alt={ad.alt || ad.title}
          loading="lazy"
          className="block h-[92px] w-full object-cover"
        />
      ) : null}
      <span className="absolute left-2 top-2 rounded-full border border-white/30 bg-black/70 px-2 py-1 text-[9px] font-medium text-white backdrop-blur">
        {ad.disclosure || "Sponsored"}
      </span>
      {ad.image ? null : <p className="px-3 py-3 text-[11.5px] font-semibold">{ad.title}</p>}
    </a>
  );
}

function PublicAgentAdvert() {
  const agents = [
    {
      name: "Teme",
      role: "Customer service",
      description:
        "Deploy me as your customer service assistant and I can answer common questions, guide customers, capture requests and keep conversations moving.",
      href: "/profile/teme-ai",
    },
    {
      name: "Milo",
      role: "Sales assistant",
      description:
        "Deploy me to welcome prospects, explain what you offer, qualify enquiries and help customers take the next step.",
      href: "/profile/teme-ai",
    },
    {
      name: "Nia",
      role: "Operations assistant",
      description:
        "Deploy me to keep everyday requests organised, coordinate follow-ups and help your team move work toward completion.",
      href: "/profile/teme-ai",
    },
    {
      name: "Kito",
      role: "Bookings assistant",
      description:
        "Deploy me to handle booking enquiries, collect the details you need and help customers get to the right service.",
      href: "/profile/teme-ai",
    },
  ] as const;
  const [slide, setSlide] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setSlide((value) => (value + 1) % agents.length), 5000);
    return () => window.clearInterval(timer);
  }, [playing]);
  const agent = agents[slide] ?? agents[0];
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-foreground p-3 text-background shadow-[var(--shadow-soft)]">
      <div
        className="absolute -right-8 -top-8 size-24 rounded-full bg-primary/20 blur-2xl"
        aria-hidden="true"
      />
      <div className="relative">
        <div className="flex items-start justify-end">
          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            aria-label={playing ? "Pause agents" : "Play agents"}
            className="grid size-6 place-items-center rounded-full bg-background/10 text-background/70 hover:bg-background/15 hover:text-background"
          >
            {playing ? <Pause className="size-3" /> : <Play className="ml-0.5 size-3" />}
          </button>
        </div>
        <div className="mt-0.5 flex items-start justify-center gap-2">
          <h2 className="text-center text-[15px] font-semibold">Hi, I'm {agent.name}</h2>
          <span className="mt-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[7.5px] font-semibold uppercase tracking-wide text-primary">
            AI agent
          </span>
        </div>
        <div className="mt-3 flex justify-center">
          <span className="grid size-14 place-items-center rounded-full bg-background/10 ring-1 ring-background/15">
            <Bot className="size-7" />
          </span>
        </div>
        <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[9.5px] font-medium text-background/80">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          Available
        </div>
        <p className="mt-2 text-center text-[10px] leading-relaxed text-background/70">
          {agent.description}
        </p>
        <p className="mt-1 text-center text-[8.5px] text-background/45">{agent.role}</p>
        <Link
          to={agent.href}
          className="mt-3 inline-flex w-full items-center justify-between rounded-lg bg-background px-2.5 py-2 text-[9.5px] font-semibold text-foreground hover:bg-background/90"
        >
          <span>View {agent.name} profile</span>
          <ArrowUpRight className="size-3" />
        </Link>
        <div className="mt-2 flex items-center justify-center gap-1" aria-label="Agent carousel">
          {agents.map((item, index) => (
            <button
              key={item.name}
              type="button"
              onClick={() => setSlide(index)}
              aria-label={`Show ${item.name}`}
              className={`h-1.5 rounded-full transition-all ${index === slide ? "w-5 bg-primary" : "w-1.5 bg-background/25"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function TopicCommunityStats() {
  const [stats, setStats] = useState<CommunityStats | null>(null);
  useEffect(() => {
    void fetchCommunityStats()
      .then(setStats)
      .catch(() => undefined);
  }, []);
  const members = stats?.members ?? 1;
  const online = stats?.online ?? 1;
  const guests = stats?.guests ?? 1;
  return (
    <section className="mt-3 px-1" aria-label="Community statistics">
      <div className="flex items-center gap-2 px-1">
        <Users className="size-[14px] text-primary" />
        <h2 className="text-[13px] font-semibold">Community</h2>
      </div>
      <div className="mt-2 grid grid-cols-3 items-end gap-2 px-1">
        <div>
          <p className="text-[9px] text-muted-foreground">Members</p>
          <p className="mt-0.5 text-[13px] font-semibold tabular-nums">{members}</p>
        </div>
        <div>
          <p className="text-[9px] text-muted-foreground">Online</p>
          <p className="mt-0.5 text-[13px] font-semibold tabular-nums">{online}</p>
        </div>
        <div>
          <p className="text-[9px] text-muted-foreground">Guests</p>
          <p className="mt-0.5 text-[13px] font-semibold tabular-nums">{guests}</p>
        </div>
      </div>
    </section>
  );
}

function TopicsPeek() {
  const [topics, setTopics] = useState<CanonicalTopic[]>([]);
  useEffect(() => {
    void fetchCanonicalTopics(4)
      .then(setTopics)
      .catch(() => setTopics([]));
  }, []);
  return (
    <section className="rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-[15px] text-primary" />
          <h2 className="text-[13px] font-semibold">Topic context</h2>
        </div>
        <Link to="/topics" className="text-[9.5px] font-medium text-muted-foreground">
          See all
        </Link>
      </div>
      <Link
        to="/topics/create"
        className="mt-3 flex items-center justify-between rounded-xl border border-border bg-background px-2.5 py-2 text-[10.5px] font-medium"
      >
        <span className="flex items-center gap-1.5">
          <span className="grid size-5 place-items-center rounded-full bg-brand-tint text-brand-ink">
            <Plus className="size-3" />
          </span>
          Start a Topic
        </span>
        <ArrowUpRight className="size-3.5 text-muted-foreground" />
      </Link>
      <div className="mt-2 space-y-1">
        {topics.map((topic) => (
          <Link
            key={topic.id}
            to="/topics/$slug"
            params={{ slug: topic.slug }}
            className="flex items-center gap-2 rounded-xl px-1.5 py-1.5 hover:bg-elevated"
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-elevated text-muted-foreground">
              <MessageCircle className="size-3" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[10.5px] font-medium">{topic.title}</p>
              <p className="truncate text-[9px] text-muted-foreground">
                {topic.replyCount} {topic.replyCount === 1 ? "reply" : "replies"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function PublicContextRail({
  signedIn,
  onOpenAuth,
}: {
  signedIn: boolean;
  onOpenAuth?: (mode: AuthMode) => void;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [role, setRole] = useState(getStoredKurukooRole());
  useEffect(() => {
    const read = () => setRole(getStoredKurukooRole());
    window.addEventListener("kurukoo-role-changed", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("kurukoo-role-changed", read);
      window.removeEventListener("storage", read);
    };
  }, []);
  const guide = useMemo(() => {
    if (pathname.startsWith("/providers"))
      return { key: "provider" as const, resourceSlug: "provider-and-capability-guides" };
    if (pathname.startsWith("/contributors"))
      return { key: "contributor" as const, resourceSlug: "contributors-and-tasks" };
    if (pathname.startsWith("/partners"))
      return { key: "partner" as const, resourceSlug: "channels-and-connected-doors" };
    if (pathname.startsWith("/advertising"))
      return { key: "advertiser" as const, resourceSlug: "how-kurukoo-works" };
    return {
      key: roleGuide[role.id],
      resourceSlug: role.id === "provider" ? "provider-and-capability-guides" : "how-kurukoo-works",
    };
  }, [pathname, role.id]);
  const isTopics = pathname.startsWith("/topics");
  return (
    <aside
      aria-label="Public context rail"
      className="flex h-full min-w-0 flex-col overflow-y-auto bg-background/70 px-3 py-4"
    >
      <SearchBox />
      {isTopics ? <TopicCommunityStats /> : null}
      <section className="mt-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Play className="size-[14px] text-primary" />
            <h2 className="text-[13px] font-semibold">How to</h2>
          </div>
          <span className="text-[9px] text-muted-foreground">Visual guide</span>
        </div>
        <PublicGuideCarousel
          scenes={guideScenes[guide.key]}
          resourceSlug={guide.resourceSlug}
          roleLabel={role.title}
        />
      </section>
      <div className="mt-3">
        <PublicActivityFeed signedIn={signedIn} onOpenAuth={onOpenAuth} />
      </div>
      <div className="mt-3">
        <PublicAgentAdvert />
      </div>
      <div className="mt-3">
        <PublicRailAd />
      </div>
      {isTopics ? (
        <div className="mt-3">
          <TopicsPeek />
        </div>
      ) : null}
    </aside>
  );
}
