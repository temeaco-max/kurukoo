import { getDb, saveDb } from '../database.js';
import { sendFcmPush } from './pushNotifications.js';
import { addPoints as addCredits } from './pointsEngine.js';
import { getIntentions } from './deferredRequestService.js';

/*
 * Proactive Opportunity Engine (§21.3, §33)
 * Score formula:
 * score = (user_need_match * 0.4) + (urgency * 0.3) + (recency * 0.2) + (business_value * 0.1)
 */

export interface Opportunity {
    id?: number;
    phone: string;
    type: 'job' | 'market_intel' | 'daily_pick' | 'reward';
    title: string;
    subtitle: string;
    ctaText: string;
    ctaLink: string;
    urgency: number;
    businessValue: number;
    score?: number;
    status: 'sent' | 'viewed' | 'acted' | 'dismissed';
    createdAt?: string;
    updatedAt?: string;
}

export async function initOpportunityTable() {
    const db = await getDb();
    db.run(`
        CREATE TABLE IF NOT EXISTS proactive_opportunities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT,
            type TEXT,
            title TEXT,
            subtitle TEXT,
            cta_text TEXT,
            cta_link TEXT,
            urgency REAL DEFAULT 0.5,
            business_value REAL DEFAULT 0.5,
            status TEXT DEFAULT 'sent',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    `);
    saveDb();
}

/**
 * Generate, rank, and store personalized opportunities for a user
 */
