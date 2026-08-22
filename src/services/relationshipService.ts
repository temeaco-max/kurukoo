import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';
import { getDiscoveryEntity } from './discoveryNetwork.js';
import { sendFcmPush } from './pushNotifications.js';

export const RELATIONSHIP_TARGET_TYPES = ['person', 'provider', 'contributor', 'topic', 'opportunity', 'agent', 'discovery'] as const;
export type RelationshipTargetType = typeof RELATIONSHIP_TARGET_TYPES[number];

/**
 * The vocabulary intentionally distinguishes relationship semantics without
 * making Follow a source of contact, safety, participant, or provider authority.
 * Only follow and subscribe are mutable through this service today.
 */
export const RELATIONSHIP_TYPES = ['follow', 'subscribe', 'contact', 'participant', 'provider_relationship', 'safety'] as const;
export type RelationshipType = typeof RELATIONSHIP_TYPES[number];
export type RelationshipStatus = 'active' | 'revoked' | 'suppressed';
export type NotificationPreference = 'all' | 'muted';
export type RelationshipVisibility = 'private' | 'contextual';

export interface Relationship {
  id: string;
  actorPhone: string;
  targetType: string;
  targetId: string;
  relationshipType: RelationshipType;
  status: RelationshipStatus;
  notificationPreference: NotificationPreference;
  visibility: RelationshipVisibility;
  context: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
}

export interface RelationshipInput {
  targetType: unknown;
  targetId: unknown;
  relationshipType?: unknown;
  notificationPreference?: unknown;
  visibility?: unknown;
  context?: unknown;
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function cleanTargetType(value: unknown): RelationshipTargetType {
  const type = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!(RELATIONSHIP_TARGET_TYPES as readonly string[]).includes(type)) throw new Error('Unsupported relationship target type');
  return type as RelationshipTargetType;
}

function cleanTargetId(value: unknown): string {
  const id = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
  if (!id || id.length > 180 || /[\u0000-\u001f\u007f]/.test(id)) throw new Error('A valid relationship target is required');
  return id;
}

function cleanRelationshipType(value: unknown): RelationshipType {
  const type = typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : 'follow';
  if (!(RELATIONSHIP_TYPES as readonly string[]).includes(type)) throw new Error('Unsupported relationship type');
  if (type !== 'follow' && type !== 'subscribe') throw new Error('This relationship type remains owned by its canonical service');
  return type as RelationshipType;
}

function cleanNotificationPreference(value: unknown): NotificationPreference {
  const preference = value == null || value === '' ? 'all' : String(value).trim().toLowerCase();
  if (preference !== 'all' && preference !== 'muted') throw new Error('notificationPreference must be all or muted');
  return preference;
}

function cleanVisibility(value: unknown): RelationshipVisibility {
  const visibility = value == null || value === '' ? 'private' : String(value).trim().toLowerCase();
  if (visibility !== 'private' && visibility !== 'contextual') throw new Error('visibility must be private or contextual');
  return visibility;
}

function cleanContext(value: unknown): Record<string, unknown> {
  if (value == null) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('context must be an object');
  const json = JSON.stringify(value);
  if (json.length > 4_000) throw new Error('context is too large');
  return value as Record<string, unknown>;
}

function rowToRelationship(row: any): Relationship {
  return {
    id: String(row.id),
    actorPhone: String(row.actor_phone),
    targetType: String(row.target_type),
    targetId: String(row.target_id),
    relationshipType: String(row.relationship_type) as RelationshipType,
    status: String(row.status) as RelationshipStatus,
    notificationPreference: String(row.notification_preference || 'all') as NotificationPreference,
    visibility: String(row.visibility || 'private') as RelationshipVisibility,
    context: parseJsonObject(row.context_json),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    revokedAt: row.revoked_at == null ? null : String(row.revoked_at),
  };
}

