import { getEconomicCategory, getSkillCapabilities, getSkillRequirements } from './skillFlows.js';
import { getAllCatalogueSkillNames, getSkillExtension } from './skillCatalogueConvergence.js';

export type FulfilmentMechanism =
  | 'marketplace_purchase'
  | 'service_request'
  | 'booking'
  | 'procurement'
  | 'local_discovery'
  | 'provider_dispatch'
  | 'information_lookup'
  | 'communication_relay';

export interface FulfilmentSkillBinding {
  skill: string;
  mechanism: FulfilmentMechanism;
  requiredInputs: string[];
  optionalInputs: string[];
  catalogueFirst: boolean;
  providerInquiryFallback: boolean;
  confirmationRequired: boolean;
  notes?: string;
}

const bindings = new Map<string, FulfilmentSkillBinding>();

export function registerFulfilmentSkillBinding(binding: FulfilmentSkillBinding): void {
  const skill = String(binding.skill || '').trim().toLowerCase();
  if (!skill) throw new Error('Fulfilment skill binding requires a skill name');
  bindings.set(skill, {
    ...binding,
    skill,
    requiredInputs: [...new Set(binding.requiredInputs.map(String).filter(Boolean))],
    optionalInputs: [...new Set(binding.optionalInputs.map(String).filter(Boolean))],
  });
}

export function getFulfilmentSkillBinding(skill: string): FulfilmentSkillBinding | undefined {
  const binding = bindings.get(String(skill || '').trim().toLowerCase());
  return binding ? { ...binding, requiredInputs: [...binding.requiredInputs], optionalInputs: [...binding.optionalInputs] } : undefined;
}

export function listFulfilmentSkillBindings(): FulfilmentSkillBinding[] {
  return [...bindings.values()].map(binding => ({ ...binding, requiredInputs: [...binding.requiredInputs], optionalInputs: [...binding.optionalInputs] })).sort((a,b) => a.skill.localeCompare(b.skill));
}

export function resolveMissingFulfilmentInputs(binding: FulfilmentSkillBinding, collected: Record<string, unknown>): string[] {
  return binding.requiredInputs.filter(key => {
    const value = collected[key];
    return value === undefined || value === null || (typeof value === 'string' && !value.trim());
  });
}

export function getFulfilmentMechanismForSkill(skill: string): FulfilmentMechanism | undefined {
  return getFulfilmentSkillBinding(skill)?.mechanism;
}

// These are deliberately mechanism bindings, not bespoke implementations. New
// skills can join the same fulfilment infrastructure with configuration only.
const genericBindings: Array<Omit<FulfilmentSkillBinding, 'skill'>> = [
  {
    mechanism: 'marketplace_purchase',
    requiredInputs: ['item', 'quantity', 'location'],
    optionalInputs: ['budgetMinor', 'currency', 'timing', 'preferences'],
    catalogueFirst: true,
    providerInquiryFallback: true,
    confirmationRequired: true,
    notes: 'Catalogue first; ask a provider when current catalogue availability is unknown.',
  },
  {
    mechanism: 'service_request',
    requiredInputs: ['description', 'location', 'timing'],
    optionalInputs: ['budgetMinor', 'preferences'],
    catalogueFirst: false,
    providerInquiryFallback: true,
    confirmationRequired: true,
  },
  {
    mechanism: 'booking',
    requiredInputs: ['item', 'timing', 'location'],
    optionalInputs: ['quantity', 'budgetMinor', 'preferences'],
    catalogueFirst: true,
    providerInquiryFallback: true,
    confirmationRequired: true,
  },
  {
    mechanism: 'procurement',
    requiredInputs: ['item', 'quantity', 'location'],
    optionalInputs: ['budgetMinor', 'currency', 'timing', 'preferences'],
    catalogueFirst: true,
    providerInquiryFallback: true,
    confirmationRequired: true,
  },
  {
    mechanism: 'local_discovery',
    requiredInputs: ['item', 'location'],
    optionalInputs: ['timing', 'preferences'],
    catalogueFirst: true,
    providerInquiryFallback: true,
    confirmationRequired: false,
  },
  {
    mechanism: 'provider_dispatch',
    requiredInputs: ['description', 'location', 'timing'],
    optionalInputs: ['budgetMinor', 'preferences'],
    catalogueFirst: false,
    providerInquiryFallback: true,
    confirmationRequired: true,
  },
  {
    mechanism: 'information_lookup',
    requiredInputs: ['item'],
    optionalInputs: ['location', 'timing', 'preferences'],
    catalogueFirst: true,
    providerInquiryFallback: false,
    confirmationRequired: false,
  },
  {
    mechanism: 'communication_relay',
    requiredInputs: ['description'],
    optionalInputs: ['providerId', 'providerPhone', 'timing'],
    catalogueFirst: false,
    providerInquiryFallback: true,
    confirmationRequired: true,
  },
];

export function registerSkillsToFulfilmentMechanism(skills: string[], mechanism: FulfilmentMechanism, overrides: Partial<Omit<FulfilmentSkillBinding, 'skill' | 'mechanism'>> = {}): void {
  const generic = genericBindings.find(item => item.mechanism === mechanism);
  if (!generic) throw new Error(`Unknown fulfilment mechanism ${mechanism}`);
  for (const skill of skills) registerFulfilmentSkillBinding({ skill, ...generic, ...overrides, mechanism });
}

