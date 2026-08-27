import { listUniversalCapabilities, type CapabilityRisk, type UniversalCapabilityDescriptor, getCanonicalOperationDescriptor } from './universalCapabilityProtocol.js';

export type InteractionPriority = 'background' | 'normal' | 'high' | 'critical';
export type InterruptionMode = 'never' | 'at_trigger' | 'conditional' | 'immediate';
export type GuestAccess = 'allowed' | 'allowed_for_initial_help' | 'blocked';
export type AuthRequirement = 'none' | 'after_initial_help' | 'required_before_action';
export type ConfirmationMode = 'none' | 'contextual' | 'explicit';
export type AutonomyMode = 'none' | 'bounded' | 'long_running';

export interface CapabilityInteractionPolicy {
  capability: string;
  action?: string;
  priority: InteractionPriority;
  interruption: InterruptionMode;
  guestAccess: GuestAccess;
  authentication: AuthRequirement;
  confirmation: ConfirmationMode;
  autonomy: AutonomyMode;
  backgroundAllowed: boolean;
  resumable: boolean;
  preemptsOtherGoals: boolean;
  preservesPriorGoals: boolean;
  exactIdentityRequired: boolean;
  locationMode: 'none' | 'optional' | 'recommended' | 'required';
  voiceMode: 'none' | 'optional' | 'preferred' | 'required';
  externalEvidenceRequired: boolean;
  draftVsCommitRequired: boolean;
  failureMustPreserveContext: boolean;
  notes: string[];
}

const EMERGENCY_TERMS = /(^|[._:-])(emergency|safety|police|ambulance|fire|threat|assault|danger|distress)([._:-]|$)/i;
const REMINDER_TERMS = /(^|[._:-])reminder([._:-]|$)/i;
const AGENT_TERMS = /(^|[._:-])(agent|agent_goal)([._:-]|$)/i;
const PAYMENT_TERMS = /(^|[._:-])(payment|escrow|refund|subscription|order|checkout)([._:-]|$)/i;
const REMOTE_TERMS = /(^|[._:-])(remote|device|connected_resource|linked_device|voice|webrtc|call|dial|wifi|network|printer|camera|cctv|tv|iot|smart_device)([._:-]|$)/i;
const MEMORY_TERMS = /(^|[._:-])memory([._:-]|$)/i;
const CHANNEL_SEND_TERMS = /(^|[._:-])(channel|message|sms|whatsapp|telegram|email)([._:-]|$)/i;
const SECURITY_TERMS = /(^|[._:-])(security|fraud|scam|account|identity|stolen|lost|unauthorized|privacy|breach|malware|virus)([._:-]|$)/i;
const PUBLIC_COMMIT_TERMS = /(^|[._:-])(publish|post|topic|reply|advertising|campaign|referral|points|claim|invite|advert)([._:-]|$)/i;
const OUTCOME_TERMS = /(^|[._:-])(help|fix|solve|check|diagnose|inspect|repair|book|buy|order|find|get|arrange|organise|organize|sort|handle|do|clean|setup|set_up|configure|connect|recover|restore|replace|deliver|send|contact|schedule|monitor|watch|keep_an_eye_on)([._:-]|$)/i;

function riskToConfirmation(risk: CapabilityRisk): ConfirmationMode {
  if (risk === 'confirmation_required' || risk === 'high_risk') return 'explicit';
  return 'none';
}

