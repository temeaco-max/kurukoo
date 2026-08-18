import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';
import { deductCredits } from './pointsEngine.js';

/* Internal matching may use exact coordinates explicitly supplied by an authenticated provider.
 * Public Pulse surfaces must use fuzzed coordinates and must never expose phone identifiers. */
export interface ActivePulseProvider {
    phone: string;
    skill: string;
    lat: number;
    lng: number;
    name: string;
    location?: string;
    subscription_tier?: string;
    source: 'mobile' | 'stationary';
}

export interface PublicPulseProvider extends Omit<ActivePulseProvider, 'lat' | 'lng' | 'phone'> {
    id: string;
    lat: number;
    lng: number;
    location_radius_m: number;
    verified: true;
    live_now: true;
}

export async function canActivatePulse(phone: string, skill?: string): Promise<boolean> {
    const db = await getDb();
    const stmt = db.prepare(skill
        ? `SELECT operation_mode, is_available FROM skills WHERE phone = ? AND skill = ? LIMIT 1`
        : `SELECT operation_mode, is_available FROM skills WHERE phone = ?`);
    stmt.bind(skill ? [phone, skill] : [phone]);
    let eligible = false;
    while (stmt.step()) {
        const row = stmt.getAsObject() as Record<string, unknown>;
        if (row.operation_mode === 'mobile' && Number(row.is_available ?? 1) === 1) { eligible = true; break; }
    }
    stmt.free();
    return eligible;
}

export interface PulseReadiness {
    radarDefaultOn: boolean;
    active: boolean;
    eligibleToBroadcast: boolean;
    role: 'provider' | 'user';
    activeSkills?: string[];
    nudge?: string;
}

export async function getPulseReadiness(phone: string): Promise<PulseReadiness> {
    const db = await getDb();
    const profileStmt = db.prepare(`SELECT verified_provider, is_available FROM memory_profiles WHERE phone = ? LIMIT 1`);
    profileStmt.bind([phone]);
    let verifiedProvider = false;
    let available = false;
    if (profileStmt.step()) {
        const profile = profileStmt.getAsObject() as Record<string, unknown>;
        verifiedProvider = Number(profile.verified_provider || 0) === 1;
        available = Number(profile.is_available || 0) === 1;
    }
    profileStmt.free();
    const activeProviders = await getActivePulseProviders();
    const activeSkills = activeProviders.filter(provider => provider.phone === phone).map(provider => provider.skill);
    const eligibleToBroadcast = verifiedProvider && available && await canActivatePulse(phone);
    return {
        radarDefaultOn: true,
        active: activeSkills.length > 0,
        eligibleToBroadcast,
        role: verifiedProvider ? 'provider' : 'user',
        activeSkills,
        nudge: activeSkills.length
            ? `You are live on Nearby Pulse for ${activeSkills.join(', ')}. Kurukoo keeps your public location fuzzed and each capability's availability separate.`
            : eligibleToBroadcast
                ? 'Nearby Radar is ready. Go Live only for the skill you want nearby people to discover.'
                : 'Nearby Radar is ready for local discovery. Complete provider verification and capability setup before broadcasting yourself.',
    };
}

