import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ensureCapabilityFoundation } from '../src/services/capabilityFoundation.js';
import { listCapabilityRegistrations, type CapabilityRegistration } from '../src/services/capabilityRegistry.js';
import { getAllConvergedSkillNames, getConvergedSkillBehaviour } from '../src/services/skillBehaviourConvergence.js';
import { buildSkillExecutionContract } from '../src/services/skillExecutionContract.js';

const datasetVersion = String(process.env.KURUKOO_DATASET_VERSION || 'kurukoo-core-v2');
const outputDir = path.join(process.cwd(), 'ml', 'datasets');
const actors = ['consumer', 'provider', 'business', 'contributor', 'agent', 'support_operator'];
const channels = ['web_chat', 'pwa', 'whatsapp', 'telegram', 'sms', 'ussd', 'email', 'voice', 'linked_device'];
const locales = ['ng:en', 'ng:pidgin', 'ng:hausa-influenced', 'gh:en', 'gb:en', 'ca:en', 'ca:fr'];
const surfaces = ['memory', 'reminders', 'notifications', 'points', 'subscriptions', 'topics', 'media', 'support', 'products', 'orders', 'cart', 'discovery', 'provider_interaction', 'safety', 'consent', 'payment_boundary', 'locale', 'dialect', 'agent_representation', 'commercial_ledger'];
const skillVariants = [
  { key: 'normal', user: (skill: string) => `I need help with ${skill.replaceAll('_', ' ')}.`, lifecycle: 'requested' },
  { key: 'ambiguity', user: (skill: string) => `Can you handle ${skill.replaceAll('_', ' ')} for me, or do I need to find someone myself?`, lifecycle: 'clarifying' },
  { key: 'interruption', user: (skill: string) => `Before we continue with ${skill.replaceAll('_', ' ')}, I need to ask about something else.`, lifecycle: 'paused' },
  { key: 'correction', user: (skill: string) => `Correction: the details I gave for ${skill.replaceAll('_', ' ')} were wrong. Please update the request, not a different one.`, lifecycle: 'clarifying' },
  { key: 'unavailable', user: (skill: string) => `If no verified option is available for ${skill.replaceAll('_', ' ')}, tell me honestly and offer a safe next step.`, lifecycle: 'failed' },
  { key: 'consent', user: (skill: string) => `What do you need my consent or confirmation for before proceeding with ${skill.replaceAll('_', ' ')}?`, lifecycle: 'awaiting_confirmation' },
  { key: 'channel', user: (skill: string) => `Continue my ${skill.replaceAll('_', ' ')} request from this channel and keep the same context.`, lifecycle: 'resumed' },
  { key: 'recovery', user: (skill: string) => `The ${skill.replaceAll('_', ' ')} request did not complete. Help me recover or resume it without creating a duplicate.`, lifecycle: 'failed' },
  { key: 'linked_device', user: (skill: string) => `I am continuing my ${skill.replaceAll('_', ' ')} request from a linked device. Keep the same identity and object context.`, lifecycle: 'resumed' },
];
const capabilityVariants = [
  { key: 'inspect', user: (name: string) => `Please show me the current status for ${name}.`, lifecycle: 'requested' },
  { key: 'action', user: (name: string, action: string) => `I need help to ${action.replaceAll('_', ' ')} ${name}.`, lifecycle: 'clarifying' },
  { key: 'consent', user: (name: string, action: string) => `Before you ${action.replaceAll('_', ' ')} ${name}, tell me what needs my confirmation.`, lifecycle: 'awaiting_confirmation' },
  { key: 'recovery', user: (name: string) => `The ${name} step did not finish. Help me resume the same item without making a duplicate.`, lifecycle: 'failed' },
  { key: 'pidgin', user: (name: string) => `Abeg, help me check ${name} and tell me the next safe step.`, lifecycle: 'requested' },
  { key: 'hausa_influenced', user: (name: string) => `Please help me with ${name}; ask only the details you still need.`, lifecycle: 'clarifying' },
];

