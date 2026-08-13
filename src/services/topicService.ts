import { randomUUID } from 'crypto';
import { getDb, saveDb } from '../database.js';
import { ECONOMIC_CATEGORIES, getEconomicCategory, getKnownSkills } from './skillFlows.js';

/**
 * Topics are a deliberately small durable-content authority. They are not a
 * social graph, provider directory, recommendation engine, economic request,
 * payment boundary, or reputation system. Related systems retain ownership.
 */
export const TOPIC_TYPES = [
  'question', 'opinion', 'guide', 'review', 'local_report', 'price_report',
  'recommendation', 'meme', 'poll', 'event', 'alert', 'opportunity', 'experience',
] as const;
export type TopicType = typeof TOPIC_TYPES[number];
export type TopicStatus = 'draft' | 'submitted' | 'public' | 'restricted' | 'removed';
export type ReplyStatus = 'submitted' | 'public' | 'restricted' | 'removed';

export interface TopicInput {
  title: unknown;
  body: unknown;
  type?: unknown;
  category?: unknown;
  skills?: unknown;
  city?: unknown;
  lga?: unknown;
}

export interface TopicReplyInput { body: unknown; }
export interface TopicModerationInput { decision: unknown; note?: unknown; }

const TOPIC_SELECT = `
  SELECT t.id, t.slug, t.author_phone, t.title, t.body, t.type, t.category, t.skills_json,
         t.city, t.lga, t.status, t.moderation_note, t.created_at, t.updated_at, t.published_at,
         (SELECT COUNT(*) FROM topic_replies r WHERE r.topic_id=t.id AND r.status='public') AS public_reply_count
  FROM topics t
`;

function cleanText(value: unknown, field: string, minimum: number, maximum: number): string {
  if (typeof value !== 'string') throw new Error(`${field} is required`);
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean.length < minimum || clean.length > maximum) throw new Error(`${field} must be between ${minimum} and ${maximum} characters`);
  return clean;
}

function optionalBroadLocality(value: unknown, field: string): string | null {
  if (value == null || value === '') return null;
  const clean = cleanText(value, field, 2, 80);
  if (/\d{3,}|\b(latitude|longitude|coordinates?|address|street|road|house|flat|apartment)\b/i.test(clean)) {
    throw new Error(`${field} must be broad city or LGA context, not a precise address or coordinate`);
  }
  return clean;
}

function normalizeSkills(value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error('skills must be an array');
  if (value.length > 3) throw new Error('A Topic may reference at most three existing skills');
  const valid = new Set(getKnownSkills());
  const normalized = [...new Set(value.map((skill) => String(skill || '').trim().toLowerCase()).filter(Boolean))];
  if (normalized.length !== value.length || normalized.some((skill) => !valid.has(skill))) {
    throw new Error('Each skill must be an existing Kurukoo skill');
  }
  return normalized;
}

function normalizeInput(input: TopicInput) {
  const title = cleanText(input.title, 'title', 12, 160);
  const body = cleanText(input.body, 'body', 30, 8000);
  const type = String(input.type || 'question').trim().toLowerCase() as TopicType;
  if (!TOPIC_TYPES.includes(type)) throw new Error('type must be a supported Topic type');
  const category = input.category == null || input.category === '' ? null : String(input.category).trim().toLowerCase();
  if (category && !(ECONOMIC_CATEGORIES as readonly string[]).includes(category)) throw new Error('category must be an existing Kurukoo category');
  const skills = normalizeSkills(input.skills);
  if (category && skills.some((skill) => getEconomicCategory(skill) !== category)) {
    throw new Error('Each selected skill must belong to the selected category');
  }
  return { title, body, type, category, skills, city: optionalBroadLocality(input.city, 'city'), lga: optionalBroadLocality(input.lga, 'lga') };
}

function toSlug(title: string): string {
  const candidate = title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72);
  return candidate || 'topic';
}

async function uniqueSlug(title: string): Promise<string> {
  const db = await getDb();
  const stem = toSlug(title);
  let slug = stem;
  let attempt = 2;
  while (true) {
    const statement = db.prepare('SELECT 1 FROM topics WHERE slug=? LIMIT 1');
    statement.bind([slug]);
    const exists = statement.step();
    statement.free();
    if (!exists) return slug;
    slug = `${stem}-${attempt++}`;
  }
}