export async function ensureRelationshipSchema(): Promise<void> {
  const db = await getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS relationships (
      id TEXT PRIMARY KEY,
      actor_phone TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      relationship_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked','suppressed')),
      notification_preference TEXT NOT NULL DEFAULT 'all' CHECK(notification_preference IN ('all','muted')),
      visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','contextual')),
      context_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revoked_at TEXT,
      UNIQUE(actor_phone, target_type, target_id, relationship_type)
    );
    CREATE INDEX IF NOT EXISTS idx_relationships_actor_status ON relationships(actor_phone, status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_relationships_target_status ON relationships(target_type, target_id, status, relationship_type);
    CREATE INDEX IF NOT EXISTS idx_relationships_type_status ON relationships(relationship_type, status, updated_at DESC);
    CREATE TABLE IF NOT EXISTS relationship_blocks (
      blocker_phone TEXT NOT NULL,
      blocked_phone TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(blocker_phone, blocked_phone)
    );
    CREATE INDEX IF NOT EXISTS idx_relationship_blocks_blocked ON relationship_blocks(blocked_phone, blocker_phone);
  `);
  const profileColumns = new Set((db.exec('PRAGMA table_info(memory_profiles)')[0]?.values || []).map((row: any[]) => String(row[1])));
  if (!profileColumns.has('relationship_visibility')) db.run(`ALTER TABLE memory_profiles ADD COLUMN relationship_visibility TEXT NOT NULL DEFAULT 'private'`);

  const legacy = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='discover_interests'`);
  if (legacy[0]?.values?.length) {
    db.run(`
      INSERT OR IGNORE INTO relationships(id, actor_phone, target_type, target_id, relationship_type, status, notification_preference, visibility, context_json, created_at, updated_at)
      SELECT 'legacy-discover-follow:' || id, phone, item_type, item_id, 'follow', 'active', 'all', 'private', '{}', created_at, updated_at
      FROM discover_interests
      WHERE action='follow'
    `);
    db.run(`DELETE FROM discover_interests WHERE action='follow'`);
  }
  saveDb();
}

async function resolveTarget(targetType: RelationshipTargetType, targetId: string, actorPhone: string): Promise<void> {
  const db = await getDb();
  if (targetType === 'topic') {
    const row = db.exec(`SELECT id FROM topics WHERE id=? AND status='public' LIMIT 1`, [targetId]);
    if (!row[0]?.values?.length) throw new Error('Relationship target is not publicly available');
    return;
  }
  if (targetType === 'provider') {
    const row = db.exec(`SELECT p.phone FROM memory_profiles p WHERE p.phone=? AND (p.verified_provider=1 OR EXISTS (SELECT 1 FROM skills s WHERE s.phone=p.phone)) LIMIT 1`, [targetId]);
    if (!row[0]?.values?.length) throw new Error('Relationship target is not a public provider');
    return;
  }
  if (targetType === 'contributor') {
    const row = db.exec(`SELECT phone FROM memory_profiles WHERE phone=? AND is_contributor=1 AND COALESCE(relationship_visibility,'private')='public' LIMIT 1`, [targetId]);
    if (!row[0]?.values?.length) throw new Error('Relationship target is not a public contributor');
    return;
  }
  if (targetType === 'person') {
    if (targetId === actorPhone) throw new Error('A user cannot follow themself');
    const row = db.exec(`SELECT phone FROM memory_profiles WHERE phone=? AND COALESCE(relationship_visibility,'private')='public' LIMIT 1`, [targetId]);
    if (!row[0]?.values?.length) throw new Error('Relationship target is private or unavailable');
    return;
  }
  if (targetType === 'agent') {
    const row = db.exec(`SELECT id FROM ai_agents WHERE id=? AND status='active' LIMIT 1`, [targetId]);
    if (!row[0]?.values?.length) throw new Error('Relationship target is not an eligible agent');
    return;
  }
  if (targetType === 'opportunity') {
    const row = db.exec(`SELECT id FROM proactive_opportunities WHERE id=? AND phone=? AND status!='dismissed' LIMIT 1`, [targetId, actorPhone]);
    if (!row[0]?.values?.length) throw new Error('Relationship target is private or unavailable');
    return;
  }
  const entity = await getDiscoveryEntity(targetId);
  if (!entity) throw new Error('Relationship target was not found');
}

async function assertNotBlocked(actorPhone: string, targetId: string, targetType: RelationshipTargetType): Promise<void> {
  if (targetType !== 'person' && targetType !== 'provider' && targetType !== 'contributor') return;
  const db = await getDb();
  const result = db.exec(`SELECT 1 FROM relationship_blocks WHERE (blocker_phone=? AND blocked_phone=?) OR (blocker_phone=? AND blocked_phone=?) LIMIT 1`, [targetId, actorPhone, actorPhone, targetId]);
  if (result[0]?.values?.length) throw new Error('This relationship is blocked by a privacy boundary');
}

