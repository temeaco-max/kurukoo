import { getEconomicRequest } from './skillFlows.js';
import { buildWorkingContext } from './livingMemoryEngine.js';
import { listReminders } from './reminderService.js';
import { advanceFulfilmentStorefront as advanceStorefront } from './fulfilmentStorefrontBridge.js';
import { listConnectedResources, viewConnectedResource } from './connectedResourceService.js';
import { ensureCapabilityFoundation } from './capabilityFoundation.js';
import { getCapabilityActionContract, getCapabilityRegistration, listCapabilityRegistrations, resolveCapabilityAction, resolveCapabilityComposition } from './capabilityRegistry.js';
import { getCanonicalIdentityContext } from './memoryProfile.js';
import { syncAgentGoalFromCapabilityResult } from './agentCapabilityOutcomeService.js';
import { recordAgentExecutionTrace, ensureAgentExecutionTraceSchema } from './agentExecutionTrace.js';

export type AgentToolPermission = 'read' | 'low_risk_write' | 'coordination' | 'high_risk';
export type AgentToolRisk = 'read_only' | 'reversible' | 'user_confirmation_required' | 'high_risk';
export type AgentToolName = 'get_request_state' | 'get_memory_context' | 'get_reminders' | 'get_connected_resources' | 'view_connected_resource' | 'inspect_capability_plan' | 'list_capabilities' | 'execute_capability' | 'recheck_economic_request' | 'fulfilment_get' | 'fulfilment_update_requirements' | 'fulfilment_find_offers' | 'fulfilment_list_offers' | 'fulfilment_select_offer' | 'fulfilment_create_inquiry' | 'fulfilment_get_inquiry' | 'fulfilment_resume';

export interface AgentToolContext { phone: string; conversationId?: string; goalId: string; /** Execution-budget context supplied by the canonical runtime; recorded in trace metadata. */ budget?: { allowed: boolean; reason?: string; actionsUsed: number; retriesUsed: number; remainingActions: number }; }
export interface AgentToolResult { ok: boolean; tool: AgentToolName; permission: AgentToolPermission; data?: Record<string, unknown>; evidence?: string; message?: string; }
export interface AgentToolDefinition { description: string; inputSchema: Record<string, string>; permission: AgentToolPermission; risk: AgentToolRisk; supportedContexts: Array<'text' | 'voice' | 'qr' | 'event'>; authorization: string; idempotency: 'none' | 'service_owned'; audit: 'goal_event'; autonomous: boolean; }

