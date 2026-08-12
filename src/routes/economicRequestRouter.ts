import { Router } from 'express';
import crypto from 'crypto';
import { authenticateAdmin, authenticateUser, type AuthRequest } from '../middleware/auth.js';
import { getDb } from '../database.js';
import {
  ECONOMIC_CATEGORIES,
  getEconomicCategory,
  getDefaultCapabilities,
  getSkillFlow,
  getSkillRequirements,
  createEconomicRequest,
  getEconomicRequest,
  transitionEconomicRequest,
  type EconomicRequestStatus,
} from '../services/skillFlows.js';
import {
  runOrchestrationPass,
  lockEscrowForEconomicRequest,
  completeEconomicRequest,
} from '../services/tradeEngine.js';
import {
  runDailyMemoryDecay,
  runWeeklyMemoryPrune,
  runMemoryCrystallize,
  getWorkingContextInspector,
  ensureLivingMemorySchema,
} from '../services/livingMemoryEngine.js';
import { startStorefrontSession, advanceStorefront } from '../services/agenticStorefront.js';
import { getAiQuotaStatus } from '../services/aiQuotaService.js';
import {
  addEconomicParticipant,
  attachEconomicOffer,
  getEconomicRequestCoordination,
  getEconomicParticipants,
  updateEconomicParticipant,
  searchKnownEconomicOffers,
  startKnownOfferEconomicRequest,
  getDeliveryCandidates,
  selectDeliveryCandidate,
  type EconomicParticipantRole,
  type EconomicParticipantStatus,
} from '../services/economicParticipants.js';
import {
  createExecutionRequest,
  dispatchExecutionRequest,
  getExecutionRequestsForRequest,
} from '../services/executionConnector.js';

const router = Router();

const ALLOWED_STATUSES = new Set<EconomicRequestStatus>([
  'requested', 'awaiting_match', 'partially_matched', 'matched', 'quoting', 'quoted',
  'awaiting_confirmation', 'reserved', 'payment_pending', 'paid', 'in_fulfillment',
  'fulfilled', 'completed', 'cancelled', 'disputed', 'failed', 'abandoned',
]);

function phoneFrom(req: AuthRequest): string | null {
  return req.user?.phone ? String(req.user.phone) : null;
}

function cleanRequirements(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(input).filter(([key]) => /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key))
  );
}

function requiredRequirementKeys(skill: string): string[] {
  return getSkillRequirements(skill).filter((requirement) => requirement.required).map((requirement) => requirement.key);
}

function validateRequirements(skill: string, requirements: Record<string, unknown>, allowPartial: boolean): string[] {
  if (allowPartial) return [];
  return requiredRequirementKeys(skill).filter((key) => {
    const value = requirements[key];
    return value === undefined || value === null || (typeof value === 'string' && !value.trim());
  });
}

router.get('/categories', async (_req: AuthRequest, res) =>
  res.json({
    success: true,
    categories: ECONOMIC_CATEGORIES.map((category) => ({
      id: category,
      capabilities: getDefaultCapabilities(category),
    })),
  })
);

router.get('/skills/:skill/flow', async (req: AuthRequest, res) => {
  const skill = String(req.params.skill || '').trim().toLowerCase();
  const category = getEconomicCategory(skill);
  if (!category) return res.status(404).json({ success: false, error: 'Unknown economic skill' });
  const flow = await getSkillFlow(skill);
  res.json({
    success: true,
    skill,
    category,
    flow,
    requiredRequirements: getSkillRequirements(skill).filter((requirement) => requirement.required),
    requirements: getSkillRequirements(skill),
    capabilities: flow?.capabilities || getDefaultCapabilities(category),
  });
});

router.post('/storefront/start', authenticateUser, async (req: AuthRequest, res) => {
  const phone = phoneFrom(req);
  if (!phone) return res.status(401).json({ success: false, error: 'Authenticated phone is required' });
  const skill = typeof req.body?.skill === 'string' ? req.body.skill.trim().toLowerCase() : 'find_worker';
  const requirements = cleanRequirements(req.body?.requirements);
  try {
    const card = await startStorefrontSession(phone, skill, requirements);
    res.status(201).json({ success: true, card });
  } catch (error) {
    console.error('[Storefront] start failed:', error);
    res.status(500).json({ success: false, error: 'Unable to start storefront session' });
  }
});

