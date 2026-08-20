import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const seed = String(process.env.KURUKOO_SCENARIO_SEED || 'kurukoo-provider-outcome-lab-v1');
const target = Math.max(1, Number(process.env.KURUKOO_SCENARIO_TARGET || 24000));
const shouldExecute = process.argv.includes('--execute');
const outputDir = path.join(process.cwd(), 'data', 'scenario-lab');
const mlDir = path.join(process.cwd(), 'ml', 'datasets');

const markets = [
  { key: 'ng', locale: 'ng:en', dialect: 'nigerian-english', currency: 'NGN', geography: 'Ikeja, Lagos', postcode: '100001', lowBandwidth: true },
  { key: 'ng-pidgin', locale: 'ng:pidgin', dialect: 'pidgin', currency: 'NGN', geography: 'Yaba, Lagos', postcode: '100213', lowBandwidth: true },
  { key: 'ng-hausa', locale: 'ng:hausa-influenced', dialect: 'hausa-influenced', currency: 'NGN', geography: 'Abuja', postcode: '900001', lowBandwidth: true },
  { key: 'gb', locale: 'gb:en', dialect: 'uk-english', currency: 'GBP', geography: 'London', postcode: 'SW1A 1AA', lowBandwidth: false },
  { key: 'gb-regional', locale: 'gb:en', dialect: 'uk-english', currency: 'GBP', geography: 'Manchester', postcode: 'M1 1AE', lowBandwidth: false },
  { key: 'ca', locale: 'ca:en', dialect: 'canadian-english', currency: 'CAD', geography: 'Toronto, Ontario', postcode: 'M5V 3A8', lowBandwidth: false },
  { key: 'ca-fr', locale: 'ca:fr', dialect: 'canadian-french', currency: 'CAD', geography: 'Montreal, Quebec', postcode: 'H2Y 1C6', lowBandwidth: false },
];
const channels = ['web_chat', 'pwa', 'whatsapp', 'telegram', 'sms', 'ussd', 'email', 'voice', 'linked_device', 'qr_context'];
const actors = ['consumer', 'provider', 'business', 'contributor', 'agent', 'support_operator'];
const providerTypes = ['individual', 'business', 'community_provider', 'delivery_provider', 'seller', 'professional'];
const lifecycleVariants = [
  ['normal', 'requested → matched → selected → quoted → authorized → executing → evidenced → completed'],
  ['ambiguous', 'requested → clarification → corrected → matched'],
  ['interrupted', 'requested → matched → paused → resumed'],
  ['corrected', 'requested → wrong_assumption → correction → replanned'],
  ['provider_failure', 'selected → unavailable → rediscovery'],
  ['quote_change', 'indicative_quote → provider_quote → changed_quote → user_decision'],
  ['payment_failure', 'authorization → payment_failed → retry_or_cancel'],
  ['cancellation', 'selected → cancelled → terminal'],
  ['execution_failure', 'executing → failed → recovery'],
  ['evidence_failure', 'executing → insufficient_evidence → review'],
  ['delivery_failure', 'dispatch → delayed_or_failed → recovery'],
  ['dispute', 'completed → disputed → review → resolution'],
  ['notification_failure', 'state_changed → notification_failed → conversation_resume'],
  ['channel_interruption', 'channel_a → identity_check → channel_b → continuation'],
  ['context_conflict', 'request_a_active → request_b_active → explicit_identity_selection'],
  ['duplicate_action', 'action → replay → idempotent_same_state'],
  ['stale_action', 'stale_card → fail_closed → current_context'],
  ['safety_boundary', 'request → consent_or_escalation → bounded_response'],
  ['legal_boundary', 'request → jurisdiction_check → fail_closed_or_escalate'],
  ['locale_variant', 'natural_locale_request → canonical_interpretation → same_lifecycle'],
] as const;
const executionBoundaries = ['none_information_only', 'development_connector', 'sandbox_payment', 'external_provider_activation', 'external_channel_activation', 'human_confirmation_required'];
const uiStates = ['clarification', 'choice', 'provider_card', 'quote', 'confirmation', 'payment', 'escrow', 'execution', 'evidence', 'notification', 'error', 'recovery', 'completion', 'follow_up'];
const externalDependencies = ['none', 'provider_verification', 'provider_availability', 'payment_provider', 'delivery_connector', 'channel_credentials', 'push_registration', 'voice_provider', 'legal_review'];
const readiness = ['LOCALLY_COMPLETE', 'DEVELOPMENT_FIXTURE_COMPLETE', 'REPOSITORY_READY_EXTERNAL_ACTIVATION_REQUIRED', 'STRUCTURALLY_INCOMPLETE', 'BLOCKED_BY_EXTERNAL_DEPENDENCY', 'INTENTIONALLY_UNSUPPORTED'];

