import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';

/*
 * Presence Trick-Bridge Service (§5)
 * Cost-effective continuous feel without continuous GPS/WebRTC relay costs.
 * Public coordinates are fuzzed and provider phone numbers are never exposed.
 * Skill-specific availability remains owned by the canonical skills/portfolio state.
 */

export interface TrickPresence {
    providerId: string;
    skill?: string;
    fuzzedLat: number;
    fuzzedLng: number;
    isLive: boolean;
    lastConfirmed: string;
    mode: 'mobile' | 'stationary';
}

function publicProviderId(phone: string): string { return crypto.createHash('sha256').update(`kurukoo:provider:${phone}`).digest('hex').slice(0, 16); }
function fuzzCoordinates(lat: number, lng: number): { lat: number; lng: number } {
    const latOffset = (Math.random() - 0.5) * 0.0018;
    const lngOffset = (Math.random() - 0.5) * 0.0018;
    return { lat: Number((lat + latOffset).toFixed(5)), lng: Number((lng + lngOffset).toFixed(5)) };
}

export async function updateTrickPresence(phone: string, lat: number, lng: number, movementMeters: number = 50): Promise<{ success: boolean; fuzzed: { lat: number; lng: number } }> {
    if (!phone || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error('Invalid presence coordinates');
    const db = await getDb();
    const fuzzed = fuzzCoordinates(lat, lng);
    const isStationary = movementMeters < 80;
    db.run(`UPDATE provider_presence SET last_lat = ?, last_lng = ?, fuzzed_lat = ?, fuzzed_lng = ?, last_confirmed = datetime('now'), updated_at = datetime('now'), operation_mode = ? WHERE phone = ?`, [lat, lng, fuzzed.lat, fuzzed.lng, isStationary ? 'stationary' : 'mobile', phone]);
    saveDb();
    return { success: true, fuzzed };
}

export async function getFuzzedTrickPresence(): Promise<TrickPresence[]> {
    const db = await getDb();
    const stmt = db.prepare(`
        SELECT pr.phone, s.skill, pr.fuzzed_lat, pr.fuzzed_lng, pr.is_live, pr.last_confirmed, pr.operation_mode
        FROM provider_presence pr
        JOIN memory_profiles m ON pr.phone = m.phone
        JOIN skills s ON s.phone = pr.phone AND s.is_available = 1
        WHERE pr.is_live = 1 AND pr.live_until > datetime('now') AND m.verified_provider = 1
    `);
    const results: TrickPresence[] = [];
    while (stmt.step()) {
        const row = stmt.getAsObject() as any;
        results.push({
            providerId: publicProviderId(String(row.phone || '')),
            skill: row.skill ? String(row.skill) : undefined,
            fuzzedLat: (row.fuzzed_lat !== null && row.fuzzed_lat !== undefined) ? Number(row.fuzzed_lat) : 0,
            fuzzedLng: (row.fuzzed_lng !== null && row.fuzzed_lng !== undefined) ? Number(row.fuzzed_lng) : 0,
            isLive: Number(row.is_live) === 1,
            lastConfirmed: row.last_confirmed as string,
            mode: (row.operation_mode as 'mobile' | 'stationary') || 'stationary'
        });
    }
    stmt.free();
    return results;
}

export function validateHighValueTransportGate(intentConfirmed: boolean, activeJobOrDelivery: boolean): boolean { return intentConfirmed || activeJobOrDelivery; }

export async function checkStationaryNudges(): Promise<number> {
    const db = await getDb();
    const stmt = db.prepare(`SELECT phone FROM provider_presence WHERE operation_mode = 'stationary' AND is_live = 1 AND (last_confirmed < datetime('now', '-12 hours') OR last_confirmed IS NULL)`);
    let count = 0;
    while (stmt.step()) count++;
    stmt.free();
    return count;
}
