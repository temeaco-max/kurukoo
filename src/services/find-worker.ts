import { getDb } from '../database.js';

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
    distance_km?: number;
}

export interface FindWorkerResult {
    providers: ProviderMatch[];
    count: number;
}

/**
 * Canonical provider discovery for Economic Requests.
 * A provider is only presented as verified when the provider's Memory Profile
 * explicitly carries verified_provider=1 or the category-specific skill has
 * verified_artist=1. A supplied location is a hard service-area constraint;
 * this module deliberately does not invent geocoded distance data.
 */
export async function find_worker(options: { skill: string; location?: string; max?: number }): Promise<FindWorkerResult> {
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
               p.name, p.location, p.verified_provider
        FROM skills s
        LEFT JOIN memory_profiles p ON p.phone = s.phone
        WHERE lower(s.skill) = lower(?)
          AND s.is_available = 1
          AND (COALESCE(p.verified_provider, 0) = 1 OR COALESCE(s.verified_artist, 0) = 1)
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
            verified: Boolean(Number(r.verified_provider ?? 0) || Number(r.verified_artist ?? 0)),
        });
    }
    stmt.free();
    return { providers, count: providers.length };
}
