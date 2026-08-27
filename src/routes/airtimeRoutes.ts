import { Router } from 'express';
import { authenticateUser, type AuthRequest } from '../middleware/auth.js';
import { paymentRateLimit } from '../middleware/rateLimit.js';
import { airtimeAvailability, recordAirtimeDeliveryReport, submitAirtimeActivation } from '../services/africasTalkingAirtime.js';

const router = Router();

router.get('/airtime/status', authenticateUser, (_req: AuthRequest, res) => res.json(airtimeAvailability()));

router.post('/airtime/activate', authenticateUser, paymentRateLimit, async (req: AuthRequest, res) => {
  const ownerPhone = String(req.user?.phone || '').trim();
  const requestId = String(req.body?.economicRequestId || '').trim();
  const recipientPhone = String(req.body?.recipientPhone || '').trim();
  const amountMinor = Number(req.body?.amountMinor);
  const currency = String(req.body?.currency || 'NGN').trim();
  const idempotencyKey = String(req.body?.idempotencyKey || '').trim();
  if (!ownerPhone || !requestId || !recipientPhone || !Number.isSafeInteger(amountMinor) || !idempotencyKey) {
    return res.status(400).json({ success: false, error: 'An owner, Economic Request, international recipient phone, integer amountMinor, and idempotencyKey are required.' });
  }
  try {
    const activation = await submitAirtimeActivation({ ownerPhone, requestId, recipientPhone, amountMinor, currency, idempotencyKey });
    return res.status(activation.status === 'failed' ? 422 : 202).json({
      success: activation.status !== 'failed',
      activation,
      settlement: activation.status === 'accepted' ? 'provider_acceptance_only_delivery_status_required' : 'no_delivery_recorded',
    });
  } catch (error) {
    return res.status(409).json({ success: false, error: error instanceof Error ? error.message : 'Airtime activation could not be submitted.' });
  }
});

/**
 * Africa’s Talking should be configured to call this URL with a per-deployment
 * callback token. The handler stores only a correlated final delivery result.
 */
router.post('/webhooks/africastalking/airtime', async (req, res) => {
  const callbackToken = String(req.header('x-kurukoo-airtime-token') || req.query.token || '');
  const result = await recordAirtimeDeliveryReport({
    callbackToken,
    providerRequestId: String(req.body?.requestId || ''),
    recipientPhone: String(req.body?.phoneNumber || ''),
    status: String(req.body?.status || ''),
    value: String(req.body?.value || ''),
    description: req.body?.description ? String(req.body.description) : undefined,
    discount: req.body?.discount ? String(req.body.discount) : undefined,
  });
  if (!result.accepted) return res.status(403).json({ received: false, status: result.status, message: result.message });
  return res.status(200).json({ received: true, status: result.status, requestId: result.requestId, message: result.message });
});

export default router;
