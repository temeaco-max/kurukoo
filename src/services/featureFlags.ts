import fs from 'fs';
import path from 'path';

const FLAG_ENV_PREFIX = 'FF_';

export type FeatureLifecycle = 'experimental' | 'pilot' | 'production-capable' | 'deprecated';
export type FeatureRisk = 'low' | 'medium' | 'high';
export type FeatureOperationalStatus = 'ENABLED' | 'DISABLED' | 'MISCONFIGURED' | 'WAITING_FOR_PROVIDER' | 'EXPERIMENTAL' | 'DEPRECATED';

export interface FeatureDefinition {
    description: string;
    lifecycle: FeatureLifecycle;
    defaultEnabled: boolean;
    markets?: string[];
    requires?: string[];
    dependencies?: string[];
    providerPrerequisites?: string[];
    risk?: FeatureRisk;
    killSwitch?: boolean;
    adminVisible?: boolean;
}

/**
 * Canonical feature registry.
 *
 * Feature flags are rollout controls, not a substitute for provider readiness.
 * A feature may be code-complete but remain disabled until its dependencies are configured.
 */
export const FEATURE_REGISTRY: Record<string, FeatureDefinition> = {
    ussd: { description: 'USSD channel', lifecycle: 'pilot', defaultEnabled: false, markets: ['ng'] },
    whatsapp: { description: 'WhatsApp channel', lifecycle: 'pilot', defaultEnabled: false, markets: ['ng', 'gb', 'ca'], requires: ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_APP_SECRET'] },
    telegram: { description: 'Telegram channel', lifecycle: 'pilot', defaultEnabled: false, requires: ['TELEGRAM_BOT_TOKEN'] },
    sms: { description: 'SMS channel', lifecycle: 'pilot', defaultEnabled: false, requires: ['SMS_PROVIDER'] },
    email: { description: 'Signed outbound and inbound email transport', lifecycle: 'pilot', defaultEnabled: false, requires: ['EMAIL_TRANSPORT'], providerPrerequisites: ['configured sender, provider credentials, signed inbound callback and delivery evidence'], risk: 'medium', killSwitch: true, adminVisible: true },
    voice: { description: 'Voice interaction', lifecycle: 'pilot', defaultEnabled: false },
    google_drive: { description: 'Owner-scoped Google Drive artifact persistence', lifecycle: 'pilot', defaultEnabled: false, requires: ['GOOGLE_DRIVE_OAUTH'], providerPrerequisites: ['registered OAuth client, exact callback URI, owner authorization and drive.file scope evidence'], risk: 'medium', killSwitch: true, adminVisible: true },
    google_sheets: { description: 'Owner-scoped Google Sheets read-only source connection', lifecycle: 'pilot', defaultEnabled: false, requires: ['GOOGLE_SHEETS_OAUTH'], providerPrerequisites: ['registered OAuth client, exact callback URI, owner authorization, Sheets API enabled and read-only scope evidence'], risk: 'medium', killSwitch: true, adminVisible: true },
    notion: { description: 'Owner-scoped Notion source connection', lifecycle: 'pilot', defaultEnabled: false, requires: ['NOTION_OAUTH'], providerPrerequisites: ['public Notion connection, exact callback URI, owner authorization and shared-page evidence'], risk: 'medium', killSwitch: true, adminVisible: true },
    outlook: { description: 'Owner-scoped Microsoft Outlook basic mailbox source connection', lifecycle: 'pilot', defaultEnabled: false, requires: ['MICROSOFT_GRAPH_OAUTH'], providerPrerequisites: ['Microsoft app registration, exact callback URI, Mail.ReadBasic delegated consent and mailbox evidence'], risk: 'high', killSwitch: true, adminVisible: true },
    onedrive: { description: 'Owner-scoped Microsoft OneDrive file-source connection', lifecycle: 'pilot', defaultEnabled: false, requires: ['MICROSOFT_GRAPH_OAUTH'], providerPrerequisites: ['Microsoft app registration, exact callback URI, Files.Read delegated consent and file-list evidence'], risk: 'medium', killSwitch: true, adminVisible: true },
    fcm: { description: 'External push delivery', lifecycle: 'pilot', defaultEnabled: false, requires: ['FIREBASE_ADMIN_CREDENTIALS'] },
    agent_runtime: { description: 'Bounded agent runtime', lifecycle: 'production-capable', defaultEnabled: false },
    autonomous_low_risk: { description: 'Low-risk autonomous execution within explicit user permissions', lifecycle: 'pilot', defaultEnabled: false, requires: ['agent_runtime'] },
    stripe_payments: { description: 'Stripe payment collection', lifecycle: 'pilot', defaultEnabled: false, requires: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] },
    mobile_money: { description: 'Mobile-money payment adapter', lifecycle: 'pilot', defaultEnabled: false },
    hosted_gemini: { description: 'Gemini hosted AI execution', lifecycle: 'pilot', defaultEnabled: false, requires: ['GEMINI_API_KEY'], providerPrerequisites: ['approved model, quota, privacy and retention review'], risk: 'medium', killSwitch: true, adminVisible: true },
    hosted_mistral: { description: 'Mistral hosted AI execution', lifecycle: 'pilot', defaultEnabled: false, requires: ['MISTRAL_API_KEY'], providerPrerequisites: ['approved model, quota, privacy and retention review'], risk: 'medium', killSwitch: true, adminVisible: true },
    mistral_tts: { description: 'Mistral Voxtral text-to-speech execution', lifecycle: 'pilot', defaultEnabled: false, requires: ['MISTRAL_TTS_CONFIGURATION'], dependencies: ['hosted_mistral'], providerPrerequisites: ['approved Voxtral TTS model, saved voice profile, quota, privacy and retention review'], risk: 'high', killSwitch: true, adminVisible: true },
    hosted_groq: { description: 'Groq hosted AI execution', lifecycle: 'pilot', defaultEnabled: false, requires: ['GROQ_API_KEY'], providerPrerequisites: ['approved model, quota, privacy and retention review'], risk: 'medium', killSwitch: true, adminVisible: true },
    hosted_openrouter: { description: 'OpenRouter hosted AI execution', lifecycle: 'pilot', defaultEnabled: false, requires: ['OPENROUTER_CONFIGURATION'], providerPrerequisites: ['approved explicit model, bounded spend, privacy and retention review'], risk: 'medium', killSwitch: true, adminVisible: true },
    huggingface_jobs: { description: 'Hugging Face remote training Jobs', lifecycle: 'pilot', defaultEnabled: false, requires: ['HUGGINGFACE_TOKEN'], providerPrerequisites: ['scoped token, approved GPU budget, benchmark and registry review'], risk: 'high', killSwitch: true, adminVisible: true },
    topics: { description: 'Public/shared Topic surface', lifecycle: 'production-capable', defaultEnabled: true },
    advertising: { description: 'Public advertising placements and campaign management', lifecycle: 'production-capable', defaultEnabled: true },
    contributor_tasks: { description: 'Contributor task and evidence workflow', lifecycle: 'production-capable', defaultEnabled: true },
    nearby_pulse: { description: 'Consent-based live presence and nearby discovery', lifecycle: 'pilot', defaultEnabled: false },
    catalog_ordering: { description: 'Shared catalogue/product ordering flow', lifecycle: 'pilot', defaultEnabled: false, dependencies: ['topics'], risk: 'medium', killSwitch: true, adminVisible: true },
    pwa_conversation_first: { description: 'Conversation-first installed application shell', lifecycle: 'production-capable', defaultEnabled: true, risk: 'low', killSwitch: true, adminVisible: true },
    memory_provenance: { description: 'Fact-level memory provenance and lifecycle controls', lifecycle: 'production-capable', defaultEnabled: true, risk: 'medium', killSwitch: true, adminVisible: true },
    private_number_masking: { description: 'Real routable private-number communication', lifecycle: 'pilot', defaultEnabled: false, requires: ['NUMBER_MASKING_PROVIDER'], providerPrerequisites: ['telephony provider with number ownership, routing, consent, and delivery receipts'], risk: 'high', killSwitch: true, adminVisible: true },
    webrtc: { description: 'WebRTC realtime media', lifecycle: 'experimental', defaultEnabled: false, requires: ['STUN_TURN_OR_RELAY'], providerPrerequisites: ['configured STUN/TURN or relay service'], risk: 'high', killSwitch: true, adminVisible: true },
    iot_remote: { description: 'Authenticated IoT/MQTT remote control', lifecycle: 'experimental', defaultEnabled: false, requires: ['MQTT_BROKER_URL'], providerPrerequisites: ['authenticated MQTT broker and device registry'], risk: 'high', killSwitch: true, adminVisible: true },
};

