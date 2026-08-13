import { getDb, getSystemSetting, saveDb, setSystemSetting } from '../database.js';

type ControlKind = 'boolean' | 'integer' | 'enum';
type ControlDefinition = { key: string; label: string; description: string; env: string; kind: ControlKind; defaultValue: string; minimum?: number; maximum?: number; options?: string[]; restartRequired?: boolean; safety: 'low_risk' | 'guarded' | 'deployment_only'; };

export const ADMIN_RUNTIME_CONTROLS: readonly ControlDefinition[] = [
  { key: 'voice_enabled', label: 'Web Voice', description: 'Allow the configured voice provider to provision new browser voice sessions.', env: 'KURUKOO_VOICE_ENABLED', kind: 'boolean', defaultValue: 'false', safety: 'guarded' },
  { key: 'voice_max_session_seconds', label: 'Voice session limit', description: 'Maximum duration of a browser voice session in seconds.', env: 'KURUKOO_VOICE_MAX_SESSION_SECONDS', kind: 'integer', defaultValue: '900', minimum: 60, maximum: 1800, safety: 'low_risk' },
  { key: 'voice_idle_timeout_seconds', label: 'Voice idle timeout', description: 'Browser voice inactivity timeout in seconds.', env: 'KURUKOO_VOICE_IDLE_TIMEOUT_SECONDS', kind: 'integer', defaultValue: '120', minimum: 30, maximum: 600, safety: 'low_risk' },
  { key: 'voice_max_concurrent_sessions', label: 'Voice concurrency', description: 'Maximum simultaneous browser voice sessions per identity.', env: 'KURUKOO_VOICE_MAX_CONCURRENT_SESSIONS', kind: 'integer', defaultValue: '2', minimum: 1, maximum: 10, safety: 'guarded' },
  { key: 'voice_session_rate_limit', label: 'Voice session rate limit', description: 'Maximum new browser voice sessions per IP address each minute. Existing sessions are unaffected.', env: 'KURUKOO_VOICE_SESSION_RATE_LIMIT', kind: 'integer', defaultValue: '5', minimum: 1, maximum: 20, safety: 'guarded' },
  { key: 'controlled_pilot', label: 'Controlled provider pilot', description: 'Allow the existing evidence-gated coordination pilot. It does not verify providers, promise availability, or authorize payment.', env: 'KURUKOO_CONTROLLED_PILOT', kind: 'boolean', defaultValue: 'false', safety: 'guarded' },
  { key: 'communication_outbox_enabled', label: 'Outbound communication delivery', description: 'Allow the canonical consent-gated outbox to attempt configured outbound channel deliveries. Queued records remain durable while disabled.', env: 'KURUKOO_COMMUNICATION_OUTBOX_ENABLED', kind: 'boolean', defaultValue: 'true', safety: 'guarded' },
  { key: 'credit_economy_enabled', label: 'Credit economy', description: 'Enable the existing internal credit and points lifecycle. This does not configure a payment provider, collect funds, or release escrow.', env: 'CREDIT_ECONOMY_ENABLED', kind: 'boolean', defaultValue: 'true', safety: 'guarded' },
  { key: 'agent_enabled', label: 'Bounded agent runtime', description: 'Enable the existing bounded goal runtime. It still cannot make payments, dispatch, or execute high-risk actions.', env: 'KURUKOO_AGENT_ENABLED', kind: 'boolean', defaultValue: 'false', safety: 'guarded' },
  { key: 'agent_autonomous_low_risk', label: 'Low-risk autonomous recheck', description: 'Permit only existing low-risk request rechecks through the canonical storefront.', env: 'KURUKOO_AGENT_AUTONOMOUS_LOW_RISK', kind: 'boolean', defaultValue: 'false', safety: 'guarded' },
  { key: 'agent_max_actions_per_cycle', label: 'Agent action limit', description: 'Maximum bounded actions per agent cycle.', env: 'KURUKOO_AGENT_MAX_ACTIONS_PER_CYCLE', kind: 'integer', defaultValue: '3', minimum: 1, maximum: 20, safety: 'low_risk' },
  { key: 'agent_max_retries', label: 'Agent retry limit', description: 'Maximum bounded retries for one goal.', env: 'KURUKOO_AGENT_MAX_RETRIES', kind: 'integer', defaultValue: '3', minimum: 0, maximum: 10, safety: 'low_risk' },
  { key: 'agent_max_concurrent_goals', label: 'Agent concurrency', description: 'Maximum active bounded goals in this single-instance pilot.', env: 'KURUKOO_AGENT_MAX_CONCURRENT_GOALS', kind: 'integer', defaultValue: '25', minimum: 1, maximum: 100, safety: 'guarded' },
  { key: 'agent_cooldown_seconds', label: 'Agent cooldown', description: 'Minimum seconds before a goal can take another bounded action.', env: 'KURUKOO_AGENT_COOLDOWN_SECONDS', kind: 'integer', defaultValue: '60', minimum: 10, maximum: 3600, safety: 'low_risk' },
  { key: 'agent_worker_interval_ms', label: 'Agent worker interval', description: 'Interval between bounded agent follow-up passes in milliseconds. This persisted setting is applied when the worker process starts.', env: 'KURUKOO_AGENT_WORKER_INTERVAL_MS', kind: 'integer', defaultValue: '60000', minimum: 30000, maximum: 900000, restartRequired: true, safety: 'low_risk' },
  { key: 'external_execution_enabled', label: 'External execution', description: 'Deployment kill switch for authorized external connectors only. No connector or evidence path is created by this control.', env: 'KURUKOO_EXTERNAL_EXECUTION_ENABLED', kind: 'boolean', defaultValue: 'false', safety: 'deployment_only' },
] as const;

