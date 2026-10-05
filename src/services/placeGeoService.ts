/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { computeNeeds, getPlaceBySlug } from './placeService.js';
import { getDb, saveDb } from '../database.js';

/**
 * Live geographic context for Kurukoo Places, from OpenStreetMap via Overpass.
 *
 * Activation boundary: the public Overpass API needs no key and is free, but it
 * is still an external dependency. Every behaviour here is fail-closed:
 * - counts are labelled community-reported with source + fetched_at, never verified;
 * - any fetch/parse failure leaves existing place data untouched;
 * - oversized responses are truncated and the truncation is recorded;
 * - the endpoint URL is overridable (KURUKOO_OVERPASS_URL) for tests and mirrors.
 *
 * Sentinel-2 imagery ingestion, self-hosted tiles (Protomaps) and a routing
 * engine remain explicit non-goals: they are ops-heavy pipelines, not code
 * slices, and are recorded in docs/architecture/PLACES.md instead of faked.
 */

export const OVERPASS_DEFAULT_URL = 'https://overpass-api.de/api/interpreter';
const FETCH_TIMEOUT_MS = 25_000;
const MAX_ELEMENTS = 3000;
const DEFAULT_RADIUS_M = 1000;

/** Routing engine boundary: public OSRM demo server by default (free, no key,
 *  rate-limited), self-hosted OSRM/Valhalla via KURUKOO_OSRM_URL when available. */
export const OSRM_DEFAULT_URL = 'https://router.project-osrm.org';
export function osrmUrl(): string {
  return String(process.env.KURUKOO_OSRM_URL || OSRM_DEFAULT_URL).replace(/\/$/, '') || OSRM_DEFAULT_URL;
}

/** Elevation boundary: SRTM via OpenTopodata (free, no key). Fail-soft always. */
export const OPENTOPODATA_DEFAULT_URL = 'https://api.opentopodata.org/v1/srtm30m';
export function openTopoDataUrl(): string {
  return String(process.env.KURUKOO_ELEVATION_URL || OPENTOPODATA_DEFAULT_URL).replace(/\/$/, '') || OPENTOPODATA_DEFAULT_URL;
}

export function overpassUrl(): string {
  return String(process.env.KURUKOO_OVERPASS_URL || OVERPASS_DEFAULT_URL).trim() || OVERPASS_DEFAULT_URL;
}

export function buildOverpassQuery(lat: number, lng: number, radiusM: number): string {
  const r = Math.min(Math.max(Math.round(radiusM) || DEFAULT_RADIUS_M, 100), 5000);
  return `[out:json][timeout:25];
(
  nwr["amenity"~"^(school|college|university|hospital|clinic|doctors|pharmacy|marketplace|recycling|waste_disposal)$"](around:${r},${lat},${lng});
  nwr["shop"~"^(mall|market|supermarket|department_store)$"](around:${r},${lat},${lng});
  nwr["leisure"~"^(park|garden|playground|pitch)$"](around:${r},${lat},${lng});
  nwr["highway"="bus_stop"](around:${r},${lat},${lng});
  nwr["railway"~"^(station|halt|tram_stop)$"](around:${r},${lat},${lng});
  nwr["natural"="water"](around:${r},${lat},${lng});
  way["highway"](around:${r},${lat},${lng});
);
out tags center ${MAX_ELEMENTS};`;
}

export interface OverpassCounts {
  schools: number;
  healthcare: number;
  retail: number;
  green_space: number;
  public_transport: number;
  waste: number;
  water_bodies: number;
  road_ways: number;
  truncated: boolean;
  totalElements: number;
  /** Representative coordinates (capped) for routing analysis. Informational. */
  amenityCoords: { schools: Array<[number, number]>; healthcare: Array<[number, number]> };
}

const EMPTY: OverpassCounts = {
  schools: 0, healthcare: 0, retail: 0, green_space: 0,
  public_transport: 0, waste: 0, water_bodies: 0, road_ways: 0,
  truncated: false, totalElements: 0,
  amenityCoords: { schools: [], healthcare: [] },
};

function tagsOf(element: any): Record<string, string> {
  const tags = (element as any)?.tags;
  return tags && typeof tags === 'object' ? tags as Record<string, string> : {};
}

