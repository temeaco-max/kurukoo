/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-places-truth-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'test';
process.env.KURUKOO_FCM_PROJECT_ID = '';

const { getDb } = await import('../src/database.js');
const places = await import('../src/services/placeService.js');
const { seedDemoPlaces } = await import('../src/database.js');

const db0 = await getDb();
// Test databases stay unseeded (see allowDemoSeeds + test-demo-workspace-seed), so
// this contract seeds the pilot places explicitly, exactly as a test should.
seedDemoPlaces(db0);
const creator = '+2348011111111';
const resident = '+2348022222222';

// Phase 0: place with partial reality — unsourced fields must stay missing, never invented.
const place = await places.createPlace(creator, {
  name: 'Oke-Afa Vision Grounds',
  state: 'Enugu',
  lga: 'Enugu South',
  centerLat: 6.4249,
  centerLng: 7.5139,
  reality: { schools: { count: 1, confidence: 'community-reported' } },
});
assert.ok(place.slug, 'place gets a slug');
assert.equal(place.status, 'observed');
assert.equal(place.confidence.schools, 'community-reported');

// Pilot seeds: Abuja, Enugu (+ Lagos, Ibadan, Port Harcourt). Geocoded centres,
// empty reality, no invented community signal.
const expectedSeeds: Array<[string, number, number]> = [
  ['garki-abuja', 9.0131, 7.4813],
  ['wuse-abuja', 9.062, 7.4666],
  ['lugbe-phase-2-abuja', 8.991, 7.3575],
  ['independence-layout-enugu', 6.443, 7.5197],
  ['trans-ekulu-enugu', 6.4792, 7.4884],
  ['gra-enugu', 6.4602, 7.4944],
  ['ikeja-lagos', 6.6016, 3.3516],
  ['lekki-phase-1-lagos', 6.436, 3.4512],
  ['old-bodija-ibadan', 7.4173, 3.9021],
  ['old-gra-port-harcourt', 4.779, 7.0125],
];
for (const [slug, lat, lng] of expectedSeeds) {
  const seeded = await places.getPlaceBySlug(slug);
  assert.ok(seeded, `pilot place exists: ${slug}`);
  assert.equal(seeded.status, 'observed');
  assert.deepEqual(Object.keys(seeded.reality || {}), [], `${slug} seeds no reality claims`);
  assert.ok(Math.abs(seeded.centerLat - lat) < 1e-9 && Math.abs(seeded.centerLng - lng) < 1e-9, `${slug} centre matches geocoded anchor`);
  const seedConcepts = await places.listConceptsForPlace(seeded.id);
  assert.equal(seedConcepts.length, 0, `${slug} seeds no invented concepts or votes`);
}
const abujaSeedNeeds = await places.computeNeeds('garki-abuja');
assert.ok(abujaSeedNeeds.every((n: any) => n.gap === 'unknown' && n.confidence === 'missing'), 'seeded places stay honestly unknown until surveyed');

// Phase 2 (early): needs must not fabricate — unknown stays unknown.
const needs = await places.computeNeeds(place.slug);
const clinics = needs.find((n: any) => n.category === 'healthcare');
assert.equal(clinics.current, 'unknown');
assert.equal(clinics.gap, 'unknown');
assert.equal(clinics.confidence, 'missing');
const schools = needs.find((n: any) => n.category === 'schools');
assert.equal(schools.current, '1');
assert.equal(schools.gap, 'high');
assert.match(schools.evidence, /indicative/i, 'unsourced counts are labelled indicative');

// Phase 1: concepts + one-vote-per-person + fork evolution.
const concept = await places.createConcept(creator, place.slug, {
  title: 'A neighbourhood centre with market and clinic',
  description: 'A low-rise centre with twenty market stalls, a small clinic, drainage and a playground on the open ground.',
  scenario: 'community_growth',
});
assert.equal(concept.status, 'published');
const voted = await places.voteConcept(resident, concept.id, 1, 'lives_here');
assert.equal(voted.votes.support, 1);
assert.equal(voted.votes.byRole.lives_here, 1);
const revoted = await places.voteConcept(resident, concept.id, -1, 'lives_here');
assert.equal(revoted.votes.support, 0, 're-vote replaces the previous vote');
assert.equal(revoted.votes.oppose, 1);
const fork = await places.forkConcept(resident, concept.id, {
  title: 'Neighbourhood centre with market, clinic and park',
  description: 'Fork of the centre concept that keeps the market and clinic but adds a green park edge and pedestrian spine.',
  scenario: 'green',
});
assert.equal(fork.parentConceptId, concept.id);
assert.equal(fork.version, 2);

