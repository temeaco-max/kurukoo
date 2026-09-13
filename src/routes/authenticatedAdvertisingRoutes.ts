/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { Router, type Response } from 'express';
import { optionalAuthenticateUser, type AuthRequest } from '../middleware/auth.js';
import {
  createAdCampaign,
  getAdCampaigns,
  getRenderableCampaigns,
  recordAdImpression,
} from '../services/adManager.js';
import { optimizeCampaignImage } from '../services/assetOptimization.js';

const router = Router();
const allowedPlacements = new Set([
  'authenticated_left_rail',
  'authenticated_context_rail',
  'authenticated_desk_content',
  'authenticated_home_promotions',
  'topics_top_1',
  'topics_top_2',
  'topics_top_3',
  'topics_bottom_1',
  'topics_bottom_2',
  'topics_bottom_3',
  'topics_bottom_large',
]);

const TOPICS_PLACEMENTS = [
  'topics_top_1',
  'topics_top_2',
  'topics_top_3',
  'topics_bottom_1',
  'topics_bottom_2',
  'topics_bottom_3',
  'topics_bottom_large',
] as const;

const HOME_PROMOTIONS = [
  ['Get a Ride', 'Book a taxi, okada or keke locally.', 'ride', 'Get a ride', '/chat?prompt=Get%20me%20a%20ride', '/assets/chat/campaign-rider-delivery.webp'],
  ['Broken device?', 'Let Kurukoo diagnose the problem and help arrange the repair.', 'repair', 'Fix it', '/chat?prompt=My%20device%20is%20broken%20and%20I%20need%20help%20diagnosing%20and%20repairing%20it', '/assets/chat/sponsored-home-repair.webp'],
  ['Need health help?', 'Ask Kurukoo what to do next or find the right care option.', 'health', 'Get health help', '/chat?prompt=I%20need%20help%20with%20a%20health%20issue', '/assets/chat/campaign-digital-worker.webp'],
  ['Get food', 'Find food nearby or ask Kurukoo to help you order.', 'food', 'Get food', '/chat?prompt=Help%20me%20get%20food', '/assets/chat/campaign-food-vendor.webp'],
  ['Get groceries', 'Build your list, find options and get the shopping moving.', 'groceries', 'Get groceries', '/chat?prompt=Help%20me%20get%20my%20groceries', '/assets/chat/sponsored-fresh-market.webp'],
  ['Send something', 'Arrange a local rider or get help moving something where it needs to go.', 'delivery', 'Arrange delivery', '/chat?prompt=I%20need%20to%20send%20something', '/assets/chat/campaign-rider-delivery.webp'],
  ['Get home help', 'Find help with cleaning, plumbing, electrical work and more.', 'home help', 'Find home help', '/chat?prompt=I%20need%20help%20at%20home', '/assets/chat/sponsored-home-repair.webp'],
  ['Start a Money Circle', 'Set up or manage a group savings circle with Kurukoo.', 'money circle', 'Start a Money Circle', '/explore/money-circle', '/assets/chat/campaign-digital-worker.webp'],
  ['Sell something', 'Get help listing an item and finding interested people.', 'sell', 'Sell something', '/chat?prompt=Help%20me%20sell%20something', '/assets/chat/campaign-beauty.webp'],
  ['Find work', 'Explore gigs, tasks and opportunities you can act on.', 'work', 'Find work', '/chat?prompt=Help%20me%20find%20work', '/assets/chat/campaign-tailor.webp'],
  ['Join as a driver', 'Offer rides locally and let people discover when you are available.', 'driver', 'Join as a driver', '/chat?prompt=I%20want%20to%20join%20as%20a%20driver', '/assets/chat/campaign-rider-delivery.webp'],
  ['Get an errand done', 'Ask Kurukoo to help coordinate a practical task from start to finish.', 'errand', 'Get it done', '/chat?prompt=I%20need%20an%20errand%20done', '/assets/chat/campaign-digital-worker.webp'],
] as const;

async function ensureHomePromotions() {
  const campaigns = await getAdCampaigns();
  for (const [title, desc, keyword, ctaText, destination, imageUrl] of HOME_PROMOTIONS) {
    if (campaigns.some((campaign) => campaign.firstParty === 1 && campaign.title === title)) continue;
    await createAdCampaign({
      title,
      desc,
      imageUrl,
      targetKeyword: keyword,
      creditsBudget: 0,
      campaignType: 'first_party',
      disclosure: 'Kurukoo',
      advertiserName: 'Kurukoo',
      firstParty: 1,
      ctaText,
      destination,
      priority: 120 - HOME_PROMOTIONS.findIndex((item) => item[0] === title),
      targeting: JSON.stringify({ scope: 'authenticated_home', safetyExcluded: true }),
      placement: 'authenticated_home_promotions',
      category: 'everyday',
      country: 'NG',
      region: '',
      frequencyCap: 5,
      assetStatus: 'approved',
      approvedBy: 'Kurukoo',
    });
  }
}

