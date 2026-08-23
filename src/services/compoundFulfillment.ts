import { getEconomicRequest, type EconomicRequest } from './skillFlows.js';
import { getCanonicalStore } from './canonicalStore.js';

export interface CompoundLeg { id: string; skill: string; status: string; purpose: string; economicRequestId?: string; }

type CompoundStatus = 'pending'|'matched'|'reserved'|'in_fulfillment'|'fulfilled'|'failed'|'cancelled';

/**
 * Compound fulfilment keeps pickup/return/transfer/etc. attached to the same
 * user outcome. Durable child-leg records are owned by the canonical store.
 */
export async function ensureCompoundFulfillmentSchema(): Promise<void> {
  const db = await getCanonicalStore();
  await db.run(`CREATE TABLE IF NOT EXISTS fulfillment_legs (
    id TEXT PRIMARY KEY,
    parent_request_id TEXT NOT NULL,
    skill TEXT NOT NULL,
    purpose TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    requirements_json TEXT NOT NULL DEFAULT '{}',
    child_request_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(parent_request_id, skill, purpose)
  )`);
  await db.run('CREATE INDEX IF NOT EXISTS idx_fulfillment_legs_parent ON fulfillment_legs(parent_request_id, status)');
}

export async function attachCompoundLeg(parentRequestId: string, skill: string, purpose: string, requirements: Record<string, unknown> = {}): Promise<CompoundLeg> {
  await ensureCompoundFulfillmentSchema();
  const parent = await getEconomicRequest(parentRequestId);
  if (!parent) throw new Error('Parent Economic Request not found');
  const id = `leg_${parentRequestId}_${skill}_${Date.now().toString(36)}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const db = await getCanonicalStore();
  await db.run(
    `INSERT INTO fulfillment_legs(id,parent_request_id,skill,purpose,status,requirements_json)
     VALUES(?,?,?,?,?,?)
     ON CONFLICT(parent_request_id,skill,purpose) DO NOTHING`,
    [id, parentRequestId, skill, purpose, 'pending', JSON.stringify(requirements)],
  );
  const row = await db.one<any>('SELECT id,skill,purpose,status,child_request_id FROM fulfillment_legs WHERE parent_request_id=? AND skill=? AND purpose=? LIMIT 1', [parentRequestId, skill, purpose]);
  return {
    id: String(row.id),
    skill: String(row.skill),
    purpose: String(row.purpose),
    status: String(row.status),
    economicRequestId: row.child_request_id ? String(row.child_request_id) : undefined,
  };
}

export async function listCompoundLegs(parentRequestId: string): Promise<CompoundLeg[]> {
  await ensureCompoundFulfillmentSchema();
  const db = await getCanonicalStore();
  const rows = await db.all<any>('SELECT id,skill,purpose,status,child_request_id FROM fulfillment_legs WHERE parent_request_id=? ORDER BY created_at', [parentRequestId]);
  return rows.map(row => ({
    id: String(row.id),
    skill: String(row.skill),
    purpose: String(row.purpose),
    status: String(row.status),
    economicRequestId: row.child_request_id ? String(row.child_request_id) : undefined,
  }));
}

export async function updateCompoundLegStatus(legId: string, status: CompoundStatus, childRequestId?: string): Promise<void> {
  await ensureCompoundFulfillmentSchema();
  const db = await getCanonicalStore();
  await db.run(
    'UPDATE fulfillment_legs SET status=?, child_request_id=COALESCE(?,child_request_id), updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [status, childRequestId || null, legId],
  );
}

export async function compoundOutcomeReady(parent: EconomicRequest): Promise<boolean> {
  const legs = await listCompoundLegs(parent.id);
  if (!legs.length) return true;
  return legs.every(leg => leg.status === 'fulfilled');
}
