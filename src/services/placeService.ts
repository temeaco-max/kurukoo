/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { randomUUID } from 'crypto';
import { getDb, saveDb } from '../database.js';
import { createEconomicRequest } from './skillFlows.js';
import { notifyRelationshipTargetUpdate } from './relationshipService.js';

/**
 * Kurukoo Places — "See it. Shape it. Build it."
 *
 * Canonical owner for Place / Concept / Vote entities. Reuses (never duplicates):
 * - discoveryNetwork: canonical spatial interface (Places are queryable nearby entities)
 * - topicService: discussion owner (a Place may link a Topic for comments)
 * - opportunityEngine: demand/interest feed (strong concepts become opportunities)
 * - skillFlows Economic Request: "Make this real" execution owner
 * - nearbyPulse: presence/privacy patterns (fuzzed public coordinates)
 *
 * Truth rules: every reality/needs claim carries a confidence label
 * (verified | estimated | community-reported | missing). Missing data is shown
 * as missing — never invented.
 */

export type PlaceStatus =
  | 'observed' | 'visioning' | 'proposed' | 'approved' | 'building' | 'built';
export type ConceptStatus =
  | 'draft' | 'published' | 'leading' | 'proposed' | 'approved' | 'building' | 'built';
export type ConceptScenario =
  | 'community_growth' | 'commercial' | 'green' | 'future_city' | 'custom';
export type Confidence = 'verified' | 'estimated' | 'community-reported' | 'missing';
export type VoterRole = 'lives_here' | 'works_here' | 'owns_here' | 'interested';

export const PLACE_STATUSES: PlaceStatus[] = [
  'observed', 'visioning', 'proposed', 'approved', 'building', 'built',
];
export const CONCEPT_STATUSES: ConceptStatus[] = [
  'draft', 'published', 'leading', 'proposed', 'approved', 'building', 'built',
];
/** Moderation adds removal; removed concepts are hidden from every public surface. */
export const ADMIN_CONCEPT_STATUSES = [...CONCEPT_STATUSES, 'removed'] as const;
export type AdminConceptStatus = typeof ADMIN_CONCEPT_STATUSES[number];
export const CONCEPT_SCENARIOS: ConceptScenario[] = [
  'community_growth', 'commercial', 'green', 'future_city', 'custom',
];
export const VOTER_ROLES: VoterRole[] = ['lives_here', 'works_here', 'owns_here', 'interested'];

/** Scenario prompts for "Show me what this could become" (text-first; imagery is pay-per-use, on demand only). */
export const SCENARIO_TEMPLATES: Record<ConceptScenario, { title: string; focus: string[]; brief: string }> = {
  community_growth: {
    title: 'Community Growth',
    focus: ['affordable housing', 'schools', 'clinics', 'local markets', 'parks', 'pedestrian routes', 'drainage'],
    brief: 'Growth around everyday needs: housing, learning, care, trade and shared space.',
  },
  commercial: {
    title: 'Commercial Growth',
    focus: ['retail', 'offices', 'hospitality', 'transport interchange', 'mixed-use buildings', 'logistics'],
    brief: 'Jobs and trade first: where commerce clusters without choking movement.',
  },
  green: {
    title: 'Green Neighbourhood',
    focus: ['trees', 'parks', 'walking routes', 'cycling', 'water management', 'community spaces'],
    brief: 'Lower density, more canopy and water sense: a place that breathes.',
  },
  future_city: {
    title: 'Future City',
    focus: ['density done well', 'transit spine', 'digital infrastructure', 'energy', 'public realm'],
    brief: 'Ambitious transformation anchored to the same geography and constraints.',
  },
  custom: {
    title: 'Custom vision',
    focus: [],
    brief: 'A creator-led vision that does not fit one template.',
  },
};

export interface PlaceInput {
  name: unknown;
  state?: unknown;
  lga?: unknown;
  centerLat: unknown;
  centerLng: unknown;
  bbox?: unknown;
  reality?: unknown;
  topicId?: unknown;
}

export interface ConceptInput {
  title: unknown;
  description: unknown;
  scenario?: unknown;
  assets?: unknown;
  feasibility?: unknown;
  sponsored?: unknown;
  sponsorLabel?: unknown;
}

let schemaReady = false;

