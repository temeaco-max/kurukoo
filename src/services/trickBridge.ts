import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';

/*
 * Presence Trick-Bridge Service (§5)
 * Cost-effective continuous feel without continuous GPS/WebRTC relay costs.
 * Public coordinates are fuzzed and provider phone numbers are never exposed.
 */

export interface TrickPresence {
    providerId: string;
    fuzzedLat: number;
    fuzzedLng: number;
    isLive: boolean;
    lastConfirmed: string;
    mode: 'mobile' | 'stationary';
}

function publicProviderId(phone: string): string {
    return crypto.createHash('sha256').update(`kurukoo:provider:${phone}`).digest('hex').slice(0, 16);
}

function fuzzCoordinates(lat: number, lng: number): { lat: number; lng: number } {
    const latOffset = (Math.random() - 0.5) * 0.0018;
    const lngOffset = (Math.random() - 0.5) * 0.0018;
    return { lat: Number((lat + latOffset).toFixed(5)), lng: Number((lng + lngOffset).toFixed(5)) };
}

export async function updateTrickPresence(phone: string, lat: number, lng: number, movementMeters: number = 50, operationMode?: 'mobile' | 'stationary'): Promise<{ success: boolean; fuzzed: { lat: number; lng: number } }> {
    if (!phone || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        throw new Error('Invalid presence coordinates');
    }
    const db = await getDb();
    const fuzzed = fuzzCoordinates(lat, lng);
    const mode = operationMode || (movementMeters < 80 ? 'stationary' : 'mobile');
    db.run(
        `UPDATE provider_presence SET last_lat = ?, last_lng = ?, fuzzed_lat = ?, fuzzed_lng = ?, last_confirmed = datetime('now'), updated_at = datetime('now'), operation_mode = ? WHERE phone = ?`,
        [lat, lng, fuzzed.lat, fuzzed.lng, mode, phone]
    );
    saveDb();
    return { success: true, fuzzed };
}

export async function getFuzzedTrickPresence(): Promise<TrickPresence[]> {
    const db = await getDb();
    const stmt = db.prepare(`
        SELECT phone, fuzzed_lat, fuzzed_lng, is_live, last_confirmed, operation_mode
        FROM provider_presence
        WHERE is_live = 1 AND live_until > datetime('now') AND fuzzed_lat IS NOT NULL AND fuzzed_lng IS NOT NULL
    `);
    const results: TrickPresence[] = [];
    while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push({
            providerId: publicProviderId(String(row.phone || '')),
            fuzzedLat: Number(row.fuzzed_lat),
            fuzzedLng: Number(row.fuzzed_lng),
            isLive: row.is_live === 1,
            lastConfirmed: row.last_confirmed as string,
            mode: (row.operation_mode as 'mobile' | 'stationary') || 'stationary'
        });
    }
    stmt.free();
    return results;
}

export function validateHighValueTransportGate(intentConfirmed: boolean, activeJobOrDelivery: boolean): boolean {
    return intentConfirmed || activeJobOrDelivery;
}

export async function checkStationaryNudges(): Promise<number> {
    const db = await getDb();
    const stmt = db.prepare(`
        SELECT phone FROM provider_presence
        WHERE operation_mode = 'stationary' AND is_live = 1 AND (last_confirmed < datetime('now', '-12 hours') OR last_confirmed IS NULL)
    `);
    let count = 0;
    while (stmt.step()) count++;
    stmt.free();
    return count;
}
