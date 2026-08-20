import { getDb } from '../database.js';
import { getAllCatalogueSkillNames } from './skillCatalogueConvergence.js';

export interface CatalogueInventoryItem {
  providerPhone: string;
  providerName: string;
  skill: string;
  product: string;
  matchedTerms: string[];
  available: boolean;
  verified: boolean;
  location?: string;
  price?: number;
  currency?: string;
  rating?: number;
  source: 'provider_skill_products';
}

function normalize(value: unknown): string {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseProducts(value: unknown): Array<Record<string, unknown>> {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (Array.isArray(parsed)) return parsed.map(item => typeof item === 'string' ? { name: item } : item).filter(Boolean);
    if (parsed && typeof parsed === 'object') return Object.entries(parsed as Record<string, unknown>).map(([name, details]) => typeof details === 'object' && details ? { name, ...(details as Record<string, unknown>) } : { name, value: details });
  } catch {}
  return [];
}

function terms(query: string): string[] {
  return normalize(query).split(' ').filter(term => term.length >= 2);
}

function scoreProduct(productName: string, queryTerms: string[]): { score: number; matched: string[] } {
  const normalized = normalize(productName);
  if (!normalized || !queryTerms.length) return { score: 0, matched: [] };
  const matched = queryTerms.filter(term => normalized === term || normalized.includes(term));
  const unique = [...new Set(matched)];
  const exact = normalized === queryTerms.join(' ') ? 2 : 0;
  const coverage = unique.length / queryTerms.length;
  return { score: exact + coverage, matched: unique };
}

export async function matchCatalogueInventory(options: {
  query: string;
  skill?: string;
  location?: string;
  max?: number;
  requireVerified?: boolean;
}): Promise<CatalogueInventoryItem[]> {
  const query = normalize(options.query);
  if (!query) return [];
  const db = await getDb();
  const max = Math.min(50, Math.max(1, Number(options.max || 10)));
  const requestedSkill = normalize(options.skill).replace(/ /g, '_');
  const canonicalSkills = new Set(getAllCatalogueSkillNames());
  const allowedSkills = requestedSkill && canonicalSkills.has(requestedSkill) ? [requestedSkill] : Array.from(canonicalSkills);
  const placeholders = allowedSkills.map(() => '?').join(',');
  const queryTerms = terms(query);
  const sql = `
    SELECT s.phone, s.skill, s.products, s.is_available, s.rating,
           p.name, p.location, p.verified_provider, p.currency
    FROM skills s
    LEFT JOIN memory_profiles p ON p.phone = s.phone
    WHERE lower(s.skill) IN (${placeholders})
      AND s.is_available = 1
      ${options.requireVerified === false ? '' : 'AND COALESCE(p.verified_provider, 0) = 1'}
  `;
  const stmt = db.prepare(sql);
  stmt.bind(allowedSkills);
  const rows: CatalogueInventoryItem[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    const location = String(row.location || '').trim();
    if (options.location && !normalize(location).includes(normalize(options.location))) continue;
    for (const raw of parseProducts(row.products)) {
      const product = String(raw.name || raw.product || raw.title || raw.item || '').trim();
      const scored = scoreProduct(product, queryTerms);
      if (scored.score < 0.4) continue;
      const priceValue = Number(raw.price ?? raw.price_minor ?? raw.amount);
      rows.push({
        providerPhone: String(row.phone || ''),
        providerName: String(row.name || 'Provider'),
        skill: String(row.skill || requestedSkill || 'product_sourcing'),
        product,
        matchedTerms: scored.matched,
        available: raw.available !== false && Number(raw.stock ?? 1) !== 0,
        verified: Number(row.verified_provider || 0) === 1,
        location: location || undefined,
        price: Number.isFinite(priceValue) ? priceValue : undefined,
        currency: String(raw.currency || row.currency || '').trim() || undefined,
        rating: Number(row.rating || 0),
        source: 'provider_skill_products',
      });
    }
  }
  stmt.free();
  return rows
    .filter(item => item.available)
    .sort((a, b) => {
      const termDelta = b.matchedTerms.length - a.matchedTerms.length;
      if (termDelta) return termDelta;
      return Number(b.rating || 0) - Number(a.rating || 0);
    })
    .slice(0, max);
}
