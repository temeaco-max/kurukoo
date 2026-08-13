import { createHash, randomUUID } from 'node:crypto';
import { getDb, saveDb } from '../database.js';

export type AffiliateMerchantStatus = 'inactive' | 'active' | 'suspended';
export type AffiliateOfferStatus = 'inactive' | 'active' | 'expired' | 'suspended';
export type AffiliateConversionStatus = 'confirmed' | 'reversed';

export interface AffiliateMerchant {
  id: string;
  name: string;
  websiteUrl: string;
  disclosure: string;
  status: AffiliateMerchantStatus;
  countries: string[];
  evidenceRef: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AffiliateOffer {
  id: string;
  merchantId: string;
  merchantName?: string;
  title: string;
  description: string;
  country?: string;
  status: AffiliateOfferStatus;
  disclosure: string;
  evidenceRef: string;
  visitUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

const MERCHANT_STATUSES = new Set<AffiliateMerchantStatus>(['inactive', 'active', 'suspended']);
const OFFER_STATUSES = new Set<AffiliateOfferStatus>(['inactive', 'active', 'expired', 'suspended']);
const CONVERSION_STATUSES = new Set<AffiliateConversionStatus>(['confirmed', 'reversed']);

function cleanText(value: unknown, field: string, maxLength = 500): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${field} is too long`);
  return text;
}

function cleanUrl(value: unknown, field: string): string {
  const raw = cleanText(value, field, 2048);
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new Error(`${field} must be an absolute HTTPS or HTTP URL`); }
  if (!['https:', 'http:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
    throw new Error(`${field} must be a safe absolute HTTP URL`);
  }
  return parsed.toString();
}

function cleanCountries(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('Countries must be an array of ISO country codes');
  return Array.from(new Set(value.map((country) => cleanText(country, 'Country', 8).toLowerCase()).filter((country) => /^[a-z]{2}$/.test(country))));
}

function cleanCurrency(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const currency = cleanText(value, 'Currency', 8).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Currency must be a three-letter ISO code');
  return currency;
}

function ownerHash(phone: string): string {
  const secret = process.env.KURUKOO_AFFILIATE_EVENT_SALT || process.env.JWT_SECRET || 'development-affiliate-salt';
  return createHash('sha256').update(`${secret}:${phone}`).digest('hex').slice(0, 40);
}

function parseCountries(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed.map(String).filter((item) => /^[a-z]{2}$/.test(item)) : [];
  } catch { return []; }
}

function merchantFromRow(row: Record<string, unknown>): AffiliateMerchant {
  return {
    id: String(row.id),
    name: String(row.name),
    websiteUrl: String(row.website_url),
    disclosure: String(row.disclosure),
    status: String(row.status) as AffiliateMerchantStatus,
    countries: parseCountries(row.countries_json),
    evidenceRef: String(row.evidence_ref),
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function offerFromRow(row: Record<string, unknown>, exposeVisitUrl = false): AffiliateOffer {
  const id = String(row.id);
  return {
    id,
    merchantId: String(row.merchant_id),
    merchantName: row.merchant_name ? String(row.merchant_name) : undefined,
    title: String(row.title),
    description: String(row.description),
    country: row.country ? String(row.country) : undefined,
    status: String(row.status) as AffiliateOfferStatus,
    disclosure: String(row.disclosure),
    evidenceRef: String(row.evidence_ref),
    visitUrl: exposeVisitUrl ? `/api/affiliate/offers/${encodeURIComponent(id)}/visit` : undefined,
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

async function ensureAffiliateSchema(): Promise<any> {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS affiliate_merchants (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, website_url TEXT NOT NULL, disclosure TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'inactive', countries_json TEXT NOT NULL DEFAULT '[]', evidence_ref TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS affiliate_offers (
    id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL,
    external_url TEXT NOT NULL, country TEXT, status TEXT NOT NULL DEFAULT 'inactive', disclosure TEXT NOT NULL,
    evidence_ref TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS affiliate_click_events (
    id TEXT PRIMARY KEY, offer_id TEXT NOT NULL, owner_hash TEXT NOT NULL, destination_url TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_affiliate_click_events_offer_created ON affiliate_click_events(offer_id, created_at)`);
  db.run(`CREATE TABLE IF NOT EXISTS affiliate_conversion_events (
    id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL, offer_id TEXT NOT NULL, click_id TEXT,
    external_conversion_ref TEXT NOT NULL UNIQUE, status TEXT NOT NULL, commission_minor INTEGER, currency TEXT,
    evidence_ref TEXT NOT NULL, occurred_at TEXT, recorded_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_affiliate_conversion_events_offer_status ON affiliate_conversion_events(offer_id, status, recorded_at)`);
  return db;
}

