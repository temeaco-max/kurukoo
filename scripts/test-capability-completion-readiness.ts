import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { AUTHENTICATED_CAPABILITY_COVERAGE } from '../src/services/authenticatedCapabilityCoverageRegistry.js';
import { AUTHENTICATED_CAPABILITY_COMPLETION_EVIDENCE, getCapabilityCompletionReadiness } from '../src/services/capabilityCompletionReadiness.js';

const execFile = promisify(execFileCallback);
const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
const proofScripts = [...new Set(Object.values(AUTHENTICATED_CAPABILITY_COMPLETION_EVIDENCE).flatMap((evidence) => evidence.proofs.map((proof) => proof.test)))].sort();
for (const script of proofScripts) {
  assert.ok(packageJson.scripts?.[script], `Capability proof script is not registered: ${script}.`);
  await execFile('npm', ['run', script, '--silent'], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'test' }, maxBuffer: 2 * 1024 * 1024 });
}
const readiness = getCapabilityCompletionReadiness({ NODE_ENV: 'test', KURUKOO_MCP_ENABLED: 'false' });

assert.equal(readiness.length, AUTHENTICATED_CAPABILITY_COVERAGE.length, 'Every authenticated user-facing capability must have a completion-readiness projection.');
assert.equal(new Set(readiness.map((item) => item.id)).size, readiness.length, 'Capability readiness projection identifiers must remain unique.');

for (const contract of AUTHENTICATED_CAPABILITY_COVERAGE) {
  const evidence = AUTHENTICATED_CAPABILITY_COMPLETION_EVIDENCE[contract.id];
  const item = readiness.find((candidate) => candidate.id === contract.id);
  assert.ok(evidence, `Missing internal execution evidence for ${contract.id}.`);
  assert.ok(item, `Missing readiness projection for ${contract.id}.`);
  assert.equal(item?.internalExecution.state, 'VERIFIED', `${contract.id} must expose a verified internal execution state.`);
  assert.ok(item?.internalExecution.proofs.length, `${contract.id} must retain at least one deterministic internal execution proof.`);
  for (const proof of item?.internalExecution.proofs || []) {
    assert.ok(proof.test.startsWith('test:'), `${contract.id} proof must name a canonical test script.`);
    assert.ok(packageJson.scripts?.[proof.test], `${contract.id} proof script is not registered: ${proof.test}.`);
    assert.ok(proof.boundary.length >= 30, `${contract.id} proof must describe the bounded internal execution path.`);
  }
  assert.notEqual(item?.completionState, 'STRUCTURALLY_INCOMPLETE', `${contract.id} must not report an incomplete internal path.`);
  if (item?.completionState === 'LOCALLY_COMPLETE') {
    assert.equal(item.finalExternalDependencies.length, 0, `${contract.id} must not hide an external prerequisite behind a local-complete state.`);
  } else {
    assert.equal(item?.completionState, 'REPOSITORY_READY_EXTERNAL_ACTIVATION', `${contract.id} can only remain externally gated after its internal path is verified.`);
    assert.ok(item.finalExternalDependencies.length, `${contract.id} must name the final external dependency rather than use a generic blocked state.`);
    for (const dependency of item.finalExternalDependencies) {
      assert.notEqual(dependency.uiState, 'PRODUCTION_ACTIVE', `${contract.id} must not infer external activation from repository evidence.`);
      assert.ok(dependency.summary.length >= 30, `${contract.id} must preserve a truthful external activation summary.`);
    }
  }
}

const locallyComplete = readiness.filter((item) => item.completionState === 'LOCALLY_COMPLETE');
const externalActivation = readiness.filter((item) => item.completionState === 'REPOSITORY_READY_EXTERNAL_ACTIVATION');
assert.ok(locallyComplete.length > 0, 'The readiness pass must distinguish capabilities complete without an external activation dependency.');
assert.ok(externalActivation.length > 0, 'The readiness pass must identify capabilities whose only remaining dependency is external activation.');
assert.ok(readiness.find((item) => item.id === 'payments')?.finalExternalDependencies.some((dependency) => dependency.id === 'stripe'), 'Payments must name the canonical payment activation boundary.');
assert.ok(readiness.find((item) => item.id === 'connect')?.finalExternalDependencies.some((dependency) => dependency.id === 'google_drive'), 'Connect must name canonical integration readiness rather than claim a generic completion state.');
assert.ok(readiness.find((item) => item.id === 'voice')?.finalExternalDependencies.some((dependency) => dependency.id === 'voice'), 'Voice must retain the final provider/device activation boundary.');

console.log(JSON.stringify({
  ok: true,
  capabilities: readiness.length,
  proofScriptsExecuted: proofScripts.length,
  locallyComplete: locallyComplete.length,
  repositoryReadyExternalActivation: externalActivation.length,
  structurallyIncomplete: readiness.filter((item) => item.completionState === 'STRUCTURALLY_INCOMPLETE').length,
  externalActivationState: 'not_claimed',
}));
