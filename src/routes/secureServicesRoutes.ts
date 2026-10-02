/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
/**
 * Routes for the secure execution and payment-protection capabilities:
 *   - Secure credential store (agent-blind secrets)
 *   - One-time cards + purchase protections
 *   - Secure execution environment (sandboxed browser / VM)
 *   - Execution audit timeline
 * All routes require authentication and are gated by feature flags.
 */
import { Router } from 'express';
import { authenticateUser, type AuthRequest } from '../middleware/auth.js';
import { isFeatureEnabled } from '../services/featureFlags.js';
import { storeCredential, listCredentialMetadata, getEncryptedCredential, markCredentialUsed, deleteCredential, countCredentials } from '../services/secureCredentialStore.js';
import { createVirtualCard, listVirtualCards, getVirtualCard, freezeCard, cancelCard, fileProtectionClaim, listProtectionClaims, resolveProtectionClaim } from '../services/oneTimeCardService.js';
import { createSession, listSessions, getSession, queueAction, listActions, stopSession } from '../services/secureExecutionEnvironment.js';
import { getAuditTimeline, getAuditEntry, exportAuditTimeline } from '../services/executionAuditService.js';

const router = Router();
router.use(authenticateUser);

const gate = (flag: string) => (req: AuthRequest, res: any, next: any) => {
  const phone = req.user?.phone;
  if (!phone) return res.status(401).json({ error: 'Authenticated phone required' });
  if (!isFeatureEnabled('gb', flag)) return res.status(403).json({ error: 'Feature not available in your market', flag });
  next();
};

// ── Secure Credential Store ──────────────────────────────────────────────
router.get('/credentials', gate('secure_credentials'), async (req: AuthRequest, res) => {
  try {
    const meta = await listCredentialMetadata(req.user!.phone!);
    const count = await countCredentials(req.user!.phone!);
    res.json({ success: true, credentials: meta, count });
  } catch (e) { res.status(500).json({ error: 'Unable to list credentials' }); }
});

router.post('/credentials', gate('secure_credentials'), async (req: AuthRequest, res) => {
  try {
    const { label, ciphertext, iv, salt, domain, credentialType, expiresAt } = req.body || {};
    if (!label || !ciphertext || !iv || !salt) return res.status(400).json({ error: 'label, ciphertext, iv, salt required' });
    const stored = await storeCredential(req.user!.phone!, label, { ciphertext, iv, salt }, { domain, credentialType, expiresAt });
    res.json({ success: true, id: stored.id, label: stored.label });
  } catch (e) { res.status(500).json({ error: 'Unable to store credential' }); }
});

router.get('/credentials/:id', gate('secure_credentials'), async (req: AuthRequest, res) => {
  try {
    const cred = await getEncryptedCredential(req.user!.phone!, req.params.id);
    if (!cred) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, credential: { id: cred.id, label: cred.label, domain: cred.domain, credentialType: cred.credentialType, ciphertext: cred.ciphertext, iv: cred.iv, salt: cred.salt, algorithm: cred.algorithm, iterations: cred.iterations, expiresAt: cred.expiresAt } });
  } catch (e) { res.status(500).json({ error: 'Unable to fetch credential' }); }
});

router.post('/credentials/:id/use', gate('secure_credentials'), async (req: AuthRequest, res) => {
  try { const ok = await markCredentialUsed(req.user!.phone!, req.params.id); res.json({ success: ok }); }
  catch (e) { res.status(500).json({ error: 'Unable to mark used' }); }
});

router.delete('/credentials/:id', gate('secure_credentials'), async (req: AuthRequest, res) => {
  try { const ok = await deleteCredential(req.user!.phone!, req.params.id); res.json({ success: ok }); }
  catch (e) { res.status(500).json({ error: 'Unable to delete credential' }); }
});

// ── One-Time Cards + Purchase Protections ───────────────────────────────
router.get('/cards', gate('one_time_cards'), async (req: AuthRequest, res) => {
  try { res.json({ success: true, cards: await listVirtualCards(req.user!.phone!) }); }
  catch (e) { res.status(500).json({ error: 'Unable to list cards' }); }
});

router.post('/cards', gate('one_time_cards'), async (req: AuthRequest, res) => {
  try {
    const { spendLimitMinor, currency, merchantLock, expiresInHours } = req.body || {};
    if (!spendLimitMinor) return res.status(400).json({ error: 'spendLimitMinor required' });
    const card = await createVirtualCard(req.user!.phone!, { spendLimitMinor, currency, merchantLock, expiresInHours });
    res.json({ success: true, card: { id: card.id, last4: card.last4, brand: card.brand, status: card.status, spendLimitMinor: card.spendLimitMinor, currency: card.currency, expiresAt: card.expiresAt } });
  } catch (e) { res.status(500).json({ error: 'Unable to create card' }); }
});