// Sponsored concepts must carry their label.
const sponsored = await places.createConcept(creator, place.slug, {
  title: 'Sponsored mixed-use block',
  description: 'A developer-sponsored mixed-use block concept for the same grounds, clearly labelled as sponsored.',
  scenario: 'commercial',
  sponsored: true,
  sponsorLabel: 'Example Developments Ltd',
});
assert.equal(sponsored.sponsored, true);
assert.equal(sponsored.sponsorLabel, 'Example Developments Ltd');

// Public views never leak phone numbers.
const detail = await places.getPlaceDetail(place.slug);
assert.ok(detail.concepts.length >= 3, 'losers are kept, not deleted');
assert.equal(detail.concepts[0].creatorPhone, undefined, 'creator phone is not public');

// Phase 2b: opportunity carries evidence + Chat continuation, linked to place/concept.
const opp = await places.publishPlaceOpportunity(creator, concept.id);
assert.match(opp.subtitle, /Recorded community signal/i);
assert.match(opp.subtitle, /not yet validated/i);
assert.match(opp.ctaLink, /\/chat\?prompt=/);

// Phase 3: make-real creates ONE canonical Economic Request, linked once.
const real = await places.makeConceptReal(creator, concept.id, 'Start with a surveyor.', 'land_surveyor');
assert.ok(real.economicRequest.id, 'economic request created');
assert.equal(real.economicRequest.skill, 'land_surveyor', 'make-real routes to the requested profession');
await assert.rejects(
  places.makeConceptReal(creator, concept.id),
  /already has a linked Economic Request/,
  'no second lifecycle for the same concept'
);
// A concept with no Economic Request yet, so the profession guard is what rejects it.
const wrongProfessionConcept = await places.createConcept(creator, place.slug, {
  title: 'Shaded communal courtyard',
  description: 'A shaded communal courtyard with seating and trees where residents can gather.',
  scenario: 'green',
});
await assert.rejects(
  places.makeConceptReal(creator, wrongProfessionConcept.id, '', 'plumber'),
  /must be one of/,
  'make-real only routes to development professions and general matching'
);
const { getSkillFlow } = await import('../src/services/skillFlows.js');
for (const skill of ['architect', 'urban_planner', 'civil_engineer', 'quantity_surveyor']) {
  const flow = await getSkillFlow(skill);
  assert.ok(flow && flow.category === 'professional-services', `${skill} has an explicit professional flow`);
}

// Radar: bounded, fuzzed, layered.
const radar = await places.getRadarLayers(6.4249, 7.5139, 5000);
const all = Object.values(radar.layers).flat() as any[];
assert.ok(all.length >= 1, 'pilot place appears on radar');
assert.ok(all.every((i: any) => Math.abs(i.lat * 1000 - Math.round(i.lat * 1000)) < 1e-9), 'radar coords are fuzzed');
await assert.rejects(places.getRadarLayers(Number.NaN, 7.5), /lat\/lng/, 'radar rejects bad coords');

console.log('Places truth contract passed: evidence-bound needs, one-vote voting, fork evolution, labelled sponsorship, opportunity + single Economic Request link, fuzzed radar.');

