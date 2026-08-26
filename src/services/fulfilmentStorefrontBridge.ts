import { advanceStorefront, startStorefrontSession, type StorefrontCard } from './agenticStorefront.js';
import { getEconomicRequest, transitionEconomicRequest, type EconomicRequest } from './skillFlows.js';
import { matchCatalogueInventory } from './catalogueInventoryMatcher.js';
import { find_worker } from './find-worker.js';
import {
  createFulfilment,
  createOffer,
  createProviderInquiry,
  getFulfilment,
  markProviderInquirySent,
  providerInquiryReference,
  listOffers,
  listProviderInquiries,
  selectOffer,
  updateFulfilmentRequirements,
  type Fulfilment,
  type FulfilmentRequirements,
  type Offer,
} from './canonicalFulfilmentService.js';
import { getFulfilmentSkillBinding, resolveMissingFulfilmentInputs } from './fulfilmentSkillBindings.js';
import { sendSmsText } from '../channels/sms.js';

export interface FulfilmentStorefrontCard extends StorefrontCard {
  fulfilment?: Pick<Fulfilment, 'id' | 'status' | 'missingInputs' | 'economicRequestId'>;
  canonicalOffers?: Array<Pick<Offer, 'id' | 'providerId' | 'providerName' | 'title' | 'priceMinor' | 'currency' | 'quantity' | 'unit' | 'availability' | 'location' | 'delivery' | 'source' | 'evidenceLevel' | 'validUntil'>>;
  providerInquiries?: Array<{ id: string; providerId?: string; providerName?: string; status: string; externalActivation: 'repository_ready_external_activation' }>;
}

function asString(value: unknown): string | undefined {
  const text = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
  return text || undefined;
}

