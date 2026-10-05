import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BellPlus, BellOff, ThumbsDown, ThumbsUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState, PageHeader } from "@/components/app-shell";
import {
  conceptVisionUrl,
  fetchPlaceApprovals,
  fetchPlaceDetail,
  fetchPlacePoster,
  fetchPlacePromotions,
  fetchPlaceRelationship,
  followPlace,
  refreshPlaceReality,
  unfollowPlace,
  voteForConcept,
  type PlaceApproval,
  type PlaceConcept,
  type PlaceDetail,
  type PlacePoster,
  type PlacePromotion,
} from "@/lib/places-api";

export const Route = createFileRoute("/places/$slug")({
  head: () => ({
    meta: [
      { title: "Place — Kurukoo" },
      {
        name: "description",
        content: "See what a place is, imagine what it could become, and agree on priorities.",
      },
      { property: "og:title", content: "Kurukoo Place" },
      // Only existing places reach this route (the detail chain 404s unknown slugs).
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: PlacePage,
});

type LeafletMap = {
  setView: (latlng: [number, number], zoom: number) => LeafletMap;
  remove: () => void;
};

declare global {
  interface Window {
    L?: {
      map: (el: HTMLElement) => LeafletMap;
      tileLayer: (url: string, opts?: Record<string, unknown>) => { addTo: (map: unknown) => unknown };
      marker: (latlng: [number, number]) => { addTo: (map: unknown) => unknown };
    };
  }
}

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
/** Self-hosted tiles (e.g. Protomaps) drop in here with zero code changes. */
const TILE_STREETS =
  (import.meta.env["VITE_KURUKOO_TILE_URL_STREETS"] as string | undefined) ||
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_SATELLITE =
  (import.meta.env["VITE_KURUKOO_TILE_URL_SATELLITE"] as string | undefined) ||
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

function PlaceMap({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"streets" | "satellite">("streets");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    // Held outside boot() so the effect cleanup can tear the map down. A Leaflet
    // instance is not a promise, and leaving it mounted leaks the DOM node and
    // its tile listeners on every mode switch and unmount.
    let map: { remove: () => void } | null = null;
    async function boot() {
      try {
        if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = LEAFLET_CSS;
          document.head.appendChild(link);
        }
        if (!window.L) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = LEAFLET_JS;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("map unavailable"));
            document.head.appendChild(script);
          });
        }
        if (cancelled || !ref.current || !window.L) return;
        ref.current.innerHTML = "";
        const instance = window.L.map(ref.current).setView([lat, lng], 15);
        map = instance as unknown as { remove: () => void };
        const url = mode === "streets" ? TILE_STREETS : TILE_SATELLITE;
        window.L.tileLayer(url, {
          maxZoom: 19,
          attribution: mode === "streets" ? "© OpenStreetMap contributors" : "Imagery © Esri",
        }).addTo(instance);
        window.L.marker([lat, lng]).addTo(instance);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    void boot();
    return () => {
      cancelled = true;
      map?.remove();
      map = null;
    };
  }, [lat, lng, mode]);
  if (failed || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return (
      <div className="rounded-xl border p-4 text-sm">
        Map tiles are unavailable offline. The area centre is approximately {lat}, {lng} —{" "}
        <a
          className="underline"
          href={`https://www.openstreetmap.org/#map=15/${lat}/${lng}`}
          target="_blank"
          rel="noreferrer"
        >
          open {name} in OpenStreetMap
        </a>
        .
      </div>
    );
  }
  return (
    <div>
      <div className="mb-2 flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode("streets")}
          className={mode === "streets" ? "font-semibold underline" : "underline opacity-70"}
        >
          Now · streets
        </button>
        <button
          type="button"
          onClick={() => setMode("satellite")}
          className={mode === "satellite" ? "font-semibold underline" : "underline opacity-70"}
        >
          Now · satellite
        </button>
      </div>
      <div ref={ref} className="h-64 w-full rounded-xl border" role="img" aria-label={`Map of ${name}`} />
      <p className="mt-1 text-xs opacity-70">Area centre, approximate. Public view only.</p>
    </div>
  );
}

function SharePlace({ slug, name }: { slug: string; name: string }) {
  const [poster, setPoster] = useState<PlacePoster | null>(null);
  const [open, setOpen] = useState(false);
  async function load() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (!poster) {
      try {
        setPoster(await fetchPlacePoster(slug));
      } catch {
        setPoster(null);
      }
    }
  }
  return (
    <div className="rounded-xl border p-4 text-sm">
      <button type="button" onClick={() => void load()} className="underline">
        {open ? "Hide pilot poster" : "Share this place — pilot poster & QR"}
      </button>
      {open ? (
        poster ? (
          <div className="mt-3 space-y-2">
            <div dangerouslySetInnerHTML={{ __html: poster.svg }} className="max-w-[220px]" />
            <p className="opacity-70">{poster.description}</p>
            <p>
              <a href={poster.whatsappShareUrl} target="_blank" rel="noreferrer" className="underline">
                Share on WhatsApp
              </a>
            </p>
            <p className="text-xs opacity-70">{poster.expiresNote}</p>
          </div>
        ) : (
          <p className="mt-2 opacity-70">Poster unavailable right now.</p>
        )
      ) : null}
      <span className="sr-only">{name}</span>
    </div>
  );
}

