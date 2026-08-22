import crypto from 'crypto';
import { getDb, saveDb } from '../database.js';
import { getEconomicRequest } from './skillFlows.js';
import { getEconomicParticipants, type EconomicParticipant, type EconomicParticipantRole } from './economicParticipants.js';
import { generateProxyNumber, getPrivacyBridgeStatus } from './privacyBridge.js';

export const EXECUTION_STATUSES = [
  'pending',
  'dispatched',
  'acknowledged',
  'in_progress',
  'succeeded',
  'failed',
  'cancelled',
  'expired',
] as const;

export type ExecutionStatus = typeof EXECUTION_STATUSES[number];

export const EVIDENCE_SOURCES = [
  'provider_reported',
  'connector_reported',
  'kurukoo_recorded',
  'unverified_participant',
] as const;

export type EvidenceSource = typeof EVIDENCE_SOURCES[number];

export const EVIDENCE_VERIFICATION_STATES = [
  'unverified',
  'pending_review',
  'verified',
  'rejected',
] as const;

export type EvidenceVerificationState = typeof EVIDENCE_VERIFICATION_STATES[number];

export interface ExecutionEvidence {
  id: string;
  source: EvidenceSource;
  type: string;
  scope: string;
  submittedBy: string;
  verificationState: EvidenceVerificationState;
  payload: Record<string, unknown>;
  recordedAt: string;
}

export interface ExecutionRequestRecord {
  id: string;
  requestId: string;
  actionId: string;
  providerPhone: string;
  role: EconomicParticipantRole;
  capability: string;
  actionRequested: string;
  idempotencyKey: string;
  correlationId: string;
  connectorId: string;
  authorizationContext: Record<string, unknown>;
  status: ExecutionStatus;
  externalReference: string | null;
  failureReason: string | null;
  evidence: ExecutionEvidence[];
  requestedAt: string;
  updatedAt: string;
}

export interface ConnectorAdapter {
  connectorId: string;
  name: string;
  dispatch(execution: ExecutionRequestRecord): Promise<{
    externalReference?: string;
    status: Extract<ExecutionStatus, 'acknowledged' | 'failed'>;
    failureReason?: string;
    evidence?: Omit<ExecutionEvidence, 'id' | 'recordedAt'> & { id?: string };
  }>;
}

const STATUS_SET = new Set<string>(EXECUTION_STATUSES);
const EVIDENCE_SOURCE_SET = new Set<string>(EVIDENCE_SOURCES);
const EVIDENCE_STATE_SET = new Set<string>(EVIDENCE_VERIFICATION_STATES);
const STATUS_TRANSITIONS: Record<ExecutionStatus, readonly ExecutionStatus[]> = {
  pending: ['dispatched', 'failed', 'cancelled', 'expired'],
  dispatched: ['acknowledged', 'failed', 'cancelled', 'expired'],
  acknowledged: ['in_progress', 'failed', 'cancelled', 'expired'],
  in_progress: ['succeeded', 'failed', 'cancelled', 'expired'],
  succeeded: [],
  failed: [],
  cancelled: [],
  expired: [],
};

function parseJsonObject(value: unknown): Record<string, unknown> {
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function parseEvidence(value: unknown): ExecutionEvidence[] {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed as ExecutionEvidence[] : [];
  } catch {
    return [];
  }
}

function mapExecution(row: any): ExecutionRequestRecord {
  return {
    id: String(row.id),
    requestId: String(row.request_id),
    actionId: String(row.action_id),
    providerPhone: String(row.provider_phone),
    role: String(row.role) as EconomicParticipantRole,
    capability: String(row.capability),
    actionRequested: String(row.action_requested),
    idempotencyKey: String(row.idempotency_key),
    correlationId: String(row.correlation_id),
    connectorId: String(row.connector_id),
    authorizationContext: parseJsonObject(row.authorization_context),
    status: String(row.status) as ExecutionStatus,
    externalReference: row.external_reference ? String(row.external_reference) : null,
    failureReason: row.failure_reason ? String(row.failure_reason) : null,
    evidence: parseEvidence(row.evidence_json),
    requestedAt: String(row.requested_at),
    updatedAt: String(row.updated_at),
  };
}