function policyFromParts(capability: string, family: string, mode: UniversalCapabilityDescriptor['mode'], actions: string[], risk: CapabilityRisk, activationState: UniversalCapabilityDescriptor['activationState'], requiredInputs: UniversalCapabilityDescriptor['context']['requiredInputs'], optionalInputs: UniversalCapabilityDescriptor['context']['optionalInputs']): CapabilityInteractionPolicy {
  const key = `${capability}`;
  const actionKey = actions.join('|');
  const emergency = EMERGENCY_TERMS.test(key) || EMERGENCY_TERMS.test(actionKey) || /\bemergency\b/i.test(family);
  const reminder = REMINDER_TERMS.test(key) || REMINDER_TERMS.test(actionKey) || /reminder/i.test(family);
  const agent = AGENT_TERMS.test(key) || AGENT_TERMS.test(actionKey) || /agent/i.test(family);
  const payment = PAYMENT_TERMS.test(key) || PAYMENT_TERMS.test(actionKey) || risk === 'confirmation_required' && /economic|commerce|subscription|payment/i.test(family);
  const remote = REMOTE_TERMS.test(key) || REMOTE_TERMS.test(actionKey) || /connected-resource|device|digital-services|home-automation/i.test(family);
  const memory = MEMORY_TERMS.test(key) || MEMORY_TERMS.test(actionKey);
  const channelSend = CHANNEL_SEND_TERMS.test(key) || CHANNEL_SEND_TERMS.test(actionKey);
  const security = SECURITY_TERMS.test(key) || SECURITY_TERMS.test(actionKey) || /security|privacy|trust/i.test(family);
  const publicCommit = PUBLIC_COMMIT_TERMS.test(key) || PUBLIC_COMMIT_TERMS.test(actionKey) || /community|advertising|growth|public|attribution|referral|advert/i.test(family);
  const outcome = OUTCOME_TERMS.test(key) || OUTCOME_TERMS.test(actionKey);

  if (emergency) return {
    capability, priority: 'critical', interruption: 'immediate', guestAccess: 'allowed_for_initial_help', authentication: 'after_initial_help', confirmation: 'contextual', autonomy: 'bounded', backgroundAllowed: false, resumable: true, preemptsOtherGoals: true, preservesPriorGoals: true, exactIdentityRequired: false, locationMode: 'recommended', voiceMode: 'preferred', externalEvidenceRequired: true, draftVsCommitRequired: false, failureMustPreserveContext: true,
    notes: ['Emergency/safety capabilities interrupt ordinary onboarding and unrelated goals.', 'Do not require registration before initial emergency assistance when legally and technically unnecessary.', 'Never claim dispatch or connection without external evidence.'],
  };
  if (reminder) return {
    capability, priority: 'high', interruption: 'at_trigger', guestAccess: 'allowed_for_initial_help', authentication: 'after_initial_help', confirmation: 'none', autonomy: 'long_running', backgroundAllowed: true, resumable: true, preemptsOtherGoals: false, preservesPriorGoals: true, exactIdentityRequired: true, locationMode: 'none', voiceMode: 'optional', externalEvidenceRequired: false, draftVsCommitRequired: false, failureMustPreserveContext: true,
    notes: ['Reminder triggers may interrupt a current conversation according to user preference.', 'The pre-trigger conversation remains resumable.'],
  };
  if (agent) return {
    capability, priority: 'high', interruption: 'conditional', guestAccess: 'blocked', authentication: 'required_before_action', confirmation: 'contextual', autonomy: 'long_running', backgroundAllowed: true, resumable: true, preemptsOtherGoals: true, preservesPriorGoals: true, exactIdentityRequired: true, locationMode: 'optional', voiceMode: 'optional', externalEvidenceRequired: false, draftVsCommitRequired: false, failureMustPreserveContext: true,
    notes: ['Agent control commands override the goal they target.', 'Agent autonomy remains bounded by existing runtime quotas and action policy.'],
  };
  if (security) return {
    capability, priority: 'high', interruption: 'conditional', guestAccess: 'allowed_for_initial_help', authentication: 'after_initial_help', confirmation: 'contextual', autonomy: 'bounded', backgroundAllowed: false, resumable: true, preemptsOtherGoals: true, preservesPriorGoals: true, exactIdentityRequired: true, locationMode: 'optional', voiceMode: 'optional', externalEvidenceRequired: activationState !== 'locally_available', draftVsCommitRequired: false, failureMustPreserveContext: true,
    notes: ['Security incidents may interrupt ordinary workflows for initial containment and guidance.', 'Account recovery, identity changes and destructive security actions still require exact authenticated ownership.'],
  };
  if (remote) return {
    capability, priority: 'high', interruption: 'conditional', guestAccess: 'allowed_for_initial_help', authentication: 'after_initial_help', confirmation: risk === 'read_only' ? 'none' : 'explicit', autonomy: 'bounded', backgroundAllowed: false, resumable: true, preemptsOtherGoals: false, preservesPriorGoals: true, exactIdentityRequired: true, locationMode: 'optional', voiceMode: /voice|webrtc|call|dial/i.test(key) ? 'preferred' : 'optional', externalEvidenceRequired: activationState !== 'locally_available', draftVsCommitRequired: channelSend, failureMustPreserveContext: true,
    notes: ['Device and remote help can begin with authorised inspection or explanation before action authorization.', 'Guest users may receive initial troubleshooting guidance; target control still requires exact authenticated ownership.', 'Drafting and sending communications are separate actions.'],
  };
  if (payment) return {
    capability, priority: 'high', interruption: 'conditional', guestAccess: 'blocked', authentication: 'required_before_action', confirmation: 'explicit', autonomy: 'bounded', backgroundAllowed: false, resumable: true, preemptsOtherGoals: false, preservesPriorGoals: true, exactIdentityRequired: true, locationMode: 'optional', voiceMode: 'optional', externalEvidenceRequired: activationState !== 'locally_available', draftVsCommitRequired: true, failureMustPreserveContext: true,
    notes: ['Discussion of price or payment is not authorization.', 'Payment state is authoritative only from the canonical payment owner.'],
  };
  if (publicCommit) return {
    capability, priority: mode === 'external_execution' ? 'high' : 'normal', interruption: 'conditional', guestAccess: mode === 'conversation' ? 'allowed' : 'blocked', authentication: mode === 'conversation' ? 'after_initial_help' : 'required_before_action', confirmation: 'explicit', autonomy: 'none', backgroundAllowed: false, resumable: true, preemptsOtherGoals: false, preservesPriorGoals: true, exactIdentityRequired: true, locationMode: 'none', voiceMode: 'none', externalEvidenceRequired: activationState !== 'locally_available', draftVsCommitRequired: true, failureMustPreserveContext: true,
    notes: ['Public, attribution and financial effects require a separate draft/review/commit boundary.', 'Canonical owners remain responsible for ownership, confirmation, evidence and publication.'],
  };
  if (memory) return {
    capability, priority: 'normal', interruption: 'never', guestAccess: 'allowed_for_initial_help', authentication: 'after_initial_help', confirmation: 'explicit', autonomy: 'none', backgroundAllowed: false, resumable: true, preemptsOtherGoals: false, preservesPriorGoals: true, exactIdentityRequired: true, locationMode: 'none', voiceMode: 'none', externalEvidenceRequired: false, draftVsCommitRequired: false, failureMustPreserveContext: true,
    notes: ['Conversation facts are not automatically persisted as memory without the existing memory policy.', 'Forget operations must target the exact memory object/context.'],
  };
  if (outcome) return {
    capability, priority: mode === 'external_execution' ? 'high' : 'normal', interruption: 'conditional', guestAccess: mode === 'read_only' || mode === 'conversation' ? 'allowed' : 'allowed_for_initial_help', authentication: mode === 'read_only' || mode === 'conversation' ? 'none' : 'after_initial_help', confirmation: riskToConfirmation(risk), autonomy: mode === 'external_execution' ? 'bounded' : 'none', backgroundAllowed: mode === 'read_only' || mode === 'conversation', resumable: true, preemptsOtherGoals: false, preservesPriorGoals: true, exactIdentityRequired: mode !== 'conversation', locationMode: requiredInputs.some(input => /location|address|pickup|destination/i.test(input.key)) ? 'required' : optionalInputs.some(input => /location|address|pickup|destination/i.test(input.key)) ? 'optional' : 'none', voiceMode: mode === 'external_execution' ? 'optional' : 'none', externalEvidenceRequired: activationState !== 'locally_available', draftVsCommitRequired: risk === 'confirmation_required', failureMustPreserveContext: true,
    notes: ['Start from the user outcome and use the existing capability composition to accomplish it.', 'Ask only for information that is actually needed for the next useful action.', 'Continue the same outcome when more information, permission, a provider or an external system becomes necessary.'],
  };
  return {
    capability,
    priority: mode === 'external_execution' ? 'high' : mode === 'state_change' ? 'normal' : 'background',
    interruption: mode === 'external_execution' ? 'conditional' : 'never',
    guestAccess: mode === 'read_only' || mode === 'conversation' ? 'allowed' : 'blocked',
    authentication: mode === 'read_only' || mode === 'conversation' ? 'none' : 'required_before_action',
    confirmation: riskToConfirmation(risk),
    autonomy: 'none',
    backgroundAllowed: mode === 'read_only' || mode === 'conversation',
    resumable: true,
    preemptsOtherGoals: false,
    preservesPriorGoals: true,
    exactIdentityRequired: mode !== 'conversation',
    locationMode: requiredInputs.some(input => /location|address|pickup|destination/i.test(input.key)) ? 'required' : optionalInputs.some(input => /location|address|pickup|destination/i.test(input.key)) ? 'optional' : 'none',
    voiceMode: mode === 'external_execution' ? 'optional' : 'none',
    externalEvidenceRequired: activationState !== 'locally_available',
    draftVsCommitRequired: false,
    failureMustPreserveContext: true,
    notes: ['Canonical domain services remain authoritative for state, authorization, execution and evidence.'],
  };
}

