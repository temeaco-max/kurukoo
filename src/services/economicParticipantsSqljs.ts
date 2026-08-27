import crypto from 'crypto';
import { getDb, saveDb } from '../database.js';
import { createEconomicRequest, getEconomicRequest, type EconomicRequest } from './skillFlows.js';
import { validateCustodyEvidenceUpdate } from './custodyEvidence.js';
import { find_worker, type FindWorkerResult } from './find-worker.js';
import { persistCoordinatorEvent } from './coordinatorStore.js';

export const ECONOMIC_PARTICIPANT_ROLES = [
  'seller',
  'delivery_provider',
  'service_provider',
  'external_platform',
  'agent',
] as const;

export type EconomicParticipantRole = typeof ECONOMIC_PARTICIPANT_ROLES[number];

export const ECONOMIC_PARTICIPANT_STATUSES = [
  'invited',
  'offered',
  'selected',
  'confirmed',
  'handover_pending',
  'handed_over',
  'collected',
  'in_progress',
  'completion_reported',
  'delivered',
  'declined',
  'withdrawn',
] as const;

export type EconomicParticipantStatus = typeof ECONOMIC_PARTICIPANT_STATUSES[number];

export const ECONOMIC_OFFER_STATUSES = ['available', 'unavailable', 'reserved', 'withdrawn', 'expired'] as const;
export type EconomicOfferStatus = typeof ECONOMIC_OFFER_STATUSES[number];
export const ECONOMIC_OFFER_PROVENANCE = ['seller_created', 'externally_sourced', 'affiliate_derived', 'conversationally_created'] as const;
export type EconomicOfferProvenance = typeof ECONOMIC_OFFER_PROVENANCE[number];

