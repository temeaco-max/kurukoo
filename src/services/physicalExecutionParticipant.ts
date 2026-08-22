import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';
import { find_worker } from './find-worker.js';
import { getEconomicRequest } from './skillFlows.js';
import { createExecutionRequest, getExecutionRequest, type ExecutionRequestRecord } from './executionConnector.js';
import { normalizeProviderEntityType, type ProviderEntityType } from './providerEntity.js';
import type { EconomicParticipantRole } from './economicParticipants.js';

export const PHYSICAL_EXECUTION_PARTICIPANT_TYPES = [
  'human_driver',
  'courier',
  'delivery_provider',
  'robot_taxi',
  'autonomous_vehicle',
  'drone',
  'robotic_delivery_system',
] as const;

export const PHYSICAL_EXECUTION_ACTIONS = [
  'collect_item',
  'transport_person',
  'transport_item',
  'deliver_package',
  'collect_repair_item',
  'return_repaired_item',
  'verify_pickup',
  'verify_delivery',
] as const;

export const PHYSICAL_COMMUNICATION_METHODS = ['message', 'voice', 'call', 'realtime'] as const;
export const PHYSICAL_EVIDENCE_METHODS = [
  'participant_confirmation',
  'recipient_confirmation',
  'timestamp',
  'location_reference',
  'item_reference',
  'delivery_artifact',
  'system_receipt',
  'telemetry_reference',
  'signed_event',
  'external_confirmation',
] as const;

export type PhysicalExecutionParticipantType = typeof PHYSICAL_EXECUTION_PARTICIPANT_TYPES[number];
export type PhysicalExecutionAction = typeof PHYSICAL_EXECUTION_ACTIONS[number];
export type PhysicalCommunicationMethod = typeof PHYSICAL_COMMUNICATION_METHODS[number];
export type PhysicalEvidenceMethod = typeof PHYSICAL_EVIDENCE_METHODS[number];
export type PhysicalExecutionStage = 'requested' | 'authorized' | 'assigned' | 'accepted' | 'en_route' | 'arrived' | 'picked_up' | 'in_progress' | 'delivered' | 'evidence_pending' | 'completed' | 'failed' | 'cancelled' | 'expired';

export interface PhysicalExecutionCapacity {
  maxPayloadKg?: number;
  maxPassengers?: number;
  maxVolumeLitres?: number;
}

export interface PhysicalExecutionParticipant {
  participantId: string;
  participantType: PhysicalExecutionParticipantType;
  providerType: ProviderEntityType;
  capability: string;
  serviceArea: { country: string | null; state: string | null; lga: string | null; locality: string | null; radiusKm: number | null };
  transportMode: string | null;
  available: boolean;
  operatingConstraints: string[];
  supportedPayloadTypes: string[];
  capacity: PhysicalExecutionCapacity;
  verificationState: 'verified' | 'unverified';
  communicationMethods: PhysicalCommunicationMethod[];
  evidenceMethods: PhysicalEvidenceMethod[];
  supportedActions: PhysicalExecutionAction[];
  pricingModel: string | null;
}

interface StoredExecutionProfile {
  participantType?: PhysicalExecutionParticipantType;
  operatingConstraints?: string[];
  supportedPayloadTypes?: string[];
  capacity?: PhysicalExecutionCapacity;
  communicationMethods?: PhysicalCommunicationMethod[];
  evidenceMethods?: PhysicalEvidenceMethod[];
  supportedActions?: PhysicalExecutionAction[];
}

const PARTICIPANT_TYPES = new Set<string>(PHYSICAL_EXECUTION_PARTICIPANT_TYPES);
const ACTIONS = new Set<string>(PHYSICAL_EXECUTION_ACTIONS);
const COMMUNICATION_METHODS = new Set<string>(PHYSICAL_COMMUNICATION_METHODS);
const EVIDENCE_METHODS = new Set<string>(PHYSICAL_EVIDENCE_METHODS);

const PARTICIPANT_TYPE_PROVIDER_TYPES: Record<PhysicalExecutionParticipantType, readonly ProviderEntityType[]> = {
  human_driver: ['human', 'business'],
  courier: ['human', 'business'],
  delivery_provider: ['human', 'business', 'external_platform'],
  robot_taxi: ['vehicle', 'autonomous_asset', 'external_platform'],
  autonomous_vehicle: ['vehicle', 'autonomous_asset', 'external_platform'],
  drone: ['drone', 'autonomous_asset', 'external_platform'],
  robotic_delivery_system: ['robot', 'autonomous_asset', 'external_platform'],
};

