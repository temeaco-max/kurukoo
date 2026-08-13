import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';

const dbPath = path.join(os.tmpdir(), `kurukoo-ad-placement-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'test';
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.KURUKOO_WORKERS = '0';
process.env.JWT_SECRET = 'ad_placement_system_test_secret_at_least_32_chars';
process.env.KURUKOO_AD_EVENT_SALT = 'ad_placement_system_event_salt';
const { app } = await import('../src/index.js');
const { createAdCampaign, getAdCampaigns, getCampaignPlacementMetrics, getPlacementMetrics, recordPublicAdPlacementEvent, resolvePublicAdPlacement, setAdCampaignStatus, setCampaignPlacements, updateAdPlacement } = await import('../src/services/adManager.js');

const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const sessionA = 'placement_session_A_123456789';
const sessionB = 'placement_session_B_123456789';
const adminToken = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '10m' });

try {
  const campaign = await createAdCampaign({
    title: 'Repair category sponsor',
    desc: 'Clearly disclosed campaign content for a repair category.',
    imageUrl: '',
    targetKeyword: 'repair',
    targetCategories: ['repairs-maintenance'],
    targetCountries: ['ng'],
    placementIds: ['category_inline'],
    creditsBudget: 2,
    placementSource: 'external_inventory',
    disclosure: 'Advertisement',
  });
  assert.deepEqual(campaign.campaign.placementIds, ['category_inline'], 'campaign placement assignment belongs to the canonical ad manager');

  const unknown = await resolvePublicAdPlacement({ placementId: 'does-not-exist', category: 'repairs-maintenance', country: 'ng', device: 'mobile', sessionId: sessionA });
  assert.equal(unknown.reason, 'unsafe_context', 'public callers cannot resolve unknown/private inventory');
  const excludedWorkspace = await resolvePublicAdPlacement({ placementId: 'workspace_daily_picks_sponsor', category: 'repairs-maintenance', country: 'ng', device: 'mobile', sessionId: sessionA });
  assert.equal(excludedWorkspace.reason, 'unsafe_context', 'public route cannot select the private workspace sponsor slot');
  const wrongCategory = await resolvePublicAdPlacement({ placementId: 'category_inline', category: 'food-drink', country: 'ng', device: 'mobile', sessionId: sessionA });
  assert.equal(wrongCategory.item, null, 'a category-targeted campaign is not served on an unrelated canonical category');
  const inactiveMarket = await resolvePublicAdPlacement({ placementId: 'category_inline', category: 'repairs-maintenance', country: 'ca', device: 'mobile', sessionId: sessionA });
  assert.equal(inactiveMarket.item, null, 'an inactive market cannot receive commercial inventory');
  const wrongCountry = await resolvePublicAdPlacement({ placementId: 'category_inline', category: 'repairs-maintenance', country: 'gh', device: 'mobile', sessionId: sessionA });
  assert.equal(wrongCountry.item, null, 'a country-targeted campaign is not served outside its configured coarse market');

  const resolved = await resolvePublicAdPlacement({ placementId: 'category_inline', category: 'repairs-maintenance', country: 'ng', device: 'mobile', sessionId: sessionA });
  assert.equal(resolved.reason, 'served');
  assert.equal(resolved.item?.source, 'campaign');
  assert.equal(resolved.item?.campaignId, campaign.campaign.id);
  assert.equal(resolved.item?.disclosure, 'Advertisement');
  assert.match(resolved.item?.boundary || '', /not a provider verification/i, 'placement language must preserve non-provider truthfulness');
  assert.equal('verified' in (resolved.item || {}), false, 'advertising projection has no provider-evidence field');

  const badToken = await recordPublicAdPlacementEvent({ placementId: 'category_inline', campaignId: campaign.campaign.id, source: 'campaign', eventType: 'impression', sessionId: sessionA, eventToken: 'forged', category: 'repairs-maintenance', country: 'ng', device: 'mobile' });
  assert.equal(badToken.recorded, false, 'measurement requires the server-issued opaque event token');
  const recorded = await recordPublicAdPlacementEvent({ placementId: 'category_inline', campaignId: campaign.campaign.id, source: 'campaign', eventType: 'impression', sessionId: sessionA, eventToken: resolved.item?.eventToken, category: 'repairs-maintenance', country: 'ng', device: 'mobile' });
  assert.equal(recorded.recorded, true, 'one visible disclosed campaign exposure is recorded');
  const duplicate = await recordPublicAdPlacementEvent({ placementId: 'category_inline', campaignId: campaign.campaign.id, source: 'campaign', eventType: 'impression', sessionId: sessionA, eventToken: resolved.item?.eventToken, category: 'repairs-maintenance', country: 'ng', device: 'mobile' });
  assert.equal(duplicate.recorded, false, 'a session cannot inflate an identical placement exposure');
  const capped = await resolvePublicAdPlacement({ placementId: 'category_inline', category: 'repairs-maintenance', country: 'ng', device: 'mobile', sessionId: sessionA });
  assert.equal(capped.reason, 'frequency_capped', 'the placement session cap removes repeat inventory');

  const secondSession = await resolvePublicAdPlacement({ placementId: 'category_inline', category: 'repairs-maintenance', country: 'ng', device: 'desktop', sessionId: sessionB });
  assert.equal(secondSession.reason, 'served', 'a separate opaque browser session can receive eligible inventory while budget remains');
  const click = await recordPublicAdPlacementEvent({ placementId: 'category_inline', campaignId: campaign.campaign.id, source: 'campaign', eventType: 'click', sessionId: sessionA, eventToken: resolved.item?.eventToken, category: 'repairs-maintenance', country: 'ng', device: 'mobile' });
  assert.equal(click.recorded, true, 'an explicit CTA click is measured separately from exposure');
  const metrics = await getPlacementMetrics();
  const categoryMetrics = metrics.find(metric => metric.placementId === 'category_inline');
  assert.equal(categoryMetrics?.impressions, 1);
  assert.equal(categoryMetrics?.clicks, 1);
  assert.match(categoryMetrics?.boundary || '', /not provider viewability certification/i);
  assert.equal((await getAdCampaigns()).find(item => item.id === campaign.campaign.id)?.creditsSpent, 1, 'only a recorded campaign impression advances the bounded delivery-unit cap');
  const campaignMetrics = (await getCampaignPlacementMetrics()).find(metric => metric.campaignId === campaign.campaign.id);
  assert.equal(campaignMetrics?.impressions, 1, 'campaign reporting derives impressions from canonical placement evidence');
  assert.equal(campaignMetrics?.clicks, 1, 'campaign reporting derives clicks from canonical placement evidence');
  assert.equal(campaignMetrics?.ctr, 1, 'campaign CTR is derived from recorded events, not estimated');

  await setAdCampaignStatus(campaign.campaign.id, 'paused');
  const paused = await resolvePublicAdPlacement({ placementId: 'category_inline', category: 'repairs-maintenance', country: 'ng', device: 'desktop', sessionId: 'placement_session_C_123456789' });
  assert.equal(paused.item, null, 'paused campaigns disappear from placement resolution immediately when no fallback inventory exists');
  const merchantResponse = await fetch(`${baseUrl}/api/admin/affiliate/merchants`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Approved repair merchant', websiteUrl: 'https://merchant.example.test/', countries: ['ng'], evidenceRef: 'placement-affiliate-merchant', status: 'active' }) });
  assert.equal(merchantResponse.status, 201);
  const merchant = await merchantResponse.json() as { merchant: { id: string } };
  const offerResponse = await fetch(`${baseUrl}/api/admin/affiliate/offers`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ merchantId: merchant.merchant.id, title: 'Maintenance partner referral', description: 'External repair maintenance referral.', externalUrl: 'https://merchant.example.test/repair', country: 'ng', evidenceRef: 'placement-affiliate-offer', status: 'active' }) });
  assert.equal(offerResponse.status, 201);
  const affiliate = await resolvePublicAdPlacement({ placementId: 'category_inline', category: 'repairs-maintenance', country: 'ng', device: 'desktop', sessionId: 'placement_session_F_123456789' });
  assert.equal(affiliate.item?.source, 'affiliate', 'an approved matching affiliate offer is the second canonical fallback after direct campaign inventory');
  assert.match(affiliate.item?.disclosure || '', /affiliate/i, 'affiliate fallback retains explicit external referral disclosure');
  assert.match(affiliate.item?.boundary || '', /not a Kurukoo verified provider/i, 'affiliate fallback does not inherit provider verification');
  await assert.rejects(() => setCampaignPlacements(campaign.campaign.id, ['chat_message']), /unknown or excluded placement/, 'campaigns cannot be assigned into private message inventory');
  await updateAdPlacement('category_inline', { active: false });
  const inactive = await resolvePublicAdPlacement({ placementId: 'category_inline', category: 'repairs-maintenance', country: 'ng', device: 'desktop', sessionId: 'placement_session_D_123456789' });
  assert.equal(inactive.reason, 'inactive_placement', 'deactivated inventory suppresses all campaigns');

  const publicResponse = await fetch(`${baseUrl}/api/advertising/placements/category_inline?category=repairs-maintenance&country=ng&device=mobile&sessionId=placement_session_E_123456789`);
  assert.equal(publicResponse.status, 200);
  assert.match(String(publicResponse.headers.get('cache-control')), /no-store/i, 'placement context responses are not shared-cacheable');
  const privateResponse = await fetch(`${baseUrl}/api/advertising/placements/workspace_daily_picks_sponsor?category=repairs-maintenance&country=ng&device=mobile&sessionId=placement_session_E_123456789`);
  assert.equal((await privateResponse.json() as { reason: string }).reason, 'unsafe_context', 'the public placement API cannot retrieve a private workspace slot');
  const adminAnonymous = await fetch(`${baseUrl}/api/admin/marketing/placements`);
  assert.equal(adminAnonymous.status, 401, 'placement inventory and aggregate evidence remain in the Admin boundary');
  const adminResponse = await fetch(`${baseUrl}/api/admin/marketing/placements`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(adminResponse.status, 200);
  const adminPayload = await adminResponse.json() as { placements?: unknown[]; metrics?: unknown[]; programmatic?: { provider?: string; status?: string; boundary?: string } };
  assert.ok(adminPayload.placements && adminPayload.placements.length >= 13, 'the Admin Control Room projects the canonical placement catalogue');
  assert.ok(Array.isArray(adminPayload.metrics), 'the Admin Control Room receives aggregate placement evidence');
  assert.equal(adminPayload.programmatic?.status, 'not_configured', 'programmatic inventory remains explicitly disabled without a reviewed provider adapter');
  assert.match(adminPayload.programmatic?.boundary || '', /no remote ad SDK/i, 'an absent provider does not produce a fake remote advertising integration');

  console.log('Canonical advertising placement regression passed');
  console.log('Verified: one canonical manager, public/private context exclusion, campaign-slot eligibility, category targeting, disclosure, no provider claim, event token, frequency cap, budget cap, pause/deactivation, aggregate evidence, cache privacy, and Admin authorization.');
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const suffix of ['', '-journal', '-wal', '-shm']) { try { fs.unlinkSync(`${dbPath}${suffix}`); } catch {} }
}
