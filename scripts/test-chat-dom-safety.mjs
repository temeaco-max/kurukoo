import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(__dirname, '../public/js/kurukoo-primary-chat.js'), 'utf8');
const shell = fs.readFileSync(path.join(__dirname, '../public/chat/index.html'), 'utf8');
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
assert.match(source, /setMarkdown\(output, full\)/, 'streaming Markdown must continue through its sanitizer-backed DOM helper');
assert.match(source, /function setMarkdown\(el, text\)[\s\S]*renderMarkdown\(text\)[\s\S]*replaceChildren/, 'Markdown helper must sanitize before replacing rendered DOM content');
assert.match(shell, /aria-controls="chat-inspector"/, 'context inspector toggle must declare its controlled region');
assert.match(shell, /id="inspector-feedback"[^>]*role="status"/, 'Native Assistance feedback must be announced to assistive technology');
assert.match(shell, /id="native-assistance-status"[^>]*role="status"/, 'primary chat must announce proactive Native Assistance status');
assert.match(source, /function setInspectorOpen\(/, 'context inspector must have a responsive open-state controller');
assert.match(source, /async function nativeAction\(/, 'Native Assistance actions must use a shared error-aware request helper');
assert.match(source, /\/api\/safety\/contacts\/.*\/revoke/, 'context inspector must expose owner-scoped safety contact revocation');
assert.match(source, /function updateNativeAssistanceStatus\(/, 'primary chat must derive proactive Native Assistance status from canonical state');
assert.match(source, /no contact is notified automatically/, 'safety status must preserve the non-emergency delivery boundary');

console.log('Chat DOM-safety contract passed: storefront cards use DOM APIs, Markdown remains sanitized, and Native Assistance controls are accessible and error-aware.');
