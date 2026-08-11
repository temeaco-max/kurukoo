/**
 * Payment-related mutations — points and credits.
 * Identity comes from the authenticated session. Client-supplied payment
 * references are never treated as proof of payment.
 */
import { Router } from 'express';
import { authenticateUser, AuthRequest } from '../middleware/auth.js';
import { paymentRateLimit } from '../middleware/rateLimit.js';
import { addPoints, getPointsBalance, addCredits } from '../services/pointsEngine.js';
import { getProfile } from '../services/memoryProfile.js';

const router = Router();
function configuredPaymentProvider(): string | null {
  const configured = String(process.env.KURUKOO_PAY_PROVIDER || '').trim().toLowerCase();
  if (configured) return configured;
  return process.env.NODE_ENV === 'production' ? null : 'sandbox';
}

router.get('/points/balance', authenticateUser, async (req: AuthRequest, res) => {
  const phone = req.user?.phone ? String(req.user.phone) : null;
  if (!phone) return res.status(401).json({ error: 'Authenticated phone is required' });
  if (req.query.phone && String(req.query.phone) !== phone) return res.status(403).json({ error: 'You can only view your own balance' });
  try { const balance = await getPointsBalance(phone); const profile = await getProfile(phone, 'points_query'); res.json({ success: true, points: balance, tier: profile?.subscription_tier || 'Base', currency: 'NGN' }); }
  catch (e: any) { res.status(500).json({ error: e.message || 'Failed to fetch points balance' }); }
});

router.post('/points/topup', authenticateUser, paymentRateLimit, async (req: AuthRequest, res) => {
  const phone = req.user?.phone ? String(req.user.phone) : null; if (!phone) return res.status(401).json({ error: 'Authenticated phone is required' });
  if (req.body?.phone && String(req.body.phone) !== phone) return res.status(403).json({ error: 'Top-up must use authenticated identity' });
  const points = Number(req.body?.amount_points); if (!Number.isInteger(points) || points <= 0) return res.status(400).json({ error: 'amount_points must be a positive integer' });
  const provider = configuredPaymentProvider();
  if (process.env.NODE_ENV === 'production' || provider !== 'sandbox') return res.status(503).json({ error: 'Verified payment provider integration is required before production top-ups are enabled', payment_required: true });
  try { await addPoints(phone, points, 'Sandbox top-up'); const newBalance = await getPointsBalance(phone); res.json({ success: true, message: `Credited ${points} sandbox Points.`, balance: newBalance }); }
  catch (e: any) { res.status(500).json({ error: e.message || 'Failed to top up points' }); }
});

router.post('/credits/topup', authenticateUser, paymentRateLimit, async (req: AuthRequest, res) => {
  const phone = req.user?.phone ? String(req.user.phone) : null; if (!phone) return res.status(401).json({ error: 'Authenticated phone is required' });
  if (req.body?.phone && String(req.body.phone) !== phone) return res.status(403).json({ error: 'Credit top-up must use authenticated identity' });
  const amount = Number(req.body?.amount); if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Valid positive amount is required' });
  const provider = configuredPaymentProvider();
  if (process.env.NODE_ENV === 'production' || provider !== 'sandbox') return res.status(503).json({ success: false, error: 'Verified payment provider integration is required before production credit top-ups are enabled', payment_required: true });
  try { const profile = await getProfile(phone, 'credit_topup'); const fcmToken = req.body?.fcmToken || req.headers['x-fcm-token']; if (profile?.fcm_token && (!fcmToken || fcmToken !== profile.fcm_token)) return res.status(403).json({ success: false, error: 'Device session token mismatch or missing.' }); await addCredits(phone, amount, 'Sandbox credit top-up'); res.json({ success: true }); }
  catch (e: any) { res.status(500).json({ success: false, error: e.message || 'Failed to top up credits' }); }
});
export default router;