function hash(input: string): string { return crypto.createHash('sha256').update(`${seed}:${input}`).digest('hex'); }
function pick<T>(values: readonly T[], key: string): T { return values[Number.parseInt(hash(key).slice(0, 8), 16) % values.length]; }
function stableIndex(key: string, max: number): number { return Number.parseInt(hash(key).slice(0, 8), 16) % max; }
const trajectoryHorizons = [5, 10, 20, 40, 80, 81] as const;
const conversationalNoise = ['please', 'abeg', 'sorry, quick one', 'wait', 'actually', 'lol', 'pls', 'I mean', 'small correction', 'same one', 'pls help im stressed', 'where can i get this', 'need help asap', 'I dont know what to do', 'same place??'];
const pivotTopics = ['a reminder', 'my points', 'a safety check-in', 'another request', 'a provider question', 'my saved context', 'a channel issue'];
function makeTrajectory(rowKey: string, userMessage: string, lifecycleVariant: string, horizon: number): Array<{ role: 'user' | 'assistant'; content: string; turn: number; activeGoals: string[] }> {
  const noise = conversationalNoise[stableIndex(`${rowKey}:noise`, conversationalNoise.length)];
  const pivot = pivotTopics[stableIndex(`${rowKey}:pivot`, pivotTopics.length)];
  const goals = ['primary_request', pivot.replaceAll(' ', '_'), 'preserve_canonical_identity'];
  const base = [
    userMessage,
    `I understand the ${lifecycleVariant.replaceAll('_', ' ')} context. I will keep the canonical object and any other active goal separate.`,
    `${noise}, before we continue, can we handle ${pivot} first?`,
    `Yes. I will pause the first context without cancelling it and answer only what is safe to answer here.`,
    `Correction: I meant the other one, the same place, not a new request.`,
    `I will resolve that relative reference only from the conversation and explicit owner-scoped identity; I will ask if it is ambiguous.`,
    `Please come back to the earlier request when this is done.`,
    `We can resume it now, subject to the canonical state and any required confirmation.`,
    `If the option is unavailable, tell me plainly and keep the next safe step resumable.`,
    `I have not approved payment, disclosure, delivery, verification, or completion merely by discussing it.`,
  ];
  const messages: Array<{ role: 'user' | 'assistant'; content: string; turn: number; activeGoals: string[] }> = [];
  for (let turn = 0; turn < horizon; turn += 1) {
    messages.push({ role: turn % 2 === 0 ? 'user' : 'assistant', content: base[turn % base.length], turn: turn + 1, activeGoals: goals.slice(0, turn % goals.length + 1) });
  }
  return messages;
}
function phrase(skill: string, variant: string, market: typeof markets[number]): string {
  const label = skill.replaceAll('_', ' ');
  if (variant === 'ambiguous') return `Can you help with ${label}, or should I find someone myself?`;
  if (variant === 'interrupted') return `Before we continue with ${label}, I need to ask about something else.`;
  if (variant === 'corrected') return `Correction: the details for my ${label} request were wrong. Update the same request, not another one.`;
  if (variant === 'unavailable') return `If no verified ${label} provider is available in ${market.geography}, tell me honestly and keep the request resumable.`;
  if (variant === 'channel_interruption') return `Continue my ${label} request from this channel while preserving the same canonical request.`;
  if (variant === 'safety_boundary') return `Help me with ${label} while protecting consent, privacy, and any safety boundary that applies.`;
  if (variant === 'cancellation') return `Please cancel the ${label} request and do not create another one; tell me what remains reversible.`;
  if (variant === 'notification_failure') return `I have not seen the update for ${label}; postpone any next step until you confirm the current state.`;
  if (variant === 'legal_boundary') return `Can this ${label} request proceed lawfully in ${market.key}? If not, explain the safe next step.`;
  return `I need help with ${label} in ${market.geography}.`;
}
function classify(skill: string, mode: string, variant: string, dependency: string): { finalState: string; status: string; failure?: string } {
  if (mode !== 'economic') return { finalState: 'bounded_non_economic_response', status: 'LOCALLY_COMPLETE' };
  if (variant === 'legal_boundary' || variant === 'safety_boundary') return { finalState: 'consent_or_escalation', status: 'REPOSITORY_READY_EXTERNAL_ACTIVATION_REQUIRED' };
  if (variant === 'provider_failure' || variant === 'payment_failure' || variant === 'execution_failure' || variant === 'delivery_failure' || variant === 'evidence_failure') return { finalState: 'recovery_or_deferred', status: 'DEVELOPMENT_FIXTURE_COMPLETE', failure: variant };
  if (dependency !== 'none') return { finalState: 'awaiting_external_evidence', status: 'BLOCKED_BY_EXTERNAL_DEPENDENCY' };
  return { finalState: variant === 'normal' ? 'development_fixture_complete' : 'conversation_resumable', status: 'DEVELOPMENT_FIXTURE_COMPLETE' };
}

