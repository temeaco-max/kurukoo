import { getDb, saveDb } from '../database.js';

export interface AdCampaign {
    id: number;
    title: string;
    desc: string;
    imageUrl: string;
    targetKeyword: string;
    creditsBudget: number;
    creditsSpent: number;
    status: string;
    createdAt: string;
    updatedAt: string;
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
        campaigns.push(campaign as AdCampaign);
    }
    return campaigns;
}

export async function createAdCampaign(campaign: Omit<AdCampaign, 'id' | 'creditsSpent' | 'status' | 'createdAt' | 'updatedAt'>): Promise<any> {
    const db = await getDb();
    db.run(
        `INSERT INTO ad_campaigns (title, desc, image_url, target_keyword, credits_budget) VALUES (?, ?, ?, ?, ?)`,
        [campaign.title, campaign.desc, campaign.imageUrl, campaign.targetKeyword, campaign.creditsBudget]
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
            INSERT INTO ad_campaigns (title, desc, image_url, target_keyword, credits_budget) VALUES 
            ('Premium Jasmine Rice (50kg)', 'Get premium quality jasmine rice delivered to your doorstep.', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=400', 'rice', 50),
            ('Swift Okada Riders Ibadan', 'Request Ibadan fast local okada. 10% discount on first ride today.', 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&q=80&w=400', 'ride', 100),
            ('Dugbe Bakers Association', 'Get hot, freshly baked Ibadan soft bread delivered to your area.', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=400', 'bread', 80)
        `);
        saveDb();
        console.log('Demo ad campaigns seeded successfully');
    }
}
