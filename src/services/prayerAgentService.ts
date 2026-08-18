import { createAIAgent, executeAgentTask, getAIAgentById, type AIAgent } from './aiAgentService.js';
import { createReminder, listReminders } from './reminderService.js';
import { getProfile } from './memoryProfile.js';

export type PrayerTradition = 'christian' | 'muslim' | 'jewish' | 'spiritual' | 'general';
export type PrayerMode = 'text' | 'audio' | 'live';

const PRAYER_AGENT_ID = 'agent_prayer_companion';
const PRAYER_SYSTEM_PROMPT = `[IDENTITY & ROLE]\nYou are Kurukoo's Prayer Companion, a first-class spiritual-support agent. You offer respectful, user-led prayer and spiritual conversation. You do not claim supernatural certainty, divine authority, guaranteed outcomes, healing, prophecy, or knowledge of God's intentions. Never impersonate a real pastor, priest, imam, rabbi, prophet, or named religious leader. You may use a warm pastoral/preacher-like style when the user requests it, but clearly remain Kurukoo's AI prayer companion.\n\n[BEHAVIOUR]\n- Listen before praying when the user wants conversation.\n- Ask at most one useful clarification when the requested prayer would materially benefit from it (for example: tradition, topic, preferred tone).\n- Respect the user's stated tradition and wording; never assume a religion.\n- A user's name may be used when supplied in the current request or from an authoritative Kurukoo profile.\n- Never fabricate quotations from scripture. Use only short, well-known quotations when explicitly requested, and identify them as quotations; otherwise write original prayer language.\n- Never promise prosperity, healing, reconciliation, employment, money, or any other real-world outcome. Pray for guidance, strength, wisdom, peace, perseverance, provision and other values without claiming a guaranteed result.\n- If a user describes immediate danger, abuse, medical emergency, or severe crisis, keep prayer supportive but direct the user to appropriate real-world help; prayer is not a replacement for emergency or professional care.\n- For live voice, sound natural, calm and compassionate. Allow the user to interrupt. Do not monologue indefinitely.\n\n[OUTPUT]\nFor a prayer request, produce a personalised original prayer that names the person's stated concern and may include their name. Keep the language spoken-aloud friendly, sincere and specific. Do not include internal reasoning or metadata.`;

const DEFAULT_AGENT: AIAgent = {
  id: PRAYER_AGENT_ID,
  name: 'Kurukoo Prayer Companion',
  avatar: '🙏',
  system_prompt: PRAYER_SYSTEM_PROMPT,
  skills: ['prayer', 'spiritual_support', 'pray_for_me', 'prayer_routine', 'live_prayer'],
  tools: ['prayer_script', 'prayer_voice', 'prayer_routine'],
  status: 'active',
  lga: 'All',
  concurrency_limit: 20,
  token_quota_daily: 50000,
  cost_threshold_usd: 5,
  temperature: 0.65,
};

export async function ensurePrayerAgent(): Promise<AIAgent> {
  const existing = await getAIAgentById(PRAYER_AGENT_ID);
  if (existing) return existing;
  await createAIAgent(DEFAULT_AGENT);
  return (await getAIAgentById(PRAYER_AGENT_ID)) || DEFAULT_AGENT;
}

function normalizeTradition(value: unknown): PrayerTradition {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'christian' || text === 'christianity') return 'christian';
  if (text === 'muslim' || text === 'islam' || text === 'islamic') return 'muslim';
  if (text === 'jewish' || text === 'judaism') return 'jewish';
  if (text === 'spiritual') return 'spiritual';
  return 'general';
}

function spokenFallback(name: string, topic: string, tradition: PrayerTradition): string {
  const address = name ? `${name}, ` : '';
  const traditionLead = tradition === 'christian' ? 'Father, we bring ' : tradition === 'muslim' ? 'O Allah, we bring ' : tradition === 'jewish' ? 'Holy One, we bring ' : 'May peace and wisdom surround ';
  if (tradition === 'general' || tradition === 'spiritual') {
    return `${address}may you be held in peace as you face ${topic}. May you find clarity for the decisions before you, courage for the difficult parts, supportive people around you, and steady strength for the work ahead. May your efforts bear good fruit and may you have wisdom to recognise good opportunities without losing your peace. May you feel accompanied rather than alone. Amen.`;
  }
  return `${traditionLead}${name || 'this person'} and their concern about ${topic}. May they receive wisdom, strength, provision, peace and the right support for the road ahead. Guard them from fear and discouragement, help them act with integrity, and let their efforts bear good fruit. Give them clarity about what is theirs to do and patience about what they cannot control. May they be strengthened today and in the days ahead. Amen.`;
}

export async function generatePrayer(input: {
  phone: string;
  topic?: string;
  name?: string;
  tradition?: PrayerTradition;
  tone?: string;
  length?: 'short' | 'medium' | 'long';
  conversationId?: string;
}): Promise<{ prayer: string; agentId: string; provider?: string; model?: string; tradition: PrayerTradition }> {
  const agent = await ensurePrayerAgent();
  const profile = await getProfile(input.phone, 'prayerAgent').catch(() => null);
  const name = String(input.name || profile?.name || '').trim().slice(0, 80);
  const topic = String(input.topic || 'the concerns and hopes currently on their heart').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 500);
  const tradition = normalizeTradition(input.tradition);
  const tone = String(input.tone || 'warm, sincere and encouraging').trim().slice(0, 120);
  const length = input.length || 'medium';
  const task = `Write an original ${length} prayer for ${name || 'the user'}. Tradition/style requested: ${tradition}. Topic: ${topic}. Tone: ${tone}. The prayer should be suitable to read aloud, use the person's name naturally when available, avoid supernatural guarantees, and avoid inventing scripture quotations.`;
  const execution = await executeAgentTask(agent.id, task, input.phone);
  const prayer = execution.success && execution.result.trim().length > 0 ? execution.result.trim() : spokenFallback(name, topic, tradition);
  return { prayer, agentId: agent.id, provider: execution.provider, model: execution.model, tradition };
}

export async function createPrayerRoutine(input: { phone: string; topic: string; dueAt: string; recurrence: 'daily' | 'weekly'; tradition?: PrayerTradition; name?: string; conversationId?: string }) {
  const tradition = normalizeTradition(input.tradition);
  await ensurePrayerAgent();
  const reminder = await createReminder(input.phone, {
    title: 'Prayer time',
    note: `Prayer Companion: ${input.topic.slice(0, 220)}${tradition !== 'general' ? ` (${tradition})` : ''}`,
    dueAt: input.dueAt,
    recurrence: input.recurrence,
    sourceConversationId: input.conversationId || null,
    resumeContextId: `prayer:${PRAYER_AGENT_ID}`,
  });
  return reminder;
}

export async function listPrayerRoutines(phone: string) {
  const reminders = await listReminders(phone);
  return reminders.filter(reminder => reminder.resume_context_id === `prayer:${PRAYER_AGENT_ID}`);
}

export function prayerLiveSystemInstruction(tradition: PrayerTradition = 'general'): string {
  return `${PRAYER_SYSTEM_PROMPT}\n\n[LIVE SESSION]\nYou are currently conducting a live prayer conversation. Requested tradition: ${tradition}. First listen and respond conversationally. When the user asks to pray, lead a spoken prayer in a calm natural voice. You may invite a brief response before or after praying. Keep each spoken turn reasonably short so the user can interrupt. Never claim supernatural certainty or that a prayer has guaranteed an outcome.`;
}

export { PRAYER_AGENT_ID };
