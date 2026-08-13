import { getDb, saveDb } from '../database.js';
import { getIntentions } from './deferredRequestService.js';
import { resolveAdPlacement } from './adManager.js';
import { getEconomicCategory } from './skillFlows.js';
import { listPublicTopics } from './topicService.js';

/**
 * Owner-scoped, evidence-backed suggestions for existing Daily Picks surfaces.
 * This is not a provider directory, inventory system, request lifecycle, or
 * notification authority. It only projects actionable state already owned by
 * deferred intentions and disclosed active advertising campaigns.
 */
export interface Opportunity {
  id?: number;
  phone: string;
  type: 'market_intel' | 'daily_pick';
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  urgency: number;
  businessValue: number;
  score?: number;
  status: 'sent' | 'viewed' | 'acted' | 'dismissed';
  sourceType: 'deferred_intention' | 'ad_campaign' | 'topic';
  sourceId: string;
  disclosure?: string;
  category?: string;
  expiresAt: string;
  createdAt?: string;
  updatedAt?: string;
}

function parseDate(value: unknown): number | null {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function clamp(value: unknown, fallback = 0.5): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
}

function cleanText(value: unknown, fallback: string, maximum = 280): string {
  const text = String(value || '').trim();
  return (text || fallback).slice(0, maximum);
}

function opportunityExpiry(sourceExpiry: unknown, fallbackHours = 24): string {
  const timestamp = parseDate(sourceExpiry);
  return new Date(timestamp && timestamp > Date.now() ? timestamp : Date.now() + fallbackHours * 60 * 60 * 1000).toISOString();
}

function promptLink(prompt: string): string {
  return `/chat?prompt=${encodeURIComponent(prompt)}`;
}

function topicLink(slug: string): string {
  return `/chat?topic=${encodeURIComponent(slug)}`;
}

function meaningfulTokens(value: unknown): Set<string> {
  return new Set(String(value || '').toLowerCase().match(/[a-z0-9]{4,}/g)?.filter((token) => !['continue', 'your', 'request', 'with', 'from', 'this', 'that', 'about', 'community', 'kurukoo'].includes(token)) || []);
}

function overlap(left: Set<string>, right: Set<string>): number {
  let count = 0;
  for (const token of left) if (right.has(token)) count += 1;
  return count;
}

export async function initOpportunityTable(): Promise<void> {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS proactive_opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    cta_text TEXT NOT NULL,
    cta_link TEXT NOT NULL,
    urgency REAL DEFAULT 0.5,
    business_value REAL DEFAULT 0.5,
    status TEXT DEFAULT 'sent',
    source_type TEXT,
    source_id TEXT,
    idempotency_key TEXT,
    disclosure TEXT,
    expires_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  const columns = db.exec('PRAGMA table_info(proactive_opportunities)')[0]?.values || [];
  const names = new Set(columns.map((row: any[]) => String(row[1])));
  const additions: Record<string, string> = {
    source_type: 'TEXT', source_id: 'TEXT', idempotency_key: 'TEXT', disclosure: 'TEXT', expires_at: 'TEXT',
  };
  for (const [name, type] of Object.entries(additions)) if (!names.has(name)) db.run(`ALTER TABLE proactive_opportunities ADD COLUMN ${name} ${type}`);
  db.run('CREATE INDEX IF NOT EXISTS idx_proactive_opportunities_owner ON proactive_opportunities(phone, status, expires_at, created_at)');
  db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_proactive_opportunities_dedupe ON proactive_opportunities(phone, idempotency_key) WHERE idempotency_key IS NOT NULL');
  saveDb();
}

function score(opportunity: Opportunity): number {
  const sourceMatch = opportunity.sourceType === 'deferred_intention' ? 1 : 0.4;
  return (sourceMatch * 0.5) + (clamp(opportunity.urgency) * 0.3) + (clamp(opportunity.businessValue) * 0.2);
}

async function deferredCandidates(phone: string): Promise<Opportunity[]> {
  const intentions = await getIntentions(phone);
  return intentions
    .filter((item: any) => ['requested', 'awaiting_match', 'partially_matched'].includes(String(item.status)) && (!item.expires_at || (parseDate(item.expires_at) || 0) > Date.now()))
    .map((item: any) => {
      const intent = cleanText(item.intent || item.skill, 'your request', 120);
      const state = String(item.status).replaceAll('_', ' ');
      return {
        phone,
        type: 'market_intel' as const,
        title: `Continue your ${intent}`,
        subtitle: `Your request is ${state}. Review the current canonical request state in Kurukoo; a provider, price, payment, or fulfilment is not implied.`,
        ctaText: 'Continue in Web Chat',
        ctaLink: promptLink(`Continue my ${intent} request`),
        urgency: item.status === 'partially_matched' ? 0.8 : 0.6,
        businessValue: 0,
        status: 'sent' as const,
        sourceType: 'deferred_intention' as const,
        sourceId: String(item.id),
        category: getEconomicCategory(String(item.skill || item.intent || '')) || undefined,
        expiresAt: opportunityExpiry(item.expires_at),
      };
    });
}

