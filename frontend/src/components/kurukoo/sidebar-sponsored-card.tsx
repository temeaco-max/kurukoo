import { useEffect, useState, type ReactNode } from "react";
import { fetchSponsoredAds, type SponsoredAd } from "@/lib/kurukoo-api";

/**
 * SidebarSponsoredCard — replicates the backend’s `sidebar-sponsored-card`
 * advert from http://localhost:3000/chat/ and brings it into the
 * authenticated frontend at http://localhost:5173/.
 *
 * Pulls campaigns from /api/chat/spponsored (up to 8) and cycles
 * through them every 6.5 s — matching the backend's sliding behaviour.
 */
export function SidebarSponsoredCard() {
  const [ads, setAds] = useState<SponsoredAd[]>([]);
  const [index, setIndex] = useState(-1);

  useEffect(() => {
    let cancelled = false;
    void fetchSponsoredAds()
      .then((campaigns) => { if (!cancelled) setAds(campaigns); })
      .catch(() => { if (!cancelled) setAds([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ads.length) return;
    setIndex(0);
    const handle = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setIndex((prev) => (prev + 1) % ads.length);
      }
    }, 6500);
    return () => clearInterval(handle);
  }, [ads]);

  if (!ads.length || index < 0) return null;

  const ad = ads[index];

  return (
    <a
      href={ad.clickUrl}
      data-ad-id={ad.id}
      aria-label="Sponsored local service promotion. Disclosed placement outside your conversation."
      className="sidebar-sponsored-card"
      rel="nofollow"
    >
      <img src={ad.image} alt={ad.alt} loading="lazy" />
      <span className="sidebar-sponsored-tag">{ad.disclosure || "Sponsored"}</span>
    </a>
  );
}
