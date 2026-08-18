import { Router } from 'express';
import { authenticateUser, type AuthRequest } from '../middleware/auth.js';
import { ensureCapability, listCapabilityPortfolio, capabilityPortfolioSummary, setCapabilityState, isKnownSkill } from '../services/capabilityPortfolioService.js';

const router = Router();
router.use(authenticateUser);

function owner(req: AuthRequest): string | null {
  const phone = String(req.user?.phone || '').trim();
  return phone && !phone.startsWith('anon_') ? phone : null;
}

router.get('/', async (req: AuthRequest, res) => {
  const phone = owner(req);
  if (!phone) return res.status(401).json({ error: 'Authenticated owner required' });
  res.json(await capabilityPortfolioSummary(phone));
});

router.get('/:skill', async (req: AuthRequest, res) => {
  const phone = owner(req);
  if (!phone) return res.status(401).json({ error: 'Authenticated owner required' });
  const items = await listCapabilityPortfolio(phone);
  const skill = String(req.params.skill || '').trim().toLowerCase();
  const item = items.find(x => x.skill === skill);
  if (!item) return res.status(404).json({ error: 'Capability not found', skill });
  res.json({ success: true, capability: item });
});

router.post('/', async (req: AuthRequest, res) => {
  const phone = owner(req);
  if (!phone) return res.status(401).json({ error: 'Authenticated owner required' });
  const skill = String(req.body?.skill || '').trim().toLowerCase();
  const kind = ['provider','contributor','native','agent'].includes(req.body?.kind) ? req.body.kind : 'provider';
  if (!skill || !isKnownSkill(skill)) return res.status(400).json({ error: 'Unknown capability skill', skill });
  const capability = await ensureCapability(phone, skill, kind, req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {});
  res.status(201).json({ success: true, capability });
});

router.patch('/:skill', async (req: AuthRequest, res) => {
  const phone = owner(req);
  if (!phone) return res.status(401).json({ error: 'Authenticated owner required' });
  const status = req.body?.status;
  const availability = req.body?.availability;
  const allowedStatus = ['discovered','interested','onboarding','verified','active','paused','suspended'];
  const allowedAvailability = ['offline','available','live'];
  if (status !== undefined && !allowedStatus.includes(status)) return res.status(400).json({ error: 'Invalid capability status' });
  if (availability !== undefined && !allowedAvailability.includes(availability)) return res.status(400).json({ error: 'Invalid capability availability' });
  const capability = await setCapabilityState(phone, String(req.params.skill), { status, availability, kind: req.body?.kind, metadata: req.body?.metadata });
  res.json({ success: true, capability });
});

export default router;