async function topicCandidates(phone: string, intentionText: string[]): Promise<Opportunity[]> {
  const interest = meaningfulTokens(intentionText.join(' '));
  if (!interest.size) return [];
  const topics = await listPublicTopics({ limit: 100 });
  return topics
    .filter((topic: any) => {
      // Match only substantive, taxonomised public context. This is a source-quality gate, not a Topic ranking system.
      if (!topic?.slug || !topic?.category || !Array.isArray(topic.skills) || !topic.skills.length) return false;
      if (!['question', 'guide', 'review', 'local_report', 'price_report', 'recommendation', 'experience'].includes(String(topic.type))) return false;
      if (String(topic.title || '').trim().length < 20 || String(topic.body || '').trim().length < 240) return false;
      return overlap(interest, meaningfulTokens(`${topic.title} ${topic.body} ${topic.category} ${(topic.skills || []).join(' ')}`)) >= 2;
    })
    .slice(0, 3)
    .map((topic: any) => ({
      phone,
      type: 'daily_pick' as const,
      title: String(topic.title).slice(0, 160),
      subtitle: `Community-shared context in ${String(topic.category).replace(/-/g, ' ')}. It is not verified provider, price, availability, booking, payment, delivery, or fulfilment information.`,
      ctaText: 'Discuss in Web Chat',
      ctaLink: topicLink(String(topic.slug)),
      urgency: 0.25,
      businessValue: 0,
      status: 'sent' as const,
      sourceType: 'topic' as const,
      sourceId: String(topic.id),
      disclosure: 'Community-shared context',
      expiresAt: opportunityExpiry(undefined, 12),
    }));
}

async function sponsoredCandidates(phone: string, categories: string[]): Promise<Opportunity[]> {
  const category = categories.find(Boolean);
  const resolution = await resolveAdPlacement({
    placementId: 'workspace_daily_picks_sponsor', category, safeContext: 'workspace_sponsor', device: 'desktop',
  });
  const item = resolution.item;
  if (!item || item.source !== 'campaign' || !item.campaignId) return [];
  return [{
    phone,
    type: 'daily_pick' as const,
    title: cleanText(item.title, 'Sponsored suggestion', 160),
    subtitle: `${cleanText(item.description, 'A disclosed sponsored placement.', 260)} ${cleanText(item.boundary, 'External advertisement', 280)}`,
    ctaText: cleanText(item.ctaText, 'Review in Web Chat', 80),
    ctaLink: cleanText(item.ctaLink, '/chat', 2048),
    urgency: 0.3,
    businessValue: 0,
    status: 'sent' as const,
    sourceType: 'ad_campaign' as const,
    sourceId: String(item.campaignId),
    disclosure: cleanText(item.disclosure, 'Sponsored', 120),
    category,
    expiresAt: opportunityExpiry(undefined, 24),
  }];
}

