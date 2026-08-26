import crypto from 'node:crypto';
import { getCanonicalPersistenceMode } from './canonicalPersistence.js';
import { getCanonicalStore } from './canonicalStore.js';
import { persistCoordinatorEvent } from './coordinatorStore.js';

export type FulfilmentStatus =
  | 'draft'
  | 'gathering_requirements'
  | 'searching'
  | 'inquiry_pending'
  | 'offers_ready'
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'in_fulfillment'
  | 'fulfilled'
  | 'completed'
  | 'cancelled'
  | 'blocked'
  | 'failed';

export type OfferSource = 'catalogue' | 'provider_inquiry' | 'external_integration' | 'manual';
export type OfferStatus = 'candidate' | 'available' | 'unavailable' | 'expired' | 'selected' | 'rejected';
export type InquiryStatus = 'pending' | 'sent' | 'responded' | 'no_response' | 'declined' | 'expired' | 'cancelled';
export type EvidenceLevel = 'none' | 'source_attributed' | 'provider_confirmed' | 'externally_verified';
type FulfilmentLifecycleAction = 'created' | 'requirements_updated' | 'state_changed' | 'offer_created' | 'offer_selected' | 'provider_inquiry_created' | 'provider_response_recorded';

export interface FulfilmentRequirements {
  item?: string;
  description?: string;
  quantity?: number;
  unit?: string;
  location?: string;
  deliveryLocation?: string;
  timing?: string;
  budgetMinor?: number;
  currency?: string;
  preferences?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface Fulfilment {
  id: string;
  ownerPhone: string;
  skill: string;
  mechanism: string;
  economicRequestId?: string;
  status: FulfilmentStatus;
  requirements: FulfilmentRequirements;
  requiredInputs: string[];
  missingInputs: string[];
  selectedOfferId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Offer {
  id: string;
  fulfilmentId: string;
  ownerPhone: string;
  providerId?: string;
  providerPhone?: string;
  providerName?: string;
  title: string;
  description?: string;
  source: OfferSource;
  status: OfferStatus;
  priceMinor?: number;
  currency?: string;
  quantity?: number;
  unit?: string;
  availability?: string;
  location?: string;
  delivery?: string;
  validUntil?: string;
  evidenceLevel: EvidenceLevel;
  evidenceRef?: string;
  sourceRef?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderInquiry {
  id: string;
  fulfilmentId: string;
  ownerPhone: string;
  providerId?: string;
  providerPhone?: string;
  providerName?: string;
  question: string;
  requestedFields: string[];
  status: InquiryStatus;
  response?: Record<string, unknown>;
  evidenceLevel: EvidenceLevel;
  evidenceRef?: string;
  sentAt?: string;
  respondedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

function now(): string { return new Date().toISOString(); }
function json(value: unknown): string { return JSON.stringify(value ?? {}); }
function parseObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}
function parseArray(value: unknown): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch { return []; }
}

export async function ensureCanonicalFulfilmentSchema(): Promise<void> {
  const store = await getCanonicalStore();
  await store.run(`CREATE TABLE IF NOT EXISTS fulfilments (
    id TEXT PRIMARY KEY,
    owner_phone TEXT NOT NULL,
    skill TEXT NOT NULL,
    mechanism TEXT NOT NULL,
    economic_request_id TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    requirements_json TEXT NOT NULL DEFAULT '{}',
    required_inputs_json TEXT NOT NULL DEFAULT '[]',
    missing_inputs_json TEXT NOT NULL DEFAULT '[]',
    selected_offer_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await store.run(`CREATE TABLE IF NOT EXISTS fulfilment_offers (
    id TEXT PRIMARY KEY,
    fulfilment_id TEXT NOT NULL,
    owner_phone TEXT NOT NULL,
    provider_id TEXT,
    provider_phone TEXT,
    provider_name TEXT,
    title TEXT NOT NULL,
    description TEXT,
    source TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'candidate',
    price_minor INTEGER,
    currency TEXT,
    quantity REAL,
    unit TEXT,
    availability TEXT,
    location TEXT,
    delivery TEXT,
    valid_until TEXT,
    evidence_level TEXT NOT NULL DEFAULT 'none',
    evidence_ref TEXT,
    source_ref TEXT,
    metadata_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await store.run(`CREATE TABLE IF NOT EXISTS provider_inquiries (
    id TEXT PRIMARY KEY,
    fulfilment_id TEXT NOT NULL,
    owner_phone TEXT NOT NULL,
    provider_id TEXT,
    provider_phone TEXT,
    provider_name TEXT,
    question TEXT NOT NULL,
    requested_fields_json TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending',
    response_json TEXT,
    evidence_level TEXT NOT NULL DEFAULT 'none',
    evidence_ref TEXT,
    sent_at TEXT,
    responded_at TEXT,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await store.run(`CREATE INDEX IF NOT EXISTS idx_fulfilments_owner_status ON fulfilments(owner_phone,status,updated_at DESC)`);
  await store.run(`CREATE INDEX IF NOT EXISTS idx_fulfilments_request ON fulfilments(economic_request_id)`);
  await store.run(`CREATE INDEX IF NOT EXISTS idx_fulfilment_offers_owner ON fulfilment_offers(owner_phone,fulfilment_id,status,updated_at DESC)`);
  await store.run(`CREATE INDEX IF NOT EXISTS idx_provider_inquiries_owner ON provider_inquiries(owner_phone,fulfilment_id,status,updated_at DESC)`);
}

function rowToFulfilment(row: any): Fulfilment {
  return {
    id: String(row.id),
    ownerPhone: String(row.owner_phone),
    skill: String(row.skill),
    mechanism: String(row.mechanism),
    economicRequestId: row.economic_request_id ? String(row.economic_request_id) : undefined,
    status: String(row.status) as FulfilmentStatus,
    requirements: parseObject(row.requirements_json) as FulfilmentRequirements,
    requiredInputs: parseArray(row.required_inputs_json),
    missingInputs: parseArray(row.missing_inputs_json),
    selectedOfferId: row.selected_offer_id ? String(row.selected_offer_id) : undefined,
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

function rowToOffer(row: any): Offer {
  return {
    id: String(row.id),
    fulfilmentId: String(row.fulfilment_id),
    ownerPhone: String(row.owner_phone),
    providerId: row.provider_id ? String(row.provider_id) : undefined,
    providerPhone: row.provider_phone ? String(row.provider_phone) : undefined,
    providerName: row.provider_name ? String(row.provider_name) : undefined,
    title: String(row.title),
    description: row.description ? String(row.description) : undefined,
    source: String(row.source) as OfferSource,
    status: String(row.status) as OfferStatus,
    priceMinor: row.price_minor == null ? undefined : Number(row.price_minor),
    currency: row.currency ? String(row.currency) : undefined,
    quantity: row.quantity == null ? undefined : Number(row.quantity),
    unit: row.unit ? String(row.unit) : undefined,
    availability: row.availability ? String(row.availability) : undefined,
    location: row.location ? String(row.location) : undefined,
    delivery: row.delivery ? String(row.delivery) : undefined,
    validUntil: row.valid_until ? String(row.valid_until) : undefined,
    evidenceLevel: String(row.evidence_level) as EvidenceLevel,
    evidenceRef: row.evidence_ref ? String(row.evidence_ref) : undefined,
    sourceRef: row.source_ref ? String(row.source_ref) : undefined,
    metadata: parseObject(row.metadata_json),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

function rowToInquiry(row: any): ProviderInquiry {
  return {
    id: String(row.id),
    fulfilmentId: String(row.fulfilment_id),
    ownerPhone: String(row.owner_phone),
    providerId: row.provider_id ? String(row.provider_id) : undefined,
    providerPhone: row.provider_phone ? String(row.provider_phone) : undefined,
    providerName: row.provider_name ? String(row.provider_name) : undefined,
    question: String(row.question),
    requestedFields: parseArray(row.requested_fields_json),
    status: String(row.status) as InquiryStatus,
    response: parseObject(row.response_json),
    evidenceLevel: String(row.evidence_level) as EvidenceLevel,
    evidenceRef: row.evidence_ref ? String(row.evidence_ref) : undefined,
    sentAt: row.sent_at ? String(row.sent_at) : undefined,
    respondedAt: row.responded_at ? String(row.responded_at) : undefined,
    expiresAt: row.expires_at ? String(row.expires_at) : undefined,
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

async function assertOwner(store: Awaited<ReturnType<typeof getCanonicalStore>>, fulfilmentId: string, ownerPhone: string): Promise<Fulfilment> {
  const row = await store.one<any>('SELECT * FROM fulfilments WHERE id=? AND owner_phone=? LIMIT 1', [fulfilmentId, ownerPhone]);
  if (!row) throw new Error('Fulfilment not found');
  return rowToFulfilment(row);
}

async function lifecycleEvent(fulfilment: Fulfilment, action: FulfilmentLifecycleAction, payload: Record<string, unknown>): Promise<void> {
  await persistCoordinatorEvent({
    id: `fulfilment:${fulfilment.id}:${action}:${Date.now()}`,
    type: `fulfilment.${action}`,
    occurredAt: now(),
    producer: 'canonicalFulfilmentService',
    correlationId: `fulfilment:${fulfilment.id}`,
    ownerPhone: fulfilment.ownerPhone.startsWith('anon_') ? undefined : fulfilment.ownerPhone,
    economicRequestId: fulfilment.economicRequestId,
    payload: { fulfilmentId: fulfilment.id, ...payload },
    sensitivity: fulfilment.ownerPhone.startsWith('anon_') ? 'public' : 'personal',
    provenance: { source: 'canonical_service', sourceId: fulfilment.id, evidenceLevel: 'persisted_state' },
    policy: { autonomousAllowed: false, confirmationRequired: 'none' },
    schemaVersion: 1,
  });
}

export async function createFulfilment(input: {
  ownerPhone: string;
  skill: string;
  mechanism: string;
  requirements?: FulfilmentRequirements;
  requiredInputs?: string[];
  missingInputs?: string[];
  economicRequestId?: string;
  id?: string;
}): Promise<Fulfilment> {
  if (!input.ownerPhone) throw new Error('ownerPhone is required');
  await ensureCanonicalFulfilmentSchema();
  const id = input.id || crypto.randomUUID();
  const store = await getCanonicalStore();
  await store.run(`INSERT INTO fulfilments(id,owner_phone,skill,mechanism,economic_request_id,status,requirements_json,required_inputs_json,missing_inputs_json) VALUES(?,?,?,?,?,?,?,?,?)`, [
    id, input.ownerPhone, input.skill, input.mechanism, input.economicRequestId || null,
    input.missingInputs?.length ? 'gathering_requirements' : 'searching',
    json(input.requirements || {}), json(input.requiredInputs || []), json(input.missingInputs || []),
  ]);
  const fulfilment = (await getFulfilment(input.ownerPhone, id))!;
  await lifecycleEvent(fulfilment, 'created', { skill: fulfilment.skill, mechanism: fulfilment.mechanism, missingInputs: fulfilment.missingInputs });
  return fulfilment;
}

export async function getFulfilment(ownerPhone: string, id: string): Promise<Fulfilment | null> {
  await ensureCanonicalFulfilmentSchema();
  const row = await (await getCanonicalStore()).one<any>('SELECT * FROM fulfilments WHERE id=? AND owner_phone=? LIMIT 1', [id, ownerPhone]);
  return row ? rowToFulfilment(row) : null;
}

export async function getFulfilmentForEconomicRequest(ownerPhone: string, economicRequestId: string): Promise<Fulfilment | null> {
  await ensureCanonicalFulfilmentSchema();
  const requestId = String(economicRequestId || '').trim();
  if (!requestId) return null;
  const row = await (await getCanonicalStore()).one<any>('SELECT * FROM fulfilments WHERE owner_phone=? AND economic_request_id=? ORDER BY updated_at DESC LIMIT 1', [ownerPhone, requestId]);
  return row ? rowToFulfilment(row) : null;
}

export async function listFulfilments(ownerPhone: string, options: { includeClosed?: boolean; limit?: number } = {}): Promise<Fulfilment[]> {
  await ensureCanonicalFulfilmentSchema();
  const limit = Math.max(1, Math.min(100, Math.floor(Number(options.limit) || 50)));
  const store = await getCanonicalStore();
  const sql = options.includeClosed ? 'SELECT * FROM fulfilments WHERE owner_phone=? ORDER BY updated_at DESC LIMIT ?' : `SELECT * FROM fulfilments WHERE owner_phone=? AND status NOT IN ('completed','cancelled','failed') ORDER BY updated_at DESC LIMIT ?`;
  return (await store.all<any>(sql, [ownerPhone, limit])).map(rowToFulfilment);
}

export async function updateFulfilmentRequirements(ownerPhone: string, id: string, patch: FulfilmentRequirements, missingInputs: string[] = []): Promise<Fulfilment> {
  await ensureCanonicalFulfilmentSchema();
  const store = await getCanonicalStore();
  const current = await assertOwner(store, id, ownerPhone);
  const merged = { ...current.requirements, ...patch };
  const status: FulfilmentStatus = missingInputs.length ? 'gathering_requirements' : 'searching';
  await store.run('UPDATE fulfilments SET requirements_json=?,missing_inputs_json=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_phone=?', [json(merged), json(missingInputs), status, id, ownerPhone]);
  const updated = (await getFulfilment(ownerPhone, id))!;
  await lifecycleEvent(updated, 'requirements_updated', { keys: Object.keys(patch), missingInputs });
  return updated;
}

export async function transitionFulfilment(ownerPhone: string, id: string, status: FulfilmentStatus): Promise<Fulfilment> {
  await ensureCanonicalFulfilmentSchema();
  const store = await getCanonicalStore();
  const current = await assertOwner(store, id, ownerPhone);
  await store.run('UPDATE fulfilments SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_phone=?', [status, id, ownerPhone]);
  const updated = (await getFulfilment(ownerPhone, id))!;
  await lifecycleEvent(updated, 'state_changed', { fromStatus: current.status, toStatus: status });
  return updated;
}

export async function createOffer(input: Omit<Offer, 'createdAt' | 'updatedAt' | 'status' | 'id'> & { id?: string; status?: OfferStatus }): Promise<Offer> {
  await ensureCanonicalFulfilmentSchema();
  const store = await getCanonicalStore();
  await assertOwner(store, input.fulfilmentId, input.ownerPhone);
  const id = input.id || crypto.randomUUID();
  await store.run(`INSERT INTO fulfilment_offers(id,fulfilment_id,owner_phone,provider_id,provider_phone,provider_name,title,description,source,status,price_minor,currency,quantity,unit,availability,location,delivery,valid_until,evidence_level,evidence_ref,source_ref,metadata_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    id,input.fulfilmentId,input.ownerPhone,input.providerId||null,input.providerPhone||null,input.providerName||null,input.title,input.description||null,input.source,input.status||'candidate',input.priceMinor??null,input.currency||null,input.quantity??null,input.unit||null,input.availability||null,input.location||null,input.delivery||null,input.validUntil||null,input.evidenceLevel,input.evidenceRef||null,input.sourceRef||null,json(input.metadata||{}),
  ]);
  const row = await store.one<any>('SELECT * FROM fulfilment_offers WHERE id=? AND owner_phone=? LIMIT 1', [id, input.ownerPhone]);
  const offer = rowToOffer(row);
  const fulfilment = (await getFulfilment(input.ownerPhone, input.fulfilmentId))!;
  await lifecycleEvent(fulfilment, 'offer_created', { offerId: offer.id, source: offer.source, providerId: offer.providerId, evidenceLevel: offer.evidenceLevel });
  if (['available','candidate'].includes(offer.status)) await transitionFulfilment(input.ownerPhone, input.fulfilmentId, 'offers_ready');
  return offer;
}

export async function listOffers(ownerPhone: string, fulfilmentId: string, options: { status?: OfferStatus; limit?: number } = {}): Promise<Offer[]> {
  await ensureCanonicalFulfilmentSchema();
  const store = await getCanonicalStore();
  await assertOwner(store, fulfilmentId, ownerPhone);
  const limit = Math.max(1, Math.min(100, Math.floor(Number(options.limit) || 50)));
  const sql = options.status ? 'SELECT * FROM fulfilment_offers WHERE fulfilment_id=? AND owner_phone=? AND status=? ORDER BY updated_at DESC LIMIT ?' : 'SELECT * FROM fulfilment_offers WHERE fulfilment_id=? AND owner_phone=? ORDER BY updated_at DESC LIMIT ?';
  const args = options.status ? [fulfilmentId, ownerPhone, options.status, limit] : [fulfilmentId, ownerPhone, limit];
  return (await store.all<any>(sql, args)).map(rowToOffer);
}

export async function selectOffer(ownerPhone: string, fulfilmentId: string, offerId: string): Promise<{ fulfilment: Fulfilment; offer: Offer }> {
  await ensureCanonicalFulfilmentSchema();
  const store = await getCanonicalStore();
  const fulfilment = await assertOwner(store, fulfilmentId, ownerPhone);
  const row = await store.one<any>('SELECT * FROM fulfilment_offers WHERE id=? AND fulfilment_id=? AND owner_phone=? LIMIT 1', [offerId, fulfilmentId, ownerPhone]);
  if (!row) throw new Error('Offer not found');
  await store.run('UPDATE fulfilment_offers SET status=CASE WHEN id=? THEN \'selected\' ELSE CASE WHEN status=\'selected\' THEN \'available\' ELSE status END END,updated_at=CURRENT_TIMESTAMP WHERE fulfilment_id=? AND owner_phone=?', [offerId, fulfilmentId, ownerPhone]);
  await store.run('UPDATE fulfilments SET selected_offer_id=?,status=\'awaiting_confirmation\',updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_phone=?', [offerId, fulfilmentId, ownerPhone]);
  const selected = rowToOffer((await store.one<any>('SELECT * FROM fulfilment_offers WHERE id=?', [offerId]))!);
  const updated = (await getFulfilment(ownerPhone, fulfilmentId))!;
  await lifecycleEvent(updated, 'offer_selected', { offerId, awaitingConfirmation: true });
  return { fulfilment: updated, offer: selected };
}

export async function createProviderInquiry(input: { fulfilmentId: string; ownerPhone: string; providerId?: string; providerPhone?: string; providerName?: string; question: string; requestedFields?: string[]; expiresAt?: string; id?: string }): Promise<ProviderInquiry> {
  await ensureCanonicalFulfilmentSchema();
  const store = await getCanonicalStore();
  const fulfilment = await assertOwner(store, input.fulfilmentId, input.ownerPhone);
  const id = input.id || crypto.randomUUID();
  await store.run(`INSERT INTO provider_inquiries(id,fulfilment_id,owner_phone,provider_id,provider_phone,provider_name,question,requested_fields_json,status,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)`, [id,input.fulfilmentId,input.ownerPhone,input.providerId||null,input.providerPhone||null,input.providerName||null,input.question,json(input.requestedFields||[]),'pending',input.expiresAt||null]);
  await transitionFulfilment(input.ownerPhone, input.fulfilmentId, 'inquiry_pending');
  const row = await store.one<any>('SELECT * FROM provider_inquiries WHERE id=? AND owner_phone=? LIMIT 1', [id,input.ownerPhone]);
  const inquiry = rowToInquiry(row);
  await lifecycleEvent(fulfilment, 'provider_inquiry_created', { inquiryId:id, providerId:input.providerId, requestedFields:input.requestedFields||[] });
  return inquiry;
}

export async function getOpenProviderInquiry(ownerPhone: string, fulfilmentId: string, providerPhone?: string): Promise<ProviderInquiry | null> {
  await ensureCanonicalFulfilmentSchema();
  const store = await getCanonicalStore();
  const sql = providerPhone
    ? "SELECT * FROM provider_inquiries WHERE owner_phone=? AND fulfilment_id=? AND provider_phone=? AND status IN ('pending','sent') ORDER BY updated_at DESC LIMIT 1"
    : "SELECT * FROM provider_inquiries WHERE owner_phone=? AND fulfilment_id=? AND status IN ('pending','sent') ORDER BY updated_at DESC LIMIT 1";
  const args = providerPhone ? [ownerPhone, fulfilmentId, providerPhone] : [ownerPhone, fulfilmentId];
  const row = await store.one<any>(sql, args);
  return row ? rowToInquiry(row) : null;
}

export async function markProviderInquirySent(ownerPhone: string, inquiryId: string): Promise<ProviderInquiry> {
  await ensureCanonicalFulfilmentSchema();
  const store = await getCanonicalStore();
  const row = await store.one<any>('SELECT * FROM provider_inquiries WHERE id=? AND owner_phone=? LIMIT 1',[inquiryId,ownerPhone]);
  if (!row) throw new Error('Provider inquiry not found');
  await store.run('UPDATE provider_inquiries SET status=\'sent\',sent_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_phone=?',[now(),inquiryId,ownerPhone]);
  return rowToInquiry((await store.one<any>('SELECT * FROM provider_inquiries WHERE id=? AND owner_phone=?',[inquiryId,ownerPhone]))!);
}

export async function recordProviderInquiryResponse(input: { ownerPhone: string; inquiryId: string; response: Record<string, unknown>; evidenceLevel?: EvidenceLevel; evidenceRef?: string; offer?: Omit<Offer, 'fulfilmentId' | 'ownerPhone' | 'createdAt' | 'updatedAt' | 'status' | 'id'> }): Promise<{ inquiry: ProviderInquiry; offer?: Offer }> {
  await ensureCanonicalFulfilmentSchema();
  const store = await getCanonicalStore();
  const row = await store.one<any>('SELECT * FROM provider_inquiries WHERE id=? AND owner_phone=? LIMIT 1',[input.inquiryId,input.ownerPhone]);
  if (!row) throw new Error('Provider inquiry not found');
  const responseEvidence = input.evidenceLevel || 'provider_confirmed';
  await store.run('UPDATE provider_inquiries SET status=\'responded\',response_json=?,evidence_level=?,evidence_ref=?,responded_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_phone=?',[json(input.response),responseEvidence,input.evidenceRef||null,now(),input.inquiryId,input.ownerPhone]);
  const inquiry = rowToInquiry((await store.one<any>('SELECT * FROM provider_inquiries WHERE id=? AND owner_phone=?',[input.inquiryId,input.ownerPhone]))!);
  let offer: Offer | undefined;
  const fulfilment = (await getFulfilment(input.ownerPhone, inquiry.fulfilmentId))!;
  if (input.offer) {
    offer = await createOffer({ ...input.offer, fulfilmentId: inquiry.fulfilmentId, ownerPhone: input.ownerPhone, source: 'provider_inquiry', evidenceLevel: responseEvidence, evidenceRef: input.evidenceRef || input.inquiryId });
  }
  await lifecycleEvent(fulfilment, 'provider_response_recorded', { inquiryId:input.inquiryId, evidenceLevel:responseEvidence, offerId:offer?.id });
  return { inquiry, offer };
}

export function rankOffers(offers: Offer[], preference: { maxPriceMinor?: number; preferredProviderId?: string; location?: string } = {}): Offer[] {
  return [...offers].filter(offer => offer.status !== 'unavailable' && offer.status !== 'expired').sort((a,b) => {
    const score = (offer: Offer): number => {
      let value = 0;
      if (offer.evidenceLevel === 'externally_verified') value += 40;
      else if (offer.evidenceLevel === 'provider_confirmed') value += 30;
      else if (offer.evidenceLevel === 'source_attributed') value += 10;
      if (preference.preferredProviderId && offer.providerId === preference.preferredProviderId) value += 15;
      if (preference.maxPriceMinor != null && offer.priceMinor != null && offer.priceMinor <= preference.maxPriceMinor) value += 10;
      if (preference.location && offer.location && offer.location.toLowerCase().includes(preference.location.toLowerCase())) value += 5;
      if (offer.priceMinor != null) value += Math.max(0, 20 - Math.min(20, offer.priceMinor / 100000));
      return value;
    };
    return score(b) - score(a);
  });
}

export function buildProviderInquiryQuestion(input: { item: string; quantity?: number; unit?: string; location?: string; timing?: string; extra?: Record<string, unknown> }): string {
  const quantity = input.quantity != null ? `${input.quantity}${input.unit ? ` ${input.unit}` : ''}` : 'the requested quantity';
  const location = input.location ? ` for ${input.location}` : '';
  const timing = input.timing ? ` for ${input.timing}` : '';
  const extra = Object.entries(input.extra || {}).map(([key,value]) => `${key}: ${String(value)}`).join('; ');
  return `A Kurukoo customer wants ${quantity} of ${input.item}${location}${timing}. Do you currently have this available, and what is your price?${extra ? ` Additional details: ${extra}` : ''}`;
}

export function fulfilmentSupportsProviderInquiry(mechanism: string): boolean {
  return ['marketplace_purchase','service_request','booking','procurement','local_discovery','provider_dispatch'].includes(mechanism);
}

export function canonicalFulfilmentPersistenceMode(): 'canonical' {
  return getCanonicalPersistenceMode() === 'postgres' ? 'canonical' : 'canonical';
}
