import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';
import { listAgentGoals, type AgentGoal } from './agentRuntime.js';
import { deriveInteractionPolicyForCapabilityName } from './capabilityInteractionPolicyService.js';
import { listEconomicRequestsForPhone, type EconomicRequest } from './skillFlows.js';
import { getProfile } from './memoryProfile.js';
import { getInternalNotifications } from './pushNotifications.js';
import { listReminders, type Reminder } from './reminderService.js';
import { listAssignedTasks, type MicroTask } from './microTasks.js';

/**
 * A compact, deterministic projection over canonical state. It deliberately
 * keeps only stable references and user-facing state summaries; it is not a
 * second notification, request, task, memory, or event authority.
 */
export type AgentBriefItemCategory =
  | 'completed'
  | 'pending'
  | 'attention_required'
  | 'upcoming_task'
  | 'provider_update'
  | 'important_notification'
  | 'safety_event'
  | 'agent_work_in_progress'
  | 'agent_work_completed'
  | 'waiting_for_user';

export type AgentBriefPriority = 'low' | 'normal' | 'high' | 'critical';
export type AgentBriefUrgency = 'none' | 'upcoming' | 'due' | 'time_sensitive' | 'critical';
export type AgentBriefAttention = 'IMMEDIATE' | 'NOTIFY' | 'NEXT_BRIEF' | 'SILENT';
export type AgentPresence = 'idle' | 'thinking' | 'speaking' | 'working' | 'waiting' | 'needs-attention';
export type BriefVisibility = 'private' | 'restricted';

export interface AgentBriefAction {
  id: string;
  label: string;
  canonicalAction?: string;
  objectType: string;
  objectId: string;
  conversationId?: string;
}

export interface AgentBriefItem {
  stableRef: string;
  category: AgentBriefItemCategory;
  priority: AgentBriefPriority;
  urgency: AgentBriefUrgency;
  timestamp?: string;
  source: 'request' | 'task' | 'reminder' | 'notification' | 'agent_runtime';
  summary: string;
  action?: AgentBriefAction;
  approvalRequired: boolean;
  expiresAt?: string;
  visibility: BriefVisibility;
  attention: AgentBriefAttention;
}

export interface AgentBriefPreferences {
  proactiveVoiceEnabled: boolean;
  quietHours?: { start: string; end: string; timeZone?: string };
  style: 'concise' | 'detailed';
  notificationCategories?: AgentBriefItemCategory[];
  interruptionSensitivity: 'minimal' | 'standard' | 'interruptive';
  allowCriticalInterruption: boolean;
}

export interface AgentBriefPresentation {
  text: string;
  shouldSpeak: boolean;
  fallback: 'text' | 'notification';
}

export interface AgentBrief {
  id: string;
  version: 1;
  ownerPhone: string;
  generatedAt: string;
  presence: AgentPresence;
  items: AgentBriefItem[];
  presentation: AgentBriefPresentation;
}

export interface BuildAgentBriefOptions {
  now?: Date;
  preferences?: Partial<AgentBriefPreferences>;
}

const CLOSED_REQUESTS = new Set(['completed', 'fulfilled']);
const REQUESTS_NEEDING_APPROVAL = new Set(['quoted', 'awaiting_confirmation', 'payment_pending']);
const ACTIVE_REQUESTS = new Set(['requested', 'awaiting_match', 'partially_matched', 'matched', 'quoting', 'reserved', 'paid', 'in_fulfillment']);
const CLOSED_GOALS = new Set(['completed', 'cancelled', 'failed', 'expired']);
const CLOSED_TASKS = new Set(['completed', 'approved', 'rejected']);
const RECENT_COMPLETION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asChoice<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T : fallback;
}

function normaliseQuietHours(value: unknown): AgentBriefPreferences['quietHours'] {
  if (!isObject(value)) return undefined;
  const start = typeof value.start === 'string' ? value.start : '';
  const end = typeof value.end === 'string' ? value.end : '';
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return undefined;
  return { start, end, timeZone: typeof value.timeZone === 'string' ? value.timeZone : undefined };
}

