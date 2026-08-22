import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const callHtml = fs.readFileSync(path.join(root, 'public', 'call', 'index.html'), 'utf8');
const callClient = fs.readFileSync(path.join(root, 'public', 'js', 'kurukoo-call.js'), 'utf8');
const providerRoutes = fs.readFileSync(path.join(root, 'src', 'routes', 'providerCommunicationRoutes.ts'), 'utf8');

assert.match(callHtml, /id="provider-context"/, 'canonical call must expose provider context');
assert.match(callHtml, /id="provider-message-form"/, 'canonical call must expose the existing provider-session message form');
assert.match(callHtml, /id="provider-message-input"/, 'canonical call must expose a bounded provider message input');
assert.match(callHtml, /\/js\/kurukoo-call\.js/, 'canonical call must keep the existing call client');
assert.match(callClient, /loadProviderContext/, 'call client must load canonical provider-session context');
assert.match(callClient, /\/api\/provider-communication\/sessions\/\$\{encodeURIComponent\(sessionId\)\}\/messages/, 'call client must use canonical provider-session messages');
assert.match(callClient, /\/api\/provider-communication\/sessions\/\$\{encodeURIComponent\(sessionId\)\}\/state/, 'call client must report connected or failed transport state to the canonical session');
assert.match(callClient, /providerMessageForm\?\.addEventListener\('submit'/, 'call client must bind the existing provider message form');
assert.match(callClient, /\/api\/provider-communication\/sessions\/\$\{encodeURIComponent\(sessionId\)\}\/end/, 'call client must terminate the canonical provider session');
assert.match(providerRoutes, /import \{ sendFcmPush \} from '\.\.\/services\/pushNotifications\.js';/, 'provider routes must reuse the canonical notification owner');
assert.match(providerRoutes, /if\(role==='provider'\)/, 'provider responses must be the notification trigger');
assert.match(providerRoutes, /canonicalAction:'resume_provider_session'/, 'provider notification must preserve canonical resume context');
assert.match(providerRoutes, /conversationId:ready\.conversationId/, 'provider notification must preserve conversation context');

console.log(JSON.stringify({ status: 'PASS', canonicalCallContext: true, providerSessionMessaging: true, providerReplyNotification: true }, null, 2));
