const production = process.env.NODE_ENV === 'production';
const issues = [];
const warnings = [];
const present = (value) => {
  const text = String(value ?? '').trim().toLowerCase();
  return Boolean(text) && !['stub', 'unconfigured'].includes(text) && !text.startsWith('change_me');
};

if (!production) {
  console.log(JSON.stringify({ status: 'skip', reason: 'NODE_ENV is not production' }, null, 2));
  process.exit(0);
}

const workers = Number(process.env.KURUKOO_WORKERS || 1);
const databaseMode = String(process.env.KURUKOO_DATABASE_MODE || 'sqljs').trim().toLowerCase();
const jobMode = String(process.env.KURUKOO_JOB_MODE || 'in_process').trim().toLowerCase();
const persistentRequired = process.env.KURUKOO_PERSISTENT_STATE_REQUIRED !== 'false';
const cloudRunDetected = present(process.env.K_SERVICE) || process.env.KURUKOO_CLOUD_RUN === 'true';

if (!present(process.env.JWT_SECRET) || String(process.env.JWT_SECRET).length < 32) issues.push('JWT_SECRET must be at least 32 characters and non-placeholder.');
if (databaseMode === 'sqljs' && workers > 1) issues.push('SQL.js is single-process; KURUKOO_WORKERS must remain 1 until an approved multi-process database adapter is active.');
if (databaseMode === 'sqljs' && cloudRunDetected) issues.push('Cloud Run production cannot use SQL.js as canonical durable state: the container filesystem is instance-local and ephemeral.');
if (databaseMode === 'postgres') issues.push('Postgres mode is blocked until the Postgres persistence adapter is implemented, migrated, verified, and explicitly activated; DATABASE_URL alone does not switch the persistence owner.');
if (databaseMode !== 'sqljs' && databaseMode !== 'postgres') issues.push(`Unsupported KURUKOO_DATABASE_MODE=${databaseMode || '<empty>'}.`);
if (jobMode === 'distributed' && !present(process.env.KURUKOO_REDIS_URL)) issues.push('KURUKOO_JOB_MODE=distributed requires KURUKOO_REDIS_URL.');
if (persistentRequired && String(process.env.DB_PATH || '').startsWith('/tmp/')) issues.push('Persistent state is required; DB_PATH may not be under /tmp in production.');
if (process.env.KURUKOO_PAY_PROVIDER === 'sandbox') issues.push('Sandbox payment provider is forbidden in production.');

if (process.env.KURUKOO_MCP_ENABLED === 'true') {
  if (!String(process.env.KURUKOO_MCP_ISSUER || '').startsWith('https://')) issues.push('MCP issuer must be HTTPS in production.');
  if (!present(process.env.KURUKOO_MCP_CLIENT_ID)) issues.push('MCP client ID is required when MCP is enabled.');
  if (!String(process.env.KURUKOO_MCP_REDIRECT_URIS || '').split(',').map(v => v.trim()).filter(Boolean).every(uri => uri.startsWith('https://'))) issues.push('MCP redirect URIs must all be HTTPS in production.');
  if (String(process.env.KURUKOO_MCP_OAUTH_SECRET || process.env.JWT_SECRET || '').length < 32) issues.push('MCP OAuth secret must be at least 32 characters.');
}

if (process.env.KURUKOO_EXTERNAL_EXECUTION_ENABLED === 'true' && !present(process.env.ECONOMIC_PAYMENT_ADAPTER)) warnings.push('External execution is enabled; verify every connector relationship and production evidence contract before activation.');
if (process.env.KURUKOO_METRICS_ENABLED === 'true' && !present(process.env.KURUKOO_OTEL_ENDPOINT)) warnings.push('Prometheus metrics are active but OTEL export endpoint is not configured.');
if (process.env.KURUKOO_VOICE_ENABLED === 'true' && !present(process.env.GEMINI_API_KEY) && !present(process.env.API_KEY)) issues.push('Voice is enabled but Gemini credentials are absent.');
if (process.env.KURUKOO_PROGRESSIVE_TRUST_ENABLED === 'true' && !present(process.env.MEMORY_ENCRYPTION_KEY)) warnings.push('Progressive trust is enabled; verify encrypted memory/device-related data handling before production activation.');

const result = { status: issues.length ? 'blocked' : warnings.length ? 'warning' : 'ready', production, cloudRunDetected, databaseMode, jobMode, workers, issues, warnings };
console.log(JSON.stringify(result, null, 2));
if (issues.length) process.exit(1);
