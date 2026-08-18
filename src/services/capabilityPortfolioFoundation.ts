import type { UniversalCapabilityDescriptor } from './universalCapabilityProtocol.js';
import { getCapabilityRegistration, registerCapabilities } from './capabilityRegistry.js';

export const CAPABILITY_PORTFOLIO_CAPABILITY = 'capability_portfolio';

export function ensureCapabilityPortfolioRegistration(): void {
  if (getCapabilityRegistration(CAPABILITY_PORTFOLIO_CAPABILITY)) return;
  const descriptor: UniversalCapabilityDescriptor = {
    kind: 'operation',
    capability: CAPABILITY_PORTFOLIO_CAPABILITY,
    family: 'identity-capabilities',
    mode: 'structured_action',
    actions: ['inspect', 'add', 'update', 'pause', 'available', 'live', 'offline'],
    context: { requiredInputs: [], optionalInputs: [
      { key: 'skill', label: 'Skill', required: false },
      { key: 'kind', label: 'Capability kind', required: false },
      { key: 'availability', label: 'Availability', required: false },
      { key: 'metadata', label: 'Capability metadata', required: false },
      { key: 'lat', label: 'Latitude for explicit Pulse activation', required: false },
      { key: 'lng', label: 'Longitude for explicit Pulse activation', required: false },
    ] },
    permissions: ['authenticated_owner'],
    owner: ['capabilityPortfolioService', 'nearbyPulse', 'skills'],
    risk: 'low_risk',
    consentRequired: true,
    confirmationRequired: false,
    lifecycle: ['requested','clarifying','ready','accepted','waiting','executing','completed','cancelled','failed'],
    canonicalFactsAvailable: ['identity','skill','capability_status','availability','pulse_state','evidence'],
    executionStatus: ['not_started','accepted','waiting','needs_user','executing','completed','failed'],
    evidenceStatus: ['none','internal_record','canonical_service','provider_evidence'],
    nextAllowedActions: ['inspect','add','update','pause','available','live','offline'],
    failureStates: ['blocked','failed','foreign_context','confirmation_required','unavailable_external_dependency'],
    retryPolicy: ['preserve the same owner and skill','do not create duplicate capability records'],
    recoveryActions: ['inspect','resume','retry','cancel'],
    continuationContext: ['conversationId','contextId','ownerScope','skill','capabilityId'],
    externalDependencyState: ['Nearby Pulse activation additionally requires explicit location, provider verification and a configured external/presence boundary where applicable.'],
    activationState: 'locally_available',
  };
  registerCapabilities([{
    descriptor,
    namespace: 'kurukoo.identity-capabilities',
    version: '1',
    aliases: ['capability_portfolio', 'my_capabilities', 'skills_portfolio'],
    source: 'capabilityPortfolioService',
  }]);
}

ensureCapabilityPortfolioRegistration();
