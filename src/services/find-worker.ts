import { getDb } from '../database.js';
import { normalizeProviderEntityType, type ProviderEntityType } from './providerEntity.js';
import { ensureProviderVerificationSchema } from './providerVerification.js';

export interface ProviderMatch {
    phone: string;
    name: string;
    business_name?: string;
    skill: string;
    rating: number;
    jobs_completed: number;
    hourly_rate: number;
    operation_mode: string;
    service_radius_km: number;
    verified: boolean;
    provider_type: ProviderEntityType;
    distance_km?: number;
}

export interface FindWorkerResult {
    providers: ProviderMatch[];
    count: number;
}

/**
 * Canonical provider discovery for Economic Requests.
 * A provider is only presented as verified when the authoritative provider
 * verification lifecycle has current evidence-backed `verified` state. The
 * memory-profile boolean is a legacy presentation projection only. A supplied
 * location is a hard service-area constraint; this module deliberately does not
 * invent geocoded distance data, telemetry, availability, or quotes.
 */
export async function find_worker(options: { skill: string; location?: string; max?: number }): Promise<FindWorkerResult> {
    await ensureProviderVerificationSchema();
    const db = await getDb();
    const max = Math.min(25, Math.max(1, options.max ?? 5));
    const location = String(options.location || '').trim();
    const locationClause = location
        ? `AND (
            lower(COALESCE(p.location, '')) LIKE '%' || lower(?) || '%'
            OR lower(COALESCE(p.primary_lga, '')) LIKE '%' || lower(?) || '%'
            OR lower(COALESCE(p.primary_state, '')) LIKE '%' || lower(?) || '%'
        )`
        : '';

    const stmt = db.prepare(`
        SELECT s.phone, s.skill, s.rating, s.jobs_completed, s.hourly_rate,
               s.operation_mode, s.service_radius_km,
               s.verified_artist,
               p.name, p.location, p.provider_type,
               v.state AS verification_state, v.evidence_ref, v.expires_at
        FROM skills s
        LEFT JOIN memory_profiles p ON p.phone = s.phone
        INNER JOIN provider_verifications v ON v.phone = s.phone
        WHERE lower(s.skill) = lower(?)
          AND s.is_available = 1
          AND v.state = 'verified'
          AND v.evidence_ref IS NOT NULL
          AND trim(v.evidence_ref) <> ''
          AND (v.expires_at IS NULL OR datetime(v.expires_at) > datetime('now'))
          ${locationClause}
        ORDER BY s.rating DESC, s.jobs_completed DESC
        LIMIT ?
    `);
    const bindParams: unknown[] = [options.skill.toLowerCase()];
    if (location) bindParams.push(location, location, location);
    bindParams.push(max);
    stmt.bind(bindParams);

    const providers: ProviderMatch[] = [];
    while (stmt.step()) {
        const r = stmt.getAsObject() as Record<string, unknown>;
        providers.push({
            phone: String(r.phone ?? ''),
            name: String(r.name ?? 'Provider'),
            business_name: undefined,
            skill: String(r.skill ?? options.skill),
            rating: Number(r.rating ?? 0),
            jobs_completed: Number(r.jobs_completed ?? 0),
            hourly_rate: Number(r.hourly_rate ?? 0),
            operation_mode: String(r.operation_mode ?? 'stationary'),
            service_radius_km: Number(r.service_radius_km ?? 0),
            verified: true,
            provider_type: normalizeProviderEntityType(r.provider_type),
        });
    }
    stmt.free();
    return { providers, count: providers.length };
}
