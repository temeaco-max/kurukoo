import express, { Router } from 'express';
import { getActivePulseProviders } from '../services/nearbyPulse.js';
import { listPublicTopics } from '../services/topicService.js';

type RadarLayer = 'mobile' | 'stationary' | 'agents' | 'emergency' | 'deals' | 'events';

const EARTH_RADIUS_METRES = 6_371_000;
const PUBLIC_LOCATION_FUZZ_METRES = 100;
const RADAR_LAYERS: Record<RadarLayer, { available: boolean; label: string; reason?: string }> = {
  mobile: { available: true, label: 'Mobile providers' },
  stationary: { available: true, label: 'Stationary providers' },
  agents: { available: false, label: 'AI agents', reason: 'Live geographic agent presence is not configured.' },
  emergency: { available: false, label: 'Emergency services', reason: 'Kurukoo does not provide a live emergency-service location feed.' },
  deals: { available: false, label: 'Active deals', reason: 'No verified live deal-location source is configured.' },
  events: { available: false, label: 'Events', reason: 'No verified live event-location source is configured.' },
};

function distanceMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fuzzCoordinate(value: number, metres: number, seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  const normalized = (Math.abs(hash) % 10000) / 10000;
  return value + ((normalized * 2 - 1) * metres) / EARTH_RADIUS_METRES * (180 / Math.PI);
}

function parseLayers(raw: unknown): RadarLayer[] {
  const requested = typeof raw === 'string' ? raw.split(',').map((value) => value.trim()).filter(Boolean) : ['mobile', 'stationary'];
  return Array.from(new Set(requested.filter((value): value is RadarLayer => value in RADAR_LAYERS)));
}

/**
 * Nearby Radar is a read-only public projection of canonical provider presence.
 * It never creates providers, grants verification, exposes exact coordinates, or
 * represents unavailable data sources as live layers.
 */
export function createDiscoveryRouter(): Router {
  const router = express.Router();

  router.get('/api/discover/community-context', async (req, res, next) => {
    try {
      const topics = await listPublicTopics({ category: req.query.category, city: req.query.city, limit: req.query.limit });
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return res.json({
        items: topics.map((topic) => ({ id: topic.id, slug: topic.slug, title: topic.title, excerpt: topic.body.slice(0, 220), type: topic.type, category: topic.category, city: topic.city, publishedAt: topic.publishedAt, provenance: 'community_statement' })),
        disclosure: 'Community statements are shared context, not provider presence, availability, price, booking, payment, delivery, or fulfilment records.',
      });
    } catch (error) { return next(error); }
  });

  router.get('/api/discover/map', async (req, res, next) => {
    try {
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);
      const radius = req.query.radius === undefined ? 5000 : Number(req.query.radius);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ success: false, error: 'lat and lng are required numbers' });
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return res.status(400).json({ success: false, error: 'invalid coordinates' });
      if (!Number.isFinite(radius) || radius <= 0 || radius > 50000) return res.status(400).json({ success: false, error: 'radius must be between 1 and 50000 metres' });

      const layers = parseLayers(req.query.layers);
      const category = typeof req.query.category === 'string' ? req.query.category.trim().toLowerCase() : undefined;
      const providers = await getActivePulseProviders();
      const features = providers
        .filter((provider: any) => {
          const providerLat = Number(provider.lat);
          const providerLng = Number(provider.lng);
          const source = provider.source === 'stationary' ? 'stationary' : 'mobile';
          return Number.isFinite(providerLat) && Number.isFinite(providerLng)
            && layers.includes(source)
            && distanceMetres(lat, lng, providerLat, providerLng) <= radius
            && (!category || String(provider.skill || '').toLowerCase() === category);
        })
        .map((provider: any, index: number) => {
          const source: 'mobile' | 'stationary' = provider.source === 'stationary' ? 'stationary' : 'mobile';
          const rawLat = Number(provider.lat);
          const rawLng = Number(provider.lng);
          const seed = `${provider.phone}:${provider.skill}:${Math.round(rawLat * 1000)}:${Math.round(rawLng * 1000)}`;
          const hasFuzzedLat = provider.fuzzed_lat !== null && provider.fuzzed_lat !== undefined && Number.isFinite(Number(provider.fuzzed_lat));
          const hasFuzzedLng = provider.fuzzed_lng !== null && provider.fuzzed_lng !== undefined && Number.isFinite(Number(provider.fuzzed_lng));
          const publicLat = hasFuzzedLat ? Number(provider.fuzzed_lat) : fuzzCoordinate(rawLat, PUBLIC_LOCATION_FUZZ_METRES, `${seed}:lat`);
          const publicLng = hasFuzzedLng ? Number(provider.fuzzed_lng) : fuzzCoordinate(rawLng, PUBLIC_LOCATION_FUZZ_METRES, `${seed}:lng`);
          return {
            type: 'Feature',
            id: `${source}-${index}`,
            geometry: { type: 'Point', coordinates: [publicLng, publicLat] },
            properties: {
              layer: source,
              name: provider.name || 'Verified provider',
              detail: provider.skill || 'Service provider',
              distanceMetres: Math.round(distanceMetres(lat, lng, rawLat, rawLng)),
              locationPrecision: 'approximate_100m',
              liveUntil: provider.live_until || null,
            },
          };
        });

      const layerMeta = Object.fromEntries(layers.map((layer) => [layer, RADAR_LAYERS[layer]]));
      res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
      return res.json({
        type: 'FeatureCollection',
        features,
        meta: { radius, layers: layerMeta, generatedAt: new Date().toISOString(), exactCoordinatesExposed: false },
      });
    } catch (error) { return next(error); }
  });

  return router;
}

export default createDiscoveryRouter();
