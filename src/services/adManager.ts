import { getDb, saveDb } from '../database.js';

export type AdPlacementSource = 'kurukoo_sponsored' | 'external_inventory';

export interface AdCampaign {
    id: number;
    title: string;
    desc: string;
    imageUrl: string;
    targetKeyword: string;
    creditsBudget: number;
    creditsSpent: number;
    status: string;
    placementSource: AdPlacementSource;
    disclosure: string;
    createdAt: string;
    updatedAt: string;
}

export type CreateAdCampaign = Omit<AdCampaign, 'id' | 'creditsSpent' | 'status' | 'createdAt' | 'updatedAt' | 'placementSource' | 'disclosure'> & Partial<Pick<AdCampaign, 'placementSource' | 'disclosure'>>;

function normalizeCampaign(campaign: Partial<AdCampaign>): AdCampaign {
    const placementSource: AdPlacementSource = campaign.placementSource === 'kurukoo_sponsored' ? 'kurukoo_sponsored' : 'external_inventory';
    const disclosure = String(campaign.disclosure || (placementSource === 'kurukoo_sponsored' ? 'Kurukoo-sponsored' : 'External advertisement')).slice(0, 120);
    return { ...campaign, placementSource, disclosure } as AdCampaign;
}

export async function getAdCampaigns(): Promise<AdCampaign[]> {
    const db = await getDb();
    const rows = db.exec(`SELECT * FROM ad_campaigns`);
    if (rows.length === 0) return [];

    const campaigns: AdCampaign[] = [];
    const columns = rows[0].columns;
    for (const values of rows[0].values) {
        const campaign: any = {};
        columns.forEach((col: string, idx: number) => {
            const camelKey = col.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            campaign[camelKey] = values[idx];
        });
        campaigns.push(normalizeCampaign(campaign));
    }
    return campaigns;
}

export async function createAdCampaign(campaign: CreateAdCampaign): Promise<any> {
    const db = await getDb();
    const normalized = normalizeCampaign(campaign);
    db.run(
        `INSERT INTO ad_campaigns (title, desc, image_url, target_keyword, credits_budget, placement_source, disclosure) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [normalized.title, normalized.desc, normalized.imageUrl, normalized.targetKeyword, normalized.creditsBudget, normalized.placementSource, normalized.disclosure]
    );
    saveDb();
    return { success: true, message: 'Ad campaign created successfully' };
}

export async function spendAdCampaign(id: number, cost: number = 2): Promise<boolean> {
    const db = await getDb();
    const campaignRows = db.exec(`SELECT credits_budget, credits_spent FROM ad_campaigns WHERE id = ?`, [id]);
    if (campaignRows.length === 0) return false;

    const [budget, spent] = campaignRows[0].values[0];
    const newSpent = spent + cost;

    if (newSpent >= budget) {
        db.run(`UPDATE ad_campaigns SET credits_spent = ?, status = 'completed' WHERE id = ?`, [budget, id]);
    } else {
        db.run(`UPDATE ad_campaigns SET credits_spent = ? WHERE id = ?`, [newSpent, id]);
    }
    saveDb();
    return true;
}

export async function matchAdCampaigns(query: string): Promise<AdCampaign[]> {
    const db = await getDb();
    const allCampaigns = await getAdCampaigns();
    const cleanQuery = query.toLowerCase();

    // Return active campaigns whose keywords are found in the query
    const matched = allCampaigns.filter(c => {
        if (c.status !== 'active') return false;
        const kw = c.targetKeyword.toLowerCase().trim();
        return kw && cleanQuery.includes(kw);
    });

    return matched;
}

export async function seedDemoAdCampaigns(): Promise<void> {
    const db = await getDb();
    const existing = db.exec(`SELECT count(*) FROM ad_campaigns`);
    if (existing[0].values[0][0] === 0) {
        db.run(`
            INSERT INTO ad_campaigns (title, desc, image_url, target_keyword, credits_budget, placement_source, disclosure, status) VALUES
            ('Kurukoo discovery placement preview', 'Illustrative Kurukoo-sponsored placement. It is not a provider verification, live stock or delivery claim.', '', 'preview', 0, 'kurukoo_sponsored', 'Kurukoo-sponsored preview', 'inactive')
        `);
        saveDb();
        console.log('Demo ad campaigns seeded successfully');
    }
}