const definitions: Record<AgentToolName, AgentToolDefinition> = {
  get_request_state: { description: 'Read the current state of an Economic Request owned by the user.', inputSchema: { requestId: 'string' }, permission: 'read', risk: 'read_only', supportedContexts: ['text', 'voice', 'qr', 'event'], authorization: 'owned_request_read', idempotency: 'none', audit: 'goal_event', autonomous: true },
  get_memory_context: { description: 'Retrieve the minimum relevant bounded Living Memory context for an owned goal, including canonical user identity when available.', inputSchema: { query: 'string' }, permission: 'read', risk: 'read_only', supportedContexts: ['text', 'voice', 'qr', 'event'], authorization: 'owned_memory_read', idempotency: 'none', audit: 'goal_event', autonomous: true },
  get_reminders: { description: 'Read scheduled reminders owned by the current user.', inputSchema: {}, permission: 'read', risk: 'read_only', supportedContexts: ['text', 'voice', 'event'], authorization: 'owned_reminder_read', idempotency: 'none', audit: 'goal_event', autonomous: true },
  get_connected_resources: { description: 'Read the currently active connected phones, cameras, TVs, computers and IoT resources owned by the user, including their exposed capabilities.', inputSchema: {}, permission: 'read', risk: 'read_only', supportedContexts: ['text', 'voice', 'qr', 'event'], authorization: 'owned_connected_resource_read', idempotency: 'none', audit: 'goal_event', autonomous: true },
  view_connected_resource: { description: 'View authorised media exposed by one exact active connected resource, such as a CCTV/camera stream, without changing device state.', inputSchema: { resourceId: 'string' }, permission: 'read', risk: 'read_only', supportedContexts: ['text', 'voice', 'qr', 'event'], authorization: 'owned_connected_resource_view', idempotency: 'none', audit: 'goal_event', autonomous: true },
  inspect_capability_plan: { description: 'Inspect the canonical capability composition for a skill/capability without executing it.', inputSchema: { skill: 'string' }, permission: 'read', risk: 'read_only', supportedContexts: ['text', 'voice', 'qr', 'event'], authorization: 'canonical_capability_read', idempotency: 'none', audit: 'goal_event', autonomous: true },
  list_capabilities: { description: 'Discover the canonical capabilities available to this Kurukoo runtime, including their actions, risk and activation state. This is read-only and never authorizes an action.', inputSchema: { query: 'string' }, permission: 'read', risk: 'read_only', supportedContexts: ['text', 'voice', 'qr', 'event'], authorization: 'canonical_capability_catalog_read', idempotency: 'none', audit: 'goal_event', autonomous: true },
  execute_capability: { description: 'Invoke one exact capability action through the canonical executor. The executor remains authoritative for policy, identity, confirmation, idempotency and external activation.', inputSchema: { capability: 'string', action: 'string', contextId: 'string', canonicalObjectId: 'string', argumentsJson: 'json', confirmationGranted: 'boolean' }, permission: 'coordination', risk: 'user_confirmation_required', supportedContexts: ['text', 'voice', 'qr', 'event'], authorization: 'canonical_executor_policy', idempotency: 'service_owned', audit: 'goal_event', autonomous: true },
  recheck_economic_request: { description: 'Safely re-evaluate an unresolved request through the canonical storefront only when explicitly enabled.', inputSchema: { requestId: 'string' }, permission: 'coordination', risk: 'reversible', supportedContexts: ['text', 'voice', 'event'], authorization: 'owned_unresolved_request_and_deployment_flag', idempotency: 'service_owned', audit: 'goal_event', autonomous: true },
  fulfilment_get: { description: 'Read one exact owner-scoped canonical Fulfilment.', inputSchema: { fulfilmentId: 'string' }, permission: 'read', risk: 'read_only', supportedContexts: ['text', 'voice', 'qr', 'event'], authorization: 'owned_fulfilment_read', idempotency: 'none', audit: 'goal_event', autonomous: true },
  fulfilment_update_requirements: { description: 'Update collected requirements on one exact Fulfilment through the canonical owner.', inputSchema: { fulfilmentId: 'string', patchJson: 'json' }, permission: 'coordination', risk: 'reversible', supportedContexts: ['text', 'voice', 'qr', 'event'], authorization: 'owned_fulfilment_update', idempotency: 'service_owned', audit: 'goal_event', autonomous: true },
  fulfilment_find_offers: { description: 'List current canonical offers for one exact Fulfilment without contacting providers directly.', inputSchema: { fulfilmentId: 'string' }, permission: 'read', risk: 'read_only', supportedContexts: ['text', 'voice', 'qr', 'event'], authorization: 'owned_fulfilment_read', idempotency: 'none', audit: 'goal_event', autonomous: true },
  fulfilment_list_offers: { description: 'List current non-expired canonical offers for one exact Fulfilment.', inputSchema: { fulfilmentId: 'string' }, permission: 'read', risk: 'read_only', supportedContexts: ['text', 'voice', 'qr', 'event'], authorization: 'owned_fulfilment_read', idempotency: 'none', audit: 'goal_event', autonomous: true },
  fulfilment_select_offer: { description: 'Select one exact current offer through the canonical Fulfilment owner; this does not confirm execution.', inputSchema: { fulfilmentId: 'string', offerId: 'string' }, permission: 'coordination', risk: 'reversible', supportedContexts: ['text', 'voice', 'qr', 'event'], authorization: 'owned_fulfilment_offer_selection', idempotency: 'service_owned', audit: 'goal_event', autonomous: true },
  fulfilment_create_inquiry: { description: 'Prepare one transport-neutral provider inquiry through the canonical Fulfilment owner.', inputSchema: { fulfilmentId: 'string', providerId: 'string', question: 'string' }, permission: 'coordination', risk: 'reversible', supportedContexts: ['text', 'voice', 'qr', 'event'], authorization: 'owned_fulfilment_inquiry_preparation', idempotency: 'service_owned', audit: 'goal_event', autonomous: true },
  fulfilment_get_inquiry: { description: 'Read provider inquiry state for one exact owner-scoped Fulfilment.', inputSchema: { fulfilmentId: 'string' }, permission: 'read', risk: 'read_only', supportedContexts: ['text', 'voice', 'qr', 'event'], authorization: 'owned_fulfilment_read', idempotency: 'none', audit: 'goal_event', autonomous: true },
  fulfilment_resume: { description: 'Resume inspection of one exact canonical Fulfilment without creating a duplicate.', inputSchema: { fulfilmentId: 'string' }, permission: 'read', risk: 'read_only', supportedContexts: ['text', 'voice', 'qr', 'event'], authorization: 'owned_fulfilment_read', idempotency: 'none', audit: 'goal_event', autonomous: true },
};

