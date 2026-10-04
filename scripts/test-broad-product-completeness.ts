/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PRODUCT_SURFACE_COMPLETENESS } from '../src/services/productSurfaceCompletenessRegistry.js';
import { ADMIN_CONFIG_DEFINITIONS } from '../src/services/adminConfigMetadata.js';

const appRoutes = fs.readFileSync('src/routes/appSurfaceRoutes.ts', 'utf8');
const featureRegistry = fs.readFileSync('src/services/platformFeatureVisualRegistry.ts', 'utf8');
const canonicalUrls = fs.readFileSync('src/services/canonicalUrlRegistry.ts', 'utf8');
const chatContract = fs.existsSync('CHAT_SURFACE_CONTRACT.md') ? fs.readFileSync('CHAT_SURFACE_CONTRACT.md', 'utf8') : '';
const clientCoverage = fs.existsSync('docs/architecture/CLIENT_FEATURE_COVERAGE.md') ? fs.readFileSync('docs/architecture/CLIENT_FEATURE_COVERAGE.md', 'utf8') : '';

const requiredSurfaceIds = [
  'agent-chat', 'agents', 'subscriptions', 'providers', 'public-content',
  'monetisation', 'admin-keys-config', 'brand-system', 'client-parity',
];
for (const id of requiredSurfaceIds) assert.ok(PRODUCT_SURFACE_COMPLETENESS.some(surface => surface.id === id), `Missing broad surface contract: ${id}`);

const publicFamilies = ['/about', '/features', '/discover', '/network', '/channels', '/topics', '/resources', '/help', '/contact', '/pricing', '/partners', '/advertise', '/careers', '/blog', '/developers', '/legal'];
for (const route of publicFamilies) assert.ok(appRoutes.includes(route) || canonicalUrls.includes(route) || featureRegistry.includes(`webSurface:'${route}`), `Public product family is not represented: ${route}`);

for (const url of ['/field', '/chat', '/requests', '/tasks', '/connect', '/subscriptions', '/points', '/top-up', '/wallet']) {
  assert.ok(canonicalUrls.includes(url) || appRoutes.includes(url), `Canonical product URL is missing: ${url}`);
}

for (const env of ['KURUKOO_PUBLIC_BASE_URL', 'JWT_SECRET', 'ADMIN_USERNAME', 'ADMIN_PASSWORD', 'STRIPE_WEBHOOK_SECRET', 'ECONOMIC_PAYMENT_ADAPTER', 'QR_CONTEXT_SECRET']) {
  assert.ok(ADMIN_CONFIG_DEFINITIONS.some(item => item.key === env), `Admin config catalogue missing: ${env}`);
}

for (const token of ['conversation', 'composer', 'voice', 'attachment', 'context', 'continuation', 'safety']) {
  assert.ok(chatContract.toLowerCase().includes(token) || clientCoverage.toLowerCase().includes(token), `Chat/Agent completeness evidence missing: ${token}`);
}

console.log(JSON.stringify({ passed: true, productSurfaces: PRODUCT_SURFACE_COMPLETENESS.length, adminConfigKeys: ADMIN_CONFIG_DEFINITIONS.length, publicFamilies: publicFamilies.length }, null, 2));
