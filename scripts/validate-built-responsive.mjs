import fs from 'node:fs/promises';
import http from 'node:http';

const baseUrl = 'http://127.0.0.1:3300';
const debugHost = '127.0.0.1';
const debugPort = 9222;
const viewports = [360, 390, 414, 768, 900, 1024, 1280, 1440];
const routes = [
  '/',
  '/admin/login.html',
  '/admin/dashboard.html',
  '/admin/analytics.html',
  '/admin/users.html',
  '/admin/ai-agents.html',
  '/admin/skill-flows.html',
  '/admin/content.html',
  '/admin/seo.html',
  '/admin/settings.html',
  '/admin/pilot',
  '/admin/supply.html',
  '/admin/referrals.html',
  '/admin/partnerships.html',
  '/admin/scam.html',
  '/admin/pricing.html',
  '/admin/commissions.html',
  '/admin/social.html',
  '/admin/future.html'
];

function request(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: debugHost, port: debugPort, path, method }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const targetResponse = await request(`/json/new?${encodeURIComponent('about:blank')}`, 'PUT');
if (targetResponse.status !== 200) throw new Error(`Unable to create browser target: ${targetResponse.status}`);
const target = JSON.parse(targetResponse.body);
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 1;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const payload = JSON.parse(event.data);
  const deferred = pending.get(payload.id);
  if (!deferred) return;
  pending.delete(payload.id);
  payload.error ? deferred.reject(new Error(payload.error.message)) : deferred.resolve(payload.result);
});

function cdp(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return result.result.value;
}

await cdp('Page.enable');
await cdp('Runtime.enable');
const results = [];
for (const width of viewports) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
  for (const route of routes) {
    const url = `${baseUrl}${route}`;
    await cdp('Page.navigate', { url });
    await wait(350);
    const snapshot = await evaluate(`JSON.stringify((() => {
      const sidebar = document.querySelector('.admin-shell-sidebar');
      const topbar = document.querySelector('.admin-shell-topbar');
      const root = document.documentElement;
      const body = document.body;
      const style = sidebar ? getComputedStyle(sidebar) : null;
      const rect = sidebar ? sidebar.getBoundingClientRect() : null;
      return {
        title: document.title,
        documentWidth: root.scrollWidth,
        viewportWidth: window.innerWidth,
        horizontalOverflow: root.scrollWidth > window.innerWidth + 1,
        sidebarPresent: Boolean(sidebar),
        sidebarPosition: style?.position || null,
        sidebarViewportTop: rect ? Math.round(rect.top) : null,
        sidebarViewportBottom: rect ? Math.round(rect.bottom) : null,
        topbarPresent: Boolean(topbar),
        topbarViewportTop: topbar ? Math.round(topbar.getBoundingClientRect().top) : null,
        bodyClass: body.className,
        pageText: body.innerText.slice(0, 120)
      };
    })())`);
    results.push({ width, route, ...JSON.parse(snapshot) });
  }
}

await cdp('Emulation.clearDeviceMetricsOverride');
socket.close();
await request(`/json/close/${target.id}`);
const failures = results.filter((result) => result.horizontalOverflow);
const shellFailures = results.filter((result) => result.route.startsWith('/admin/') && !result.route.includes('login') && (!result.sidebarPresent || !result.topbarPresent));
const fixedSidebarFailures = results.filter((result) => result.route.startsWith('/admin/') && !result.route.includes('login') && result.sidebarPosition !== 'fixed');
const report = {
  runtime: baseUrl,
  testedAt: new Date().toISOString(),
  viewports,
  routeCount: routes.length,
  assertions: {
    totalChecks: results.length,
    horizontalOverflow: failures,
    missingShell: shellFailures,
    nonFixedSidebars: fixedSidebarFailures
  },
  results
};
await fs.mkdir('validation-notes', { recursive: true });
await fs.writeFile('validation-notes/built-responsive-report.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ totalChecks: report.assertions.totalChecks, overflowFailures: failures.length, missingShellFailures: shellFailures.length, nonFixedSidebarFailures: fixedSidebarFailures.length }, null, 2));
if (failures.length || shellFailures.length || fixedSidebarFailures.length) process.exitCode = 1;