function Approvals({ slug }: { slug: string }) {
  const [approvals, setApprovals] = useState<PlaceApproval[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchPlaceApprovals(slug)
      .then((list) => {
        if (!cancelled) setApprovals(list);
      })
      .catch(() => {
        if (!cancelled) setApprovals([]);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);
  if (!approvals || approvals.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">Authority reviews</h2>
      <ul className="space-y-2 text-sm">
        {approvals.map((approval) => (
          <li key={approval.id} className="rounded-lg border p-3">
            <strong>{approval.authority}</strong> · {approval.status.replace(/_/g, " ")}
            {approval.note ? <p className="opacity-70">{approval.note}</p> : null}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs opacity-70">Community support is not an approval; only a recorded authority decision counts.</p>
    </section>
  );
}

function VisionTour({ concepts }: { concepts: PlaceConcept[] }) {
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!playing || concepts.length < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % concepts.length), 4000);
    return () => window.clearInterval(timer);
  }, [playing, concepts.length]);
  if (concepts.length < 2) return null;
  const current = concepts[index % concepts.length];
  return (
    <div className="mb-4 rounded-xl border p-4">
      <button type="button" onClick={() => setPlaying((p) => !p)} className="text-sm underline">
        {playing ? "Pause vision tour" : "Play vision tour"}
      </button>
      {playing && current ? (
        <div className="mt-3">
          <img
            key={current.id}
            src={conceptVisionUrl(current.id)}
            alt={`Illustrative massing for ${current.title}`}
            className="w-full rounded-lg border"
            loading="lazy"
          />
          <p className="mt-1 text-sm">
            {index + 1} of {concepts.length} — {current.title}
          </p>
          <p className="text-xs opacity-70">Illustrative renders, not plans. Motion is a slideshow, not a generated video.</p>
        </div>
      ) : null}
    </div>
  );
}

function ConceptCard({ concept, onVoted }: { concept: PlaceConcept; onVoted: (next: PlaceConcept) => void }) {  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  async function vote(value: 1 | -1) {
    setBusy(true);
    setNotice(null);
    try {
      const next = await voteForConcept(concept.id, value, "interested");
      onVoted(next);
    } catch (error) {
      setNotice(
        error instanceof Error && /401/.test(error.message)
          ? "Sign in via Chat to vote."
          : error instanceof Error
            ? error.message
            : "Vote failed",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold">{concept.title}</h3>
        {concept.sponsored && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs">
            Sponsored{concept.sponsorLabel ? ` · ${concept.sponsorLabel}` : ""}
          </span>
        )}
        <span className="text-xs opacity-70">
          {concept.scenario.replace(/_/g, " ")} · v{concept.version} · {concept.status}
        </span>
      </div>
      <img
        src={conceptVisionUrl(concept.id)}
        alt={`Illustrative massing for ${concept.title}`}
        className="mt-3 w-full rounded-lg border"
        loading="lazy"
      />
      <p className="mt-3 text-sm">{concept.description}</p>
      {concept.parentConceptId && <p className="mt-1 text-xs opacity-70">Evolved from an earlier concept (v{concept.version - 1}).</p>}
      <div className="mt-3 flex items-center gap-3 text-sm">
        <button type="button" disabled={busy} onClick={() => void vote(1)} className="flex items-center gap-1 underline">
          <ThumbsUp size={16} /> Support ({concept.votes.support})
        </button>
        <button type="button" disabled={busy} onClick={() => void vote(-1)} className="flex items-center gap-1 underline">
          <ThumbsDown size={16} /> Oppose ({concept.votes.oppose})
        </button>
        {concept.economicRequestId && <span className="text-xs opacity-70">In execution → Work</span>}
      </div>
      {notice && <p className="mt-2 text-sm">{notice} <Link to="/chat" className="underline">Open Chat</Link></p>}
    </article>
  );
}

function PlacePage() {
  const { slug } = Route.useParams();
  const [place, setPlace] = useState<PlaceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [promotions, setPromotions] = useState<PlacePromotion[]>([]);
  const load = useCallback(async () => {
    setError(null);
    try {
      const detail = await fetchPlaceDetail(slug);
      setPlace(detail);
      const rel = await fetchPlaceRelationship(detail.id);
      setFollowing(Boolean(rel && rel.status !== "revoked"));
    } catch (err) {
      setPlace(null);
      setError(err instanceof Error ? err.message : "Place not found");
    }
  }, [slug]);
  useEffect(() => {
    void load();
    fetchPlacePromotions(slug)
      .then(setPromotions)
      .catch(() => undefined);
  }, [load, slug]);
  async function refreshReality() {
    if (!place || refreshing) return;
    setRefreshing(true);
    setRefreshNotice(null);
    try {
      const result = await refreshPlaceReality(place.slug);
      setRefreshNotice(`Live map data applied from ${result.source}. Counts are community-reported, not verified.`);
      await load();
    } catch (err) {
      setRefreshNotice(err instanceof Error ? err.message : "Live map data is unavailable right now.");
    } finally {
      setRefreshing(false);
    }
  }
  async function toggleFollow() {
    if (!place) return;
    try {
      if (following) {
        await unfollowPlace(place.id);
        setFollowing(false);
      } else {
        await followPlace(place.id);
        setFollowing(true);
      }
    } catch {
      setFollowing(null);
    }
  }
  if (error) {
    return (
      <div className="p-4">
        <EmptyState title="Place not found" description={error} />
        <Link to="/chat" className="underline">Ask Kurukoo instead</Link>
      </div>
    );
  }
  if (!place) return <div className="p-4">Loading place…</div>;
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <Link to="/chat" className="flex items-center gap-1 text-sm underline">
        <ArrowLeft size={16} /> Back to Chat
      </Link>
      <PageHeader
        title={place.name}
        description={`${[place.lga, place.state].filter(Boolean).join(", ") || "Nigeria"} · ${place.status}`}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void toggleFollow()} className="flex items-center gap-1 text-sm underline">
          {following ? <BellOff size={16} /> : <BellPlus size={16} />}
          {following ? "Following — mute updates" : following === false ? "Follow this place" : "Follow"}
        </button>
      </div>
      <SharePlace slug={place.slug} name={place.name} />
      {promotions.length > 0 ? (
        <section aria-label="Sponsored">
          {promotions.map((promotion, index) => (
            <a
              key={`${promotion.title}-${index}`}
              href={promotion.destination}
              className="block rounded-xl border p-4 text-sm"
            >
              <p className="text-xs opacity-70">{promotion.disclosure}</p>
              <p className="font-semibold">{promotion.title}</p>
              <p className="underline">{promotion.ctaText}</p>
            </a>
          ))}
        </section>
      ) : null}
      <section>
        <h2 className="mb-2 text-lg font-semibold">Now</h2>
        <PlaceMap lat={place.centerLat} lng={place.centerLng} name={place.name} />
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Potential ({place.concepts.length})</h2>
        <VisionTour concepts={place.concepts} />
        {place.concepts.length === 0 ? (
          <EmptyState
            title="No visions yet"
            description="Be the first to imagine what this area could become. Open Chat and describe it."
          />
        ) : (
          <div className="space-y-4">
            {place.concepts.map((concept) => (
              <ConceptCard
                key={concept.id}
                concept={concept}
                onVoted={(next) =>
                  setPlace((prev) =>
                    prev ? { ...prev, concepts: prev.concepts.map((c) => (c.id === next.id ? next : c)) } : prev,
                  )
                }
              />
            ))}
          </div>
        )}
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Creators shaping this place</h2>
        {place.creators.length === 0 ? (
          <p className="text-sm opacity-70">No creators yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {place.creators.map((creator) => (
              <li key={creator.displayName} className="flex flex-wrap gap-2">
                <strong>{creator.displayName}</strong>
                <span className="opacity-70">
                  {creator.concepts} vision{creator.concepts === 1 ? "" : "s"} · {creator.support} supporters
                  {creator.built > 0 ? ` · ${creator.built} built` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">What this place needs</h2>
          <button type="button" onClick={() => void refreshReality()} disabled={refreshing} className="text-sm underline">
            {refreshing ? "Checking live map…" : "Refresh from live map"}
          </button>
        </div>
        {refreshNotice && <p className="mb-2 text-sm">{refreshNotice}</p>}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left opacity-70">
              <th className="py-1">Category</th>
              <th>Current</th>
              <th>Gap</th>
              <th>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {place.needs.map((need) => (
              <tr key={need.category} className="border-t">
                <td className="py-1">{need.category.replace(/_/g, " ")}</td>
                <td>{need.current}</td>
                <td>{need.gap}</td>
                <td>{need.confidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">History</h2>
        {place.imagery.length === 0 ? (
          <p className="text-sm opacity-70">
            No historical imagery connected yet. Satellite history appears here once an imagery source is connected — nothing is backfilled or guessed.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {place.imagery.map((epoch) => (
              <li key={epoch.epochLabel} className="rounded-lg border p-3">
                <strong>{epoch.epochLabel}</strong>
                {epoch.capturedAt ? ` · ${epoch.capturedAt}` : ""} · {epoch.source}
                {epoch.note ? <p className="opacity-70">{epoch.note}</p> : null}
                {epoch.url ? (
                  <a href={epoch.url} target="_blank" rel="noreferrer" className="underline">
                    Open source imagery
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <Approvals slug={place.slug} />
      <section className="rounded-xl border p-4 text-sm opacity-80">
        <h2 className="mb-1 font-semibold">How to read this page</h2>
        <p>{place.disclaimers.scenarios}</p>
        <p className="mt-1">{place.disclaimers.votes}</p>
        <p className="mt-1">{place.disclaimers.land}</p>
        <p className="mt-1">
          Land registries:{" "}
          {place.landRegistries.map((registry) => `${registry.name} (${registry.status.replace(/_/g, " ")})`).join(" · ")}
        </p>
      </section>
    </div>
  );
}
