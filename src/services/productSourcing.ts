import { getDb } from '../database.js';

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

    const db = await getDb();
    const cards: SourcedProductCard[] = [];
    try {
        const stmt = db.prepare(`
            SELECT m.name, m.location, m.verified_provider,
                   s.skill, s.hourly_rate, s.rating, s.verified_artist
            FROM memory_profiles m
            JOIN skills s ON m.phone = s.phone
            WHERE lower(m.country) = ?
              AND (lower(s.skill) LIKE ? OR lower(s.skill) = ?)
              AND (COALESCE(m.verified_provider, 0) = 1 OR COALESCE(s.verified_artist, 0) = 1)
            LIMIT 3
        `);
        stmt.bind([normalizedCountry, `%${cleanQuery}%`, cleanQuery]);
        while (stmt.step()) {
            const row = stmt.getAsObject() as Record<string, unknown>;
            const rate = Number(row.hourly_rate);
            const verified = Boolean(Number(row.verified_provider ?? 0) || Number(row.verified_artist ?? 0));
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
