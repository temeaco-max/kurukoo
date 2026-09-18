/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';

/**
 * User-owned MCP server registry (BYOT).
 *
 * Users can register their own Model Context Protocol servers (Claude, custom
 * tools, business systems) so Kurukoo can call tools the user already owns.
 * Servers are owner-scoped, revocable, and every tool call is evidence-logged.
 * An unreachable, unauthorized, or slow server fails closed; nothing is
 * invented on its behalf. MCP consumption never bypasses capability
 * authorization: external tools can only act where a connector or capability
 * grant already permits.
 */

export interface RegisteredMcpServer {
  id: string;
  ownerPhone: string;
  label: string;
  endpoint: string;
  status: 'active' | 'disabled' | 'revoked';
  lastTestStatus: 'never_tested' | 'verified' | 'failed' | 'unavailable';
  lastTestMessage: string | null;
  createdAt: string;
}

const MAX_BODY_BYTES = 256_000;

function clean(value: unknown, field: string, max: number): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${field} is required.`);
  if (text.length > max) throw new Error(`${field} is too long.`);
  return text;
}

async function ensureSchema() {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS user_mcp_servers (
    id TEXT PRIMARY KEY, owner_phone TEXT NOT NULL, label TEXT NOT NULL,
    endpoint TEXT NOT NULL, auth_header TEXT, status TEXT NOT NULL DEFAULT 'active',
    last_test_status TEXT NOT NULL DEFAULT 'never_tested', last_test_message TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_mcp_servers_owner ON user_mcp_servers(owner_phone,status)`);
  db.run(`CREATE TABLE IF NOT EXISTS user_mcp_tool_calls (
    id TEXT PRIMARY KEY, server_id TEXT NOT NULL, owner_phone TEXT NOT NULL,
    tool_name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'started',
    result_summary TEXT, error_code TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_mcp_tool_calls_server ON user_mcp_tool_calls(server_id,created_at DESC)`);
  saveDb();
  return db;
}

function httpsOnly(endpoint: string): string {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error('MCP server endpoints must use HTTPS in production; HTTP is allowed only for localhost development servers.');
  }
  return url.toString();
}

async function activeServer(ownerPhone: string, serverId: string) {
  const db = await ensureSchema();
  const stmt = db.prepare(`SELECT id, owner_phone, label, endpoint, auth_header, status, last_test_status, last_test_message, created_at FROM user_mcp_servers WHERE id=? AND owner_phone=? LIMIT 1`);
  stmt.bind([serverId, ownerPhone]);
  const row = stmt.step() ? stmt.getAsObject() as Record<string, unknown> : null;
  stmt.free();
  if (!row || String(row.status) !== 'active') throw new Error('The registered MCP server is unavailable, disabled, or revoked.');
  return { db, id: String(row.id), label: String(row.label), endpoint: String(row.endpoint), authHeader: row.auth_header ? String(row.auth_header) : null };
}
async function jsonRpc(endpoint: string, authHeader: string | null, method: string, params: Record<string, unknown>): Promise<unknown> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: `kurukoo-${Date.now().toString(36)}`, method, params }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(`The MCP server rejected the request (HTTP ${response.status}).`);
  if (payload?.error) {
    const message = typeof (payload.error as Record<string, unknown>)?.message === 'string'
      ? String((payload.error as Record<string, unknown>).message)
      : 'The MCP server returned an error.';
    throw new Error(message.slice(0, 240));
  }
  return payload?.result;
}

function cap(summary: unknown): string {
  const text = typeof summary === 'string' ? summary : JSON.stringify(summary);
  return text.length > MAX_BODY_BYTES
    ? ''
    : text.slice(0, 4_000);
}

export async function registerMcpServer(input: { ownerPhone: string; label: string; endpoint: string; authHeader?: string }): Promise<RegisteredMcpServer> {
  const ownerPhone = clean(input.ownerPhone, 'Owner phone', 64);
  const label = clean(input.label, 'Server label', 120);
  const endpoint = httpsOnly(clean(input.endpoint, 'Server endpoint', 2048));
  const authHeader = typeof input.authHeader === 'string' && input.authHeader.trim() ? input.authHeader.trim().slice(0, 500) : null;
  const db = await ensureSchema();
  const id = `mcp_${crypto.randomUUID()}`;
  db.run(`INSERT INTO user_mcp_servers (id,owner_phone,label,endpoint,auth_header,status) VALUES (?,?,?,?,?,'active')`, [id, ownerPhone, label, endpoint, authHeader]);
  saveDb();
  return { id, ownerPhone, label, endpoint, status: 'active', lastTestStatus: 'never_tested', lastTestMessage: null, createdAt: new Date().toISOString() };
}