function compactName(value: string): string {
  return String(value || '').replace(/^atomic\./, '').replace(/^skill\./, '').replaceAll('_', ' ').replaceAll('.', ' ').replace(/\s+/g, ' ').trim();
}

function directCapabilityName(registration: CapabilityRegistration): string {
  const alias = [...(registration.aliases || []), registration.descriptor.capability]
    .map(compactName)
    .find(Boolean);
  return alias || compactName(registration.descriptor.capability);
}

function skillAssistantTarget(skill: string, contract: any, variant: string): string {
  const name = compactName(skill);
  const required = contract.requirements.filter((requirement: any) => requirement.required).map((requirement: any) => requirement.label).slice(0, 3);
  const details = required.length ? ` I still need ${required.join(', ')} before I can prepare a truthful next step.` : '';
  const boundary = contract.requiresPayment || contract.requiresProvider || contract.requiresEvidence
    ? ' I will not claim a provider, payment, availability, or completion until the canonical service has evidence.'
    : ' I will keep the same context and use the canonical owner for any recorded change.';
  if (variant === 'ambiguity') return `I can help you decide what ${name} support is appropriate. I will clarify the outcome before creating or changing anything.${boundary}`;
  if (variant === 'interruption') return `I will keep the ${name} context resumable while we discuss the other question. I will not replace it or create a duplicate.${boundary}`;
  if (variant === 'correction') return `I will update the exact ${name} context you mean after confirming the changed detail. I will not create a second request.${boundary}`;
  if (variant === 'unavailable') return `If no verified option is available for ${name}, I will say so clearly and keep the next safe option visible. I will not invent a match.${boundary}`;
  if (variant === 'consent') return `I will explain any consent or confirmation needed for ${name} before a consequential action. Nothing irreversible will happen from this message alone.${boundary}`;
  if (variant === 'channel' || variant === 'linked_device') return `I can continue the same ${name} context when identity and object ownership match. I will not create a duplicate merely because the channel changed.${boundary}`;
  if (variant === 'recovery') return `I can inspect and recover the same ${name} context without claiming it completed. I will preserve its exact identity and any available evidence.${boundary}`;
  return `I can help with ${name}.${details}${boundary}`;
}

function capabilityAssistantTarget(registration: CapabilityRegistration, action: string, variant: string): string {
  const descriptor = registration.descriptor;
  const name = directCapabilityName(registration);
  const actionName = action.replaceAll('_', ' ');
  const confirmation = descriptor.confirmationRequired ? ` I will ask for explicit confirmation before ${actionName}.` : '';
  const activation = descriptor.activationState === 'repository_ready_external_activation'
    ? ' Any external outcome still requires the configured provider and canonical evidence.'
    : ' I will use the registered canonical owner and preserve the current context.';
  if (variant === 'recovery') return `I can inspect the same ${name} operation and help recover it without creating a duplicate.${confirmation}${activation}`;
  if (variant === 'consent') return `I can explain what ${name} can do and what confirmation is required before ${actionName}.${confirmation}${activation}`;
  if (variant === 'pidgin') return `I fit help check the ${name} matter and tell you the next safe step. I no go claim say anything don finish without record.${activation}`;
  if (variant === 'hausa_influenced') return `I can help with ${name} and ask only for the details still needed. I will not claim an external result without evidence.${activation}`;
  return `I can inspect ${name} in the current context and prepare the ${actionName} step safely.${confirmation}${activation}`;
}