// Core examples used by the generic infrastructure and as a template for the
// wider skill catalogue. The catalogue can grow without adding execution engines.
registerSkillsToFulfilmentMechanism(['purchase','buy','food_order','grocery','restaurant','marketplace'], 'marketplace_purchase');
registerSkillsToFulfilmentMechanism(['phone_repair','computer_repair','home_repair','plumbing','electrical','cleaning','moving','car_repair'], 'service_request');
registerSkillsToFulfilmentMechanism(['ride','flight','hotel','artist_booking','appointment','restaurant_booking'], 'booking');
registerSkillsToFulfilmentMechanism(['wholesale','business_procurement','office_supplies','equipment','parts'], 'procurement');
registerSkillsToFulfilmentMechanism(['find_worker','find_provider','local_business','discover'], 'local_discovery');
registerSkillsToFulfilmentMechanism(['courier','delivery','pickup','field_service'], 'provider_dispatch');
registerSkillsToFulfilmentMechanism(['search','research','lookup','compare','local_information'], 'information_lookup');
registerSkillsToFulfilmentMechanism(['contact_provider','message_provider','request_quote'], 'communication_relay');

function mechanismForSkillCoverage(skill: string): FulfilmentMechanism {
  const normalized = skill.toLowerCase();
  const extension = getSkillExtension(normalized);
  const category = String(extension?.category || getEconomicCategory(normalized) || '').toLowerCase();
  const capabilities = getSkillCapabilities(normalized);
  if (extension?.mode === 'information' || /(?:information|government|legal|finance|education|news|content)/.test(category) && !capabilities.includes('fulfillment')) return 'information_lookup';
  if (/(?:message|contact|communication|voice|call|topic|reply|share)/.test(normalized)) return 'communication_relay';
  if (/(?:transport|mobility|events|entertainment|travel|hospitality|childcare)/.test(category) || /(?:ride|flight|hotel|appointment|booking|ticket)/.test(normalized)) return 'booking';
  if (/(?:errands|delivery|courier|dispatch)/.test(category) || /(?:courier|delivery|pickup|towing|recovery)/.test(normalized)) return 'provider_dispatch';
  if (/(?:classifieds|marketplace|food|drink|agriculture|produce|fashion|apparel|water|beverage|retail)/.test(category) || /(?:buy|order|grocery|shop|source|supplier|product|gas_refill)/.test(normalized)) return 'marketplace_purchase';
  if (/(?:business|office|wholesale|procurement)/.test(category) || /(?:wholesale|procurement|office_supplies|equipment|parts)/.test(normalized)) return 'procurement';
  if (extension?.mode === 'coordination' || /(?:discovery|local|nearby)/.test(normalized)) return 'local_discovery';
  return 'service_request';
}

function registerConvergedSkillCoverage(): void {
  for (const skill of getAllCatalogueSkillNames()) {
    if (getFulfilmentSkillBinding(skill)) continue;
    const mechanism = mechanismForSkillCoverage(skill);
    const generic = genericBindings.find(item => item.mechanism === mechanism)!;
    const requirements = getSkillRequirements(skill);
    const extension = getSkillExtension(skill);
    const requiredInputs = requirements.filter(item => item.required).map(item => item.key);
    const optionalInputs = requirements.filter(item => !item.required).map(item => item.key);
    const hasExternalFulfilment = getSkillCapabilities(skill).some(capability => ['fulfillment', 'payment', 'reservation', 'quote'].includes(capability));
    registerFulfilmentSkillBinding({
      skill,
      ...generic,
      mechanism,
      requiredInputs: requiredInputs.length ? requiredInputs : extension?.requirements.map(value => value.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase()).filter(Boolean) || generic.requiredInputs,
      optionalInputs: optionalInputs.length ? optionalInputs : extension?.optional.map(value => value.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase()).filter(Boolean) || generic.optionalInputs,
      catalogueFirst: mechanism === 'marketplace_purchase' || mechanism === 'procurement' || mechanism === 'booking' || mechanism === 'local_discovery',
      providerInquiryFallback: ['marketplace_purchase', 'service_request', 'booking', 'procurement', 'local_discovery', 'provider_dispatch', 'communication_relay'].includes(mechanism),
      confirmationRequired: hasExternalFulfilment && mechanism !== 'information_lookup' && mechanism !== 'local_discovery',
      notes: `Catalogue-driven reusable ${mechanism} binding for the converged skill catalogue.`,
    });
  }
}

registerConvergedSkillCoverage();

// Food quantity is required by the canonical Fulfilment resolver even though the
// older Economic Request prompt treats it as an optional capture field.
const canonicalFoodBinding = getFulfilmentSkillBinding('order_food');
if (canonicalFoodBinding) registerFulfilmentSkillBinding({ ...canonicalFoodBinding, requiredInputs: [...canonicalFoodBinding.requiredInputs.filter(key => key !== 'quantity' && key !== 'location'), 'quantity', 'location'] });
