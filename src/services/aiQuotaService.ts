/**
 * Hard AI quotas — cost discipline for free cascade.
 * Per-user daily request + estimated token budgets; global soft ceiling.
 */
import { getDb, saveDb } from '../database.js';

export type QuotaKind = 'simple' | 'complex' | 'embedding';

const DEFAULTS = {
  // Per user per UTC day
  maxSimpleRequests: Number(process.env.AI_QUOTA_SIMPLE_PER_DAY || 80),
  maxComplexRequests: Number(process.env.AI_QUOTA_COMPLEX_PER_DAY || 25),
  maxTokensPerDay: Number(process.env.AI_QUOTA_TOKENS_PER_DAY || 80_000),
  // Global (all users) soft ceiling — only logged / optional hard block
  globalComplexPerMinute: Number(process.env.AI_QUOTA_GLOBAL_COMPLEX_PER_MIN || 120),
  hardBlockWhenExceeded: process.env.AI_QUOTA_HARD_BLOCK !== 'false',
};

async function ensureQuotaTables(): Promise<void> {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS ai_usage_daily (
    phone TEXT NOT NULL,
    day TEXT NOT NULL,
    simple_requests INTEGER DEFAULT 0,
    complex_requests INTEGER DEFAULT 0,
    tokens_est INTEGER DEFAULT 0,
    PRIMARY KEY (phone, day)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS ai_usage_minute (
    bucket TEXT PRIMARY KEY,
    complex_count INTEGER DEFAULT 0
  )`);
  saveDb();
}

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function minuteBucket(): string {
  const d = new Date();
  return `${d.toISOString().slice(0, 16)}`; // YYYY-MM-DDTHH:MM
}

export interface QuotaDecision {
  allowed: boolean;
  reason?: string;
  remaining: {
    simple: number;
    complex: number;
    tokens: number;
  };
  downgradeToTemplate?: boolean;
}

export async function checkAiQuota(
  phone: string | undefined,
  kind: QuotaKind,
  estimatedTokens = 500
): Promise<QuotaDecision> {
  if (!phone) {
    return {
      allowed: true,
      remaining: {
        simple: DEFAULTS.maxSimpleRequests,
        complex: DEFAULTS.maxComplexRequests,
        tokens: DEFAULTS.maxTokensPerDay,
      },
    };
  }

  await ensureQuotaTables();
  const db = await getDb();
  const day = utcDay();
  const stmt = db.prepare(`SELECT simple_requests, complex_requests, tokens_est FROM ai_usage_daily WHERE phone = ? AND day = ?`);
  stmt.bind([phone, day]);
  let simple = 0;
  let complex = 0;
  let tokens = 0;
  if (stmt.step()) {
    const row = stmt.getAsObject() as any;
    simple = Number(row.simple_requests || 0);
    complex = Number(row.complex_requests || 0);
    tokens = Number(row.tokens_est || 0);
  }
  stmt.free();

  const remaining = {
    simple: Math.max(0, DEFAULTS.maxSimpleRequests - simple),
    complex: Math.max(0, DEFAULTS.maxComplexRequests - complex),
    tokens: Math.max(0, DEFAULTS.maxTokensPerDay - tokens),
  };

  if (tokens + estimatedTokens > DEFAULTS.maxTokensPerDay) {
    return {
      allowed: !DEFAULTS.hardBlockWhenExceeded,
      reason: 'Daily AI token budget reached',
      remaining,
      downgradeToTemplate: true,
    };
  }

  if (kind === 'simple' && simple >= DEFAULTS.maxSimpleRequests) {
    return {
      allowed: !DEFAULTS.hardBlockWhenExceeded,
      reason: 'Daily simple AI request quota reached',
      remaining,
      downgradeToTemplate: true,
    };
  }

  if (kind === 'complex' && complex >= DEFAULTS.maxComplexRequests) {
    return {
      allowed: !DEFAULTS.hardBlockWhenExceeded,
      reason: 'Daily complex AI request quota reached',
      remaining,
      downgradeToTemplate: true,
    };
  }

  // Global complex rate soft check
  if (kind === 'complex') {
    const bucket = minuteBucket();
    const g = db.prepare(`SELECT complex_count FROM ai_usage_minute WHERE bucket = ?`);
    g.bind([bucket]);
    let gCount = 0;
    if (g.step()) gCount = Number(g.getAsObject().complex_count || 0);
    g.free();
    if (gCount >= DEFAULTS.globalComplexPerMinute) {
      return {
        allowed: false,
        reason: 'Platform AI rate limit — try again shortly',
        remaining,
        downgradeToTemplate: true,
      };
    }
  }

  return { allowed: true, remaining };
}

export async function recordAiUsage(
  phone: string | undefined,
  kind: QuotaKind,
  estimatedTokens = 500
): Promise<void> {
  if (!phone) return;
  await ensureQuotaTables();
  const db = await getDb();
  const day = utcDay();
  db.run(
    `INSERT INTO ai_usage_daily (phone, day, simple_requests, complex_requests, tokens_est)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(phone, day) DO UPDATE SET
       simple_requests = simple_requests + excluded.simple_requests,
       complex_requests = complex_requests + excluded.complex_requests,
       tokens_est = tokens_est + excluded.tokens_est`,
    [
      phone,
      day,
      kind === 'simple' ? 1 : 0,
      kind === 'complex' ? 1 : 0,
      Math.max(0, Math.round(estimatedTokens)),
    ]
  );

  if (kind === 'complex') {
    const bucket = minuteBucket();
    db.run(
      `INSERT INTO ai_usage_minute (bucket, complex_count) VALUES (?, 1)
       ON CONFLICT(bucket) DO UPDATE SET complex_count = complex_count + 1`,
      [bucket]
    );
  }
  saveDb();
}

export async function getAiQuotaStatus(phone: string): Promise<QuotaDecision['remaining'] & { day: string }> {
  const decision = await checkAiQuota(phone, 'simple', 0);
  return { ...decision.remaining, day: utcDay() };
}


export interface AiUsageTelemetryInput {
  requestId: string;
  phone?: string;
  agentId?: string;
  skill?: string;
  category?: string;
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  estimatedCost?: number | null;
  costStatus?: 'available' | 'unavailable';
  latencyMs?: number;
  success: boolean;
  fallbackUsed: boolean;
  escalationReason?: string;
  country?: string;
}

async function ensureAiTelemetryTable(): Promise<void> {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS ai_request_telemetry (
    request_id TEXT PRIMARY KEY,
    phone TEXT,
    agent_id TEXT,
    skill TEXT,
    category TEXT,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cached_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_cost REAL,
    cost_status TEXT NOT NULL DEFAULT 'unavailable',
    latency_ms INTEGER,
    success INTEGER NOT NULL,
    fallback_used INTEGER NOT NULL DEFAULT 0,
    escalation_reason TEXT,
    country TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ai_request_telemetry_created ON ai_request_telemetry(created_at DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ai_request_telemetry_provider ON ai_request_telemetry(provider, model, created_at DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ai_request_telemetry_skill ON ai_request_telemetry(skill, created_at DESC)`);
  saveDb();
}

