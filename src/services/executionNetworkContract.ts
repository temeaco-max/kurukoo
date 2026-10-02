/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */

/**
 * Canonical machine-readable expression of the Execution Network strategy.
 *
 * This is deliberately a contract, not a second execution engine. Each pillar
 * points at an existing Kurukoo owner so product, API, admin and test surfaces
 * can reason about network completeness without creating parallel authorities.
 */
export type ExecutionNetworkPillarState = 'implemented' | 'plumbed' | 'external_activation_required';

export interface ExecutionNetworkPillar {
  id: string;
  name: string;
  state: ExecutionNetworkPillarState;
  owners: string[];
  capabilityRefs: string[];
  testIntent: string;
}

const P = (id: string, name: string, state: ExecutionNetworkPillarState, owners: string[], capabilityRefs: string[], testIntent: string): ExecutionNetworkPillar => ({ id, name, state, owners, capabilityRefs, testIntent });

export const EXECUTION_NETWORK_PILLARS: readonly ExecutionNetworkPillar[] = [
  P('provider_neutral_execution', 'Provider-neutral execution', 'plumbed', ['skillFlows', 'universalCapabilityProtocol', 'economicRequestService'], ['provider', 'economic_request'], 'A request can be fulfilled without hard-coding a particular provider.'),
  P('human_ai_execution', 'Human + AI execution', 'plumbed', ['agentRuntime', 'providerEntity', 'executionConnector'], ['execution', 'agent'], 'The execution participant may be a human/provider or an authorized agent.'),
  P('provider_network', 'Provider network', 'plumbed', ['providerDiscovery', 'providerVerification', 'economicRequestService'], ['provider', 'discovery'], 'Eligible providers can be discovered and attached to an exact request.'),
  P('open_provider_model', 'Open provider model', 'plumbed', ['providerEntity', 'capabilityPortfolioService'], ['provider', 'capability_portfolio'], 'A person or business can expose an executable capability without a new vertical engine.'),
  P('demand_supply_coordination', 'Demand/supply coordination', 'plumbed', ['economicRequestService', 'discoveryNetwork', 'proactiveOpportunityService'], ['economic_request', 'discovery'], 'Open demand can produce a grounded provider/opportunity path.'),
  P('execution_graph', 'Execution graph', 'plumbed', ['economicRequestService', 'executionPersistence', 'outcomeContext'], ['economic_request', 'execution'], 'Request, participant, execution, evidence and outcome remain linked.'),
  P('outcome_oriented_execution', 'Outcome-oriented execution', 'implemented', ['outcomeCompleteness', 'economicRequestService'], ['completion', 'execution'], 'Completion is evaluated as an outcome, not merely an agent task ending.'),
  P('evidence_first_completion', 'Evidence-first completion', 'implemented', ['executionPersistence', 'outcomeCompleteness'], ['evidence', 'completion'], 'A completed external outcome requires canonical or external evidence appropriate to the action.'),
  P('execution_reputation', 'Execution reputation', 'plumbed', ['trustService', 'providerVerification', 'reviewService'], ['verification', 'provider'], 'Provider trust can be derived from verification and execution history.'),
  P('negotiated_fulfilment', 'Negotiated fulfilment', 'plumbed', ['economicRequestService', 'fulfilmentOfferModel'], ['quote', 'provider'], 'Multiple offers can be compared before consequential selection.'),
  P('multi_party_orchestration', 'Multi-party orchestration', 'implemented', ['economicRequestService', 'executionPersistence', 'physicalExecutionParticipant'], ['execution', 'fulfillment'], 'A request can contain multiple execution participants without a second workflow engine.'),
  P('offline_world_state', 'Offline-world state', 'plumbed', ['presenceService', 'physicalExecutionParticipant', 'executionPersistence'], ['execution', 'tracking'], 'Physical state is represented only when a configured observation/evidence boundary supports it.'),
  P('geography_native_execution', 'Geography-native execution', 'implemented', ['discoveryNetwork', 'nearbyPulse', 'locationContext'], ['discovery', 'availability'], 'Location-aware matching never fabricates precision or availability.'),
  P('africa_native_execution', 'Africa-native execution', 'plumbed', ['channelRegistry', 'providerNetwork', 'localExecutionAdapters'], ['channel', 'provider'], 'Local channels and provider models can enter the same canonical lifecycle.'),
  P('multi_channel_execution', 'Multi-channel execution', 'implemented', ['channelRegistry', 'channelDeliveryState'], ['channel', 'communication'], 'Web and configured external channels continue the same canonical context.'),
  P('identity_minimised_context', 'Identity-minimised context', 'implemented', ['authService', 'memoryProfile', 'contextArbitration'], ['memory', 'economic_request'], 'Execution uses only the owner/context required for the action.'),
  P('model_independent_intelligence', 'Model-independent intelligence', 'implemented', ['unifiedAiEngine', 'aiAdapters', 'intentRouter'], ['agent', 'execution'], 'Changing an AI provider does not change canonical execution ownership.'),
  P('agent_of_agents', 'Agent-of-agents', 'implemented', ['agentRuntime', 'agentDelegation', 'agentToolRegistry'], ['agent'], 'Agents delegate through bounded canonical capabilities rather than spawning parallel authorities.'),
  P('execution_api', 'Execution API', 'plumbed', ['canonicalCapabilityExecutor', 'mcpAppService'], ['execution', 'economic_request'], 'An authorized client can invoke a canonical action without bypassing policy.'),
  P('universal_execution_protocol', 'Universal execution protocol', 'implemented', ['universalCapabilityProtocol', 'capabilityRegistry'], ['execution', 'economic_request', 'provider'], 'Capabilities expose lifecycle, risk, evidence and recovery contracts consistently.'),
  P('capability_not_app_abstraction', 'Capability-not-app abstraction', 'implemented', ['capabilityFoundation', 'skillFlows'], ['atomic.execute', 'atomic.discovery'], 'The network resolves capabilities rather than requiring a specific application.'),
  P('provider_competition', 'Provider competition', 'plumbed', ['discoveryNetwork', 'fulfilmentOfferModel'], ['discovery', 'quote'], 'Eligible alternatives can be compared without hidden provider preference.'),
  P('opportunity_engine', 'Opportunity engine', 'implemented', ['proactiveOpportunityService', 'economicRequestService'], ['discovery', 'economic_request'], 'Opportunities originate from grounded demand/evidence rather than invented market activity.'),
  P('provider_os', 'Provider OS', 'plumbed', ['providerRoutes', 'providerCommunication', 'providerPayout'], ['provider', 'communication'], 'Providers can receive, progress and close work through canonical surfaces.'),
  P('outcome_learned_capabilities', 'Outcome-learned capabilities', 'plumbed', ['executionPersistence', 'outcomeCompleteness', 'trustService'], ['evidence', 'verification'], 'Observed execution outcomes can improve capability/trust projections without fabricating facts.'),
  P('economic_neutrality', 'Economic neutrality', 'plumbed', ['economicRequestService', 'discoveryNetwork'], ['economic_request', 'provider'], 'The matching path is based on legitimate user constraints, not an assumed house provider.'),
  P('execution_native_advertising', 'Execution-native advertising', 'plumbed', ['authenticatedAdvertising', 'economicRequestService'], ['provider', 'discovery'], 'Sponsored options remain disclosed and cannot become proof of fulfilment.'),
  P('contributor_network', 'Contributor network', 'plumbed', ['contributorService', 'taskService', 'pointsEngine'], ['points'], 'Contributors can improve grounded network information through canonical tasks.'),
  P('assistance_marketplace_convergence', 'Assistance + marketplace convergence', 'implemented', ['canonicalChatTurnService', 'economicRequestService'], ['economic_request', 'execution'], 'Chat can enter a canonical request without forcing a separate product workflow.'),
  P('transaction_trust', 'Transaction trust', 'implemented', ['authorization', 'payment', 'evidence', 'dispute'], ['payment', 'evidence', 'dispute'], 'Consequential state changes retain authorization, provenance and recovery boundaries.'),
  P('outcome_protection', 'Outcome protection', 'plumbed', ['economicRequestService', 'disputeService', 'payment'], ['dispute', 'completion'], 'Failures can be represented and recovered without claiming an outcome that did not occur.'),
  P('cost_adaptive_intelligence', 'Cost-adaptive intelligence', 'implemented', ['intentRouter', 'fastText', 'unifiedAiEngine', 'aiAdapters'], ['agent'], 'The cheapest sufficient model handles a task before expensive inference is used.'),
  P('event_driven_execution', 'Event-driven execution', 'implemented', ['eventBus', 'durableJobs', 'backgroundServices'], ['execution', 'notification'], 'Downstream work is emitted/queued rather than making canonical state services into god functions.'),
  P('economic_request_primitive', 'Economic Request primitive', 'implemented', ['economicRequestService', 'economicRequestRouter'], ['economic_request'], 'Economic coordination uses one canonical request lifecycle across supported categories.'),
  P('beyond_personal_ai', 'Beyond personal AI', 'plumbed', ['universalCapabilityProtocol', 'providerNetwork', 'agentRuntime'], ['execution', 'provider'], 'The same execution network can serve a person, provider, or external AI agent.'),
  P('cross_agent_interoperability', 'Cross-agent interoperability', 'plumbed', ['mcpAppService', 'canonicalCapabilityExecutor'], ['execution', 'agent'], 'External agents can discover and invoke approved Kurukoo capabilities through an adapter.'),
  P('progressive_disclosure_ux', 'Progressive-disclosure UX', 'implemented', ['chatRouter', 'workSurface', 'activitySurface'], ['economic_request', 'execution'], 'The user sees a simple outcome-first journey while important consent and failure states remain visible.'),
  P('execution_network_effects', 'Execution-network effects', 'plumbed', ['providerNetwork', 'economicRequestService', 'executionPersistence'], ['provider', 'economic_request', 'evidence'], 'Each verified execution can strengthen future matching/trust without becoming an ungrounded claim.'),
  P('provider_consumer_dual_network', 'Provider-consumer dual network', 'plumbed', ['consumerChat', 'providerRoutes', 'economicRequestService'], ['provider', 'economic_request'], 'The consumer and provider sides use the same canonical request/execution objects.'),
  // ── Secure execution and payment-protection pillars ─────────────────────
  P('secure_credential_vault', 'Secure credential vault', 'plumbed', ['secureCredentialStore'], ['credential_vault'], 'User-scoped encrypted credential store the agent cannot see.'),
  P('one_time_card_protection', 'One-time card + purchase protection', 'plumbed', ['oneTimeCardService'], ['payment_protection'], 'Virtual cards with single-use tokens and purchase protection claims.'),
  P('isolated_execution_surface', 'Isolated execution surface', 'external_activation_required', ['secureExecutionEnvironment'], ['sandboxed_execution'], 'Sandboxed browser/VM execution surface for agent tasks.'),
  P('user_audit_timeline', 'User-facing audit timeline', 'implemented', ['executionAuditService'], ['audit_timeline'], 'Single timeline showing what was requested, planned and happened.'),
];

