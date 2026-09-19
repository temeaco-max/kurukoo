import "@/components/kurukoo/field-surface.css";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  MapPin,
  MessageCircle,
  Play,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Composer } from "@/components/kurukoo/composer";
import { AskKurukoo } from "@/components/kurukoo/ask-kurukoo";
import { useKurukoo } from "@/lib/kurukoo-store";
import {
  fetchEconomicRequests,
  fetchProactiveFeed,
  fetchPulseReadiness,
  isKurukooApiConfigured,
  type EconomicRequest,
  type ProactiveOpportunity,
  type PulseReadiness,
} from "@/lib/kurukoo-api";
import { canonicalWorkItem } from "@/lib/work-projection";
import { entities, topics, videos, entityById } from "@/lib/kurukoo-demo";

const terminalStatuses = new Set(["completed", "cancelled", "abandoned", "disputed", "failed"]);
const attentionStatuses = new Set([
  "awaiting_approval",
  "awaiting_payment",
  "awaiting_confirmation",
]);

const contributorWisdom = [
  { text: "Small steps become big progress when you keep moving.", source: "Kurukoo contributor" },
  { text: "Clarity grows when you turn intention into action.", source: "Kurukoo contributor" },
  { text: "Do the next useful thing, then let the next step reveal itself.", source: "Kurukoo contributor" },
  { text: "Good work starts with a clear outcome and one honest next step.", source: "Kurukoo contributor" },
];

function getDailyWisdom() {
  const day = Math.floor(Date.now() / 86400000);
  return contributorWisdom[day % contributorWisdom.length];
}


type WeatherState = { temperature: number; label: string; location: string; icon: string } | null;

const weatherConditions: Record<number, { label: string; icon: string }> = {
  0: { label: "Clear", icon: "☀" },
  1: { label: "Mainly clear", icon: "🌤" },
  2: { label: "Partly cloudy", icon: "⛅" },
  3: { label: "Overcast", icon: "☁" },
  45: { label: "Foggy", icon: "🌫" },
  48: { label: "Foggy", icon: "🌫" },
  51: { label: "Drizzle", icon: "🌦" },
  53: { label: "Drizzle", icon: "🌦" },
  55: { label: "Drizzle", icon: "🌦" },
  56: { label: "Freezing drizzle", icon: "🌧" },
  57: { label: "Freezing drizzle", icon: "🌧" },
  61: { label: "Rain", icon: "🌧" },
  63: { label: "Rain", icon: "🌧" },
  65: { label: "Heavy rain", icon: "🌧" },
  66: { label: "Freezing rain", icon: "🌧" },
  67: { label: "Freezing rain", icon: "🌧" },
  71: { label: "Snow", icon: "🌨" },
  73: { label: "Snow", icon: "🌨" },
  75: { label: "Heavy snow", icon: "❄" },
  77: { label: "Snow grains", icon: "❄" },
  80: { label: "Showers", icon: "🌦" },
  81: { label: "Showers", icon: "🌦" },
  82: { label: "Heavy showers", icon: "🌧" },
  85: { label: "Snow showers", icon: "🌨" },
  86: { label: "Snow showers", icon: "🌨" },
  95: { label: "Thunderstorm", icon: "⛈" },
  96: { label: "Thunderstorm", icon: "⛈" },
  99: { label: "Thunderstorm", icon: "⛈" },
};

const timezoneFallbacks: Record<string, string> = {
  "Africa/Accra": "Accra",
  "Europe/London": "London",
  "Europe/Dublin": "Dublin",
  "Europe/Paris": "Paris",
  "Europe/Berlin": "Berlin",
  "Europe/Madrid": "Madrid",
  "America/New_York": "New York",
  "America/Chicago": "Chicago",
  "America/Los_Angeles": "Los Angeles",
  "Asia/Dubai": "Dubai",
  "Asia/Kolkata": "Kolkata",
  "Asia/Tokyo": "Tokyo",
};

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function FieldCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`field-card ${className}`}>{children}</section>;
}

function CardHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="field-card-heading">
      <div>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function StatusBadge({
  children,
  tone = "peach",
}: {
  children: ReactNode;
  tone?: "peach" | "green" | "gold";
}) {
  return <span className={`field-status field-status-${tone}`}>{children}</span>;
}

