/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import { buildSkillBehaviourInstruction, resolveSkillBehaviour } from '../src/services/skillBehaviourRegistry.js';
import { getServiceJurisdictionProfile } from '../src/services/jurisdictionServiceProfiles.js';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-skill-behaviour-and-repair-outcomes-${process.pid}-${Date.now()}.sqlite`;
const { chooseInferenceProvider } = await import('../src/services/aiInferencePolicy.js');

const phone = resolveSkillBehaviour('My iPhone 13 screen is broken in London and I need collection and return today.');
assert(phone);
assert.equal(phone.skill, 'phone_repairer');
assert(phone.required.includes('device'));
assert(phone.compound?.some(leg => leg.skill === 'device_collection'));
assert(phone.compound?.some(leg => leg.skill === 'delivery_return'));
assert(buildSkillBehaviourInstruction(phone).includes('Completion evidence'));

const hotel = resolveSkillBehaviour('Book me a hotel and airport transfer in London.');
assert(hotel);
assert.equal(hotel.skill, 'hotel_booking');
assert(hotel.compound?.some(leg => leg.skill === 'airport_transfer'));

assert.equal(getServiceJurisdictionProfile('GB').currency, 'GBP');
assert.equal(getServiceJurisdictionProfile('NG').currency, 'NGN');
assert.equal(getServiceJurisdictionProfile('CA').currency, 'CAD');
assert.equal(getServiceJurisdictionProfile('GB').sameDayRepairSupported, true);

const cheap = chooseInferenceProvider({ task: 'conversation', prompt: 'hello' });
assert.equal(cheap.provider, 'smollm2');
const complex = chooseInferenceProvider({ task: 'planning', prompt: 'coordinate and negotiate a same-day repair with pickup and return' });
assert(['smollm2', 'mistral'].includes(complex.provider));

console.log('Skill behaviour, compound fulfilment, jurisdiction and inference policy checks passed.');
