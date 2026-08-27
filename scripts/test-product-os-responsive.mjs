import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const baseUrl = String(process.env.KURUKOO_E2E_BASE_URL || '').replace(/\/$/, '');
if (!baseUrl) throw new Error('KURUKOO_E2E_BASE_URL is required');
if (process.env.KURUKOO_E2E_LOCAL_AUTH !== 'true') throw new Error('KURUKOO_E2E_LOCAL_AUTH=true is required for this controlled local browser contract');

const chromiumPath = process.env.KURUKOO_CHROMIUM_PATH || '/usr/bin/chromium';
const debuggingPort = Number(process.env.KURUKOO_CDP_PORT || 9228);
const phone = String(process.env.KURUKOO_TEST_PHONE || '08030000000');
const outputDir = path.resolve(process.env.KURUKOO_E2E_OUTPUT || 'artifacts/product-os-responsive');
const viewports = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'laptop', width: 1280, height: 800, mobile: false },
  { name: 'tablet', width: 900, height: 1080, mobile: true },
  { name: 'mobile', width: 390, height: 844, mobile: true },
];
const routes = [
  { path: '/desk', required: ['Kurukoo Brief', 'What needs you now', 'Recent outcomes'], selector: '[data-desk-convergence]' },
  { path: '/chat', required: ['Coordinate what matters', 'History'], selector: '#message-input', focusedAgent: true },
  { path: '/requests', required: ['Requests Kurukoo is moving forward', 'Needs you'], selector: '[data-requests-list]' },
  { path: '/tasks', required: ['Small steps that move work forward', 'Ready to do'], selector: '[data-tasks-list]' },
  { path: '/notifications', required: ['Changes and decisions that matter'], selector: '[data-notifications-root]' },
  { path: '/connect', required: ['People and connections'], selector: '[data-connect-resource-grid]' },
  { path: '/memory', required: ['What Kurukoo remembers'], selector: '[data-memory-root]' },
  { path: '/discover', required: ['See what might help today.'], selector: '.discover-os-header' },
  { path: '/agents', required: ['What Kurukoo is keeping moving'], selector: '.k-app-container' },
  { path: '/settings', required: ['Settings that keep Kurukoo working your way', 'Subscription and plan', 'Memory and privacy'], selector: '#k-settings-hub' },
  { path: '/wallet', required: ['Economic balances and payment evidence', 'Plan and billing'], selector: '.k-app-container' },
  { path: '/reminders', required: ['Create and review scheduled help', 'Pause, resume or cancel without losing context'], selector: '.k-app-container' },
  { path: '/safety', required: ['Safety context, trusted contacts and check-ins'], selector: '.k-app-container' },
  { path: '/call', required: ['Call a confirmed participant', 'Call safety and readiness', 'Start call'], selector: '.k-call-workspace' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const api = async (pathname, options = {}) => {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${pathname} returned HTTP ${response.status}: ${payload.error || 'unknown error'}`);
  return { response, payload };
};

async function waitForCdp() {
  let lastError = null;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debuggingPort}/json/version`);
      if (response.ok) return response.json();
    } catch (error) { lastError = error; }
    await sleep(100);
  }
  throw new Error(`Chromium DevTools endpoint did not become ready: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${message.error.message} (${message.error.code})`));
      else pending.resolve(message.result || {});
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() { this.socket.close(); }
}

async function connectTarget() {
  const targets = await (await fetch(`http://127.0.0.1:${debuggingPort}/json/list`)).json();
  const target = targets.find((item) => item.type === 'page');
  if (!target?.webSocketDebuggerUrl) throw new Error('No Chromium page target was available');
  const cdp = new CdpClient(target.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send('Page.enable');
  await cdp.send('Network.enable');
  await cdp.send('Runtime.enable');
  return cdp;
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Browser evaluation failed');
  return result.result?.value;
}

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });
const profileDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kurukoo-product-os-cdp-'));
const chrome = spawn(chromiumPath, [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
  `--remote-debugging-port=${debuggingPort}`, `--user-data-dir=${profileDir}`, 'about:blank',
], { stdio: 'ignore' });