router.post('/cards/:id/freeze', gate('one_time_cards'), async (req: AuthRequest, res) => {
  try { const ok = await freezeCard(req.user!.phone!, req.params.id); res.json({ success: ok }); }
  catch (e) { res.status(500).json({ error: 'Unable to freeze card' }); }
});

router.delete('/cards/:id', gate('one_time_cards'), async (req: AuthRequest, res) => {
  try { const ok = await cancelCard(req.user!.phone!, req.params.id); res.json({ success: ok }); }
  catch (e) { res.status(500).json({ error: 'Unable to cancel card' }); }
});

router.get('/protections', gate('one_time_cards'), async (req: AuthRequest, res) => {
  try { res.json({ success: true, claims: await listProtectionClaims(req.user!.phone!) }); }
  catch (e) { res.status(500).json({ error: 'Unable to list claims' }); }
});

router.post('/protections', gate('one_time_cards'), async (req: AuthRequest, res) => {
  try {
    const { cardId, orderRef, amountMinor, currency, reason, evidence } = req.body || {};
    if (!cardId || !orderRef || !amountMinor || !reason) return res.status(400).json({ error: 'cardId, orderRef, amountMinor, reason required' });
    const claim = await fileProtectionClaim(req.user!.phone!, cardId, { orderRef, amountMinor, currency, reason, evidence });
    res.json({ success: true, id: claim.id, status: claim.status });
  } catch (e) { res.status(500).json({ error: 'Unable to file claim' }); }
});

// ── Secure Execution Environment ────────────────────────────────────────
router.get('/execution/sessions', gate('secure_execution'), async (req: AuthRequest, res) => {
  try { res.json({ success: true, sessions: await listSessions(req.user!.phone!) }); }
  catch (e) { res.status(500).json({ error: 'Unable to list sessions' }); }
});

router.post('/execution/sessions', gate('secure_execution'), async (req: AuthRequest, res) => {
  try {
    const { ttlMinutes, metadata } = req.body || {};
    const session = await createSession(req.user!.phone!, { ttlMinutes, metadata });
    res.json({ success: true, session: { id: session.id, status: session.status, expiresAt: session.expiresAt } });
  } catch (e) { res.status(500).json({ error: 'Unable to create session' }); }
});

router.get('/execution/sessions/:id', gate('secure_execution'), async (req: AuthRequest, res) => {
  try {
    const session = await getSession(req.user!.phone!, req.params.id);
    if (!session) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, session });
  } catch (e) { res.status(500).json({ error: 'Unable to fetch session' }); }
});

router.post('/execution/sessions/:id/actions', gate('secure_execution'), async (req: AuthRequest, res) => {
  try {
    const { type, payload } = req.body || {};
    if (!type) return res.status(400).json({ error: 'action type required' });
    const action = await queueAction(req.user!.phone!, req.params.id, type, payload);
    res.json({ success: true, id: action.id, status: action.status });
  } catch (e: any) {
    if (e.message === 'provider_required') return res.status(503).json({ error: 'provider_required', message: 'Secure execution provider not configured' });
    res.status(500).json({ error: 'Unable to queue action' });
  }
});

router.get('/execution/sessions/:id/actions', gate('secure_execution'), async (req: AuthRequest, res) => {
  try { res.json({ success: true, actions: await listActions(req.user!.phone!, req.params.id) }); }
  catch (e) { res.status(500).json({ error: 'Unable to list actions' }); }
});

router.delete('/execution/sessions/:id', gate('secure_execution'), async (req: AuthRequest, res) => {
  try { const ok = await stopSession(req.user!.phone!, req.params.id); res.json({ success: ok }); }
  catch (e) { res.status(500).json({ error: 'Unable to stop session' }); }
});

// ── Execution Audit Timeline ────────────────────────────────────────────
router.get('/audit', gate('execution_audit'), async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
    const timeline = await getAuditTimeline(req.user!.phone!, limit);
    res.json({ success: true, timeline });
  } catch (e) { res.status(500).json({ error: 'Unable to load audit timeline' }); }
});

router.get('/audit/export', gate('execution_audit'), async (req: AuthRequest, res) => {
  try {
    const data = await exportAuditTimeline(req.user!.phone!);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="kurukoo-audit-export.json"');
    res.json({ success: true, export: data });
  } catch (e) { res.status(500).json({ error: 'Unable to export audit' }); }
});

router.get('/audit/:id', gate('execution_audit'), async (req: AuthRequest, res) => {
  try {
    const entry = await getAuditEntry(req.user!.phone!, req.params.id);
    if (!entry) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, entry });
  } catch (e) { res.status(500).json({ error: 'Unable to fetch entry' }); }
});

export default router;



