import {
  auditEconomicTaxonomy,
  getDefaultCapabilities,
  getEconomicCategory,
  getKnownSkills,
  getSkillCapabilities,
  getSkillRequirements,
  ECONOMIC_CATEGORIES,
  getAllowedEconomicTransitions,
} from '../src/services/skillFlows.js';

const taxonomy = auditEconomicTaxonomy();
if (taxonomy.unmapped.length) throw new Error(`Unmapped skills: ${taxonomy.unmapped.join(', ')}`);
if (taxonomy.categories !== ECONOMIC_CATEGORIES.length) throw new Error('Economic category count mismatch');

// `ride_request` is the chat intent; the canonical economic skill it resolves to
// is `okada_rider` (see intentRouter.ts). Keep this audit aligned with the
// canonical CATEGORY_BY_SKILL catalogue rather than introducing a second alias.
const requiredSkills = [
  'okada_rider',
  'keke_driver',
  'order_food',
  'buy_car',
  'buy_ticket',
  'repair',
  'find_worker',
  'product_sourcing',
  'security_personnel',
  'verified_artist',
  'football_player',
  'sports_coach',
];

for (const skill of requiredSkills) {
  const category = getEconomicCategory(skill);
  if (!category) throw new Error(`Missing category for required skill: ${skill}`);
  const capabilities = getDefaultCapabilities(category);
  if (!capabilities.includes('discovery') || !capabilities.includes('completion')) {
    throw new Error(`Incomplete capabilities for ${skill}`);
  }
}

// Every canonical skill must be usable through the same economic machinery:
// it needs a category, a requirement schema, and the common discovery/completion
// lifecycle. This deliberately does not require a bespoke flow row per skill.
const known = getKnownSkills();
if (known.length < 120) throw new Error(`Expected broad canonical skill taxonomy, found only ${known.length}`);
for (const skill of known) {
  const category = getEconomicCategory(skill);
  if (!category) throw new Error(`Canonical skill has no category: ${skill}`);

  const requirements = getSkillRequirements(skill);
  if (!requirements.length) throw new Error(`Canonical skill has no requirement schema: ${skill}`);

  const keys = requirements.map((requirement) => requirement.key);
  if (new Set(keys).size !== keys.length) throw new Error(`Duplicate requirement keys for ${skill}`);
  for (const requirement of requirements) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(requirement.key)) {
      throw new Error(`Invalid requirement key for ${skill}: ${requirement.key}`);
    }
    if (!requirement.label.trim()) throw new Error(`Blank requirement label for ${skill}: ${requirement.key}`);
  }

  const capabilities = getSkillCapabilities(skill);
  if (!capabilities.includes('discovery') || !capabilities.includes('completion')) {
    throw new Error(`Canonical skill lacks shared economic lifecycle capabilities: ${skill}`);
  }
}

// These are intentionally capability assertions, not artist-specific architecture
// assertions: specialist requirements are composed onto the same economic request.
const artistCapabilities = getSkillCapabilities('verified_artist');
for (const capability of ['verification', 'contract', 'escrow', 'completion'] as const) {
  if (!artistCapabilities.includes(capability)) throw new Error(`Artist capability missing: ${capability}`);
}

const vehicleCapabilities = getSkillCapabilities('buy_car');
for (const capability of ['verification', 'evidence', 'escrow', 'completion'] as const) {
  if (!vehicleCapabilities.includes(capability)) throw new Error(`Vehicle capability missing: ${capability}`);
}

const ticketCapabilities = getSkillCapabilities('buy_ticket');
for (const capability of ['verification', 'evidence', 'payment', 'completion'] as const) {
  if (!ticketCapabilities.includes(capability)) throw new Error(`Ticket capability missing: ${capability}`);
}

if (!getAllowedEconomicTransitions('requested').includes('awaiting_match')) throw new Error('Initial lifecycle transition missing');
if (!getAllowedEconomicTransitions('paid').includes('in_fulfillment')) throw new Error('Paid -> fulfilment transition missing');
if (!getAllowedEconomicTransitions('fulfilled').includes('completed')) throw new Error('Fulfilled -> completed transition missing');

console.log(`Economic request audit passed: ${taxonomy.categories} categories, ${taxonomy.skills} skills, canonical requirement/lifecycle parity verified.`);