function normaliseCategories(value: unknown): AgentBriefItemCategory[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const allowed = new Set<AgentBriefItemCategory>(['completed', 'pending', 'attention_required', 'upcoming_task', 'provider_update', 'important_notification', 'safety_event', 'agent_work_in_progress', 'agent_work_completed', 'waiting_for_user']);
  const categories = value.filter((item): item is AgentBriefItemCategory => typeof item === 'string' && allowed.has(item as AgentBriefItemCategory));
  return categories.length ? [...new Set(categories)] : undefined;
}

/** Read only the existing encrypted Memory Profile preference document. */
export function resolveAgentBriefPreferences(profilePreferences: unknown, overrides: Partial<AgentBriefPreferences> = {}): AgentBriefPreferences {
  const root = isObject(profilePreferences) ? profilePreferences : {};
  const proactive = isObject(root.proactive_brief) ? root.proactive_brief : {};
  const style = asChoice(proactive.style ?? root.response_style ?? root.communication_style, ['concise', 'detailed'] as const, 'concise');
  const categories = normaliseCategories(proactive.notification_categories ?? root.notification_categories);
  const quietHours = normaliseQuietHours(proactive.quiet_hours ?? root.quiet_hours);
  return {
    proactiveVoiceEnabled: asBoolean(overrides.proactiveVoiceEnabled, asBoolean(proactive.voice_enabled ?? root.proactive_voice_enabled, false)),
    quietHours: overrides.quietHours ?? quietHours,
    style: overrides.style ?? style,
    notificationCategories: overrides.notificationCategories ?? categories,
    interruptionSensitivity: overrides.interruptionSensitivity ?? asChoice(proactive.interruption_sensitivity ?? root.interruption_sensitivity, ['minimal', 'standard', 'interruptive'] as const, 'standard'),
    allowCriticalInterruption: asBoolean(overrides.allowCriticalInterruption, asBoolean(proactive.allow_critical_interruption ?? root.allow_critical_interruption, true)),
  };
}

function timeToMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

export function isQuietHoursActive(preferences: AgentBriefPreferences, now = new Date()): boolean {
  const quiet = preferences.quietHours;
  if (!quiet) return false;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: quiet.timeZone || 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const hour = Number(parts.find(part => part.type === 'hour')?.value || 0);
    const minute = Number(parts.find(part => part.type === 'minute')?.value || 0);
    const current = hour * 60 + minute;
    const start = timeToMinutes(quiet.start);
    const end = timeToMinutes(quiet.end);
    return start === end ? false : start < end ? current >= start && current < end : current >= start || current < end;
  } catch {
    return false;
  }
}

function isRecentCompletion(timestamp: string | undefined, now: Date): boolean {
  if (!timestamp) return false;
  const occurredAt = new Date(timestamp).getTime();
  return Number.isFinite(occurredAt) && occurredAt >= now.getTime() - RECENT_COMPLETION_WINDOW_MS;
}

function requestTitle(request: EconomicRequest): string {
  const raw = String(request.requirements?.service || request.requirements?.product || request.requirements?.description || request.skill || 'request').replace(/[_-]+/g, ' ').trim();
  return raw ? raw.slice(0, 80) : 'request';
}

function requestItem(request: EconomicRequest, now: Date): Omit<AgentBriefItem, 'attention'> | null {
  const title = requestTitle(request);
  const base = {
    stableRef: `economic_request:${request.id}`,
    timestamp: request.updatedAt,
    source: 'request' as const,
    visibility: 'private' as const,
    action: { id: 'open_request', label: 'Open request', canonicalAction: 'economic_request.open', objectType: 'economic_request', objectId: request.id },
  };
  if (CLOSED_REQUESTS.has(request.status)) return isRecentCompletion(request.updatedAt || request.createdAt, now) ? { ...base, category: 'completed', priority: 'normal', urgency: 'none', summary: `Your ${title} request is complete.`, approvalRequired: false } : null;
  if (REQUESTS_NEEDING_APPROVAL.has(request.status)) return { ...base, category: 'waiting_for_user', priority: 'high', urgency: 'time_sensitive', summary: `Your ${title} request needs your review before Kurukoo can continue.`, approvalRequired: true };
  if (request.status === 'disputed' || request.status === 'failed') return { ...base, category: 'attention_required', priority: 'high', urgency: 'time_sensitive', summary: `Your ${title} request needs attention before it can continue.`, approvalRequired: false };
  if (ACTIVE_REQUESTS.has(request.status)) {
    const providerUpdate = new Set(['matched', 'quoting', 'reserved', 'paid', 'in_fulfillment']).has(request.status);
    return { ...base, category: providerUpdate ? 'provider_update' : 'pending', priority: providerUpdate ? 'high' : 'normal', urgency: providerUpdate ? 'upcoming' : 'none', summary: providerUpdate ? `Your ${title} request has a verified progress update.` : `Your ${title} request is still in progress.`, approvalRequired: false };
  }
  return null;
}

