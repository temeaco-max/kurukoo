import assert from 'node:assert/strict';
import { routeIntent } from '../src/services/intentRouter.js';
import { processCanonicalChatTurn } from '../src/services/canonicalChatTurnService.js';
import { sendFcmPush } from '../src/services/pushNotifications.js';
import { createEconomicRequest, getEconomicRequest, transitionEconomicRequest } from '../src/services/skillFlows.js';
import { executeCanonicalCapabilityProposal } from '../src/services/canonicalCapabilityExecutor.js';
import { listAgentGoals } from '../src/services/agentRuntime.js';
import { upsertProfile } from '../src/routes/authRoutes.js';
import { addContact } from '../src/services/identityContactService.js';

const phone = `+234807${String(Date.now()).slice(-7)}`;
const conversationId = `chat-os-outcomes-${Date.now()}`;
const paymentPhone = `+234806${String(Date.now()).slice(-7)}`;
const paymentRequest = await createEconomicRequest({ id: `graceful-payment-${Date.now()}`, phone: paymentPhone, skill: 'product_sourcing', requirements: { product: 'replacement charger', location: 'Ikeja' } });
await transitionEconomicRequest(paymentRequest.id, 'awaiting_match');
await transitionEconomicRequest(paymentRequest.id, 'matched');
await transitionEconomicRequest(paymentRequest.id, 'quoted', { quote: { amountMinor: 125000, currency: 'NGN', source: 'test' } });

const remembered = await routeIntent('Remember that I prefer concise answers.', phone, undefined, undefined, conversationId);
assert.equal(remembered.skill, 'memory');
assert.equal(remembered.cardData?.type, 'memory_action');
assert.equal(remembered.canonicalAction, 'memory.record');

const memory = await routeIntent('What do you remember?', phone, undefined, undefined, conversationId);
assert.equal(memory.cardData?.type, 'memory');
assert.ok(memory.cardData?.ownerScoped);

const reminder = await routeIntent('Remind me in 2 hours to review the outcome slices.', phone, undefined, undefined, conversationId);
assert.equal(reminder.skill, 'reminder');
assert.equal(reminder.cardData?.type, 'reminder');
assert.equal(reminder.cardData?.reminder?.status, 'scheduled');

const reminders = await routeIntent('Show my reminders.', phone, undefined, undefined, conversationId);
assert.equal(reminders.cardData?.type, 'reminders');
assert.equal(reminders.cardData?.reminders?.length, 1);
const reminderId = String(reminders.cardData.reminders[0].id);
const cancelled = await routeIntent(`Cancel reminder ${reminderId}.`, phone, undefined, undefined, conversationId);
assert.equal(cancelled.cardData?.type, 'reminder_action');
assert.equal(cancelled.cardData?.status, 'completed');

await sendFcmPush(phone, 'Kurukoo test update', 'A stored update is ready for review.', '/chat/', { conversationId, canonicalAction: 'test.update', ownerScope: phone, idempotencyKey: `chat-os:${phone}` });
const notifications = await routeIntent('Show my notifications.', phone, undefined, undefined, conversationId);
assert.equal(notifications.cardData?.type, 'notifications');
assert.ok(notifications.cardData?.notifications?.length >= 1);
const notificationId = Number(notifications.cardData.notifications[0].id);
const marked = await routeIntent(`Mark notification ${notificationId} as read.`, phone, undefined, undefined, conversationId);
assert.equal(marked.cardData?.type, 'notification_action');
assert.equal(marked.cardData?.status, 'completed');

const points = await routeIntent('What is my points balance?', phone, undefined, undefined, conversationId);
assert.equal(points.cardData?.type, 'os_status');
assert.equal(points.cardData?.domain, 'points');

const subscription = await routeIntent('What is my subscription?', phone, undefined, undefined, conversationId);
assert.equal(subscription.cardData?.type, 'os_status');
assert.equal(subscription.cardData?.domain, 'subscription');

