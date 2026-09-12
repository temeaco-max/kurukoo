export type ExecutionNetworkPillarState = 'implemented' | 'plumbed' | 'external_activation_required';

export type ExecutionNetworkPillar = {
  id: string;
  name: string;
  state: ExecutionNetworkPillarState;
  owners: string[];
  capabilityRefs: string[];
  testIntent: string;
};

export type ExecutionNetworkContract = {
  success: boolean;
  protocol: 'kurukoo-execution-network-v1' | string;
  contractVersion: string;
  product: string;
  consumerPromise: string;
  interaction: string[];
  lifecycle: string[];
  validation: { valid: boolean; count: number; duplicateIds: string[]; invalidStates: string[] };
  pillars: ExecutionNetworkPillar[];
};

const API_BASE = (import.meta.env['VITE_KURUKOO_API_BASE_URL'] ?? '').replace(/\/$/, '');

export function executionNetworkApiUrl() {
  return `${API_BASE}/api/execution-network`;
}

export async function fetchExecutionNetworkContract(signal?: AbortSignal): Promise<ExecutionNetworkContract> {
  const response = await fetch(executionNetworkApiUrl(), { credentials: 'include', signal });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : `Execution Network contract unavailable (${response.status})`);
  return payload as ExecutionNetworkContract;
}

export function summarizeExecutionNetwork(contract: ExecutionNetworkContract) {
  const counts = { implemented: 0, plumbed: 0, external_activation_required: 0 } as Record<ExecutionNetworkPillarState, number>;
  for (const pillar of contract.pillars) counts[pillar.state] += 1;
  return { total: contract.pillars.length, ...counts };
}