export function deriveCapabilityInteractionPolicy(descriptor: UniversalCapabilityDescriptor): CapabilityInteractionPolicy {
  return policyFromParts(descriptor.capability, descriptor.family, descriptor.mode, descriptor.actions, descriptor.risk, descriptor.activationState, descriptor.context.requiredInputs, descriptor.context.optionalInputs);
}
export async function getCapabilityInteractionPolicy(capability: string): Promise<CapabilityInteractionPolicy | null> { const direct = getCanonicalOperationDescriptor(capability); if (direct) return deriveCapabilityInteractionPolicy(direct); const descriptors = await listUniversalCapabilities(); const descriptor = descriptors.find(item => item.capability === capability); return descriptor ? deriveCapabilityInteractionPolicy(descriptor) : null; }
export function deriveInteractionPolicyForCapabilityName(capability: string, fallback: Partial<UniversalCapabilityDescriptor> = {}): CapabilityInteractionPolicy { return policyFromParts(capability, fallback.family || 'uncategorized', fallback.mode || 'conversation', fallback.actions || ['answer', 'clarify', 'continue'], fallback.risk || 'read_only', fallback.activationState || 'locally_available', fallback.context?.requiredInputs || [], fallback.context?.optionalInputs || []); }
export async function getAllCapabilityInteractionPolicies(): Promise<CapabilityInteractionPolicy[]> { const descriptors = await listUniversalCapabilities(); return descriptors.map(deriveCapabilityInteractionPolicy); }
export function policyAllowsGuestInitialAction(policy: CapabilityInteractionPolicy): boolean { return policy.guestAccess === 'allowed' || policy.guestAccess === 'allowed_for_initial_help'; }
export function shouldInterruptCurrentConversation(policy: CapabilityInteractionPolicy): boolean { return policy.interruption === 'immediate' || policy.interruption === 'at_trigger' || (policy.interruption === 'conditional' && policy.priority === 'high'); }
