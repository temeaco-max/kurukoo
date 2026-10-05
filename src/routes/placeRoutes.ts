/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { Router } from 'express';
import QRCode from 'qrcode';
import { authenticateAdmin, authenticateUser, type AuthRequest } from '../middleware/auth.js';
import { aiRateLimit, createRateLimiter } from '../middleware/rateLimit.js';
import { describeQrContext, signQrContext } from '../services/qrContextService.js';
import {
  computeNeeds,
  createConcept,
  createPlace,
  forkConcept,
  getDeveloperReport,
  getDistrictPulse,
  getPlaceBySlug,
  getPlaceDetail,
  getRadarLayers,
  listApprovalsForPlace,
  listConceptsAdmin,
  listImageryEpochs,
  listPlaces,
  listPlacesAdmin,
  makeConceptReal,
  publishPlaceOpportunity,
  requestConceptApproval,
  reviewConceptApproval,
  SCENARIO_TEMPLATES,
  setConceptStatusAdmin,
  transitionPlaceStatus,
  voteConcept,
  type PlaceStatus,
} from '../services/placeService.js';
import { getConceptHero, getConceptVisionSvg, requestConceptVision } from '../services/visionService.js';
import { refreshPlaceReality } from '../services/placeGeoService.js';
import { getRenderableCampaigns } from '../services/adManager.js';
import { getDb } from '../database.js';

const router = Router();

/** External geo-fetching is user-triggered and bounded like AI spend. */
const geoRefreshRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: 5,
  keyPrefix: 'place-geo-refresh',
  message: 'Place refresh rate limit exceeded',
});

function sessionPhone(req: AuthRequest): string | null {
  return req.user?.phone ? String(req.user.phone) : null;
}

// Public: scenario templates for "Show me what this could become".
router.get('/place-scenarios', async (_req, res) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json({ scenarios: SCENARIO_TEMPLATES });
  } catch { res.status(500).json({ error: 'Unable to load place scenarios' }); }
});

// Public: radar layers ("what's happening around me"). Bounded + fuzzed.
router.get('/places-radar', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = Number(req.query.radiusMetres || req.query.radius || 10000);
    res.setHeader('Cache-Control', 'no-store');
    res.json(await getRadarLayers(lat, lng, radius));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to load radar' });
  }
});

// Public: list + detail.
router.get('/places', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      places: await listPlaces({
        state: req.query.state != null ? String(req.query.state) : undefined,
        lga: req.query.lga != null ? String(req.query.lga) : undefined,
        status: req.query.status != null ? String(req.query.status) : undefined,
        limit: req.query.limit != null ? Number(req.query.limit) : undefined,
      }),
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to list places' });
  }
});

router.get('/places/:slug', async (req, res) => {
  try {
    const detail = await getPlaceDetail(String(req.params.slug), undefined);
    if (!detail) return res.status(404).json({ error: 'Place not found' });
    res.setHeader('Cache-Control', 'no-store');
    res.json(detail);
  } catch { res.status(500).json({ error: 'Unable to load place' }); }
});

router.get('/places/:slug/needs', async (req, res) => {
  try {
    const place = await getPlaceBySlug(String(req.params.slug));
    if (!place) return res.status(404).json({ error: 'Place not found' });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ slug: place.slug, needs: await computeNeeds(place.slug) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to compute needs' });
  }
});

router.get('/places/:slug/approvals', async (req, res) => {
  try {
    const place = await getPlaceBySlug(String(req.params.slug));
    if (!place) return res.status(404).json({ error: 'Place not found' });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ slug: place.slug, approvals: await listApprovalsForPlace(place.id) });
  } catch { res.status(500).json({ error: 'Unable to load approvals' }); }
});

// Live OSM refresh: user-triggered, labelled, fail-closed. Never invents data.
router.post('/places/:slug/refresh-reality', authenticateUser, geoRefreshRateLimit, async (req: AuthRequest, res) => {  try {
    if (!sessionPhone(req)) return res.status(401).json({ error: 'Authentication required' });
    const radius = req.body?.radiusM != null ? Number(req.body.radiusM) : 1000;
    res.json(await refreshPlaceReality(String(req.params.slug), radius));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to refresh place reality' });
  }
});

// Admin moderation (authenticateAdmin routes only).
router.get('/admin/places', authenticateAdmin, async (_req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ places: await listPlacesAdmin() });
  } catch { res.status(500).json({ error: 'Unable to list places' }); }
});

router.get('/admin/places/:slug/concepts', authenticateAdmin, async (req, res) => {
  try {
    const place = await getPlaceBySlug(String(req.params.slug));
    if (!place) return res.status(404).json({ error: 'Place not found' });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ concepts: await listConceptsAdmin(place.id) });
  } catch { res.status(500).json({ error: 'Unable to list concepts' }); }
});

