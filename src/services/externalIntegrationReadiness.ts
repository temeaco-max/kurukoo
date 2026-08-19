import { getFeatureFlagStatus, type FeatureOperationalStatus } from './featureFlags.js';
import { getPilotReadiness, type ReadinessItem } from './pilotReadiness.js';

export type ExternalIntegrationId =
  | 'google_drive' | 'google_sheets' | 'notion' | 'outlook' | 'onedrive'
  | 'whatsapp' | 'telegram' | 'sms' | 'ussd' | 'email' | 'fcm'
  | 'stripe' | 'mobile_money' | 'mcp' | 'gemini' | 'mistral' | 'mistral_tts' | 'groq' | 'openrouter' | 'huggingface'
  | 'webrtc' | 'mqtt_iot' | 'voice' | 'external_dispatch' | 'provider_verification' | 'maps_geolocation';

export type IntegrationUserState = 'CREDENTIALS_REQUIRED' | 'LIVE_VERIFICATION_REQUIRED' | 'DISABLED' | 'NOT_IMPLEMENTED' | 'PRODUCTION_ACTIVE';
export type FeatureFlagProjectionState = FeatureOperationalStatus | 'NOT_REQUIRED' | 'NOT_REGISTERED';

export interface ExternalIntegrationReadiness {
  id: ExternalIntegrationId;
  name: string;
  category: 'sources' | 'channels' | 'payments' | 'ai' | 'infrastructure' | 'operations';
  description: string;
  canonicalBoundary: string;
  uiState: IntegrationUserState;
  summary: string;
  recovery: string;
  activationChecklist: string[];
  readiness: {
    IMPLEMENTED: boolean;
    CONTRACT_TESTED: boolean;
    MOCK_VERIFIED: boolean;
    CREDENTIAL_READY: boolean;
    LIVE_VERIFIED: boolean;
    FEATURE_FLAG_STATE: FeatureFlagProjectionState;
    PRODUCTION_ACTIVE: boolean;
  };
}

const PRESENT = (value: unknown): boolean => {
  const normalized = String(value || '').trim().toLowerCase();
  return Boolean(normalized) && !['stub', 'unconfigured'].includes(normalized) && !normalized.startsWith('change_me');
};

function pilotItem(categories: ReturnType<typeof getPilotReadiness>['categories'], category: string, name: string): ReadinessItem | undefined {
  return categories[category]?.[name];
}

function credentialPresent(item: ReadinessItem | undefined): boolean {
  return Boolean(item && !['NOT_CONFIGURED', 'DISABLED'].includes(item.state));
}

function featureState(flagName: string | undefined, env: NodeJS.ProcessEnv): FeatureFlagProjectionState {
  if (!flagName) return 'NOT_REQUIRED';
  const status = getFeatureFlagStatus(env.KURUKOO_DEFAULT_COUNTRY || 'ng', flagName);
  return status.status === 'UNKNOWN' ? 'NOT_REGISTERED' : status.status;
}

function record(input: Omit<ExternalIntegrationReadiness, 'uiState' | 'summary' | 'readiness'> & {
  implemented: boolean;
  contractTested: boolean;
  mockVerified: boolean;
  credentialsReady: boolean;
  featureFlag?: string;
}, env: NodeJS.ProcessEnv): ExternalIntegrationReadiness {
  const flag = featureState(input.featureFlag, env);
  const featureEnabled = flag === 'ENABLED' || flag === 'NOT_REQUIRED';
  // Credentials only prove configuration. Provider, callback, device and outcome evidence are deliberately not persisted as live proof here.
  const liveVerified = false;
  const productionActive = false;
  const uiState: IntegrationUserState = !input.implemented
    ? 'NOT_IMPLEMENTED'
    : !input.credentialsReady
      ? 'CREDENTIALS_REQUIRED'
      : !featureEnabled
        ? 'DISABLED'
        : liveVerified && productionActive
          ? 'PRODUCTION_ACTIVE'
          : 'LIVE_VERIFICATION_REQUIRED';
  const summary = uiState === 'NOT_IMPLEMENTED'
    ? 'No provider adapter is registered for this source in the current deployment. Kurukoo does not present a connect action that cannot complete.'
    : uiState === 'CREDENTIALS_REQUIRED'
      ? 'The canonical adapter and local contract exist, but provider credentials or prerequisite configuration are absent. No external action is attempted.'
      : uiState === 'DISABLED'
        ? 'The adapter is configured enough to assess, but its feature flag is disabled. No external action is available until an authorized activation enables it.'
        : uiState === 'LIVE_VERIFICATION_REQUIRED'
          ? 'Configuration is present, but Kurukoo has no independent live provider evidence yet. A controlled smoke test and callback/device proof are required before activation.'
          : 'Independent provider evidence is recorded and the feature is active.';
  return {
    id: input.id,
    name: input.name,
    category: input.category,
    description: input.description,
    canonicalBoundary: input.canonicalBoundary,
    uiState,
    summary,
    recovery: input.recovery,
    activationChecklist: input.activationChecklist,
    readiness: {
      IMPLEMENTED: input.implemented,
      CONTRACT_TESTED: input.contractTested,
      MOCK_VERIFIED: input.mockVerified,
      CREDENTIAL_READY: input.credentialsReady,
      LIVE_VERIFIED: liveVerified,
      FEATURE_FLAG_STATE: flag,
      PRODUCTION_ACTIVE: productionActive,
    },
  };
}