const channel = await routeIntent('Is WhatsApp connected?', phone, undefined, undefined, conversationId);
assert.equal(channel.cardData?.type, 'os_status');
assert.equal(channel.cardData?.domain, 'channel');

const createContext = { relation: 'create' } as any;
const makeDomainPhone = (offset: number) => `+234${String(Date.now() + offset).slice(-10)}`;
const recurringReminder = await routeIntent('Remind me every day at 9am to call John', makeDomainPhone(13), undefined, undefined, `${conversationId}-recurring-reminder`);
assert.equal(recurringReminder.skill, 'reminder');
assert.equal(recurringReminder.cardData?.type, 'reminder');
assert.equal(recurringReminder.cardData?.reminder?.status, 'scheduled');

const untilDoneReminder = await routeIntent('Keep reminding me until I deal with this', makeDomainPhone(15), undefined, undefined, `${conversationId}-until-done-reminder`);
assert.equal(untilDoneReminder.skill, 'reminder');
assert.equal(untilDoneReminder.cardData?.type, 'reminder_setup');
assert.equal(untilDoneReminder.cardData?.status, 'needs_user');

const plumber = await routeIntent('Find me a plumber tomorrow', makeDomainPhone(17), undefined, createContext, `${conversationId}-plumber`);
assert.equal(plumber.skill, 'find_worker');
assert.equal(plumber.cardData?.type, 'agentic_storefront');

const food = await routeIntent('Find me a good place to eat nearby', makeDomainPhone(23), undefined, createContext, `${conversationId}-food`);
assert.equal(food.skill, 'order_food');
assert.equal(food.cardData?.type, 'agentic_storefront');

const transport = await routeIntent('Get me to the airport tomorrow', makeDomainPhone(29), undefined, createContext, `${conversationId}-transport`);
assert.equal(transport.skill, 'ride_request');
assert.equal(transport.cardData?.type, 'agentic_storefront');

const nigeriaJourneyCases = [
  ['I\'m in Yaba. Get me to Lekki Phase 1.', 'ride_request'],
  ['I need to be in Victoria Island by 8pm.', 'ride_request'],
  ['Find me a bus to Ibadan.', 'ride_request'],
  ['Get me to Lagos airport at 6am tomorrow.', 'ride_request'],
] as const;
for (const [message, expectedSkill] of nigeriaJourneyCases) {
  const journey = await routeIntent(message, makeDomainPhone(30 + message.length), undefined, createContext, `${conversationId}-journey-${message.length}`);
  assert.equal(journey.skill, expectedSkill, `Journey request should resolve to ${expectedSkill}: ${message}`);
  assert.equal(journey.cardData?.type, 'agentic_storefront', `Journey request should enter the canonical storefront: ${message}`);
}

for (const [message, expectedSkill] of [
  ['Find me somewhere to stay in Lagos tomorrow.', 'hotel_deals'],
  ['Find me a two-bedroom apartment around Yaba under 500000.', 'rental_tracker'],
  ['Find me warehouse jobs around Lagos that I can apply for.', 'job_tracker'],
] as const) {
  const outcome = await routeIntent(message, makeDomainPhone(31 + message.length), undefined, createContext, `${conversationId}-broad-${message.length}`);
  assert.equal(outcome.skill, expectedSkill, `Broad outcome should resolve to ${expectedSkill}: ${message}`);
  assert.equal(outcome.cardData?.type, 'agentic_storefront', `Broad outcome should enter the canonical storefront: ${message}`);
}

const property = await routeIntent('Find a 2 bedroom furnished flat near a bus stop in Yaba with security.', makeDomainPhone(35), undefined, createContext, `${conversationId}-property-preferences`);
assert.equal(property.skill, 'rental_tracker');
const propertyRequest = await getEconomicRequest(property.cardData?.requestId || '');
assert.equal(propertyRequest?.requirements.bedrooms, 2, 'Property discovery must retain bedroom requirements.');
assert.equal(propertyRequest?.requirements.furnishing, 'furnished', 'Property discovery must retain furnishing preferences.');
assert.equal(propertyRequest?.requirements.security_requirements, 'security_requested', 'Property discovery must retain safety requirements without asserting building security.');
assert.match(String(propertyRequest?.requirements.transport_proximity || ''), /bus stop/i, 'Property discovery must retain transport-proximity preferences.');

