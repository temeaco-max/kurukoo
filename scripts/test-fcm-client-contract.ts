/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const read = (relative: string) => fs.readFile(path.join(process.cwd(), relative), 'utf8');

const webClient = await read('frontend/public/js/fcm-client.js');
const worker = await read('frontend/public/firebase-messaging-sw.js');
const nativeNotifications = await read('mobile/kurukoo-mobile/lib/notifications.ts');
const nativeLayout = await read('mobile/kurukoo-mobile/app/_layout.tsx');
const expoConfig = await read('mobile/kurukoo-mobile/app.config.ts');
const index = await read('src/index.ts');
const adminFcm = await read('src/routes/adminFcmRoutes.ts');
const docs = await read('docs/deployment/FIREBASE_FCM_SETUP.md');

assert.match(webClient, /\/api\/fcm\/config/);
assert.match(webClient, /\/api\/fcm\/register/);
assert.match(webClient, /vapidKey/);
assert.match(webClient, /Notification\.requestPermission/);
assert.match(webClient, /Never prompt automatically|never prompt automatically/i);
assert.match(worker, /firebase-messaging/);
assert.match(worker, /onBackgroundMessage/);
assert.match(worker, /notificationclick/);
assert.match(nativeNotifications, /getDevicePushTokenAsync/);
assert.match(nativeNotifications, /\/api\/fcm\/register/);
assert.match(nativeNotifications, /tokenType.*fcm|tokenType/);
assert.match(nativeNotifications, /ios-native-provider-required/);
assert.match(nativeLayout, /registerNativeFcmTokenIfPermitted/);
assert.match(expoConfig, /googleServicesFile/);
assert.match(expoConfig, /GOOGLE_SERVICES_JSON/);
assert.match(expoConfig, /GOOGLE_SERVICES_PLIST/);
assert.match(index, /adminFcmRoutes/);
assert.match(index, /fcmPublicRoutes/);
assert.match(adminFcm, /authenticateAdmin/);
assert.match(adminFcm, /sendFcmPush/);
assert.match(docs, /FCM_SERVICE_ACCOUNT_JSON/);
assert.match(docs, /KURUKOO_FCM_VAPID_KEY/);
assert.match(docs, /physical device/i);

console.log('test-fcm-client-contract: PASS');
