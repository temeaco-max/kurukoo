export const PROVIDER_ENTITY_TYPES = [
  'human',
  'business',
  'software_service',
  'vehicle',
  'robot',
  'drone',
  'autonomous_asset',
  'external_platform',
] as const;

export type ProviderEntityType = typeof PROVIDER_ENTITY_TYPES[number];

const PROVIDER_ENTITY_TYPE_SET = new Set<string>(PROVIDER_ENTITY_TYPES);

/**
 * A provider is an entity capable of fulfilling an Economic Request. Its
 * declared skills remain the capability source of truth; this type neither
 * dispatches hardware nor grants trust, payment, or lifecycle privileges.
 */
export function isProviderEntityType(value: unknown): value is ProviderEntityType {
  return typeof value === 'string' && PROVIDER_ENTITY_TYPE_SET.has(value);
}

export function normalizeProviderEntityType(value: unknown): ProviderEntityType {
  return isProviderEntityType(value) ? value : 'human';
}

/**
 * Artist representation is a human-representation exception only. Every provider
 * entity, including future autonomous assets, requires current evidence-backed
 * verification lifecycle state before canonical discovery may return it.
 */
export function mayUseArtistVerification(type: ProviderEntityType): boolean {
  return type === 'human';
}
