import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const mustExist = [
  'src/services/quickRideDispatchService.ts',
  'src/services/rideDispatchContract.ts',
  'src/routes/quickRideRoutes.ts',
  'src/services/economicDispatchCoordinator.ts',
  'src/services/providerCommunicationService.ts',
  'src/services/outcomeContextService.ts',
  'src/services/agentNetworkCommerce.ts',
  'src/services/catalogueSourceRegistry.ts',
  'src/services/discoverExperience.ts',
  'src/services/unifiedAiEngine.ts',
  'src/services/aiInferencePolicy.ts',
  'mobile/kurukoo-mobile/lib/quick-ride-contract.ts',
  'docs/architecture/KURUKOO_OS_WEAVE_CONTRACT.md',
];
for (const file of mustExist) assert.equal(fs.existsSync(path.join(root, file)), true, `missing OS weave owner: ${file}`);

const index = fs.readFileSync(path.join(root, 'src/index.ts'), 'utf8');
for (const marker of ["import quickRideRoutes from './routes/quickRideRoutes.js';", "app.use('/api',quickRideRoutes);"]) assert.ok(index.includes(marker), `index missing weave registration: ${marker}`);

const dispatch = fs.readFileSync(path.join(root, 'src/services/economicDispatchCoordinator.ts'), 'utf8');
for (const marker of ['chargeProviderLead', 'createProviderCommunicationSession', 'markDispatchArrived', 'completeDispatch']) assert.ok(dispatch.includes(marker), `dispatch weave missing: ${marker}`);

const communication = fs.readFileSync(path.join(root, 'src/routes/providerCommunicationRoutes.ts'), 'utf8');
for (const marker of ['/messages', '/location', '/sessions/:id/state', 'preferredTransport:\'webrtc\'']) assert.ok(communication.includes(marker), `communication weave missing: ${marker}`);

console.log(JSON.stringify({ passed: true, checked: mustExist.length, canonical: 'Kurukoo OS weave', quickRideDefault: 'any', leadCharge: 'acceptance', communication: 'webrtc-first' }, null, 2));
