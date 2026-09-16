/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
/**
 * REAL browser FCM receipt harness — the acceptance path for actual push delivery.
 *
 * This is NOT a deterministic CI test and must not be wired into required CI.
 * It needs a real Chrome instance whose Push API can genuinely subscribe, a
 * Firebase project that can genuinely deliver to that subscription, and a
 * notification permission that persists for the browser profile.
 *
 * Hard rules enforced by this harness (see test-fcm-receipt-regression.ts):
 *   - It NEVER overrides, synthesises or intercepts PushManager.subscribe().
 *   - It NEVER fabricates a device token, a receipt or a delivery claim.
 *   - When the Push API is unavailable it reports BLOCKED_EXTERNAL and exits 2.
 *     It never downgrades a blocked run into a pass.
 *
 * Verification dimensions are reported separately and never substituted:
 *   - server delivery-path VERIFIED   (Firebase HTTP v1 accepted a real send)
 *   - browser token registration VERIFIED (backend stored a real device token)
 *   - actual browser receipt VERIFIED (service worker received the push and a
 *     real notification exists for it)
 *   - external/device prerequisite    (real browser profile + granted
 *     notification permission + reachable Firebase project)
 *
 * Run (recommended, one-time manual permission grant, then repeatable):
 *   KURUKOO_FCM_BROWSER_E2E=true npm run test:fcm:browser -- --profile=.kurukoo-fcm-profile
 *
 * Run (fully headless best-effort — will usually report BLOCKED_EXTERNAL because
 * headless Chrome does not enable the Push API):
 *   KURUKOO_FCM_BROWSER_E2E=true npm run test:fcm:browser -- --headless
 *
 * Documentation: docs/deployment/FCM_REAL_BROWSER_RECEIPT.md
 */
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

dotenv.config();

/** Exit codes: 0 receipt verified, 2 blocked by an external prerequisite, 1 genuine failure. */
const EXIT_VERIFIED = 0;
const EXIT_FAILED = 1;
const EXIT_BLOCKED_EXTERNAL = 2;

const args = process.argv.slice(2);
const flag = (name: string) => args.some((a) => a === `--${name}`);
const option = (name: string) => {
  const withEquals = args.find((a) => a.startsWith(`--${name}=`));
  if (withEquals) return withEquals.slice(name.length + 3);
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : '';
};

const HEADLESS = flag('headless');
const KEEP_OPEN = flag('keep-open');
const COMMAND_TIMEOUT_MS = Number(option('timeout') || 300000);
const root = process.cwd();
const PORT = Number(option('port') || 3486);
const BASE = `http://127.0.0.1:${PORT}`;
const dbPath = path.join(root, `tmp-fcm-receipt-${PORT}.sqlite`);
const profileDir = path.resolve(root, option('profile') || '.kurukoo-fcm-receipt-profile');

// ── Prerequisite reporting helpers ───────────────────────────────────────────
const dimensions: Record<string, string> = {
  'server delivery-path': 'NOT_TESTED',
  'browser token registration': 'NOT_TESTED',
  'actual browser receipt': 'NOT_TESTED',
  'notification deep-link click': 'NOT_TESTED',
  'external/device prerequisite': 'NOT_TESTED',
};
function report() {
  console.log('');
  console.log('=== FCM REAL BROWSER RECEIPT — VERIFICATION DIMENSIONS ===');
  for (const [dimension, status] of Object.entries(dimensions)) {
    console.log(`  ${dimension}: ${status}`);
  }
  console.log('');
}
let browserRef: { close: () => Promise<unknown> } | null = null;