async function getMerchantRow(id: string): Promise<Record<string, unknown> | undefined> {
  const db = await ensureAffiliateSchema();
  const stmt = db.prepare(`SELECT * FROM affiliate_merchants WHERE id = ? LIMIT 1`);
  stmt.bind([cleanText(id, 'Merchant id', 128)]);
  const result = stmt.step() ? stmt.getAsObject() as Record<string, unknown> : undefined;
  stmt.free();
  return result;
}

async function getOfferRow(id: string): Promise<Record<string, unknown> | undefined> {
  const db = await ensureAffiliateSchema();
  const stmt = db.prepare(`SELECT o.*, m.name AS merchant_name, m.status AS merchant_status FROM affiliate_offers o JOIN affiliate_merchants m ON m.id=o.merchant_id WHERE o.id = ? LIMIT 1`);
  stmt.bind([cleanText(id, 'Affiliate offer id', 128)]);
  const result = stmt.step() ? stmt.getAsObject() as Record<string, unknown> : undefined;
  stmt.free();
  return result;
}

export async function createAffiliateMerchant(input: {
  name: unknown; websiteUrl: unknown; disclosure?: unknown; countries?: unknown; evidenceRef: unknown; status?: unknown;
}): Promise<AffiliateMerchant> {
  const status = String(input.status || 'inactive') as AffiliateMerchantStatus;
  if (!MERCHANT_STATUSES.has(status)) throw new Error('Unsupported affiliate merchant status');
  const evidenceRef = cleanText(input.evidenceRef, 'Merchant evidence reference', 512);
  const disclosure = typeof input.disclosure === 'string' && input.disclosure.trim()
    ? cleanText(input.disclosure, 'Merchant disclosure', 500)
    : 'Affiliate link — Kurukoo may receive a commission if you buy. This merchant is not a Kurukoo verified provider.';
  const merchant: AffiliateMerchant = {
    id: randomUUID(),
    name: cleanText(input.name, 'Merchant name', 160),
    websiteUrl: cleanUrl(input.websiteUrl, 'Merchant website URL'),
    disclosure,
    status,
    countries: cleanCountries(input.countries),
    evidenceRef,
  };
  const db = await ensureAffiliateSchema();
  db.run(`INSERT INTO affiliate_merchants (id,name,website_url,disclosure,status,countries_json,evidence_ref) VALUES (?,?,?,?,?,?,?)`, [
    merchant.id, merchant.name, merchant.websiteUrl, merchant.disclosure, merchant.status, JSON.stringify(merchant.countries), merchant.evidenceRef,
  ]);
  saveDb();
  return (await getAffiliateMerchant(merchant.id))!;
}

export async function updateAffiliateMerchant(input: {
  id: string; name?: unknown; websiteUrl?: unknown; disclosure?: unknown; countries?: unknown; evidenceRef?: unknown; status?: unknown;
}): Promise<AffiliateMerchant> {
  const current = await getAffiliateMerchant(input.id);
  if (!current) throw new Error('Affiliate merchant not found');
  const status = input.status === undefined ? current.status : String(input.status) as AffiliateMerchantStatus;
  if (!MERCHANT_STATUSES.has(status)) throw new Error('Unsupported affiliate merchant status');
  const next = {
    name: input.name === undefined ? current.name : cleanText(input.name, 'Merchant name', 160),
    websiteUrl: input.websiteUrl === undefined ? current.websiteUrl : cleanUrl(input.websiteUrl, 'Merchant website URL'),
    disclosure: input.disclosure === undefined ? current.disclosure : cleanText(input.disclosure, 'Merchant disclosure', 500),
    countries: input.countries === undefined ? current.countries : cleanCountries(input.countries),
    evidenceRef: input.evidenceRef === undefined ? current.evidenceRef : cleanText(input.evidenceRef, 'Merchant evidence reference', 512),
  };
  const db = await ensureAffiliateSchema();
  db.run(`UPDATE affiliate_merchants SET name=?,website_url=?,disclosure=?,status=?,countries_json=?,evidence_ref=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`, [
    next.name, next.websiteUrl, next.disclosure, status, JSON.stringify(next.countries), next.evidenceRef, current.id,
  ]);
  saveDb();
  return (await getAffiliateMerchant(current.id))!;
}