function reminderItem(reminder: Reminder, now: Date): Omit<AgentBriefItem, 'attention'> | null {
  if (reminder.status !== 'scheduled') return null;
  const due = new Date(reminder.due_at);
  if (Number.isNaN(due.getTime())) return null;
  const dueNow = due.getTime() <= now.getTime();
  const withinDay = due.getTime() - now.getTime() <= 24 * 60 * 60 * 1000;
  if (!dueNow && !withinDay) return null;
  return {
    stableRef: `reminder:${reminder.id}`,
    category: dueNow ? 'attention_required' : 'upcoming_task',
    priority: dueNow ? 'high' : 'normal',
    urgency: dueNow ? 'due' : 'upcoming',
    timestamp: reminder.due_at,
    source: 'reminder',
    summary: dueNow ? `Reminder due: ${reminder.title.slice(0, 160)}.` : `Upcoming reminder: ${reminder.title.slice(0, 160)}.`,
    action: { id: 'open_reminder', label: 'Open reminder', canonicalAction: 'reminder.open', objectType: 'reminder', objectId: reminder.id, conversationId: reminder.source_conversation_id || undefined },
    approvalRequired: false,
    visibility: 'private',
  };
}

function taskItem(task: MicroTask, now: Date): Omit<AgentBriefItem, 'attention'> | null {
  const title = String(task.title || 'Task').slice(0, 160);
  const completed = CLOSED_TASKS.has(String(task.status));
  if (completed && !isRecentCompletion(task.updatedAt || task.createdAt, now)) return null;
  return {
    stableRef: `task:${task.id}`,
    category: completed ? 'completed' : 'pending',
    priority: completed ? 'low' : 'normal',
    urgency: 'none',
    timestamp: task.updatedAt || task.createdAt,
    source: 'task',
    summary: completed ? `Task complete: ${title}.` : `Task in progress: ${title}.`,
    action: { id: 'open_task', label: 'Open task', canonicalAction: 'task.open', objectType: 'task', objectId: String(task.id) },
    approvalRequired: false,
    visibility: 'private',
  };
}

function goalItem(goal: AgentGoal, now: Date): Omit<AgentBriefItem, 'attention'> | null {
  const summary = String(goal.summary || goal.objective || 'Kurukoo has an update on your objective.').slice(0, 280);
  const base = {
    stableRef: `agent_goal:${goal.id}`,
    timestamp: goal.completedAt || goal.updatedAt,
    source: 'agent_runtime' as const,
    visibility: 'private' as const,
    action: { id: 'open_agent_goal', label: 'Open objective', canonicalAction: 'agent.goal.review', objectType: 'agent_goal', objectId: goal.id, conversationId: goal.conversationId },
  };
  if (goal.status === 'completed') return isRecentCompletion(goal.completedAt || goal.updatedAt, now) ? { ...base, category: 'agent_work_completed', priority: 'normal', urgency: 'none', summary, approvalRequired: false } : null;
  if (goal.status === 'needs_user') return { ...base, category: 'waiting_for_user', priority: 'high', urgency: 'time_sensitive', summary, approvalRequired: true };
  if (goal.status === 'blocked' || goal.status === 'failed') return { ...base, category: 'attention_required', priority: 'high', urgency: 'time_sensitive', summary, approvalRequired: false };
  if (CLOSED_GOALS.has(goal.status)) return null;
  return { ...base, category: 'agent_work_in_progress', priority: 'normal', urgency: 'none', summary, approvalRequired: false };
}

