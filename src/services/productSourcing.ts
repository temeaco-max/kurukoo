import { getDb } from '../database.js';
import { ensureProviderVerificationSchema } from './providerVerification.js';

export interface SourcedProductCard {
    title: string;
    price: string;
    source: string;
    location?: string;
    verified?: boolean;
}

/**
 * Conversational product sourcing. Kurukoo must never invent a product, price,
 * affiliate relationship or verification status. External affiliate/catalog
 * connectors can be added behind this same interface when credentials and live
 * catalog APIs are configured.
 */
export async function sourceProduct(query: string, country: string): Promise<SourcedProductCard[]> {
    const normalizedCountry = country.toLowerCase().trim();
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery || !normalizedCountry) return [];

    await ensureProviderVerificationSchema();
    const db = await getDb();
    const cards: SourcedProductCard[] = [];
    try {
        const stmt = db.prepare(`
            SELECT m.name, m.location, v.state AS verification_state,
                   s.skill, s.hourly_rate, s.rating
            FROM memory_profiles m
            JOIN skills s ON m.phone = s.phone
            JOIN provider_verifications v ON v.phone=m.phone
            WHERE lower(m.country) = ?
              AND (lower(s.skill) LIKE ? OR lower(s.skill) = ?)
              AND v.state='verified' AND v.evidence_ref IS NOT NULL AND trim(v.evidence_ref)<>''
              AND (v.expires_at IS NULL OR datetime(v.expires_at)>datetime('now'))
            LIMIT 3
        `);
        stmt.bind([normalizedCountry, `%${cleanQuery}%`, cleanQuery]);
        while (stmt.step()) {
            const row = stmt.getAsObject() as Record<string, unknown>;
            const rate = Number(row.hourly_rate);
            const verified = String(row.verification_state || '') === 'verified';
            cards.push({
                title: `${row.name || 'Provider'} (${row.skill})`,
                price: Number.isFinite(rate) && rate > 0 ? `₦${rate.toLocaleString()}/hr` : 'Price on request',
                source: `${row.location || 'Local provider'}`,
                location: row.location ? String(row.location) : undefined,
                verified,
            });
        }
        stmt.free();
    } catch (err) {
        console.error('[Product Sourcing] local catalog query failed:', err);
    }

    return cards.slice(0, 3);
}
