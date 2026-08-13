import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';
import { ensureProviderVerificationSchema } from './providerVerification.js';
import { createEconomicRequest, getEconomicRequest } from './skillFlows.js';
import { addEconomicParticipant, attachEconomicOffer } from './economicParticipants.js';

export interface ProviderProductInput {
  id?: unknown;
  title: unknown;
  description?: unknown;
  priceMinor?: unknown;
  currency?: unknown;
  availabilityNote?: unknown;
  active?: unknown;
}

interface StoredProviderProduct {
  id: string;
  title: string;
  description: string | null;
  priceMinor: number | null;
  currency: string;
  availabilityNote: string | null;
  active: boolean;
}

export interface ProviderProductListing {
  id: string;
  title: string;
  description: string | null;
  priceMinor: number | null;
  currency: string;
  availabilityNote: string | null;
  providerName: string;
  skill: string;
  country: string;
  listingState: 'provider_listed';
}

export interface SourcedProductCard {
  title: string;
  price: string;
  source: string;
  location?: string;
  verified?: boolean;
}

function cleanText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${field} is too long`);
  return text;
}

function cleanOptionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  return cleanText(value, field, maxLength);
}

function catalogueSecret(): string {
  return process.env.KURUKOO_PRODUCT_CATALOGUE_SECRET || process.env.JWT_SECRET || 'development-product-catalogue-secret';
}

function listingReference(providerPhone: string, skill: string, productId: string): string {
  return crypto.createHmac('sha256', catalogueSecret()).update(`${providerPhone}\u0000${skill}\u0000${productId}`).digest('base64url');
}

function parseProducts(raw: unknown): StoredProviderProduct[] {
  try {
    const parsed = JSON.parse(String(raw || '[]'));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item): StoredProviderProduct | null => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const value = item as Record<string, unknown>;
      const id = typeof value.id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value.id) ? value.id : '';
      const title = typeof value.title === 'string' && value.title.trim().length <= 160 ? value.title.trim() : '';
      if (!id || !title) return null;
      const priceMinor = value.priceMinor === null || value.priceMinor === undefined || value.priceMinor === '' ? null : Number(value.priceMinor);
      if (priceMinor !== null && (!Number.isInteger(priceMinor) || priceMinor < 0)) return null;
      return {
        id,
        title,
        description: typeof value.description === 'string' && value.description.trim() && value.description.trim().length <= 600 ? value.description.trim() : null,
        priceMinor,
        currency: typeof value.currency === 'string' && /^[A-Za-z]{3}$/.test(value.currency.trim()) ? value.currency.trim().toUpperCase() : 'NGN',
        availabilityNote: typeof value.availabilityNote === 'string' && value.availabilityNote.trim() && value.availabilityNote.trim().length <= 300 ? value.availabilityNote.trim() : null,
        active: value.active !== false,
      };
    }).filter((item): item is StoredProviderProduct => Boolean(item));
  } catch {
    return [];
  }
}

function normalizeProducts(value: unknown): StoredProviderProduct[] {
  if (!Array.isArray(value)) throw new Error('Products must be an array');
  if (value.length > 50) throw new Error('A skill may list at most 50 products');
  const ids = new Set<string>();
  return value.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`Product ${index + 1} must be an object`);
    const product = raw as ProviderProductInput;
    const id = product.id === undefined || product.id === null || product.id === '' ? crypto.randomUUID() : cleanText(product.id, 'Product id', 80);
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || ids.has(id)) throw new Error('Product ids must be unique URL-safe identifiers');
    ids.add(id);
    const priceMinor = product.priceMinor === undefined || product.priceMinor === null || product.priceMinor === '' ? null : Number(product.priceMinor);
    if (priceMinor !== null && (!Number.isInteger(priceMinor) || priceMinor < 0)) throw new Error('Listed product price must be a non-negative integer amount in minor units');
    const currency = cleanOptionalText(product.currency ?? 'NGN', 'Product currency', 3) || 'NGN';
    if (!/^[A-Za-z]{3}$/.test(currency)) throw new Error('Product currency must be a three-letter code');
    return {
      id,
      title: cleanText(product.title, 'Product title', 160),
      description: cleanOptionalText(product.description, 'Product description', 600),
      priceMinor,
      currency: currency.toUpperCase(),
      availabilityNote: cleanOptionalText(product.availabilityNote, 'Product listing note', 300),
      active: product.active !== false,
    };
  });
}

/** Provider-owned product listings live on the existing canonical skill record. */
export async function replaceProviderSkillProducts(input: { providerPhone: string; skill: string; products: unknown }): Promise<StoredProviderProduct[]> {
  const providerPhone = cleanText(input.providerPhone, 'Authenticated provider', 128);
  const skill = cleanText(input.skill, 'Skill', 120).toLowerCase();
  const products = normalizeProducts(input.products);
  const db = await getDb();
  const stmt = db.prepare('SELECT id FROM skills WHERE phone=? AND lower(skill)=? LIMIT 1');
  stmt.bind([providerPhone, skill]);
  const exists = stmt.step();
  stmt.free();
  if (!exists) throw new Error('Add this skill before managing its products');
  db.run('UPDATE skills SET products=? WHERE phone=? AND lower(skill)=?', [JSON.stringify(products), providerPhone, skill]);
  saveDb();
  return products;
}

function termsFor(query: string): string[] {
  return Array.from(new Set(String(query || '').toLowerCase().match(/[a-z0-9]{2,}/g) || [])).slice(0, 8);
}

async function matchingCatalogueRows(): Promise<Array<{ providerPhone: string; providerName: string; country: string; skill: string; products: StoredProviderProduct[] }>> {
  await ensureProviderVerificationSchema();
  const db = await getDb();
  const statement = db.prepare(`SELECT s.phone, s.skill, s.products, m.name, m.country
    FROM skills s
    JOIN memory_profiles m ON m.phone=s.phone
    JOIN provider_verifications v ON v.phone=s.phone
    WHERE s.is_available=1 AND s.products IS NOT NULL AND trim(s.products)<>''
      AND v.state='verified' AND v.evidence_ref IS NOT NULL AND trim(v.evidence_ref)<>''
      AND (v.expires_at IS NULL OR datetime(v.expires_at)>datetime('now'))`);
  const rows: Array<{ providerPhone: string; providerName: string; country: string; skill: string; products: StoredProviderProduct[] }> = [];
  while (statement.step()) {
    const row = statement.getAsObject() as Record<string, unknown>;
    const products = parseProducts(row.products).filter(product => product.active);
    if (products.length) rows.push({ providerPhone: String(row.phone), providerName: String(row.name || 'Verified provider'), country: String(row.country || 'ng').toLowerCase(), skill: String(row.skill).toLowerCase(), products });
  }
  statement.free();
  return rows;
}

/** Match provider-declared product listings; a listing is never a stock, price, reservation, or fulfilment confirmation. */
export async function searchProviderProductListings(query: string, limit = 5, country?: string): Promise<ProviderProductListing[]> {
  const terms = termsFor(query);
  if (!terms.length) return [];
  const normalizedCountry = country ? String(country).trim().toLowerCase() : '';
  const matches: Array<ProviderProductListing & { score: number }> = [];
  for (const row of await matchingCatalogueRows()) {
    if (normalizedCountry && row.country !== normalizedCountry) continue;
    for (const product of row.products) {
      const haystack = `${product.title} ${product.description || ''} ${product.availabilityNote || ''} ${row.skill}`.toLowerCase();
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
      if (score) matches.push({
        id: listingReference(row.providerPhone, row.skill, product.id), title: product.title, description: product.description,
        priceMinor: product.priceMinor, currency: product.currency, availabilityNote: product.availabilityNote,
        providerName: row.providerName, skill: row.skill, country: row.country, listingState: 'provider_listed', score,
      });
    }
  }
  return matches.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, Math.min(Math.max(limit, 1), 10)).map(({ score: _score, ...listing }) => listing);
}

async function resolveProviderProductListing(reference: string): Promise<(ProviderProductListing & { providerPhone: string; productId: string }) | null> {
  const normalizedReference = cleanText(reference, 'Product listing reference', 128);
  for (const row of await matchingCatalogueRows()) {
    for (const product of row.products) {
      if (listingReference(row.providerPhone, row.skill, product.id) === normalizedReference) {
        return { id: normalizedReference, title: product.title, description: product.description, priceMinor: product.priceMinor, currency: product.currency, availabilityNote: product.availabilityNote, providerName: row.providerName, skill: row.skill, country: row.country, listingState: 'provider_listed', providerPhone: row.providerPhone, productId: product.id };
      }
    }
  }
  return null;
}

/** Select a provider-declared listing into one canonical product-sourcing request; current inventory and final price still require provider confirmation. */
export async function startProviderProductListingRequest(input: { buyerPhone: string; listingId: string; quantity?: string; deliveryLocation?: string; deliveryRequired?: boolean }): Promise<{ requestId: string }> {
  const buyerPhone = cleanText(input.buyerPhone, 'Buyer phone', 128);
  const listing = await resolveProviderProductListing(input.listingId);
  if (!listing) throw new Error('Provider product listing not found or no longer eligible');
  const request = await createEconomicRequest({
    id: crypto.randomUUID(), phone: buyerPhone, skill: 'product_sourcing', requirements: {
      product: listing.title, quantity: cleanOptionalText(input.quantity, 'Quantity', 128) || undefined,
      location: cleanOptionalText(input.deliveryLocation, 'Delivery location', 500) || undefined,
      product_listing_reference: listing.id, product_listing_state: listing.listingState,
      seller_reference: listing.providerPhone, source_skill: listing.skill,
      delivery_required: input.deliveryRequired === true ? 'yes' : input.deliveryRequired === false ? 'no' : 'unknown',
    },
  });
  await attachEconomicOffer({ requestId: request.id, ownerPhone: buyerPhone, id: crypto.randomUUID(), sellerPhone: listing.providerPhone, description: listing.title, priceMinor: listing.priceMinor, currency: listing.currency, source: 'provider_product_listing', availabilityNote: listing.availabilityNote || 'Provider-listed product; current availability and final quote require confirmation.', status: 'available', provenance: 'seller_created', originOfferId: listing.id });
  await addEconomicParticipant({ requestId: request.id, ownerPhone: buyerPhone, role: 'seller', providerPhone: listing.providerPhone, capability: 'seller_product_listing', status: 'offered', evidence: { product_listing_reference: listing.id, listing_state: listing.listingState, source_skill: listing.skill, availability_confirmation: 'required' } });
  return { requestId: request.id };
}

/** Compatibility product cards now expose only evidence-backed provider listings with unknown current availability. */
export async function sourceProduct(query: string, country: string): Promise<SourcedProductCard[]> {
  const listings = await searchProviderProductListings(query, 3, country);
  return listings.map(listing => ({
    title: listing.title,
    price: listing.priceMinor === null ? 'Price requires provider confirmation' : `${listing.priceMinor} ${listing.currency} listed price`,
    source: `${listing.providerName} · provider-listed product; availability requires confirmation`,
    verified: true,
  }));
}
