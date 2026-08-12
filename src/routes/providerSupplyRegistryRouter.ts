import { Router } from 'express';
import { authenticateAdmin, authenticateUser, type AuthRequest } from '../middleware/auth.js';
import {
  activateClaimedSupplyEntity,
  getProviderSupplyEntity,
  importProviderSupplyBatch,
  importProviderSupplyEntity,
  listProviderSupplyEntities,
  listPublicProviderSupplyListings,
  listSupplyClaims,
  listSupplyProvenance,
  requestSupplyEntityClaim,
  reviewSupplyEntityClaim,
} from '../services/providerSupplyRegistry.js';
import { approveProviderSupplyReadiness, beginProviderReadinessReview, markOverdueSupplyEntitiesStale, reviewProviderSupplyEntity } from '../services/providerSupplyReview.js';
import { decideSupplyDuplicate, listSupplyDuplicates } from '../services/providerSupplyDuplicates.js';
import { listSupplySourcePolicies, upsertSupplySourcePolicy } from '../services/providerSupplyPolicy.js';
import { claimSupplyInvitation, createSupplyClaimInvitation } from '../services/providerSupplyInvitation.js';

const router = Router();

function claimantPhone(req: AuthRequest): string | null { return req.user?.phone ? String(req.user.phone) : null; }
function operatorId(req: AuthRequest): string { return String(req.user?.username || req.user?.id || req.user?.phone || 'admin'); }

router.get('/public-listings', async (req, res) => {
  try { res.json({ success: true, listings: await listPublicProviderSupplyListings({ state: req.query.state, lga: req.query.lga, limit: req.query.limit }), semantics: { label: 'Publicly listed business', provider_verified: false, availability: 'unknown', price: 'unknown', coordination_invitation: false } }); }
  catch (error) { const message = error instanceof Error ? error.message : 'Unable to load public supply listings'; res.status(422).json({ success: false, error: message }); }
});

router.post('/claim-invitations/:token/claim', authenticateUser, async (req: AuthRequest, res) => {
  const phone = claimantPhone(req); if (!phone) return res.status(401).json({ success: false, error: 'Authenticated claimant identity is required' });
  try { const claim = await claimSupplyInvitation({ token: String(req.params.token || ''), claimantPhone: phone }); res.status(201).json({ success: true, claim, provider_verified: false, external_outreach_performed: false }); }
  catch (error) { const message = error instanceof Error ? error.message : 'Unable to claim invitation'; res.status(/invalid|expired/.test(message) ? 410 : 409).json({ success: false, error: message }); }
});

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

router.post('/admin/imports', authenticateAdmin, async (req: AuthRequest, res) => {
  try { const result = await importProviderSupplyBatch({ records: req.body?.records, batchId: req.body?.batchId, operatorId: operatorId(req) }); res.status(201).json({ success: true, ...result, external_fetch_performed: false, external_outreach_performed: false }); }
  catch (error) { const message = error instanceof Error ? error.message : 'Unable to run controlled supply import'; res.status(422).json({ success: false, error: message }); }
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

router.post('/admin/entities/:id/transition', authenticateAdmin, async (_req: AuthRequest, res) => {
  res.status(410).json({ success: false, error: 'Generic supply lifecycle mutation is disabled. Use the dedicated review, claim-review, readiness, freshness, duplicate, or activation action.' });
});

router.post('/admin/entities/:id/invitation', authenticateAdmin, async (req: AuthRequest, res) => {
  try { const invitation = await createSupplyClaimInvitation({ entityId: String(req.params.id || ''), operatorId: operatorId(req), expiresInDays: req.body?.expiresInDays }); res.status(201).json({ success: true, invitation, external_outreach_performed: false, claim_url: `/supply-registry/claim-invitations/${encodeURIComponent(invitation.claimUrlToken)}/claim` }); }
  catch (error) { const message = error instanceof Error ? error.message : 'Unable to issue claim invitation'; res.status(409).json({ success: false, error: message }); }
});

router.post('/admin/entities/:id/review', authenticateAdmin, async (req: AuthRequest, res) => {
  try { const entity = await reviewProviderSupplyEntity({ entityId: String(req.params.id || ''), operatorId: operatorId(req), decision: req.body?.decision, evidenceRef: req.body?.evidenceRef, sourceRetrievedAt: req.body?.sourceRetrievedAt }); res.json({ success: true, entity, provider_verified: false }); }
  catch (error) { const message = error instanceof Error ? error.message : 'Unable to review supply entity'; res.status(/not found/.test(message) ? 404 : 409).json({ success: false, error: message }); }
});

router.post('/admin/entities/:id/provider-readiness/start', authenticateAdmin, async (req: AuthRequest, res) => {
  try { const entity = await beginProviderReadinessReview({ entityId: String(req.params.id || ''), operatorId: operatorId(req) }); res.json({ success: true, entity }); }
  catch (error) { const message = error instanceof Error ? error.message : 'Unable to start provider readiness review'; res.status(/not found/.test(message) ? 404 : 409).json({ success: false, error: message }); }
});

router.post('/admin/entities/:id/provider-readiness', authenticateAdmin, async (req: AuthRequest, res) => {
  try { const entity = await approveProviderSupplyReadiness({ entityId: String(req.params.id || ''), operatorId: operatorId(req), evidenceRef: req.body?.evidenceRef }); res.json({ success: true, entity, provider_verified: true, payment_or_dispatch_confirmed: false }); }
  catch (error) { const message = error instanceof Error ? error.message : 'Unable to review provider readiness'; res.status(/not found/.test(message) ? 404 : 409).json({ success: false, error: message }); }
});

router.post('/admin/freshness/revalidate-overdue', authenticateAdmin, async (_req: AuthRequest, res) => {
  res.json({ success: true, stale_marked: await markOverdueSupplyEntitiesStale(), external_fetch_performed: false });
});

router.get('/admin/duplicates', authenticateAdmin, async (req: AuthRequest, res) => {
  res.json({ success: true, duplicates: await listSupplyDuplicates(typeof req.query.decision === 'string' ? req.query.decision : undefined) });
});

router.post('/admin/duplicates/:id/decision', authenticateAdmin, async (req: AuthRequest, res) => {
  try { res.json({ success: true, duplicate: await decideSupplyDuplicate({ duplicateId: String(req.params.id || ''), decision: req.body?.decision, operatorId: operatorId(req) }) }); }
  catch (error) { const message = error instanceof Error ? error.message : 'Unable to decide duplicate candidate'; res.status(409).json({ success: false, error: message }); }
});

router.get('/admin/source-policies', authenticateAdmin, async (_req: AuthRequest, res) => {
  res.json({ success: true, policies: await listSupplySourcePolicies() });
});

router.post('/admin/source-policies', authenticateAdmin, async (req: AuthRequest, res) => {
  try { res.status(201).json({ success: true, policy: await upsertSupplySourcePolicy({ ...req.body, operatorId: operatorId(req) }) }); }
  catch (error) { const message = error instanceof Error ? error.message : 'Unable to save source policy'; res.status(422).json({ success: false, error: message }); }
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
