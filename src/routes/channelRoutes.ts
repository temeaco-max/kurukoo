/**
 * Channel webhooks + USSD — extracted from legacyApp during channel consolidation.
 * Single dispatch via channelRegistry; no parallel channel identity stores.
 */
import { Router } from 'express';
import { dispatchWebhook } from '../channels/channelRegistry.js';
import { webhookRateLimit } from '../middleware/rateLimit.js';

const router = Router();

// Meta verifies the callback endpoint before sending WhatsApp events. A token is
// required so arbitrary public endpoints cannot be registered as Kurukoo's channel.
router.get('/webhook/whatsapp', (req, res) => {
  const verifyToken = String(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '');
  const mode = String(req.query['hub.mode'] || '');
  const supplied = String(req.query['hub.verify_token'] || '');
  const challenge = String(req.query['hub.challenge'] || '');
  if (!verifyToken || mode !== 'subscribe' || !challenge || supplied !== verifyToken) {
    return res.status(403).send('Webhook verification failed');
  }
  return res.status(200).type('text/plain').send(challenge);
});

router.post('/webhook/whatsapp', webhookRateLimit, async (req, res) => {
  const rawBody = (req as any).rawBody;
  const result = await dispatchWebhook('whatsapp', req.body, req.headers as Record<string, any>, rawBody);
  res.status(200).json(result);
});

router.post('/webhook/telegram', webhookRateLimit, async (req, res) => {
  const result = await dispatchWebhook('telegram', req.body, req.headers as Record<string, any>);
  res.status(200).json(result);
});

router.post('/webhook/sms', webhookRateLimit, async (req, res) => {
  const result = await dispatchWebhook('sms', req.body, req.headers as Record<string, any>);
  res.status(200).json(result);
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

router.post('/ussd', webhookRateLimit, async (req, res) => {
  const result = await dispatchWebhook('ussd', req.body, req.headers as Record<string, any>);
  res.set('Content-Type', 'text/plain');
  res.send(result.response || '');
});

export default router;
