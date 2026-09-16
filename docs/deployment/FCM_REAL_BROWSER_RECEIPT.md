# FCM real browser receipt — manual E2E runbook

This is the **external-device verification** path for Kurukoo push delivery.
It is NOT a deterministic CI test and must never be wired into required CI.

## What it proves (and what CI already proves)

| Dimension | Where | Status |
|---|---|---|
| server delivery-path (Firebase HTTP v1 send for a real token) | `npm run test:fcm:ci` | deterministic CI |
| browser token registration (`/api/fcm/register` stores a real token) | `npm run test:fcm:ci` + this harness step 4 | CI + harness |
| **actual browser receipt** (service worker receives the push, real notification exists) | **this harness only** | external-device verification |
| notification deep-link click (lands on the canonical Work destination) | this harness steps 8–9 | external-device verification |

The harness exits non-zero unless a real push is observed by the real
service worker. When the Push API cannot genuinely subscribe it exits `2`
(`BLOCKED_EXTERNAL`) and claims nothing — it never downgrades to a pass.

## Prerequisites

1. A Firebase project with Cloud Messaging enabled and its **web app**
   configuration in the local `.env`:
   `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`,
   `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`,
   `FIREBASE_APP_ID`, `KURUKOO_FCM_VAPID_KEY`.
2. The FCM **service-account** values in the local `.env`:
   `KURUKOO_FCM_PROJECT_ID`, `KURUKOO_FCM_CLIENT_EMAIL`,
   `KURUKOO_FCM_PRIVATE_KEY`, plus `JWT_SECRET`.
3. A real Chrome or Chromium binary on the machine running the harness.
   Override discovery with `KURUKOO_CHROME_PATH=/path/to/chrome`.
4. A development-test identity: `KURUKOO_TEST_PHONE` (verified against the
   canonical `KURUKOO_DEV_AUTH` OTP boundary — code `111111` — never a stub).
5. `puppeteer-core` resolvable in the workspace (already used by
   `scripts/conversation-test.cjs`; no new dependency).

## One-time permission grant (headed, recommended)

Headless Chrome does not enable the Push API, so the first run must be
headed in order to grant notification permission to the harness origin.
The grant persists in the profile directory for repeatable runs:

```sh
KURUKOO_FCM_BROWSER_E2E=true KURUKOO_TEST_PHONE=+2348011111112 \
  npm run test:fcm:browser -- --profile=.kurukoo-fcm-profile --keep-open
```

Grant notification permission for `http://127.0.0.1:3486` when Chrome asks
(the harness never grants it synthetically). Then keep the window open or
close it — the grant persists in `.kurukoo-fcm-profile/`.

## Repeatable verification run

```sh
KURUKOO_FCM_BROWSER_E2E=true KURUKOO_TEST_PHONE=+2348011111112 \
  npm run test:fcm:browser -- --profile=.kurukoo-fcm-profile
```

Expected output on success (exit `0`):

```text
=== FCM REAL BROWSER RECEIPT: VERIFIED ===
Chain verified: Kurukoo login → canonical Work item → canonical worker notification event
  → real FCM token registration → Firebase HTTP v1 send → real service-worker receipt
  → notification click → /reminders?objectType=reminder&objectId=…
```

## What the harness does, step by step

1. Boots the real Kurukoo server on `http://127.0.0.1:3486` with the
   canonical background workers on a 30-second reminder pass.
2. Drives a real Chrome instance with `puppeteer-core` (no Push API
   overrides of any kind — `test-fcm-receipt-regression.ts` proves this
   from source).
3. Signs the test identity in through the canonical
   `POST /api/auth/request-otp` → `POST /api/auth/verify-otp` boundary.
4. Opens the real authenticated `/work` surface and uses the production
   `window.kurukooFcm` client (`frontend/public/js/fcm-client.js`) to obtain
   a genuine FCM token and register it at `POST /api/fcm/register`.
5. Creates a canonical Work item (`POST /api/reminders`, due immediately)
   from the browser session, so the chain stays canonical:
   user action → Work object → worker → notification → FCM.
6. Installs an **observe-only** `showNotification` wrapper in the service
   worker before the push arrives: it records the receipt and calls through
   to the real `showNotification`, so the notification is genuinely created.
7. Waits for the canonical worker to deliver, then asserts the received
   notification carries the canonical destination
   (`/reminders?objectType=reminder&objectId=…`).
8. Dispatches the **production** `notificationclick` handler with the
   actually-received payload and asserts the browser lands on the canonical
   Work destination.
9. Prints the per-dimension report and exits `0`.

## Failure and blocked modes

- Exit `2` (`BLOCKED_EXTERNAL`): the Push API genuinely cannot subscribe
  here (for example any headless run), or the service worker is not
  running, or the origin is not a secure context. Nothing is claimed.
- Exit `1`: a real failure — sign-in, registration, delivery, receipt or
  deep-link assertion failed. The output names the failing step.
- Running without `KURUKOO_FCM_BROWSER_E2E=true` exits `0` with `SKIPPED`
  and claims nothing (guard proven by `test-fcm-receipt-regression.ts`).

## Headless best-effort (expected to block)

```sh
KURUKOO_FCM_BROWSER_E2E=true KURUKOO_TEST_PHONE=+2348011111112 \
  npm run test:fcm:browser -- --headless
```

Expected: `BLOCKED_EXTERNAL` because headless Chrome refuses the real Push
subscription. This is the honest result — the harness must not fake the
subscription to turn it green.

## Regression guard

```sh
npm run test:fcm:regression
```

Proves the acceptance path cannot fabricate a push: no `PushManager`
override/synthesis/interception in the harness, the CI test stays
server-side only, the canonical service worker owns click routing, and the
diagnostic page (`/fcm-browser-test.html`) is labelled diagnostic-only.

