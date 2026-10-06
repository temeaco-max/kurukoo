/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-advertising-${process.pid}-${Date.now()}.sqlite`;
const { createAdCampaign, getAdCampaigns, matchAdCampaigns, recordAdClick, recordAdImpression, seedDemoAdCampaigns, updateAdCampaign } = await import('../src/services/adManager.js');

await seedDemoAdCampaigns();
const seeded = await getAdCampaigns();
assert.ok(seeded.length >= 3, 'first-party demo campaigns should be seeded');
const firstParty = seeded.filter(campaign => Number(campaign.firstParty) === 1);
assert.ok(firstParty.length >= 8, 'first-party Kurukoo campaign set should be seeded');
assert.ok(firstParty.every(campaign => campaign.campaignType === 'first_party'), 'first-party campaigns must use the canonical first_party type');
assert.ok(firstParty.every(campaign => campaign.advertiserName === 'Kurukoo'), 'first-party campaigns require an explicit advertiser identity');
assert.ok(firstParty.every(campaign => String(campaign.disclosure || '').toLowerCase().includes('kurukoo')), 'first-party campaigns require explicit disclosure');
assert.ok(firstParty.every(campaign => campaign.ctaText && campaign.destination), 'first-party campaigns require CTA and destination');

const title = `[Kurukoo test] advertising ${Date.now()}`;
await assert.rejects(() => createAdCampaign({ title: `${title} invalid`, desc: 'Invalid campaign', imageUrl: '', targetKeyword: 'invalid', creditsBudget: 12, disclosure: 'Sponsored invalid campaign' }), /approved campaign image asset/, 'Unapproved campaign assets must be rejected');
await createAdCampaign({ title, desc: 'Controlled test campaign', imageUrl: '/assets/chat/sponsored-local-service.jpg', targetKeyword: 'convergence', creditsBudget: 12, disclosure: 'Sponsored test campaign' });
const created = (await getAdCampaigns()).find(campaign => campaign.title === title);
assert.ok(created, 'admin campaign creation should persist a campaign');
assert.equal(created?.campaignType, 'external');
assert.equal(created?.firstParty, 0);
assert.equal(created?.placement, 'public_discovery');
await updateAdCampaign(Number(created?.id), { assetStatus: 'pending', status: 'active' });
const pendingMatches = await matchAdCampaigns('convergence discovery');
assert.ok(!pendingMatches.some(campaign => campaign.title === title), 'pending assets must not be keyword-matched into public responses');
const updated = await updateAdCampaign(Number(created?.id), { desc: 'Updated controlled test campaign', assetStatus: 'approved', status: 'active' });
assert.equal(updated.assetStatus, 'approved', 'existing campaigns should be explicitly approvable after asset validation');
assert.equal(updated.status, 'active', 'approved campaigns should be able to remain active');
const beforeImpressions = Number(updated.impressions || 0);
const beforeClicks = Number(updated.clicks || 0);
assert.equal(await recordAdImpression(Number(updated.id)), true, 'rendered campaign impressions should be recorded');
assert.equal(await recordAdClick(Number(updated.id)), true, 'campaign clicks should be recorded through the canonical tracker');
const tracked = (await getAdCampaigns()).find(campaign => Number(campaign.id) === Number(updated.id));
assert.equal(Number(tracked?.impressions), beforeImpressions + 1, 'impression counter should increment once');
assert.equal(Number(tracked?.clicks), beforeClicks + 1, 'click counter should increment once');

const matched = await matchAdCampaigns('convergence discovery');
assert.ok(matched.some(campaign => campaign.title === title), 'public ad matching should use the ad manager authority');
console.log(`Advertising regression passed: ${firstParty.length} first-party campaigns and one managed external campaign verified.`);
