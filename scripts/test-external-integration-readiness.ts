import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const originalEnv = { ...process.env };
const keys = [
  'KURUKOO_GOOGLE_DRIVE_CLIENT_ID', 'KURUKOO_GOOGLE_DRIVE_CLIENT_SECRET', 'KURUKOO_GOOGLE_DRIVE_REDIRECT_URI', 'KURUKOO_STORAGE_ENCRYPTION_KEY', 'FF_TEST_GOOGLE_DRIVE',
  'WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_APP_SECRET', 'FF_WHATSAPP',
  'GEMINI_API_KEY', 'MISTRAL_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'HF_TOKEN', 'HUGGINGFACE_API_KEY', 'HF_API_KEY',
];
for (const key of keys) delete process.env[key];
process.env.NODE_ENV = 'test';
process.env.KURUKOO_MCP_ENABLED = 'false';

const { getExternalIntegrationReadiness } = await import('../src/services/externalIntegrationReadiness.js');

try {
  const baseline = getExternalIntegrationReadiness();
  assert.ok(baseline.length >= 25, 'The canonical readiness projection must cover the declared external integration set.');
  const requiredDimensions = ['IMPLEMENTED', 'CONTRACT_TESTED', 'MOCK_VERIFIED', 'CREDENTIAL_READY', 'LIVE_VERIFIED', 'FEATURE_FLAG_STATE', 'PRODUCTION_ACTIVE'];
  for (const integration of baseline) {
    for (const dimension of requiredDimensions) assert.ok(dimension in integration.readiness, `${integration.id} must report ${dimension}.`);
    assert.equal(integration.readiness.LIVE_VERIFIED, false, `${integration.id} must not fabricate provider evidence from repository state.`);
    assert.equal(integration.readiness.PRODUCTION_ACTIVE, false, `${integration.id} must not claim production activation without independent evidence.`);
    assert.ok(integration.activationChecklist.length >= 3, `${integration.id} must expose an actionable activation checklist.`);
    assert.ok(integration.recovery.length > 20, `${integration.id} must expose a meaningful recovery state.`);
  }

  const drive = baseline.find((item) => item.id === 'google_drive');
  assert.ok(drive?.readiness.IMPLEMENTED && drive.readiness.CONTRACT_TESTED && drive.readiness.MOCK_VERIFIED, 'Google Drive must retain the existing canonical implementation and deterministic contract proof.');
  assert.equal(drive?.readiness.CREDENTIAL_READY, false, 'Drive must report missing deployment credentials truthfully.');
  assert.equal(drive?.uiState, 'CREDENTIALS_REQUIRED', 'Drive must surface a truthful configuration state when OAuth prerequisites are absent.');

  const sheets = baseline.find((item) => item.id === 'google_sheets');
  assert.ok(sheets, 'Google Sheets must appear explicitly instead of being represented by a fake connection card.');
  assert.equal(sheets.readiness.IMPLEMENTED, false, 'An unregistered source adapter must remain visibly unimplemented.');
  assert.equal(sheets.uiState, 'NOT_IMPLEMENTED');
  const openRouter = baseline.find((item) => item.id === 'openrouter');
  assert.equal(openRouter?.readiness.IMPLEMENTED, false, 'An unsupported hosted provider must be explicitly unimplemented, not credential-activatable.');
  assert.equal(openRouter?.uiState, 'NOT_IMPLEMENTED');

  const whatsapp = baseline.find((item) => item.id === 'whatsapp');
  assert.ok(whatsapp?.readiness.IMPLEMENTED && whatsapp.readiness.CONTRACT_TESTED && whatsapp.readiness.MOCK_VERIFIED, 'WhatsApp must report its existing adapter and local contract boundary.');
  assert.equal(whatsapp?.readiness.CREDENTIAL_READY, false);

  process.env.KURUKOO_GOOGLE_DRIVE_CLIENT_ID = 'drive-client';
  process.env.KURUKOO_GOOGLE_DRIVE_CLIENT_SECRET = 'drive-secret';
  process.env.KURUKOO_GOOGLE_DRIVE_REDIRECT_URI = 'https://example.test/api/artifacts/drive/callback';
  process.env.KURUKOO_STORAGE_ENCRYPTION_KEY = 'test-storage-key';
  const driveFlagDisabled = getExternalIntegrationReadiness().find((item) => item.id === 'google_drive');
  assert.equal(driveFlagDisabled?.readiness.CREDENTIAL_READY, true, 'Drive OAuth configuration can be detected while its feature remains disabled.');
  assert.equal(driveFlagDisabled?.uiState, 'DISABLED', 'Drive must not offer external persistence from credentials alone when its feature flag is disabled.');
  process.env.FF_TEST_GOOGLE_DRIVE = 'true';
  process.env.WHATSAPP_TOKEN = 'whatsapp-token';
  process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone-id';
  process.env.WHATSAPP_VERIFY_TOKEN = 'verify-token';
  process.env.WHATSAPP_APP_SECRET = 'app-secret';
  process.env.FF_WHATSAPP = 'true';
  const configured = getExternalIntegrationReadiness();
  const configuredDrive = configured.find((item) => item.id === 'google_drive');
  const configuredWhatsApp = configured.find((item) => item.id === 'whatsapp');
  assert.equal(configuredDrive?.readiness.CREDENTIAL_READY, true, 'Drive configuration must be detected without exposing credential contents.');
  assert.equal(configuredDrive?.readiness.FEATURE_FLAG_STATE, 'ENABLED', 'Drive must require an explicit feature enablement in addition to OAuth configuration.');
  assert.equal(configuredDrive?.uiState, 'LIVE_VERIFICATION_REQUIRED', 'Enabled Drive credentials must still require a real owner/provider evidence run.');
  assert.equal(configuredWhatsApp?.readiness.CREDENTIAL_READY, true, 'WhatsApp configuration must be detected through the canonical channel readiness boundary.');
  assert.equal(configuredWhatsApp?.readiness.FEATURE_FLAG_STATE, 'ENABLED', 'Configured WhatsApp must report its explicit feature flag state.');
  assert.equal(configuredWhatsApp?.uiState, 'LIVE_VERIFICATION_REQUIRED', 'An enabled credential set must not become a false production claim.');

  const channelsView = fs.readFileSync(path.join(process.cwd(), 'views', 'channels.ejs'), 'utf8');
  const publicRoutes = fs.readFileSync(path.join(process.cwd(), 'src', 'routes', 'publicRoutes.ts'), 'utf8');
  const workspaceClient = fs.readFileSync(path.join(process.cwd(), 'public', 'js', 'kurukoo-workspace.js'), 'utf8');
  assert.match(channelsView, /integrationReadiness/, 'Channels must render the canonical integration readiness projection.');
  assert.match(channelsView, /Object\.entries\(item\.readiness\)/, 'Channels must render every locked readiness dimension rather than a reduced placeholder state.');
  assert.match(channelsView, /NOT_IMPLEMENTED/, 'Channels must distinguish an unregistered adapter from an unavailable configured adapter.');
  assert.doesNotMatch(channelsView, /Google Sheets<\/h3><p>Bring your spreadsheets into the conversation\.<\/p><span[^>]*>Not connected/i, 'Channels must not retain a hard-coded fake source connection state.');
  assert.match(publicRoutes, /getExternalIntegrationReadiness/, 'Public Channels and Connect compositions must reuse the canonical integration readiness projection.');
  assert.match(workspaceClient, /storage\.configured && storage\.enabled/, 'Connect must distinguish a configured-but-disabled Drive provider from an enabled OAuth path.');
  assert.match(workspaceClient, /Drive disabled/, 'Connect must render a truthful disabled Drive state.');

  console.log(JSON.stringify({ ok: true, integrations: baseline.length, dimensions: requiredDimensions, baseline: { drive: drive.uiState, googleSheets: sheets.uiState, whatsapp: whatsapp.uiState }, configured: { drive: configuredDrive?.uiState, whatsapp: configuredWhatsApp?.uiState }, ui: 'canonical_projection' }));
} finally {
  for (const key of keys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
}