const { getAllCatalogueSkillNames, getCatalogueStats } = await import('../src/services/skillCatalogueConvergence.js');
const { buildSkillExecutionContract } = await import('../src/services/skillExecutionContract.js');
const catalogue = getCatalogueStats();
const skills = getAllCatalogueSkillNames();
if (skills.length !== catalogue.total) throw new Error(`Converged scenario catalogue mismatch: expected ${catalogue.total}, found ${skills.length}`);
const executionLimit = Math.max(skills.length, Number(process.env.KURUKOO_SCENARIO_EXECUTION_LIMIT || 1000));
const rows: any[] = [];
for (let i = 0; i < skills.length; i += 1) {
  const skill = skills[i];
  const contract = buildSkillExecutionContract(skill);
  for (let variantIndex = 0; variantIndex < lifecycleVariants.length; variantIndex += 1) {
    for (let marketIndex = 0; marketIndex < markets.length; marketIndex += 1) {
      const variant = lifecycleVariants[variantIndex];
      const market = markets[marketIndex];
      const key = `${skill}:${variant[0]}:${market.key}`;
      const channel = pick(channels, `${key}:channel`);
      const actor = pick(actors, `${key}:actor`);
      const providerType = pick(providerTypes, `${key}:provider`);
      const dependency = pick(externalDependencies, `${key}:dependency`);
      const state = classify(skill, contract.mode, variant[0], dependency);
      const horizon = trajectoryHorizons[stableIndex(`${key}:horizon`, trajectoryHorizons.length)];
      const trajectory = makeTrajectory(key, phrase(skill, variant[0], market), variant[0], horizon);
      const scenario = {
        scenarioId: `pol:${hash(key).slice(0, 20)}`,
        seed,
        skill,
        family: contract.category || 'uncategorized',
        mode: contract.mode,
        market: market.key,
        locale: market.locale,
        dialect: market.dialect,
        actor,
        providerType,
        channel,
        linkedDevice: channel === 'linked_device',
        qrContext: channel === 'qr_context',
        userMessage: phrase(skill, variant[0], market),
        trajectory,
        turnCount: trajectory.length,
        horizon,
        activeGoalCount: new Set(trajectory.flatMap((message) => message.activeGoals)).size,
        lifecycleVariant: variant[0],
        lifecycle: variant[1],
        canonicalServices: ['canonicalChatTurnService', 'intentRouter', 'contextArbitration', 'skillFlows', 'discoveryNetwork', 'agenticStorefront', 'executionConnector', 'pushNotifications'],
        capabilities: contract.capabilities,
        requirementKeys: contract.requirements.map((requirement) => requirement.key),
        uiStates: uiStates.slice(0, 3 + stableIndex(key, uiStates.length - 2)),
        executionBoundary: pick(executionBoundaries, `${key}:boundary`),
        evidenceRequirements: ['owner_scoped_identity', 'provider_or_source_provenance', 'state_change_evidence'],
        externalDependencies: dependency === 'none' ? [] : [dependency],
        finalState: state.finalState,
        result: state.finalState,
        failure: state.failure || null,
        rootCause: state.failure ? `${state.failure}: canonical boundary or external dependency requires recovery` : null,
        repair: state.failure ? 'Use the existing canonical recovery, retry, cancellation, or escalation path; do not fabricate completion.' : null,
        readinessClassification: state.status,
        forbiddenClaims: ['live availability', 'provider verification without evidence', 'payment settlement', 'delivery', 'completion without evidence'],
        evaluation: {
          naturalness: 'candidate_requires_model_grading', contextRetention: true, goalRetention: true,
          interruptionHandling: variant[0] === 'interrupted' || variant[0] === 'context_conflict', correctionHandling: variant[0] === 'corrected',
          clarificationQuality: variant[0] === 'ambiguous', ambiguityHandling: variant[0] === 'ambiguous' || variant[0] === 'context_conflict',
          relativeReferenceResolution: true, multiGoalTracking: true, actionTransitionAccuracy: 'canonical_probe_required', schemaAdherence: 'canonical_service_required',
          hallucinationRate: 'must_be_zero_for_canonical_claims', unnecessaryQuestionRate: 'model_grade_required', prematureActionRate: 'must_be_zero',
          memoryContamination: 'must_be_zero', safetyCompliance: variant[0] === 'safety_boundary' ? 'required' : 'not_applicable',
          failureRecovery: ['recovery', 'provider_failure', 'payment_failure', 'execution_failure', 'delivery_failure', 'evidence_failure'].includes(variant[0]),
        },
        provenance: { source: 'canonical Kurukoo registries', synthetic: true, productionUserData: false },
      };
      rows.push(scenario);
    }
  }
}
rows.sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));
const selected = rows.length > target ? rows.slice(0, target) : rows;
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(mlDir, { recursive: true });
const jsonl = `${selected.map((row) => JSON.stringify(row)).join('\n')}\n`;
const scenarioPath = path.join(outputDir, 'provider-outcome-scenarios.jsonl');
fs.writeFileSync(scenarioPath, jsonl);
const trainingPath = path.join(mlDir, 'kurukoo-provider-outcome-lab-v1.all.jsonl');
fs.writeFileSync(trainingPath, `${selected.map((row) => JSON.stringify({ messages: row.trajectory, labels: { scenarioId: row.scenarioId, skill: row.skill, family: row.family, mode: row.mode, market: row.market, locale: row.locale, dialect: row.dialect, actor: row.actor, providerType: row.providerType, channel: row.channel, linkedDevice: row.linkedDevice, qrContext: row.qrContext, lifecycle: row.lifecycleVariant, turnCount: row.turnCount, horizon: row.horizon, activeGoalCount: row.activeGoalCount, evaluation: row.evaluation, result: row.result, failure: row.failure, rootCause: row.rootCause, repair: row.repair, readiness: row.readinessClassification, canonicalServices: row.canonicalServices, uiStates: row.uiStates, executionBoundary: row.executionBoundary, evidenceRequirements: row.evidenceRequirements, externalDependencies: row.externalDependencies, canonicalEntry: 'canonicalChatTurnService', authorityBoundary: 'canonical_domain_services' }, provenance: row.provenance, privacy: { synthetic: true, containsPersonalData: false } })).join('\n')}\n`);

