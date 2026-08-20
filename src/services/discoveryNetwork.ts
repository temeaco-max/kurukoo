import { getDb, saveDb } from '../database.js';
import { getActivePulseProviders } from './nearbyPulse.js';

export type DiscoveryLifecycle = 'discovered' | 'candidate' | 'opportunity' | 'invited' | 'claimed' | 'onboarded' | 'verified' | 'available' | 'executing' | 'completed';
export type DiscoveryEntityType = 'place' | 'business' | 'service' | 'event' | 'provider' | 'agent' | 'community_context';
export type DiscoverySourceType = 'verified_provider' | 'business_listing' | 'authoritative_directory' | 'licensed_external' | 'opportunity_signal';
export type DiscoveryReadiness = 'ready' | 'sparse' | 'no_verified_local_data';

export interface DiscoveryEntity {
  id: string;
  entityType: DiscoveryEntityType;
  lifecycle: DiscoveryLifecycle;
  name: string;
  detail: string;
  category?: string;
  source: string;
  sourceType?: DiscoverySourceType;
  sourceRef?: string;
  sourceUrl?: string;
  latitude: number;
  longitude: number;
  distanceMetres?: number;
  freshnessAt: string;
  expiresAt?: string;
  evidenceLevel: 'source_attributed' | 'persisted_state' | 'verified_state';
  claimed: boolean;
  verified: boolean;
  available: boolean;
}

export interface DiscoveryQuery {
  latitude: number;
  longitude: number;
  radiusMetres?: number;
  category?: string;
  layers?: string[];
  limit?: number;
  offset?: number;
  cluster?: boolean;
  now?: number;
}

export interface DiscoveryDataProvider {
  name: string;
  query(query: DiscoveryQuery): Promise<DiscoveryEntity[]>;
}

const EARTH_RADIUS_METRES = 6_371_000;
const lifecycleOrder: DiscoveryLifecycle[] = ['discovered', 'candidate', 'opportunity', 'invited', 'claimed', 'onboarded', 'verified', 'available', 'executing', 'completed'];
const transitions: Record<DiscoveryLifecycle, DiscoveryLifecycle[]> = {
  discovered: ['candidate', 'opportunity'],
  candidate: ['opportunity', 'invited', 'claimed'],
  opportunity: ['invited', 'claimed'],
  invited: ['claimed', 'candidate'],
  claimed: ['onboarded'],
  onboarded: ['verified'],
  verified: ['available'],
  available: ['executing'],
  executing: ['completed', 'available'],
  completed: [],
};

function distanceMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeLifecycle(value: unknown): DiscoveryLifecycle {
  return lifecycleOrder.includes(String(value) as DiscoveryLifecycle) ? String(value) as DiscoveryLifecycle : 'discovered';
}
function normalizeSourceType(value: unknown, source: unknown): DiscoverySourceType {
  const candidate = String(value || '');
  if (['verified_provider', 'business_listing', 'authoritative_directory', 'licensed_external', 'opportunity_signal'].includes(candidate)) return candidate as DiscoverySourceType;
  const normalizedSource = String(source || '').toLowerCase();
  if (normalizedSource.startsWith('kurukoo_presence:')) return 'verified_provider';
  if (normalizedSource.includes('directory')) return 'authoritative_directory';
  if (normalizedSource.includes('listing')) return 'business_listing';
  return 'opportunity_signal';
}

function safeEntity(row: any, query: DiscoveryQuery): DiscoveryEntity {
  const lifecycle = normalizeLifecycle(row.lifecycle);
  return {
    id: String(row.id),
    entityType: String(row.entity_type || 'place') as DiscoveryEntityType,
    lifecycle,
    name: String(row.name || 'Useful nearby activity'),
    detail: String(row.detail || row.category || 'Discovery item'),
    category: row.category ? String(row.category) : undefined,
    source: String(row.source || 'unknown'),
    sourceType: normalizeSourceType(row.source_type, row.source),
    sourceRef: row.source_ref ? String(row.source_ref) : undefined,
    sourceUrl: row.source_url ? String(row.source_url) : undefined,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    distanceMetres: distanceMetres(query.latitude, query.longitude, Number(row.latitude), Number(row.longitude)),
    freshnessAt: String(row.freshness_at || row.updated_at || new Date(0).toISOString()),
    expiresAt: row.expires_at ? String(row.expires_at) : undefined,
    evidenceLevel: row.evidence_level === 'verified_state' ? 'verified_state' : row.evidence_level === 'persisted_state' ? 'persisted_state' : 'source_attributed',
    claimed: Number(row.claimed) === 1,
    verified: Number(row.verified) === 1,
    available: Number(row.available) === 1,
  };
}