router.post('/storefront/:id/advance', authenticateUser, async (req: AuthRequest, res) => {
  const phone = phoneFrom(req);
  if (!phone) return res.status(401).json({ success: false, error: 'Authenticated phone is required' });
  const requestId = String(req.params.id || '');
  const action = typeof req.body?.action === 'string' ? req.body.action : undefined;
  const patch = cleanRequirements(req.body?.requirements || req.body?.fields);
  try {
    const card = await advanceStorefront(phone, requestId, patch, action);
    res.json({ success: true, card });
  } catch (error) {
    console.error('[Storefront] advance failed:', error);
    res.status(500).json({ success: false, error: 'Unable to advance storefront' });
  }
});

router.get('/ai-quota', authenticateUser, async (req: AuthRequest, res) => {
  const phone = phoneFrom(req);
  if (!phone) return res.status(401).json({ success: false, error: 'Authenticated phone is required' });
  try {
    const status = await getAiQuotaStatus(phone);
    res.json({ success: true, quota: status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Unable to load AI quota' });
  }
});

router.post('/', authenticateUser, async (req: AuthRequest, res) => {
  const phone = phoneFrom(req);
  const skill = typeof req.body?.skill === 'string' ? req.body.skill.trim().toLowerCase() : '';
  const category = getEconomicCategory(skill);
  if (!phone) return res.status(401).json({ success: false, error: 'Authenticated phone is required' });
  if (!skill || !category) return res.status(400).json({ success: false, error: 'A supported economic skill is required' });
  const requirements = cleanRequirements(req.body?.requirements);
  const missing = validateRequirements(skill, requirements, req.body?.allowPartial === true);
  if (missing.length) return res.status(422).json({ success: false, error: 'More information is required', missing });
  try {
    const request = await createEconomicRequest({
      id: crypto.randomUUID(),
      phone,
      skill,
      requirements,
      amount:
        typeof req.body?.amount === 'number' && Number.isFinite(req.body.amount)
          ? req.body.amount
          : undefined,
    });
    res.status(201).json({ success: true, request });
  } catch (error) {
    console.error('[EconomicRequest] create failed:', error);
    res.status(500).json({ success: false, error: 'Unable to create economic request' });
  }
});

router.get('/offers/search', authenticateUser, async (req: AuthRequest, res) => {
  const phone = phoneFrom(req);
  if (!phone) return res.status(401).json({ success: false, error: 'Authenticated phone is required' });
  try {
    const offers = await searchKnownEconomicOffers(String(req.query.q || ''), Number(req.query.limit) || 5);
    res.json({ success: true, offers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to search known offers';
    res.status(422).json({ success: false, error: message });
  }
});

router.post('/offers/:offerId/start', authenticateUser, async (req: AuthRequest, res) => {
  const phone = phoneFrom(req);
  if (!phone) return res.status(401).json({ success: false, error: 'Authenticated phone is required' });
  try {
    const result = await startKnownOfferEconomicRequest({
      buyerPhone: phone,
      offerId: String(req.params.offerId || ''),
      deliveryRequired: typeof req.body?.deliveryRequired === 'boolean' ? req.body.deliveryRequired : undefined,
      deliveryLocation: typeof req.body?.deliveryLocation === 'string' ? req.body.deliveryLocation : undefined,
      quantity: typeof req.body?.quantity === 'string' ? req.body.quantity : undefined,
    });
    const card = await advanceStorefront(phone, result.request.id, {}, 'view_offer');
    res.status(201).json({ success: true, request: result.request, card });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start a request from this offer';
    res.status(/not found/.test(message) ? 404 : 422).json({ success: false, error: message });
  }
});

router.post('/:id/offer', authenticateUser, async (req: AuthRequest, res) => {
  const phone = phoneFrom(req);
  if (!phone) return res.status(401).json({ success: false, error: 'Authenticated phone is required' });
  try {
    const offer = await attachEconomicOffer({
      requestId: String(req.params.id || ''),
      ownerPhone: phone,
      id: typeof req.body?.id === 'string' ? req.body.id : crypto.randomUUID(),
      sellerPhone: req.body?.sellerPhone,
      description: req.body?.description,
      priceMinor: req.body?.priceMinor,
      currency: req.body?.currency,
      source: req.body?.source,
      availabilityNote: req.body?.availabilityNote,
      externalSource: req.body?.externalSource,
      status: req.body?.status,
      provenance: req.body?.provenance,
      mediaReference: req.body?.mediaReference,
      externalUrl: req.body?.externalUrl,
      originOfferId: req.body?.originOfferId,
    });
    res.status(201).json({ success: true, offer });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to attach offer';
    const status = /ownership|not found/.test(message) ? 404 : 422;
    res.status(status).json({ success: false, error: message });
  }
});

router.post('/:id/participants', authenticateUser, async (req: AuthRequest, res) => {
  const phone = phoneFrom(req);
  if (!phone) return res.status(401).json({ success: false, error: 'Authenticated phone is required' });
  try {
    const participant = await addEconomicParticipant({
      requestId: String(req.params.id || ''),
      ownerPhone: phone,
      role: req.body?.role as EconomicParticipantRole,
      providerPhone: req.body?.providerPhone,
      capability: req.body?.capability,
      status: req.body?.status as EconomicParticipantStatus | undefined,
      evidence: req.body?.evidence,
    });
    res.status(201).json({ success: true, participant });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to add participant';
    const status = /ownership|not found/.test(message) ? 404 : /verified provider/.test(message) ? 409 : 422;
    res.status(status).json({ success: false, error: message });
  }
});

router.get('/:id/delivery-candidates', authenticateUser, async (req: AuthRequest, res) => {
  const phone = phoneFrom(req);
  if (!phone) return res.status(401).json({ success: false, error: 'Authenticated phone is required' });
  try {
    const result = await getDeliveryCandidates({ requestId: String(req.params.id || ''), ownerPhone: phone, max: Number(req.query.limit) || 5 });
    res.json({ success: true, providers: result.providers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to find delivery providers';
    res.status(/ownership|not found/.test(message) ? 404 : 422).json({ success: false, error: message });
  }
});

router.post('/:id/delivery-selection', authenticateUser, async (req: AuthRequest, res) => {
  const phone = phoneFrom(req);
  if (!phone) return res.status(401).json({ success: false, error: 'Authenticated phone is required' });
  try {
    const participant = await selectDeliveryCandidate({
      requestId: String(req.params.id || ''),
      ownerPhone: phone,
      providerPhone: req.body?.providerPhone,
    });
    const card = await advanceStorefront(phone, String(req.params.id || ''), {}, 'review_delivery_options');
    res.json({ success: true, participant, card });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to select delivery provider';
    res.status(/ownership|not found/.test(message) ? 404 : 422).json({ success: false, error: message });
  }
});

router.get('/:id/participants', authenticateUser, async (req: AuthRequest, res) => {
  const phone = phoneFrom(req);
  if (!phone) return res.status(401).json({ success: false, error: 'Authenticated phone is required' });
  const request = await getEconomicRequest(String(req.params.id || ''));
  if (!request || request.phone !== phone) return res.status(404).json({ success: false, error: 'Economic request not found' });
  const coordination = await getEconomicRequestCoordination(request.id);
  res.json({ success: true, ...coordination });
});

router.post('/:id/participants/:role/evidence', authenticateUser, async (req: AuthRequest, res) => {
  const phone = phoneFrom(req);
  if (!phone) return res.status(401).json({ success: false, error: 'Authenticated phone is required' });
  try {
    const participant = await updateEconomicParticipant({
      requestId: String(req.params.id || ''),
      actorPhone: phone,
      role: String(req.params.role || '') as EconomicParticipantRole,
      providerPhone: req.body?.providerPhone,
      status: req.body?.status as EconomicParticipantStatus | undefined,
      evidence: req.body?.evidence,
    });
    res.json({ success: true, participant });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update participant evidence';
    const status = /ownership|not found/.test(message) ? 404 : 422;
    res.status(status).json({ success: false, error: message });
  }
});

router.get('/', authenticateUser, async (req: AuthRequest, res) => {
  const phone = phoneFrom(req);
  if (!phone) return res.status(401).json({ success: false, error: 'Authenticated phone is required' });
  try {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM economic_requests WHERE phone = ? ORDER BY created_at DESC LIMIT 50');
    stmt.bind([phone]);
    const requests: any[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      try { row.requirements = row.requirements ? JSON.parse(String(row.requirements)) : {}; } catch { row.requirements = {}; }
      try { row.quote = row.quote ? JSON.parse(String(row.quote)) : null; } catch { row.quote = null; }
      requests.push(row);
    }
    stmt.free();
    res.json({ success: true, requests });
  } catch (error) {
    console.error('[EconomicRequest] list failed:', error);
    res.status(500).json({ success: false, error: 'Unable to list economic requests' });
  }
});

router.get('/:id', authenticateUser, async (req: AuthRequest, res) => {
  const phone = phoneFrom(req);
  if (!phone) return res.status(401).json({ success: false, error: 'Authenticated phone is required' });
  const request = await getEconomicRequest(String(req.params.id || ''));
  if (!request || request.phone !== phone) return res.status(404).json({ success: false, error: 'Economic request not found' });
  res.json({ success: true, request });
});

router.post('/:id/transition', authenticateUser, async (req: AuthRequest, res) => {
  const phone = phoneFrom(req);
  if (!phone) return res.status(401).json({ success: false, error: 'Authenticated phone is required' });
  const request = await getEconomicRequest(String(req.params.id || ''));
  if (!request || request.phone !== phone) return res.status(404).json({ success: false, error: 'Economic request not found' });
  const status = String(req.body?.status || '').trim() as EconomicRequestStatus;
  if (!ALLOWED_STATUSES.has(status)) return res.status(400).json({ success: false, error: 'Unsupported request status' });

  // Customers may only request customer-owned lifecycle transitions. Provider/system
  // transitions are performed by the orchestration/payment/provider services.
  const customerAllowed = new Set<EconomicRequestStatus>([
    'awaiting_confirmation', 'reserved', 'cancelled', 'completed',
  ]);
  if (!customerAllowed.has(status)) {
    return res.status(403).json({ success: false, error: 'This lifecycle transition is performed by the economic service layer.' });
  }
  if (status === 'completed' && !['fulfilled', 'in_fulfillment'].includes(request.status)) {
    return res.status(409).json({ success: false, error: 'A request must be fulfilled before the customer can complete it.' });
  }
  try {
    const updated = await transitionEconomicRequest(request.id, status, {
      fulfillment: req.body?.fulfillment && typeof req.body.fulfillment === 'object' ? req.body.fulfillment : undefined,
    });
    res.json({ success: true, request: updated });
  } catch (error) {
    res.status(409).json({ success: false, error: error instanceof Error ? error.message : 'Invalid request transition' });
  }
});

router.post('/:id/escrow', authenticateUser, async (req: AuthRequest, res) => {
  const phone = phoneFrom(req);
  if (!phone) return res.status(401).json({ success: false, error: 'Authenticated phone is required' });
  const request = await getEconomicRequest(String(req.params.id || ''));
  if (!request || request.phone !== phone) return res.status(404).json({ success: false, error: 'Economic request not found' });
  const amount = typeof req.body?.amount_minor === 'number' && Number.isInteger(req.body.amount_minor) ? req.body.amount_minor : undefined;
  const result = await lockEscrowForEconomicRequest(request.id, amount);
  res.status(result.success ? 200 : 409).json(result);
});

router.post('/:id/complete', authenticateUser, async (req: AuthRequest, res) => {
  const phone = phoneFrom(req);
  if (!phone) return res.status(401).json({ success: false, error: 'Authenticated phone is required' });
  const request = await getEconomicRequest(String(req.params.id || ''));
  if (!request || request.phone !== phone) return res.status(404).json({ success: false, error: 'Economic request not found' });
  const evidence = req.body?.evidence && typeof req.body.evidence === 'object' ? req.body.evidence : undefined;
  const result = await completeEconomicRequest(request.id, evidence);
  res.status(result.success ? 200 : 409).json(result);
});

router.get('/:id/execution', authenticateUser, async (req: AuthRequest, res) => {
  const request = await getEconomicRequest(req.params.id);
  if (!request) {
    return res.status(404).json({ ok: false, error: 'Economic request not found' });
  }
  const userPhone = phoneFrom(req);
  if (request.phone !== userPhone) {
    return res.status(403).json({ ok: false, error: 'Unauthorized: only request owner can inspect execution requests' });
  }
  const executions = await getExecutionRequestsForRequest(req.params.id);
  return res.json({ ok: true, executionRequests: executions });
});

router.post('/:id/execution', authenticateUser, async (req: AuthRequest, res) => {
  const request = await getEconomicRequest(req.params.id);
  if (!request) {
    return res.status(404).json({ ok: false, error: 'Economic request not found' });
  }
  const userPhone = phoneFrom(req);
  if (request.phone !== userPhone) {
    return res.status(403).json({ ok: false, error: 'Unauthorized: only request owner can dispatch execution' });
  }

  const { providerPhone, capability, actionRequested, role, idempotencyKey } = req.body || {};
  if (!providerPhone || !capability || !actionRequested || !role || !idempotencyKey) {
    return res.status(400).json({
      ok: false,
      error: 'providerPhone, capability, actionRequested, role, and idempotencyKey are required'
    });
  }

  const participants = await getEconomicParticipants(req.params.id);
  const participant = participants.find((p) => p.providerPhone === providerPhone && p.role === role);
  if (!participant) {
    return res.status(400).json({ ok: false, error: 'Specified provider is not a registered participant on this request' });
  }

  try {
    const actionId = `act_${Math.random().toString(36).substring(2, 10)}`;
    const correlationId = `corr_${request.id}`;
    const created = await createExecutionRequest({
      requestId: request.id,
      actionId,
      providerPhone,
      role,
      capability,
      actionRequested,
      idempotencyKey: String(idempotencyKey),
      correlationId,
      authorizationContext: {
        invoked_by: userPhone,
        participant_status: participant.status,
      }
    });
    const execution = await dispatchExecutionRequest(created.id);

    return res.json({ ok: true, executionRequest: execution });
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err?.message || 'Failed to create execution request' });
  }
});

router.post('/orchestration/run', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const result = await runOrchestrationPass();
    res.json({ success: true, result });
  } catch (error) {
    console.error('[Orchestration] pass failed:', error);
    res.status(500).json({ success: false, error: 'Orchestration pass failed' });
  }
});

router.post('/memory/lifecycle', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    await ensureLivingMemorySchema();
    const job = String(req.body?.job || 'all');
    const out: Record<string, unknown> = {};
    if (job === 'decay' || job === 'all') out.decay = await runDailyMemoryDecay();
    if (job === 'prune' || job === 'all') out.prune = await runWeeklyMemoryPrune();
    if (job === 'crystallize' || job === 'all') out.crystallize = await runMemoryCrystallize();
    res.json({ success: true, ...out });
  } catch (error) {
    console.error('[LivingMemory] lifecycle failed:', error);
    res.status(500).json({ success: false, error: 'Memory lifecycle failed' });
  }
});

router.get('/memory/inspector', authenticateUser, async (req: AuthRequest, res) => {
  const phone = phoneFrom(req);
  if (!phone) return res.status(401).json({ success: false, error: 'Authenticated phone is required' });
  try {
    const rows = await getWorkingContextInspector(phone);
    res.json({ success: true, audits: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Unable to load memory inspector' });
  }
});

export default router;