export function listAgentTools(): Array<{ name: AgentToolName } & AgentToolDefinition> {
  return Object.entries(definitions).map(([name, definition]) => ({ name: name as AgentToolName, ...definition }));
}

function autonomousLowRiskEnabled(): boolean { return process.env.KURUKOO_AGENT_AUTONOMOUS_LOW_RISK === 'true'; }

async function traceToolEvent(context: AgentToolContext, kind: 'tool_requested' | 'tool_succeeded' | 'tool_failed', name: AgentToolName, fields: { status?: string; reason?: string; evidence?: string; metadata?: Record<string, unknown> }): Promise<void> {
  if (!context.phone || context.phone.startsWith('anon_')) return;
  try {
    await ensureAgentExecutionTraceSchema();
    await recordAgentExecutionTrace({
      ownerPhone: context.phone,
      goalId: context.goalId,
      conversationId: context.conversationId,
      kind,
      actor: 'agent_tool_registry',
      tool: name,
      status: fields.status,
      reason: fields.reason,
      evidence: fields.evidence,
      metadata: fields.metadata,
      idempotencyKey: `tool:${context.goalId}:${name}:${kind}:${fields.status || ''}`,
    });
  } catch (e) {
    console.warn?.('[agentToolRegistry] trace write failed:', String(e instanceof Error ? e.message : e));
  }
}

/**
 * Canonical tool execution entry point. The Tool Registry remains the ONLY
 * execution owner (permission, risk, authorization, idempotency, execution,
 * audit). This wrapper enriches each invocation with durable execution-trace
 * events and the caller's budget context without replacing any safeguard.
 */
export async function executeAgentTool(name: AgentToolName, args: Record<string, unknown>, context: AgentToolContext): Promise<AgentToolResult> {
  await traceToolEvent(context, 'tool_requested', name, {
    status: context.budget?.allowed === false ? 'budget_denied' : 'requested',
    reason: context.budget?.allowed === false ? context.budget?.reason : undefined,
    metadata: context.budget ? { budget: context.budget } : undefined,
  });
  if (context.budget && context.budget.allowed === false) {
    return { ok: false, tool: name, permission: definitions[name]?.permission || 'high_risk', message: 'The agent execution budget for this objective is exhausted.' };
  }
  try {
    const result = await executeAgentToolInternal(name, args, context);
    await traceToolEvent(context, result.ok ? 'tool_succeeded' : 'tool_failed', name, {
      status: result.ok ? 'success' : 'denied',
      reason: result.message,
      evidence: result.evidence,
    });
    return result;
  } catch (e) {
    await traceToolEvent(context, 'tool_failed', name, { status: 'error', reason: String(e instanceof Error ? e.message : e) });
    throw e;
  }
}

