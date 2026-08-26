import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const baseUrl = String(process.env.KURUKOO_E2E_BASE_URL || '').replace(/\/$/, '');
if (!baseUrl) throw new Error('KURUKOO_E2E_BASE_URL is required');
const viewports = String(process.env.KURUKOO_E2E_VIEWPORTS || '1440x900,1280x800').split(',').map((value) => { const [width, height] = value.trim().split('x').map(Number); if (!width || !height) throw new Error(`Invalid viewport ${value}`); return { width, height }; });
const headed = process.env.KURUKOO_E2E_HEADED === 'true';
const useLocalAuth = process.env.KURUKOO_E2E_LOCAL_AUTH === 'true';
const testPhone = String(process.env.KURUKOO_TEST_PHONE || '08030000000');
const authCookieInput = String(process.env.KURUKOO_E2E_AUTH_COOKIE || '').trim();
const adminTokenInput = String(process.env.KURUKOO_E2E_ADMIN_TOKEN || '').trim();
const outputDir = path.resolve(process.env.KURUKOO_E2E_OUTPUT || 'artifacts/desktop-walkthrough');
const failOnConsole = process.env.KURUKOO_E2E_FAIL_CONSOLE !== 'false';

const publicRoutes = ['/', '/explore', '/discover', '/network', '/topics', '/channels', '/about', '/help', '/how-it-works', '/resources', '/pricing', '/contact', '/partners', '/advertise', '/blog', '/careers', '/legal', '/api-docs', '/chat'];
const appRoutes = ['/desk', '/chat', '/discover', '/topics', '/requests', '/reminders', '/saved', '/cart', '/tasks', '/connect', '/agents', '/capabilities', '/opportunities', '/wallet', '/points', '/top-up', '/subscriptions', '/checkout', '/confirmations', '/memory', '/artifacts', '/prayer', '/call', '/notifications', '/safety'];
const adminRoutes = ['/admin/', '/admin/?section=conversations', '/admin/?section=providers', '/admin/?section=economic', '/admin/?section=moderation', '/admin/?section=compliance', '/admin/?section=notifications', '/admin/?section=connectors', '/admin/?section=settings', '/admin/?section=seo', '/admin/ai-agents.html', '/admin/users.html', '/admin/pricing.html', '/admin/referrals.html', '/admin/commissions.html', '/admin/partnerships.html', '/admin/scam.html', '/admin/social.html', '/admin/artists.html', '/admin/celebrity.html', '/admin/analytics.html', '/admin/revenue.html', '/admin/marketing.html', '/admin/ads.html', '/admin/content.html', '/admin/curation.html', '/admin/future.html'];
const routeChecks = {
  '/desk': ['a[href="/chat"]'], '/cart': ['a[href*="/checkout"]'],
  '/checkout': ['a[href*="/confirmations"], a[href="/chat"]'],
  '/confirmations': ['a[href="/chat"], a[href="/requests"]'],
  '/requests': ['a[href="/chat"]'], '/tasks': ['a[href="/chat"]'],
  '/connect': ['a[href="/chat"]'], '/memory': ['a[href="/chat"]'],
  '/notifications': ['a[href="/chat"]'], '/safety': ['a[href="/chat"]'],
};

async function localAuth() {
  if (!useLocalAuth) return { authCookie: authCookieInput, adminToken: adminTokenInput };
  const headers = { 'content-type': 'application/json' };
  const otpRequest = await fetch(`${baseUrl}/api/auth/request-otp`, { method: 'POST', headers, body: JSON.stringify({ phone: testPhone }) });
  if (!otpRequest.ok) throw new Error(`Local user OTP request failed: HTTP ${otpRequest.status}`);
  const otp = await otpRequest.json();
  if (otp.testMode !== true || !otp.devCode) throw new Error('Local user OTP test mode is unavailable');
  const verify = await fetch(`${baseUrl}/api/auth/verify-otp`, { method: 'POST', headers, body: JSON.stringify({ phone: testPhone, code: otp.devCode, name: 'Desktop Test User' }) });
  if (!verify.ok) throw new Error(`Local user OTP verification failed: HTTP ${verify.status}`);
  const authCookie = String(verify.headers.get('set-cookie') || '').split(';')[0];
  if (!authCookie.startsWith('kurukoo_auth=')) throw new Error('Local user auth cookie was not returned');
  const adminLogin = await fetch(`${baseUrl}/api/admin/auth`, { method: 'POST', headers, body: JSON.stringify({ username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD || 'admin-password-for-test' }) });
  if (!adminLogin.ok) throw new Error(`Local admin login failed: HTTP ${adminLogin.status}`);
  const admin = await adminLogin.json();
  if (!admin.token) throw new Error('Local admin token was not returned');
  return { authCookie, adminToken: String(admin.token) };
}

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });
const credentials = await localAuth();
const results = [];

