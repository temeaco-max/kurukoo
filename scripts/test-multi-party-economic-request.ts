import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-multi-party-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'production';
process.env.KURUKOO_PAY_PROVIDER = 'sandbox';

const { getDb, saveDb } = await import('../src/database.js');
const { createEconomicRequest, getEconomicRequest, transitionEconomicRequest } = await import('../src/services/skillFlows.js');
const { attachEconomicOffer, addEconomicParticipant, getEconomicRequestCoordination, updateEconomicParticipant, searchKnownEconomicOffers, startKnownOfferEconomicRequest, getDeliveryCandidates, selectDeliveryCandidate } = await import('../src/services/economicParticipants.js');
const { lockEscrowForEconomicRequest, runEscrowPass } = await import('../src/services/tradeEngine.js');
const { createDispute } = await import('../src/services/disputeResolution.js');
const { resumeStorefrontFromRequest, advanceStorefront } = await import('../src/services/agenticStorefront.js');
const { createAIAgent } = await import('../src/services/aiAgentService.js');
const { createOpenIntention } = await import('../src/services/deferredRequestService.js');
const { routeIntent } = await import('../src/services/intentRouter.js');
const { getInternalNotifications } = await import('../src/services/pushNotifications.js');

const db = await getDb();
const buyerPhone = '+2347000010101';
const intruderPhone = '+2347000010100';
const primaryProviderPhone = '+2347000010102';
const sellerPhone = '+2347000010103';
const deliveryPhone = '+2347000010104';
const unverifiedDeliveryPhone = '+2347000010105';
const externalPlatformPhone = '+2347000010106';
const agentId = 'multi_party_coordination_agent';
const legacyRequestId = 'multi-party-legacy-request';
const requestId = 'multi-party-canonical-request';

for (const [phone, name, providerType, verified] of [
  [buyerPhone, 'Multi-party buyer', 'human', 0],
  [intruderPhone, 'Unauthorised requester', 'human', 0],
  [primaryProviderPhone, 'Primary canonical provider', 'business', 1],
  [sellerPhone, 'Verified product seller', 'business', 1],
  [deliveryPhone, 'Verified delivery provider', 'human', 1],
  [unverifiedDeliveryPhone, 'Unverified delivery provider', 'human', 0],
  [externalPlatformPhone, 'External platform reference', 'external_platform', 1],
] as const) {
  db.run(
    'INSERT INTO memory_profiles (phone,name,location,country,provider_type,verified_provider) VALUES (?,?,\'Ikeja\',\'ng\',?,?)',
    [phone, name, providerType, verified],
  );
}
db.run('INSERT INTO skills (phone,skill,is_available,hourly_rate,rating,jobs_completed) VALUES (?,\'product_sourcing\',1,8000,4.9,11)', [primaryProviderPhone]);
db.run('INSERT INTO skills (phone,skill,is_available,hourly_rate,rating,jobs_completed) VALUES (?,\'delivery\',1,1200,4.8,7)', [deliveryPhone]);

// Legacy single-provider requests retain their shape and do not receive implicit coordination data.
await createEconomicRequest({ id: legacyRequestId, phone: buyerPhone, skill: 'product_sourcing', requirements: { product: 'legacy item' } });
const legacy = await getEconomicRequest(legacyRequestId);
assert.equal(legacy?.providerPhone, null, 'existing single-provider records must remain readable without a participant payload');
assert.deepEqual(await getEconomicRequestCoordination(legacyRequestId), { offer: null, participants: [] }, 'legacy requests must receive empty additive coordination data');

await createEconomicRequest({ id: requestId, phone: buyerPhone, skill: 'product_sourcing', requirements: { product: 'solar lantern', location: 'Ikeja' } });
await transitionEconomicRequest(requestId, 'awaiting_match');
await transitionEconomicRequest(requestId, 'matched', { providerPhone: primaryProviderPhone });
await transitionEconomicRequest(requestId, 'quoting');
await transitionEconomicRequest(requestId, 'quoted', {
  quote: { amount_minor: 8000, currency: 'NGN', provider_phone: primaryProviderPhone, source: 'confirmed_provider_quote' },
});

await assert.rejects(
  () => attachEconomicOffer({
    requestId,
    ownerPhone: intruderPhone,
    id: 'unauthorised-offer',
    sellerPhone,
    description: 'This must not be attached.',
    source: 'test',
  }),
  /ownership/i,
  'only the canonical request owner may attach an offer',
);

