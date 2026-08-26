import assert from 'node:assert/strict';
import fs from 'node:fs';

const convergence = fs.readFileSync('public/js/kurukoo-app-convergence.js', 'utf8');
const fcm = fs.readFileSync('public/js/fcm-client.js', 'utf8');

assert.match(convergence, /\/api\/pulse\/providers/, 'Discover must use the canonical Pulse provider projection.');
assert.match(convergence, /\/api\/pulse\/status/, 'Discover must expose the owner-scoped Pulse status boundary.');
assert.match(convergence, /\/api\/payments\/stripe\/status/, 'Economic surfaces must use canonical payment readiness.');
assert.match(convergence, /\/api\/chat\/economic-requests/, 'Economic surfaces must use canonical Economic Request state.');
assert.match(convergence, /payment state stays evidence-gated/i, 'Economic UI must preserve evidence-gated payment semantics.');
assert.match(convergence, /kurukooAppConvergence/, 'The convergence script must be self-identifying to avoid duplicate loads.');
assert.match(fcm, /kurukoo-app-convergence\.js/, 'The authenticated PWA bootstrap must load the canonical client-convergence layer.');

console.log(JSON.stringify({ ok: true, discover: true, economic: true, bootstrap: true }));
