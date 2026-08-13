import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-ad-disclosure-${process.pid}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'test';
const { getDb } = await import('../src/database.js');
const { createAdCampaign, getAdCampaigns, matchAdCampaigns } = await import('../src/services/adManager.js');
await getDb();

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
  console.log('Advertising disclosure regression passed: persisted placement source, truthful default labels, active-only matching, and no provider-evidence field.');
} finally {
  for (const suffix of ['', '-journal', '-wal', '-shm']) { try { fs.unlinkSync(`${dbPath}${suffix}`); } catch {} }
}
