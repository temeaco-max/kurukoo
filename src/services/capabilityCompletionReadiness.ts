import { AUTHENTICATED_CAPABILITY_COVERAGE, type AuthenticatedCapabilityContract } from './authenticatedCapabilityCoverageRegistry.js';
import { getExternalIntegrationReadiness, type ExternalIntegrationReadiness } from './externalIntegrationReadiness.js';

export type CapabilityCompletionState = 'LOCALLY_COMPLETE' | 'REPOSITORY_READY_EXTERNAL_ACTIVATION' | 'STRUCTURALLY_INCOMPLETE';

export interface CapabilityInternalProof {
  test: string;
  boundary: string;
}

export interface CapabilityCompletionReadiness {
  id: string;
  capability: string;
  canonicalSurface: AuthenticatedCapabilityContract['canonicalSurface'];
  canonicalRoute: string;
  canonicalOwner: string;
  internalExecution: {
    state: 'VERIFIED';
    proofs: readonly CapabilityInternalProof[];
  };
  completionState: CapabilityCompletionState;
  finalExternalDependencies: Array<Pick<ExternalIntegrationReadiness, 'id' | 'name' | 'uiState' | 'summary'>>;
  summary: string;
}

type CompletionEvidence = {
  proofs: readonly CapabilityInternalProof[];
  externalDependencies?: readonly string[];
};

const proof = (test: string, boundary: string): CapabilityInternalProof => ({ test, boundary });

/**
 * This maps the existing authenticated coverage contract to deterministic internal
 * proof already exercised by repository convergence. It deliberately does not
 * mark a provider, device, payment rail, carrier, or other external dependency
 * as active; those remain final activation prerequisites below.
 */
export const AUTHENTICATED_CAPABILITY_COMPLETION_EVIDENCE: Readonly<Record<string, CompletionEvidence>> = {
  'agent-chat': { proofs: [proof('test:behavioral-chat-matrix', 'Canonical Chat routing, continuation, and truthful outcome presentation.')] },
  'agents-runtime': { proofs: [proof('test:agent-runtime', 'Owner-scoped Goal lifecycle, persistence, bounded worker re-entry, and checkpoint handling.')] },
  requests: { proofs: [proof('test:skill-flows', 'Canonical Economic Request creation, lifecycle, and requirement validation.')], externalDependencies: ['provider_verification', 'external_dispatch'] },
  tasks: { proofs: [proof('test:task', 'Canonical task route, continuation, acceptance, and completion ownership.')] },
  notifications: { proofs: [proof('test:notification-queue', 'Durable internal notification queue, source identity, and delivery-state truth.')], externalDependencies: ['fcm'] },
  'contacts-identity': { proofs: [proof('test:relationships', 'Identity and owner-scoped relationship persistence.')], externalDependencies: ['whatsapp', 'telegram', 'sms', 'email'] },
  memory: { proofs: [proof('test:memory-self-service', 'Owner-scoped memory review, correction, and revocation path.')] },
  discover: { proofs: [proof('test:discovery-network', 'Canonical discovery entity, availability truth, and continuation path.')], externalDependencies: ['maps_geolocation', 'provider_verification'] },
  topics: { proofs: [proof('test:topics', 'Canonical topic, reply, and relationship continuity.')] },
  opportunities: { proofs: [proof('test:opportunity-truth', 'Opportunity truth, canonical request handoff, and non-fabrication boundary.')], externalDependencies: ['provider_verification', 'external_dispatch'] },
  follow: { proofs: [proof('test:relationships', 'Owner-scoped follow and unfollow persistence across canonical contexts.')] },
  'provider-communication': { proofs: [proof('test:provider-session-message-delivery', 'Provider session message policy, exact context, and canonical delivery state.')], externalDependencies: ['whatsapp', 'telegram', 'sms', 'email'] },
  calls: { proofs: [proof('test:voice', 'Call/voice policy, consent, fallback, and fail-closed provider boundary.')], externalDependencies: ['webrtc', 'voice'] },
  voice: { proofs: [proof('test:voice', 'Voice routing, transcript, consent, and text fallback boundary.')], externalDependencies: ['voice'] },
  'agent-brief': { proofs: [proof('test:agent-brief', 'Deterministic Agent Brief projection from exact canonical context.')] },
  'quick-ride': { proofs: [proof('test:quick-ride-contract', 'Mobility request lifecycle and non-fabricated provider/dispatch contract.')], externalDependencies: ['maps_geolocation', 'provider_verification', 'stripe', 'mobile_money', 'external_dispatch'] },
  'physical-execution': { proofs: [proof('test:execution-boundary', 'Authorization, idempotency, durable execution state, evidence, retry, and cancellation boundary.')], externalDependencies: ['external_dispatch'] },
  'agent-to-agent': { proofs: [proof('test:external-agent-foundation', 'Schema-validated, authorization-gated coordination and fail-closed completion claims.')], externalDependencies: ['external_dispatch'] },
  saved: { proofs: [proof('test:relationships', 'Saved context persistence and return to original canonical object.')] },
  cart: { proofs: [proof('test:checkout-confirmation', 'Cart/checkout context preservation and explicit confirmation boundary.')], externalDependencies: ['stripe', 'mobile_money'] },
  reminders: { proofs: [proof('test:reminder-safety-coordinator', 'Reminder persistence, interruption, recovery, and exact continuation context.')], externalDependencies: ['fcm'] },
  connect: { proofs: [proof('test:external-integration-readiness', 'Owner-scoped integration setup projection, configuration gates, and fail-closed readiness.')], externalDependencies: ['google_drive', 'google_sheets', 'notion', 'outlook', 'onedrive', 'whatsapp', 'telegram', 'sms', 'ussd', 'email', 'fcm', 'mcp', 'webrtc', 'mqtt_iot', 'voice'] },
  artifacts: { proofs: [proof('test:artifact-storage', 'Owner-scoped artifact retention, access, and canonical evidence linkage.')], externalDependencies: ['google_drive'] },
  safety: { proofs: [proof('test:interaction-policy', 'Safety interruption, consent, explicit handoff, and non-fabrication policy.')], externalDependencies: ['external_dispatch'] },
  'wallet-points-topup': { proofs: [proof('test:topup', 'Wallet/Points state, explicit authorization, and payment-provider truth boundary.')], externalDependencies: ['stripe', 'mobile_money'] },
  'subscriptions-checkout': { proofs: [proof('test:subscription', 'Subscription entitlement and checkout confirmation state.')], externalDependencies: ['stripe', 'mobile_money'] },
  payments: { proofs: [proof('test:stripe-payment', 'Payment adapter contract, signed webhook, replay resistance, and canonical request integrity.')], externalDependencies: ['stripe', 'mobile_money'] },
};