async function activeRelationshipFor(actorPhone: string, targetType: string, targetId: string, relationshipType: string): Promise<Relationship | null> {
  const db = await getDb();
  const statement = db.prepare(`SELECT * FROM relationships WHERE actor_phone=? AND target_type=? AND target_id=? AND relationship_type=? LIMIT 1`);
  statement.bind([actorPhone, targetType, targetId, relationshipType]);
  const row = statement.step() ? statement.getAsObject() : null;
  statement.free();
  return row ? rowToRelationship(row) : null;
}

export async function createRelationship(actorPhone: string, input: RelationshipInput): Promise<{ relationship: Relationship; idempotent: boolean; reactivated: boolean }> {
  if (!actorPhone || actorPhone.startsWith('anon_')) throw new Error('Authenticated user is required');
  await ensureRelationshipSchema();
  const targetType = cleanTargetType(input.targetType);
  const targetId = cleanTargetId(input.targetId);
  const relationshipType = cleanRelationshipType(input.relationshipType);
  const notificationPreference = cleanNotificationPreference(input.notificationPreference);
  const visibility = cleanVisibility(input.visibility);
  const context = cleanContext(input.context);
  await resolveTarget(targetType, targetId, actorPhone);
  await assertNotBlocked(actorPhone, targetId, targetType);

  const prior = await activeRelationshipFor(actorPhone, targetType, targetId, relationshipType);
  const db = await getDb();
  if (prior?.status === 'active') return { relationship: prior, idempotent: true, reactivated: false };
  if (prior) {
    db.run(`UPDATE relationships SET status='active', notification_preference=?, visibility=?, context_json=?, revoked_at=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [notificationPreference, visibility, JSON.stringify(context), prior.id]);
    saveDb();
    const relationship = await activeRelationshipFor(actorPhone, targetType, targetId, relationshipType);
    if (!relationship) throw new Error('Unable to reactivate relationship');
    return { relationship, idempotent: false, reactivated: true };
  }

  const id = crypto.randomUUID();
  db.run(`INSERT INTO relationships(id,actor_phone,target_type,target_id,relationship_type,status,notification_preference,visibility,context_json) VALUES(?,?,?,?,?,'active',?,?,?)`, [id, actorPhone, targetType, targetId, relationshipType, notificationPreference, visibility, JSON.stringify(context)]);
  saveDb();
  const relationship = await activeRelationshipFor(actorPhone, targetType, targetId, relationshipType);
  if (!relationship) throw new Error('Unable to create relationship');
  return { relationship, idempotent: false, reactivated: false };
}

async function suppressQueuedRelationshipNotifications(relationshipId: string, reason: string): Promise<number> {
  const db = await getDb();
  db.run(`UPDATE internal_notifications SET delivery_state='suppressed', failure_reason=? WHERE object_type='relationship' AND object_id=? AND delivery_state IN ('queued','accepted','sent','failed')`, [reason, relationshipId]);
  const suppressed = db.getRowsModified();
  if (suppressed) saveDb();
  return suppressed;
}

export async function revokeRelationship(actorPhone: string, targetTypeValue: unknown, targetIdValue: unknown, relationshipTypeValue: unknown = 'follow'): Promise<{ revoked: boolean; suppressedNotifications: number }> {
  if (!actorPhone || actorPhone.startsWith('anon_')) throw new Error('Authenticated user is required');
  await ensureRelationshipSchema();
  const targetType = cleanTargetType(targetTypeValue);
  const targetId = cleanTargetId(targetIdValue);
  const relationshipType = cleanRelationshipType(relationshipTypeValue);
  const relationship = await activeRelationshipFor(actorPhone, targetType, targetId, relationshipType);
  if (!relationship || relationship.status !== 'active') return { revoked: false, suppressedNotifications: 0 };
  const db = await getDb();
  db.run(`UPDATE relationships SET status='revoked', revoked_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=? AND actor_phone=? AND status='active'`, [relationship.id, actorPhone]);
  if (!db.getRowsModified()) return { revoked: false, suppressedNotifications: 0 };
  saveDb();
  return { revoked: true, suppressedNotifications: await suppressQueuedRelationshipNotifications(relationship.id, 'relationship_revoked') };
}

export async function setRelationshipNotificationPreference(actorPhone: string, targetTypeValue: unknown, targetIdValue: unknown, relationshipTypeValue: unknown, notificationPreferenceValue: unknown): Promise<Relationship | null> {
  if (!actorPhone || actorPhone.startsWith('anon_')) throw new Error('Authenticated user is required');
  await ensureRelationshipSchema();
  const targetType = cleanTargetType(targetTypeValue);
  const targetId = cleanTargetId(targetIdValue);
  const relationshipType = cleanRelationshipType(relationshipTypeValue);
  const notificationPreference = cleanNotificationPreference(notificationPreferenceValue);
  const relationship = await activeRelationshipFor(actorPhone, targetType, targetId, relationshipType);
  if (!relationship || relationship.status !== 'active') return null;
  const db = await getDb();
  db.run(`UPDATE relationships SET notification_preference=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND actor_phone=? AND status='active'`, [notificationPreference, relationship.id, actorPhone]);
  if (!db.getRowsModified()) return null;
  saveDb();
  return activeRelationshipFor(actorPhone, targetType, targetId, relationshipType);
}

export async function getRelationshipForActor(actorPhone: string, targetTypeValue: unknown, targetIdValue: unknown, relationshipTypeValue: unknown = 'follow'): Promise<Relationship | null> {
  if (!actorPhone || actorPhone.startsWith('anon_')) throw new Error('Authenticated user is required');
  await ensureRelationshipSchema();
  return activeRelationshipFor(actorPhone, cleanTargetType(targetTypeValue), cleanTargetId(targetIdValue), cleanRelationshipType(relationshipTypeValue));
}

export async function listRelationshipsForActor(actorPhone: string, options: { status?: RelationshipStatus; relationshipType?: RelationshipType; limit?: number } = {}): Promise<Relationship[]> {
  if (!actorPhone || actorPhone.startsWith('anon_')) throw new Error('Authenticated user is required');
  await ensureRelationshipSchema();
  const status = options.status || 'active';
  const type = options.relationshipType;
  const limit = Math.max(1, Math.min(100, Math.floor(Number(options.limit) || 50)));
  const db = await getDb();
  const statement = db.prepare(`SELECT * FROM relationships WHERE actor_phone=? AND status=?${type ? ' AND relationship_type=?' : ''} ORDER BY updated_at DESC LIMIT ?`);
  statement.bind(type ? [actorPhone, status, type, limit] : [actorPhone, status, limit]);
  const relationships: Relationship[] = [];
  while (statement.step()) relationships.push(rowToRelationship(statement.getAsObject()));
  statement.free();
  return relationships;
}

/** This low-level privacy control is intentionally not a follow, contact, or safety relationship. */
export async function blockRelationshipActor(blockerPhone: string, blockedPhoneValue: unknown): Promise<boolean> {
  if (!blockerPhone || blockerPhone.startsWith('anon_')) throw new Error('Authenticated user is required');
  const blockedPhone = cleanTargetId(blockedPhoneValue);
  if (blockedPhone === blockerPhone) throw new Error('A user cannot block themself');
  await ensureRelationshipSchema();
  const db = await getDb();
  db.run(`INSERT OR IGNORE INTO relationship_blocks(blocker_phone,blocked_phone) VALUES(?,?)`, [blockerPhone, blockedPhone]);
  const changed = db.getRowsModified() > 0;
  saveDb();
  return changed;
}

export async function revokeRelationshipsForTarget(targetTypeValue: unknown, targetIdValue: unknown, reason = 'target_removed'): Promise<{ revoked: number; suppressedNotifications: number }> {
  await ensureRelationshipSchema();
  const targetType = cleanTargetType(targetTypeValue);
  const targetId = cleanTargetId(targetIdValue);
  const db = await getDb();
  const statement = db.prepare(`SELECT id FROM relationships WHERE target_type=? AND target_id=? AND status='active'`);
  statement.bind([targetType, targetId]);
  const ids: string[] = [];
  while (statement.step()) ids.push(String((statement.getAsObject() as any).id));
  statement.free();
  if (!ids.length) return { revoked: 0, suppressedNotifications: 0 };
  db.run(`UPDATE relationships SET status='suppressed', revoked_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE target_type=? AND target_id=? AND status='active'`, [targetType, targetId]);
  saveDb();
  let suppressedNotifications = 0;
  for (const id of ids) suppressedNotifications += await suppressQueuedRelationshipNotifications(id, reason);
  return { revoked: ids.length, suppressedNotifications };
}

async function isTargetStillNotifiable(targetType: string, targetId: string): Promise<boolean> {
  const db = await getDb();
  if (targetType === 'topic') return Boolean(db.exec(`SELECT 1 FROM topics WHERE id=? AND status='public' LIMIT 1`, [targetId])[0]?.values?.length);
  if (targetType === 'provider') return Boolean(db.exec(`SELECT 1 FROM memory_profiles p WHERE p.phone=? AND (p.verified_provider=1 OR EXISTS (SELECT 1 FROM skills s WHERE s.phone=p.phone)) LIMIT 1`, [targetId])[0]?.values?.length);
  if (targetType === 'contributor') return Boolean(db.exec(`SELECT 1 FROM memory_profiles WHERE phone=? AND is_contributor=1 AND COALESCE(relationship_visibility,'private')='public' LIMIT 1`, [targetId])[0]?.values?.length);
  if (targetType === 'agent') return Boolean(db.exec(`SELECT 1 FROM ai_agents WHERE id=? AND status='active' LIMIT 1`, [targetId])[0]?.values?.length);
  if (targetType === 'opportunity') return Boolean(db.exec(`SELECT 1 FROM proactive_opportunities WHERE id=? AND status!='dismissed' LIMIT 1`, [targetId])[0]?.values?.length);
  if (targetType === 'discovery') return Boolean(await getDiscoveryEntity(targetId));
  return false;
}

export async function notifyRelationshipTargetUpdate(targetTypeValue: unknown, targetIdValue: unknown, update: { title: string; body: string; link?: string; signature: string }): Promise<{ considered: number; queued: number }> {
  await ensureRelationshipSchema();
  const targetType = cleanTargetType(targetTypeValue);
  const targetId = cleanTargetId(targetIdValue);
  if (!(await isTargetStillNotifiable(targetType, targetId))) return { considered: 0, queued: 0 };
  const db = await getDb();
  const statement = db.prepare(`SELECT * FROM relationships WHERE target_type=? AND target_id=? AND relationship_type IN ('follow','subscribe') AND status='active' AND notification_preference='all' ORDER BY created_at ASC`);
  statement.bind([targetType, targetId]);
  const relationships: Relationship[] = [];
  while (statement.step()) relationships.push(rowToRelationship(statement.getAsObject()));
  statement.free();
  for (const relationship of relationships) {
    await sendFcmPush(relationship.actorPhone, update.title.slice(0, 160), update.body.slice(0, 800), update.link, {
      objectType: 'relationship',
      objectId: relationship.id,
      ownerScope: relationship.actorPhone,
      canonicalAction: 'relationship_target_update',
      idempotencyKey: `relationship:${relationship.id}:${update.signature}`.slice(0, 240),
      surface: 'notification',
    });
  }
  return { considered: relationships.length, queued: relationships.length };
}

export async function recordDiscoverFollow(phone: string, itemType: string, itemId: string): Promise<{ relationship: Relationship; idempotent: boolean; reactivated: boolean }> {
  const targetType = itemType === 'topic' ? 'topic' : itemType === 'discovery' ? 'discovery' : null;
  if (!targetType) throw new Error('This Discover item does not support a reusable follow relationship');
  return createRelationship(phone, { targetType, targetId: itemId, relationshipType: 'follow' });
}

export async function removeDiscoverFollow(phone: string, itemType: string, itemId: string): Promise<{ revoked: boolean; suppressedNotifications: number }> {
  const targetType = itemType === 'topic' ? 'topic' : itemType === 'discovery' ? 'discovery' : null;
  if (!targetType) throw new Error('This Discover item does not support a reusable follow relationship');
  return revokeRelationship(phone, targetType, itemId, 'follow');
}