function cleanText(value: unknown, field: string, maxLength = 200): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${field} is too long`);
  return text;
}

function validateStatus(value: unknown): ExecutionStatus {
  const status = cleanText(value, 'Execution status', 32);
  if (!STATUS_SET.has(status)) throw new Error('Unsupported execution status');
  return status as ExecutionStatus;
}

function validateEvidenceSource(value: unknown): EvidenceSource {
  const source = cleanText(value, 'Evidence source', 64);
  if (!EVIDENCE_SOURCE_SET.has(source)) throw new Error('Unsupported evidence source');
  return source as EvidenceSource;
}

function validateEvidenceState(value: unknown): EvidenceVerificationState {
  const state = cleanText(value, 'Evidence verification state', 64);
  if (!EVIDENCE_STATE_SET.has(state)) throw new Error('Unsupported evidence verification state');
  return state as EvidenceVerificationState;
}

export class ExecutionAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExecutionAuthorizationError';
  }
}

export class ExecutionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExecutionConflictError';
  }
}

const connectors = new Map<string, ConnectorAdapter>();

class DummyTestConnector implements ConnectorAdapter {
  connectorId = 'kurukoo_dummy_test_v1';
  name = 'Kurukoo Standard Test Connector';

  async dispatch(execution: ExecutionRequestRecord) {
    return {
      externalReference: `DUMMY-${execution.id.toUpperCase()}`,
      status: 'acknowledged' as const,
      evidence: {
        source: 'connector_reported' as const,
        type: 'dispatch_acknowledgement',
        scope: execution.role,
        submittedBy: this.connectorId,
        verificationState: 'pending_review' as const,
        payload: { connector: this.connectorId, action: execution.actionRequested },
      },
    };
  }
}

export const dummyTestConnector = new DummyTestConnector();
connectors.set(dummyTestConnector.connectorId, dummyTestConnector);

export function registerConnector(adapter: ConnectorAdapter): void {
  connectors.set(cleanText(adapter.connectorId, 'Connector id', 128), adapter);
}

export function getConnector(connectorId: string): ConnectorAdapter | null {
  return connectors.get(connectorId) || null;
}

async function getExecutionTable() {
  return getDb();
}

async function getProviderAuthorization(providerPhone: string, capability: string, actionRequested: string) {
  const db = await getExecutionTable();
  const stmt = db.prepare(`
    SELECT connector_id, external_provider_id, allowed_actions_json
    FROM provider_execution_connectors
    WHERE provider_phone=? AND capability=? AND authorization_status='active'
    ORDER BY updated_at DESC, id DESC
    LIMIT 1
  `);
  stmt.bind([providerPhone, capability]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  if (!row) return null;
  const allowedActions = (() => {
    try {
      const parsed = JSON.parse(String(row.allowed_actions_json || '[]'));
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  })();
  if (allowedActions.length && !allowedActions.includes(actionRequested)) return null;
  const connectorId = String(row.connector_id);
  if (!getConnector(connectorId)) return null;
  return { connectorId, externalProviderId: row.external_provider_id ? String(row.external_provider_id) : null };
}

/**
 * Explicitly grant a connector relationship for tests or a separately authorized
 * provider-onboarding flow. Provider type alone never creates this relationship.
 */
export async function authorizeProviderConnector(input: {
  providerPhone: string;
  connectorId: string;
  capability: string;
  externalProviderId?: string | null;
  allowedActions?: string[];
}): Promise<void> {
  const providerPhone = cleanText(input.providerPhone, 'Provider phone', 128);
  const connectorId = cleanText(input.connectorId, 'Connector id', 128);
  const capability = cleanText(input.capability, 'Capability', 128);
  if (!getConnector(connectorId)) throw new ExecutionAuthorizationError('Connector is not registered');
  const actions = input.allowedActions || [];
  if (!Array.isArray(actions) || actions.some((action) => typeof action !== 'string' || !action.trim())) {
    throw new ExecutionAuthorizationError('Allowed connector actions must be strings');
  }
  const db = await getExecutionTable();
  db.run(`
    INSERT INTO provider_execution_connectors
      (provider_phone,connector_id,capability,external_provider_id,authorization_status,allowed_actions_json)
    VALUES (?,?,?,?, 'active', ?)
    ON CONFLICT(provider_phone,connector_id,capability) DO UPDATE SET
      external_provider_id=excluded.external_provider_id,
      authorization_status='active',
      allowed_actions_json=excluded.allowed_actions_json,
      updated_at=CURRENT_TIMESTAMP
  `, [providerPhone, connectorId, capability, input.externalProviderId || null, JSON.stringify(actions)]);
  saveDb();
}

export async function revokeProviderConnector(input: { providerPhone: string; connectorId: string; capability: string }): Promise<void> {
  const db = await getExecutionTable();
  db.run(`UPDATE provider_execution_connectors SET authorization_status='revoked', updated_at=CURRENT_TIMESTAMP WHERE provider_phone=? AND connector_id=? AND capability=?`, [
    cleanText(input.providerPhone, 'Provider phone', 128),
    cleanText(input.connectorId, 'Connector id', 128),
    cleanText(input.capability, 'Capability', 128),
  ]);
  saveDb();
}

export async function authorizeProviderExecution(input: {
  requestId: string;
  providerPhone: string;
  role: EconomicParticipantRole;
  capability: string;
  actionRequested: string;
}): Promise<{ authorized: true; connectorId: string; externalProviderId: string | null } | { authorized: false; reason: string }> {
  const request = await getEconomicRequest(cleanText(input.requestId, 'Request id', 128));
  if (!request) return { authorized: false, reason: 'Economic Request not found' };
  const providerPhone = cleanText(input.providerPhone, 'Provider phone', 128);
  const capability = cleanText(input.capability, 'Capability', 128);
  const actionRequested = cleanText(input.actionRequested, 'Action requested', 256);
  const participants = await getEconomicParticipants(request.id);
  const participant = participants.find((item: EconomicParticipant) => item.providerPhone === providerPhone && item.role === input.role);
  if (!participant) return { authorized: false, reason: 'Provider is not a participant on this Economic Request' };
  if (['declined', 'withdrawn'].includes(participant.status)) return { authorized: false, reason: 'Participant is not eligible for execution' };

  const db = await getExecutionTable();
  const profileStmt = db.prepare('SELECT verified_provider, is_available FROM memory_profiles WHERE phone=? LIMIT 1');
  profileStmt.bind([providerPhone]);
  const profile = profileStmt.step() ? profileStmt.getAsObject() : null;
  profileStmt.free();
  if (!profile) return { authorized: false, reason: 'Provider profile not found' };
  if (Number(profile.verified_provider) !== 1) return { authorized: false, reason: 'Provider is not verified' };
  if (Number(profile.is_available) !== 1) return { authorized: false, reason: 'Provider is unavailable' };

  const skillStmt = db.prepare('SELECT 1 FROM skills WHERE phone=? AND lower(skill)=lower(?) AND is_available=1 LIMIT 1');
  skillStmt.bind([providerPhone, capability]);
  const hasCapability = skillStmt.step();
  skillStmt.free();
  if (!hasCapability) return { authorized: false, reason: 'Provider does not have the required active capability' };

  const authorization = await getProviderAuthorization(providerPhone, capability, actionRequested);
  if (!authorization) return { authorized: false, reason: 'No active authorized connector permits this action' };
  return { authorized: true, ...authorization };
}

export async function getExecutionRequest(id: string): Promise<ExecutionRequestRecord | null> {
  const db = await getExecutionTable();
  const stmt = db.prepare('SELECT * FROM execution_requests WHERE id=? LIMIT 1');
  stmt.bind([cleanText(id, 'Execution id', 128)]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row ? mapExecution(row) : null;
}

export async function getExecutionRequestsForRequest(requestId: string): Promise<ExecutionRequestRecord[]> {
  const db = await getExecutionTable();
  const stmt = db.prepare('SELECT * FROM execution_requests WHERE request_id=? ORDER BY requested_at ASC, id ASC');
  stmt.bind([cleanText(requestId, 'Request id', 128)]);
  const rows: ExecutionRequestRecord[] = [];
  while (stmt.step()) rows.push(mapExecution(stmt.getAsObject()));
  stmt.free();
  return rows;
}

export async function createExecutionRequest(input: {
  requestId: string;
  actionId: string;
  providerPhone: string;
  role: EconomicParticipantRole;
  capability: string;
  actionRequested: string;
  idempotencyKey: string;
  correlationId: string;
  authorizationContext?: Record<string, unknown>;
}): Promise<ExecutionRequestRecord> {
  const requestId = cleanText(input.requestId, 'Request id', 128);
  const actionId = cleanText(input.actionId, 'Action id', 128);
  const idempotencyKey = cleanText(input.idempotencyKey, 'Idempotency key', 256);
  const db = await getExecutionTable();
  const existingStmt = db.prepare('SELECT * FROM execution_requests WHERE idempotency_key=? LIMIT 1');
  existingStmt.bind([idempotencyKey]);
  const existing = existingStmt.step() ? existingStmt.getAsObject() : null;
  existingStmt.free();
  if (existing) {
    const existingRecord = mapExecution(existing);
    if (existingRecord.requestId !== requestId || existingRecord.providerPhone !== input.providerPhone || existingRecord.actionRequested !== input.actionRequested) {
      throw new ExecutionConflictError('Idempotency key is already bound to a different execution');
    }
    return existingRecord;
  }

  const authorization = await authorizeProviderExecution({
    requestId,
    providerPhone: input.providerPhone,
    role: input.role,
    capability: input.capability,
    actionRequested: input.actionRequested,
  });
  if (!authorization.authorized) throw new ExecutionAuthorizationError(authorization.reason);

  const authorizationContext = { ...(input.authorizationContext || {}) };
  const masking = getPrivacyBridgeStatus();
  if (masking.enabled && masking.configured) {
    const proxyPhone = await generateProxyNumber(input.providerPhone, `execution:${requestId}`);
    authorizationContext.privateContactNumber = proxyPhone;
    authorizationContext.numberMasking = 'proxy_mapping_ready';
  }

  const id = `exec_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  db.run(`
    INSERT INTO execution_requests
      (id,request_id,action_id,provider_phone,role,capability,action_requested,idempotency_key,correlation_id,connector_id,authorization_context,status,requested_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending',?,?)
  `, [
    id,
    requestId,
    actionId,
    cleanText(input.providerPhone, 'Provider phone', 128),
    input.role,
    cleanText(input.capability, 'Capability', 128),
    cleanText(input.actionRequested, 'Action requested', 256),
    idempotencyKey,
    cleanText(input.correlationId, 'Correlation id', 256),
    authorization.connectorId,
    JSON.stringify({ ...authorizationContext, connector_id: authorization.connectorId, authorized_at: now }),
    now,
    now,
  ]);
  saveDb();
  return (await getExecutionRequest(id))!;
}