function requiredText(value: unknown, field: string, maxLength = 200): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${field} is too long`);
  return text;
}

function optionalText(value: unknown, field: string, maxLength = 200): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requiredText(value, field, maxLength);
}

function stringList(value: unknown, field: string, allowed?: Set<string>, maxItems = 16, maxLength = 120): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(`${field} must contain no more than ${maxItems} entries`);
  const result = Array.from(new Set(value.map((item) => requiredText(item, field, maxLength))));
  if (allowed && result.some((item) => !allowed.has(item))) throw new Error(`Unsupported ${field}`);
  return result;
}

function capacity(value: unknown): PhysicalExecutionCapacity {
  if (value === undefined || value === null) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Capacity must be an object');
  const source = value as Record<string, unknown>;
  const output: PhysicalExecutionCapacity = {};
  for (const [key, max] of [['maxPayloadKg', 100000], ['maxPassengers', 1000], ['maxVolumeLitres', 100000]] as const) {
    if (source[key] === undefined || source[key] === null) continue;
    const numeric = Number(source[key]);
    if (!Number.isFinite(numeric) || numeric <= 0 || numeric > max) throw new Error(`Capacity ${key} must be a positive bounded number`);
    output[key] = numeric;
  }
  return output;
}

function parseStoredProfile(value: unknown): StoredExecutionProfile {
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as StoredExecutionProfile : {};
  } catch {
    return {};
  }
}

function participantType(value: unknown): PhysicalExecutionParticipantType {
  const type = requiredText(value, 'Physical participant type', 64);
  if (!PARTICIPANT_TYPES.has(type)) throw new Error('Unsupported physical participant type');
  return type as PhysicalExecutionParticipantType;
}

function deriveDestinationBinding(requirements: Record<string, unknown>): string {
  const location = {
    origin: requirements.origin ?? requirements.pickup ?? requirements.location ?? null,
    originLatitude: requirements.origin_latitude ?? requirements.pickup_latitude ?? null,
    originLongitude: requirements.origin_longitude ?? requirements.pickup_longitude ?? null,
    destination: requirements.destination ?? requirements.delivery_location ?? null,
    destinationLatitude: requirements.destination_latitude ?? null,
    destinationLongitude: requirements.destination_longitude ?? null,
  };
  return crypto.createHash('sha256').update(JSON.stringify(location)).digest('hex');
}

function participantFromRow(row: any): PhysicalExecutionParticipant | null {
  const stored = parseStoredProfile(row.execution_profile_json);
  if (!stored.participantType || !PARTICIPANT_TYPES.has(stored.participantType)) return null;
  const providerType = normalizeProviderEntityType(row.provider_type);
  return {
    participantId: String(row.phone),
    participantType: stored.participantType,
    providerType,
    capability: String(row.skill),
    serviceArea: {
      country: optionalText(row.country, 'Country', 8),
      state: optionalText(row.primary_state, 'State', 120),
      lga: optionalText(row.primary_lga, 'LGA', 120),
      locality: optionalText(row.location, 'Locality', 200),
      radiusKm: row.service_radius_km === null || row.service_radius_km === undefined ? null : Number(row.service_radius_km),
    },
    transportMode: optionalText(row.transport_mode, 'Transport mode', 80),
    available: Number(row.profile_available) === 1 && Number(row.skill_available) === 1,
    operatingConstraints: stringList(stored.operatingConstraints, 'Operating constraints', undefined, 16, 180),
    supportedPayloadTypes: stringList(stored.supportedPayloadTypes, 'Supported payload types', undefined, 16, 120),
    capacity: capacity(stored.capacity),
    verificationState: Number(row.verified_provider) === 1 ? 'verified' : 'unverified',
    communicationMethods: stringList(stored.communicationMethods, 'Communication methods', COMMUNICATION_METHODS) as PhysicalCommunicationMethod[],
    evidenceMethods: stringList(stored.evidenceMethods, 'Evidence methods', EVIDENCE_METHODS) as PhysicalEvidenceMethod[],
    supportedActions: stringList(stored.supportedActions, 'Supported actions', ACTIONS) as PhysicalExecutionAction[],
    pricingModel: optionalText(row.pricing_model, 'Pricing model', 120),
  };
}

async function findParticipantRow(providerPhone: string, capability: string): Promise<any | null> {
  const db = await getDb();
  const stmt = db.prepare(`
    SELECT s.phone,s.skill,s.is_available AS skill_available,s.service_radius_km,s.transport_mode,s.pricing_model,s.execution_profile_json,
           m.provider_type,m.verified_provider,m.is_available AS profile_available,m.country,m.primary_state,m.primary_lga,m.location
    FROM skills s
    JOIN memory_profiles m ON m.phone=s.phone
    WHERE s.phone=? AND lower(s.skill)=lower(?)
    LIMIT 1
  `);
  stmt.bind([providerPhone, capability]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

/**
 * Store physical-execution metadata on an existing canonical skill declaration.
 * This extends the provider capability source of truth; it does not create a new
 * provider directory, dispatch lifecycle, or autonomous hardware integration.
 */
export async function declarePhysicalExecutionCapability(input: {
  providerPhone: string;
  actorPhone: string;
  capability: string;
  participantType: PhysicalExecutionParticipantType;
  transportMode?: string | null;
  pricingModel?: string | null;
  operatingConstraints?: string[];
  supportedPayloadTypes?: string[];
  capacity?: PhysicalExecutionCapacity;
  communicationMethods?: PhysicalCommunicationMethod[];
  evidenceMethods?: PhysicalEvidenceMethod[];
  supportedActions?: PhysicalExecutionAction[];
}): Promise<PhysicalExecutionParticipant> {
  const providerPhone = requiredText(input.providerPhone, 'Provider phone', 128);
  if (providerPhone !== requiredText(input.actorPhone, 'Actor phone', 128)) throw new Error('Only the provider may declare physical execution capability metadata');
  const capabilityName = requiredText(input.capability, 'Capability', 128);
  const type = participantType(input.participantType);
  const row = await findParticipantRow(providerPhone, capabilityName);
  if (!row) throw new Error('An existing canonical skill declaration is required');
  const providerType = normalizeProviderEntityType(row.provider_type);
  if (!PARTICIPANT_TYPE_PROVIDER_TYPES[type].includes(providerType)) throw new Error('Participant type is incompatible with the canonical provider entity type');
  const supportedActions = stringList(input.supportedActions, 'Supported actions', ACTIONS) as PhysicalExecutionAction[];
  if (!supportedActions.length) throw new Error('At least one supported physical execution action is required');
  const profile: StoredExecutionProfile = {
    participantType: type,
    operatingConstraints: stringList(input.operatingConstraints, 'Operating constraints', undefined, 16, 180),
    supportedPayloadTypes: stringList(input.supportedPayloadTypes, 'Supported payload types', undefined, 16, 120),
    capacity: capacity(input.capacity),
    communicationMethods: stringList(input.communicationMethods, 'Communication methods', COMMUNICATION_METHODS) as PhysicalCommunicationMethod[],
    evidenceMethods: stringList(input.evidenceMethods, 'Evidence methods', EVIDENCE_METHODS) as PhysicalEvidenceMethod[],
    supportedActions,
  };
  const db = await getDb();
  db.run(
    `UPDATE skills SET execution_profile_json=?, transport_mode=COALESCE(?,transport_mode), pricing_model=COALESCE(?,pricing_model) WHERE phone=? AND lower(skill)=lower(?)`,
    [JSON.stringify(profile), optionalText(input.transportMode, 'Transport mode', 80), optionalText(input.pricingModel, 'Pricing model', 120), providerPhone, capabilityName],
  );
  if (db.getRowsModified() !== 1) throw new Error('Physical execution capability declaration could not be stored');
  saveDb();
  return (await getPhysicalExecutionParticipant({ providerPhone, capability: capabilityName }))!;
}

export async function getPhysicalExecutionParticipant(input: { providerPhone: string; capability: string }): Promise<PhysicalExecutionParticipant | null> {
  const row = await findParticipantRow(requiredText(input.providerPhone, 'Provider phone', 128), requiredText(input.capability, 'Capability', 128));
  return row ? participantFromRow(row) : null;
}

/** Reuse canonical capability matching, then filter only by declared physical execution metadata. */
export async function matchPhysicalExecutionParticipants(input: {
  ownerPhone: string;
  capability: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  action: PhysicalExecutionAction;
  payloadType?: string;
  max?: number;
}): Promise<PhysicalExecutionParticipant[]> {
  const action = requiredText(input.action, 'Physical execution action', 80);
  if (!ACTIONS.has(action)) throw new Error('Unsupported physical execution action');
  const matched = await find_worker({
    skill: requiredText(input.capability, 'Capability', 128),
    ownerPhone: requiredText(input.ownerPhone, 'Owner phone', 128),
    location: input.location,
    latitude: input.latitude,
    longitude: input.longitude,
    max: Math.min(Math.max(Number(input.max || 8), 1), 15),
  });
  const payloadType = input.payloadType ? requiredText(input.payloadType, 'Payload type', 120) : null;
  const participants = await Promise.all(matched.providers.map((provider) => getPhysicalExecutionParticipant({ providerPhone: provider.phone, capability: input.capability })));
  const physicalParticipants = participants.filter((participant): participant is PhysicalExecutionParticipant => participant !== null);
  return physicalParticipants.filter((participant) => participant.available
    && participant.verificationState === 'verified'
    && participant.supportedActions.includes(action as PhysicalExecutionAction)
    && (!payloadType || participant.supportedPayloadTypes.includes(payloadType)));
}

export async function createBoundedPhysicalExecution(input: {
  requestId: string;
  actorPhone: string;
  providerPhone: string;
  role: EconomicParticipantRole;
  capability: string;
  actionRequested: PhysicalExecutionAction;
  actionId: string;
  idempotencyKey: string;
  correlationId: string;
  authorizationScope: {
    expiresAt: string;
    destinationBinding: string;
    allowedActions: PhysicalExecutionAction[];
    safetyPolicyRef: string;
    maxSpendMinor?: number;
  };
}): Promise<ExecutionRequestRecord> {
  const request = await getEconomicRequest(requiredText(input.requestId, 'Economic Request id', 128));
  if (!request) throw new Error('Economic Request not found');
  const actorPhone = requiredText(input.actorPhone, 'Actor phone', 128);
  if (request.phone !== actorPhone) throw new Error('Economic Request owner authorization is required');
  const actionRequested = requiredText(input.actionRequested, 'Physical execution action', 80);
  if (!ACTIONS.has(actionRequested)) throw new Error('Unsupported physical execution action');
  const participant = await getPhysicalExecutionParticipant({ providerPhone: input.providerPhone, capability: input.capability });
  if (!participant || !participant.available || participant.verificationState !== 'verified') throw new Error('Verified available physical execution participant is required');
  if (!participant.supportedActions.includes(actionRequested as PhysicalExecutionAction)) throw new Error('Participant capability does not permit this physical execution action');
  const scope = input.authorizationScope;
  const expiresAt = new Date(requiredText(scope.expiresAt, 'Authorization expiry', 64));
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) throw new Error('Physical execution authorization must have a future expiry');
  if (!Array.isArray(scope.allowedActions) || !scope.allowedActions.includes(actionRequested as PhysicalExecutionAction)) throw new Error('Physical execution action is outside the explicit authorization scope');
  const destinationBinding = deriveDestinationBinding(request.requirements);
  if (requiredText(scope.destinationBinding, 'Destination binding', 128) !== destinationBinding) throw new Error('Physical execution authorization is not bound to the current request destination');
  if (!Number.isInteger(scope.maxSpendMinor ?? 0) || Number(scope.maxSpendMinor ?? 0) < 0) throw new Error('Maximum spend must be a non-negative minor-unit integer');
  return createExecutionRequest({
    requestId: request.id,
    actionId: requiredText(input.actionId, 'Action id', 128),
    providerPhone: input.providerPhone,
    role: input.role,
    capability: input.capability,
    actionRequested,
    idempotencyKey: requiredText(input.idempotencyKey, 'Idempotency key', 256),
    correlationId: requiredText(input.correlationId, 'Correlation id', 256),
    authorizationContext: {
      physical_execution: {
        participant_type: participant.participantType,
        provider_type: participant.providerType,
        destination_binding: destinationBinding,
        authorization_expires_at: expiresAt.toISOString(),
        safety_policy_ref: requiredText(scope.safetyPolicyRef, 'Safety policy reference', 160),
        allowed_actions: scope.allowedActions,
        max_spend_minor: scope.maxSpendMinor ?? 0,
      },
    },
  });
}

/** Derive a readable physical stage from canonical execution state plus typed evidence; this is not a second persisted lifecycle. */
export function derivePhysicalExecutionStage(execution: ExecutionRequestRecord): PhysicalExecutionStage {
  if (execution.status === 'failed') return 'failed';
  if (execution.status === 'cancelled') return 'cancelled';
  if (execution.status === 'expired') return 'expired';
  if (execution.status === 'pending') return 'authorized';
  if (execution.status === 'dispatched') return 'assigned';
  if (execution.status === 'acknowledged') return 'accepted';
  const evidenceTypes = new Set(execution.evidence.map((evidence) => evidence.type));
  if (execution.status === 'in_progress') {
    if (evidenceTypes.has('delivery_confirmation')) return 'delivered';
    if (evidenceTypes.has('pickup_confirmation')) return 'picked_up';
    if (evidenceTypes.has('arrival_confirmation')) return 'arrived';
    if (evidenceTypes.has('en_route_update')) return 'en_route';
    return 'in_progress';
  }
  if (execution.status === 'succeeded') return execution.evidence.some((evidence) => evidence.verificationState === 'verified') ? 'completed' : 'evidence_pending';
  return 'requested';
}

export function getPhysicalExecutionDestinationBinding(requirements: Record<string, unknown>): string {
  return deriveDestinationBinding(requirements);
}