function blocked(reason: string): never {
  dimensions['actual browser receipt'] = 'BLOCKED_EXTERNAL';
  dimensions['external/device prerequisite'] = `BLOCKED_EXTERNAL — ${reason}`;
  console.log('');
  console.log('───────────────────────────────────────────────────────────');
  console.log('[fcm-real] BLOCKED_EXTERNAL');
  console.log(`[fcm-real] ${reason}`);
  console.log('[fcm-real] Reference: docs/deployment/FCM_REAL_BROWSER_RECEIPT.md');
  console.log('[fcm-real] No delivery, receipt or click behaviour is claimed.');
  console.log('───────────────────────────────────────────────────────────');
  report();
  if (browserRef) void browserRef.close().catch(() => undefined);
  process.exit(EXIT_BLOCKED_EXTERNAL);
}

// ─ Harness guard: this acceptance path never runs implicitly ────────────────
if (process.env.KURUKOO_FCM_BROWSER_E2E !== 'true') {
  console.log('[fcm-real] SKIPPED: set KURUKOO_FCM_BROWSER_E2E=true to run the real-browser receipt harness.');
  console.log('[fcm-real] The deterministic server-side CI test is: npm run test:fcm:ci');
  process.exit(EXIT_VERIFIED);
}

const REQUIRED_SERVER = ['KURUKOO_FCM_PROJECT_ID', 'KURUKOO_FCM_CLIENT_EMAIL', 'KURUKOO_FCM_PRIVATE_KEY', 'JWT_SECRET'] as const;
const REQUIRED_WEB = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
  'KURUKOO_FCM_VAPID_KEY',
] as const;

const missingServer = REQUIRED_SERVER.filter((name) => !String(process.env[name] || '').trim());
if (missingServer.length) {
  console.error(`[fcm-real] Missing FCM service-account configuration: ${missingServer.join(', ')}`);
  process.exit(EXIT_FAILED);
}
const missingWeb = REQUIRED_WEB.filter((name) => !String(process.env[name] || '').trim());
if (missingWeb.length) {
  console.error(`[fcm-real] Missing Firebase web configuration: ${missingWeb.join(', ')}`);
  console.error('[fcm-real] The browser cannot mint a real FCM token without these values.');
  process.exit(EXIT_FAILED);
}
console.log('[fcm-real] FCM service-account and Firebase web configuration present (values withheld).');

// ── Real test identity (canonical development-test auth path) ───────────────
const testPhone = String(process.env.KURUKOO_TEST_PHONE || '').trim();
if (!testPhone) {
  console.error('[fcm-real] KURUKOO_TEST_PHONE must be configured; the harness signs in a real test user.');
  process.exit(EXIT_FAILED);
}
const DEV_TEST_OTP = '111111';

// ── Server boot ─────────────────────────────────────────────────────────────
for (const suffix of ['', '-wal', '-shm']) {
  if (fs.existsSync(dbPath + suffix)) fs.rmSync(dbPath + suffix);
}
process.env.DB_PATH = dbPath;

const serverEnv: NodeJS.ProcessEnv = {
  ...process.env,
  PORT: String(PORT),
  NODE_ENV: 'development',
  KURUKOO_PUBLIC_BASE_URL: BASE,
  KURUKOO_DEV_AUTH: 'true',
  DB_PATH: dbPath,
  // Run the canonical background workers and shorten the reminder pass so the
  // harness can observe a real canonical notification within a bounded window.
  KURUKOO_REMINDER_INTERVAL_SEC: '30',
};
const server = spawn('npx', ['tsx', 'index.ts'], { cwd: root, env: serverEnv, stdio: ['ignore', 'pipe', 'pipe'] });
const serverLog: string[] = [];
server.stdout.on('data', (d) => serverLog.push(String(d)));
server.stderr.on('data', (d) => serverLog.push(String(d)));
let serverExited = false;
server.on('exit', () => { serverExited = true; });
const shutdown = () => { try { if (!serverExited) server.kill('SIGTERM'); } catch { /* already gone */ } };
process.on('exit', shutdown);

async function waitForServer(attempts = 120): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try { const r = await fetch(`${BASE}/api/auth/identity`); if (r.ok) return; } catch { /* not up yet */ }
    if (serverExited) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error(serverLog.join(''));
  throw new Error('[fcm-real] server did not become ready');
}