/**
 * Complete a local development execution through the same connector/evidence boundary.
 *
 * This is deliberately limited to the registered dummy connector and non-production
 * environments. It is a deterministic local adapter, not evidence of a real-world
 * provider dispatch, delivery, or completion.
 */
export async function completeDevelopmentExecution(id: string): Promise<ExecutionRequestRecord> {
  const execution = await getExecutionRequest(id);
  if (!execution) throw new Error('Execution request not found');
  if (execution.connectorId !== dummyTestConnector.connectorId || process.env.NODE_ENV === 'production') return execution;
  let current = execution;
  if (current.status === 'pending' || current.status === 'dispatched') current = await dispatchExecutionRequest(current.id);
  if (current.status === 'acknowledged') current = await updateExecutionStatus(current.id, 'in_progress');
  if (current.status === 'in_progress') {
    current = await recordExecutionEvidence(current.id, {
      id: `dev-dispatch:${current.id}`,
      source: 'connector_reported',
      type: 'development_dispatch_progress',
      scope: current.role,
      submittedBy: dummyTestConnector.connectorId,
      verificationState: 'pending_review',
      payload: { environment: 'development', simulated: true, action: current.actionRequested },
    });
    current = await updateExecutionStatus(current.id, 'succeeded');
    current = await recordExecutionEvidence(current.id, {
      id: `dev-completion:${current.id}`,
      source: 'connector_reported',
      type: 'development_execution_result',
      scope: current.role,
      submittedBy: dummyTestConnector.connectorId,
      verificationState: 'pending_review',
      payload: { environment: 'development', simulated: true, result: 'succeeded' },
    });
  }
  return current;
}

