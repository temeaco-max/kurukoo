import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync('public/sw.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('public/manifest.json', 'utf8')) as Record<string, unknown>;
const offline = fs.readFileSync('public/offline.html', 'utf8');
const registration = fs.readFileSync('public/js/kurukoo-pwa.js', 'utf8');

assert.match(worker, /kurukoo-static-v7/);
assert.match(worker, /kurukoo-pages-v7/);
assert.match(worker, /kurukoo-pwa-shell-v7/);
assert.match(worker, /const CACHEABLE_PAGE_PATHS = new Set\(PAGES_TO_CACHE\)/);
assert.match(worker, /const CACHEABLE_PUBLIC_APIS = new Set\(\['\/api\/hero-taglines', '\/api\/pricing', '\/api\/blog'\]\)/);
assert.match(worker, /isExplicitlyCacheablePublicRequest/);
assert.match(worker, /url\.origin === self\.location\.origin/);
assert.match(worker, /pathname\.startsWith\('\/api\/chat'\)/, 'private attachments and chat data must be excluded from caching');
assert.match(worker, /pathname\.startsWith\('\/api\/voice'\)/, 'voice sessions and transcripts must be excluded from caching');
assert.match(worker, /pathname\.startsWith\('\/api\/user'\)/, 'account export and deletion data must be excluded from caching');
assert.match(worker, /pathname\.startsWith\('\/admin'\)/, 'admin pages must be excluded from caching');
assert.match(worker, /if \(request\.mode === 'navigate'\) event\.respondWith\(fetch\(request\)\.catch\(\(\) => caches\.match\('\/offline\.html'\)\)\)/, 'uncached navigations must fall back offline without being persisted');
assert.doesNotMatch(worker, /request\.mode === 'navigate' \|\| request\.headers\.get\('accept'\)/, 'unknown HTML navigations must not be broadly cacheable');
assert.match(registration, /serviceWorker\.register\('\/sw\.js'\)/);
assert.equal(manifest.name, 'Kurukoo');
assert.equal(manifest.display, 'standalone');
assert.match(offline, /Offline/i);
assert.match(offline, /Connect to the internet to use all features/i);

console.log('PWA offline contract passed: explicit public shell caching, no protected dynamic caching, cache migration, and truthful uncached-navigation fallback.');
