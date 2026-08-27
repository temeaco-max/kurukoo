import { queryUnifiedAI, type AIProvider, type ConversationalContextHint } from './unifiedAiEngine.js';
import { decideConversationIntelligence } from './conversationIntelligenceService.js';
import { getProfile, getMemoryFacts, updateProfile } from './memoryProfile.js';
import { delegateToAgentForSkill } from './aiAgentService.js';
import { getContextualIntentSuggestions, getEconomicCategory, getEconomicRequest, getKnownSkills, getSkillFlow } from './skillFlows.js';
import { classifyWithFastText } from './fastTextService.js';
import { advanceStorefront, previewStorefrontCard, startStorefrontSession, tryResumeStorefront } from './agenticStorefront.js';
import { searchKnownEconomicOffers } from './economicParticipants.js';
import { listReminders } from './reminderService.js';
import { listSafetyContacts } from './safetyService.js';
import { getInternalNotificationById, getInternalNotifications, markNotificationRead } from './pushNotifications.js';
import { cancelAgentGoal, listAgentGoals, pauseAgentGoal, resumeAgentGoal } from './agentRuntime.js';
import { acceptTask, completeTask, listAssignedTasks } from './microTasks.js';
import { generateReferralCode } from './referralService.js';
import { getAssistanceOutcome } from './assistanceOutcomeService.js';
import { resolveConversationPriority } from './conversationPriorityService.js';
import { executeCanonicalCapabilityProposal } from './canonicalCapabilityExecutor.js';
import { connectedResourceSupportProfile, connectedResourceSupports, listConnectedResources } from './connectedResourceService.js';
import { listChatMessages } from './chatConversationService.js';
import { createTopicDraft } from './topicService.js';
import { getPersonProfile, listContacts } from './identityContactService.js';
import { getWhatsAppBusinessStatus, sendWhatsAppBusinessText } from './whatsappBusinessPlatformService.js';
import { recordChannelDispatch } from './channelDeliveryState.js';
import type { IntentRoutingResult } from '../types.js';
import { extractConversationalEntities, extractFoodOrderSlots, isFoodOrderExpression, validateConversationalEntities } from './conversationalExtraction.js';

const ACTION_INTENTS = new Set(['ride_request', 'order_food', 'buy_airtime', 'find_worker', 'universal_vendor_order', 'sports_matchmaking', 'event_coverage', 'how_to_video', 'security_booking', 'circle_create', 'artist_booking', 'national_events', 'subscription', 'advertising', 'autonomous_agent', 'referral', 'nearby_pulse_start', 'nearby_pulse_stop']);
const STOREFRONT_INTENTS = new Set(['ride_request', 'order_food', 'buy_airtime', 'find_worker', 'universal_vendor_order', 'security_booking']);

