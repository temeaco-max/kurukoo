import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const baseUrl = String(process.env.KURUKOO_E2E_BASE_URL || '').replace(/\/$/, '');
if (!baseUrl) throw new Error('KURUKOO_E2E_BASE_URL is required');
const testPhone = String(process.env.KURUKOO_TEST_PHONE || '08030000000');
const useLocalAuth = process.env.KURUKOO_E2E_LOCAL_AUTH === 'true';
const outputDir = path.resolve(process.env.KURUKOO_E2E_OUTPUT || 'artifacts/runtime-os-proof');
const viewports = String(process.env.KURUKOO_E2E_VIEWPORTS || '1440x900,390x844').split(',').map((value) => {
  const [width, height] = value.trim().split('x').map(Number);
  if (!width || !height) throw new Error(`Invalid viewport ${value}`);
  return { width, height, mobile: width <= 600 };
});

const screens = [
  { id: 'desk', label: 'Desk', route: '/desk' },
  { id: 'chat', label: 'Chat', route: '/chat' },
  { id: 'requests', label: 'Requests', route: '/requests' },
  { id: 'tasks', label: 'Tasks', route: '/tasks' },
  { id: 'notifications', label: 'Notifications', route: '/notifications' },
  { id: 'contacts', label: 'Contacts (Safety)', route: '/safety', note: 'No standalone /contacts page exists; contacts are canonically owned by Safety.' },
  { id: 'memory', label: 'Memory', route: '/memory' },
  { id: 'agent', label: 'Agent', route: '/agents' },
  { id: 'discover', label: 'Discover', route: '/discover' },
];

const expectedPresenceStates = ['idle', 'listening', 'thinking', 'speaking', 'working', 'waiting', 'needs-attention'];
const semanticStates = ['pending', 'working', 'listening', 'waiting', 'completed', 'blocked', 'needs-attention', 'unavailable', 'offline', 'approval-required', 'success', 'verified'];

async function authenticate() {
  if (!useLocalAuth) return;
  const headers = { 'content-type': 'application/json' };
  const otpRequest = await fetch(`${baseUrl}/api/auth/request-otp`, { method: 'POST', headers, body: JSON.stringify({ phone: testPhone }) });
  if (!otpRequest.ok) throw new Error(`OTP request failed: HTTP ${otpRequest.status}`);
  const otp = await otpRequest.json();
  if (otp.testMode !== true || !otp.devCode) throw new Error('Local OTP test mode unavailable');
  const verify = await fetch(`${baseUrl}/api/auth/verify-otp`, { method: 'POST', headers, body: JSON.stringify({ phone: testPhone, code: otp.devCode, name: 'Runtime Visual Proof' }) });
  if (!verify.ok) throw new Error(`OTP verification failed: HTTP ${verify.status}`);
  const cookie = String(verify.headers.get('set-cookie') || '').split(';')[0];
  if (!cookie.startsWith('kurukoo_auth=')) throw new Error('Auth cookie missing');
  return cookie;
}

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });
const authCookie = await authenticate();
const results = [];
const presenceEvidence = [];

