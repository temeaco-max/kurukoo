import assert from 'node:assert/strict';
import { getDb, saveDb } from '../src/database.js';
import { createProviderCommunicationSession, getProviderCommunicationSession, recordProviderLocation, updateProviderCommunicationState, endProviderCommunicationSession } from '../src/services/providerCommunicationService.js';

const customerPhone = `ci_customer_${Date.now()}@example.com`;
const providerPhone = `ci_provider_${Date.now()}@example.com`;
const db = await getDb();
try {
  const session = await createProviderCommunicationSession({ customerPhone, providerPhone, economicRequestId: 'ci-economic-request', mode: 'webrtc_tracking' });
  assert.equal(session.customerPhone, customerPhone);
  assert.ok(session.trackingBridgeId);
  const connected = await updateProviderCommunicationState(session.id, 'connected');
  assert.equal(connected.state, 'connected');
  const located = await recordProviderLocation(session.id, 6.6018, 3.3515);
  assert.equal(located.state, 'provider_en_route');
  assert.equal(located.lastLatitude, 6.6018);
  const fetched = await getProviderCommunicationSession(session.id);
  assert.equal(fetched?.providerPhone, providerPhone);
  const ended = await endProviderCommunicationSession(session.id);
  assert.equal(ended.state, 'ended');
  console.log(JSON.stringify({ passed: true, sessionId: session.id, trackingBridge: session.trackingBridgeId }, null, 2));
} finally {
  db.run('DELETE FROM provider_communication_sessions WHERE customer_phone=? OR provider_phone=?', [customerPhone, providerPhone]);
  db.run('DELETE FROM chat_conversations WHERE phone=?', [customerPhone]);
  saveDb(true);
}