export async function ensurePlaceSchema(): Promise<void> {
  if (schemaReady) return;
  const db = await getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS places (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      state TEXT,
      lga TEXT,
      center_lat REAL NOT NULL,
      center_lng REAL NOT NULL,
      bbox_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'observed',
      reality_json TEXT NOT NULL DEFAULT '{}',
      confidence_json TEXT NOT NULL DEFAULT '{}',
      needs_json TEXT NOT NULL DEFAULT '[]',
      topic_id TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_places_slug ON places(slug);
    CREATE INDEX IF NOT EXISTS idx_places_state_lga ON places(state, lga);
    CREATE INDEX IF NOT EXISTS idx_places_status ON places(status);
    CREATE TABLE IF NOT EXISTS place_concepts (
      id TEXT PRIMARY KEY,
      place_id TEXT NOT NULL REFERENCES places(id),
      creator_phone TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      scenario TEXT NOT NULL DEFAULT 'custom',
      parent_concept_id TEXT REFERENCES place_concepts(id),
      version INTEGER NOT NULL DEFAULT 1,
      assets_json TEXT NOT NULL DEFAULT '[]',
      feasibility_json TEXT NOT NULL DEFAULT '{}',
      evidence_json TEXT NOT NULL DEFAULT '[]',
      sponsored INTEGER NOT NULL DEFAULT 0,
      sponsor_label TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      economic_request_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_place_concepts_place ON place_concepts(place_id, status);
    CREATE INDEX IF NOT EXISTS idx_place_concepts_parent ON place_concepts(parent_concept_id);
    CREATE TABLE IF NOT EXISTS place_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      concept_id TEXT NOT NULL REFERENCES place_concepts(id),
      voter_phone TEXT NOT NULL,
      value INTEGER NOT NULL CHECK(value IN (1, -1)),
      role TEXT NOT NULL DEFAULT 'interested',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(concept_id, voter_phone)
    );
    CREATE INDEX IF NOT EXISTS idx_place_votes_concept ON place_votes(concept_id);
  `);
  // Creator milestone flag (additive; never rewrites existing rows).
  try {
    const conceptCols = (db.exec('PRAGMA table_info(place_concepts)')[0]?.values || []).map((c: unknown[]) => String(c[1]));
    if (!conceptCols.includes('rewarded')) db.run('ALTER TABLE place_concepts ADD COLUMN rewarded INTEGER NOT NULL DEFAULT 0');
  } catch { /* reward flag unavailable; voting continues without rewards */ }
  // Opportunity link columns (additive; never rewrites existing rows).
  await ensureOpportunityPlaceColumns();
  db.run(`
    CREATE TABLE IF NOT EXISTS place_imagery_epochs (
      id TEXT PRIMARY KEY,
      place_id TEXT NOT NULL REFERENCES places(id),
      epoch_label TEXT NOT NULL,
      captured_at TEXT,
      source TEXT NOT NULL,
      url TEXT,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(place_id, epoch_label)
    );
    CREATE INDEX IF NOT EXISTS idx_place_imagery_epochs_place ON place_imagery_epochs(place_id);
    CREATE TABLE IF NOT EXISTS place_approvals (
      id TEXT PRIMARY KEY,
      place_id TEXT NOT NULL REFERENCES places(id),
      concept_id TEXT NOT NULL REFERENCES place_concepts(id),
      requester_phone TEXT NOT NULL,
      authority TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested', 'under_review', 'approved', 'rejected', 'needs_changes')),
      note TEXT,
      reviewer TEXT,
      decided_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_place_approvals_concept ON place_approvals(concept_id, status);
    CREATE INDEX IF NOT EXISTS idx_place_approvals_place ON place_approvals(place_id);
  `);
  saveDb();
  schemaReady = true;
}

async function ensureOpportunityPlaceColumns(): Promise<void> {
  const db = await getDb();
  try {
    db.run('CREATE TABLE IF NOT EXISTS proactive_opportunities (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT, type TEXT, title TEXT, subtitle TEXT, cta_text TEXT, cta_link TEXT, urgency REAL DEFAULT 0.5, business_value REAL DEFAULT 0.5, status TEXT DEFAULT \'sent\', created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)');
    const cols = (db.exec('PRAGMA table_info(proactive_opportunities)')[0]?.values || []).map((c: unknown[]) => String(c[1]));
    if (!cols.includes('place_id')) db.run('ALTER TABLE proactive_opportunities ADD COLUMN place_id TEXT');
    if (!cols.includes('concept_id')) db.run('ALTER TABLE proactive_opportunities ADD COLUMN concept_id TEXT');
  } catch { /* opportunity feed unavailable; place flow continues */ }
}

function cleanText(value: unknown, field: string, minimum: number, maximum: number): string {
  if (typeof value !== 'string') throw new Error(`${field} is required`);
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean.length < minimum || clean.length > maximum) throw new Error(`${field} must be between ${minimum} and ${maximum} characters`);
  return clean;
}

function cleanCoord(value: unknown, field: string): number {
  const num = Number(value);
  if (!Number.isFinite(num)) throw new Error(`${field} must be a number`);
  if (field === 'centerLat' && (num < -90 || num > 90)) throw new Error('centerLat must be between -90 and 90');
  if (field === 'centerLng' && (num < -180 || num > 180)) throw new Error('centerLng must be between -180 and 180');
  return num;
}

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'place';
  return `${base}-${randomUUID().slice(0, 8)}`;
}

function parseJson(value: unknown, fallback: any): any {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch { return fallback; }
}

function rowToPlace(row: any): any {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    state: row.state ? String(row.state) : null,
    lga: row.lga ? String(row.lga) : null,
    centerLat: Number(row.center_lat),
    centerLng: Number(row.center_lng),
    bbox: parseJson(row.bbox_json, {}),
    status: String(row.status),
    reality: parseJson(row.reality_json, {}),
    confidence: parseJson(row.confidence_json, {}),
    needs: parseJson(row.needs_json, []),
    topicId: row.topic_id ? String(row.topic_id) : null,
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function rowToConcept(row: any, votes?: { support: number; oppose: number; byRole: Record<string, number> }): any {
  return {
    id: String(row.id),
    placeId: String(row.place_id),
    creatorPhone: undefined, // never expose raw creator phone publicly; see owner view
    title: String(row.title),
    description: String(row.description),
    scenario: String(row.scenario),
    parentConceptId: row.parent_concept_id ? String(row.parent_concept_id) : null,
    version: Number(row.version),
    assets: parseJson(row.assets_json, []),
    feasibility: parseJson(row.feasibility_json, {}),
    evidence: parseJson(row.evidence_json, []),
    sponsored: Number(row.sponsored) === 1,
    sponsorLabel: row.sponsor_label ? String(row.sponsor_label) : null,
    status: String(row.status),
    economicRequestId: row.economic_request_id ? String(row.economic_request_id) : null,
    rewarded: Number(row.rewarded || 0) === 1,
    votes: votes || { support: 0, oppose: 0, byRole: {} },
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/** Owner view keeps creator phone for the creator/admin only. */
function rowToConceptOwner(row: any): any {
  return { ...rowToConcept(row), creatorPhone: String(row.creator_phone) };
}

async function voteSummary(conceptId: string): Promise<{ support: number; oppose: number; byRole: Record<string, number> }> {
  const db = await getDb();
  const stmt = db.prepare('SELECT value, role FROM place_votes WHERE concept_id=?');
  stmt.bind([conceptId]);
  let support = 0;
  let oppose = 0;
  const byRole: Record<string, number> = {};
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    if (Number(row.value) === 1) support += 1; else oppose += 1;
    const role = String(row.role || 'interested');
    byRole[role] = (byRole[role] || 0) + 1;
  }
  stmt.free();
  return { support, oppose, byRole };
}

// --- Phase 0: Places ---

export async function createPlace(creatorPhone: string, input: PlaceInput): Promise<any> {
  await ensurePlaceSchema();
  const name = cleanText(input.name, 'name', 3, 120);
  const centerLat = cleanCoord(input.centerLat, 'centerLat');
  const centerLng = cleanCoord(input.centerLng, 'centerLng');
  const state = input.state == null || input.state === '' ? null : cleanText(input.state, 'state', 2, 60);
  const lga = input.lga == null || input.lga === '' ? null : cleanText(input.lga, 'lga', 2, 80);
  const id = randomUUID();
  const slug = slugify(name);
  const db = await getDb();
  const stmt = db.prepare(
    'INSERT INTO places(id, slug, name, state, lga, center_lat, center_lng, bbox_json, reality_json, confidence_json, topic_id, created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)'
  );
  stmt.bind([
    id, slug, name, state, lga, centerLat, centerLng,
    JSON.stringify(parseJson(input.bbox, {})),
    JSON.stringify(parseJson(input.reality, {})),
    JSON.stringify(defaultConfidence(parseJson(input.reality, {}))),
    input.topicId != null && input.topicId !== '' ? String(input.topicId) : null,
    creatorPhone,
  ]);
  stmt.step();
  stmt.free();
  saveDb();
  return getPlaceById(id);
}

/** Anything not explicitly sourced is labelled missing — the anti-fabrication rule. */
function defaultConfidence(reality: any): Record<string, Confidence> {
  const out: Record<string, Confidence> = {};
  if (reality && typeof reality === 'object') {
    for (const key of Object.keys(reality)) {
      const entry = (reality as any)[key];
      const labelled = entry && typeof entry === 'object' && typeof entry.confidence === 'string'
        ? entry.confidence as Confidence
        : 'community-reported';
      out[key] = ['verified', 'estimated', 'community-reported', 'missing'].includes(labelled) ? labelled : 'community-reported';
    }
  }
  return out;
}

export async function getPlaceById(id: string): Promise<any | null> {
  await ensurePlaceSchema();
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM places WHERE id=? LIMIT 1');
  stmt.bind([String(id)]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row ? rowToPlace(row) : null;
}

export async function getPlaceBySlug(slug: string): Promise<any | null> {
  await ensurePlaceSchema();
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM places WHERE slug=? LIMIT 1');
  stmt.bind([String(slug)]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row ? rowToPlace(row) : null;
}

export async function listPlaces(filter: { state?: string; lga?: string; status?: string; limit?: number } = {}): Promise<any[]> {
  await ensurePlaceSchema();
  const db = await getDb();
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.state) { clauses.push('state=?'); params.push(String(filter.state)); }
  if (filter.lga) { clauses.push('lga=?'); params.push(String(filter.lga)); }
  if (filter.status) {
    if (!PLACE_STATUSES.includes(filter.status as PlaceStatus)) throw new Error('Unknown place status');
    clauses.push('status=?'); params.push(String(filter.status));
  }
  const limit = Math.min(Math.max(Number(filter.limit) || 20, 1), 100);
  // NOTE: sql.js exec() returns [] for zero-row results, so columns must come
  // from the data query itself — never from a separate LIMIT 0 probe.
  const result = db.exec(
    `SELECT * FROM places ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY updated_at DESC LIMIT ${limit}`,
    params
  )[0];
  const cols = result?.columns || [];
  return (result?.values || []).map((values: unknown[]) => {
    const row: any = {};
    cols.forEach((col: string, i: number) => { row[col] = (values as unknown[])[i]; });
    return rowToPlace(row);
  });
}

export async function transitionPlaceStatus(slug: string, status: PlaceStatus, requesterPhone: string): Promise<any> {
  await ensurePlaceSchema();
  if (!PLACE_STATUSES.includes(status)) throw new Error('Unknown place status');
  const place = await getPlaceBySlug(slug);
  if (!place) throw new Error('Place not found');
  const order = PLACE_STATUSES.indexOf(place.status as PlaceStatus);
  const next = PLACE_STATUSES.indexOf(status);
  if (next < order) throw new Error(`Invalid place transition: ${place.status} -> ${status}`);
  if (place.createdBy && place.createdBy !== requesterPhone && !String(requesterPhone).startsWith('admin:')) {
    throw new Error('Only the place creator can advance its status');
  }
  const db = await getDb();
  db.run('UPDATE places SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [status, place.id]);
  saveDb();
  const updated = await getPlaceById(place.id);
  try {
    await notifyRelationshipTargetUpdate('place', place.id, {
      title: `Update in ${place.name}`,
      body: `This place moved to ${status}. Community support is not a planning approval.`,
      link: `/places/${encodeURIComponent(place.slug)}`,
      signature: `place:${place.id}:${status}:${String(updated?.updatedAt)}`,
    });
  } catch { /* notifications never break a status transition */ }
  return updated;
}

// --- Phase 1: Concepts (GitHub-for-places: fork/evolve, never delete losers) ---

export async function createConcept(creatorPhone: string, placeSlug: string, input: ConceptInput): Promise<any> {
  await ensurePlaceSchema();
  const place = await getPlaceBySlug(placeSlug);
  if (!place) throw new Error('Place not found');
  const title = cleanText(input.title, 'title', 8, 140);
  const description = cleanText(input.description, 'description', 30, 6000);
  const scenario = String(input.scenario || 'custom').toLowerCase();
  if (!CONCEPT_SCENARIOS.includes(scenario as ConceptScenario)) throw new Error('Unknown concept scenario');
  const sponsored = input.sponsored === true || input.sponsored === 1 || input.sponsored === 'true';
  const sponsorLabel = sponsored
    ? cleanText(input.sponsorLabel, 'sponsorLabel', 2, 120)
    : null;
  const id = randomUUID();
  const db = await getDb();
  const stmt = db.prepare(
    `INSERT INTO place_concepts(id, place_id, creator_phone, title, description, scenario, assets_json, feasibility_json, sponsored, sponsor_label, status)
     VALUES(?,?,?,?,?,?,?,?,?,?, 'published')`
  );
  stmt.bind([
    id, place.id, creatorPhone, title, description, scenario,
    JSON.stringify(Array.isArray(input.assets) ? input.assets.slice(0, 12) : []),
    JSON.stringify(parseJson(input.feasibility, {})),
    sponsored ? 1 : 0, sponsorLabel,
  ]);
  stmt.step();
  stmt.free();
  saveDb();
  // First concept moves a fresh place into visioning.
  if (place.status === 'observed') {
    try { await transitionPlaceStatus(placeSlug, 'visioning', creatorPhone); } catch { /* creator mismatch: leave status */ }
  }
  try {
    await notifyRelationshipTargetUpdate('place', place.id, {
      title: `New vision for ${place.name}`,
      body: `A new community concept was published: ${title}. Scenarios are possibilities, not plans.`,
      link: `/places/${encodeURIComponent(place.slug)}`,
      signature: `place-concept:${place.id}:${id}`,
    });
  } catch { /* notifications never break publishing */ }
  return getConcept(id, creatorPhone);
}

export async function forkConcept(creatorPhone: string, conceptId: string, input: ConceptInput): Promise<any> {
  await ensurePlaceSchema();
  const parent = await requireUsableConcept(conceptId);
  const place = await getPlaceById(parent.placeId);
  if (!place) throw new Error('Place not found');
  const title = cleanText(input.title ?? parent.title, 'title', 8, 140);
  const description = cleanText(input.description ?? parent.description, 'description', 30, 6000);
  const id = randomUUID();
  const db = await getDb();
  const stmt = db.prepare(
    `INSERT INTO place_concepts(id, place_id, creator_phone, title, description, scenario, parent_concept_id, version, assets_json, feasibility_json, status)
     VALUES(?,?,?,?,?,?,?,?,?,?, 'published')`
  );
  stmt.bind([
    id, place.id, creatorPhone, title, description,
    String(input.scenario || parent.scenario).toLowerCase(),
    conceptId, Number(parent.version) + 1,
    JSON.stringify(Array.isArray(input.assets) ? input.assets.slice(0, 12) : parent.assets),
    JSON.stringify(parseJson(input.feasibility, parent.feasibility)),
  ]);
  stmt.step();
  stmt.free();
  saveDb();
  return getConcept(id, creatorPhone);
}

export async function getConcept(id: string, viewerPhone?: string): Promise<any | null> {
  await ensurePlaceSchema();
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM place_concepts WHERE id=? LIMIT 1');
  stmt.bind([String(id)]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  if (!row) return null;
  const isOwner = Boolean(viewerPhone && (viewerPhone === String((row as any).creator_phone) || String(viewerPhone).startsWith('admin:')));
  if (String((row as any).status) === 'removed' && !isOwner) return null;
  const summary = await voteSummary(String(id));
  const base = rowToConcept(row, summary);
  if (isOwner) {
    return { ...base, creatorPhone: String((row as any).creator_phone) };
  }
  return base;
}

export async function listConceptsForPlace(placeId: string, viewerPhone?: string): Promise<any[]> {
  await ensurePlaceSchema();
  const db = await getDb();
  const stmt = db.prepare(`SELECT * FROM place_concepts WHERE place_id=? AND status!='removed' ORDER BY created_at ASC`);
  stmt.bind([String(placeId)]);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  const out: any[] = [];
  for (const row of rows) {
    const summary = await voteSummary(String((row as any).id));
    const base = rowToConcept(row, summary);
    out.push(viewerPhone && (viewerPhone === String((row as any).creator_phone) || String(viewerPhone).startsWith('admin:'))
      ? { ...base, creatorPhone: String((row as any).creator_phone) }
      : base);
  }
  return out.sort((a, b) => (b.votes.support - b.votes.oppose) - (a.votes.support - a.votes.oppose));
}

function assertConceptUsable(concept: any): void {
  if (!concept) throw new Error('Concept not found');
  if (String(concept.status) === 'removed') throw new Error('This concept was removed by moderation');
}

/** Mutation paths resolve removed concepts explicitly so the error stays truthful. */
async function requireUsableConcept(conceptId: string, viewerPhone?: string): Promise<any> {
  await ensurePlaceSchema();
  const db = await getDb();
  const rows = db.exec('SELECT status FROM place_concepts WHERE id=? LIMIT 1', [String(conceptId)])[0]?.values || [];
  if (!rows.length) throw new Error('Concept not found');
  if (String(rows[0][0]) === 'removed') throw new Error('This concept was removed by moderation');
  const concept = await getConcept(conceptId, viewerPhone);
  assertConceptUsable(concept);
  return concept;
}

export async function voteConcept(voterPhone: string, conceptId: string, value: unknown, role: unknown): Promise<any> {
  await ensurePlaceSchema();
  const vote = Number(value) === -1 ? -1 : 1;
  const voterRole = String(role || 'interested').toLowerCase();
  if (!VOTER_ROLES.includes(voterRole as VoterRole)) throw new Error('Unknown voter role');
  const concept = await requireUsableConcept(conceptId);
  const db = await getDb();
  db.run(
    `INSERT INTO place_votes(concept_id, voter_phone, value, role) VALUES(?,?,?,?)
     ON CONFLICT(concept_id, voter_phone) DO UPDATE SET value=excluded.value, role=excluded.role, created_at=CURRENT_TIMESTAMP`,
    [conceptId, voterPhone, vote, voterRole]
  );
  saveDb();
  await maybeRewardCreator(conceptId);
  return getConcept(conceptId, voterPhone);
}

/**
 * Creator milestone: a concept that earns sustained community support awards
 * its creator once, through the existing points rails. Rewards never break
 * voting; failures are silent by design.
 */
export const CREATOR_SUPPORT_REWARD_THRESHOLD = 10;
export const CREATOR_SUPPORT_REWARD_POINTS = 5;

async function maybeRewardCreator(conceptId: string): Promise<void> {
  try {
    const db = await getDb();
    const rows = db.exec('SELECT creator_phone, rewarded FROM place_concepts WHERE id=? LIMIT 1', [String(conceptId)])[0]?.values || [];
    if (!rows.length || Number(rows[0][1]) === 1) return;
    const summary = await voteSummary(conceptId);
    if (summary.support < CREATOR_SUPPORT_REWARD_THRESHOLD) return;
    const { addPoints } = await import('./pointsEngine.js');
    await addPoints(String(rows[0][0]), CREATOR_SUPPORT_REWARD_POINTS, `Kurukoo Places creator milestone: ${CREATOR_SUPPORT_REWARD_THRESHOLD} community supporters`);
    db.run('UPDATE place_concepts SET rewarded=1, updated_at=CURRENT_TIMESTAMP WHERE id=? AND rewarded=0', [String(conceptId)]);
    saveDb();
  } catch { /* rewards never break voting */ }
}

export const PLACE_DISCLAIMERS = {
  scenarios: 'Scenarios are possibilities, not plans. A visualisation shows what a place could become, not what will be built.',
  votes: 'A vote records community support. It is not a planning approval, a land claim, or a funding commitment.',
  land: 'No land ownership or availability is claimed. Where official land data (e.g. AGIS/ENGIS) is not connected, land fields are labelled missing until surveyed.',
};

/**
 * Land-registry activation seam. Registries are real institutions; connectivity
 * is deployment-specific and starts disconnected. When a registry connects, the
 * same structure carries verified entries — no new authority is created.
 */
export const LAND_REGISTRIES = [
  { name: 'AGIS (Abuja Geographic Information Systems)', coverage: 'FCT Abuja', status: 'not_connected' },
  { name: 'ENGIS (Enugu Geographic Information System)', coverage: 'Enugu State', status: 'not_connected' },
] as const;

export async function getPlaceDetail(slug: string, viewerPhone?: string): Promise<any | null> {
  const place = await getPlaceBySlug(slug);
  if (!place) return null;
  const concepts = await listConceptsForPlace(place.id, viewerPhone);
  return {
    ...place,
    concepts,
    creators: await getPlaceCreators(place.id),
    imagery: await listImageryEpochs(place.id),
    landRegistries: LAND_REGISTRIES.map((r) => ({ ...r })),
    scenarioTemplates: SCENARIO_TEMPLATES,
    disclaimers: PLACE_DISCLAIMERS,
  };
}

/** Historical imagery epochs (satellite/aerial history). Empty until an imagery
 *  backend is connected — the empty list is the honest state, not a gap to fill
 *  with invented history. */
export async function listImageryEpochs(placeId: string): Promise<any[]> {
  await ensurePlaceSchema();
  const db = await getDb();
  const stmt = db.prepare('SELECT epoch_label, captured_at, source, url, note FROM place_imagery_epochs WHERE place_id=? ORDER BY captured_at ASC, epoch_label ASC');
  stmt.bind([String(placeId)]);
  const out: any[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    out.push({ epochLabel: String(row.epoch_label), capturedAt: row.captured_at ? String(row.captured_at) : null, source: String(row.source), url: row.url ? String(row.url) : null, note: row.note ? String(row.note) : null });
  }
  stmt.free();
  return out;
}

/** Records one imagery epoch for a place. Called by imagery ingestion when (and only when) a real source provides it. */
export async function recordImageryEpoch(placeId: string, input: { epochLabel: unknown; capturedAt?: unknown; source: unknown; url?: unknown; note?: unknown }): Promise<any> {
  await ensurePlaceSchema();
  const place = await getPlaceById(placeId);
  if (!place) throw new Error('Place not found');
  const epochLabel = cleanText(input.epochLabel, 'epochLabel', 2, 40);
  const source = cleanText(input.source, 'source', 2, 120);
  const db = await getDb();
  db.run(
    `INSERT INTO place_imagery_epochs(id, place_id, epoch_label, captured_at, source, url, note) VALUES(?,?,?,?,?,?,?)
     ON CONFLICT(place_id, epoch_label) DO UPDATE SET captured_at=excluded.captured_at, source=excluded.source, url=excluded.url, note=excluded.note`,
    [randomUUID(), place.id, epochLabel,
      input.capturedAt != null && input.capturedAt !== '' ? String(input.capturedAt).slice(0, 30) : null,
      source,
      input.url != null && input.url !== '' ? String(input.url).slice(0, 500) : null,
      input.note != null && input.note !== '' ? String(input.note).slice(0, 500) : null]
  );
  saveDb();
  return listImageryEpochs(place.id);
}

/**
 * District pulse: aggregates existing Places into LGA/state intelligence.
 * Purely computed from labelled data — never invents places, people or demand.
 */
export async function getDistrictPulse(state: unknown, lga?: unknown): Promise<any> {
  await ensurePlaceSchema();
  const cleanState = cleanText(state, 'state', 2, 60);
  const places = await listPlaces({ state: cleanState, lga: lga != null && lga !== '' ? cleanText(lga, 'lga', 2, 80) : undefined, limit: 100 });
  const byStatus: Record<string, number> = {};
  let concepts = 0;
  let support = 0;
  let oppose = 0;
  const gapVotes: Record<string, number> = {};
  const leading: any[] = [];
  for (const place of places) {
    byStatus[place.status] = (byStatus[place.status] || 0) + 1;
    const list = await listConceptsForPlace(place.id);
    concepts += list.length;
    for (const concept of list) {
      support += concept.votes.support;
      oppose += concept.votes.oppose;
      if (leading.length < 5) leading.push({ placeSlug: place.slug, placeName: place.name, conceptId: concept.id, title: concept.title, support: concept.votes.support });
    }
    const needs = Array.isArray(place.needs) ? place.needs : [];
    for (const need of needs) {
      if (need && (need.gap === 'critical' || need.gap === 'high')) gapVotes[need.category] = (gapVotes[need.category] || 0) + 1;
    }
  }
  leading.sort((a, b) => b.support - a.support);
  return {
    state: cleanState,
    lga: lga != null && lga !== '' ? String(lga) : null,
    places: places.length,
    byStatus,
    concepts,
    support,
    oppose,
    topGaps: Object.entries(gapVotes).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([category, placeCount]) => ({ category, placeCount })),
    leadingConcepts: leading.slice(0, 5),
    disclaimer: 'Aggregated from labelled place data only. Gaps counted here come from verified or community-reported counts; places without data contribute nothing.',
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Privacy-respecting creator leaderboard. Real names appear only for profiles
 * that opted into public visibility; everyone else is an ordered community
 * creator. Phones are never exposed.
 */
export async function getPlaceCreators(placeId: string): Promise<any[]> {
  await ensurePlaceSchema();
  const db = await getDb();
  const stmt = db.prepare(`SELECT creator_phone, COUNT(*) AS concepts FROM place_concepts WHERE place_id=? AND status!='removed' GROUP BY creator_phone`);
  stmt.bind([String(placeId)]);
  const phones: Array<{ phone: string; concepts: number }> = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    phones.push({ phone: String(row.creator_phone), concepts: Number(row.concepts) });
  }
  stmt.free();
  const out: any[] = [];
  for (const entry of phones) {
    let support = 0;
    let oppose = 0;
    let built = 0;
    const ids = db.exec('SELECT id, status FROM place_concepts WHERE place_id=? AND creator_phone=? AND status!=\'removed\'', [String(placeId), entry.phone])[0]?.values || [];
    for (const [id, status] of ids as unknown[][]) {
      const summary = await voteSummary(String(id));
      support += summary.support;
      oppose += summary.oppose;
      if (String(status) === 'built') built += 1;
    }
    let displayName = 'Community creator';
    try {
      const profile = db.exec(`SELECT name, COALESCE(relationship_visibility,'private') AS visibility FROM memory_profiles WHERE phone=? LIMIT 1`, [entry.phone])[0]?.values?.[0];
      if (profile && String(profile[1]) === 'public' && String(profile[0] || '').trim()) displayName = String(profile[0]).trim().slice(0, 60);
    } catch { /* profiles unavailable: keep anonymous */ }
    out.push({ displayName, concepts: entry.concepts, support, oppose, built });
  }
  return out.sort((a, b) => b.support - a.support || b.concepts - a.concepts);
}

// --- Admin moderation (authenticateAdmin routes only) ---

export async function listPlacesAdmin(): Promise<any[]> {
  await ensurePlaceSchema();
  const db = await getDb();
  const places = await listPlaces({ limit: 100 });
  return Promise.all(places.map(async (place: any) => {
    const concepts = db.exec('SELECT COUNT(*), COALESCE(SUM(CASE WHEN status=\'removed\' THEN 1 ELSE 0 END),0) FROM place_concepts WHERE place_id=?', [place.id])[0]?.values?.[0] || [0, 0];
    const votes = db.exec('SELECT COUNT(*) FROM place_votes WHERE concept_id IN (SELECT id FROM place_concepts WHERE place_id=?)', [place.id])[0]?.values?.[0]?.[0] || 0;
    return { ...place, conceptCount: Number(concepts[0]), removedCount: Number(concepts[1]), voteCount: Number(votes) };
  }));
}

export async function listConceptsAdmin(placeId: string): Promise<any[]> {
  await ensurePlaceSchema();
  const db = await getDb();
  const place = await getPlaceById(placeId);
  if (!place) throw new Error('Place not found');
  const stmt = db.prepare('SELECT * FROM place_concepts WHERE place_id=? ORDER BY created_at ASC');
  stmt.bind([place.id]);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  const out: any[] = [];
  for (const row of rows) {
    out.push({ ...rowToConceptOwner(row), votes: await voteSummary(String((row as any).id)) });
  }
  return out;
}

// --- Approval workflow: community support is not approval; an authority decision is recorded explicitly. ---

export const APPROVAL_STATUSES = ['requested', 'under_review', 'approved', 'rejected', 'needs_changes'] as const;

function cleanAuthority(value: unknown): string {
  const authority = cleanText(value, 'authority', 2, 120);
  return authority;
}

export async function requestConceptApproval(requesterPhone: string, conceptId: string, authority: unknown, note?: unknown): Promise<any> {
  await ensurePlaceSchema();
  const concept = await requireUsableConcept(conceptId, requesterPhone);
  const place = await getPlaceById(concept.placeId);
  if (!place) throw new Error('Place not found');
  const id = randomUUID();
  const db = await getDb();
  db.run(
    'INSERT INTO place_approvals(id, place_id, concept_id, requester_phone, authority, note) VALUES(?,?,?,?,?,?)',
    [id, place.id, concept.id, requesterPhone, cleanAuthority(authority), note != null && note !== '' ? String(note).slice(0, 1000) : null]
  );
  saveDb();
  try {
    await notifyRelationshipTargetUpdate('place', place.id, {
      title: `Approval requested in ${place.name}`,
      body: `"${concept.title}" was submitted to ${cleanAuthority(authority)} for review. Community support is not an approval.`,
      link: `/places/${encodeURIComponent(place.slug)}`,
      signature: `place-approval:${id}`,
    });
  } catch { /* notifications never break requests */ }
  return getApproval(id);
}

export async function getApproval(id: string): Promise<any | null> {
  await ensurePlaceSchema();
  const db = await getDb();
  const rows = db.exec('SELECT * FROM place_approvals WHERE id=? LIMIT 1', [String(id)])[0];
  if (!rows || !rows.values.length) return null;
  const cols = rows.columns || [];
  const row: any = {};
  cols.forEach((col: string, i: number) => { row[col] = (rows.values[0] as unknown[])[i]; });
  return {
    id: String(row.id), placeId: String(row.place_id), conceptId: String(row.concept_id),
    authority: String(row.authority), status: String(row.status),
    note: row.note ? String(row.note) : null, reviewer: row.reviewer ? String(row.reviewer) : null,
    decidedAt: row.decided_at ? String(row.decided_at) : null, createdAt: String(row.created_at),
  };
}

export async function listApprovalsForPlace(placeId: string): Promise<any[]> {
  await ensurePlaceSchema();
  const db = await getDb();
  const stmt = db.prepare('SELECT id FROM place_approvals WHERE place_id=? ORDER BY created_at DESC LIMIT 50');
  stmt.bind([String(placeId)]);
  const ids: string[] = [];
  while (stmt.step()) ids.push(String((stmt.getAsObject() as any).id));
  stmt.free();
  const out: any[] = [];
  for (const id of ids) {
    const approval = await getApproval(id);
    if (approval) out.push(approval);
  }
  return out;
}

export async function reviewConceptApproval(reviewerPhone: string, approvalId: string, status: unknown, note?: unknown): Promise<any> {
  await ensurePlaceSchema();
  const value = String(status || '').toLowerCase();
  if (!(APPROVAL_STATUSES as readonly string[]).includes(value) || value === 'requested') throw new Error('Review must resolve to under_review, approved, rejected or needs_changes');
  const approval = await getApproval(approvalId);
  if (!approval) throw new Error('Approval request not found');
  if (approval.status === 'approved' || approval.status === 'rejected') throw new Error(`This request is already ${approval.status}`);
  const db = await getDb();
  db.run('UPDATE place_approvals SET status=?, note=COALESCE(?,note), reviewer=?, decided_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?', [
    value, note != null && note !== '' ? String(note).slice(0, 1000) : null, reviewerPhone, approvalId,
  ]);
  saveDb();
  if (value === 'approved') {
    try {
      const conceptDb = await getDb();
      conceptDb.run("UPDATE place_concepts SET status='approved', updated_at=CURRENT_TIMESTAMP WHERE id=? AND status!='removed'", [approval.conceptId]);
      saveDb();
    } catch { /* approval record stands even if the status move fails */ }
  }
  const place = await getPlaceById(approval.placeId);
  if (place) {
    try {
      await notifyRelationshipTargetUpdate('place', place.id, {
        title: `Decision in ${place.name}`,
        body: `The ${approval.authority} review ended: ${value.replace(/_/g, ' ')}.`,
        link: `/places/${encodeURIComponent(place.slug)}`,
        signature: `place-approval-decision:${approvalId}:${value}`,
      });
    } catch { /* notifications never break reviews */ }
  }
  return getApproval(approvalId);
}

export async function setConceptStatusAdmin(conceptId: string, status: unknown): Promise<any> {
  await ensurePlaceSchema();
  const value = String(status || '').toLowerCase();
  if (!(ADMIN_CONCEPT_STATUSES as readonly string[]).includes(value)) throw new Error('Unknown concept status');
  const db = await getDb();
  const exists = db.exec('SELECT id FROM place_concepts WHERE id=? LIMIT 1', [String(conceptId)])[0]?.values?.length;
  if (!exists) throw new Error('Concept not found');
  db.run('UPDATE place_concepts SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [value, String(conceptId)]);
  saveDb();
  return getConcept(conceptId, 'admin:console');
}

// --- Phase 2: Needs engine (rules first, evidence-bound) ---

const NEED_CATEGORIES = [
  'schools', 'healthcare', 'roads', 'drainage', 'green_space',
  'retail', 'public_transport', 'waste', 'water', 'connectivity',
] as const;

export interface PlaceNeed {
  category: string;
  current: string;
  gap: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
  confidence: Confidence;
  evidence: string;
}

/** Derives gaps from labelled reality + community signal. Unknown stays unknown. */
export async function computeNeeds(placeSlug: string): Promise<PlaceNeed[]> {
  const place = await getPlaceBySlug(placeSlug);
  if (!place) throw new Error('Place not found');
  const reality = place.reality || {};
  const confidence = place.confidence || {};
  const concepts = await listConceptsForPlace(place.id);
  const totalSupport = concepts.reduce((sum: number, c: any) => sum + c.votes.support, 0);
  const needs: PlaceNeed[] = NEED_CATEGORIES.map((category) => {
    const entry = reality[category];
    const count = entry && typeof entry === 'object' && Number.isFinite(Number((entry as any).count))
      ? Number((entry as any).count)
      : null;
    const conf = (confidence[category] as Confidence) || 'missing';
    if (count == null) {
      return {
        category,
        current: 'unknown',
        gap: 'unknown' as const,
        confidence: 'missing' as Confidence,
        evidence: totalSupport > 0
          ? `${totalSupport} community vote(s) recorded for this place; on-the-ground survey still required.`
          : 'No verified count and no community signal yet — survey required before any gap claim.',
      };
    }
    const gap = count === 0 ? 'critical' : count <= 1 ? 'high' : count <= 3 ? 'medium' : 'low';
    return {
      category,
      current: String(count),
      gap: gap as PlaceNeed['gap'],
      confidence: conf,
      evidence: conf === 'verified'
        ? `Verified count of ${count} from an attributed source.`
        : `Count of ${count} reported with ${conf} confidence — treat as indicative, not authoritative.`,
    };
  });
  const db = await getDb();
  db.run('UPDATE places SET needs_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [JSON.stringify(needs), place.id]);
  saveDb();
  return needs;
}

/** Top interventions derived only from labelled gaps — never from thin air. */
export function topInterventions(needs: PlaceNeed[], limit = 5): string[] {
  const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 };
  return needs
    .filter((need) => need.gap !== 'low' && need.gap !== 'unknown')
    .sort((a, b) => rank[a.gap] - rank[b.gap])
    .slice(0, limit)
    .map((need) => need.category);
}

// --- Phase 2b: Opportunity link (feeds the existing Opportunity Engine feed) ---

export async function publishPlaceOpportunity(requesterPhone: string, conceptId: string): Promise<any> {
  await ensurePlaceSchema();
  const concept = await requireUsableConcept(conceptId, requesterPhone);
  const place = await getPlaceById(concept.placeId);
  if (!place) throw new Error('Place not found');
  const summary = concept.votes;
  const db = await getDb();
  await ensureOpportunityPlaceColumns();
  const title = `Development interest: ${concept.title}`;
  const subtitle = `Recorded community signal in ${place.name}: ${summary.support} support / ${summary.oppose} oppose across ${Object.keys(summary.byRole).length || 0} voter role(s). Feasibility is not yet validated.`;
  const ctaLink = `/chat?prompt=${encodeURIComponent(`Show me the place vision for ${place.name}`)}`;
  const stmt = db.prepare(
    'INSERT INTO proactive_opportunities(phone, type, title, subtitle, cta_text, cta_link, urgency, business_value, status, place_id, concept_id) VALUES(?, \'market_intel\', ?, ?, ?, ?, 0.6, 0.6, \'sent\', ?, ?)'
  );
  stmt.bind([requesterPhone, title, subtitle, 'Open in Chat', ctaLink, place.id, conceptId]);
  stmt.step();
  stmt.free();
  saveDb();
  const id = Number(db.exec('SELECT last_insert_rowid() AS id')[0]?.values?.[0]?.[0]);
  return { id, title, subtitle, ctaLink, placeId: place.id, conceptId };
}

// --- Phase 3: Make-it-real (canonical Economic Request, no second lifecycle) ---

export const MAKE_REAL_SKILLS = ['find_worker', 'architect', 'urban_planner', 'civil_engineer', 'quantity_surveyor', 'land_surveyor'] as const;

export async function makeConceptReal(requesterPhone: string, conceptId: string, detail?: unknown, skill?: unknown): Promise<any> {
  await ensurePlaceSchema();
  const concept = await requireUsableConcept(conceptId, requesterPhone);
  const place = await getPlaceById(concept.placeId);
  if (!place) throw new Error('Place not found');
  if (concept.economicRequestId) throw new Error('This concept already has a linked Economic Request');
  const requestedSkill = String(skill || 'find_worker').trim().toLowerCase();
  if (!(MAKE_REAL_SKILLS as readonly string[]).includes(requestedSkill)) {
    throw new Error(`Skill must be one of: ${MAKE_REAL_SKILLS.join(', ')}`);
  }
  const extra = detail == null || detail === '' ? '' : ` Proposer note: ${String(detail).slice(0, 500)}`;
  const request = await createEconomicRequest({
    id: randomUUID(),
    phone: requesterPhone,
    skill: requestedSkill,
    requirements: {
      place_id: place.id,
      place_slug: place.slug,
      place_name: place.name,
      concept_id: conceptId,
      concept_title: concept.title,
      concept_scenario: concept.scenario,
      location: [place.lga, place.state].filter(Boolean).join(', ') || place.name,
      description: `Development proposal from Kurukoo Places: "${concept.title}" in ${place.name}.${extra}`,
    },
  });
  const db = await getDb();
  db.run('UPDATE place_concepts SET economic_request_id=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [
    request.id,
    'proposed',
    conceptId,
  ]);
  saveDb();
  return { economicRequest: request, conceptId, placeSlug: place.slug };
}

// --- Phase 3b: Developer / institutional intelligence (paid surface reads this) ---

export async function getDeveloperReport(placeSlug: string): Promise<any> {
  const place = await getPlaceBySlug(placeSlug);
  if (!place) throw new Error('Place not found');
  const concepts = await listConceptsForPlace(place.id);
  const needs = await computeNeeds(placeSlug);
  const votesByRole: Record<string, number> = {};
  let support = 0;
  let oppose = 0;
  for (const concept of concepts) {
    support += concept.votes.support;
    oppose += concept.votes.oppose;
    for (const [role, count] of Object.entries<number>(concept.votes.byRole)) {
      votesByRole[role] = (votesByRole[role] || 0) + count;
    }
  }
  return {
    place: { slug: place.slug, name: place.name, state: place.state, lga: place.lga, status: place.status },
    confidence: place.confidence,
    concepts: concepts.length,
    support,
    oppose,
    votesByRole,
    needs,
    topInterventions: topInterventions(needs),
    leadingConcepts: concepts.slice(0, 3).map((c: any) => ({
      id: c.id, title: c.title, scenario: c.scenario, version: c.version,
      support: c.votes.support, oppose: c.votes.oppose, sponsored: c.sponsored,
      sponsorLabel: c.sponsorLabel, economicRequestId: c.economicRequestId,
    })),
    disclaimer: 'Community signal is indicative, not a planning approval. Counts without a verified source are labelled missing and excluded from gap claims.',
  };
}

// --- Radar layers for Nearby ("what's happening around me") ---

function fuzzCoord(value: number): number {
  // ~100m public precision; exact coordinates stay request-scoped.
  return Math.round(Number(value) * 1000) / 1000;
}

export async function getRadarLayers(lat: number, lng: number, radiusMetres = 10000): Promise<any> {
  await ensurePlaceSchema();
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('lat/lng must be numbers');
  const radius = Math.min(Math.max(Number(radiusMetres) || 10000, 100), 50000);
  const toRad = (v: number) => (v * Math.PI) / 180;
  // Rough bbox prefilter (1 deg lat ~= 111km).
  const delta = radius / 111000;
  const db = await getDb();
  const stmt = db.prepare(
    'SELECT * FROM places WHERE center_lat BETWEEN ? AND ? AND center_lng BETWEEN ? AND ? LIMIT 200'
  );
  stmt.bind([lat - delta, lat + delta, lng - delta, lng + delta]);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  const layers: Record<string, any[]> = {
    existing: [], proposed: [], voting: [], seeking_dev: [], building: [], built: [],
  };
  const dist = (a: number, b: number, c: number, d: number) => {
    const s = Math.sin(toRad(c - a) / 2) ** 2 + Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(toRad(d - b) / 2) ** 2;
    return 2 * 6371000 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  };
  for (const row of rows) {
    const place = rowToPlace(row);
    const metres = dist(lat, lng, place.centerLat, place.centerLng);
    if (metres > radius) continue;
    const concepts = await listConceptsForPlace(place.id);
    const votes = concepts.reduce((sum: number, c: any) => sum + c.votes.support + c.votes.oppose, 0);
    const item = {
      id: place.id, slug: place.slug, name: place.name, status: place.status,
      lat: fuzzCoord(place.centerLat), lng: fuzzCoord(place.centerLng),
      distanceMetres: Math.round(metres), concepts: concepts.length, votes,
    };
    if (place.status === 'built') layers.built.push(item);
    else if (place.status === 'building' || place.status === 'approved') layers.building.push(item);
    else if (concepts.some((c: any) => c.economicRequestId)) layers.seeking_dev.push(item);
    else if (votes > 0) layers.voting.push(item);
    else if (concepts.length > 0) layers.proposed.push(item);
    else layers.existing.push(item);
  }
  return {
    layers,
    generatedAt: new Date().toISOString(),
    precisionMetres: 100,
    precisionPolicy: 'Public radar coordinates are rounded to ~100m. Exact place geometry stays request-scoped and is never used to claim land boundaries.',
  };
}

export { rowToConceptOwner };