function parseTopic(row: any, includeOwner = false) {
  const publicTopic = {
    id: String(row.id), slug: String(row.slug), title: String(row.title), body: String(row.body),
    type: String(row.type) as TopicType, category: row.category ? String(row.category) : null,
    skills: JSON.parse(String(row.skills_json || '[]')) as string[], city: row.city ? String(row.city) : null,
    lga: row.lga ? String(row.lga) : null, status: String(row.status) as TopicStatus,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    publishedAt: row.published_at ? String(row.published_at) : null,
    replyCount: Number(row.public_reply_count || 0), authorLabel: 'Community member',
  };
  return includeOwner ? { ...publicTopic, authorPhone: String(row.author_phone), moderationNote: row.moderation_note ? String(row.moderation_note) : null } : publicTopic;
}

function parseReply(row: any, includeOwner = false) {
  const reply = { id: String(row.id), topicId: String(row.topic_id), body: String(row.body), status: String(row.status) as ReplyStatus, createdAt: String(row.created_at), updatedAt: String(row.updated_at), authorLabel: 'Community member' };
  return includeOwner ? { ...reply, authorPhone: String(row.author_phone), moderationNote: row.moderation_note ? String(row.moderation_note) : null } : reply;
}

function existingTopicById(db: any, id: string): any | null {
  const statement = db.prepare(`${TOPIC_SELECT} WHERE t.id=? LIMIT 1`);
  statement.bind([id]);
  const row = statement.step() ? statement.getAsObject() : null;
  statement.free();
  return row;
}

function existingTopicBySlug(db: any, slug: string): any | null {
  const statement = db.prepare(`${TOPIC_SELECT} WHERE t.slug=? LIMIT 1`);
  statement.bind([slug]);
  const row = statement.step() ? statement.getAsObject() : null;
  statement.free();
  return row;
}

export async function createTopic(authorPhone: string, input: TopicInput) {
  const clean = normalizeInput(input);
  const db = await getDb();
  const slug = await uniqueSlug(clean.title);
  const id = randomUUID();
  const statement = db.prepare(`INSERT INTO topics(id, slug, author_phone, title, body, type, category, skills_json, city, lga, status) VALUES(?,?,?,?,?,?,?,?,?,?,'submitted')`);
  statement.bind([id, slug, authorPhone, clean.title, clean.body, clean.type, clean.category, JSON.stringify(clean.skills), clean.city, clean.lga]);
  statement.step();
  statement.free();
  saveDb();
  return getTopicForOwner(id, authorPhone);
}

export async function updateTopic(authorPhone: string, id: string, input: TopicInput) {
  const clean = normalizeInput(input);
  const db = await getDb();
  const current = existingTopicById(db, id);
  if (!current) throw new Error('Topic not found');
  if (String(current.author_phone) !== authorPhone) throw new Error('Topic ownership is required');
  if (!['draft', 'submitted', 'restricted'].includes(String(current.status))) throw new Error('Only non-public Topics may be edited; create a new Topic to correct published context');
  const statement = db.prepare(`UPDATE topics SET title=?, body=?, type=?, category=?, skills_json=?, city=?, lga=?, slug=?, status='submitted', moderation_note=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?`);
  statement.bind([clean.title, clean.body, clean.type, clean.category, JSON.stringify(clean.skills), clean.city, clean.lga, await uniqueSlug(clean.title), id]);
  statement.step();
  statement.free();
  saveDb();
  return getTopicForOwner(id, authorPhone);
}

export async function removeTopic(authorPhone: string, id: string) {
  const db = await getDb();
  const current = existingTopicById(db, id);
  if (!current) throw new Error('Topic not found');
  if (String(current.author_phone) !== authorPhone) throw new Error('Topic ownership is required');
  const statement = db.prepare(`UPDATE topics SET status='removed', updated_at=CURRENT_TIMESTAMP WHERE id=?`);
  statement.bind([id]); statement.step(); statement.free(); saveDb();
  return { id, removed: true };
}

export async function getTopicForOwner(id: string, authorPhone: string) {
  const db = await getDb();
  const row = existingTopicById(db, id);
  if (!row || String(row.author_phone) !== authorPhone) return null;
  return parseTopic(row, true);
}

export async function listTopicsForOwner(authorPhone: string, limit = 50) {
  const db = await getDb();
  const statement = db.prepare(`${TOPIC_SELECT} WHERE t.author_phone=? ORDER BY t.updated_at DESC LIMIT ?`);
  statement.bind([authorPhone, Math.max(1, Math.min(100, Math.floor(limit)))]);
  const topics: any[] = [];
  while (statement.step()) topics.push(parseTopic(statement.getAsObject(), true));
  statement.free();
  return topics;
}

export async function getPublicTopic(slug: string) {
  const db = await getDb();
  const row = existingTopicBySlug(db, slug);
  if (!row || String(row.status) !== 'public') return null;
  const replyStatement = db.prepare(`SELECT id, topic_id, author_phone, body, status, moderation_note, created_at, updated_at FROM topic_replies WHERE topic_id=? AND status='public' ORDER BY created_at ASC LIMIT 100`);
  replyStatement.bind([String(row.id)]);
  const replies: any[] = [];
  while (replyStatement.step()) replies.push(parseReply(replyStatement.getAsObject()));
  replyStatement.free();
  return { ...parseTopic(row), replies };
}

