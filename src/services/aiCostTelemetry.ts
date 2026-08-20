import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';

export interface AiUsageEvent {
  requestId?: string;
  phone?: string;
  agentId?: string;
  skill?: string;
  category?: string;
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  estimatedCostUsd?: number | null;
  latencyMs?: number;
  success: boolean;
  escalationReason?: string;
  occurredAt?: string;
}

async function ensureTable() {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS ai_usage_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id TEXT,
    user_scope TEXT,
    agent_id TEXT,
    skill TEXT,
    category TEXT,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cached_tokens INTEGER,
    estimated_cost_usd REAL,
    latency_ms INTEGER,
    success INTEGER NOT NULL,
    escalation_reason TEXT,
    occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ai_usage_events_provider_time ON ai_usage_events(provider, occurred_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ai_usage_events_skill_time ON ai_usage_events(skill, occurred_at)`);
  return db;
}

export async function recordAiUsageEvent(event: AiUsageEvent): Promise<string> {
  const db = await ensureTable();
  const id = `ai_${event.requestId || crypto.randomUUID()}`;
  db.run(`INSERT INTO ai_usage_events
    (request_id,user_scope,agent_id,skill,category,provider,model,input_tokens,output_tokens,cached_tokens,estimated_cost_usd,latency_ms,success,escalation_reason,occurred_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    event.requestId || id,
    event.phone ? `user:${event.phone}` : null,
    event.agentId || null,
    event.skill || null,
    event.category || null,
    event.provider,
    event.model,
    event.inputTokens ?? null,
    event.outputTokens ?? null,
    event.cachedTokens ?? null,
    event.estimatedCostUsd ?? null,
    event.latencyMs ?? null,
    event.success ? 1 : 0,
    event.escalationReason || null,
    event.occurredAt || new Date().toISOString(),
  ]);
  saveDb();
  return id;
}

export async function getAiUsageSummary(sinceIso?: string): Promise<{ total: number; successes: number; failures: number; estimatedCostUsd: number | null; avgLatencyMs: number | null; byProvider: Array<{ provider: string; requests: number; failures: number; estimatedCostUsd: number | null }>; bySkill: Array<{ skill: string; requests: number; estimatedCostUsd: number | null }> }> {
  const db = await ensureTable();
  const since = sinceIso ? String(sinceIso) : '1970-01-01T00:00:00.000Z';
  const overall = db.exec(`SELECT COUNT(*), SUM(success), SUM(CASE WHEN success=0 THEN 1 ELSE 0 END), SUM(estimated_cost_usd), AVG(latency_ms) FROM ai_usage_events WHERE occurred_at >= ?`, [since])[0]?.values?.[0] || [];
  const providers = db.exec(`SELECT provider, COUNT(*), SUM(CASE WHEN success=0 THEN 1 ELSE 0 END), SUM(estimated_cost_usd) FROM ai_usage_events WHERE occurred_at >= ? GROUP BY provider ORDER BY COUNT(*) DESC`, [since])[0]?.values || [];
  const skills = db.exec(`SELECT COALESCE(skill,'unknown'), COUNT(*), SUM(estimated_cost_usd) FROM ai_usage_events WHERE occurred_at >= ? GROUP BY skill ORDER BY COUNT(*) DESC`, [since])[0]?.values || [];
  return {
    total: Number(overall[0] || 0),
    successes: Number(overall[1] || 0),
    failures: Number(overall[2] || 0),
    estimatedCostUsd: overall[3] == null ? null : Number(overall[3]),
    avgLatencyMs: overall[4] == null ? null : Number(overall[4]),
    byProvider: (providers as unknown[][]).map((row: unknown[]) => ({ provider: String(row[0]), requests: Number(row[1] || 0), failures: Number(row[2] || 0), estimatedCostUsd: row[3] == null ? null : Number(row[3]) })),
    bySkill: (skills as unknown[][]).map((row: unknown[]) => ({ skill: String(row[0]), requests: Number(row[1] || 0), estimatedCostUsd: row[2] == null ? null : Number(row[2]) })),
  };
}