async function walkViewport(viewport, kind, route, index, context) {
  const page = await context.newPage();
  const consoleErrors = []; const requestFailures = []; const httpErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('requestfailed', (request) => requestFailures.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText || 'request failed'}`));
  page.on('response', (response) => { if (response.status() >= 500) httpErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`); });
  let status = 0; let finalUrl = ''; let title = ''; let layout = {}; let error = null;
  try {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 45000 });
    status = response?.status() || 0; finalUrl = page.url(); title = await page.title();
    layout = await page.evaluate(() => {
      const body = document.body; const root = document.documentElement;
      const shellSelectors = ['.k-app-sidebar', '.k-app-header', '.k-mobile-tabbar', '.kurukoo-admin-convergence-bar'];
      const shellCounts = Object.fromEntries(shellSelectors.map((selector) => [selector, document.querySelectorAll(selector).length]));
      return { bodyScrollWidth: body?.scrollWidth || 0, viewportWidth: window.innerWidth, horizontalOverflow: (body?.scrollWidth || 0) > window.innerWidth + 2, rootHeight: root?.scrollHeight || 0, shellCounts, hasAppShell: Boolean(document.querySelector('.k-app-page, .workspace-page')), hasAdminShell: Boolean(document.querySelector('.kurukoo-admin-convergence-bar')), visibleErrorText: /internal server error|application error|cannot get|not found/i.test(body?.innerText || ''), expectedActionSelectors: [], appSection: body?.className.match(/k-app-section-([a-z0-9-]+)/)?.[1] || null };
    });
    for (const selector of routeChecks[route] || []) layout.expectedActionSelectors.push({ selector, pass: await page.locator(selector).first().isVisible().catch(() => false) });
    const safeRoute = route.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'root';
    await page.screenshot({ path: path.join(outputDir, `${String(index).padStart(3, '0')}-${kind}-${safeRoute}-${viewport.width}x${viewport.height}.png`), fullPage: true });
  } catch (caught) { error = caught instanceof Error ? caught.message : String(caught); }
  const protectedRoute = kind !== 'public';
  const unauthenticatedRedirect = protectedRoute && /\/login(?:\/|\?|$)/.test(finalUrl);
  const duplicateAdminShell = kind === 'admin' && layout.shellCounts?.['.kurukoo-admin-convergence-bar'] !== 1;
  const missingAppShell = kind === 'app' && layout.hasAppShell !== true;
  const leakedAdminShell = kind !== 'admin' && layout.hasAdminShell === true;
  const missingExpectedAction = Array.isArray(layout.expectedActionSelectors) && layout.expectedActionSelectors.some((check) => !check.pass);
  const hardFailure = Boolean(error) || status >= 500 || layout.visibleErrorText || layout.horizontalOverflow || unauthenticatedRedirect || duplicateAdminShell || missingAppShell || leakedAdminShell || missingExpectedAction || (failOnConsole && consoleErrors.length > 0);
  results.push({ kind, route, viewport, status, finalUrl, title, consoleErrors, requestFailures, httpErrors, layout, error, pass: !hardFailure, failureReasons: [ ...(error ? [`navigation: ${error}`] : []), ...(status >= 500 ? [`HTTP ${status}`] : []), ...(layout.visibleErrorText ? ['visible application/server error text'] : []), ...(layout.horizontalOverflow ? ['horizontal overflow'] : []), ...(unauthenticatedRedirect ? ['protected route redirected to login'] : []), ...(duplicateAdminShell ? ['Admin shell not exactly once'] : []), ...(missingAppShell ? ['authenticated app shell missing'] : []), ...(leakedAdminShell ? ['Admin shell leaked into non-Admin surface'] : []), ...(missingExpectedAction ? ['expected action/recovery link missing'] : []), ...(failOnConsole && consoleErrors.length ? ['browser console error'] : []) ] });
  await page.close();
}

let index = 0;
for (const viewport of viewports) {
  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce' });
  if (credentials.authCookie) await context.addCookies(credentials.authCookie.split(';').map((part) => part.trim()).filter(Boolean).map((part) => { const i = part.indexOf('='); return i > 0 ? { name: part.slice(0, i), value: part.slice(i + 1), url: `${baseUrl}/` } : null; }).filter(Boolean));
  if (credentials.adminToken) await context.addInitScript((token) => localStorage.setItem('kurukoo_admin', token), credentials.adminToken);
  for (const route of publicRoutes) await walkViewport(viewport, 'public', route, index++, context);
  for (const route of appRoutes) await walkViewport(viewport, 'app', route, index++, context);
  for (const route of adminRoutes) await walkViewport(viewport, 'admin', route, index++, context);
  await browser.close();
}

const failed = results.filter((result) => !result.pass);
await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify({ baseUrl, viewports, localAuth, generatedAt: new Date().toISOString(), results, summary: { total: results.length, passed: results.length - failed.length, failed: failed.length } }, null, 2));
console.log(JSON.stringify({ baseUrl, viewports, total: results.length, passed: results.length - failed.length, failed: failed.length, failures: failed.map((result) => ({ kind: result.kind, route: result.route, viewport: result.viewport, reasons: result.failureReasons })) }, null, 2));
if (failed.length) process.exit(1);
