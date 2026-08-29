/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { getPilotReadiness } from '../src/services/pilotReadiness.js';

function state(report: ReturnType<typeof getPilotReadiness>, category: string, key: string) {
  return report.categories[category]?.[key]?.state;
}

const original = { ...process.env };
try {
  const base = { ...process.env, NODE_ENV: 'test', KURUKOO_DEV_AUTH: 'true', KURUKOO_TEST_PHONE: '+2348000000000', JWT_SECRET: 'a'.repeat(40), KURUKOO_PAY_PROVIDER: '', FF_NIMC_KYC: 'true', KURUKOO_AGENT_ENABLED: 'false' };
  const development = getPilotReadiness(base);
  assert.equal(state(development, 'CORE', 'developmentAuth'), 'READY');
  assert.equal(state(development, 'CORE', 'databaseConcurrency'), 'READY');
  assert.equal(state(getPilotReadiness({ ...base, KURUKOO_WORKERS: '2' }), 'CORE', 'databaseConcurrency'), 'PENDING');
  assert.equal(state(development, 'CHANNELS', 'WhatsApp'), 'NOT_CONFIGURED');
  assert.ok(['NOT_CONFIGURED', 'EXTERNAL_DEPENDENCY'].includes(String(state(development, 'CHANNELS', 'FCM'))));
  assert.equal(state(development, 'PAYMENTS', 'Stripe'), 'NOT_CONFIGURED');
  assert.equal(state(development, 'VERIFICATION', 'KYC'), 'NOT_CONFIGURED');
  assert.equal(state(development, 'AGENT', 'runtime'), 'DISABLED');
  assert.equal(state(development, 'VERIFICATION', 'providerVerification'), 'NOT_CONFIGURED');

  const production = getPilotReadiness({ ...base, NODE_ENV: 'production' });
  assert.equal(state(production, 'CORE', 'developmentAuth'), 'DISABLED');
  assert.equal(state(getPilotReadiness({ ...base, NODE_ENV: 'production', KURUKOO_WORKERS: '4' }), 'CORE', 'databaseConcurrency'), 'PENDING');
  assert.equal(state(production, 'CHANNELS', 'WhatsApp'), 'NOT_CONFIGURED');
  assert.ok(['NOT_CONFIGURED', 'EXTERNAL_DEPENDENCY'].includes(String(state(production, 'CHANNELS', 'FCM'))));
  assert.equal(state(production, 'PAYMENTS', 'Stripe'), 'NOT_CONFIGURED');
  assert.equal(state(production, 'VERIFICATION', 'KYC'), 'NOT_CONFIGURED');
  assert.equal(state(production, 'AGENT', 'runtime'), 'DISABLED');
  assert.equal(state(production, 'VERIFICATION', 'providerVerification'), 'NOT_CONFIGURED');

  const report = getPilotReadiness(process.env);
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else console.log('Pilot readiness regression passed: missing external credentials, disabled agent state, controlled development auth, and production rejection are truthful.');
} finally {
  for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
  Object.assign(process.env, original);
}