// --- Vision: free deterministic SVG always; hero only when an image backend exists. ---
// Hermetic: vision generation must never depend on network/quota in tests.
delete process.env.GEMINI_API_KEY;
delete process.env.API_KEY;
const vision = await import('../src/services/visionService.js');
const firstVision = await vision.requestConceptVision(creator, concept.id);
assert.ok(firstVision.svgUrl.endsWith('/vision.svg'), 'every concept gets a free SVG vision URL');
assert.equal(firstVision.heroUrl, null, 'no hero render without a configured image backend');
assert.match(firstVision.heroStatus, /unavailable/, 'missing image backend is reported honestly');
const secondVision = await vision.requestConceptVision(creator, concept.id);
assert.equal(secondVision.svgUrl, firstVision.svgUrl, 'vision URLs are stable per revision');
const svgA = vision.buildMassingSvg(concept.title, 'community_growth', `${concept.id}:v1`);
const svgB = vision.buildMassingSvg(concept.title, 'community_growth', `${concept.id}:v1`);
assert.equal(svgA, svgB, 'SVG massing is deterministic');
assert.match(svgA, /Illustrative massing/, 'honesty caption is baked into the render');
const svgFetch = await vision.getConceptVisionSvg('no-such-concept');
assert.equal(svgFetch, null, 'unknown concept vision is null, not a placeholder');

// --- Live geo: pure parser, fail-closed fetch, labelled merge. ---
const geo = await import('../src/services/placeGeoService.js');
const fixture = [
  { type: 'node', id: 1, lat: 6.425, lon: 7.514, tags: { amenity: 'school', name: 'Community School' } },
  { type: 'node', id: 2, lat: 6.426, lon: 7.515, tags: { amenity: 'clinic' } },
  { type: 'node', id: 3, lat: 6.427, lon: 7.516, tags: { amenity: 'marketplace' } },
  { type: 'node', id: 4, lat: 6.428, lon: 7.517, tags: { leisure: 'park' } },
  { type: 'node', id: 5, lat: 6.429, lon: 7.518, tags: { highway: 'bus_stop' } },
  { type: 'node', id: 6, lat: 6.43, lon: 7.519, tags: { natural: 'water' } },
  { type: 'way', id: 7, tags: { highway: 'residential' } },
  { type: 'node', id: 1, lat: 6.425, lon: 7.514, tags: { amenity: 'school', name: 'Community School' } },
];
const parsed = geo.parseOverpassElements(fixture);
assert.equal(parsed.schools, 1, 'duplicate OSM ids are counted once');
assert.equal(parsed.healthcare, 1);
assert.equal(parsed.retail, 1);
assert.equal(parsed.green_space, 1);
assert.equal(parsed.public_transport, 1);
assert.equal(parsed.water_bodies, 1);
assert.equal(parsed.road_ways, 1);

const stubFetch = (async (url: unknown) => {
  const target = String(url);
  if (target.includes('/route/v1/')) return { ok: true, json: async () => ({ routes: [{ duration: 600, distance: 800 }] }) };
  if (target.includes('opentopodata') || target.includes('elevation')) return { ok: true, json: async () => ({ results: [{ elevation: 150 }] }) };
  return { ok: true, json: async () => ({ elements: fixture }) };
}) as unknown as typeof fetch;
const refreshed = await geo.refreshPlaceReality(place.slug, 1000, stubFetch);
assert.equal(refreshed.source, 'OpenStreetMap contributors via Overpass');
assert.equal(refreshed.counts.schools, 1);
assert.equal((refreshed.connectivity as any).nearest_school?.walk_seconds, 600, 'real routing enriches connectivity');
assert.equal((refreshed.terrain as any).elevation_m, 150, 'real elevation enriches terrain');
const afterRefresh = await places.getPlaceBySlug(place.slug);
assert.equal(afterRefresh.confidence.schools, 'community-reported');
assert.equal(afterRefresh.reality.schools.source, 'OpenStreetMap contributors via Overpass');
assert.ok(afterRefresh.reality.schools.fetched_at, 'live counts carry fetch time');
const refreshedNeeds = await places.computeNeeds(place.slug);
assert.equal(refreshedNeeds.find((n: any) => n.category === 'schools').current, '1');

const failingFetch = (async () => { throw new Error('no network'); }) as unknown as typeof fetch;
const beforeFail = JSON.stringify((await places.getPlaceBySlug(place.slug)).reality);
await assert.rejects(geo.refreshPlaceReality(place.slug, 1000, failingFetch), /unchanged/, 'unreachable geo source fails closed');
assert.equal(JSON.stringify((await places.getPlaceBySlug(place.slug)).reality), beforeFail, 'failed refresh writes nothing');
process.env.KURUKOO_OVERPASS_URL = 'http://127.0.0.1:9/unreachable';
await assert.rejects(geo.refreshPlaceReality(place.slug), /unchanged/, 'URL override is honoured');
delete process.env.KURUKOO_OVERPASS_URL;