export interface EconomicOffer {
  id: string;
  requestId: string;
  sellerPhone: string;
  description: string;
  priceMinor: number | null;
  currency: string;
  source: string;
  availabilityNote: string | null;
  externalSource: string | null;
  status: EconomicOfferStatus;
  provenance: EconomicOfferProvenance;
  mediaReference: string | null;
  externalUrl: string | null;
  originOfferId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface EconomicParticipant {
  id: number;
  requestId: string;
  role: EconomicParticipantRole;
  providerPhone: string;
  capability: string;
  status: EconomicParticipantStatus;
  evidence: Record<string, unknown>;
  addedAt: string | null;
}

const ROLE_SET = new Set<string>(ECONOMIC_PARTICIPANT_ROLES);
const STATUS_SET = new Set<string>(ECONOMIC_PARTICIPANT_STATUSES);
const OFFER_STATUS_SET = new Set<string>(ECONOMIC_OFFER_STATUSES);
const OFFER_PROVENANCE_SET = new Set<string>(ECONOMIC_OFFER_PROVENANCE);

function cleanText(value: unknown, field: string, maxLength = 1000): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${field} is too long`);
  return text;
}

function cleanOptionalText(value: unknown, field: string, maxLength = 2000): string | null {
  if (value === undefined || value === null || value === '') return null;
  return cleanText(value, field, maxLength);
}

function cleanEvidence(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Evidence must be an object');
  return value as Record<string, unknown>;
}

function parseEvidence(value: unknown): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function normalizeRole(value: unknown): EconomicParticipantRole {
  const role = cleanText(value, 'Participant role', 64);
  if (!ROLE_SET.has(role)) throw new Error('Unsupported participant role');
  return role as EconomicParticipantRole;
}

function normalizeStatus(value: unknown): EconomicParticipantStatus {
  const status = cleanText(value, 'Participant status', 64);
  if (!STATUS_SET.has(status)) throw new Error('Unsupported participant status');
  return status as EconomicParticipantStatus;
}

function normalizeOfferStatus(value: unknown): EconomicOfferStatus {
  const status = cleanText(value, 'Offer status', 64);
  if (!OFFER_STATUS_SET.has(status)) throw new Error('Unsupported offer status');
  return status as EconomicOfferStatus;
}

function normalizeOfferProvenance(value: unknown): EconomicOfferProvenance {
  const provenance = cleanText(value, 'Offer provenance', 64);
  if (!OFFER_PROVENANCE_SET.has(provenance)) throw new Error('Unsupported offer provenance');
  return provenance as EconomicOfferProvenance;
}

function offerFromRow(row: any): EconomicOffer {
  return {
    id: String(row.id),
    requestId: String(row.request_id),
    sellerPhone: String(row.seller_phone),
    description: String(row.description),
    priceMinor: row.price_minor === null || row.price_minor === undefined ? null : Number(row.price_minor),
    currency: String(row.currency || 'NGN'),
    source: String(row.source),
    availabilityNote: row.availability_note ? String(row.availability_note) : null,
    externalSource: row.external_source ? String(row.external_source) : null,
    status: String(row.status || 'available') as EconomicOfferStatus,
    provenance: String(row.provenance || 'conversationally_created') as EconomicOfferProvenance,
    mediaReference: row.media_reference ? String(row.media_reference) : null,
    externalUrl: row.external_url ? String(row.external_url) : null,
    originOfferId: row.origin_offer_id ? String(row.origin_offer_id) : null,
    createdAt: row.created_at ? String(row.created_at) : null,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

function participantFromRow(row: any): EconomicParticipant {
  return {
    id: Number(row.id),
    requestId: String(row.request_id),
    role: String(row.role) as EconomicParticipantRole,
    providerPhone: String(row.provider_phone),
    capability: String(row.capability),
    status: String(row.status) as EconomicParticipantStatus,
    evidence: parseEvidence(row.evidence_json),
    addedAt: row.added_at ? String(row.added_at) : null,
  };
}

async function requireRequestOwner(requestId: string, ownerPhone: string): Promise<void> {
  const request = await getEconomicRequest(requestId);
  if (!request) throw new Error('Economic request not found');
  if (request.phone !== ownerPhone) throw new Error('Economic request ownership is required');
}

async function requireVerifiedProvider(phone: string): Promise<void> {
  const db = await getDb();
  const stmt = db.prepare('SELECT verified_provider FROM memory_profiles WHERE phone=? LIMIT 1');
  stmt.bind([phone]);
  const verified = stmt.step() ? Number(stmt.getAsObject().verified_provider) === 1 : false;
  stmt.free();
  if (!verified) throw new Error('A verified provider is required for this participant role');
}

async function requireRegisteredAgent(agentId: string): Promise<void> {
  const db = await getDb();
  const stmt = db.prepare('SELECT id FROM ai_agents WHERE id=? LIMIT 1');
  stmt.bind([agentId]);
  const exists = stmt.step();
  stmt.free();
  if (!exists) throw new Error('A registered AI agent is required for the agent participant role');
}

/**
 * Attach an informational seller offer to one canonical Economic Request.
 * Its item price never replaces the request quote or changes escrow settlement.
 */
export async function attachEconomicOffer(input: {
  requestId: string;
  ownerPhone: string;
  id: string;
  sellerPhone: string;
  description: string;
  priceMinor?: number | null;
  currency?: string;
  source: string;
  availabilityNote?: string | null;
  externalSource?: string | null;
  status?: EconomicOfferStatus;
  provenance?: EconomicOfferProvenance;
  mediaReference?: string | null;
  externalUrl?: string | null;
  originOfferId?: string | null;
}): Promise<EconomicOffer> {
  await requireRequestOwner(cleanText(input.requestId, 'Request id', 128), cleanText(input.ownerPhone, 'Owner phone', 128));
  const sellerPhone = cleanText(input.sellerPhone, 'Seller phone', 128);
  await requireVerifiedProvider(sellerPhone);
  const priceMinor = input.priceMinor === undefined || input.priceMinor === null ? null : input.priceMinor;
  if (priceMinor !== null && (!Number.isInteger(priceMinor) || priceMinor < 0)) throw new Error('Offer price must be a non-negative integer amount in minor units');
  const db = await getDb();
  db.run(
    `INSERT INTO economic_offers (id,request_id,seller_phone,description,price_minor,currency,source,availability_note,external_source,status,provenance,media_reference,external_url,origin_offer_id,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
     ON CONFLICT(request_id) DO UPDATE SET
       id=excluded.id,
       seller_phone=excluded.seller_phone,
       description=excluded.description,
       price_minor=excluded.price_minor,
       currency=excluded.currency,
       source=excluded.source,
       availability_note=excluded.availability_note,
       external_source=excluded.external_source,
       status=excluded.status,
       provenance=excluded.provenance,
       media_reference=excluded.media_reference,
       external_url=excluded.external_url,
       origin_offer_id=excluded.origin_offer_id,
       updated_at=CURRENT_TIMESTAMP`,
    [
      cleanText(input.id, 'Offer id', 128),
      input.requestId,
      sellerPhone,
      cleanText(input.description, 'Offer description', 2000),
      priceMinor,
      cleanOptionalText(input.currency ?? 'NGN', 'Offer currency', 16) || 'NGN',
      cleanText(input.source, 'Offer source', 128),
      cleanOptionalText(input.availabilityNote, 'Availability note'),
      cleanOptionalText(input.externalSource, 'External source'),
      input.status === undefined ? 'available' : normalizeOfferStatus(input.status),
      input.provenance === undefined ? 'conversationally_created' : normalizeOfferProvenance(input.provenance),
      cleanOptionalText(input.mediaReference, 'Offer media reference'),
      cleanOptionalText(input.externalUrl, 'Offer external URL'),
      cleanOptionalText(input.originOfferId, 'Origin offer id', 128),
    ],
  );
  saveDb();
  const request = await getEconomicRequest(input.requestId);
  await persistCoordinatorEvent({
    id: `provider-offer:${input.id}:${Date.now()}`,
    type: 'provider.offer.received',
    occurredAt: new Date().toISOString(),
    producer: 'economicParticipants',
    correlationId: `economic_request:${input.requestId}`,
    ownerPhone: request?.phone?.startsWith('anon_') ? undefined : request?.phone,
    economicRequestId: input.requestId,
    payload: { offerId: input.id, sellerPhone, description: String(input.description).slice(0, 240), priceMinor: priceMinor ?? undefined, currency: input.currency || 'NGN', status: input.status || 'available', provenance: input.provenance || 'conversationally_created', verifiedSeller: true, availabilityClaim: input.availabilityNote || undefined },
    sensitivity: request?.phone?.startsWith('anon_') ? 'public' : 'personal',
    provenance: { source: 'canonical_service', sourceId: input.id, evidenceLevel: 'persisted_state' },
    policy: { autonomousAllowed: false, confirmationRequired: 'none' },
    schemaVersion: 1,
  });
  return (await getEconomicOffer(input.requestId))!;
}

/**
 * Add or update a named provider participant. Verification is required for
 * seller, delivery-provider, service-provider, and external-platform roles; an AI agent remains
 * representable for orchestration but receives no fulfillment or payment rights.
 */
export async function addEconomicParticipant(input: {
  requestId: string;
  ownerPhone: string;
  role: EconomicParticipantRole;
  providerPhone: string;
  capability: string;
  status?: EconomicParticipantStatus;
  evidence?: Record<string, unknown>;
}): Promise<EconomicParticipant> {
  const requestId = cleanText(input.requestId, 'Request id', 128);
  await requireRequestOwner(requestId, cleanText(input.ownerPhone, 'Owner phone', 128));
  const role = normalizeRole(input.role);
  const providerPhone = cleanText(input.providerPhone, 'Provider phone', 128);
  if (role === 'agent') await requireRegisteredAgent(providerPhone);
  else await requireVerifiedProvider(providerPhone);
  const status = input.status === undefined ? 'invited' : normalizeStatus(input.status);
  const db = await getDb();
  db.run(
    `INSERT INTO economic_participants (request_id,role,provider_phone,capability,status,evidence_json)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(request_id,role,provider_phone) DO UPDATE SET
       capability=excluded.capability,
       status=excluded.status,
       evidence_json=excluded.evidence_json`,
    [requestId, role, providerPhone, cleanText(input.capability, 'Participant capability', 500), status, JSON.stringify(cleanEvidence(input.evidence))],
  );
  saveDb();
  return (await getEconomicParticipants(requestId)).find((participant) => participant.role === role && participant.providerPhone === providerPhone)!;
}

export interface KnownEconomicOffer extends EconomicOffer {
  sellerName: string;
  sellerVerified: boolean;
}

function knownOfferFromRow(row: any): KnownEconomicOffer {
  return {
    ...offerFromRow(row),
    sellerName: String(row.seller_name || 'Verified seller'),
    sellerVerified: Number(row.verified_provider || 0) === 1,
  };
}

function offerSearchTerms(query: string): string[] {
  return Array.from(new Set(query.toLowerCase().match(/[a-z0-9]{3,}/g) || []))
    .filter((term) => !new Set(['want', 'need', 'with', 'from', 'that', 'this', 'listing', 'offer']).has(term))
    .slice(0, 8);
}

/**
 * Resolve an offer only from verified sellers and only while the seller has
 * explicitly marked it available. This is a commercial reference lookup, not
 * an inventory or external marketplace connector.
 */
export async function searchKnownEconomicOffers(query: string, limit = 5): Promise<KnownEconomicOffer[]> {
  const terms = offerSearchTerms(query);
  if (!terms.length) return [];
  const db = await getDb();
  const stmt = db.prepare(`
    SELECT e.*, m.name AS seller_name, m.verified_provider
    FROM economic_offers e
    JOIN memory_profiles m ON m.phone=e.seller_phone
    WHERE e.status='available' AND COALESCE(m.verified_provider, 0)=1
    ORDER BY e.updated_at DESC, e.created_at DESC
    LIMIT 50
  `);
  const matches: Array<{ offer: KnownEconomicOffer; score: number }> = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    const offer = knownOfferFromRow(row);
    const haystack = `${offer.description} ${offer.sellerName} ${offer.source} ${offer.availabilityNote || ''}`.toLowerCase();
    const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
    if (score > 0) matches.push({ offer, score });
  }
  stmt.free();
  return matches
    .sort((a, b) => b.score - a.score || String(b.offer.updatedAt || '').localeCompare(String(a.offer.updatedAt || '')))
    .slice(0, Math.min(Math.max(limit, 1), 10))
    .map(({ offer }) => offer);
}

async function getKnownEconomicOffer(id: string): Promise<KnownEconomicOffer | null> {
  const db = await getDb();
  const stmt = db.prepare(`
    SELECT e.*, m.name AS seller_name, m.verified_provider
    FROM economic_offers e
    JOIN memory_profiles m ON m.phone=e.seller_phone
    WHERE e.id=? AND e.status='available' AND COALESCE(m.verified_provider, 0)=1
    LIMIT 1
  `);
  stmt.bind([cleanText(id, 'Offer id', 128)]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row ? knownOfferFromRow(row) : null;
}

/**
 * Start one canonical product-sourcing request from a known offer, snapshotting
 * the commercial reference onto the buyer's request. It does not reserve stock,
 * dispatch delivery, or create seller/delivery split settlement.
 */
export async function startKnownOfferEconomicRequest(input: {
  buyerPhone: string;
  offerId: string;
  deliveryRequired?: boolean;
  deliveryLocation?: string;
  quantity?: string;
}): Promise<{ request: EconomicRequest; offer: EconomicOffer; seller: EconomicParticipant }> {
  const buyerPhone = cleanText(input.buyerPhone, 'Buyer phone', 128);
  const sourceOffer = await getKnownEconomicOffer(input.offerId);
  if (!sourceOffer) throw new Error('Known available offer not found');
  const request = await createEconomicRequest({
    id: crypto.randomUUID(),
    phone: buyerPhone,
    skill: 'product_sourcing',
    requirements: {
      product: sourceOffer.description,
      quantity: cleanOptionalText(input.quantity, 'Quantity', 128) || undefined,
      location: cleanOptionalText(input.deliveryLocation, 'Delivery location', 500) || undefined,
      offer_id: sourceOffer.id,
      seller_reference: sourceOffer.sellerPhone,
      delivery_required: input.deliveryRequired === true ? 'yes' : input.deliveryRequired === false ? 'no' : 'unknown',
      offer_status: sourceOffer.status,
    },
  });
  const offer = await attachEconomicOffer({
    requestId: request.id,
    ownerPhone: buyerPhone,
    id: crypto.randomUUID(),
    sellerPhone: sourceOffer.sellerPhone,
    description: sourceOffer.description,
    priceMinor: sourceOffer.priceMinor,
    currency: sourceOffer.currency,
    source: 'known_offer_reference',
    availabilityNote: sourceOffer.availabilityNote,
    externalSource: sourceOffer.externalSource,
    status: sourceOffer.status,
    provenance: sourceOffer.provenance,
    mediaReference: sourceOffer.mediaReference,
    externalUrl: sourceOffer.externalUrl,
    originOfferId: sourceOffer.id,
  });
  const seller = await addEconomicParticipant({
    requestId: request.id,
    ownerPhone: buyerPhone,
    role: 'seller',
    providerPhone: sourceOffer.sellerPhone,
    capability: 'seller_offer',
    status: 'offered',
    evidence: {
      offer_reference: sourceOffer.id,
      offer_provenance: sourceOffer.provenance,
      availability_statement: sourceOffer.availabilityNote || 'No availability statement supplied',
      integration_status: 'not_configured',
    },
  });
  return { request: (await getEconomicRequest(request.id))!, offer, seller };
}

/** Return verified providers who declare the existing delivery capability. */
export async function getDeliveryCandidates(input: { requestId: string; ownerPhone: string; max?: number }): Promise<FindWorkerResult> {
  const requestId = cleanText(input.requestId, 'Request id', 128);
  await requireRequestOwner(requestId, cleanText(input.ownerPhone, 'Owner phone', 128));
  const request = await getEconomicRequest(requestId);
  const location = typeof request?.requirements.location === 'string' ? request.requirements.location : undefined;
  return find_worker({ skill: 'delivery', location, max: Math.min(Math.max(input.max || 5, 1), 10) });
}

/** Record a buyer choice from the existing verified delivery-provider matches. */
export async function selectDeliveryCandidate(input: { requestId: string; ownerPhone: string; providerPhone: string }): Promise<EconomicParticipant> {
  const candidates = await getDeliveryCandidates({ requestId: input.requestId, ownerPhone: input.ownerPhone, max: 10 });
  const provider = candidates.providers.find((candidate) => candidate.phone === cleanText(input.providerPhone, 'Delivery provider phone', 128));
  if (!provider) throw new Error('Delivery provider is not an eligible current match');
  return addEconomicParticipant({
    requestId: input.requestId,
    ownerPhone: input.ownerPhone,
    role: 'delivery_provider',
    providerPhone: provider.phone,
    capability: 'delivery',
    status: 'selected',
    evidence: {
      selected_by: 'buyer',
      matching_skill: 'delivery',
      provider_listed_rate_minor: provider.hourly_rate > 0 ? Math.round(provider.hourly_rate) : null,
      integration_status: 'not_configured',
    },
  });
}

export async function getEconomicOffer(requestId: string): Promise<EconomicOffer | null> {
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM economic_offers WHERE request_id=? LIMIT 1');
  stmt.bind([requestId]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row ? offerFromRow(row) : null;
}

export async function getEconomicParticipants(requestId: string): Promise<EconomicParticipant[]> {
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM economic_participants WHERE request_id=? ORDER BY added_at ASC, id ASC');
  stmt.bind([requestId]);
  const participants: EconomicParticipant[] = [];
  while (stmt.step()) participants.push(participantFromRow(stmt.getAsObject()));
  stmt.free();
  return participants;
}

/**
 * Store role-specific evidence and coordination status without mutating the
 * canonical request lifecycle, escrow recipient, payment state, or quote.
 */
export async function updateEconomicParticipant(input: {
  requestId: string;
  ownerPhone?: string;
  actorPhone?: string;
  role: EconomicParticipantRole;
  providerPhone: string;
  status?: EconomicParticipantStatus;
  evidence?: Record<string, unknown>;
}): Promise<EconomicParticipant> {
  const requestId = cleanText(input.requestId, 'Request id', 128);
  const actorPhone = cleanText(input.actorPhone ?? input.ownerPhone, 'Authenticated actor phone', 128);
  const request = await getEconomicRequest(requestId);
  if (!request) throw new Error('Economic request not found');
  const role = normalizeRole(input.role);
  const providerPhone = cleanText(input.providerPhone, 'Provider phone', 128);
  const db = await getDb();
  const existing = db.prepare('SELECT * FROM economic_participants WHERE request_id=? AND role=? AND provider_phone=? LIMIT 1');
  existing.bind([requestId, role, providerPhone]);
  const row = existing.step() ? existing.getAsObject() : null;
  existing.free();
  if (!row) throw new Error('Economic participant not found');
  const isOwner = request.phone === actorPhone;
  const isDirectParticipant = role !== 'agent' && providerPhone === actorPhone;
  if (!isOwner && !isDirectParticipant) throw new Error('Request ownership or participant identity is required');
  const status = input.status === undefined ? String(row.status) as EconomicParticipantStatus : normalizeStatus(input.status);
  const submittedEvidence = cleanEvidence(input.evidence);
  validateCustodyEvidenceUpdate({ role, status, isOwner, isDirectParticipant, evidence: submittedEvidence });
  const priorEvidence = parseEvidence(row.evidence_json);
  const priorSubmissions = Array.isArray(priorEvidence._submissions) ? priorEvidence._submissions.slice(-19) : [];
  const evidence = {
    ...priorEvidence,
    ...submittedEvidence,
    _submissions: [
      ...priorSubmissions,
      {
        actor_phone: actorPhone,
        actor_scope: isOwner ? 'request_owner' : 'participant',
        submitted_at: new Date().toISOString(),
        status,
        verification: 'submitted_unverified',
      },
    ],
  };
  db.run(
    'UPDATE economic_participants SET status=?, evidence_json=? WHERE id=?',
    [status, JSON.stringify(evidence), Number(row.id)],
  );
  saveDb();
  if (!isOwner && String(row.status) !== status) {
    const participantLabel = role === 'delivery_provider' ? 'delivery provider' : role === 'service_provider' ? 'provider' : role === 'seller' ? 'seller' : 'participant';
    const statusLabel = status.replace(/_/g, ' ');
    const progressMessage = `Your ${participantLabel} recorded ${statusLabel} for this request. This is provider-reported progress and not final completion unless the request’s completion evidence confirms it. Review the same work item in Kurukoo.`;
    await import('./pushNotifications.js').then(({ sendFcmPush }) => sendFcmPush(request.phone, `Update from your ${participantLabel}`, progressMessage, `/app/requests?request=${encodeURIComponent(requestId)}`, {
      contextId: `request:${requestId}`,
      canonicalAction: 'economic_request.open',
      objectType: 'economic_request',
      objectId: requestId,
      ownerScope: request.phone,
      idempotencyKey: `participant-progress-attention:${requestId}:${role}:${providerPhone}:${status}:${priorSubmissions.length + 1}`,
      surface: 'requests',
    })).catch(() => false);
  }
  return (await getEconomicParticipants(requestId)).find((participant) => participant.id === Number(row.id))!;
}

export async function getEconomicRequestCoordination(requestId: string): Promise<{ offer: EconomicOffer | null; participants: EconomicParticipant[] }> {
  const [offer, participants] = await Promise.all([getEconomicOffer(requestId), getEconomicParticipants(requestId)]);
  return { offer, participants };
}
