import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { EmptyState, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/places")({
  head: () => ({
    meta: [
      { title: "Places — Kurukoo" },
      {
        name: "description",
        content: "Areas people are understanding, imagining and agreeing on.",
      },
    ],
  }),
  component: PlacesPage,
});

interface PlaceSummary {
  slug: string;
  name: string;
  state: string | null;
  lga: string | null;
  status: string;
}

function PlacesPage() {
  const [places, setPlaces] = useState<PlaceSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/places?limit=50", { credentials: "include" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : "Places unavailable");
        return payload as { places?: PlaceSummary[] };
      })
      .then((payload) => {
        if (!cancelled) setPlaces(Array.isArray(payload.places) ? payload.places : []);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setPlaces([]);
          setError(err instanceof Error ? err.message : "Places unavailable");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <PageHeader
        title="Places"
        description="See what an area is, imagine what it could become, and agree on priorities."
      />
      {error && <p className="text-sm">{error}</p>}
      {places === null ? (
        <p>Loading places…</p>
      ) : places.length === 0 ? (
        <div>
          <EmptyState
            title="No places yet"
            description="Places appear here once someone starts one. Open Chat and describe an area."
          />
          <Link to="/chat" className="underline">
            Ask Kurukoo
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {places.map((place) => (
            <li key={place.slug} className="rounded-xl border p-4">
              <Link to="/places/$slug" params={{ slug: place.slug }} className="text-base font-semibold underline">
                {place.name}
              </Link>
              <p className="text-sm opacity-70">
                {[place.lga, place.state].filter(Boolean).join(", ") || "Nigeria"} · {place.status}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
