import fs from 'node:fs';
import path from 'node:path';

const critical = [
  'src/services/memoryProfile.ts',
  'src/services/chatConversationService.ts',
  'src/services/otpAuthService.ts',
  'src/services/durableJobQueue.ts',
  'src/services/pushNotifications.ts',
  'src/services/canonicalStore.ts',
  'src/services/postgresPersistence.ts',
  'src/services/persistenceReadiness.ts',
  // Agent execution spine: all durable state must stay behind the canonical store.
  'src/services/agentRuntime.ts',
  'src/services/agentToolRegistry.ts',
  'src/services/agentCapabilityOutcomeService.ts',
  'src/services/agentExecutionTrace.ts',
  'src/services/agentEconomicRequestOrchestrator.ts',
  'src/services/canonicalCapabilityExecutor.ts',
  'src/startup/backgroundServices.ts',
];
const forbidden = /(?:from\s+['"][^'"]*database\.js['"]|import\s*\(\s*['"][^'"]*database\.js['"]\s*\)|\bgetDb\s*\()/;
const failures = [];
for (const file of critical) {
  const source = fs.readFileSync(path.resolve(file), 'utf8');
  if (file === 'src/services/canonicalStore.ts') continue;
  if (forbidden.test(source)) failures.push(`${file}: direct database.ts persistence access remains`);
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('Persistence boundary audit: VERIFIED for critical shared-state and Agent execution services.');