const FEATURE_NAME = /^[a-z][a-z0-9_]{1,63}$/;
const values = new Map<string, string>();
let hydrated = false;
const truth = (value: unknown) => ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
const deploymentEnabled = () => process.env.NODE_ENV !== 'production' || truth(process.env.KURUKOO_ADMIN_CONTROL_PLANE_ENABLED);
const settingKey = (key: string) => `admin_control:${key}`;
const featureKey = (country: string, feature: string) => `admin_feature:${country.toLowerCase()}:${feature.toLowerCase()}`;
const lockEnv = (env: string) => `KURUKOO_ADMIN_LOCK_${env.replace(/^KURUKOO_/, '')}`;

function definition(key: string): ControlDefinition { const item = ADMIN_RUNTIME_CONTROLS.find(candidate => candidate.key === key); if (!item) throw new Error('Unknown or non-admin-managed runtime control'); return item; }
function normalize(def: ControlDefinition, value: unknown): string {
  if (def.kind === 'boolean') return truth(value) ? 'true' : 'false';
  if (def.kind === 'integer') { const parsed = Number(value); if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < (def.minimum ?? Number.MIN_SAFE_INTEGER) || parsed > (def.maximum ?? Number.MAX_SAFE_INTEGER)) throw new Error(`${def.label} must be an integer between ${def.minimum} and ${def.maximum}`); return String(parsed); }
  const candidate = String(value || '').trim(); if (!def.options?.includes(candidate)) throw new Error(`${def.label} must be one of the approved values`); return candidate;
}

export async function hydrateAdminControlPlane(): Promise<void> {
  if (hydrated) return; hydrated = true;
  if (!deploymentEnabled()) return;
  for (const control of ADMIN_RUNTIME_CONTROLS) {
    if (truth(process.env[lockEnv(control.env)])) continue;
    const stored = await getSystemSetting(settingKey(control.key), '');
    if (stored) { values.set(control.key, stored); process.env[control.env] = stored; }
  }
  const db = await getDb();
  const stmt = db.prepare("SELECT key,value FROM system_settings WHERE key LIKE 'admin_feature:%'");
  while (stmt.step()) { const row = stmt.getAsObject(); values.set(String(row.key), String(row.value)); }
  stmt.free();
}

