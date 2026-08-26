/**
 * Channel webhooks + USSD — extracted from legacyApp during channel consolidation.
 * Single dispatch via channelRegistry; no parallel channel identity stores.
 */
import { Router } from 'express';
import { dispatchWebhook } from '../channels/channelRegistry.js';
import { webhookRateLimit } from '../middleware/rateLimit.js';
import { recordAirtimeCallback } from '../services/airtimeService.js';

const router = Router();

function webhookStatus(result: { status?: string; error?: string }): number {
  if (result.status !== 'error') return 200;
  return /signature|secret|auth/i.test(String(result.error || '')) ? 401 : 502;
}

router.get('/webhook/whatsapp', (req, res) => {
  const mode = String(req.query['hub.mode'] || '');
  const token = String(req.query['hub.verify_token'] || '');
  const challenge = String(req.query['hub.challenge'] || '');
  const configured = String(process.env.WHATSAPP_VERIFY_TOKEN || '');
  if (mode === 'subscribe' && Boolean(configured) && token === configured && challenge) return res.status(200).type('text/plain').send(challenge);
  return res.status(403).json({ error: 'WhatsApp webhook verification failed' });
});

router.post('/webhook/whatsapp', webhookRateLimit, async (req, res) => {
  const rawBody = (req as any).rawBody;
  const result = await dispatchWebhook('whatsapp', req.body, req.headers as Record<string, any>, rawBody);
  res.status(webhookStatus(result)).json(result);
});

router.post('/webhook/telegram', webhookRateLimit, async (req, res) => {
  const result = await dispatchWebhook('telegram', req.body, req.headers as Record<string, any>);
  res.status(webhookStatus(result)).json(result);
});

router.post('/webhook/sms', webhookRateLimit, async (req, res) => {
  const result = await dispatchWebhook('sms', req.body, req.headers as Record<string, any>);
  res.status(webhookStatus(result)).json(result);
});

router.post('/webhook/email', webhookRateLimit, async (req, res) => {
  const rawBody = (req as any).rawBody;
  if (!rawBody) return res.status(400).json({ error: 'Raw webhook body unavailable' });
  try {
    const result = await dispatchWebhook('email', req.body, req.headers as Record<string, any>, rawBody);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid email webhook' });
  }
});

router.post('/airtime', webhookRateLimit, async (req, res) => {
  try {
    const outcome = await recordAirtimeCallback(req.body && typeof req.body === 'object' ? req.body : {});
    res.status(200).json({ received: true, duplicate: outcome.duplicate, operationId: outcome.operation?.id, status: outcome.operation?.status });
  } catch {
    res.status(502).json({ received: false, error: 'airtime_callback_processing_failed' });
  }
});

router.post('/ussd', webhookRateLimit, async (req, res) => {
  const result = await dispatchWebhook('ussd', req.body, req.headers as Record<string, any>);
  res.set('Content-Type', 'text/plain');
  res.send(result.response || '');
});

export default router;