export async function activatePulse(phone: string, skill: string, lat: number, lng: number): Promise<{ success: boolean; message: string }> {
    const normalizedSkill = String(skill || '').trim().slice(0, 120);
    if (!normalizedSkill) return { success: false, message: 'A service skill is required before going live.' };
    if (!await canActivatePulse(phone, normalizedSkill)) return { success: false, message: `Cannot Go Live for ${normalizedSkill}. That skill is not registered as a mobile, available capability.` };
    const latitude = Number(lat); const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return { success: false, message: 'Nearby Pulse needs an explicit valid location before it can be activated. No location was inferred.' };
    }
    const db = await getDb();
    const profileStmt = db.prepare(`SELECT subscription_tier, verified_provider, is_available FROM memory_profiles WHERE phone = ?`);
    profileStmt.bind([phone]);
    let tier = 'Base'; let verifiedProvider = false; let available = false;
    if (profileStmt.step()) {
        const profile = profileStmt.getAsObject() as Record<string, unknown>;
        tier = String(profile.subscription_tier || 'Base');
        verifiedProvider = Number(profile.verified_provider || 0) === 1;
        available = Number(profile.is_available || 0) === 1;
    }
    profileStmt.free();
    if (!verifiedProvider || !available) return { success: false, message: 'Nearby Pulse requires an approved provider profile that is currently available.' };
    if (tier === 'Base') {
        const countStmt = db.prepare(`SELECT COUNT(*) as cnt FROM pulse_sessions WHERE phone = ? AND created_at >= datetime('now', '-30 days')`);
        countStmt.bind([phone]);
        const sessionCount = countStmt.step() ? Number(countStmt.getAsObject().cnt || 0) : 0;
        countStmt.free();
        if (sessionCount >= 10) return { success: false, message: 'Nearby Pulse monthly limit reached. Base tier is limited to 5 hours (10 sessions) per month. Upgrade to Plus or Business for unlimited access.' };
    }
    if (!await deductCredits(phone, 5, `Nearby Pulse "Go Live" for ${normalizedSkill} (30 min)`)) return { success: false, message: 'Insufficient credits for Nearby Pulse (requires 5 credits).' };
    /* Multi-skilled people may be live in several capabilities at once. Replacing
       only the same skill prevents a barber session from disabling delivery work. */
    db.run(`UPDATE pulse_sessions SET active = 0 WHERE phone = ? AND skill = ?`, [phone, normalizedSkill]);
    db.run(`INSERT INTO pulse_sessions (phone, skill, lat, lng, expires_at, active) VALUES (?, ?, ?, ?, datetime('now', '+30 minutes'), 1)`, [phone, normalizedSkill, latitude, longitude]);
    saveDb();
    return { success: true, message: `${normalizedSkill} is live on Nearby Pulse for 30 minutes. Public discovery is fuzzed; matching and any external contact remain separate, evidence-backed steps.` };
}

export async function endPulseSession(phone: string, skill?: string): Promise<void> {
    const db = await getDb();
    if (skill) db.run(`UPDATE pulse_sessions SET active = 0 WHERE phone = ? AND skill = ? AND active = 1`, [phone, skill]);
    else db.run(`UPDATE pulse_sessions SET active = 0 WHERE phone = ? AND active = 1`, [phone]);
    saveDb();
}

export async function getActivePulseProviders(): Promise<ActivePulseProvider[]> {
    const db = await getDb();
    const stmt = db.prepare(`
        SELECT p.phone, p.skill, p.lat, p.lng, m.name, m.location, m.subscription_tier, 'mobile' as source
        FROM pulse_sessions p JOIN memory_profiles m ON p.phone = m.phone
        WHERE p.active = 1 AND p.expires_at > datetime('now') AND m.verified_provider = 1 AND m.is_available = 1
        UNION ALL
        SELECT pr.phone, s.skill, pr.last_lat as lat, pr.last_lng as lng, m.name, m.location, m.subscription_tier, 'stationary' as source
        FROM provider_presence pr JOIN memory_profiles m ON pr.phone = m.phone JOIN skills s ON pr.phone = s.phone
        WHERE pr.is_live = 1 AND pr.operation_mode = 'stationary' AND m.verified_provider = 1 AND m.is_available = 1
    `);
    const results: ActivePulseProvider[] = [];
    while (stmt.step()) {
        const row = stmt.getAsObject() as Record<string, unknown>;
        const lat = Number(row.lat); const lng = Number(row.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        results.push({ phone: String(row.phone), skill: String(row.skill), lat, lng, name: String(row.name || 'Verified provider'), location: row.location ? String(row.location) : undefined, subscription_tier: row.subscription_tier ? String(row.subscription_tier) : undefined, source: row.source === 'stationary' ? 'stationary' : 'mobile' });
    }
    stmt.free();
    return results;
}

function fuzzCoordinate(value: number, salt: string, metres: number): number {
    const hash = crypto.createHash('sha256').update(salt).digest();
    const signed = (hash.readInt32BE(0) / 0x7fffffff) * metres;
    return Math.round((value + signed / 111_320) * 1000) / 1000;
}

export function toPublicPulseProviders(providers: ActivePulseProvider[]): PublicPulseProvider[] {
    return providers.map((provider) => {
        const radius = 100;
        const salt = `${provider.phone}:${provider.skill}:${provider.source}`;
        return {
            id: crypto.createHash('sha256').update(`${provider.phone}:${provider.skill}`).digest('hex').slice(0, 16),
            skill: provider.skill,
            name: provider.name,
            location: provider.location,
            subscription_tier: provider.subscription_tier,
            source: provider.source,
            lat: fuzzCoordinate(provider.lat, `${salt}:lat`, radius),
            lng: fuzzCoordinate(provider.lng, `${salt}:lng`, radius),
            location_radius_m: radius,
            verified: true,
            live_now: true,
        };
    });
}
