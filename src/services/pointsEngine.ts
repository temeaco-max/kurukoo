/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { getDb, saveDb } from '../database.js';

/**
 * Kurukoo network-unit ledger.
 * Database/API names remain points_* for backwards compatibility.
 */
export const NETWORK_UNIT_LABEL = String(process.env.KURUKOO_UNIT_LABEL || 'Kurukoo Units').trim() || 'Kurukoo Units';
export const NETWORK_UNIT_SYMBOL = String(process.env.KURUKOO_UNIT_SYMBOL || 'KU').trim().slice(0, 8) || 'KU';
export const MAX_GRACE_LEADS = 3;

export const POINTS_AWARDS = {
    DAILY_ENGAGEMENT: 1,
    REFERRAL: 20,
    JOB_COMPLETION_MIN: 1,
    JOB_COMPLETION_MAX: 5,
    STAR_BONUS: 1,
} as const;

export const POINTS_COSTS = {
    RIDE_REQUEST: 1,
    EXTRA_RIDE: 2,
    PULSE_GO_LIVE_BLOCK: 5,
    BOOST_LISTING: 10,
    LIVECAST_SIGNAL: 1,
} as const;

export const LEAD_CHARGES: Record<string, number> = {
    okada: 50, keke: 50, car: 50, taxi: 50, ride: 50,
    bicycle_delivery: 30,
    hawker: 20, street_food: 20, food: 20,
    wheelbarrow: 20, truck_pusher: 20, truck: 20,
    professional: 50,
};

async function isPointsEnabledForUser(db: any, phone: string): Promise<boolean> {
    if (process.env.CREDIT_ECONOMY_ENABLED === 'false') return false;
    const stmt = db.prepare(`SELECT country FROM memory_profiles WHERE phone = ?`);
    stmt.bind([phone]);
    let country = 'ng';
    if (stmt.step()) country = String(stmt.getAsObject().country || 'ng').toLowerCase();
    stmt.free();
    return country === 'ng' || !country;
}

export async function addPoints(phone: string, amount: number, description: string): Promise<void> {
    if (!Number.isInteger(amount) || amount <= 0) throw new Error('Network-unit amount must be a positive integer');
    const db = await getDb();
    if (!(await isPointsEnabledForUser(db, phone))) return;
    db.run('BEGIN TRANSACTION');
    try {
        db.run(`UPDATE memory_profiles SET points_balance = COALESCE(points_balance, 0) + ?, updated_at = CURRENT_TIMESTAMP WHERE phone = ?`, [amount, phone]);
        db.run(`INSERT INTO credit_transactions (phone, amount, type, description) VALUES (?, ?, 'credit', ?)`, [phone, amount, description]);
        db.run('COMMIT');
        saveDb();
    } catch (err) {
        db.run('ROLLBACK');
        console.error('Failed to add network units:', err);
        throw err;
    }
}

