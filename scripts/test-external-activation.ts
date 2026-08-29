/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { activateConfiguredExternalProviders } from '../src/services/externalActivationService.js';

const previousEnv = { ...process.env };
const originalFetch = globalThis.fetch;

process.env.KURUKOO_PUBLIC_BASE_URL = 'https://example.test';
process.env.TELEGRAM_BOT_TOKEN = 'telegram-test-token';
process.env.TELEGRAM_WEBHOOK_SECRET = 'telegram-webhook-secret';
process.env.WHATSAPP_TOKEN = 'whatsapp-test-token';
process.env.WHATSAPP_PHONE_NUMBER_ID = '123456';
process.env.WHATSAPP_GRAPH_API_VERSION = 'v23.0';
process.env.STRIPE_SECRET_KEY = 'sk_test_activation_contract';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_activation_contract';
process.env.KURUKOO_PAY_PROVIDER = 'stripe';
process.env.RESEND_API_KEY = 're_test_activation';
process.env.MISTRAL_API_KEY = 'mistral_test_activation';
process.env.KURUKOO_DEFAULT_COUNTRY = 'ng';
process.env.FF_HOSTED_MISTRAL = 'true';

try {
  globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('api.telegram.org') && url.endsWith('/getMe')) return new Response(JSON.stringify({ ok: true, result: { id: 42, username: 'kurukoo_test_bot' } }), { status: 200 });
    if (url.includes('api.telegram.org') && url.includes('/setWebhook')) return new Response(JSON.stringify({ ok: true, result: true }), { status: 200 });
    if (url.includes('graph.facebook.com') && url.includes('subscribed_apps')) return new Response(JSON.stringify({ success: true }), { status: 200 });
    if (url.includes('graph.facebook.com')) return new Response(JSON.stringify({ id: '123456', display_phone_number: '+10000000000', verified_name: 'Kurukoo Test' }), { status: 200 });
    if (url.includes('api.stripe.com/v1/account')) return new Response(JSON.stringify({ id: 'acct_test_kurukoo' }), { status: 200 });
    if (url.includes('api.resend.com/domains')) return new Response(JSON.stringify({ data: [] }), { status: 200 });
    if (url.includes('api.mistral.ai/v1/models')) return new Response(JSON.stringify({ data: [{ id: 'mistral-small-latest' }] }), { status: 200 });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  const activation = await activateConfiguredExternalProviders();
  const names = activation.results.map(result => result.provider).sort();
  assert.deepEqual(names, ['email', 'fcm', 'mistral', 'stripe', 'telegram', 'whatsapp']);
  const configuredProviders = activation.results.filter(result => result.provider !== 'fcm');
  assert.equal(configuredProviders.every(result => result.configured && result.activated && result.verified), true);
  const fcm = activation.results.find(result => result.provider === 'fcm');
  assert.ok(fcm, 'FCM readiness must be reported even when its optional runtime configuration is absent');
  if (fcm.configured) assert.equal(fcm.verified, true, 'configured FCM must surface a verified or explicit probe state');
  const mistral = activation.results.find(result => result.provider === 'mistral');
  assert.ok(mistral?.detail.includes('Mistral'));
  const whatsapp = activation.results.find(result => result.provider === 'whatsapp');
  assert.ok(whatsapp?.detail.includes('v23.0'));
  console.log(JSON.stringify({ ok: true, providers: activation.results.map(({ provider, configured, activated, verified }) => ({ provider, configured, activated, verified })) }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) if (!(key in previousEnv)) delete process.env[key];
  for (const [key, value] of Object.entries(previousEnv)) process.env[key] = value;
}