export async function recordAiRequestTelemetry(input: AiUsageTelemetryInput): Promise<void> {
  await ensureAiTelemetryTable();
  const db = await getDb();
  db.run(`INSERT OR IGNORE INTO ai_request_telemetry (request_id, phone, agent_id, skill, category, provider, model, input_tokens, output_tokens, cached_tokens, estimated_cost, cost_status, latency_ms, success, fallback_used, escalation_reason, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    input.requestId, input.phone || null, input.agentId || null, input.skill || null, input.category || null,
    input.provider, input.model, Math.max(0, Math.floor(input.inputTokens || 0)), Math.max(0, Math.floor(input.outputTokens || 0)), Math.max(0, Math.floor(input.cachedTokens || 0)),
    input.estimatedCost ?? null, input.costStatus || 'unavailable', Math.max(0, Math.floor(input.latencyMs || 0)), input.success ? 1 : 0, input.fallbackUsed ? 1 : 0,
    input.escalationReason || null, input.country || null,
  ]);
  saveDb();
}

export async function getAiUsageTelemetrySummary(limit = 30) {
  await ensureAiTelemetryTable();
  const db = await getDb();
  const aggregate = (group: string) => db.exec(`SELECT COALESCE(${group}, 'unattributed') AS key, COUNT(*) AS requests, SUM(CASE WHEN success=1 THEN 1 ELSE 0 END) AS successes, SUM(CASE WHEN fallback_used=1 THEN 1 ELSE 0 END) AS fallbacks, SUM(CASE WHEN estimated_cost IS NOT NULL THEN estimated_cost ELSE 0 END) AS known_cost, SUM(CASE WHEN estimated_cost IS NOT NULL THEN 1 ELSE 0 END) AS priced_requests, AVG(latency_ms) AS average_latency_ms FROM ai_request_telemetry GROUP BY ${group} ORDER BY requests DESC LIMIT ?`, [Math.max(1, Math.min(100, Math.floor(limit)) )])[0]?.values || [];
  const mapRows = (rows: unknown[][]) => rows.map(row => ({ key: row[0], requests: Number(row[1]), successes: Number(row[2]), fallbacks: Number(row[3]), knownCost: Number(row[4]), pricedRequests: Number(row[5]), averageLatencyMs: Number(row[6] || 0) }));
  const overall = db.exec(`SELECT COUNT(*) AS requests, SUM(CASE WHEN fallback_used=1 THEN 1 ELSE 0 END) AS fallbacks, SUM(CASE WHEN success=0 THEN 1 ELSE 0 END) AS failures, AVG(latency_ms) AS average_latency_ms FROM ai_request_telemetry`)[0]?.values?.[0] || [0, 0, 0, 0];
  return {
    overall: { requests: Number(overall[0]), fallbacks: Number(overall[1]), failures: Number(overall[2]), averageLatencyMs: Number(overall[3] || 0) },
    byModel: mapRows(aggregate('model')),
    bySkill: mapRows(aggregate('skill')),
    byAgent: mapRows(aggregate('agent_id')),
    byCountry: mapRows(aggregate('country')),
    localVsHosted: mapRows(db.exec(`SELECT CASE WHEN provider IN ('SmolLM2', 'Kurukoo Template', 'FastText') THEN 'local' ELSE 'hosted' END AS key, COUNT(*) AS requests, SUM(CASE WHEN success=1 THEN 1 ELSE 0 END) AS successes, SUM(CASE WHEN fallback_used=1 THEN 1 ELSE 0 END) AS fallbacks, SUM(CASE WHEN estimated_cost IS NOT NULL THEN estimated_cost ELSE 0 END) AS known_cost, SUM(CASE WHEN estimated_cost IS NOT NULL THEN 1 ELSE 0 END) AS priced_requests, AVG(latency_ms) AS average_latency_ms FROM ai_request_telemetry GROUP BY key`)[0]?.values || []),
  };
}
