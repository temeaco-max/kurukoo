import { Router } from 'express';
import { authenticateAdmin, authenticateUser, type AuthRequest } from '../middleware/auth.js';
import {
  activateClaimedSupplyEntity,
  getProviderSupplyEntity,
  importProviderSupplyEntity,
  listProviderSupplyEntities,
  listSupplyClaims,
  listSupplyProvenance,
  requestSupplyEntityClaim,
  reviewSupplyEntityClaim,
  transitionSupplyEntity,
} from '../services/providerSupplyRegistry.js';

const router = Router();

function claimantPhone(req: AuthRequest): string | null { return req.user?.phone ? String(req.user.phone) : null; }
function operatorId(req: AuthRequest): string { return String(req.user?.username || req.user?.id || req.user?.phone || 'admin'); }

router.post('/entities/:id/claim', authenticateUser, async (req: AuthRequest, res) => {
  const phone = claimantPhone(req);
  if (!phone) return res.status(401).json({ success: false, error: 'Authenticated claimant identity is required' });
  try {
    const claim = await requestSupplyEntityClaim({ entityId: String(req.params.id || ''), claimantPhone: phone });
    res.status(201).json({ success: true, claim, provider_verified: false, message: 'Claim requested. This does not verify the business or activate it as a Kurukoo provider.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to request supply entity claim';
    res.status(/not found/.test(message) ? 404 : 409).json({ success: false, error: message });
  }
});

router.get('/admin/entities', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const entities = await listProviderSupplyEntities({ country: req.query.country, status: req.query.status, limit: req.query.limit, offset: req.query.offset });
    res.json({ success: true, entities, provider_network_membership: 'not implied' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to list provider supply entities';
    res.status(422).json({ success: false, error: message });
  }
});

router.post('/admin/entities', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const entity = await importProviderSupplyEntity({ ...req.body, operatorId: operatorId(req) });
    res.status(201).json({ success: true, entity, provider_verified: false, provider_network_membership: 'not implied' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to import provider supply entity';
    res.status(422).json({ success: false, error: message });
  }
});

router.get('/admin/entities/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const entity = await getProviderSupplyEntity(String(req.params.id || ''));
    if (!entity) return res.status(404).json({ success: false, error: 'Supply entity not found' });
    const provenance = await listSupplyProvenance(entity.id);
    res.json({ success: true, entity, provenance, provider_network_membership: 'not implied' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load provider supply entity';
    res.status(422).json({ success: false, error: message });
  }
});

router.post('/admin/entities/:id/transition', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const entity = await transitionSupplyEntity({ entityId: String(req.params.id || ''), status: req.body?.status, operatorId: operatorId(req) });
    res.json({ success: true, entity, provider_network_membership: entity.status === 'active' ? 'activation requires the dedicated revalidation route' : 'not implied' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to transition provider supply entity';
    res.status(/not found/.test(message) ? 404 : 409).json({ success: false, error: message });
  }
});

router.post('/admin/entities/:id/activate', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const entity = await activateClaimedSupplyEntity({ entityId: String(req.params.id || ''), operatorId: operatorId(req) });
    res.json({ success: true, entity, provider_network_membership: 'active', payment_or_dispatch_confirmed: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to activate provider supply entity';
    res.status(/not found/.test(message) ? 404 : 409).json({ success: false, error: message });
  }
});

router.get('/admin/claims', authenticateAdmin, async (req: AuthRequest, res) => {
  try { res.json({ success: true, claims: await listSupplyClaims(req.query.status) }); }
  catch (error) { const message = error instanceof Error ? error.message : 'Unable to list supply claims'; res.status(422).json({ success: false, error: message }); }
});

router.post('/admin/claims/:id/review', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const claim = await reviewSupplyEntityClaim({ claimId: String(req.params.id || ''), operatorId: operatorId(req), decision: req.body?.decision, evidenceRef: req.body?.evidenceRef });
    res.json({ success: true, claim, provider_verified: false, message: claim.status === 'approved' ? 'Claim approved. Separate provider verification and capability review are still required.' : 'Claim decision recorded.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to review supply claim';
    res.status(/not found/.test(message) ? 404 : 409).json({ success: false, error: message });
  }
});

export default router;
