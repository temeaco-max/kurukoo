import { buildAICapabilityOrchestration } from '../src/services/aiCapabilityOrchestrator.js';
import { buildConversationTurnContract } from '../src/services/conversationTurnContractService.js';
import type { IntentRoutingResult } from '../src/types.js';

function contract(message: string, activeContextIds: string[] = []) {
  return buildConversationTurnContract({
    latestUserMessage: message,
    userMessage: message,
    activeContextIds,
    knownFacts: [],
    pendingFields: [],
    pausedGoals: [],
    currentGoal: undefined,
    priorAssistantReplies: [],
  });
}

const casual: IntentRoutingResult = { skill: 'general_question', reply: 'placeholder' };
const casualDecision = buildAICapabilityOrchestration(casual, contract('hello'));
if (!casualDecision.shouldTalk || casualDecision.shouldProposeCapability || casualDecision.proposal) {
  throw new Error('Ordinary conversation must remain model conversation without capability proposal');
}

const action: IntentRoutingResult = {
  skill: 'find_worker',
  target_skill: 'find_worker',
  reply: 'I can help find a cleaner.',
  canonicalAction: 'economic_request.create',
  intentConfidence: 0.96,
  extractedEntities: { service: 'house_cleaner', location: 'Ibadan' },
};
const actionDecision = buildAICapabilityOrchestration(action, contract('Please find me a cleaner in Ibadan', ['request:existing']));
if (!actionDecision.shouldProposeCapability || !actionDecision.proposal) {
  throw new Error('Explicit action must produce a bounded capability proposal');
}
if (actionDecision.proposal.capability !== 'find_worker' || actionDecision.proposal.requiresCanonicalValidation !== true) {
  throw new Error('Capability proposal must preserve canonical capability ownership');
}

const canonicalResult: IntentRoutingResult = {
  skill: 'find_worker',
  reply: 'I found two verified options.',
  cardData: { type: 'provider_match', requestId: 'request-1' },
  canonicalAction: 'economic_request.review_match',
};
const resultDecision = buildAICapabilityOrchestration(canonicalResult, contract('Show me the options'));
if (!resultDecision.shouldPresentCanonicalResult) {
  throw new Error('Canonical result must remain available for conversational presentation');
}

const referral: IntentRoutingResult = {
  skill: 'referral',
  reply: 'Your referral link is ready through the Referral QR surface.',
  cardData: { type: 'referral', status: 'ready', destination: '/referral-qr/' },
  canonicalAction: 'referral.invite',
};
const referralDecision = buildAICapabilityOrchestration(referral, contract('Create my referral link'));
if (referralDecision.proposal?.capability !== 'referral' || !referralDecision.proposal.executionPlan?.some(candidate => candidate.capability === 'referral')) {
  throw new Error('Referral routes must resolve through the registered direct referral capability without falling through to an unregistered skill');
}

console.log('AI capability orchestration regression passed');