await waitForServer();
console.log(`[fcm-real] Server ready on ${BASE}`);

// Seed the canonical profile for the real test identity.
{
  const { getDb, saveDb } = await import('../src/database.js');
  const db = await getDb();
  await db.run(
    `INSERT INTO memory_profiles (phone, name, email, country, is_available) VALUES (?, ?, ?, 'ng', 1)`,
    [testPhone, 'Kurukoo Receipt Harness', 'receipt.harness@example.test'],
  );
  saveDb(true);
}

// ── Canonical Work object ───────────────────────────────────────────────────
// The Work object is a real reminder created later through the real
// authenticated Kurukoo API from the browser session, so the whole chain stays
// canonical: user action → canonical Work object → canonical worker →
// notification event → FCM delivery.
console.log('[fcm-real] The canonical Work object will be created through the real Kurukoo API in the browser session.');

// ── Real Chrome instance (no Push API faking at any point) ──────────────────
interface HarnessCdpSession { send(method: string, params?: Record<string, unknown>): Promise<unknown>; }
interface HarnessTarget { type(): string; url(): string; createCDPSession(): Promise<HarnessCdpSession>; }
interface HarnessPage {
  on(event: string, handler: (payload: unknown) => void): void;
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  evaluate<TIn, TOut>(fn: (input: TIn) => TOut, input: TIn): Promise<TOut>;
  evaluate<TOut>(fn: () => TOut): Promise<TOut>;
  waitForFunction<TIn>(fn: (input: TIn) => boolean, options: { timeout: number; polling?: number }, input: TIn): Promise<unknown>;
  url(): string;
  context(): { overridePermissions(origin: string, permissions: string[]): Promise<void>; clearPermissionOverrides(): Promise<void>; };
}
interface HarnessBrowser {
  newPage(): Promise<HarnessPage>;
  version(): Promise<string>;
  targets(): HarnessTarget[];
  close(): Promise<void>;
}
type PuppeteerModule = { launch: (options: Record<string, unknown>) => Promise<HarnessBrowser> };
let puppeteerModule: PuppeteerModule | null = null;
try {
  // puppeteer-core is the established browser driver in this workspace
  // (see scripts/conversation-test.cjs). No new dependency is introduced;
  // the real Chrome binary below supplies the browser.
  puppeteerModule = (await import('puppeteer-core')) as unknown as PuppeteerModule;
} catch {
  puppeteerModule = null;
}
if (!puppeteerModule) {
  blocked('puppeteer-core is not available in this workspace, so no real Chrome instance can be driven.');
}

const CHROME_CANDIDATES = [
  String(process.env.KURUKOO_CHROME_PATH || '').trim(),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
].filter(Boolean);
const chromePath = CHROME_CANDIDATES.find((candidate) => {
  try { return fs.existsSync(candidate); } catch { return false; }
}) || '';
if (!chromePath) {
  blocked('No real Chrome binary was found. Install Google Chrome or set KURUKOO_CHROME_PATH to a real Chrome/Chromium binary.');
}

// A persistent profile is what makes a real, user-granted notification
// permission survive between runs. Headless runs use a throwaway profile.
const effectiveProfile = HEADLESS && !option('profile')
  ? fs.mkdtempSync(path.join(os.tmpdir(), 'kurukoo-fcm-receipt-'))
  : profileDir;
fs.mkdirSync(effectiveProfile, { recursive: true });

console.log(`[fcm-real] Chrome binary: ${chromePath}`);
console.log(`[fcm-real] Chrome profile: ${effectiveProfile}`);
console.log(`[fcm-real] Headless: ${HEADLESS}`);

