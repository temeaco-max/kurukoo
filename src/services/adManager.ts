import { getDb, saveDb } from '../database.js';
import { ECONOMIC_CATEGORIES } from './skillFlows.js';

export type AdPlacementSource = 'kurukoo_sponsored' | 'external_inventory';
export type AdCampaignStatus = 'active' | 'paused' | 'completed' | 'inactive';

export interface AdCampaign {
  id: number;
  title: string;
  desc: string;
  imageUrl: string;
  targetKeyword: string;
  targetCategories: string[];
  creditsBudget: number;
  creditsSpent: number;
  status: AdCampaignStatus;
  placementSource: AdPlacementSource;
  disclosure: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateAdCampaign = Omit<AdCampaign, 'id' | 'creditsSpent' | 'status' | 'createdAt' | 'updatedAt' | 'placementSource' | 'disclosure' | 'targetCategories'>
  & Partial<Pick<AdCampaign, 'placementSource' | 'disclosure' | 'targetCategories'>>;

export interface AdMatchContext { category?: string; }

const CATEGORY_SET = new Set<string>(ECONOMIC_CATEGORIES);
const CAMPAIGN_STATUSES = new Set<AdCampaignStatus>(['active', 'paused', 'completed', 'inactive']);

function text(value: unknown, maximum: number): string {
  return String(value || '').trim().slice(0, maximum);
}

function parseCategories(value: unknown): string[] {
  let raw: unknown[] = [];
  if (Array.isArray(value)) raw = value;
  else if (typeof value === 'string' && value.trim()) {
    try { const parsed = JSON.parse(value); raw = Array.isArray(parsed) ? parsed : [value]; }
    catch { raw = value.split(','); }
  }
  return Array.from(new Set(raw.map((item) => text(item, 80).toLowerCase()).filter((item) => CATEGORY_SET.has(item))));
}

function normalizeCampaign(campaign: Partial<AdCampaign> & { targetCategoriesJson?: unknown }): AdCampaign {
  const placementSource: AdPlacementSource = campaign.placementSource === 'kurukoo_sponsored' ? 'kurukoo_sponsored' : 'external_inventory';
  const disclosure = text(campaign.disclosure || (placementSource === 'kurukoo_sponsored' ? 'Kurukoo-sponsored' : 'External advertisement'), 120);
  const status: AdCampaignStatus = CAMPAIGN_STATUSES.has(campaign.status as AdCampaignStatus) ? campaign.status as AdCampaignStatus : 'active';
  return {
    ...campaign,
    id: Number(campaign.id || 0), title: text(campaign.title, 160), desc: text(campaign.desc, 320), imageUrl: text(campaign.imageUrl, 600),
    targetKeyword: text(campaign.targetKeyword, 120), targetCategories: parseCategories(campaign.targetCategories ?? campaign.targetCategoriesJson),
    creditsBudget: Math.max(0, Number(campaign.creditsBudget || 0)), creditsSpent: Math.max(0, Number(campaign.creditsSpent || 0)),
    status, placementSource, disclosure, createdAt: String(campaign.createdAt || ''), updatedAt: String(campaign.updatedAt || ''),
  };
}

function validateCampaign(campaign: AdCampaign): void {
  if (campaign.title.length < 3) throw new Error('Campaign title must contain at least 3 characters');
  if (campaign.desc.length < 3) throw new Error('Campaign description must contain at least 3 characters');
  if (!campaign.targetKeyword && !campaign.targetCategories.length) throw new Error('Provide a target keyword or at least one canonical category');
  if (!Number.isFinite(campaign.creditsBudget) || campaign.creditsBudget < 0) throw new Error('Campaign budget must be a non-negative number');
}

export async function getAdCampaigns(): Promise<AdCampaign[]> {
  const db = await getDb();
  const rows = db.exec('SELECT * FROM ad_campaigns ORDER BY id DESC');
  if (!rows.length) return [];
  const columns = rows[0].columns;
  return rows[0].values.map((values: unknown[]) => {
    const campaign: Record<string, unknown> = {};
    columns.forEach((column: string, index: number) => { campaign[column.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())] = values[index]; });
    return normalizeCampaign(campaign);
  });
}

export async function createAdCampaign(input: CreateAdCampaign): Promise<{ success: true; campaign: AdCampaign }> {
  const db = await getDb();
  const campaign = normalizeCampaign(input);
  validateCampaign(campaign);
  db.run(
    `INSERT INTO ad_campaigns (title, desc, image_url, target_keyword, target_categories_json, credits_budget, placement_source, disclosure, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [campaign.title, campaign.desc, campaign.imageUrl, campaign.targetKeyword, JSON.stringify(campaign.targetCategories), campaign.creditsBudget, campaign.placementSource, campaign.disclosure],
  );
  const id = Number(db.exec('SELECT last_insert_rowid()')[0]?.values?.[0]?.[0] || 0);
  saveDb();
  const created = (await getAdCampaigns()).find((item) => item.id === id);
  return { success: true, campaign: created || { ...campaign, id, status: 'active' } };
}

export async function setAdCampaignStatus(id: number, status: AdCampaignStatus): Promise<AdCampaign | null> {
  if (!CAMPAIGN_STATUSES.has(status)) throw new Error('Invalid campaign status');
  const db = await getDb();
  db.run('UPDATE ad_campaigns SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [status, Number(id)]);
  if (!db.getRowsModified()) return null;
  saveDb();
  return (await getAdCampaigns()).find((campaign) => campaign.id === Number(id)) || null;
}

export async function spendAdCampaign(id: number, cost: number = 2): Promise<boolean> {
  const db = await getDb();
  const result = db.exec('SELECT credits_budget, credits_spent, status FROM ad_campaigns WHERE id = ?', [id]);
  if (!result.length || String(result[0].values[0]?.[2]) !== 'active') return false;
  const [budget, spent] = result[0].values[0];
  const next = Math.min(Number(budget || 0), Number(spent || 0) + Math.max(0, Number(cost || 0)));
  db.run('UPDATE ad_campaigns SET credits_spent=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [next, next >= Number(budget || 0) ? 'completed' : 'active', id]);
  saveDb();
  return true;
}

/**
 * Match only active, disclosed campaigns against existing caller-provided context.
 * Category context must come from an existing canonical skill/Topic taxonomy owner.
 */
export async function matchAdCampaigns(query: string, context: AdMatchContext = {}): Promise<AdCampaign[]> {
  const cleanQuery = text(query, 600).toLowerCase();
  const category = parseCategories([context.category])[0] || '';
  return (await getAdCampaigns()).filter((campaign) => {
    if (campaign.status !== 'active') return false;
    const keywordMatches = Boolean(campaign.targetKeyword && cleanQuery.includes(campaign.targetKeyword.toLowerCase()));
    const categoryMatches = Boolean(category && campaign.targetCategories.includes(category));
    return keywordMatches || categoryMatches;
  });
}

export async function seedDemoAdCampaigns(): Promise<void> {
  const db = await getDb();
  const existing = db.exec('SELECT count(*) FROM ad_campaigns');
  if (existing[0].values[0][0] === 0) {
    db.run(`INSERT INTO ad_campaigns (title, desc, image_url, target_keyword, target_categories_json, credits_budget, placement_source, disclosure, status) VALUES
      ('Kurukoo discovery placement preview', 'Illustrative Kurukoo-sponsored placement. It is not a provider verification, live stock or delivery claim.', '', 'preview', '[]', 0, 'kurukoo_sponsored', 'Kurukoo-sponsored preview', 'inactive')`);
    saveDb();
    console.log('Demo ad campaigns seeded successfully');
  }
}
