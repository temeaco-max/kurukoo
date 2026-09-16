/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
/**
 * Subscription entitlement boundary.
 * Identity comes only from the authenticated session; payment references are
 * metadata and are never accepted as proof of settlement.
 */
import { Router } from 'express';
import { authenticateUser, AuthRequest } from '../middleware/auth.js';
import { paymentRateLimit } from '../middleware/rateLimit.js';
import { upgradeSubscriptionAfterPayment, subscribeProviderTier } from '../services/subscriptionService.js';
import { getUserSubscriptionState } from '../services/subscriptionReadService.js';
import { getUserUsage } from '../services/usageReadService.js';

const router = Router();

router.get('/subscription/state', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const phone = req.user?.phone;
    if (!phone) return res.status(401).json({ error: 'Authentication required' });
    res.json(await getUserSubscriptionState(String(phone)));
  } catch (e: any) {
    console.error('Subscription state error:', e);
    res.status(500).json({ error: e.message || 'Failed to read subscription state' });
  }
});

router.get('/usage', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const phone = req.user?.phone;
    if (!phone) return res.status(401).json({ error: 'Authentication required' });
    res.json(await getUserUsage(String(phone)));
  } catch (e: any) {
    console.error('Usage state error:', e);
    res.status(500).json({ error: e.message || 'Failed to read usage state' });
  }
});

router.post('/subscription/upgrade', authenticateUser, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    const phone = req.user?.phone;
    if (!phone) return res.status(401).json({ error: 'Authentication required' });
    if (req.body?.phone && String(req.body.phone) !== String(phone)) return res.status(403).json({ error: 'Forbidden: subscription must use authenticated identity' });
    const plan = String(req.body?.plan || '').trim();
    const country = String(req.body?.country || req.body?.locale || 'ng').trim().toLowerCase();
    const payment_ref = req.body?.payment_ref ? String(req.body.payment_ref) : undefined;
    const result = await upgradeSubscriptionAfterPayment(String(phone), plan, country, { payment_ref });
    if (!result.success) return res.status(result.payment_required ? 402 : result.error === 'plan_not_found' ? 404 : 400).json(result);
    res.json(result);
  } catch (e: any) {
    console.error('Subscription upgrade error:', e);
    res.status(500).json({ error: e.message || 'Failed to upgrade subscription' });
  }
});

router.post('/provider/subscribe', authenticateUser, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    const phone = req.user?.phone;
    if (!phone) return res.status(401).json({ error: 'Authentication required' });
    if (req.body?.phone && String(req.body.phone) !== String(phone)) return res.status(403).json({ error: 'Forbidden: subscription must use authenticated identity' });
    const tier = String(req.body?.tier || '').trim();
    const payment_ref = req.body?.payment_ref ? String(req.body.payment_ref) : undefined;
    const result = await subscribeProviderTier(String(phone), tier, { payment_ref });
    if (!result.success) return res.status(result.payment_required ? 402 : 400).json(result);
    res.json(result);
  } catch (e: any) {
    console.error('Provider subscribe error:', e);
    res.status(500).json({ success: false, error: e.message || 'Internal error' });
  }
});

export default router;