export async function listPublicTopics(filters: { category?: unknown; skill?: unknown; type?: unknown; city?: unknown; limit?: unknown } = {}) {
  const conditions = ["t.status='public'"];
  const params: unknown[] = [];
  const category = typeof filters.category === 'string' ? filters.category.trim().toLowerCase() : '';
  const skill = typeof filters.skill === 'string' ? filters.skill.trim().toLowerCase() : '';
  const type = typeof filters.type === 'string' ? filters.type.trim().toLowerCase() : '';
  const city = typeof filters.city === 'string' ? filters.city.trim() : '';
  if (category) { conditions.push('t.category=?'); params.push(category); }
  if (skill) { conditions.push("t.skills_json LIKE ?"); params.push(`%\"${skill.replace(/[%_]/g, '')}\"%`); }
  if (type && TOPIC_TYPES.includes(type as TopicType)) { conditions.push('t.type=?'); params.push(type); }
  if (city) { conditions.push('lower(t.city)=lower(?)'); params.push(city.slice(0, 80)); }
  const limit = Math.max(1, Math.min(50, Number.isFinite(Number(filters.limit)) ? Math.floor(Number(filters.limit)) : 20));
  const db = await getDb();
  const statement = db.prepare(`${TOPIC_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY t.published_at DESC, t.updated_at DESC LIMIT ?`);
  statement.bind([...params, limit]);
  const topics: any[] = [];
  while (statement.step()) topics.push(parseTopic(statement.getAsObject()));
  statement.free();
  return topics;
}

export async function createReply(authorPhone: string, topicId: string, input: TopicReplyInput) {
  const body = cleanText(input.body, 'reply body', 2, 4000);
  const db = await getDb();
  const topic = existingTopicById(db, topicId);
  if (!topic || String(topic.status) !== 'public') throw new Error('Replies are available only on public Topics');
  const id = randomUUID();
  const statement = db.prepare(`INSERT INTO topic_replies(id, topic_id, author_phone, body, status) VALUES(?,?,?,?, 'submitted')`);
  statement.bind([id, topicId, authorPhone, body]); statement.step(); statement.free(); saveDb();
  return getReplyForOwner(id, authorPhone);
}

export async function getReplyForOwner(id: string, authorPhone: string) {
  const db = await getDb();
  const statement = db.prepare(`SELECT id, topic_id, author_phone, body, status, moderation_note, created_at, updated_at FROM topic_replies WHERE id=? AND author_phone=? LIMIT 1`);
  statement.bind([id, authorPhone]);
  const row = statement.step() ? statement.getAsObject() : null; statement.free();
  return row ? parseReply(row, true) : null;
}

export async function createTopicReport(reporterPhone: string, targetType: unknown, targetId: unknown, reason: unknown, detail?: unknown) {
  const type = targetType === 'reply' ? 'reply' : targetType === 'topic' ? 'topic' : null;
  const id = typeof targetId === 'string' ? targetId.trim() : '';
  if (!type || !id) throw new Error('A valid Topic or reply report target is required');
  const cleanReason = cleanText(reason, 'report reason', 3, 80);
  const cleanDetail = detail == null || detail === '' ? null : cleanText(detail, 'report detail', 3, 1000);
  const db = await getDb();
  const existsStatement = db.prepare(type === 'topic' ? 'SELECT 1 FROM topics WHERE id=? LIMIT 1' : 'SELECT 1 FROM topic_replies WHERE id=? LIMIT 1');
  existsStatement.bind([id]); const exists = existsStatement.step(); existsStatement.free();
  if (!exists) throw new Error('Report target not found');
  const reportId = randomUUID();
  const statement = db.prepare(`INSERT INTO topic_reports(id, target_type, target_id, reporter_phone, reason, detail) VALUES(?,?,?,?,?,?)`);
  statement.bind([reportId, type, id, reporterPhone, cleanReason, cleanDetail]); statement.step(); statement.free(); saveDb();
  return { id: reportId, status: 'open' };
}

export async function listSubmittedTopics(limit = 100) {
  const db = await getDb();
  const statement = db.prepare(`${TOPIC_SELECT} WHERE t.status IN ('submitted', 'restricted') ORDER BY t.updated_at ASC LIMIT ?`);
  statement.bind([Math.max(1, Math.min(200, Math.floor(limit)))]);
  const topics: any[] = []; while (statement.step()) topics.push(parseTopic(statement.getAsObject(), true)); statement.free(); return topics;
}

