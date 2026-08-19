// Proves the capability execution adapter bridge registers ALL built-in execution
// adapters at runtime (points, discovery, subscription, payment, order, channel,
// connected_resource) and that connected_resource control is dispatched, not a stub.

import { listExecutionAdapters, getExecutionAdapter } from '../src/services/capabilityExecutionAdapterBridgeV2.js';
import { getCapabilityRegistration } from '../src/services/capabilityRegistry.js';

const EXPECTED = ['points', 'discovery', 'subscription', 'payment', 'order', 'channel', 'connected_resource'];

async function main(): Promise<void> {
  const adapters = listExecutionAdapters();
  const registered = new Set(adapters.map((a) => a.capability));
  const missing = EXPECTED.filter((name) => !registered.has(name));
  if (missing.length) throw new Error(`Adapters failed to register at runtime: ${missing.join(', ')}`);

  // Capabilities underlying the adapters must exist in the registry (so adapters can bind).
  for (const name of ['points', 'order', 'channel']) {
    if (!getCapabilityRegistration(name)) throw new Error(`Capability "${name}" missing from the registry; its adapter would be dead.`);
  }

  // connected_resource control must be a real dispatch path (not the needs_user stub).
  const connected = getExecutionAdapter('connected_resource');
  if (!connected || !connected.actions.includes('control')) throw new Error('connected_resource adapter must expose a control action.');
  const execute = connected.execute as ((context: any) => Promise<any>) | undefined;
  if (!execute) throw new Error('connected_resource adapter is missing its execute implementation.');
  // Unknown resource must resolve ownership truthfully (unauthorized), proving dispatch wiring.
  const control = await execute({
    phone: '+9990000000', action: 'control', capability: 'connected_resource',
    arguments: { resourceId: 'conn_nonexistent', command: 'power_on', payload: '1' },
    idempotencyKey: 'test-control',
  });
  if (!control || control.status !== 'unauthorized') throw new Error(`control dispatch must resolve ownership; got ${control?.status}`);

  console.log(`Capability adapter bridge passed: ${registered.size} adapters registered.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});