// --- Creator rewards: sustained support pays once through existing points rails. ---
const rewardCreator = '+2348033333333';
const rewardPlace = await places.createPlace(rewardCreator, { name: 'Reward Test Grounds', centerLat: 6.5, centerLng: 7.5 });
const rewardConcept = await places.createConcept(rewardCreator, rewardPlace.slug, {
  title: 'Ten supporters community hall vision for testing',
  description: 'A hall concept that will gather ten distinct supporters to trigger the creator milestone exactly once.',
  scenario: 'community_growth',
});
const rdb = await getDb();
rdb.run(`INSERT OR REPLACE INTO memory_profiles(phone,name,country,points_balance,subscription_tier) VALUES(?,?,?,?,?)`, [rewardCreator, 'Reward Creator', 'ng', 0, 'Base']);
const balanceOf = () => Number(rdb.exec(`SELECT COALESCE(points_balance,0) FROM memory_profiles WHERE phone=?`, [rewardCreator])[0]?.values?.[0]?.[0]);
for (let i = 0; i < 10; i++) {
  await places.voteConcept(`+23481000000${String(i).padStart(2, '0')}`, rewardConcept.id, 1, 'interested');
}
assert.equal(balanceOf(), 5, 'creator earns the milestone reward exactly once at threshold');
await places.voteConcept('+2348100000011', rewardConcept.id, 1, 'interested');
assert.equal(balanceOf(), 5, 'no double reward past threshold');
assert.equal((await places.getConcept(rewardConcept.id, rewardCreator)).rewarded, true);

// --- Leaderboard + scenario guard. ---
const rewardDetail = await places.getPlaceDetail(rewardPlace.slug);
assert.ok(Array.isArray(rewardDetail.creators) && rewardDetail.creators.length === 1, 'place detail carries creators');
assert.equal(rewardDetail.creators[0].support, 11);
assert.equal(rewardDetail.creators[0].displayName, 'Community creator', 'private profiles stay anonymous');
assert.ok(rewardDetail.disclaimers && rewardDetail.disclaimers.votes, 'detail carries disclaimers');
await assert.rejects(
  places.createConcept(rewardCreator, rewardPlace.slug, { title: 'Invalid scenario concept attempt here', description: 'A sufficiently long description so validation reaches the scenario check first.', scenario: 'utopia' }),
  /Unknown concept scenario/,
  'scenarios stay a fixed enum, not a stealth taxonomy'
);

// --- District pulse, imagery epochs, land-registry seam. ---
const pulse = await places.getDistrictPulse('Enugu');
assert.ok(pulse.places >= 1, 'district pulse aggregates real places');
assert.ok(Array.isArray(pulse.topGaps), 'district pulse carries gaps');
assert.ok(Array.isArray(pulse.leadingConcepts), 'district pulse carries leading concepts');
assert.match(pulse.disclaimer, /labelled place data only/, 'aggregation disclaimer is honest');
await assert.rejects(places.getDistrictPulse(''), /state must be between/, 'district pulse requires a state');

const epochsEmpty = await places.listImageryEpochs(place.id);
assert.deepEqual(epochsEmpty, [], 'imagery epochs start honestly empty');
const epochs = await places.recordImageryEpoch(place.id, { epochLabel: '2024', capturedAt: '2024-06-01', source: 'Test imagery source', note: 'Recorded through the ingestion seam' });
assert.equal(epochs.length, 1);
assert.equal(epochs[0].source, 'Test imagery source');

const seamDetail = await places.getPlaceDetail(place.slug);
assert.equal(seamDetail.landRegistries.length, 2, 'land-registry seam is visible');
assert.ok(seamDetail.landRegistries.every((r: any) => r.status === 'not_connected'), 'unconnected registries are labelled, not hidden');