router.patch('/admin/concepts/:conceptId/status', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    res.json(await setConceptStatusAdmin(String(req.params.conceptId), req.body?.status));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to update concept status' });
  }
});

router.patch('/admin/places/:slug/status', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const phone = sessionPhone(req);
    if (!phone) return res.status(401).json({ error: 'Authentication required' });
    res.json(await transitionPlaceStatus(String(req.params.slug), String(req.body?.status) as PlaceStatus, `admin:${phone}`));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to update place status' });
  }
});

// Authenticated: create place / advance status / concepts / votes / execution.
router.post('/places', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const phone = sessionPhone(req);
    if (!phone) return res.status(401).json({ error: 'Authentication required' });
    res.status(201).json(await createPlace(phone, {
      name: req.body?.name,
      state: req.body?.state,
      lga: req.body?.lga,
      centerLat: req.body?.centerLat ?? req.body?.center_lat,
      centerLng: req.body?.centerLng ?? req.body?.center_lng,
      bbox: req.body?.bbox,
      reality: req.body?.reality,
      topicId: req.body?.topicId,
    }));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create place' });
  }
});

router.patch('/places/:slug/status', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const phone = sessionPhone(req);
    if (!phone) return res.status(401).json({ error: 'Authentication required' });
    res.json(await transitionPlaceStatus(String(req.params.slug), String(req.body?.status) as PlaceStatus, phone));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to update place status' });
  }
});

router.post('/places/:slug/concepts', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const phone = sessionPhone(req);
    if (!phone) return res.status(401).json({ error: 'Authentication required' });
    res.status(201).json(await createConcept(phone, String(req.params.slug), {
      title: req.body?.title,
      description: req.body?.description,
      scenario: req.body?.scenario,
      assets: req.body?.assets,
      feasibility: req.body?.feasibility,
      sponsored: req.body?.sponsored,
      sponsorLabel: req.body?.sponsorLabel,
    }));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create concept' });
  }
});

router.post('/places/:slug/concepts/:conceptId/fork', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const phone = sessionPhone(req);
    if (!phone) return res.status(401).json({ error: 'Authentication required' });
    res.status(201).json(await forkConcept(phone, String(req.params.conceptId), {
      title: req.body?.title,
      description: req.body?.description,
      scenario: req.body?.scenario,
      assets: req.body?.assets,
      feasibility: req.body?.feasibility,
    }));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to fork concept' });
  }
});

router.post('/concepts/:conceptId/vote', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const phone = sessionPhone(req);
    if (!phone) return res.status(401).json({ error: 'Authentication required' });
    res.json(await voteConcept(phone, String(req.params.conceptId), req.body?.value, req.body?.role));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to record vote' });
  }
});

router.post('/concepts/:conceptId/opportunity', authenticateUser, async (req: AuthRequest, res) => {  try {
    const phone = sessionPhone(req);
    if (!phone) return res.status(401).json({ error: 'Authentication required' });
    res.status(201).json(await publishPlaceOpportunity(phone, String(req.params.conceptId)));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to publish opportunity' });
  }
});

router.post('/concepts/:conceptId/make-real', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const phone = sessionPhone(req);
    if (!phone) return res.status(401).json({ error: 'Authentication required' });
    res.status(201).json(await makeConceptReal(phone, String(req.params.conceptId), req.body?.detail, req.body?.skill));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to start execution' });
  }
});

// Approval workflow: community support is not approval; authority decisions are recorded.
router.post('/concepts/:conceptId/approval', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const phone = sessionPhone(req);
    if (!phone) return res.status(401).json({ error: 'Authentication required' });
    res.status(201).json(await requestConceptApproval(phone, String(req.params.conceptId), req.body?.authority, req.body?.note));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to request approval' });
  }
});

router.patch('/admin/approvals/:approvalId', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const phone = sessionPhone(req);
    if (!phone) return res.status(401).json({ error: 'Authentication required' });
    res.json(await reviewConceptApproval(phone, String(req.params.approvalId), req.body?.status, req.body?.note));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to review approval' });
  }
});

// Concept visualisation: free deterministic SVG always; one cached AI hero
// per revision only when the deployment configures an image backend.
router.post('/concepts/:conceptId/vision', authenticateUser, aiRateLimit, async (req: AuthRequest, res) => {
  try {
    const phone = sessionPhone(req);
    if (!phone) return res.status(401).json({ error: 'Authentication required' });
    res.status(201).json(await requestConceptVision(phone, String(req.params.conceptId)));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to generate vision' });
  }
});

router.get('/concepts/:conceptId/vision.svg', async (req, res) => {
  try {
    const vision = await getConceptVisionSvg(String(req.params.conceptId));
    if (!vision) return res.status(404).json({ error: 'Concept not found' });
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=86400');
    res.type('image/svg+xml').send(vision.svg);
  } catch { res.status(500).json({ error: 'Unable to load vision' }); }
});