/**
 * Canonical read-only projection for user and operator readiness surfaces. It does not execute a provider call,
 * expose secret presence beyond a boolean, or manufacture live-verification evidence.
 */
export function getExternalIntegrationReadiness(env: NodeJS.ProcessEnv = process.env): ExternalIntegrationReadiness[] {
  const pilot = getPilotReadiness(env).categories;
  const channel = (name: string) => credentialPresent(pilotItem(pilot, 'CHANNELS', name));
  const payment = (name: string) => credentialPresent(pilotItem(pilot, 'PAYMENTS', name));
  const verification = (name: string) => credentialPresent(pilotItem(pilot, 'VERIFICATION', name));
  const ai = (name: string) => credentialPresent(pilotItem(pilot, 'AI_PROVIDERS', name));
  const configuredDrive = PRESENT(env.KURUKOO_GOOGLE_DRIVE_CLIENT_ID) && PRESENT(env.KURUKOO_GOOGLE_DRIVE_CLIENT_SECRET) && PRESENT(env.KURUKOO_GOOGLE_DRIVE_REDIRECT_URI) && PRESENT(env.KURUKOO_STORAGE_ENCRYPTION_KEY);
  const configuredSheets = PRESENT(env.KURUKOO_GOOGLE_SHEETS_CLIENT_ID) && PRESENT(env.KURUKOO_GOOGLE_SHEETS_CLIENT_SECRET) && PRESENT(env.KURUKOO_GOOGLE_SHEETS_REDIRECT_URI) && PRESENT(env.KURUKOO_STORAGE_ENCRYPTION_KEY);
  const configuredNotion = PRESENT(env.KURUKOO_NOTION_CLIENT_ID) && PRESENT(env.KURUKOO_NOTION_CLIENT_SECRET) && PRESENT(env.KURUKOO_NOTION_REDIRECT_URI) && PRESENT(env.KURUKOO_STORAGE_ENCRYPTION_KEY);
  const configuredMicrosoft = PRESENT(env.KURUKOO_MICROSOFT_CLIENT_ID) && PRESENT(env.KURUKOO_MICROSOFT_CLIENT_SECRET) && PRESENT(env.KURUKOO_MICROSOFT_REDIRECT_URI) && PRESENT(env.KURUKOO_STORAGE_ENCRYPTION_KEY);
  const configuredMcp = env.KURUKOO_MCP_ENABLED === 'true' && PRESENT(env.KURUKOO_MCP_ISSUER) && PRESENT(env.KURUKOO_MCP_CLIENT_ID) && PRESENT(env.KURUKOO_MCP_CLIENT_SECRET) && PRESENT(env.KURUKOO_MCP_OAUTH_SECRET);
  const configuredVoice = channel('Voice');
  const configuredMqtt = credentialPresent(pilotItem(pilot, 'EXTERNAL_FOUNDATIONS', 'MQTTBridge'));
  const configuredWebRtc = credentialPresent(pilotItem(pilot, 'EXTERNAL_FOUNDATIONS', 'WebRTCRelay'));
  const configuredOpenRouter = PRESENT(env.OPENROUTER_API_KEY) && PRESENT(env.OPENROUTER_MODEL);
  const configuredMistralTts = PRESENT(env.MISTRAL_API_KEY) && PRESENT(env.MISTRAL_TTS_MODEL) && PRESENT(env.MISTRAL_TTS_VOICE_ID);

  return [
    record({ id: 'google_drive', name: 'Google Drive', category: 'sources', description: 'Owner-scoped artifact persistence using narrow Drive file access.', canonicalBoundary: 'artifactService and artifactRoutes', implemented: true, contractTested: true, mockVerified: true, credentialsReady: configuredDrive, featureFlag: 'google_drive', recovery: 'Use managed owner-scoped fallback storage until an owner reconnects Drive; reference removal never deletes a Drive file unless explicitly requested.', activationChecklist: ['Register the exact OAuth redirect URI.', 'Authorize an owner with the drive.file scope.', 'Verify upload, open, reference delete, and explicit external deletion.'] }, env),
    record({ id: 'google_sheets', name: 'Google Sheets', category: 'sources', description: 'Owner-scoped read-only spreadsheet source connection.', canonicalBoundary: 'googleSheetsSourceService and artifactRoutes', implemented: true, contractTested: true, mockVerified: true, credentialsReady: configuredSheets, featureFlag: 'google_sheets', recovery: 'Keep the spreadsheet outside Kurukoo until its owner reconnects or corrects access; no values are persisted as Kurukoo artifacts.', activationChecklist: ['Enable the Google Sheets API and register the exact OAuth redirect URI.', 'Authorize an owner with the spreadsheets.readonly scope.', 'Verify a real bounded read, denied source, refresh, revocation and owner-isolation path.'] }, env),
    record({ id: 'notion', name: 'Notion', category: 'sources', description: 'Owner-scoped shared-page and data-source connection.', canonicalBoundary: 'notionSourceService and artifactRoutes', implemented: true, contractTested: true, mockVerified: true, credentialsReady: configuredNotion, featureFlag: 'notion', recovery: 'Keep Notion pages outside Kurukoo until the owner reconnects or corrects sharing; no background workspace mirror is created.', activationChecklist: ['Register a public Notion connection and exact callback URI.', 'Authorize an owner and share only chosen pages or data sources.', 'Verify a real bounded search, denied page, reauthorization, revocation and owner-isolation path.'] }, env),
    record({ id: 'outlook', name: 'Microsoft Outlook', category: 'sources', description: 'Owner-scoped basic mailbox metadata source connection.', canonicalBoundary: 'microsoftGraphSourceService and artifactRoutes', implemented: true, contractTested: true, mockVerified: true, credentialsReady: configuredMicrosoft, featureFlag: 'outlook', recovery: 'Keep the mailbox outside Kurukoo until the owner reconnects; request only bounded basic message metadata and never persist message bodies.', activationChecklist: ['Register Microsoft OAuth and the exact callback URI.', 'Authorize the owner with only the Mail.ReadBasic delegated scope.', 'Verify a real bounded message list, consent denial, token refresh, local revocation and owner isolation.'] }, env),
    record({ id: 'onedrive', name: 'Microsoft OneDrive', category: 'sources', description: 'Owner-scoped bounded file-list source connection.', canonicalBoundary: 'microsoftGraphSourceService and artifactRoutes', implemented: true, contractTested: true, mockVerified: true, credentialsReady: configuredMicrosoft, featureFlag: 'onedrive', recovery: 'Keep files outside Kurukoo until the owner reconnects; list only a bounded selected folder view and never import or synchronize file content.', activationChecklist: ['Register Microsoft OAuth and the exact callback URI.', 'Authorize the owner with only the Files.Read delegated scope.', 'Verify a real bounded file list, consent denial, token refresh, local revocation and owner isolation.'] }, env),
    record({ id: 'whatsapp', name: 'WhatsApp', category: 'channels', description: 'Cloud API and owner-scoped linked-device channel boundaries.', canonicalBoundary: 'channelRegistry, webhook routes, WhatsApp linked-device service', implemented: true, contractTested: true, mockVerified: true, credentialsReady: channel('WhatsApp'), featureFlag: 'whatsapp', recovery: 'Keep Web Chat as the canonical continuation path when delivery is unavailable; do not claim message delivery.', activationChecklist: ['Configure approved provider credentials and callback verification.', 'Enable the approved channel flag.', 'Verify signed inbound and outbound delivery with a real owned test account.'] }, env),
    record({ id: 'telegram', name: 'Telegram', category: 'channels', description: 'Bot and owner-scoped personal linked-device channel boundaries.', canonicalBoundary: 'channelRegistry and Telegram linked-device service', implemented: true, contractTested: true, mockVerified: true, credentialsReady: channel('Telegram'), featureFlag: 'telegram', recovery: 'Continue in Web Chat when bot or linked-device delivery is unavailable.', activationChecklist: ['Configure bot token or owner-scoped linked-device credentials.', 'Enable the approved channel path.', 'Verify inbound, outbound, logout, and revocation with a real owned account.'] }, env),
    record({ id: 'sms', name: 'SMS', category: 'channels', description: 'Carrier-backed phone channel adapter.', canonicalBoundary: 'channelRegistry and SMS adapter', implemented: true, contractTested: true, mockVerified: true, credentialsReady: channel('SMS'), featureFlag: 'sms', recovery: 'Present verification or delivery as unavailable and retain Web Chat continuity.', activationChecklist: ['Configure the approved carrier account and sender identity.', 'Verify signed inbound callbacks and controlled outbound delivery.', 'Observe retry and delivery-failure behaviour.'] }, env),
    record({ id: 'ussd', name: 'USSD', category: 'channels', description: 'Carrier/shortcode feature-phone session adapter.', canonicalBoundary: 'channelRegistry and USSD route', implemented: true, contractTested: true, mockVerified: true, credentialsReady: channel('USSD'), featureFlag: 'ussd', recovery: 'Use Web Chat or another configured channel when the carrier session is unavailable.', activationChecklist: ['Provision shortcode and carrier callback.', 'Enable the approved country feature flag.', 'Verify session pagination, callback integrity, and handoff with a test handset.'] }, env),
    record({ id: 'email', name: 'Email', category: 'channels', description: 'Signed outbound and inbound email boundary.', canonicalBoundary: 'email service and channel registry', implemented: true, contractTested: true, mockVerified: true, credentialsReady: channel('Email'), featureFlag: 'email', recovery: 'Do not state that a message was sent; keep the conversation available in Web Chat.', activationChecklist: ['Configure provider, sender and signed inbound callback.', 'Verify test send, inbound handling, replay resistance, and failure state.', 'Record provider evidence before activation.'] }, env),
    record({ id: 'fcm', name: 'Push / FCM', category: 'channels', description: 'External mobile push delivery layered over internal notifications.', canonicalBoundary: 'firebaseCloudMessaging and notification authority', implemented: true, contractTested: true, mockVerified: true, credentialsReady: channel('FCM'), featureFlag: 'fcm', recovery: 'Retain the internal notification queue and show delivery as pending or unavailable.', activationChecklist: ['Configure Firebase project identity.', 'Register an authenticated test device and request permission.', 'Verify accepted provider request and physical-device receipt.'] }, env),
    record({ id: 'stripe', name: 'Stripe', category: 'payments', description: 'Payment intent and signed webhook boundary.', canonicalBoundary: 'stripePayment and canonical Economic Request lifecycle', implemented: true, contractTested: true, mockVerified: true, credentialsReady: payment('Stripe'), featureFlag: 'stripe_payments', recovery: 'Keep payments uncompleted and return to the exact Economic Request when provider confirmation is absent.', activationChecklist: ['Configure test account, secret and webhook signing secret.', 'Verify payment, webhook, replay, refund, dispute and reconciliation flows.', 'Obtain production account evidence before production activation.'] }, env),
    record({ id: 'mobile_money', name: 'Mobile money', category: 'payments', description: 'Fail-closed mobile-money adapter boundary.', canonicalBoundary: 'mobile-money/payment capability boundary', implemented: true, contractTested: true, mockVerified: true, credentialsReady: PRESENT(env.MOMO_API_KEY) || PRESENT(env.PAGA_API_KEY), featureFlag: 'mobile_money', recovery: 'Preserve the request and disclose that no settlement occurred.', activationChecklist: ['Configure a provider sandbox and signed callbacks.', 'Verify authorization, failure, reconciliation and refund paths.', 'Complete country-specific legal and production-account activation.'] }, env),
    record({ id: 'mcp', name: 'External AI clients / MCP', category: 'ai', description: 'Remote OAuth/MCP app boundary for compatible external assistants.', canonicalBoundary: 'mcpAppService and mcpAppRoutes', implemented: true, contractTested: true, mockVerified: true, credentialsReady: configuredMcp, recovery: 'Keep Web Chat as the canonical interface; do not request another assistant’s password or subscription credential.', activationChecklist: ['Configure public HTTPS issuer and OAuth client settings.', 'Enable the MCP flag.', 'Verify OAuth authorization, token refresh, tool authorization, and revocation with a compatible client.'] }, env),
    record({ id: 'gemini', name: 'Gemini', category: 'ai', description: 'Optional hosted text and realtime voice provider.', canonicalBoundary: 'unifiedAiEngine, gemini service, and voice service', implemented: true, contractTested: true, mockVerified: true, credentialsReady: ai('GeminiText'), featureFlag: 'hosted_gemini', recovery: 'Use canonical local or deterministic fallback with actual-provider diagnostics.', activationChecklist: ['Configure provider key and approved model.', 'Set quota, privacy and retention policy.', 'Verify actual request, fallback, error classification and response attribution.'] }, env),
    record({ id: 'mistral', name: 'Mistral', category: 'ai', description: 'Optional hosted text, transcription and media provider.', canonicalBoundary: 'mistralService and unifiedAiEngine', implemented: true, contractTested: true, mockVerified: true, credentialsReady: ai('MistralText'), featureFlag: 'hosted_mistral', recovery: 'Use canonical provider failover or deterministic fallback while recording the fallback reason.', activationChecklist: ['Configure provider key and approved models.', 'Enable only the relevant text or transcription flag.', 'Verify actual provider response, quota failure, and fallback diagnostics.'] }, env),
    record({ id: 'mistral_tts', name: 'Mistral Voxtral TTS', category: 'ai', description: 'Optional saved-voice hosted speech generation through the canonical server voice boundary.', canonicalBoundary: 'mistralService and serverTtsService', implemented: true, contractTested: true, mockVerified: true, credentialsReady: configuredMistralTts, featureFlag: 'mistral_tts', recovery: 'Continue in text or the separately configured voice provider when no confirmed Mistral audio response is available; never synthesize fallback audio under Mistral attribution.', activationChecklist: ['Configure a Mistral API key, explicit approved Voxtral model and saved voice profile.', 'Enable hosted Mistral and the dedicated Mistral TTS feature flag after privacy and quota review.', 'Verify actual audio generation, moderation rejection, timeout, provider failure, and text fallback.'] }, env),
    record({ id: 'groq', name: 'Groq', category: 'ai', description: 'Optional hosted text failover provider.', canonicalBoundary: 'groqService and unifiedAiEngine', implemented: true, contractTested: true, mockVerified: true, credentialsReady: PRESENT(env.GROQ_API_KEY), featureFlag: 'hosted_groq', recovery: 'Use the ordered canonical failover or deterministic fallback; never label a fallback as Groq execution.', activationChecklist: ['Configure the provider key and model.', 'Verify selection, actual response, timeout and fallback diagnostics.', 'Review quota and retention before activation.'] }, env),
    record({ id: 'openrouter', name: 'OpenRouter', category: 'ai', description: 'Optional explicit-model hosted text provider and final canonical failover candidate.', canonicalBoundary: 'openRouterService and unifiedAiEngine', implemented: true, contractTested: true, mockVerified: true, credentialsReady: configuredOpenRouter, featureFlag: 'hosted_openrouter', recovery: 'Use the ordered canonical failover or deterministic fallback; no credential or upstream routing metadata is treated as a successful response without usable provider content.', activationChecklist: ['Configure an API key, an explicit approved model, quota and privacy policy.', 'Enable the OpenRouter feature flag after configuration review.', 'Verify actual returned model/provider metadata, timeout, quota, upstream failure and deterministic fallback.'] }, env),
    record({ id: 'huggingface', name: 'Hugging Face', category: 'ai', description: 'Optional teacher routing, private Student artifact hosting and managed GPU Jobs; raw SmolLM2 serverless runtime is retired.', canonicalBoundary: 'huggingfaceJobsBackend and teacher/training adapters', implemented: true, contractTested: true, mockVerified: true, credentialsReady: PRESENT(env.HF_TOKEN) || PRESENT(env.HUGGINGFACE_API_KEY) || PRESENT(env.HF_API_KEY), featureFlag: 'huggingface_jobs', recovery: 'Keep training blocked, artifact promotion unapproved and optional teacher routing unavailable until the requested capability returns provider evidence; never restore raw SmolLM2 serverless inference.', activationChecklist: ['Configure a scoped token and private artifact repository.', 'Run non-billing preflight and approve bounded cost explicitly.', 'Verify job launch, monitor, retrieval, benchmark and fail-closed registry promotion.'] }, env),
    record({ id: 'webrtc', name: 'WebRTC / realtime relay', category: 'infrastructure', description: 'Authenticated signalling foundation for realtime media.', canonicalBoundary: 'webrtcSignalling and voice policy', implemented: true, contractTested: true, mockVerified: true, credentialsReady: configuredWebRtc, featureFlag: 'webrtc', recovery: 'Return to Web Chat or configured voice rather than implying call establishment.', activationChecklist: ['Configure approved STUN/TURN or relay infrastructure.', 'Enable the WebRTC flag after security review.', 'Verify consent, browser interoperability, relay operation, media teardown and failure recovery.'] }, env),
    record({ id: 'mqtt_iot', name: 'MQTT / IoT', category: 'infrastructure', description: 'Owner-scoped connected-resource command and broker boundary.', canonicalBoundary: 'connectedResourceService and iotBridge', implemented: true, contractTested: true, mockVerified: true, credentialsReady: configuredMqtt, featureFlag: 'iot_remote', recovery: 'Keep command records owner-scoped and report unavailable delivery; do not claim device execution.', activationChecklist: ['Configure a TLS-capable broker and device identity policy.', 'Enable the remote-control flag after review.', 'Verify pairing, authorization, idempotent command, inbound state, retry and revocation.'] }, env),
    record({ id: 'voice', name: 'Voice infrastructure', category: 'infrastructure', description: 'Realtime voice, transcription and TTS capability boundaries.', canonicalBoundary: 'voiceRouter, voiceService, serverTtsService and artifact service', implemented: true, contractTested: true, mockVerified: true, credentialsReady: configuredVoice, featureFlag: 'voice', recovery: 'Persist owner audio only through the artifact boundary and continue in text when voice is unavailable.', activationChecklist: ['Configure approved realtime/transcription/TTS provider settings.', 'Enable the relevant voice flag and quota policy.', 'Verify real audio, transcript state, privacy boundary, timeout, disconnect and text fallback.'] }, env),
    record({ id: 'external_dispatch', name: 'External dispatch', category: 'operations', description: 'Policy-gated external execution connector boundary.', canonicalBoundary: 'deliveryService and canonical execution boundary', implemented: true, contractTested: true, mockVerified: true, credentialsReady: env.KURUKOO_EXTERNAL_EXECUTION_ENABLED === 'true', recovery: 'Keep the request externally pending and preserve recovery actions when no approved connector returns evidence.', activationChecklist: ['Register an approved connector and authorization policy.', 'Verify idempotent dispatch, evidence capture, retry, cancel and escalation.', 'Enable only after operator review and live test evidence.'] }, env),
    record({ id: 'provider_verification', name: 'Provider verification', category: 'operations', description: 'External verification and KYC readiness boundary.', canonicalBoundary: 'provider verification service and trust policy', implemented: true, contractTested: true, mockVerified: true, credentialsReady: verification('providerVerification'), recovery: 'Keep providers unverified and never infer verification from profile data or configured credentials.', activationChecklist: ['Configure approved verification/KYC provider and consent flow.', 'Verify a controlled identity lifecycle and callback validation.', 'Review retention, disputes and revocation before activation.'] }, env),
    record({ id: 'maps_geolocation', name: 'Maps / geolocation', category: 'operations', description: 'Coarse, consent-bound location and Nearby Pulse readiness.', canonicalBoundary: 'location consent and presence/discovery services', implemented: true, contractTested: true, mockVerified: true, credentialsReady: env.KURUKOO_LOCATION_CONSENT_ENABLED === 'true', featureFlag: 'nearby_pulse', recovery: 'Retain no inferred background location and use explicit coarse-location or no-location states.', activationChecklist: ['Enable explicit location-consent policy.', 'Verify permission, expiry, fuzzing and owner revocation.', 'Configure any maps provider separately and verify real map terms/usage before activation.'] }, env),
  ];
}

export function getExternalIntegrationReadinessById(id: string, env: NodeJS.ProcessEnv = process.env): ExternalIntegrationReadiness | undefined {
  return getExternalIntegrationReadiness(env).find((integration) => integration.id === id);
}
