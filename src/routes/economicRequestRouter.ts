import { Router } from 'express';
import crypto from 'crypto';
import { type AuthRequest } from '../middleware/auth.js';
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

router.post('/storefront/start', async (req: AuthRequest, res) => {
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

router.post('/storefront/:id/advance', async (req: AuthRequest, res) => {
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

router.get('/ai-quota', async (req: AuthRequest, res) => {
  const phone = phoneFrom(req);
  if (!phone) return res.status(401).json({ success: false, error: 'Authenticated phone is required' });
  try {
    const status = await getAiQuotaStatus(phone);
    res.json({ success: true, quota: status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Unable to load AI quota' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
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

router.get('/:id', async (req: AuthRequest, res) => {
  const phone = phoneFrom(req);
  if (!phone) return res.status(401).json({ success: false, error: 'Authenticated phone is required' });
  const request = await getEconomicRequest(String(req.params.id || ''));
  if (!request || request.phone !== phone) return res.status(404).json({ success: false, error: 'Economic request not found' });
  res.json({ success: true, request });
});

router.post('/:id/transition', async (req: AuthRequest, res) => {
  const phone = phoneFrom(req);
  if (!phone) return res.status(401).json({ success: false, error: 'Authenticated phone is required' });
  const request = await getEconomicRequest(String(req.params.id || ''));
  if (!request || request.phone !== phone) return res.status(404).json({ success: false, error: 'Economic request not found' });
  const status = String(req.body?.status || '').trim() as EconomicRequestStatus;
  if (!ALLOWED_STATUSES.has(status)) return res.status(400).json({ success: false, error: 'Unsupported request status' });

  // Customers may only request customer-owned lifecycle transitions. Provider/system
  // transitions are performed by the orchestration/payment/provider services.
  const customerAllowed = new Set<EconomicRequestStatus>([
    'awaiting_confirmation', 'reserved', 'cancelled', 'disputed', 'completed',
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

router.post('/:id/escrow', async (req: AuthRequest, res) => {
  const phone = phoneFrom(req);
  if (!phone) return res.status(401).json({ success: false, error: 'Authenticated phone is required' });
  const request = await getEconomicRequest(String(req.params.id || ''));
  if (!request || request.phone !== phone) return res.status(404).json({ success: false, error: 'Economic request not found' });
  const amount = typeof req.body?.amount_minor === 'number' && Number.isInteger(req.body.amount_minor) ? req.body.amount_minor : undefined;
  const result = await lockEscrowForEconomicRequest(request.id, amount);
  res.status(result.success ? 200 : 409).json(result);
});

router.post('/:id/complete', async (req: AuthRequest, res) => {
  const phone = phoneFrom(req);
  if (!phone) return res.status(401).json({ success: false, error: 'Authenticated phone is required' });
  const request = await getEconomicRequest(String(req.params.id || ''));
  if (!request || request.phone !== phone) return res.status(404).json({ success: false, error: 'Economic request not found' });
  const evidence = req.body?.evidence && typeof req.body.evidence === 'object' ? req.body.evidence : undefined;
  const result = await completeEconomicRequest(request.id, evidence);
  res.status(result.success ? 200 : 409).json(result);
});

router.post('/orchestration/run', async (_req: AuthRequest, res) => {
  try {
    const result = await runOrchestrationPass();
    res.json({ success: true, result });
  } catch (error) {
    console.error('[Orchestration] pass failed:', error);
    res.status(500).json({ success: false, error: 'Orchestration pass failed' });
  }
});

router.post('/memory/lifecycle', async (req: AuthRequest, res) => {
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

router.get('/memory/inspector', async (req: AuthRequest, res) => {
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