export async function deductPoints(phone: string, amount: number, description: string, allowGrace = false): Promise<{ success: boolean; isGrace?: boolean; remainingPoints?: number }> {
    if (!Number.isInteger(amount) || amount <= 0) return { success: false };
    const db = await getDb();
    if (!(await isPointsEnabledForUser(db, phone))) return { success: true, remainingPoints: 0 };
    db.run('BEGIN TRANSACTION');
    try {
        const stmt = db.prepare(`SELECT COALESCE(points_balance, 0) AS points, COALESCE(grace_leads, 0) AS grace_leads FROM memory_profiles WHERE phone = ?`);
        stmt.bind([phone]);
        if (!stmt.step()) {
            stmt.free();
            db.run('ROLLBACK');
            return { success: false };
        }
        const row = stmt.getAsObject() as any;
        const currentPoints = Math.max(0, Number(row.points || 0));
        const graceLeads = Math.max(0, Number(row.grace_leads || 0));
        stmt.free();

        if (currentPoints < amount) {
            if (!allowGrace || graceLeads >= MAX_GRACE_LEADS) {
                db.run('ROLLBACK');
                return { success: false, remainingPoints: currentPoints };
            }
            db.run(`UPDATE memory_profiles SET grace_leads = grace_leads + 1, updated_at = CURRENT_TIMESTAMP WHERE phone = ?`, [phone]);
            db.run(`INSERT INTO credit_transactions (phone, amount, type, description) VALUES (?, ?, 'debit_grace', ?)`, [phone, 0, `${description} [grace:${graceLeads + 1}/${MAX_GRACE_LEADS}]`]);
            db.run('COMMIT');
            saveDb();
            return { success: true, isGrace: true, remainingPoints: currentPoints };
        }

        db.run(`UPDATE memory_profiles SET points_balance = points_balance - ?, updated_at = CURRENT_TIMESTAMP WHERE phone = ? AND COALESCE(points_balance, 0) >= ?`, [amount, phone, amount]);
        db.run(`INSERT INTO credit_transactions (phone, amount, type, description) VALUES (?, ?, 'debit', ?)`, [phone, -amount, description]);
        const verify = db.prepare(`SELECT COALESCE(points_balance, 0) AS points FROM memory_profiles WHERE phone = ?`);
        verify.bind([phone]);
        const remaining = verify.step() ? Math.max(0, Number(verify.getAsObject().points || 0)) : 0;
        verify.free();
        db.run('COMMIT');
        saveDb();
        return { success: true, remainingPoints: remaining };
    } catch (err) {
        db.run('ROLLBACK');
        console.error('Failed to deduct network units:', err);
        return { success: false };
    }
}

export async function getPointsBalance(phone: string): Promise<number> {
    const db = await getDb();
    if (!(await isPointsEnabledForUser(db, phone))) return 0;
    const stmt = db.prepare(`SELECT COALESCE(points_balance, 0) AS points FROM memory_profiles WHERE phone = ?`);
    stmt.bind([phone]);
    let points = 0;
    if (stmt.step()) points = Math.max(0, Number(stmt.getAsObject().points || 0));
    stmt.free();
    return points;
}

