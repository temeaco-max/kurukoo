import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('views/app.ejs', 'utf8');
const runtime = fs.readFileSync('public/js/kurukoo-requests-convergence.js', 'utf8');
const css = fs.readFileSync('public/css/kurukoo-requests-convergence.css', 'utf8');

assert.match(app, /section === 'requests'/, 'Requests branch must remain owned by the canonical app template');
assert.match(app, /kurukoo-requests-convergence\.css/, 'Requests-only CSS must be loaded explicitly');
assert.match(app, /kurukoo-requests-convergence\.js/, 'Requests-only presentation enhancement must be loaded explicitly');
assert.doesNotMatch(app, /section === 'chat'/, 'Requests convergence must not create a Chat template branch');
assert.match(runtime, /\/api\/chat\/economic-requests/, 'Requests presentation must read the canonical Economic Request API');
assert.match(runtime, /\/participants/, 'Provider context must use the canonical participant boundary');
assert.match(runtime, /Continue my \$\{skill\} request\./, 'Chat continuation must preserve request identity');
assert.match(runtime, /payment_pending/, 'Payment presentation must distinguish pending evidence');
assert.match(runtime, /\/confirmations\?request=/, 'Review actions must preserve request identity when routed to confirmation');
assert.match(runtime, /dataset\.requestId/, 'Request cards must expose canonical request identity to the presentation layer');
assert.match(css, /\.k-app-section-requests/, 'Requests styling must be scoped to Requests');
assert.match(css, /min-height: 44px/, 'Requests actions must remain touch-safe');

const forbidden = [
  'kurukoo-primary-chat.js',
  'chat/index.html',
  'k-chat-',
];
for (const token of forbidden) {
  assert.doesNotMatch(runtime, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Requests enhancement must not introduce ${token}`);
}

console.log('Requests Screen Convergence contract passed: canonical Economic Request API, user-safe continuation, provider/payment boundaries, Requests-only styling, and 44px actions remain covered.');