const browser = await puppeteerModule.launch({
  headless: HEADLESS,
  executablePath: chromePath,
  userDataDir: effectiveProfile,
  protocolTimeout: COMMAND_TIMEOUT_MS,
  args: [
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-features=Translate',
    // NOTICE: no push-related overrides are used. The Push API must work for
    // real; when it does not, this harness reports BLOCKED_EXTERNAL.
  ],
});
console.log(`[fcm-real] Browser version: ${await browser.version()}`);
browserRef = browser;

// ── Real browser flow ───────────────────────────────────────────────────────
const page = await browser.newPage();
page.on('console', (payload) => {
  const candidate = payload as { text?: () => string };
  const text = typeof candidate?.text === 'function' ? candidate.text() : '';
  if (text) console.log(`[browser] ${text}`);
});
page.on('pageerror', (payload) => {
  console.log(`[browser:error] ${String((payload as Error)?.message || payload)}`);
});

// 1. Real sign-in through the canonical auth boundary.
console.log('[fcm-real] Signing in the real test user through the canonical auth boundary…');
await page.goto(`${BASE}/chat`, { waitUntil: 'domcontentloaded' });
const auth = await page.evaluate(async (input: { base: string; phone: string; code: string }) => {
  const request = await fetch(`${input.base}/api/auth/request-otp`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone: input.phone }),
  });
  const requestBody = (await request.json()) as { testMode?: boolean };
  const verify = await fetch(`${input.base}/api/auth/verify-otp`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      phone: input.phone,
      code: input.code,
      deviceId: 'fcm-receipt-harness',
      credentialType: 'web',
      pushCapable: true,
    }),
  });
  const verifyBody = (await verify.json()) as { success?: boolean; message?: string };
  return {
    requestOk: request.ok,
    testMode: requestBody?.testMode === true,
    verifyOk: verify.ok,
    success: verifyBody?.success === true,
    message: String(verifyBody?.message || ''),
  };
}, { base: BASE, phone: testPhone, code: DEV_TEST_OTP });

assert.ok(auth.requestOk && auth.testMode, 'the development-test OTP boundary must be active for the harness identity');
assert.ok(auth.verifyOk && auth.success, `real test-user sign-in failed: ${auth.message}`);
console.log('[fcm-real] Real test user signed in (session cookie established by the browser itself).');

// 2. Open the real authenticated Kurukoo surface that owns the notification opt-in.
console.log('[fcm-real] Opening the real authenticated Kurukoo Work surface…');
await page.goto(`${BASE}/work`, { waitUntil: 'domcontentloaded' });
const surface = await page.evaluate(() => ({
  canonicalPath: document.body?.getAttribute('data-canonical-path') || '',
  appPage: document.body?.classList.contains('k-app-page') === true,
  fcmClient: typeof (window as unknown as { kurukooFcm?: unknown }).kurukooFcm === 'object',
  permission: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  secureContext: window.isSecureContext === true,
}));
assert.ok(surface.appPage, 'the harness must open the real authenticated Kurukoo app surface');
assert.ok(surface.fcmClient, 'the real Kurukoo FCM client must be present on the authenticated surface');
console.log(
  `[fcm-real] Surface ${surface.canonicalPath} loaded `
  + `(appPage=${surface.appPage}, fcmClient=${surface.fcmClient}, secureContext=${surface.secureContext})`,
);
if (!surface.secureContext) {
  blocked('The Push API requires a secure context; the harness origin is not secure for this browser.');
}
// 3. Notification permission — a real browser-level grant, never simulated state.
let permission = surface.permission;
if (permission !== 'granted') {
  console.log(`[fcm-real] Notification permission is "${permission}"; requesting a real browser grant…`);
  try { await page.context().overridePermissions(BASE, ['notifications']); } catch { /* a headed browser may refuse automation here */ }
  permission = await page.evaluate(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission));
}
if (permission !== 'granted' && HEADLESS) {
  blocked('Headless Chrome did not grant notification permission, so the Push API cannot create a real subscription.');
}
if (permission !== 'granted') {
  console.log('');
  console.log('  ─────────────────────────────────────────────────────────');
  console.log('  ACTION REQUIRED IN CHROME');
  console.log('  Approve the notification permission prompt, or click');
  console.log('  "Enable notifications" in the Kurukoo header.');
  console.log('  ─────────────────────────────────────────────────────────');
  console.log('');
  try {
    await page.waitForFunction(
      () => typeof Notification !== 'undefined' && Notification.permission === 'granted',
      { timeout: COMMAND_TIMEOUT_MS, polling: 1000 },
      undefined,
    );
    permission = 'granted';
  } catch {
    blocked('Notification permission was not granted within the timeout window.');
  }
}
console.log('[fcm-real] Notification permission: granted (real browser state).');

