import assert from 'node:assert/strict';
import {
  createFulfilment,
  createOffer,
  createProviderInquiry,
  getFulfilment,
  listOffers,
  recordProviderInquiryResponse,
  selectOffer,
} from '../src/services/canonicalFulfilmentService.js';
import { getFulfilmentSkillBinding, listFulfilmentSkillBindings, resolveMissingFulfilmentInputs } from '../src/services/fulfilmentSkillBindings.js';
import { advanceFulfilmentStorefront, startFulfilmentStorefrontSession } from '../src/services/fulfilmentStorefrontBridge.js';
import { executeCanonicalCapabilityProposal } from '../src/services/canonicalCapabilityExecutor.js';
import { executeAgentTool } from '../src/services/agentToolRegistry.js';

const owner = `fulfilment-network-${Date.now()}`;
const otherOwner = `fulfilment-network-other-${Date.now()}`;
const binding = getFulfilmentSkillBinding('order_food');
assert.ok(binding, 'order_food must have a reusable canonical fulfilment binding');
assert.equal(binding.mechanism, 'marketplace_purchase');
assert.deepEqual(resolveMissingFulfilmentInputs(binding, { item: 'suya', items: 'suya' }), ['quantity', 'location']);
assert.ok(listFulfilmentSkillBindings().length >= 241, 'all converged skills should have fulfilment bindings');

const journeyPhone = `fulfilment-journey-${Date.now()}`;
const firstTurn = await startFulfilmentStorefrontSession(journeyPhone, 'order_food', { items: 'suya' }, { forceNew: true });
assert.equal(firstTurn.stage, 'slot_fill');
assert.match(firstTurn.message, /quantity/i);
assert.match(firstTurn.message, /delivery area/i);
assert.ok(firstTurn.requestId);
const secondTurn = await advanceFulfilmentStorefront(journeyPhone, firstTurn.requestId!, { quantity: 2, unit: 'portions', location: 'Ikeja' });
assert.ok(secondTurn.fulfilment?.id, 'completed requirements must create/link a canonical Fulfilment');
assert.equal(secondTurn.fulfilment?.missingInputs.length, 0);

const catalogue = await createFulfilment({
  id: `network-catalogue-${Date.now()}`,
  ownerPhone: owner,
  skill: 'order_food',
  mechanism: binding.mechanism,
  economicRequestId: `request-${Date.now()}`,
  requirements: { item: 'suya', quantity: 2, unit: 'portions', location: 'Ikeja' },
  requiredInputs: binding.requiredInputs,
  missingInputs: [],
});
const availableOffer = await createOffer({
  id: `network-catalogue-offer-${Date.now()}`,
  fulfilmentId: catalogue.id,
  ownerPhone: owner,
  providerId: 'catalogue-seller',
  providerName: 'Catalogue Suya Seller',
  title: 'Two portions of suya',
  source: 'catalogue',
  status: 'available',
  priceMinor: 600000,
  currency: 'NGN',
  quantity: 2,
  unit: 'portions',
  availability: 'available',
  location: 'Ikeja',
  evidenceLevel: 'source_attributed',
  sourceRef: 'catalogue:suya:ikeja',
});
const selection = await selectOffer(owner, catalogue.id, availableOffer.id);
assert.equal(selection.fulfilment.status, 'awaiting_confirmation');
const confirmationBlocked = await executeCanonicalCapabilityProposal({ capability: 'fulfilment', action: 'confirm', canonicalObjectId: catalogue.id, phone: owner, idempotencyKey: `confirmation-blocked-${catalogue.id}` });
assert.equal(confirmationBlocked.status, 'confirmation_required');
const confirmationAccepted = await executeCanonicalCapabilityProposal({ capability: 'fulfilment', action: 'confirm', canonicalObjectId: catalogue.id, phone: owner, confirmationGranted: true, idempotencyKey: `confirmation-accepted-${catalogue.id}` });
assert.equal(confirmationAccepted.status, 'externally_pending');
const agentRead = await executeAgentTool('fulfilment_get', { fulfilmentId: catalogue.id }, { phone: owner, goalId: `goal-${catalogue.id}` });
assert.equal(agentRead.ok, true);
assert.equal(agentRead.data?.status, 'completed');
await assert.rejects(() => selectOffer(otherOwner, catalogue.id, availableOffer.id), /Fulfilment not found/);

const expired = await createOffer({
  id: `network-expired-offer-${Date.now()}`,
  fulfilmentId: catalogue.id,
  ownerPhone: owner,
  providerId: 'expired-seller',
  title: 'Expired suya',
  source: 'catalogue',
  status: 'available',
  priceMinor: 500000,
  currency: 'NGN',
  evidenceLevel: 'source_attributed',
  validUntil: new Date(Date.now() - 60_000).toISOString(),
});
assert.equal(expired.status, 'expired');
assert.equal((await listOffers(owner, catalogue.id)).some(offer => offer.id === expired.id), false);

const inquiryFulfilment = await createFulfilment({
  id: `network-inquiry-${Date.now()}`,
  ownerPhone: owner,
  skill: 'order_food',
  mechanism: binding.mechanism,
  requirements: { item: 'suya', quantity: 2, unit: 'portions', location: 'Ikeja' },
  requiredInputs: binding.requiredInputs,
  missingInputs: [],
});
const inquiry = await createProviderInquiry({
  id: `network-inquiry-record-${Date.now()}`,
  fulfilmentId: inquiryFulfilment.id,
  ownerPhone: owner,
  providerId: 'provider-suya-1',
  providerPhone: '+2348012345678',
  providerName: 'Provider Suya Seller',
  question: 'A Kurukoo customer wants 2 portions of suya in Ikeja. Do you currently have this available, and what is your price?',
  requestedFields: ['availability', 'price', 'delivery'],
});

const responseInput = {
  ownerPhone: owner,
  inquiryId: inquiry.id,
  providerIdentity: 'provider-suya-1',
  idempotencyKey: `provider-webhook-${inquiry.id}`,
  evidenceRef: `provider-message-${inquiry.id}`,
  response: { availability: true, priceMinor: 600000, currency: 'NGN', delivery: 'available' },
  offer: {
    id: `provider-offer-${inquiry.id}`,
    providerId: 'provider-suya-1',
    providerPhone: '+2348012345678',
    providerName: 'Provider Suya Seller',
    title: 'Two portions of suya',
    description: 'Provider-confirmed current offer',
    source: 'provider_inquiry' as const,
    priceMinor: 600000,
    currency: 'NGN',
    quantity: 2,
    unit: 'portions',
    availability: 'confirmed',
    location: 'Ikeja',
    delivery: 'available',
    evidenceLevel: 'provider_confirmed' as const,
    evidenceRef: `provider-message-${inquiry.id}`,
  },
};
const firstResponse = await recordProviderInquiryResponse(responseInput);
const duplicateResponse = await recordProviderInquiryResponse(responseInput);
assert.equal(firstResponse.offer?.source, 'provider_inquiry');
assert.equal(firstResponse.offer?.evidenceLevel, 'provider_confirmed');
assert.equal(duplicateResponse.duplicate, true);
assert.equal(duplicateResponse.offer?.id, firstResponse.offer?.id);
assert.equal((await getFulfilment(owner, inquiryFulfilment.id))?.status, 'offers_ready');

console.log('Canonical fulfilment network regression passed.');