// --- Discover plumbing: places section, follow/unfollow through canonical boundary. ---
const discover = await import('../src/services/discoverExperience.js');
const home = await discover.getDiscoverHome({ latitude: 6.4249, longitude: 7.5139, radiusMetres: 10000 });
assert.ok(Array.isArray((home as any).sections.places), 'discover home carries a places section');
assert.ok(((home as any).sections.places as any[]).length >= 1, 'pilot place surfaces in discover');
const placeItem = ((home as any).sections.places as any[])[0];
assert.equal(placeItem.type, 'place');
assert.equal(placeItem.chatAction.type, 'open_place');
const followPhone = '+2348200000001';
const recorded = await discover.recordDiscoverAction(followPhone, 'place', `place:${place.id}`, 'follow');
assert.equal(recorded.ok, true);
await assert.rejects(discover.recordDiscoverAction(followPhone, 'place', `place:${place.id}`, 'watch'), /use follow/, 'place watches redirect to follow');
const removed = await discover.removeDiscoverAction(followPhone, 'place', `place:${place.id}`, 'follow');
assert.equal(removed.revoked, true);
// --- Follows: people who care about an area, re-engaged through canonical notify. ---
const relationships = await import('../src/services/relationshipService.js');
const follow = await relationships.createRelationship(resident, { targetType: 'place', targetId: place.id, relationshipType: 'follow' });
assert.equal(follow.relationship.targetType, 'place');
const updateConcept = await places.createConcept(creator, place.slug, {
  title: 'Riverside walk with shade trees',
  description: 'A shaded riverside walking path with benches, lighting and drainage swales along the water edge.',
  scenario: 'green',
});
const db = await getDb();
const notes = db.exec(`SELECT title, link FROM internal_notifications WHERE phone=? ORDER BY id DESC LIMIT 5`, [resident]);
const titles = (notes[0]?.values || []).map((row: unknown[]) => String(row[0]));
assert.ok(titles.some((t: string) => t.includes(place.name)), 'place followers are notified of new concepts');
await assert.rejects(
  relationships.createRelationship(resident, { targetType: 'place', targetId: 'no-such-place', relationshipType: 'follow' }),
  /not found/,
  'cannot follow a place that does not exist'
);

// --- Chat → Place: deterministic intent path, no model call, no invented areas. ---
const { routeIntent } = await import('../src/services/intentRouter.js');
const garkiTurn = await routeIntent('show me what Garki could become');
assert.equal(garkiTurn.skill, 'general_question');
assert.equal(garkiTurn.classificationSource, 'rules', 'place resolution is deterministic, not a model call');
assert.equal((garkiTurn.cardData as any)?.type, 'place_card');
assert.equal((garkiTurn.cardData as any)?.slug, 'garki-abuja');
assert.match(garkiTurn.reply, /Garki/);
const identityGuard = await routeIntent('show me what Garki could become');
assert.equal((identityGuard.cardData as any)?.type, 'place_card', 'area questions must not be captured as identity input');
const unknownTurn = await routeIntent('show me what Maitama could become');
assert.equal((unknownTurn.cardData as any)?.type, 'place_clarification', 'unknown areas get a deterministic clarification card');
assert.ok(((unknownTurn.cardData as any).knownPlaces as any[]).length >= 1, 'clarification lists only real places');
assert.match(unknownTurn.reply, /never guess an area/, 'clarification refuses to invent an area');
assert.ok(!(unknownTurn.cardData as any)?.slug, 'unknown areas get no place card');
assert.match(unknownTurn.reply, /Garki/, 'clarification names only places that exist');
const vagueTurn = await routeIntent('what could this area become');
assert.equal(vagueTurn.progressStage, 'understanding', 'area without a name asks for clarification');
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.KURUKOO_WORKERS = '0';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
const jwt = (await import('jsonwebtoken')).default;
const { app } = await import('../src/index.js');
const server = app.listen(0);
const address = server.address();
assert.ok(address && typeof address === 'object');
const baseUrl = `http://127.0.0.1:${(address as any).port}`;
const bearer = (phone: string) => ({ Authorization: `Bearer ${jwt.sign({ phone, role: 'user' }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '10m' })}`, 'Content-Type': 'application/json' });
  const adminBearer = (phone: string) => ({ Authorization: `Bearer ${jwt.sign({ phone, role: 'admin' }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '10m' })}`, 'Content-Type': 'application/json' });
