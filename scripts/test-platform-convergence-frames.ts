import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'docs/architecture/PLATFORM_CONVERGENCE_FRAMEWORK.md',
  'src/services/platformCanonicalContracts.ts',
  'src/services/outcomeContextService.ts',
  'src/services/aiInferencePolicy.ts',
  'src/services/catalogueInventoryMatcher.ts',
  'src/services/catalogueSourceRegistry.ts',
  'src/services/discoverExperience.ts',
  'src/services/discoverCommercialComposition.ts',
  'src/services/agentNetworkCommerce.ts',
  'src/services/providerCommunicationService.ts',
  'src/routes/agentNetworkCommerceRoutes.ts',
  'src/routes/providerCommunicationRoutes.ts',
  'src/routes/catalogueRoutes.ts',
  'src/routes/outcomeContextRoutes.ts',
  'src/routes/stripeAgentPointsWebhookRoutes.ts',
  'src/services/commercialLedger.ts',
  'src/services/pointsEngine.ts',
  'src/services/privacyBridge.ts',
  'src/routes/webrtcRoutes.ts',
  'mobile/kurukoo-mobile/lib/platform-contract.ts',
];
for (const relative of required) assert.equal(fs.existsSync(path.join(root, relative)), true, `missing convergence frame: ${relative}`);
const framework = fs.readFileSync(path.join(root, 'docs/architecture/PLATFORM_CONVERGENCE_FRAMEWORK.md'), 'utf8');
for (const marker of ['AI Router', 'Discover', 'Revenue paths', 'Channel monetisation', 'Product discovery', 'POS', 'masked call', 'WebRTC', 'Outcome Context']) assert.ok(framework.includes(marker), `framework missing: ${marker}`);
const mobile = fs.readFileSync(path.join(root, 'mobile/kurukoo-mobile/lib/platform-contract.ts'), 'utf8');
for (const marker of ['commerce-network', 'catalogue', 'provider-communications']) assert.ok(mobile.includes(marker), `mobile contract missing: ${marker}`);
console.log(JSON.stringify({ passed: true, checked: required.length, mobile: true, wovenOutcomeContext: true }, null, 2));
