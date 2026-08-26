# Firebase / FCM delivery setup

Kurukoo's notification path is one canonical queue:

```text
Client device
  -> notification permission
  -> FCM registration token
  -> POST /api/fcm/register
  -> canonical notification queue
  -> FCM HTTP v1
  -> provider acceptance
  -> device notification
```

The product distinguishes provider acceptance from actual device display. The Admin Control Room therefore reports configuration and registered-device counts separately from real delivery evidence.

## Server credentials

Configure the Firebase service account through managed deployment secrets. Supported server variables are:

- `FCM_SERVICE_ACCOUNT_PATH`
- `FCM_SERVICE_ACCOUNT_JSON`
- `KURUKOO_FCM_PROJECT_ID`
- `KURUKOO_FCM_CLIENT_EMAIL`
- `KURUKOO_FCM_PRIVATE_KEY`

Do not commit the service-account JSON or private key.

## Web / PWA client configuration

Firebase Web configuration is client-visible configuration and is safe to return from `GET /api/fcm/config`. Configure:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `KURUKOO_FCM_VAPID_KEY`

`FIREBASE_VAPID_KEY` is accepted as a compatibility fallback for the VAPID public key.

The Web/PWA client loads Firebase JS SDK 12.17.0, registers `/firebase-messaging-sw.js`, requests notification permission only after an explicit user action, obtains the FCM registration token with the configured VAPID key, and registers that token against the authenticated Kurukoo identity. The Firebase Web documentation recommends using a VAPID key for Web Push and a root `firebase-messaging-sw.js` or explicitly supplied service worker registration. citeturn350681search1turn350681search5

## Native Expo / EAS configuration

The mobile app uses the existing `expo-notifications` boundary. Expo's current configuration supports `android.googleServicesFile` and `ios.googleServicesFile` for Firebase configuration; EAS can provide these files as secret-file environment variables. citeturn837167search0turn837167search6

Configure these EAS file variables for native builds:

- `GOOGLE_SERVICES_JSON` → Firebase `google-services.json`
- `GOOGLE_SERVICES_PLIST` → Firebase `GoogleService-Info.plist`

The mobile `app.config.ts` consumes those paths only when they are present, so ordinary local Web/PWA development does not require them.

Android calls `expo-notifications.getDevicePushTokenAsync()` and registers the token with Kurukoo when the native provider reports `fcm`. Expo's Android FCM setup requires the Firebase `google-services.json` configuration for the standalone application. citeturn837167search4

iOS remains explicitly provider-gated when Expo exposes an APNs token rather than an FCM token. The repository does not pretend an APNs token is an FCM token. A Firebase-native iOS messaging integration can be added later through the native Firebase boundary if an FCM token is required on iOS; the current client will fail closed and report `ios-native-provider-required` rather than registering the wrong token.

## Native API endpoint

The mobile client registers its authenticated device against the same backend using:

- `EXPO_PUBLIC_API_BASE_URL`

No second mobile notification endpoint exists.

## Validation sequence

1. Configure the managed server secrets.
2. Configure the Firebase Web public variables and VAPID public key.
3. Configure `GOOGLE_SERVICES_JSON` for Android EAS builds and `GOOGLE_SERVICES_PLIST` when iOS Firebase native configuration is required.
4. Deploy the application/backend.
5. Sign into Kurukoo on a supported browser or native build.
6. Web/PWA: choose **Enable notifications** in the application shell.
7. Native: grant notification permission; Android FCM registration occurs automatically after permission.
8. Confirm the Control Room reports Firebase server configuration, client configuration, and at least one registered device.
9. Enter the target account phone into the Control Room Firebase test card and send a test notification.
10. Confirm the Admin response reports Firebase provider acceptance and the target device actually displays the notification.
11. If FCM returns an `UNREGISTERED` or equivalent invalid-token response, Kurukoo dead-letters that notification and clears the stale stored device token so it can be re-registered cleanly.

## Important boundaries

Credentials are never returned by `/api/fcm/config`. Device tokens are never returned by `/api/fcm/register`. A successful FCM HTTP response means Firebase accepted the message; it is not proof that the device rendered it. Physical device delivery therefore remains a runtime validation step.