async function storeOpportunity(opportunity: Opportunity): Promise<Opportunity> {
  const db = await getDb();
  const idempotencyKey = opportunity.sourceType === 'topic'
    ? `topic:${opportunity.sourceId}:${new Date().toISOString().slice(0, 10)}`
    : `${opportunity.sourceType}:${opportunity.sourceId}`;
  db.run(`INSERT OR IGNORE INTO proactive_opportunities
    (phone,type,title,subtitle,cta_text,cta_link,urgency,business_value,status,source_type,source_id,idempotency_key,disclosure,expires_at,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, [
    opportunity.phone, opportunity.type, opportunity.title, opportunity.subtitle, opportunity.ctaText, opportunity.ctaLink,
    opportunity.urgency, opportunity.businessValue, opportunity.status, opportunity.sourceType, opportunity.sourceId,
    idempotencyKey, opportunity.disclosure || null, opportunity.expiresAt,
  ]);
  saveDb();
  const stmt = db.prepare('SELECT * FROM proactive_opportunities WHERE phone=? AND idempotency_key=? LIMIT 1');
  stmt.bind([opportunity.phone, idempotencyKey]);
  const row = stmt.step() ? stmt.getAsObject() as Record<string, unknown> : null;
  stmt.free();
  return row ? rowToOpportunity(row) : opportunity;
}

function rowToOpportunity(row: Record<string, unknown>): Opportunity {
  return {
    id: Number(row.id), phone: String(row.phone), type: String(row.type) === 'daily_pick' ? 'daily_pick' : 'market_intel',
    title: String(row.title), subtitle: String(row.subtitle), ctaText: String(row.cta_text), ctaLink: String(row.cta_link),
    urgency: Number(row.urgency || 0), businessValue: Number(row.business_value || 0), status: String(row.status) as Opportunity['status'],
    sourceType: String(row.source_type) === 'ad_campaign' ? 'ad_campaign' : String(row.source_type) === 'topic' ? 'topic' : 'deferred_intention', sourceId: String(row.source_id || ''),
    disclosure: row.disclosure ? String(row.disclosure) : undefined, expiresAt: String(row.expires_at || ''),
    createdAt: row.created_at ? String(row.created_at) : undefined, updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

/** Generate only current, owner-scoped opportunities from canonical evidence. */
/** Protected account deletion removes private opportunity-feed state through this owner. */
export async function deleteOpportunitiesForOwner(phone: string): Promise<number> {
  await initOpportunityTable();
  const db = await getDb();
  db.run('DELETE FROM proactive_opportunities WHERE phone=?', [String(phone || '').trim()]);
  const deleted = db.getRowsModified();
  if (deleted) saveDb();
  return deleted;
}

export async function generateProactiveOpportunities(phone: string): Promise<Opportunity[]> {
  const owner = String(phone || '').trim();
  if (!owner) throw new Error('Authenticated owner is required');
  await initOpportunityTable();
  const deferred = await deferredCandidates(owner);
  const intentText = deferred.map((item) => item.title);
  const topics = await topicCandidates(owner, intentText);
  // Sponsorship receives only canonical deferred-request categories; raw request text is never an advertising payload.
  const sponsored = await sponsoredCandidates(owner, deferred.map((item) => item.category || '').filter(Boolean));
  const candidates = [...deferred, ...topics].map((item) => ({ ...item, score: score(item) }))
    .sort((left, right) => (right.score || 0) - (left.score || 0)).slice(0, 3);
  const stored: Opportunity[] = [];
  for (const candidate of candidates) stored.push(await storeOpportunity(candidate));
  // Campaign items remain transient: a pause, budget cap, or inventory change removes them immediately.
  return [...stored, ...sponsored];
}

export async function getOpportunitiesForFeed(phone: string): Promise<Opportunity[]> {
  const owner = String(phone || '').trim();
  if (!owner) throw new Error('Authenticated owner is required');
  await initOpportunityTable();
  const currentCandidates = await generateProactiveOpportunities(owner);
  const db = await getDb();
  const stmt = db.prepare(`SELECT * FROM proactive_opportunities
    WHERE phone=? AND status != 'dismissed' AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
    ORDER BY CASE status WHEN 'sent' THEN 0 WHEN 'viewed' THEN 1 ELSE 2 END, created_at DESC LIMIT 15`);
  stmt.bind([owner]);
  const results: Opportunity[] = [];
  while (stmt.step()) {
    const opportunity = rowToOpportunity(stmt.getAsObject() as Record<string, unknown>);
    if (opportunity.sourceType === 'ad_campaign') continue;
    results.push(opportunity);
  }
  stmt.free();
  return [...results, ...currentCandidates.filter((item) => item.sourceType === 'ad_campaign')];
}

/** Records the user interaction; the client follows the already-disclosed CTA separately. */
export async function actOnOpportunity(id: number, phone: string): Promise<{ success: boolean; message: string; ctaLink?: string }> {
  await initOpportunityTable();
  const owner = String(phone || '').trim();
  const db = await getDb();
  const stmt = db.prepare(`SELECT * FROM proactive_opportunities WHERE id=? AND phone=? AND (expires_at IS NULL OR datetime(expires_at) > datetime('now')) LIMIT 1`);
  stmt.bind([Number(id), owner]);
  const row = stmt.step() ? stmt.getAsObject() as Record<string, unknown> : null;
  stmt.free();
  if (!row) return { success: false, message: 'Opportunity not found or expired' };
  if (String(row.status) !== 'acted') db.run(`UPDATE proactive_opportunities SET status='acted', updated_at=CURRENT_TIMESTAMP WHERE id=? AND phone=?`, [Number(id), owner]);
  saveDb();
  return { success: true, message: 'Opportunity marked as reviewed. Continue only through the disclosed Kurukoo path.', ctaLink: String(row.cta_link) };
}

export async function dismissOpportunity(id: number, phone: string): Promise<boolean> {
  await initOpportunityTable();
  const db = await getDb();
  db.run(`UPDATE proactive_opportunities SET status='dismissed', updated_at=CURRENT_TIMESTAMP WHERE id=? AND phone=? AND status != 'dismissed'`, [Number(id), String(phone || '').trim()]);
  const changed = db.getRowsModified() > 0;
  saveDb();
  return changed;
}