function notificationCategory(notification: { title: string; body: string; canonical_action?: string; object_type?: string }): AgentBriefItemCategory {
  const fingerprint = `${notification.canonical_action || ''} ${notification.object_type || ''} ${notification.title} ${notification.body}`.toLowerCase();
  if (/emergency|safety|security|danger|fraud|scam/.test(fingerprint)) return 'safety_event';
  if (/provider|dispatch|fulfil|fulfill|arrival|quote/.test(fingerprint)) return 'provider_update';
  return 'important_notification';
}

function notificationItem(notification: { id: number; title: string; body: string; canonical_action?: string; object_type?: string; object_id?: string; conversation_id?: string; created_at: string }): Omit<AgentBriefItem, 'attention'> | null {
  const fingerprint = `${notification.title} ${notification.body}`.toLowerCase();
  if (/\b(?:promotion|sponsored)\b/.test(fingerprint)) return null;
  const category = notificationCategory(notification);
  const safety = category === 'safety_event';
  return {
    stableRef: `notification:${notification.id}`,
    category,
    priority: safety ? 'critical' : 'high',
    urgency: safety ? 'critical' : 'time_sensitive',
    timestamp: notification.created_at,
    source: 'notification',
    summary: `${notification.title.slice(0, 100)}${notification.body ? `: ${notification.body.slice(0, 220)}` : ''}`,
    action: { id: 'open_notification', label: 'Open update', canonicalAction: notification.canonical_action || 'notification.open', objectType: notification.object_type || 'notification', objectId: notification.object_id || String(notification.id), conversationId: notification.conversation_id },
    approvalRequired: false,
    visibility: 'private',
  };
}

function priorityWeight(priority: AgentBriefPriority): number {
  return { critical: 4, high: 3, normal: 2, low: 1 }[priority];
}

function urgencyWeight(urgency: AgentBriefUrgency): number {
  return { critical: 5, time_sensitive: 4, due: 3, upcoming: 2, none: 1 }[urgency];
}

function capabilityForItem(item: Omit<AgentBriefItem, 'attention'>): string {
  if (item.category === 'safety_event') return 'safety.alert';
  if (item.source === 'reminder') return 'reminder.open';
  if (item.source === 'agent_runtime') return 'agent.goal.review';
  if (item.category === 'provider_update' || item.source === 'request') return 'economic_request.open';
  return 'notification.open';
}

/**
 * Deterministically maps a canonical-state item to a delivery posture. It does
 * not authorize a state change; approval remains on the referenced owner.
 */
export function classifyAgentBriefAttention(item: Omit<AgentBriefItem, 'attention'>, preferences: AgentBriefPreferences): AgentBriefAttention {
  if (item.visibility !== 'private') return 'SILENT';
  if (preferences.notificationCategories && !preferences.notificationCategories.includes(item.category)) return 'SILENT';
  const policy = deriveInteractionPolicyForCapabilityName(capabilityForItem(item));
  const safetyImmediate = item.category === 'safety_event' && preferences.allowCriticalInterruption && policy.interruption === 'immediate';
  if (safetyImmediate) return 'IMMEDIATE';
  if (preferences.interruptionSensitivity === 'interruptive' && item.priority === 'critical' && preferences.allowCriticalInterruption) return 'IMMEDIATE';
  if (item.priority === 'high' || item.priority === 'critical' || item.urgency === 'due' || item.urgency === 'time_sensitive') return 'NOTIFY';
  if (item.category === 'agent_work_in_progress' && preferences.interruptionSensitivity === 'minimal') return 'SILENT';
  return 'NEXT_BRIEF';
}

export function deriveAgentPresence(items: AgentBriefItem[]): AgentPresence {
  if (items.some(item => item.attention === 'IMMEDIATE' || item.attention === 'NOTIFY')) return 'needs-attention';
  if (items.some(item => item.category === 'agent_work_in_progress')) return 'working';
  if (items.some(item => item.category === 'waiting_for_user' || item.category === 'pending')) return 'waiting';
  return 'idle';
}

