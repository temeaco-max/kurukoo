import crypto from 'node:crypto';
import { getCanonicalPersistenceMode } from './canonicalPersistence.js';
import { getCanonicalStore } from './canonicalStore.js';
import { listChatMessages } from './chatConversationService.js';
import {
  getCanonicalOperationDescriptor,
  listUniversalCapabilities,
  projectCapabilityResult,
  validateCapabilityProposal,
  type CapabilityActionProposal,
  type UniversalCapabilityResult,
} from './universalCapabilityProtocol.js';
import { createReminder, cancelReminder, getReminderForPhone } from './reminderService.js';
import { cancelAgentGoal, getAgentGoal, pauseAgentGoal, resumeAgentGoal } from './agentRuntime.js';
import { getInternalNotificationById, markNotificationRead } from './pushNotifications.js';
import { revokeMemoryFact } from './memoryProfile.js';
import { getPointsBalance, getPointsHistory } from './pointsEngine.js';
import { getEconomicRequest } from './skillFlows.js';
import { advanceStorefront } from './agenticStorefront.js';
import { deriveCapabilityInteractionPolicy } from './capabilityInteractionPolicyService.js';
import { getPreferredEmergencyNumber } from './emergencyDirectoryService.js';
import { getDiscoveryEntity } from './discoveryNetwork.js';
import { controlConnectedResource, getConnectedResource, viewConnectedResource } from './connectedResourceService.js';
import { getExecutionAdapter } from './capabilityExecutionAdapterBridgeV2.js';
import { resolveExecutableCapabilityPlan } from './capabilityFoundationIntegration.js';
import { getCapabilityRegistration } from './capabilityRegistry.js';

type ExecutorStatus = UniversalCapabilityResult['status'] | 'in_progress' | 'external_unavailable' | 'stale_context' | 'unauthorized' | 'invalid';

export interface CanonicalCapabilityExecutionInput extends CapabilityActionProposal {
  phone: string;
  conversationId?: string;
  confirmationGranted?: boolean;
  idempotencyKey?: string;
  channel?: string;
}

export interface CanonicalCapabilityExecutionResult extends Omit<UniversalCapabilityResult, 'status'> {
  status: ExecutorStatus;
  idempotencyKey: string;
  duplicate?: boolean;
}

