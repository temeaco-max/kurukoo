import { getDb, saveDb } from '../database.js';
import { getProfile, updateProfile } from './memoryProfile.js';
import { addCredits } from './pointsEngine.js';

const QR_CONTEXTS = new Set(['referral', 'contributor', 'network', 'offer', 'product', 'location', 'channel', 'continue', 'public']);
const CHANNELS = new Set(['whatsapp', 'telegram', 'sms', 'ussd', 'web']);

export async function generateReferralCode(phone: string): Promise<string> {
    const profile = await getProfile(phone);
    if (profile && profile.preferences && profile.preferences.referral_code) {
        return profile.preferences.referral_code;
    }
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    if (profile) {
        const prefs = { ...profile.preferences, referral_code: code };
        await updateProfile(phone, 'system', { preferences: prefs });
    }
    return code;
}

export async function findReferrerByCode(code: string): Promise<string | null> {
    const db = await getDb();
    const { decryptData } = await import('./memoryProfile.js');
    const stmt = db.prepare(`SELECT phone, preferences FROM memory_profiles`);
    let referrerPhone: string | null = null;
    while (stmt.step()) {
        const obj = stmt.getAsObject();
        if (obj.preferences) {
            try {
                const decrypted = decryptData(obj.preferences as string);
                const prefs = JSON.parse(decrypted);
                if (prefs.referral_code === code) { referrerPhone = obj.phone as string; break; }
            } catch (_) {}
        }
    }
    stmt.free();
    return referrerPhone;
}

export async function trackReferral(referrerPhone: string, referredPhone: string, referralCode: string): Promise<void> {
    const db = await getDb();
    db.run(`INSERT OR IGNORE INTO referrals (referrer_phone, referred_phone, referral_code, status, created_at) VALUES (?, ?, ?, 'registered', CURRENT_TIMESTAMP)`, [referrerPhone, referredPhone, referralCode]);
    saveDb();
}

export async function claimReferral(referredPhone: string): Promise<boolean> {
    const db = await getDb();
    const stmt = db.prepare(`SELECT * FROM referrals WHERE referred_phone = ? AND status = 'registered'`);
    stmt.bind([referredPhone]);
    const referral = stmt.getAsObject();
    stmt.free();
    if (referral && referral.referrer_phone) {
        db.run(`UPDATE referrals SET status = 'subscribed' WHERE referred_phone = ?`, [referredPhone]);
        await addCredits(referral.referrer_phone as string, 200, `Referral reward for subscription of ${referredPhone}`);
        saveDb();
        return true;
    }
    return false;
}

export async function awardShareReward(phone: string): Promise<boolean> {
    const profile = await getProfile(phone);
    if (!profile) return false;
    const prefs = profile.preferences || {};
    if (prefs.referral_shared) return false;
    prefs.referral_shared = true;
    await updateProfile(phone, 'system', { preferences: prefs });
    await addCredits(phone, 10, `Referral sharing with contacts bonus`);
    return true;
}

export async function getReferralStats(phone: string): Promise<{ totalReferrals: number, totalPointsEarned: number, successfulReferrals: number }> {
    const db = await getDb();
    const stmtTotal = db.prepare(`SELECT COUNT(*) as count FROM referrals WHERE referrer_phone = ?`);
    stmtTotal.bind([phone]);
    let totalReferrals = 0;
    if (stmtTotal.step()) totalReferrals = stmtTotal.getAsObject().count as number;
    stmtTotal.free();
    const stmtSub = db.prepare(`SELECT COUNT(*) as count FROM referrals WHERE referrer_phone = ? AND status = 'subscribed'`);
    stmtSub.bind([phone]);
    let successfulReferrals = 0;
    if (stmtSub.step()) successfulReferrals = stmtSub.getAsObject().count as number;
    stmtSub.free();
    return { totalReferrals, totalPointsEarned: successfulReferrals * 200, successfulReferrals };
}

/** Build a QR-safe Kurukoo entry URL. No credentials or personal data are encoded. */
export function buildQrContextUrl(baseUrl: string, options: {
    context?: string;
    referralCode?: string;
    source?: string;
    entity?: string;
    capability?: string;
    channel?: string;
} = {}): string {
    const url = new URL('/start', baseUrl);
    const context = QR_CONTEXTS.has(options.context || '') ? options.context! : 'public';
    url.searchParams.set('context', context);
    if (options.referralCode) url.searchParams.set('ref', options.referralCode.slice(0, 64).toUpperCase());
    if (options.source) url.searchParams.set('source', options.source.slice(0, 128));
    if (options.entity) url.searchParams.set('entity', options.entity.slice(0, 128));
    if (options.capability) url.searchParams.set('capability', options.capability.slice(0, 128));
    if (options.channel && CHANNELS.has(options.channel.toLowerCase())) url.searchParams.set('channel', options.channel.toLowerCase());
    return url.toString();
}
