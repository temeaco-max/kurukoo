/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
export type CapabilitySurface = 'chat' | 'desk' | 'agents' | 'requests' | 'tasks' | 'notifications' | 'contacts' | 'memory' | 'discover' | 'topics' | 'opportunities' | 'saved' | 'cart' | 'reminders' | 'connect' | 'call' | 'contextual' | 'wallet' | 'checkout';
export type CapabilityStatus = 'IMPLEMENTED' | 'AVAILABLE' | 'RUNTIME_VERIFIED' | 'BLOCKED_EXTERNAL' | 'UNVERIFIED' | 'DISABLED' | 'FAILED';

export interface AuthenticatedCapabilityContract {
  id: string;
  capability: string;
  canonicalSurface: CapabilitySurface;
  canonicalRoute: string;
  primaryAction: string;
  secondaryActions: readonly string[];
  canonicalOwner: string;
  authentication: 'required' | 'contextual';
  authorization: string;
  continuation: string;
  notificationIntegration: string;
  runtimeStatus: CapabilityStatus;
  verificationBoundary: string;
}

const action = (id: string, capability: string, canonicalSurface: CapabilitySurface, canonicalRoute: string, primaryAction: string, canonicalOwner: string, continuation: string, runtimeStatus: CapabilityStatus, verificationBoundary: string, secondaryActions: readonly string[] = [], authorization = 'authenticated user') => ({
  id, capability, canonicalSurface, canonicalRoute, primaryAction, secondaryActions, canonicalOwner,
  authentication: 'required' as const, authorization, continuation, notificationIntegration: 'canonical notification/Agent Brief projections where events exist', runtimeStatus, verificationBoundary,
});

