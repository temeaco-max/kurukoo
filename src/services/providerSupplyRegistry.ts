import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';
import { providerMayBeDiscovered } from './providerVerification.js';
import { normalizeNigeriaGeography } from './nigeriaGeography.js';
import { assertSupplySourceApproved } from './providerSupplyPolicy.js';
import { detectSupplyDuplicates } from './providerSupplyDuplicates.js';

export const SUPPLY_ENTITY_STATUSES = [
  'discovered', 'imported', 'invited', 'claim_requested', 'claimed',
  'verification_pending', 'verified', 'active', 'suspended', 'removed',
] as const;
export type SupplyEntityStatus = typeof SUPPLY_ENTITY_STATUSES[number];

export const SUPPLY_SOURCE_TYPES = ['public_website', 'public_directory', 'manual_operator', 'provider_claim', 'other'] as const;
export type SupplySourceType = typeof SUPPLY_SOURCE_TYPES[number];
export const SUPPLY_CLAIM_STATUSES = ['requested', 'approved', 'rejected', 'cancelled'] as const;
export type SupplyClaimStatus = typeof SUPPLY_CLAIM_STATUSES[number];

export interface ProviderSupplyEntity {
  id: string;
  businessName: string;
  entityType: string;
  country: string;
  state: string | null;
  lga: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  publicPhone: string | null;
  website: string | null;
  openingHours: Record<string, unknown> | null;
  services: string[];
  status: SupplyEntityStatus;
  sourceType: SupplySourceType;
  sourceUrl: string | null;
  sourceRetrievedAt: string | null;
  sourceConfidence: number | null;
  source: string | null;
  importBatchId: string | null;
  reviewStatus: 'required' | 'reviewed' | 'rejected';
  freshnessState: 'current' | 'stale' | 'review_required' | 'removed';
  nextReviewAt: string | null;
  lastReviewedBy: string | null;
  reviewEvidenceRef: string | null;
  reviewedAt: string | null;
  duplicateReviewStatus: 'clear' | 'possible_duplicate' | 'merged' | 'rejected';
  normalizedState: string | null;
  normalizedStateCode: string | null;
  normalizedLga: string | null;
  locality: string | null;
  geographyStatus: 'normalized' | 'partial' | 'unavailable';
  claimedProviderPhone: string | null;
  linkedProviderPhone: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SupplyProvenanceRecord {
  id: string;
  entityId: string;
  fieldScope: string;
  sourceType: SupplySourceType;
  sourceUrl: string | null;
  retrievedAt: string | null;
  confidence: number | null;
  valueHash: string | null;
  recordedAt: string | null;
}

export interface SupplyClaim {
  id: string;
  entityId: string;
  claimantPhone: string;
  status: SupplyClaimStatus;
  evidenceRef: string | null;
  reviewedByHash: string | null;
  createdAt: string | null;
  reviewedAt: string | null;
}

const supplyStatusSet = new Set<string>(SUPPLY_ENTITY_STATUSES);
const sourceTypeSet = new Set<string>(SUPPLY_SOURCE_TYPES);
const claimStatusSet = new Set<string>(SUPPLY_CLAIM_STATUSES);
const TRANSITIONS: Record<SupplyEntityStatus, SupplyEntityStatus[]> = {
  discovered: ['imported', 'invited', 'claim_requested', 'suspended'],
  imported: ['invited', 'claim_requested', 'suspended'],
  invited: ['claim_requested', 'suspended'],
  claim_requested: ['claimed', 'suspended'],
  claimed: ['verification_pending', 'suspended'],
  verification_pending: ['verified', 'suspended'],
  verified: ['active', 'suspended'],
  active: ['suspended', 'removed'],
  suspended: ['verification_pending', 'removed'],
  removed: [],
};

function cleanText(value: unknown, field: string, maxLength = 500): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`);
  const cleaned = value.trim();
  if (cleaned.length > maxLength) throw new Error(`${field} is too long`);
  return cleaned;
}

function cleanOptionalText(value: unknown, field: string, maxLength = 500): string | null {
  if (value === undefined || value === null || value === '') return null;
  return cleanText(value, field, maxLength);
}

function cleanCountry(value: unknown): string {
  return cleanText(value, 'Country', 3).toLowerCase();
}

function cleanSourceType(value: unknown): SupplySourceType {
  const sourceType = cleanText(value, 'Source type', 64) as SupplySourceType;
  if (!sourceTypeSet.has(sourceType)) throw new Error('Unsupported source type');
  return sourceType;
}

function cleanStatus(value: unknown): SupplyEntityStatus {
  const status = cleanText(value, 'Supply entity status', 64) as SupplyEntityStatus;
  if (!supplyStatusSet.has(status)) throw new Error('Unsupported supply entity status');
  return status;
}

function cleanUrl(value: unknown, field: string): string | null {
  const raw = cleanOptionalText(value, field, 1_500);
  if (!raw) return null;
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new Error(`${field} must be a valid absolute URL`); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`${field} must use HTTP or HTTPS`);
  return parsed.toString();
}

function cleanCoordinate(value: unknown, field: string, min: number, max: number): number | null {
  if (value === undefined || value === null || value === '') return null;
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate) || coordinate < min || coordinate > max) throw new Error(`${field} is out of range`);
  return Number(coordinate.toFixed(7));
}

function cleanServices(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('Services must be an array');
  return Array.from(new Set(value.map(service => cleanText(service, 'Service', 100).toLowerCase()))).slice(0, 40);
}

function cleanObject(value: unknown, field: string): Record<string, unknown> | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be an object`);
  const encoded = JSON.stringify(value);
  if (encoded.length > 10_000) throw new Error(`${field} is too large`);
  return JSON.parse(encoded);
}

