import { queryUnifiedAI, type AIProvider, type ConversationalContextHint } from './unifiedAiEngine.js';
import { decideConversationIntelligence } from './conversationIntelligenceService.js';
import { getProfile, getMemoryFacts, updateProfile } from './memoryProfile.js';
import { delegateToAgentForSkill } from './aiAgentService.js';
import { getContextualIntentSuggestions, getEconomicCategory, getKnownSkills, getSkillFlow } from './skillFlows.js';
import { classifyWithFastText } from './fastTextService.js';
import { advanceStorefront, previewStorefrontCard, startStorefrontSession, tryResumeStorefront } from './agenticStorefront.js';
import { searchKnownEconomicOffers } from './economicParticipants.js';
import { listReminders } from './reminderService.js';
import { listSafetyContacts } from './safetyService.js';
import { getInternalNotifications } from './pushNotifications.js';
import { cancelAgentGoal, listAgentGoals, pauseAgentGoal, resumeAgentGoal } from './agentRuntime.js';
import { generateReferralCode } from './referralService.js';
import { getAssistanceOutcome } from './assistanceOutcomeService.js';
import { resolveConversationPriority } from './conversationPriorityService.js';
import { executeCanonicalCapabilityProposal } from './canonicalCapabilityExecutor.js';
import { listConnectedResources } from './connectedResourceService.js';
import type { IntentRoutingResult } from '../types.js';
import { extractConversationalEntities, extractFoodOrderSlots, isFoodOrderExpression, validateConversationalEntities } from './conversationalExtraction.js';

const ACTION_INTENTS = new Set(['ride_request', 'order_food', 'find_worker', 'universal_vendor_order', 'sports_matchmaking', 'event_coverage', 'how_to_video', 'security_booking', 'circle_create', 'artist_booking', 'national_events', 'subscription', 'advertising', 'autonomous_agent', 'referral', 'nearby_pulse_start', 'nearby_pulse_stop']);
const STOREFRONT_INTENTS = new Set(['ride_request', 'order_food', 'find_worker', 'universal_vendor_order', 'security_booking']);

