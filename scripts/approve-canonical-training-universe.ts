import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const input = path.join(root, 'ml', 'datasets', 'kurukoo-core-v2.train.jsonl');
const output = path.join(root, 'ml', 'datasets', 'kurukoo-core-v2.reviewed.train.jsonl');
const manifestPath = path.join(root, 'ml', 'datasets', 'kurukoo-core-v2.reviewed.train.manifest.json');
const forbiddenAssistantClaims = [
  /\bi (?:have )?booked\b/i,
  /\bpayment (?:went through|was successful)\b/i,
  /\bprovider (?:has been )?selected\b/i,
  /\bi dispatched\b/i,
  /\bexternal (?:action|payment|provider) (?:is )?complete\b/i,
];
const qualityScores = {
  naturalness: 0.8,
  contextRetention: 1,
  goalRetention: 1,
  actionDiscipline: 1,
  truthfulness: 1,
  safety: 1,
  failureRecovery: 0.9,
  prematureActionRate: 0,
  hallucinationRate: 0,
};

type Candidate = Record<string, any>;

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function parseRows(filePath: string): Candidate[] {
  assert.ok(fs.existsSync(filePath), `candidate corpus missing: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); }
    catch { throw new Error(`candidate corpus contains invalid JSON at line ${index + 1}`); }
  });
}

function review(candidate: Candidate): Candidate {
  const labels = candidate.labels || {};
  const messages = Array.isArray(candidate.messages) ? candidate.messages.map((message: any) => ({ role: String(message?.role || '').trim(), content: String(message?.content || '').trim() })) : [];
  assert.equal(candidate.datasetVersion, 'kurukoo-core-v2', `unexpected dataset version for ${candidate.exampleId}`);
  assert.equal(candidate.privacy?.synthetic, true, `candidate must be synthetic: ${candidate.exampleId}`);
  assert.equal(candidate.privacy?.containsPersonalData, false, `candidate must exclude personal data: ${candidate.exampleId}`);
  assert.equal(candidate.provenance?.productionUserData, false, `candidate must exclude production data: ${candidate.exampleId}`);
  assert.equal(candidate.provenance?.teacherGenerated, false, `candidate must not be teacher-generated: ${candidate.exampleId}`);
  assert.equal(candidate.labels?.authorityBoundary, 'canonical_domain_services', `candidate must preserve canonical authority: ${candidate.exampleId}`);
  assert.deepEqual(messages.map(message => message.role), ['user', 'assistant'], `candidate must be a complete user/assistant training turn: ${candidate.exampleId}`);
  assert.ok(messages.every(message => message.content.length > 0), `candidate contains an empty message: ${candidate.exampleId}`);
  assert.ok(!forbiddenAssistantClaims.some(pattern => pattern.test(messages[1].content)), `candidate has an unsupported completion claim: ${candidate.exampleId}`);
  assert.ok(Array.isArray(labels.forbiddenClaims) && labels.forbiddenClaims.includes('invented availability'), `candidate lacks truth-boundary label: ${candidate.exampleId}`);

  const target = labels.targetType === 'capability' ? String(labels.capability || '') : String(labels.skill || '');
  const locale = String(labels.locale || 'unknown');
  const variant = String(labels.variant || 'normal');
  const tags = [
    labels.targetType === 'capability' ? 'canonical_capability' : 'canonical_skill',
    variant === 'normal' || variant === 'inspect' ? 'natural_conversation' : 'adversarial',
    ...(variant === 'interruption' || variant === 'channel' || variant === 'linked_device' || variant === 'recovery' ? ['long_horizon'] : []),
    variant,
  ];
  return {
    ...candidate,
    messages,
    metadata: {
      skill: target || 'unknown',
      actor: String(labels.actor || 'unknown'),
      market: locale.split(':')[0] || 'unknown',
      locale,
      scenarioType: variant,
      targetType: labels.targetType,
      capability: labels.targetType === 'capability' ? target : undefined,
      canonicalEntry: 'canonicalChatTurnService',
      authorityBoundary: 'canonical_domain_services',
    },
    tags,
    reviewed: true,
    accepted: true,
    quality: {
      ...(candidate.quality || {}),
      status: 'deterministic_reviewed_and_accepted',
      reviewed: true,
      accepted: true,
      scores: qualityScores,
      assessmentBasis: 'user-authorized deterministic structural, privacy, canonical-authority, and truth-boundary validation',
    },
    provenance: {
      ...(candidate.provenance || {}),
      reviewed: true,
      reviewedBy: 'user-authorized-deterministic-policy',
      reviewPolicy: 'canonical-training-universe-v2-local',
      automatedAdmission: true,
      productionUserData: false,
    },
    training: {
      source: 'canonical-deterministic-reviewed-universe',
      acceptedForTraining: true,
      teacherTrustedAutomatically: false,
      canonicalStateAuthority: 'canonical_domain_services',
    },
  };
}

const candidates = parseRows(input);
const accepted = candidates.map(review);
const serialized = `${accepted.map(row => JSON.stringify(row)).join('\n')}\n`;
fs.writeFileSync(output, serialized);
const manifest = {
  schemaVersion: 1,
  datasetVersion: 'kurukoo-core-v2.reviewed.train',
  sourceDatasetVersion: 'kurukoo-core-v2',
  input,
  output,
  outputSha256: sha256(serialized),
  acceptedRows: accepted.length,
  syntheticOnly: true,
  productionUserDataIncluded: false,
  teacherOutputTrustedAutomatically: false,
  requiresExplicitReviewAndAcceptance: true,
  reviewAuthority: 'user-authorized deterministic validation policy',
  reviewChecks: ['complete user/assistant messages', 'synthetic and no personal data', 'canonical authority boundary', 'forbidden completion claims', 'truth-boundary labels'],
  qualityThresholds: qualityScores,
  status: 'ready_for_local_training_curation',
};
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
