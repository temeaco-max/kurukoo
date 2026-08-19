import type { UniversalCapabilityDescriptor } from './universalCapabilityProtocol.js';
import type { CapabilityExtensionExecutionAdapter } from './capabilityExtensionExecutionTypes.js';
import { ensureCapabilityFoundation } from './capabilityFoundation.js';
import { getCapabilityRegistration, registerCapability, resolveCapabilityComposition } from './capabilityRegistry.js';

export type { CapabilityExtensionExecutionAdapter } from './capabilityExtensionExecutionTypes.js';

export interface ComposableSkillExtension {
  name: string;
  family: string;
  capabilities: string[];
  requiredInputs?: Array<{ key: string; label: string; required?: boolean }>;
  optionalInputs?: Array<{ key: string; label: string; required?: boolean }>;
  actions?: string[];
  permissions?: string[];
  risk?: UniversalCapabilityDescriptor['risk'];
  mode?: UniversalCapabilityDescriptor['mode'];
  owner: string[];
  activationState?: UniversalCapabilityDescriptor['activationState'];
  source?: string;
  executionAdapter?: CapabilityExtensionExecutionAdapter;
}

const executionAdapters = new Map<string, CapabilityExtensionExecutionAdapter>();

export function registerCapabilityExecutionAdapter(name: string, adapter: CapabilityExtensionExecutionAdapter): void {
  const normalized = String(name || '').trim().toLowerCase();
  if (!normalized) throw new Error('Capability execution adapter requires a capability name.');
  const registered = getCapabilityRegistration(normalized);
  if (!registered) throw new Error(`Cannot bind execution adapter before registering capability ${normalized}.`);
  const allowed = new Set(registered.descriptor.actions.map(action => action.toLowerCase()));
  for (const action of adapter.actions) {
    if (!allowed.has(String(action).toLowerCase())) throw new Error(`Adapter action ${action} is not registered for capability ${normalized}.`);
  }
  executionAdapters.set(normalized, {
    ...adapter,
    actions: [...new Set(adapter.actions)],
    actionMetadata: adapter.actionMetadata ? { ...adapter.actionMetadata } : undefined,
  });
}

export function getCapabilityExecutionAdapter(name: string): CapabilityExtensionExecutionAdapter | undefined {
  const normalized = String(name || '').trim().toLowerCase();
  const adapter = executionAdapters.get(normalized);
  return adapter ? { ...adapter, actions: [...adapter.actions], actionMetadata: adapter.actionMetadata ? { ...adapter.actionMetadata } : undefined } : undefined;
}

export function listCapabilityExecutionAdapters(): Array<{ capability: string } & CapabilityExtensionExecutionAdapter> {
  return [...executionAdapters.entries()].map(([capability, adapter]) => ({ capability, ...adapter, actions: [...adapter.actions], actionMetadata: adapter.actionMetadata ? { ...adapter.actionMetadata } : undefined }));
}

export function registerComposableSkillExtension(extension: ComposableSkillExtension): UniversalCapabilityDescriptor {
  ensureCapabilityFoundation();
  const normalizedName = String(extension.name || '').trim().toLowerCase();
  if (!normalizedName) throw new Error('Composable skill extension requires a name.');
  const requiredCapabilities = [...new Set((extension.capabilities || []).map(value => {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized.startsWith('atomic.') || normalized.startsWith('skill.') || normalized.startsWith('capability.') ? normalized : `atomic.${normalized}`;
  }).filter(Boolean))];
  if (!requiredCapabilities.length) throw new Error(`Composable skill ${normalizedName} requires at least one capability.`);
  const composition = resolveCapabilityComposition(requiredCapabilities);
  if (composition.unresolved.length || composition.cycle?.length) throw new Error(`Composable skill ${normalizedName} has unresolved or cyclic capability dependencies.`);

  const descriptor: UniversalCapabilityDescriptor = {
    kind: 'skill',
    capability: `skill.${normalizedName}`,
    family: extension.family || 'extension',
    mode: extension.mode || 'structured_action',
    actions: [...new Set(extension.actions?.length ? extension.actions : ['understand', 'clarify', 'start', 'review', 'update', 'cancel', 'resume'])],
    context: {
      requiredInputs: (extension.requiredInputs || []).map(input => ({ key: input.key, label: input.label, required: input.required !== false })),
      optionalInputs: (extension.optionalInputs || []).map(input => ({ key: input.key, label: input.label, required: false })),
    },
    permissions: [...new Set(extension.permissions || ['authenticated_owner'])],
    owner: [...new Set(extension.owner || ['canonicalChatTurnService', 'capabilityRegistry'])],
    risk: extension.risk || 'low_risk',
    consentRequired: (extension.risk || 'low_risk') !== 'read_only',
    confirmationRequired: extension.risk === 'confirmation_required' || extension.risk === 'high_risk',
    lifecycle: ['requested', 'clarifying', 'ready', 'accepted', 'waiting', 'executing', 'completed', 'cancelled', 'failed'],
    canonicalFactsAvailable: ['intent', 'requirements', 'canonical_object_identity', 'lifecycle', 'evidence', 'external_activation'],
    executionStatus: ['not_started', 'accepted', 'waiting', 'needs_user', 'executing', 'completed', 'failed'],
    evidenceStatus: ['none', 'internal_record', 'canonical_service', 'provider_evidence', 'verified_external_evidence'],
    nextAllowedActions: [...new Set(extension.actions?.length ? extension.actions : ['understand', 'clarify', 'start', 'review', 'update', 'cancel', 'resume'])],
    failureStates: ['blocked', 'failed', 'stale_context', 'foreign_context', 'confirmation_required', 'unavailable_external_dependency'],
    retryPolicy: ['retry through canonical owner only', 'preserve exact identity and idempotency', 'do not create duplicate objects or effects'],
    recoveryActions: ['clarify', 'review', 'resume', 'cancel', 'retry', 'wait', 'escalate'],
    continuationContext: ['conversationId', 'contextId', 'canonicalObjectId', 'ownerScope', 'lifecycle', 'nextAllowedActions'],
    externalDependencyState: (extension.activationState === 'repository_ready_external_activation' || extension.activationState === 'unavailable_external_dependency') ? ['External activation/evidence is required before claiming a completed real-world outcome.'] : [],
    activationState: extension.activationState || 'locally_available',
  };

  registerCapability({ descriptor, namespace: 'kurukoo.extensions', version: '1', aliases: [normalizedName], requiresCapabilities: requiredCapabilities, providesCapabilities: [`skill.${normalizedName}`], source: extension.source || 'runtime-extension' });
  if (extension.executionAdapter) registerCapabilityExecutionAdapter(descriptor.capability, extension.executionAdapter);
  return descriptor;
}

export function isComposableSkillRegistered(name: string): boolean {
  ensureCapabilityFoundation();
  return Boolean(getCapabilityRegistration(`skill.${String(name || '').trim().toLowerCase()}`));
}