export async function listMcpServers(ownerPhone: string): Promise<RegisteredMcpServer[]> {
  const db = await ensureSchema();
  const stmt = db.prepare(`SELECT id, owner_phone, label, endpoint, status, last_test_status, last_test_message, created_at FROM user_mcp_servers WHERE owner_phone=? AND status!='revoked' ORDER BY created_at DESC LIMIT 50`);
  stmt.bind([String(ownerPhone)]);
  const out: RegisteredMcpServer[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    out.push({ id: String(row.id), ownerPhone: String(row.owner_phone), label: String(row.label), endpoint: String(row.endpoint), status: String(row.status) as RegisteredMcpServer['status'], lastTestStatus: String(row.last_test_status) as RegisteredMcpServer['lastTestStatus'], lastTestMessage: row.last_test_message ? String(row.last_test_message) : null, createdAt: String(row.created_at) });
  }
  stmt.free();
  return out;
}

export async function setMcpServerStatus(input: { ownerPhone: string; serverId: string; status: 'active' | 'disabled' | 'revoked' }): Promise<void> {
  const db = await ensureSchema();
  db.run(`UPDATE user_mcp_servers SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_phone=?`, [input.status, input.serverId, input.ownerPhone]);
  saveDb();
}

export async function testMcpServer(input: { ownerPhone: string; serverId: string }): Promise<{ ok: boolean; toolsReturned: number; message: string }> {
  const { db, id, label, endpoint, authHeader } = await activeServer(input.ownerPhone, input.serverId);
  try {
    const result = await jsonRpc(endpoint, authHeader, 'tools/list', {});
    const tools = Array.isArray((result as Record<string, unknown>)?.tools) ? (result as { tools: unknown[] }).tools : [];
    db.run(`UPDATE user_mcp_servers SET last_test_status='verified', last_test_message=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [`${label}: ${tools.length} tool(s) listed. Connection is provider-confirmed, not a delivery claim.`, id]);
    saveDb();
    return { ok: true, toolsReturned: tools.length, message: 'Connection verified: the MCP server listed its tools.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MCP server connection failed.';
    db.run(`UPDATE user_mcp_servers SET last_test_status='failed', last_test_message=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [message.slice(0, 240), id]);
    saveDb();
    return { ok: false, toolsReturned: 0, message };
  }
}

export async function callMcpTool(input: { ownerPhone: string; serverId: string; toolName: string; toolInput?: Record<string, unknown> }): Promise<{ tool: string; ok: boolean; result?: unknown; error?: string }> {
  const { db, id, endpoint, authHeader } = await activeServer(input.ownerPhone, input.serverId);
  const toolName = clean(input.toolName, 'Tool name', 160);
  const callId = `mct_${crypto.randomUUID()}`;
  db.run(`INSERT INTO user_mcp_tool_calls (id,server_id,owner_phone,tool_name,status) VALUES (?,?,?,?,'started')`, [callId, id, input.ownerPhone, toolName]);
  saveDb();
  try {
    const toolInput = input.toolInput && typeof input.toolInput === 'object' && !Array.isArray(input.toolInput) ? input.toolInput : {};
    const result = await jsonRpc(endpoint, authHeader, 'tools/call', { name: toolName, arguments: toolInput });
    db.run(`UPDATE user_mcp_tool_calls SET status='succeeded', result_summary=? WHERE id=?`, [cap(result), callId]);
    saveDb();
    return { tool: toolName, ok: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MCP tool call failed.';
    db.run(`UPDATE user_mcp_tool_calls SET status='failed', error_code=? WHERE id=?`, [message.slice(0, 240), callId]);
    saveDb();
    return { tool: toolName, ok: false, error: message.slice(0, 240) };
  }
}