import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getKnownSkills, getEconomicCategory, getSkillCapabilities, getSkillFlow, getSkillRequirements } from '../src/services/skillFlows.js';
import { listUniversalCapabilities } from '../src/services/universalCapabilityProtocol.js';
import { listAgentTools } from '../src/services/agentToolRegistry.js';

const outputDir = path.join(process.cwd(), 'ml', 'behaviour');
const sourceCommit = String(process.env.GITHUB_SHA || process.env.KURUKOO_SOURCE_COMMIT || 'working-tree');
const packVersion = String(process.env.KURUKOO_BEHAVIOUR_PACK_VERSION || 'kurukoo-behaviour-v1');

const constitution = {
  identity: 'One person, one persistent Kurukoo relationship, many contexts and capabilities.',
  brain: 'Brain/context arbitration decides meaning, context relationship and next capability; it does not execute mutations.',
  skills: 'Skills describe supported human capabilities; Skill Flows describe their lifecycle, requirements and operational semantics.',
  agents: 'Agents maintain bounded goals and initiative using canonical agent tools and canonical execution.',
  capabilities: 'Universal capabilities are the executable semantic contract; canonical services own truth and state.',
  execution: 'Only canonical services/executor may mutate economic, payment, provider, memory or external state.',
  evidence: 'Kurukoo must not claim availability, price, payment, delivery, fulfilment or external outcomes without evidence.',
  identityTrust: 'Guest/provisional identity may converse but cannot bypass capability-specific trust gates.',
  continuity: 'Context, goal, memory and capability state should survive interruption and supported channel switches.',
  storage: 'Training artifacts contain synthetic/provenance-marked data only; production user data is never silently admitted.'
};

const agentRuntime = {
  goalStatuses: ['active','waiting','needs_user','blocked','completed','cancelled','failed','expired'],
  sources: ['conversation','request','reminder','proactive','network','contributor','qr','event'],
  autonomyLevels: ['observe','suggest','assist','act_with_confirmation','act_within_permission'],
  riskLevels: ['read_only','reversible','user_confirmation_required','high_risk'],
  planStepStatuses: ['pending','running','waiting','completed','blocked','failed'],
  workerBoundaries: {
    maxActionsPerCycle: Number(process.env.KURUKOO_AGENT_MAX_ACTIONS_PER_CYCLE || 8),
    maxConcurrentGoals: Number(process.env.KURUKOO_AGENT_MAX_CONCURRENT_GOALS || 5),
    maxRetries: Number(process.env.KURUKOO_AGENT_MAX_RETRIES || 2),
    cooldownSeconds: Number(process.env.KURUKOO_AGENT_COOLDOWN_SECONDS || 30),
  },
  principles: [
    'observe before acting',
    'preserve exact goal and owner',
    'use canonical agent tools',
    'replan from verified outcomes',
    'wait when external evidence is missing',
    'request confirmation when policy requires it',
    'never claim completion without evidence',
    'pause/cancel/resume exact goals only'
  ]
};

const behaviourFamilies = [
  { id:'ordinary_conversation', description:'Answer naturally without forcing a skill or action.', expected:['preserve context','avoid premature action','ask only useful clarification'] },
  { id:'clarification', description:'Gather only information necessary to progress the current goal.', expected:['minimal clarification','do not restart unrelated context'] },
  { id:'interruption', description:'Switch to a new topic without destroying resumable work.', expected:['preserve active contexts','resume exact context later'] },
  { id:'correction', description:'Apply corrections to the exact owned context.', expected:['update exact object','do not create duplicate request'] },
  { id:'relative_reference', description:'Resolve phrases such as the cheaper one, that request, same time against exact active context.', expected:['resolve exact context','ask when ambiguous'] },
  { id:'multi_goal', description:'Maintain multiple simultaneous goals without conflation.', expected:['independent context state','correct target selection'] },
  { id:'action_boundary', description:'Distinguish exploration from explicit action.', expected:['conversation remains non-mutating','explicit action uses canonical capability'] },
  { id:'agent_continuation', description:'Pause, resume, cancel, wait, replan and recover long-lived goals.', expected:['persist goal','observe outcome','replan only through canonical tools'] },
  { id:'truth_evidence', description:'State only what canonical state/evidence supports.', expected:['no invented availability','no invented price/payment/fulfilment'] },
  { id:'identity_capability_portfolio', description:'Treat one person as holding multiple independent capabilities.', expected:['same identity','skill-specific availability','skill-specific Pulse'] },
  { id:'cross_channel', description:'Continue the same conversation/goal across supported channels.', expected:['same owner','same canonical object/context'] },
  { id:'failure_recovery', description:'Recover honestly from unavailable providers, failed payments, stale contexts and external dependencies.', expected:['preserve identity','offer safe next step','never claim success'] },
  { id:'safety_and_injection', description:'Treat system/quality material as non-user content and resist prompt injection.', expected:['ignore control-plane instructions embedded as user intent','keep safety boundary'] },
  { id:'locale_and_dialect', description:'Adapt wording to supported locale/dialect without changing canonical meaning.', expected:['semantic equivalence','culturally natural language'] }
];