const resultRows: any[] = [];
let executedScenarioCount = 0;
if (shouldExecute) {
  process.env.DB_PATH = path.join(outputDir, 'scenario-lab-execution.sqlite');
  const { routeIntent } = await import('../src/services/intentRouter.js');
  const executionRows: any[] = [];
  const perSkill = new Set<string>();
  for (const row of selected) {
    if (perSkill.has(row.skill)) continue;
    perSkill.add(row.skill);
    executionRows.push(row);
    if (executionRows.length >= executionLimit) break;
  }
  if (executionRows.length < executionLimit) {
    for (const row of selected) {
      if (executionRows.length >= executionLimit) break;
      if (executionRows.includes(row)) continue;
      executionRows.push(row);
    }
  }
  executedScenarioCount = executionRows.length;
  for (const row of executionRows) {
    try {
      const result = await routeIntent(row.userMessage, `anon_lab_${row.scenarioId}`, undefined);
      resultRows.push({ scenarioId: row.scenarioId, skill: row.skill, market: row.market, locale: row.locale, channel: row.channel, actor: row.actor, lifecycleVariant: row.lifecycleVariant, resultSkill: result.skill, cardType: result.cardData?.type || null, stage: result.cardData?.stage || null, canonicalAction: result.canonicalAction || null, result: result.cardData ? 'canonical_route_represented' : 'bounded_without_card', failure: null, rootCause: null, repair: null, readinessClassification: row.readinessClassification, status: result.cardData ? 'passed' : 'bounded_without_card' });
    } catch (error) {
      resultRows.push({ scenarioId: row.scenarioId, skill: row.skill, status: 'failed', error: error instanceof Error ? error.message : String(error) });
    }
  }
}
const resultPath = path.join(outputDir, 'provider-outcome-execution-results.jsonl');
if (shouldExecute) fs.writeFileSync(resultPath, `${resultRows.map((row) => JSON.stringify(row)).join('\n')}\n`);
const counts = (values: string[]) => Object.fromEntries([...new Set(values)].map((value) => [value, values.filter((item) => item === value).length]));
const manifest = {
  schemaVersion: 1,
  seed,
  generatedCount: selected.length,
  fullUniverseCount: rows.length,
  target,
  executedCount: resultRows.length,
  executedPassed: resultRows.filter((row) => row.status !== 'failed').length,
  executedFailed: resultRows.filter((row) => row.status === 'failed').length,
  skillCount: skills.length,
  catalogue,
  familyCount: new Set(selected.map((row) => row.family)).size,
  coverage: {
    skills: skills.length,
    families: new Set(selected.map((row) => row.family)).size,
    markets: [...new Set(selected.map((row) => row.market))],
    locales: [...new Set(selected.map((row) => row.locale))],
    dialects: [...new Set(selected.map((row) => row.dialect))],
    channels: [...new Set(selected.map((row) => row.channel))],
    actors: [...new Set(selected.map((row) => row.actor))],
    providerTypes: [...new Set(selected.map((row) => row.providerType))],
    lifecycleVariants: [...new Set(selected.map((row) => row.lifecycleVariant))],
    readiness: counts(selected.map((row) => row.readinessClassification)),
    linkedDevices: selected.filter((row) => row.linkedDevice).length,
    qrContexts: selected.filter((row) => row.qrContext).length,
    horizons: Object.fromEntries(trajectoryHorizons.map((horizon) => [String(horizon), selected.filter((row) => row.horizon === horizon).length])),
    totalTurns: selected.reduce((sum, row) => sum + row.turnCount, 0),
    averageTurns: selected.reduce((sum, row) => sum + row.turnCount, 0) / selected.length,
    multiGoalTrajectories: selected.filter((row) => row.activeGoalCount >= 3).length,
  },
  fileSha256: { scenarios: crypto.createHash('sha256').update(jsonl).digest('hex'), training: crypto.createHash('sha256').update(fs.readFileSync(trainingPath)).digest('hex') },
  executionMode: shouldExecute ? 'isolated_stratified_canonical_route_probe' : 'generation_only',
  executionLimit: executedScenarioCount,
  sourceOfTruth: ['src/services/skillCatalogueConvergence.ts', 'src/services/skillExecutionContract.ts', 'src/services/intentRouter.ts', 'src/services/canonicalChatTurnService.ts', 'src/services/discoveryNetwork.ts', 'src/services/agenticStorefront.ts', 'src/services/executionConnector.ts'],
  normalRuntimeDependsOnUniverse: false,
  syntheticOnly: true,
  externalCapabilitiesClaimed: false,
  readinessVocabulary: readiness,
  trajectoryHorizons,
  gradingDimensions: ['naturalness', 'contextRetention', 'goalRetention', 'interruptionHandling', 'correctionHandling', 'clarificationQuality', 'ambiguityHandling', 'relativeReferenceResolution', 'multiGoalTracking', 'actionTransitionAccuracy', 'schemaAdherence', 'hallucinationRate', 'unnecessaryQuestionRate', 'prematureActionRate', 'memoryContamination', 'safetyCompliance', 'latency', 'tokenUsage', 'inferenceCost', 'failureRecovery'],
  failureOwnershipLabels: ['model_capability', 'prompt_context_construction', 'memory_assembly', 'intent_arbitration', 'slot_extraction', 'canonical_action_proposal', 'ui_card_transition', 'deterministic_backend_state'],
  contextPatterns: ['ambiguity', 'interruption', 'correction', 'delayed-answer', 'topic-resumption', 'simultaneous-contexts', 'explicit-object-identity', 'relative-reference', 'emotional-language', 'slang', 'typo', 'incomplete-utterance', 'cancellation', 'postponement'],
};
const manifestPath = path.join(outputDir, 'provider-outcome-scenario-lab.manifest.json');
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ manifestPath, scenarioPath, trainingPath, resultPath: shouldExecute ? resultPath : undefined, ...manifest }, null, 2));
