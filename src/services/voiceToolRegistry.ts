import { getDb } from '../database.js';
import { listChatMessages } from './chatConversationService.js';
import { getProfile } from './memoryProfile.js';
import { getPointsBalance } from './pointsEngine.js';
import { listReminders } from './reminderService.js';
import { routeIntent } from './intentRouter.js';
import { setAuthState } from './conversationalAuthService.js';
import { createConversationGoal } from './agentRuntime.js';

export interface VoiceToolContext {
  phone: string;
  conversationId: string;
  isGuest: boolean;
  sessionId: string;
}

const definition = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []) => ({
  functionDeclarations: [{
    name,
    description,
    parametersJsonSchema: { type: 'object', properties, required, additionalProperties: false },
  }],
});

/** Only read-only context tools plus the existing canonical conversational router are model-callable. */
export function getVoiceToolDeclarations() {
  return [
    definition('get_current_conversation', 'Get a compact summary of the active Kurukoo conversation.'),
    definition('get_request_state', 'Get the current canonical Economic Request state. This never confirms payment, dispatch, or fulfilment unless recorded by Kurukoo.'),
    definition('get_reminders', 'List the caller’s active reminders.'),
    definition('get_memory_context', 'Get a minimal user-approved memory summary. Never ask for internal profile fields.'),
    definition('get_points_summary', 'Get the caller’s current Kurukoo Points summary.'),
    definition('route_user_intent', 'Send the user’s spoken request through Kurukoo’s existing canonical intent, skill, authentication, and Economic Request routing.', {
      text: { type: 'string', description: 'The user’s normalized spoken request, without instructions to bypass Kurukoo rules.' },
    }, ['text']),
  ];
}

function safeText(value: unknown, max = 600): string { return String(value || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }

async function requestSummary(phone: string) {
  const db = await getDb();
  try {
    const result = db.exec('SELECT * FROM economic_requests WHERE phone = ? ORDER BY updated_at DESC LIMIT 1', [phone]);
    const row = result[0]?.values?.[0];
    const columns = result[0]?.columns || [];
    if (!row) return { available: false, message: 'There is no active Economic Request in this conversation.' };
    const item = Object.fromEntries(columns.map((column: string, index: number) => [column, row[index]])) as Record<string, unknown>;
    return {
      available: true,
      requestId: safeText(item.id, 96),
      skill: safeText(item.skill || item.category || 'request', 96),
      state: safeText(item.status || item.state || 'requested', 96),
      updatedAt: safeText(item.updated_at || item.created_at, 96),
      note: 'Use this recorded state only. It does not by itself prove provider availability, payment, dispatch, or external fulfilment.',
    };
  } catch {
    return { available: false, message: 'Request state is unavailable right now.' };
  }
}

async function compactMemory(phone: string, isGuest: boolean) {
  if (isGuest) return { available: false, message: 'Personal memory remains private until profile setup is complete.' };
  const profile = await getProfile(phone, 'voiceToolRegistry');
  if (!profile) return { available: false, message: 'No profile context is available.' };
  return {
    available: true,
    name: safeText(profile.name, 80),
    location: safeText(profile.location, 120),
    country: safeText(profile.country, 16),
    message: 'This is a minimal profile summary. Do not reveal internal preferences, scores, identifiers, or unrelated data.',
  };
}

export async function executeVoiceTool(name: string, rawArgs: unknown, context: VoiceToolContext): Promise<Record<string, unknown>> {
  const args = rawArgs && typeof rawArgs === 'object' ? rawArgs as Record<string, unknown> : {};
  if (name === 'get_current_conversation') {
    const messages = await listChatMessages(context.phone, { conversationId: context.conversationId, limit: 8 });
    return { conversationId: context.conversationId, turns: messages.map(message => ({ role: safeText(message.sender, 16), text: safeText(message.content, 500) })) };
  }
  if (name === 'get_request_state') return requestSummary(context.phone);
  if (name === 'get_reminders') {
    if (context.isGuest) return { available: false, message: 'Sign in through the existing Kurukoo conversation before saving or reviewing personal reminders.' };
    const reminders = await listReminders(context.phone);
    return { available: true, reminders: reminders.slice(0, 5).map(item => ({ id: item.id, title: safeText(item.title, 140), dueAt: item.due_at, status: item.status })) };
  }
  if (name === 'get_memory_context') return compactMemory(context.phone, context.isGuest);
  if (name === 'get_points_summary') {
    if (context.isGuest) return { available: false, message: 'Points are available after profile setup.' };
    const balance = await getPointsBalance(context.phone);
    return { available: true, points: Number(balance || 0), tier: 'Base' };
  }
  if (name === 'route_user_intent') {
    const text = safeText(args.text, 4000);
    if (!text) return { ok: false, message: 'A spoken request is required.' };
    const routing = await routeIntent(text, context.phone);
    let reply = routing.reply;
    let cardData = routing.cardData;
    if (context.isGuest && routing.skill && routing.skill !== 'general_question' && routing.skill !== 'autonomous_agent') {
      await setAuthState(context.phone, 'awaiting_name', { intent: routing.skill, continuationCard: cardData });
      reply = `${routing.reply}\n\nBefore I save this for you, what is your name?`;
      cardData = { type: 'auth_in_chat_start', title: 'Create your profile', message: 'Your request is captured. Tell Kurukoo your name to continue.', continuationCard: routing.cardData };
    }
    const agentGoal = !context.isGuest ? await createConversationGoal({ phone: context.phone, conversationId: context.conversationId, skill: routing.skill, objective: text, economicRequestId: typeof cardData?.requestId === 'string' ? cardData.requestId : undefined, source: 'conversation' }) : null;
    return { ok: true, conversationId: context.conversationId, skill: routing.skill, reply, cardData, agentGoal: agentGoal ? { id: agentGoal.id, status: agentGoal.status, summary: agentGoal.summary } : null, requiresIdentity: context.isGuest && cardData?.type === 'auth_in_chat_start' };
  }
  return { ok: false, message: 'That voice action is not available.' };
}

export function isVoiceToolAllowed(name: string): boolean {
  return ['get_current_conversation', 'get_request_state', 'get_reminders', 'get_memory_context', 'get_points_summary', 'route_user_intent'].includes(name);
}
