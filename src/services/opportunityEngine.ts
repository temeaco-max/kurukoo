import { getDb, saveDb } from '../database.js';
import { getIntentions } from './deferredRequestService.js';
import { getAdCampaigns } from './adManager.js';

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
  sourceType: 'deferred_intention' | 'ad_campaign';
  sourceId: string;
  disclosure?: string;
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
        expiresAt: opportunityExpiry(item.expires_at),
      };
    });
}

async function sponsoredCandidates(phone: string, intentionText: string[]): Promise<Opportunity[]> {
  const haystack = intentionText.join(' ').toLowerCase();
  if (!haystack) return [];
  const campaigns = await getAdCampaigns();
  return campaigns
    .filter((campaign) => campaign.status === 'active' && campaign.targetKeyword && haystack.includes(campaign.targetKeyword.toLowerCase().trim()))
    .map((campaign) => ({
      phone,
      type: 'daily_pick' as const,
      title: cleanText(campaign.title, 'Sponsored suggestion', 160),
      subtitle: `${cleanText(campaign.desc, 'A disclosed sponsored placement.', 260)} ${cleanText(campaign.disclosure, 'External advertisement', 120)}`,
      ctaText: 'Discuss in Web Chat',
      ctaLink: promptLink(`I am interested in ${cleanText(campaign.title, 'this sponsored placement', 120)}`),
      urgency: 0.3,
      businessValue: 0,
      status: 'sent' as const,
      sourceType: 'ad_campaign' as const,
      sourceId: String(campaign.id),
      disclosure: cleanText(campaign.disclosure, 'External advertisement', 120),
      expiresAt: opportunityExpiry(undefined, 24),
    }));
}

async function storeOpportunity(opportunity: Opportunity): Promise<Opportunity> {
  const db = await getDb();
  const idempotencyKey = `${opportunity.sourceType}:${opportunity.sourceId}`;
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
    sourceType: String(row.source_type) === 'ad_campaign' ? 'ad_campaign' : 'deferred_intention', sourceId: String(row.source_id || ''),
    disclosure: row.disclosure ? String(row.disclosure) : undefined, expiresAt: String(row.expires_at || ''),
    createdAt: row.created_at ? String(row.created_at) : undefined, updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

/** Generate only current, owner-scoped opportunities from canonical evidence. */
export async function generateProactiveOpportunities(phone: string): Promise<Opportunity[]> {
  const owner = String(phone || '').trim();
  if (!owner) throw new Error('Authenticated owner is required');
  await initOpportunityTable();
  const deferred = await deferredCandidates(owner);
  const sponsored = await sponsoredCandidates(owner, deferred.map((item) => item.title));
  const candidates = [...deferred, ...sponsored].map((item) => ({ ...item, score: score(item) }))
    .sort((left, right) => (right.score || 0) - (left.score || 0)).slice(0, 3);
  const stored: Opportunity[] = [];
  for (const candidate of candidates) stored.push(await storeOpportunity(candidate));
  return stored;
}

export async function getOpportunitiesForFeed(phone: string): Promise<Opportunity[]> {
  const owner = String(phone || '').trim();
  if (!owner) throw new Error('Authenticated owner is required');
  await initOpportunityTable();
  await generateProactiveOpportunities(owner);
  const db = await getDb();
  const stmt = db.prepare(`SELECT * FROM proactive_opportunities
    WHERE phone=? AND status != 'dismissed' AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
    ORDER BY CASE status WHEN 'sent' THEN 0 WHEN 'viewed' THEN 1 ELSE 2 END, created_at DESC LIMIT 15`);
  stmt.bind([owner]);
  const results: Opportunity[] = [];
  while (stmt.step()) results.push(rowToOpportunity(stmt.getAsObject() as Record<string, unknown>));
  stmt.free();
  return results;
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
