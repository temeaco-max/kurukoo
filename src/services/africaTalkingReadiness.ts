import { hasConfiguredSecret } from './providerCapabilities.js';

export type ExternalChannelReadinessState = 'configured' | 'not_configured' | 'external_unavailable';
type Environment = Record<string, string | undefined>;

function hasHttpsCallback(value: string | undefined): boolean {
  try {
    return new URL(String(value || '')).protocol === 'https:';
  } catch {
    return false;
  }
}

function channelStatus(featureEnabled: boolean, credentialsConfigured: boolean, callbackConfigured: boolean, callbackRequired = true) {
  if (!featureEnabled) return { status: 'not_configured' as const, reason: 'feature_disabled' };
  if (!credentialsConfigured) return { status: 'not_configured' as const, reason: 'provider_credentials_missing' };
  if (callbackRequired && !callbackConfigured) return { status: 'not_configured' as const, reason: 'https_callback_missing' };
  return { status: 'configured' as const, reason: 'configuration_present' };
}

/**
 * Reports deploy-time readiness only. It never calls the provider, sends a message,
 * or returns secret material; external delivery remains unverified until a provider
 * callback reaches a configured public endpoint.
 */
export function getAfricaTalkingReadiness(env: Environment = process.env): {
  provider: { status: ExternalChannelReadinessState; credentials_configured: boolean; external_completion_proven: false; note: string };
  sms: { status: ExternalChannelReadinessState; reason: string; feature_enabled: boolean; callback_configured: boolean; callback_path: '/webhook/sms' };
  ussd: { status: ExternalChannelReadinessState; reason: string; feature_enabled: boolean; callback_configured: boolean; callback_path: '/ussd' };
  otp: { status: ExternalChannelReadinessState; reason: string; uses_sms_boundary: true };
  airtime: { status: ExternalChannelReadinessState; reason: string; feature_enabled: boolean; callback_configured: boolean; callback_path: '/airtime'; completion_requires_provider_callback: true };
} {
  const credentialsConfigured = hasConfiguredSecret(env.AFRICASTALKING_API_KEY) && hasConfiguredSecret(env.AFRICASTALKING_USERNAME);
  const callbacks = {
    sms: hasHttpsCallback(env.AFRICASTALKING_SMS_CALLBACK_URL),
    ussd: hasHttpsCallback(env.AFRICASTALKING_USSD_CALLBACK_URL),
    airtime: hasHttpsCallback(env.AFRICASTALKING_AIRTIME_CALLBACK_URL),
  };
  const sms = channelStatus(env.FF_SMS === 'true', credentialsConfigured, callbacks.sms);
  const ussd = channelStatus(env.FF_USSD === 'true', credentialsConfigured, callbacks.ussd);
  const airtime = channelStatus(env.FF_AIRTIME === 'true', credentialsConfigured, callbacks.airtime);
  const otp = sms.status === 'configured'
    ? { status: 'configured' as const, reason: 'canonical_sms_boundary_configured', uses_sms_boundary: true as const }
    : { status: 'not_configured' as const, reason: `canonical_sms_boundary_${sms.reason}`, uses_sms_boundary: true as const };
  return {
    provider: {
      status: credentialsConfigured ? 'external_unavailable' : 'not_configured',
      credentials_configured: credentialsConfigured,
      external_completion_proven: false,
      note: credentialsConfigured
        ? 'Credentials are configured, but readiness performs no outbound probe and has no live provider callback evidence.'
        : 'Provider credentials are not configured.',
    },
    sms: { ...sms, feature_enabled: env.FF_SMS === 'true', callback_configured: callbacks.sms, callback_path: '/webhook/sms' },
    ussd: { ...ussd, feature_enabled: env.FF_USSD === 'true', callback_configured: callbacks.ussd, callback_path: '/ussd' },
    otp,
    airtime: { ...airtime, feature_enabled: env.FF_AIRTIME === 'true', callback_configured: callbacks.airtime, callback_path: '/airtime', completion_requires_provider_callback: true },
  };
}
