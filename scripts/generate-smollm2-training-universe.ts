import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getAllConvergedSkillNames, getConvergedSkillBehaviour } from '../src/services/skillBehaviourConvergence.js';
import { getCatalogueStats } from '../src/services/skillCatalogueConvergence.js';
import { buildSkillExecutionContract } from '../src/services/skillExecutionContract.js';

const datasetVersion = String(process.env.KURUKOO_DATASET_VERSION || 'kurukoo-core-v2');
const outputDir = path.join(process.cwd(), 'ml', 'datasets');
const actors = ['consumer', 'provider', 'business', 'contributor', 'agent', 'support_operator'];
const channels = ['web_chat', 'pwa', 'whatsapp', 'telegram', 'sms', 'ussd', 'email', 'voice', 'linked_device'];
const locales = ['ng:en', 'ng:pidgin', 'ng:hausa-influenced', 'gh:en', 'gb:en', 'ca:en', 'ca:fr'];
const surfaces = ['memory', 'reminders', 'notifications', 'points', 'subscriptions', 'topics', 'media', 'support', 'products', 'orders', 'cart', 'discovery', 'provider_interaction', 'safety', 'consent', 'payment_boundary', 'locale', 'dialect', 'agent_representation', 'commercial_ledger'];
const variants = [
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

function createExample(skill: string, skillIndex: number, index: number) {
  const contract = buildSkillExecutionContract(skill);
  const pack = getConvergedSkillBehaviour(skill);
  const ordinal = skillIndex * variants.length + index;
  const variant = variants[index % variants.length];
  const actor = actors[ordinal % actors.length];
  const channel = channels[ordinal % channels.length];
  const locale = locales[ordinal % locales.length];
  const surface = surfaces[ordinal % surfaces.length];
  return {
    exampleId: `${datasetVersion}:${skill}:${variant.key}:${index}`,
    datasetVersion,
    messages: [
      { role: 'user', content: variant.user(skill), actor, channel, locale },
      { role: 'assistant', content: 'Interpret the objective, preserve active context, gather only the required information, use Memory Profile context without exposing provenance, and state any unavailable capability or external dependency truthfully.', mode: 'semantic_interpreter' },
    ],
    labels: {
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

function hashFile(filePath: string) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}
function writeJsonl(filePath: string, rows: unknown[]) { fs.writeFileSync(filePath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`); }

fs.mkdirSync(outputDir, { recursive: true });
const catalogue = getCatalogueStats();
const skills = getAllConvergedSkillNames();
if (skills.length !== catalogue.total) throw new Error(`Training universe catalogue mismatch: expected ${catalogue.total}, found ${skills.length}`);
const rows = skills.flatMap((skill, skillIndex) => variants.map((_, index) => createExample(skill, skillIndex, index)));
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
const goldenRows = rows.filter((row) => row.labels.variant === 'normal');
const adversarialRows = rows.filter((row) => ['ambiguity', 'interruption', 'correction', 'unavailable', 'consent', 'recovery', 'linked_device'].includes(row.labels.variant));
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
  catalogue,
  familyCount: new Set(rows.map((row) => row.labels.family)).size,
  variantCount: variants.length,
  actorCoverage: [...new Set(rows.map((row) => row.labels.actor))],
  channelCoverage: [...new Set(rows.map((row) => row.labels.channel))],
  localeCoverage: [...new Set(rows.map((row) => row.labels.locale))],
  surfaceCoverage: [...new Set(rows.map((row) => row.labels.surface))],
  variantCoverage: [...new Set(rows.map((row) => row.labels.variant))],
  sourceOfTruth: ['src/services/skillCatalogueConvergence.ts', 'src/services/skillBehaviourConvergence.ts', 'src/services/skillExecutionContract.ts', 'src/services/canonicalChatTurnService.ts', 'src/services/featureFlags.ts'],
  teacherOutputAllowed: true,
  teacherOutputTrustedAutomatically: false,
  productionUserDataIncluded: false,
  trainingIsNotRuntimeAuthority: true,
  status: 'candidate_dataset_requires_validation_and_curation',
};
fs.writeFileSync(path.join(outputDir, `${datasetVersion}.manifest.json`), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
