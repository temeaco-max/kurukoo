import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [
  'docs/architecture/KURUKOO_OS_WEAVE_CONTRACT.md',
  'src/services/aiInferencePolicy.ts',
  'src/services/unifiedAiEngine.ts',
  'src/services/discoverExperience.ts',
  'src/services/discoverCommercialComposition.ts',
  'src/services/catalogueInventoryMatcher.ts',
  'src/services/agentNetworkCommerce.ts',
  'src/services/agentCommissionSettlement.ts',
  'src/services/economicDispatchCoordinator.ts',
  'src/services/rideDispatchContract.ts',
  'src/services/providerCommunicationService.ts',
  'src/services/trickbridgeTrackingAdapter.ts',
  'src/services/pointsEngine.ts',
  'src/services/artifactService.ts',
  'src/routes/qrRouter.ts',
  'mobile/kurukoo-mobile/lib/offline-queue.ts',
  'mobile/kurukoo-mobile/lib/haptics.ts',
];
for (const file of files) assert.equal(fs.existsSync(path.join(root, file)), true, `missing OS weave surface: ${file}`);
const weave = fs.readFileSync(path.join(root, 'docs/architecture/KURUKOO_OS_WEAVE_CONTRACT.md'), 'utf8');
for (const marker of ['Discover', 'Products', 'POS/agent top-up', 'Provider communication', 'AI', 'Channels', 'Artifacts', 'QR', 'Mobile offline', 'Revenue weave', 'Ride / delivery communication lifecycle']) assert.ok(weave.includes(marker), `missing weave contract marker: ${marker}`);
const dispatch = fs.readFileSync(path.join(root, 'src/services/economicDispatchCoordinator.ts'), 'utf8');
for (const marker of ['chargeProviderLead', 'createProviderCommunicationSession', 'markDispatchArrived', 'completeDispatch']) assert.ok(dispatch.includes(marker), `ride weave missing: ${marker}`);
const communication = fs.readFileSync(path.join(root, 'src/routes/providerCommunicationRoutes.ts'), 'utf8');
assert.ok(communication.includes("state!=='arrived'"), 'provider voice must be arrival-gated');
const aiPolicy = fs.readFileSync(path.join(root, 'src/services/aiInferencePolicy.ts'), 'utf8');
for (const marker of ['mistral', 'gemini', 'groq', 'openrouter', 'free/included capacity']) assert.ok(aiPolicy.includes(marker), `AI capacity weave missing: ${marker}`);
const points = fs.readFileSync(path.join(root, 'src/services/pointsEngine.ts'), 'utf8');
assert.ok(points.includes('LEAD_CHARGES'), 'provider lead Points charges are not wired');
const agent = fs.readFileSync(path.join(root, 'src/services/agentNetworkCommerce.ts'), 'utf8');
assert.ok(agent.includes('points_purchase') && agent.includes('commission'), 'agent Points/commission weave is incomplete');
console.log(JSON.stringify({ passed: true, checked: files.length, wovenAreas: ['ride','provider-communication','points-agent-network','catalogue-discover','ai-capacity','mobile-parity'] }, null, 2));