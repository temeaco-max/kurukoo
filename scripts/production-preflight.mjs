const production = process.env.NODE_ENV === 'production';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const issues = [];
const warnings = [];
const present = (value) => {
  const text = String(value ?? '').trim().toLowerCase();
  return Boolean(text) && !['stub', 'unconfigured'].includes(text) && !text.startsWith('change_me');
};

function findDirectSqljsCallSurface(directory = path.resolve(process.cwd(), 'src')) {
  const directFiles = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile() && entry.name.endsWith('.ts')) {
        const relative = path.relative(process.cwd(), file).replaceAll(path.sep, '/');
        if (relative === 'src/database.ts' || relative === 'src/services/canonicalStore.ts') continue;
        const source = fs.readFileSync(file, 'utf8');
        if (/\bgetDb\s*\(|from\s+['"][^'"]*database\.js['"]/.test(source)) directFiles.push(relative);
      }
    }
  };
  walk(directory);
  return directFiles.sort();
}

if (!production) {
  console.log(JSON.stringify({ status: 'skip', reason: 'NODE_ENV is not production' }, null, 2));
  process.exit(0);
}

const workers = Number(process.env.KURUKOO_WORKERS || 1);
const databaseMode = String(process.env.KURUKOO_DATABASE_MODE || 'sqljs').trim().toLowerCase();
const jobMode = String(process.env.KURUKOO_JOB_MODE || 'in_process').trim().toLowerCase();
const persistentRequired = process.env.KURUKOO_PERSISTENT_STATE_REQUIRED !== 'false';
const cloudRunDetected = present(process.env.K_SERVICE) || process.env.KURUKOO_CLOUD_RUN === 'true';
const postgresClientInstalled = (() => { try { require.resolve('postgres'); return true; } catch { return false; } })();
const postgresDirectSqljsFiles = findDirectSqljsCallSurface();
const postgresApplicationIntegrated = postgresClientInstalled && postgresDirectSqljsFiles.length === 0;
const postgresActivationEnabled = process.env.KURUKOO_POSTGRES_APPLICATION_INTEGRATED === 'true';

if (!present(process.env.JWT_SECRET) || String(process.env.JWT_SECRET).length < 32) issues.push('JWT_SECRET must be at least 32 characters and non-placeholder.');
if (workers > 1) issues.push('Horizontal application workers remain disabled by policy until shared worker/lease semantics have been separately validated; keep KURUKOO_WORKERS=1.');
if (databaseMode === 'sqljs' && cloudRunDetected) issues.push('Cloud Run production cannot use SQL.js as canonical durable state: the container filesystem is instance-local and ephemeral.');
if (databaseMode === 'postgres' && !postgresApplicationIntegrated) issues.push(`PostgreSQL mode is blocked until the existing synchronous persistence call surface is migrated to the async canonical PostgreSQL adapter and its validation gates pass (${postgresDirectSqljsFiles.length} direct SQL.js files remain).`);
if (databaseMode === 'postgres' && postgresApplicationIntegrated && !postgresActivationEnabled) issues.push('PostgreSQL application integration is verified but activation remains disabled; set KURUKOO_POSTGRES_APPLICATION_INTEGRATED=true only during controlled external cutover.');
if (databaseMode === 'postgres' && !present(process.env.DATABASE_URL) && !present(process.env.POSTGRES_URL)) issues.push('KURUKOO_DATABASE_MODE=postgres requires DATABASE_URL or POSTGRES_URL for external configuration.');
if (databaseMode === 'postgres' && !postgresClientInstalled) issues.push('KURUKOO_DATABASE_MODE=postgres requires the pinned postgres client before production cutover.');
if (databaseMode !== 'sqljs' && databaseMode !== 'postgres') issues.push(`Unsupported KURUKOO_DATABASE_MODE=${databaseMode || '<empty>'}.`);
if (jobMode === 'distributed' && !present(process.env.KURUKOO_REDIS_URL)) issues.push('KURUKOO_JOB_MODE=distributed requires KURUKOO_REDIS_URL.');
if (persistentRequired && String(process.env.DB_PATH || '').startsWith('/tmp/')) issues.push('Persistent state is required; DB_PATH may not be under /tmp in production.');
if (process.env.KURUKOO_PAY_PROVIDER === 'sandbox') issues.push('Sandbox payment provider is forbidden in production.');

if (process.env.KURUKOO_MCP_ENABLED === 'true') {
  if (!String(process.env.KURUKOO_MCP_ISSUER || '').startsWith('https://')) issues.push('MCP issuer must be HTTPS in production.');
  if (!present(process.env.KURUKOO_MCP_CLIENT_ID)) issues.push('MCP client ID is required when MCP is enabled.');
  if (!String(process.env.KURUKOO_MCP_REDIRECT_URIS || '').split(',').map(v => v.trim()).filter(Boolean).every(uri => uri.startsWith('https://'))) issues.push('MCP redirect URIs must all be HTTPS.');
  if (String(process.env.KURUKOO_MCP_OAUTH_SECRET || process.env.JWT_SECRET || '').length < 32) issues.push('MCP OAuth secret must be at least 32 characters.');
}

if (process.env.KURUKOO_EXTERNAL_EXECUTION_ENABLED === 'true' && !present(process.env.ECONOMIC_PAYMENT_ADAPTER)) warnings.push('External execution is enabled; verify every connector relationship and production evidence contract before activation.');
if (process.env.KURUKOO_METRICS_ENABLED === 'true' && !present(process.env.KURUKOO_OTEL_ENDPOINT)) warnings.push('Prometheus metrics are active but OTEL export endpoint is not configured.');
if (process.env.KURUKOO_VOICE_ENABLED === 'true' && !present(process.env.GEMINI_API_KEY) && !present(process.env.API_KEY)) issues.push('Voice is enabled but Gemini credentials are absent.');
if (process.env.KURUKOO_PROGRESSIVE_TRUST_ENABLED === 'true' && !present(process.env.MEMORY_ENCRYPTION_KEY)) warnings.push('Progressive trust is enabled; verify encrypted memory/device-related data handling before production activation.');

const result = { status: issues.length ? 'blocked' : warnings.length ? 'warning' : 'ready', production, cloudRunDetected, databaseMode, jobMode, workers, postgresApplicationIntegrated, postgresActivationEnabled, postgresClientInstalled, postgresDirectSqljsFileCount: postgresDirectSqljsFiles.length, issues, warnings };
console.log(JSON.stringify(result, null, 2));
if (issues.length) process.exit(1);
