import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Brain,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Compass,
  MapPin,
  MessageSquare,
  Sparkles,
  Tags,
  Target,
  Wallet,
  Zap,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useKurukoo } from "@/lib/kurukoo-store";
import { fetchPulseReadiness, type PulseReadiness } from "@/lib/kurukoo-api";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };
type Icon = typeof Sparkles;
const shortcuts: Array<{ label: string; to: string; icon: Icon }> = [
  { label: "For You", to: "/", icon: Sparkles },
  { label: "Nearby Radar", to: "/discover", icon: MapPin },
  { label: "Availability", to: "/discover", icon: Zap },
  { label: "Current work", to: "/work", icon: Briefcase },
  { label: "Memory", to: "/memory", icon: Brain },
  { label: "Attention", to: "/activity", icon: Bell },
  { label: "Topics", to: "/topics", icon: Tags },
  { label: "Opportunities", to: "/opportunities", icon: Target },
  { label: "Explore", to: "/explore", icon: Compass },
  { label: "Messages", to: "/messages", icon: MessageSquare },
  { label: "Wallet", to: "/wallet", icon: Wallet },
];
function Row({
  icon: Icon,
  title,
  detail,
  to,
  live,
}: {
  icon: Icon;
  title: string;
  detail: string;
  to?: string;
  live?: boolean;
}) {
  const content = (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl px-1.5 py-1.5">
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full",
          live ? "bg-brand-tint text-brand-ink" : "bg-elevated text-muted-foreground",
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11.5px] font-medium">{title}</span>
        <span className="block truncate text-[10px] text-muted-foreground">{detail}</span>
      </span>
    </div>
  );
  return to ? (
    <Link to={to as never} className="block rounded-xl hover:bg-elevated">
      {content}
    </Link>
  ) : (
    content
  );
}
function Section({
  title,
  icon: Icon,
  to,
  children,
}: {
  title: string;
  icon: Icon;
  to: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
          <h2 className="truncate text-[12.5px] font-semibold">{title}</h2>
        </div>
        <Link to={to as never} className="text-[10px] text-muted-foreground hover:text-foreground">
          Open
        </Link>
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}
export function TrustedContextRail({ open, onOpenChange }: Props) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { work, memory, notifications } = useKurukoo();
  const [readiness, setReadiness] = useState<PulseReadiness | null>(null);
  const focus = work.find((item) => item.stage !== "done");
  const unread = notifications.filter((item) => !item.read).length;
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      void fetchPulseReadiness()
        .then((value) => {
          if (!cancelled) setReadiness(value);
        })
        .catch(() => {
          if (!cancelled) setReadiness(null);
        });
    load();
    const timer = window.setInterval(load, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);
  const live = Boolean(readiness?.active);
  const currentWork = focus ? (
    <Row
      icon={Target}
      title={focus.title}
      detail={focus.stage === "needs_you" ? "Needs you" : "In progress"}
      to={`/work/${focus.id}`}
    />
  ) : (
    <p className="px-1.5 py-2 text-[10px] text-muted-foreground">Nothing in motion.</p>
  );
  const openContent = (
    <>
      <Section title="Trusted context" icon={Brain} to="/memory">
        <Row icon={Sparkles} title="For You" detail="Personal operating view" to="/" />
        <Row
          icon={Briefcase}
          title="Current work"
          detail={focus?.title ?? "No active work"}
          to="/work"
        />
        <Row
          icon={Brain}
          title={memory.length ? "Active memory" : "Memory ready"}
          detail="Private continuity"
          to="/memory"
        />
      </Section>
      <Section title="Nearby Radar" icon={MapPin} to="/discover">
        <Row
          icon={MapPin}
          title="Nearby"
          detail="People, places, offers and live activity"
          to="/discover"
        />
        <Row
          icon={Zap}
          title="Radar"
          detail={live ? "Your Pulse is live" : "Local attention layer"}
          live
          to="/discover"
        />
      </Section>
      <Section title="Attention" icon={Bell} to="/activity">
        <Row
          icon={Bell}
          title={unread ? `${unread} unread` : "Caught up"}
          detail="What needs your attention"
          to="/activity"
        />
      </Section>
      <Section title="Topics & opportunity" icon={Tags} to="/topics">
        <Row
          icon={Tags}
          title="Community Topics"
          detail="Context, not fulfilment proof"
          to="/topics"
        />
        <Row
          icon={Target}
          title="Opportunities"
          detail="Useful ways to participate"
          to="/opportunities"
        />
      </Section>
    </>
  );
  return (
    <aside
      aria-label="Trusted context rail"
      className={cn(
        "relative z-40 min-h-0 h-full hidden bg-surface lg:flex lg:flex-col border-l border-border",
        open ? "w-[224px] px-3 py-4" : "w-[48px] px-1.5 py-4",
      )}
    >
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label={open ? "Close trusted context" : "Open trusted context"}
        title={open ? "Close trusted context" : "Open trusted context"}
        className="absolute left-0 top-5 z-[80] grid size-9 -translate-x-1/2 place-items-center rounded-full border border-border bg-surface text-muted-foreground shadow-[var(--shadow-soft)] hover:bg-elevated"
      >
        {open ? (
          <ChevronRight className="size-[17px]" strokeWidth={1.8} />
        ) : (
          <ChevronLeft className="size-[17px]" strokeWidth={1.8} />
        )}
      </button>
      {open ? (
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none space-y-3 pt-1">
          {openContent}
        </div>
      ) : (
        <nav
          aria-label="Trusted context shortcuts"
          className="mt-10 flex min-h-0 flex-1 flex-col items-center gap-1 py-1"
        >
          {shortcuts.map(({ label, to, icon: Icon }) => (
            <Link
              key={label}
              to={to as never}
              aria-label={label}
              title={label}
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-xl",
                (to === "/" ? pathname === "/" : pathname.startsWith(to))
                  ? "bg-elevated text-foreground"
                  : "text-muted-foreground hover:bg-elevated",
              )}
            >
              <Icon className="size-[17px]" strokeWidth={1.8} />
            </Link>
          ))}
        </nav>
      )}
    </aside>
  );
}