try {
  const scenarios = await fetch(`${baseUrl}/api/place-scenarios`);
  assert.equal(scenarios.status, 200);

  const unknownPage = await fetch(`${baseUrl}/places/no-such-place-xyz`);
  assert.equal(unknownPage.status, 404, 'unknown place slug stays 404');

  const knownPage = await fetch(`${baseUrl}/places/${place.slug}`);
  assert.ok([200, 503].includes(knownPage.status), 'known place slug serves SPA content or a truthful 503');
  if (knownPage.status === 503) assert.match(await knownPage.text(), /app build/, '503 names the missing SPA build');

  const svgRes = await fetch(`${baseUrl}/api/concepts/${concept.id}/vision.svg`);
  assert.equal(svgRes.status, 200);
  assert.match(svgRes.headers.get('content-type') || '', /svg/, 'vision served as SVG');

  const heroRes = await fetch(`${baseUrl}/api/concepts/${concept.id}/hero.png`);
  assert.equal(heroRes.status, 404, 'missing hero render is a truthful 404, not a placeholder');

  const anonVote = await fetch(`${baseUrl}/api/concepts/${concept.id}/vote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: 1, role: 'interested' }) });
  assert.equal(anonVote.status, 401, 'voting requires authentication');

  const authedVote = await fetch(`${baseUrl}/api/concepts/${concept.id}/vote`, { method: 'POST', headers: bearer(resident), body: JSON.stringify({ value: 1, role: 'lives_here' }) });
  assert.equal(authedVote.status, 200);
  assert.equal((await authedVote.json() as any).votes.support, 1);

  const heroGen = await fetch(`${baseUrl}/api/concepts/${concept.id}/vision`, { method: 'POST', headers: bearer(creator), body: '{}' });
  assert.equal(heroGen.status, 201);
  assert.equal((await heroGen.json() as any).heroUrl, null);

  // Approval workflow: support is not approval; authority decisions are recorded.
  const approvalReq = await fetch(`${baseUrl}/api/concepts/${concept.id}/approval`, { method: 'POST', headers: bearer(creator), body: JSON.stringify({ authority: 'AMAC planning', note: 'Pilot review request' }) });
  assert.equal(approvalReq.status, 201);
  const approval = (await approvalReq.json()) as any;
  assert.equal(approval.status, 'requested');
  const userReview = await fetch(`${baseUrl}/api/admin/approvals/${approval.id}`, { method: 'PATCH', headers: bearer(creator), body: JSON.stringify({ status: 'approved' }) });
  assert.equal(userReview.status, 403, 'approval review requires the admin role');
  const adminReview = await fetch(`${baseUrl}/api/admin/approvals/${approval.id}`, { method: 'PATCH', headers: adminBearer('+2348099999999'), body: JSON.stringify({ status: 'approved', note: 'Fits the pilot' }) });
  assert.equal(adminReview.status, 200);
  assert.equal(((await adminReview.json()) as any).status, 'approved');
  const approvalsList = await fetch(`${baseUrl}/api/places/${place.slug}/approvals`);
  assert.equal(approvalsList.status, 200);
  assert.ok((((await approvalsList.json()) as any).approvals as any[]).length >= 1, 'approvals are publicly listed');

  // Pilot poster: QR opens Chat with the place in context.
  const poster = await fetch(`${baseUrl}/api/places/${place.slug}/poster`);
  assert.equal(poster.status, 200);
  const posterBody = (await poster.json()) as any;
  assert.ok(String(posterBody.svg).includes('<svg'), 'poster carries a printable QR');
  assert.ok(String(posterBody.whatsappShareUrl).startsWith('https://wa.me/'), 'poster carries a share link');
  const unknownPoster = await fetch(`${baseUrl}/api/places/no-such-place/poster`);
  assert.equal(unknownPoster.status, 404);

  const act = await fetch(`${baseUrl}/api/proactive/${opp.id}/act`, { method: 'POST', headers: bearer(creator), body: '{}' });
  assert.equal(act.status, 200, 'opportunity act has an HTTP route');
  const dismiss = await fetch(`${baseUrl}/api/proactive/${opp.id}/dismiss`, { method: 'POST', headers: bearer(creator), body: '{}' });
  assert.equal(dismiss.status, 200, 'opportunity dismiss has an HTTP route');

  const adminList = await fetch(`${baseUrl}/api/admin/places`, { headers: adminBearer('+2348099999999') });
  assert.equal(adminList.status, 200);
  assert.ok(((await adminList.json()) as any).places.length >= 1, 'admin sees places with counts');
  const userAdminList = await fetch(`${baseUrl}/api/admin/places`, { headers: bearer(creator) });
  assert.equal(userAdminList.status, 403, 'admin routes reject non-admin roles');
  const remove = await fetch(`${baseUrl}/api/admin/concepts/${fork.id}/status`, { method: 'PATCH', headers: adminBearer('+2348099999999'), body: JSON.stringify({ status: 'removed' }) });
  assert.equal(remove.status, 200);
  const afterRemoval = await places.getPlaceDetail(place.slug);
  assert.ok(afterRemoval.concepts.every((c: any) => c.id !== fork.id), 'removed concepts leave every public surface');
  await assert.rejects(places.voteConcept(resident, fork.id, 1, 'interested'), /removed/, 'votes on removed concepts are inert');
  const badStatus = await fetch(`${baseUrl}/api/admin/concepts/${concept.id}/status`, { method: 'PATCH', headers: adminBearer('+2348099999999'), body: JSON.stringify({ status: 'demolished' }) });
  assert.equal(badStatus.status, 400, 'admin statuses stay in the lifecycle vocabulary');

  const badRadar = await fetch(`${baseUrl}/api/places-radar`);
  assert.equal(badRadar.status, 400, 'radar rejects unbounded queries');

  const sitemap = await fetch(`${baseUrl}/sitemap-places.xml`);
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers.get('content-type') || '', /xml/, 'places sitemap is XML');
  assert.match(await sitemap.text(), /\/places\//, 'sitemap lists place URLs');

  const pulseRes = await fetch(`${baseUrl}/api/district-pulse?state=Enugu`);
  assert.equal(pulseRes.status, 200);
  assert.ok(((await pulseRes.json()) as any).places >= 1, 'district pulse serves aggregates');
  const pulseBad = await fetch(`${baseUrl}/api/district-pulse`);
  assert.equal(pulseBad.status, 400, 'district pulse requires a state');

  const imageryRes = await fetch(`${baseUrl}/api/places/${place.slug}/imagery`);
  assert.equal(imageryRes.status, 200);
  assert.ok(Array.isArray(((await imageryRes.json()) as any).epochs), 'imagery epochs endpoint serves (possibly empty)');

  const anonRefresh = await fetch(`${baseUrl}/api/places/${place.slug}/refresh-reality`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(anonRefresh.status, 401, 'live geo refresh requires authentication');

  // Report gate: Base tier gets 402 with an upgrade path, never the report.
  const gatedReport = await fetch(`${baseUrl}/api/places/${place.slug}/report`, { headers: bearer(creator) });
  assert.equal(gatedReport.status, 402, 'developer intelligence is gated, participation is not');
  const gatedBody = (await gatedReport.json()) as any;
  assert.equal(gatedBody.payment_required, true);
  assert.ok(gatedBody.upgrade, 'gate names the upgrade path');
  const tdb = await getDb();
  tdb.run(`INSERT OR REPLACE INTO memory_profiles(phone,subscription_tier,country) VALUES(?, 'Plus', 'ng')`, [creator]);
  const openReport = await fetch(`${baseUrl}/api/places/${place.slug}/report`, { headers: bearer(creator) });
  assert.equal(openReport.status, 200);
  assert.ok(((await openReport.json()) as any).place, 'entitled callers get the report');

  // Promotions: truthful empty until the placement is bought.
  const promos = await fetch(`${baseUrl}/api/places/${place.slug}/promotions`);
  assert.equal(promos.status, 200);
  assert.deepEqual(((await promos.json()) as any).promotions, [], 'no invented sponsorships');
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

console.log('Places HTTP contract passed: detail chain, vision assets, authenticated votes, opportunity act/dismiss, bounded radar.');
try { fs.unlinkSync(dbPath); } catch {}