export const EXECUTION_NETWORK_CONTRACT_VERSION = '1.0';

export function listExecutionNetworkPillars(): ExecutionNetworkPillar[] {
  return EXECUTION_NETWORK_PILLARS.map(pillar => ({ ...pillar, owners: [...pillar.owners], capabilityRefs: [...pillar.capabilityRefs] }));
}

export function getExecutionNetworkPillar(id: string): ExecutionNetworkPillar | undefined {
  const normalized = String(id || '').trim().toLowerCase();
  const pillar = EXECUTION_NETWORK_PILLARS.find(item => item.id === normalized);
  return pillar ? { ...pillar, owners: [...pillar.owners], capabilityRefs: [...pillar.capabilityRefs] } : undefined;
}

export function validateExecutionNetworkContract(): { valid: boolean; count: number; duplicateIds: string[]; invalidStates: string[] } {
  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  const invalidStates: string[] = [];
  for (const pillar of EXECUTION_NETWORK_PILLARS) {
    if (seen.has(pillar.id)) duplicateIds.push(pillar.id);
    seen.add(pillar.id);
    if (!['implemented', 'plumbed', 'external_activation_required'].includes(pillar.state)) invalidStates.push(pillar.id);
  }
  return { valid: EXECUTION_NETWORK_PILLARS.length === 43 && duplicateIds.length === 0 && invalidStates.length === 0, count: EXECUTION_NETWORK_PILLARS.length, duplicateIds, invalidStates };
}
