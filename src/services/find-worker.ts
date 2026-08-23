import { getCanonicalStore } from './canonicalStore.js';
import { normalizeProviderEntityType, type ProviderEntityType } from './providerEntity.js';
import { getActivePulseProviders } from './nearbyPulse.js';
import { getActiveLocationConsent } from './progressiveTrustService.js';

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
    live_now?: boolean;
    live_source?: 'mobile' | 'stationary';
}

export interface FindWorkerResult {
    providers: ProviderMatch[];
    count: number;
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (value: number) => value * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function find_worker(options: {
    skill: string;
    location?: string;
    max?: number;
    service?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    ownerPhone?: string;
}): Promise<FindWorkerResult> {
    const store = await getCanonicalStore();
    const max = Math.min(25, Math.max(1, options.max ?? 5));
    const location = String(options.location || '').trim();
    const requestedSkill = String(options.skill || '').trim().toLowerCase();
    const service = String(options.service || '').trim().toLowerCase();
    let latitude = Number(options.latitude);
    let longitude = Number(options.longitude);
    let hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude)
        && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
    let consentedLocation: string | undefined;

    if (!hasCoordinates && options.ownerPhone) {
        const consent = await getActiveLocationConsent(String(options.ownerPhone), ['nearby', 'network_discovery', 'fulfilment']);
        if (consent) {
            latitude = consent.latitude;
            longitude = consent.longitude;
            hasCoordinates = true;
            consentedLocation = consent.precision === 'precise' ? 'consented precise location' : 'consented coarse location';
        }
    }

    const radiusKm = Math.min(50, Math.max(0.1, Number(options.radiusKm || 10)));
    const searchSkills = new Set<string>([requestedSkill]);
    if (requestedSkill === 'find_worker' && service) searchSkills.add(service.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
    if (requestedSkill === 'repair') {
        const deviceRepair = /iphone|ipad|android|phone|mobile|tablet|screen|laptop|computer|device/.test(`${service} ${requestedSkill}`);
        if (deviceRepair) {
            searchSkills.add('phone_repairer');
            searchSkills.add('phone_repair');
        }
    }
    const skillValues = Array.from(searchSkills).filter(Boolean).slice(0, 5);
    const skillPlaceholders = skillValues.map(() => '?').join(', ');
    const locationClause = location
        ? `AND (lower(COALESCE(p.location, '')) LIKE '%' || lower(?) || '%' OR lower(COALESCE(p.primary_lga, '')) LIKE '%' || lower(?) || '%' OR lower(COALESCE(p.primary_state, '')) LIKE '%' || lower(?) || '%')`
        : '';

    const bindParams: unknown[] = [...skillValues];
    if (location) bindParams.push(location, location, location);
    bindParams.push(max);
    const rows = await store.all<any>(`
        SELECT s.phone, s.skill, s.rating, s.jobs_completed, s.hourly_rate,
               s.operation_mode, s.service_radius_km,
               s.verified_artist,
               p.name, p.location, p.verified_provider, p.provider_type
        FROM skills s
        LEFT JOIN memory_profiles p ON p.phone = s.phone
        WHERE lower(s.skill) IN (${skillPlaceholders})
          AND s.is_available = 1
          AND (COALESCE(p.verified_provider, 0) = 1 OR (COALESCE(p.provider_type, 'human') = 'human' AND COALESCE(s.verified_artist, 0) = 1))
          ${locationClause}
        ORDER BY s.rating DESC, s.jobs_completed DESC
        LIMIT ?
    `, bindParams);

    const providers: ProviderMatch[] = rows.map((r: any) => ({
        phone: String(r.phone ?? ''),
        name: String(r.name ?? 'Provider'),
        business_name: undefined,
        skill: String(r.skill ?? requestedSkill),
        rating: Number(r.rating ?? 0),
        jobs_completed: Number(r.jobs_completed ?? 0),
        hourly_rate: Number(r.hourly_rate ?? 0),
        operation_mode: String(r.operation_mode ?? 'stationary'),
        service_radius_km: Number(r.service_radius_km ?? 0),
        verified: Boolean(Number(r.verified_provider ?? 0) || Number(r.verified_artist ?? 0)),
        provider_type: normalizeProviderEntityType(r.provider_type),
        live_now: false,
    }));

    if (hasCoordinates) {
        const liveProviders = await getActivePulseProviders();
        const byPhone = new Map(providers.map(provider => [provider.phone, provider]));
        for (const live of liveProviders) {
            const liveSkill = String(live.skill || '').trim().toLowerCase();
            if (!skillValues.includes(liveSkill)) continue;
            const liveLat = Number(live.lat);
            const liveLng = Number(live.lng);
            if (!Number.isFinite(liveLat) || !Number.isFinite(liveLng)) continue;
            const distance = distanceKm(latitude, longitude, liveLat, liveLng);
            if (distance > radiusKm) continue;
            const existing = byPhone.get(String(live.phone));
            if (existing) {
                existing.distance_km = distance;
                existing.live_now = true;
                existing.live_source = String(live.source) === 'mobile' ? 'mobile' : 'stationary';
                continue;
            }
            const profile = await store.one<any>('SELECT name, provider_type, verified_provider FROM memory_profiles WHERE phone=? LIMIT 1', [String(live.phone)]);
            if (Number(profile?.verified_provider || 0) !== 1) continue;
            const provider: ProviderMatch = {
                phone: String(live.phone),
                name: String(live.name || profile?.name || 'Verified provider'),
                business_name: undefined,
                skill: liveSkill,
                rating: 0,
                jobs_completed: 0,
                hourly_rate: 0,
                operation_mode: String(live.source || 'mobile') === 'mobile' ? 'mobile' : 'stationary',
                service_radius_km: radiusKm,
                verified: true,
                provider_type: normalizeProviderEntityType(profile?.provider_type),
                distance_km: distance,
                live_now: true,
                live_source: String(live.source) === 'mobile' ? 'mobile' : 'stationary',
            };
            providers.push(provider);
            byPhone.set(provider.phone, provider);
        }
    }

    providers.sort((a, b) => {
        const liveDelta = Number(Boolean(b.live_now)) - Number(Boolean(a.live_now));
        if (liveDelta) return liveDelta;
        const distanceDelta = Number(a.distance_km ?? Number.POSITIVE_INFINITY) - Number(b.distance_km ?? Number.POSITIVE_INFINITY);
        if (Number.isFinite(distanceDelta) && Math.abs(distanceDelta) > 1e-9) return distanceDelta;
        return b.rating - a.rating || b.jobs_completed - a.jobs_completed;
    });

    void consentedLocation;
    return { providers: providers.slice(0, max), count: Math.min(providers.length, max) };
}
