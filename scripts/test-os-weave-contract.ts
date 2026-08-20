import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [
  'docs/architecture/KURUKOO_OS_WEAVE_CONTRACT.md',
  'src/services/aiInferencePolicy.ts',
  'src/services/discoverExperience.ts',
  'src/services/catalogueInventoryMatcher.ts',
  'src/services/agentNetworkCommerce.ts',
  'src/services/providerCommunicationService.ts',
  'src/services/artifactService.ts',
  'src/routes/qrRouter.ts',
  'mobile/kurukoo-mobile/lib/offline-queue.ts',
  'mobile/kurukoo-mobile/lib/haptics.ts',
];
for (const file of files) assert.equal(fs.existsSync(path.join(root, file)), true, `missing OS weave surface: ${file}`);
const weave = fs.readFileSync(path.join(root, 'docs/architecture/KURUKOO_OS_WEAVE_CONTRACT.md'), 'utf8');
for (const marker of ['Discover', 'Products', 'POS/agent top-up', 'Provider communication', 'AI', 'Channels', 'Artifacts', 'QR', 'Mobile offline', 'Revenue weave']) assert.ok(weave.includes(marker), `missing weave contract marker: ${marker}`);
console.log(JSON.stringify({ passed: true, checked: files.length }, null, 2));
