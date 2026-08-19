import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const originalEnv = { ...process.env };
const keys = [
  'KURUKOO_GOOGLE_DRIVE_CLIENT_ID', 'KURUKOO_GOOGLE_DRIVE_CLIENT_SECRET', 'KURUKOO_GOOGLE_DRIVE_REDIRECT_URI', 'KURUKOO_NOTION_CLIENT_ID', 'KURUKOO_NOTION_CLIENT_SECRET', 'KURUKOO_NOTION_REDIRECT_URI', 'FF_TEST_NOTION', 'KURUKOO_MICROSOFT_CLIENT_ID', 'KURUKOO_MICROSOFT_CLIENT_SECRET', 'KURUKOO_MICROSOFT_REDIRECT_URI', 'FF_TEST_OUTLOOK', 'FF_TEST_ONEDRIVE', 'KURUKOO_GOOGLE_SHEETS_CLIENT_ID', 'KURUKOO_GOOGLE_SHEETS_CLIENT_SECRET', 'KURUKOO_GOOGLE_SHEETS_REDIRECT_URI', 'KURUKOO_STORAGE_ENCRYPTION_KEY', 'FF_TEST_GOOGLE_DRIVE', 'FF_TEST_GOOGLE_SHEETS',
  'WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_APP_SECRET', 'FF_WHATSAPP',
  'GEMINI_API_KEY', 'MISTRAL_API_KEY', 'MISTRAL_TTS_MODEL', 'MISTRAL_TTS_VOICE_ID', 'FF_TEST_HOSTED_MISTRAL', 'FF_TEST_MISTRAL_TTS', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'FF_TEST_HOSTED_OPENROUTER', 'HF_TOKEN', 'HUGGINGFACE_API_KEY', 'HF_API_KEY',
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
  assert.ok(sheets.readiness.IMPLEMENTED && sheets.readiness.CONTRACT_TESTED && sheets.readiness.MOCK_VERIFIED, 'Google Sheets must expose its canonical owner-scoped lifecycle and deterministic contract evidence.');
  assert.equal(sheets.readiness.CREDENTIAL_READY, false, 'Google Sheets must report absent OAuth configuration truthfully.');
  assert.equal(sheets.uiState, 'CREDENTIALS_REQUIRED');
  const notion = baseline.find((item) => item.id === 'notion');
  assert.ok(notion?.readiness.IMPLEMENTED && notion.readiness.CONTRACT_TESTED && notion.readiness.MOCK_VERIFIED, 'Notion must expose its canonical owner-scoped lifecycle and deterministic contract proof.');
  assert.equal(notion?.readiness.CREDENTIAL_READY, false, 'Notion must report absent public OAuth configuration truthfully.');
  assert.equal(notion?.uiState, 'CREDENTIALS_REQUIRED');
  for (const sourceId of ['outlook', 'onedrive']) { const source = baseline.find((item) => item.id === sourceId); assert.ok(source?.readiness.IMPLEMENTED && source.readiness.CONTRACT_TESTED && source.readiness.MOCK_VERIFIED, `${sourceId} must expose its canonical owner-scoped lifecycle and deterministic contract proof.`); assert.equal(source?.readiness.CREDENTIAL_READY, false); assert.equal(source?.uiState, 'CREDENTIALS_REQUIRED'); }
  const mistralTts = baseline.find((item) => item.id === 'mistral_tts');
  assert.ok(mistralTts?.readiness.IMPLEMENTED && mistralTts.readiness.CONTRACT_TESTED && mistralTts.readiness.MOCK_VERIFIED, 'Mistral TTS must expose its canonical saved-voice lifecycle and deterministic contract proof.');
  assert.equal(mistralTts?.readiness.CREDENTIAL_READY, false, 'Mistral TTS must require an explicit API key, model and saved voice profile.');
  assert.equal(mistralTts?.uiState, 'CREDENTIALS_REQUIRED');
  const openRouter = baseline.find((item) => item.id === 'openrouter');
  assert.ok(openRouter?.readiness.IMPLEMENTED && openRouter.readiness.CONTRACT_TESTED && openRouter.readiness.MOCK_VERIFIED, 'OpenRouter must expose its canonical hosted adapter and deterministic contract proof.');
  assert.equal(openRouter?.readiness.CREDENTIAL_READY, false, 'OpenRouter must require both a key and an explicit approved model.');
  assert.equal(openRouter?.uiState, 'CREDENTIALS_REQUIRED');

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
  process.env.KURUKOO_GOOGLE_SHEETS_CLIENT_ID = 'sheets-client';
  process.env.KURUKOO_GOOGLE_SHEETS_CLIENT_SECRET = 'sheets-secret';
  process.env.KURUKOO_GOOGLE_SHEETS_REDIRECT_URI = 'https://example.test/api/artifacts/sheets/callback';
  const sheetsFlagDisabled = getExternalIntegrationReadiness().find((item) => item.id === 'google_sheets');
  assert.equal(sheetsFlagDisabled?.readiness.CREDENTIAL_READY, true, 'Google Sheets OAuth configuration can be detected without activating source reads.');
  assert.equal(sheetsFlagDisabled?.uiState, 'DISABLED', 'Google Sheets must remain disabled from credentials alone.');
  process.env.FF_TEST_GOOGLE_SHEETS = 'true';
  process.env.KURUKOO_NOTION_CLIENT_ID = 'notion-client';
  process.env.KURUKOO_NOTION_CLIENT_SECRET = 'notion-secret';
  process.env.KURUKOO_NOTION_REDIRECT_URI = 'https://example.test/api/artifacts/notion/callback';
  const notionFlagDisabled = getExternalIntegrationReadiness().find((item) => item.id === 'notion');
  assert.equal(notionFlagDisabled?.readiness.CREDENTIAL_READY, true, 'Notion OAuth configuration can be detected without activating source reads.');
  assert.equal(notionFlagDisabled?.uiState, 'DISABLED', 'Notion must remain disabled from credentials alone.');
  process.env.FF_TEST_NOTION = 'true';
  process.env.KURUKOO_MICROSOFT_CLIENT_ID = 'microsoft-client';
  process.env.KURUKOO_MICROSOFT_CLIENT_SECRET = 'microsoft-secret';
  process.env.KURUKOO_MICROSOFT_REDIRECT_URI = 'https://example.test/api/artifacts/microsoft/outlook/callback';
  const outlookFlagDisabled = getExternalIntegrationReadiness().find((item) => item.id === 'outlook');
  const oneDriveFlagDisabled = getExternalIntegrationReadiness().find((item) => item.id === 'onedrive');
  assert.equal(outlookFlagDisabled?.readiness.CREDENTIAL_READY, true); assert.equal(outlookFlagDisabled?.uiState, 'DISABLED');
  assert.equal(oneDriveFlagDisabled?.readiness.CREDENTIAL_READY, true); assert.equal(oneDriveFlagDisabled?.uiState, 'DISABLED');
  process.env.FF_TEST_OUTLOOK = 'true'; process.env.FF_TEST_ONEDRIVE = 'true';
  process.env.MISTRAL_API_KEY = 'mistral-key';
  process.env.MISTRAL_TTS_MODEL = 'voxtral-mini-tts-2603';
  process.env.MISTRAL_TTS_VOICE_ID = 'saved-voice';
  const mistralTtsFlagDisabled = getExternalIntegrationReadiness().find((item) => item.id === 'mistral_tts');
  assert.equal(mistralTtsFlagDisabled?.readiness.CREDENTIAL_READY, true, 'Mistral TTS model and voice configuration can be detected while feature gates remain disabled.');
  assert.equal(mistralTtsFlagDisabled?.uiState, 'DISABLED', 'Mistral TTS credentials must not enable external speech generation alone.');
  process.env.FF_TEST_HOSTED_MISTRAL = 'true'; process.env.FF_TEST_MISTRAL_TTS = 'true';
  process.env.OPENROUTER_API_KEY = 'openrouter-key';
  process.env.OPENROUTER_MODEL = 'openai/gpt-5-mini';
  const openRouterFlagDisabled = getExternalIntegrationReadiness().find((item) => item.id === 'openrouter');
  assert.equal(openRouterFlagDisabled?.readiness.CREDENTIAL_READY, true, 'OpenRouter key and explicit model configuration must be detected without activation.');
  assert.equal(openRouterFlagDisabled?.uiState, 'DISABLED', 'OpenRouter credentials must not enable hosted generation by themselves.');
  process.env.FF_TEST_HOSTED_OPENROUTER = 'true';
  process.env.WHATSAPP_TOKEN = 'whatsapp-token';
  process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone-id';
  process.env.WHATSAPP_VERIFY_TOKEN = 'verify-token';
  process.env.WHATSAPP_APP_SECRET = 'app-secret';
  process.env.FF_WHATSAPP = 'true';
  const configured = getExternalIntegrationReadiness();
  const configuredDrive = configured.find((item) => item.id === 'google_drive');
  const configuredSheets = configured.find((item) => item.id === 'google_sheets');
  const configuredNotion = configured.find((item) => item.id === 'notion');
  const configuredOutlook = configured.find((item) => item.id === 'outlook');
  const configuredOneDrive = configured.find((item) => item.id === 'onedrive');
  const configuredMistralTts = configured.find((item) => item.id === 'mistral_tts');
  const configuredOpenRouter = configured.find((item) => item.id === 'openrouter');
  const configuredWhatsApp = configured.find((item) => item.id === 'whatsapp');
  assert.equal(configuredDrive?.readiness.CREDENTIAL_READY, true, 'Drive configuration must be detected without exposing credential contents.');
  assert.equal(configuredDrive?.readiness.FEATURE_FLAG_STATE, 'ENABLED', 'Drive must require an explicit feature enablement in addition to OAuth configuration.');
  assert.equal(configuredDrive?.uiState, 'LIVE_VERIFICATION_REQUIRED', 'Enabled Drive credentials must still require a real owner/provider evidence run.');
  assert.equal(configuredSheets?.readiness.FEATURE_FLAG_STATE, 'ENABLED', 'Google Sheets must require explicit source activation in addition to OAuth configuration.');
  assert.equal(configuredSheets?.uiState, 'LIVE_VERIFICATION_REQUIRED', 'Enabled Google Sheets credentials must still require a real owner/provider evidence run.');
  assert.equal(configuredNotion?.readiness.FEATURE_FLAG_STATE, 'ENABLED', 'Notion must require explicit source activation in addition to OAuth configuration.');
  assert.equal(configuredNotion?.uiState, 'LIVE_VERIFICATION_REQUIRED', 'Enabled Notion credentials must still require a real owner/provider evidence run.');
  assert.equal(configuredOutlook?.readiness.FEATURE_FLAG_STATE, 'ENABLED'); assert.equal(configuredOutlook?.uiState, 'LIVE_VERIFICATION_REQUIRED');
  assert.equal(configuredOneDrive?.readiness.FEATURE_FLAG_STATE, 'ENABLED'); assert.equal(configuredOneDrive?.uiState, 'LIVE_VERIFICATION_REQUIRED');
  assert.equal(configuredMistralTts?.readiness.FEATURE_FLAG_STATE, 'ENABLED', 'Mistral TTS must require the explicit dedicated feature flag in addition to hosted Mistral.');
  assert.equal(configuredMistralTts?.uiState, 'LIVE_VERIFICATION_REQUIRED', 'Enabled Mistral TTS credentials remain unverified until actual provider audio evidence exists.');
  assert.equal(configuredOpenRouter?.readiness.FEATURE_FLAG_STATE, 'ENABLED', 'OpenRouter must require explicit hosted-provider activation in addition to configuration.');
  assert.equal(configuredOpenRouter?.uiState, 'LIVE_VERIFICATION_REQUIRED', 'Enabled OpenRouter configuration must remain unverified until independent provider evidence exists.');
  assert.equal(configuredWhatsApp?.readiness.CREDENTIAL_READY, true, 'WhatsApp configuration must be detected through the canonical channel readiness boundary.');
  assert.equal(configuredWhatsApp?.readiness.FEATURE_FLAG_STATE, 'ENABLED', 'Configured WhatsApp must report its explicit feature flag state.');
  assert.equal(configuredWhatsApp?.uiState, 'LIVE_VERIFICATION_REQUIRED', 'An enabled credential set must not become a false production claim.');

  const channelsView = fs.readFileSync(path.join(process.cwd(), 'views', 'channels.ejs'), 'utf8');
  const publicRoutes = fs.readFileSync(path.join(process.cwd(), 'src', 'routes', 'publicRoutes.ts'), 'utf8');
  const workspaceClient = fs.readFileSync(path.join(process.cwd(), 'public', 'js', 'kurukoo-workspace.js'), 'utf8');
  const workspaceView = fs.readFileSync(path.join(process.cwd(), 'views', 'workspace.ejs'), 'utf8');
  assert.match(channelsView, /integrationReadiness/, 'Channels must render the canonical integration readiness projection.');
  assert.match(channelsView, /Object\.entries\(item\.readiness\)/, 'Channels must render every locked readiness dimension rather than a reduced placeholder state.');
  assert.match(channelsView, /NOT_IMPLEMENTED/, 'Channels must distinguish an unregistered adapter from an unavailable configured adapter.');
  assert.doesNotMatch(channelsView, /Google Sheets<\/h3><p>Bring your spreadsheets into the conversation\.<\/p><span[^>]*>Not connected/i, 'Channels must not retain a hard-coded fake source connection state.');
  assert.match(publicRoutes, /getExternalIntegrationReadiness/, 'Public Channels and Connect compositions must reuse the canonical integration readiness projection.');
  assert.match(workspaceClient, /storage\.configured && storage\.enabled/, 'Connect must distinguish a configured-but-disabled Drive provider from an enabled OAuth path.');
  assert.match(workspaceClient, /Drive disabled/, 'Connect must render a truthful disabled Drive state.');
  assert.match(channelsView, /\['google_drive', 'google_sheets', 'notion', 'outlook', 'onedrive'\]/, 'Channels must direct completed owner source setup into the authenticated Connect workspace.');
  assert.match(workspaceView, /data-google-sheets-source/, 'Connect must render the completed Google Sheets source panel.');
  assert.match(workspaceView, /data-notion-source/, 'Connect must render the completed Notion source panel.');
  assert.match(workspaceView, /data-microsoft-source/, 'Connect must render the completed Microsoft source panel.');
  assert.match(workspaceClient, /\/api\/artifacts\/microsoft\/\$\{kind\}\/list/, 'Connect must invoke the canonical owner-scoped Microsoft list endpoint.');
  assert.match(workspaceClient, /\/api\/artifacts\/notion\/search/, 'Connect must invoke the canonical owner-scoped Notion search endpoint.');
  assert.match(workspaceClient, /\/api\/artifacts\/sheets\/read/, 'Connect must invoke the canonical owner-scoped Sheets read endpoint.');
  assert.match(workspaceClient, /bounded previews/, 'Connect must describe Sheets reads as bounded previews rather than persisted source imports.');

  console.log(JSON.stringify({ ok: true, integrations: baseline.length, dimensions: requiredDimensions, baseline: { drive: drive.uiState, googleSheets: sheets.uiState, whatsapp: whatsapp.uiState }, configured: { drive: configuredDrive?.uiState, whatsapp: configuredWhatsApp?.uiState }, ui: 'canonical_projection' }));
} finally {
  for (const key of keys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
}