export async function getAffiliateMerchant(id: string): Promise<AffiliateMerchant | undefined> {
  const row = await getMerchantRow(id);
  return row ? merchantFromRow(row) : undefined;
}

export async function listAffiliateMerchants(): Promise<AffiliateMerchant[]> {
  const db = await ensureAffiliateSchema();
  const stmt = db.prepare(`SELECT * FROM affiliate_merchants ORDER BY updated_at DESC, created_at DESC`);
  const results: AffiliateMerchant[] = [];
  while (stmt.step()) results.push(merchantFromRow(stmt.getAsObject() as Record<string, unknown>));
  stmt.free();
  return results;
}

export async function createAffiliateOffer(input: {
  merchantId: unknown; title: unknown; description: unknown; externalUrl: unknown; country?: unknown; disclosure?: unknown; evidenceRef: unknown; status?: unknown;
}): Promise<AffiliateOffer> {
  const merchant = await getAffiliateMerchant(cleanText(input.merchantId, 'Merchant id', 128));
  if (!merchant) throw new Error('Affiliate merchant not found');
  const status = String(input.status || 'inactive') as AffiliateOfferStatus;
  if (!OFFER_STATUSES.has(status)) throw new Error('Unsupported affiliate offer status');
  if (status === 'active' && merchant.status !== 'active') throw new Error('An active affiliate offer requires an active evidence-backed merchant');
  const country = input.country === undefined || input.country === null || input.country === '' ? undefined : cleanText(input.country, 'Offer country', 8).toLowerCase();
  if (country && !/^[a-z]{2}$/.test(country)) throw new Error('Offer country must be an ISO country code');
  const disclosure = typeof input.disclosure === 'string' && input.disclosure.trim()
    ? cleanText(input.disclosure, 'Offer disclosure', 500)
    : merchant.disclosure;
  const id = randomUUID();
  const db = await ensureAffiliateSchema();
  db.run(`INSERT INTO affiliate_offers (id,merchant_id,title,description,external_url,country,status,disclosure,evidence_ref) VALUES (?,?,?,?,?,?,?,?,?)`, [
    id,
    merchant.id,
    cleanText(input.title, 'Offer title', 240),
    cleanText(input.description, 'Offer description', 2000),
    cleanUrl(input.externalUrl, 'Affiliate destination URL'),
    country || null,
    status,
    disclosure,
    cleanText(input.evidenceRef, 'Offer evidence reference', 512),
  ]);
  saveDb();
  return (await getAffiliateOffer(id, true))!;
}