const offer = await attachEconomicOffer({
  requestId,
  ownerPhone: buyerPhone,
  id: 'offer-solar-lantern',
  sellerPhone,
  description: "Ada's blue generator",
  priceMinor: 7000,
  currency: 'NGN',
  source: 'seller_declared',
  availabilityNote: 'Seller states the generator is available; confirmation is still required.',
  status: 'available',
  provenance: 'seller_created',
  mediaReference: 'seller-submitted-generator-photo-reference',
  externalUrl: 'https://example.invalid/ada-generator-reference',
});
assert.equal(offer.priceMinor, 7000, 'the durable offer preserves the seller-listed product price');
assert.equal(offer.provenance, 'seller_created', 'the offer retains its constrained seller-created provenance');

const knownOffers = await searchKnownEconomicOffers("I want Ada's blue generator", 3);
assert.equal(knownOffers.length, 1, 'an explicitly referenced known seller offer can be found without a global marketplace');
assert.equal(knownOffers[0]?.sellerPhone, sellerPhone, 'known-offer lookup exposes the verified seller reference only to the canonical service');
const routedOffer = await routeIntent("I want Ada's blue generator", buyerPhone);
assert.equal(routedOffer.cardData?.type, 'agentic_storefront', 'explicit listing language receives the existing storefront card primitive');
assert.equal((routedOffer.cardData as any)?.knownOffers?.[0]?.id, offer.id, 'the chat projection presents only the matched known offer candidate');
const knownRequest = await startKnownOfferEconomicRequest({ buyerPhone, offerId: offer.id, deliveryRequired: true, deliveryLocation: 'Ikeja' });
assert.equal(knownRequest.request.skill, 'product_sourcing', 'known offer selection starts one canonical product-sourcing request');
assert.equal(knownRequest.request.requirements.delivery_required, 'yes', 'the buyer delivery preference is stored as request context, not a second lifecycle');
assert.equal(knownRequest.seller.role, 'seller', 'known offer selection records the verified seller participant');
assert.equal(knownRequest.offer.originOfferId, offer.id, 'the selected request snapshots the known offer reference for auditability');
const deliveryDecision = await resumeStorefrontFromRequest(buyerPhone, knownRequest.request.id);
assert.equal(deliveryDecision?.stage, 'delivery_selection', 'an offer with requested delivery projects the existing courier choice as one decision on the same request');
assert.equal((deliveryDecision?.deliveryCandidates || []).some(provider => provider.phone === deliveryPhone), true, 'the delivery decision exposes only current verified delivery candidates');
const deliveryCandidates = await getDeliveryCandidates({ requestId: knownRequest.request.id, ownerPhone: buyerPhone });
assert.equal(deliveryCandidates.providers.some((provider) => provider.phone === deliveryPhone), true, 'delivery candidates reuse existing verified skill matching');
const selectedDelivery = await selectDeliveryCandidate({ requestId: knownRequest.request.id, ownerPhone: buyerPhone, providerPhone: deliveryPhone });
assert.equal(selectedDelivery.status, 'selected', 'buyer selection records one delivery participant without altering the primary provider field');
const selectedDeliveryDecision = await resumeStorefrontFromRequest(buyerPhone, knownRequest.request.id);
assert.equal(selectedDeliveryDecision?.stage, 'delivery_selection', 'the same request resumes after courier selection without starting another delivery workflow');
assert.equal(selectedDeliveryDecision?.actions?.some(action => action.id === 'dispatch_delivery'), true, 'the selected courier advances to the existing authorized dispatch boundary');
const participantHandover = await updateEconomicParticipant({
  requestId: knownRequest.request.id,
  actorPhone: sellerPhone,
  role: 'seller',
  providerPhone: sellerPhone,
  status: 'handed_over',
  evidence: { handover_receipt: 'seller-submitted-handover-001' },
});
assert.equal(participantHandover.evidence.handover_receipt, 'seller-submitted-handover-001', 'the seller can submit its own handover evidence');
assert.equal(Array.isArray(participantHandover.evidence._submissions), true, 'server records evidence submission attribution rather than trusting an asserted actor');
assert.equal((participantHandover.evidence._submissions as any[])[0]?.actor_phone, sellerPhone, 'participant evidence includes the authenticated submitter recorded by the service');
const handoverAttention = await getInternalNotifications(buyerPhone, 20);
assert.equal(handoverAttention.some((notification: any) => notification.title === 'Update from your seller' && notification.object_id === knownRequest.request.id && notification.canonical_action === 'economic_request.open'), true, 'a seller handover update must notify the owner with the same request context');
await assert.rejects(
  () => updateEconomicParticipant({ requestId: knownRequest.request.id, actorPhone: intruderPhone, role: 'seller', providerPhone: sellerPhone, status: 'handed_over', evidence: { forged: true } }),
  /ownership or participant identity/i,
  'an unrelated user cannot submit seller evidence',
);

await assert.rejects(
  () => addEconomicParticipant({
    requestId,
    ownerPhone: intruderPhone,
    role: 'seller',
    providerPhone: sellerPhone,
    capability: 'unauthorised participant mutation',
  }),
  /ownership/i,
  'only the canonical request owner may attach a participant',
);

