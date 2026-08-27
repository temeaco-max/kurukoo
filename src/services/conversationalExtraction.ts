import { getKnownSkills } from './skillFlows.js';
import { detectUserOutcomeVerb, type UserOutcomeVerb } from './outcomeSupport.js';

export interface ConversationalEntities {
  intent?: string;
  skill?: string;
  location?: string;
  date?: string;
  time?: string;
  budget?: number;
  quantity?: number;
  product?: string;
  items?: string;
  delivery?: boolean;
  dietaryRequirements?: string;
  allergyRequirements?: string;
  substitutionPolicy?: string;
  deliveryInstructions?: string;
  recipient?: string;
  contactMethod?: 'call' | 'sms' | 'whatsapp';
  fulfilmentMethod?: 'delivery' | 'pickup';
  packagingPreference?: string;
  deliveryTime?: string;
  preferences?: string[];
  provider?: string;
  outcomeVerb?: UserOutcomeVerb;
  subject?: string;
  device?: string;
  deviceModel?: string;
  issue?: string;
  network?: string;
  requestContext?: string;
}

const SKILL_ALIASES: Array<[RegExp, string]> = [
  [/\bpaint(?:er|ing)?\b/i, 'painter'],
  [/\bplumb(?:er|ing)?\b/i, 'plumber'],
  [/\belectric(?:ian|al)?\b/i, 'electrician'],
  [/\bcarpenter\b/i, 'carpenter'],
  [/\bclean(?:er|ing)?\b/i, 'cleaner'],
  [/\b(?:taxi|cab|ride|uber)\b/i, 'ride_request'],
  [/\b(?:jollof|fried rice|rice|yam|plantain|food|meal|groceries)\b/i, 'order_food'],
  [/\b(?:wifi|wi-fi|internet|router|broadband)\b/i, 'wifi_installer'],
  [/\b(?:phone|mobile|iphone|android|tablet|ipad|laptop|computer|pc|macbook|watch|smartwatch|printer|tv|television|camera|router)\b/i, 'support_triage'],
];

function clean(value: string | undefined): string | undefined {
  const result = value?.replace(/[.!?,;:]+$/, '').trim();
  return result || undefined;
}

function parseBudget(text: string): number | undefined {
  const match = text.match(/(?:₦|ngn|naira)\s*([\d,]+)|\b([\d,]+)\s*(?:ngn|naira|k)\b/i);
  if (!match) return undefined;
  const value = Number((match[1] || match[2] || '').replace(/,/g, ''));
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return /\bk\b/i.test(match[0]) ? value * 1000 : value;
}