export async function updateAffiliateOffer(input: {
  id: string; title?: unknown; description?: unknown; externalUrl?: unknown; country?: unknown; disclosure?: unknown; evidenceRef?: unknown; status?: unknown;
}): Promise<AffiliateOffer> {
  const current = await getAffiliateOffer(input.id, true);
  if (!current) throw new Error('Affiliate offer not found');
  const merchant = await getAffiliateMerchant(current.merchantId);
  if (!merchant) throw new Error('Affiliate merchant not found');
  const status = input.status === undefined ? current.status : String(input.status) as AffiliateOfferStatus;
  if (!OFFER_STATUSES.has(status)) throw new Error('Unsupported affiliate offer status');
  if (status === 'active' && merchant.status !== 'active') throw new Error('An active affiliate offer requires an active evidence-backed merchant');
  const country = input.country === undefined ? current.country : (input.country ? cleanText(input.country, 'Offer country', 8).toLowerCase() : undefined);
  if (country && !/^[a-z]{2}$/.test(country)) throw new Error('Offer country must be an ISO country code');
  const db = await ensureAffiliateSchema();
  const row = await getOfferRow(current.id);
  if (!row) throw new Error('Affiliate offer not found');
  db.run(`UPDATE affiliate_offers SET title=?,description=?,external_url=?,country=?,status=?,disclosure=?,evidence_ref=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`, [
    input.title === undefined ? current.title : cleanText(input.title, 'Offer title', 240),
    input.description === undefined ? current.description : cleanText(input.description, 'Offer description', 2000),
    input.externalUrl === undefined ? String(row.external_url) : cleanUrl(input.externalUrl, 'Affiliate destination URL'),
    country || null,
    status,
    input.disclosure === undefined ? current.disclosure : cleanText(input.disclosure, 'Offer disclosure', 500),
    input.evidenceRef === undefined ? current.evidenceRef : cleanText(input.evidenceRef, 'Offer evidence reference', 512),
    current.id,
  ]);
  saveDb();
  return (await getAffiliateOffer(current.id, true))!;
}

export async function getAffiliateOffer(id: string, includeInactive = false): Promise<AffiliateOffer | undefined> {
  const row = await getOfferRow(id);
  if (!row) return undefined;
  if (!includeInactive && (row.status !== 'active' || row.merchant_status !== 'active')) return undefined;
  return offerFromRow(row, true);
}

export async function listPublicAffiliateOffers(country?: string): Promise<AffiliateOffer[]> {
  const normalizedCountry = country?.trim().toLowerCase();
  const db = await ensureAffiliateSchema();
  const stmt = db.prepare(`SELECT o.*, m.name AS merchant_name, m.status AS merchant_status, m.countries_json
    FROM affiliate_offers o JOIN affiliate_merchants m ON m.id=o.merchant_id
    WHERE o.status='active' AND m.status='active' ORDER BY o.updated_at DESC, o.created_at DESC`);
  const results: AffiliateOffer[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    const merchantCountries = parseCountries(row.countries_json);
    const offerCountry = row.country ? String(row.country) : undefined;
    if (normalizedCountry && offerCountry && offerCountry !== normalizedCountry) continue;
    if (normalizedCountry && !offerCountry && merchantCountries.length && !merchantCountries.includes(normalizedCountry)) continue;
    results.push(offerFromRow(row, true));
  }
  stmt.free();
  return results;
}

export async function recordAffiliateClick(input: { offerId: string; phone: string }): Promise<{ clickId: string; destinationUrl: string; offer: AffiliateOffer }> {
  const offer = await getAffiliateOffer(input.offerId);
  if (!offer) throw new Error('Active affiliate offer not found');
  const row = await getOfferRow(offer.id);
  if (!row) throw new Error('Active affiliate offer not found');
  const id = randomUUID();
  const db = await ensureAffiliateSchema();
  db.run(`INSERT INTO affiliate_click_events (id,offer_id,owner_hash,destination_url) VALUES (?,?,?,?)`, [
    id, offer.id, ownerHash(cleanText(input.phone, 'Authenticated identity', 128)), String(row.external_url),
  ]);
  saveDb();
  return { clickId: id, destinationUrl: String(row.external_url), offer };
}