const seller = await addEconomicParticipant({
  requestId,
  ownerPhone: buyerPhone,
  role: 'seller',
  providerPhone: sellerPhone,
  capability: 'seller-provided item availability and handover',
  status: 'handover_pending',
  evidence: { inventory_confirmation: 'seller-declared only' },
});
const delivery = await addEconomicParticipant({
  requestId,
  ownerPhone: buyerPhone,
  role: 'delivery_provider',
  providerPhone: deliveryPhone,
  capability: 'collection and delivery coordination',
  status: 'selected',
  evidence: { delivery_quote_minor: 1200, delivery_quote_currency: 'NGN' },
});
assert.equal(seller.role, 'seller');
assert.equal(delivery.role, 'delivery_provider');

await assert.rejects(
  () => addEconomicParticipant({
    requestId,
    ownerPhone: buyerPhone,
    role: 'delivery_provider',
    providerPhone: unverifiedDeliveryPhone,
    capability: 'unverified dispatch',
  }),
  /verified provider/i,
  'participant role must never bypass provider verification',
);

await createAIAgent({
  id: agentId,
  name: 'Multi-party Coordination Agent',
  avatar: 'C',
  system_prompt: 'Coordinate information only; never settle, pay, or control hardware.',
  skills: ['product_sourcing'],
  tools: ['coordination_notes'],
  status: 'active',
  lga: 'Ikeja',
  concurrency_limit: 1,
  token_quota_daily: 10,
  cost_threshold_usd: 0.01,
  temperature: 0,
});
const agent = await addEconomicParticipant({
  requestId,
  ownerPhone: buyerPhone,
  role: 'agent',
  providerPhone: agentId,
  capability: 'orchestration and coordination notes only',
  status: 'confirmed',
});
assert.equal(agent.role, 'agent', 'a registered AI agent can be represented without becoming the fulfillment provider');

const external = await addEconomicParticipant({
  requestId,
  ownerPhone: buyerPhone,
  role: 'external_platform',
  providerPhone: externalPlatformPhone,
  capability: 'external catalogue reference only',
  status: 'offered',
  evidence: { integration: 'not configured', source_reference: 'seller-provided URL' },
});
assert.equal(external.role, 'external_platform', 'an external platform is representable without inventing an integration');

const coordination = await getEconomicRequestCoordination(requestId);
assert.equal(coordination.offer?.sellerPhone, sellerPhone);
assert.equal(coordination.participants.length, 4, 'seller, delivery, agent, and external platform remain explicit and separately queryable');
assert.equal(coordination.participants.find((participant) => participant.role === 'delivery_provider')?.evidence.delivery_quote_minor, 1200, 'delivery quote evidence is role-specific');
const quotedRequest = await getEconomicRequest(requestId);
assert.equal((quotedRequest?.quote as { amount_minor?: number }).amount_minor, 8000, 'delivery quote evidence must not replace the canonical request quote');
assert.equal(quotedRequest?.providerPhone, primaryProviderPhone, 'participants must not replace the primary fulfillment provider');

const blockedEscrow = await lockEscrowForEconomicRequest(requestId);
assert.equal(blockedEscrow.success, false, 'seller or delivery participation must not bypass verified payment before escrow');
assert.match(blockedEscrow.message, /Verified payment must be completed/i);

await transitionEconomicRequest(requestId, 'awaiting_confirmation');
await transitionEconomicRequest(requestId, 'reserved');
await transitionEconomicRequest(requestId, 'payment_pending');
await transitionEconomicRequest(requestId, 'paid', { fulfillment: { payment_verified: true, payment_reference: 'payment-multi-party-001' } });
const locked = await lockEscrowForEconomicRequest(requestId);
assert.equal(locked.success, true, 'canonical escrow remains available only after verified payment evidence');
const escrowRow = db.exec('SELECT buyer_phone,provider_phone,amount_minor,status FROM escrow WHERE id=?', [locked.escrowId])[0]?.values?.[0];
assert.deepEqual(escrowRow, [buyerPhone, primaryProviderPhone, 8000, 'held'], 'escrow must remain buyer-to-primary-provider only, not a speculative split settlement');

await updateEconomicParticipant({
  requestId,
  actorPhone: sellerPhone,
  role: 'seller',
  providerPhone: sellerPhone,
  status: 'handed_over',
  evidence: { handover_receipt: 'seller-handover-001' },
});
const handoverCard = await resumeStorefrontFromRequest(buyerPhone, requestId);
assert.equal(handoverCard?.stage, 'seller_handover', 'storefront projects seller handover independently from delivery collection');
assert.equal(handoverCard?.participants?.find((participant) => participant.role === 'seller')?.evidence.handover_receipt, 'seller-handover-001');

