import assert from 'node:assert/strict';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-topics-convergence-${process.pid}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.KURUKOO_WORKERS = '0';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'topics_convergence_test_secret_32_chars';
process.env.CREDIT_ECONOMY_ENABLED = 'true';

const { app } = await import('../src/index.js');
const { getDb, saveDb } = await import('../src/database.js');
const db = await getDb();
const author = '+2348010021001';
const other = '+2348010021002';
const moderator = '+2348010021099';
for (const [phone, name] of [[author, 'Topic Author'], [other, 'Other Member'], [moderator, 'Moderator']] as const) {
  db.run(`INSERT OR REPLACE INTO memory_profiles(phone,name,country,points_balance,subscription_tier) VALUES(?,?,?,?,?)`, [phone, name, 'ng', 0, 'Base']);
}
saveDb();

const token = (phone: string, role = 'user') => jwt.sign({ phone, role }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '10m' });
const headers = (phone: string, role = 'user') => ({ Authorization: `Bearer ${token(phone, role)}`, 'Content-Type': 'application/json' });
const server = app.listen(0);
const address = server.address();
assert.ok(address && typeof address === 'object');
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const initial = await fetch(`${baseUrl}/api/topics`);
  assert.equal(initial.status, 200);
  assert.equal((await initial.json() as { topics: unknown[] }).topics.length, 0, 'empty public Topics must remain a truthful empty state');

  const invalidCategory = await fetch(`${baseUrl}/api/topics`, { method: 'POST', headers: headers(author), body: JSON.stringify({ title: 'Question about a useful repair service', body: 'I am trying to understand whether there is a reliable approach for this repair.', category: 'forum-general' }) });
  assert.equal(invalidCategory.status, 400, 'Topics must reject a parallel category taxonomy');

  const preciseLocation = await fetch(`${baseUrl}/api/topics`, { method: 'POST', headers: headers(author), body: JSON.stringify({ title: 'Question about a useful repair service', body: 'I am trying to understand whether there is a reliable approach for this repair.', city: '12 Banana Island Road' }) });
  assert.equal(preciseLocation.status, 400, 'Topics must reject a precise public address');

  const created = await fetch(`${baseUrl}/api/topics`, { method: 'POST', headers: { ...headers(author), 'Idempotency-Key': 'topic-create-idempotency-key-0001' }, body: JSON.stringify({
    title: 'Where can a neighbour learn safe generator maintenance?',
    body: 'I am looking for community context about safe generator maintenance in Ibadan. This is a question, not a confirmed provider or availability claim. The discussion should focus on safe maintenance steps, how to assess a public recommendation, and when to ask Kurukoo for a separate supported next step. It does not establish a provider, current availability, price, booking, payment, delivery, or fulfilment outcome.',
    type: 'question', category: 'repairs-maintenance', skills: ['generator_repairer'], city: 'Ibadan', lga: 'Ibadan North',
  }) });
  const createdPayload = await created.json() as { topic?: { id: string; slug: string; status: string; authorPhone?: string } };
  assert.equal(created.status, 201, JSON.stringify(createdPayload));
  assert.equal(createdPayload.topic?.status, 'submitted');
  assert.equal(createdPayload.topic?.authorPhone, author, 'owner views retain the existing authenticated identity reference only');
  const topicId = createdPayload.topic!.id;
  const slug = createdPayload.topic!.slug;
  const idempotentCreate = await fetch(`${baseUrl}/api/topics`, { method: 'POST', headers: { ...headers(author), 'Idempotency-Key': 'topic-create-idempotency-key-0001' }, body: JSON.stringify({ title: 'Where can a neighbour learn safe generator maintenance?', body: 'I am looking for community context about safe generator maintenance in Ibadan. This is a question, not a confirmed provider or availability claim. The discussion should focus on safe maintenance steps, how to assess a public recommendation, and when to ask Kurukoo for a separate supported next step. It does not establish a provider, current availability, price, booking, payment, delivery, or fulfilment outcome.', type: 'question', category: 'repairs-maintenance', skills: ['generator_repairer'], city: 'Ibadan', lga: 'Ibadan North' }) });
  const idempotentPayload = await idempotentCreate.json() as { topic?: { id?: string; idempotent?: boolean } };
  assert.equal(idempotentCreate.status, 200, JSON.stringify(idempotentPayload));
  assert.equal(idempotentPayload.topic?.id, topicId, 'an idempotency-key replay must return the original Topic');
  assert.equal(idempotentPayload.topic?.idempotent, true);

  const publicBeforeModeration = await fetch(`${baseUrl}/api/topics/${encodeURIComponent(slug)}`);
  assert.equal(publicBeforeModeration.status, 404, 'submitted Topics must not be publicly projected');

  const mine = await fetch(`${baseUrl}/api/topics/mine/${topicId}`, { headers: headers(author) });
  assert.equal(mine.status, 200);
  assert.equal((await mine.json() as { topic?: { status?: string } }).topic?.status, 'submitted');

  const forbiddenEdit = await fetch(`${baseUrl}/api/topics/${topicId}`, { method: 'PUT', headers: headers(other), body: JSON.stringify({ title: 'Where can a neighbour learn safe generator maintenance?', body: 'This should not be permitted because the caller does not own it.' }) });
  assert.equal(forbiddenEdit.status, 403, 'a Topic cannot be edited by another user');

  const moderationQueue = await fetch(`${baseUrl}/api/admin/topics/submitted`, { headers: headers(moderator, 'admin') });
  assert.equal(moderationQueue.status, 200);
  assert.ok((await moderationQueue.json() as { topics?: Array<{ id: string }> }).topics?.some((topic) => topic.id === topicId));

  const published = await fetch(`${baseUrl}/api/admin/topics/${topicId}/moderate`, { method: 'POST', headers: headers(moderator, 'admin'), body: JSON.stringify({ decision: 'public', note: 'Community question permitted as context, not a provider claim.' }) });
  assert.equal(published.status, 200, await published.text());

  const malformed = await fetch(`${baseUrl}/api/topics`, { method: 'POST', headers: { ...headers(author), 'Idempotency-Key': 'topic-malformed-json-key-0001' }, body: '{' });
  assert.equal(malformed.status, 400, 'malformed JSON must use the normal API error contract');

  const publicList = await fetch(`${baseUrl}/api/topics?category=repairs-maintenance`);
  const publicListPayload = await publicList.json() as { topics?: Array<{ id: string; authorPhone?: string; category?: string }> };
  assert.equal(publicList.status, 200);
  assert.ok(publicListPayload.topics?.some((topic) => topic.id === topicId && topic.category === 'repairs-maintenance'));
  assert.equal(publicListPayload.topics?.[0]?.authorPhone, undefined, 'public Topic projection must not expose a user phone/identity field');

  const publicTopic = await fetch(`${baseUrl}/api/topics/${encodeURIComponent(slug)}`);
  const publicTopicPayload = await publicTopic.json() as { topic?: { id?: string; replies?: unknown[]; authorPhone?: string; body?: string } };
  assert.equal(publicTopic.status, 200, JSON.stringify(publicTopicPayload));
  assert.equal(publicTopicPayload.topic?.id, topicId);
  assert.equal(publicTopicPayload.topic?.authorPhone, undefined, 'public detail must keep author identity private');
  assert.match(String(publicTopicPayload.topic?.body), /not a confirmed provider/i);
  const chatContext = await fetch(`${baseUrl}/api/topics/${encodeURIComponent(slug)}/chat-context`);
  assert.equal(chatContext.status, 200);
  assert.equal((await chatContext.json() as { topic?: { slug?: string; provenance?: string; authorPhone?: string } }).topic?.provenance, 'community_statement');
  const discovered = await fetch(`${baseUrl}/api/discover/community-context?category=repairs-maintenance`);
  assert.equal(discovered.status, 200);
  assert.ok((await discovered.json() as { items?: Array<{ id?: string; provenance?: string; authorPhone?: string }> }).items?.some((item) => item.id === topicId && item.provenance === 'community_statement' && item.authorPhone === undefined));
  db.run(`INSERT INTO content(slug,title,body,type,author) VALUES(?,?,?,?,?)`, ['generator-safety-guide', 'Generator safety guide', 'Editorial guide for safe generator maintenance context.', 'help', 'admin']); saveDb();
  const linked = await fetch(`${baseUrl}/api/admin/topics/${topicId}/resources`, { method: 'POST', headers: headers(moderator, 'admin'), body: JSON.stringify({ resourceSlug: 'generator-safety-guide' }) });
  assert.equal(linked.status, 201, await linked.text());
  const linkedTopic = await fetch(`${baseUrl}/api/topics/${encodeURIComponent(slug)}`);
  assert.ok((await linkedTopic.json() as { topic?: { relatedResources?: Array<{ slug?: string }> } }).topic?.relatedResources?.some((resource) => resource.slug === 'generator-safety-guide'), 'a public Topic can project a curator-linked CMS resource without becoming CMS content');

  const reply = await fetch(`${baseUrl}/api/topics/${topicId}/replies`, { method: 'POST', headers: headers(other), body: JSON.stringify({ body: 'I would ask Kurukoo to help you identify the next safe request path instead of relying on this post as a provider record.' }) });
  const replyPayload = await reply.json() as { reply?: { id?: string; status?: string } };
  assert.equal(reply.status, 201, JSON.stringify(replyPayload));
  assert.equal(replyPayload.reply?.status, 'submitted');
  const replyId = replyPayload.reply!.id!;

  const hiddenReply = await fetch(`${baseUrl}/api/topics/${encodeURIComponent(slug)}`);
  assert.equal((await hiddenReply.json() as { topic: { replies: unknown[] } }).topic.replies.length, 0, 'submitted replies must not appear publicly');

  const replyModeration = await fetch(`${baseUrl}/api/admin/topics/replies/${replyId}/moderate`, { method: 'POST', headers: headers(moderator, 'admin'), body: JSON.stringify({ decision: 'public' }) });
  assert.equal(replyModeration.status, 200, await replyModeration.text());
  const publicReply = await fetch(`${baseUrl}/api/topics/${encodeURIComponent(slug)}`);
  assert.equal((await publicReply.json() as { topic: { replies: unknown[] } }).topic.replies.length, 1, 'only moderated replies are projected');

  const report = await fetch(`${baseUrl}/api/topics/${topicId}/report`, { method: 'POST', headers: headers(other), body: JSON.stringify({ reason: 'Please review wording for clarity' }) });
  const reportPayload = await report.json() as { report?: { id?: string; status?: string } };
  assert.equal(report.status, 201, JSON.stringify(reportPayload));
  assert.equal(reportPayload.report?.status, 'open');
  const duplicateReport = await fetch(`${baseUrl}/api/topics/${topicId}/report`, { method: 'POST', headers: headers(other), body: JSON.stringify({ reason: 'Please review wording for clarity' }) });
  const duplicateReportPayload = await duplicateReport.json() as { report?: { id?: string; idempotent?: boolean } };
  assert.equal(duplicateReport.status, 200);
  assert.equal(duplicateReportPayload.report?.id, reportPayload.report?.id);
  assert.equal(duplicateReportPayload.report?.idempotent, true);
  const reports = await fetch(`${baseUrl}/api/admin/topics/reports`, { headers: headers(moderator, 'admin') });
  assert.equal(reports.status, 200);
  assert.ok((await reports.json() as { reports?: Array<{ id: string; reporterPhone?: string }> }).reports?.some((item) => item.id === reportPayload.report?.id && item.reporterPhone === other), 'reporter identity remains in the private moderation queue only');

  const closeReport = await fetch(`${baseUrl}/api/admin/topics/reports/${reportPayload.report?.id}/close`, { method: 'POST', headers: headers(moderator, 'admin'), body: JSON.stringify({ note: 'Reviewed.' }) });
  assert.equal(closeReport.status, 200, await closeReport.text());

  const verificationTask = await fetch(`${baseUrl}/api/admin/tasks/topic-verification`, { method: 'POST', headers: headers(moderator, 'admin'), body: JSON.stringify({ topicId, verificationKind: 'factual_observation', creditsReward: 10 }) });
  const verificationPayload = await verificationTask.json() as { task?: { id?: number; sourceType?: string; sourceId?: string } };
  assert.equal(verificationTask.status, 201, JSON.stringify(verificationPayload));
  const taskId = verificationPayload.task?.id!;
  assert.equal(verificationPayload.task?.sourceType, 'topic'); assert.equal(verificationPayload.task?.sourceId, topicId);
  assert.equal((await fetch(`${baseUrl}/api/tasks/accept`, { method: 'POST', headers: headers(other), body: JSON.stringify({ taskId }) })).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/tasks/complete`, { method: 'POST', headers: headers(other), body: JSON.stringify({ taskId, result: 'I checked the cited public safety guidance and recorded the observation without claiming provider verification.' }) })).status, 201);
  const taskApproval = await fetch(`${baseUrl}/api/admin/tasks/${taskId}/moderate`, { method: 'POST', headers: headers(moderator, 'admin'), body: JSON.stringify({ decision: 'approved', note: 'Evidence accepted as an observation.' }) });
  assert.equal(taskApproval.status, 200, await taskApproval.text());
  const contributorPoints = db.exec(`SELECT COALESCE(points_balance, 0) FROM memory_profiles WHERE phone=?`, [other]);
  assert.equal(Number(contributorPoints[0].values[0][0]), 10, 'Points are awarded only by the existing approved contributor-task workflow, never for Topic engagement');

  const points = db.exec(`SELECT COALESCE(points_balance, 0) FROM memory_profiles WHERE phone=?`, [author]);
  assert.equal(Number(points[0].values[0][0]), 0, 'creating or publishing a Topic must not award Points');
  const economicTable = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='economic_requests'`);
  if (economicTable.length) {
    const economicRequests = db.exec(`SELECT COUNT(*) FROM economic_requests`);
    assert.equal(Number(economicRequests[0].values[0][0]), 0, 'Topic interaction must not create an economic request, payment, or fulfilment action');
  }
  assert.equal(economicTable.length, 0, 'Topic interaction must not initialize the economic request lifecycle');

  const indexPage = await fetch(`${baseUrl}/topics`);
  assert.equal(indexPage.status, 200);
  assert.match(await indexPage.text(), /Community context/);
  const detailPage = await fetch(`${baseUrl}/topics/${encodeURIComponent(slug)}`);
  assert.equal(detailPage.status, 200);
  const detailHtml = await detailPage.text();
  assert.match(detailHtml, /id="topic-detail"/);
  assert.match(detailHtml, /index,follow/, 'only the quality-gated public Topic receives indexable metadata');
  const sitemap = await fetch(`${baseUrl}/sitemap-topics.xml`); assert.equal(sitemap.status, 200); assert.match(await sitemap.text(), new RegExp(`/topics/${slug}`));
  const robots = await fetch(`${baseUrl}/robots.txt`); assert.equal(robots.status, 200); assert.match(await robots.text(), /sitemap-topics\.xml/);

  console.log('Topics convergence regression passed: minimal canonical public-content lifecycle, ownership, moderation, privacy, explicit chat handoff, and no parallel Points/economic side effects.');
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const suffix of ['', '-journal', '-wal', '-shm']) { try { fs.unlinkSync(`${dbPath}${suffix}`); } catch {} }
}
