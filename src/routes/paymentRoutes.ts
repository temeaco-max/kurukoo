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
import { getEconomicRequest, transitionEconomicRequest } from '../services/skillFlows.js';
import { lockEscrowForEconomicRequest } from '../services/tradeEngine.js';
import { createStripePaymentIntent, stripeStatus, verifyStripeWebhook } from '../services/stripePayment.js';
import { getDb, saveDb } from '../database.js';

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

router.get('/payments/stripe/status', authenticateUser, (_req: AuthRequest, res) => res.json(stripeStatus()));

router.post('/payments/stripe/intents', authenticateUser, paymentRateLimit, async (req: AuthRequest, res) => {
  const phone = req.user?.phone ? String(req.user.phone) : null;
  const requestId = typeof req.body?.economicRequestId === 'string' ? req.body.economicRequestId.trim() : '';
  if (!phone || !requestId) return res.status(400).json({ error: 'An authenticated owner and Economic Request are required.' });
  const request = await getEconomicRequest(requestId);
  if (!request || request.phone !== phone) return res.status(404).json({ error: 'That Economic Request is unavailable.' });
  const quote = request.quote as Record<string, unknown> | undefined;
  const amountMinor = typeof quote?.amount_minor === 'number' ? quote.amount_minor : 0;
  const currency = typeof quote?.currency === 'string' ? quote.currency : 'GBP';
  if (!['quoted', 'awaiting_confirmation', 'payment_pending'].includes(request.status) || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) return res.status(409).json({ error: 'A current confirmed quote is required before payment can begin.' });
  try {
    const intent = await createStripePaymentIntent({ amountMinor, currency, economicRequestId: request.id, idempotencyKey: `kurukoo:stripe:${request.id}:${amountMinor}:${currency}` });
    if (request.status !== 'payment_pending') await transitionEconomicRequest(request.id, 'payment_pending', { fulfillment: { ...(request.fulfillment || {}), payment_provider: 'stripe', payment_intent_id: intent.id, payment_started_at: new Date().toISOString() } });
    res.json({ provider: 'stripe', paymentIntentId: intent.id, clientSecret: intent.clientSecret, amountMinor: intent.amountMinor, currency: intent.currency, status: intent.status });
  } catch (error) { res.status(503).json({ error: error instanceof Error ? error.message : 'Payment provider is unavailable.', payment_required: true }); }
});

/** Public only to Stripe; raw request bytes are signature-verified before any state change. */
router.post('/webhooks/stripe', async (req, res) => {
  const event = verifyStripeWebhook((req as any).rawBody as Buffer, req.header('stripe-signature'));
  if (!event) return res.status(400).json({ error: 'Invalid Stripe webhook signature.' });
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS payment_webhook_events (provider TEXT NOT NULL, event_id TEXT NOT NULL, received_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(provider, event_id))`);
  const exists = db.prepare(`SELECT event_id FROM payment_webhook_events WHERE provider='stripe' AND event_id=?`); exists.bind([event.id]); const duplicate = exists.step(); exists.free();
  if (duplicate) return res.status(200).json({ received: true, duplicate: true });
  db.run(`INSERT INTO payment_webhook_events(provider,event_id) VALUES ('stripe',?)`, [event.id]); saveDb();
  const payment = event.data?.object;
  const requestId = payment?.metadata?.economic_request_id;
  if (!requestId || !payment?.id) return res.status(200).json({ received: true, ignored: true });
  const request = await getEconomicRequest(requestId);
  if (!request) return res.status(200).json({ received: true, ignored: true });
  const quote = request.quote as Record<string, unknown> | undefined;
  if (event.type === 'payment_intent.succeeded' && payment.status === 'succeeded' && Number(payment.amount) === Number(quote?.amount_minor) && String(payment.currency || '').toLowerCase() === String(quote?.currency || '').toLowerCase()) {
    try {
      await transitionEconomicRequest(request.id, 'paid', { fulfillment: { ...(request.fulfillment || {}), payment_verified: true, payment_provider: 'stripe', payment_reference: payment.id, payment_event_id: event.id, payment_verified_at: new Date().toISOString() } });
      await lockEscrowForEconomicRequest(request.id, Number(payment.amount));
    } catch (error) { db.run(`DELETE FROM payment_webhook_events WHERE provider='stripe' AND event_id=?`, [event.id]); saveDb(); console.error('[Stripe] verified payment transition failed', { eventId: event.id, requestId, message: error instanceof Error ? error.message : 'unknown' }); return res.status(500).json({ error: 'Payment reconciliation failed; retry is safe.' }); }
  }
  res.status(200).json({ received: true });
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