// 4. Ask the real production client to obtain a genuine FCM registration token.
//    No PushManager override, synthesis or interception is performed here.
console.log('[fcm-real] Invoking the real Kurukoo FCM client (window.kurukooFcm.registerIfPermitted)…');
const registration = await page.evaluate(async () => {
  const client = (window as unknown as {
    kurukooFcm?: {
      registerIfPermitted: () => Promise<{ status: string; reason?: string }>;
      getStatus: () => string;
    };
  }).kurukooFcm;
  if (!client) return { ok: false, status: 'client_missing', reason: '', error: 'window.kurukooFcm is unavailable' };
  try {
    const result = await client.registerIfPermitted();
    return {
      ok: result?.status === 'registered',
      status: String(result?.status || 'unknown'),
      reason: String(result?.reason || ''),
      error: '',
    };
  } catch (error) {
    return { ok: false, status: 'threw', reason: '', error: String((error as Error)?.message || error) };
  }
});
console.log(
  `[fcm-real] FCM client result: ${registration.status}`
  + `${registration.reason ? ` (${registration.reason})` : ''}`
  + `${registration.error ? ` — ${registration.error}` : ''}`,
);
if (!registration.ok) {
  const detail = `${registration.status} ${registration.reason} ${registration.error}`.toLowerCase();
  const pushRefused = ['permission denied', 'notallowed', 'registration failed', 'push service', 'pushmessaging']
    .some((marker) => detail.includes(marker));
  if (pushRefused) {
    blocked(
      'The browser refused the real Push API subscription, so no genuine FCM token exists. '
      + `Reported state: ${registration.status}${registration.error ? ` (${registration.error})` : ''}.`,
    );
  }
  console.error(`[fcm-real] FAILED: the real FCM client did not register a device token (${registration.status} ${registration.error}).`);
  report();
  process.exit(EXIT_FAILED);
}

// 5. Confirm the backend stored a real device token (server-side truth).
const devices = await page.evaluate(async (base: string) => {
  const response = await fetch(`${base}/api/fcm/devices`, { credentials: 'include' });
  const body = (await response.json()) as { success?: boolean; devices?: Array<{ deviceId?: string; platform?: string; active?: boolean }> };
  return { ok: response.ok, devices: Array.isArray(body?.devices) ? body.devices : [] };
}, BASE);
const activeDevices = devices.devices.filter((device) => device?.active !== false);
assert.ok(devices.ok && activeDevices.length > 0, 'the backend must report the real registered device');
dimensions['browser token registration'] = `VERIFIED — backend reports ${activeDevices.length} active device(s) for the real browser token`;
console.log(`[fcm-real] Backend registered devices: ${activeDevices.length} (server-side truth).`);

// Install the observe-only service-worker receipt observer BEFORE the push is
// sent. It records what the service worker received and then calls through to
// the REAL showNotification, so the notification is genuinely created. It never
// fabricates a push, a token or a receipt.
const OBSERVER = `(() => {
  if (self.__kurukooReceiptObserver) return 'already';
  self.__kurukooReceipts = [];
  const original = self.registration.showNotification.bind(self.registration);
  self.registration.showNotification = function (title, options) {
    try {
      self.__kurukooReceipts.push({
        title: String(title || ''),
        body: String((options && options.body) || ''),
        link: String((options && options.data && options.data.link) || ''),
        at: Date.now()
      });
    } catch (error) { /* observation must never break delivery */ }
    return original(title, options);
  };
  self.__kurukooReceiptObserver = true;
  return 'installed';
})()`;