async function inspectScreen(page, screen, viewport, index) {
  const routeResult = { screen: screen.label, route: screen.route, viewport, issues: [], semanticStatesObserved: [], communication: [], composer: null, accessibility: null, presence: null, finalUrl: '', status: 0, screenshot: null, pass: false, note: screen.note || null };
  const consoleErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('response', (response) => { if (response.status() >= 500) routeResult.issues.push(`HTTP ${response.status()} ${response.url()}`); });
  page.on('requestfailed', (request) => routeResult.issues.push(`Request failed: ${request.method()} ${request.url()}`));

  try {
    const response = await page.goto(`${baseUrl}${screen.route}`, { waitUntil: 'networkidle', timeout: 45000 });
    routeResult.status = response?.status() || 0;
    routeResult.finalUrl = page.url();
    if (routeResult.status >= 500) routeResult.issues.push(`HTTP ${routeResult.status}`);
    if (/\/login(?:\/|\?|$)/.test(routeResult.finalUrl)) routeResult.issues.push('Authenticated screen redirected to login');

    const rawStateAttrs = await page.evaluate(() => Array.from(document.querySelectorAll('[data-state],[data-agent-presence]')).flatMap((node) => [node.getAttribute('data-state'), node.getAttribute('data-agent-presence')]).filter(Boolean));
    routeResult.semanticStatesObserved = [...new Set(rawStateAttrs)].filter((state) => semanticStates.includes(state));

    const layout = await page.evaluate(() => {
      const body = document.body;
      const viewportWidth = window.innerWidth;
      const visible = (el) => {
        const style = getComputedStyle(el); const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };
      const interactive = Array.from(document.querySelectorAll('button,a,input,textarea,select,[tabindex]')).filter(visible);
      const touchIssues = interactive.filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width < 40 || rect.height < 40;
      }).slice(0, 12).map((el) => ({ tag: el.tagName, text: (el.textContent || '').trim().slice(0, 60), width: Math.round(el.getBoundingClientRect().width), height: Math.round(el.getBoundingClientRect().height) }));
      return {
        overflow: (body?.scrollWidth || 0) > viewportWidth + 2,
        bodyScrollWidth: body?.scrollWidth || 0,
        viewportWidth,
        appShell: Boolean(document.querySelector('.k-app-page,.workspace-page,.kurukoo-chat-page')),
        header: Boolean(document.querySelector('.k-app-header,.workspace-header,.chat-header')),
        nav: Boolean(document.querySelector('.k-app-nav,.workspace-nav,.chat-sidebar')),
        cards: document.querySelectorAll('.k-app-card,.card,.panel-card,.workspace-panel,.k-screen-card,.inspector-card').length,
        touchIssues,
        iconOnlyWithoutLabel: Array.from(document.querySelectorAll('button,a')).filter((el) => {
          const text = (el.textContent || '').trim();
          const label = el.getAttribute('aria-label') || el.getAttribute('title');
          const hasIcon = Boolean(el.querySelector('svg'));
          return hasIcon && !text && !label;
        }).length,
      };
    });
    if (layout.overflow) routeResult.issues.push(`horizontal overflow ${layout.bodyScrollWidth}px > ${layout.viewportWidth}px`);
    if (!layout.appShell) routeResult.issues.push('shared authenticated shell marker missing');
    if (!layout.header) routeResult.issues.push('shared header marker missing');
    if (!layout.nav) routeResult.issues.push('shared navigation marker missing');
    if (viewport.mobile && layout.touchIssues.length) routeResult.issues.push(`small mobile targets: ${JSON.stringify(layout.touchIssues)}`);
    if (layout.iconOnlyWithoutLabel) routeResult.issues.push(`${layout.iconOnlyWithoutLabel} icon-only controls lack label/title`);

    routeResult.accessibility = await page.evaluate(() => {
      const visible = (el) => {
        const style = getComputedStyle(el); const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };
      const first = Array.from(document.querySelectorAll('button,input,textarea,a')).find(visible);
      if (!first) return { focusChecked: false };
      first.focus();
      const style = getComputedStyle(first);
      return { focusChecked: document.activeElement === first, boxShadow: style.boxShadow, outline: style.outlineStyle };
    });
    if (routeResult.accessibility?.focusChecked && routeResult.accessibility.boxShadow === 'none' && routeResult.accessibility.outline === 'none') routeResult.issues.push('focused control has no visible focus treatment');

    if (screen.id === 'chat') {
      routeResult.composer = await page.evaluate(() => {
        const selectors = ['#message-input', '#attach-file', '#voice-input', '#send-message', '#stop-generation', '#composer-quick-actions'];
        const checks = Object.fromEntries(selectors.map((selector) => [selector, { exists: Boolean(document.querySelector(selector)), visible: (() => { const el = document.querySelector(selector); return Boolean(el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden'); })() }]));
        return { ...checks, composerCount: document.querySelectorAll('.composer').length, quickActionCount: document.querySelectorAll('#composer-quick-actions button').length };
      });
      if (routeResult.composer.composerCount !== 1) routeResult.issues.push(`composer count ${routeResult.composer.composerCount}, expected 1`);
      for (const selector of ['#message-input', '#attach-file', '#voice-input', '#send-message']) if (!routeResult.composer[selector]?.visible) routeResult.issues.push(`composer control missing/hidden: ${selector}`);

      routeResult.communication = await page.evaluate(() => Array.from(document.querySelectorAll('.ko-communication-actions button,.communication-actions button,.message-actions button,.provider-actions button,.profile-actions button,[data-action="message"],[data-action="call"],[data-action="voice"]')).map((element) => {
        const rect = element.getBoundingClientRect();
        return { action: element.getAttribute('data-action') || element.className, width: Math.round(rect.width), height: Math.round(rect.height), disabled: Boolean(element.disabled || element.getAttribute('aria-disabled') === 'true') };
      }));
      for (const control of routeResult.communication) if (control.width < 40 || control.height < 40) routeResult.issues.push(`communication target below 40px: ${control.action}`);

      const presence = await page.evaluate(async (states) => {
        const seen = new Set();
        const listener = (event) => seen.add(event.detail?.state);
        window.addEventListener('kurukoo:agent-presence', listener);
        const current = document.querySelector('[data-agent-presence]')?.getAttribute('data-agent-presence') || null;
        seen.add(current);
        const speechSupported = Boolean(window.KurukooSpeechOutput?.isSupported?.());
        let speakingObserved = false;
        if (speechSupported) {
          window.KurukooSpeechOutput.speak('Kurukoo runtime visual proof.');
          const deadline = Date.now() + 5000;
          while (Date.now() < deadline && ![...seen].includes('speaking')) await new Promise((resolve) => setTimeout(resolve, 100));
          speakingObserved = [...seen].includes('speaking');
          window.KurukooSpeechOutput.stop();
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
        window.removeEventListener('kurukoo:agent-presence', listener);
        return { seen: [...seen].filter((value) => states.includes(value)), speakingObserved, speechSupported, final: document.querySelector('[data-agent-presence]')?.getAttribute('data-agent-presence') || null };
      }, expectedPresenceStates);
      routeResult.presence = presence;
      presenceEvidence.push({ screen: screen.label, viewport, ...presence });
    }

    if (screen.id === 'contacts') {
      const contactApi = await page.evaluate(async () => {
        try { const response = await fetch('/api/safety/contacts', { credentials: 'same-origin' }); return { status: response.status, json: await response.json().catch(() => null) }; }
        catch (error) { return { error: String(error) }; }
      });
      routeResult.contactsApi = contactApi;
      if (contactApi.status && contactApi.status >= 500) routeResult.issues.push(`contacts API failed: ${contactApi.status}`);
    }

    const safe = `${String(index).padStart(2, '0')}-${screen.id}-${viewport.width}x${viewport.height}.png`;
    await page.screenshot({ path: path.join(outputDir, safe), fullPage: true });
    routeResult.screenshot = safe;
    if (consoleErrors.length) routeResult.issues.push(`console errors: ${consoleErrors.slice(0, 3).join(' | ')}`);
  } catch (error) {
    routeResult.issues.push(`navigation/runtime error: ${error instanceof Error ? error.message : String(error)}`);
  }
  routeResult.pass = routeResult.issues.length === 0;
  return routeResult;
}

for (const viewport of viewports) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.mobile, hasTouch: viewport.mobile, deviceScaleFactor: viewport.mobile ? 2 : 1, colorScheme: 'light', reducedMotion: 'reduce', permissions: ['microphone'] });
  if (authCookie) await context.addCookies([{ name: 'kurukoo_auth', value: authCookie.split('=')[1], url: `${baseUrl}/` }]);
  for (let i = 0; i < screens.length; i += 1) {
    const page = await context.newPage();
    results.push(await inspectScreen(page, screens[i], viewport, i));
    await page.close();
  }
  await browser.close();
}

const observedPresence = [...new Set(presenceEvidence.flatMap((entry) => entry.seen))];
const missingPresence = expectedPresenceStates.filter((state) => !observedPresence.includes(state));
const failed = results.filter((result) => !result.pass);
const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  viewports,
  nineScreenSet: screens.map((screen) => ({ id: screen.id, label: screen.label, route: screen.route, note: screen.note || null })),
  results,
  presence: { expected: expectedPresenceStates, observed: observedPresence, notObserved: missingPresence, evidence: presenceEvidence },
  summary: { totalScreens: results.length, passed: results.length - failed.length, failed: failed.length },
};
await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
console.log(JSON.stringify(report.presence, null, 2));
if (failed.length) process.exit(1);
