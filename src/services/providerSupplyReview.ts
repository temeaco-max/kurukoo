import { getDb, saveDb } from '../database.js';
import { getProviderSupplyEntity, ensureProviderSupplyRegistrySchema, type ProviderSupplyEntity } from './providerSupplyRegistry.js';
import { getSupplySourcePolicy } from './providerSupplyPolicy.js';
import crypto from 'node:crypto';

export type SupplyReviewDecision = 'still_current' | 'changed' | 'closed' | 'unreachable' | 'source_removed' | 'duplicate' | 'needs_review';

function clean(value: unknown, field: string, max = 500): string { if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`); const output = value.trim(); if (output.length > max) throw new Error(`${field} is too long`); return output; }
function reviewerHash(value: string): string { return crypto.createHash('sha256').update(`${process.env.KURUKOO_SUPPLY_REGISTRY_SALT || process.env.JWT_SECRET || 'supply-review'}:${value}`).digest('hex').slice(0, 32); }

export async function markOverdueSupplyEntitiesStale(): Promise<number> {
  await ensureProviderSupplyRegistrySchema(); const db = await getDb();
  db.run(`UPDATE provider_supply_entities SET freshness_state='stale',updated_at=CURRENT_TIMESTAMP WHERE freshness_state IN ('current','review_required') AND next_review_at IS NOT NULL AND datetime(next_review_at)<=datetime('now') AND status<>'removed'`);
  const changed = Number(db.getRowsModified?.() || 0); if (changed) saveDb(); return changed;
}

export async function reviewProviderSupplyEntity(input: { entityId: string; operatorId: string; decision: SupplyReviewDecision; evidenceRef: unknown; sourceRetrievedAt?: unknown }): Promise<ProviderSupplyEntity> {
  const entity = await getProviderSupplyEntity(input.entityId); if (!entity) throw new Error('Supply entity not found');
  const decision = clean(input.decision, 'Review decision', 40) as SupplyReviewDecision; if (!['still_current','changed','closed','unreachable','source_removed','duplicate','needs_review'].includes(decision)) throw new Error('Unsupported supply review decision');
  const evidenceRef = clean(input.evidenceRef, 'Review evidence reference', 500); const db = await getDb();
  const now = new Date().toISOString(); let freshness: ProviderSupplyEntity['freshnessState'] = 'review_required'; let status = entity.status; let reviewStatus: ProviderSupplyEntity['reviewStatus'] = 'reviewed';
  if (decision === 'still_current' || decision === 'changed') {
    freshness = 'current';
    const policy = entity.source ? await getSupplySourcePolicy(entity.source, entity.sourceType) : null;
    const days = Math.min(Math.max(Number(policy?.freshnessWindowDays) || 90, 1), 365);
    const nextReviewAt = new Date(Date.now() + days * 86400000).toISOString();
    db.run(`UPDATE provider_supply_entities SET review_status=?,freshness_state=?,next_review_at=?,last_reviewed_by=?,review_evidence_ref=?,reviewed_at=?,source_retrieved_at=COALESCE(?,source_retrieved_at),updated_at=CURRENT_TIMESTAMP WHERE id=?`, [reviewStatus, freshness, nextReviewAt, reviewerHash(clean(input.operatorId, 'Operator identity', 128)), evidenceRef, now, input.sourceRetrievedAt || null, entity.id]);
  } else if (decision === 'closed' || decision === 'source_removed') {
    freshness = 'removed'; status = 'removed';
    db.run(`UPDATE provider_supply_entities SET status=?,review_status=?,freshness_state=?,next_review_at=NULL,last_reviewed_by=?,review_evidence_ref=?,reviewed_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`, [status, reviewStatus, freshness, reviewerHash(clean(input.operatorId, 'Operator identity', 128)), evidenceRef, now, entity.id]);
  } else if (decision === 'duplicate') {
    freshness = 'review_required';
    db.run(`UPDATE provider_supply_entities SET review_status=?,freshness_state=?,duplicate_review_status='possible_duplicate',last_reviewed_by=?,review_evidence_ref=?,reviewed_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`, [reviewStatus, freshness, reviewerHash(clean(input.operatorId, 'Operator identity', 128)), evidenceRef, now, entity.id]);
  } else {
    freshness = 'review_required'; reviewStatus = 'required';
    db.run(`UPDATE provider_supply_entities SET review_status=?,freshness_state=?,last_reviewed_by=?,review_evidence_ref=?,reviewed_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`, [reviewStatus, freshness, reviewerHash(clean(input.operatorId, 'Operator identity', 128)), evidenceRef, now, entity.id]);
  }
  db.run(`INSERT INTO provider_supply_events(id,entity_id,event_name,actor_hash,evidence_json) VALUES (?,?,?,?,?)`, [crypto.randomUUID(), entity.id, `supply_entity_review_${decision}`, reviewerHash(clean(input.operatorId, 'Operator identity', 128)), JSON.stringify({ decision, evidence_ref_present: true, freshness_state: freshness, status })]); saveDb();
  return (await getProviderSupplyEntity(entity.id))!;
}

export async function approveProviderSupplyReadiness(input: { entityId: string; operatorId: string; evidenceRef: unknown }): Promise<ProviderSupplyEntity> {
  const entity = await getProviderSupplyEntity(input.entityId); if (!entity) throw new Error('Supply entity not found');
  if (entity.status !== 'verification_pending') throw new Error('Provider readiness review requires verification_pending registry state');
  if (entity.reviewStatus !== 'reviewed' || entity.freshnessState !== 'current' || entity.duplicateReviewStatus === 'possible_duplicate') throw new Error('Current reviewed supply and duplicate clearance are required before provider readiness review');
  if (!entity.claimedProviderPhone) throw new Error('An approved claim is required before provider readiness review');
  const evidenceRef = clean(input.evidenceRef, 'Provider readiness evidence reference', 500);
  const db = await getDb();
  const claim = db.prepare("SELECT 1 FROM provider_supply_claims WHERE entity_id=? AND claimant_phone=? AND status='approved' AND evidence_ref IS NOT NULL LIMIT 1"); claim.bind([entity.id, entity.claimedProviderPhone]); const claimApproved = claim.step(); claim.free(); if (!claimApproved) throw new Error('An evidence-approved supply claim is required');
  if (!await (await import('./providerVerification.js')).providerMayBeDiscovered(entity.claimedProviderPhone)) throw new Error('Linked provider account lacks authoritative verification evidence');
  const capability = db.prepare('SELECT 1 FROM skills WHERE phone=? AND is_available=1 LIMIT 1'); capability.bind([entity.claimedProviderPhone]); const hasCapability = capability.step(); capability.free(); if (!hasCapability) throw new Error('Linked provider account must configure at least one available capability');
  db.run(`UPDATE provider_supply_entities SET status='verified',last_reviewed_by=?,review_evidence_ref=?,reviewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`, [reviewerHash(clean(input.operatorId, 'Operator identity', 128)), evidenceRef, entity.id]);
  db.run(`INSERT INTO provider_supply_events(id,entity_id,event_name,actor_hash,evidence_json) VALUES (?,?,?,?,?)`, [crypto.randomUUID(), entity.id, 'supply_provider_readiness_verified', reviewerHash(clean(input.operatorId, 'Operator identity', 128)), JSON.stringify({ claim_approved: true, provider_verification_revalidated: true, capability_available: true, payment_or_dispatch_confirmed: false })]); saveDb();
  return (await getProviderSupplyEntity(entity.id))!;
}

export async function beginProviderReadinessReview(input: { entityId: string; operatorId: string }): Promise<ProviderSupplyEntity> {
  const entity = await getProviderSupplyEntity(input.entityId); if (!entity) throw new Error('Supply entity not found');
  if (entity.status !== 'claimed') throw new Error('Provider readiness review can only begin for a claimed supply entity');
  if (!entity.claimedProviderPhone) throw new Error('An approved claim is required before provider readiness review');
  const db = await getDb(); const claim = db.prepare("SELECT 1 FROM provider_supply_claims WHERE entity_id=? AND claimant_phone=? AND status='approved' AND evidence_ref IS NOT NULL LIMIT 1"); claim.bind([entity.id, entity.claimedProviderPhone]); const approved = claim.step(); claim.free(); if (!approved) throw new Error('An evidence-approved supply claim is required');
  db.run(`UPDATE provider_supply_entities SET status='verification_pending',updated_at=CURRENT_TIMESTAMP WHERE id=?`, [entity.id]);
  db.run(`INSERT INTO provider_supply_events(id,entity_id,event_name,actor_hash,evidence_json) VALUES (?,?,?,?,?)`, [crypto.randomUUID(), entity.id, 'supply_provider_readiness_started', reviewerHash(clean(input.operatorId, 'Operator identity', 128)), JSON.stringify({ claim_approved: true })]); saveDb();
  return (await getProviderSupplyEntity(entity.id))!;
}