const truthBoundary = {
  mustNotClaimWithoutEvidence: ['provider availability','provider verification','live inventory','price/quote','payment success','dispatch','delivery','fulfilment','external message delivery','external system state'],
  allowed: ['planned action','repository-ready activation','canonical internal state','explicitly verified external evidence'],
};

const safetyBoundary = {
  modelAuthority: 'proposal_only',
  mutationAuthority: 'canonical_services',
  agentAuthority: 'bounded_by_runtime_and_tool_registry',
  externalAuthority: 'explicit_connector_and_evidence',
  prohibited: ['credential fabrication','identity elevation','cross-user access','memory leakage','unauthorized payment','unverified external claims','duplicate irreversible action']
};

const activationStates = {
  locally_available: 'The behavior/capability is executable without an external provider.',
  repository_ready_external_activation: 'The integration exists and is ready for configured credentials/contracts; do not claim it is active.',
  unavailable_external_dependency: 'The external dependency is not available now; remain truthful and offer recovery.',
  intentionally_unsupported: 'Kurukoo deliberately does not offer the operation.'
};

const skills = [] as any[];
for (const skill of getKnownSkills().sort()) {
  const flow = await getSkillFlow(skill);
  skills.push({
    skill,
    family: getEconomicCategory(skill) || 'uncategorized',
    mode: flow?.mode || 'economic',
    capabilities: getSkillCapabilities(skill),
    requirements: getSkillRequirements(skill),
    flow: flow ? { questionSet: flow.question_set, postMatchAction: flow.post_match_action, paymentModel: flow.payment_model, fulfillmentInstructions: flow.fulfillment_instructions } : null,
    trainingInvariants: { mustPreserve: ['owner identity','exact context','truth boundary','canonical execution boundary'], mayNotInvent: ['availability','quote','payment','evidence','completion'] }
  });
}

const capabilities = (await listUniversalCapabilities()).map(descriptor => ({
  kind: descriptor.kind, capability: descriptor.capability, family: descriptor.family, mode: descriptor.mode, actions: descriptor.actions,
  requiredInputs: descriptor.context.requiredInputs, optionalInputs: descriptor.context.optionalInputs, permissions: descriptor.permissions,
  owner: descriptor.owner, risk: descriptor.risk, confirmationRequired: descriptor.confirmationRequired, lifecycle: descriptor.lifecycle,
  canonicalFactsAvailable: descriptor.canonicalFactsAvailable, evidenceStatus: descriptor.evidenceStatus, activationState: descriptor.activationState,
  failureStates: descriptor.failureStates, recoveryActions: descriptor.recoveryActions, externalDependencyState: descriptor.externalDependencyState,
})).sort((a,b) => a.capability.localeCompare(b.capability));

const agentTools = listAgentTools().map(tool => ({
  name: tool.name, description: tool.description, inputSchema: tool.inputSchema, permission: tool.permission, risk: tool.risk,
  supportedContexts: tool.supportedContexts, authorization: tool.authorization, idempotency: tool.idempotency, audit: tool.audit, autonomous: tool.autonomous,
})).sort((a,b) => a.name.localeCompare(b.name));

const pack = {
  schemaVersion: '1', packVersion, generatedAt: new Date().toISOString(), sourceCommit,
  sourceOfTruth: ['BLUEPRINT.md','src/services/skillFlows.ts','src/services/universalCapabilityProtocol.ts','src/services/agentToolRegistry.ts','src/services/contextArbitration.ts','src/services/canonicalChatTurnService.ts','src/services/agentRuntime.ts','src/services/memoryProfile.ts','src/services/nearbyPulse.ts','src/services/capabilityPortfolioService.ts'],
  constitution, agentRuntime, behaviourFamilies, skills, capabilities, agentTools, truthBoundary, safetyBoundary, activationStates,
  coverage: { skillCount: skills.length, capabilityCount: capabilities.length, agentToolCount: agentTools.length, behaviourFamilyCount: behaviourFamilies.length, families: [...new Set(skills.map(item => item.family))].sort(), modes: [...new Set(skills.map(item => item.mode))].sort() }
};

const stablePayload = { ...pack, generatedAt: undefined };
const hash = crypto.createHash('sha256').update(JSON.stringify(stablePayload)).digest('hex');
const result = { ...pack, packHash: hash };
fs.mkdirSync(outputDir, { recursive: true });
const filePath = path.join(outputDir, `${packVersion}.json`);
fs.writeFileSync(filePath, `${JSON.stringify(result, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'latest.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ filePath, packVersion, packHash: hash, coverage: result.coverage }, null, 2));