function parseBoolean(value: string | undefined): boolean | undefined {
    if (value === undefined) return undefined;
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    return undefined;
}

function localeCandidates(country: string): string[] {
    const normalized = String(country || 'ng').toLowerCase();
    const candidates = [normalized];
    if (normalized === 'gb' || normalized === 'uk') candidates.push('gb', 'en');
    else if (normalized === 'ng') candidates.push('ng', 'en');
    else candidates.push('en');
    return [...new Set(candidates)];
}

function hasRequirement(requirement: string): boolean {
    if (requirement === 'FIREBASE_ADMIN_CREDENTIALS') {
        return Boolean(process.env.FIREBASE_ADMIN_PRIVATE_KEY && process.env.FIREBASE_ADMIN_CLIENT_EMAIL);
    }
    if (requirement === 'STUN_TURN_OR_RELAY') {
        return Boolean(process.env.STUN_SERVERS || process.env.TURN_URL || process.env.TURN_SERVER_URL);
    }
    if (requirement === 'SMS_PROVIDER') {
        return Boolean(process.env.SMS_PROVIDER || process.env.SMS_API_KEY);
    }
    if (requirement === 'GOOGLE_DRIVE_OAUTH') {
        return Boolean(process.env.KURUKOO_GOOGLE_DRIVE_CLIENT_ID && process.env.KURUKOO_GOOGLE_DRIVE_CLIENT_SECRET && process.env.KURUKOO_GOOGLE_DRIVE_REDIRECT_URI && (process.env.KURUKOO_STORAGE_ENCRYPTION_KEY || process.env.MEMORY_ENCRYPTION_KEY || process.env.JWT_SECRET));
    }
    if (requirement === 'GOOGLE_SHEETS_OAUTH') {
        return Boolean(process.env.KURUKOO_GOOGLE_SHEETS_CLIENT_ID && process.env.KURUKOO_GOOGLE_SHEETS_CLIENT_SECRET && process.env.KURUKOO_GOOGLE_SHEETS_REDIRECT_URI && (process.env.KURUKOO_STORAGE_ENCRYPTION_KEY || process.env.MEMORY_ENCRYPTION_KEY || process.env.JWT_SECRET));
    }
    if (requirement === 'MICROSOFT_GRAPH_OAUTH') {
        return Boolean(process.env.KURUKOO_MICROSOFT_CLIENT_ID && process.env.KURUKOO_MICROSOFT_CLIENT_SECRET && process.env.KURUKOO_MICROSOFT_REDIRECT_URI && (process.env.KURUKOO_STORAGE_ENCRYPTION_KEY || process.env.MEMORY_ENCRYPTION_KEY || process.env.JWT_SECRET));
    }
    if (requirement === 'NOTION_OAUTH') {
        return Boolean(process.env.KURUKOO_NOTION_CLIENT_ID && process.env.KURUKOO_NOTION_CLIENT_SECRET && process.env.KURUKOO_NOTION_REDIRECT_URI && (process.env.KURUKOO_STORAGE_ENCRYPTION_KEY || process.env.MEMORY_ENCRYPTION_KEY || process.env.JWT_SECRET));
    }
    if (requirement === 'EMAIL_TRANSPORT') {
        return Boolean((process.env.RESEND_API_KEY && process.env.EMAIL_FROM) || process.env.EMAIL_WEBHOOK_URL);
    }
    if (requirement === 'GEMINI_API_KEY') return Boolean(process.env.GEMINI_API_KEY || process.env.API_KEY);
    if (requirement === 'MISTRAL_API_KEY') return Boolean(process.env.MISTRAL_API_KEY);
    if (requirement === 'MISTRAL_TTS_CONFIGURATION') return Boolean(process.env.MISTRAL_API_KEY && process.env.MISTRAL_TTS_MODEL && process.env.MISTRAL_TTS_VOICE_ID);
    if (requirement === 'GROQ_API_KEY') return Boolean(process.env.GROQ_API_KEY);
    if (requirement === 'OPENROUTER_CONFIGURATION') return Boolean(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_MODEL);
    if (requirement === 'HUGGINGFACE_TOKEN') return Boolean(process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY);
    if (requirement === 'NUMBER_MASKING_PROVIDER') {
        return Boolean(process.env.NUMBER_MASKING_PROVIDER || process.env.TWILIO_ACCOUNT_SID || process.env.AFTERA_PROVIDER_KEY);
    }
    if (requirement === 'agent_runtime') return process.env.KURUKOO_AGENT_ENABLED === 'true';
    return Boolean(process.env[requirement]);
}

