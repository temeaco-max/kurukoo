export type PersistenceMode = 'sqljs' | 'postgres' | 'unknown';
export type PersistenceReadinessState = 'READY' | 'BLOCKED' | 'UNVERIFIED';

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

  if (mode === 'postgres') {
    return {
      state: 'BLOCKED',
      mode,
      cloudRunDetected,
      durableCanonicalState: false,
      concurrentWriterSafe: false,
      adapterImplemented: false,
      reason: postgresConfigured
        ? 'A Postgres connection signal is present, but Kurukoo has no active Postgres persistence adapter; SQL.js remains the actual persistence owner.'
        : 'Postgres mode is declared, but no database connection is configured and no Postgres persistence adapter is implemented.',
      requiredChange: 'Implement and validate the existing persistence boundary against Postgres, then cut over the canonical owner with migration/rollback verification before enabling Cloud Run production.',
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
      requiredChange: 'Keep Cloud Run production blocked until a shared durable database adapter is implemented and validated. Do not use Cloud Storage FUSE as a transactional SQL.js database.',
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
      requiredChange: 'Before any multi-instance or Cloud Run production deployment, migrate the canonical persistence owner to an approved shared database adapter.',
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
    requiredChange: 'Use the current SQL.js single-process mode for local development or implement a supported shared database adapter before production deployment.',
  };
}

export function assertProductionPersistenceSafe(env: NodeJS.ProcessEnv = process.env): void {
  const production = env.NODE_ENV === 'production';
  if (!production) return;
  const readiness = getPersistenceReadiness(env);
  if (readiness.state === 'BLOCKED') throw new Error(`[Kurukoo Persistence] ${readiness.reason} ${readiness.requiredChange}`);
  if (readiness.mode === 'unknown') throw new Error(`[Kurukoo Persistence] ${readiness.reason}`);
}