const CANONICAL_ALIASES: Array<[RegExp, string]> = [
  [/\b(jollof|fried rice|meal for|food for)\b/, 'order_food'],
  [/\b(?:buy|send|get|top[ -]?up|recharge)\b.*\b(?:airtime|credit)\b|\b(?:airtime|credit)\b.*\b(?:buy|send|top[ -]?up|recharge)\b/, 'buy_airtime'],
  [/\b(buy|purchase|get)\b.*\b(car|vehicle)\b|\b(car|vehicle)\b.*\b(buy|purchase)\b/, 'buy_car'],
  [/\b(buy|purchase|get)\b.*\btickets?\b|\btickets?\b.*\b(buy|purchase|get)\b/, 'buy_ticket'],
  [/\b(phone|device|laptop|computer|screen)\b.*\brepair\b|\brepair\b.*\b(phone|device|laptop|computer|screen)\b/, 'repair'],
  [/\b(?:check|diagnose|troubleshoot|investigate|help(?: me)? with)\b.*\b(?:wi-?fi|network|internet|device|phone|iphone|ipad|laptop|macbook|computer|tv|camera|cctv|router|iot)\b|\b(?:wi-?fi|network|internet|device|phone|iphone|ipad|laptop|macbook|computer|tv|camera|cctv|router|iot)\b.*\b(?:slow|slowly|sluggish|offline|not working|won't connect|will not connect|malware|virus|charging|diagnostic|diagnostics)\b/, 'device_support'],
  [/\b(source|source me|find|procure)\b.*\b(product|products|goods|item)\b|\b(phone\s+charger|charger|replacement\s+part|spare\s+part|phone\s+accessory)\b/, 'product_sourcing'],
  [/\b(bodyguard|security guard|security personnel|private security)\b/, 'security_personnel'],
  [/\b(?:plumber|plumb|electrician|electrical|mechanic|carpenter|tailor|cleaner|clean|cleaning|housekeeping|technician|painter|paint|painting|decorator|decorating|tiler|tiling|roofer|roofing|mason|welder)\b|\b(?:find|need)(?: me)?\s+(?:someone|a person|a worker)\s+(?:to\s+)?(?:help|clean|fix|repair|paint|move|install|build|assemble)\b|\b(?:fix|repair)\b.*\b(?:tap|faucet|leak|plumbing)\b|\bhelp\s+with\s+(?:my\s+)?(?:house|home|garden|yard|roof|kitchen|bathroom|moving)\b|\b(?:can|could|would)\s+(?:someone|anyone)\s+(?:help|clean|fix|repair|paint|move|install|build|assemble)\b/, 'find_worker'],
  [/\b(order|get|buy)\b.*\b(food|meal|rice|groceries|groceries?)\b/, 'order_food'],
  [/\b(?:get|take|drive|bring)\s+me\s+(?:to|from)\b|\b(?:need|want)\s+to\s+(?:get|be)\s+(?:to|in)\b|\b(?:airport|bus|train|ferry|taxi|uber|bolt|indrive|okada|keke|tricycle|ride|journey|trip)\b.*\b(?:tomorrow|today|tonight|by\s+\d|arrive|arrival|leave|leaving|cheapest|fastest|quickest)\b/, 'ride_request'],
  [/\b(okada|motorbike|motorcycle)\b/, 'okada_rider'],
  [/\bkeke|tricycle\b/, 'keke_driver'],
  [/\b(taxi|cab|uber|ride-hailing)\b/, 'taxi_driver'],
  [/\b(ride|trip)\b/, 'ride_request'],
  [/(?:\b(book|hire|need|get|find|help me with|want)\b.*\b(artist|musician|dj|celebrity|performer|creator)\b|\b(?:artist|musician|dj|celebrity|performer|creator)\b\s+(?:for hire|services?))/, 'verified_artist'],
  [/\b(football|basketball|tennis|pitch|match|league|team|player)\b/, 'sports_matchmaking'],
  [/\b(verify|evidence|capture|report|contributor|event coverage)\b/, 'event_coverage'],
  [/\b(happening|event|events|calendar|daily picks)\b/, 'national_events']
];

function skillForIntent(intent: string): string {
  if (intent === 'ride_request') return 'ride_request';
  if (intent === 'order_food' || intent === 'universal_vendor_order') return 'order_food';
  if (intent === 'buy_airtime') return 'buy_airtime';
  if (intent === 'find_worker') return 'find_worker';
  if (intent === 'security_booking') return 'security_personnel';
  if (intent === 'artist_booking') return 'verified_artist';
  return intent;
}

function parsePersistedCard(row: any): any | null {
  try {
    const raw = row?.card_data ?? row?.cardData;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function communicationCard(input: { recipient: string; body: string; status: string; recipientResolved?: boolean; channel?: string | null; deliveryState?: string; actions?: any[]; messageId?: string }) {
  return {
    type: 'communication_prepare',
    status: input.status,
    recipient: input.recipient,
    body: input.body,
    recipientResolved: Boolean(input.recipientResolved),
    channel: input.channel || null,
    deliveryState: input.deliveryState || 'not_sent',
    providerMessageId: input.messageId,
    actions: input.actions || [],
    truthful: true,
  };
}

async function findPreparedCommunication(phone: string, conversationId?: string): Promise<any | null> {
  if (!conversationId) return null;
  const messages = await listChatMessages(phone, { conversationId, limit: 50 });
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const card = parsePersistedCard(messages[index]);
    if (card?.type === 'communication_prepare' && card.recipient && card.body) return card;
  }
  return null;
}

async function resolveCommunicationRecipient(phone: string, recipient: string, recipientPhone?: string) {
  if (recipientPhone) {
    try {
      const exactContact = await getPersonProfile(phone, recipientPhone, 'message');
      if (exactContact?.communication.message) return exactContact;
    } catch { /* Removed or unauthorized contacts must not be recovered by an old prepared card. */ }
  }
  const wanted = recipient.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!wanted) return null;
  const contacts = await listContacts(phone);
  const exact = contacts.find((contact) => String(contact.displayName || '').trim().toLowerCase() === wanted);
  if (exact) return exact;
  const matches = contacts.filter((contact) => {
    const name = String(contact.displayName || '').trim().toLowerCase();
    return name.startsWith(`${wanted} `) || wanted.startsWith(`${name} `);
  });
  return matches.length === 1 ? matches[0] : null;
}

async function continuePreparedCommunication(phone: string, message: string, conversationId?: string): Promise<IntentRoutingResult | null> {
  const normalized = message.trim().toLowerCase();
  if (!/^(?:resolve the recipient for this message|choose an available channel for this message|confirm(?: and)? send(?:ing)? this message|copy this message)\b/.test(normalized)) return null;
  const prepared = await findPreparedCommunication(phone, conversationId);
  if (!prepared) return null;
  const recipient = await resolveCommunicationRecipient(phone, String(prepared.recipient), typeof prepared.recipientPhone === 'string' ? prepared.recipientPhone : undefined);
  const base = { recipient: String(prepared.recipient), body: String(prepared.body) };
  if (/^resolve the recipient/.test(normalized)) {
    if (!recipient) return { skill: 'communication', reply: `I could not match **${base.recipient}** to one authorised contact. Your message is still saved in this conversation and has not been sent. Add or identify the contact before choosing a delivery channel.`, cardData: communicationCard({ ...base, status: 'needs_recipient', actions: [{ id: 'copy_message', label: 'Copy message', style: 'secondary' }] }), canonicalAction: 'communication.recipient_required', progressStage: 'understanding', extractionSource: 'deterministic' };
    return { skill: 'communication', reply: `I found the authorised contact **${recipient.displayName}**. Your message is still unsent. I can now check the available delivery route.`, cardData: communicationCard({ ...base, recipient: recipient.displayName, status: 'recipient_ready', recipientResolved: true, actions: [{ id: 'choose_channel', label: 'Choose an available channel' }] }), canonicalAction: 'communication.channel_review', progressStage: 'ready', extractionSource: 'deterministic' };
  }
  if (!recipient) return { skill: 'communication', reply: `I still need to match **${base.recipient}** to an authorised contact before I can prepare a delivery route. Nothing has been sent.`, cardData: communicationCard({ ...base, status: 'needs_recipient', actions: [{ id: 'resolve_recipient', label: 'Resolve recipient' }, { id: 'copy_message', label: 'Copy message', style: 'secondary' }] }), canonicalAction: 'communication.recipient_required', progressStage: 'understanding', extractionSource: 'deterministic' };
  if (/^choose an available channel/.test(normalized)) {
    if (!getWhatsAppBusinessStatus().enabled) return { skill: 'communication', reply: `I found **${recipient.displayName}**, but no authorised delivery channel is active for this message. The message remains saved here for you to copy or send once a channel is connected.`, cardData: communicationCard({ ...base, recipient: recipient.displayName, status: 'channel_unavailable', recipientResolved: true, actions: [{ id: 'copy_message', label: 'Copy message', style: 'secondary' }] }), canonicalAction: 'communication.channel_unavailable', progressStage: 'ready', extractionSource: 'deterministic' };
    return { skill: 'communication', reply: `WhatsApp is available for **${recipient.displayName}**. Review the message and confirm before I hand it to the channel; acceptance and delivery remain separate evidence states.`, cardData: communicationCard({ ...base, recipient: recipient.displayName, status: 'ready_to_send', recipientResolved: true, channel: 'WhatsApp', actions: [{ id: 'confirm_send', label: 'Confirm and send' }, { id: 'copy_message', label: 'Copy message', style: 'secondary' }] }), canonicalAction: 'communication.send_confirmation', progressStage: 'ready', extractionSource: 'deterministic' };
  }
  if (/^copy this message/.test(normalized)) return { skill: 'communication', reply: `Here is the unsent message for **${recipient.displayName}**:\n\n${base.body}\n\nNo channel delivery was attempted.`, cardData: communicationCard({ ...base, recipient: recipient.displayName, status: 'copy_ready', recipientResolved: true, actions: [{ id: 'choose_channel', label: 'Choose an available channel' }] }), canonicalAction: 'communication.copy_ready', progressStage: 'information', extractionSource: 'deterministic' };
  if (!getWhatsAppBusinessStatus().enabled) return { skill: 'communication', reply: 'No authorised WhatsApp delivery route is active, so I did not send the message. It remains saved in this conversation for you to copy or send after a channel is connected.', cardData: communicationCard({ ...base, recipient: recipient.displayName, status: 'channel_unavailable', recipientResolved: true, actions: [{ id: 'copy_message', label: 'Copy message', style: 'secondary' }] }), canonicalAction: 'communication.channel_unavailable', progressStage: 'ready', extractionSource: 'deterministic' };
  const sent = await sendWhatsAppBusinessText(recipient.phone, base.body);
  if (!sent.ok || !sent.messageId) return { skill: 'communication', reply: 'I could not hand that message to WhatsApp, so I have not claimed it was sent. The message remains saved here for you to retry or copy.', cardData: communicationCard({ ...base, recipient: recipient.displayName, status: 'send_failed', recipientResolved: true, channel: 'WhatsApp', deliveryState: 'not_sent', actions: [{ id: 'copy_message', label: 'Copy message', style: 'secondary' }, { id: 'choose_channel', label: 'Review channel' }] }), canonicalAction: 'communication.send_failed', progressStage: 'ready', extractionSource: 'deterministic' };
  await recordChannelDispatch({ channel: 'whatsapp', provider: 'meta_whatsapp_business', providerMessageId: sent.messageId, phone, status: 'accepted', raw: { recipient: recipient.phone } });
  return { skill: 'communication', reply: `WhatsApp accepted the message for **${recipient.displayName}**. I have not claimed delivery; that needs a delivery report from the channel.`, cardData: communicationCard({ ...base, recipient: recipient.displayName, status: 'accepted', recipientResolved: true, channel: 'WhatsApp', deliveryState: 'accepted', messageId: sent.messageId }), canonicalAction: 'communication.dispatch_accepted', progressStage: 'coordinating', extractionSource: 'deterministic' };
}

function isExploratoryQuestion(query: string): boolean {
  const asksToExplore = /^(?:where can i get|where do i get|do you know where|is there|who sells|what(?:'s| is) a good place for|can i find)\b/i.test(query.trim());
  const localTopic = /\b(?:suya|food|meal|rice|groceries?|restaurant|seller|market|cleaner|plumber|electrician|repair(?:er)?|provider)\b/i.test(query);
  const explicitAction = /\b(?:order|buy|book|hire|deliver|send|bring|purchase|get me|find me|arrange)\b/i.test(query);
  return asksToExplore && localTopic && !explicitAction;
}

function actionCard(intent: string): any {
  if (STOREFRONT_INTENTS.has(intent)) return previewStorefrontCard(skillForIntent(intent));
  if (intent === 'sports_matchmaking') return { type: 'sports_search' };
  if (intent === 'event_coverage') return { type: 'event_coverage', status: 'offer' };
  if (intent === 'national_events') return { type: 'events_list' };
  if (intent === 'artist_booking') return previewStorefrontCard('verified_artist');
  return undefined;
}

function requirementPrompt(category: string | null, skill: string): string {
  switch (category) {
    case 'transport-mobility': return 'Where are you going, when do you need it, and do you have a vehicle preference?';
    case 'food-drink': return 'What do you want, where should it be delivered or collected, and when?';
    case 'repairs-maintenance': return 'What needs fixing, where are you, and how urgent is it?';
    case 'events-entertainment': return 'What is the event, date, location, expected audience, and budget?';
    case 'automotive-mechanics': return 'What vehicle or service do you need, where are you, and when?';
    case 'classifieds-marketplace': return 'What exactly are you looking for, your budget, and your preferred area?';
    case 'gigs-microtasks': return 'What needs to be done, where, when, and what budget or rate do you have?';
    case 'professional-services': return 'What outcome do you need, where are you, and what deadline or budget applies?';
    case 'sports-recreation': return 'Which sport or activity, where, when, and how many people are involved?';
    case 'health-medical': return 'What service do you need, where are you, and how soon do you need help?';
    default: return `Tell me what you need for ${skill.replace(/_/g, ' ')}, where you need it, and when.`;
  }
}

function flowReply(intent: string, flow: any): string {
  if (!flow) return `I can help with ${intent.replace(/_/g, ' ')}. ${requirementPrompt(getEconomicCategory(intent), intent)}`;
  const action = flow.post_match_action || 'match a suitable provider';
  const questions = flow.question_set ? flow.question_set.replace(/[\[\]{}]/g, '').trim() : '';
  return questions ? `I can help with this. ${questions} I’ll use the Kurukoo flow to ${action.toLowerCase()} and show you the next step before anything is committed.` : `I can help with this. ${requirementPrompt(flow.category || getEconomicCategory(intent), intent)} I’ll use the Kurukoo flow to ${action.toLowerCase()} and show you the next step before anything is committed.`;
}

function matchCanonicalSkill(query: string): string | null {
  for (const [pattern, skill] of CANONICAL_ALIASES) if (pattern.test(query)) return skill;
  const skills = getKnownSkills().filter(skill => skill.length >= 4);
  for (const skill of skills) {
    const phrase = skill.replace(/_/g, ' ').toLowerCase();
    if (query.includes(phrase)) return skill;
  }
  return null;
}

async function balanceReply(phone?: string): Promise<string> {
  if (!phone) return 'Your Kurukoo Points balance is available in the header.';
  const profile = await getProfile(phone, 'conversation_balance');
  const points = profile?.points_balance ?? 0;
  const location = profile?.location || 'your area';
  return `🪙 **${points} Points**\n\nKurukoo remembers you’re in **${location}**. Your Points stay attached to the same Memory Profile across channels.`;
}

function isResumePhrase(q: string): boolean {
  return /\b(continue|resume|open request|my request|the match|found a match|provider matched|pick up|where we left|deferred request|continue with)\b/.test(q);
}

function parseReminderQuery(q: string): { dueAt: string; title: string; displayTime: string; recurrence?: 'daily' | 'weekly' } | null {
  const input = /^(?:set (?:me )?a reminder|remind me)\b/i.test(q) ? q.replace(/^set (?:me )?a reminder\b/i, 'remind me') : q;
  const rel = input.match(/^remind me\s+(?:in\s+)?(\d+)\s+(minute|minutes|hour|hours|day|days)\s+(?:to\s+)?(.+)$/i);
  if (rel) {
    const amount = Number(rel[1]); const unit = rel[2].toLowerCase(); const multiplier = unit.startsWith('hour') ? 3600_000 : unit.startsWith('day') ? 86400_000 : 60_000; const ms = amount * multiplier;
    if (Number.isFinite(ms) && ms > 0) return { dueAt: new Date(Date.now() + ms).toISOString(), title: rel[3].trim(), displayTime: `in ${amount} ${unit}` };
  }
  const abs = input.match(/^remind me\s+(?:(every\s+day|every\s+week|daily|weekly)?\s*)?(?:on\s+([a-z]+)\s+)?(?:(tomorrow|today)\s+)?(?:(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+)?(?:to\s+)?(.+)$/i);
  if (abs) {
    const recurrence = abs[1]?.toLowerCase(), day = abs[2]?.toLowerCase(), relative = abs[3]?.toLowerCase(); let hour = Number(abs[4] || 9); const min = Number(abs[5] || 0); const meridiem = abs[6]?.toLowerCase(); if (meridiem === 'pm' && hour < 12) hour += 12; if (meridiem === 'am' && hour === 12) hour = 0;
    const d = new Date(); d.setHours(hour, min, 0, 0); if (relative === 'tomorrow') d.setDate(d.getDate() + 1);
    if (day) { const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']; const target = days.indexOf(day); if (target !== -1) { let diff = target - d.getDay(); if (diff <= 0) diff += 7; d.setDate(d.getDate() + diff); } }
    if (d.getTime() <= Date.now() && !day && !relative) d.setDate(d.getDate() + 1);
    const normalizedRecurrence = recurrence === 'daily' || recurrence === 'every day' ? 'daily' : recurrence === 'weekly' || recurrence === 'every week' ? 'weekly' : undefined;
    return { dueAt: d.toISOString(), title: abs[7].trim(), displayTime: `${relative || day ? `${relative || day} at ` : ''}${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${normalizedRecurrence ? ` (${normalizedRecurrence})` : ''}`, recurrence: normalizedRecurrence };
  }
  return null;
}

function suggestionCard(intent: string) { const suggestions = getContextualIntentSuggestions(intent); return suggestions.length ? { type: 'intent_suggestions', intent, suggestions } : undefined; }
function decorateCardWithSuggestions(card: any, intent: string) { const suggestions = getContextualIntentSuggestions(intent); return suggestions.length ? { ...(card || {}), suggestions } : card; }

function deviceResourceMatches(query: string, resource: { kind: string; label: string }): boolean {
  const text = query.toLowerCase();
  const label = resource.label.toLowerCase();
  if (label && text.includes(label)) return true;
  if (/\b(?:camera|cctv)\b/.test(text)) return ['camera', 'cctv'].includes(resource.kind);
  if (/\b(?:tv|television)\b/.test(text)) return resource.kind === 'tv';
  if (/\b(?:laptop|macbook|computer|desktop)\b/.test(text)) return ['laptop', 'desktop'].includes(resource.kind);
  if (/\b(?:phone|iphone|ipad|tablet|android)\b/.test(text)) return ['phone', 'tablet'].includes(resource.kind);
  if (/\b(?:wi-?fi|router|internet|network)\b/.test(text)) return ['phone', 'tablet', 'laptop', 'desktop', 'iot', 'other'].includes(resource.kind);
  return true;
}

async function recentDeviceObservation(phone: string, threadId: string | undefined, query: string): Promise<Record<string, unknown> | undefined> {
  const rows = await listChatMessages(phone, threadId ? { conversationId: threadId, limit: 40 } : { limit: 40 });
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    let card: any;
    try { card = rows[index]?.card_data ? (typeof rows[index].card_data === 'string' ? JSON.parse(rows[index].card_data) : rows[index].card_data) : null; } catch { card = null; }
    if (!card || card.type !== 'device_support' || !card.resource || typeof card.resource !== 'object') continue;
    const resource = card.resource as Record<string, unknown>;
    const label = String(resource.label || '').trim();
    const kind = String(resource.kind || '').trim().toLowerCase();
    const text = query.toLowerCase();
    const sameResource = Boolean(label && text.includes(label.toLowerCase())) || Boolean(kind && new RegExp(`\\b${kind.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i').test(text));
    if (!sameResource) continue;
    let observedState: unknown = card.observedState;
    try { observedState = JSON.parse(JSON.stringify(observedState)); } catch { observedState = String(observedState || '').slice(0, 500); }
    const boundedState = typeof observedState === 'string' ? observedState.slice(0, 500) : observedState;
    return { source: 'canonical_chat_device_support', resource: { label, kind, vendor: resource.vendor || null }, observedState: boundedState ?? null, observedAt: card.observedAt || null, evidenceLevel: card.evidenceLevel || 'canonical_service', liveObservation: card.liveObservation === true };
  }
  return undefined;
}

function deviceResolutionOptions(resource: { label: string; kind: string }, facts: Record<string, any>, issue?: string): Array<{ id: string; label: string; prompt: string; basis: string }> {
  const label = resource.label || resource.kind || 'device';
  const serialized = JSON.stringify(facts.observedState || {}).toLowerCase();
  const options: Array<{ id: string; label: string; prompt: string; basis: string }> = [];
  if (/storage.{0,30}(full|low|critical)|(?:full|low|critical).{0,30}storage/.test(serialized)) options.push({ id: 'guided_cleanup', label: 'Help me free storage', prompt: `Help me safely free storage on my ${label}.`, basis: 'observed_storage_pressure' });
  if (/background|battery.{0,30}(high|unusual)|high.{0,30}activity/.test(serialized)) options.push({ id: 'guided_configuration', label: 'Review background activity', prompt: `Help me review and reduce unusual background activity on my ${label}.`, basis: 'observed_background_activity' });
  if (issue || /slow|sluggish|fault|error|broken|not working/.test(serialized)) options.push({ id: 'find_provider', label: 'Find an expert', prompt: `Find someone who can inspect or fix my ${label}; include the recorded device evidence.`, basis: 'reported_or_observed_issue' });
  if (facts.liveObservation === true || facts.observedAt) options.push({ id: 'monitor', label: 'Keep monitoring it', prompt: `Keep an eye on my ${label} and tell me if anything changes.`, basis: 'recorded_observation_available' });
  if (!options.length) options.push({ id: 'no_action', label: 'It may be fine', prompt: `The available information suggests my ${label} may be fine. Help me decide whether any action is needed.`, basis: 'no_actionable_issue_observed' });
  return options.slice(0, 4);
}

async function inspectConnectedResourceForDeviceSupport(phone: string | undefined, query: string, threadId?: string): Promise<IntentRoutingResult | null> {
  if (!phone || phone.startsWith('anon_')) return null;
  const active = (await listConnectedResources(phone)).filter(resource => resource.status === 'active');
  const matches = active.filter(resource => deviceResourceMatches(query, resource));
  if (matches.length !== 1) {
    if (matches.length <= 1) return null;
    const labels = matches.slice(0, 5).map(resource => `${resource.label} (${resource.kind})`).join(', ');
    return { skill: 'device_support', reply: `I found more than one connected resource that could match this request: ${labels}. Tell me the exact resource name before I inspect anything.`, cardData: { type: 'device_resource_selection', status: 'needs_user', resources: matches.slice(0, 5).map(resource => ({ id: resource.id, kind: resource.kind, label: resource.label, vendor: resource.vendor || null, capabilities: resource.capabilities })), ownerScoped: true, noInspectionPerformed: true }, progressStage: 'understanding', extractionSource: 'deterministic' };
  }
  const resource = matches[0];
  const support = connectedResourceSupportProfile(resource);
  if (!connectedResourceSupports(resource, 'inspect')) return {
    skill: 'device_support',
    reply: `Your connected ${resource.kind} is registered, but this client has not exposed an authorised inspection capability. I will not claim to have checked it. I can guide safe checks or help find someone to inspect it.`,
    cardData: { type: 'device_support', status: 'needs_user', title: 'Inspection unavailable', supportLevel: support, resource: { id: resource.id, kind: resource.kind, label: resource.label, protocol: resource.protocol }, inspection: { status: 'unavailable', reason: 'client_inspection_capability_not_exposed' }, resolution: { status: 'options', options: [{ id: 'guided_checks', label: 'Guide me through checks', prompt: `Guide me through safe checks for my ${resource.label}.`, basis: 'direct_inspection_unavailable' }, { id: 'find_provider', label: 'Find an inspector', prompt: `Find someone who can inspect my ${resource.label}.`, basis: 'direct_inspection_unavailable' }] }, liveObservation: false, noInspectionPerformed: true, ownerScoped: true }, canonicalAction: 'device_support.inspection_unavailable', progressStage: 'information', extractionSource: 'deterministic',
  };
  const result = await executeCanonicalCapabilityProposal({ capability: 'execution', action: 'dispatch', canonicalObjectId: resource.id, arguments: { resourceId: resource.id, command: 'status' }, phone, conversationId: threadId, channel: 'chat', confirmationRequired: false, idempotencyKey: `device-support-inspect:${threadId || 'turn'}:${resource.id}:${query.toLowerCase().slice(0, 120)}` });
  const facts = (result.canonicalFacts || {}) as Record<string, any>;
  const resolutionOptions = result.status === 'completed' ? deviceResolutionOptions(resource, { ...facts, liveObservation: facts.liveObservation === true }, facts.issue || facts.observedState?.issue) : [];
  const resolution = result.status === 'completed' ? { status: 'options', options: resolutionOptions } : { status: 'waiting_for_evidence', options: [] };
  return { skill: 'device_support', reply: result.status === 'completed' ? `${result.message} Based on that evidence, the next step is a resolution choice rather than assuming repair.` : result.message, cardData: { type: 'device_support', status: result.status, title: `Recorded ${resource.kind} observation`, message: result.message, supportLevel: support, resource: facts.resource || { id: resource.id, kind: resource.kind, label: resource.label }, observedState: facts.observedState ?? null, observedAt: facts.observedAt ?? null, liveObservation: facts.liveObservation === true, evidenceLevel: result.evidenceLevel, nextActions: result.nextActions, resolution, ownerScoped: true }, canonicalAction: 'execution.dispatch', progressStage: result.status === 'completed' ? 'checking' : 'coordination', extractionSource: 'deterministic' };
}

function extractHealthcareSlots(q: string): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const concern = q.match(/\b(?:for|about|with|regarding)\s+(?:my\s+)?([^.!?]{3,140}?)(?=\s+(?:in|at|near|around|next|this|tomorrow|today|on|with|and)\b|[.!?]|$)/i)?.[1]?.trim();
  const location = q.match(/\b(?:in|at|near|around)\s+([a-z][a-z .'-]{2,50}?)(?=\s+(?:for|about|with|next|this|tomorrow|today|on|and|who|that)\b|[,.!?]|$)/i)?.[1]?.trim();
  const timing = q.match(/\b(?:today|tonight|tomorrow(?:\s+(?:morning|afternoon|evening))?|this\s+week|next\s+week|on\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i)?.[0];
  const specialist = q.match(/\b(?:a|an|the)\s+((?:dermatologist|paediatrician|pediatrician|dentist|gynaecologist|gynecologist|physiotherapist|specialist|doctor|nurse))\b/i)?.[1];
  const preferredFacility = q.match(/\b(?:at|with)\s+(?:the\s+)?([A-Z][A-Za-z .'-]{2,60}(?:clinic|hospital|medical centre|medical center))\b/)?.[1]?.trim();
  const accessibility = q.match(/\b(?:wheelchair|step[- ]?free|accessible|sign language|hearing support|mobility support)(?:(?!\s+and\s+(?:will|use|need|pay|have)\b)[^.!?])*/i)?.[0]?.trim();
  const insurance = q.match(/\b(?:NHIA|HMO|insurance|insured|self[- ]?pay|cash payment)\b[^.!?]*/i)?.[0]?.trim();
  const appointmentType = /\b(?:in person|in-person|physical appointment|clinic visit)\b/i.test(q) ? 'in_person' : /\b(?:online|virtual|telemedicine|video appointment)\b/i.test(q) ? 'virtual' : undefined;
  if (concern) patch.objective = concern;
  if (location) patch.location = location;
  if (timing) patch.timing = timing;
  if (specialist) patch.specialist = specialist.toLowerCase();
  if (preferredFacility) patch.preferred_facility = preferredFacility;
  if (accessibility) patch.accessibility = accessibility;
  if (insurance) patch.insurance_context = insurance;
  if (appointmentType) patch.appointment_type = appointmentType;
  if (/\b(?:follow[- ]?up|review appointment|return visit)\b/i.test(q)) patch.follow_up = true;
  return patch;
}

function extractRepairSlots(q: string): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const device = q.match(/\b(?:my\s+)?((?:iphone|samsung|tecno|infinix|google\s+pixel|pixel|phone|tablet|laptop)[a-z0-9 .-]{0,36}?)(?=\s*(?:[,.!?]|that\b|with\b|and\b|is\b|needs\b|for\b|$))/i)?.[1]?.trim();
  const issue = q.match(/\b(?:screen\s+is|issue\s+is|has|with)\s+([^.!?]{3,180})/i)?.[1]?.trim() || (/\b(?:cracked|broken|shattered|not charging|charging.*(?:intermittent|fault|fail)|battery.*(?:fail|drain)|water damage|won't turn on|will not turn on)\b/i.test(q) ? q.trim().replace(/[.!?]+$/, '') : undefined);
  const locationMatches = [...q.matchAll(/\b(?:in|around)\s+([a-z][a-z -]{2,40}?)(?=\s*(?:[,.!?]|$|\b(?:today|tomorrow|tonight|this|next|for|and|with)\b))/ig)];
  const location = locationMatches.at(-1)?.[1]?.trim() || q.match(/\bnear\s+(?!me\b)([a-z][a-z -]{2,40}?)(?=\s*(?:[,.!?]|$|\b(?:today|tomorrow|tonight|this|next|for|and|with)\b))/i)?.[1]?.trim();
  const urgency = q.match(/\b(today|tonight|tomorrow(?:\s+(?:morning|afternoon|evening))?|asap|urgent(?:ly)?|this week)\b/i)?.[1];
  const pickupReturn = /\b(?:collect|pick(?:\s+(?:it|the\s+(?:device|phone|item)))?\s*(?:-|\s)?\s*up).{0,80}\b(?:return|bring(?:\s+it)?\s+back|deliver(?:\s+it)?\s+back)\b|\bpickup(?:\s|-)?and(?:\s|-)?return\b/i.test(q);
  const onsite = /\b(?:come to me|at my (?:home|office|place)|on[ -]?site|home visit)\b/i.test(q);
  const parts = q.match(/\b(?:genuine|original|oem|compatible|aftermarket|used)\s+(?:parts?|screen|battery|replacement)\b/i)?.[0];
  const diagnostic = /\b(?:diagnos(?:e|is)|inspect(?:ion)?|check first|quote first)\b/i.test(q);
  const collectionAddress = q.match(/\b(?:collect|pick(?:\s+(?:it|the\s+(?:device|phone|item)))?\s*(?:-|\s)?\s*up)\s+(?:it\s+)?(?:from|at)\s+([^.!?]{3,120}?)(?=\s+\b(?:and\s+)?(?:return|bring|deliver)\b|[.!?]|$)/i)?.[1]?.trim();
  const returnAddress = q.match(/\b(?:return|bring|deliver)\s+(?:it\s+)?(?:to|back to)\s+([^.!?]{3,120})/i)?.[1]?.trim();
  if (device) patch.device_or_asset = device;
  if (issue) patch.issue = issue;
  if (location) patch.location = location;
  if (urgency) patch.urgency = urgency;
  if (parts) patch.parts_preference = parts.toLowerCase();
  if (diagnostic) patch.diagnostic_authorization = 'diagnosis_before_repair';
  if (pickupReturn || onsite) patch.fulfilment_method = pickupReturn ? 'pickup_return' : 'on_site';
  if (collectionAddress) patch.collection_address = collectionAddress;
  if (returnAddress) patch.delivery_address = returnAddress;
  return patch;
}

function extractBookingPreferenceSlots(q: string, skill: string): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (skill === 'rental_tracker') {
    const bedrooms = q.match(/\b(\d+)\s*(?:-|\s)?bed(?:room)?s?\b/i)?.[1];
    if (bedrooms) patch.bedrooms = Number(bedrooms);
    const bathrooms = q.match(/\b(\d+)\s*(?:-|\s)?bath(?:room)?s?\b/i)?.[1];
    if (bathrooms) patch.bathrooms = Number(bathrooms);
    const furnishing = q.match(/\b(furnished|unfurnished|semi[-\s]?furnished)\b/i)?.[1];
    if (furnishing) patch.furnishing = furnishing.toLowerCase().replace(/\s+/g, '-');
    if (/\b(?:security|gated|gatehouse|guard)\b/i.test(q)) patch.security_requirements = 'security_requested';
    const transport = q.match(/\b(?:near|close to|walking distance to)\s+([^,.!?]{2,60})/i)?.[1]?.trim();
    if (transport) patch.transport_proximity = transport;
  }
  if (skill === 'hotel_deals') {
    const guests = q.match(/\bfor\s+(\d+)\s*(?:guests?|people|persons?)\b/i)?.[1];
    if (guests) patch.guest_count = Number(guests);
    const rooms = q.match(/\b(\d+)\s*rooms?\b/i)?.[1];
    if (rooms) patch.room_count = Number(rooms);
    if (/\b(?:wheelchair|step[-\s]?free|accessible room|mobility access)\b/i.test(q)) patch.accessibility_requirements = 'accessibility_requested';
  }
  return patch;
}

function extractJobSearchSlots(q: string): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const roleMatch = q.match(/\b(?:find|need|want|looking for|search(?:ing)? for|apply(?:ing)? for)\s+(?:me\s+)?(?:an?\s+)?([a-z][a-z /-]{2,60}?)\s+(?:job|jobs|role|position|vacancy|vacancies)\b/i)?.[1]
    || q.match(/\b(?:job|role|position)\s+(?:as|in|for)\s+(?:an?\s+)?([a-z][a-z /-]{2,60}?)(?=\s+(?:in|at|near|around|today|tomorrow|this|next|with|under|for)\b|[.!?]|$)/i)?.[1];
  if (roleMatch) {
    const role = roleMatch.replace(/\b(?:remote|hybrid|on[ -]?site|full[ -]?time|part[ -]?time|contract|temporary|internship)\b/gi, '').replace(/\s+/g, ' ').trim();
    if (role) patch.role = role;
  }
  const workMode = q.match(/\b(remote|hybrid|on[ -]?site)\b/i)?.[1];
  if (workMode) patch.work_mode = workMode.toLowerCase().replace(/\s+/g, '-');
  const employmentType = q.match(/\b(full[ -]?time|part[ -]?time|contract|temporary|internship)\b/i)?.[1];
  if (employmentType) patch.employment_type = employmentType.toLowerCase().replace(/\s+/g, '-');
  return patch;
}

function extractFollowUpPatch(q: string, skill: string): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const locationCorrection = q.match(/\b(?:change|correct|update|set)\s+(?:the\s+)?(?:location|delivery area|area)\s+(?:to|as)\s+(.+?)(?:[.!?]|$)/i)?.[1]?.trim();
  if (locationCorrection) patch.location = locationCorrection;
  if (skill === 'find_worker') { const location = q.match(/\b(?:in|at)\s+([a-z][a-z\s-]{2,40})$/i)?.[1] || (q.includes('ikeja') ? 'Ikeja' : undefined); if (location) patch.location = location.trim().replace(/[.!?]+$/, ''); if (/\b(tomorrow|today|tonight|evening|morning|afternoon|this week)\b/i.test(q)) patch.time = q.trim(); if (!location && !patch.time && /^(the )?(bathroom|kitchen|roof|car|phone|fridge|sink)\b/i.test(q)) patch.service = q.trim().replace(/[.!?]+$/, ''); }
  if (skill === 'repair') Object.assign(patch, extractRepairSlots(q));
  if (skill === 'order_food') {
    const quantity = q.match(/\bfor\s+(\d+)\s*(?:people|persons)?\b/i)?.[1]; if (quantity) patch.quantity = quantity;
    const food = extractFoodOrderSlots(q);
    for (const [key, value] of Object.entries(food)) {
      if (value !== undefined && (key !== 'location' || !locationCorrection)) patch[key] = value;
    }
    if (!food.items && !locationCorrection && !Object.keys(food).length) {
      const items = q.replace(/\bfor\s+\d+\s*(?:people|persons)?\b/i, '').trim().replace(/[.!?]+$/, '');
      if (items && !/^(in|at)\b/i.test(items) && !food.location) patch.items = items;
    }
  }
  return patch;
}

async function applyFollowUpSlot(phone: string, q: string): Promise<IntentRoutingResult | null> { const active = await tryResumeStorefront(phone); if (!active?.requestId) return null; const patch = extractFollowUpPatch(q, active.skill); if (!Object.keys(patch).length) return null; const card = await advanceStorefront(phone, active.requestId, patch); return { skill: active.skill, reply: card.message, cardData: card }; }

async function handleExplicitMemory(phone: string, q: string, conversationId?: string): Promise<IntentRoutingResult | null> {
  const remember = q.match(/^remember that\s+(.+)$/i);
  if (remember) {
    const statement = remember[1].trim(); const profile = await getProfile(phone, 'conversation_memory'); const preferences = { ...(profile?.preferences || {}) }; const locationMatch = statement.match(/\busual area is\s+([a-z][a-z -]{1,40}?)(?:\s+and\b|$)/i);
    if (/\b(prefer|want|like)\b.*\b(short|simple|concise|brief)\b/i.test(statement)) preferences.response_style = 'concise'; else if (/\bevening\b.*\breminder/i.test(statement)) preferences.reminder_time_preference = 'evening'; else if (!locationMatch) return { skill: 'memory', reply: 'I can remember preferences such as how you like answers, your usual area, or when you prefer reminders. Tell me that preference in a specific way.' };
    await updateProfile(phone, 'conversation_memory', { preferences, ...(locationMatch ? { location: locationMatch[1].trim(), provenance: 'user_declared' as const, source_ref: conversationId ? `chat:${conversationId}:memory_preference` : 'conversation_memory' } : {}) });
    return { skill: 'memory', reply: locationMatch ? `Got it. I’ll remember **${locationMatch[1].trim()}** as your usual area and keep your preference with your Kurukoo Memory Profile.` : 'Got it. I’ll keep that preference with your Kurukoo Memory Profile.', cardData: { type: 'memory_action', status: 'recorded', provenance: 'user_declared', source: 'conversation_memory' }, canonicalAction: 'memory.record', progressStage: 'complete' };
  }
  if (/^what do you remember\b|^what do you know about me\b/i.test(q)) {
    const profile = await getProfile(phone, 'conversation_memory'); const facts = await getMemoryFacts(phone, ['name', 'location']); const preferences = profile?.preferences || {}; const nameFact = facts.find((fact) => fact.field === 'name'); const locationFact = facts.find((fact) => fact.field === 'location'); const items = [nameFact ? `your name is ${nameFact.value}` : '', locationFact ? `your usual area is ${locationFact.value}` : '', preferences.response_style === 'concise' ? 'you prefer short, simple answers' : '', preferences.reminder_time_preference === 'evening' ? 'you prefer evening reminders' : ''].filter(Boolean);
    return { skill: 'memory', reply: items.length ? `I remember that ${items.join('; ')}.` : 'I do not have any saved preferences or declared profile facts for you yet.', cardData: { type: 'memory', status: items.length ? 'stored' : 'empty', facts: facts.map((fact: any) => ({ id: fact.id, field: fact.field, value: fact.value, provenance: fact.provenance, sourceRef: fact.source_ref })), preferences: { responseStyle: preferences.response_style, reminderTimePreference: preferences.reminder_time_preference }, ownerScoped: true }, canonicalAction: 'memory.review', progressStage: 'information' };
  }
  return null;
}

async function handleExplicitOSAction(phone: string | undefined, q: string, threadId?: string): Promise<IntentRoutingResult | null> {
  if (!phone || phone.startsWith('anon_')) return null;
  const notificationRead = q.match(/^(?:mark|set) notification (\d+) as (?:read|seen)$/i);
  if (notificationRead) {
    const id = Number(notificationRead[1]);
    const existing = await getInternalNotificationById(phone, id);
    if (!existing) return { skill: 'notifications', reply: 'That exact notification is not available to this account, so I did not substitute another one.', cardData: { type: 'notification_action', status: 'unavailable', notificationId: id, exactContext: true }, canonicalAction: 'notification.read.unavailable', progressStage: 'information' };
    const changed = await markNotificationRead(phone, id);
    return { skill: 'notifications', reply: changed ? `Marked **${existing.title}** as read. Its source context remains available from the notification record.` : `That exact notification is already read or no longer active. I did not substitute another notification.`, cardData: { type: 'notification_action', status: changed ? 'completed' : 'stale_context', notification: existing, exactContext: true, canonicalAction: changed ? 'notification.dismiss' : 'notification.read.unavailable' }, canonicalAction: changed ? 'notification.dismiss' : 'notification.read.unavailable', progressStage: 'complete' };
  }
  const notificationOpen = q.match(/^open notification (\d+)$/i);
  if (notificationOpen) {
    const id = Number(notificationOpen[1]);
    const notification = await getInternalNotificationById(phone, id);
    if (!notification) return { skill: 'notifications', reply: 'That exact notification is no longer available, so I did not substitute another one.', cardData: { type: 'notification_action', status: 'unavailable', notificationId: id, exactContext: true }, canonicalAction: 'notification.open.unavailable', progressStage: 'information' };
    return { skill: 'notifications', reply: `${notification.title}: ${notification.body}`, cardData: { type: 'notification_action', status: 'opened', notification, exactContext: true, canonicalAction: 'notification.open' }, canonicalAction: 'notification.open', progressStage: 'information' };
  }
  if (/^(?:what notifications|show (?:my )?notifications|what updates are waiting|show (?:my )?updates)$/i.test(q)) {
    const notifications = await getInternalNotifications(phone, 20);
    return { skill: 'notifications', reply: notifications.length ? `I found ${notifications.length} stored notification${notifications.length === 1 ? '' : 's'} and kept each source context separate.` : 'There are no stored notifications waiting for you right now. External push delivery is not assumed unless the delivery state says so.', cardData: { type: 'notifications', status: 'stored', count: notifications.length, notifications: notifications.map(item => ({ id: item.id, title: item.title, body: item.body, status: item.status, deliveryState: item.delivery_state, link: item.link, objectType: item.object_type, objectId: item.object_id, conversationId: item.conversation_id, canonicalAction: item.canonical_action })), exactContext: false, ownerScoped: true }, canonicalAction: 'notification.inbox.open', progressStage: 'information' };
  }
  if (/^(?:show|list) (?:my )?reminders$|^what are my reminders$/i.test(q)) {
    const reminders = await listReminders(phone);
    return { skill: 'reminder', reply: reminders.length ? `You have ${reminders.length} active reminder${reminders.length === 1 ? '' : 's'}. Choose one below to continue or cancel it.` : 'You have no active reminders. Tell me what you want me to remind you about and when.', cardData: { type: 'reminders', status: 'stored', reminders: reminders.slice(0, 20).map(item => ({ id: item.id, title: item.title, dueAt: item.due_at, recurrence: item.recurrence, status: item.status, sourceConversationId: item.source_conversation_id, resumeContextId: item.resume_context_id })), ownerScoped: true }, canonicalAction: 'reminder.inbox.open', progressStage: 'information' };
  }
  const reminderId = q.match(/^cancel reminder (\S+)$/i);
  if (reminderId) {
    const exactId = reminderId[1];
    const result = await executeCanonicalCapabilityProposal({ capability: 'reminder', action: 'cancel', canonicalObjectId: exactId, phone, conversationId: threadId, channel: 'chat', idempotencyKey: `route-reminder-cancel:${phone}:${exactId}` });
    return { skill: 'reminder', reply: result.message, cardData: { type: 'reminder_action', status: result.status, reminderId: exactId, canonicalFacts: result.canonicalFacts || {}, exactContext: true }, canonicalAction: 'reminder.cancel', progressStage: result.status === 'completed' ? 'complete' : 'information' };
  }
  const forgetMemory = q.match(/^forget memory (\d+)$/i);
  if (forgetMemory) {
    const exactId = forgetMemory[1];
    const result = await executeCanonicalCapabilityProposal({ capability: 'memory', action: 'forget', canonicalObjectId: exactId, phone, conversationId: threadId, channel: 'chat', idempotencyKey: `route-memory-forget:${phone}:${exactId}` });
    return { skill: 'memory', reply: result.message, cardData: { type: 'memory_action', status: result.status, factId: exactId, canonicalFacts: result.canonicalFacts || {}, exactContext: true }, canonicalAction: 'memory.forget', progressStage: result.status === 'completed' ? 'complete' : 'information' };
  }
  if (/^(?:show|list) (?:my )?tasks$|^what are my tasks$/i.test(q)) {
    const tasks = await listAssignedTasks(phone);
    return { skill: 'tasks', reply: tasks.length ? `I found ${tasks.length} active task${tasks.length === 1 ? '' : 's'} assigned to you. Choose a task to accept or continue.` : 'You have no active assigned tasks right now.', cardData: { type: 'tasks', status: 'stored', tasks: tasks.slice(0, 20).map(task => ({ id: task.id, title: task.title, status: task.status, description: task.description, sourceType: task.sourceType })), ownerScoped: true }, canonicalAction: 'task.inbox.open', progressStage: 'information' };
  }
  const acceptTaskMatch = q.match(/^accept task (\d+)$/i);
  if (acceptTaskMatch) {
    try { const task = await acceptTask(phone, Number(acceptTaskMatch[1])); return { skill: 'tasks', reply: `Accepted task **${task.title}**. Complete the work, then tell me “complete task ${task.id}: [your result]” so I can record the submitted evidence.`, cardData: { type: 'task_action', status: 'in_progress', task, exactContext: true }, canonicalAction: 'task.accept', progressStage: 'ready' }; } catch (error) { return { skill: 'tasks', reply: error instanceof Error ? error.message : 'I could not accept that exact task.', cardData: { type: 'task_action', status: 'blocked', taskId: Number(acceptTaskMatch[1]), exactContext: true }, canonicalAction: 'task.accept.blocked', progressStage: 'information' }; }
  }
  const completeTaskMatch = q.match(/^complete task (\d+)\s*:\s*(.+)$/i);
  if (completeTaskMatch) {
    try { const result = await completeTask(phone, Number(completeTaskMatch[1]), completeTaskMatch[2].trim()); return { skill: 'tasks', reply: result.success ? `Submitted the result for task **${completeTaskMatch[1]}**. The completion record and any eligible Points award are now persisted.` : 'I could not confirm completion of that exact task.', cardData: { type: 'task_action', status: result.success ? 'completed' : 'blocked', taskId: Number(completeTaskMatch[1]), reward: result.reward, evidence: completeTaskMatch[2].trim(), exactContext: true }, canonicalAction: 'task.complete', progressStage: result.success ? 'complete' : 'information' }; } catch (error) { return { skill: 'tasks', reply: error instanceof Error ? error.message : 'I could not complete that exact task.', cardData: { type: 'task_action', status: 'blocked', taskId: Number(completeTaskMatch[1]), exactContext: true }, canonicalAction: 'task.complete.blocked', progressStage: 'information' }; }
  }
  if (/^(?:what is|what's|show) (?:my )?(?:points balance|points history)$/i.test(q)) {
    const action = /history/i.test(q) ? 'history' : 'inspect';
    const result = await executeCanonicalCapabilityProposal({ capability: 'points', action, phone, conversationId: threadId, channel: 'chat', idempotencyKey: `route-points:${phone}:${action}` });
    return { skill: 'view_balance', reply: result.message, cardData: { type: 'os_status', domain: 'points', status: result.status, facts: result.canonicalFacts || {}, nextActions: result.nextActions || [], ownerScoped: true }, canonicalAction: `points.${action}`, progressStage: 'information' };
  }
  if (/^(?:what is|what's|show) (?:my )?(?:subscription|plan)$/i.test(q)) {
    const result = await executeCanonicalCapabilityProposal({ capability: 'subscription', action: 'status', phone, conversationId: threadId, channel: 'chat', idempotencyKey: `route-subscription:${phone}` });
    return { skill: 'subscription', reply: result.message, cardData: { type: 'os_status', domain: 'subscription', status: result.status, facts: result.canonicalFacts || {}, nextActions: result.nextActions || [], ownerScoped: true }, canonicalAction: 'subscription.status', progressStage: 'information' };
  }
  const channelMatch = q.match(/^is (whatsapp|telegram|sms|email|ivr|web) connected\??$/i);
  if (channelMatch) {
    const channel = channelMatch[1].toLowerCase();
    const result = await executeCanonicalCapabilityProposal({ capability: 'channel', action: 'status', arguments: { channel }, phone, conversationId: threadId, channel: 'chat', idempotencyKey: `route-channel:${phone}:${channel}` });
    return { skill: 'channel', reply: result.message, cardData: { type: 'os_status', domain: 'channel', channel, status: result.status, facts: result.canonicalFacts || {}, nextActions: result.nextActions || [], ownerScoped: true }, canonicalAction: 'channel.status', progressStage: 'information' };
  }
  if (/^(?:what happened|what's happening|any update) (?:with|on|about) (?:that|this|it)\??$/i.test(q)) {
    const active = await tryResumeStorefront(phone);
    if (!active?.requestId) return { skill: 'requests', reply: 'I could not find an active request, order, or booking connected to that reference. I have not substituted another one.', cardData: { type: 'request_status', status: 'not_found', exactContext: true, relativeReference: true }, canonicalAction: 'economic_request.status.not_found', progressStage: 'information', extractionSource: 'deterministic' };
    const request = await getEconomicRequest(active.requestId);
    if (!request || request.phone !== phone) return { skill: 'requests', reply: 'That exact request context is not available to this account, so I have not substituted another request.', cardData: { type: 'request_status', status: 'unavailable', requestId: active.requestId, exactContext: true, relativeReference: true }, canonicalAction: 'economic_request.status.unavailable', progressStage: 'information', extractionSource: 'deterministic' };
    return { skill: 'requests', reply: `The latest recorded state for your ${request.skill.replace(/_/g, ' ')} request is **${request.status}**. I have not inferred provider, payment, dispatch, or fulfilment success beyond the evidence stored on that exact request.`, cardData: { type: 'request_status', status: request.status, requestId: request.id, skill: request.skill, requirements: request.requirements || {}, quote: request.quote || null, fulfillment: request.fulfillment || null, exactContext: true, relativeReference: true, ownerScoped: true }, canonicalAction: 'economic_request.status', progressStage: 'information', extractionSource: 'deterministic' };
  }
  if (/^(?:what is|what's|show) (?:the )?(?:status|state) of my (?:request|order|booking)$/i.test(q)) {
    const active = await tryResumeStorefront(phone);
    if (!active?.requestId) return { skill: 'requests', reply: 'I could not find an active request, order, or booking in this conversation. I have not substituted another one.', cardData: { type: 'request_status', status: 'not_found', exactContext: true }, canonicalAction: 'economic_request.status.not_found', progressStage: 'information' };
    const request = await getEconomicRequest(active.requestId);
    if (!request || request.phone !== phone) return { skill: 'requests', reply: 'That request context is not available to this account, so I have not substituted another request.', cardData: { type: 'request_status', status: 'unavailable', requestId: active.requestId, exactContext: true }, canonicalAction: 'economic_request.status.unavailable', progressStage: 'information' };
    return { skill: 'requests', reply: `Your ${request.skill.replace(/_/g, ' ')} request is currently **${request.status}**. I have not claimed a provider, payment, dispatch, or fulfilment outcome beyond the evidence recorded on the request.`, cardData: { type: 'request_status', status: request.status, requestId: request.id, skill: request.skill, requirements: request.requirements || {}, quote: request.quote || null, fulfillment: request.fulfillment || null, exactContext: true, ownerScoped: true }, canonicalAction: 'economic_request.status', progressStage: 'information' };
  }
  return null;
}

export async function routeIntent(query: string, phone?: string, provider?: AIProvider, contextHint?: ConversationalContextHint, threadId?: string): Promise<IntentRoutingResult> {
  const q = query.trim().toLowerCase().replace(/[.!?]+$/, '');
  if (!q) return { skill: 'general_question', reply: 'Tell me what you need.' };

  if (phone && !phone.startsWith('anon_')) {
    const communicationContinuation = await continuePreparedCommunication(phone, query, threadId);
    if (communicationContinuation) return communicationContinuation;
  }

  const priority = resolveConversationPriority(query);
  if (priority.kind === 'emergency' && /\b(?:ambulance|police|fire|immediate danger|life[- ]threatening|call|dial|unconscious|attacking|not breathing)\b/i.test(q)) {
    const service = /\bambulance\b/i.test(q) ? 'ambulance' : /\bpolice\b/i.test(q) ? 'police' : /\bfire\b/i.test(q) ? 'fire' : 'national';
    const result = await executeCanonicalCapabilityProposal({ capability: 'safety', action: 'emergency_dispatch', arguments: { service, country: 'NG' }, phone: phone || 'anon_router', conversationId: threadId, channel: 'chat', idempotencyKey: `route-emergency:${threadId || 'turn'}:${q}` });
    return { skill: 'emergency', reply: result.message, cardData: { type: 'emergency_dispatch', status: result.status, service, ...(result.canonicalFacts || {}), actions: result.nextActions, recovery: result.retryRecovery, canonicalAction: 'safety.emergency_dispatch', priority: priority.kind }, canonicalAction: 'safety.emergency_dispatch', progressStage: 'safety', extractionSource: 'deterministic' };
  }

  if (phone) { const memoryResult = await handleExplicitMemory(phone, q, threadId); if (memoryResult) return memoryResult; }
  const explicitNotificationRead = Boolean(phone && /^(?:mark|dismiss)\s+(?:all\s+)?(?:notifications?|updates?)(?:\s+#?\d+)?\s+(?:as\s+)?(?:read|seen|handled)\b/i.test(q));
  const osAction = explicitNotificationRead ? null : await handleExplicitOSAction(phone, q, threadId);
  if (osAction) return osAction;
  if (phone && /^(what notifications|show (my )?notifications|what updates are waiting|show (my )?updates)\b/i.test(q)) {
    const notifications = await getInternalNotifications(phone, 10); if (!notifications.length) return { skill: 'notifications', reply: 'There are no stored notifications waiting for you right now. External push delivery is not assumed unless the delivery state says so.' }; const summary = notifications.slice(0, 5).map(item => `${item.title}: ${item.body} (${item.delivery_state})`).join('; '); return { skill: 'notifications', reply: `I found ${notifications.length} stored notification${notifications.length === 1 ? '' : 's'}: ${summary}`, cardData: { type: 'notifications', status: 'stored', count: notifications.length } };
  }
  if (phone && /^(?:mark|dismiss)\s+(?:all\s+)?(?:notifications?|updates?)(?:\s+#?\d+)?\s+(?:as\s+)?(?:read|seen|handled)\b/i.test(q)) {
    const id = q.match(/\b(?:notification|update)\s+#?(\d+)\b/i)?.[1];
    if (id) {
      const updated = await markNotificationRead(phone, Number(id));
      return updated
        ? { skill: 'notifications', reply: 'Marked that stored Kurukoo update as read. This changes only your internal notification state; it does not claim that any external delivery occurred.', cardData: { type: 'notification_action', status: 'completed', notificationId: Number(id), canonicalAction: 'notification.mark_read' }, canonicalAction: 'notification.mark_read', progressStage: 'complete' }
        : { skill: 'notifications', reply: 'I could not find that stored notification for your account, so nothing was changed.', cardData: { type: 'notifications', status: 'not_found', notificationId: Number(id) }, progressStage: 'information' };
    }
    const notifications = await getInternalNotifications(phone, 100);
    let updatedCount = 0;
    for (const notification of notifications) if (String(notification.status || 'unread') !== 'read' && await markNotificationRead(phone, Number(notification.id))) updatedCount += 1;
    return { skill: 'notifications', reply: updatedCount ? `Marked ${updatedCount} stored notification${updatedCount === 1 ? '' : 's'} as read. This changes only your internal notification state; it does not claim external delivery.` : 'There were no unread stored notifications to read.', cardData: { type: 'notifications', status: 'read', count: updatedCount, canonicalAction: 'notification.mark_all_read' }, canonicalAction: 'notification.mark_all_read', progressStage: 'complete' };
  }
  if (/^what provider and model handled (that|the) turn\b/i.test(q)) return { skill: 'general_question', reply: 'The Chat diagnostics for each turn are the source of truth for classification source, provider, model, latency, action, and final state. This request is handled by the canonical Chat path; it does not imply that a hosted provider was used.' };
  if (/\b(?:verified capability|do not invent (?:availability|price|reviews)|provider availability)\b/i.test(q)) return { skill: 'general_question', reply: 'Understood. I will use only recorded provider evidence and will keep availability, price, reviews, verification, payment, and fulfilment in explicit states. If evidence is missing, the request remains waiting or deferred.' };
  if (/^(what is kurukoo|what does kurukoo do|explain kurukoo)\??$/i.test(q)) { const profile = phone ? await getProfile(phone, 'conversation_explanation') : null; const concise = profile?.preferences?.response_style === 'concise'; return { skill: 'general_question', reply: concise ? 'Kurukoo is one conversation for everyday help: it can answer questions, remember preferences, set reminders, coordinate verified services, and keep requests moving without pretending a payment or provider action happened.' : 'Kurukoo is an everyday utility assistant in one conversation. It can answer questions, remember preferences, set reminders, coordinate verified services and products, and keep requests moving through truthful states before any payment or external action.' }; }
  if (/^explain the difference between (?:a )?reminder and (?:an )?agent(?: simply)?\??$/i.test(q)) return { skill: 'general_question', reply: 'A reminder is a scheduled nudge for you. A bounded agent is an explicit follow-up that can re-check an owned request under limited permissions, report its actual status, and pause or stop when you ask.' };
  if (/(?:compare|comparing)\b.*\b(?:venues?|locations?|spaces?)\b|\bvenue comparison\b/i.test(q) && /\b(?:workshop|event|community|meeting)\b/i.test(q)) return { skill: 'general_question', reply: 'Here is a short venue-comparison plan:\n\n1. Define the essentials: date, expected attendance, accessibility, transport, and budget.\n2. Score each venue on capacity, total cost, location, facilities, reliability, and cancellation terms.\n3. Visit or verify the two strongest options, then choose the one with the best practical fit—not just the lowest price.\n\nA simple 1–5 scorecard with weighted priorities will make the trade-offs clear.' };
  if (/^(i(?:'|’)ve|i have|i just)(?: just)? moved\b|^i(?:'|’)m in\b|^i am in\b/i.test(q) && !/\b(?:get|take|drive|bring|need|want|find|book|hire)\b/i.test(q)) return { skill: 'general_question', reply: 'Welcome to the area. I can help you understand a problem, find a verified service, set a reminder, or answer a question. Tell me what you would like to get done; I will not create a request from your location alone.' };
  if (/\bbathroom\b.*\bleak|\bleak(?:ing)?\b.*\bbathroom\b/i.test(q) && !/\b(?:need|find|hire|book|arrange|get me)\b/i.test(q)) return { skill: 'general_question', reply: 'A bathroom leak often points to a plumbing, seal, drain, or shower fitting issue. I can help narrow it down first. Is the water coming from the shower, a pipe, or a fixture, and which area are you in?' };
  if (/\b(?:don['’]t|do not) know whether i need\b/i.test(q)) return { skill: 'general_question', reply: 'A plumber is a likely starting point, but I do not need to create a request yet. Is the leak only during the shower, is there visible damage, and which area should I use if you decide to find someone?' };
  if (/^it only happens when i use the shower\b/i.test(q)) return { skill: 'general_question', reply: 'That pattern suggests the shower fitting, drain, seal, or nearby plumbing may be involved. If you want, tell me your area and whether water reaches the floor or wall; then I can suggest the next supported step.' };
  if (/^what do you suggest\b/i.test(q)) return { skill: 'general_question', reply: 'Based on what you described, start by checking the shower fitting, drain, and seal for the source of the water. If there is visible damage or the leak is worsening, tell me your area and I can help you decide whether to open a plumber request; I will not create one without your confirmation.' };
  if (/^what are my options\b/i.test(q)) return { skill: 'general_question', reply: 'Your options depend on what you want to do: I can answer a question, remember a preference, set a reminder, coordinate a verified service, or explain a public Kurukoo business surface. Tell me which outcome you want and I will show the next supported step.' };
  if (phone && /^(what have you been doing(?: for me)?|what are you doing(?: for me)?)\??$/i.test(q)) { const [reminders, active, goals] = await Promise.all([listReminders(phone), tryResumeStorefront(phone), listAgentGoals(phone)]); const parts: string[] = []; if (reminders.length) parts.push(`one active reminder (${reminders[0].title})`); if (active) parts.push(`an open ${active.skill.replace(/_/g, ' ')} request (${active.stage})`); const activeGoal = goals.find(goal => ['active', 'waiting', 'paused', 'needs_user', 'blocked'].includes(goal.status)); if (activeGoal) { const state = activeGoal.status === 'paused' ? 'paused at your request' : activeGoal.status === 'needs_user' ? 'waiting for your input' : activeGoal.status === 'blocked' ? 'waiting for more information' : 'continuing'; parts.push(`a bounded follow-up goal (${state})`); } return { skill: 'general_question', reply: parts.length ? `Right now I’m tracking ${parts.join(', ')}. I have not claimed a provider, price, payment, or external action unless the relevant evidence is recorded.` : 'Nothing is actively running for you right now. I can answer a question, remember a preference, set a reminder, or help coordinate a request.' }; }
  if (phone && /^(pause|pause that|pause it|stop temporarily)\b/.test(q)) { const goals = await listAgentGoals(phone); const goal = goals.find(item => ['active', 'waiting', 'needs_user', 'blocked'].includes(item.status)); if (goal) { const paused = await pauseAgentGoal(phone, goal.id); return { skill: 'autonomous_agent', reply: paused?.summary || 'Paused that bounded follow-up. Nothing else will run until you resume it.', cardData: { type: 'agent_goal', goal: paused } }; } return { skill: 'general_question', reply: 'There is no active bounded agent follow-up to pause.' }; }
  if (phone && /^(resume|resume that|resume it|continue checking)\b/.test(q)) { const goals = await listAgentGoals(phone, true); const goal = goals.find(item => item.status === 'paused'); if (goal) { const resumed = await resumeAgentGoal(phone, goal.id); return { skill: 'autonomous_agent', reply: resumed?.summary || 'Resumed that bounded follow-up.', cardData: { type: 'agent_goal', goal: resumed } }; } return { skill: 'general_question', reply: 'I could not find a paused bounded agent follow-up to resume.' }; }
  if (phone && /^cancel\s+(the\s+)?reminder\b/.test(q)) { const reminders = await listReminders(phone); const reminder = reminders[0]; if (!reminder) return { skill: 'reminder', reply: 'There is no active reminder to cancel.' }; const cancelled = await executeCanonicalCapabilityProposal({ capability: 'reminder', action: 'cancel', canonicalObjectId: String(reminder.id), phone, conversationId: threadId, channel: 'chat', idempotencyKey: `route-reminder-cancel:${phone}:${String(reminder.id)}` }); return { skill: 'reminder', reply: cancelled.status === 'completed' ? `Cancelled your reminder: **${reminder.title}**.` : 'I could not cancel that reminder.' }; }
  if (phone && /^(cancel that|cancel it|stop following|stop checking)\b/.test(q)) { const goals = await listAgentGoals(phone); const activeGoal = goals.find(goal => ['active', 'waiting', 'paused', 'needs_user', 'blocked'].includes(goal.status)); if (activeGoal) { const cancelled = await cancelAgentGoal(phone, activeGoal.id); return { skill: 'autonomous_agent', reply: cancelled?.summary || 'I stopped following up on that objective.', cardData: { type: 'agent_goal', goal: cancelled } }; } const reminders = await listReminders(phone); if (reminders.length && !/^(stop following|stop checking)\b/.test(q)) { const cancelled = await executeCanonicalCapabilityProposal({ capability: 'reminder', action: 'cancel', canonicalObjectId: String(reminders[0].id), phone, conversationId: threadId, channel: 'chat', idempotencyKey: `route-reminder-cancel:${phone}:${String(reminders[0].id)}` }); return { skill: 'reminder', reply: cancelled.status === 'completed' ? `Cancelled your reminder: **${reminders[0].title}**.` : 'I could not cancel that reminder.' }; } const active = await tryResumeStorefront(phone); if (active?.requestId) { const card = await advanceStorefront(phone, active.requestId, {}, 'cancel'); return { skill: active.skill, reply: card.message, cardData: card }; } return { skill: 'general_question', reply: 'There is no active follow-up for me to cancel.' }; }
  if (/\bkeep reminding me\b[\s\S]*\buntil\b/i.test(q)) { return { skill: 'reminder', reply: 'I can keep reminding you, but I need a cadence and a clear completion condition before scheduling it. Tell me, for example, “Remind me every day at 9am to call John until I say it is done.” No reminder has been created yet.', cardData: { type: 'reminder_setup', status: 'needs_user', requirement: 'cadence_and_completion_condition', actions: [{ id: 'choose_cadence', label: 'Choose a daily or weekly cadence' }, { id: 'define_completion', label: 'Define how I should know it is done' }] }, canonicalAction: 'reminder.setup', progressStage: 'understanding', extractionSource: 'deterministic' }; }
  if (/^(?:remind me|set (?:me )?a reminder)\b/.test(q)) { if (!phone || phone.startsWith('anon_')) return { skill: 'reminder', reply: 'I can save that reminder as soon as you sign in, so it stays with your Kurukoo profile.' }; const reminder = parseReminderQuery(q); if (reminder) { try { const created = await executeCanonicalCapabilityProposal({ capability: 'reminder', action: 'create', arguments: { title: reminder.title, dueAt: reminder.dueAt, ...(reminder.recurrence ? { recurrence: reminder.recurrence } : {}) }, phone, conversationId: threadId, contextId: threadId ? `conv:${threadId}` : undefined, channel: 'chat', idempotencyKey: `route-reminder:${phone}:${threadId || 'turn'}:${reminder.dueAt}` }); return { skill: 'reminder', reply: created.status === 'completed' ? `⏰ Done. I’ll remind you **${reminder.title}** (${reminder.displayTime})${reminder.recurrence ? ` until you cancel it` : ''}.` : 'I could not create that reminder.', cardData: decorateCardWithSuggestions({ type: 'reminder', reminder: { id: created.canonicalObjectId, title: reminder.title, due_at: reminder.dueAt, recurrence: reminder.recurrence || null, status: 'scheduled' } }, 'reminder') }; } catch (e) { return { skill: 'reminder', reply: e instanceof Error ? e.message : 'I could not create that reminder.' }; } } return { skill: 'reminder', reply: 'I can set that reminder. Tell me the time, for example: “Remind me in 20 minutes to call Mum” or “Remind me tomorrow at 9am to check reports”.' }; }
  if (q === 'reset onboarding') return { skill: 'general_question', reply: 'Onboarding reset is available from your profile settings.' };
  if (/^(ask the community|share with the community|post to the community)\b/i.test(q)) {
    if (!phone || phone.startsWith('anon_')) return { skill: 'topic', reply: 'Sign in first and I can prepare a private community draft for your review. Nothing from this conversation will be shared automatically.', cardData: { type: 'topic_draft', status: 'sign_in_required', privacy: 'private_by_default' } };
    const subject = query.replace(/^(?:ask\s+(?:(?:with|to)\s+)?|share\s+with\s+|post\s+to\s+)the\s+community\b[:\s,-]*/i, '').trim() || 'a local question I need help with';
    const matchedSkill = matchCanonicalSkill(query);
    const skill = matchedSkill && getKnownSkills().includes(matchedSkill) ? matchedSkill : null;
    const category = skill ? getEconomicCategory(skill) : null;
    const title = `Community question: ${subject}`.slice(0, 160);
    const body = `I would value community experiences and practical guidance about ${subject}. Please share only what you personally know. This does not verify a provider, price, availability, booking, payment, or completed service.`.slice(0, 8000);
    const idempotencyKey = `chat_topic_${Buffer.from(`${threadId || 'turn'}:${query}`).toString('base64url').slice(0, 120)}`;
    try {
      const draft = await createTopicDraft(phone, { title, body, type: 'question', category: category || undefined, skills: skill ? [skill] : [], idempotencyKey });
      return { skill: 'topic', reply: `I prepared a private community draft about **${subject}**. Review it before submitting it for moderation; nothing has been published or treated as provider evidence.`, cardData: { type: 'topic_draft', status: 'review_required', privacy: 'private_by_default', source: 'explicit_user_request', topic: draft, topicId: draft?.id, title: draft?.title || title, body: draft?.body || body, category: draft?.category || category, skills: draft?.skills || (skill ? [skill] : []), city: draft?.city || null, draftLink: draft?.id ? `/topics?draft=${encodeURIComponent(draft.id)}` : '/topics' }, canonicalAction: 'topic.draft.review', progressStage: 'coordination', extractionSource: 'deterministic' };
    } catch (error) {
      return { skill: 'topic', reply: error instanceof Error ? `I could not prepare that private community draft: ${error.message}` : 'I could not prepare that private community draft yet. Nothing has been shared.' };
    }
  }
  if (q.includes('balance') || q.includes('points') || q.includes('wallet') || q.includes('credits')) return { skill: 'view_balance', reply: await balanceReply(phone) };
  if (q.includes('show nearby') || q.includes('nearby active') || q.includes('radar') || q.includes('where are providers')) return { skill: 'nearby_radar', reply: '📡 **Nearby Radar is on.** I’ll use your shared presence and Memory Profile to surface providers around you.', cardData: { type: 'nearby_radar' } };

  if (/\b(?:help with|information about|what is)\s+emergency\b/i.test(q)) return { skill: 'safety', reply: 'I can help with emergency and safety guidance. If someone is in immediate danger, use the verified emergency route now; I will not claim that responders were contacted or dispatched.', cardData: { type: 'skill_flow', stage: 'safety', canonicalAction: 'skill_flow.safety', requestId: undefined, truthful: true }, canonicalAction: 'skill_flow.safety', progressStage: 'safety', extractionSource: 'deterministic' };
  if (/\b(emergency|ambulance|fire service|flood line|swep alert|immediate danger|life[- ]threatening)\b/i.test(q) && !/\b(emergency|safety) contact\b/i.test(q)) {
    const result = await executeCanonicalCapabilityProposal({ capability: 'safety', action: 'emergency_dispatch', arguments: { service: /\bambulance\b/i.test(q) ? 'ambulance' : /\bpolice\b/i.test(q) ? 'police' : /\bfire\b/i.test(q) ? 'fire' : 'national', country: 'NG' }, phone: phone || 'anon_router', conversationId: threadId, channel: 'chat', idempotencyKey: `route-emergency:${threadId || 'turn'}:${q}` });
    return { skill: 'emergency', reply: result.message, cardData: { type: 'emergency_dispatch', status: result.status, service: /\bambulance\b/i.test(q) ? 'ambulance' : /\bpolice\b/i.test(q) ? 'police' : /\bfire\b/i.test(q) ? 'fire' : 'national', ...(result.canonicalFacts || {}), actions: result.nextActions, recovery: result.retryRecovery, canonicalAction: 'safety.emergency_dispatch', priority: 'critical' }, canonicalAction: 'safety.emergency_dispatch', progressStage: 'safety', extractionSource: 'deterministic' };
  }
  if (/\b(?:set|start|create|run)\s+(?:a\s+)?safety check-?in\b/i.test(q)) { if (!phone || phone.startsWith('anon_')) return { skill: 'safety_contact', reply: 'I can prepare a safety check-in as soon as you sign in, so its contact and consent state stay with your Kurukoo profile.' }; const activeContacts = (await listSafetyContacts(phone)).filter(contact => contact.status === 'active'); if (!activeContacts.length) return { skill: 'safety_contact', reply: 'Before starting a safety check-in, add a trusted contact and wait for their consent. You can add one in the context inspector; no notification or check-in has been started.', cardData: suggestionCard('safety_contact') }; return { skill: 'safety_contact', reply: `You have ${activeContacts.length} consented safety contact${activeContacts.length === 1 ? '' : 's'}. Choose one from the Safety workspace to start a check-in; I will not start or notify anyone until you select the contact and confirm the timing.`, cardData: suggestionCard('safety_contact') }; }
  if (q.includes('emergency contact') || q.includes('safety contact')) { if (!phone || phone.startsWith('anon_')) return { skill: 'safety_contact', reply: 'I can save your personal emergency contacts as soon as you sign in, so they stay with your Kurukoo profile.' }; const addMatch = q.match(/add\s+(.+?)\s+as\s+(?:my\s+)?(?:emergency|safety)\s+contact/i); if (addMatch) { const name = addMatch[1].trim(); return { skill: 'safety_contact', reply: `I've captured **${name}** as a potential safety contact. To finish adding them, please provide their phone number.`, cardData: { type: 'safety_contact_capture', name } }; } return { skill: 'safety_contact', reply: 'I can manage your safety contacts. You can add a contact by saying “Add [Name] as my emergency contact” or review them in the context inspector.', cardData: suggestionCard('safety_contact') }; }

  if (phone && /^(?:tell|message|text|send)\s+(?:[a-z][a-z' -]{1,60})\s+(?:that\s+)?(?:i['’]?m|i am|we['’]?re|we are)\s+(?:late|running late|delayed)\b/i.test(q)) { const match = q.match(/^(?:tell|message|text|send)\s+(.+?)\s+(?:that\s+)?(?:i['’]?m|i am|we['’]?re|we are)\s+(.+)$/i); const recipient = match?.[1]?.trim() || null; const body = match ? `I am ${match[2].trim()}.` : null; return { skill: 'communication', reply: `I can prepare that message for ${recipient ? `**${recipient}**` : 'the intended recipient'}. I have not sent it: I still need to resolve the recipient, choose an available channel, and receive your confirmation before any external delivery.`, cardData: { type: 'communication_prepare', status: 'needs_user', recipient, body, actions: [{ id: 'resolve_recipient', label: 'Resolve recipient' }, { id: 'choose_channel', label: 'Choose a channel' }, { id: 'confirm_send', label: 'Confirm sending' }], deliveryState: 'not_sent', truthful: true }, canonicalAction: 'communication.prepare', progressStage: 'understanding', extractionSource: 'deterministic' }; }
  if (phone && /\b(i want to earn|i can|i offer|offer(?:ing)? .*service|provide .*service|take jobs|find work)\b/i.test(q)) { const providerSkillMatch = q.match(/\b(plumb(?:er|ing)|electrician|mechanic|carpenter|tailor|cleaner|technician|painter|decorator|tiler|roofer|mason|welder|driver|baker|coder)\b/i)?.[1]?.toLowerCase(); const providerSkill = providerSkillMatch === 'plumbing' ? 'plumber' : providerSkillMatch; if (providerSkill) { const location = q.match(/\b(?:in|around|near)\s+([a-z][a-z -]{2,40}?)(?=\s+(?:and|can|tomorrow|today|available)\b|[,.!?]|$)/i)?.[1]?.trim() || null; return { skill: 'provider_onboarding', reply: `I can help you add **${providerSkill}** to your provider profile${location ? ` for ${location}` : ''}. I will not publish or mark you available automatically. Confirm the skill and location, then I can save the profile update; availability, pricing, verification, and job matching remain separate steps.`, cardData: { type: 'provider_profile_setup', status: 'review_required', skill: providerSkill, location, source: 'explicit_provider_statement' } }; } }
  if (phone && /\b(?:seller|known seller offers?)\b/i.test(q) && /\b(?:sell|offer|product|charger|stock|catalogue|catalog)\b/i.test(q)) return { skill: 'seller_offer_review', reply: 'I can help review your seller or product offer details. I will keep the offer in review until the product, price, inventory, evidence, and fulfilment terms are explicitly recorded; nothing is published or sold from this message alone.', cardData: { type: 'seller_offer_review', status: 'review_required', source: 'explicit_seller_statement' } };
  if (isExploratoryQuestion(query)) { const conversational = await queryUnifiedAI(query, { phone, conversational: true, contextHint, threadId }); return { skill: 'general_question', reply: conversational.text, modelProvider: conversational.provider, model: conversational.model, intentConfidence: conversational.confidence, classificationSource: conversational.provider === 'Kurukoo Template' ? 'fallback' : 'rules' }; }
  if (phone && isResumePhrase(q)) { try { const resumed = await tryResumeStorefront(phone); if (resumed) return { skill: resumed.skill || 'find_worker', reply: resumed.message, cardData: resumed }; } catch (e) { console.warn('[Router] resume failed:', e); } }
  if (phone && q.length <= 80 && !matchCanonicalSkill(q) && !/^(continue|ask the community|keep checking)\b/.test(q)) { const followUp = await applyFollowUpSlot(phone, q); if (followUp) return followUp; }
  if (phone && (/\b(listing|offer)\b/.test(q) || /\b[a-z][a-z-]{1,40}['’]s\b/.test(q))) { try { const offers = await searchKnownEconomicOffers(query, 3); if (offers.length) return { skill: 'product_sourcing', reply: `I found ${offers.length === 1 ? 'a known seller offer' : 'known seller offers'} matching that reference. Choose one to start a single Economic Request.`, cardData: { type: 'agentic_storefront', stage: 'offer_review', skill: 'product_sourcing', title: 'Known seller offers', message: 'Choose a verified seller offer to continue.', knownOffers: offers, escrowProtected: false, progress: 55 } }; } catch (e) { console.warn('[Router] known offer lookup failed:', e); } }
  const assistanceQuestion = /^(how do i|how can i|what should i do|what is the best way|why is|what does)\b/i.test(q) && !/\b(?:find someone|find me|book|hire|order|get me|need someone|who can)\b/i.test(q);
  if (assistanceQuestion) { const assistance = await getAssistanceOutcome(query).catch((error) => { console.warn('[Router] assistance question projection unavailable:', error); return null; }); if (assistance) return { skill: assistance.mode === 'support' ? 'support_triage' : 'general_question', reply: `${assistance.mode === 'support' ? 'I found relevant Kurukoo guidance and community context for this issue.' : 'I found relevant Kurukoo guidance and community context.'} I have not treated any source as a provider, recommendation, availability or completed action. ${assistance.nextActions[0]?.prompt || 'Tell me what you want to do next.'}`, cardData: assistance, canonicalAction: assistance.canonicalAction, progressStage: assistance.mode === 'support' ? 'coordination' : 'information', extractionSource: 'deterministic' }; }
  const explicitFoodOutcome = /\b(?:hungry|eat|restaurant|food|grocer(?:y|ies)|meal|takeaway|takeout)\b/i.test(q) && /\b(?:find|recommend|order|get|buy|somewhere|place|good)\b/i.test(q);
  const explicitAutomotiveServiceOutcome = /\b(?:car|vehicle|auto|engine|tyre|tire|brake|battery)\b[\s\S]*\b(?:mechanic|repair|fix|service|diagnos(?:e|is)|breakdown|broken)\b|\b(?:mechanic|repair|fix|service|diagnos(?:e|is)|breakdown|broken)\b[\s\S]*\b(?:car|vehicle|auto|engine|tyre|tire|brake|battery)\b/i.test(q);
  const roadsideAutomotiveNeed = /\b(?:roadside|breakdown|stranded|tow|won['’]?t start|flat tyre|flat tire)\b/i.test(q);
  const explicitTransportOutcome = !explicitAutomotiveServiceOutcome && (/\b(?:get|take|drive|bring)\s+me\s+(?:to|from)\b|\b(?:need|want)\s+to\s+(?:get|be)\s+(?:to|in)\b|\b(?:find|book|hire)\s+(?:me\s+)?(?:a\s+)?(?:bus|taxi|ride|driver|train|ferry|car)\b/i.test(q) || (/\b(?:airport|station|transport|ride|travel|bus|taxi|train|ferry|journey|trip)\b/i.test(q) && /\b(?:tomorrow|today|tonight|from|to|by\s+\d|arrive|arrival|leave|leaving|book|find|need)\b/i.test(q)));
  const explicitRepairOutcome = /\b(?:phone|mobile|laptop|computer|tablet)\b/i.test(q) && /\b(?:repairer|repair|fix|broken|cracked|screen|not charging|won't turn on|technician)\b/i.test(q);
  const explicitAccommodationOutcome = /\b(?:somewhere to stay|place to stay|hotel|accommodation|short[ -]?let|guest house|lodging)\b/i.test(q) && /\b(?:find|book|get|need|want|stay)\b/i.test(q);
  const explicitHouseholdServiceOutcome = /\b(?:find|need|hire|get)\b[\s\S]*\b(?:someone|person|worker)\b[\s\S]*\b(?:help|clean|fix|repair|maintain|install|move)\b[\s\S]*\b(?:house|home|garden|yard|roof|kitchen|bathroom)\b/i.test(q);
  const explicitPropertyOutcome = !explicitHouseholdServiceOutcome && /\b(?:apartment|flat|house|rental|rent|two[ -]?bed(?:room)?|property)\b/i.test(q) && /\b(?:find|need|want|rent|looking|search)\b/i.test(q);
  const explicitJobOutcome = /\b(?:job|jobs|vacancy|vacancies|employment|role)\b/i.test(q) && /\b(?:find|need|want|looking|apply|search)\b/i.test(q);
  const explicitTutorOutcome = /\b(?:tutor|tutoring|teacher|teach(?:ing)?|lesson|lessons|guitar)\b/i.test(q) && /\b(?:find|hire|book|get|need|want|looking)\b/i.test(q);
  const explicitInternetServiceOutcome = /\b(?:sort out|fix|install|set[ -]?up|arrange|find|book|need|want|help)\b[\s\S]*\b(?:wi-?fi|internet|broadband|router|network)\b|\b(?:wi-?fi|internet|broadband|router|network)\b[\s\S]*\b(?:installer|technician|provider|repair|fix|set[ -]?up|not working|slow)\b/i.test(q);
  const explicitDataBundleOutcome = /\b(?:buy|get|purchase|send|recharge|subscribe|activate)\b[\s\S]*\b(?:data|bundle|internet)\b|\b(?:data|bundle)\b[\s\S]*\b(?:mtn|airtel|glo|9mobile|etisalat)\b/i.test(q) && !/\b(?:airtime|credit|voice)\b/i.test(q);
  const explicitEventRentalOutcome = /\b(?:find|hire|rent|book|need|get|arrange)\b[\s\S]*\b(?:canopy|tent|pa system|public address|sound system|speakers?)\b|\b(?:canopy|tent|pa system|public address|sound system|speakers?)\b[\s\S]*\b(?:rental|rent|wedding|party|event)\b/i.test(q);
  const explicitHealthcareOutcome = /\b(?:find|book|arrange|need|want|see|speak(?:\s+to)?|consult)\b[\s\S]*\b(?:doctor|clinic|hospital|healthcare|health care|dermatologist|dentist|paediatrician|pediatrician|nurse|specialist|appointment)\b/i.test(q) || /\b(?:doctor|clinic|hospital|healthcare|health care|dermatologist|dentist|paediatrician|pediatrician|nurse|specialist)\b[\s\S]*\b(?:appointment|available|availability|consult|see|book)\b/i.test(q);
  const explicitProductOutcome = !explicitRepairOutcome && /\b(?:buy|order|get|find|replace|replacement)\b/i.test(q) && /\b(?:charger|cable|phone|laptop|product|item|groceries)\b/i.test(q);
  const explicitProviderOutcome = /\b(?:find|hire|book|get|need)\b/i.test(q) && /\b(?:someone|person|plumber|teacher|tutor|mechanic|electrician|cleaner|technician|guitar)\b/i.test(q);
  if (phone && /\b(?:keep an eye on|tell me if anything changes|watch for|monitor|keep checking)\b/i.test(q)) return { skill: 'autonomous_agent', reply: 'I can keep an exact, bounded watch on this. I need the resource or subject, the change to look for, and—where relevant—notification permission. I will not claim monitoring has started until the observation and notification capability are recorded.', cardData: { type: 'monitoring_setup', status: 'needs_user', target: /\b(?:my|this)\s+([a-z0-9 -]{2,50})/i.exec(q)?.[1]?.trim() || null, requirement: 'target_and_change_condition', actions: [{ id: 'define_condition', label: 'Define what should count as a change' }, { id: 'connect_resource', label: 'Connect an observable resource' }, { id: 'enable_notifications', label: 'Enable notifications for changes' }], truthful: true }, canonicalAction: 'monitoring.setup', progressStage: 'understanding', extractionSource: 'deterministic' };
  const outcomeSkill = explicitFoodOutcome ? 'order_food' : explicitDataBundleOutcome ? 'data_bundle' : explicitAutomotiveServiceOutcome ? roadsideAutomotiveNeed ? 'roadside_mechanic' : 'mechanic' : explicitAccommodationOutcome ? 'hotel_deals' : explicitHouseholdServiceOutcome ? 'find_worker' : explicitEventRentalOutcome ? /\b(?:pa system|public address|sound system|speakers?)\b/i.test(q) ? 'public_address_system' : 'canopy_rental' : explicitPropertyOutcome ? 'rental_tracker' : explicitTransportOutcome ? 'ride_request' : explicitJobOutcome ? 'job_tracker' : explicitTutorOutcome ? 'home_tutor' : explicitInternetServiceOutcome ? 'wifi_installer' : explicitRepairOutcome ? 'phone_repairer' : explicitHealthcareOutcome ? 'doctor_appointment' : explicitProductOutcome ? 'product_sourcing' : explicitProviderOutcome ? 'find_worker' : null;
  const directSkill = outcomeSkill || matchCanonicalSkill(q) || (isFoodOrderExpression(query) ? 'order_food' : null);
  const extractedEntities = validateConversationalEntities(extractConversationalEntities(query, directSkill || undefined), directSkill || undefined);
  if (directSkill === 'device_support') {
    const inspected = await inspectConnectedResourceForDeviceSupport(phone, query, threadId);
    if (inspected) return { ...inspected, extractedEntities: extractedEntities as Record<string, unknown>, extractionSource: 'deterministic' };
    if (phone) {
      return {
        skill: 'device_support',
        reply: `I can help check your ${extractedEntities.device || 'device'}${extractedEntities.issue ? ` — I noted that it is ${extractedEntities.issue}` : ''}. I do not have a live connection or a recorded observation for it yet. Connect the device or tell me what you can see, and I’ll guide the safest next check before suggesting any repair.`,
        cardData: { type: 'device_support', status: 'needs_user', title: 'Guided assistance available', supportLevel: { level: 1, name: 'Guided assistance', canInspect: false, canAct: false, canInteractWithPhysicalWorld: false, explanation: 'Kurukoo can still reason about the problem, guide safe checks, and coordinate help without direct device access.' }, resource: extractedEntities.device ? { kind: extractedEntities.device, label: extractedEntities.deviceModel || extractedEntities.device } : null, issue: extractedEntities.issue || null, inspection: { status: 'unavailable', reason: 'no_authorized_connected_resource' }, resolution: { status: 'options', options: [{ id: 'guided_checks', label: 'Guide me through checks', prompt: `Guide me through safe checks for my ${extractedEntities.deviceModel || extractedEntities.device || 'device'}.`, basis: 'no_authorized_connected_resource' }, { id: 'find_provider', label: 'Find an inspector', prompt: `Find someone who can inspect my ${extractedEntities.deviceModel || extractedEntities.device || 'device'}.`, basis: 'no_authorized_connected_resource' }] }, liveObservation: false, noInspectionPerformed: true, ownerScoped: true },
        extractedEntities: extractedEntities as Record<string, unknown>,
        extractionSource: 'deterministic',
        progressStage: 'understanding',
      };
    }
  }
  const conversationDecision = decideConversationIntelligence({ userMessage: query, latestUserMessage: query, assistantReply: '', activeContextIds: contextHint?.activeContexts?.map(context => context.contextId), selectedContextId: contextHint?.selectedContext, relation: contextHint?.relation, pendingFields: contextHint?.activeContexts?.flatMap(context => context.pendingFields || []).slice(0, 8) });
  if (conversationDecision.shouldAvoidAction && !outcomeSkill && (!directSkill || conversationDecision.mode === 'exploration' || conversationDecision.mode === 'clarification')) { const ai = await queryUnifiedAI(query, { provider, phone, conversational: true, contextHint, threadId }); return { skill: 'general_question', reply: ai.text, cardData: ai.provider === 'SmolLM2' ? { type: 'ai_metadata', provider: ai.provider, model: ai.model, conversationMode: conversationDecision.mode } : undefined, modelProvider: ai.provider, model: ai.model, extractionSource: Object.keys(extractedEntities).length > 1 ? 'deterministic' : 'none', extractedEntities: extractedEntities as Record<string, unknown>, progressStage: 'complete' }; }
  if (directSkill && !phone) { const flow = getSkillFlow(directSkill); return { skill: directSkill, reply: flowReply(directSkill, flow), cardData: decorateCardWithSuggestions(actionCard(directSkill), directSkill), extractedEntities: extractedEntities as Record<string, unknown>, extractionSource: 'deterministic' }; }
  if (directSkill === 'event_coverage' && phone) return { skill: 'event_coverage', reply: 'I can help you prepare event evidence for review. Share the event, location, date, and what you personally observed; your submission remains a contributor record and does not verify a provider or create a payment request.', cardData: { type: 'event_coverage', status: 'offer', mode: 'contributor_evidence', moderation: 'required', privateByDefault: true } };
  if (directSkill === 'national_events' && phone) return { skill: 'national_events', reply: 'I can show public event information and daily picks. I will not imply attendance, availability, booking, or payment.', cardData: { type: 'events_list', status: 'public_information' } };
  if (directSkill === 'sports_matchmaking' && phone) return { skill: 'sports_matchmaking', reply: 'I can help coordinate a sports activity. Tell me the sport, location, timing, and number of participants; no participant or venue is confirmed until the supported flow records it.', cardData: { type: 'sports_search', status: 'coordination_needed' } };
  if (directSkill && phone) {
    try {
      if (directSkill === 'product_sourcing') { const offers = await searchKnownEconomicOffers(query, 3); if (offers.length) return { skill: directSkill, reply: `I found ${offers.length === 1 ? 'one known seller offer' : `${offers.length} known seller offers`} matching that product. Choose one to continue through the existing Economic Request flow.`, cardData: { type: 'agentic_storefront', stage: 'offer_review', skill: directSkill, title: 'Known seller offers', message: 'These are verified seller references, not a stock or payment confirmation.', knownOffers: offers, escrowProtected: false, progress: 55 } }; }
      const workerMatch = q.match(/\b(plumber|plumb|electrician|electrical|mechanic|carpenter|tailor|cleaner|clean|cleaning|housekeeping|technician|teacher|tutor|tutoring|teach(?:ing)?|lesson|lessons|guitar|painter|paint|painting|decorator|decorating|tiler|tiling|roofer|roofing|mason|welder)\b/i)?.[1]; const worker = workerMatch ? (/^plumb/i.test(workerMatch) ? 'plumber' : /^electri/i.test(workerMatch) ? 'electrician' : /^clean|^housekeep/i.test(workerMatch) ? 'house_cleaner' : /^guitar/i.test(workerMatch) ? 'guitar_teacher' : /^(?:teach|tutor|lesson)/i.test(workerMatch) ? 'teacher' : /^paint/i.test(workerMatch) ? 'painter' : /^decorat/i.test(workerMatch) ? 'decorator' : /^til/i.test(workerMatch) ? 'tiler' : /^roof/i.test(workerMatch) ? 'roofer' : workerMatch.toLowerCase()) : undefined;
      const foodSlots = directSkill === 'order_food' ? extractFoodOrderSlots(query) : {};
      const priorObservation = (directSkill === 'repair' || directSkill === 'phone_repair' || directSkill === 'phone_repairer') ? await recentDeviceObservation(phone, threadId, query) : undefined;
      const dataBundlePhone = directSkill === 'data_bundle' ? query.match(/\b(?:\+234|234|0)(?:[\s-]?\d){10}\b/)?.[0]?.replace(/[\s-]/g, '') : undefined;
      const dataBundleNetwork = directSkill === 'data_bundle' ? query.match(/\b(?:mtn|airtel|glo|9mobile|etisalat)\b/i)?.[0]?.toLowerCase() : undefined;
      const dataBundleVariationCode = directSkill === 'data_bundle' ? query.match(/\b(?:variation(?:_code)?|plan(?:_code)?)\s*[:#-]?\s*([a-z0-9_-]{2,40})\b/i)?.[1] : undefined;
      const dataBundleAmount = directSkill === 'data_bundle' ? query.match(/(?:₦|ngn\s*)\s*(\d[\d,]*(?:\.\d{1,2})?)/i)?.[1] : undefined;
      const airtimePhone = directSkill === 'buy_airtime' ? query.match(/\b(?:\+234|234|0)(?:[\s-]?\d){10}\b/)?.[0]?.replace(/[\s-]/g, '') : undefined;
      const airtimeAmount = directSkill === 'buy_airtime' ? query.match(/(?:₦|ngn\s*)\s*(\d[\d,]*(?:\.\d{1,2})?)/i)?.[1] : undefined;
      const seed: Record<string, unknown> = directSkill === 'data_bundle' ? { objective: 'Data bundle purchase', ...(dataBundlePhone ? { recipient_phone: dataBundlePhone } : {}), ...(dataBundleNetwork ? { network: dataBundleNetwork } : {}), ...(dataBundleVariationCode ? { variation_code: dataBundleVariationCode } : {}), ...(dataBundleAmount ? { amount_minor: Math.round(Number(dataBundleAmount.replace(/,/g, '')) * 100), currency: 'NGN' } : {}) } : directSkill === 'buy_airtime' ? { objective: 'Airtime purchase', ...(airtimePhone ? { recipient_phone: airtimePhone } : {}), ...(airtimeAmount ? { amount_minor: Math.round(Number(airtimeAmount.replace(/,/g, '')) * 100), currency: 'NGN' } : {}) } : directSkill === 'find_worker' && worker ? { service: worker, task_scope: query.trim(), ...extractFollowUpPatch(query, directSkill) } : (directSkill === 'repair' || directSkill === 'phone_repair' || directSkill === 'phone_repairer') ? { ...extractRepairSlots(query), ...(priorObservation ? { prior_diagnostics: priorObservation } : {}) } : directSkill === 'doctor_appointment' ? extractHealthcareSlots(query) : directSkill === 'device_support' ? { problem: query.trim(), desired_action: 'diagnose' } : directSkill === 'product_sourcing' ? { product: query.trim() } : directSkill === 'verified_artist' ? { event_type: query.trim() } : directSkill === 'order_food' ? { ...foodSlots, ...extractFollowUpPatch(query, directSkill) } : ['hotel_deals','rental_tracker'].includes(String(directSkill)) ? { objective: query.trim(), ...extractBookingPreferenceSlots(query, directSkill), ...extractFollowUpPatch(query, directSkill) } : directSkill === 'job_tracker' ? { objective: query.trim(), ...extractJobSearchSlots(query), ...extractFollowUpPatch(query, directSkill) } : ['mechanic','roadside_mechanic','home_tutor','wifi_installer','canopy_rental','public_address_system'].includes(String(directSkill)) ? { objective: query.trim(), ...extractFollowUpPatch(query, directSkill) } : {};
      const fromTo = query.match(/\bfrom\s+(.+?)\s+to\s+(.+?)(?=\s+(?:tomorrow|today|on\s+\w+)|[.!?]|$)/i); if (fromTo && (directSkill === 'ride_request' || directSkill === 'ride')) { seed.origin = fromTo[1].trim(); seed.destination = fromTo[2].trim(); }
      if (directSkill === 'ride_request' || directSkill === 'ride') {
        const destinationMatch = query.match(/\b(?:get|take|drive|bring)\s+me\s+to\s+(.+?)(?=\s+(?:tomorrow|today|tonight|by\s+\d|at\s+\d|on\s+\w+)|[.!?]|$)/i) || query.match(/\b(?:need|want)\s+to\s+be\s+in\s+(.+?)(?=\s+(?:tomorrow|today|tonight|by\s+\d|at\s+\d|on\s+\w+)|[.!?]|$)/i);
        if (destinationMatch?.[1] && !seed.destination) seed.destination = destinationMatch[1].trim();
        if (extractedEntities.location && !seed.origin) seed.origin = extractedEntities.location;
        if (extractedEntities.preferences) seed.preferences = extractedEntities.preferences;
      }
      const departure = query.match(/\b(today|tonight|tomorrow(?:\s+(?:morning|afternoon|evening|night))?|this\s+weekend|next\s+week|saturday|sunday|monday|tuesday|wednesday|thursday|friday)\b/i); if (departure && (directSkill === 'ride_request' || directSkill === 'ride')) seed.departure_time = departure[1];
      if (extractedEntities.location && !seed.location) seed.location = extractedEntities.location; if (extractedEntities.items && directSkill === 'order_food') seed.items = extractedEntities.items; if (extractedEntities.date) seed.date = extractedEntities.date; if (extractedEntities.time) seed.time = extractedEntities.time; if (['hotel_deals','rental_tracker','job_tracker','mechanic','roadside_mechanic','home_tutor','wifi_installer','canopy_rental','public_address_system'].includes(String(directSkill)) && !seed.timing && (extractedEntities.date || extractedEntities.time)) seed.timing = [extractedEntities.date, extractedEntities.time].filter(Boolean).join(' '); if (extractedEntities.budget !== undefined) seed.budget = extractedEntities.budget; if (extractedEntities.quantity !== undefined) seed.quantity = extractedEntities.quantity; if (extractedEntities.delivery && (directSkill === 'order_food' || directSkill === 'product_sourcing')) seed.delivery = true; if (extractedEntities.product && !/^(?:it|that|this)(?:\s+delivered)?$/i.test(String(extractedEntities.product))) seed.product = extractedEntities.product;
      const card = await startStorefrontSession(phone, directSkill, seed, { forceNew: contextHint?.relation === 'create', conversationId: threadId }); const reply = directSkill === 'product_sourcing' ? `${card.message} I’ll only show a product card when a verified seller reference is available; I will not invent stock, price, or delivery.` : (directSkill === 'repair' || directSkill === 'phone_repair' || directSkill === 'phone_repairer') && priorObservation ? `${card.message} I attached the earlier recorded device observation as context for the repair provider. It is not a live diagnosis, so the provider must independently confirm the fault.` : card.message; const progressStage = card.stage === 'information' ? 'information' : card.stage === 'safety' ? 'safety' : card.stage === 'coordination' ? 'coordination' : card.stage === 'slot_fill' || card.stage === 'intent_extraction' ? 'understanding' : card.stage === 'catalog_match' || card.stage === 'offer_review' || card.stage === 'quote_review' ? 'checking' : card.stage === 'complete' ? 'complete' : 'coordinating'; const canonicalAction = card.requestId ? 'economic_request.start' : `skill_flow.${card.stage}`;
      return { skill: directSkill, reply, cardData: { ...decorateCardWithSuggestions(card, directSkill), extractedEntities, extractionSource: 'deterministic', canonicalAction, progressStage }, extractedEntities: extractedEntities as Record<string, unknown>, extractionSource: 'deterministic', canonicalAction, progressStage };
    } catch (e) { console.warn('[Router] storefront start failed:', e); }
  }
  if (q.includes('price check') || q.includes('market price') || q.includes('how much is')) { const result = await delegateToAgentForSkill('price_checker', query, phone); if (result.success) return { skill: 'price_check', reply: result.reply }; }
  if (q.includes('dispute') || q.includes('complain') || q.includes('scam') || q.includes('safety')) { const result = await delegateToAgentForSkill('support_triage', query, phone); if (result.success) return { skill: 'support_triage', reply: result.reply }; }
  const classification = classifyWithFastText(query); const trustedActionClassification = classification && ACTION_INTENTS.has(classification.intent) && !(classification.source === 'fallback' && classification.confidence < 0.85);
  if (trustedActionClassification) {
    const source = { classificationSource: classification.source, intentConfidence: classification.confidence } as const;
    if (classification.intent === 'subscription') return { skill: 'subscription', reply: 'I can show the available Consumer and Provider plans. Payment and entitlement activation remain separate, sandbox-gated steps.', cardData: { type: 'subscription_plans', status: 'information_only', destination: '/pricing' }, ...source };
    if (classification.intent === 'advertising') return { skill: 'advertising', reply: 'Kurukoo advertising uses disclosed public placements only. I can take you to the advertiser guidance and campaign entry surface; no private Chat text is used for hidden targeting.', cardData: { type: 'advertising_info', status: 'public_only', destination: '/advertise' }, ...source };
    if (classification.intent === 'referral') { const code = phone && !phone.startsWith('anon_') ? await generateReferralCode(phone) : null; return { skill: 'referral', reply: code ? `Your referral link is ready through the Referral QR surface. Share it only with people you choose; reward eligibility is recorded by the referral authority.` : 'Sign in first and I can create your owner-scoped referral link.', cardData: { type: 'referral', status: code ? 'ready' : 'sign_in_required', destination: '/referral-qr/' }, ...source }; }
    if (classification.intent === 'autonomous_agent') { if (!phone || phone.startsWith('anon_')) return { skill: 'autonomous_agent', reply: 'Sign in first to review or create your owner-scoped bounded agents.', cardData: { type: 'agent_goals', status: 'sign_in_required' }, ...source }; const goals = await listAgentGoals(phone); const active = goals.filter(goal => ['active', 'waiting', 'paused', 'needs_user', 'blocked'].includes(goal.status)); return { skill: 'autonomous_agent', reply: active.length ? `You have ${active.length} saved agent ${active.length === 1 ? 'objective' : 'objectives'}${active.some(goal => goal.status === 'paused') ? '; paused work remains paused until you resume it' : ' currently being progressed'}. I can show their activity and controls without claiming completion.` : 'You do not have a saved agent objective yet. Ask me to keep checking a specific request and I will show the required confirmation and limits.', cardData: { type: 'agent_goals', status: active.length ? (active.every(goal => goal.status === 'paused') ? 'paused' : 'active') : 'empty', goals: active }, ...source }; }
    if (classification.intent === 'circle_create') return { skill: 'circle_create', reply: 'I can help you set up or join a Money Circle. Confirm the members, contribution cadence and rules before anything is recorded; no funds move from this conversation alone.', cardData: { type: 'money_circle', status: 'setup_required', destination: '/chat?prompt=Set%20up%20a%20Money%20Circle' }, ...source };
    if (classification.intent === 'nearby_pulse_start' || classification.intent === 'nearby_pulse_stop') return { skill: classification.intent, reply: classification.intent === 'nearby_pulse_start' ? 'Go Live shares only the presence details you approve for Nearby and Radar, subject to the existing presence authority and duration controls. Confirm your location and skill before activation.' : 'I can turn off your Go Live presence through the existing Pulse authority. No hidden background sharing is claimed.', cardData: { type: 'nearby_pulse', status: classification.intent === 'nearby_pulse_start' ? 'consent_required' : 'stop_available' }, ...source };
    const flowSkill = skillForIntent(classification.intent); const flow = await getSkillFlow(flowSkill).catch(() => null); if (phone && STOREFRONT_INTENTS.has(classification.intent)) { try { const card = await startStorefrontSession(phone, flowSkill, {}, { conversationId: threadId }); return { skill: flowSkill, reply: card.message, cardData: card, classificationSource: classification.source, intentConfidence: classification.confidence }; } catch (e) { console.warn('[Router] storefront start failed:', e); } }
    const cardData = decorateCardWithSuggestions(actionCard(classification.intent), flowSkill) || suggestionCard(flowSkill); const reply = flowReply(flowSkill, flow); return { skill: flowSkill, reply, cardData, classificationSource: classification.source, intentConfidence: classification.confidence };
  }
  const assistance = await getAssistanceOutcome(query).catch((error) => { console.warn('[Router] assistance projection unavailable:', error); return null; });
  if (assistance) { const lead = assistance.mode === 'support' ? 'I found relevant Kurukoo guidance and community context for this issue.' : 'I found relevant Kurukoo guidance and community context.'; return { skill: assistance.mode === 'support' ? 'support_triage' : 'general_question', reply: `${lead} I have not treated any source as a provider, recommendation, availability or completed action. ${assistance.nextActions[0]?.prompt || 'Tell me what you want to do next.'}`, cardData: assistance, canonicalAction: assistance.canonicalAction, progressStage: assistance.mode === 'support' ? 'coordination' : 'information', extractionSource: 'deterministic' }; }
  const ai = await queryUnifiedAI(query, { provider, phone, conversational: true, contextHint, threadId }); const cardData: any = ai.provider === 'SmolLM2' ? { type: 'ai_metadata', provider: ai.provider, model: ai.model } : undefined; const generalEntities = validateConversationalEntities(extractConversationalEntities(query, classification?.intent), classification?.intent); return { skill: 'general_question', reply: ai.text, cardData, modelProvider: ai.provider, model: ai.model, extractionSource: Object.keys(generalEntities).length > 1 ? 'deterministic' : 'none', extractedEntities: generalEntities as Record<string, unknown>, progressStage: 'complete' };
}