await updateEconomicParticipant({
  requestId,
  actorPhone: deliveryPhone,
  role: 'delivery_provider',
  providerPhone: deliveryPhone,
  status: 'collected',
  evidence: { collection_receipt: 'delivery-collection-001' },
});
const deliveryCard = await resumeStorefrontFromRequest(buyerPhone, requestId);
assert.equal(deliveryCard?.stage, 'delivery_in_progress', 'storefront projects delivery evidence after collection');
const postCollection = await getEconomicRequestCoordination(requestId);
assert.equal(postCollection.participants.find((participant) => participant.role === 'seller')?.evidence.handover_receipt, 'seller-handover-001');
assert.equal(postCollection.participants.find((participant) => participant.role === 'delivery_provider')?.evidence.collection_receipt, 'delivery-collection-001');

await assert.rejects(
  () => updateEconomicParticipant({ requestId, actorPhone: buyerPhone, role: 'delivery_provider', providerPhone: deliveryPhone, status: 'delivered', evidence: { delivery_reference: 'forged-owner-delivery-001' } }),
  /only the selected delivery provider/i,
  'the request owner cannot fabricate a provider delivery report',
);
await assert.rejects(
  () => updateEconomicParticipant({ requestId, actorPhone: deliveryPhone, role: 'delivery_provider', providerPhone: deliveryPhone, status: 'delivered', evidence: {} }),
  /delivery.*reference/i,
  'delivery reporting requires a durable provider, recipient, or tracking reference',
);
const deliveryReported = await updateEconomicParticipant({
  requestId,
  actorPhone: deliveryPhone,
  role: 'delivery_provider',
  providerPhone: deliveryPhone,
  status: 'delivered',
  evidence: { delivery_reference: 'delivery-receipt-001', tracking_reference: 'tracking-001' },
});
assert.equal(deliveryReported.status, 'delivered');
const deliveryConfirmationCard = await resumeStorefrontFromRequest(buyerPhone, requestId);
assert.equal(deliveryConfirmationCard?.stage, 'delivery_confirmation', 'provider-reported delivery must be shown as a confirmation task rather than auto-completion');
assert.equal(deliveryConfirmationCard?.actions?.some(action => action.id === 'confirm_delivery_receipt'), true);
const deliveryReceiptConfirmation = await advanceStorefront(buyerPhone, requestId, {}, 'confirm_delivery_receipt');
assert.equal(deliveryReceiptConfirmation.stage, 'coordination', 'owner confirmation should record the custody event without closing the primary request');
const confirmedCoordination = await getEconomicRequestCoordination(requestId);
const confirmedDelivery = confirmedCoordination.participants.find((participant) => participant.role === 'delivery_provider');
assert.equal(confirmedDelivery?.status, 'confirmed');
assert.equal(confirmedDelivery?.evidence.owner_confirmation, 'confirmed_by_explicit_storefront_action');
assert.equal((await getEconomicRequest(requestId))?.status, 'in_fulfillment', 'delivery receipt does not bypass product/service completion, payment, or dispute policy');

await assert.rejects(
  () => createDispute(deliveryPhone, String(locked.orderId), 'delivery participant cannot dispute buyer order'),
  /Only the order buyer/i,
  'participant roles must not bypass canonical dispute authorization',
);
const dispute = await createDispute(buyerPhone, String(locked.orderId), 'buyer reports product condition issue');
assert.equal(dispute.escrowFrozen, true, 'canonical dispute path freezes the existing single-recipient escrow');
assert.equal(await runEscrowPass(), 0, 'a disputed request cannot release escrow through the normal pass');
assert.equal(db.exec('SELECT status FROM escrow WHERE id=?', [locked.escrowId])[0]?.values?.[0]?.[0], 'disputed');

const deferred = await createOpenIntention(
  deliveryPhone,
  'Willing to coordinate solar-lantern delivery when the buyer confirms the seller handover.',
  JSON.stringify({ capability: 'collection and delivery coordination', request_id: requestId }),
  { skill: 'delivery', location: 'Ikeja', economicRequestId: requestId },
);
assert.equal(deferred?.economic_request_id, requestId, 'a provider willingness note can use the existing deferred-intention continuation model without a second opportunity engine');

saveDb(true);
try { fs.rmSync(dbPath, { force: true }); } catch { /* isolated test cleanup is best-effort */ }

console.log('Multi-party Economic Request regression checks passed');
console.log('Verified: legacy compatibility, seller offer linkage, verified seller/delivery participants, role-specific evidence, unchanged quote/payment/escrow/dispute controls, registered-agent coordination, external-platform representation without integration, deferred continuity, and storefront projections.');
