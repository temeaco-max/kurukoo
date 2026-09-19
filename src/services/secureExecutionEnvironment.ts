/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
/**
 * Secure Execution Environment — isolated browser/VM execution boundary.
 * Isolated execution surface (sandboxed browser / headless runtime) for tasks
 * needing a real browser or OS-level action. Kurukoo-side infra (session
 * lifecycle, action queue, result retrieval, audit) is fully functional; the
 * actual browser runtime is delegated to a pluggable provider (Browserless,
 * Playwright-as-a-service) configured via SECURE_EXECUTION_PROVIDER.
 * Without a provider, the service degrades gracefully: sessions tracked,
 * actions queued, API reports "provider_required" for clear UI state.
 */
import crypto from 'crypto';
import { getCanonicalStore } from './canonicalStore.js';

export type SessionStatus = 'pending' | 'starting' | 'ready' | 'busy' | 'stopping' | 'stopped' | 'error' | 'provider_required';
export type ActionType = 'navigate' | 'click' | 'type' | 'screenshot' | 'extract' | 'scroll' | 'wait' | 'evaluate';
export type ActionStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SecureSession {
  id: string; ownerPhone: string; status: SessionStatus;
  providerRef?: string | null; createdAt: string; expiresAt: string;
  lastActionAt?: string | null; metadata?: Record<string, unknown>;
}

export interface ExecutionAction {
  id: string; sessionId: string; type: ActionType; payload: Record<string, unknown>;
  status: ActionStatus; result?: Record<string, unknown>; error?: string | null;
  createdAt: string; completedAt?: string | null;
}

async function ensureSchema(): Promise<void> {
  const store = await getCanonicalStore();
  await store.run(`CREATE TABLE IF NOT EXISTS secure_execution_sessions (
    id TEXT PRIMARY KEY, owner_phone TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
    provider_ref TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL, last_action_at TEXT, metadata_json TEXT)`);
  await store.run(`CREATE INDEX IF NOT EXISTS idx_secure_exec_sessions_owner ON secure_execution_sessions(owner_phone, status)`);
  await store.run(`CREATE TABLE IF NOT EXISTS secure_execution_actions (
    id TEXT PRIMARY KEY, session_id TEXT NOT NULL, type TEXT NOT NULL, payload_json TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'queued', result_json TEXT, error TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT)`);
  await store.run(`CREATE INDEX IF NOT EXISTS idx_secure_exec_actions_session ON secure_execution_actions(session_id, status)`);
}

export function isProviderConfigured(): boolean {
  return Boolean(process.env.SECURE_EXECUTION_PROVIDER || process.env.BROWSERLESS_TOKEN || process.env.PLAYWRIGHT_SERVICE_URL);
}

export async function createSession(ownerPhone: string, options: { ttlMinutes?: number; metadata?: Record<string, unknown> } = {}): Promise<SecureSession> {
  if (!ownerPhone) throw new Error('ownerPhone required');
  await ensureSchema();
  const store = await getCanonicalStore();
  const id = `ses:${ownerPhone}:${Date.now()}:${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (options.ttlMinutes ?? 30) * 60_000).toISOString();
  const status: SessionStatus = isProviderConfigured() ? 'starting' : 'provider_required';
  await store.run(`INSERT INTO secure_execution_sessions (id, owner_phone, status, expires_at, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, ownerPhone, status, expiresAt, options.metadata ? JSON.stringify(options.metadata) : null, now.toISOString()]);
  return { id, ownerPhone, status, createdAt: now.toISOString(), expiresAt, metadata: options.metadata };
}

export async function listSessions(ownerPhone: string): Promise<SecureSession[]> {
  if (!ownerPhone) return [];
  await ensureSchema();
  const store = await getCanonicalStore();
  const rows = await store.all<any>(`SELECT * FROM secure_execution_sessions WHERE owner_phone = ? ORDER BY created_at DESC`, [ownerPhone]);
  return rows.map((r: any) => ({ id: String(r.id), ownerPhone: String(r.owner_phone), status: r.status as SessionStatus, providerRef: r.provider_ref ? String(r.provider_ref) : null, createdAt: String(r.created_at), expiresAt: String(r.expires_at), lastActionAt: r.last_action_at ? String(r.last_action_at) : null, metadata: r.metadata_json ? JSON.parse(r.metadata_json) : undefined }));
}

export async function getSession(ownerPhone: string, id: string): Promise<SecureSession | null> {
  if (!ownerPhone || !id) return null;
  await ensureSchema();
  const store = await getCanonicalStore();
  const row = await store.one<any>(`SELECT * FROM secure_execution_sessions WHERE id = ? AND owner_phone = ?`, [id, ownerPhone]);
  if (!row) return null;
  return { id: String(row.id), ownerPhone: String(row.owner_phone), status: row.status as SessionStatus, providerRef: row.provider_ref ? String(row.provider_ref) : null, createdAt: String(row.created_at), expiresAt: String(row.expires_at), lastActionAt: row.last_action_at ? String(row.last_action_at) : null, metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined };
}

export async function queueAction(ownerPhone: string, sessionId: string, type: ActionType, payload: Record<string, unknown> = {}): Promise<ExecutionAction> {
  if (!ownerPhone || !sessionId || !type) throw new Error('ownerPhone, sessionId, type required');
  const session = await getSession(ownerPhone, sessionId);
  if (!session) throw new Error('session not found');
  if (session.status === 'provider_required') throw new Error('provider_required');
  await ensureSchema();
  const store = await getCanonicalStore();
  const id = `act:${sessionId}:${Date.now()}:${crypto.randomBytes(4).toString('hex')}`;
  await store.run(`INSERT INTO secure_execution_actions (id, session_id, type, payload_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, sessionId, type, JSON.stringify(payload), 'queued', new Date().toISOString()]);
  await store.run(`UPDATE secure_execution_sessions SET last_action_at = CURRENT_TIMESTAMP, status = ? WHERE id = ?`, ['busy', sessionId]);
  return { id, sessionId, type, payload, status: 'queued', createdAt: new Date().toISOString() };
}

export async function listActions(ownerPhone: string, sessionId: string): Promise<ExecutionAction[]> {
  if (!ownerPhone || !sessionId) return [];
  await ensureSchema();
  const store = await getCanonicalStore();
  const rows = await store.all<any>(`SELECT * FROM secure_execution_actions WHERE session_id = ? ORDER BY created_at ASC`, [sessionId]);
  return rows.map((r: any) => ({ id: String(r.id), sessionId: String(r.session_id), type: r.type as ActionType, payload: JSON.parse(r.payload_json || '{}'), status: r.status as ActionStatus, result: r.result_json ? JSON.parse(r.result_json) : undefined, error: r.error ? String(r.error) : null, createdAt: String(r.created_at), completedAt: r.completed_at ? String(r.completed_at) : null }));
}

export async function stopSession(ownerPhone: string, id: string): Promise<boolean> {
  if (!ownerPhone || !id) return false;
  await ensureSchema();
  const store = await getCanonicalStore();
  const res = await store.run(`UPDATE secure_execution_sessions SET status = 'stopped' WHERE id = ? AND owner_phone = ? AND status NOT IN ('stopped','error')`, [id, ownerPhone]);
  return res.rowCount > 0;
}