export function getAdminControlPlaneStatus() {
  const controls = ADMIN_RUNTIME_CONTROLS.map(control => {
    const locked = truth(process.env[lockEnv(control.env)]); const stored = values.get(control.key); const effective = locked ? (process.env[control.env] || control.defaultValue) : (stored || process.env[control.env] || control.defaultValue);
    return { key: control.key, label: control.label, description: control.description, kind: control.kind, value: effective, defaultValue: control.defaultValue, minimum: control.minimum, maximum: control.maximum, options: control.options, restartRequired: Boolean(control.restartRequired), safety: control.safety, mutable: deploymentEnabled() && !locked && control.safety !== 'deployment_only', source: locked ? 'deployment_lock' : stored ? 'admin_override' : process.env[control.env] !== undefined ? 'deployment_default' : 'safe_default' };
  });
  const secretStatus = [
    { key: 'gemini_api_key', label: 'Gemini API key', configured: Boolean(process.env.GEMINI_API_KEY || process.env.API_KEY), rotation: 'secret_manager_required', exposed: false },
    { key: 'groq_api_key', label: 'Groq API key', configured: Boolean(process.env.GROQ_API_KEY), rotation: 'secret_manager_required', exposed: false },
    { key: 'huggingface_api_key', label: 'Hugging Face API key', configured: Boolean(process.env.HUGGINGFACE_API_KEY), rotation: 'secret_manager_required', exposed: false },
    { key: 'resend_api_key', label: 'Email delivery key', configured: Boolean(process.env.RESEND_API_KEY), rotation: 'secret_manager_required', exposed: false },
    { key: 'whatsapp_token', label: 'WhatsApp channel token', configured: Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_APP_SECRET), rotation: 'secret_manager_required', exposed: false },
    { key: 'telegram_bot_token', label: 'Telegram bot token', configured: Boolean(process.env.TELEGRAM_BOT_TOKEN), rotation: 'secret_manager_required', exposed: false },
    { key: 'africastalking_api_key', label: 'SMS / USSD channel key', configured: Boolean(process.env.AFRICASTALKING_API_KEY && process.env.AFRICASTALKING_USERNAME), rotation: 'secret_manager_required', exposed: false },
    { key: 'stripe_secret_key', label: 'Stripe secret key', configured: Boolean(process.env.STRIPE_SECRET_KEY), rotation: 'secret_manager_required', exposed: false },
    { key: 'stripe_webhook_secret', label: 'Stripe webhook secret', configured: Boolean(process.env.STRIPE_WEBHOOK_SECRET), rotation: 'secret_manager_required', exposed: false },
    { key: 'jwt_secret', label: 'JWT secret', configured: String(process.env.JWT_SECRET || '').length >= 32, rotation: 'secret_manager_required', exposed: false },
    { key: 'memory_encryption_key', label: 'Memory encryption key', configured: String(process.env.MEMORY_ENCRYPTION_KEY || '').length >= 32, rotation: 'secret_manager_required', exposed: false },
  ];
  const integrationStatus = [
    { key: 'voice', label: 'Live voice', state: truth(process.env.KURUKOO_VOICE_ENABLED) && Boolean(process.env.GEMINI_API_KEY || process.env.API_KEY) ? 'ready' : 'not_ready', surface: 'Control plane', href: '/admin/settings.html', detail: 'Requires the configured live-voice credential; browser dictation remains an in-browser fallback.' },
    { key: 'agents', label: 'Bounded agent runtime', state: truth(process.env.KURUKOO_AGENT_ENABLED) ? 'enabled' : 'disabled', surface: 'AI agents', href: '/admin/ai-agents.html', detail: 'Existing goals, quotas, and tool restrictions remain authoritative.' },
    { key: 'communications', label: 'Communications outbox', state: process.env.KURUKOO_COMMUNICATION_OUTBOX_ENABLED === 'false' ? 'disabled' : 'ready', surface: 'Operations', href: '/admin/operations.html', detail: 'Channel delivery remains consent-gated and only configured transports can be attempted.' },
    { key: 'credit_economy', label: 'Credit economy', state: process.env.CREDIT_ECONOMY_ENABLED === 'false' ? 'disabled' : 'enabled', surface: 'Control plane', href: '/admin/settings.html', detail: 'The internal points and credit lifecycle is controlled here; it is not a payment or escrow guarantee.' },
    { key: 'payments', label: 'Economic payment adapter', state: process.env.ECONOMIC_PAYMENT_ADAPTER === 'verified' && Boolean(process.env.KURUKOO_PAY_PROVIDER) ? 'ready' : 'not_ready', surface: 'Commercial evidence', href: '/admin/revenue.html', detail: 'Provider selection, credentials, and settlement contracts remain deployment-owned.' },
    { key: 'ussd', label: 'USSD channel', state: truth(process.env.KURUKOO_USSD_ENABLED) && Boolean(process.env.AFRICASTALKING_USSD_SERVICE_CODE && process.env.AFRICASTALKING_WEBHOOK_TOKEN) ? 'ready' : 'not_ready', surface: 'Operations', href: '/admin/operations.html', detail: 'USSD activation remains deployment-controlled because it depends on a verified provider contract.' },
    { key: 'workers', label: 'Background workers', state: process.env.KURUKOO_WORKERS === '0' || process.env.KURUKOO_WORKERS === 'false' ? 'disabled' : 'ready', surface: 'Control plane', href: '/admin/settings.html', detail: 'Worker process enablement and scheduling topology remain deployment-owned.' },
  ];
  return { enabled: deploymentEnabled(), controls, secretStatus, integrationStatus, policy: { secrets: 'never stored, displayed, exported, or rotated in the admin database', deployment_locks: 'KURUKOO_ADMIN_LOCK_<CONTROL_ENV_SUFFIX>=true', production_enablement: 'KURUKOO_ADMIN_CONTROL_PLANE_ENABLED=true' } };
}

