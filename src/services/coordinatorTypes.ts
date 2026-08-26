import type { AgentToolName, AgentToolResult } from './agentToolRegistry.js';

export type CoordinatorEventType =
  | 'agent.goal.due'
  | 'economic_request.state_changed'
  | 'notification.action_required'
  | 'chat.turn.completed'
  | 'memory.context.retrieved'
  | 'provider.offer.received'
  | 'fulfilment.created'
  | 'fulfilment.requirements_updated'
  | 'fulfilment.state_changed'
  | 'fulfilment.offer_created'
  | 'fulfilment.offer_selected'
  | 'fulfilment.provider_inquiry_created'
  | 'fulfilment.provider_response_recorded'
  | 'payment.webhook.verified'
  | 'operator.policy_changed'
  | 'reminder.state_changed'
  | 'safety.checkin.state_changed'
  | 'trust.device.registered'
  | 'trust.challenge.created'
  | 'trust.challenge.approved'
  | 'trust.challenge.denied'
  | 'trust.device.revoked'
  | 'channel.evidence.observed'
  | 'privacy.number_mapping.created'
  | 'privacy.number_mapping.released'
  | 'agent.persona.requested';

export type CoordinatorConfirmation = 'none' | 'user' | 'operator' | 'external_evidence';
export type CoordinatorEvidenceLevel = 'assertion' | 'persisted_state' | 'canonical_service' | 'verified_external' | 'policy_reviewed';

export interface CoordinatorEventEnvelope<TPayload = Record<string, unknown>> {
  id: string;
  type: CoordinatorEventType;
  occurredAt: string;
  producer: string;
  correlationId: string;
  causationId?: string;
  ownerPhone?: string;
  economicRequestId?: string;
  agentGoalId?: string;
  payload: TPayload;
  sensitivity: 'public' | 'personal' | 'sensitive' | 'restricted';
  provenance: {
    source: 'user' | 'canonical_service' | 'provider' | 'operator' | 'teacher_model';
    sourceId?: string;
    evidenceLevel: CoordinatorEvidenceLevel;
  };
  policy: {
    autonomousAllowed: boolean;
    confirmationRequired: CoordinatorConfirmation;
    expiresAt?: string;
  };
  schemaVersion: 1;
}

export type CoordinatorCapabilityName = 'execute_capability' | 'inspect_request' | 'recheck_request' | 'first_class_agent_persona' | 'wait_for_user';
export type CoordinatorCapabilityRisk = 'read_only' | 'reversible' | 'user_confirmation_required';

export interface CoordinatorContext {
  event: CoordinatorEventEnvelope;
  dryRun: boolean;
}

export interface CoordinatorCapabilityResult {
  ok: boolean;
  state: 'observed' | 'awaiting_confirmation' | 'completed' | 'deferred' | 'failed';
  message: string;
  tool?: AgentToolName;
  data?: Record<string, unknown>;
  evidence?: { source: string; level: CoordinatorEvidenceLevel };
}

export interface CoordinatorCapability {
  name: CoordinatorCapabilityName;
  risk: CoordinatorCapabilityRisk;
  requires: CoordinatorConfirmation;
  autonomous: boolean;
  canRun(context: CoordinatorContext): boolean;
  run(context: CoordinatorContext): Promise<CoordinatorCapabilityResult>;
}

export interface CoordinatorRun {
  id: number;
  eventId: string;
  capability?: CoordinatorCapabilityName;
  state: CoordinatorCapabilityResult['state'];
  provider: 'deterministic' | 'local' | 'hosted' | 'teacher';
  model: string;
  latencyMs: number;
  failureReason?: string;
  createdAt: string;
}

export interface CoordinatorDecision {
  capability: CoordinatorCapabilityName;
  provider: CoordinatorRun['provider'];
  model: string;
  reason: string;
}

export type CoordinatorToolResult = AgentToolResult;
