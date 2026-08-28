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
registerSkillsToFulfilmentMechanism(['ride_request'], 'provider_dispatch', {
  requiredInputs: ['origin', 'destination'],
  optionalInputs: ['departure_time', 'passengers', 'vehicle_type', 'budget', 'accessibility', 'safety_requirements', 'note'],
  notes: 'Use the shared provider-dispatch and evidence lifecycle; a provider acceptance or report is not a completed journey.',
});
registerSkillsToFulfilmentMechanism(['search','research','lookup','compare','local_information'], 'information_lookup');
registerSkillsToFulfilmentMechanism(['contact_provider','message_provider','request_quote'], 'communication_relay');

// Canonical Chat uses these current skill identifiers and requirement keys. Keep
// the mechanism shared while preserving the request owner's collected fields.
registerSkillsToFulfilmentMechanism(['order_food'], 'marketplace_purchase', {
  requiredInputs: ['items', 'location'],
  optionalInputs: ['quantity', 'delivery_time', 'dietary_requirements', 'delivery', 'delivery_address', 'delivery_provider', 'tracking_reference'],
});
registerSkillsToFulfilmentMechanism(['product_sourcing'], 'marketplace_purchase', {
  requiredInputs: ['product'],
  optionalInputs: ['quantity', 'budget', 'location', 'deadline', 'delivery', 'delivery_address', 'delivery_provider', 'tracking_reference'],
});
registerSkillsToFulfilmentMechanism(['buy_airtime'], 'marketplace_purchase', {
  requiredInputs: ['recipient_phone', 'amount_minor'],
  optionalInputs: ['currency', 'network'],
  catalogueFirst: false,
  providerInquiryFallback: false,
  confirmationRequired: true,
});
registerSkillsToFulfilmentMechanism(['data_bundle'], 'marketplace_purchase', {
  requiredInputs: ['recipient_phone', 'network', 'variation_code', 'amount_minor'],
  optionalInputs: ['bundle_label', 'currency', 'provider_request_id', 'provider_transaction_id', 'provider_status', 'payment_reference'],
  catalogueFirst: false,
  providerInquiryFallback: false,
  confirmationRequired: true,
  notes: 'Verify payment before VTpass activation; provider acceptance is not delivery, and only a correlated delivered status is completion evidence.',
});
registerSkillsToFulfilmentMechanism(['repair', 'phone_repairer'], 'service_request', {
  requiredInputs: ['device_or_asset', 'issue', 'location'],
  optionalInputs: ['urgency', 'parts_preference', 'diagnostic_authorization', 'fulfilment_method', 'collection_address', 'delivery_address', 'delivery_provider', 'tracking_reference'],
});
registerSkillsToFulfilmentMechanism(['find_worker'], 'local_discovery', {
  requiredInputs: ['service', 'location'],
  optionalInputs: ['time', 'budget', 'task_scope', 'skills_required', 'tools_required', 'materials_preference', 'access_instructions', 'onsite_contact', 'task_duration', 'urgency', 'safety_requirements', 'payment_model', 'delivery_address', 'delivery_provider', 'tracking_reference'],
  notes: 'Keep task scope and site conditions available for verified worker matching and quotes; a provider response is not task completion.',
});
registerSkillsToFulfilmentMechanism(['hotel_deals'], 'booking', {
  requiredInputs: ['objective'],
  optionalInputs: ['location', 'timing', 'budget', 'guest_count', 'room_preference', 'check_in', 'check_out', 'room_count', 'amenities', 'accessibility_requirements', 'contact_preference'],
});
registerSkillsToFulfilmentMechanism(['doctor_appointment'], 'booking', {
  requiredInputs: ['objective', 'location'],
  optionalInputs: ['timing', 'specialist', 'preferred_facility', 'accessibility', 'insurance_context', 'appointment_type', 'follow_up'],
  notes: 'Coordinate only a verified healthcare provider or facility response; no diagnosis, prescription, or appointment confirmation is inferred from a request.',
});
registerSkillsToFulfilmentMechanism(['rental_tracker'], 'booking', {
  requiredInputs: ['objective'],
  optionalInputs: ['location', 'timing', 'budget', 'bedrooms', 'property_preference', 'bathrooms', 'furnishing', 'move_in_date', 'amenities', 'transport_proximity', 'security_requirements', 'viewing_requirements', 'contact_preference'],
});
registerSkillsToFulfilmentMechanism(['home_tutor'], 'service_request', {
  requiredInputs: ['objective'],
  optionalInputs: ['subject', 'level', 'curriculum', 'location', 'delivery_mode', 'schedule', 'budget', 'tutor_preference', 'duration', 'contact_preference'],
});
registerSkillsToFulfilmentMechanism(['job_tracker'], 'local_discovery', {
  requiredInputs: ['objective'],
  optionalInputs: ['location', 'timing', 'role', 'skills', 'experience', 'work_mode', 'salary_expectation', 'availability', 'employment_type', 'work_authorization', 'cv_reference', 'contact_preference'],
});
registerSkillsToFulfilmentMechanism(['mechanic', 'roadside_mechanic'], 'service_request', {
  requiredInputs: ['objective', 'location'],
  optionalInputs: ['vehicle_make', 'vehicle_model', 'vehicle_year', 'registration', 'mileage', 'symptoms', 'service_type', 'parts_preference', 'pickup_required', 'urgency', 'budget', 'contact_preference'],
});
registerSkillsToFulfilmentMechanism(['wifi_installer'], 'service_request', {
  requiredInputs: ['objective'],
  optionalInputs: ['location', 'timing', 'connection_type', 'provider', 'symptoms'],
});
registerSkillsToFulfilmentMechanism(['vet_assistant', 'pet_weight'], 'service_request', {
  requiredInputs: ['objective', 'location'],
  optionalInputs: ['timing', 'animal_type', 'breed', 'age', 'pet_size', 'symptoms', 'urgency', 'visit_mode', 'previous_vet', 'treatment_budget', 'contact_preference'],
  notes: 'Preserve care-request context for matching and scheduling; this binding does not diagnose, prescribe, or assert provider availability.',
});
registerSkillsToFulfilmentMechanism(['canopy_rental', 'public_address_system'], 'booking', {
  requiredInputs: ['objective', 'location', 'timing'],
  optionalInputs: ['event_type', 'attendee_count', 'venue', 'setup_time', 'teardown_time', 'equipment_requirements', 'power_requirements', 'delivery_setup', 'budget', 'contact_preference'],
  notes: 'Retain event requirements for provider inquiry and explicit booking confirmation; availability, reservation, and setup remain evidence-dependent.',
});
