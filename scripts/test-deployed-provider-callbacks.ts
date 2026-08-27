import assert from 'node:assert/strict';

const configuredBase = String(process.env.KURUKOO_BASE_URL || '').trim();
assert.ok(configuredBase, 'KURUKOO_BASE_URL must name the deployed staging service.');

const base = new URL(configuredBase.endsWith('/') ? configuredBase : `${configuredBase}/`);
assert.equal(base.protocol, 'https:', 'The deployed callback service must be reached over HTTPS.');

function endpoint(pathname: string): string {
  return new URL(pathname.replace(/^\//, ''), base).toString();
}

async function postForm(pathname: string, form: URLSearchParams): Promise<Response> {
  return fetch(endpoint(pathname), {
    method: 'POST',
    headers: { Accept: 'application/json, text/plain;q=0.9', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
}

const probeId = `kurukoo-staging-route-probe-${Date.now()}`;
const smsPaths = ['/webhook/sms', '/api/webhook/sms'];
const results: Array<{ path: string; status: number; deliveryStatus?: string }> = [];

for (const pathname of smsPaths) {
  // The ID does not correspond to any Kurukoo dispatch. The application must acknowledge
  // a valid provider-shaped callback but represent it as unknown rather than persistent proof.
  const response = await postForm(pathname, new URLSearchParams({ id: `${probeId}-${results.length + 1}`, status: 'Success' }));
  assert.equal(response.status, 200, `${pathname} must accept form-encoded SMS callbacks.`);
  const payload = await response.json() as { status?: string; deliveryStatus?: string };
  assert.equal(payload.status, 'success', `${pathname} must reach the SMS callback handler.`);
  assert.equal(payload.deliveryStatus, 'unknown', `${pathname} must not convert an uncorrelated callback into delivery evidence.`);
  results.push({ path: pathname, status: response.status, deliveryStatus: payload.deliveryStatus });
}

for (const pathname of ['/ussd', '/api/ussd']) {
  // Deliberately omit phoneNumber so routing and form parsing are exercised without creating
  // a USSD conversation or invoking an operational user flow.
  const response = await postForm(pathname, new URLSearchParams({ sessionId: probeId, serviceCode: '*000*0#', text: '' }));
  assert.equal(response.status, 200, `${pathname} must accept form-encoded USSD callbacks.`);
  assert.match(String(response.headers.get('content-type') || ''), /^text\/plain/i, `${pathname} must return the USSD text protocol.`);
  assert.equal(await response.text(), '', `${pathname} must not create a session for an unidentified caller.`);
  results.push({ path: pathname, status: response.status });
}

console.log(JSON.stringify({
  passed: true,
  baseUrl: base.origin,
  routes: results,
  guarantees: [
    'root and legacy callback aliases reach the deployed application',
    'SMS callback parsing does not manufacture delivery evidence',
    'USSD callback parsing does not manufacture a customer session',
  ],
}, null, 2));
