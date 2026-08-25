export type CountryCode = string;

export interface CountryExperience {
  code: CountryCode;
  iso3: string;
  name: string;
  locale: string;
  currency: string;
  currencyMinorUnit: string;
  defaultEmergencyNumber: string;
  publicPath: string;
  pricingManaged: boolean;
  channels: readonly string[];
}

const COUNTRY_EXPERIENCES: Record<string, CountryExperience> = {
  ng: { code: 'ng', iso3: 'NGA', name: 'Nigeria', locale: 'en-NG', currency: 'NGN', currencyMinorUnit: 'kobo', defaultEmergencyNumber: '112', publicPath: '/ng', pricingManaged: true, channels: ['web', 'whatsapp', 'telegram', 'sms', 'ussd', 'email', 'fcm', 'voice'] },
  gh: { code: 'gh', iso3: 'GHA', name: 'Ghana', locale: 'en-GH', currency: 'GHS', currencyMinorUnit: 'pesewas', defaultEmergencyNumber: '112', publicPath: '/gh', pricingManaged: true, channels: ['web', 'whatsapp', 'telegram', 'sms', 'ussd', 'email', 'fcm', 'voice'] },
  gb: { code: 'gb', iso3: 'GBR', name: 'United Kingdom', locale: 'en-GB', currency: 'GBP', currencyMinorUnit: 'pence', defaultEmergencyNumber: '999', publicPath: '/gb', pricingManaged: true, channels: ['web', 'whatsapp', 'telegram', 'sms', 'email', 'fcm', 'voice'] },
  ca: { code: 'ca', iso3: 'CAN', name: 'Canada', locale: 'en-CA', currency: 'CAD', currencyMinorUnit: 'cents', defaultEmergencyNumber: '911', publicPath: '/ca', pricingManaged: true, channels: ['web', 'whatsapp', 'telegram', 'sms', 'email', 'fcm', 'voice'] },
  us: { code: 'us', iso3: 'USA', name: 'United States', locale: 'en-US', currency: 'USD', currencyMinorUnit: 'cents', defaultEmergencyNumber: '911', publicPath: '/us', pricingManaged: true, channels: ['web', 'whatsapp', 'telegram', 'sms', 'email', 'fcm', 'voice'] },
};

interface CountryOverride extends Partial<CountryExperience> { code: string }
function configuredExperiences(): Record<string, CountryExperience> {
  const result = { ...COUNTRY_EXPERIENCES };
  let overrides: CountryOverride[] = [];
  try { overrides = process.env.KURUKOO_MARKET_PROFILES_JSON ? JSON.parse(process.env.KURUKOO_MARKET_PROFILES_JSON) : []; } catch { overrides = []; }
  for (const override of Array.isArray(overrides) ? overrides : []) {
    const code = String(override?.code || '').trim().toLowerCase();
    if (!code) continue;
    const existing = result[code];
    result[code] = {
      code,
      iso3: String(override.iso3 || existing?.iso3 || ''),
      name: String(override.name || existing?.name || code.toUpperCase()),
      locale: String(override.locale || existing?.locale || `en-${code.toUpperCase()}`),
      currency: String(override.currency || existing?.currency || ''),
      currencyMinorUnit: String(override.currencyMinorUnit || existing?.currencyMinorUnit || 'minor'),
      defaultEmergencyNumber: String(override.defaultEmergencyNumber || existing?.defaultEmergencyNumber || '112'),
      publicPath: String(override.publicPath || existing?.publicPath || `/${code}`),
      pricingManaged: override.pricingManaged === undefined ? existing?.pricingManaged ?? false : Boolean(override.pricingManaged),
      channels: Array.isArray(override.channels) ? override.channels.map(String) : existing?.channels || ['web'],
    };
  }
  return result;
}

export function normalizeCountryCode(value: unknown, fallback: CountryCode = 'ng'): CountryCode {
  const normalized = String(value || '').trim().toLowerCase();
  const experiences = configuredExperiences();
  return Object.prototype.hasOwnProperty.call(experiences, normalized) ? normalized : fallback;
}

export function getCountryExperience(value: unknown, fallback: CountryCode = 'ng'): CountryExperience {
  return configuredExperiences()[normalizeCountryCode(value, fallback)];
}

export function listCountryExperiences(): CountryExperience[] {
  return Object.values(configuredExperiences());
}

export function isSupportedCountry(value: unknown): value is CountryCode {
  const normalized = String(value || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(configuredExperiences(), normalized);
}