function externalProjection(ids: readonly string[], integrations: readonly ExternalIntegrationReadiness[]): Array<Pick<ExternalIntegrationReadiness, 'id' | 'name' | 'uiState' | 'summary'>> {
  return ids.map((id) => integrations.find((integration) => integration.id === id)).filter((integration): integration is ExternalIntegrationReadiness => Boolean(integration)).map(({ id, name, uiState, summary }) => ({ id, name, uiState, summary }));
}

export function getCapabilityCompletionReadiness(env: NodeJS.ProcessEnv = process.env): CapabilityCompletionReadiness[] {
  const integrations = getExternalIntegrationReadiness(env);
  return AUTHENTICATED_CAPABILITY_COVERAGE.map((contract) => {
    const evidence = AUTHENTICATED_CAPABILITY_COMPLETION_EVIDENCE[contract.id];
    const requestedDependencies = evidence?.externalDependencies || [];
    const finalExternalDependencies = externalProjection(requestedDependencies, integrations);
    const unresolvedDependencies = requestedDependencies.filter((id) => !finalExternalDependencies.some((dependency) => dependency.id === id));
    const completionState: CapabilityCompletionState = !evidence?.proofs.length || unresolvedDependencies.length
      ? 'STRUCTURALLY_INCOMPLETE'
      : finalExternalDependencies.length
        ? 'REPOSITORY_READY_EXTERNAL_ACTIVATION'
        : 'LOCALLY_COMPLETE';
    const summary = completionState === 'LOCALLY_COMPLETE'
      ? 'The authenticated capability has deterministic internal execution proof and no external activation prerequisite.'
      : completionState === 'REPOSITORY_READY_EXTERNAL_ACTIVATION'
        ? 'The authenticated capability has deterministic internal execution proof; only the listed final external activation dependencies remain.'
        : 'The capability readiness contract is incomplete and must not be represented as activation-ready.';
    return {
      id: contract.id,
      capability: contract.capability,
      canonicalSurface: contract.canonicalSurface,
      canonicalRoute: contract.canonicalRoute,
      canonicalOwner: contract.canonicalOwner,
      internalExecution: { state: 'VERIFIED', proofs: evidence?.proofs || [] },
      completionState,
      finalExternalDependencies,
      summary,
    };
  });
}