export function getFeatureDefinition(flagName: string): FeatureDefinition | undefined {
    return FEATURE_REGISTRY[flagName];
}

function testOverride(flagName: string): boolean | undefined {
    if (process.env.NODE_ENV === 'production') return undefined;
    return parseBoolean(process.env[`FF_TEST_${flagName.toUpperCase()}`]);
}

function killSwitchActive(flagName: string): boolean {
    const definition = FEATURE_REGISTRY[flagName];
    if (!definition?.killSwitch) return false;
    return parseBoolean(process.env[`FF_KILL_${flagName.toUpperCase()}`]) === true;
}

function missingForDefinition(country: string, flagName: string, definition: FeatureDefinition): string[] {
    const missing = (definition.requires || []).filter((requirement) => !hasRequirement(requirement));
    for (const dependency of definition.dependencies || []) {
        if (!getFeatureFlag(country, dependency)) missing.push(`feature:${dependency}`);
    }
    return [...new Set(missing)];
}

export function getFeatureFlagStatus(country: string, flagName: string): {
    enabled: boolean;
    lifecycle: FeatureLifecycle | 'unknown';
    configured: boolean;
    missingRequirements: string[];
    status: FeatureOperationalStatus | 'UNKNOWN';
    description?: string;
    markets?: string[];
    dependencies?: string[];
    providerPrerequisites?: string[];
    risk?: FeatureRisk;
    defaultEnabled?: boolean;
    killSwitchActive?: boolean;
    adminVisible?: boolean;
    source?: 'test_override' | 'environment' | 'locale' | 'default' | 'unknown';
} {
    const definition = FEATURE_REGISTRY[flagName];
    if (!definition) return { enabled: false, lifecycle: 'unknown', configured: false, missingRequirements: [], status: 'UNKNOWN', source: 'unknown' };

    const missingRequirements = missingForDefinition(country, flagName, definition);
    const configured = missingRequirements.length === 0;
    const override = testOverride(flagName);
    const killed = killSwitchActive(flagName);
    const configuredFlag = getFeatureFlag(country, flagName);
    const enabled = Boolean(override ?? configuredFlag) && configured && !killed;
    let status: FeatureOperationalStatus;
    if (definition.lifecycle === 'deprecated') status = 'DEPRECATED';
    else if (definition.lifecycle === 'experimental') status = 'EXPERIMENTAL';
    else if (killed) status = 'DISABLED';
    else if (!configured) status = definition.providerPrerequisites?.length ? 'WAITING_FOR_PROVIDER' : 'MISCONFIGURED';
    else status = enabled ? 'ENABLED' : 'DISABLED';
    return {
        enabled,
        lifecycle: definition.lifecycle,
        configured,
        missingRequirements,
        status,
        description: definition.description,
        markets: definition.markets,
        dependencies: definition.dependencies,
        providerPrerequisites: definition.providerPrerequisites,
        risk: definition.risk,
        defaultEnabled: definition.defaultEnabled,
        killSwitchActive: killed,
        adminVisible: definition.adminVisible !== false,
        source: override !== undefined ? 'test_override' : process.env[`${FLAG_ENV_PREFIX}${flagName.toUpperCase()}`] !== undefined ? 'environment' : 'default',
    };
}