/** Pure parser: Overpass elements -> labelled counts. Unit-tested with fixtures. */
export function parseOverpassElements(elements: unknown): OverpassCounts {
  const list = Array.isArray(elements) ? elements : [];
  const counts = { ...EMPTY, totalElements: list.length, truncated: list.length >= MAX_ELEMENTS, amenityCoords: { schools: [], healthcare: [] } };
  const seen = new Set<string>();
  const pushCoord = (bucket: Array<[number, number]>, el: any) => {
    if (bucket.length >= 20) return;
    const lat = Number(el?.lat ?? el?.center?.lat);
    const lng = Number(el?.lon ?? el?.center?.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) bucket.push([lat, lng]);
  };
  for (const element of list) {
    const el = element as any;
    const key = `${String(el?.type)}:${String(el?.id)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const tags = tagsOf(el);
    const amenity = tags.amenity || '';
    const shop = tags.shop || '';
    const leisure = tags.leisure || '';
    const highway = tags.highway || '';
    const railway = tags.railway || '';
    const natural = tags.natural || '';
    if (['school', 'college', 'university'].includes(amenity)) { counts.schools += 1; pushCoord(counts.amenityCoords.schools, el); }
    else if (['hospital', 'clinic', 'doctors', 'pharmacy'].includes(amenity)) { counts.healthcare += 1; pushCoord(counts.amenityCoords.healthcare, el); }
    else if (amenity === 'marketplace' || ['mall', 'market', 'supermarket', 'department_store'].includes(shop)) counts.retail += 1;
    else if (['park', 'garden', 'playground', 'pitch'].includes(leisure)) counts.green_space += 1;
    else if (highway === 'bus_stop' || ['station', 'halt', 'tram_stop'].includes(railway)) counts.public_transport += 1;
    else if (['recycling', 'waste_disposal'].includes(amenity)) counts.waste += 1;
    else if (natural === 'water') counts.water_bodies += 1;
    if (el?.type === 'way' && highway) counts.road_ways += 1;
  }
  return counts;
}

export async function fetchOverpassCounts(
  lat: number,
  lng: number,
  radiusM = DEFAULT_RADIUS_M,
  fetchImpl: typeof fetch = fetch,
): Promise<OverpassCounts> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('lat/lng must be numbers');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(overpassUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(buildOverpassQuery(lat, lng, radiusM))}`,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Live map data responded with status ${response.status}`);
    const payload = (await response.json()) as any;
    return parseOverpassElements(payload?.elements);
  } catch (error) {
    if (error instanceof Error && /aborted/i.test(error.message)) throw new Error('Live map data timed out');
    throw error instanceof Error ? error : new Error('Live map data is unavailable');
  } finally {
    clearTimeout(timer);
  }
}

export interface RefreshResult {
  slug: string;
  source: string;
  fetchedAt: string;
  radiusM: number;
  counts: OverpassCounts;
  connectivity: Record<string, unknown>;
  terrain: Record<string, unknown>;
  needs: unknown[];
}

/** Real network routing (OSRM). Throws on any failure; callers treat it as optional. */
export async function walkingSeconds(
  fromLat: number, fromLng: number, toLat: number, toLng: number,
  fetchImpl: typeof fetch = fetch,
): Promise<{ seconds: number; metres: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const url = `${osrmUrl()}/route/v1/walking/${fromLng},${fromLat};${toLng},${toLat}?overview=false`;
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Routing responded with status ${response.status}`);
    const payload = (await response.json()) as any;
    const route = payload?.routes?.[0];
    if (!route || !Number.isFinite(Number(route.duration))) throw new Error('No route found');
    return { seconds: Math.round(Number(route.duration)), metres: Math.round(Number(route.distance) || 0) };
  } finally {
    clearTimeout(timer);
  }
}