export async function dispatchExecutionRequest(id: string): Promise<ExecutionRequestRecord> {
  const execution = await getExecutionRequest(id);
  if (!execution) throw new Error('Execution request not found');
  if (['acknowledged', 'in_progress', 'succeeded', 'failed', 'cancelled', 'expired'].includes(execution.status)) return execution;
  if (Object.prototype.hasOwnProperty.call(execution.authorizationContext, 'physical_execution')) {
    const { validatePhysicalExecutionAuthorizationAtDispatch } = await import('./physicalExecutionParticipant.js');
    const physicalAuthorization = await validatePhysicalExecutionAuthorizationAtDispatch(execution);
    if (!physicalAuthorization.valid) {
      const status = /authorization has expired/i.test(physicalAuthorization.reason) ? 'expired' : 'failed';
      return updateExecutionStatus(id, status, { failureReason: `Physical execution authorization failed: ${physicalAuthorization.reason}` });
    }
  }
  const actionTimeAuthorization = await authorizeProviderExecution({
    requestId: execution.requestId,
    providerPhone: execution.providerPhone,
    role: execution.role,
    capability: execution.capability,
    actionRequested: execution.actionRequested,
  });
  if (!actionTimeAuthorization.authorized) {
    return updateExecutionStatus(id, 'failed', { failureReason: `Action-time authorization failed: ${actionTimeAuthorization.reason}` });
  }
  if (actionTimeAuthorization.connectorId !== execution.connectorId) {
    return updateExecutionStatus(id, 'failed', { failureReason: 'Authorized connector changed before dispatch' });
  }
  const connector = getConnector(execution.connectorId);
  if (!connector) return updateExecutionStatus(id, 'failed', { failureReason: 'Registered connector is unavailable' });
  const dispatched = execution.status === 'pending'
    ? await updateExecutionStatus(id, 'dispatched')
    : execution;
  try {
    const result = await connector.dispatch(dispatched);
    let updated = await updateExecutionStatus(id, result.status, {
      externalReference: result.externalReference,
      failureReason: result.failureReason,
    });
    if (result.evidence) updated = await recordExecutionEvidence(id, result.evidence);
    return updated;
  } catch (error) {
    return updateExecutionStatus(id, 'failed', { failureReason: error instanceof Error ? error.message : 'Connector dispatch failed' });
  }
}