async function executeAgentToolInternal(name: AgentToolName, args: Record<string, unknown>, context: AgentToolContext): Promise<AgentToolResult> {
  const definition = definitions[name];
  if (!definition || !context.phone || context.phone.startsWith('anon_')) return { ok: false, tool: name, permission: definition?.permission || 'high_risk', message: 'This action is not available for the current identity.' };
  if (name.startsWith('fulfilment_')) {
    const fulfilmentId = typeof args.fulfilmentId === 'string' ? args.fulfilmentId.trim() : '';
    if (!fulfilmentId) return { ok: false, tool: name, permission: definitions[name].permission, message: 'A canonical fulfilment ID is required.' };
    const actionByTool: Partial<Record<AgentToolName, string>> = {
      fulfilment_get: 'get', fulfilment_update_requirements: 'update_requirements', fulfilment_find_offers: 'find_offers', fulfilment_list_offers: 'list_offers', fulfilment_select_offer: 'select_offer', fulfilment_create_inquiry: 'create_inquiry', fulfilment_get_inquiry: 'get_inquiry', fulfilment_resume: 'resume',
    };
    const action = actionByTool[name];
    if (!action) return { ok: false, tool: name, permission: definitions[name].permission, message: 'This fulfilment operation is unavailable.' };
    let patch: Record<string, unknown> | undefined;
    if (name === 'fulfilment_update_requirements') {
      try { const candidate = typeof args.patchJson === 'string' ? JSON.parse(args.patchJson) : args.patchJson; if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('invalid'); patch = candidate as Record<string, unknown>; } catch { return { ok: false, tool: name, permission: definitions[name].permission, message: 'patchJson must be a JSON object.' }; }
    }
    const { executeCanonicalCapabilityProposal } = await import('./canonicalCapabilityExecutor.js');
    const result = await executeCanonicalCapabilityProposal({ capability: 'fulfilment', action, canonicalObjectId: fulfilmentId, contextId: context.conversationId || context.goalId, arguments: { ...(patch ? { patch } : {}), ...(typeof args.offerId === 'string' ? { offerId: args.offerId } : {}), ...(typeof args.providerId === 'string' ? { providerId: args.providerId } : {}), ...(typeof args.providerPhone === 'string' ? { providerPhone: args.providerPhone } : {}), ...(typeof args.providerName === 'string' ? { providerName: args.providerName } : {}), ...(typeof args.question === 'string' ? { question: args.question } : {}) }, phone: context.phone, conversationId: context.conversationId, channel: 'agent', idempotencyKey: `agent:${context.goalId}:${name}:${fulfilmentId}:${typeof args.offerId === 'string' ? args.offerId : ''}` });
    return { ok: !['failed', 'blocked', 'unauthorized', 'invalid'].includes(result.status), tool: name, permission: definitions[name].permission, data: { status: result.status, canonicalObjectId: result.canonicalObjectId, facts: result.canonicalFacts, nextActions: result.nextActions }, evidence: `canonical_fulfilment:${fulfilmentId}:${action}:${result.status}`, message: result.message };
  }
  if (name === 'get_request_state') { const requestId = typeof args.requestId === 'string' ? args.requestId : ''; const request = requestId ? await getEconomicRequest(requestId) : null; if (!request || request.phone !== context.phone) return { ok: false, tool: name, permission: 'read', message: 'That request is unavailable.' }; return { ok: true, tool: name, permission: 'read', data: { id: request.id, skill: request.skill, status: request.status, requirements: request.requirements || {}, providerPhone: request.providerPhone || null, quote: request.quote || null }, evidence: `economic_request:${request.id}:${request.status}` }; }
  if (name === 'get_memory_context') { const query = typeof args.query === 'string' ? args.query.slice(0, 500) : ''; const [memory, identity] = await Promise.all([buildWorkingContext(context.phone, query || 'active goal', { threadId: context.conversationId, route: 'fasttext' }), getCanonicalIdentityContext(context.phone, 'agentToolRegistry')]); return { ok: true, tool: name, permission: 'read', data: { context: memory.context.slice(0, 2000), items: memory.selected.map(item => ({ tier: item.tier, source: item.source, text: item.text.slice(0, 220) })), identity: { hasProfile: identity.hasProfile, hasName: identity.hasName, name: identity.name, nameProvenance: identity.nameProvenance, location: identity.location, country: identity.country, preferences: identity.preferences }, memoryFacts: identity.stableFacts }, evidence: `memory:${memory.selected.length}:facts:${identity.stableFacts.length}` }; }
  if (name === 'get_reminders') { const reminders = await listReminders(context.phone); return { ok: true, tool: name, permission: 'read', data: { reminders: reminders.slice(0, 10).map(reminder => ({ id: reminder.id, title: reminder.title, dueAt: reminder.due_at, status: reminder.status })) }, evidence: `reminders:${reminders.length}` }; }
  if (name === 'get_connected_resources') { const resources = await listConnectedResources(context.phone); const active = resources.filter(resource => resource.status === 'active'); return { ok: true, tool: name, permission: 'read', data: { resources: active.slice(0, 24).map(resource => ({ id: resource.id, kind: resource.kind, label: resource.label, vendor: resource.vendor || null, protocol: resource.protocol, capabilities: resource.capabilities, hasView: Boolean(resource.viewUrl || resource.streamUrl), lastSeenAt: resource.lastSeenAt })) }, evidence: `connected_resources:${active.length}` }; }
  if (name === 'view_connected_resource') { const resourceId = typeof args.resourceId === 'string' ? args.resourceId.trim() : ''; if (!resourceId) return { ok: false, tool: name, permission: 'read', message: 'A connected resource id is required.' }; const view = await viewConnectedResource(context.phone, resourceId); if (!view) return { ok: false, tool: name, permission: 'read', message: 'That connected resource is unavailable or not active.' }; return { ok: true, tool: name, permission: 'read', data: { resource: { id: view.resource.id, kind: view.resource.kind, label: view.resource.label, vendor: view.resource.vendor || null }, media: view.media }, evidence: `connected_resource_view:${view.resource.id}:${view.media.length}` }; }
  if (name === 'inspect_capability_plan') { const skill = typeof args.skill === 'string' ? args.skill.trim().toLowerCase() : ''; if (!skill) return { ok: false, tool: name, permission: 'read', message: 'A skill or capability name is required.' }; ensureCapabilityFoundation(); const registration = getCapabilityRegistration(skill.startsWith('skill.') ? skill : `skill.${skill}`) || getCapabilityRegistration(skill); if (!registration) return { ok: false, tool: name, permission: 'read', message: 'That capability is not registered.' }; const composition = resolveCapabilityComposition([registration.descriptor.capability]); return { ok: composition.unresolved.length === 0 && !composition.cycle?.length, tool: name, permission: 'read', data: { requested: composition.requested, capabilities: composition.ordered.map(item => item.descriptor.capability), unresolved: composition.unresolved, cycle: composition.cycle || null }, evidence: `capability_plan:${registration.descriptor.capability}:${composition.ordered.length}` }; }
  if (name === 'list_capabilities') { const query = typeof args.query === 'string' ? args.query.trim().toLowerCase().slice(0, 120) : ''; ensureCapabilityFoundation(); const matches = listCapabilityRegistrations().filter(registration => { if (!query) return true; const descriptor = registration.descriptor; const actionMetadata = Object.entries(registration.actionMetadata || {}).map(([action, metadata]) => `${action} ${(metadata.aliases || []).join(' ')}`).join(' '); const haystack = [descriptor.capability, descriptor.family, descriptor.mode, descriptor.actions.join(' '), descriptor.owner.join(' '), actionMetadata].join(' ').toLowerCase(); return haystack.includes(query); }).slice(0, 64).map(registration => { const descriptor = registration.descriptor; return { capability: descriptor.capability, family: descriptor.family, kind: descriptor.kind, mode: descriptor.mode, actions: descriptor.actions, risk: descriptor.risk, activationState: descriptor.activationState, owner: descriptor.owner, aliases: registration.aliases || [], actionMetadata: registration.actionMetadata || {}, source: registration.source || 'core' }; }); return { ok: true, tool: name, permission: 'read', data: { query, count: matches.length, capabilities: matches }, evidence: `capability_catalog:${matches.length}` }; }
  if (name === 'execute_capability') {
    const capability = typeof args.capability === 'string' ? args.capability.trim() : '';
    const requestedAction = typeof args.action === 'string' ? args.action.trim() : '';
    if (!capability || !requestedAction) return { ok: false, tool: name, permission: 'coordination', message: 'A capability and action are required.' };
    let parsedArguments: Record<string, unknown> = {};
    if (typeof args.argumentsJson === 'string' && args.argumentsJson.trim()) { try { const candidate = JSON.parse(args.argumentsJson); if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) parsedArguments = candidate as Record<string, unknown>; else throw new Error('arguments must be an object'); } catch { return { ok: false, tool: name, permission: 'coordination', message: 'argumentsJson must be valid JSON for an object.' }; }
    }
    ensureCapabilityFoundation();
    const registration = getCapabilityRegistration(capability);
    if (!registration) return { ok: false, tool: name, permission: 'coordination', message: 'That capability is not registered in the canonical fabric.' };
    const action = resolveCapabilityAction(capability, requestedAction);
    if (!action) return { ok: false, tool: name, permission: 'coordination', message: `The canonical capability does not expose a compatible ${requestedAction} action.` };
    const actionContract = getCapabilityActionContract(capability, action);
    if (!actionContract) return { ok: false, tool: name, permission: 'coordination', message: 'That action has no canonical action contract.' };
    const readOnly = actionContract.risk === 'read_only';
    const confirmationRequired = actionContract.confirmationRequired || actionContract.risk === 'high_risk';
    if (!readOnly && (!autonomousLowRiskEnabled() || confirmationRequired) && args.confirmationGranted !== true) return { ok: false, tool: name, permission: 'coordination', message: confirmationRequired ? 'This capability action requires explicit user confirmation.' : 'Autonomous low-risk capability execution is disabled for this deployment.' };
    const { executeCanonicalCapabilityProposal } = await import('./canonicalCapabilityExecutor.js');
    const result = await executeCanonicalCapabilityProposal({ capability, action, contextId: typeof args.contextId === 'string' ? args.contextId : context.goalId, canonicalObjectId: typeof args.canonicalObjectId === 'string' ? args.canonicalObjectId : undefined, arguments: parsedArguments, confirmationGranted: args.confirmationGranted === true, phone: context.phone, conversationId: context.conversationId, channel: 'agent' });
    await syncAgentGoalFromCapabilityResult({ phone: context.phone, goalId: context.goalId, capability, action, idempotencyKey: result.idempotencyKey, outcome: { status: result.status, capability: result.capability, action: result.action, canonicalObjectId: result.canonicalObjectId, continuationContext: result.continuationContext, nextActions: result.nextActions, canonicalFacts: result.canonicalFacts, message: result.message, evidence: `canonical_capability:${capability}:${action}:${result.status}`, executablePlan: result.executablePlan } });
    return { ok: result.status !== 'failed' && result.status !== 'blocked' && result.status !== 'unauthorized' && result.status !== 'invalid', tool: name, permission: 'coordination', data: { status: result.status, capability: result.capability, action: result.action, canonicalObjectId: result.canonicalObjectId, nextActions: result.nextActions, canonicalFacts: result.canonicalFacts, continuationContext: result.continuationContext, executablePlan: result.executablePlan }, evidence: `canonical_capability:${capability}:${action}:${result.status}`, message: result.message };
  }
  if (name === 'recheck_economic_request') { const requestId = typeof args.requestId === 'string' ? args.requestId : ''; if (!autonomousLowRiskEnabled()) return { ok: false, tool: name, permission: 'coordination', message: 'Autonomous re-checking is disabled for this deployment.' }; const request = requestId ? await getEconomicRequest(requestId) : null; if (!request || request.phone !== context.phone) return { ok: false, tool: name, permission: 'coordination', message: 'That request is unavailable.' }; if (!['requested', 'awaiting_match', 'partially_matched'].includes(request.status)) return { ok: false, tool: name, permission: 'coordination', message: 'This request is not eligible for a safe re-check.' }; const card = await advanceStorefront(context.phone, request.id, {}); return { ok: true, tool: name, permission: 'coordination', data: { requestId: request.id, stage: card.stage, title: card.title, message: card.message, progress: card.progress }, evidence: `storefront:${request.id}:${card.stage}` }; }
  return { ok: false, tool: name, permission: 'high_risk', message: 'This tool is not permitted.' };
}
