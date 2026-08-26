import assert from 'node:assert/strict';
import {
  buildProviderInquiryQuestion,
  createFulfilment,
  createOffer,
  createProviderInquiry,
  listOffers,
  rankOffers,
  recordProviderInquiryResponse,
  selectOffer,
  updateFulfilmentRequirements,
} from '../src/services/canonicalFulfilmentService.js';
import { getFulfilmentMechanismForSkill, getFulfilmentSkillBinding, resolveMissingFulfilmentInputs } from '../src/services/fulfilmentSkillBindings.js';

const owner = `+234809${String(Date.now()).slice(-7)}`;

const purchase = getFulfilmentSkillBinding('purchase');
assert.ok(purchase, 'Purchase must use a reusable fulfilment binding');
assert.equal(purchase?.mechanism, 'marketplace_purchase');
assert.equal(purchase?.catalogueFirst, true);
assert.equal(purchase?.providerInquiryFallback, true);
assert.deepEqual(resolveMissingFulfilmentInputs(purchase!, { item: 'suya' }), ['quantity', 'location'], 'Chat can identify the missing information before execution');
assert.equal(getFulfilmentMechanismForSkill('food_order'), 'marketplace_purchase', 'Adjacent skills must reuse the same purchase mechanism');

const catalogueFlow = await createFulfilment({ ownerPhone: owner, skill: 'purchase', mechanism: 'marketplace_purchase', requirements: { item: 'suya', quantity: 2, unit: 'portions', location: 'Ikeja' }, requiredInputs: ['item','quantity','location'], missingInputs: [] });
const catalogueOffer = await createOffer({ fulfilmentId: catalogueFlow.id, ownerPhone: owner, title: 'Beef suya', description: 'Two portions of beef suya', source: 'catalogue', status: 'available', priceMinor: 600000, currency: 'NGN', quantity: 2, unit: 'portions', availability: 'available_today', location: 'Ikeja', delivery: 'delivery', evidenceLevel: 'source_attributed', sourceRef: 'provider-catalogue:test' });
assert.equal((await listOffers(owner, catalogueFlow.id)).length, 1);
assert.equal(rankOffers(await listOffers(owner, catalogueFlow.id))[0]?.id, catalogueOffer.id, 'Verified/source-attributed offers must be rankable by one canonical resolver');
const selectedCatalogue = await selectOffer(owner, catalogueFlow.id, catalogueOffer.id);
assert.equal(selectedCatalogue.fulfilment.status, 'awaiting_confirmation', 'Selecting an offer must move the canonical fulfilment to user confirmation');
assert.equal(selectedCatalogue.offer.status, 'selected');

const inquiryFlow = await createFulfilment({ ownerPhone: owner, skill: 'food_order', mechanism: 'marketplace_purchase', requirements: { item: 'suya', quantity: 2, unit: 'portions', location: 'Ikeja', timing: 'today' }, requiredInputs: ['item','quantity','location'], missingInputs: [] });
const question = buildProviderInquiryQuestion({ item: 'suya', quantity: 2, unit: 'portions', location: 'Ikeja', timing: 'today' });
assert.match(question, /Do you currently have this available/);
const inquiry = await createProviderInquiry({ fulfilmentId: inquiryFlow.id, ownerPhone: owner, providerId: 'seller-1', providerPhone: '+2348012345678', providerName: 'Example Suya Seller', question, requestedFields: ['availability','price','delivery'] });
assert.equal(inquiry.status, 'pending');
const response = await recordProviderInquiryResponse({ ownerPhone: owner, inquiryId: inquiry.id, response: { availability: true, priceMinor: 600000, currency: 'NGN', delivery: 'yes' }, evidenceLevel: 'provider_confirmed', evidenceRef: `provider-message:${inquiry.id}`, offer: { providerId: 'seller-1', providerPhone: '+2348012345678', providerName: 'Example Suya Seller', title: 'Beef suya', description: 'Provider confirmed availability by inquiry response', source: 'provider_inquiry', priceMinor: 600000, currency: 'NGN', quantity: 2, unit: 'portions', availability: 'confirmed', location: 'Ikeja', delivery: 'yes', evidenceLevel: 'provider_confirmed', evidenceRef: `provider-message:${inquiry.id}` }, });
assert.equal(response.inquiry.status, 'responded');
assert.equal(response.inquiry.evidenceLevel, 'provider_confirmed');
assert.ok(response.offer, 'Provider response must materialize into the same Offer object used by catalogue results');
assert.equal(response.offer?.source, 'provider_inquiry');
assert.equal(response.offer?.evidenceLevel, 'provider_confirmed');
assert.equal((await listOffers(owner, inquiryFlow.id))[0]?.priceMinor, 600000);

await updateFulfilmentRequirements(owner, inquiryFlow.id, { budgetMinor: 700000 }, []);
const postUpdate = await (await import('../src/services/canonicalFulfilmentService.js')).getFulfilment(owner, inquiryFlow.id);
assert.equal(postUpdate?.requirements.budgetMinor, 700000, 'Conversation-collected requirements remain durable');
assert.equal(postUpdate?.ownerPhone, owner, 'Fulfilment state remains owner-scoped');

console.log(JSON.stringify({ passed: true, catalogueOffer: catalogueOffer.id, inquiry: inquiry.id, providerOffer: response.offer?.id }, null, 2));
