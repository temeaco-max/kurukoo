import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-ad-disclosure-${process.pid}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'test';
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.JWT_SECRET = 'advertising_management_test_secret_at_least_32_chars';
const { app } = await import('../src/index.js');
const { getDb } = await import('../src/database.js');
const { createAdCampaign, getAdCampaigns, matchAdCampaigns, setAdCampaignStatus } = await import('../src/services/adManager.js');
await getDb();
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const adminHeaders = { Authorization: `Bearer ${jwt.sign({ role: 'admin' }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '10m' })}`, 'Content-Type': 'application/json' };

try {
  await createAdCampaign({
    title: 'Kurukoo event discovery',
    desc: 'A Kurukoo-sponsored placement for a discovery topic.',
    imageUrl: '',
    targetKeyword: 'events',
    creditsBudget: 10,
    placementSource: 'kurukoo_sponsored',
    disclosure: 'Kurukoo-sponsored',
  });
  await createAdCampaign({
    title: 'External repair advert',
    desc: 'External advertising inventory.',
    imageUrl: '',
    targetKeyword: 'repair',
    creditsBudget: 10,
  });
  const categoryCampaign = await createAdCampaign({
    title: 'Repairs category context',
    desc: 'A disclosed contextual campaign that must not claim provider verification or availability.',
    imageUrl: '',
    targetKeyword: '',
    targetCategories: ['repairs-maintenance'],
    creditsBudget: 10,
  });
  await assert.rejects(() => createAdCampaign({ title: 'Invalid category', desc: 'This must not be accepted as a taxonomy target.', imageUrl: '', targetKeyword: '', targetCategories: ['not-a-kurukoo-category'], creditsBudget: 1 }), /target keyword or at least one canonical category/);
  const campaigns = await getAdCampaigns();
  const sponsored = campaigns.find((campaign) => campaign.title === 'Kurukoo event discovery');
  const external = campaigns.find((campaign) => campaign.title === 'External repair advert');
  assert.equal(sponsored?.placementSource, 'kurukoo_sponsored');
  assert.equal(sponsored?.disclosure, 'Kurukoo-sponsored');
  assert.equal(external?.placementSource, 'external_inventory');
  assert.equal(external?.disclosure, 'External advertisement');

  const matched = await matchAdCampaigns('I need repair assistance');
  assert.equal(matched.length, 1);
  assert.equal(matched[0].placementSource, 'external_inventory');
  assert.equal(matched[0].disclosure, 'External advertisement');
  assert.ok(!('verified' in matched[0]), 'advertising data must not expose provider-verification semantics');
  const categoryMatched = await matchAdCampaigns('Need help today', { category: 'repairs-maintenance' });
  assert.ok(categoryMatched.some((campaign) => campaign.id === categoryCampaign.campaign.id), 'canonical category context may match a disclosed campaign without an advertising-specific classifier');
  assert.deepEqual(categoryCampaign.campaign.targetCategories, ['repairs-maintenance']);
  await setAdCampaignStatus(categoryCampaign.campaign.id, 'paused');
  const paused = await matchAdCampaigns('Need help today', { category: 'repairs-maintenance' });
  assert.ok(!paused.some((campaign) => campaign.id === categoryCampaign.campaign.id), 'paused campaigns must not serve through category context');

  const anonymous = await fetch(`${baseUrl}/api/admin/marketing/campaigns`);
  assert.equal(anonymous.status, 401, 'campaign records must remain inside the authenticated Admin boundary');
  const managed = await fetch(`${baseUrl}/api/admin/marketing/campaigns`, { method: 'POST', headers: adminHeaders, body: JSON.stringify({ title: 'Admin category campaign', desc: 'A disclosed admin campaign without provider or commercial-outcome claims.', imageUrl: '', targetKeyword: '', targetCategories: ['food-drink'], creditsBudget: 3, placementSource: 'kurukoo_sponsored', disclosure: 'Kurukoo-sponsored' }) });
  const managedPayload = await managed.json() as { campaign?: { id?: number; targetCategories?: string[]; disclosure?: string; status?: string } };
  assert.equal(managed.status, 201, JSON.stringify(managedPayload));
  assert.deepEqual(managedPayload.campaign?.targetCategories, ['food-drink']);
  assert.equal(managedPayload.campaign?.disclosure, 'Kurukoo-sponsored');
  const pausedViaAdmin = await fetch(`${baseUrl}/api/admin/marketing/campaigns/${managedPayload.campaign?.id}/status`, { method: 'POST', headers: adminHeaders, body: JSON.stringify({ status: 'paused' }) });
  assert.equal(pausedViaAdmin.status, 200, await pausedViaAdmin.text());
  const listed = await fetch(`${baseUrl}/api/admin/marketing/campaigns`, { headers: adminHeaders });
  assert.equal(listed.status, 200);
  assert.ok((await listed.json() as { campaigns?: Array<{ id?: number; status?: string }> }).campaigns?.some((campaign) => campaign.id === managedPayload.campaign?.id && campaign.status === 'paused'));
  console.log('Advertising disclosure regression passed: persisted placement source, truthful default labels, canonical category targeting, paused exclusion, active-only matching, and no provider-evidence field.');
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const suffix of ['', '-journal', '-wal', '-shm']) { try { fs.unlinkSync(`${dbPath}${suffix}`); } catch {} }
}