export async function updateAdminRuntimeControl(input: { key: string; value: unknown; actor: string }): Promise<ReturnType<typeof getAdminControlPlaneStatus>> {
  if (!deploymentEnabled()) throw new Error('The admin control plane is disabled by deployment policy'); const control = definition(input.key); if (control.safety === 'deployment_only') throw new Error('This deployment kill switch remains deployment-controlled and cannot be changed from the ordinary admin console'); if (truth(process.env[lockEnv(control.env)])) throw new Error('This control is locked by deployment policy');
  const value = normalize(control, input.value); values.set(control.key, value); process.env[control.env] = value; await setSystemSetting(settingKey(control.key), value);
  const db = await getDb(); db.run('INSERT INTO audit_logs(action,details) VALUES(?,?)', ['admin_runtime_control_updated', JSON.stringify({ key: control.key, value, actor: String(input.actor || 'admin').slice(0, 128) })]); saveDb(); return getAdminControlPlaneStatus();
}

export function getAdminFeatureOverride(country: string, feature: string): boolean | undefined {
  const key = featureKey(country, feature); const raw = values.get(key); return raw === undefined ? undefined : truth(raw);
}

export async function listAdminFeatureFlags(country = 'ng') {
  const db = await getDb(); const prefix = `admin_feature:${country.toLowerCase()}:`; const stmt = db.prepare("SELECT key,value FROM system_settings WHERE key LIKE ? ORDER BY key"); stmt.bind([`${prefix}%`]); const flags: Array<{ name: string; value: boolean; source: 'admin_override' }> = [];
  while (stmt.step()) { const row = stmt.getAsObject(); flags.push({ name: String(row.key).slice(prefix.length), value: truth(row.value), source: 'admin_override' }); } stmt.free(); return { enabled: deploymentEnabled(), country: country.toLowerCase(), flags, policy: 'Environment deployment locks still take precedence; absent flags remain fail-closed.' };
}

export async function updateAdminFeatureFlag(input: { country: string; name: string; value: unknown; actor: string }) {
  if (!deploymentEnabled()) throw new Error('The admin control plane is disabled by deployment policy'); const country = String(input.country || 'ng').toLowerCase(); const name = String(input.name || '').toLowerCase(); if (!/^[a-z]{2,3}$/.test(country) || !FEATURE_NAME.test(name)) throw new Error('Invalid feature flag identifier'); const env = `FF_${name.toUpperCase()}`; if (truth(process.env[lockEnv(env)])) throw new Error('This feature flag is locked by deployment policy'); const value = truth(input.value) ? 'true' : 'false'; const key = featureKey(country, name); values.set(key, value); await setSystemSetting(key, value);
  const db = await getDb(); db.run('INSERT INTO audit_logs(action,details) VALUES(?,?)', ['admin_feature_flag_updated', JSON.stringify({ country, name, value, actor: String(input.actor || 'admin').slice(0, 128) })]); saveDb(); return { country, name, value: truth(value), source: 'admin_override' as const };
}