function createSkillExample(skill: string, skillIndex: number, index: number) {
  const contract = buildSkillExecutionContract(skill);
  const pack = getConvergedSkillBehaviour(skill);
  const ordinal = skillIndex * skillVariants.length + index;
  const variant = skillVariants[index % skillVariants.length];
  const actor = actors[ordinal % actors.length];
  const channel = channels[ordinal % channels.length];
  const locale = locales[ordinal % locales.length];
  const surface = surfaces[ordinal % surfaces.length];
  return {
    exampleId: `${datasetVersion}:skill:${skill}:${variant.key}:${index}`,
    datasetVersion,
    messages: [
      { role: 'user', content: variant.user(skill), actor, channel, locale },
      { role: 'assistant', content: skillAssistantTarget(skill, contract, variant.key), mode: 'semantic_interpreter' },
    ],
    labels: {
      targetType: 'skill',
      skill,
      family: contract.category || 'uncategorized',
      mode: contract.mode,
      variant: variant.key,
      lifecycle: variant.lifecycle,
      capabilities: contract.capabilities,
      requirementKeys: contract.requirements.map(requirement => requirement.key),
      requiredInformation: contract.requirements.filter(requirement => requirement.required).map(requirement => requirement.label),
      memoryKeys: contract.memoryKeys,
      completionEvidence: contract.completionEvidence,
      failureModes: contract.failureModes,
      truthBoundary: contract.truthBoundary,
      requiresProvider: contract.requiresProvider,
      requiresPayment: contract.requiresPayment,
      requiresEvidence: contract.requiresEvidence,
      actor,
      channel,
      locale,
      surface,
      canonicalEntry: 'canonicalChatTurnService',
      authorityBoundary: 'canonical_domain_services',
      behaviourInstructionCount: pack.instructions.length,
      forbiddenClaims: ['invented availability', 'invented provider verification', 'invented payment', 'invented evidence', 'direct state mutation by model', 'fabricated Memory Profile facts'],
    },
    provenance: { source: 'canonical Kurukoo converged skill catalogue', generatedBy: 'deterministic repository generator', teacherGenerated: false, productionUserData: false, reviewed: false },
    quality: { status: 'candidate', requiresReview: true, scenarioFamily: 'outcome-first-context-arbitration' },
    privacy: { containsPersonalData: false, synthetic: true },
  };
}

function createCapabilityExample(registration: CapabilityRegistration, capabilityIndex: number, index: number) {
  const descriptor = registration.descriptor;
  const ordinal = capabilityIndex * capabilityVariants.length + index;
  const variant = capabilityVariants[index % capabilityVariants.length];
  const action = descriptor.actions[index % Math.max(1, descriptor.actions.length)] || 'inspect';
  const name = directCapabilityName(registration);
  const actor = actors[ordinal % actors.length];
  const channel = channels[ordinal % channels.length];
  const locale = locales[ordinal % locales.length];
  const surface = surfaces[(ordinal + skillVariants.length) % surfaces.length];
  return {
    exampleId: `${datasetVersion}:capability:${descriptor.capability}:${variant.key}:${index}`,
    datasetVersion,
    messages: [
      { role: 'user', content: variant.user(name, action), actor, channel, locale },
      { role: 'assistant', content: capabilityAssistantTarget(registration, action, variant.key), mode: 'semantic_interpreter' },
    ],
    labels: {
      targetType: 'capability',
      capability: descriptor.capability,
      action,
      actions: descriptor.actions,
      family: descriptor.family,
      mode: descriptor.mode,
      variant: variant.key,
      lifecycle: variant.lifecycle,
      owners: descriptor.owner,
      risk: descriptor.risk,
      confirmationRequired: descriptor.confirmationRequired,
      activationState: descriptor.activationState,
      actor,
      channel,
      locale,
      surface,
      canonicalEntry: 'canonicalChatTurnService',
      authorityBoundary: 'canonical_domain_services',
      forbiddenClaims: ['invented availability', 'invented provider verification', 'invented payment', 'invented evidence', 'direct state mutation by model', 'fabricated Memory Profile facts'],
    },
    provenance: { source: 'canonical Kurukoo capability registry', generatedBy: 'deterministic repository generator', teacherGenerated: false, productionUserData: false, reviewed: false },
    quality: { status: 'candidate', requiresReview: true, scenarioFamily: 'capability-action-boundary' },
    privacy: { containsPersonalData: false, synthetic: true },
  };
}

