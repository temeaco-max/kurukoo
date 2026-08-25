import crypto from 'node:crypto';
import { getCanonicalStore } from './canonicalStore.js';
import { listCountryExperiences, type CountryCode, getCountryExperience } from './countryExperience.js';
import { listUnknownIntentFeedback } from './unknownIntentFeedbackService.js';
import { ensureDiscoveryNetworkSchema, upsertDiscoveryEntity, type DiscoveryEntity } from './discoveryNetwork.js';
import { listAgentExecutionTrace } from './agentExecutionTrace.js';

export interface MarketProfile {
  code: string;
  iso3: string;
  name: string;
  locale: string;
  currency: string;
  currencyMinorUnit: string;
  defaultEmergencyNumber: string;
  publicPath: string;
  channels: string[];
  paymentRails: string[];
  regulatoryClass: string;
  supportedLanguages: string[];
  enabled: boolean;
}

export interface DiscoverySeed extends Omit<DiscoveryEntity, 'distanceMetres'> {
  provenance: 'licensed_directory' | 'curated_seed' | 'provider_submitted' | 'user_attributed';
}

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value?.trim()) return fallback;
  try { const parsed = JSON.parse(value); return parsed as T; } catch { return fallback; }
}

function configuredMarkets(): MarketProfile[] {
  const defaults = listCountryExperiences().map(item => ({
    code: item.code,
    iso3: item.iso3,
    name: item.name,
    locale: item.locale,
    currency: item.currency,
    currencyMinorUnit: item.currencyMinorUnit,
    defaultEmergencyNumber: item.defaultEmergencyNumber,
    publicPath: item.publicPath,
    channels: [...item.channels],
    paymentRails: item.code === 'ng' || item.code === 'gh' ? ['bank_transfer', 'mobile_money', 'card'] : ['card', 'bank_transfer'],
    regulatoryClass: item.code === 'ng' || item.code === 'gh' ? 'market-specific-financial-regulation' : 'market-specific-regulation',
    supportedLanguages: [item.locale.split('-')[0]],
    enabled: true,
  }));
  const overrides = parseJson<Partial<MarketProfile>[]>(process.env.KURUKOO_MARKET_PROFILES_JSON, []);
  const byCode = new Map(defaults.map(item => [item.code, item]));
  for (const override of overrides) {
    const code = String(override.code || '').trim().toLowerCase();
    if (!code) continue;
    const base = byCode.get(code);
    byCode.set(code, {
      ...(base || {
        code, iso3: '', name: code.toUpperCase(), locale: `en-${code.toUpperCase()}`, currency: '', currencyMinorUnit: 'minor', defaultEmergencyNumber: '112', publicPath: `/${code}`,
        channels: [], paymentRails: [], regulatoryClass: 'market-specific-regulation', supportedLanguages: ['en'], enabled: false,
      }),
      ...override,
      code,
      channels: Array.isArray(override.channels) ? override.channels.map(String) : base?.channels || [],
      paymentRails: Array.isArray(override.paymentRails) ? override.paymentRails.map(String) : base?.paymentRails || [],
      supportedLanguages: Array.isArray(override.supportedLanguages) ? override.supportedLanguages.map(String) : base?.supportedLanguages || ['en'],
      enabled: override.enabled === undefined ? base?.enabled ?? false : Boolean(override.enabled),
    });
  }
  return [...byCode.values()];
}

function configuredDiscoverySeeds(): DiscoverySeed[] {
  return parseJson<DiscoverySeed[]>(process.env.KURUKOO_DISCOVERY_SEEDS_JSON, []).filter(seed =>
    seed && typeof seed.id === 'string' && typeof seed.name === 'string' && Number.isFinite(Number(seed.latitude)) && Number.isFinite(Number(seed.longitude)) && typeof seed.source === 'string' && ['licensed_directory', 'curated_seed', 'provider_submitted', 'user_attributed'].includes(seed.provenance),
  );
}

async function ensureEvidenceLedgerSchema(): Promise<void> {
  const store = await getCanonicalStore();
  await store.run(`CREATE TABLE IF NOT EXISTS agent_evidence_ledger (
    id TEXT PRIMARY KEY,
    subject_type TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    goal_id TEXT,
    owner_phone TEXT,
    evidence_hash TEXT NOT NULL,
    evidence_level TEXT NOT NULL,
    verifier TEXT NOT NULL,
    source TEXT,
    metadata_json TEXT,
    verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(subject_type, subject_id, evidence_hash)
  )`);
  await store.run(`CREATE INDEX IF NOT EXISTS idx_agent_evidence_subject ON agent_evidence_ledger(subject_type, subject_id, verified_at DESC)`);
}

