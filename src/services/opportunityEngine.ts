/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { getDb, saveDb } from '../database.js';
import { sendFcmPush } from './pushNotifications.js';
import { addPoints as addCredits } from './pointsEngine.js';
import { getIntentions } from './deferredRequestService.js';
import { getRenderableCampaigns } from './adManager.js';

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

    const userState = String(userProfile.primary_state || '').trim();
    const userLga = String(userProfile.primary_lga || userProfile.location || '').trim();

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

    // Opportunity alerts are evidence-backed only. No engagement reward or local demand is inferred from a profile alone.
    const demandStmt = db.prepare(`SELECT skill, requirements_json FROM economic_requests WHERE status IN ('requested','awaiting_match','partially_matched','matched','quoting','quoted')`);
    const demandBySkill = new Map<string, number>();
    while (demandStmt.step()) {
        const row = demandStmt.getAsObject() as any;
        let requirements: any = {};
        try { requirements = JSON.parse(String(row.requirements_json || '{}')); } catch { requirements = {}; }
        const requestLocation = String(requirements.location || requirements.area || requirements.lga || '').trim().toLowerCase();
        const locationMatches = !userLga || !requestLocation || requestLocation.includes(userLga.toLowerCase()) || userLga.toLowerCase().includes(requestLocation);
        const requestSkill = String(row.skill || '').trim().toLowerCase();
        if (locationMatches && requestSkill) demandBySkill.set(requestSkill, (demandBySkill.get(requestSkill) || 0) + 1);
    }
    demandStmt.free();
    for (const skill of skills) {
        const demandCount = demandBySkill.get(skill) || 0;
        if (!demandCount) continue;
        rawOpportunities.push({
            phone,
            type: 'job',
            title: `Recorded request${demandCount === 1 ? '' : 's'} for ${skill.charAt(0).toUpperCase() + skill.slice(1)}`,
            subtitle: `Recorded demand: ${demandCount} open Economic Request${demandCount === 1 ? '' : 's'} currently match this capability${userLga ? ` near ${userLga}` : ''}. Availability and matching still require explicit provider action.`,
            ctaText: 'Review in Chat',
            ctaLink: `/chat?prompt=${encodeURIComponent(`Review recorded ${skill} requests`)}`,
            urgency: 0.8,
            businessValue: 0.8
        });
    }

    // --- Type C: Open Intention follow-ups / Re-order suggestions ---
    for (const intention of activeOpenIntentions) {
        const continuationId = intention.economic_request_id ? String(intention.economic_request_id) : String(intention.id);
        const prompt = `Continue with my ${String(intention.skill || intention.intent || 'request')} request`;
        const continuationParams = new URLSearchParams({ prompt });
        if (intention.economic_request_id) {
            continuationParams.set('contextId', `economic_request:${continuationId}`);
            continuationParams.set('action', 'review');
            continuationParams.set('canonicalAction', 'economic_request.open');
            continuationParams.set('objectType', 'economic_request');
            continuationParams.set('objectId', continuationId);
        } else {
            continuationParams.set('requestId', continuationId);
        }
        rawOpportunities.push({
            phone,
            type: 'market_intel',
            title: `Follow-up: ${intention.intent}`,
            subtitle: `Still looking for assistance with "${intention.intent}"? Continue in Chat to review the supported next step.`,
            ctaText: 'Continue in Chat',
            ctaLink: `/chat?${continuationParams.toString()}`,
            urgency: 1.0, // Urgent follow-up
            businessValue: 0.6
        });
    }

    // --- Type D: Sponsored Daily Picks (Ad campaigns) ---
    const ads = await getRenderableCampaigns({ firstParty: true, limit: 3 });
    let adCount = 0;
    for (const ad of ads) {
        rawOpportunities.push({
            phone,
            type: 'daily_pick',
            title: ad.title as string,
            subtitle: `${String(ad.disclosure || 'Sponsored').trim()} · ${String(ad.desc || '')}`,
            ctaText: String(ad.ctaText || 'Learn more'),
            ctaLink: String(ad.destination || '/chat'),
            urgency: 0.5,
            businessValue: 1.0 // High revenue sponsored ad
        });
        adCount++;
    }

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
        const existing = db.exec(`SELECT id FROM proactive_opportunities WHERE phone = ? AND type = ? AND title = ? AND status != 'dismissed' AND datetime(created_at) > datetime('now', '-24 hours') LIMIT 1`, [opp.phone, opp.type, opp.title]);
        if (existing[0]?.values?.length) continue;
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
        SELECT opportunity.* FROM proactive_opportunities opportunity
        INNER JOIN (
            SELECT phone, type, title, MAX(id) AS latest_id
            FROM proactive_opportunities
            WHERE phone = ? AND status != 'dismissed'
            GROUP BY phone, type, title
        ) latest ON latest.latest_id = opportunity.id
        WHERE opportunity.phone = ? AND opportunity.status != 'dismissed'
        ORDER BY opportunity.created_at DESC LIMIT 15
    `);
    stmt.bind([phone, phone]);
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
            createdAt: row.created_at,
            placeId: (row as any).place_id ? String((row as any).place_id) : null,
            conceptId: (row as any).concept_id ? String((row as any).concept_id) : null
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
    if (opp.status === 'acted') return { success: true, message: 'This opportunity was already opened.' };
    if (opp.type !== 'reward') {
        return { success: true, message: 'This opportunity is ready in Chat. No external action has been claimed.' };
    }

    await addCredits(phone, 1, 'Daily Engagement Reward');
    db.run(`
        UPDATE proactive_opportunities
        SET status = 'acted', updated_at = ?
        WHERE id = ? AND phone = ? AND status != 'acted'
    `, [now, id, phone]);
    saveDb();
    return { success: true, message: 'Daily reward claimed! +1 Credit added to your balance.' };
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
