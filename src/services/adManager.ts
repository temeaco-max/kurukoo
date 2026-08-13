import { createHash, randomUUID } from 'node:crypto';
import { getDb, saveDb } from '../database.js';
import { ECONOMIC_CATEGORIES } from './skillFlows.js';
import { listPublicAffiliateOffers, type AffiliateOffer } from './affiliateService.js';

export type AdPlacementSource = 'kurukoo_sponsored' | 'external_inventory';
export type AdCampaignStatus = 'active' | 'paused' | 'completed' | 'inactive';
export type PlacementFormat = 'native_card' | 'inline_banner' | 'related_card';
export type PlacementDevice = 'mobile' | 'tablet' | 'desktop';
export type PlacementContextKind = 'public_content' | 'workspace_sponsor' | 'explicit_commerce_result';
export type PlacementEventType = 'impression' | 'click';
export type ResolvedPlacementSource = 'campaign' | 'affiliate';

export interface AdCampaign {
  id: number;
  title: string;
  desc: string;
  imageUrl: string;
  targetKeyword: string;
  targetCategories: string[];
  targetCountries: string[];
  creditsBudget: number;
  creditsSpent: number;
  status: AdCampaignStatus;
  placementSource: AdPlacementSource;
  disclosure: string;
  placementIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AdPlacement {
  id: string;
  surface: string;
  position: string;
  format: PlacementFormat;
  deviceEligibility: PlacementDevice[];
  contextKinds: PlacementContextKind[];
  allowedSources: AdPlacementSource[];
  affiliateEnabled: boolean;
  frequencyCap: number;
  priority: number;
  active: boolean;
  disclosureLabel: string;
  safetyExclusions: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PlacementContext {
  placementId: string;
  category?: string;
  country?: string;
  device?: PlacementDevice;
  sessionId?: string;
  safeContext: PlacementContextKind;
}

export interface ResolvedPlacementItem {
  source: ResolvedPlacementSource;
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  disclosure: string;
  placementSource: AdPlacementSource | 'affiliate';
  ctaText: string;
  ctaLink: string;
  campaignId?: number;
  affiliateOfferId?: string;
  eventToken: string;
  boundary: string;
}

export interface PlacementResolution {
  placement: AdPlacement | null;
  item: ResolvedPlacementItem | null;
  reason: 'served' | 'unknown_placement' | 'inactive_placement' | 'unsafe_context' | 'frequency_capped' | 'no_eligible_inventory';
}

export interface CampaignPlacementMetrics {
  campaignId: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  boundary: string;
}

export interface PlacementMetrics {
  placementId: string;
  impressions: number;
  clicks: number;
  campaignImpressions: number;
  affiliateImpressions: number;
  boundary: string;
}

export type CreateAdCampaign = Omit<AdCampaign, 'id' | 'creditsSpent' | 'status' | 'createdAt' | 'updatedAt' | 'placementSource' | 'disclosure' | 'targetCategories' | 'targetCountries' | 'placementIds'>
  & Partial<Pick<AdCampaign, 'placementSource' | 'disclosure' | 'targetCategories' | 'targetCountries' | 'placementIds'>>;

/** Compatibility input for the existing controlled server-side suggestion path. */
export interface AdMatchContext { category?: string; }

const CATEGORY_SET = new Set<string>(ECONOMIC_CATEGORIES);
const COMMERCIAL_COUNTRY_SET = new Set(['ng', 'gh', 'gb']);
const CAMPAIGN_STATUSES = new Set<AdCampaignStatus>(['active', 'paused', 'completed', 'inactive']);
const SOURCE_SET = new Set<AdPlacementSource>(['kurukoo_sponsored', 'external_inventory']);
const DEVICE_SET = new Set<PlacementDevice>(['mobile', 'tablet', 'desktop']);
const CONTEXT_SET = new Set<PlacementContextKind>(['public_content', 'workspace_sponsor', 'explicit_commerce_result']);
const FORMAT_SET = new Set<PlacementFormat>(['native_card', 'inline_banner', 'related_card']);
const MAX_SESSION_ID_LENGTH = 128;
const PUBLIC_PLACEMENT_IDS = new Set(['home_inline', 'how_it_works_inline', 'explore_inline', 'category_inline', 'discover_feed', 'topic_inline', 'topic_end', 'resource_inline', 'resource_end', 'provider_related']);
const EXCLUDED_PLACEMENT_IDS = new Set(['chat_message', 'auth', 'payment', 'safety', 'emergency', 'voice', 'attachment', 'admin', 'moderation', 'provider_verification', 'account_security']);

const DEFAULT_PLACEMENTS: Array<Omit<AdPlacement, 'createdAt' | 'updatedAt'>> = [
  { id: 'home_inline', surface: 'home', position: 'below_primary_explanation', format: 'native_card', deviceEligibility: ['mobile', 'tablet', 'desktop'], contextKinds: ['public_content'], allowedSources: ['kurukoo_sponsored', 'external_inventory'], affiliateEnabled: false, frequencyCap: 1, priority: 100, active: true, disclosureLabel: 'Sponsored', safetyExclusions: ['hero_cta', 'auth', 'payment', 'safety'] },
  { id: 'how_it_works_inline', surface: 'how_it_works', position: 'after_organic_lifecycle', format: 'inline_banner', deviceEligibility: ['mobile', 'tablet', 'desktop'], contextKinds: ['public_content'], allowedSources: ['kurukoo_sponsored', 'external_inventory'], affiliateEnabled: false, frequencyCap: 1, priority: 85, active: true, disclosureLabel: 'Sponsored', safetyExclusions: ['primary_cta', 'auth', 'payment', 'safety'] },
  { id: 'explore_inline', surface: 'explore', position: 'after_organic_categories', format: 'native_card', deviceEligibility: ['mobile', 'tablet', 'desktop'], contextKinds: ['public_content'], allowedSources: ['kurukoo_sponsored', 'external_inventory'], affiliateEnabled: false, frequencyCap: 1, priority: 90, active: true, disclosureLabel: 'Sponsored', safetyExclusions: ['adjacent_slot'] },
  { id: 'category_inline', surface: 'explore_category', position: 'after_organic_category_content', format: 'native_card', deviceEligibility: ['mobile', 'tablet', 'desktop'], contextKinds: ['public_content'], allowedSources: ['kurukoo_sponsored', 'external_inventory'], affiliateEnabled: true, frequencyCap: 1, priority: 90, active: true, disclosureLabel: 'Sponsored', safetyExclusions: ['adjacent_slot'] },
  { id: 'discover_feed', surface: 'discover', position: 'after_organic_results', format: 'native_card', deviceEligibility: ['mobile', 'tablet', 'desktop'], contextKinds: ['public_content'], allowedSources: ['kurukoo_sponsored', 'external_inventory'], affiliateEnabled: false, frequencyCap: 1, priority: 80, active: true, disclosureLabel: 'Sponsored', safetyExclusions: ['map_overlay', 'precise_location', 'provider_result_style'] },
  { id: 'topic_inline', surface: 'topic', position: 'after_public_context', format: 'inline_banner', deviceEligibility: ['mobile', 'tablet', 'desktop'], contextKinds: ['public_content'], allowedSources: ['kurukoo_sponsored', 'external_inventory'], affiliateEnabled: false, frequencyCap: 1, priority: 80, active: true, disclosureLabel: 'Sponsored', safetyExclusions: ['reply_stream', 'sensitive_topic'] },
  { id: 'topic_end', surface: 'topic', position: 'after_public_content', format: 'related_card', deviceEligibility: ['mobile', 'tablet', 'desktop'], contextKinds: ['public_content'], allowedSources: ['kurukoo_sponsored', 'external_inventory'], affiliateEnabled: false, frequencyCap: 1, priority: 70, active: true, disclosureLabel: 'Sponsored', safetyExclusions: ['reply_stream', 'duplicate_topic_slot'] },
  { id: 'resource_inline', surface: 'resource', position: 'after_editorial_context', format: 'inline_banner', deviceEligibility: ['mobile', 'tablet', 'desktop'], contextKinds: ['public_content'], allowedSources: ['kurukoo_sponsored', 'external_inventory'], affiliateEnabled: false, frequencyCap: 1, priority: 80, active: true, disclosureLabel: 'Sponsored', safetyExclusions: ['legal', 'security', 'payment_guide'] },
  { id: 'resource_end', surface: 'resource', position: 'after_editorial_content', format: 'related_card', deviceEligibility: ['mobile', 'tablet', 'desktop'], contextKinds: ['public_content'], allowedSources: ['kurukoo_sponsored', 'external_inventory'], affiliateEnabled: false, frequencyCap: 1, priority: 70, active: true, disclosureLabel: 'Sponsored', safetyExclusions: ['legal', 'security', 'duplicate_resource_slot'] },
  { id: 'provider_related', surface: 'provider_profile', position: 'after_organic_provider_facts', format: 'related_card', deviceEligibility: ['mobile', 'tablet', 'desktop'], contextKinds: ['public_content'], allowedSources: ['kurukoo_sponsored', 'external_inventory'], affiliateEnabled: false, frequencyCap: 1, priority: 70, active: true, disclosureLabel: 'Sponsored', safetyExclusions: ['provider_result_style', 'verification'] },
  { id: 'workspace_daily_picks_sponsor', surface: 'workspace_daily_picks', position: 'dedicated_sponsor_panel', format: 'native_card', deviceEligibility: ['mobile', 'tablet', 'desktop'], contextKinds: ['workspace_sponsor'], allowedSources: ['kurukoo_sponsored', 'external_inventory'], affiliateEnabled: false, frequencyCap: 1, priority: 90, active: true, disclosureLabel: 'Sponsored', safetyExclusions: ['personal_suggestion', 'safety', 'payment', 'dispute'] },
  { id: 'workspace_external_offer', surface: 'workspace_external_offers', position: 'external_offer_panel', format: 'related_card', deviceEligibility: ['mobile', 'tablet', 'desktop'], contextKinds: ['workspace_sponsor'], allowedSources: [], affiliateEnabled: true, frequencyCap: 3, priority: 60, active: true, disclosureLabel: 'Affiliate', safetyExclusions: ['personal_suggestion'] },
  { id: 'chat_commerce_result', surface: 'chat_commerce_result', position: 'outside_message_stream', format: 'native_card', deviceEligibility: ['mobile', 'tablet', 'desktop'], contextKinds: ['explicit_commerce_result'], allowedSources: ['kurukoo_sponsored', 'external_inventory'], affiliateEnabled: false, frequencyCap: 1, priority: 60, active: false, disclosureLabel: 'Sponsored', safetyExclusions: ['raw_chat', 'message_stream', 'voice', 'safety', 'sensitive_context'] },
];

function text(value: unknown, maximum: number): string { return String(value || '').trim().slice(0, maximum); }
function bool(value: unknown): boolean { return value === true || value === 1 || value === '1' || value === 'true'; }
function positiveInt(value: unknown, fallback: number, maximum: number): number {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? Math.min(number, maximum) : fallback;
}
function parseArray<T extends string>(value: unknown, valid: Set<T>): T[] {
  let raw: unknown[] = [];
  if (Array.isArray(value)) raw = value;
  else if (typeof value === 'string' && value.trim()) { try { const parsed = JSON.parse(value); raw = Array.isArray(parsed) ? parsed : value.split(','); } catch { raw = value.split(','); } }
  return Array.from(new Set(raw.map(item => text(item, 100) as T).filter(item => valid.has(item))));
}
function parseCategories(value: unknown): string[] {
  let raw: unknown[] = [];
  if (Array.isArray(value)) raw = value;
  else if (typeof value === 'string' && value.trim()) { try { const parsed = JSON.parse(value); raw = Array.isArray(parsed) ? parsed : [value]; } catch { raw = value.split(','); } }
  return Array.from(new Set(raw.map(item => text(item, 80).toLowerCase()).filter(item => CATEGORY_SET.has(item))));
}
function parseCountries(value: unknown): string[] {
  let raw: unknown[] = [];
  if (Array.isArray(value)) raw = value;
  else if (typeof value === 'string' && value.trim()) { try { const parsed = JSON.parse(value); raw = Array.isArray(parsed) ? parsed : [value]; } catch { raw = value.split(','); } }
  return Array.from(new Set(raw.map(item => cleanCountry(item)).filter((item): item is string => Boolean(item && COMMERCIAL_COUNTRY_SET.has(item)))));
}
function parseStringArray(value: unknown, maximum = 80): string[] {
  let raw: unknown[] = [];
  if (Array.isArray(value)) raw = value;
  else if (typeof value === 'string' && value.trim()) { try { const parsed = JSON.parse(value); raw = Array.isArray(parsed) ? parsed : [value]; } catch { raw = value.split(','); } }
  return Array.from(new Set(raw.map(item => text(item, maximum)).filter(Boolean)));
}
function normalizeCampaign(campaign: Partial<AdCampaign> & { targetCategoriesJson?: unknown; targetCountriesJson?: unknown; placementIdsJson?: unknown }): AdCampaign {
  const placementSource: AdPlacementSource = campaign.placementSource === 'kurukoo_sponsored' ? 'kurukoo_sponsored' : 'external_inventory';
  const disclosure = text(campaign.disclosure || (placementSource === 'kurukoo_sponsored' ? 'Kurukoo-sponsored' : 'External advertisement'), 120);
  const status: AdCampaignStatus = CAMPAIGN_STATUSES.has(campaign.status as AdCampaignStatus) ? campaign.status as AdCampaignStatus : 'active';
  return {
    id: Number(campaign.id || 0), title: text(campaign.title, 160), desc: text(campaign.desc, 320), imageUrl: text(campaign.imageUrl, 600), targetKeyword: text(campaign.targetKeyword, 120),
    targetCategories: parseCategories(campaign.targetCategories ?? campaign.targetCategoriesJson), targetCountries: parseCountries(campaign.targetCountries ?? campaign.targetCountriesJson), creditsBudget: Math.max(0, Number(campaign.creditsBudget || 0)), creditsSpent: Math.max(0, Number(campaign.creditsSpent || 0)),
    status, placementSource, disclosure, placementIds: parseStringArray(campaign.placementIds ?? campaign.placementIdsJson, 100), createdAt: String(campaign.createdAt || ''), updatedAt: String(campaign.updatedAt || ''),
  };
}
function normalizePlacement(row: Record<string, unknown>): AdPlacement {
  const format = text(row.format, 40) as PlacementFormat;
  return {
    id: text(row.id, 100), surface: text(row.surface, 100), position: text(row.position, 100), format: FORMAT_SET.has(format) ? format : 'native_card',
    deviceEligibility: parseArray(row.deviceEligibility ?? row.device_eligibility_json, DEVICE_SET), contextKinds: parseArray(row.contextKinds ?? row.context_kinds_json, CONTEXT_SET),
    allowedSources: parseArray(row.allowedSources ?? row.allowed_sources_json, SOURCE_SET), affiliateEnabled: bool(row.affiliateEnabled ?? row.affiliate_enabled), frequencyCap: positiveInt(row.frequencyCap ?? row.frequency_cap, 1, 20),
    priority: positiveInt(row.priority, 0, 10_000), active: bool(row.active), disclosureLabel: text(row.disclosureLabel ?? row.disclosure_label, 120) || 'Sponsored', safetyExclusions: parseStringArray(row.safetyExclusions ?? row.safety_exclusions_json, 120),
    createdAt: row.createdAt ?? row.created_at ? String(row.createdAt ?? row.created_at) : undefined, updatedAt: row.updatedAt ?? row.updated_at ? String(row.updatedAt ?? row.updated_at) : undefined,
  };
}
function validateCampaign(campaign: AdCampaign): void {
  if (campaign.title.length < 3) throw new Error('Campaign title must contain at least 3 characters');
  if (campaign.desc.length < 3) throw new Error('Campaign description must contain at least 3 characters');
  if (!campaign.targetKeyword && !campaign.targetCategories.length) throw new Error('Provide a target keyword or at least one canonical category');
  if (!Number.isSafeInteger(campaign.creditsBudget) || campaign.creditsBudget < 0) throw new Error('Campaign budget must be a non-negative integer');
}
function eventSessionHash(sessionId: string): string {
  const secret = process.env.KURUKOO_AD_EVENT_SALT || process.env.JWT_SECRET || 'development-ad-event-salt';
  return createHash('sha256').update(`${secret}:${sessionId}`).digest('hex').slice(0, 48);
}
function cleanSessionId(value: unknown): string | null {
  const sessionId = text(value, MAX_SESSION_ID_LENGTH);
  return /^[A-Za-z0-9_-]{16,128}$/.test(sessionId) ? sessionId : null;
}
function cleanCountry(value: unknown): string | undefined {
  const country = text(value, 8).toLowerCase();
  return /^[a-z]{2}$/.test(country) ? country : undefined;
}
function cleanDevice(value: unknown): PlacementDevice { return DEVICE_SET.has(value as PlacementDevice) ? value as PlacementDevice : 'desktop'; }
function campaignCta(campaign: AdCampaign): { text: string; link: string } {
  return { text: 'Review in Web Chat', link: `/chat?prompt=${encodeURIComponent(`I am interested in ${campaign.title}`)}` };
}
function campaignMatchesContext(campaign: AdCampaign, category?: string, country?: string): boolean {
  if (campaign.status !== 'active' || campaign.creditsBudget <= campaign.creditsSpent) return false;
  if (campaign.targetCategories.length && (!category || !campaign.targetCategories.includes(category))) return false;
  if (campaign.targetCountries.length && (!country || !campaign.targetCountries.includes(country))) return false;
  return true;
}

async function ensureAdPlacementSchema(): Promise<any> {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS ad_placements (
    id TEXT PRIMARY KEY, surface TEXT NOT NULL, position TEXT NOT NULL, format TEXT NOT NULL,
    device_eligibility_json TEXT NOT NULL DEFAULT '[]', context_kinds_json TEXT NOT NULL DEFAULT '[]', allowed_sources_json TEXT NOT NULL DEFAULT '[]', affiliate_enabled INTEGER NOT NULL DEFAULT 0,
    frequency_cap INTEGER NOT NULL DEFAULT 1, priority INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, disclosure_label TEXT NOT NULL DEFAULT 'Sponsored', safety_exclusions_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  try { db.run("ALTER TABLE ad_campaigns ADD COLUMN target_countries_json TEXT NOT NULL DEFAULT '[]'"); } catch { /* Existing deployments already have or do not need the additive field. */ }
  db.run(`CREATE TABLE IF NOT EXISTS ad_campaign_placements (
    campaign_id INTEGER NOT NULL, placement_id TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, priority INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(campaign_id, placement_id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS ad_placement_events (
    id TEXT PRIMARY KEY, placement_id TEXT NOT NULL, campaign_id INTEGER, affiliate_offer_id TEXT, source TEXT NOT NULL, event_type TEXT NOT NULL,
    session_hash TEXT NOT NULL, category TEXT, country TEXT, device TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(placement_id, campaign_id, affiliate_offer_id, event_type, session_hash)
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_ad_campaign_placements_placement ON ad_campaign_placements(placement_id, active, priority)');
  db.run('CREATE INDEX IF NOT EXISTS idx_ad_placement_events_metrics ON ad_placement_events(placement_id, event_type, created_at)');
  for (const placement of DEFAULT_PLACEMENTS) {
    db.run(`INSERT OR IGNORE INTO ad_placements (id,surface,position,format,device_eligibility_json,context_kinds_json,allowed_sources_json,affiliate_enabled,frequency_cap,priority,active,disclosure_label,safety_exclusions_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [placement.id, placement.surface, placement.position, placement.format, JSON.stringify(placement.deviceEligibility), JSON.stringify(placement.contextKinds), JSON.stringify(placement.allowedSources), placement.affiliateEnabled ? 1 : 0, placement.frequencyCap, placement.priority, placement.active ? 1 : 0, placement.disclosureLabel, JSON.stringify(placement.safetyExclusions)]);
  }
  saveDb();
  return db;
}

async function campaignPlacementIds(campaignId: number): Promise<string[]> {
  const db = await ensureAdPlacementSchema();
  const stmt = db.prepare('SELECT placement_id FROM ad_campaign_placements WHERE campaign_id=? AND active=1 ORDER BY priority DESC, placement_id ASC');
  stmt.bind([campaignId]);
  const ids: string[] = [];
  while (stmt.step()) ids.push(String(stmt.getAsObject().placement_id));
  stmt.free();
  return ids;
}
async function getCampaignById(id: number): Promise<AdCampaign | null> { return (await getAdCampaigns()).find(campaign => campaign.id === id) || null; }
async function campaignEligibleForPlacement(campaign: AdCampaign, placement: AdPlacement, category?: string, country?: string): Promise<boolean> {
  if (!campaignMatchesContext(campaign, category, country) || !placement.allowedSources.includes(campaign.placementSource)) return false;
  return (await campaignPlacementIds(campaign.id)).includes(placement.id);
}
async function sessionPlacementEventCount(placementId: string, sessionHash: string): Promise<number> {
  const db = await ensureAdPlacementSchema();
  const stmt = db.prepare(`SELECT COUNT(*) AS count FROM ad_placement_events WHERE placement_id=? AND session_hash=? AND event_type='impression'`);
  stmt.bind([placementId, sessionHash]);
  const count = stmt.step() ? Number(stmt.getAsObject().count || 0) : 0;
  stmt.free();
  return count;
}

export async function listAdPlacements(): Promise<AdPlacement[]> {
  const db = await ensureAdPlacementSchema();
  const stmt = db.prepare('SELECT * FROM ad_placements ORDER BY priority DESC, id ASC');
  const placements: AdPlacement[] = [];
  while (stmt.step()) placements.push(normalizePlacement(stmt.getAsObject() as Record<string, unknown>));
  stmt.free();
  return placements;
}
export async function getAdPlacement(id: string): Promise<AdPlacement | null> {
  const db = await ensureAdPlacementSchema();
  const stmt = db.prepare('SELECT * FROM ad_placements WHERE id=? LIMIT 1');
  stmt.bind([text(id, 100)]);
  const row = stmt.step() ? stmt.getAsObject() as Record<string, unknown> : null;
  stmt.free();
  return row ? normalizePlacement(row) : null;
}
export async function updateAdPlacement(id: string, input: { active?: unknown; frequencyCap?: unknown; priority?: unknown }): Promise<AdPlacement | null> {
  const current = await getAdPlacement(id);
  if (!current) return null;
  const active = input.active === undefined ? current.active : bool(input.active);
  const frequencyCap = input.frequencyCap === undefined ? current.frequencyCap : positiveInt(input.frequencyCap, current.frequencyCap, 20);
  const priority = input.priority === undefined ? current.priority : positiveInt(input.priority, current.priority, 10_000);
  const db = await ensureAdPlacementSchema();
  db.run('UPDATE ad_placements SET active=?,frequency_cap=?,priority=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [active ? 1 : 0, frequencyCap, priority, current.id]);
  saveDb();
  return getAdPlacement(current.id);
}

export async function getAdCampaigns(): Promise<AdCampaign[]> {
  const db = await ensureAdPlacementSchema();
  const rows = db.exec('SELECT * FROM ad_campaigns ORDER BY id DESC');
  if (!rows.length) return [];
  const columns = rows[0].columns;
  const campaigns: AdCampaign[] = [];
  for (const values of rows[0].values) {
    const campaign: Record<string, unknown> = {};
    columns.forEach((column: string, index: number) => { campaign[column.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())] = values[index]; });
    const normalized = normalizeCampaign(campaign);
    normalized.placementIds = await campaignPlacementIds(normalized.id);
    campaigns.push(normalized);
  }
  return campaigns;
}

export async function setCampaignPlacements(campaignId: number, placementIds: unknown): Promise<AdCampaign | null> {
  const campaign = await getCampaignById(Number(campaignId));
  if (!campaign) return null;
  const requested = parseStringArray(placementIds, 100);
  const known = new Set((await listAdPlacements()).map(placement => placement.id));
  if (requested.some(id => !known.has(id) || EXCLUDED_PLACEMENT_IDS.has(id))) throw new Error('Campaign includes an unknown or excluded placement');
  const db = await ensureAdPlacementSchema();
  db.run('DELETE FROM ad_campaign_placements WHERE campaign_id=?', [campaign.id]);
  for (const placementId of requested) db.run('INSERT INTO ad_campaign_placements (campaign_id,placement_id,active,priority) VALUES (?,?,1,0)', [campaign.id, placementId]);
  saveDb();
  return getCampaignById(campaign.id);
}

export async function createAdCampaign(input: CreateAdCampaign): Promise<{ success: true; campaign: AdCampaign }> {
  const db = await ensureAdPlacementSchema();
  const campaign = normalizeCampaign(input);
  validateCampaign(campaign);
  db.run(`INSERT INTO ad_campaigns (title, desc, image_url, target_keyword, target_categories_json, target_countries_json, credits_budget, placement_source, disclosure, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, [campaign.title, campaign.desc, campaign.imageUrl, campaign.targetKeyword, JSON.stringify(campaign.targetCategories), JSON.stringify(campaign.targetCountries), campaign.creditsBudget, campaign.placementSource, campaign.disclosure]);
  const id = Number(db.exec('SELECT last_insert_rowid()')[0]?.values?.[0]?.[0] || 0);
  const defaultPlacementIds = campaign.placementIds.length ? campaign.placementIds : ['explore_inline'];
  await setCampaignPlacements(id, defaultPlacementIds);
  saveDb();
  const created = await getCampaignById(id);
  return { success: true, campaign: created || { ...campaign, id, status: 'active', placementIds: defaultPlacementIds } };
}

export async function setAdCampaignStatus(id: number, status: AdCampaignStatus): Promise<AdCampaign | null> {
  if (!CAMPAIGN_STATUSES.has(status)) throw new Error('Invalid campaign status');
  const db = await ensureAdPlacementSchema();
  db.run('UPDATE ad_campaigns SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [status, Number(id)]);
  if (!db.getRowsModified()) return null;
  saveDb();
  return getCampaignById(Number(id));
}

/** Legacy controlled helper. It only advances a delivery-unit cap and does not claim billing or settlement. */
export async function spendAdCampaign(id: number, cost: number = 1): Promise<boolean> {
  const db = await ensureAdPlacementSchema();
  const result = db.exec('SELECT credits_budget, credits_spent, status FROM ad_campaigns WHERE id = ?', [id]);
  if (!result.length || String(result[0].values[0]?.[2]) !== 'active') return false;
  const [budget, spent] = result[0].values[0];
  if (Number(spent || 0) >= Number(budget || 0)) return false;
  const next = Math.min(Number(budget || 0), Number(spent || 0) + Math.max(1, Math.floor(Number(cost || 1))));
  db.run('UPDATE ad_campaigns SET credits_spent=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [next, next >= Number(budget || 0) ? 'completed' : 'active', id]);
  saveDb();
  return true;
}

/** Existing compatibility matcher; new public projections use resolveAdPlacement with a narrower context contract. */
export async function matchAdCampaigns(query: string, context: AdMatchContext = {}): Promise<AdCampaign[]> {
  const cleanQuery = text(query, 600).toLowerCase();
  const category = parseCategories([context.category])[0] || '';
  return (await getAdCampaigns()).filter(campaign => {
    if (campaign.status !== 'active' || campaign.creditsBudget <= campaign.creditsSpent) return false;
    const keywordMatches = Boolean(campaign.targetKeyword && cleanQuery.includes(campaign.targetKeyword.toLowerCase()));
    const categoryMatches = Boolean(category && campaign.targetCategories.includes(category));
    return keywordMatches || categoryMatches;
  });
}

function placementIsSafe(placement: AdPlacement, context: PlacementContext): boolean {
  if (EXCLUDED_PLACEMENT_IDS.has(placement.id) || !placement.active) return false;
  if (!CONTEXT_SET.has(context.safeContext) || !placement.contextKinds.includes(context.safeContext)) return false;
  const device = cleanDevice(context.device);
  if (!placement.deviceEligibility.includes(device)) return false;
  const category = context.category ? parseCategories([context.category])[0] : undefined;
  if (context.category && !category) return false;
  if (PUBLIC_PLACEMENT_IDS.has(placement.id) && context.safeContext !== 'public_content') return false;
  return true;
}
function itemToken(parts: string[]): string { return createHash('sha256').update(`${process.env.KURUKOO_AD_EVENT_SALT || process.env.JWT_SECRET || 'development-ad-event-salt'}:${parts.join(':')}`).digest('hex').slice(0, 32); }
function directItem(campaign: AdCampaign, placement: AdPlacement, context: PlacementContext): ResolvedPlacementItem {
  const cta = campaignCta(campaign);
  return { source: 'campaign', id: `campaign:${campaign.id}`, campaignId: campaign.id, title: campaign.title, description: campaign.desc, imageUrl: campaign.imageUrl || undefined, disclosure: campaign.disclosure || placement.disclosureLabel, placementSource: campaign.placementSource, ctaText: cta.text, ctaLink: cta.link, eventToken: itemToken([placement.id, 'campaign', String(campaign.id), context.sessionId || '']), boundary: 'Sponsored campaign content is disclosed advertising. It is not a provider verification, inventory, price, availability, booking, payment, delivery, or fulfilment confirmation.' };
}
function affiliateItem(offer: AffiliateOffer, placement: AdPlacement, context: PlacementContext): ResolvedPlacementItem {
  return { source: 'affiliate', id: `affiliate:${offer.id}`, affiliateOfferId: offer.id, title: offer.title, description: offer.description, disclosure: offer.disclosure || 'Affiliate link — Kurukoo may receive a commission if you buy.', placementSource: 'affiliate', ctaText: 'Review external offer', ctaLink: offer.visitUrl || '/saved', eventToken: itemToken([placement.id, 'affiliate', offer.id, context.sessionId || '']), boundary: 'This is an external merchant referral, not a Kurukoo verified provider, quote, inventory, availability, payment, delivery, or fulfilment confirmation.' };
}
function affiliateMatchesCategory(offer: AffiliateOffer, category?: string): boolean {
  if (!category) return false;
  const tokens = category.split('-').filter(token => token.length >= 3);
  const haystack = `${offer.title} ${offer.description}`.toLowerCase();
  return tokens.some(token => haystack.includes(token));
}

/** Resolve one safe, disclosed card. Empty inventory is a normal truthful outcome. */
export async function resolveAdPlacement(context: PlacementContext): Promise<PlacementResolution> {
  const placement = await getAdPlacement(context.placementId);
  if (!placement) return { placement: null, item: null, reason: 'unknown_placement' };
  if (!placement.active) return { placement, item: null, reason: 'inactive_placement' };
  const sessionId = cleanSessionId(context.sessionId);
  if (!placementIsSafe(placement, context)) return { placement, item: null, reason: 'unsafe_context' };
  // Canada is currently a Web Chat foundation market; commercial inventory must not contradict that public readiness disclosure.
  if (cleanCountry(context.country) === 'ca') return { placement, item: null, reason: 'no_eligible_inventory' };
  const sessionHash = sessionId ? eventSessionHash(sessionId) : null;
  if (sessionHash && await sessionPlacementEventCount(placement.id, sessionHash) >= placement.frequencyCap) return { placement, item: null, reason: 'frequency_capped' };
  const category = context.category ? parseCategories([context.category])[0] : undefined;
  const country = cleanCountry(context.country);
  const candidates: AdCampaign[] = [];
  for (const campaign of await getAdCampaigns()) if (await campaignEligibleForPlacement(campaign, placement, category, country)) candidates.push(campaign);
  candidates.sort((left, right) => right.id - left.id);
  const campaign = candidates[0];
  if (campaign) return { placement, item: directItem(campaign, placement, { ...context, sessionId: sessionId || undefined }), reason: 'served' };
  if (placement.affiliateEnabled) {
    const offers = (await listPublicAffiliateOffers(cleanCountry(context.country))).filter(offer => affiliateMatchesCategory(offer, category));
    if (offers[0]) return { placement, item: affiliateItem(offers[0], placement, { ...context, sessionId: sessionId || undefined }), reason: 'served' };
  }
  return { placement, item: null, reason: 'no_eligible_inventory' };
}

export async function recordAdPlacementEvent(input: { placementId: unknown; campaignId?: unknown; affiliateOfferId?: unknown; source: unknown; eventType: unknown; sessionId: unknown; eventToken?: unknown; category?: unknown; country?: unknown; device?: unknown; safeContext: unknown }): Promise<{ recorded: boolean; campaignStatus?: AdCampaignStatus }> {
  const placement = await getAdPlacement(text(input.placementId, 100));
  const source = text(input.source, 20) as ResolvedPlacementSource;
  const eventType = text(input.eventType, 20) as PlacementEventType;
  const sessionId = cleanSessionId(input.sessionId);
  const safeContext = text(input.safeContext, 60) as PlacementContextKind;
  if (!placement || !sessionId || !['campaign', 'affiliate'].includes(source) || !['impression', 'click'].includes(eventType)) return { recorded: false };
  if (!placementIsSafe(placement, { placementId: placement.id, category: input.category ? String(input.category) : undefined, country: input.country ? String(input.country) : undefined, device: cleanDevice(input.device), sessionId, safeContext })) return { recorded: false };
  const category = input.category ? parseCategories([input.category])[0] : undefined;
  const sessionHash = eventSessionHash(sessionId);
  const campaignId = source === 'campaign' ? Number(input.campaignId) : null;
  const affiliateOfferId = source === 'affiliate' ? text(input.affiliateOfferId, 128) : null;
  const expectedToken = itemToken([placement.id, source, source === 'campaign' ? String(campaignId || '') : affiliateOfferId || '', sessionId]);
  if (text(input.eventToken, 80) !== expectedToken) return { recorded: false };
  if (source === 'campaign') {
    const campaign = campaignId ? await getCampaignById(campaignId) : null;
    if (!campaign || !await campaignEligibleForPlacement(campaign, placement, category, cleanCountry(input.country))) return { recorded: false };
  } else if (!placement.affiliateEnabled || !affiliateOfferId) return { recorded: false };
  const db = await ensureAdPlacementSchema();
  const duplicate = db.prepare('SELECT id FROM ad_placement_events WHERE placement_id=? AND campaign_id IS ? AND affiliate_offer_id IS ? AND event_type=? AND session_hash=? LIMIT 1');
  duplicate.bind([placement.id, campaignId, affiliateOfferId, eventType, sessionHash]);
  const exists = duplicate.step();
  duplicate.free();
  if (exists) return { recorded: false };
  let campaignStatus: AdCampaignStatus | undefined;
  if (source === 'campaign' && eventType === 'impression' && campaignId) {
    const campaign = await getCampaignById(campaignId);
    if (!campaign || campaign.creditsSpent >= campaign.creditsBudget) return { recorded: false };
    await spendAdCampaign(campaign.id, 1);
    campaignStatus = (await getCampaignById(campaign.id))?.status;
  }
  db.run('INSERT INTO ad_placement_events (id,placement_id,campaign_id,affiliate_offer_id,source,event_type,session_hash,category,country,device) VALUES (?,?,?,?,?,?,?,?,?,?)', [randomUUID(), placement.id, campaignId, affiliateOfferId, source, eventType, sessionHash, category || null, cleanCountry(input.country) || null, cleanDevice(input.device)]);
  saveDb();
  return { recorded: true, campaignStatus };
}

/** Public callers are restricted to content placement IDs and the `public_content` context. */
export async function resolvePublicAdPlacement(input: Omit<PlacementContext, 'safeContext'>): Promise<PlacementResolution> {
  if (!PUBLIC_PLACEMENT_IDS.has(text(input.placementId, 100))) return { placement: null, item: null, reason: 'unsafe_context' };
  return resolveAdPlacement({ ...input, safeContext: 'public_content' });
}

/** Public measurement cannot submit another context kind or a non-public placement. */
export async function recordPublicAdPlacementEvent(input: Omit<Parameters<typeof recordAdPlacementEvent>[0], 'safeContext'>): Promise<{ recorded: boolean; campaignStatus?: AdCampaignStatus }> {
  if (!PUBLIC_PLACEMENT_IDS.has(text(input.placementId, 100))) return { recorded: false };
  return recordAdPlacementEvent({ ...input, safeContext: 'public_content' });
}

export function getProgrammaticAdProviderStatus(): { provider: string; status: 'not_configured' | 'adapter_required'; boundary: string } {
  const provider = text(process.env.KURUKOO_PROGRAMMATIC_AD_PROVIDER || 'none', 40).toLowerCase();
  if (!provider || provider === 'none') return { provider: 'none', status: 'not_configured', boundary: 'No programmatic advertising provider is configured. Kurukoo serves no remote ad SDK, script, overlay, placeholder, or fabricated programmatic campaign.' };
  return { provider, status: 'adapter_required', boundary: 'A provider name alone does not activate programmatic advertising. A reviewed provider adapter, credentials, consent/privacy assessment, approved format configuration, and acceptance/error evidence are required before any remote inventory can serve.' };
}

export async function getCampaignPlacementMetrics(): Promise<CampaignPlacementMetrics[]> {
  const db = await ensureAdPlacementSchema();
  const rows = db.exec(`SELECT campaign_id,
    COALESCE(SUM(CASE WHEN event_type='impression' THEN 1 ELSE 0 END),0) AS impressions,
    COALESCE(SUM(CASE WHEN event_type='click' THEN 1 ELSE 0 END),0) AS clicks
    FROM ad_placement_events WHERE campaign_id IS NOT NULL GROUP BY campaign_id ORDER BY campaign_id ASC`);
  if (!rows.length) return [];
  const columns = rows[0].columns;
  return rows[0].values.map((values: unknown[]) => {
    const row: Record<string, unknown> = {}; columns.forEach((column: string, index: number) => { row[column] = values[index]; });
    const impressions = Number(row.impressions || 0); const clicks = Number(row.clicks || 0);
    return { campaignId: Number(row.campaign_id || 0), impressions, clicks, ctr: impressions ? clicks / impressions : null, boundary: 'CTR is calculated from deduplicated Kurukoo placement events. It is not third-party viewability, conversion, advertising revenue, billed spend, or settlement evidence.' };
  });
}

export async function getPlacementMetrics(): Promise<PlacementMetrics[]> {
  const placements = await listAdPlacements();
  const db = await ensureAdPlacementSchema();
  return placements.map(placement => {
    const stmt = db.prepare(`SELECT
      COALESCE(SUM(CASE WHEN event_type='impression' THEN 1 ELSE 0 END),0) AS impressions,
      COALESCE(SUM(CASE WHEN event_type='click' THEN 1 ELSE 0 END),0) AS clicks,
      COALESCE(SUM(CASE WHEN event_type='impression' AND source='campaign' THEN 1 ELSE 0 END),0) AS campaign_impressions,
      COALESCE(SUM(CASE WHEN event_type='impression' AND source='affiliate' THEN 1 ELSE 0 END),0) AS affiliate_impressions
      FROM ad_placement_events WHERE placement_id=?`);
    stmt.bind([placement.id]);
    const row = stmt.step() ? stmt.getAsObject() as Record<string, unknown> : {};
    stmt.free();
    return { placementId: placement.id, impressions: Number(row.impressions || 0), clicks: Number(row.clicks || 0), campaignImpressions: Number(row.campaign_impressions || 0), affiliateImpressions: Number(row.affiliate_impressions || 0), boundary: 'Counts are deduplicated placement-event evidence. They are not provider viewability certification, conversions, billed spend, advertising revenue, or settlement.' };
  });
}

export async function seedDemoAdCampaigns(): Promise<void> {
  const db = await ensureAdPlacementSchema();
  const existing = db.exec('SELECT count(*) FROM ad_campaigns');
  if (existing[0].values[0][0] === 0) {
    db.run(`INSERT INTO ad_campaigns (title, desc, image_url, target_keyword, target_categories_json, credits_budget, placement_source, disclosure, status) VALUES
      ('Kurukoo discovery placement preview', 'Illustrative Kurukoo-sponsored placement. It is not a provider verification, live stock or delivery claim.', '', 'preview', '[]', 0, 'kurukoo_sponsored', 'Kurukoo-sponsored preview', 'inactive')`);
    saveDb();
  }
}