const hotel = await routeIntent('Find a hotel in Yaba for 3 guests with 2 rooms and wheelchair access.', makeDomainPhone(36), undefined, createContext, `${conversationId}-hotel-preferences`);
assert.equal(hotel.skill, 'hotel_deals');
const hotelRequest = await getEconomicRequest(hotel.cardData?.requestId || '');
assert.equal(hotelRequest?.requirements.guest_count, 3, 'Hotel discovery must retain guest count.');
assert.equal(hotelRequest?.requirements.room_count, 2, 'Hotel discovery must retain room count.');
assert.equal(hotelRequest?.requirements.accessibility_requirements, 'accessibility_requested', 'Hotel discovery must retain accessibility needs without asserting a room is accessible.');

const charger = await routeIntent('Buy me a replacement charger', makeDomainPhone(31), undefined, createContext, `${conversationId}-charger`);
assert.equal(charger.skill, 'product_sourcing');
assert.equal(charger.cardData?.type, 'agentic_storefront');

const teacher = await routeIntent('Find someone who teaches guitar', makeDomainPhone(37), undefined, createContext, `${conversationId}-teacher`);
assert.equal(teacher.skill, 'find_worker');
assert.equal(teacher.cardData?.type, 'agentic_storefront');

const tutor = await routeIntent('Find a maths tutor in Yaba for lessons on Saturday.', makeDomainPhone(38), undefined, createContext, `${conversationId}-tutor`);
assert.equal(tutor.skill, 'find_worker', 'Ordinary tutor language must enter the existing local-help outcome rather than generic conversation.');
assert.equal(tutor.cardData?.type, 'agentic_storefront');
assert.equal((await getEconomicRequest(tutor.cardData?.requestId || ''))?.requirements.service, 'teacher', 'Tutor language must seed the reusable teacher-provider service required for discovery.');

const automotive = await routeIntent('Find a car mechanic in Ikeja to diagnose my engine problem today.', makeDomainPhone(40), undefined, createContext, `${conversationId}-automotive`);
assert.equal(automotive.skill, 'find_worker', 'Vehicle repair wording must enter the existing local-mechanic outcome rather than a ride request.');
assert.equal(automotive.cardData?.type, 'agentic_storefront');
assert.equal((await getEconomicRequest(automotive.cardData?.requestId || ''))?.requirements.service, 'mechanic', 'Automotive repair must seed the mechanic service required for provider discovery.');

const internet = await routeIntent('Arrange someone to set up Wi-Fi in Yaba tomorrow.', makeDomainPhone(42), undefined, createContext, `${conversationId}-internet-service`);
assert.equal(internet.skill, 'wifi_installer', 'Ordinary internet setup language must enter the existing Wi-Fi installer outcome rather than generic conversation.');
assert.equal(internet.cardData?.type, 'agentic_storefront');
assert.match(String((await getEconomicRequest(internet.cardData?.requestId || ''))?.requirements.objective || ''), /set up Wi-Fi/i, 'Internet outcome must retain the user’s stated service objective for provider coordination.');

