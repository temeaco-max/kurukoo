import { Sparkles, Tag, Calendar } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { RecommendationCard } from "@/components/kurukoo/cards";
import { Panel, SectionHeader } from "@/components/kurukoo/ui";
import { fetchDailyPick, type DailyPick } from "@/lib/kurukoo-api";
import { isKurukooApiConfigured } from "@/lib/kurukoo-api";
import { useKurukoo } from "@/lib/kurukoo-store";

export function DailyPicksStrip() {
  const { send } = useKurukoo();
  const [pick, setPick] = useState<DailyPick | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isKurukooApiConfigured()) return;
    let cancelled = false;
    setLoading(true);
    fetchDailyPick()
      .then((p) => { if (!cancelled) setPick(p); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (!isKurukooApiConfigured()) return null;

  return (
    <Panel className="overflow-hidden p-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/70">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <span className="text-[12.5px] font-medium">Today's pick</span>
        </div>
        <button
          type="button"
          onClick={() => void fetchDailyPick().then(setPick)}
          className="text-[10.5px] text-muted-foreground hover:text-foreground"
          aria-label="Refresh"
        >
          Refresh
        </button>
      </div>
      {loading ? (
        <div className="px-4 pb-4">
          <div className="h-16 animate-pulse rounded-xl bg-elevated" />
        </div>
      ) : pick ? (
        <div className="px-4 pb-4">
          <RecommendationCard
            title={pick.title}
            reason={pick.description}
            meta={pick.category}
            to={
              <Link
                to={pick.ctaLink as never}
                onClick={() => {
                  if (pick.ctaText.toLowerCase().includes("chat") || pick.ctaText.toLowerCase().includes("ask")) {
                    void send(pick.description);
                  }
                }}
                className="text-[13.5px] underline"
              >
                {pick.ctaText}
              </Link>
            }
          />
          <p className="mt-3 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
            <Calendar className="size-3" />
            {pick.created_at ? new Date(pick.created_at).toLocaleDateString() : "Today"}
          </p>
        </div>
      ) : (
        <div className="px-4 py-5">
          <p className="text-[11.5px] text-muted-foreground">
            No pick scheduled for today.
          </p>
        </div>
      )}
    </Panel>
  );
}