function hashFile(filePath: string) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}
function writeJsonl(filePath: string, rows: unknown[]) { fs.writeFileSync(filePath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`); }

fs.mkdirSync(outputDir, { recursive: true });
ensureCapabilityFoundation();
const skills = getAllConvergedSkillNames();
const directCapabilities = listCapabilityRegistrations()
  .filter(registration => registration.descriptor.kind === 'operation')
  .sort((left, right) => left.descriptor.capability.localeCompare(right.descriptor.capability));
const skillRows = skills.flatMap((skill, skillIndex) => skillVariants.map((_, index) => createSkillExample(skill, skillIndex, index)));
const capabilityRows = directCapabilities.flatMap((registration, capabilityIndex) => capabilityVariants.map((_, index) => createCapabilityExample(registration, capabilityIndex, index)));
const rows = [...skillRows, ...capabilityRows];
const splitFor = (row: (typeof rows)[number]) => {
  const bucket = crypto.createHash('sha256').update(row.exampleId).digest().readUInt16BE(0) % 100;
  return bucket < 80 ? 'train' : bucket < 90 ? 'validation' : 'test';
};
const files: Record<string, string> = {};
for (const split of ['all', 'train', 'validation', 'test']) {
  const splitRows = split === 'all' ? rows : rows.filter((row) => splitFor(row) === split);
  const filePath = path.join(outputDir, `${datasetVersion}.${split}.jsonl`);
  writeJsonl(filePath, splitRows);
  files[split] = filePath;
}
const goldenRows = rows.filter((row) => row.labels.variant === 'normal' || (row.labels.targetType === 'capability' && row.labels.variant === 'inspect'));
const adversarialRows = rows.filter((row) => !['normal', 'inspect'].includes(row.labels.variant));
for (const [name, setRows] of [['golden', goldenRows], ['adversarial', adversarialRows]] as const) {
  const filePath = path.join(outputDir, `${datasetVersion}.${name}.jsonl`);
  writeJsonl(filePath, setRows);
  files[name] = filePath;
}
const manifest = {
  datasetVersion,
  generatedAt: new Date().toISOString(),
  exampleCount: rows.length,
  splitCounts: Object.fromEntries(Object.entries(files).filter(([key]) => key !== 'all').map(([key, filePath]) => [key, fs.readFileSync(filePath, 'utf8').trim().split('\n').filter(Boolean).length])),
  fileSha256: Object.fromEntries(Object.entries(files).map(([key, filePath]) => [key, hashFile(filePath)])),
  evaluationSets: { golden: { count: goldenRows.length, status: 'candidate_requires_human_curation' }, adversarial: { count: adversarialRows.length, status: 'candidate_requires_human_curation' } },
  skillCount: skills.length,
  directCapabilityCount: directCapabilities.length,
  skillExampleCount: skillRows.length,
  capabilityExampleCount: capabilityRows.length,
  familyCount: new Set(rows.map((row) => row.labels.family)).size,
  variantCount: skillVariants.length,
  capabilityVariantCount: capabilityVariants.length,
  actorCoverage: [...new Set(rows.map((row) => row.labels.actor))],
  channelCoverage: [...new Set(rows.map((row) => row.labels.channel))],
  localeCoverage: [...new Set(rows.map((row) => row.labels.locale))],
  surfaceCoverage: [...new Set(rows.map((row) => row.labels.surface))],
  variantCoverage: [...new Set(rows.map((row) => row.labels.variant))],
  sourceOfTruth: ['src/services/skillCatalogueConvergence.ts', 'src/services/skillBehaviourConvergence.ts', 'src/services/skillExecutionContract.ts', 'src/services/capabilityFoundation.ts', 'src/services/capabilityRegistry.ts', 'src/services/canonicalChatTurnService.ts', 'src/services/featureFlags.ts'],
  teacherOutputAllowed: true,
  teacherOutputTrustedAutomatically: false,
  productionUserDataIncluded: false,
  trainingIsNotRuntimeAuthority: true,
  status: 'candidate_dataset_requires_validation_and_curation',
};
fs.writeFileSync(path.join(outputDir, `${datasetVersion}.manifest.json`), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