const healthcare = await routeIntent('Find a dermatologist in Yaba next week for this recurring rash. I need wheelchair access and will use NHIA.', makeDomainPhone(43), undefined, createContext, `${conversationId}-healthcare-appointment`);
assert.equal(healthcare.skill, 'doctor_appointment', 'A healthcare appointment request must enter the bounded shared booking outcome.');
assert.equal(healthcare.cardData?.type, 'agentic_storefront');
const healthcareRequest = await getEconomicRequest(healthcare.cardData?.requestId || '');
assert.equal(healthcareRequest?.requirements.objective, 'this recurring rash', 'Healthcare routing must preserve the stated concern without diagnosing it.');
assert.equal(healthcareRequest?.requirements.location, 'Yaba', 'Healthcare routing must preserve the requested area.');
assert.equal(healthcareRequest?.requirements.timing, 'next week', 'Healthcare routing must preserve appointment timing.');
assert.equal(healthcareRequest?.requirements.specialist, 'dermatologist', 'Healthcare routing must preserve specialist preference.');
assert.equal(healthcareRequest?.requirements.accessibility, 'wheelchair access', 'Healthcare routing must preserve accessibility needs.');
assert.equal(healthcareRequest?.requirements.insurance_context, 'NHIA', 'Healthcare routing must preserve insurance context without claiming eligibility.');
assert.match(healthcare.reply, /(?:verified provider|appointment|availability|confirm)/i, 'Healthcare response must remain a coordination state rather than a diagnosis or booking claim.');

const repair = await routeIntent('I need my iPhone 13 repaired for a cracked screen. Pick it up from 12 Allen Avenue in Ikeja and return it to 14 Allen Avenue. Diagnose it first.', makeDomainPhone(44), undefined, createContext, `${conversationId}-repair-pickup-return`);
assert.equal(repair.skill, 'repair', 'A phone repair request must enter the existing repair outcome rather than a generic worker route.');
assert.equal(repair.cardData?.type, 'agentic_storefront');
const repairRequest = await getEconomicRequest(repair.cardData?.requestId || '');
assert.equal(repairRequest?.requirements.fulfilment_method, 'pickup_return', 'Repair coordination must retain the requested pickup-and-return method.');
assert.equal(repairRequest?.requirements.collection_address, '12 Allen Avenue in Ikeja', 'Repair coordination must retain the requested collection address.');
assert.equal(repairRequest?.requirements.delivery_address, '14 Allen Avenue', 'Repair coordination must retain the requested return address.');
assert.equal(repairRequest?.requirements.diagnostic_authorization, 'diagnosis_before_repair', 'Repair coordination must retain the customer’s diagnostic authorization.');

for (const [offset, message, firstSkill] of [
  [61, 'I need somewhere to stay next week.', 'hotel_deals'],
  [67, 'Sort out my internet.', 'wifi_installer'],
  [71, 'I need to get to the airport tomorrow.', 'ride_request'],
  [73, 'Find and buy the right charger for this laptop.', 'phone_repairer'],
] as const) {
  const composed = await processCanonicalChatTurn({ phone: makeDomainPhone(offset), message, channel: 'web', conversationId: `${conversationId}-composed-${offset}` });
  assert.equal(composed.cardData?.type, 'agent_goal');
  assert.equal(composed.cardData?.subGoals?.[0]?.goalType, firstSkill);
  assert.ok(composed.cardData?.firstCapability !== undefined, `Expected first capability projection for ${message}`);
  assert.ok(/No external (?:success|action)|not claimed/i.test(composed.reply), `Expected truthful boundary for ${message}`);
  assert.equal(composed.cardData?.truthful, true);
}

const ownedFoodPhone = makeDomainPhone(39);
await upsertProfile(ownedFoodPhone, 'Owned Food User');
const ownedFoodConversation = `${conversationId}-owned-food`;
const ownedFood = await processCanonicalChatTurn({ phone: ownedFoodPhone, message: 'I am hungry. Find me something good nearby and get it delivered.', channel: 'web', conversationId: ownedFoodConversation });
assert.equal(ownedFood.cardData?.type, 'agentic_storefront');
assert.equal(ownedFood.cardData?.ownedWork, true, 'ordinary storefront outcomes should become owned work without requiring a separate monitor command');
assert.equal(typeof ownedFood.cardData?.agentGoalId, 'string');
assert.equal((await listAgentGoals(ownedFoodPhone)).some(goal => goal.id === ownedFood.cardData?.agentGoalId && goal.economicRequestId === ownedFood.cardData?.requestId), true, 'the food outcome must persist one goal attached to the same canonical request');

