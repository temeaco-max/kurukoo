import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Panel } from "@/components/kurukoo/ui";

type HomePromotion = {
  id: number | string;
  title: string;
  desc: string;
  image?: string;
  disclosure: string;
  clickUrl: string;
  ctaText: string;
};

const API_BASE = (import.meta.env["VITE_KURUKOO_API_BASE_URL"] ?? "").replace(/\/$/, "");

async function fetchHomePromotions(): Promise<HomePromotion[]> {
  if (!API_BASE) return [];
  const response = await fetch(`${API_BASE}/api/advertising/home-promotions`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Unable to load home promotions (${response.status})`);
  const payload = (await response.json()) as { campaigns?: HomePromotion[] };
  return Array.isArray(payload.campaigns) ? payload.campaigns : [];
}

export function HomePromotionCarousel() {
  const [campaigns, setCampaigns] = useState<HomePromotion[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetchHomePromotions()
      .then((items) => {
        if (!cancelled) setCampaigns(items);
      })
      .catch(() => {
        if (!cancelled) setCampaigns([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (campaigns.length < 2) return;
    const id = window.setInterval(() => setIndex((value) => (value + 1) % campaigns.length), 6500);
    return () => window.clearInterval(id);
  }, [campaigns.length]);

  useEffect(() => {
    if (index >= campaigns.length && campaigns.length) setIndex(0);
  }, [campaigns.length, index]);

  if (!campaigns.length) return null;

  const campaign = campaigns[index] ?? campaigns[0]!;
  const previous = () => setIndex((value) => (value - 1 + campaigns.length) % campaigns.length);
  const next = () => setIndex((value) => (value + 1) % campaigns.length);

  return (
    <Panel className="relative min-h-[116px] overflow-hidden p-0">
      <div className="flex h-full min-h-[116px]">
        <div className="flex min-w-0 flex-1 flex-col justify-between p-4 pr-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-primary">
                {campaign.disclosure || "Kurukoo"}
              </span>
              {campaigns.length > 1 ? (
                <span className="text-[9px] text-muted-foreground">
                  {index + 1}/{campaigns.length}
                </span>
              ) : null}
            </div>
            <h2 className="mt-1 text-[14px] font-semibold leading-5 tracking-tight">
              {campaign.title}
            </h2>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
              {campaign.desc}
            </p>
          </div>
          <a
            href={campaign.clickUrl}
            className="mt-2 inline-flex w-fit items-center gap-1 text-[10.5px] font-semibold text-primary hover:opacity-80"
          >
            {campaign.ctaText}
            <ArrowRight className="size-3" />
          </a>
        </div>
        {campaign.image ? (
          <img
            src={campaign.image}
            alt=""
            loading="lazy"
            className="h-auto w-[76px] shrink-0 object-cover"
          />
        ) : null}
      </div>
      {campaigns.length > 1 ? (
        <div className="absolute bottom-2 right-2 flex items-center gap-1">
          <button
            type="button"
            onClick={previous}
            aria-label="Previous Kurukoo promotion"
            className="grid size-6 place-items-center rounded-full border border-border/80 bg-surface/90 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next Kurukoo promotion"
            className="grid size-6 place-items-center rounded-full border border-border/80 bg-surface/90 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      ) : null}
    </Panel>
  );
}