/**
 * Bounded external execution worker. It only runs when the deployment has explicitly
 * enabled external execution, and each candidate still passes the authorization and
 * connector checks captured when the execution request was created.
 */
export async function drainPendingExecutionRequests(limit = 20): Promise<{ attempted: number; advanced: number; failed: number }> {
  if (process.env.KURUKOO_EXTERNAL_EXECUTION_ENABLED !== 'true') return { attempted: 0, advanced: 0, failed: 0 };
  const db = await getExecutionTable();
  const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 20)));
  const stmt = db.prepare(`SELECT id FROM execution_requests WHERE status IN ('pending','dispatched') ORDER BY requested_at ASC,id ASC LIMIT ?`);
  stmt.bind([safeLimit]);
  const ids: string[] = [];
  while (stmt.step()) ids.push(String((stmt.getAsObject() as any).id));
  stmt.free();
  let advanced = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      const before = await getExecutionRequest(id);
      const after = await dispatchExecutionRequest(id);
      if (before && after.status !== before.status) advanced += 1;
      if (after.status === 'failed') failed += 1;
    } catch (error) {
      failed += 1;
      console.error('[ExecutionWorker] Dispatch failed:', error instanceof Error ? error.message : error);
    }
  }
  return { attempted: ids.length, advanced, failed };
}