export async function ensureDiscoveryNetworkSchema(): Promise<void> {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS discovery_entities (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    lifecycle TEXT NOT NULL DEFAULT 'discovered',
    name TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'opportunity_signal',
    source_ref TEXT NOT NULL DEFAULT '',
    source_url TEXT NOT NULL DEFAULT '',
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    freshness_at TEXT NOT NULL,
    expires_at TEXT,
    evidence_level TEXT NOT NULL DEFAULT 'source_attributed',
    claimed INTEGER NOT NULL DEFAULT 0,
    verified INTEGER NOT NULL DEFAULT 0,
    available INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const discoveryColumns = db.exec(`PRAGMA table_info(discovery_entities)`)[0]?.values?.map((row: any[]) => String(row[1])) || [];
  if (!discoveryColumns.includes('source_type')) { try { db.run(`ALTER TABLE discovery_entities ADD COLUMN source_type TEXT NOT NULL DEFAULT 'opportunity_signal'`); } catch {} }
  db.run(`CREATE INDEX IF NOT EXISTS idx_discovery_entities_geo ON discovery_entities(latitude, longitude, lifecycle, freshness_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_discovery_entities_source ON discovery_entities(source, source_ref)`);
  db.run(`CREATE TABLE IF NOT EXISTS discovery_invitations (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    inviter_phone TEXT NOT NULL,
    contributor_phone TEXT,
    status TEXT NOT NULL DEFAULT 'invited',
    evidence_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_discovery_invitations_entity ON discovery_invitations(entity_id, inviter_phone, status)`);
  saveDb();
}

export async function upsertDiscoveryEntity(input: Omit<DiscoveryEntity, 'distanceMetres'>): Promise<DiscoveryEntity> {
  await ensureDiscoveryNetworkSchema();
  const db = await getDb();
  const existing = db.exec('SELECT lifecycle, claimed, verified, available FROM discovery_entities WHERE id = ?', [input.id]);
  const previous = existing[0]?.values?.[0];
  const previousLifecycle = normalizeLifecycle(previous?.[0]);
  const lifecycle = previous && lifecycleOrder.indexOf(input.lifecycle) < lifecycleOrder.indexOf(previousLifecycle) ? previousLifecycle : input.lifecycle;
  const claimed = previous ? Math.max(Number(previous[1]) || 0, input.claimed ? 1 : 0) : input.claimed ? 1 : 0;
  const verified = previous ? Math.max(Number(previous[2]) || 0, input.verified ? 1 : 0) : input.verified ? 1 : 0;
  const available = previous ? Math.max(Number(previous[3]) || 0, input.available ? 1 : 0) : input.available ? 1 : 0;
  db.run(`INSERT INTO discovery_entities (id, entity_type, lifecycle, name, detail, category, source, source_type, source_ref, source_url, latitude, longitude, freshness_at, expires_at, evidence_level, claimed, verified, available, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET entity_type=excluded.entity_type, lifecycle=excluded.lifecycle, name=excluded.name, detail=excluded.detail, category=excluded.category, source=excluded.source, source_type=excluded.source_type, source_ref=excluded.source_ref, source_url=excluded.source_url, latitude=excluded.latitude, longitude=excluded.longitude, freshness_at=excluded.freshness_at, expires_at=excluded.expires_at, evidence_level=excluded.evidence_level, claimed=excluded.claimed, verified=excluded.verified, available=excluded.available, updated_at=CURRENT_TIMESTAMP`, [input.id, input.entityType, lifecycle, input.name, input.detail, input.category || '', input.source, normalizeSourceType(input.sourceType, input.source), input.sourceRef || '', input.sourceUrl || '', input.latitude, input.longitude, input.freshnessAt, input.expiresAt || null, input.evidenceLevel, claimed, verified, available]);
  saveDb();
  const row = db.exec('SELECT * FROM discovery_entities WHERE id = ?', [input.id])[0]?.values?.[0];
  const columns = db.exec('PRAGMA table_info(discovery_entities)')[0]?.values?.map((value: any[]) => String(value[1])) || [];
  return safeEntity(Object.fromEntries(columns.map((column: string, index: number) => [column, row?.[index]])), { latitude: input.latitude, longitude: input.longitude });
}

export async function syncPulseDiscoveryEntities(): Promise<number> {
  await ensureDiscoveryNetworkSchema();
  const db = await getDb();
  db.run("UPDATE discovery_entities SET expires_at = CURRENT_TIMESTAMP, available = 0, updated_at = CURRENT_TIMESTAMP WHERE source LIKE 'kurukoo_presence:%'");
  const providers = await getActivePulseProviders();
  let count = 0;
  for (const provider of providers) {
    const latitude = Number(provider.lat);
    const longitude = Number(provider.lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const source = String(provider.source || 'mobile');
    const skill = String(provider.skill || 'general_service');
    await upsertDiscoveryEntity({
      id: `pulse:${source}:${String(provider.phone)}:${skill}`,
      entityType: 'provider',
      lifecycle: 'available',
      name: String(provider.name || 'Verified provider'),
      detail: skill,
      category: skill,
      source: `kurukoo_presence:${source}`,
      sourceType: 'verified_provider',
      sourceRef: `presence:${String(provider.phone)}`,
      latitude,
      longitude,
      freshnessAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 120000).toISOString(),
      evidenceLevel: 'verified_state',
      claimed: true,
      verified: true,
      available: true,
    });
    count += 1;
  }
  return count;
}

export async function getDiscoveryEntity(entityId: string): Promise<DiscoveryEntity | null> {
  await ensureDiscoveryNetworkSchema();
  const db = await getDb();
  const rows = db.exec('SELECT * FROM discovery_entities WHERE id = ?', [String(entityId || '').slice(0, 180)]);
  if (!rows[0]?.values?.length) return null;
  const row = rows[0].values[0];
  const columns = rows[0].columns;
  const record = Object.fromEntries(columns.map((column: string, index: number) => [column, row[index]]));
  return safeEntity(record, { latitude: Number(record.latitude), longitude: Number(record.longitude) });
}

export function getDiscoveryNetworkReadiness(): { provider: string; cacheOwned: boolean; bulkNominatim: boolean; mapIsPresentationLayer: boolean; externalProviderSeam: boolean; supportedSourceTypes: DiscoverySourceType[] } {
  return { provider: 'owned-cache+pulse', cacheOwned: true, bulkNominatim: false, mapIsPresentationLayer: true, externalProviderSeam: true, supportedSourceTypes: ['verified_provider', 'business_listing', 'authoritative_directory', 'licensed_external', 'opportunity_signal'] };
}
function deriveDensityReadiness(entities: DiscoveryEntity[]): { state: DiscoveryReadiness; message: string; verifiedLocalCount: number } {
  const verifiedLocalCount = entities.filter(entity => entity.sourceType === 'verified_provider' && entity.verified && entity.available).length;
  if (verifiedLocalCount === 0) return { state: 'no_verified_local_data', message: 'Not much is live here yet. Ask Kurukoo what you need and we’ll help find it.', verifiedLocalCount };
  if (verifiedLocalCount < 3) return { state: 'sparse', message: 'There are a few verified local options. Kurukoo can help widen the search when needed.', verifiedLocalCount };
  return { state: 'ready', message: 'Verified local discovery data is available for this area.', verifiedLocalCount };
}

export async function queryDiscoveryEntities(query: DiscoveryQuery): Promise<{ entities: DiscoveryEntity[]; hasMore: boolean; generatedAt: string; provider: string; readiness: { state: DiscoveryReadiness; message: string; verifiedLocalCount: number } }> {
  await ensureDiscoveryNetworkSchema();
  await syncPulseDiscoveryEntities();
  const radius = Math.min(Math.max(Number(query.radiusMetres || 5000), 1), 50000);
  const latitudeDelta = radius / 111320;
  const longitudeDelta = radius / Math.max(111320 * Math.cos(query.latitude * Math.PI / 180), 1);
  const limit = Math.min(Math.max(Math.floor(Number(query.limit || 100)), 1), 200);
  const offset = Math.max(Math.floor(Number(query.offset || 0)), 0);
  const db = await getDb();
  const nowIso = new Date(query.now || Date.now()).toISOString();
  const stmt = db.prepare(`SELECT * FROM discovery_entities WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ? AND (expires_at IS NULL OR expires_at > ?) ORDER BY updated_at DESC LIMIT ? OFFSET ?`);
  stmt.bind([query.latitude - latitudeDelta, query.latitude + latitudeDelta, query.longitude - longitudeDelta, query.longitude + longitudeDelta, nowIso, limit + 1, offset]);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  const entities = rows.filter((row) => distanceMetres(query.latitude, query.longitude, Number(row.latitude), Number(row.longitude)) <= radius)
    .filter((row) => !query.category || String(row.category || '').toLowerCase() === String(query.category).toLowerCase())
    .filter((row) => !query.layers?.length || query.layers.includes(String(row.entity_type)) || query.layers.includes(String(String(row.source || '').split(':').pop() || '')))
    .slice(0, limit)
    .map((row) => safeEntity(row, query));
  return { entities, hasMore: rows.length > limit, generatedAt: new Date().toISOString(), provider: 'owned-cache+pulse', readiness: deriveDensityReadiness(entities) };
}

export async function transitionDiscoveryEntity(entityId: string, next: DiscoveryLifecycle, actorPhone: string, reason: string): Promise<DiscoveryEntity> {
  await ensureDiscoveryNetworkSchema();
  const db = await getDb();
  const rows = db.exec('SELECT * FROM discovery_entities WHERE id = ?', [entityId]);
  const row = rows[0]?.values?.[0];
  if (!row) throw new Error('Discovery entity not found');
  const columns = rows[0].columns;
  const current = Object.fromEntries(columns.map((column: string, index: number) => [column, row[index]]));
  const currentLifecycle = normalizeLifecycle(current.lifecycle);
  if (!transitions[currentLifecycle].includes(next)) throw new Error(`Invalid discovery lifecycle transition: ${currentLifecycle} -> ${next}`);
  if (!actorPhone || actorPhone.startsWith('anon_')) throw new Error('Authenticated actor is required for lifecycle changes');
  db.run('UPDATE discovery_entities SET lifecycle = ?, claimed = CASE WHEN ? IN (\'claimed\', \'onboarded\', \'verified\', \'available\', \'executing\', \'completed\') THEN 1 ELSE claimed END, verified = CASE WHEN ? IN (\'verified\', \'available\', \'executing\', \'completed\') THEN 1 ELSE verified END, available = CASE WHEN ? IN (\'available\', \'executing\') THEN 1 ELSE available END, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [next, next, next, next, entityId]);
  saveDb();
  return safeEntity({ ...current, lifecycle: next }, { latitude: Number(current.latitude), longitude: Number(current.longitude) });
}

export async function inviteContributorToDiscoveryEntity(entityId: string, inviterPhone: string, contributorPhone?: string): Promise<{ id: string; entityId: string; status: 'invited' }> {
  await ensureDiscoveryNetworkSchema();
  if (!inviterPhone || inviterPhone.startsWith('anon_')) throw new Error('Authenticated inviter is required');
  const db = await getDb();
  const entity = db.exec('SELECT id, lifecycle FROM discovery_entities WHERE id = ?', [entityId]);
  if (!entity[0]?.values?.length) throw new Error('Discovery entity not found');
  const id = `discovery-invite:${entityId}:${inviterPhone}:${contributorPhone || 'unassigned'}`;
  db.run(`INSERT INTO discovery_invitations (id, entity_id, inviter_phone, contributor_phone, status, evidence_json, updated_at) VALUES (?, ?, ?, ?, 'invited', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET status='invited', updated_at=CURRENT_TIMESTAMP`, [id, entityId, inviterPhone, contributorPhone || null, JSON.stringify({ source: 'discovery_network', attributable: true })]);
  saveDb();
  return { id, entityId, status: 'invited' };
}