/** SRTM elevation (OpenTopodata). Throws on any failure; optional enrichment. */
export async function fetchElevation(lat: number, lng: number, fetchImpl: typeof fetch = fetch): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetchImpl(`${openTopoDataUrl()}?locations=${lat},${lng}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`Elevation responded with status ${response.status}`);
    const payload = (await response.json()) as any;
    const elevation = Number(payload?.results?.[0]?.elevation);
    if (!Number.isFinite(elevation)) throw new Error('No elevation value');
    return Math.round(elevation);
  } finally {
    clearTimeout(timer);
  }
}

async function nearestWalk(lat: number, lng: number, targets: Array<[number, number]>, fetchImpl: typeof fetch): Promise<Record<string, unknown> | null> {
  if (!targets.length) return null;
  let best: { seconds: number; metres: number } | null = null;
  for (const [tLat, tLng] of targets.slice(0, 5)) {
    try {
      const candidate = await walkingSeconds(lat, lng, tLat, tLng, fetchImpl);
      if (!best || candidate.seconds < best.seconds) best = candidate;
    } catch { /* try the next candidate */ }
  }
  return best ? { walk_seconds: best.seconds, walk_metres: best.metres, engine: 'OSRM', confidence: 'estimated' } : null;
}

/**
 * Refreshes a place's reality from live OSM data. All-or-nothing: counts are
 * computed first, then merged in a single update. Throws without writing when
 * the external source is unreachable.
 */
export async function refreshPlaceReality(
  slug: string,
  radiusM = DEFAULT_RADIUS_M,
  fetchImpl: typeof fetch = fetch,
): Promise<RefreshResult> {
  const place = await getPlaceBySlug(slug);
  if (!place) throw new Error('Place not found');
  let counts: OverpassCounts;
  try {
    counts = await fetchOverpassCounts(place.centerLat, place.centerLng, radiusM, fetchImpl);
  } catch {
    throw new Error('Live map data is unavailable right now; existing place data is unchanged.');
  }
  const fetchedAt = new Date().toISOString();
  const source = 'OpenStreetMap contributors via Overpass';
  const entry = (count: number) => ({ count, confidence: 'community-reported' as const, source, fetched_at: fetchedAt, ...(counts.truncated ? { truncated: true } : {}) });
  const reality = { ...(place.reality || {}) };
  reality.schools = entry(counts.schools);
  reality.healthcare = entry(counts.healthcare);
  reality.retail = entry(counts.retail);
  reality.green_space = entry(counts.green_space);
  reality.public_transport = entry(counts.public_transport);
  reality.waste = entry(counts.waste);
  // Informational only: not needs categories, never gap claims.
  reality.water_bodies = { ...entry(counts.water_bodies), informational: true };
  reality.road_ways = { ...entry(counts.road_ways), informational: true };
  // Fail-soft enrichment: routing + terrain never block or break a refresh.
  const connectivity: Record<string, unknown> = {};
  try {
    const [school, clinic] = await Promise.all([
      nearestWalk(place.centerLat, place.centerLng, counts.amenityCoords.schools, fetchImpl),
      nearestWalk(place.centerLat, place.centerLng, counts.amenityCoords.healthcare, fetchImpl),
    ]);
    if (school) connectivity.nearest_school = school;
    if (clinic) connectivity.nearest_clinic = clinic;
  } catch { /* routing unavailable */ }
  if (Object.keys(connectivity).length) reality.connectivity = { ...connectivity, fetched_at: fetchedAt };
  const terrain: Record<string, unknown> = {};
  try {
    const elevation = await fetchElevation(place.centerLat, place.centerLng, fetchImpl);
    terrain.elevation_m = elevation;
    terrain.source = 'SRTM via OpenTopodata';
    terrain.confidence = 'estimated';
    terrain.fetched_at = fetchedAt;
    reality.terrain = { ...terrain };
  } catch { /* elevation unavailable */ }
  const confidence = { ...(place.confidence || {}) };
  for (const key of ['schools', 'healthcare', 'retail', 'green_space', 'public_transport', 'waste', 'water_bodies', 'road_ways']) {
    confidence[key] = 'community-reported';
  }
  const db = await getDb();
  db.run('UPDATE places SET reality_json=?, confidence_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [
    JSON.stringify(reality),
    JSON.stringify(confidence),
    place.id,
  ]);
  saveDb();
  const needs = await computeNeeds(slug);
  return { slug, source, fetchedAt, radiusM, counts, connectivity, terrain, needs };
}