const CANONICAL_ALIASES: Array<[RegExp, string]> = [
  [/\b(jollof|fried rice|meal for|food for)\b/, 'order_food'],
  [/\b(buy|purchase|get)\b.*\b(car|vehicle)\b|\b(car|vehicle)\b.*\b(buy|purchase)\b/, 'buy_car'],
  [/\b(buy|purchase|get)\b.*\btickets?\b|\btickets?\b.*\b(buy|purchase|get)\b/, 'buy_ticket'],
  [/\b(phone|device|laptop|computer|screen)\b.*\brepair\b|\brepair\b.*\b(phone|device|laptop|computer|screen)\b/, 'repair'],
  [/\b(?:check|diagnose|troubleshoot|investigate|help(?: me)? with)\b.*\b(?:wi-?fi|network|internet|device|phone|iphone|ipad|laptop|macbook|computer|tv|camera|cctv|router|iot)\b|\b(?:wi-?fi|network|internet|device|phone|iphone|ipad|laptop|macbook|computer|tv|camera|cctv|router|iot)\b.*\b(?:slow|slowly|sluggish|offline|not working|won't connect|will not connect|malware|virus|charging|diagnostic|diagnostics)\b/, 'device_support'],
  [/\b(source|source me|find|procure)\b.*\b(product|products|goods|item)\b|\b(phone\s+charger|charger|replacement\s+part|spare\s+part|phone\s+accessory)\b/, 'product_sourcing'],
  [/\b(bodyguard|security guard|security personnel|private security)\b/, 'security_personnel'],
  [/\b(?:plumber|plumb|electrician|electrical|mechanic|carpenter|tailor|cleaner|clean|cleaning|housekeeping|technician|painter|paint|painting|decorator|decorating|tiler|tiling|roofer|roofing|mason|welder)\b|\b(?:find|need)(?: me)?\s+(?:someone|a person|a worker)\s+(?:to\s+)?(?:help|clean|fix|repair|paint|move|install|build|assemble)\b|\b(?:fix|repair)\b.*\b(?:tap|faucet|leak|plumbing)\b|\bhelp\s+with\s+(?:my\s+)?(?:house|home|garden|yard|roof|kitchen|bathroom|moving)\b|\b(?:can|could|would)\s+(?:someone|anyone)\s+(?:help|clean|fix|repair|paint|move|install|build|assemble)\b/, 'find_worker'],
  [/\b(order|get|buy)\b.*\b(food|meal|rice|groceries|groceries?)\b/, 'order_food'],
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
  if (intent === 'find_worker') return 'find_worker';
  if (intent === 'security_booking') return 'security_personnel';
  if (intent === 'artist_booking') return 'verified_artist';
  return intent;
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

function parseReminderQuery(q: string): { dueAt: string; title: string; displayTime: string } | null {
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
    return { dueAt: d.toISOString(), title: abs[7].trim(), displayTime: `${relative || day ? `${relative || day} at ` : ''}${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${recurrence ? ` (${recurrence})` : ''}` };
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
  const result = await executeCanonicalCapabilityProposal({ capability: 'execution', action: 'dispatch', canonicalObjectId: resource.id, arguments: { resourceId: resource.id, command: 'status' }, phone, conversationId: threadId, channel: 'chat', confirmationRequired: false, idempotencyKey: `device-support-inspect:${threadId || 'turn'}:${resource.id}:${query.toLowerCase().slice(0, 120)}` });
  const facts = result.canonicalFacts || {};
  return { skill: 'device_support', reply: result.message, cardData: { type: 'device_support', status: result.status, title: `Recorded ${resource.kind} observation`, message: result.message, resource: facts.resource || { id: resource.id, kind: resource.kind, label: resource.label }, observedState: facts.observedState ?? null, observedAt: facts.observedAt ?? null, liveObservation: facts.liveObservation === true, evidenceLevel: result.evidenceLevel, nextActions: result.nextActions, ownerScoped: true }, canonicalAction: 'execution.dispatch', progressStage: result.status === 'completed' ? 'information' : 'coordination', extractionSource: 'deterministic' };
}

function extractRepairSlots(q: string): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const device = q.match(/\b(?:my\s+)?((?:iphone|samsung|tecno|infinix|google\s+pixel|pixel|phone|tablet|laptop)[a-z0-9 .-]{0,36}?)(?=\s*(?:[,.!?]|that\b|with\b|and\b|is\b|needs\b|for\b|$))/i)?.[1]?.trim();
  const issue = q.match(/\b(?:screen\s+is|issue\s+is|has|with)\s+([^.!?]{3,180})/i)?.[1]?.trim() || (/\b(?:cracked|broken|shattered|not charging|charging.*(?:intermittent|fault|fail)|battery.*(?:fail|drain)|water damage|won't turn on|will not turn on)\b/i.test(q) ? q.trim().replace(/[.!?]+$/, '') : undefined);
  const locationMatches = [...q.matchAll(/\b(?:in|around)\s+([a-z][a-z -]{2,40}?)(?=\s*(?:[,.!?]|$|\b(?:today|tomorrow|tonight|this|next|for|and|with)\b))/ig)];
  const location = locationMatches.at(-1)?.[1]?.trim() || q.match(/\bnear\s+(?!me\b)([a-z][a-z -]{2,40}?)(?=\s*(?:[,.!?]|$|\b(?:today|tomorrow|tonight|this|next|for|and|with)\b))/i)?.[1]?.trim();
  const urgency = q.match(/\b(today|tonight|tomorrow(?:\s+(?:morning|afternoon|evening))?|asap|urgent(?:ly)?|this week)\b/i)?.[1];
  if (device) patch.device_or_asset = device;
  if (issue) patch.issue = issue;
  if (location) patch.location = location;
  if (urgency) patch.urgency = urgency;
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
    if (food.items) patch.items = food.items;
    if (food.location) patch.location = food.location;
    if (!food.items && !locationCorrection) {
      const items = q.replace(/\bfor\s+\d+\s*(?:people|persons)?\b/i, '').trim().replace(/[.!?]+$/, '');
      if (items && !/^(in|at)\b/i.test(items) && !food.location) patch.items = items;
    }
  }
  return patch;
}

async function applyFollowUpSlot(phone: string, q: string): Promise<IntentRoutingResult | null> { const active = await tryResumeStorefront(phone); if (!active?.requestId) return null; const patch = extractFollowUpPatch(q, active.skill); if (!Object.keys(patch).length) return null; const card = await advanceStorefront(phone, active.requestId, patch); return { skill: active.skill, reply: card.message, cardData: card }; }

async function handleExplicitMemory(phone: string, q: string): Promise<IntentRoutingResult | null> {
  const remember = q.match(/^remember that\s+(.+)$/i);
  if (remember) {
    const statement = remember[1].trim(); const profile = await getProfile(phone, 'conversation_memory'); const preferences = { ...(profile?.preferences || {}) }; const locationMatch = statement.match(/\busual area is\s+([a-z][a-z -]{1,40}?)(?:\s+and\b|$)/i);
    if (/\b(prefer|want|like)\b.*\b(short|simple|concise|brief)\b/i.test(statement)) preferences.response_style = 'concise'; else if (/\bevening\b.*\breminder/i.test(statement)) preferences.reminder_time_preference = 'evening'; else if (!locationMatch) return { skill: 'memory', reply: 'I can remember preferences such as how you like answers, your usual area, or when you prefer reminders. Tell me that preference in a specific way.' };
    await updateProfile(phone, 'conversation_memory', { preferences, ...(locationMatch ? { location: locationMatch[1].trim(), provenance: 'user_declared' as const, source_ref: 'conversation_memory' } : {}) });
    return { skill: 'memory', reply: locationMatch ? `Got it. I’ll remember **${locationMatch[1].trim()}** as your usual area and keep your preference with your Kurukoo Memory Profile.` : 'Got it. I’ll keep that preference with your Kurukoo Memory Profile.' };
  }
  if (/^what do you remember\b|^what do you know about me\b/i.test(q)) {
    const profile = await getProfile(phone, 'conversation_memory'); const facts = await getMemoryFacts(phone, ['name', 'location']); const preferences = profile?.preferences || {}; const nameFact = facts.find((fact) => fact.field === 'name'); const locationFact = facts.find((fact) => fact.field === 'location'); const items = [nameFact ? `your name is ${nameFact.value}` : '', locationFact ? `your usual area is ${locationFact.value}` : '', preferences.response_style === 'concise' ? 'you prefer short, simple answers' : '', preferences.reminder_time_preference === 'evening' ? 'you prefer evening reminders' : ''].filter(Boolean);
    return { skill: 'memory', reply: items.length ? `I remember that ${items.join('; ')}.` : 'I do not have any saved preferences or declared profile facts for you yet.' };
  }
  return null;
}

export async function routeIntent(query: string, phone?: string, provider?: AIProvider, contextHint?: ConversationalContextHint, threadId?: string): Promise<IntentRoutingResult> {
  const q = query.trim().toLowerCase().replace(/[.!?]+$/, '');
  if (!q) return { skill: 'general_question', reply: 'Tell me what you need.' };

  const priority = resolveConversationPriority(query);
  if (priority.kind === 'emergency' && /\b(?:ambulance|police|fire|immediate danger|life[- ]threatening|call|dial|unconscious|attacking|not breathing)\b/i.test(q)) {
    const service = /\bambulance\b/i.test(q) ? 'ambulance' : /\bpolice\b/i.test(q) ? 'police' : /\bfire\b/i.test(q) ? 'fire' : 'national';
    const result = await executeCanonicalCapabilityProposal({ capability: 'safety', action: 'emergency_dispatch', arguments: { service, country: 'NG' }, phone: phone || 'anon_router', conversationId: threadId, channel: 'chat', idempotencyKey: `route-emergency:${threadId || 'turn'}:${q}` });
    return { skill: 'emergency', reply: result.message, cardData: { type: 'emergency_dispatch', status: result.status, service, ...(result.canonicalFacts || {}), actions: result.nextActions, recovery: result.retryRecovery, canonicalAction: 'safety.emergency_dispatch', priority: priority.kind }, canonicalAction: 'safety.emergency_dispatch', progressStage: 'safety', extractionSource: 'deterministic' };
  }

  if (phone) { const memoryResult = await handleExplicitMemory(phone, q); if (memoryResult) return memoryResult; }
  if (phone && /^(what notifications|show (my )?notifications|what updates are waiting|show (my )?updates)\b/i.test(q)) {
    const notifications = await getInternalNotifications(phone, 10); if (!notifications.length) return { skill: 'notifications', reply: 'There are no stored notifications waiting for you right now. External push delivery is not assumed unless the delivery state says so.' }; const summary = notifications.slice(0, 5).map(item => `${item.title}: ${item.body} (${item.delivery_state})`).join('; '); return { skill: 'notifications', reply: `I found ${notifications.length} stored notification${notifications.length === 1 ? '' : 's'}: ${summary}`, cardData: { type: 'notifications', status: 'stored', count: notifications.length } };
  }
  if (/^what provider and model handled (that|the) turn\b/i.test(q)) return { skill: 'general_question', reply: 'The Chat diagnostics for each turn are the source of truth for classification source, provider, model, latency, action, and final state. This request is handled by the canonical Chat path; it does not imply that a hosted provider was used.' };
  if (/\b(?:verified capability|do not invent (?:availability|price|reviews)|provider availability)\b/i.test(q)) return { skill: 'general_question', reply: 'Understood. I will use only recorded provider evidence and will keep availability, price, reviews, verification, payment, and fulfilment in explicit states. If evidence is missing, the request remains waiting or deferred.' };
  if (/^(what is kurukoo|what does kurukoo do|explain kurukoo)\??$/i.test(q)) { const profile = phone ? await getProfile(phone, 'conversation_explanation') : null; const concise = profile?.preferences?.response_style === 'concise'; return { skill: 'general_question', reply: concise ? 'Kurukoo is one conversation for everyday help: it can answer questions, remember preferences, set reminders, coordinate verified services, and keep requests moving without pretending a payment or provider action happened.' : 'Kurukoo is an everyday utility assistant in one conversation. It can answer questions, remember preferences, set reminders, coordinate verified services and products, and keep requests moving through truthful states before any payment or external action.' }; }
  if (/^explain the difference between (?:a )?reminder and (?:an )?agent(?: simply)?\??$/i.test(q)) return { skill: 'general_question', reply: 'A reminder is a scheduled nudge for you. A bounded agent is an explicit follow-up that can re-check an owned request under limited permissions, report its actual status, and pause or stop when you ask.' };
  if (/(?:compare|comparing)\b.*\b(?:venues?|locations?|spaces?)\b|\bvenue comparison\b/i.test(q) && /\b(?:workshop|event|community|meeting)\b/i.test(q)) return { skill: 'general_question', reply: 'Here is a short venue-comparison plan:\n\n1. Define the essentials: date, expected attendance, accessibility, transport, and budget.\n2. Score each venue on capacity, total cost, location, facilities, reliability, and cancellation terms.\n3. Visit or verify the two strongest options, then choose the one with the best practical fit—not just the lowest price.\n\nA simple 1–5 scorecard with weighted priorities will make the trade-offs clear.' };
  if (/^(i(?:'|’)ve|i have|i just)(?: just)? moved\b|^i(?:'|’)m in\b|^i am in\b/i.test(q)) return { skill: 'general_question', reply: 'Welcome to the area. I can help you understand a problem, find a verified service, set a reminder, or answer a question. Tell me what you would like to get done; I will not create a request from your location alone.' };
  if (/\bbathroom\b.*\bleak|\bleak(?:ing)?\b.*\bbathroom\b/i.test(q) && !/\b(?:need|find|hire|book|arrange|get me)\b/i.test(q)) return { skill: 'general_question', reply: 'A bathroom leak often points to a plumbing, seal, drain, or shower fitting issue. I can help narrow it down first. Is the water coming from the shower, a pipe, or a fixture, and which area are you in?' };
  if (/\b(?:don['’]t|do not) know whether i need\b/i.test(q)) return { skill: 'general_question', reply: 'A plumber is a likely starting point, but I do not need to create a request yet. Is the leak only during the shower, is there visible damage, and which area should I use if you decide to find someone?' };
  if (/^it only happens when i use the shower\b/i.test(q)) return { skill: 'general_question', reply: 'That pattern suggests the shower fitting, drain, seal, or nearby plumbing may be involved. If you want, tell me your area and whether water reaches the floor or wall; then I can suggest the next supported step.' };
  if (/^what do you suggest\b/i.test(q)) return { skill: 'general_question', reply: 'Based on what you described, start by checking the shower fitting, drain, and seal for the source of the water. If there is visible damage or the leak is worsening, tell me your area and I can help you decide whether to open a plumber request; I will not create one without your confirmation.' };
  if (/^what are my options\b/i.test(q)) return { skill: 'general_question', reply: 'Your options depend on what you want to do: I can answer a question, remember a preference, set a reminder, coordinate a verified service, or explain a public Kurukoo business surface. Tell me which outcome you want and I will show the next supported step.' };
  if (phone && /^(what have you been doing(?: for me)?|what are you doing(?: for me)?)\??$/i.test(q)) { const [reminders, active, goals] = await Promise.all([listReminders(phone), tryResumeStorefront(phone), listAgentGoals(phone)]); const parts: string[] = []; if (reminders.length) parts.push(`one active reminder (${reminders[0].title})`); if (active) parts.push(`an open ${active.skill.replace(/_/g, ' ')} request (${active.stage})`); const activeGoal = goals.find(goal => ['active', 'waiting', 'needs_user', 'blocked'].includes(goal.status)); if (activeGoal) parts.push(`a bounded follow-up goal (${activeGoal.status})`); return { skill: 'general_question', reply: parts.length ? `Right now I’m tracking ${parts.join(', ')}. I have not claimed a provider, price, payment, or external action unless the relevant evidence is recorded.` : 'Nothing is actively running for you right now. I can answer a question, remember a preference, set a reminder, or help coordinate a request.' }; }
  if (phone && /^(pause|pause that|pause it|stop temporarily)\b/.test(q)) { const goals = await listAgentGoals(phone); const goal = goals.find(item => ['active', 'waiting', 'needs_user', 'blocked'].includes(item.status)); if (goal) { const paused = await pauseAgentGoal(phone, goal.id); return { skill: 'autonomous_agent', reply: paused?.summary || 'Paused that bounded follow-up. Nothing else will run until you resume it.', cardData: { type: 'agent_goal', goal: paused } }; } return { skill: 'general_question', reply: 'There is no active bounded agent follow-up to pause.' }; }
  if (phone && /^(resume|resume that|resume it|continue checking)\b/.test(q)) { const goals = await listAgentGoals(phone, true); const goal = goals.find(item => ['waiting', 'active', 'needs_user', 'blocked'].includes(item.status) && /paused|follow-up|check/i.test(item.summary || item.objective)); if (goal) { const resumed = await resumeAgentGoal(phone, goal.id); return { skill: 'autonomous_agent', reply: resumed?.summary || 'Resumed that bounded follow-up.', cardData: { type: 'agent_goal', goal: resumed } }; } return { skill: 'general_question', reply: 'I could not find a paused bounded agent follow-up to resume.' }; }
  if (phone && /^cancel\s+(the\s+)?reminder\b/.test(q)) { const reminders = await listReminders(phone); const reminder = reminders[0]; if (!reminder) return { skill: 'reminder', reply: 'There is no active reminder to cancel.' }; const cancelled = await executeCanonicalCapabilityProposal({ capability: 'reminder', action: 'cancel', canonicalObjectId: String(reminder.id), phone, conversationId: threadId, channel: 'chat', idempotencyKey: `route-reminder-cancel:${phone}:${String(reminder.id)}` }); return { skill: 'reminder', reply: cancelled.status === 'completed' ? `Cancelled your reminder: **${reminder.title}**.` : 'I could not cancel that reminder.' }; }
  if (phone && /^(cancel that|cancel it|stop following|stop checking)\b/.test(q)) { const goals = await listAgentGoals(phone); const activeGoal = goals.find(goal => ['active', 'waiting', 'needs_user', 'blocked'].includes(goal.status)); if (activeGoal) { const cancelled = await cancelAgentGoal(phone, activeGoal.id); return { skill: 'autonomous_agent', reply: cancelled?.summary || 'I stopped following up on that objective.', cardData: { type: 'agent_goal', goal: cancelled } }; } const reminders = await listReminders(phone); if (reminders.length && !/^(stop following|stop checking)\b/.test(q)) { const cancelled = await executeCanonicalCapabilityProposal({ capability: 'reminder', action: 'cancel', canonicalObjectId: String(reminders[0].id), phone, conversationId: threadId, channel: 'chat', idempotencyKey: `route-reminder-cancel:${phone}:${String(reminders[0].id)}` }); return { skill: 'reminder', reply: cancelled.status === 'completed' ? `Cancelled your reminder: **${reminders[0].title}**.` : 'I could not cancel that reminder.' }; } const active = await tryResumeStorefront(phone); if (active?.requestId) { const card = await advanceStorefront(phone, active.requestId, {}, 'cancel'); return { skill: active.skill, reply: card.message, cardData: card }; } return { skill: 'general_question', reply: 'There is no active follow-up for me to cancel.' }; }
  if (/^(?:remind me|set (?:me )?a reminder)\b/.test(q)) { if (!phone || phone.startsWith('anon_')) return { skill: 'reminder', reply: 'I can save that reminder as soon as you sign in, so it stays with your Kurukoo profile.' }; const reminder = parseReminderQuery(q); if (reminder) { try { const created = await executeCanonicalCapabilityProposal({ capability: 'reminder', action: 'create', arguments: { title: reminder.title, dueAt: reminder.dueAt }, phone, conversationId: threadId, contextId: threadId ? `conv:${threadId}` : undefined, channel: 'chat', idempotencyKey: `route-reminder:${phone}:${threadId || 'turn'}:${reminder.dueAt}` }); return { skill: 'reminder', reply: created.status === 'completed' ? `⏰ Done. I’ll remind you **${reminder.title}** (${reminder.displayTime}).` : 'I could not create that reminder.', cardData: decorateCardWithSuggestions({ type: 'reminder', reminder: { id: created.canonicalObjectId, title: reminder.title, due_at: reminder.dueAt, status: 'scheduled' } }, 'reminder') }; } catch (e) { return { skill: 'reminder', reply: e instanceof Error ? e.message : 'I could not create that reminder.' }; } } return { skill: 'reminder', reply: 'I can set that reminder. Tell me the time, for example: “Remind me in 20 minutes to call Mum” or “Remind me tomorrow at 9am to check reports”.' }; }
  if (q === 'reset onboarding') return { skill: 'general_question', reply: 'Onboarding reset is available from your profile settings.' };
  if (/^(ask the community|share with the community|post to the community)\b/i.test(q)) return { skill: 'topic', reply: 'I can help you draft a community Topic. Nothing from this private conversation will be shared automatically; review the draft and choose what to publish.', cardData: { type: 'topic_draft', status: 'review_required', privacy: 'private_by_default', source: 'explicit_user_request', content: '' } };
  if (q.includes('balance') || q.includes('points') || q.includes('wallet') || q.includes('credits')) return { skill: 'view_balance', reply: await balanceReply(phone) };
  if (q.includes('show nearby') || q.includes('nearby active') || q.includes('radar') || q.includes('where are providers')) return { skill: 'nearby_radar', reply: '📡 **Nearby Radar is on.** I’ll use your shared presence and Memory Profile to surface providers around you.', cardData: { type: 'nearby_radar' } };

  if (/\b(?:help with|information about|what is)\s+emergency\b/i.test(q)) return { skill: 'safety', reply: 'I can help with emergency and safety guidance. If someone is in immediate danger, use the verified emergency route now; I will not claim that responders were contacted or dispatched.', cardData: { type: 'skill_flow', stage: 'safety', canonicalAction: 'skill_flow.safety', requestId: undefined, truthful: true }, canonicalAction: 'skill_flow.safety', progressStage: 'safety', extractionSource: 'deterministic' };
  if (/\b(emergency|ambulance|fire service|flood line|swep alert|immediate danger|life[- ]threatening)\b/i.test(q) && !/\b(emergency|safety) contact\b/i.test(q)) {
    const result = await executeCanonicalCapabilityProposal({ capability: 'safety', action: 'emergency_dispatch', arguments: { service: /\bambulance\b/i.test(q) ? 'ambulance' : /\bpolice\b/i.test(q) ? 'police' : /\bfire\b/i.test(q) ? 'fire' : 'national', country: 'NG' }, phone: phone || 'anon_router', conversationId: threadId, channel: 'chat', idempotencyKey: `route-emergency:${threadId || 'turn'}:${q}` });
    return { skill: 'emergency', reply: result.message, cardData: { type: 'emergency_dispatch', status: result.status, service: /\bambulance\b/i.test(q) ? 'ambulance' : /\bpolice\b/i.test(q) ? 'police' : /\bfire\b/i.test(q) ? 'fire' : 'national', ...(result.canonicalFacts || {}), actions: result.nextActions, recovery: result.retryRecovery, canonicalAction: 'safety.emergency_dispatch', priority: 'critical' }, canonicalAction: 'safety.emergency_dispatch', progressStage: 'safety', extractionSource: 'deterministic' };
  }
  if (/\b(?:set|start|create|run)\s+(?:a\s+)?safety check-?in\b/i.test(q)) { if (!phone || phone.startsWith('anon_')) return { skill: 'safety_contact', reply: 'I can prepare a safety check-in as soon as you sign in, so its contact and consent state stay with your Kurukoo profile.' }; const activeContacts = (await listSafetyContacts(phone)).filter(contact => contact.status === 'active'); if (!activeContacts.length) return { skill: 'safety_contact', reply: 'Before starting a safety check-in, add a trusted contact and wait for their consent. You can add one in the context inspector; no notification or check-in has been started.', cardData: suggestionCard('safety_contact') }; return { skill: 'safety_contact', reply: `You have ${activeContacts.length} consented safety contact${activeContacts.length === 1 ? '' : 's'}. Choose one from the Safety workspace to start a check-in; I will not start or notify anyone until you select the contact and confirm the timing.`, cardData: suggestionCard('safety_contact') }; }
  if (q.includes('emergency contact') || q.includes('safety contact')) { if (!phone || phone.startsWith('anon_')) return { skill: 'safety_contact', reply: 'I can save your personal emergency contacts as soon as you sign in, so they stay with your Kurukoo profile.' }; const addMatch = q.match(/add\s+(.+?)\s+as\s+(?:my\s+)?(?:emergency|safety)\s+contact/i); if (addMatch) { const name = addMatch[1].trim(); return { skill: 'safety_contact', reply: `I've captured **${name}** as a potential safety contact. To finish adding them, please provide their phone number.`, cardData: { type: 'safety_contact_capture', name } }; } return { skill: 'safety_contact', reply: 'I can manage your safety contacts. You can add a contact by saying “Add [Name] as my emergency contact” or review them in the context inspector.', cardData: suggestionCard('safety_contact') }; }

  if (phone && /\b(i want to earn|i can|i offer|offer(?:ing)? .*service|provide .*service|take jobs|find work)\b/i.test(q)) { const providerSkillMatch = q.match(/\b(plumb(?:er|ing)|electrician|mechanic|carpenter|tailor|cleaner|technician|painter|decorator|tiler|roofer|mason|welder|driver|baker|coder)\b/i)?.[1]?.toLowerCase(); const providerSkill = providerSkillMatch === 'plumbing' ? 'plumber' : providerSkillMatch; if (providerSkill) { const location = q.match(/\b(?:in|around|near)\s+([a-z][a-z -]{2,40}?)(?=\s+(?:and|can|tomorrow|today|available)\b|[,.!?]|$)/i)?.[1]?.trim() || null; return { skill: 'provider_onboarding', reply: `I can help you add **${providerSkill}** to your provider profile${location ? ` for ${location}` : ''}. I will not publish or mark you available automatically. Confirm the skill and location, then I can save the profile update; availability, pricing, verification, and job matching remain separate steps.`, cardData: { type: 'provider_profile_setup', status: 'review_required', skill: providerSkill, location, source: 'explicit_provider_statement' } }; } }
  if (phone && /\b(?:seller|known seller offers?)\b/i.test(q) && /\b(?:sell|offer|product|charger|stock|catalogue|catalog)\b/i.test(q)) return { skill: 'seller_offer_review', reply: 'I can help review your seller or product offer details. I will keep the offer in review until the product, price, inventory, evidence, and fulfilment terms are explicitly recorded; nothing is published or sold from this message alone.', cardData: { type: 'seller_offer_review', status: 'review_required', source: 'explicit_seller_statement' } };
  if (isExploratoryQuestion(query)) { const conversational = await queryUnifiedAI(query, { phone, conversational: true, contextHint, threadId }); return { skill: 'general_question', reply: conversational.text, modelProvider: conversational.provider, model: conversational.model, intentConfidence: conversational.confidence, classificationSource: conversational.provider === 'Kurukoo Template' ? 'fallback' : 'rules' }; }
  if (phone && isResumePhrase(q)) { try { const resumed = await tryResumeStorefront(phone); if (resumed) return { skill: resumed.skill || 'find_worker', reply: resumed.message, cardData: resumed }; } catch (e) { console.warn('[Router] resume failed:', e); } }
  if (phone && q.length <= 80 && !matchCanonicalSkill(q) && !/^(continue|ask the community|keep checking)\b/.test(q)) { const followUp = await applyFollowUpSlot(phone, q); if (followUp) return followUp; }
  if (phone && (/\b(listing|offer)\b/.test(q) || /\b[a-z][a-z-]{1,40}['’]s\b/.test(q))) { try { const offers = await searchKnownEconomicOffers(query, 3); if (offers.length) return { skill: 'product_sourcing', reply: `I found ${offers.length === 1 ? 'a known seller offer' : 'known seller offers'} matching that reference. Choose one to start a single Economic Request.`, cardData: { type: 'agentic_storefront', stage: 'offer_review', skill: 'product_sourcing', title: 'Known seller offers', message: 'Choose a verified seller offer to continue.', knownOffers: offers, escrowProtected: false, progress: 55 } }; } catch (e) { console.warn('[Router] known offer lookup failed:', e); } }
  const assistanceQuestion = /^(how do i|how can i|what should i do|what is the best way|why is|what does)\b/i.test(q) && !/\b(?:find someone|find me|book|hire|order|get me|need someone|who can)\b/i.test(q);
  if (assistanceQuestion) { const assistance = await getAssistanceOutcome(query).catch((error) => { console.warn('[Router] assistance question projection unavailable:', error); return null; }); if (assistance) return { skill: assistance.mode === 'support' ? 'support_triage' : 'general_question', reply: `${assistance.mode === 'support' ? 'I found relevant Kurukoo guidance and community context for this issue.' : 'I found relevant Kurukoo guidance and community context.'} I have not treated any source as a provider, recommendation, availability or completed action. ${assistance.nextActions[0]?.prompt || 'Tell me what you want to do next.'}`, cardData: assistance, canonicalAction: assistance.canonicalAction, progressStage: assistance.mode === 'support' ? 'coordination' : 'information', extractionSource: 'deterministic' }; }
  const directSkill = matchCanonicalSkill(q) || (isFoodOrderExpression(query) ? 'order_food' : null); if (directSkill === 'device_support') { const inspected = await inspectConnectedResourceForDeviceSupport(phone, query, threadId); if (inspected) return inspected; } const extractedEntities = validateConversationalEntities(extractConversationalEntities(query, directSkill || undefined), directSkill || undefined); const conversationDecision = decideConversationIntelligence({ userMessage: query, latestUserMessage: query, assistantReply: '', activeContextIds: contextHint?.activeContexts?.map(context => context.contextId), selectedContextId: contextHint?.selectedContext, relation: contextHint?.relation, pendingFields: contextHint?.activeContexts?.flatMap(context => context.pendingFields || []).slice(0, 8) });
  if (conversationDecision.shouldAvoidAction && (!directSkill || conversationDecision.mode === 'exploration' || conversationDecision.mode === 'clarification')) { const ai = await queryUnifiedAI(query, { provider, phone, conversational: true, contextHint, threadId }); return { skill: 'general_question', reply: ai.text, cardData: ai.provider === 'SmolLM2' ? { type: 'ai_metadata', provider: ai.provider, model: ai.model, conversationMode: conversationDecision.mode } : undefined, modelProvider: ai.provider, model: ai.model, extractionSource: Object.keys(extractedEntities).length > 1 ? 'deterministic' : 'none', extractedEntities: extractedEntities as Record<string, unknown>, progressStage: 'complete' }; }
  if (directSkill && !phone) { const flow = getSkillFlow(directSkill); return { skill: directSkill, reply: flowReply(directSkill, flow), cardData: decorateCardWithSuggestions(actionCard(directSkill), directSkill), extractedEntities: extractedEntities as Record<string, unknown>, extractionSource: 'deterministic' }; }
  if (directSkill === 'event_coverage' && phone) return { skill: 'event_coverage', reply: 'I can help you prepare event evidence for review. Share the event, location, date, and what you personally observed; your submission remains a contributor record and does not verify a provider or create a payment request.', cardData: { type: 'event_coverage', status: 'offer', mode: 'contributor_evidence', moderation: 'required', privateByDefault: true } };
  if (directSkill === 'national_events' && phone) return { skill: 'national_events', reply: 'I can show public event information and daily picks. I will not imply attendance, availability, booking, or payment.', cardData: { type: 'events_list', status: 'public_information' } };
  if (directSkill === 'sports_matchmaking' && phone) return { skill: 'sports_matchmaking', reply: 'I can help coordinate a sports activity. Tell me the sport, location, timing, and number of participants; no participant or venue is confirmed until the supported flow records it.', cardData: { type: 'sports_search', status: 'coordination_needed' } };
  if (directSkill && phone) {
    try {
      if (directSkill === 'product_sourcing') { const offers = await searchKnownEconomicOffers(query, 3); if (offers.length) return { skill: directSkill, reply: `I found ${offers.length === 1 ? 'one known seller offer' : `${offers.length} known seller offers`} matching that product. Choose one to continue through the existing Economic Request flow.`, cardData: { type: 'agentic_storefront', stage: 'offer_review', skill: directSkill, title: 'Known seller offers', message: 'These are verified seller references, not a stock or payment confirmation.', knownOffers: offers, escrowProtected: false, progress: 55 } }; }
      const workerMatch = q.match(/\b(plumber|plumb|electrician|electrical|mechanic|carpenter|tailor|cleaner|clean|cleaning|housekeeping|technician|painter|paint|painting|decorator|decorating|tiler|tiling|roofer|roofing|mason|welder)\b/i)?.[1]; const worker = workerMatch ? (/^plumb/i.test(workerMatch) ? 'plumber' : /^electri/i.test(workerMatch) ? 'electrician' : /^clean|^housekeep/i.test(workerMatch) ? 'house_cleaner' : /^paint/i.test(workerMatch) ? 'painter' : /^decorat/i.test(workerMatch) ? 'decorator' : /^til/i.test(workerMatch) ? 'tiler' : /^roof/i.test(workerMatch) ? 'roofer' : workerMatch.toLowerCase()) : undefined;
      const foodSlots = directSkill === 'order_food' ? extractFoodOrderSlots(query) : {};
      const seed: Record<string, unknown> = directSkill === 'find_worker' && worker ? { service: worker } : directSkill === 'repair' ? extractRepairSlots(query) : directSkill === 'device_support' ? { problem: query.trim(), desired_action: 'diagnose' } : directSkill === 'product_sourcing' ? { product: query.trim() } : directSkill === 'verified_artist' ? { event_type: query.trim() } : directSkill === 'order_food' ? { ...(foodSlots.items ? { items: foodSlots.items } : {}), ...(foodSlots.location ? { location: foodSlots.location } : {}), ...extractFollowUpPatch(query, directSkill) } : {};
      const fromTo = query.match(/\bfrom\s+(.+?)\s+to\s+(.+?)(?=\s+(?:tomorrow|today|on\s+\w+)|[.!?]|$)/i); if (fromTo && (directSkill === 'ride_request' || directSkill === 'ride')) { seed.origin = fromTo[1].trim(); seed.destination = fromTo[2].trim(); }
      const departure = query.match(/\b(today|tonight|tomorrow(?:\s+(?:morning|afternoon|evening|night))?|this\s+weekend|next\s+week|saturday|sunday|monday|tuesday|wednesday|thursday|friday)\b/i); if (departure && (directSkill === 'ride_request' || directSkill === 'ride')) seed.departure_time = departure[1];
      if (extractedEntities.location && !seed.location) seed.location = extractedEntities.location; if (extractedEntities.items && directSkill === 'order_food') seed.items = extractedEntities.items; if (extractedEntities.date) seed.date = extractedEntities.date; if (extractedEntities.time) seed.time = extractedEntities.time; if (extractedEntities.budget !== undefined) seed.budget = extractedEntities.budget; if (extractedEntities.quantity !== undefined) seed.quantity = extractedEntities.quantity; if (extractedEntities.product) seed.product = extractedEntities.product;
      const card = await startStorefrontSession(phone, directSkill, seed, { forceNew: contextHint?.relation === 'create' }); const reply = directSkill === 'product_sourcing' ? `${card.message} I’ll only show a product card when a verified seller reference is available; I will not invent stock, price, or delivery.` : card.message; const progressStage = card.stage === 'information' ? 'information' : card.stage === 'safety' ? 'safety' : card.stage === 'coordination' ? 'coordination' : card.stage === 'slot_fill' || card.stage === 'intent_extraction' ? 'understanding' : card.stage === 'catalog_match' || card.stage === 'offer_review' || card.stage === 'quote_review' ? 'checking' : card.stage === 'complete' ? 'complete' : 'coordinating'; const canonicalAction = card.requestId ? 'economic_request.start' : `skill_flow.${card.stage}`;
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
    if (classification.intent === 'autonomous_agent') { if (!phone || phone.startsWith('anon_')) return { skill: 'autonomous_agent', reply: 'Sign in first to review or create your owner-scoped bounded agents.', cardData: { type: 'agent_goals', status: 'sign_in_required' }, ...source }; const goals = await listAgentGoals(phone); const active = goals.filter(goal => ['active', 'waiting', 'needs_user', 'blocked'].includes(goal.status)); return { skill: 'autonomous_agent', reply: active.length ? `You have ${active.length} bounded agent ${active.length === 1 ? 'goal' : 'goals'} in progress. I can show their status, activity and controls without claiming completion.` : 'You do not have an active bounded agent goal yet. Ask me to keep checking a specific request and I will show the required confirmation and limits.', cardData: { type: 'agent_goals', status: active.length ? 'active' : 'empty', goals: active }, ...source }; }
    if (classification.intent === 'circle_create') return { skill: 'circle_create', reply: 'I can help you set up or join a Money Circle. Confirm the members, contribution cadence and rules before anything is recorded; no funds move from this conversation alone.', cardData: { type: 'money_circle', status: 'setup_required', destination: '/chat?prompt=Set%20up%20a%20Money%20Circle' }, ...source };
    if (classification.intent === 'nearby_pulse_start' || classification.intent === 'nearby_pulse_stop') return { skill: classification.intent, reply: classification.intent === 'nearby_pulse_start' ? 'Go Live shares only the presence details you approve for Nearby and Radar, subject to the existing presence authority and duration controls. Confirm your location and skill before activation.' : 'I can turn off your Go Live presence through the existing Pulse authority. No hidden background sharing is claimed.', cardData: { type: 'nearby_pulse', status: classification.intent === 'nearby_pulse_start' ? 'consent_required' : 'stop_available' }, ...source };
    const flowSkill = skillForIntent(classification.intent); const flow = await getSkillFlow(flowSkill).catch(() => null); if (phone && STOREFRONT_INTENTS.has(classification.intent)) { try { const card = await startStorefrontSession(phone, flowSkill, {}); return { skill: flowSkill, reply: card.message, cardData: card, classificationSource: classification.source, intentConfidence: classification.confidence }; } catch (e) { console.warn('[Router] storefront start failed:', e); } }
    const cardData = decorateCardWithSuggestions(actionCard(classification.intent), flowSkill) || suggestionCard(flowSkill); const reply = flowReply(flowSkill, flow); return { skill: flowSkill, reply, cardData, classificationSource: classification.source, intentConfidence: classification.confidence };
  }
  const assistance = await getAssistanceOutcome(query).catch((error) => { console.warn('[Router] assistance projection unavailable:', error); return null; });
  if (assistance) { const lead = assistance.mode === 'support' ? 'I found relevant Kurukoo guidance and community context for this issue.' : 'I found relevant Kurukoo guidance and community context.'; return { skill: assistance.mode === 'support' ? 'support_triage' : 'general_question', reply: `${lead} I have not treated any source as a provider, recommendation, availability or completed action. ${assistance.nextActions[0]?.prompt || 'Tell me what you want to do next.'}`, cardData: assistance, canonicalAction: assistance.canonicalAction, progressStage: assistance.mode === 'support' ? 'coordination' : 'information', extractionSource: 'deterministic' }; }
  const ai = await queryUnifiedAI(query, { provider, phone, conversational: true, contextHint, threadId }); const cardData: any = ai.provider === 'SmolLM2' ? { type: 'ai_metadata', provider: ai.provider, model: ai.model } : undefined; const generalEntities = validateConversationalEntities(extractConversationalEntities(query, classification?.intent), classification?.intent); return { skill: 'general_question', reply: ai.text, cardData, modelProvider: ai.provider, model: ai.model, extractionSource: Object.keys(generalEntities).length > 1 ? 'deterministic' : 'none', extractedEntities: generalEntities as Record<string, unknown>, progressStage: 'complete' };
}
