import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-capability-portfolio-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'test';
process.env.CREDIT_ECONOMY_ENABLED = 'true';

const { getDb, saveDb } = await import('../src/database.js');
const { ensureCapability, listCapabilityPortfolio, setCapabilityState } = await import('../src/services/capabilityPortfolioService.js');
const { activatePulse, endPulseSession, getActivePulseProviders } = await import('../src/services/nearbyPulse.js');
const { executeCanonicalCapabilityProposal } = await import('../src/services/canonicalCapabilityExecutor.js');

const phone = `portfolio_${Date.now()}`;

try {
  const db = await getDb();
  db.run(`INSERT INTO memory_profiles (phone, name, country, verified_provider, is_available, trust_score, points_balance) VALUES (?, ?, 'ng', 1, 1, 5, 100)`, [phone, 'Portfolio Test']);
  db.run(`INSERT INTO skills (phone, skill, source, confidence, is_available, operation_mode, service_radius_km) VALUES (?, 'mobile_barber', 'test', 1, 1, 'mobile', 10)`);
  db.run(`INSERT INTO skills (phone, skill, source, confidence, is_available, operation_mode, service_radius_km) VALUES (?, 'delivery_runner', 'test', 1, 1, 'mobile', 15)`);
  saveDb(true);

  await ensureCapability(phone, 'mobile_barber', 'provider');
  await ensureCapability(phone, 'delivery_runner', 'provider');
  await ensureCapability(phone, 'contributor', 'contributor');

  let portfolio = await listCapabilityPortfolio(phone);
  if (!['mobile_barber', 'delivery_runner', 'contributor'].every(skill => portfolio.some(item => item.skill === skill))) throw new Error('Multi-capability portfolio did not reconcile from canonical sources.');

  await activatePulse(phone, 'mobile_barber', 6.5244, 3.3792);
  await activatePulse(phone, 'delivery_runner', 6.5244, 3.3792);
  let live = (await getActivePulseProviders()).filter(item => item.phone === phone);
  if (live.length !== 2 || !live.some(item => item.skill === 'mobile_barber') || !live.some(item => item.skill === 'delivery_runner')) throw new Error('Skill-specific Pulse did not retain simultaneous capabilities.');

  await endPulseSession(phone, 'mobile_barber');
  live = (await getActivePulseProviders()).filter(item => item.phone === phone);
  if (live.length !== 1 || live[0].skill !== 'delivery_runner') throw new Error('Stopping one capability incorrectly stopped another capability.');

  await setCapabilityState(phone, 'delivery_runner', { availability: 'offline' });
  portfolio = await listCapabilityPortfolio(phone);
  const delivery = portfolio.find(item => item.skill === 'delivery_runner');
  const barber = portfolio.find(item => item.skill === 'mobile_barber');
  if (delivery?.availability !== 'offline') throw new Error('Canonical skill availability did not propagate to portfolio.');
  if (barber?.availability === 'offline') throw new Error('Changing one capability unexpectedly changed another.');

  const inspect = await executeCanonicalCapabilityProposal({ phone, capability: 'capability_portfolio', action: 'inspect', arguments: {}, confirmationGranted: false, channel: 'test', idempotencyKey: `portfolio-inspect-${phone}` });
  if (inspect.status !== 'completed' || !Array.isArray(inspect.canonicalFacts?.capabilityPortfolio)) throw new Error(`Canonical portfolio inspection failed: ${JSON.stringify(inspect)}`);

  const addResult = await executeCanonicalCapabilityProposal({ phone, capability: 'capability_portfolio', action: 'add', arguments: { skill: 'mobile_barber' }, confirmationGranted: false, channel: 'test', idempotencyKey: `portfolio-add-${phone}` });
  if (addResult.status !== 'completed') throw new Error(`Canonical portfolio add failed: ${JSON.stringify(addResult)}`);

  console.log('Capability portfolio passed: one identity can hold provider + contributor capabilities, operate skill-specific Pulse independently, and use the canonical capability executor.');
} finally {
  try { fs.rmSync(dbPath, { force: true }); } catch {}
}