export function getFeatureRegistryReadiness(country = 'ng') {
    return Object.keys(FEATURE_REGISTRY).filter((flagName) => FEATURE_REGISTRY[flagName].adminVisible !== false).map((flagName) => ({
        flagName,
        ...getFeatureFlagStatus(country, flagName),
    }));
}

export function getFeatureFlag(country: string, flagName: string): boolean {
    const definition = FEATURE_REGISTRY[flagName];
    if (!definition) return false;
    if (killSwitchActive(flagName)) return false;
    const override = testOverride(flagName);
    if (override !== undefined) return override && missingForDefinition(country, flagName, definition).length === 0;
    const envValue = parseBoolean(process.env[`${FLAG_ENV_PREFIX}${flagName.toUpperCase()}`]);
    if (envValue !== undefined) {
        if (!envValue) return false;
        return missingForDefinition(country, flagName, definition).length === 0;
    }

    for (const locale of localeCandidates(country)) {
        const filePath = path.join(process.cwd(), 'locales', `${locale}.json`);
        try {
            if (!fs.existsSync(filePath)) continue;
            const localeData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            const value = localeData?.feature_flags?.[flagName];
            const parsed = typeof value === 'boolean' ? value : parseBoolean(value);
            if (parsed !== undefined) {
                if (!parsed) return false;
                return missingForDefinition(country, flagName, definition).length === 0;
            }
        } catch (e) {
            console.error(`Error reading feature flag ${flagName} for locale ${locale}:`, e);
        }
    }

    return definition.defaultEnabled && missingForDefinition(country, flagName, definition).length === 0;
}

export function isFeatureEnabled(country: string, flagName: string): boolean {
    return getFeatureFlag(country, flagName);
}
