/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { strict as assert } from 'node:assert';
import {
  PRIMARY_SIDEBAR_ITEMS,
  SECONDARY_SIDEBAR_ITEMS,
  HEADER_ITEMS,
  ACCOUNT_MENU_ITEMS,
  SETTINGS_SECTION_ITEMS,
} from '../src/services/authenticatedNavigationModel';

// Assistant-first IA: Chat is the primary entry point, followed by
// Home (what matters now), Discover (discovery), Activity (what is
// happening) and Work (active fulfilment).
assert.deepEqual(PRIMARY_SIDEBAR_ITEMS.map((item) => item.id), ['chat', 'field', 'discover', 'activity', 'work']);
assert.deepEqual(PRIMARY_SIDEBAR_ITEMS.map((item) => item.route), ['/chat', '/field', '/discover', '/activity', '/work']);
assert.deepEqual(SECONDARY_SIDEBAR_ITEMS.map((item) => item.id), ['reminders', 'saved', 'notifications', 'memory']);

// Header affordances (search, points, cart, notifications, account)
// are owned by the shared shell runtime, not the navigation model.
assert.deepEqual(HEADER_ITEMS.map((item) => item.id), []);

const accountIds = new Set(ACCOUNT_MENU_ITEMS.map((item) => item.id));
for (const required of ['subscriptions', 'top-up', 'wallet', 'agents', 'connect', 'capabilities', 'opportunities']) {
  assert.equal(accountIds.has(required), true, `Account menu missing ${required}`);
}

const settingsIds = new Set(SETTINGS_SECTION_ITEMS.map((item) => item.id));
for (const required of ['profile', 'settings', 'contacts', 'safety', 'appearance', 'notifications-settings', 'privacy-settings', 'settings-security']) {
  assert.equal(settingsIds.has(required), true, `Settings missing ${required}`);
}

// Commerce and utility stay out of the primary navigation surfaces.
assert.equal(PRIMARY_SIDEBAR_ITEMS.some((item) => item.id === 'cart'), false);
assert.equal(PRIMARY_SIDEBAR_ITEMS.some((item) => item.id === 'points'), false);
assert.equal(SECONDARY_SIDEBAR_ITEMS.some((item) => item.id === 'cart'), false);
assert.equal(SECONDARY_SIDEBAR_ITEMS.some((item) => item.id === 'points'), false);

// Safety and identity configuration live in Settings, not the account menu.
assert.equal(ACCOUNT_MENU_ITEMS.some((item) => item.id === 'memory'), false);
assert.equal(ACCOUNT_MENU_ITEMS.some((item) => item.id === 'safety'), false);
assert.equal(SETTINGS_SECTION_ITEMS.some((item) => item.id === 'appearance'), true);

console.log('authenticated navigation model: PASS');
