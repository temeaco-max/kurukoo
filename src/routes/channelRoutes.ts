/**
 * Channel webhooks + USSD — extracted from legacyApp during channel consolidation.
 * Single dispatch via channelRegistry; no parallel channel identity stores.
 */
import { Router } from 'express';
import crypto from 'node:crypto';
import { dispatchWebhook } from '../channels/channelRegistry.js';
import { webhookRateLimit } from '../middleware/rateLimit.js';
import { handleSmsDeliveryReport, handleSmsOptOut } from '../channels/smsReceipts.js';
import { recordUssdSessionOutcome } from '../ussd/menus.js';

const router = Router();

function hasValidAfricasTalkingCallbackToken(req: any): boolean {
  const configured = String(process.env.AFRICASTALKING_WEBHOOK_TOKEN || '');
  if (!configured) return process.env.NODE_ENV !== 'production';
  const supplied = String(req.header('x-kurukoo-webhook-token') || req.query?.token || '');
  return supplied.length === configured.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(configured));
}

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
  if (!hasValidAfricasTalkingCallbackToken(req)) return res.status(403).json({ error: 'Invalid SMS callback token' });
  const result = await dispatchWebhook('sms', req.body, req.headers as Record<string, any>);
  res.status(200).json(result);
});

router.post('/webhook/sms/delivery-report', webhookRateLimit, async (req, res) => {
  if (!hasValidAfricasTalkingCallbackToken(req)) return res.status(403).json({ error: 'Invalid SMS callback token' });
  res.status(200).json(await handleSmsDeliveryReport(req.body));
});

router.post('/webhook/sms/opt-out', webhookRateLimit, async (req, res) => {
  if (!hasValidAfricasTalkingCallbackToken(req)) return res.status(403).json({ error: 'Invalid SMS callback token' });
  res.status(200).json(await handleSmsOptOut(req.body));
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
  if (!hasValidAfricasTalkingCallbackToken(req)) return res.status(403).type('text/plain').send('END USSD callback verification failed.');
  const result = await dispatchWebhook('ussd', req.body, req.headers as Record<string, any>);
  res.set('Content-Type', 'text/plain');
  res.send(result.response || '');
});

router.post('/webhook/ussd/session-outcome', webhookRateLimit, async (req, res) => {
  if (!hasValidAfricasTalkingCallbackToken(req)) return res.status(403).json({ error: 'Invalid USSD callback token' });
  res.status(200).json(await recordUssdSessionOutcome(req.body));
});

export default router;
