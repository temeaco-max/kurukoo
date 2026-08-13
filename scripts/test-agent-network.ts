import assert from 'node:assert/strict';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-agent-network-${process.pid}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.KURUKOO_WORKERS = '0';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'agent_network_test_secret_at_least_32_chars';

const { app } = await import('../src/index.js');
const { getDb, saveDb } = await import('../src/database.js');
const { createEconomicRequest, getEconomicRequest } = await import('../src/services/skillFlows.js');
const { createAIAgent } = await import('../src/services/aiAgentService.js');
const db = await getDb();
const ownerPhone = '+2348010007001';
const otherPhone = '+2348010007002';
db.run(`INSERT OR REPLACE INTO memory_profiles(phone,name,country,points_balance,subscription_tier) VALUES(?,?,?,?,?)`, [ownerPhone, 'Request owner', 'ng', 0, 'Base']);
db.run(`INSERT OR REPLACE INTO memory_profiles(phone,name,country,points_balance,subscription_tier) VALUES(?,?,?,?,?)`, [otherPhone, 'Other account', 'ng', 0, 'Base']);
saveDb();

await createAIAgent({
  id: 'agent_ikeja_repair_registry',
  name: 'Ikeja Repair Coordination Agent',
  avatar: 'K',
  system_prompt: 'Read-only repair coordination. Do not execute external actions.',
  skills: ['repair'],
  tools: [],
  status: 'active',
  lga: 'Ikeja',
  concurrency_limit: 1,
  token_quota_daily: 100,
  cost_threshold_usd: 0.01,
  temperature: 0,
});
const request = await createEconomicRequest({ id: 'agent_network_repair_request', phone: ownerPhone, skill: 'repair', requirements: { location: 'Ikeja', service: 'Appliance repair' } });

const token = (phone: string) => jwt.sign({ phone, role: 'user' }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '10m' });
const headers = (phone: string) => ({ Authorization: `Bearer ${token(phone)}`, 'Content-Type': 'application/json' });
const server = app.listen(0);
const address = server.address();
assert.ok(address && typeof address === 'object');
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const candidatesResponse = await fetch(`${baseUrl}/api/agent/network/candidates?requestId=${encodeURIComponent(request.id)}`, { headers: headers(ownerPhone) });
  const candidatesPayload = await candidatesResponse.json() as { success?: boolean; candidates?: Array<{ agentId: string; localityMatch: string; availability: string; boundary: string }> };
  assert.equal(candidatesResponse.status, 200, JSON.stringify(candidatesPayload));
  const candidate = candidatesPayload.candidates?.find((item) => item.agentId === 'agent_ikeja_repair_registry');
  assert.ok(candidate, 'matching active registered agent should be visible to request owner');
  assert.equal(candidate?.localityMatch, 'declared_exact');
  assert.equal(candidate?.availability, 'registered_active');
  assert.match(String(candidate?.boundary), /does not start autonomous work/i);

  const forbidden = await fetch(`${baseUrl}/api/agent/network/candidates?requestId=${encodeURIComponent(request.id)}`, { headers: headers(otherPhone) });
  assert.equal(forbidden.status, 404, 'another account cannot inspect the owner’s agent network candidates');

  const assigned = await fetch(`${baseUrl}/api/agent/network/assignments`, { method: 'POST', headers: headers(ownerPhone), body: JSON.stringify({ requestId: request.id, agentId: 'agent_ikeja_repair_registry' }) });
  const assignedPayload = await assigned.json() as { success?: boolean; assignment?: { role?: string; providerPhone?: string; status?: string; evidence?: Record<string, unknown> }; message?: string };
  assert.equal(assigned.status, 201, JSON.stringify(assignedPayload));
  assert.equal(assignedPayload.assignment?.role, 'agent');
  assert.equal(assignedPayload.assignment?.providerPhone, 'agent_ikeja_repair_registry');
  assert.equal(assignedPayload.assignment?.status, 'selected');
  assert.equal(assignedPayload.assignment?.evidence?.execution_state, 'not_started');
  assert.match(String(assignedPayload.message), /No autonomous work, payment, dispatch, or fulfilment has started/i);

  const assignments = await fetch(`${baseUrl}/api/agent/network/assignments?requestId=${encodeURIComponent(request.id)}`, { headers: headers(ownerPhone) });
  const assignmentsPayload = await assignments.json() as { assignments?: Array<{ role?: string; providerPhone?: string }> };
  assert.equal(assignments.status, 200, JSON.stringify(assignmentsPayload));
  assert.equal(assignmentsPayload.assignments?.filter((item) => item.providerPhone === 'agent_ikeja_repair_registry').length, 1, 'agent assignment must use one canonical participant record');

  const latestRequest = await getEconomicRequest(request.id);
  assert.equal(latestRequest?.status, 'requested', 'agent selection must not change the Economic Request lifecycle');
  assert.equal(latestRequest?.quote ?? null, null, 'agent selection must not create a quote');
  const escrowRows = db.exec(`SELECT COUNT(*) AS count FROM escrow WHERE order_id=?`, [request.id])[0].values[0][0];
  assert.equal(Number(escrowRows), 0, 'agent selection must not create escrow');
  const profileRows = db.exec(`SELECT provider_type FROM memory_profiles WHERE phone='agent_ikeja_repair_registry'`)[0].values;
  assert.equal(String(profileRows[0][0]), 'software_service', 'AI agent provider representation remains software_service');

  console.log('Agent network regression passed: geographic capability match and participant assignment without autonomous, financial, or fulfilment side effects.');
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const suffix of ['', '-journal', '-wal', '-shm']) { try { fs.unlinkSync(`${dbPath}${suffix}`); } catch {} }
}