router.get('/concepts/:conceptId/hero.png', async (req, res) => {
  try {
    const hero = await getConceptHero(String(req.params.conceptId));
    if (!hero) return res.status(404).json({ error: 'No hero render for this concept revision yet', hint: 'POST /api/concepts/:id/vision generates one when an image backend is configured' });
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    res.type(hero.mime).send(hero.bytes);
  } catch { res.status(500).json({ error: 'Unable to load hero render' }); }
});

// Pilot poster: printable QR that opens Chat with this place in context.
// Reuses the signed QR entry authority; posters expire after 90 days.
router.get('/places/:slug/poster', async (req, res) => {
  try {
    const place = await getPlaceBySlug(String(req.params.slug));
    if (!place) return res.status(404).json({ error: 'Place not found' });
    const context = { type: 'location' as const, entity: String(place.name).slice(0, 96), source: `place:${place.slug}`.slice(0, 96) };
    const base = String(process.env.KURUKOO_PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`);
    const posterUrl = new URL('/start', base);
    posterUrl.searchParams.set('qr', signQrContext(context, Date.now() + 90 * 86400_000));
    const entryUrl = posterUrl.toString();
    const svg = await QRCode.toString(entryUrl, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    const shareText = `See what ${place.name} could become — visions, votes and what the area needs. ${base}/places/${encodeURIComponent(place.slug)}`;
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json({
      slug: place.slug,
      name: place.name,
      entryUrl,
      svg,
      description: describeQrContext(context),
      expiresNote: 'Poster QR codes expire after 90 days; generate a fresh poster to renew.',
      shareText,
      whatsappShareUrl: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
    });
  } catch { res.status(500).json({ error: 'Unable to build poster' }); }
});
router.get('/district-pulse', async (req, res) => {
  try {
    if (req.query.state == null || req.query.state === '') return res.status(400).json({ error: 'state is required' });
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json(await getDistrictPulse(String(req.query.state), req.query.lga != null ? String(req.query.lga) : undefined));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to load district pulse' });
  }
});

// Historical imagery epochs. Empty until an imagery backend connects.
router.get('/places/:slug/imagery', async (req, res) => {
  try {
    const place = await getPlaceBySlug(String(req.params.slug));
    if (!place) return res.status(404).json({ error: 'Place not found' });
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json({ slug: place.slug, epochs: await listImageryEpochs(place.id) });
  } catch { res.status(500).json({ error: 'Unable to load imagery epochs' }); }
});

// Developer / institutional intelligence (paid surface reads this; participation stays free).
// Gated on the existing subscription tier: anything above Base (consumer Plus/Business
// or an active provider tier, both of which write memory_profiles.subscription_tier).
async function reportEntitlement(phone: string): Promise<{ allowed: boolean; tier: string | null }> {
  try {
    const db = await getDb();
    const stmt = db.prepare('SELECT subscription_tier FROM memory_profiles WHERE phone=? LIMIT 1');
    stmt.bind([phone]);
    const row = stmt.step() ? stmt.getAsObject() as any : null;
    stmt.free();
    const tier = row?.subscription_tier ? String(row.subscription_tier) : null;
    return { allowed: Boolean(tier && tier !== 'Base'), tier };
  } catch {
    return { allowed: false, tier: null };
  }
}

router.get('/places/:slug/report', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const phone = sessionPhone(req);
    if (!phone) return res.status(401).json({ error: 'Authentication required' });
    if (String(req.user?.role) !== 'admin') {
      const entitlement = await reportEntitlement(phone);
      if (!entitlement.allowed) {
        return res.status(402).json({
          error: 'Developer intelligence requires a Plus or Business plan. Community participation stays free.',
          payment_required: true,
          upgrade: '/pricing',
        });
      }
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json(await getDeveloperReport(String(req.params.slug)));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to load report' });
  }
});

// Clearly labelled ad placement for place detail surfaces. Empty until an
// advertiser buys the 'places_detail' placement through the existing campaign authority.
router.get('/places/:slug/promotions', async (req, res) => {
  try {
    const place = await getPlaceBySlug(String(req.params.slug));
    if (!place) return res.status(404).json({ error: 'Place not found' });
    const campaigns = await getRenderableCampaigns({ placements: ['places_detail'], limit: 2 });
    res.setHeader('Cache-Control', 'public, max-age=120');
    res.json({
      slug: place.slug,
      promotions: campaigns.map((ad: any) => ({
        title: ad.title || 'Sponsored', image: ad.imageUrl, alt: ad.title || 'Sponsored',
        destination: ad.destination || '/advertise', ctaText: ad.ctaText || 'Learn more',
        disclosure: ad.disclosure || 'Sponsored',
      })),
    });
  } catch { res.status(500).json({ error: 'Unable to load promotions' }); }
});

export default router;
