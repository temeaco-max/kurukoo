import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AddressInfo } from 'node:net';

const dbPath = path.join(os.tmpdir(), `kurukoo-public-contracts-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'test';
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.JWT_SECRET = 'public-contracts-test-secret-that-is-long-enough';

const { app } = await import('../src/index.ts');
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));

async function request(base: string, pathName: string, redirect: RequestRedirect = 'follow') {
  return fetch(`${base}${pathName}`, { redirect });
}

try {
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  const home = await request(base, '/');
  assert.equal(home.status, 200, 'homepage must render');
  const homeHtml = await home.text();
  assert.match(homeHtml, /\/css\/kurukoo-home\.css\?v=1\.0\.0/, 'homepage must load its existing dedicated stylesheet');
  assert.match(homeHtml, /id="kurukoo-onboarding-modal"/, 'homepage navigation must include the existing onboarding modal');
  assert.match(homeHtml, /data-onboarding-goal="buyer"/, 'homepage navigation must declare its onboarding goal');
  const homeBodyHtml = homeHtml.slice(homeHtml.indexOf('<body'));
  assert.doesNotMatch(homeBodyHtml, /onclick=|onsubmit=/, 'homepage navigation and onboarding must use controller-bound events rather than inline handlers');

  for (const pathName of ['/dashboard.html', '/css/site.css', '/js/kurukoo-pwa.js']) {
    const response = await request(base, pathName);
    assert.equal(response.status, 200, `${pathName} must be served by the canonical public asset boundary`);
  }

  for (const pathName of ['/chat', '/chat/']) {
    const chat = await request(base, pathName);
    assert.equal(chat.status, 200, `${pathName} must resolve for the homepage, PWA embed, manifest shortcut, and service-worker shell`);
    assert.match(await chat.text(), /id="chat-shell"|class="chat-shell"/, `${pathName} must serve the existing chat shell`);
  }

  for (const pathName of ['/explore/food', '/explore/groceries', '/explore/repairs-maintenance', '/explore/sports']) {
    const response = await request(base, pathName);
    assert.equal(response.status, 200, `${pathName} must resolve through the canonical Explore route`);
    const html = await response.text();
    assert.doesNotMatch(html, /undefined\s+(Verified Providers|Rating)/, `${pathName} must not invent missing provider statistics`);
    assert.match(html, /Explore related services/, `${pathName} must render the existing category template`);
  }

  const unknownCategory = await request(base, '/explore/not-a-real-category');
  assert.equal(unknownCategory.status, 404, 'unknown Explore categories must remain not found');

  const pricing = await request(base, '/pricing');
  assert.equal(pricing.status, 200, 'pricing navigation must render the existing pricing page');
  assert.match(await pricing.text(), /Simple, Transparent Pricing/, 'pricing page content must be available');

  const country = await request(base, '/gb');
  assert.equal(country.status, 200, 'supported country path must render the homepage');
  assert.match(await country.text(), /\/css\/kurukoo-home\.css\?v=1\.0\.0/, 'country homepage must preserve dedicated styling');

  for (const [pathName, location] of [
    ['/how-it-works', '/#how'],
    ['/events', '/explore/events'],
    ['/earn/rides', '/explore/transport'],
  ] as const) {
    const response = await request(base, pathName, 'manual');
    assert.equal(response.status, 302, `${pathName} must use an explicit public redirect`);
    assert.equal(response.headers.get('location'), location, `${pathName} must redirect to its canonical public destination`);
  }
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  try { fs.rmSync(dbPath, { force: true }); } catch { /* best-effort temporary database cleanup */ }
}

console.log('Public runtime contract checks passed');
console.log('Verified: homepage stylesheet and onboarding events, canonical public assets and chat shell, Explore category aliases, truthful category data, public redirects, pricing, and country routes.');
