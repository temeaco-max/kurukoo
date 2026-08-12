import { getEconomicRequest } from './skillFlows.js';
import { buildWorkingContext } from './livingMemoryEngine.js';
import { listReminders } from './reminderService.js';
import { advanceStorefront } from './agenticStorefront.js';

export type AgentToolPermission = 'read' | 'low_risk_write' | 'coordination' | 'high_risk';
export type AgentToolRisk = 'read_only' | 'reversible' | 'user_confirmation_required' | 'high_risk';
export type AgentToolName = 'get_request_state' | 'get_memory_context' | 'get_reminders' | 'recheck_economic_request';

export interface AgentToolContext {
  phone: string;
  conversationId?: string;
  goalId: string;
}

export interface AgentToolResult {
  ok: boolean;
  tool: AgentToolName;
  permission: AgentToolPermission;
  data?: Record<string, unknown>;
  evidence?: string;
  message?: string;
}

export interface AgentToolDefinition { description: string; inputSchema: Record<string, string>; permission: AgentToolPermission; risk: AgentToolRisk; supportedContexts: Array<'text' | 'voice' | 'qr' | 'event'>; authorization: string; idempotency: 'none' | 'service_owned'; audit: 'goal_event'; autonomous: boolean; }
const definitions: Record<AgentToolName, AgentToolDefinition> = {
  get_request_state: { description: 'Read the current state of an Economic Request owned by the user.', inputSchema: { requestId: 'string' }, permission: 'read', risk: 'read_only', supportedContexts: ['text', 'voice', 'qr', 'event'], authorization: 'owned_request_read', idempotency: 'none', audit: 'goal_event', autonomous: true },
  get_memory_context: { description: 'Retrieve the minimum relevant bounded Living Memory context for an owned goal.', inputSchema: { query: 'string' }, permission: 'read', risk: 'read_only', supportedContexts: ['text', 'voice', 'qr', 'event'], authorization: 'owned_memory_read', idempotency: 'none', audit: 'goal_event', autonomous: true },
  get_reminders: { description: 'Read scheduled reminders owned by the current user.', inputSchema: {}, permission: 'read', risk: 'read_only', supportedContexts: ['text', 'voice', 'event'], authorization: 'owned_reminder_read', idempotency: 'none', audit: 'goal_event', autonomous: true },
  recheck_economic_request: { description: 'Safely re-evaluate an unresolved request through the canonical storefront only when explicitly enabled.', inputSchema: { requestId: 'string' }, permission: 'coordination', risk: 'reversible', supportedContexts: ['text', 'voice', 'event'], authorization: 'owned_unresolved_request_and_deployment_flag', idempotency: 'service_owned', audit: 'goal_event', autonomous: true },
};

export function listAgentTools(): Array<{ name: AgentToolName } & AgentToolDefinition> {
  return Object.entries(definitions).map(([name, definition]) => ({ name: name as AgentToolName, ...definition }));
}

function autonomousLowRiskEnabled(): boolean {
  return process.env.KURUKOO_AGENT_AUTONOMOUS_LOW_RISK === 'true';
}

export async function executeAgentTool(
  name: AgentToolName,
  args: Record<string, unknown>,
  context: AgentToolContext,
): Promise<AgentToolResult> {
  const definition = definitions[name];
  if (!definition || !context.phone || context.phone.startsWith('anon_')) {
    return { ok: false, tool: name, permission: definition?.permission || 'high_risk', message: 'This action is not available for the current identity.' };
  }

  if (name === 'get_request_state') {
    const requestId = typeof args.requestId === 'string' ? args.requestId : '';
    const request = requestId ? await getEconomicRequest(requestId) : null;
    if (!request || request.phone !== context.phone) return { ok: false, tool: name, permission: 'read', message: 'That request is unavailable.' };
    return { ok: true, tool: name, permission: 'read', data: { id: request.id, skill: request.skill, status: request.status, requirements: request.requirements || {}, providerPhone: request.providerPhone || null, quote: request.quote || null }, evidence: `economic_request:${request.id}:${request.status}` };
  }

  if (name === 'get_memory_context') {
    const query = typeof args.query === 'string' ? args.query.slice(0, 500) : '';
    const memory = await buildWorkingContext(context.phone, query || 'active goal', { threadId: context.conversationId, route: 'fasttext' });
    return { ok: true, tool: name, permission: 'read', data: { context: memory.context.slice(0, 2000), items: memory.selected.map(item => ({ tier: item.tier, source: item.source, text: item.text.slice(0, 220) })) }, evidence: `memory:${memory.selected.length}` };
  }

  if (name === 'get_reminders') {
    const reminders = await listReminders(context.phone);
    return { ok: true, tool: name, permission: 'read', data: { reminders: reminders.slice(0, 10).map(reminder => ({ id: reminder.id, title: reminder.title, dueAt: reminder.due_at, status: reminder.status })) }, evidence: `reminders:${reminders.length}` };
  }

  if (name === 'recheck_economic_request') {
    const requestId = typeof args.requestId === 'string' ? args.requestId : '';
    if (!autonomousLowRiskEnabled()) return { ok: false, tool: name, permission: 'coordination', message: 'Autonomous re-checking is disabled for this deployment.' };
    const request = requestId ? await getEconomicRequest(requestId) : null;
    if (!request || request.phone !== context.phone) return { ok: false, tool: name, permission: 'coordination', message: 'That request is unavailable.' };
    if (!['requested', 'awaiting_match', 'partially_matched'].includes(request.status)) return { ok: false, tool: name, permission: 'coordination', message: 'This request is not eligible for a safe re-check.' };
    const card = await advanceStorefront(context.phone, request.id, {});
    return { ok: true, tool: name, permission: 'coordination', data: { requestId: request.id, stage: card.stage, title: card.title, message: card.message, progress: card.progress }, evidence: `storefront:${request.id}:${card.stage}` };
  }

  return { ok: false, tool: name, permission: 'high_risk', message: 'This tool is not permitted.' };
}