function cleanOpeningHours(value: unknown): Record<string, unknown> | null {
  const output = cleanObject(value, 'Opening hours'); if (!output) return null;
  const allowedKey = /^(mon|tue|wed|thu|fri|sat|sun)(day)?([_-].*)?$/i;
  for (const [key, item] of Object.entries(output)) {
    if (!allowedKey.test(key) || /password|token|otp|jwt|nin|employee|customer|private|email/i.test(`${key}:${String(item)}`)) throw new Error('Opening hours may contain only public day and opening-time fields');
  }
  return output;
}

function hashValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function operatorHash(value: string): string {
  const salt = process.env.KURUKOO_SUPPLY_REGISTRY_SALT || process.env.KURUKOO_COORDINATION_SALT || process.env.JWT_SECRET || 'development-supply-registry-salt';
  return crypto.createHash('sha256').update(`${salt}:${value.slice(0, 256)}`).digest('hex').slice(0, 32);
}

function parseJson<T>(value: unknown, fallback: T): T {
  try { return JSON.parse(String(value || '')) as T; } catch { return fallback; }
}

function entityFromRow(row: any): ProviderSupplyEntity {
  return {
    id: String(row.id), businessName: String(row.business_name), entityType: String(row.entity_type), country: String(row.country),
    state: row.state ? String(row.state) : null, lga: row.lga ? String(row.lga) : null, address: row.address ? String(row.address) : null,
    latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude), longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
    publicPhone: row.public_phone ? String(row.public_phone) : null, website: row.website ? String(row.website) : null,
    openingHours: row.opening_hours_json ? parseJson<Record<string, unknown>>(row.opening_hours_json, {}) : null,
    services: parseJson<string[]>(row.services_json, []), status: String(row.status) as SupplyEntityStatus,
    sourceType: String(row.source_type) as SupplySourceType, sourceUrl: row.source_url ? String(row.source_url) : null,
    sourceRetrievedAt: row.source_retrieved_at ? String(row.source_retrieved_at) : null,
    sourceConfidence: row.source_confidence === null || row.source_confidence === undefined ? null : Number(row.source_confidence),
    source: row.source ? String(row.source) : null,
    importBatchId: row.import_batch_id ? String(row.import_batch_id) : null,
    reviewStatus: String(row.review_status || 'required') as ProviderSupplyEntity['reviewStatus'],
    freshnessState: String(row.freshness_state || 'review_required') as ProviderSupplyEntity['freshnessState'],
    nextReviewAt: row.next_review_at ? String(row.next_review_at) : null,
    lastReviewedBy: row.last_reviewed_by ? String(row.last_reviewed_by) : null,
    reviewEvidenceRef: row.review_evidence_ref ? String(row.review_evidence_ref) : null,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    duplicateReviewStatus: String(row.duplicate_review_status || 'clear') as ProviderSupplyEntity['duplicateReviewStatus'],
    normalizedState: row.normalized_state ? String(row.normalized_state) : null,
    normalizedStateCode: row.normalized_state_code ? String(row.normalized_state_code) : null,
    normalizedLga: row.normalized_lga ? String(row.normalized_lga) : null,
    locality: row.locality ? String(row.locality) : null,
    geographyStatus: String(row.geography_status || 'unavailable') as ProviderSupplyEntity['geographyStatus'],
    claimedProviderPhone: row.claimed_provider_phone ? String(row.claimed_provider_phone) : null,
    linkedProviderPhone: row.linked_provider_phone ? String(row.linked_provider_phone) : null,
    createdAt: row.created_at ? String(row.created_at) : null, updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

function provenanceFromRow(row: any): SupplyProvenanceRecord {
  return {
    id: String(row.id), entityId: String(row.entity_id), fieldScope: String(row.field_scope), sourceType: String(row.source_type) as SupplySourceType,
    sourceUrl: row.source_url ? String(row.source_url) : null, retrievedAt: row.retrieved_at ? String(row.retrieved_at) : null,
    confidence: row.confidence === null || row.confidence === undefined ? null : Number(row.confidence), valueHash: row.value_hash ? String(row.value_hash) : null,
    recordedAt: row.recorded_at ? String(row.recorded_at) : null,
  };
}

function claimFromRow(row: any): SupplyClaim {
  return {
    id: String(row.id), entityId: String(row.entity_id), claimantPhone: String(row.claimant_phone), status: String(row.status) as SupplyClaimStatus,
    evidenceRef: row.evidence_ref ? String(row.evidence_ref) : null, reviewedByHash: row.reviewed_by_hash ? String(row.reviewed_by_hash) : null,
    createdAt: row.created_at ? String(row.created_at) : null, reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
  };
}

function tableColumns(db: any, table: string): Set<string> {
  return new Set((db.exec(`PRAGMA table_info(${table})`)[0]?.values || []).map((row: any[]) => String(row[1])));
}

export async function ensureProviderSupplyRegistrySchema(): Promise<void> {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS provider_supply_entities (
    id TEXT PRIMARY KEY,
    business_name TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    country TEXT NOT NULL,
    state TEXT,
    lga TEXT,
    address TEXT,
    latitude REAL,
    longitude REAL,
    public_phone TEXT,
    website TEXT,
    opening_hours_json TEXT,
    services_json TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'discovered',
    source_type TEXT NOT NULL,
    source_url TEXT,
    source_retrieved_at TEXT,
    source_confidence REAL,
    source TEXT,
    import_batch_id TEXT,
    review_status TEXT NOT NULL DEFAULT 'required',
    freshness_state TEXT NOT NULL DEFAULT 'review_required',
    next_review_at TEXT,
    last_reviewed_by TEXT,
    review_evidence_ref TEXT,
    reviewed_at TEXT,
    duplicate_review_status TEXT NOT NULL DEFAULT 'clear',
    normalized_state TEXT,
    normalized_state_code TEXT,
    normalized_lga TEXT,
    locality TEXT,
    geography_status TEXT NOT NULL DEFAULT 'unavailable',
    claimed_provider_phone TEXT,
    linked_provider_phone TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_supply_entities_country_status ON provider_supply_entities(country,status,updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_supply_entities_location ON provider_supply_entities(country,state,lga);
  CREATE INDEX IF NOT EXISTS idx_supply_entities_linked_provider ON provider_supply_entities(linked_provider_phone);
  CREATE INDEX IF NOT EXISTS idx_supply_entities_freshness ON provider_supply_entities(country,freshness_state,next_review_at);
  CREATE INDEX IF NOT EXISTS idx_supply_entities_duplicate ON provider_supply_entities(duplicate_review_status);
  CREATE TABLE IF NOT EXISTS provider_supply_provenance (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    field_scope TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_url TEXT,
    retrieved_at TEXT,
    confidence REAL,
    value_hash TEXT,
    recorded_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_supply_provenance_entity ON provider_supply_provenance(entity_id,recorded_at DESC);
  CREATE TABLE IF NOT EXISTS provider_supply_claims (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    claimant_phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested',
    evidence_ref TEXT,
    reviewed_by_hash TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_id, claimant_phone)
  );
  CREATE INDEX IF NOT EXISTS idx_supply_claims_status ON provider_supply_claims(status,created_at);
  CREATE TABLE IF NOT EXISTS provider_supply_events (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    claim_id TEXT,
    event_name TEXT NOT NULL,
    actor_hash TEXT NOT NULL,
    evidence_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_supply_events_entity ON provider_supply_events(entity_id,created_at);
  CREATE TABLE IF NOT EXISTS provider_supply_duplicates (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    candidate_entity_id TEXT NOT NULL,
    matching_signals_json TEXT NOT NULL DEFAULT '{}',
    confidence REAL NOT NULL DEFAULT 0,
    operator_decision TEXT NOT NULL DEFAULT 'pending',
    reviewed_by_hash TEXT,
    reviewed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_id,candidate_entity_id)
  );
  CREATE INDEX IF NOT EXISTS idx_supply_duplicates_decision ON provider_supply_duplicates(operator_decision,created_at);`);
  const columns = tableColumns(db, 'provider_supply_entities');
  const additions: Array<[string, string]> = [
    ['source', 'TEXT'], ['import_batch_id', 'TEXT'], ['review_status', "TEXT NOT NULL DEFAULT 'required'"], ['freshness_state', "TEXT NOT NULL DEFAULT 'review_required'"],
    ['next_review_at', 'TEXT'], ['last_reviewed_by', 'TEXT'], ['review_evidence_ref', 'TEXT'], ['reviewed_at', 'TEXT'], ['duplicate_review_status', "TEXT NOT NULL DEFAULT 'clear'"],
    ['normalized_state', 'TEXT'], ['normalized_state_code', 'TEXT'], ['normalized_lga', 'TEXT'], ['locality', 'TEXT'], ['geography_status', "TEXT NOT NULL DEFAULT 'unavailable'"],
  ];
  for (const [column, definition] of additions) if (!columns.has(column)) db.run(`ALTER TABLE provider_supply_entities ADD COLUMN ${column} ${definition}`);
}

async function recordSupplyEvent(input: { entityId: string; claimId?: string; event: string; actor: string; evidence?: Record<string, unknown> }): Promise<void> {
  await ensureProviderSupplyRegistrySchema();
  const db = await getDb();
  db.run(`INSERT INTO provider_supply_events(id,entity_id,claim_id,event_name,actor_hash,evidence_json) VALUES (?,?,?,?,?,?)`, [crypto.randomUUID(), input.entityId, input.claimId || null, input.event, operatorHash(input.actor), JSON.stringify(input.evidence || {}).slice(0, 2_000)]);
  saveDb();
}

async function recordProvenance(input: { entityId: string; fieldScope: string; sourceType: SupplySourceType; sourceUrl: string | null; retrievedAt: string | null; confidence: number | null; value: unknown }): Promise<void> {
  await ensureProviderSupplyRegistrySchema();
  const db = await getDb();
  db.run(`INSERT INTO provider_supply_provenance(id,entity_id,field_scope,source_type,source_url,retrieved_at,confidence,value_hash) VALUES (?,?,?,?,?,?,?,?)`, [crypto.randomUUID(), input.entityId, input.fieldScope, input.sourceType, input.sourceUrl, input.retrievedAt, input.confidence, hashValue(input.value)]);
  saveDb();
}

export async function getProviderSupplyEntity(id: string): Promise<ProviderSupplyEntity | null> {
  await ensureProviderSupplyRegistrySchema();
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM provider_supply_entities WHERE id=? LIMIT 1'); stmt.bind([cleanText(id, 'Supply entity id', 128)]);
  const row = stmt.step() ? stmt.getAsObject() : null; stmt.free();
  return row ? entityFromRow(row) : null;
}

export async function importProviderSupplyEntity(input: { businessName: unknown; entityType?: unknown; country: unknown; state?: unknown; lga?: unknown; locality?: unknown; address?: unknown; latitude?: unknown; longitude?: unknown; publicPhone?: unknown; website?: unknown; openingHours?: unknown; services?: unknown; source?: unknown; sourceType: unknown; sourceUrl?: unknown; sourceRetrievedAt?: unknown; sourceConfidence?: unknown; importBatchId?: unknown; operatorId: string; }): Promise<ProviderSupplyEntity> {
  await ensureProviderSupplyRegistrySchema();
  const businessName = cleanText(input.businessName, 'Business name', 300);
  const entityType = cleanOptionalText(input.entityType ?? 'business', 'Entity type', 64) || 'business';
  const geography = normalizeNigeriaGeography(input.country, input.state, input.lga, input.locality);
  const country = geography.countryCode;
  const state = geography.stateName; const lga = geography.lgaName; const locality = geography.locality;
  const address = cleanOptionalText(input.address, 'Address', 1_000); const publicPhone = cleanOptionalText(input.publicPhone, 'Public business phone', 128);
  const website = cleanUrl(input.website, 'Website'); const openingHours = cleanOpeningHours(input.openingHours); const services = cleanServices(input.services);
  const sourceType = cleanSourceType(input.sourceType); const sourceUrl = cleanUrl(input.sourceUrl, 'Source URL');
  const source = cleanOptionalText(input.source, 'Source', 300) || (sourceUrl ? new URL(sourceUrl).hostname : 'manual_operator');
  await assertSupplySourceApproved({ source, sourceType, sourceUrl });
  const sourceRetrievedAt = cleanOptionalText(input.sourceRetrievedAt, 'Source retrieved at', 64) || new Date().toISOString();
  const retrievedDate = new Date(sourceRetrievedAt); if (!Number.isFinite(retrievedDate.getTime()) || retrievedDate.getTime() > Date.now() + 60_000) throw new Error('Source retrieved at must be a valid non-future timestamp');
  const sourceConfidence = input.sourceConfidence === undefined || input.sourceConfidence === null || input.sourceConfidence === '' ? null : Number(input.sourceConfidence);
  if (sourceConfidence !== null && (!Number.isFinite(sourceConfidence) || sourceConfidence < 0 || sourceConfidence > 1)) throw new Error('Source confidence must be between 0 and 1');
  const importBatchId = cleanOptionalText(input.importBatchId, 'Import batch id', 128) || `batch-${crypto.randomUUID()}`;
  const entity: ProviderSupplyEntity = { id: crypto.randomUUID(), businessName, entityType, country, state, lga, address, latitude: cleanCoordinate(input.latitude, 'Latitude', -90, 90), longitude: cleanCoordinate(input.longitude, 'Longitude', -180, 180), publicPhone, website, openingHours, services, status: 'imported', sourceType, sourceUrl, sourceRetrievedAt, sourceConfidence, source, importBatchId, reviewStatus: 'required', freshnessState: 'review_required', nextReviewAt: null, lastReviewedBy: null, reviewEvidenceRef: null, reviewedAt: null, duplicateReviewStatus: 'clear', normalizedState: geography.stateName, normalizedStateCode: geography.stateCode, normalizedLga: geography.lgaName, locality, geographyStatus: geography.normalizationStatus, claimedProviderPhone: null, linkedProviderPhone: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const db = await getDb();
  db.run(`INSERT INTO provider_supply_entities(id,business_name,entity_type,country,state,lga,address,latitude,longitude,public_phone,website,opening_hours_json,services_json,status,source_type,source_url,source_retrieved_at,source_confidence,source,import_batch_id,review_status,freshness_state,normalized_state,normalized_state_code,normalized_lga,locality,geography_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [entity.id, entity.businessName, entity.entityType, entity.country, entity.state, entity.lga, entity.address, entity.latitude, entity.longitude, entity.publicPhone, entity.website, entity.openingHours ? JSON.stringify(entity.openingHours) : null, JSON.stringify(entity.services), entity.status, entity.sourceType, entity.sourceUrl, entity.sourceRetrievedAt, entity.sourceConfidence, entity.source, entity.importBatchId, entity.reviewStatus, entity.freshnessState, entity.normalizedState, entity.normalizedStateCode, entity.normalizedLga, entity.locality, entity.geographyStatus]);
  await recordProvenance({ entityId: entity.id, fieldScope: 'business_profile', sourceType, sourceUrl, retrievedAt: sourceRetrievedAt, confidence: sourceConfidence, value: { businessName, country, state, lga, locality, address, website, services, publicPhone } });
  const duplicateCandidates = await detectSupplyDuplicates(entity.id);
  await recordSupplyEvent({ entityId: entity.id, event: 'supply_entity_imported', actor: input.operatorId, evidence: { source_type: sourceType, source_url_present: Boolean(sourceUrl), source, import_batch_id: importBatchId, review_status: 'required', freshness_state: 'review_required', duplicate_candidates: duplicateCandidates.length, public_listing_only: true } });
  saveDb();
  return (await getProviderSupplyEntity(entity.id))!;
}

export async function listProviderSupplyEntities(input: { country?: unknown; status?: unknown; limit?: unknown; offset?: unknown }): Promise<ProviderSupplyEntity[]> {
  await ensureProviderSupplyRegistrySchema();
  const country = input.country === undefined || input.country === null || input.country === '' ? null : cleanCountry(input.country);
  const status = input.status === undefined || input.status === null || input.status === '' ? null : cleanStatus(input.status);
  const limit = Math.min(Math.max(Number(input.limit) || 30, 1), 100); const offset = Math.max(Number(input.offset) || 0, 0);
  const clauses: string[] = []; const params: unknown[] = [];
  if (country) { clauses.push('country=?'); params.push(country); } if (status) { clauses.push('status=?'); params.push(status); }
  const db = await getDb(); const stmt = db.prepare(`SELECT * FROM provider_supply_entities ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY updated_at DESC,id DESC LIMIT ? OFFSET ?`);
  stmt.bind([...params, limit, offset]); const output: ProviderSupplyEntity[] = []; while (stmt.step()) output.push(entityFromRow(stmt.getAsObject())); stmt.free(); return output;
}

export async function listSupplyProvenance(entityId: string): Promise<SupplyProvenanceRecord[]> {
  await ensureProviderSupplyRegistrySchema(); const db = await getDb();
  const stmt = db.prepare('SELECT * FROM provider_supply_provenance WHERE entity_id=? ORDER BY recorded_at DESC,id DESC'); stmt.bind([cleanText(entityId, 'Supply entity id', 128)]);
  const output: SupplyProvenanceRecord[] = []; while (stmt.step()) output.push(provenanceFromRow(stmt.getAsObject())); stmt.free(); return output;
}

export async function requestSupplyEntityClaim(input: { entityId: string; claimantPhone: string }): Promise<SupplyClaim> {
  const entity = await getProviderSupplyEntity(input.entityId); if (!entity) throw new Error('Supply entity not found');
  if (!['discovered', 'imported', 'invited', 'claim_requested'].includes(entity.status)) throw new Error('This supply entity is not open for a claim request');
  if (entity.reviewStatus !== 'reviewed' || entity.freshnessState !== 'current') throw new Error('A current operator-reviewed supply listing is required before claiming');
  const claimantPhone = cleanText(input.claimantPhone, 'Authenticated claimant', 128); const db = await getDb();
  const existing = db.prepare('SELECT * FROM provider_supply_claims WHERE entity_id=? AND claimant_phone=? LIMIT 1'); existing.bind([entity.id, claimantPhone]); const existingRow = existing.step() ? existing.getAsObject() : null; existing.free(); if (existingRow) return claimFromRow(existingRow);
  const claim: SupplyClaim = { id: crypto.randomUUID(), entityId: entity.id, claimantPhone, status: 'requested', evidenceRef: null, reviewedByHash: null, createdAt: new Date().toISOString(), reviewedAt: null };
  db.run(`INSERT INTO provider_supply_claims(id,entity_id,claimant_phone,status) VALUES (?,?,?,'requested')`, [claim.id, claim.entityId, claim.claimantPhone]);
  if (entity.status !== 'claim_requested') db.run(`UPDATE provider_supply_entities SET status='claim_requested',updated_at=CURRENT_TIMESTAMP WHERE id=?`, [entity.id]);
  await recordProvenance({ entityId: entity.id, fieldScope: 'claim_request', sourceType: 'provider_claim', sourceUrl: null, retrievedAt: new Date().toISOString(), confidence: null, value: { claimant: claimantPhone } });
  await recordSupplyEvent({ entityId: entity.id, claimId: claim.id, event: 'supply_entity_claim_requested', actor: claimantPhone, evidence: { public_listing_only: true } }); saveDb(); return claim;
}

export async function reviewSupplyEntityClaim(input: { claimId: string; operatorId: string; decision: 'approved' | 'rejected'; evidenceRef?: unknown }): Promise<SupplyClaim> {
  const decision = cleanText(input.decision, 'Claim decision', 32) as SupplyClaimStatus; if (!['approved', 'rejected'].includes(decision) || !claimStatusSet.has(decision)) throw new Error('Claim decision must be approved or rejected');
  const db = await getDb(); const stmt = db.prepare('SELECT * FROM provider_supply_claims WHERE id=? LIMIT 1'); stmt.bind([cleanText(input.claimId, 'Claim id', 128)]); const row = stmt.step() ? stmt.getAsObject() : null; stmt.free(); if (!row) throw new Error('Supply claim not found'); const claim = claimFromRow(row);
  if (claim.status !== 'requested') throw new Error('Only requested supply claims can be reviewed'); const evidenceRef = cleanOptionalText(input.evidenceRef, 'Claim evidence reference', 500); if (decision === 'approved' && !evidenceRef) throw new Error('Approved supply claims require an evidence reference');
  db.run(`UPDATE provider_supply_claims SET status=?,evidence_ref=?,reviewed_by_hash=?,reviewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`, [decision, evidenceRef, operatorHash(cleanText(input.operatorId, 'Operator identity', 128)), claim.id]);
  if (decision === 'approved') db.run(`UPDATE provider_supply_entities SET status='claimed',claimed_provider_phone=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`, [claim.claimantPhone, claim.entityId]);
  await recordSupplyEvent({ entityId: claim.entityId, claimId: claim.id, event: `supply_entity_claim_${decision}`, actor: input.operatorId, evidence: { evidence_ref_present: Boolean(evidenceRef) } }); saveDb();
  const updated = db.prepare('SELECT * FROM provider_supply_claims WHERE id=?'); updated.bind([claim.id]); const updatedRow = updated.step() ? updated.getAsObject() : null; updated.free(); return claimFromRow(updatedRow);
}

export async function transitionSupplyEntity(input: { entityId: string; status: SupplyEntityStatus; operatorId: string }): Promise<ProviderSupplyEntity> {
  const entity = await getProviderSupplyEntity(input.entityId); if (!entity) throw new Error('Supply entity not found'); const target = cleanStatus(input.status);
  if (target !== entity.status && !(TRANSITIONS[entity.status] || []).includes(target)) throw new Error(`Invalid supply entity transition: ${entity.status} -> ${target}`);
  const db = await getDb(); db.run('UPDATE provider_supply_entities SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [target, entity.id]); await recordSupplyEvent({ entityId: entity.id, event: `supply_entity_${target}`, actor: input.operatorId, evidence: {} }); saveDb(); return (await getProviderSupplyEntity(entity.id))!;
}

export async function activateClaimedSupplyEntity(input: { entityId: string; operatorId: string }): Promise<ProviderSupplyEntity> {
  const entity = await getProviderSupplyEntity(input.entityId); if (!entity) throw new Error('Supply entity not found');
  if (entity.status !== 'verified' || !entity.claimedProviderPhone) throw new Error('Only a claimed and registry-verified supply entity can be activated');
  if (!await providerMayBeDiscovered(entity.claimedProviderPhone)) throw new Error('Linked provider account lacks authoritative verification evidence');
  const db = await getDb(); const capability = db.prepare('SELECT 1 FROM skills WHERE phone=? AND is_available=1 LIMIT 1'); capability.bind([entity.claimedProviderPhone]); const hasCapability = capability.step(); capability.free(); if (!hasCapability) throw new Error('Linked provider account must configure at least one available capability before activation');
  db.run(`UPDATE provider_supply_entities SET status='active',linked_provider_phone=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`, [entity.claimedProviderPhone, entity.id]);
  await recordSupplyEvent({ entityId: entity.id, event: 'supply_entity_activated', actor: input.operatorId, evidence: { provider_verification_revalidated: true, available_capability_present: true } }); saveDb(); return (await getProviderSupplyEntity(entity.id))!;
}

export async function listSupplyClaims(status?: unknown): Promise<SupplyClaim[]> {
  await ensureProviderSupplyRegistrySchema(); const normalized = status === undefined || status === null || status === '' ? null : cleanText(status, 'Claim status', 32) as SupplyClaimStatus; if (normalized && !claimStatusSet.has(normalized)) throw new Error('Unsupported claim status'); const db = await getDb(); const stmt = db.prepare(`SELECT * FROM provider_supply_claims ${normalized ? 'WHERE status=?' : ''} ORDER BY created_at ASC`); if (normalized) stmt.bind([normalized]); const output: SupplyClaim[] = []; while (stmt.step()) output.push(claimFromRow(stmt.getAsObject())); stmt.free(); return output;
}

export interface PublicSupplyListing {
  id: string;
  label: 'Publicly listed business';
  businessName: string;
  category: string;
  state: string | null;
  lga: string | null;
  locality: string | null;
  address: string | null;
  website: string | null;
  publicPhone: string | null;
  openingHours: Record<string, unknown> | null;
  services: string[];
  sourceType: SupplySourceType;
  sourceRetrievedAt: string | null;
  freshnessState: 'current';
  providerStatus: 'not_claimed' | 'claimed_verification_pending';
  providerVerified: false;
  availability: 'unknown';
  price: 'unknown';
}

export async function listPublicProviderSupplyListings(input: { state?: unknown; lga?: unknown; limit?: unknown }): Promise<PublicSupplyListing[]> {
  await ensureProviderSupplyRegistrySchema();
  const state = input.state ? normalizeNigeriaGeography('ng', input.state, undefined).stateName : null;
  const lga = input.lga ? normalizeNigeriaGeography('ng', undefined, input.lga).lgaName : null;
  const limit = Math.min(Math.max(Number(input.limit) || 20, 1), 50); const db = await getDb();
  const clauses = ["country='ng'", "review_status='reviewed'", "freshness_state='current'", "duplicate_review_status IN ('clear','rejected')", "status IN ('imported','invited','claim_requested','claimed','verification_pending')"]; const params: unknown[] = [];
  if (state) { clauses.push('normalized_state=?'); params.push(state); } if (lga) { clauses.push('normalized_lga=?'); params.push(lga); }
  const stmt = db.prepare(`SELECT * FROM provider_supply_entities WHERE ${clauses.join(' AND ')} ORDER BY updated_at DESC,id DESC LIMIT ?`); stmt.bind([...params, limit]); const output: PublicSupplyListing[] = [];
  while (stmt.step()) { const entity = entityFromRow(stmt.getAsObject()); output.push({ id: entity.id, label: 'Publicly listed business', businessName: entity.businessName, category: entity.entityType, state: entity.normalizedState, lga: entity.normalizedLga, locality: entity.locality, address: entity.address, website: entity.website, publicPhone: entity.publicPhone, openingHours: entity.openingHours, services: entity.services, sourceType: entity.sourceType, sourceRetrievedAt: entity.sourceRetrievedAt, freshnessState: 'current', providerStatus: entity.claimedProviderPhone ? 'claimed_verification_pending' : 'not_claimed', providerVerified: false, availability: 'unknown', price: 'unknown' }); }
  stmt.free(); return output;
}

export async function importProviderSupplyBatch(input: { records: unknown; operatorId: string; batchId?: unknown }): Promise<{ batchId: string; imported: ProviderSupplyEntity[]; rejected: Array<{ index: number; error: string }>; limits: { maxRecords: number; maxPayloadBytes: number } }> {
  if (!Array.isArray(input.records)) throw new Error('Import records must be an array');
  const maxRecords = 10; const maxPayloadBytes = 100_000; const payloadBytes = Buffer.byteLength(JSON.stringify(input.records), 'utf8');
  if (input.records.length < 1 || input.records.length > maxRecords) throw new Error(`Controlled imports allow 1-${maxRecords} records per batch`);
  if (payloadBytes > maxPayloadBytes) throw new Error('Import payload exceeds the controlled batch size');
  const batchId = cleanOptionalText(input.batchId, 'Import batch id', 128) || `batch-${crypto.randomUUID()}`; const imported: ProviderSupplyEntity[] = []; const rejected: Array<{ index: number; error: string }> = [];
  for (const [index, record] of input.records.entries()) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) { rejected.push({ index, error: 'Each import record must be an object' }); continue; }
    try { const payload = { ...(record as Record<string, unknown>), importBatchId: batchId, operatorId: input.operatorId } as Parameters<typeof importProviderSupplyEntity>[0]; imported.push(await importProviderSupplyEntity(payload)); }
    catch (error) { rejected.push({ index, error: error instanceof Error ? error.message : 'Record rejected' }); }
  }
  return { batchId, imported, rejected, limits: { maxRecords, maxPayloadBytes } };
}