async function renderPlacement(
  req: AuthRequest,
  res: Response,
  placement: string,
  options: { firstPartyOnly?: boolean; limit?: number } = {},
) {
  if (!req.user?.phone) return res.status(401).json({ error: 'Authentication required' });
  if (!allowedPlacements.has(placement)) return res.status(404).json({ error: 'Placement unavailable' });

  const limit = Math.max(1, Math.min(options.limit ?? 1, 12));
  const campaigns = await getRenderableCampaigns({
    firstParty: options.firstPartyOnly ? true : false,
    placements: [placement],
    limit,
    now: Date.now(),
  });
  const selected = options.firstPartyOnly
    ? campaigns
    : campaigns.length
      ? campaigns
      : await getRenderableCampaigns({ placements: [placement], limit, now: Date.now() });

  await Promise.all(selected.map((campaign) => recordAdImpression(Number(campaign.id)).catch(() => false)));
  res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
  return res.json({
    campaigns: selected.map((campaign) => {
      const optimized = optimizeCampaignImage(campaign);
      return {
        id: campaign.id,
        title: campaign.title,
        desc: campaign.desc,
        image: optimized.imageUrl,
        disclosure: campaign.disclosure || 'Sponsored',
        advertiserName: campaign.advertiserName || '',
        destination: campaign.destination || '/chat',
        clickUrl: `/ads/${encodeURIComponent(String(campaign.id))}/click`,
        ctaText: campaign.ctaText || 'Learn more',
        placement: campaign.placement || placement,
      };
    }),
  });
}

router.get('/left-rail', optionalAuthenticateUser, async (req: AuthRequest, res, next) => {
  try { await renderPlacement(req, res, 'authenticated_left_rail'); } catch (error) { next(error); }
});

router.get('/context-rail', optionalAuthenticateUser, async (req: AuthRequest, res, next) => {
  try { await renderPlacement(req, res, 'authenticated_context_rail'); } catch (error) { next(error); }
});

router.get('/desk-content', optionalAuthenticateUser, async (req: AuthRequest, res, next) => {
  try { await renderPlacement(req, res, 'authenticated_desk_content'); } catch (error) { next(error); }
});

router.get('/home-promotions', optionalAuthenticateUser, async (req: AuthRequest, res, next) => {
  try {
    await ensureHomePromotions();
    await renderPlacement(req, res, 'authenticated_home_promotions', { firstPartyOnly: true, limit: 12 });
  } catch (error) {
    next(error);
  }
});

// Individual topics placement routes (one campaign per slot).
router.get('/topics-top-1', optionalAuthenticateUser, async (req: AuthRequest, res, next) => {
  try { await renderPlacement(req, res, 'topics_top_1'); } catch (error) { next(error); }
});

router.get('/topics-top-2', optionalAuthenticateUser, async (req: AuthRequest, res, next) => {
  try { await renderPlacement(req, res, 'topics_top_2'); } catch (error) { next(error); }
});

router.get('/topics-top-3', optionalAuthenticateUser, async (req: AuthRequest, res, next) => {
  try { await renderPlacement(req, res, 'topics_top_3'); } catch (error) { next(error); }
});

router.get('/topics-bottom-1', optionalAuthenticateUser, async (req: AuthRequest, res, next) => {
  try { await renderPlacement(req, res, 'topics_bottom_1'); } catch (error) { next(error); }
});

router.get('/topics-bottom-2', optionalAuthenticateUser, async (req: AuthRequest, res, next) => {
  try { await renderPlacement(req, res, 'topics_bottom_2'); } catch (error) { next(error); }
});

router.get('/topics-bottom-3', optionalAuthenticateUser, async (req: AuthRequest, res, next) => {
  try { await renderPlacement(req, res, 'topics_bottom_3'); } catch (error) { next(error); }
});

router.get('/topics-bottom-large', optionalAuthenticateUser, async (req: AuthRequest, res, next) => {
  try { await renderPlacement(req, res, 'topics_bottom_large'); } catch (error) { next(error); }
});

// Batch endpoint: all Topics page ad slots in one request so the Topics page
// can populate top-1/2/3, bottom-1/2/3 and bottom-large from the admin
// campaign system with a single call. Unauthenticated callers receive an
// empty slots map (no error) so public surfaces degrade gracefully.
router.get('/topics-slots', optionalAuthenticateUser, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.phone) return res.json({ slots: {} });
    const slots: Record<string, unknown[]> = {};
    await Promise.all(TOPICS_PLACEMENTS.map(async (placement) => {
      const campaigns = await getRenderableCampaigns({
        placements: [placement],
        limit: 1,
        now: Date.now(),
      });
      if (!campaigns.length) {
        slots[placement] = [];
        return;
      }
      await Promise.all(campaigns.map((campaign) => recordAdImpression(Number(campaign.id)).catch(() => false)));
      slots[placement] = campaigns.map((campaign) => {
        const optimized = optimizeCampaignImage(campaign);
        return {
          id: campaign.id,
          title: campaign.title,
          desc: campaign.desc,
          image: optimized.imageUrl,
          disclosure: campaign.disclosure || 'Sponsored',
          advertiserName: campaign.advertiserName || '',
          destination: campaign.destination || '/chat',
          clickUrl: `/ads/${encodeURIComponent(String(campaign.id))}/click`,
          ctaText: campaign.ctaText || 'Learn more',
          placement: campaign.placement || placement,
        };
      });
    }));
    res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
    return res.json({ slots });
  } catch (error) {
    next(error);
  }
});

export default router;