async function serviceWorkerTarget(): Promise<HarnessTarget | null> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const target = browser.targets().find(
      (candidate) => candidate.type() === 'service_worker' && candidate.url().includes('firebase-messaging-sw.js'),
    );
    if (target) return target;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return null;
}

const swTarget = await serviceWorkerTarget();
if (!swTarget) {
  blocked('The Kurukoo service worker was not running, so a real push receipt cannot be observed.');
}
const swSession = await swTarget.createCDPSession();
await swSession.send('Runtime.enable');
const observerResult = await swSession.send('Runtime.evaluate', { expression: OBSERVER, returnByValue: true }) as { result?: { value?: unknown } };
console.log(`[fcm-real] Service-worker receipt observer: ${String(observerResult?.result?.value || 'unknown')} (observe-only, calls through).`);

// 6. Create the canonical Work object through the REAL authenticated Kurukoo API.
//    The reminder is due immediately, so the canonical background worker picks it
//    up and produces a real Kurukoo notification event.
console.log('[fcm-real] Creating a canonical Work item (due reminder) via POST /api/reminders…');
const reminder = await page.evaluate(async (base: string) => {
  const response = await fetch(`${base}/api/reminders`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'Kurukoo FCM receipt check',
      note: 'Created by the real-browser receipt harness to verify canonical delivery.',
      dueAt: new Date(Date.now() - 1000).toISOString(),
    }),
  });
  const body = (await response.json()) as { success?: boolean; reminder?: { id?: string; title?: string }; error?: string };
  return { ok: response.ok && body?.success === true, id: String(body?.reminder?.id || ''), error: String(body?.error || '') };
}, BASE);
assert.ok(reminder.ok && reminder.id, `the canonical Work item must be created through the real API: ${reminder.error}`);
const workDestination = `/reminders?objectType=reminder&objectId=${encodeURIComponent(reminder.id)}`;
console.log(`[fcm-real] Canonical Work item created: reminder ${reminder.id}`);
console.log(`[fcm-real] Expected notification destination: ${workDestination}`);
// 7. Wait for the REAL receipt: the canonical worker sends through Firebase
//    HTTP v1 and the service worker receives the push. Nothing here can create
//    a receipt on its own — the notification only appears if a real push arrives.
console.log('[fcm-real] Waiting for the canonical worker to deliver the notification (bounded window)…');
type ObservedNotification = { title: string; body: string; link: string; at: number };
type SwEvaluation = { result?: { value?: unknown } };

async function readWorkerReceipts(): Promise<ObservedNotification[]> {
  const raw = await swSession.send('Runtime.evaluate', {
    expression: 'JSON.stringify(self.__kurukooReceipts || [])',
    returnByValue: true,
  }) as SwEvaluation;
  const value = String(raw?.result?.value || '[]');
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as ObservedNotification[]) : [];
  } catch {
    return [];
  }
}

async function readDisplayedNotifications(): Promise<ObservedNotification[]> {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const notifications = await registration.getNotifications();
    return notifications.map((notification) => ({
      title: String(notification.title || ''),
      body: String(notification.body || ''),
      link: String((notification.data as { link?: string } | null)?.link || ''),
      at: Date.now(),
    }));
  });
}

