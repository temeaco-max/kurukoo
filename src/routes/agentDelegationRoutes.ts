import { Router } from 'express';
import { authenticateUser, type AuthRequest } from '../middleware/auth.js';
import { processDirectPayment } from '../services/directWallet.js';
import { ensureCommercialSchema, createUserAgentDelegation, listUserAgentDelegations, recordCommercialEvent, setUserAgentDelegationInstructions } from '../services/commercialLedger.js';
import { executeDelegatedAgentWithCanonicalRun } from '../services/agentDelegationOperatingModel.js';
import { getDb } from '../database.js';

const router = Router();

router.get('/delegations', authenticateUser, async (req: AuthRequest, res) => {
  const phone = String(req.user?.phone || '');
  if (!phone) return res.status(401).json({ error: 'Authenticated owner is required.' });
  try { res.json({ success: true, delegations: await listUserAgentDelegations(phone) }); }
  catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to list delegated agents.' }); }
});

router.post('/delegations', authenticateUser, async (req: AuthRequest, res) => {
  const phone = String(req.user?.phone || '');
  const skill = String(req.body?.skill || '').trim().slice(0, 120);
  if (!phone || !skill) return res.status(400).json({ error: 'skill is required.' });
  try {
    await ensureCommercialSchema(); const db = await getDb();
    const code = `agent_service:${skill}`;
    const stmt = db.prepare(`SELECT price_minor,currency,active FROM commercial_products WHERE code IN (?, 'agent_service') AND active=1 ORDER BY CASE WHEN code=? THEN 0 ELSE 1 END LIMIT 1`); stmt.bind([code,code]);
    const row = stmt.step() ? stmt.getAsObject() as any : { price_minor: 0, currency: 'NGN', active: 1 }; stmt.free();
    const priceMinor = Math.max(0, Number(row.price_minor || 0));
    const currency = String(row.currency || 'NGN').trim().toUpperCase();
    const created = await createUserAgentDelegation({ ownerPhone: phone, skill, baseAgentId: req.body?.baseAgentId ? String(req.body.baseAgentId) : undefined, instructions: req.body?.instructions ? String(req.body.instructions) : '', authority: typeof req.body?.authority === 'object' ? req.body.authority : {}, monthlyPriceMinor: priceMinor, currency, allowDonations: Boolean(req.body?.allowDonations), donationRecipient: req.body?.donationRecipient ? String(req.body.donationRecipient).trim() : undefined });
    res.status(201).json({ success: true, ...created, paymentRequired: priceMinor > 0 });
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create delegated agent.' }); }
});

router.post('/delegations/:id/subscribe', authenticateUser, async (req: AuthRequest, res) => {
  const phone = String(req.user?.phone || ''); const delegationId = String(req.params.id || '');
  if (!phone || !delegationId) return res.status(400).json({ error: 'Delegation is required.' });
  try {
    await ensureCommercialSchema(); const db = await getDb(); const stmt = db.prepare(`SELECT agent_id,skill,monthly_price_minor,currency,status FROM agent_delegations WHERE id=? AND owner_phone=?`); stmt.bind([delegationId,phone]); if (!stmt.step()) { stmt.free(); return res.status(404).json({ error: 'Delegated agent not found.' }); }
    const row = stmt.getAsObject() as any; stmt.free(); if (row.status !== 'active') return res.status(409).json({ error: 'Delegated agent is not active.' });
    const amountMinor = Number(row.monthly_price_minor || 0); const currency = String(row.currency || 'NGN').toUpperCase();
    if (amountMinor <= 0) return res.json({ success: true, paid: false, message: 'This delegated agent is currently free.' });
    const paid = await processDirectPayment(phone, 'SYSTEM', amountMinor / 100);
    if (!paid) return res.status(402).json({ success: false, payment_required: true, amountMinor, currency, message: 'Verified payment is required to activate this delegated agent.' });
    await recordCommercialEvent({ eventType: 'agent_subscription', direction: 'inbound', status: 'settled', currency, grossMinor: amountMinor, platformFeeMinor: amountMinor, providerAmountMinor: 0, payer: phone, payee: 'KURUKOO', representedParty: phone, agentId: String(row.agent_id), skill: String(row.skill), idempotencyKey: `agent_subscription:${delegationId}:${new Date().toISOString().slice(0,7)}`, metadata: { billingPeriod: 'monthly' } });
    res.json({ success: true, paid: true, amountMinor, currency, agentId: String(row.agent_id) });
  } catch (error) { res.status(503).json({ error: error instanceof Error ? error.message : 'Unable to activate delegated agent.', payment_required: true }); }
});

router.patch('/delegations/:id', authenticateUser, async (req: AuthRequest, res) => {
  const phone = String(req.user?.phone || ''); const delegationId = String(req.params.id || '');
  if (!phone || !delegationId) return res.status(400).json({ error: 'Delegation is required.' });
  try { const ok = await setUserAgentDelegationInstructions(phone, delegationId, String(req.body?.instructions || ''), typeof req.body?.authority === 'object' ? req.body.authority : {}); if (!ok) return res.status(404).json({ error: 'Delegated agent not found.' }); res.json({ success: true }); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to update delegation.' }); }
});

router.post('/delegations/:id/execute', authenticateUser, async (req: AuthRequest, res) => {
  const phone = String(req.user?.phone || ''); const delegationId = String(req.params.id || ''); const task = String(req.body?.task || '').trim(); const action = req.body?.action ? String(req.body.action).trim().slice(0, 120) : undefined;
  if (!phone || !delegationId || !task) return res.status(400).json({ error: 'A delegated agent and task are required.' });
  if (task.length > 12000) return res.status(413).json({ error: 'Task is too large.' });
  try {
    const delegations = await listUserAgentDelegations(phone);
    const selected = delegations.find(item => String(item.id) === delegationId);
    if (!selected) return res.status(404).json({ error: 'Delegated agent not found.' });
    res.json(await executeDelegatedAgentWithCanonicalRun(phone, delegationId, String(selected.skill || ''), task, action));
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to execute delegated agent.' }); }
});

export default router;