try {
  const { payload: otp } = await api('/api/auth/request-otp', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone }),
  });
  assert.equal(otp.testMode, true, 'Responsive contract must only use controlled development auth');
  assert.equal(typeof otp.devCode, 'string');
  const { response: verifyResponse, payload: verify } = await api('/api/auth/verify-otp', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, code: otp.devCode, name: 'Product OS Test User' }),
  });
  assert.equal(verify.testMode, true, 'Controlled local identity must remain test-only');
  const cookie = String(verifyResponse.headers.get('set-cookie') || '').split(';')[0];
  if (!cookie.startsWith('kurukoo_auth=')) throw new Error('Controlled local auth did not issue the expected browser cookie');
  const cookieIndex = cookie.indexOf('=');
  const cookieName = cookie.slice(0, cookieIndex);
  const cookieValue = cookie.slice(cookieIndex + 1);

  await waitForCdp();
  const cdp = await connectTarget();
  const results = [];
  try {
    await cdp.send('Network.setCookie', { name: cookieName, value: cookieValue, url: `${baseUrl}/`, httpOnly: true });
    for (const viewport of viewports) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.mobile, screenWidth: viewport.width, screenHeight: viewport.height });
      for (const route of routes) {
        const navigation = await cdp.send('Page.navigate', { url: `${baseUrl}${route.path}` });
        if (navigation.errorText) throw new Error(`${route.path}: ${navigation.errorText}`);
        await sleep(1100);
        const evaluation = await evaluate(cdp, `(() => JSON.stringify({
          url: location.pathname,
          text: document.body.innerText,
          domText: document.body.textContent || '',
          hasShell: Boolean(document.querySelector('.k-app-shell, .chat-shell')),
          selectorVisible: (() => { const node = document.querySelector(${JSON.stringify(route.selector)}); if (!node) return false; const style = getComputedStyle(node); const rect = node.getBoundingClientRect(); return style.display !== 'none' && style.visibility !== 'hidden' && rect.width >= 0 && rect.height >= 0; })(),
          scrollWidth: document.documentElement.scrollWidth,
          viewportWidth: innerWidth,
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2,
          visibleError: /internal server error|application error|unable to render/i.test(document.body.innerText),
          focusedAgent: ${route.focusedAgent ? `(() => { const input = document.querySelector('#message-input'); const inspector = document.querySelector('#chat-inspector'); return Boolean(input) && !document.querySelector('#quick-actions, #composer-quick-actions') && Boolean(inspector?.hidden) && Boolean(document.querySelector('#header-account.k-reference-account-menu')); })()` : 'true'},
          referenceShell: Boolean(document.querySelector('.k-reference-shell, .k-reference-app-header, .k-reference-sidebar')),
          globalToolsPresent: ['k-reference-header-search','header-nearby-radar','header-points','header-cart','header-account'].every((id) => Boolean(document.getElementById(id))) && !document.getElementById('header-call') && Boolean(document.querySelector('.k-ask-kurukoo-launcher')),
          agentCreationScoped: (location.pathname === '/chat' || location.pathname === '/chat/') ? Boolean(document.querySelector('#new-chat.k-reference-new-conversation')) : !document.querySelector('#new-chat'),
          desktopPaneModel: innerWidth > 1024 ? Boolean(document.querySelector('.k-reference-sidebar')) && ((location.pathname === '/chat' || location.pathname === '/chat/') ? Boolean(document.querySelector('.chat-inspector')) : Boolean(document.querySelector('.k-reference-context-rail'))) : true,
          tabletDrawerModel: innerWidth > 767 && innerWidth <= 1024 ? Boolean(document.querySelector('#open-sidebar')) && Boolean(document.querySelector('.k-reference-sidebar')) : true,
          mobileMoreModel: innerWidth <= 767 ? Boolean(document.querySelector('#k-reference-mobile-more')) && Boolean(document.querySelector('#k-reference-mobile-more-sheet')) : true,
          mobileMoreInteraction: innerWidth <= 767 ? (() => { const button = document.querySelector('#k-reference-mobile-more'); const sheet = document.querySelector('#k-reference-mobile-more-sheet'); const close = document.querySelector('#k-reference-mobile-more-close'); if (!button || !sheet || !close) return false; button.click(); const opened = !sheet.hidden && button.getAttribute('aria-expanded') === 'true'; close.click(); return opened && sheet.hidden && button.getAttribute('aria-expanded') === 'false'; })() : true
        }))()`);
        const layout = JSON.parse(evaluation);
        const textChecks = [
          ...route.required.map((expected) => ({ expected, pass: layout.text.toLowerCase().includes(expected.toLowerCase()) })),
          ...(route.domRequired || []).map((expected) => ({ expected: `${expected} (inspector)`, pass: layout.domText.toLowerCase().includes(expected.toLowerCase()) })),
        ];
        const pass = layout.url === route.path.replace(/\/$/, '') || layout.url === `${route.path.replace(/\/$/, '')}/`;
        const finalPass = pass && layout.hasShell && layout.referenceShell && layout.globalToolsPresent && layout.agentCreationScoped && layout.desktopPaneModel && layout.tabletDrawerModel && layout.mobileMoreModel && layout.mobileMoreInteraction && layout.selectorVisible && layout.focusedAgent && !layout.horizontalOverflow && !layout.visibleError && textChecks.every((check) => check.pass);
        const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
        const safeRoute = route.path.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root';
        await fs.writeFile(path.join(outputDir, `${viewport.name}-${safeRoute}.png`), Buffer.from(screenshot.data, 'base64'));
        results.push({ viewport: viewport.name, route: route.path, layout, textChecks, pass: finalPass });
      }
    }
  } finally {
    cdp.close();
  }
  const failed = results.filter((result) => !result.pass);
  await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify({ baseUrl, generatedAt: new Date().toISOString(), results, summary: { total: results.length, passed: results.length - failed.length, failed: failed.length } }, null, 2));
  console.log(JSON.stringify({ summary: { total: results.length, passed: results.length - failed.length, failed: failed.length }, failures: failed.map((result) => ({ viewport: result.viewport, route: result.route, overflow: result.layout.horizontalOverflow, selectorVisible: result.layout.selectorVisible, referenceShell: result.layout.referenceShell, globalToolsPresent: result.layout.globalToolsPresent, agentCreationScoped: result.layout.agentCreationScoped, desktopPaneModel: result.layout.desktopPaneModel, tabletDrawerModel: result.layout.tabletDrawerModel, mobileMoreModel: result.layout.mobileMoreModel, mobileMoreInteraction: result.layout.mobileMoreInteraction, focusedAgent: result.layout.focusedAgent, missingText: result.textChecks.filter((check) => !check.pass).map((check) => check.expected) })) }, null, 2));
  if (failed.length) process.exitCode = 1;
} finally {
  if (!chrome.killed) chrome.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => chrome.once('exit', resolve)), sleep(2000)]);
  await fs.rm(profileDir, { recursive: true, force: true, maxRetries: 4, retryDelay: 250 });
}