export async function getPointsHistory(phone: string, limit = 50): Promise<unknown[]> {
    const db = await getDb();
    if (!(await isPointsEnabledForUser(db, phone))) return [];
    const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
    const stmt = db.prepare(`SELECT * FROM credit_transactions WHERE phone = ? ORDER BY id DESC LIMIT ?`);
    stmt.bind([phone, safeLimit]);
    const rows: unknown[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
}

export async function spendPoints(phone: string, amount: number, feature: string): Promise<{ success: boolean; remainingPoints?: number }> {
    const res = await deductPoints(phone, amount, `Spend: ${feature}`, false);
    return { success: res.success, remainingPoints: res.remainingPoints };
}

export async function awardDailyEngagement(phone: string): Promise<void> { await addPoints(phone, POINTS_AWARDS.DAILY_ENGAGEMENT, 'Daily network participation bonus'); }
export async function awardReferral(phone: string): Promise<void> { await addPoints(phone, POINTS_AWARDS.REFERRAL, 'Referral reward (new subscriber)'); }
export async function awardJobCompletion(phone: string, rating = 5, eventMarker?: string): Promise<void> {
    const clamped = Math.max(POINTS_AWARDS.JOB_COMPLETION_MIN, Math.min(POINTS_AWARDS.JOB_COMPLETION_MAX, Math.round(rating)));
    const normalizedMarker = String(eventMarker || '').trim().slice(0, 160);
    if (normalizedMarker) {
        const db = await getDb();
        if (!(await isPointsEnabledForUser(db, phone))) return;
        const escapedMarker = normalizedMarker.replace(/[\\%_]/g, '\\$&');
        const stmt = db.prepare(`SELECT 1 FROM credit_transactions WHERE phone = ? AND type = 'credit' AND description LIKE ? ESCAPE '\\' LIMIT 1`);
        stmt.bind([phone, `%[${escapedMarker}]%`]);
        const alreadyAwarded = stmt.step();
        stmt.free();
        if (alreadyAwarded) return;
    }
    const marker = normalizedMarker ? ` [${normalizedMarker}]` : '';
    await addPoints(phone, clamped, `Job completion bonus (${clamped})${marker}`);
}
export async function awardStarBonus(phone: string): Promise<void> { await addPoints(phone, POINTS_AWARDS.STAR_BONUS, '5-star rating bonus'); }

export async function reversePointsForMarker(phone: string, eventMarker: string, reason: string): Promise<{ reversed: boolean; amount: number }> {
    const normalizedMarker = String(eventMarker || '').trim().slice(0, 160);
    if (!normalizedMarker) return { reversed: false, amount: 0 };
    const db = await getDb();
    if (!(await isPointsEnabledForUser(db, phone))) return { reversed: false, amount: 0 };
    const escapedMarker = normalizedMarker.replace(/[\\%_]/g, '\\$&');
    db.run('BEGIN TRANSACTION');
    try {
        const creditStmt = db.prepare(`SELECT id, amount FROM credit_transactions WHERE phone = ? AND type = 'credit' AND description LIKE ? ESCAPE '\\' ORDER BY id DESC LIMIT 1`);
        creditStmt.bind([phone, `%[${normalizedMarker}]%`]);
        if (!creditStmt.step()) {
            creditStmt.free();
            db.run('ROLLBACK');
            return { reversed: false, amount: 0 };
        }
        const credit = creditStmt.getAsObject() as any;
        creditStmt.free();
        const creditAmount = Math.abs(Number(credit.amount || 0));
        if (creditAmount <= 0) {
            db.run('ROLLBACK');
            return { reversed: false, amount: 0 };
        }
        const reversalStmt = db.prepare(`SELECT 1 FROM credit_transactions WHERE phone = ? AND type = 'debit' AND description LIKE ? ESCAPE '\\' LIMIT 1`);
        reversalStmt.bind([phone, `%[reversal:${escapedMarker}]%`]);
        const alreadyReversed = reversalStmt.step();
        reversalStmt.free();
        if (alreadyReversed) {
            db.run('ROLLBACK');
            return { reversed: false, amount: 0 };
        }
        const balStmt = db.prepare(`SELECT COALESCE(points_balance, 0) AS points FROM memory_profiles WHERE phone = ?`);
        balStmt.bind([phone]);
        const balance = balStmt.step() ? Math.max(0, Number((balStmt.getAsObject() as any).points || 0)) : 0;
        balStmt.free();
        const recovered = Math.min(creditAmount, balance);
        db.run(`UPDATE memory_profiles SET points_balance = MAX(COALESCE(points_balance, 0) - ?, 0), updated_at = CURRENT_TIMESTAMP WHERE phone = ?`, [recovered, phone]);
        db.run(`INSERT INTO credit_transactions (phone, amount, type, description) VALUES (?, ?, 'debit', ?)`, [phone, -recovered, `${reason} [reversal:${normalizedMarker}]`]);
        db.run('COMMIT');
        saveDb();
        return { reversed: true, amount: recovered };
    } catch (err) {
        db.run('ROLLBACK');
        console.error('Failed to reverse network units:', err);
        return { reversed: false, amount: 0 };
    }
}

export async function getPointsLeaderboard(limit = 10): Promise<unknown[]> {
    const db = await getDb();
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const stmt = db.prepare(`SELECT phone, name, COALESCE(points_balance, 0) AS points, subscription_tier FROM memory_profiles WHERE lower(COALESCE(country, 'ng')) = 'ng' ORDER BY points_balance DESC LIMIT ?`);
    stmt.bind([safeLimit]);
    const rows: unknown[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
}

export const addCredits = addPoints;
export const deductCredits = async (phone: string, amount: number, description: string): Promise<boolean> => (await deductPoints(phone, amount, description)).success;

export function getPointsLabel(): string { return NETWORK_UNIT_LABEL; }
export function getPointsSymbol(): string { return NETWORK_UNIT_SYMBOL; }