const deadline = Date.now() + COMMAND_TIMEOUT_MS;
let receipt: ObservedNotification | null = null;
while (Date.now() < deadline && !receipt) {
  const observed = await readWorkerReceipts();
  const match = observed.find((candidate) => candidate.title.toLowerCase().includes('kurukoo reminder'));
  if (match) { receipt = match; break; }
  const displayed = await readDisplayedNotifications();
  const displayedMatch = displayed.find((candidate) => candidate.title.toLowerCase().includes('kurukoo reminder'));
  if (displayedMatch) { receipt = displayedMatch; break; }
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

if (!receipt) {
  console.error('[fcm-real] FAILED: no real push receipt was observed in the service worker within the window.');
  console.error('[fcm-real] The server-side send path is covered by the deterministic CI test; this failure means');
  console.error('[fcm-real] the real browser did not receive the push (delivery, token or worker issue).');
  dimensions['actual browser receipt'] = 'NOT_VERIFIED — no service-worker receipt observed';
  report();
  process.exit(EXIT_FAILED);
}
dimensions['actual browser receipt'] = `VERIFIED — service worker received a real push and created the notification ("${receipt.title}")`;
dimensions['server delivery-path'] = 'VERIFIED — canonical worker produced the notification and Firebase accepted the send for a real token';
console.log(`[fcm-real] REAL RECEIPT OBSERVED: ${JSON.stringify(receipt)}`);

// 8. Deep-link: the notification must carry the canonical Work destination.
const receiptLink = String(receipt.link || '');
assert.ok(receiptLink.length > 1, 'the received notification must carry a canonical destination link');
assert.ok(
  receiptLink.includes(`objectId=${encodeURIComponent(reminder.id)}`),
  `the received notification must target the created Work item (expected objectId=${reminder.id}, got ${receiptLink})`,
);
console.log(`[fcm-real] Notification carries the canonical destination: ${receiptLink}`);

// 9. Invoke the REAL production notificationclick handler with the notification
//    payload that was actually received, and verify the click returns the user
//    to the canonical Kurukoo Work destination.
const clickDispatch = await swSession.send('Runtime.evaluate', {
  expression: `(async () => {
    const link = ${JSON.stringify(receiptLink)};
    const event = new Event('notificationclick');
    event.notification = { close() {}, data: { link } };
    event.waitUntil = (promise) => { self.__kurukooClickPromise = promise; };
    self.dispatchEvent(event);
    try { await self.__kurukooClickPromise; } catch (error) {}
    return true;
  })()`,
  awaitPromise: true,
  returnByValue: true,
}) as SwEvaluation;
assert.equal(clickDispatch?.result?.value, true, 'the production notificationclick handler must run');

const expectedUrl = new URL(receiptLink, BASE);
let landed = { pathname: '', search: '' };
for (let attempt = 0; attempt < 30; attempt++) {
  landed = await page.evaluate(() => ({ pathname: window.location.pathname, search: window.location.search }));
  if (landed.pathname === expectedUrl.pathname) break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}
assert.equal(landed.pathname, expectedUrl.pathname, `notification click must land on ${expectedUrl.pathname}, landed on ${landed.pathname}`);
assert.ok(
  landed.search.includes(encodeURIComponent(reminder.id)),
  `notification click must preserve the Work item context (expected objectId=${reminder.id}, got ${landed.search})`,
);
console.log(`[fcm-real] Notification click landed on ${landed.pathname}${landed.search}`);
dimensions['notification deep-link click'] = `VERIFIED — production click handler returned the browser to ${landed.pathname}${landed.search}`;
dimensions['external/device prerequisite'] = 'VERIFIED — real Chrome with a genuine Push API subscription and granted notification permission';
report();

console.log('=== FCM REAL BROWSER RECEIPT: VERIFIED ===');
console.log('Chain verified: Kurukoo login → canonical Work item → canonical worker notification event');
console.log('  → real FCM token registration → Firebase HTTP v1 send → real service-worker receipt');
console.log(`  → notification click → ${landed.pathname}${landed.search}`);
if (KEEP_OPEN) {
  console.log('[fcm-real] --keep-open set; leaving the browser open. Press Ctrl+C to finish.');
  await new Promise(() => undefined);
}
await browser.close().catch(() => undefined);
browserRef = null;
shutdown();
process.exit(EXIT_VERIFIED);