export async function recordPortableVerifiedEvidence(input: {
  subjectType: string;
  subjectId: string;
  goalId?: string;
  ownerPhone?: string;
  evidence: string;
  evidenceLevel: string;
  verifier: string;
  source?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!input.subjectType || !input.subjectId || !input.evidence) return;
  await ensureEvidenceLedgerSchema();
  const store = await getCanonicalStore();
  const evidenceHash = crypto.createHash('sha256').update(input.evidence).digest('hex');
  await store.run(`INSERT INTO agent_evidence_ledger(id,subject_type,subject_id,goal_id,owner_phone,evidence_hash,evidence_level,verifier,source,metadata_json) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(subject_type,subject_id,evidence_hash) DO NOTHING`, [
    `evidence:${input.subjectType}:${input.subjectId}:${evidenceHash.slice(0, 24)}`,
    input.subjectType,
    input.subjectId,
    input.goalId || null,
    input.ownerPhone || null,
    evidenceHash,
    input.evidenceLevel,
    input.verifier,
    input.source || null,
    input.metadata ? JSON.stringify(input.metadata) : null,
  ]);
}

export async function getPortableReputation(subjectType: string, subjectId: string) {
  await ensureEvidenceLedgerSchema();
  const store = await getCanonicalStore();
  const total = await store.one<any>('SELECT COUNT(*) AS count FROM agent_evidence_ledger WHERE subject_type=? AND subject_id=?', [subjectType, subjectId]);
  const latest = await store.all<any>('SELECT verifier,evidence_level,source,verified_at FROM agent_evidence_ledger WHERE subject_type=? AND subject_id=? ORDER BY verified_at DESC LIMIT 50', [subjectType, subjectId]);
  return { subjectType, subjectId, verifiedEvidenceCount: Number(total?.count || 0), latestEvidence: latest };
}

export async function seedConfiguredDiscoverySources(): Promise<number> {
  const seeds = configuredDiscoverySeeds();
  if (!seeds.length) return 0;
  await ensureDiscoveryNetworkSchema();
  let count = 0;
  for (const seed of seeds) {
    await upsertDiscoveryEntity({ ...seed, evidenceLevel: seed.evidenceLevel, claimed: Boolean(seed.claimed), verified: Boolean(seed.verified), available: Boolean(seed.available) });
    count += 1;
  }
  return count;
}

export async function materializeVerifiedGoalEvidence(limit = 100): Promise<number> {
  const store = await getCanonicalStore();
  await ensureEvidenceLedgerSchema();
  const goals = await store.all<any>(`SELECT id,phone,objective,status,updated_at FROM agent_goals WHERE status='completed' ORDER BY updated_at DESC LIMIT ?`, [Math.max(1, Math.min(500, limit))]);
  let count = 0;
  for (const goal of goals) {
    const trace = await listAgentExecutionTrace(String(goal.phone), String(goal.id), 200);
    const verified = trace.find(event => event.kind === 'quality_evaluated' && event.status === 'pass');
    if (!verified) continue;
    await recordPortableVerifiedEvidence({
      subjectType: 'agent_goal', subjectId: String(goal.id), goalId: String(goal.id), ownerPhone: String(goal.phone),
      evidence: `${goal.objective}|${verified.createdAt || goal.updated_at}|${verified.reason || 'quality_pass'}`,
      evidenceLevel: 'verified_goal_outcome', verifier: 'agentQualityGate', source: verified.actor || 'agentRuntime', metadata: { objective: String(goal.objective), status: String(goal.status) },
    });
    count += 1;
  }
  return count;
}

export async function getPlatformConvergenceSnapshot() {
  const markets = configuredMarkets();
  const feedback = await listUnknownIntentFeedback(200);
  const store = await getCanonicalStore();
  await ensureEvidenceLedgerSchema();
  const evidence = await store.one<any>('SELECT COUNT(*) AS count FROM agent_evidence_ledger');
  return {
    markets: markets.filter(market => market.enabled).map(market => ({ code: market.code, name: market.name, locale: market.locale, currency: market.currency, channels: market.channels })),
    marketCount: markets.filter(market => market.enabled).length,
    learning: { pendingCandidates: feedback.filter(item => String(item.status) === 'pending').length, reviewedCandidates: feedback.filter(item => String(item.status) !== 'pending').length },
    discovery: { configuredSeedCount: configuredDiscoverySeeds().length, seedSourceConfigured: Boolean(process.env.KURUKOO_DISCOVERY_SEEDS_JSON?.trim()) },
    evidence: { verifiedLedgerEntries: Number(evidence?.count || 0) },
    businessSurface: { model: 'shared-Kurukoo-OS', individualFrontDoor: 'conversation-first', businessFrontDoor: 'dashboard-and-integration', sharedExecution: true, sharedEvidence: true },
    whatsapp: { productionTransport: 'Meta WhatsApp Cloud API', configured: ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_APP_SECRET'].every(key => Boolean(String(process.env[key] || '').trim())) , unofficialLinkedDeviceAllowedForCore: false },
  };
}

export async function runPlatformConvergencePass(): Promise<{ seededDiscovery: number; materializedEvidence: number; snapshot: Awaited<ReturnType<typeof getPlatformConvergenceSnapshot>> }> {
  const seededDiscovery = await seedConfiguredDiscoverySources();
  const materializedEvidence = await materializeVerifiedGoalEvidence(100);
  const snapshot = await getPlatformConvergenceSnapshot();
  return { seededDiscovery, materializedEvidence, snapshot };
}
