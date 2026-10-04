/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */

/**
 * Contract: the built SPA must actually be reachable, and only for routes
 * whose parity has been proven.
 *
 * This exists because the build previously produced a correct prerendered SPA
 * that nothing served. Repository presence of `frontend/.output/public` is not
 * reachability; this asserts the runtime boundary.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AddressInfo } from 'node:net';

const dbPath = path.join(os.tmpdir(), `kurukoo-spa-serve-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'test';
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.JWT_SECRET = 'spa-serve-contract-secret-that-is-long-enough';

const { getSpaStaticBoundary, SPA_PILOT_ROUTES, resolveSpaPublicDir } = await import('../src/services/spaStaticService.ts');
const { app } = await import('../src/index.ts');

const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));

try {
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  // The boundary must resolve to a real directory, or the whole slice is decorative.
  const boundary = getSpaStaticBoundary();
  assert.ok(boundary.available, 'Built SPA output must be present and resolvable');
  assert.ok(boundary.publicDir && fs.existsSync(boundary.publicDir), 'Resolved SPA public directory must exist on disk');

  // Only proven routes are claimed. Everything else keeps its existing owner.
  assert.ok(SPA_PILOT_ROUTES.includes('/about'), '/about must be a proven SPA-served route');
  assert.ok(boundary.serves('/about'), '/about must be served from the built SPA');
  assert.ok(boundary.serves('/chat'), '/chat is served from the built SPA so identity can happen in the conversation');
  assert.ok(boundary.serves('/discover'), '/discover must be served from the built SPA');

  for (const route of SPA_PILOT_ROUTES) {
    // Express redirects the extensionless path to the directory form; follow it
    // so this asserts what a visitor actually receives.
    const response = await fetch(`${base}${route}/`, { redirect: 'follow' });
    assert.equal(response.status, 200, `${route} must be served by the built SPA`);
    const html = await response.text();
    const expectedTitles: Record<string, RegExp> = {
      '/about': /<title>About — Kurukoo<\/title>/,
      '/help': /<title>Help — Kurukoo<\/title>/,
      '/pricing': /<title>Plans and pricing — Kurukoo<\/title>/,
      '/contact': /<title>Contact — Kurukoo<\/title>/,
      '/careers': /<title>Careers — Kurukoo<\/title>/,
      '/blog': /<title>Kurukoo updates — Kurukoo<\/title>/,
      '/api-docs': /<title>API reference — Kurukoo<\/title>/,
      '/legal': /<title>Legal &amp; policies — Kurukoo<\/title>/,
      '/how-it-works': /<title>How Kurukoo works — everyday AI that gets things done<\/title>/,
      '/partners': /<title>Partners — Kurukoo<\/title>/,
      '/advertise': /<title>Advertisers — Kurukoo<\/title>/,
      '/network': /<title>The Kurukoo Network<\/title>/,
      '/topics': /<title>Topics — Kurukoo<\/title>/,
      '/chat': /<title>Chat \/ Voice — Kurukoo<\/title>/,
      '/discover': /<title>Discover — Kurukoo<\/title>/,
      '/login': /<title>Log in — Kurukoo<\/title>/,
      '/features': /<title>Features — Kurukoo<\/title>/,
      '/developers': /<title>Developers — Kurukoo<\/title>/,
      '/auth/challenge/complete': /<title>Completing Kurukoo sign-in<\/title>/,
      '/whatsapp-linked-device': /<title>WhatsApp linked device — Kurukoo<\/title>/,
      '/discover/food': /<title>Discover — Kurukoo<\/title>/,
      '/discover/work': /<title>Discover — Kurukoo<\/title>/,
    };
    const expectedTitle = expectedTitles[route] ?? (route.startsWith('/discover/') ? /<title>[^<]+Kurukoo<\/title>/ : undefined);
    assert.match(html, expectedTitle!, `${route} must serve its real prerendered metadata, not the retired EJS page`);
    assert.match(html, /id="\$tsr-stream-barrier"/, `${route} must serve TanStack prerendered output, proving the SPA owns this route`);
    assert.match(html, /src="\/assets\/index-[A-Za-z0-9_-]+\.js"/, `${route} must reference the built client bundle so the page can hydrate`);
    assert.ok(!/<nav class="k-nav"/.test(html), `${route} must not serve the legacy hand-written shell markup`);
  }

  // The hashed client bundle itself must be reachable, or hydration silently never runs.
  const aboutHtml = await (await fetch(`${base}/about/`, { redirect: 'follow' })).text();
  const bundleMatch = aboutHtml.match(/src="(\/assets\/index-[A-Za-z0-9_-]+\.js)"/);
  assert.ok(bundleMatch, 'Prerendered page must reference its hashed entry bundle');
  const bundleResponse = await fetch(`${base}${bundleMatch[1]}`);
  assert.equal(bundleResponse.status, 200, 'The built client bundle must be served, not 404');
  const bundleBody = await bundleResponse.text();
  assert.ok(bundleBody.length > 1000, 'Client bundle must have real content');

  // Every prerendered page now emits its route content server-side. This
  // asserts the about document carries its real <main> copy instead of the
  // empty hydration placeholder, so the SPA may actually own the route.
  const aboutMain = aboutHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? '';
  const aboutMainText = aboutMain.replace(/<footer[\s\S]*$/, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  assert.ok(aboutMainText.length > 0, 'Prerendered <main> must contain server-rendered page content');
  assert.match(aboutMainText, /A calmer way to get life moving\./, 'Prerendered <main> must include the About page copy server-side');

  // A route outside the pilot must keep its previous owner rather than 404 or go blank.
  const discover = await fetch(`${base}/discover/`);
  assert.equal(discover.status, 200, '/discover must keep serving while it is outside the pilot');
  const discoverHtml = await discover.text();
  assert.ok(
    !/<title>About — Kurukoo<\/title>/.test(discoverHtml),
    '/discover must not be served the /about prerendered payload',
  );

  // Detail surfaces with a real prerendered document must be served by the SPA,
  // not by a legacy template, and an unknown slug must stay a 404.
  // Guides live under Help now; /resources is retired as a page.
  const seededGuide = await fetch(`${base}/help/guides/how-kurukoo-works`, { redirect: 'follow' });
  assert.equal(seededGuide.status, 200, 'A /help/guides/<slug> guide must be served');
  assert.match(await seededGuide.text(), /id="\$tsr-stream-barrier"/, 'Guide detail must come from the SPA owner');
  const retiredResources = await fetch(`${base}/resources`, { redirect: 'follow' });
  assert.equal(retiredResources.status, 200, '/resources must still resolve');
  assert.match(await retiredResources.text(), /<title>Help — Kurukoo<\/title>/, '/resources must land on the merged Help surface');

  const seededTopic = await fetch(`${base}/topics/finding-a-trustworthy-plumber-in-lagos`);
  assert.equal(seededTopic.status, 200, 'A public Topic detail must be served');
  assert.match(await seededTopic.text(), /id="\$tsr-stream-barrier"/, 'Topic detail must come from the SPA owner');

  const unknownResource = await fetch(`${base}/help/guides/not-a-real-guide`);
  assert.equal(unknownResource.status, 404, 'Unknown resource slugs must stay not found');
  const unknownTopic = await fetch(`${base}/topics/not-a-real-topic`);
  assert.equal(unknownTopic.status, 404, 'Unknown topic slugs must stay not found');

  // Identity lives in the conversation: the chat document must carry the
  // in-chat identity entry rather than sending people to a separate page.
  const chatDocument = await fetch(`${base}/chat`, { redirect: 'follow' });
  const chatHtml = await chatDocument.text();
  assert.match(chatHtml, /Using Kurukoo as a guest|Continue the conversation/, 'Chat must present identity inside the conversation');
  assert.doesNotMatch(chatHtml, /Try for free/, 'The retired signup CTA must not remain in the header');

  // The retired provider profile route must not come back.
  const providerProfile = await fetch(`${base}/p/anyone`);
  assert.equal(providerProfile.status, 404, '/p/:providerSlug is retired and must not resolve');

  console.log('SPA static serve contract passed: built output resolves, pilot routes serve prerendered content and a reachable bundle, unproven routes keep their existing owner.');
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  try {
    fs.rmSync(dbPath, { force: true });
  } catch {
    /* best effort */
  }
}