const communityPhone = makeDomainPhone(44);
const communityThread = `${conversationId}-community`;
const communityMessage = 'Ask the community where neighbours have found safe generator repair guidance in Ibadan.';
const communityDraft = await routeIntent(communityMessage, communityPhone, undefined, createContext, communityThread);
assert.equal(communityDraft.skill, 'topic');
assert.equal(communityDraft.cardData?.type, 'topic_draft');
assert.equal(communityDraft.cardData?.status, 'review_required');
assert.equal(communityDraft.cardData?.privacy, 'private_by_default');
assert.equal(typeof communityDraft.cardData?.topicId, 'string');
assert.equal(communityDraft.cardData?.requestId, undefined, 'A community draft must not create an Economic Request.');
const replayedCommunityDraft = await routeIntent(communityMessage, communityPhone, undefined, createContext, communityThread);
assert.equal(replayedCommunityDraft.cardData?.topicId, communityDraft.cardData?.topicId, 'A replayed Chat turn must return to the same private Topic draft.');

const monitoring = await routeIntent('Keep an eye on my Wi-Fi', makeDomainPhone(41), undefined, undefined, `${conversationId}-monitoring`);
assert.equal(monitoring.skill, 'autonomous_agent');
assert.equal(monitoring.cardData?.type, 'monitoring_setup');

const communication = await routeIntent('Tell John I am late', makeDomainPhone(43), undefined, undefined, `${conversationId}-communication`);
assert.equal(communication.skill, 'communication');
assert.equal(communication.cardData?.type, 'communication_prepare');
assert.equal(communication.cardData?.deliveryState, 'not_sent');

const monitoringTurn = await processCanonicalChatTurn({ phone: makeDomainPhone(47), message: 'Keep an eye on my Wi-Fi', channel: 'web', conversationId: `${conversationId}-monitoring-turn` });
assert.equal(monitoringTurn.cardData?.type, 'monitoring_setup');

const communicationPhone = makeDomainPhone(53);
const johnPhone = makeDomainPhone(54);
const communicationThread = `${conversationId}-communication-turn`;
await upsertProfile(communicationPhone, 'Communication Owner');
await upsertProfile(johnPhone, 'John Ade');
await addContact(communicationPhone, johnPhone, 'John');
const communicationTurn = await processCanonicalChatTurn({ phone: communicationPhone, message: 'Tell John I am late', channel: 'web', conversationId: communicationThread });
assert.equal(communicationTurn.cardData?.type, 'communication_prepare');
assert.equal(communicationTurn.cardData?.deliveryState, 'not_sent');
const recipientResolved = await processCanonicalChatTurn({ phone: communicationPhone, message: 'Resolve the recipient for this message', channel: 'web', conversationId: communicationThread });
assert.equal(recipientResolved.cardData?.type, 'communication_prepare');
assert.equal(recipientResolved.cardData?.status, 'recipient_ready');
assert.equal(recipientResolved.cardData?.recipientResolved, true);
assert.equal(recipientResolved.cardData?.deliveryState, 'not_sent');
const channelUnavailable = await processCanonicalChatTurn({ phone: communicationPhone, message: 'Choose an available channel for this message', channel: 'web', conversationId: communicationThread });
assert.equal(channelUnavailable.cardData?.type, 'communication_prepare');
assert.equal(channelUnavailable.cardData?.status, 'channel_unavailable');
assert.equal(channelUnavailable.cardData?.deliveryState, 'not_sent');
assert.match(channelUnavailable.reply, /no authorised delivery channel is active/i);

const brief = await processCanonicalChatTurn({ phone, message: 'Show me what I need to deal with.', channel: 'web', conversationId });
assert.equal(brief.cardData?.type, 'agent_brief');