async function ensureExecutionTable(): Promise<void> {
  const store = await getCanonicalStore();
  await store.run(`CREATE TABLE IF NOT EXISTS capability_action_runs (
    id TEXT PRIMARY KEY,
    idempotency_key TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    capability TEXT NOT NULL,
    action TEXT NOT NULL,
    canonical_object_id TEXT,
    result_json TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  await store.run('CREATE INDEX IF NOT EXISTS idx_capability_action_runs_phone ON capability_action_runs(phone, created_at)');
}

async function readIdempotentResult(phone: string, idempotencyKey: string): Promise<CanonicalCapabilityExecutionResult | null> {
  await ensureExecutionTable();
  const row = await (await getCanonicalStore()).one<{ result_json?: string }>('SELECT result_json FROM capability_action_runs WHERE idempotency_key = ? AND phone = ? LIMIT 1', [idempotencyKey, phone]);
  if (!row?.result_json) return null;
  try { return { ...JSON.parse(String(row.result_json)), duplicate: true }; } catch { return null; }
}

async function persistResult(input: CanonicalCapabilityExecutionInput, idempotencyKey: string, result: CanonicalCapabilityExecutionResult): Promise<void> {
  await ensureExecutionTable();
  const store = await getCanonicalStore();
  const sql = getCanonicalPersistenceMode() === 'postgres'
    ? 'INSERT INTO capability_action_runs(id, idempotency_key, phone, capability, action, canonical_object_id, result_json) VALUES(?,?,?,?,?,?,?) ON CONFLICT (idempotency_key) DO NOTHING'
    : 'INSERT OR IGNORE INTO capability_action_runs(id, idempotency_key, phone, capability, action, canonical_object_id, result_json) VALUES(?,?,?,?,?,?,?)';
  await store.run(sql, [
    crypto.randomUUID(), idempotencyKey, input.phone, input.capability, input.action, input.canonicalObjectId || null, JSON.stringify(result),
  ]);
}

function baseResult(input: CanonicalCapabilityExecutionInput, status: ExecutorStatus, message: string, extra: Partial<CanonicalCapabilityExecutionResult> = {}): CanonicalCapabilityExecutionResult {
  const normalized = input.capability.trim().toLowerCase();
  const registration = getCapabilityRegistration(normalized);
  let executablePlan: UniversalCapabilityResult['executablePlan'];
  try {
    if (registration?.descriptor.kind === 'operation') {
      executablePlan = {
        skill: normalized,
        registeredSkill: registration.descriptor.capability,
        composition: [registration.descriptor.capability],
        executableCandidates: [{
          capability: registration.descriptor.capability,
          actions: [...registration.descriptor.actions],
          owner: [...registration.descriptor.owner],
          risk: registration.descriptor.risk,
          activationState: registration.descriptor.activationState,
        }],
        unresolved: [],
      };
    } else {
      const skillName = normalized.startsWith('skill.') ? normalized.slice(6) : normalized;
      const plan = resolveExecutableCapabilityPlan(skillName);
      executablePlan = {
        skill: plan.skill,
        registeredSkill: `skill.${plan.skill}`,
        composition: plan.composition,
        executableCandidates: plan.executable.map(candidate => ({
          capability: candidate.capability,
          actions: candidate.actions,
          owner: candidate.owner,
          risk: candidate.risk,
          activationState: candidate.activationState,
        })),
        unresolved: plan.unresolved,
        cycle: plan.cycle,
      };
    }
  } catch {
    executablePlan = undefined;
  }
  return {
    status,
    capability: input.capability,
    action: input.action,
    contextId: input.contextId,
    canonicalObjectId: input.canonicalObjectId,
    canonicalFacts: {},
    evidenceLevel: 'none',
    externalActivation: 'locally_available',
    nextActions: [],
    retryRecovery: [],
    continuationContext: { conversationId: input.conversationId, contextId: input.contextId, canonicalObjectId: input.canonicalObjectId, ownerScope: input.phone },
    message,
    idempotencyKey: input.idempotencyKey || '',
    executablePlan,
    ...extra,
  };
}

function invalidResult(input: CanonicalCapabilityExecutionInput, status: ExecutorStatus, message: string, code: string): CanonicalCapabilityExecutionResult {
  return baseResult(input, status, message, { canonicalFacts: { validationCode: code }, retryRecovery: [{ action: 'clarify', label: 'Clarify the missing or invalid action details' }, { action: 'cancel', label: 'Cancel without changing state' }] });
}

function requiredArgumentMissing(descriptor: NonNullable<ReturnType<typeof getCanonicalOperationDescriptor>>, input: CanonicalCapabilityExecutionInput): string | null {
  for (const required of descriptor.context.requiredInputs) {
    const value = input.arguments?.[required.key];
    if (value === undefined || value === null || String(value).trim() === '') return required.key;
  }
  return null;
}

async function verifyExactOwner(input: CanonicalCapabilityExecutionInput): Promise<{ ok: boolean; object?: any; code?: string }> {
  if (!input.canonicalObjectId) return { ok: true };
  const capability = input.capability;
  if (capability === 'agent') {
    const object = await getAgentGoal(input.phone, input.canonicalObjectId);
    return object ? { ok: true, object } : { ok: false, code: 'foreign_or_missing_agent_goal' };
  }
  if (capability === 'economic_request' || capability === 'order' || capability === 'product' || capability === 'payment') {
    const object = await getEconomicRequest(input.canonicalObjectId);
    return object?.phone === input.phone ? { ok: true, object } : { ok: false, code: 'foreign_or_missing_economic_request' };
  }
  if (capability === 'notification') {
    const id = Number(input.canonicalObjectId);
    const object = Number.isSafeInteger(id) ? await getInternalNotificationById(id, input.phone) : null;
    return object ? { ok: true, object } : { ok: false, code: 'foreign_or_missing_notification' };
  }
  if (capability === 'reminder') {
    const row = await (await getCanonicalStore()).one('SELECT id FROM reminders WHERE id = ? AND phone = ? LIMIT 1', [input.canonicalObjectId, input.phone]);
    return row ? { ok: true, object: row } : { ok: false, code: 'foreign_or_missing_reminder' };
  }
  if (capability === 'memory') {
    const id = Number(input.canonicalObjectId);
    return Number.isSafeInteger(id) && id > 0 ? { ok: true, object: { factId: id } } : { ok: false, code: 'invalid_memory_fact_id' };
  }
  if (capability === 'execution' && input.canonicalObjectId) {
    const object = await getConnectedResource(input.phone, input.canonicalObjectId);
    return object ? { ok: true, object } : { ok: false, code: 'foreign_or_missing_connected_resource' };
  }
  return { ok: true };
}

async function dispatchCanonicalAction(input: CanonicalCapabilityExecutionInput, object?: any): Promise<CanonicalCapabilityExecutionResult> {
  const args = input.arguments || {};
  if (input.capability === 'safety' && input.action === 'emergency_dispatch') {
    const service = String(args.service || 'emergency').toLowerCase() as 'national' | 'police' | 'ambulance' | 'fire' | 'disaster';
    const country = String(args.country || 'NG').toUpperCase();
    const contact = getPreferredEmergencyNumber(country, ['police', 'ambulance', 'fire'].includes(service) ? service : 'national');
    if (!contact) return baseResult(input, 'external_unavailable', 'I could not verify an emergency contact for this location. Use the emergency number available from your local emergency service now.', { externalActivation: 'unavailable_external_dependency', retryRecovery: [{ action: 'clarify_location', label: 'Provide your country or location' }, { action: 'retry', label: 'Retry emergency routing' }] });
    return baseResult(input, 'externally_pending', `Emergency ${service} routing is ready to hand off to ${contact.name} on ${contact.number}. Live dialing/connection is not activated in this deployment, so Kurukoo has not claimed that a call or dispatch occurred.`, {
      canonicalFacts: { service, country, emergencyNumber: contact.number, contactName: contact.name, source: contact.source, verificationState: contact.verificationState, dialable: contact.dialable },
      evidenceLevel: 'canonical_service', externalActivation: 'repository_ready_external_activation',
      nextActions: [{ action: 'dial', label: `Call ${contact.number}` }, { action: 'open_voice', label: 'Open Kurukoo voice' }],
      retryRecovery: [{ action: 'retry', label: 'Retry emergency routing' }, { action: 'continue_chat', label: 'Continue here while you seek emergency help' }],
    });
  }
  if (input.capability === 'execution' && input.action === 'dispatch') {
    const resourceId = String(input.canonicalObjectId || args.resourceId || '').trim();
    const command = String(args.command || args.action || '').trim().toLowerCase();
    if (!resourceId) return invalidResult(input, 'needs_user', 'Tell me which connected device or resource to control.', 'connected_resource_required');
    const resource = await getConnectedResource(input.phone, resourceId);
    if (!resource) return invalidResult(input, 'unauthorized', 'That connected device is not available to this account.', 'foreign_or_missing_connected_resource');
    if (['status', 'observe', 'diagnose'].includes(command)) {
      const observedResource = { id: resource.id, kind: resource.kind, label: resource.label, vendor: resource.vendor || null, protocol: resource.protocol, capabilities: resource.capabilities, status: resource.status, lastSeenAt: resource.lastSeenAt };
      const lastState = resource.metadata.lastState;
      const hasObservation = lastState !== undefined;
      return baseResult(input, hasObservation ? 'completed' : 'externally_pending', hasObservation
        ? `I inspected the recorded state for ${resource.label}. The latest device observation is available for review; this is not a live connection test.`
        : `${resource.label} is active as a connected resource, but it has not exposed a device observation to Kurukoo yet. I have not claimed that it is online, healthy, or diagnosed.`, {
        canonicalFacts: { resource: observedResource, observedState: hasObservation ? lastState : null, observedAt: hasObservation ? String(resource.metadata.lastStateAt || resource.lastSeenAt) : null, liveObservation: false },
        evidenceLevel: 'canonical_service', externalActivation: 'repository_ready_external_activation',
        nextActions: hasObservation ? [{ action: 'continue_diagnosis', label: 'Continue diagnosis in Chat' }] : [{ action: 'configure_observation', label: 'Configure an authorised observation adapter' }],
      });
    }
    if (['view', 'inspect', 'show'].includes(command)) {
      const view = await viewConnectedResource(input.phone, resourceId);
      if (!view?.media.length) return baseResult(input, 'externally_pending', `The connected ${resource.kind} is registered, but it does not currently expose a view stream to Kurukoo.`, { canonicalFacts: { resource, viewAvailable: false }, evidenceLevel: 'canonical_service', externalActivation: 'repository_ready_external_activation', nextActions: [{ action: 'configure_view', label: 'Configure an authorised view/stream' }] });
      return baseResult(input, 'completed', `Here is the connected ${resource.label}.`, { canonicalFacts: { resource, viewAvailable: true, media: view.media }, evidenceLevel: 'canonical_service', externalActivation: 'repository_ready_external_activation', nextActions: [{ action: 'control', label: 'Control device' }, { action: 'close', label: 'Close view' }] });
    }
    if (!command) return invalidResult(input, 'needs_user', 'Tell me what you want Kurukoo to do with that connected device.', 'connected_command_required');
    const result = await controlConnectedResource({ phone: input.phone, id: resourceId, command, payload: args.payload == null ? undefined : String(args.payload), idempotencyKey: input.idempotencyKey });
    return baseResult(input, result.accepted ? 'externally_pending' : 'external_unavailable', result.accepted ? `The ${command} command was accepted by Kurukoo for ${resource.label}. Delivery to the connected device remains external and has not been claimed.` : `Kurukoo could not send the ${command} command to ${resource.label}.`, { canonicalFacts: { resource: result.resource, command, state: result.state, reason: result.reason, commandId: result.commandId }, evidenceLevel: 'canonical_service', externalActivation: result.accepted ? 'repository_ready_external_activation' : 'unavailable_external_dependency', nextActions: result.accepted ? [{ action: 'status', label: 'Check device status' }] : [{ action: 'retry', label: 'Retry command' }] });
  }
  if (input.capability === 'reminder' && input.action === 'create') {
    const reminder = await createReminder(input.phone, { title: String(args.title || ''), note: args.note ? String(args.note) : undefined, dueAt: String(args.dueAt || args.due_at || ''), recurrence: args.recurrence ? String(args.recurrence) : null, sourceConversationId: input.conversationId || null, resumeContextId: input.contextId || null });
    return baseResult(input, 'completed', `Reminder created for ${reminder.due_at}.`, { canonicalObjectId: reminder.id, canonicalFacts: { reminderId: reminder.id, dueAt: reminder.due_at, status: reminder.status }, evidenceLevel: 'canonical_service', nextActions: [{ action: 'open', label: 'Open reminder' }, { action: 'cancel', label: 'Cancel reminder', confirmationRequired: false }] });
  }
  if (input.capability === 'reminder' && input.action === 'cancel') {
    if (!input.canonicalObjectId) return invalidResult(input, 'invalid', 'A reminder ID is required to cancel.', 'reminder_id_required');
    const existing = await getReminderForPhone(input.phone, input.canonicalObjectId);
    if (!existing) return invalidResult(input, 'unauthorized', 'That reminder is not available to this account.', 'foreign_or_missing_reminder');
    if (existing.status !== 'scheduled') return invalidResult(input, 'stale_context', 'That exact reminder is no longer active. I did not substitute another reminder.', 'reminder_not_active');
    const cancelled = await cancelReminder(input.phone, input.canonicalObjectId);
    return cancelled ? baseResult(input, 'completed', 'The exact reminder was cancelled.', { canonicalFacts: { reminderId: input.canonicalObjectId, status: 'cancelled' }, evidenceLevel: 'canonical_service' }) : invalidResult(input, 'stale_context', 'That exact reminder is no longer active. I did not substitute another reminder.', 'reminder_not_active');
  }
  if (input.capability === 'agent' && ['pause', 'resume', 'cancel'].includes(input.action)) {
    const goal = input.action === 'pause' ? await pauseAgentGoal(input.phone, input.canonicalObjectId!) : input.action === 'resume' ? await resumeAgentGoal(input.phone, input.canonicalObjectId!) : await cancelAgentGoal(input.phone, input.canonicalObjectId!);
    return goal ? baseResult(input, 'completed', `The exact agent goal was ${input.action}d.`, { canonicalFacts: { goalId: goal.id, status: goal.status, objective: goal.objective }, evidenceLevel: 'canonical_service', canonicalObjectId: goal.id }) : invalidResult(input, 'stale_context', 'That exact agent goal is no longer available. I did not substitute another goal.', 'agent_goal_not_active');
  }
  if (input.capability === 'notification' && input.action === 'open') return baseResult(input, 'completed', 'The exact notification is available.', { canonicalFacts: { notification: object }, evidenceLevel: 'canonical_service' });
  if (input.capability === 'notification' && input.action === 'dismiss') {
    const dismissed = await markNotificationRead(Number(input.canonicalObjectId), input.phone);
    return dismissed ? baseResult(input, 'completed', 'The exact notification was marked as read.', { canonicalFacts: { notificationId: input.canonicalObjectId, status: 'read' }, evidenceLevel: 'canonical_service' }) : invalidResult(input, 'stale_context', 'That exact notification is no longer available.', 'notification_not_active');
  }
  if (input.capability === 'memory' && input.action === 'forget') {
    const outcome = await revokeMemoryFact(input.phone, Number(input.canonicalObjectId));
    return outcome.revoked ? baseResult(input, 'completed', 'The exact memory fact was revoked from active retrieval.', { canonicalFacts: { factId: input.canonicalObjectId, revoked: true }, evidenceLevel: 'canonical_service' }) : invalidResult(input, 'stale_context', 'That exact memory fact was not available for revocation.', 'memory_fact_not_found');
  }
  if (input.capability === 'points' && ['inspect', 'status', 'history'].includes(input.action)) {
    const balance = await getPointsBalance(input.phone);
    const history = input.action === 'history' ? await getPointsHistory(input.phone, 25) : undefined;
    return baseResult(input, 'completed', input.action === 'history' ? `You have ${balance} Kurukoo Points. I’ve also retrieved your recent Points activity.` : `You have ${balance} Kurukoo Points.`, { canonicalFacts: { pointsBalance: balance, history }, evidenceLevel: 'canonical_service', nextActions: [{ action: 'history', label: 'View Points history' }] });
  }
  if (input.capability === 'subscription' && ['inspect', 'status'].includes(input.action)) {
    const store = await getCanonicalStore();
    const profile = await store.one<any>('SELECT subscription_tier, country, updated_at FROM memory_profiles WHERE phone = ? LIMIT 1', [input.phone]);
    const provider = await store.one<any>('SELECT tier, status, next_billing_date, leads_this_month FROM provider_subscriptions WHERE phone = ? LIMIT 1', [input.phone]);
    const subscription = { tier: profile?.subscription_tier ? String(profile.subscription_tier) : 'Base', country: profile?.country ? String(profile.country) : undefined, updatedAt: profile?.updated_at ? String(profile.updated_at) : undefined, providerTier: provider?.tier ? String(provider.tier) : undefined, providerStatus: provider?.status ? String(provider.status) : undefined, nextBillingDate: provider?.next_billing_date ? String(provider.next_billing_date) : undefined, leadsThisMonth: provider?.leads_this_month == null ? undefined : Number(provider.leads_this_month) }; return baseResult(input, 'completed', `Your current Kurukoo subscription is ${subscription.tier}.`, { canonicalFacts: { subscription }, evidenceLevel: 'canonical_service', nextActions: [{ action: 'change', label: 'Change subscription' }] });
  }
  if (input.capability === 'payment' && ['inspect', 'status'].includes(input.action)) {
    const requestId = String(input.canonicalObjectId || args.economicRequestId || '').trim();
    if (!requestId) return invalidResult(input, 'needs_user', 'Tell me which request payment status you want me to inspect.', 'economic_request_required');
    const request = await getEconomicRequest(requestId);
    if (!request || request.phone !== input.phone) return invalidResult(input, 'unauthorized', 'That payment context is not available to this account.', 'foreign_or_missing_economic_request');
    return baseResult(input, 'completed', `Payment state for this request is ${request.status}.`, { canonicalFacts: { economicRequestId: request.id, requestStatus: request.status, quote: request.quote || null, fulfillment: request.fulfillment || null }, evidenceLevel: 'canonical_service', nextActions: request.status === 'quoted' || request.status === 'awaiting_confirmation' ? [{ action: 'pay', label: 'Continue to payment' }] : [] });
  }
  if (input.capability === 'order' && ['inspect', 'status'].includes(input.action)) {
    const requestId = String(input.canonicalObjectId || args.economicRequestId || '').trim();
    if (!requestId) return invalidResult(input, 'needs_user', 'Tell me which order you want me to inspect.', 'economic_request_required');
    const request = await getEconomicRequest(requestId);
    if (!request || request.phone !== input.phone) return invalidResult(input, 'unauthorized', 'That order is not available to this account.', 'foreign_or_missing_order');
    return baseResult(input, 'completed', `That order/request is currently ${request.status}.`, { canonicalFacts: { economicRequestId: request.id, status: request.status, requirements: request.requirements || {}, quote: request.quote || null, fulfillment: request.fulfillment || null }, evidenceLevel: 'canonical_service' });
  }
  if (input.capability === 'channel' && ['inspect', 'status'].includes(input.action)) {
    const names = ['web', 'whatsapp', 'telegram', 'sms', 'ussd', 'email', 'ivr'];
    const requested = String(args.channel || input.canonicalObjectId || '').trim().toLowerCase();
    const channels = (requested ? names.filter(name => name === requested) : names).map(name => ({ channel: name, nativeChat: name === 'web', externalDelivery: name !== 'web' }));
    return baseResult(input, 'completed', requested ? `${requested} channel is registered with Kurukoo.` : 'I checked the channel adapters available to Kurukoo.', { canonicalFacts: { channels }, evidenceLevel: 'canonical_service' });
  }
  if (input.capability === 'discovery' && ['inspect', 'open', 'status'].includes(input.action)) {
    const entityId = String(input.canonicalObjectId || args.entityId || '').trim();
    if (!entityId) return invalidResult(input, 'needs_user', 'Tell me which discovery result you want to inspect.', 'discovery_entity_required');
    const entity = await getDiscoveryEntity(entityId);
    if (!entity) return invalidResult(input, 'stale_context', 'That exact discovery result is no longer available, so I did not substitute another result.', 'discovery_entity_not_found');
    return baseResult(input, 'completed', `${entity.name} is currently recorded as ${entity.lifecycle}.`, { canonicalFacts: { entity }, evidenceLevel: entity.evidenceLevel === 'verified_state' ? 'verified_external_evidence' : 'canonical_service', nextActions: entity.available ? [{ action: 'select', label: 'Use this discovery result' }] : [{ action: 'refresh', label: 'Refresh discovery' }] });
  }
  const adapter = getExecutionAdapter(input.capability);
  const execute = adapter?.execute;
  if (execute && adapter.actions.includes(input.action)) {
    const result = await execute({ phone: input.phone, conversationId: input.conversationId, contextId: input.contextId, capability: input.capability, action: input.action, canonicalObjectId: input.canonicalObjectId, arguments: args, confirmationGranted: input.confirmationGranted, idempotencyKey: input.idempotencyKey || crypto.randomUUID(), ownerObject: object });
    if (result) return baseResult(input, result.status as ExecutorStatus, result.message, result);
  }
  if (input.capability === 'agent' && input.action === 'create') {
    const objective = String(args.objective || args.goal || '').trim();
    if (!objective) return invalidResult(input, 'needs_user', 'Tell me what you want Kurukoo to keep working on.', 'agent_objective_required');
  }
  return baseResult(input, 'external_unavailable', 'This capability is registered but does not yet have a canonical execution adapter in this deployment.', { externalActivation: 'repository_ready_external_activation', retryRecovery: [{ action: 'wait', label: 'Wait for the required capability adapter to become available' }, { action: 'continue_chat', label: 'Continue in Chat without executing it' }] });
}

export async function executeCanonicalCapabilityProposal(input: CanonicalCapabilityExecutionInput): Promise<CanonicalCapabilityExecutionResult> {
  const idempotencyKey = input.idempotencyKey || crypto.createHash('sha256').update(JSON.stringify({ phone: input.phone, capability: input.capability, action: input.action, contextId: input.contextId || '', canonicalObjectId: input.canonicalObjectId || '', arguments: input.arguments || {} })).digest('hex');
  const existing = await readIdempotentResult(input.phone, idempotencyKey);
  if (existing) return existing;
  const descriptor = getCanonicalOperationDescriptor(input.capability);
  const owner = await verifyExactOwner(input);
  const policy = descriptor ? deriveCapabilityInteractionPolicy(descriptor) : undefined;
  if (input.phone.startsWith('anon_') && !descriptor?.permissions.includes('guest_initial_help')) {
    const result = invalidResult(input, 'unauthorized', 'Please verify your identity before using this capability. Emergency initial help remains available without registration.', 'guest_access_required');
    await persistResult(input, idempotencyKey, result);
    return result;
  }
  const confirmationRequired = input.confirmationRequired ?? policy?.confirmation === 'explicit';
  const validation = validateCapabilityProposal({ ...input, confirmationRequired }, descriptor, { ownerVerified: true, objectVerified: owner.ok, stale: false, confirmationGranted: Boolean(input.confirmationGranted) });
  if (!validation.valid) {
    const result = invalidResult(input, validation.code === 'missing_confirmation' ? 'confirmation_required' : validation.code === 'foreign_context' ? 'unauthorized' : validation.code === 'stale_context' ? 'stale_context' : 'invalid', validation.message || 'This capability action could not be accepted.', validation.code || 'invalid');
    await persistResult(input, idempotencyKey, result);
    return result;
  }
  const result = await dispatchCanonicalAction(input, owner.object);
  result.idempotencyKey = idempotencyKey;
  await persistResult(input, idempotencyKey, result);
  return result;
}

export async function executeCanonicalCapabilityProposalOnce(input: CanonicalCapabilityExecutionInput): Promise<CanonicalCapabilityExecutionResult> {
  return executeCanonicalCapabilityProposal(input);
}