export async function moderateTopic(id: string, input: TopicModerationInput) {
  const decision = input.decision === 'public' || input.decision === 'restricted' || input.decision === 'removed' ? input.decision : null;
  if (!decision) throw new Error('Moderation decision must be public, restricted, or removed');
  const note = input.note == null || input.note === '' ? null : cleanText(input.note, 'moderation note', 3, 1000);
  const db = await getDb();
  const current = existingTopicById(db, id); if (!current) throw new Error('Topic not found');
  const statement = db.prepare(`UPDATE topics SET status=?, moderation_note=?, published_at=CASE WHEN ?='public' THEN COALESCE(published_at, CURRENT_TIMESTAMP) ELSE published_at END, updated_at=CURRENT_TIMESTAMP WHERE id=?`);
  statement.bind([decision, note, decision, id]); statement.step(); statement.free(); saveDb();
  const updated = existingTopicById(db, id); return updated ? parseTopic(updated, true) : null;
}

export async function listSubmittedReplies(limit = 100) {
  const db = await getDb();
  const statement = db.prepare(`SELECT id, topic_id, author_phone, body, status, moderation_note, created_at, updated_at FROM topic_replies WHERE status IN ('submitted', 'restricted') ORDER BY updated_at ASC LIMIT ?`);
  statement.bind([Math.max(1, Math.min(200, Math.floor(limit)))]);
  const replies: any[] = []; while (statement.step()) replies.push(parseReply(statement.getAsObject(), true)); statement.free(); return replies;
}

export async function moderateReply(id: string, input: TopicModerationInput) {
  const decision = input.decision === 'public' || input.decision === 'restricted' || input.decision === 'removed' ? input.decision : null;
  if (!decision) throw new Error('Moderation decision must be public, restricted, or removed');
  const note = input.note == null || input.note === '' ? null : cleanText(input.note, 'moderation note', 3, 1000);
  const db = await getDb();
  const statement = db.prepare(`UPDATE topic_replies SET status=?, moderation_note=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`);
  statement.bind([decision, note, id]); statement.step(); statement.free();
  if (db.getRowsModified() !== 1) throw new Error('Reply not found');
  saveDb();
  const result = db.prepare(`SELECT id, topic_id, author_phone, body, status, moderation_note, created_at, updated_at FROM topic_replies WHERE id=? LIMIT 1`);
  result.bind([id]); const row = result.step() ? result.getAsObject() : null; result.free(); return row ? parseReply(row, true) : null;
}

export async function listTopicReports(limit = 100) {
  const db = await getDb();
  const statement = db.prepare(`SELECT id, target_type, target_id, reporter_phone, reason, detail, status, moderation_note, created_at, reviewed_at FROM topic_reports WHERE status='open' ORDER BY created_at ASC LIMIT ?`);
  statement.bind([Math.max(1, Math.min(200, Math.floor(limit)))]);
  const reports: any[] = [];
  while (statement.step()) {
    const row = statement.getAsObject();
    reports.push({ id: String(row.id), targetType: String(row.target_type), targetId: String(row.target_id), reporterPhone: String(row.reporter_phone), reason: String(row.reason), detail: row.detail ? String(row.detail) : null, status: String(row.status), createdAt: String(row.created_at) });
  }
  statement.free(); return reports;
}

export async function closeTopicReport(id: string, note?: unknown) {
  const cleanNote = note == null || note === '' ? null : cleanText(note, 'moderation note', 3, 1000);
  const db = await getDb();
  const statement = db.prepare(`UPDATE topic_reports SET status='closed', moderation_note=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='open'`);
  statement.bind([cleanNote, id]); statement.step(); statement.free();
  if (db.getRowsModified() !== 1) throw new Error('Open Topic report not found'); saveDb(); return { id, status: 'closed' };
}

export function getTopicTaxonomy() {
  const skillsByCategory: Record<string, string[]> = {};
  for (const skill of getKnownSkills()) {
    const category = getEconomicCategory(skill);
    if (!category) continue;
    (skillsByCategory[category] ||= []).push(skill);
  }
  for (const skills of Object.values(skillsByCategory)) skills.sort();
  return { categories: [...ECONOMIC_CATEGORIES], skillsByCategory };
}

export async function getTopicStats() {
  const db = await getDb();
  const statement = db.prepare(`SELECT status, COUNT(*) AS count FROM topics GROUP BY status`);
  const counts: Record<string, number> = {}; while (statement.step()) { const row = statement.getAsObject(); counts[String(row.status)] = Number(row.count || 0); } statement.free();
  return { public: counts.public || 0, submitted: counts.submitted || 0, restricted: counts.restricted || 0, removed: counts.removed || 0 };
}