export const AUTHENTICATED_CAPABILITY_COVERAGE: readonly AuthenticatedCapabilityContract[] = [
  action('agent-chat', 'Agent / Chat', 'chat', '/chat', 'Ask / Send / Speak', 'canonicalChatTurnService', '/chat/:conversationId or the originating contextual card', 'UNVERIFIED', 'Browser/runtime voice and conversation continuity are not runtime-verified.'),
  action('agents-runtime', 'Agents directory/runtime', 'agents', '/agents', 'Continue / Approve / Reject', 'agentRuntime', '/agents/:id with goal/evidence context, then Chat where conversation context exists', 'UNVERIFIED', 'Agent runtime is statically contracted; browser execution is unverified.', ['Pause / Resume / Cancel', 'Review evidence']),
  action('requests', 'Requests / Economic Requests', 'requests', '/requests', 'Continue / Review / Approve', 'economicRequestRouter + skillFlows', '/requests/:id and the originating conversation', 'UNVERIFIED', 'Request lifecycle is contract-tested; live external fulfilment is not browser-verified.', ['Cancel', 'View provider/quote']),
  action('tasks', 'Tasks / contributor work', 'tasks', '/tasks', 'Continue / Accept / Complete', 'microTasks', '/tasks/:id and its underlying request/execution context', 'UNVERIFIED', 'Task route/service contracts exist; live user flow is unverified.', ['Review', 'Report']),
  action('notifications', 'Notifications', 'notifications', '/notifications', 'Open source context', 'pushNotifications', 'Exact source object: request, task, topic, provider, agent, reminder or safety context', 'UNVERIFIED', 'Delivery/runtime behaviour is not browser-verified.', ['Mark read', 'Open Agent Brief']),
  action('contacts-identity', 'Contacts / identity', 'contacts', '/connect', 'Open identity / Message / Call where authorized', 'progressiveIdentityService + relationshipService', 'Same person/provider context or canonical conversation', 'UNVERIFIED', 'Identity and relationship contracts are statically verified; live communication is unverified.', ['Follow / Unfollow', 'View profile']),
  action('memory', 'Memory', 'memory', '/memory', 'Review / Edit supported memory', 'memoryProfile', '/memory/:memoryId or back to the originating conversation', 'UNVERIFIED', 'Memory service is implemented; browser proof is unavailable.', ['Delete where supported', 'Return to context']),
  action('discover', 'Discover / Nearby Pulse', 'discover', '/discover', 'Open / Follow / Continue', 'discoverExperience', 'Target person/provider/location/opportunity context or Chat', 'UNVERIFIED', 'Discovery contract is static; real availability and nearby state are not runtime-verified.', ['Message', 'Open opportunity']),
  action('topics', 'Topics / community', 'topics', '/topics', 'Reply / Follow', 'topicService + relationshipService', 'Same Topic/reply context, then contextual Chat when useful', 'UNVERIFIED', 'Topic and relationship services are statically covered; live community state is unverified.', ['Share', 'Open Chat']),
  action('opportunities', 'Opportunities', 'opportunities', '/opportunities', 'Inquire / Continue / Request', 'opportunityEngine + economicRequestRouter', '/opportunities/:id then Request/Conversation context', 'UNVERIFIED', 'Opportunity truth is contract-tested; external fulfilment/provider activation is not runtime-verified.', ['Save', 'Follow']),
  action('follow', 'Follow / relationships', 'contextual', '/topics', 'Follow / Unfollow', 'relationshipService', 'Return to the followed Person, Provider or Topic context', 'UNVERIFIED', 'Relationship persistence is contract-tested; live multi-surface continuity is unverified.', ['View relationship state']),
  action('provider-communication', 'Provider communication', 'contextual', '/requests/:id', 'Message / Continue Request', 'providerCommunicationService', 'Same Request + Conversation + Provider context', 'UNVERIFIED', 'Communication policy/service is implemented; live provider delivery is unverified.', ['Call where authorized']),
  action('calls', 'Calls', 'call', '/call', 'Call', 'webrtcRoutes + providerCommunicationService', 'Communication session back to the same person/provider/request context', 'BLOCKED_EXTERNAL', 'WebRTC/browser call execution requires runtime/device verification and external connectivity.', ['Return to context']),
  action('voice', 'Voice / voice notes / live voice', 'chat', '/chat', 'Speak / Record', 'canonicalChatTurnService + voiceRouter', 'Same Chat conversation and request/task context', 'BLOCKED_EXTERNAL', 'Voice capability is represented but live provider/device/browser execution is not verified.', ['Switch to text']),
  action('agent-brief', 'Agent Brief', 'chat', '/chat', 'View / Ask for brief', 'agentBriefService', 'Exact referenced Request/Task/Reminder/Notification/Agent Goal context', 'UNVERIFIED', 'Agent Brief projection is deterministic and statically tested; runtime surfacing is unverified.', ['Open source item']),
  action('quick-ride', 'Quick Ride / mobility', 'discover', '/discover', 'Request / Continue ride', 'universalCapabilityProtocol + economicDispatchCoordinator', '/requests/:id and provider/execution context', 'BLOCKED_EXTERNAL', 'Provider/dispatch/payment rail and real-world ride execution require external activation.', ['Review provider']),
  action('physical-execution', 'Physical execution', 'requests', '/requests/:id', 'Review / Approve execution', 'economicDispatchCoordinator + universalCapabilityProtocol', 'Request execution/evidence context, then conversation', 'BLOCKED_EXTERNAL', 'No external physical fulfilment is assumed from static implementation alone.', ['View evidence', 'Dispute']),
  action('agent-to-agent', 'Agent-to-Agent coordination', 'agents', '/agents', 'Continue / Approve agent action', 'agentRuntime + universalCapabilityProtocol', 'Exact Agent Goal/Action context; notifications/brief may surface approval', 'BLOCKED_EXTERNAL', 'Cross-agent real-world execution remains bounded and externally unverified.', ['Pause', 'Reject']),
  action('saved', 'Saved', 'saved', '/saved', 'Open / Continue saved item', 'relationshipService + saved/context persistence', 'Original Topic, Opportunity, Provider, Product or Chat context', 'UNVERIFIED', 'Persistence exists but browser continuation is unverified.', ['Remove']),
  action('cart', 'Cart', 'cart', '/cart', 'Review / Checkout', 'cartRoutes + economicRequestRouter', '/checkout with the same cart/economic context', 'UNVERIFIED', 'Cart route exists; payment/browser continuity is unverified.', ['Remove item', 'Continue shopping']),
  action('reminders', 'Reminders', 'reminders', '/reminders', 'Open / Complete', 'reminderService', 'Source conversation/request/task context when present', 'UNVERIFIED', 'Reminder lifecycle is implemented; runtime notification delivery is unverified.', ['Edit', 'Cancel']),
  action('connect', 'Connect / integrations', 'connect', '/connect', 'Connect / Reconnect', 'externalIntegrationReadiness + connectedResourceService', 'Same connection/resource context; capability resumes through the canonical surface that consumes it', 'BLOCKED_EXTERNAL', 'External credentials/providers determine live readiness; browser proof is unavailable.', ['Disconnect', 'Review readiness']),
  action('artifacts', 'Artifacts / evidence history', 'contextual', '/artifacts', 'Open / Review evidence', 'ArtifactService', 'Back to originating request/task/conversation', 'UNVERIFIED', 'Artifact storage/retention is contract-tested; live browser inspection is unverified.', ['Download where supported']),
  action('safety', 'Safety / urgent help', 'contextual', '/safety', 'Open safety guidance / interrupt', 'safety + interaction policy', 'Relevant safety context, with explicit handoff rather than fabricated emergency fulfilment', 'UNVERIFIED', 'Safety boundary is implemented; no emergency-service delivery is claimed.', ['Check in', 'Return to Chat']),
  action('wallet-points-topup', 'Wallet / Points / Top-up', 'wallet', '/wallet', 'Review balance / Top up', 'wallet/payment/points services', '/top-up or the originating economic context', 'BLOCKED_EXTERNAL', 'Points purchase rails are implemented on Stripe (intents plus signed webhook) and Paystack (transaction plus signed charge.success webhook) with KURUKOO_POINTS_PRICE_MINOR pricing; a sandbox top-up is available outside production. Live charging still requires the provider keys and KURUKOO_PAY_PROVIDER to be set in the deployment.', ['View Points', 'View transactions']),
  action('subscriptions-checkout', 'Subscriptions / checkout', 'checkout', '/subscriptions', 'Choose plan / Checkout', 'subscription + payment services', '/checkout and confirmation, preserving plan/payment context', 'BLOCKED_EXTERNAL', 'Payment provider/browser checkout requires external activation and runtime verification.', ['Cancel', 'Review entitlement']),
  action('payments', 'Payments / payment boundary', 'checkout', '/checkout', 'Review / Authorize payment', 'economicRequestRouter + payment adapter', 'Same Economic Request/order and confirmation/dispute context', 'BLOCKED_EXTERNAL', 'Payment is a canonical boundary but live provider settlement is externally dependent.', ['Cancel', 'View receipt']),
] as const;

export const AUTHENTICATED_CAPABILITY_IDS = new Set(AUTHENTICATED_CAPABILITY_COVERAGE.map(item => item.id));

export function getAuthenticatedCapabilityContract(id: string) {
  return AUTHENTICATED_CAPABILITY_COVERAGE.find(item => item.id === id);
}