function parseLocation(text: string): string | undefined {
  const explicit = text.match(/\b(?:in|at|near|around|within)\s+([A-Za-z][A-Za-z .'-]{1,50}?)(?=\s+(?:on|next|this|tomorrow|today|for|with|and|budget|around|within|to\s+(?:diagnos(?:e|is)|repair|fix|service))|[,.!?]|$)/i)?.[1];
  if (explicit) return clean(explicit);
  const known = ['ikeja', 'lekki', 'yaba', 'ibadan', 'abuja', 'surulere', 'victoria island', 'port harcourt'];
  const matched = known.find(location => new RegExp(`\\b${location.replace(' ', '\\s+')}\\b`, 'i').test(text));
  return matched ? matched.replace(/\\b[a-z]/g, letter => letter.toUpperCase()) : undefined;
}

function parseDateTime(text: string): { date?: string; time?: string } {
  const date = text.match(/\b(next\s+(?:weekend|saturday|sunday)|this\s+weekend|tomorrow|today|saturday|sunday|monday|tuesday|wednesday|thursday|friday)\b/i)?.[1];
  const time = text.match(/\b(morning|afternoon|evening|night|\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i)?.[1];
  return { date: clean(date), time: clean(time) };
}

function parseQuantity(text: string): number | undefined {
  const match = text.match(/\b(?:for|x|quantity(?: of)?)\s*(\d+)\b/i);
  return match ? Number(match[1]) : undefined;
}

function parseProduct(text: string): string | undefined {
  const match = text.match(/\b(?:buy|purchase|order|get|source)\s+(.+?)(?=\s+(?:in|at|near|for|tomorrow|today|on|with|around)\b|[.!?]|$)/i);
  return clean(match?.[1]);
}

function parseDevice(text: string): { device?: string; deviceModel?: string } {
  const model = text.match(/\b(?:iphone|ipad|macbook|galaxy|pixel|surface|thinkpad|playstation|xbox)\s*[A-Za-z0-9 .-]{0,30}?\b(?:\d{1,4}|pro|max|ultra|air|mini)\b/i)?.[0];
  const device = text.match(/\b(?:phone|mobile|iphone|android|tablet|ipad|laptop|computer|pc|macbook|desktop|watch|smartwatch|printer|tv|television|camera|router|modem|speaker|console|device)\b/i)?.[0];
  return { device: clean(device), deviceModel: clean(model) };
}

function parseIssue(text: string): string | undefined {
  const explicit = text.match(/\b(?:because|issue is|problem is|fault is|having trouble with|not working|won't|cant|can't)\s+(.+?)(?:[.!?]|$)/i)?.[1];
  if (explicit) return clean(explicit);
  const issue = text.match(/\b(?:slowly|slow|slower|freezing|frozen|crashing|overheating|hot|virus|malware|infected|broken|damaged|stuck|offline|disconnected|no internet|weak signal|not charging|won't charge|battery|storage full)\b[^.!?]*/i)?.[0];
  return clean(issue);
}

const FOOD_ITEM_PATTERN = /\b(?:rice|yam|plantain|jollof|egusi|amala|ewedu|suya|bread|chicken|beans|noodles|meal|groceries?)\b/gi;

export interface FoodOrderSlots {
  items?: string;
  location?: string;
  delivery?: boolean;
  quantity?: number;
  budget?: number;
  dietary_requirements?: string;
  allergy_requirements?: string;
  substitution_policy?: string;
  delivery_instructions?: string;
  recipient?: string;
  contact_method?: 'call' | 'sms' | 'whatsapp';
  fulfilment_method?: 'delivery' | 'pickup';
  packaging_preference?: string;
  delivery_time?: string;
}

function matchedTerms(query: string, pattern: RegExp): string | undefined {
  const values = [...query.matchAll(pattern)].map(match => match[0].trim().toLowerCase());
  return values.length ? [...new Set(values)].join(', ') : undefined;
}

export function extractFoodOrderSlots(text: string): FoodOrderSlots {
  const query = String(text || '').trim();
  const location = parseLocation(query);
  const delivery = /\b(?:deliver(?:ed|y)?|bring|send)\b/i.test(query) || undefined;
  const pickup = /\b(?:pickup|pick up|collect)\b/i.test(query);
  const found = [...query.matchAll(FOOD_ITEM_PATTERN)].map(match => match[0].toLowerCase());
  const unique = [...new Set(found)];
  const explicitFoodIntent = /\b(?:order|buy|get|need|want|deliver(?:ed|y)?|bring|send|food|meal|grocer(?:y|ies))\b/i.test(query);
  const vagueItem = !unique.length && explicitFoodIntent ? query.match(/\b(?:something|anything|a meal|food)\b/i)?.[0]?.toLowerCase() : undefined;

  const dietary = matchedTerms(query, /\b(?:vegetarian|vegan|halal|kosher|gluten[- ]?free|low[- ]?salt|no[- ]?sugar|mild|not spicy|spicy)\b/gi);
  const allergy = query.match(/\b(?:allergic to|allergy(?: to)?|without|no)\s+(?:peanuts?|nuts?|shellfish|dairy|milk|eggs?|gluten)\b/i)?.[0];
  const substitution = /\b(?:no substitutions?|do not substitute|don't substitute)\b/i.test(query) ? 'no_substitutions' : query.match(/\b(?:substitut(?:e|ion)|replacement)\b[^.!?]{0,80}/i)?.[0];
  const deliveryInstructions = query.match(/\b(?:leave(?: it)?|deliver(?: it)?|bring(?: it)?)\s+(?:with|at|by)\s+([^.!?]{3,80})/i)?.[0];
  const recipient = query.match(/\b(?:for|to)\s+((?:my\s+(?:mum|mother|dad|father|friend|wife|husband))|(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}))(?=\s+(?:at|in|on|with|and|by)|[.!?,]|$)/)?.[1];
  const contactMethod: FoodOrderSlots['contact_method'] = /\b(?:whats ?app|whatsapp)\b/i.test(query) ? 'whatsapp' : /\b(?:text me|sms me|by sms)\b/i.test(query) ? 'sms' : /\b(?:call me|phone me)\b/i.test(query) ? 'call' : undefined;
  const packaging = matchedTerms(query, /\b(?:sealed|hot|separate(?:ly)? packed|separate containers?|tamper[- ]?evident)\b/gi);
  const dateTime = parseDateTime(query);
  const deliveryTime = [dateTime.date, dateTime.time].filter(Boolean).join(' ') || undefined;
  const items = unique.length ? unique.join(' and ') : vagueItem;
  return {
    ...(items ? { items } : {}),
    ...(location ? { location } : {}),
    ...(delivery ? { delivery: true } : {}),
    ...(parseQuantity(query) ? { quantity: parseQuantity(query) } : {}),
    ...(parseBudget(query) ? { budget: parseBudget(query) } : {}),
    ...(dietary ? { dietary_requirements: dietary } : {}),
    ...(allergy ? { allergy_requirements: allergy.toLowerCase() } : {}),
    ...(substitution ? { substitution_policy: substitution.toLowerCase() } : {}),
    ...(deliveryInstructions ? { delivery_instructions: deliveryInstructions } : {}),
    ...(recipient ? { recipient } : {}),
    ...(contactMethod ? { contact_method: contactMethod } : {}),
    ...(pickup || delivery ? { fulfilment_method: pickup ? 'pickup' : 'delivery' } : {}),
    ...(packaging ? { packaging_preference: packaging } : {}),
    ...(deliveryTime ? { delivery_time: deliveryTime } : {}),
  };
}

export function isFoodOrderExpression(text: string): boolean {
  const slots = extractFoodOrderSlots(text);
  return Boolean(slots.items && (slots.location || slots.delivery || /\b(?:order|buy|get|need|want|food|meal|grocer(?:y|ies))\b/i.test(String(text || ''))));
}

function parsePreferences(text: string): string[] | undefined {
  const preferences: string[] = [];
  if (/\bprefer\b.*\b(short|brief|concise|simple)\b/i.test(text)) preferences.push('response_style:concise');
  if (/\bprefer\b.*\bevenings?\b/i.test(text)) preferences.push('time_preference:evening');
  if (/\bprefer\b.*\bmornings?\b/i.test(text)) preferences.push('time_preference:morning');
  return preferences.length ? preferences : undefined;
}

export function extractConversationalEntities(text: string, intent?: string): ConversationalEntities {
  const query = String(text || '').trim();
  const skill = SKILL_ALIASES.find(([pattern]) => pattern.test(query))?.[1] || getKnownSkills().find(candidate => query.toLowerCase().includes(candidate.replace(/_/g, ' ')));
  const dateTime = parseDateTime(query);
  const food = extractFoodOrderSlots(query);
  const { device, deviceModel } = parseDevice(query);
  const outcomeVerb = detectUserOutcomeVerb(query);
  const subject = device || food.items;
  const network = query.match(/\b(?:wifi|wi-fi|internet|router|modem|broadband|network|connection|signal)\b/i)?.[0];
  const entities: ConversationalEntities = {
    intent,
    skill,
    outcomeVerb,
    subject,
    device,
    deviceModel,
    issue: parseIssue(query),
    network: clean(network),
    location: parseLocation(query),
    date: dateTime.date,
    time: dateTime.time,
    budget: parseBudget(query),
    quantity: parseQuantity(query),
    product: parseProduct(query),
    items: food.items,
    delivery: food.delivery,
    dietaryRequirements: food.dietary_requirements,
    allergyRequirements: food.allergy_requirements,
    substitutionPolicy: food.substitution_policy,
    deliveryInstructions: food.delivery_instructions,
    recipient: food.recipient,
    contactMethod: food.contact_method,
    fulfilmentMethod: food.fulfilment_method,
    packagingPreference: food.packaging_preference,
    deliveryTime: food.delivery_time,
    preferences: parsePreferences(query),
    requestContext: query,
  };
  return Object.fromEntries(Object.entries(entities).filter(([, value]) => value !== undefined && value !== '')) as ConversationalEntities;
}

export function validateConversationalEntities(entities: ConversationalEntities, intent?: string): ConversationalEntities {
  const validated: ConversationalEntities = { ...entities, intent: intent || entities.intent };
  if (validated.budget !== undefined && (!Number.isFinite(validated.budget) || validated.budget < 0 || validated.budget > 1_000_000_000)) delete validated.budget;
  if (validated.quantity !== undefined && (!Number.isInteger(validated.quantity) || validated.quantity < 1 || validated.quantity > 10000)) delete validated.quantity;
  if (validated.location) validated.location = validated.location.slice(0, 80);
  if (validated.product) validated.product = validated.product.slice(0, 160);
  if (validated.items) validated.items = validated.items.slice(0, 160);
  if (validated.subject) validated.subject = validated.subject.slice(0, 120);
  if (validated.device) validated.device = validated.device.slice(0, 80);
  if (validated.deviceModel) validated.deviceModel = validated.deviceModel.slice(0, 120);
  if (validated.issue) validated.issue = validated.issue.slice(0, 240);
  if (validated.network) validated.network = validated.network.slice(0, 80);
  if (validated.delivery !== undefined && typeof validated.delivery !== 'boolean') delete validated.delivery;
  for (const key of ['dietaryRequirements', 'allergyRequirements', 'substitutionPolicy', 'deliveryInstructions', 'recipient', 'packagingPreference', 'deliveryTime'] as const) if (validated[key] && validated[key]!.length > 160) delete validated[key];
  if (validated.contactMethod && !['call', 'sms', 'whatsapp'].includes(validated.contactMethod)) delete validated.contactMethod;
  if (validated.fulfilmentMethod && !['delivery', 'pickup'].includes(validated.fulfilmentMethod)) delete validated.fulfilmentMethod;
  if (validated.skill && validated.skill.length > 80) delete validated.skill;
  return validated;
}
