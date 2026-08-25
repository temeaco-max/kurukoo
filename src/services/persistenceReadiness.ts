import { getCanonicalPersistenceStatus } from './canonicalPersistence.js';

export type PersistenceMode = 'sqljs' | 'postgres' | 'unknown';
export type PersistenceReadinessState = 'READY' | 'READY_FOR_EXTERNAL_CONFIG' | 'BLOCKED' | 'UNVERIFIED';

export interface PersistenceReadiness {
  state: PersistenceReadinessState;
  mode: PersistenceMode;
  cloudRunDetected: boolean;
  durableCanonicalState: boolean;
  concurrentWriterSafe: boolean;
  adapterImplemented: boolean;
  reason: string;
  requiredChange: string;
}

function present(value: unknown): boolean {
  const text = String(value ?? '').trim().toLowerCase();
  return Boolean(text) && !['stub', 'unconfigured'].includes(text) && !text.startsWith('change_me');
}

export function getPersistenceReadiness(env: NodeJS.ProcessEnv = process.env): PersistenceReadiness {
  const modeText = String(env.KURUKOO_DATABASE_MODE || 'sqljs').trim().toLowerCase();
  const mode: PersistenceMode = modeText === 'sqljs' || modeText === 'postgres' ? modeText : 'unknown';
  const cloudRunDetected = present(env.K_SERVICE) || env.KURUKOO_CLOUD_RUN === 'true';
  const postgresConfigured = present(env.DATABASE_URL) || present(env.POSTGRES_URL) || present(env.PGHOST);
  const canonical = getCanonicalPersistenceStatus(env);

  if (mode === 'postgres') {
    if (!canonical.applicationAdapterReady) {
      return {
        state: 'BLOCKED',
        mode,
        cloudRunDetected,
        durableCanonicalState: false,
        concurrentWriterSafe: false,
        adapterImplemented: true,
        reason: 'PostgreSQL adapter foundation exists, but the current application still exposes synchronous SQL.js persistence calls and has not been migrated to the async canonical adapter.',
        requiredChange: 'Migrate the existing persistence call surface to the async canonical persistence interface and then run the PostgreSQL validation suite before enabling PostgreSQL mode.',
      };
    }
    const activationEnabled = env.KURUKOO_POSTGRES_APPLICATION_INTEGRATED === 'true';
    if (!activationEnabled) {
      return {
        state: 'BLOCKED',
        mode,
        cloudRunDetected,
        durableCanonicalState: false,
        concurrentWriterSafe: false,
        adapterImplemented: true,
        reason: 'PostgreSQL call-surface migration is verified, but production activation remains fail-closed. The KURUKOO_POSTGRES_APPLICATION_INTEGRATED gate has not been set.',
        requiredChange: 'Provision managed PostgreSQL, configure DATABASE_URL as a secret, and set KURUKOO_POSTGRES_APPLICATION_INTEGRATED=true during the controlled external cutover only.',
      };
    }
    return {
      state: postgresConfigured ? 'READY_FOR_EXTERNAL_CONFIG' : 'BLOCKED',
      mode,
      cloudRunDetected,
      durableCanonicalState: true,
      concurrentWriterSafe: true,
      adapterImplemented: true,
      reason: postgresConfigured
        ? 'PostgreSQL is selected as the sole canonical persistence owner; the remaining dependency is external database credentials/connectivity and cutover verification.'
        : 'PostgreSQL mode is integrated but no external database connection is configured.',
      requiredChange: 'Provision/configure the managed PostgreSQL service, secret, schema, connectivity and migration verification before production traffic.',
    };
  }

  if (mode === 'sqljs' && cloudRunDetected) {
    return {
      state: 'BLOCKED',
      mode,
      cloudRunDetected,
      durableCanonicalState: false,
      concurrentWriterSafe: false,
      adapterImplemented: true,
      reason: 'SQL.js writes a local SQLite image to the container filesystem. Cloud Run container storage is instance-local and ephemeral, so restart, replacement, or a second instance can lose or diverge canonical state.',
      requiredChange: 'Keep Cloud Run production blocked until PostgreSQL becomes the single canonical persistence owner. Do not use Cloud Storage FUSE as a transactional SQL.js database.',
    };
  }

  if (mode === 'sqljs') {
    return {
      state: 'READY',
      mode,
      cloudRunDetected,
      durableCanonicalState: true,
      concurrentWriterSafe: false,
      adapterImplemented: true,
      reason: 'SQL.js is acceptable for local or explicitly single-process deployments where the host filesystem is itself durable and owned by one process.',
      requiredChange: 'Before any multi-instance or Cloud Run production deployment, cut the canonical owner over to PostgreSQL.',
    };
  }

  return {
    state: 'UNVERIFIED',
    mode,
    cloudRunDetected,
    durableCanonicalState: false,
    concurrentWriterSafe: false,
    adapterImplemented: false,
    reason: `Unsupported KURUKOO_DATABASE_MODE=${modeText || '<empty>'}.`,
    requiredChange: 'Use SQL.js for lightweight local mode or the approved PostgreSQL canonical adapter for durable shared deployment mode.',
  };
}

export function assertProductionPersistenceSafe(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;
  const readiness = getPersistenceReadiness(env);
  if (readiness.state === 'BLOCKED' || readiness.state === 'UNVERIFIED') {
    throw new Error(`[Kurukoo Persistence] ${readiness.reason} ${readiness.requiredChange}`);
  }
}