function asQuantity(value: unknown): number | undefined {
  const numeric = typeof value === 'number' ? value : Number(String(value || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

function requirementsForRequest(request: EconomicRequest): FulfilmentRequirements {
  const source = request.requirements || {};
  const item = asString(source.item) || asString(source.items) || asString(source.product) || asString(source.objective) || asString(source.service) || asString(source.description);
  const quantity = asQuantity(source.quantity);
  const location = asString(source.location) || asString(source.delivery_location) || asString(source.destination) || asString(source.origin);
  return {
    ...source,
    ...(item ? { item } : {}),
    ...(quantity ? { quantity } : {}),
    ...(location ? { location } : {}),
    unit: asString(source.unit) || (request.skill === 'order_food' ? 'portions' : undefined),
    timing: asString(source.delivery_time) || asString(source.time) || asString(source.deadline) || asString(source.timing),
    budgetMinor: asQuantity(source.budgetMinor) || asQuantity(source.budget) || undefined,
    currency: asString(source.currency) || 'NGN',
  };
}

function stableId(prefix: string, parts: Array<unknown>): string {
  const input = parts.map(part => String(part || '')).join('|').replace(/[^a-zA-Z0-9_.|:-]/g, '_');
  return `${prefix}:${input}`.slice(0, 240);
}

function offerProjection(offer: Offer) {
  return {
    id: offer.id,
    providerId: offer.providerId,
    providerName: offer.providerName || 'Provider',
    title: offer.title,
    priceMinor: offer.priceMinor,
    currency: offer.currency,
    quantity: offer.quantity,
    unit: offer.unit,
    availability: offer.availability,
    location: offer.location,
    delivery: offer.delivery,
    source: offer.source,
    evidenceLevel: offer.evidenceLevel,
    validUntil: offer.validUntil,
  };
}

async function ensureRequestLink(request: EconomicRequest, fulfilment: Fulfilment): Promise<void> {
  const existing = request.fulfillment && typeof request.fulfillment === 'object' ? request.fulfillment as Record<string, unknown> : {};
  if (existing.canonicalFulfilmentId === fulfilment.id) return;
  await transitionEconomicRequest(request.id, request.status, {
    fulfillment: { ...existing, canonicalFulfilmentId: fulfilment.id, fulfilmentStatus: fulfilment.status },
  });
}

async function ensureFulfilment(phone: string, request: EconomicRequest): Promise<Fulfilment | null> {
  const binding = getFulfilmentSkillBinding(request.skill);
  if (!binding) return null;
  const requirements = requirementsForRequest(request);
  const missing = resolveMissingFulfilmentInputs(binding, requirements);
  const existingId = request.fulfillment && typeof request.fulfillment === 'object' ? String((request.fulfillment as Record<string, unknown>).canonicalFulfilmentId || '') : '';
  const existing = existingId ? await getFulfilment(phone, existingId) : null;
  const fulfilment = existing || await createFulfilment({
    id: stableId('fulfilment', [phone, request.id]),
    ownerPhone: phone,
    skill: request.skill,
    mechanism: binding.mechanism,
    economicRequestId: request.id,
    requirements,
    requiredInputs: binding.requiredInputs,
    missingInputs: missing,
  });
  await ensureRequestLink(request, fulfilment);
  return fulfilment;
}

async function synchronizeOfferReview(request: EconomicRequest, offer: Offer, fulfilment: Fulfilment): Promise<void> {
  let current = await getEconomicRequest(request.id);
  if (!current) return;
  const progress: Array<'awaiting_match' | 'matched' | 'quoting' | 'quoted' | 'awaiting_confirmation'> = ['awaiting_match', 'matched', 'quoting', 'quoted', 'awaiting_confirmation'];
  for (const status of progress) {
    if (!current || current.status === status || ['awaiting_confirmation', 'reserved', 'payment_pending', 'paid', 'in_fulfillment', 'fulfilled', 'completed'].includes(current.status)) break;
    try {
      current = await transitionEconomicRequest(current.id, status, status === 'matched' ? { providerPhone: offer.providerPhone, fulfillment: { ...(current.fulfillment || {}), canonicalFulfilmentId: fulfilment.id, selectedCanonicalOfferId: offer.id } } : status === 'quoted' ? { quote: { amount_minor: offer.priceMinor ?? null, currency: offer.currency || 'NGN', provider_name: offer.providerName || 'Provider', source: offer.source, evidence_level: offer.evidenceLevel, canonicalOfferId: offer.id }, fulfillment: { ...(current.fulfillment || {}), canonicalFulfilmentId: fulfilment.id, selectedCanonicalOfferId: offer.id } } : undefined);
    } catch {
      break;
    }
  }
}

async function catalogueOffers(phone: string, request: EconomicRequest, fulfilment: Fulfilment): Promise<Offer[]> {
  const requirements = fulfilment.requirements;
  const item = asString(requirements.item);
  if (!item) return [];
  const rows = await matchCatalogueInventory({ query: item, skill: request.skill, location: asString(requirements.location), max: 8 });
  for (const row of rows) {
    const price = row.price == null ? undefined : Math.round(Number(row.price) * 100);
    await createOffer({
      id: stableId('catalogue-offer', [fulfilment.id, row.source, row.sourceId || row.providerPhone, row.product, row.location]),
      fulfilmentId: fulfilment.id,
      ownerPhone: phone,
      providerId: row.sourceId || row.providerPhone || undefined,
      providerPhone: row.providerPhone || undefined,
      providerName: row.providerName,
      title: row.product,
      description: `Current catalogue match for ${item}.`,
      source: 'catalogue',
      status: 'available',
      priceMinor: Number.isFinite(price) ? price : undefined,
      currency: row.currency || 'NGN',
      quantity: requirements.quantity,
      unit: asString(requirements.unit),
      availability: 'available',
      location: row.location || asString(requirements.location),
      delivery: 'availability must be confirmed before execution',
      evidenceLevel: 'source_attributed',
      sourceRef: row.sourceUrl || row.sourceId || `${row.source}:${row.providerPhone}:${row.product}`,
      metadata: { matchedTerms: row.matchedTerms, source: row.source, verified: row.verified },
    });
  }
  return listOffers(phone, fulfilment.id);
}

async function providerInquiries(phone: string, request: EconomicRequest, fulfilment: Fulfilment): Promise<void> {
  const requirements = fulfilment.requirements;
  const item = asString(requirements.item);
  if (!item) return;
  const candidates = await find_worker({ skill: request.skill, service: item, location: asString(requirements.location), max: 3 }).catch(() => ({ providers: [] }));
  for (const provider of candidates.providers.slice(0, 3)) {
    const question = `A Kurukoo customer wants ${requirements.quantity || 'the requested quantity'}${requirements.unit ? ` ${requirements.unit}` : ''} of ${item}${requirements.location ? ` in ${requirements.location}` : ''}${requirements.timing ? ` ${requirements.timing}` : ''}. Do you currently have this available, and what is your price?`;
    const inquiry = await createProviderInquiry({
      id: stableId('provider-inquiry', [fulfilment.id, provider.phone, item, requirements.quantity, requirements.location]),
      fulfilmentId: fulfilment.id,
      ownerPhone: phone,
      providerId: provider.phone,
      providerPhone: provider.phone,
      providerName: provider.name,
      question,
      requestedFields: ['availability', 'price', 'delivery'],
    });
    if (inquiry.status === 'pending') {
      const delivery = await sendSmsText(provider.phone, `${question}\nReply with availability and price. Reference: ${providerInquiryReference(inquiry.id)}`);
      if (delivery.ok) await markProviderInquirySent(phone, inquiry.id);
    }
  }
}

function requirementLabel(key: string): string {
  return ({ items: 'what you want', item: 'what you want', quantity: 'quantity', location: 'delivery area', timing: 'timing', description: 'request details' } as Record<string, string>)[key] || key.replace(/_/g, ' ');
}

function requirementsCard(request: EconomicRequest, fulfilment: Fulfilment, fallback?: FulfilmentStorefrontCard): FulfilmentStorefrontCard {
  const fields = [...(fallback?.fields || [])];
  for (const key of fulfilment.missingInputs) {
    const existing = fields.find(field => field.key === key);
    if (existing) existing.required = true;
    else fields.push({ key, label: requirementLabel(key), required: true, value: fulfilment.requirements[key] == null ? undefined : String(fulfilment.requirements[key]) });
  }
  return {
    ...(fallback || { type: 'agentic_storefront', skill: request.skill, category: request.category, requestId: request.id, escrowProtected: false, progress: 30 }),
    type: 'agentic_storefront', stage: 'slot_fill', skill: request.skill, category: request.category, requestId: request.id,
    title: 'A few details',
    message: `To match the right provider, I still need: ${fulfilment.missingInputs.map(requirementLabel).join(', ')}.`,
    fields,
    actions: [{ id: 'submit_slots', label: 'Continue', style: 'primary' }, { id: 'cancel', label: 'Cancel', style: 'secondary' }],
    escrowProtected: false, progress: 30,
    fulfilment: { id: fulfilment.id, status: fulfilment.status, missingInputs: fulfilment.missingInputs, economicRequestId: fulfilment.economicRequestId },
  };
}

function offersCard(request: EconomicRequest, fulfilment: Fulfilment, offers: Offer[]): FulfilmentStorefrontCard {
  const rendered = offers.map(offerProjection);
  const best = offers[0];
  const price = best?.priceMinor == null ? 'a provider-confirmed price pending' : `${(best.priceMinor / 100).toLocaleString()} ${best.currency || 'NGN'}`;
  return {
    type: 'agentic_storefront', stage: 'offer_review', skill: request.skill, category: request.category, requestId: request.id,
    title: `${offers.length} offer${offers.length === 1 ? '' : 's'} ready for review`,
    message: `I found ${offers.length} current offer${offers.length === 1 ? '' : 's'}. The leading option is ${best?.providerName || 'a provider'} at ${price}. Select an exact offer to review; no provider, payment, or fulfilment has been committed.`,
    actions: [{ id: 'select_offer', label: 'Select an offer', style: 'primary' }, { id: 'check_again', label: 'Check again', style: 'secondary' }, { id: 'cancel', label: 'Cancel', style: 'secondary' }],
    escrowProtected: false, progress: 66,
    fulfilment: { id: fulfilment.id, status: fulfilment.status, missingInputs: fulfilment.missingInputs, economicRequestId: fulfilment.economicRequestId },
    canonicalOffers: rendered,
  };
}

async function resolveFulfilment(phone: string, request: EconomicRequest, fallback?: FulfilmentStorefrontCard): Promise<FulfilmentStorefrontCard | null> {
  const fulfilment = await ensureFulfilment(phone, request);
  if (!fulfilment) return null;
  if (fulfilment.missingInputs.length) {
    if (request.skill === 'order_food') return requirementsCard(request, fulfilment, fallback);
    return fallback ? { ...fallback, fulfilment: { id: fulfilment.id, status: fulfilment.status, missingInputs: fulfilment.missingInputs, economicRequestId: fulfilment.economicRequestId } } : null;
  }
  const offers = await catalogueOffers(phone, request, fulfilment);
  if (offers.length) return offersCard(request, fulfilment, offers);
  await providerInquiries(phone, request, fulfilment);
  const inquiries = await listProviderInquiries(phone, fulfilment.id);
  if (!inquiries.length && fallback) return { ...fallback, fulfilment: { id: fulfilment.id, status: fulfilment.status, missingInputs: fulfilment.missingInputs, economicRequestId: fulfilment.economicRequestId } };
  return {
    type: 'agentic_storefront', stage: 'catalog_match', skill: request.skill, category: request.category, requestId: request.id,
    title: inquiries.length ? 'Waiting for provider replies' : 'No provider contact is ready',
    message: inquiries.length ? `I found no current catalogue offer, so I prepared ${inquiries.length} provider ${inquiries.length === 1 ? 'inquiry' : 'inquiries'}. They remain ready for delivery through the existing channel system; Kurukoo has not claimed that a message was delivered or that availability was confirmed.` : 'I found no current catalogue offer or eligible provider contact. Your exact request remains open; no availability, price, or fulfilment has been invented.',
    actions: [{ id: 'check_again', label: 'Check again', style: 'secondary' }, { id: 'cancel', label: 'Cancel', style: 'secondary' }],
    escrowProtected: false, progress: 58,
    fulfilment: { id: fulfilment.id, status: fulfilment.status, missingInputs: fulfilment.missingInputs, economicRequestId: fulfilment.economicRequestId },
    providerInquiries: inquiries.map(inquiry => ({ id: inquiry.id, providerId: inquiry.providerId, providerName: inquiry.providerName, status: inquiry.status, externalActivation: 'repository_ready_external_activation' })),
  };
}

export async function startFulfilmentStorefrontSession(phone: string, skill: string, seedRequirements: Record<string, unknown> = {}, options: { forceNew?: boolean } = {}): Promise<FulfilmentStorefrontCard> {
  const card = await startStorefrontSession(phone, skill, seedRequirements, options);
  if (!card.requestId) return card;
  const request = await getEconomicRequest(card.requestId);
  return request ? (await resolveFulfilment(phone, request, card)) || card : card;
}

export async function advanceFulfilmentStorefront(phone: string, requestId: string, patch: Record<string, unknown> = {}, action?: string, idempotencyKey?: string): Promise<FulfilmentStorefrontCard> {
  const request = await getEconomicRequest(requestId);
  const fulfilmentId = request?.fulfillment && typeof request.fulfillment === 'object' ? String((request.fulfillment as Record<string, unknown>).canonicalFulfilmentId || '') : '';
  if (request && fulfilmentId && action === 'confirm_offer') {
    const { executeCanonicalCapabilityProposal } = await import('./canonicalCapabilityExecutor.js');
    const result = await executeCanonicalCapabilityProposal({ capability: 'fulfilment', action: 'confirm', canonicalObjectId: fulfilmentId, phone, channel: 'storefront', confirmationGranted: true, idempotencyKey: idempotencyKey || `storefront-confirm:${requestId}:${fulfilmentId}` });
    return {
      type: 'agentic_storefront', stage: 'escrow_confirm', skill: request.skill, category: request.category, requestId,
      title: result.status === 'externally_pending' ? 'Confirmation recorded' : 'Confirmation needs review',
      message: result.message,
      actions: result.status === 'externally_pending' ? [{ id: 'confirm_escrow', label: 'Continue to payment boundary', style: 'primary' }, { id: 'cancel', label: 'Cancel', style: 'secondary' }] : [{ id: 'check_again', label: 'Review current offer', style: 'secondary' }],
      escrowProtected: false, progress: 80,
      fulfilment: { id: fulfilmentId, status: String((result.canonicalFacts.fulfilment as Fulfilment | undefined)?.status || 'awaiting_confirmation') as Fulfilment['status'], missingInputs: [], economicRequestId: requestId },
    };
  }
  if (request && fulfilmentId && action === 'select_offer') {
    const offerId = asString(patch.offerId) || asString(patch.canonicalOfferId);
    if (!offerId) return { type: 'agentic_storefront', stage: 'offer_review', skill: request.skill, category: request.category, requestId, title: 'Choose an exact offer', message: 'Select one of the current canonical offers before continuing. I have not substituted another offer.', actions: [{ id: 'check_again', label: 'Check again', style: 'secondary' }], escrowProtected: false, progress: 66 };
    const selected = await selectOffer(phone, fulfilmentId, offerId);
    await synchronizeOfferReview(request, selected.offer, selected.fulfilment);
    return { type: 'agentic_storefront', stage: 'offer_review', skill: request.skill, category: request.category, requestId, title: 'Offer selected', message: `${selected.offer.providerName || 'The provider'} offer is selected. Confirm explicitly before Kurukoo crosses the canonical execution and payment boundary.`, actions: [{ id: 'confirm_offer', label: 'Proceed', style: 'primary' }, { id: 'cancel', label: 'Cancel', style: 'secondary' }], escrowProtected: false, progress: 74, fulfilment: { id: selected.fulfilment.id, status: selected.fulfilment.status, missingInputs: selected.fulfilment.missingInputs, economicRequestId: selected.fulfilment.economicRequestId }, canonicalOffers: [offerProjection(selected.offer)] };
  }
  if (request && fulfilmentId && !action) {
    const fulfilment = await getFulfilment(phone, fulfilmentId);
    const binding = fulfilment ? getFulfilmentSkillBinding(fulfilment.skill) : undefined;
    if (fulfilment && binding) {
      const requirements = { ...fulfilment.requirements, ...patch };
      const missingInputs = resolveMissingFulfilmentInputs(binding, requirements);
      await updateFulfilmentRequirements(phone, fulfilment.id, patch, missingInputs);
    }
  }
  const card = await advanceStorefront(phone, requestId, patch, action, idempotencyKey);
  if (!card.requestId || card.stage === 'complete') return card;
  const current = await getEconomicRequest(card.requestId);
  return current ? (await resolveFulfilment(phone, current, card)) || card : card;
}
