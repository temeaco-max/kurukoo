import { Router } from 'express';
import { authenticateUser, type AuthRequest } from '../middleware/auth.js';
import { paymentRateLimit } from '../middleware/rateLimit.js';
import { dataBundleAvailability, requeryDataBundleActivation, submitDataBundleActivation } from '../services/vtpassDataBundle.js';

const router = Router();
router.get('/data-bundles/status', authenticateUser, (_req: AuthRequest, res) => res.json(dataBundleAvailability()));
router.post('/data-bundles/activate', authenticateUser, paymentRateLimit, async (req: AuthRequest, res) => {
  const ownerPhone = String(req.user?.phone || '').trim();
  try {
    const activation = await submitDataBundleActivation({
      ownerPhone,
      requestId: String(req.body?.economicRequestId || '').trim(),
      recipientPhone: String(req.body?.recipientPhone || '').trim(),
      network: String(req.body?.network || '').trim(),
      variationCode: String(req.body?.variationCode || '').trim(),
      amountMinor: Number(req.body?.amountMinor),
      currency: String(req.body?.currency || 'NGN').trim(),
      idempotencyKey: String(req.body?.idempotencyKey || '').trim(),
    });
    return res.status(activation.status === 'failed' ? 422 : 202).json({ success: activation.status !== 'failed', activation, settlement: activation.status === 'delivered' ? 'provider_delivery_evidence_recorded' : 'provider_status_evidence_required' });
  } catch (error) { return res.status(409).json({ success: false, error: error instanceof Error ? error.message : 'Data-bundle activation could not be submitted.' }); }
});
router.post('/data-bundles/requery', authenticateUser, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    const status = await requeryDataBundleActivation({ ownerPhone: String(req.user?.phone || ''), providerRequestId: String(req.body?.providerRequestId || '').trim() });
    return res.status(200).json({ success: true, activation: status, settlement: status.status === 'delivered' ? 'provider_delivery_evidence_recorded' : 'provider_status_evidence_required' });
  } catch (error) { return res.status(409).json({ success: false, error: error instanceof Error ? error.message : 'Data-bundle status could not be queried.' }); }
});
export default router;
