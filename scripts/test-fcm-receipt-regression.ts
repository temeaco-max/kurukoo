/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
/**
 * Regression test: the real browser receipt acceptance path must never be able
 * to report a fabricated push as if it were real delivery.
 *
 * It proves, from source AND from observed behaviour, that:
 *   1. scripts/test-fcm-browser-receipt-real.ts performs no PushManager
 *      override / synthesis / interception of any kind.
 *   2. The real-receipt harness cannot be triggered implicitly and cannot be
 *      mistaken for the deterministic CI path.
 *   3. The real-receipt harness exits without any verification claim when its
 *      external prerequisites are not met.
 *   4. The deterministic CI test is server-side only and claims no browser receipt.
 *   5. The canonical service worker registers click routing before importing FCM
 *      (so FCM cannot replace Kurukoo's canonical destination) and contains no
 *      fabricated push behaviour.
 *   6. The developer diagnostic page is explicitly diagnostic-only.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
/** Strip comments so documented prohibitions cannot be mistaken for code. */
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const harnessPath = 'scripts/test-fcm-browser-receipt-real.ts';
const ciPath = 'scripts/test-fcm-path-e2e.ts';
const workerPath = 'frontend/public/firebase-messaging-sw.js';
const diagnosticPath = 'frontend/public/fcm-browser-test.html';

// ── 1. No Push API faking in the real-receipt acceptance path ───────────────
const harness = read(harnessPath);
const harnessCode = code(harness);
const forbiddenCode = [
  'PushManager',
  'originalSubscribe',
  'evaluateOnNewDocument',
  '__fcmPushBlocked',
  'fcm.googleapis.com/fcm/send/',
  'synthesi',
  "'push'",
];
for (const token of forbiddenCode) {
  assert.ok(
    !harnessCode.includes(token),
    `${harnessPath} must not use "${token}" — the real receipt path may never fake, synthesise or intercept the Push API`,
  );
}
assert.match(
  harnessCode,
  /overridePermissions\([^)]*\[[^\]]*'notifications'[^\]]*\]/,
  'the only browser permission the harness may set is notification permission',
);
assert.ok(harness.includes('KURUKOO_FCM_BROWSER_E2E'), 'the real-receipt harness must require an explicit opt-in guard');
assert.ok(harness.includes('EXIT_BLOCKED_EXTERNAL'), 'blocked prerequisites must use a distinct exit code, never a pass');
assert.ok(
  harness.includes("dimensions['actual browser receipt']"),
  'the harness must report the browser receipt dimension separately from server delivery',
);
assert.ok(
  /if \(!receipt\)[\s\S]*?process\.exit\(EXIT_FAILED\)/.test(harness),
  'the harness must fail (not pass) when no real receipt is observed',
);
assert.ok(
  harness.indexOf("dimensions['actual browser receipt'] = `VERIFIED") > harness.indexOf('if (!receipt)'),
  'the receipt VERIFIED claim must only be reachable after a real receipt was observed',
);
// ── 2. Behaviour: without the guard the harness skips and claims nothing ─────
const childEnv: NodeJS.ProcessEnv = { ...process.env };
delete childEnv.KURUKOO_FCM_BROWSER_E2E;
const unguarded = spawnSync('npx', ['tsx', harnessPath], { cwd: root, env: childEnv, encoding: 'utf8', timeout: 180000 });
assert.equal(unguarded.status, 0, `an unguarded run must exit 0 (skip), got ${unguarded.status}`);
assert.match(String(unguarded.stdout), /SKIPPED/, 'an unguarded run must report SKIPPED');
assert.ok(!/VERIFIED/.test(String(unguarded.stdout)), 'an unguarded run must never emit a verification claim');

// ── 3. Behaviour: with the guard but unmet prerequisites, no claim is made ───
const guardedEnv: NodeJS.ProcessEnv = {
  ...process.env,
  KURUKOO_FCM_BROWSER_E2E: 'true',
  FIREBASE_API_KEY: '',
  FIREBASE_APP_ID: '',
};
const unmet = spawnSync('npx', ['tsx', harnessPath], { cwd: root, env: guardedEnv, encoding: 'utf8', timeout: 180000 });
assert.notEqual(unmet.status, 0, 'an unmet-prerequisite run must not exit 0');
assert.match(
  `${unmet.stdout}${unmet.stderr}`,
  /Missing Firebase web configuration|Missing FCM service-account/,
  'the harness must name the missing prerequisite',
);
assert.ok(
  !/actual browser receipt: VERIFIED/.test(`${unmet.stdout}${unmet.stderr}`),
  'an unmet-prerequisite run must never claim a verified browser receipt',
);

// ── 4. The deterministic CI test stays server-side only ─────────────────────
const ci = read(ciPath);
const ciLower = ci.toLowerCase();
for (const token of ['puppeteer', 'pushmanager', 'chrome', 'serviceworker']) {
  assert.ok(!ciLower.includes(token), `${ciPath} must remain server-side only (found "${token}")`);
}
assert.match(ci, /test-fcm-browser-receipt-real\.ts/, 'the CI test must point at the real-browser harness for receipt');
assert.match(ci, /server delivery-path VERIFIED/, 'the CI test must state the verification dimension it covers');

// ─ 5. Canonical service worker: click routing registered before FCM import ─
const worker = read(workerPath);
const clickIndex = worker.indexOf("addEventListener('notificationclick'");
const importIndex = worker.indexOf('importScripts(');
assert.ok(clickIndex >= 0, 'the canonical worker must own notification click routing');
assert.ok(importIndex >= 0, 'the canonical worker must load the FCM libraries');
assert.ok(
  clickIndex < importIndex,
  'notificationclick must be registered before importing FCM so FCM cannot replace canonical destination routing',
);
assert.match(worker, /DEFAULT_DESTINATION/, 'the worker must fall back to a canonical destination rather than inventing one');
assert.ok(!/mock|fake|synthes/i.test(code(worker)), 'the canonical worker must not contain fabricated push behaviour');

// ─ 6. Developer diagnostic page is diagnostic-only ─────────────────────────
const diagnostic = read(diagnosticPath);
assert.match(diagnostic, /DIAGNOSTIC ONLY/i, 'the browser test page must be labelled diagnostic-only');
assert.match(diagnostic, /does not prove/i, 'the diagnostic page must state that it does not prove delivery');

console.log('test-fcm-receipt-regression: PASS');