const firstItem = await processCanonicalChatTurn({ phone, message: 'Deal with the first one.', channel: 'web', conversationId });
assert.ok(['agent_brief', 'notification_action', 'reminder_action', 'task_action', 'agent_goal', 'agentic_storefront'].includes(String(firstItem.cardData?.type)));

const requestStatus = await routeIntent("What's the status of my request?", phone, undefined, undefined, conversationId);
assert.equal(requestStatus.cardData?.type, 'request_status');
assert.equal(requestStatus.cardData?.status, 'not_found');

const previousOutcome = await routeIntent('What happened with that?', phone, undefined, undefined, conversationId);
assert.equal(previousOutcome.cardData?.type, 'request_status');
assert.equal(previousOutcome.cardData?.relativeReference, true);
assert.equal(previousOutcome.cardData?.status, 'not_found');

const paymentPreparation = await executeCanonicalCapabilityProposal({ phone: paymentPhone, capability: 'payment', action: 'status', canonicalObjectId: paymentRequest.id, arguments: {}, conversationId, channel: 'web' });
assert.equal(paymentPreparation.canonicalFacts?.paymentPrepared, true, 'A quoted request must be prepared locally before payment activation.');
assert.equal(paymentPreparation.canonicalFacts?.paymentActivation, 'required', 'Unconfigured payment must remain an explicit final dependency.');
assert.equal(paymentPreparation.nextActions?.[0]?.action, 'connect_payment');

const whatsappReadiness = await executeCanonicalCapabilityProposal({ phone, capability: 'channel', action: 'status', canonicalObjectId: 'whatsapp', arguments: { channel: 'whatsapp' }, conversationId, channel: 'web' });
assert.equal(whatsappReadiness.canonicalFacts?.requested?.preparationAvailable, true, 'WhatsApp preparation must remain available without live WhatsApp delivery.');
assert.equal(whatsappReadiness.canonicalFacts?.requested?.activation, 'required', 'WhatsApp activation must remain explicit when not connected.');
assert.equal(whatsappReadiness.nextActions?.[0]?.action, 'use_chat');

const composed = await processCanonicalChatTurn({ phone, message: 'I need to get my laptop sorted.', channel: 'web', conversationId: `${conversationId}-composed` });
assert.equal(composed.cardData?.type, 'agent_goal', 'A broad device outcome must create one composed objective card.');
assert.ok(Array.isArray(composed.cardData?.subGoals) && composed.cardData.subGoals.length === 3, 'The device outcome must expose ordered device, expert, and follow-up sub-goals.');
assert.equal(composed.canonicalAction, 'agent.goal.coordinate');
assert.equal(composed.cardData.subGoals[1]?.status, 'waiting_on_dependency', 'Expert escalation must wait for the device evidence step.');
assert.ok(composed.cardData.goal?.plan?.capabilityPath?.understand?.length, 'Composed goals must explain what Kurukoo understands.');
assert.ok(composed.cardData.goal?.plan?.capabilityPath?.assist?.length, 'Composed goals must explain local assistance.');
assert.ok(composed.cardData.goal?.plan?.capabilityPath?.act?.length, 'Composed goals must explain the guarded action path.');
assert.ok(composed.cardData.goal?.plan?.capabilityPath?.delegate?.length, 'Composed goals must explain provider delegation where relevant.');
assert.ok(composed.cardData.goal?.plan?.capabilityPath?.continue?.length, 'Composed goals must explain how the outcome continues.');

console.log('Chat OS outcome slices passed: memory record/review, relative request-status continuity, one-shot and recurring reminders, safe until-complete reminder clarification, notification inbox/read, Nigeria-first journey understanding and canonical transport storefront routing, provider/food/transport/product/discovery outcome routing, monitoring setup, communication preparation, Agent Brief attention and first-item continuation, Points/subscription/channel status, and exact request-status fallback.');

process.exit(0);

