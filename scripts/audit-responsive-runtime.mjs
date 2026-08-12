import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const baseUrl = process.argv[2] || 'http://127.0.0.1:3000';
const target = process.argv[3] || '/';
const widths = [360, 390, 414, 768, 900, 1024, 1280, 1440];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getTarget(port) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = targets.find((item) => item.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch (_) {}
    await wait(100);
  }
  throw new Error('Chrome DevTools target did not become available');
}

async function inspect(webSocketDebuggerUrl, width, url) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let nextId = 1;
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    const onMessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id !== id) return;
      socket.removeEventListener('message', onMessage);
      if (data.error) reject(new Error(data.error.message)); else resolve(data.result);
    };
    socket.addEventListener('message', onMessage);
    socket.send(JSON.stringify({ id, method, params }));
  });
  await call('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false, screenWidth: width, screenHeight: 1000, dontSetVisibleSize: false });
  await call('Page.navigate', { url });
  await wait(700);
  const result = await call('Runtime.evaluate', { expression: `(() => ({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, viewportOverflow: document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth, visibleStorefront: Boolean(document.querySelector('[data-storefront-demo]')), visibleWorkspace: Boolean(document.querySelector('.workspace-shell')) }))()`, returnByValue: true });
  socket.close();
  return result.result?.value;
}

async function stop(process) {
  if (process.exitCode !== null) return;
  await new Promise((resolve) => { process.once('exit', resolve); process.kill('SIGTERM'); setTimeout(resolve, 500); });
}

let failed = false;
for (const width of widths) {
  const port = 9400 + width;
  const profile = mkdtempSync(path.join(tmpdir(), `kurukoo-${width}-`));
  const chrome = spawn('/usr/bin/chromium', ['--headless', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1200,1000', 'about:blank'], { stdio: 'ignore' });
  try {
    const page = await getTarget(port);
    const result = await inspect(page.webSocketDebuggerUrl, width, `${baseUrl}${target}`);
    const pass = result && !result.viewportOverflow && Math.abs(result.innerWidth - width) <= 1;
    console.log(JSON.stringify({ width, pass, ...result }));
    if (!pass) failed = true;
  } finally {
    await stop(chrome);
    await wait(150);
    rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}
if (failed) process.exitCode = 1;