async function readProfileName() {
  try {
    const response = await fetch("/api/user/profile", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (response.ok) {
      const payload = (await response.json()) as {
        profile?: { name?: string; displayName?: string; firstName?: string };
      };
      const name =
        payload.profile?.name || payload.profile?.displayName || payload.profile?.firstName;
      if (name?.trim()) return name.trim();
    }
  } catch {
    /* use the local fallback below */
  }
  if (typeof window !== "undefined") {
    const localName = window.localStorage.getItem("kurukoo-profile-name")?.trim();
    if (localName) return localName;
  }
  return "there";
}

async function readWeather(): Promise<WeatherState> {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown timezone";
  const fallbackLocation = timezoneFallbacks[timezone] ?? timezone;
  if (!navigator.geolocation) return null;
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 6000,
        maximumAge: 900000,
      }),
    );
    const { latitude, longitude } = position.coords;
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&current=temperature_2m,weather_code&timezone=auto`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) throw new Error("weather request failed");
    const payload = (await response.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
      timezone?: string;
    };
    if (
      typeof payload.current?.temperature_2m !== "number" ||
      typeof payload.current.weather_code !== "number"
    )
      return null;
    const condition = weatherConditions[payload.current.weather_code] ?? {
      label: "Current conditions",
      icon: "☼",
    };
    const location = payload.timezone?.split("/").pop()?.replaceAll("_", " ") || fallbackLocation;
    return {
      temperature: Math.round(payload.current.temperature_2m),
      label: condition.label,
      icon: condition.icon,
      location,
    };
  } catch {
    return null;
  }
}

export function FieldDashboard() {
  const { work: localWork, notifications, send } = useKurukoo();
  const configured = isKurukooApiConfigured();
  const [requests, setRequests] = useState<EconomicRequest[]>([]);
  const [pulse, setPulse] = useState<PulseReadiness | null>(null);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState("");
  const [profileName, setProfileName] = useState("there");
  const [weather, setWeather] = useState<WeatherState>(null);
  const [now, setNow] = useState(() => new Date());
  const [topicTab, setTopicTab] = useState<"trending" | "new">("trending");
  const [opportunities, setOpportunities] = useState<ProactiveOpportunity[]>([]);
  const [opportunitiesError, setOpportunitiesError] = useState("");
  const unread = notifications.filter((notification) => !notification.read).length;
  const trustedPeople = entities.filter((entity) => entity.kind === "person").slice(0, 3);

  useEffect(() => {
    void readProfileName().then(setProfileName);
    void readWeather().then(setWeather);
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const items = await fetchProactiveFeed();
        if (cancelled) return;
        setOpportunities(items);
        setOpportunitiesError("");
      } catch (cause) {
        if (cancelled) return;
        setOpportunities([]);
        setOpportunitiesError(
          cause instanceof Error ? cause.message : "Opportunities could not be refreshed.",
        );
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [next, readiness] = await Promise.all([
          fetchEconomicRequests(),
          fetchPulseReadiness(),
        ]);
        if (!cancelled) {
          setRequests(next);
          setPulse(readiness);
          setError("");
        }
      } catch (cause) {
        if (!cancelled)
          setError(
            cause instanceof Error ? cause.message : "Your live Field could not be refreshed.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [configured]);

  const active = useMemo(
    () =>
      configured
        ? requests
            .filter((request) => !terminalStatuses.has(request.status))
            .map(canonicalWorkItem)
            .slice(0, 5)
        : localWork.filter((item) => item.stage !== "done").slice(0, 5),
    [configured, localWork, requests],
  );
  const needsYou = useMemo(
    () =>
      configured
        ? requests.filter((request) => attentionStatuses.has(request.status))
        : localWork.filter((item) => item.stage === "needs_you"),
    [configured, localWork, requests],
  );
  const visibleTopics = useMemo(
    () =>
      topicTab === "trending" ? [...topics].sort((a, b) => b.followers - a.followers) : topics,
    [topicTab],
  );
  const completedCount = useMemo(
    () =>
      configured
        ? requests.filter(
            (request) => request.status === "completed" || request.status === "fulfilled",
          ).length
        : localWork.filter((item) => item.stage === "done").length,
    [configured, localWork, requests],
  );
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown timezone";
  const fallbackLocation = timezoneFallbacks[timezone] ?? timezone;
  const dailyWisdom = getDailyWisdom();

  return (
    <div className="kurukoo-field min-w-0 pb-10">
      <section className="field-welcome" aria-labelledby="field-title">
        <div className="field-welcome-copy">
          <p className="field-kicker field-welcome-meta">
            {greeting(now.getHours())}, {profileName}
            <span className="field-welcome-separator" aria-hidden="true" />
            <span className="field-weather">
              <span className="field-sun" aria-hidden="true">
                {weather?.icon ?? "☼"}
              </span>
              <strong>{weather ? `${weather.temperature}°C` : "Weather unavailable"}</strong>
              <span>•</span>
              <span>{weather?.location ?? fallbackLocation}</span>
            </span>
          </p>
          <h1 id="field-title">Your field</h1>
          <div className="field-daily-wisdom" aria-live="polite"><p className="field-daily-wisdom-text">{dailyWisdom.text}</p><span className="field-daily-wisdom-source">— {dailyWisdom.source}</span></div>
        </div>
        <div className="field-welcome-meta">
          <div className="field-date">
            <CalendarDays className="size-4" />
            <span>
              {now.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="field-notification">
              <Bell className="size-4" />
              {unread ? unread : ""}
            </span>
          </div>
        </div>
        <div className="field-horizon" aria-hidden="true">
          <span className="field-horizon-sun" />
          <span className="field-horizon-city" />
          <span className="field-horizon-water" />
        </div>
      </section>

      <div className="field-creator-slot-row" aria-label="Creator and account cards">
        <div className="field-creator-slot" aria-hidden="true" />
        <FieldCard className="field-creator-slot field-account-card">
          <CardHeading title="Points" />
          <div className="field-account-value">Not available</div>
          <p className="field-account-note">No canonical Points balance is exposed yet.</p>
          <div className="field-card-actions">
            <Link to="/wallet" className="field-card-action">View <ArrowRight className="size-3.5" /></Link>
            <Link to="/wallet" className="field-card-action">Top up <ArrowRight className="size-3.5" /></Link>
          </div>
        </FieldCard>
        <FieldCard className="field-creator-slot field-account-card">
          <CardHeading title="Wallet balance" />
          <div className="field-account-value">Not available</div>
          <p className="field-account-note">No canonical wallet balance is exposed yet.</p>
          <div className="field-card-actions">
            <Link to="/wallet" className="field-card-action">View <ArrowRight className="size-3.5" /></Link>
          </div>
        </FieldCard>
        <FieldCard className="field-creator-slot field-creator-activity-card">
          <CardHeading title="Activity summary" />
          <div className="activity-summary-grid">
            <div><strong>{completedCount}</strong><span>Tasks completed</span></div>
            <div><strong>{active.length}</strong><span>In motion</span></div>
          </div>
          <div className="field-card-actions">
            <Link to="/activity" className="field-card-action">View <ArrowRight className="size-3.5" /></Link>
          </div>
        </FieldCard>
      </div>

      <section className="field-creators-card">
        <CardHeading
          eyebrow="From creators"
          title="Useful things to watch"
          action={
            <Link to="/videos" className="field-card-action">
              See all videos <ArrowRight className="size-3.5" />
            </Link>
          }
        />
        <div className="field-video-scroller">
          {videos.map((video) => {
            const creator = entityById(video.creatorId);
            return (
              <Link
                key={video.id}
                to="/videos/$videoId"
                params={{ videoId: video.id }}
                className="field-video-card"
              >
                <span className="field-video-thumb">
                  <Play className="size-5" />
                  <small>{video.duration}</small>
                </span>
                <span className="field-video-copy">
                  <strong>{video.title}</strong>
                  <small>
                    {creator?.name ?? "Kurukoo creator"} · {video.views} views
                  </small>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {error ? (
        <div role="alert" className="field-inline-alert">
          <CircleAlert className="size-4 shrink-0" />
          Live Field data could not be refreshed. No provider, payment or execution state is being
          inferred.
        </div>
      ) : null}

      <section className="field-main-grid" aria-label="Your day">
        <FieldCard className="field-requests-card">
          <CardHeading
            eyebrow="In motion"
            title="Active requests"
            action={
              <Link to="/work" className="field-card-action">
                View all <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          {loading ? (
            <div className="field-loading">
              <span />
              <span />
              <span />
            </div>
          ) : active.length ? (
            <div className="field-request-list">
              {active.slice(0, 4).map((item, index) => (
                <Link
                  key={item.id}
                  to="/work/$workId"
                  params={{ workId: item.id }}
                  className="field-request-row"
                >
                  <span className={`field-request-icon field-request-icon-${index % 3}`}>
                    <CheckCircle2 className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </span>
                  <StatusBadge tone={index === 0 ? "peach" : "green"}>
                    {index === 0 ? "In motion" : "Scheduled"}
                  </StatusBadge>
                </Link>
              ))}
            </div>
          ) : (
            <div className="field-empty">
              <MessageCircle className="size-5" />
              <p>Nothing is in motion yet.</p>
              <small>Start in Chat when you want Kurukoo to coordinate something.</small>
              <AskKurukoo prompt="Help me get something done today">Start something</AskKurukoo>
            </div>
          )}
          {needsYou.length ? (
            <div className="field-card-footer">
              <span>
                <strong>{needsYou.length} waiting</strong> for your decision
              </span>
              <Link to="/activity">
                Review <ArrowRight className="size-3.5" />
              </Link>
            </div>
          ) : null}
        </FieldCard>

        <FieldCard className="field-flow-card">
          <CardHeading
            eyebrow="Today"
            title="Today's flow"
            action={
              <Link to="/activity" className="field-card-action">
                Full day <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <div className="field-timeline">
            <div className="field-timeline-item is-active">
              <span>08:00</span>
              <i className="field-timeline-dot" />
              <div>
                <strong>Focus time</strong>
                <small>Deep work</small>
              </div>
            </div>
            <div className="field-timeline-item">
              <span>11:00</span>
              <i className="field-timeline-dot" />
              <div>
                <strong>Delivery window</strong>
                <small>Market items to Osu</small>
              </div>
            </div>
            <div className="field-timeline-item">
              <span>13:00</span>
              <i className="field-timeline-dot" />
              <div>
                <strong>Lunch break</strong>
                <small>Recharge</small>
              </div>
            </div>
            <div className="field-timeline-item">
              <span>18:30</span>
              <i className="field-timeline-dot" />
              <div>
                <strong>Call Mum</strong>
                <small>Check in and catch up</small>
              </div>
            </div>
            <div className="field-timeline-item">
              <span>20:00</span>
              <i className="field-timeline-dot" />
              <div>
                <strong>Personal time</strong>
                <small>Read and reflect</small>
              </div>
            </div>
          </div>
        </FieldCard>

        <div className="field-side-stack">
          <FieldCard className="field-agent-card">
            <CardHeading
              eyebrow="With a little help"
              title="Agent-assisted next steps"
              action={<span className="field-count">2</span>}
            />
            <Link to="/work" className="field-agent-row">
              <span className="field-agent-icon">
                <Sparkles className="size-4" />
              </span>
              <span>
                <strong>Prepare for client call</strong>
                <small>Continue this work</small>
              </span>
              <ArrowRight className="size-3.5" />
            </Link>
            <Link to="/work" className="field-agent-row">
              <span className="field-agent-icon field-agent-icon-green">
                <CheckCircle2 className="size-4" />
              </span>
              <span>
                <strong>Grocery top-up</strong>
                <small>Continue this work</small>
              </span>
              <ArrowRight className="size-3.5" />
            </Link>
            <Link to="/agents" className="field-see-all">
              See all suggestions <ArrowRight className="size-3.5" />
            </Link>
          </FieldCard>
          <FieldCard className="field-people-card">
            <CardHeading
              title="Trusted people"
              action={
                <Link to="/connect" className="field-card-action">
                  Manage <ArrowRight className="size-3.5" />
                </Link>
              }
            />
            <div className="field-people-list">
              {trustedPeople.map((person) => (
                <Link
                  key={person.id}
                  to="/profile/$entityId"
                  params={{ entityId: person.id }}
                  className="field-person-row"
                >
                  <span className="field-person field-person-a" aria-hidden="true">
                    {person.name.slice(0, 1)}
                  </span>
                  <span>
                    <strong>{person.name}</strong>
                    <small>{person.tagline}</small>
                  </span>
                </Link>
              ))}
            </div>
          </FieldCard>
        </div>
      </section>

      <section className="field-topics-split">
        <section className="field-topics-card">
          <CardHeading
            eyebrow="Your Topics"
            title="What is useful around you"
            action={
              <Link to="/topics" className="field-card-action">
                Open Topics <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <div className="field-tabs" role="tablist" aria-label="Topic view">
            <button
              type="button"
              role="tab"
              aria-selected={topicTab === "trending"}
              onClick={() => setTopicTab("trending")}
            >
              Trending
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={topicTab === "new"}
              onClick={() => setTopicTab("new")}
            >
              New
            </button>
          </div>
          <div className="field-topic-list">
            {visibleTopics.map((topic) => (
              <Link
                key={topic.slug}
                to="/topics/$slug"
                params={{ slug: topic.slug }}
                className="field-topic-row"
              >
                <span>
                  <strong>{topic.name}</strong>
                  <small>{topic.blurb}</small>
                </span>
                <span className="field-topic-meta">
                  {topic.followers.toLocaleString()} following <ArrowRight className="size-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
        <FieldCard className="field-earnings-card">
          <CardHeading
            eyebrow="Earnings"
            title="Your earning activity"
            action={
              <Link to="/opportunities" className="field-card-action">
                See all <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <div className="field-metric-list">
            <div className="field-metric-row">
              <span>
                <strong>Tasks completed</strong>
                <small>Requests Kurukoo saw through</small>
              </span>
              <span className="field-metric-value">{completedCount}</span>
            </div>
            <div className="field-metric-row">
              <span>
                <strong>In motion</strong>
                <small>Still being coordinated</small>
              </span>
              <span className="field-metric-value">{active.length}</span>
            </div>
            <div className="field-metric-row">
              <span>
                <strong>Points</strong>
                <small>No canonical Points balance is exposed yet</small>
              </span>
              <span className="field-metric-muted">Not available</span>
            </div>
          </div>
          <div className="field-subhead">
            <strong className="field-subhead-title">Opportunities</strong>
            <span className="field-count">{opportunities.length}</span>
          </div>
          {opportunities.length ? (
            <div className="field-opportunity-list">
              {opportunities.slice(0, 3).map((item) => (
                <Link key={item.id} to={item.ctaLink as never} className="field-opportunity-row">
                  <span className="field-opportunity-icon">
                    <Sparkles className="size-4" />
                  </span>
                  <span className="grid min-w-0 flex-1 gap-[3px]">
                    <strong>{item.title}</strong>
                    <small>{item.subtitle}</small>
                  </span>
                  <ArrowRight className="size-3.5" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="field-empty field-empty-compact">
              <Sparkles className="size-5" />
              <p>No opportunities right now.</p>
              <small>Relevant ways to earn or take part will appear here.</small>
            </div>
          )}
          {opportunitiesError ? (
            <p className="field-note">Opportunities could not be refreshed right now.</p>
          ) : null}
        </FieldCard>
      </section>

      <section className="field-lower-grid">
        <FieldCard>
          <CardHeading
            title="Nearby pulse"
            action={
              <Link to="/discover" className="field-card-action">
                See nearby <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <div className="field-lower-content">
            <span className="field-lower-icon field-lower-icon-green">
              <MapPin className="size-5" />
            </span>
            <div>
              <strong>
                {pulse?.active ? "You are available nearby" : "Local context when it is available"}
              </strong>
              <small>
                {pulse?.active
                  ? "Your Nearby Pulse presence is active."
                  : pulse?.eligibleToBroadcast
                    ? "You can choose to broadcast availability."
                    : "Nearby Pulse is waiting on the readiness boundary."}
              </small>
            </div>
          </div>
        </FieldCard>
        <FieldCard>
          <CardHeading
            title="Safety state"
            action={
              <Link to="/trust" className="field-card-action">
                Review <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <div className="field-lower-content">
            <span className="field-lower-icon field-lower-icon-gold">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <strong>Trust and permissions stay explicit</strong>
              <small>Review before any consequential action.</small>
            </div>
          </div>
        </FieldCard>
        <FieldCard>
          <CardHeading
            title="Task focus"
            action={
              <Link to="/work" className="field-card-action">
                Open <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <div className="field-lower-content">
            <span className="field-lower-icon">
              <Clock3 className="size-5" />
            </span>
            <div>
              <strong>{active[0]?.title ?? "Nothing is in motion"}</strong>
              <small>{active[0]?.detail ?? "Your next action will appear here."}</small>
            </div>
          </div>
        </FieldCard>
      </section>

      <section className="field-composer-card field-composer-card-bottom" aria-label="Ask Kurukoo">
        <div className="field-composer-label">
          <span>What needs your attention?</span>
          <span className="field-composer-hint">Tell Kurukoo in your own words</span>
        </div>
        <Composer onSend={send} placeholder="Ask Kurukoo to get something done…" />
      </section>

      {!configured ? (
        <div className="field-preview-note">
          Development preview: the live backend is not configured in this frontend session. Local
          Work data may appear, but no external provider, payment, availability or fulfilment
          outcome is represented as real.
        </div>
      ) : null}
    </div>
  );
}
