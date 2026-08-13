import { Router } from 'express';
import { authenticateAdmin, authenticateUser, type AuthRequest } from '../middleware/auth.js';
import {
  createAffiliateMerchant,
  createAffiliateOffer,
  getAffiliateMetrics,
  listAffiliateMerchants,
  listPublicAffiliateOffers,
  recordAffiliateClick,
  recordAffiliateConversion,
  updateAffiliateMerchant,
  updateAffiliateOffer,
} from '../services/affiliateService.js';

const router = Router();

/** Disclosed referral offers are available only to authenticated Kurukoo identities. */
router.get('/affiliate/offers', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const country = typeof req.query.country === 'string' ? req.query.country : undefined;
    const offers = await listPublicAffiliateOffers(country);
    res.json({
      offers,
      boundary: 'Affiliate offers are external merchant referrals. They are not verified Kurukoo providers, quotes, availability, payment, dispatch, or fulfilment evidence.',
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to list affiliate offers' });
  }
});

router.get('/affiliate/offers/:offerId/visit', authenticateUser, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.phone) return res.status(401).json({ error: 'Authenticated phone identity is required' });
    const result = await recordAffiliateClick({ offerId: req.params.offerId, phone: req.user.phone });
    // A recipient deliberately follows this endpoint after seeing the disclosure.
    res.redirect(302, result.destinationUrl);
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : 'Affiliate offer is unavailable' });
  }
});

router.get('/admin/affiliate/merchants', authenticateAdmin, async (_req: AuthRequest, res) => {
  try { res.json({ merchants: await listAffiliateMerchants() }); }
  catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to list affiliate merchants' }); }
});

router.post('/admin/affiliate/merchants', authenticateAdmin, async (req: AuthRequest, res) => {
  try { res.status(201).json({ merchant: await createAffiliateMerchant(req.body || {}) }); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create affiliate merchant' }); }
});

router.put('/admin/affiliate/merchants/:merchantId', authenticateAdmin, async (req: AuthRequest, res) => {
  try { res.json({ merchant: await updateAffiliateMerchant({ ...(req.body || {}), id: req.params.merchantId }) }); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to update affiliate merchant' }); }
});

router.post('/admin/affiliate/offers', authenticateAdmin, async (req: AuthRequest, res) => {
  try { res.status(201).json({ offer: await createAffiliateOffer(req.body || {}) }); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create affiliate offer' }); }
});

router.put('/admin/affiliate/offers/:offerId', authenticateAdmin, async (req: AuthRequest, res) => {
  try { res.json({ offer: await updateAffiliateOffer({ ...(req.body || {}), id: req.params.offerId }) }); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to update affiliate offer' }); }
});

router.post('/admin/affiliate/conversions', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const conversion = await recordAffiliateConversion(req.body || {});
    res.status(conversion.duplicate ? 200 : 201).json({ conversion });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to record affiliate conversion' });
  }
});

router.get('/admin/affiliate/metrics', authenticateAdmin, async (_req: AuthRequest, res) => {
  try { res.json({ metrics: await getAffiliateMetrics() }); }
  catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to calculate affiliate metrics' }); }
});

export default router;
