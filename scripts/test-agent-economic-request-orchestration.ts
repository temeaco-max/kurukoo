import fs from 'node:fs';
import assert from 'node:assert/strict';
import { requestStatusToLinkStatus, nextActionForRequest } from '../src/services/agentEconomicRequestOrchestrator.js';

const orchestrator = fs.readFileSync('src/services/agentEconomicRequestOrchestrator.ts', 'utf8');
const router = fs.readFileSync('src/routes/agentRouter.ts', 'utf8');
const operatingModel = fs.readFileSync('src/services/agentOperatingModel.ts', 'utf8');

const requiredOrchestratorExports = [
  'getAgentEconomicRequestLink',
  'attachAgentGoalDependency',
  'listAgentGoalDependencies',
  'refreshAgentGoalDependencies',
  'isAgentGoalReadyForContinuation',
];

for (const name of requiredOrchestratorExports) {
  if (!orchestrator.includes(`export async function ${name}`)) throw new Error(`Missing orchestrator export: ${name}`);
}

for (const marker of [
  '/goals/:id/economic-request',
  '/goals/:id/dependencies',
  '/goals/:id/continuation',
  'getAgentEconomicRequestLink',
  'refreshAgentGoalDependencies',
  'attachAgentGoalDependency',
]) {
  if (!router.includes(marker)) throw new Error(`Missing Agent route integration: ${marker}`);
}

for (const marker of [
  'economicLink?: AgentEconomicLink',
  'dependencies: CompoundGoalDependency[]',
  'getAgentEconomicRequestLink',
  'listAgentGoalDependencies',
]) {
  if (!operatingModel.includes(marker)) throw new Error(`Missing Agent operating-model integration: ${marker}`);
}

assert.equal(requestStatusToLinkStatus('fulfilled'), 'completed');
assert.equal(requestStatusToLinkStatus('payment_pending'), 'waiting');
assert.equal(requestStatusToLinkStatus('cancelled'), 'blocked');
assert.equal(requestStatusToLinkStatus('requested'), 'linked');
assert.equal(nextActionForRequest('quoted'), 'review and confirm the quote');
assert.equal(nextActionForRequest('in_fulfillment'), 'monitor fulfilment');

if (!orchestrator.includes("economic_request_unavailable")) throw new Error('Economic request owner/blocking mapping missing.');
if (!orchestrator.includes("blocking_goal_unavailable")) throw new Error('Blocking goal ownership mapping missing.');

console.log('Agent Economic Request orchestration contract: PASS');