export async function generateProactiveOpportunities(phone: string): Promise<Opportunity[]> {
    await initOpportunityTable();
    const db = await getDb();

    // 1. Retrieve user details
    const userStmt = db.prepare(`SELECT * FROM memory_profiles WHERE phone = ?`);
    userStmt.bind([phone]);
    let userProfile: any = null;
    if (userStmt.step()) {
        userProfile = userStmt.getAsObject();
    }
    userStmt.free();

    if (!userProfile) return [];

    const userState = userProfile.primary_state || 'Lagos';
    const userLga = userProfile.primary_lga || 'Ikeja';

    // 2. Fetch user's registered skills
    const skills: string[] = [];
    const skillsStmt = db.prepare(`SELECT skill FROM skills WHERE phone = ?`);
    skillsStmt.bind([phone]);
    while (skillsStmt.step()) {
        skills.push(String(skillsStmt.getAsObject().skill).toLowerCase());
    }
    skillsStmt.free();

    // 3. Fetch user's open intentions
    const openIntentions = await getIntentions(phone);
    const activeOpenIntentions = openIntentions.filter((i: any) => i.status === 'open' || i.status === 'awaiting_match');

    // 4. Build list of potential opportunities
    const rawOpportunities: Omit<Opportunity, 'status'>[] = [];

    // --- Type A: Engagement Reward (Engagement) ---
    rawOpportunities.push({
        phone,
        type: 'reward',
        title: 'Daily Engagement Bonus',
        subtitle: 'You have been active! Claim your +1 Point daily bonus now.',
        ctaText: 'Claim Bonus',
        ctaLink: '/api/opportunities/act',
        urgency: 1.0, // Same-day
        businessValue: 0.5 // Engagement
    });

    // --- Type B: Skill Demand Alerts (if user has skills) ---
    for (const skill of skills) {
        rawOpportunities.push({
            phone,
            type: 'job',
            title: `High Skill Demand: ${skill.charAt(0).toUpperCase() + skill.slice(1)}`,
            subtitle: `Multiple people near ${userLga} need a ${skill} this week. Toggle Go Live to get matched!`,
            ctaText: 'Go Live Now',
            ctaLink: '/api/pulse/activate',
            urgency: 0.8,
            businessValue: 0.8 // Lead-gen value
        });
    }

    // --- Type C: Open Intention follow-ups / Re-order suggestions ---
    for (const intention of activeOpenIntentions) {
        rawOpportunities.push({
            phone,
            type: 'market_intel',
            title: `Follow-up: ${intention.intent}`,
            subtitle: `Still looking for assistance with "${intention.intent}"? Tap to notify nearby verified providers.`,
            ctaText: 'Check Providers',
            ctaLink: '/explore',
            urgency: 1.0, // Urgent follow-up
            businessValue: 0.6
        });
    }

    // --- Type D: Market Intelligence based on location ---
    if (userState.toLowerCase() === 'lagos') {
        rawOpportunities.push({
            phone,
            type: 'market_intel',
            title: 'Lagos Rice Supply Alert',
            subtitle: 'Ask Web Chat about verified market information and available wholesale providers in your area.',
            ctaText: 'Ask in Web Chat',
            ctaLink: '/chat?prompt=Show%20verified%20wholesale%20options%20near%20me',
            urgency: 0.5,
            businessValue: 0.7
        });
    } else {
        rawOpportunities.push({
            phone,
            type: 'market_intel',
            title: 'Direct Wholesale Sourcing',
            subtitle: 'Direct-from-farm tubers of Yam and Palm Oil discounts available this week for your local area.',
            ctaText: 'View Wholesale Gigs',
            ctaLink: '/explore',
            urgency: 0.5,
            businessValue: 0.7
        });
    }

    // --- Type E: Sponsored Daily Picks (Ad campaigns) ---
    const adsStmt = db.prepare(`SELECT * FROM ad_campaigns WHERE status = 'active' LIMIT 2`);
    let adCount = 0;
    while (adsStmt.step()) {
        const ad = adsStmt.getAsObject();
        rawOpportunities.push({
            phone,
            type: 'daily_pick',
            title: ad.title as string,
            subtitle: ad.desc as string,
            ctaText: 'Ask in Web Chat',
            ctaLink: `/chat?prompt=${encodeURIComponent(`I am interested in ${String(ad.title || 'this offer')}`)}`,
            urgency: 0.5,
            businessValue: 1.0 // High revenue sponsored ad
        });
        adCount++;
    }
    adsStmt.free();

    // Fallback static daily picks if no active campaigns
    if (adCount === 0) {
        rawOpportunities.push({
            phone,
            type: 'daily_pick',
            title: 'Ask about local essentials',
            subtitle: 'Use Web Chat to ask about verified products and fulfilment options when supporting data is available.',
            ctaText: 'Ask in Web Chat',
            ctaLink: '/chat?prompt=Help%20me%20find%20verified%20local%20essentials',
            urgency: 0.5,
            businessValue: 1.0
        });
    }

    // 5. Score opportunities using the formula:
    // score = (user_need_match * 0.4) + (urgency * 0.3) + (recency * 0.2) + (business_value * 0.1)
    const rankedOpportunities: Opportunity[] = [];

    for (const opp of rawOpportunities) {
        // Evaluate user_need_match
        let userNeedMatch = 0.3; // Default/General
        if (opp.type === 'reward') {
            userNeedMatch = 0.6; // High engagement matching
        } else if (opp.type === 'job') {
            userNeedMatch = 1.0; // Perfect matching registered skill!
        } else if (opp.type === 'market_intel' && opp.title.startsWith('Follow-up:')) {
            userNeedMatch = 1.0; // Perfect match for active open intention!
        }

        // Evaluate recency decay: query how many times an opportunity with this title has been sent before
        const recencyStmt = db.prepare(`SELECT COUNT(*) as cnt FROM proactive_opportunities WHERE phone = ? AND title = ?`);
        recencyStmt.bind([phone, opp.title]);
        let sentCount = 0;
        if (recencyStmt.step()) {
            sentCount = Number(recencyStmt.getAsObject().cnt);
        }
        recencyStmt.free();

        const recency = Math.max(0.1, 1.0 - sentCount * 0.1);

        // Calculate final score
        const score = (userNeedMatch * 0.4) + (opp.urgency * 0.3) + (recency * 0.2) + (opp.businessValue * 0.1);

        rankedOpportunities.push({
            ...opp,
            score,
            status: 'sent'
        });
    }

    // Sort descending by score
    rankedOpportunities.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Keep top 3 ranked opportunities for the day
    const topThree = rankedOpportunities.slice(0, 3);

    // Save top three to proactive_opportunities table
    const now = new Date().toISOString();
    for (const opp of topThree) {
        db.run(`
            INSERT INTO proactive_opportunities (phone, type, title, subtitle, cta_text, cta_link, urgency, business_value, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'sent', ?, ?)
        `, [opp.phone, opp.type, opp.title, opp.subtitle, opp.ctaText, opp.ctaLink, opp.urgency, opp.businessValue, now, now]);
    }
    saveDb();

    // Send push notification for the highest scored opportunity if not throttled
    // Throttle check: Max 1 push notification per 6 hours
    const throttleStmt = db.prepare(`
        SELECT COUNT(*) as cnt FROM proactive_opportunities 
        WHERE phone = ? AND status = 'sent' AND created_at > datetime('now', '-6 hours')
    `);
    let recentSentCount = 0;
    if (throttleStmt.step()) {
        recentSentCount = Number(throttleStmt.getAsObject().cnt);
    }
    throttleStmt.free();

    if (recentSentCount <= 1 && topThree.length > 0) {
        const topOpp = topThree[0];
        await sendFcmPush(phone, topOpp.title, topOpp.subtitle);
    }

    return topThree;
}

