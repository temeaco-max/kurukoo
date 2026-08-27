import { Router } from 'express';
import { authenticateUser, type AuthRequest } from '../middleware/auth.js';
import { ensureCapability, listCapabilityPortfolio, capabilityPortfolioSummary, setCapabilityState, isKnownSkill } from '../services/capabilityPortfolioService.js';
import { activatePulse, endPulseSession } from '../services/nearbyPulse.js';

const router = Router();
router.use(authenticateUser);

const owner = (req: AuthRequest) => {
  const phone = String(req.user?.phone || '').trim();
  return phone && !phone.startsWith('anon_') ? phone : null;
};

router.get('/', async (req: AuthRequest, res) => {
  const phone = owner(req);
  if (!phone) return res.status(401).json({ error: 'Authenticated owner required' });
  return res.json(await capabilityPortfolioSummary(phone));
});

router.get('/:skill', async (req: AuthRequest, res) => {
  const phone = owner(req);
  if (!phone) return res.status(401).json({ error: 'Authenticated owner required' });
  const skill = String(req.params.skill || '').trim().toLowerCase();
  const item = (await listCapabilityPortfolio(phone)).find(x => x.skill === skill);
  if (!item) return res.status(404).json({ error: 'Capability not found', skill });
  return res.json({ success: true, capability: item });
});

router.post('/', async (req: AuthRequest, res) => {
  const phone = owner(req);
  if (!phone) return res.status(401).json({ error: 'Authenticated owner required' });
  const skill = String(req.body?.skill || '').trim().toLowerCase();
  const kind = ['provider', 'contributor', 'native', 'agent'].includes(req.body?.kind) ? req.body.kind : 'provider';
  if (!skill || !isKnownSkill(skill)) return res.status(400).json({ error: 'Unknown capability skill', skill });
  return res.status(201).json({
    success: true,
    capability: await ensureCapability(phone, skill, kind, req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {}),
  });
});

router.patch('/:skill', async (req: AuthRequest, res) => {
  const phone = owner(req);
  if (!phone) return res.status(401).json({ error: 'Authenticated owner required' });
  const status = req.body?.status;
  const availability = req.body?.availability;
  const statuses = ['discovered', 'interested', 'onboarding', 'verified', 'active', 'paused', 'suspended'];
  const availabilityValues = ['offline', 'available', 'live'];
  if (status !== undefined && !statuses.includes(status)) return res.status(400).json({ error: 'Invalid capability status' });
  if (availability !== undefined && !availabilityValues.includes(availability)) return res.status(400).json({ error: 'Invalid capability availability' });
  if (availability === 'live') return res.status(400).json({ error: 'Use /:skill/live with explicit coordinates.' });
  try {
    return res.json({ success: true, capability: await setCapabilityState(phone, String(req.params.skill), { status, availability, kind: req.body?.kind, metadata: req.body?.metadata }) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update capability readiness';
    return res.status(/verification|required|operator-governed/i.test(message) ? 409 : 422).json({ success: false, error: message });
  }
});

router.post('/:skill/live', async (req: AuthRequest, res) => {
  const phone = owner(req);
  if (!phone) return res.status(401).json({ error: 'Authenticated owner required' });
  const skill = String(req.params.skill || '').trim().toLowerCase();
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  if (!skill || !Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: 'skill, lat and lng are required' });
  const result = await activatePulse(phone, skill, lat, lng);
  if (!result.success) return res.status(403).json(result);
  try {
    return res.json({ success: true, capability: await setCapabilityState(phone, skill, { availability: 'live', status: 'active' }), pulse: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to activate capability readiness';
    return res.status(/verification|required/i.test(message) ? 409 : 422).json({ success: false, error: message, pulse: result });
  }
});

router.delete('/:skill/live', async (req: AuthRequest, res) => {
  const phone = owner(req);
  if (!phone) return res.status(401).json({ error: 'Authenticated owner required' });
  const skill = String(req.params.skill || '').trim().toLowerCase();
  if (!skill) return res.status(400).json({ error: 'skill is required' });
  await endPulseSession(phone);
  return res.json({ success: true, capability: await setCapabilityState(phone, skill, { availability: 'offline' }), pulse: { active: false, skill } });
});

export default router;