function itemSort(a: AgentBriefItem, b: AgentBriefItem): number {
  const attention = { IMMEDIATE: 4, NOTIFY: 3, NEXT_BRIEF: 2, SILENT: 1 };
  const score = attention[b.attention] - attention[a.attention] || priorityWeight(b.priority) - priorityWeight(a.priority) || urgencyWeight(b.urgency) - urgencyWeight(a.urgency);
  if (score) return score;
  return String(b.timestamp || '').localeCompare(String(a.timestamp || '')) || a.stableRef.localeCompare(b.stableRef);
}

function count(items: AgentBriefItem[], category: AgentBriefItemCategory): number {
  return items.filter(item => item.category === category && item.attention !== 'SILENT').length;
}

export function formatAgentBrief(items: AgentBriefItem[], preferences: AgentBriefPreferences): string {
  const visible = items.filter(item => item.attention !== 'SILENT');
  const complete = count(visible, 'completed') + count(visible, 'agent_work_completed');
  const waiting = count(visible, 'waiting_for_user');
  const due = visible.filter(item => item.urgency === 'due').length;
  const important = visible.filter(item => item.attention === 'IMMEDIATE' || item.attention === 'NOTIFY').length;
  if (!visible.length) return 'Welcome back. Nothing needs your attention right now.';
  const parts: string[] = [];
  if (complete) parts.push(`${complete} ${complete === 1 ? 'item is' : 'items are'} complete`);
  if (waiting) parts.push(`${waiting} ${waiting === 1 ? 'request is' : 'requests are'} waiting for you`);
  if (due) parts.push(`${due} ${due === 1 ? 'task is' : 'tasks are'} due`);
  const accounted = complete + waiting + due;
  if (important && !accounted) parts.push(`${important} ${important === 1 ? 'item needs' : 'items need'} your attention`);
  if (!parts.length) parts.push(`${visible.length} ${visible.length === 1 ? 'item is' : 'items are'} ready for your review`);
  if (preferences.style === 'detailed') {
    const details = visible.slice(0, 4).map(item => item.summary).join(' ');
    return `Welcome back. ${parts.join(', ')}. ${details} Would you like me to go through them?`;
  }
  return `Welcome back. ${parts.join(', ')}. Would you like me to go through them?`;
}

function briefId(phone: string, items: AgentBriefItem[]): string {
  const material = items.filter(item => item.attention !== 'SILENT').map(item => `${item.stableRef}:${item.timestamp || ''}:${item.category}:${item.attention}`).join('|');
  return crypto.createHash('sha256').update(`${phone}|${material}`).digest('hex').slice(0, 24);
}

function hasEquivalentCanonicalItem(item: Omit<AgentBriefItem, 'attention'>, existing: Omit<AgentBriefItem, 'attention'>[]): boolean {
  const object = item.action?.objectType && item.action.objectId ? `${item.action.objectType}:${item.action.objectId}` : '';
  return Boolean(object && existing.some(candidate => candidate.action?.objectType === item.action?.objectType && candidate.action?.objectId === item.action?.objectId));
}

