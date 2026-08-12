export interface NormalizedNigeriaGeography {
  countryCode: 'ng';
  countryName: 'Nigeria';
  stateName: string | null;
  stateCode: string | null;
  lgaName: string | null;
  locality: string | null;
  normalizationStatus: 'normalized' | 'partial' | 'unavailable';
}

const STATES: Array<{ code: string; name: string; aliases: string[] }> = [
  { code: 'LA', name: 'Lagos', aliases: ['lagos', 'lagos state', 'la'] },
  { code: 'FC', name: 'Federal Capital Territory', aliases: ['fct', 'abuja', 'abuja fct', 'federal capital territory', 'fc'] },
  { code: 'RI', name: 'Rivers', aliases: ['rivers', 'rivers state', 'ri'] },
  { code: 'KN', name: 'Kano', aliases: ['kano', 'kano state', 'kn'] },
  { code: 'OY', name: 'Oyo', aliases: ['oyo', 'oyo state', 'oy'] },
  { code: 'EN', name: 'Enugu', aliases: ['enugu', 'enugu state', 'en'] },
  { code: 'AB', name: 'Abia', aliases: ['abia', 'abia state', 'ab'] },
  { code: 'AD', name: 'Adamawa', aliases: ['adamawa', 'adamawa state', 'ad'] },
  { code: 'AK', name: 'Akwa Ibom', aliases: ['akwa ibom', 'akwa ibom state', 'ak'] },
  { code: 'AN', name: 'Anambra', aliases: ['anambra', 'anambra state', 'an'] },
  { code: 'BA', name: 'Bauchi', aliases: ['bauchi', 'bauchi state', 'ba'] },
  { code: 'BY', name: 'Bayelsa', aliases: ['bayelsa', 'bayelsa state', 'by'] },
  { code: 'BE', name: 'Benue', aliases: ['benue', 'benue state', 'be'] },
  { code: 'BO', name: 'Borno', aliases: ['borno', 'borno state', 'bo'] },
  { code: 'CR', name: 'Cross River', aliases: ['cross river', 'cross river state', 'cr'] },
  { code: 'DE', name: 'Delta', aliases: ['delta', 'delta state', 'de'] },
  { code: 'EB', name: 'Ebonyi', aliases: ['ebonyi', 'ebonyi state', 'eb'] },
  { code: 'ED', name: 'Edo', aliases: ['edo', 'edo state', 'ed'] },
  { code: 'EK', name: 'Ekiti', aliases: ['ekiti', 'ekiti state', 'ek'] },
  { code: 'GO', name: 'Gombe', aliases: ['gombe', 'gombe state', 'go'] },
  { code: 'IM', name: 'Imo', aliases: ['imo', 'imo state', 'im'] },
  { code: 'JI', name: 'Jigawa', aliases: ['jigawa', 'jigawa state', 'ji'] },
  { code: 'KD', name: 'Kaduna', aliases: ['kaduna', 'kaduna state', 'kd'] },
  { code: 'KE', name: 'Kebbi', aliases: ['kebbi', 'kebbi state', 'ke'] },
  { code: 'KT', name: 'Katsina', aliases: ['katsina', 'katsina state', 'kt'] },
  { code: 'KO', name: 'Kogi', aliases: ['kogi', 'kogi state', 'ko'] },
  { code: 'KW', name: 'Kwara', aliases: ['kwara', 'kwara state', 'kw'] },
  { code: 'NA', name: 'Nasarawa', aliases: ['nasarawa', 'nasarawa state', 'na'] },
  { code: 'NI', name: 'Niger', aliases: ['niger', 'niger state', 'ni'] },
  { code: 'OG', name: 'Ogun', aliases: ['ogun', 'ogun state', 'og'] },
  { code: 'ON', name: 'Ondo', aliases: ['ondo', 'ondo state', 'on'] },
  { code: 'OS', name: 'Osun', aliases: ['osun', 'osun state', 'os'] },
  { code: 'PL', name: 'Plateau', aliases: ['plateau', 'plateau state', 'pl'] },
  { code: 'SO', name: 'Sokoto', aliases: ['sokoto', 'sokoto state', 'so'] },
  { code: 'TA', name: 'Taraba', aliases: ['taraba', 'taraba state', 'ta'] },
  { code: 'YO', name: 'Yobe', aliases: ['yobe', 'yobe state', 'yo'] },
  { code: 'ZA', name: 'Zamfara', aliases: ['zamfara', 'zamfara state', 'za'] },
];

const LGA_ALIASES: Record<string, string> = {
  'ikeja lga': 'Ikeja', ikeja: 'Ikeja',
  'victoria island': 'Eti-Osa', vi: 'Eti-Osa', 'eti osa': 'Eti-Osa', 'eti-osa': 'Eti-Osa',
  'lagos island': 'Lagos Island', 'lagos island lga': 'Lagos Island',
  'port harcourt': 'Port Harcourt', 'port harcourt lga': 'Port Harcourt',
  'wuse': 'Municipal Area Council', 'municipal area council': 'Municipal Area Council',
  'ibadan north': 'Ibadan North', 'ibadan north lga': 'Ibadan North',
};

function compact(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/[,_-]+/g, ' ').replace(/\s+/g, ' ');
}

export function normalizeNigeriaGeography(country: unknown, state: unknown, lga: unknown, locality?: unknown): NormalizedNigeriaGeography {
  const countryCode = compact(country);
  if (countryCode !== 'ng' && countryCode !== 'nigeria') throw new Error('Controlled Nigerian supply imports require country NG');
  const stateInput = compact(state);
  const stateRecord = stateInput ? STATES.find(item => item.aliases.includes(stateInput)) : undefined;
  if (stateInput && !stateRecord) throw new Error('State is not a recognized Nigerian state or FCT alias');
  const lgaInput = compact(lga);
  const lgaName = lgaInput ? (LGA_ALIASES[lgaInput] || String(lga).trim().replace(/\s+lga$/i, '')) : null;
  const localityValue = locality === undefined || locality === null || locality === '' ? null : String(locality).trim().slice(0, 160);
  return {
    countryCode: 'ng', countryName: 'Nigeria', stateName: stateRecord?.name || null, stateCode: stateRecord?.code || null,
    lgaName, locality: localityValue,
    normalizationStatus: stateRecord && lgaName ? 'normalized' : stateRecord || lgaName || localityValue ? 'partial' : 'unavailable',
  };
}
