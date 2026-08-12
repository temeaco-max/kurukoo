import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';
import type { SupplySourceType } from './providerSupplyRegistry.js';

const SUPPLY_SOURCE_TYPES: readonly SupplySourceType[] = ['public_website', 'public_directory', 'manual_operator', 'provider_claim', 'other'];

export interface SupplySourcePolicy {
  id: string;
  source: string;
  sourceType: SupplySourceType;
  sourceUrlPattern: string | null;
  allowedForImport: boolean;
  termsReviewStatus: 'approved' | 'pending' | 'rejected';
  operatorApproved: boolean;
  freshnessWindowDays: number;
  countryCode: 'ng';
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function text(value: unknown, field: string, max = 500): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`);
  const output = value.trim(); if (output.length > max) throw new Error(`${field} is too long`); return output;
}

function policyFromRow(row: any): SupplySourcePolicy {
  return { id: String(row.id), source: String(row.source), sourceType: String(row.source_type) as SupplySourceType, sourceUrlPattern: row.source_url_pattern ? String(row.source_url_pattern) : null, allowedForImport: Number(row.allowed_for_import) === 1, termsReviewStatus: String(row.terms_review_status) as SupplySourcePolicy['termsReviewStatus'], operatorApproved: Number(row.operator_approved) === 1, freshnessWindowDays: Number(row.freshness_window_days), countryCode: 'ng', notes: row.notes ? String(row.notes) : null, createdAt: row.created_at ? String(row.created_at) : null, updatedAt: row.updated_at ? String(row.updated_at) : null };
}

export async function ensureSupplyPolicySchema(): Promise<void> {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS provider_supply_source_policies (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_url_pattern TEXT,
    allowed_for_import INTEGER NOT NULL DEFAULT 0,
    terms_review_status TEXT NOT NULL DEFAULT 'pending',
    operator_approved INTEGER NOT NULL DEFAULT 0,
    freshness_window_days INTEGER NOT NULL DEFAULT 90,
    country_code TEXT NOT NULL DEFAULT 'ng',
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source, source_type)
  );
  CREATE INDEX IF NOT EXISTS idx_supply_policy_allowed ON provider_supply_source_policies(source_type,allowed_for_import,operator_approved);`);
}

export async function upsertSupplySourcePolicy(input: { source: unknown; sourceType: unknown; sourceUrlPattern?: unknown; allowedForImport?: unknown; termsReviewStatus?: unknown; operatorApproved?: unknown; freshnessWindowDays?: unknown; notes?: unknown; operatorId: string }): Promise<SupplySourcePolicy> {
  await ensureSupplyPolicySchema();
  const source = text(input.source, 'Source', 300); const sourceType = text(input.sourceType, 'Source type', 64) as SupplySourceType;
  if (!SUPPLY_SOURCE_TYPES.includes(sourceType)) throw new Error('Unsupported source type');
  const termsReviewStatus = text(input.termsReviewStatus || 'pending', 'Terms review status', 32) as SupplySourcePolicy['termsReviewStatus'];
  if (!['approved', 'pending', 'rejected'].includes(termsReviewStatus)) throw new Error('Unsupported terms review status');
  const freshnessWindowDays = Math.min(Math.max(Number(input.freshnessWindowDays) || 90, 1), 365);
  const id = crypto.createHash('sha256').update(`${source}:${sourceType}`).digest('hex').slice(0, 32); const db = await getDb();
  db.run(`INSERT INTO provider_supply_source_policies(id,source,source_type,source_url_pattern,allowed_for_import,terms_review_status,operator_approved,freshness_window_days,country_code,notes,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(source,source_type) DO UPDATE SET source_url_pattern=excluded.source_url_pattern,allowed_for_import=excluded.allowed_for_import,terms_review_status=excluded.terms_review_status,operator_approved=excluded.operator_approved,freshness_window_days=excluded.freshness_window_days,notes=excluded.notes,updated_at=CURRENT_TIMESTAMP`, [id, source, sourceType, input.sourceUrlPattern ? text(input.sourceUrlPattern, 'Source URL pattern', 500) : null, input.allowedForImport ? 1 : 0, termsReviewStatus, input.operatorApproved ? 1 : 0, freshnessWindowDays, 'ng', input.notes ? text(input.notes, 'Policy notes', 1_000) : null]);
  saveDb(); return (await getSupplySourcePolicy(source, sourceType))!;
}

export async function getSupplySourcePolicy(source: string, sourceType: SupplySourceType): Promise<SupplySourcePolicy | null> {
  await ensureSupplyPolicySchema(); const db = await getDb(); const stmt = db.prepare('SELECT * FROM provider_supply_source_policies WHERE source=? AND source_type=? LIMIT 1'); stmt.bind([source, sourceType]); const row = stmt.step() ? stmt.getAsObject() : null; stmt.free(); return row ? policyFromRow(row) : null;
}

export async function listSupplySourcePolicies(): Promise<SupplySourcePolicy[]> {
  await ensureSupplyPolicySchema(); const db = await getDb(); const stmt = db.prepare('SELECT * FROM provider_supply_source_policies ORDER BY source ASC, source_type ASC'); const rows: SupplySourcePolicy[] = []; while (stmt.step()) rows.push(policyFromRow(stmt.getAsObject())); stmt.free(); return rows;
}

export async function assertSupplySourceApproved(input: { source: string; sourceType: SupplySourceType; sourceUrl: string | null }): Promise<SupplySourcePolicy> {
  const policy = await getSupplySourcePolicy(input.source, input.sourceType);
  if (!policy || !policy.allowedForImport || !policy.operatorApproved || policy.termsReviewStatus !== 'approved') throw new Error('Source is not approved for controlled import');
  if (['public_website', 'public_directory'].includes(input.sourceType) && !input.sourceUrl) throw new Error('Approved public source requires a source URL');
  if (policy.sourceUrlPattern && input.sourceUrl && !input.sourceUrl.startsWith(policy.sourceUrlPattern)) throw new Error('Source URL does not match the approved source policy');
  return policy;
}
