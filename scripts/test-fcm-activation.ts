/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { probeFirebaseFcmConnection } from '../src/services/firebaseCloudMessaging.js';

const original = {
  FCM_SERVICE_ACCOUNT_PATH: process.env.FCM_SERVICE_ACCOUNT_PATH,
  FCM_SERVICE_ACCOUNT_JSON: process.env.FCM_SERVICE_ACCOUNT_JSON,
  KURUKOO_FCM_PROJECT_ID: process.env.KURUKOO_FCM_PROJECT_ID,
  KURUKOO_FCM_CLIENT_EMAIL: process.env.KURUKOO_FCM_CLIENT_EMAIL,
  KURUKOO_FCM_PRIVATE_KEY: process.env.KURUKOO_FCM_PRIVATE_KEY,
};
try {
  delete process.env.FCM_SERVICE_ACCOUNT_PATH;
  delete process.env.FCM_SERVICE_ACCOUNT_JSON;
  delete process.env.KURUKOO_FCM_PROJECT_ID;
  delete process.env.KURUKOO_FCM_CLIENT_EMAIL;
  delete process.env.KURUKOO_FCM_PRIVATE_KEY;
  const result = await probeFirebaseFcmConnection();
  assert.equal(result.configured, false);
  assert.equal(result.reachable, false);
  console.log('FCM activation contract passed.');
} finally {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key as keyof NodeJS.ProcessEnv];
    else process.env[key as keyof NodeJS.ProcessEnv] = value;
  }
}