export async function updateExecutionStatus(id: string, statusValue: ExecutionStatus, patch: { externalReference?: string; failureReason?: string } = {}): Promise<ExecutionRequestRecord> {
  const status = validateStatus(statusValue);
  const db = await getExecutionTable();
  const current = await getExecutionRequest(id);
  if (!current) throw new Error('Execution request not found');
  if (current.status === status) return current;
  if (status === 'succeeded' && typeof current.authorizationContext.external_agent_authorization_id === 'string') {
    const reviewedCompletion = current.evidence.some(item => item.type === 'external_agent_completion_claim' && item.verificationState === 'verified');
    if (!reviewedCompletion) throw new ExecutionAuthorizationError('External-agent completion requires verified canonical evidence');
  }
  if (!STATUS_TRANSITIONS[current.status].includes(status)) throw new ExecutionConflictError(`Invalid execution transition: ${current.status} -> ${status}`);
  db.run(`UPDATE execution_requests SET status=?, external_reference=COALESCE(?,external_reference), failure_reason=COALESCE(?,failure_reason), updated_at=CURRENT_TIMESTAMP WHERE id=?`, [
    status,
    patch.externalReference || null,
    patch.failureReason || null,
    current.id,
  ]);
  saveDb();
  return (await getExecutionRequest(current.id))!;
}

export async function recordExecutionEvidence(id: string, input: {
  id?: string;
  source: EvidenceSource;
  type: string;
  scope: string;
  submittedBy: string;
  verificationState?: EvidenceVerificationState;
  payload?: Record<string, unknown>;
}): Promise<ExecutionRequestRecord> {
  const execution = await getExecutionRequest(id);
  if (!execution) throw new Error('Execution request not found');
  const verificationState = input.verificationState === undefined ? 'unverified' : validateEvidenceState(input.verificationState);
  if (verificationState === 'verified' || verificationState === 'rejected') {
    throw new ExecutionAuthorizationError('Recorded execution evidence must remain unverified or pending review; use the canonical evidence review boundary');
  }
  const evidenceId = input.id || crypto.randomUUID();
  const existing = execution.evidence.find((item) => item.id === evidenceId);
  if (existing) return execution;
  const evidence: ExecutionEvidence = {
    id: evidenceId,
    source: validateEvidenceSource(input.source),
    type: cleanText(input.type, 'Evidence type', 128),
    scope: cleanText(input.scope, 'Evidence scope', 128),
    submittedBy: cleanText(input.submittedBy, 'Evidence submitter', 128),
    verificationState,
    payload: input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload) ? input.payload : {},
    recordedAt: new Date().toISOString(),
  };
  const db = await getExecutionTable();
  db.run('UPDATE execution_requests SET evidence_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [JSON.stringify([...execution.evidence, evidence]), execution.id]);
  saveDb();
  return (await getExecutionRequest(execution.id))!;
}

/**
 * A canonical reviewer may classify an already-recorded evidence item without
 * changing the execution lifecycle. In particular, verifying evidence does not
 * itself convert an external completion claim into a completed outcome.
 */
export async function reviewExecutionEvidence(input: {
  executionId: string;
  evidenceId: string;
  verificationState: Extract<EvidenceVerificationState, 'verified' | 'rejected'>;
  reviewedBy: string;
}): Promise<ExecutionRequestRecord> {
  const execution = await getExecutionRequest(input.executionId);
  if (!execution) throw new Error('Execution request not found');
  const evidenceId = cleanText(input.evidenceId, 'Evidence id', 128);
  const reviewedBy = cleanText(input.reviewedBy, 'Reviewer identity', 128);
  if (!['verified', 'rejected'].includes(input.verificationState)) throw new Error('Evidence review must be verified or rejected');
  const evidence = execution.evidence.find(item => item.id === evidenceId);
  if (!evidence) throw new Error('Execution evidence not found');
  if (evidence.verificationState === input.verificationState && evidence.payload.reviewed_by === reviewedBy) return execution;
  const reviewedAt = new Date().toISOString();
  const updatedEvidence = execution.evidence.map(item => item.id === evidenceId
    ? { ...item, verificationState: input.verificationState, payload: { ...item.payload, reviewed_by: reviewedBy, reviewed_at: reviewedAt } }
    : item,
  );
  const db = await getExecutionTable();
  db.run('UPDATE execution_requests SET evidence_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [JSON.stringify(updatedEvidence), execution.id]);
  saveDb();
  return (await getExecutionRequest(execution.id))!;
}
