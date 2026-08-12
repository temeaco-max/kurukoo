import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';
import { ensureProviderSupplyRegistrySchema, getProviderSupplyEntity, requestSupplyEntityClaim, type ProviderSupplyEntity, type SupplyClaim } from './providerSupplyRegistry.js';

function hashToken(token: string): string { return crypto.createHash('sha256').update(`${process.env.KURUKOO_SUPPLY_REGISTRY_SALT || process.env.JWT_SECRET || 'supply-invitation'}:${token}`).digest('hex'); }
function actorHash(value: string): string { return crypto.createHash('sha256').update(`${process.env.KURUKOO_SUPPLY_REGISTRY_SALT || process.env.JWT_SECRET || 'supply-invitation'}:${value}`).digest('hex').slice(0, 32); }

export async function ensureSupplyInvitationSchema(): Promise<void> {
  await ensureProviderSupplyRegistrySchema(); const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS provider_supply_invitations (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_by_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'issued',
    claimed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  ); CREATE INDEX IF NOT EXISTS idx_supply_invitation_entity ON provider_supply_invitations(entity_id,status);`);
}

export async function createSupplyClaimInvitation(input: { entityId: string; operatorId: string; expiresInDays?: unknown }): Promise<{ id: string; entity: ProviderSupplyEntity; claimUrlToken: string; expiresAt: string; externalOutreachPerformed: false }> {
  const entity = await getProviderSupplyEntity(input.entityId); if (!entity) throw new Error('Supply entity not found');
  if (entity.reviewStatus !== 'reviewed' || entity.freshnessState !== 'current') throw new Error('Only a current, reviewed supply listing can receive a claim invitation');
  if (entity.claimedProviderPhone || ['verified', 'active', 'suspended', 'removed'].includes(entity.status)) throw new Error('This supply entity is not eligible for a new claim invitation');
  const token = crypto.randomBytes(24).toString('base64url'); const expiresInDays = Math.min(Math.max(Number(input.expiresInDays) || 14, 1), 30); const expiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString(); const db = await getDb();
  const id = crypto.randomUUID(); db.run(`INSERT INTO provider_supply_invitations(id,entity_id,token_hash,created_by_hash,expires_at) VALUES (?,?,?,?,?)`, [id, entity.id, hashToken(token), actorHash(input.operatorId), expiresAt]);
  if (entity.status === 'imported') db.run("UPDATE provider_supply_entities SET status='invited',updated_at=CURRENT_TIMESTAMP WHERE id=?", [entity.id]);
  db.run(`INSERT INTO provider_supply_events(id,entity_id,event_name,actor_hash,evidence_json) VALUES (?,?,?,?,?)`, [crypto.randomUUID(), entity.id, 'supply_claim_invitation_issued', actorHash(input.operatorId), JSON.stringify({ expires_at: expiresAt, external_outreach_performed: false })]); saveDb();
  return { id, entity: (await getProviderSupplyEntity(entity.id))!, claimUrlToken: token, expiresAt, externalOutreachPerformed: false };
}

export async function claimSupplyInvitation(input: { token: string; claimantPhone: string }): Promise<SupplyClaim> {
  if (typeof input.token !== 'string' || input.token.length < 20 || input.token.length > 120) throw new Error('Invalid claim invitation token');
  await ensureSupplyInvitationSchema(); const db = await getDb(); const stmt = db.prepare("SELECT * FROM provider_supply_invitations WHERE token_hash=? AND status='issued' LIMIT 1"); stmt.bind([hashToken(input.token)]); const row = stmt.step() ? stmt.getAsObject() as any : null; stmt.free(); if (!row) throw new Error('Claim invitation is invalid or already used');
  if (new Date(String(row.expires_at)).getTime() <= Date.now()) { db.run("UPDATE provider_supply_invitations SET status='expired' WHERE id=?", [row.id]); saveDb(); throw new Error('Claim invitation has expired'); }
  const claim = await requestSupplyEntityClaim({ entityId: String(row.entity_id), claimantPhone: input.claimantPhone }); db.run("UPDATE provider_supply_invitations SET status='claimed',claimed_at=CURRENT_TIMESTAMP WHERE id=?", [row.id]); saveDb(); return claim;
}