/**
 * Fetch all opportunities for a user's feed
 */
export async function getOpportunitiesForFeed(phone: string): Promise<any[]> {
    await initOpportunityTable();
    const db = await getDb();

    const stmt = db.prepare(`
        SELECT * FROM proactive_opportunities 
        WHERE phone = ? AND status != 'dismissed'
        ORDER BY created_at DESC LIMIT 15
    `);
    const results: any[] = [];
    while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push({
            id: row.id,
            phone: row.phone,
            type: row.type,
            title: row.title,
            subtitle: row.subtitle,
            ctaText: row.cta_text,
            ctaLink: row.cta_link,
            urgency: row.urgency,
            businessValue: row.business_value,
            status: row.status,
            createdAt: row.created_at
        });
    }
    stmt.free();

    // If feed is empty, dynamically pre-populate and return top opportunities
    if (results.length === 0) {
        const generated = await generateProactiveOpportunities(phone);
        return generated;
    }

    return results;
}

/**
 * Perform action on a specific opportunity card
 */
export async function actOnOpportunity(id: number, phone: string): Promise<{ success: boolean; message: string }> {
    await initOpportunityTable();
    const db = await getDb();
    const now = new Date().toISOString();

    // 1. Fetch opportunity details
    const stmt = db.prepare(`SELECT * FROM proactive_opportunities WHERE id = ? AND phone = ?`);
    stmt.bind([id, phone]);
    let opp: any = null;
    if (stmt.step()) {
        opp = stmt.getAsObject();
    }
    stmt.free();

    if (!opp) {
        return { success: false, message: 'Opportunity not found' };
    }

    // 2. Perform type-specific actions
    let actionMessage = 'Action completed successfully!';
    if (opp.type === 'reward' && opp.status !== 'acted') {
        // Trigger +1 Credit reward!
        await addCredits(phone, 1, 'Daily Engagement Reward');
        actionMessage = 'Daily reward claimed! +1 Credit added to your balance.';
    }

    // 3. Update opportunity status to 'acted'
    db.run(`
        UPDATE proactive_opportunities 
        SET status = 'acted', updated_at = ?
        WHERE id = ? AND phone = ?
    `, [now, id, phone]);
    saveDb();

    return { success: true, message: actionMessage };
}

/**
 * Dismiss an opportunity card from feed
 */
export async function dismissOpportunity(id: number, phone: string): Promise<boolean> {
    await initOpportunityTable();
    const db = await getDb();
    const now = new Date().toISOString();

    db.run(`
        UPDATE proactive_opportunities 
        SET status = 'dismissed', updated_at = ?
        WHERE id = ? AND phone = ?
    `, [now, id, phone]);
    saveDb();
    return true;
}
