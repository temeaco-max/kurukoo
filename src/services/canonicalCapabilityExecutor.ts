import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';
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
import { getCapabilityRegistration, getCapabilityActionContract } from './capabilityRegistry.js';
import { createProviderInquiry, getFulfilment, listOffers, listProviderInquiries, selectOffer, transitionFulfilment, updateFulfilmentRequirements } from './canonicalFulfilmentService.js';
import { getFulfilmentSkillBinding, resolveMissingFulfilmentInputs } from './fulfilmentSkillBindings.js';
import { getAirtimeOperation, prepareAirtimeOperation, purchaseAirtime } from './airtimeService.js';

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
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS capability_action_runs (
    id TEXT PRIMARY KEY,
    idempotency_key TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    capability TEXT NOT NULL,
    action TEXT NOT NULL,
    canonical_object_id TEXT,
    result_json TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_capability_action_runs_phone ON capability_action_runs(phone, created_at)');
}

async function readIdempotentResult(phone: string, idempotencyKey: string): Promise<CanonicalCapabilityExecutionResult | null> {
  await ensureExecutionTable();
  const db = await getDb();
  const stmt = db.prepare('SELECT result_json FROM capability_action_runs WHERE idempotency_key = ? AND phone = ? LIMIT 1');
  stmt.bind([idempotencyKey, phone]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  if (!row?.result_json) return null;
  try { return { ...JSON.parse(String(row.result_json)), duplicate: true }; } catch { return null; }
}

async function persistResult(input: CanonicalCapabilityExecutionInput, idempotencyKey: string, result: CanonicalCapabilityExecutionResult): Promise<void> {
  await ensureExecutionTable();
  const db = await getDb();
  db.run(`INSERT OR IGNORE INTO capability_action_runs(id, idempotency_key, phone, capability, action, canonical_object_id, result_json) VALUES(?,?,?,?,?,?,?)`, [
    crypto.randomUUID(), idempotencyKey, input.phone, input.capability, input.action, input.canonicalObjectId || null, JSON.stringify(result),
  ]);
  saveDb();
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
    const db = await getDb();
    const result = db.exec('SELECT * FROM reminders WHERE id = ? AND phone = ? LIMIT 1', [input.canonicalObjectId, input.phone]);
    const row = result[0]?.values?.[0];
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
  if (capability === 'airtime' && input.canonicalObjectId) {
    const object = await getAirtimeOperation(input.phone, input.canonicalObjectId);
    return object ? { ok: true, object } : { ok: false, code: 'foreign_or_missing_airtime_operation' };
  }
  if (capability === 'fulfilment' && input.canonicalObjectId) {
    const object = await getFulfilment(input.phone, input.canonicalObjectId);
    return object ? { ok: true, object } : { ok: false, code: 'foreign_or_missing_fulfilment' };
  }
  return { ok: true };
}

async function dispatchCanonicalAction(input: CanonicalCapabilityExecutionInput, object?: any): Promise<CanonicalCapabilityExecutionResult> {
  const args = input.arguments || {};
  if (input.capability === 'airtime') {
    const operationId = String(input.canonicalObjectId || args.operationId || '').trim();
    if (['status', 'inspect'].includes(input.action)) {
      if (!operationId) return invalidResult(input, 'needs_user', 'Tell me which airtime purchase you want Kurukoo to inspect.', 'airtime_operation_id_required');
      const operation = object || await getAirtimeOperation(input.phone, operationId);
      if (!operation) return invalidResult(input, 'unauthorized', 'That airtime purchase is not available to this account.', 'foreign_or_missing_airtime_operation');
      return baseResult(input, operation.status === 'completed' ? 'completed' : operation.status === 'pending_provider' ? 'externally_pending' : operation.status === 'blocked' ? 'external_unavailable' : operation.status === 'failed' ? 'failed' : 'needs_user', `Airtime purchase status: ${operation.status}.`, { canonicalObjectId: operation.id, canonicalFacts: { airtimeOperation: operation }, evidenceLevel: operation.status === 'completed' ? 'verified_external_evidence' : 'canonical_service', externalActivation: operation.status === 'pending_provider' ? 'repository_ready_external_activation' : 'locally_available' });
    }
    if (['prepare', 'quote'].includes(input.action)) {
      const recipient = String(args.recipient || args.phone || '').trim();
      const amountMinor = Number(args.amountMinor ?? (Number(args.amount) * 100));
      if (!recipient || !Number.isFinite(amountMinor) || amountMinor <= 0) return invalidResult(input, 'needs_user', 'Provide the recipient phone number and a positive airtime amount before continuing.', 'airtime_requirements_missing');
      try {
        const operation = await prepareAirtimeOperation({ ownerPhone: input.phone, recipient, amountMinor, currency: typeof args.currency === 'string' ? args.currency : 'NGN', network: typeof args.network === 'string' ? args.network : undefined, economicRequestId: typeof args.economicRequestId === 'string' ? args.economicRequestId : undefined, idempotencyKey: input.idempotencyKey });
        return baseResult(input, 'completed', `I prepared ${operation.currency} ${(operation.amountMinor / 100).toFixed(2)} airtime for ${operation.recipient}. Review the recipient, network and amount, then explicitly confirm purchase.`, { canonicalObjectId: operation.id, canonicalFacts: { airtimeOperation: operation }, evidenceLevel: 'canonical_service', nextActions: [{ action: 'purchase', label: 'Buy this airtime', confirmationRequired: true }] });
      } catch (error) {
        return invalidResult(input, 'invalid', error instanceof Error ? error.message : 'Airtime preparation failed.', 'airtime_prepare_failed');
      }
    }
    if (input.action === 'purchase') {
      if (!operationId) return invalidResult(input, 'needs_user', 'Prepare and select the exact airtime purchase before continuing.', 'airtime_operation_id_required');
      try {
        const operation = await purchaseAirtime({ ownerPhone: input.phone, operationId, idempotencyKey: input.idempotencyKey });
        const status: ExecutorStatus = operation.status === 'completed' ? 'completed' : operation.status === 'pending_provider' ? 'externally_pending' : operation.status === 'blocked' ? 'external_unavailable' : 'failed';
        const message = operation.status === 'pending_provider' ? 'The airtime request was accepted by the provider and is awaiting its status evidence. Kurukoo has not claimed delivery.' : operation.status === 'completed' ? 'The provider callback has verified the airtime outcome.' : 'The airtime purchase was not completed.';
        return baseResult(input, status, message, { canonicalObjectId: operation.id, canonicalFacts: { airtimeOperation: operation }, evidenceLevel: operation.status === 'completed' ? 'verified_external_evidence' : 'canonical_service', externalActivation: operation.status === 'pending_provider' ? 'repository_ready_external_activation' : 'unavailable_external_dependency', nextActions: [{ action: 'status', label: 'Check airtime status' }] });
      } catch (error) {
        return invalidResult(input, 'stale_context', error instanceof Error ? error.message : 'Airtime purchase could not continue.', 'airtime_purchase_failed');
      }
    }
  }
  if (input.capability === 'fulfilment') {
    const fulfilmentId = String(input.canonicalObjectId || args.fulfilmentId || '').trim();
    if (!fulfilmentId) return invalidResult(input, 'needs_user', 'Tell me which fulfilment you want Kurukoo to use.', 'fulfilment_id_required');
    const fulfilment = object || await getFulfilment(input.phone, fulfilmentId);
    if (!fulfilment) return invalidResult(input, 'unauthorized', 'That fulfilment is not available to this account.', 'foreign_or_missing_fulfilment');
    if (['get', 'resume'].includes(input.action)) return baseResult(input, 'completed', `This fulfilment is currently ${fulfilment.status}.`, { canonicalObjectId: fulfilment.id, canonicalFacts: { fulfilment }, evidenceLevel: 'canonical_service', nextActions: [{ action: 'list_offers', label: 'View current offers' }, { action: 'get_inquiry', label: 'View provider inquiry status' }] });
    if (['find_offers', 'list_offers'].includes(input.action)) {
      const offers = await listOffers(input.phone, fulfilment.id);
      return baseResult(input, 'completed', offers.length ? `I found ${offers.length} current canonical offer${offers.length === 1 ? '' : 's'}.` : 'There are no current canonical offers yet.', { canonicalObjectId: fulfilment.id, canonicalFacts: { fulfilmentId: fulfilment.id, offers }, evidenceLevel: offers.length ? 'canonical_service' : 'none', nextActions: offers.length ? [{ action: 'select_offer', label: 'Select an exact offer' }] : [{ action: 'create_inquiry', label: 'Prepare a provider inquiry' }] });
    }
    if (input.action === 'get_inquiry') {
      const inquiries = await listProviderInquiries(input.phone, fulfilment.id, { includeClosed: true });
      return baseResult(input, 'completed', inquiries.length ? `I found ${inquiries.length} provider inquir${inquiries.length === 1 ? 'y' : 'ies'} for this fulfilment.` : 'There are no provider inquiries for this fulfilment.', { canonicalObjectId: fulfilment.id, canonicalFacts: { fulfilmentId: fulfilment.id, inquiries }, evidenceLevel: 'canonical_service', nextActions: inquiries.length ? [{ action: 'resume', label: 'Resume fulfilment' }] : [{ action: 'create_inquiry', label: 'Prepare a provider inquiry' }] });
    }
    if (input.action === 'update_requirements') {
      const patch = args.patch && typeof args.patch === 'object' && !Array.isArray(args.patch) ? args.patch as Record<string, unknown> : {};
      const binding = getFulfilmentSkillBinding(fulfilment.skill);
      if (!binding) return invalidResult(input, 'invalid', 'This fulfilment has no reusable skill binding.', 'fulfilment_binding_missing');
      const missing = resolveMissingFulfilmentInputs(binding, { ...fulfilment.requirements, ...patch });
      const updated = await updateFulfilmentRequirements(input.phone, fulfilment.id, patch, missing);
      return baseResult(input, 'completed', missing.length ? `I recorded the available requirements. Still needed: ${missing.join(', ')}.` : 'The fulfilment requirements are complete and ready for discovery.', { canonicalObjectId: updated.id, canonicalFacts: { fulfilment: updated }, evidenceLevel: 'canonical_service', nextActions: missing.length ? [{ action: 'update_requirements', label: 'Provide the remaining requirements' }] : [{ action: 'find_offers', label: 'Find current offers' }] });
    }
    if (input.action === 'select_offer') {
      const offerId = String(args.offerId || '').trim();
      if (!offerId) return invalidResult(input, 'needs_user', 'Select an exact current offer before continuing.', 'offer_id_required');
      try {
        const selected = await selectOffer(input.phone, fulfilment.id, offerId);
        return baseResult(input, 'completed', 'The exact offer is selected and awaits your explicit confirmation.', { canonicalObjectId: selected.fulfilment.id, canonicalFacts: { fulfilment: selected.fulfilment, offer: selected.offer }, evidenceLevel: 'canonical_service', nextActions: [{ action: 'confirm', label: 'Proceed with this offer', confirmationRequired: true }] });
      } catch (error) {
        return invalidResult(input, 'stale_context', error instanceof Error ? error.message : 'That offer is no longer selectable.', 'offer_not_selectable');
      }
    }
    if (input.action === 'create_inquiry') {
      const providerId = String(args.providerId || '').trim();
      const question = String(args.question || '').trim();
      if (!providerId || !question) return invalidResult(input, 'needs_user', 'A provider identity and inquiry question are required.', 'provider_inquiry_details_required');
      const inquiry = await createProviderInquiry({ fulfilmentId: fulfilment.id, ownerPhone: input.phone, providerId, providerPhone: typeof args.providerPhone === 'string' ? args.providerPhone : undefined, providerName: typeof args.providerName === 'string' ? args.providerName : undefined, question, requestedFields: Array.isArray(args.requestedFields) ? args.requestedFields.map(String).slice(0, 12) : ['availability', 'price', 'delivery'], id: typeof args.inquiryId === 'string' ? args.inquiryId : undefined });
      return baseResult(input, 'externally_pending', 'The provider inquiry is recorded and ready for delivery through the configured channel. Kurukoo has not claimed delivery or a provider response.', { canonicalObjectId: fulfilment.id, canonicalFacts: { fulfilmentId: fulfilment.id, inquiry }, evidenceLevel: 'canonical_service', externalActivation: 'repository_ready_external_activation', nextActions: [{ action: 'get_inquiry', label: 'Check inquiry status' }] });
    }
    if (input.action === 'confirm') {
      if (fulfilment.status !== 'awaiting_confirmation') return invalidResult(input, 'stale_context', 'This fulfilment is not awaiting confirmation for the selected offer.', 'fulfilment_not_awaiting_confirmation');
      const updated = await transitionFulfilment(input.phone, fulfilment.id, 'confirmed');
      return baseResult(input, 'externally_pending', 'Your confirmation is recorded. Kurukoo will now use the existing payment and execution boundaries; no payment, provider dispatch, or completion has been claimed.', { canonicalObjectId: updated.id, canonicalFacts: { fulfilment: updated }, evidenceLevel: 'canonical_service', externalActivation: 'repository_ready_external_activation', nextActions: [{ action: 'execute', label: 'Continue through the canonical execution boundary', confirmationRequired: true }] });
    }
    if (input.action === 'execute') {
      if (fulfilment.status !== 'confirmed') return invalidResult(input, 'stale_context', 'This fulfilment must be explicitly confirmed before execution can continue.', 'fulfilment_not_confirmed');
      const updated = await transitionFulfilment(input.phone, fulfilment.id, 'in_fulfillment');
      return baseResult(input, 'externally_pending', 'The canonical execution boundary is active. External payment, provider transport, and completion evidence remain required before Kurukoo can claim fulfilment.', { canonicalObjectId: updated.id, canonicalFacts: { fulfilment: updated }, evidenceLevel: 'canonical_service', externalActivation: 'repository_ready_external_activation', nextActions: [{ action: 'status', label: 'Check execution status' }] });
    }
  }
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
    const db = await getDb();
    const profile = db.exec('SELECT subscription_tier, country, updated_at FROM memory_profiles WHERE phone = ? LIMIT 1', [input.phone]);
    const profileRow = profile[0]?.values?.[0];
    const provider = db.exec('SELECT tier, status, next_billing_date, leads_this_month FROM provider_subscriptions WHERE phone = ? LIMIT 1', [input.phone]);
    const providerRow = provider[0]?.values?.[0];
    const subscription = { tier: profileRow?.[0] ? String(profileRow[0]) : 'Base', country: profileRow?.[1] ? String(profileRow[1]) : undefined, updatedAt: profileRow?.[2] ? String(profileRow[2]) : undefined, providerTier: providerRow?.[0] ? String(providerRow[0]) : undefined, providerStatus: providerRow?.[1] ? String(providerRow[1]) : undefined, nextBillingDate: providerRow?.[2] ? String(providerRow[2]) : undefined, leadsThisMonth: providerRow?.[3] == null ? undefined : Number(providerRow[3]) }; return baseResult(input, 'completed', `Your current Kurukoo subscription is ${subscription.tier}.`, { canonicalFacts: { subscription }, evidenceLevel: 'canonical_service', nextActions: [{ action: 'change', label: 'Change subscription' }] });
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
  const actionContract = getCapabilityActionContract(input.capability, input.action);
  const confirmationRequired = input.confirmationRequired ?? actionContract?.confirmationRequired ?? policy?.confirmation === 'explicit';
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