export async function recordAffiliateConversion(input: {
  merchantId: unknown; offerId: unknown; clickId?: unknown; externalConversionRef: unknown; status?: unknown; commissionMinor?: unknown; currency?: unknown; evidenceRef: unknown; occurredAt?: unknown;
}): Promise<{ id: string; status: AffiliateConversionStatus; duplicate: boolean }> {
  const merchantId = cleanText(input.merchantId, 'Merchant id', 128);
  const offerId = cleanText(input.offerId, 'Offer id', 128);
  const merchant = await getAffiliateMerchant(merchantId);
  const offer = await getAffiliateOffer(offerId, true);
  if (!merchant || !offer || offer.merchantId !== merchant.id) throw new Error('Affiliate offer and merchant relationship is invalid');
  const externalConversionRef = cleanText(input.externalConversionRef, 'External conversion reference', 256);
  const evidenceRef = cleanText(input.evidenceRef, 'Conversion evidence reference', 512);
  const status = String(input.status || 'confirmed') as AffiliateConversionStatus;
  if (!CONVERSION_STATUSES.has(status)) throw new Error('Unsupported affiliate conversion status');
  const commissionMinor = input.commissionMinor === undefined || input.commissionMinor === null ? null : Number(input.commissionMinor);
  if (commissionMinor !== null && (!Number.isSafeInteger(commissionMinor) || commissionMinor < 0)) throw new Error('Commission must be a non-negative minor-unit integer');
  const currency = cleanCurrency(input.currency);
  const clickId = input.clickId === undefined || input.clickId === null || input.clickId === '' ? null : cleanText(input.clickId, 'Affiliate click id', 128);
  const db = await ensureAffiliateSchema();
  const existing = db.prepare(`SELECT id,status FROM affiliate_conversion_events WHERE external_conversion_ref=? LIMIT 1`);
  existing.bind([externalConversionRef]);
  const row = existing.step() ? existing.getAsObject() as Record<string, unknown> : undefined;
  existing.free();
  if (row) return { id: String(row.id), status: String(row.status) as AffiliateConversionStatus, duplicate: true };
  const id = randomUUID();
  const occurredAt = input.occurredAt === undefined || input.occurredAt === null || input.occurredAt === '' ? null : new Date(cleanText(input.occurredAt, 'Conversion occurrence', 64));
  if (occurredAt && Number.isNaN(occurredAt.getTime())) throw new Error('Conversion occurrence must be an ISO date');
  db.run(`INSERT INTO affiliate_conversion_events (id,merchant_id,offer_id,click_id,external_conversion_ref,status,commission_minor,currency,evidence_ref,occurred_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`, [id, merchantId, offerId, clickId, externalConversionRef, status, commissionMinor, currency || null, evidenceRef, occurredAt?.toISOString() || null]);
  saveDb();
  return { id, status, duplicate: false };
}

export async function getAffiliateMetrics(): Promise<{
  merchants: { active: number; inactive: number; suspended: number };
  offers: { active: number; inactive: number; expired: number; suspended: number };
  clicks: number;
  conversions: { confirmed: number; reversed: number };
  confirmedCommissionMinor: number;
  currency: string | null;
}> {
  const db = await ensureAffiliateSchema();
  const count = (sql: string, params: unknown[] = []): number => {
    const stmt = db.prepare(sql); stmt.bind(params); const value = stmt.step() ? Number(stmt.getAsObject().count || 0) : 0; stmt.free(); return value;
  };
  const merchantStatuses = { active: count(`SELECT COUNT(*) AS count FROM affiliate_merchants WHERE status='active'`), inactive: count(`SELECT COUNT(*) AS count FROM affiliate_merchants WHERE status='inactive'`), suspended: count(`SELECT COUNT(*) AS count FROM affiliate_merchants WHERE status='suspended'`) };
  const offerStatuses = { active: count(`SELECT COUNT(*) AS count FROM affiliate_offers WHERE status='active'`), inactive: count(`SELECT COUNT(*) AS count FROM affiliate_offers WHERE status='inactive'`), expired: count(`SELECT COUNT(*) AS count FROM affiliate_offers WHERE status='expired'`), suspended: count(`SELECT COUNT(*) AS count FROM affiliate_offers WHERE status='suspended'`) };
  const commission = db.prepare(`SELECT COALESCE(SUM(commission_minor),0) AS total, MIN(currency) AS currency, COUNT(*) AS confirmed FROM affiliate_conversion_events WHERE status='confirmed'`);
  const commissionRow = commission.step() ? commission.getAsObject() as Record<string, unknown> : {};
  commission.free();
  return {
    merchants: merchantStatuses,
    offers: offerStatuses,
    clicks: count(`SELECT COUNT(*) AS count FROM affiliate_click_events`),
    conversions: { confirmed: Number(commissionRow.confirmed || 0), reversed: count(`SELECT COUNT(*) AS count FROM affiliate_conversion_events WHERE status='reversed'`) },
    confirmedCommissionMinor: Number(commissionRow.total || 0),
    currency: commissionRow.currency ? String(commissionRow.currency) : null,
  };
}
