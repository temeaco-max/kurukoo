# Prayer Companion Deployment Activation

Set the existing Kurukoo voice/TTS credentials and feature flags used by `voiceService.ts` and `serverTtsService.ts`. No prayer-specific secret is required.

Live prayer requires the existing realtime voice configuration (`KURUKOO_VOICE_ENABLED=true`, a supported live provider/model, and the provider credential). Spoken prayer audio requires the existing server TTS configuration and provider credential.

Without those external credentials, text prayer remains functional and voice endpoints fail closed with explicit readiness errors. This is intentional and keeps local/staging testability independent of external voice delivery.