export async function buildAgentBrief(phone: string, options: BuildAgentBriefOptions = {}): Promise<AgentBrief> {
  const ownerPhone = String(phone || '').trim();
  if (!ownerPhone || ownerPhone.startsWith('anon_')) throw new Error('An authenticated owner is required for an Agent Brief');
  const now = options.now || new Date();
  const profile = await getProfile(ownerPhone, 'agentBrief');
  const preferences = resolveAgentBriefPreferences(profile?.preferences, options.preferences);
  const [requests, reminders, tasks, goals, notifications] = await Promise.all([
    listEconomicRequestsForPhone(ownerPhone, { includeClosed: true, limit: 30 }),
    listReminders(ownerPhone, false),
    listAssignedTasks(ownerPhone, true),
    listAgentGoals(ownerPhone, true),
    getInternalNotifications(ownerPhone, 30),
  ]);
  const canonical: Array<Omit<AgentBriefItem, 'attention'>> = [
    ...requests.map(request => requestItem(request, now)).filter((item): item is Omit<AgentBriefItem, 'attention'> => Boolean(item)),
    ...reminders.map(reminder => reminderItem(reminder, now)).filter((item): item is Omit<AgentBriefItem, 'attention'> => Boolean(item)),
    ...tasks.map(task => taskItem(task, now)).filter((item): item is Omit<AgentBriefItem, 'attention'> => Boolean(item)),
    ...goals.map(goal => goalItem(goal, now)).filter((item): item is Omit<AgentBriefItem, 'attention'> => Boolean(item)),
  ];
  for (const notification of notifications) {
    if (notification.status === 'read') continue;
    const candidate = notificationItem(notification);
    if (candidate && !hasEquivalentCanonicalItem(candidate, canonical)) canonical.push(candidate);
  }
  const deduplicated = [...new Map(canonical.map(item => [item.stableRef, item])).values()];
  const items = deduplicated.map(item => ({ ...item, attention: classifyAgentBriefAttention(item, preferences) })).sort(itemSort).slice(0, 20);
  const text = formatAgentBrief(items, preferences);
  const quietHours = isQuietHoursActive(preferences, now);
  const hasSpeakableItems = items.some(item => item.attention !== 'SILENT');
  const hasCriticalInterruption = items.some(item => item.attention === 'IMMEDIATE');
  return {
    id: briefId(ownerPhone, items),
    version: 1,
    ownerPhone,
    generatedAt: now.toISOString(),
    presence: deriveAgentPresence(items),
    items,
    presentation: {
      text,
      shouldSpeak: preferences.proactiveVoiceEnabled && hasSpeakableItems && (!quietHours || (hasCriticalInterruption && preferences.allowCriticalInterruption)),
      fallback: 'text',
    },
  };
}

async function ensureAgentBriefDeliverySchema(): Promise<void> {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS agent_brief_deliveries (phone TEXT NOT NULL, brief_id TEXT NOT NULL, channel TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(phone, brief_id, channel))`);
  db.run('CREATE INDEX IF NOT EXISTS idx_agent_brief_deliveries_owner ON agent_brief_deliveries(phone, created_at DESC)');
  saveDb();
}

/**
 * Uses the canonical notification queue only as a fallback. The tiny delivery
 * ledger supplies idempotency; it never stores generated wording as truth.
 */
export async function enqueueAgentBriefNotification(phone: string, brief: AgentBrief): Promise<{ queued: boolean; duplicate: boolean }> {
  if (brief.ownerPhone !== phone) throw new Error('Agent Brief owner mismatch');
  if (!brief.items.some(item => item.attention === 'IMMEDIATE' || item.attention === 'NOTIFY')) return { queued: false, duplicate: false };
  await ensureAgentBriefDeliverySchema();
  const db = await getDb();
  const existing = db.exec('SELECT 1 FROM agent_brief_deliveries WHERE phone=? AND brief_id=? AND channel=? LIMIT 1', [phone, brief.id, 'notification']);
  if (existing[0]?.values?.length) return { queued: false, duplicate: true };
  db.run('INSERT INTO agent_brief_deliveries(phone, brief_id, channel) VALUES(?, ?, ?)', [phone, brief.id, 'notification']);
  saveDb();
  const { sendFcmPush } = await import('./pushNotifications.js');
  await sendFcmPush(phone, 'Kurukoo update', brief.presentation.text, '/chat', {
    contextId: `brief:${brief.id}`,
    availableAction: 'review_brief',
    canonicalAction: 'agent.brief.review',
    objectType: 'agent_brief',
    objectId: brief.id,
    ownerScope: phone,
    idempotencyKey: `brief:${brief.id}`,
    surface: 'chat',
  }).catch(() => false);
  return { queued: true, duplicate: false };
}

export function isAgentBriefQuestion(message: string): boolean {
  return /^(?:what(?:'s| is) (?:important|going on)|anything important|what have i got going on|give me (?:my |an )?(?:brief|update)|(?:show|read) (?:my |the )?(?:brief|updates)|what needs my attention)\??$/i.test(String(message || '').trim());
}
