import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(__dirname, '../public/js/kurukoo-primary-chat.js'), 'utf8');
const storefrontStart = source.indexOf('function renderAgenticStorefront');
const storefrontEnd = source.indexOf('function renderCard', storefrontStart);
assert.ok(storefrontStart >= 0 && storefrontEnd > storefrontStart, 'agentic storefront renderer must remain present');

const storefront = source.slice(storefrontStart, storefrontEnd);
assert.match(storefront, /document\.createElement\(/, 'storefront renderer must construct application UI with DOM APIs');
assert.match(storefront, /makeElement\(/, 'storefront renderer must construct dynamic text through the shared DOM helper');
assert.match(source, /\.textContent\s*=/, 'shared DOM helper must assign dynamic text through textContent');
assert.match(storefront, /\.setAttribute\(/, 'storefront renderer must set progress semantics through attributes');
assert.doesNotMatch(storefront, /innerHTML\s*=/, 'storefront renderer must not interpolate card data into innerHTML');
assert.doesNotMatch(storefront, /style=["'][^"']*width/, 'storefront renderer must not emit inline progress styles');
assert.match(source, /function renderMarkdown\(text\).*sanitizeHtml/s, 'sanitized Markdown rendering must remain available for genuine message content');
assert.match(source, /output\.innerHTML\s*=\s*renderMarkdown\(full\)/, 'streaming Markdown must continue through its existing sanitization boundary');

console.log('Chat DOM-safety contract passed: storefront card data uses DOM APIs; sanitized Markdown remains intact.');
