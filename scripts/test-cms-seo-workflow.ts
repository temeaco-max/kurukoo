import assert from 'node:assert/strict';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-cms-seo-${process.pid}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.KURUKOO_WORKERS = '0';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'cms_seo_workflow_test_secret_with_32_chars';

const { app } = await import('../src/index.js');
const server = app.listen(0);
const address = server.address();
assert.ok(address && typeof address === 'object');
const baseUrl = `http://127.0.0.1:${address.port}`;
const token = jwt.sign({ username: 'cms-seo-operator', role: 'admin' }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '10m' });
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const adminFetch = async (pathName: string, options: RequestInit = {}) => fetch(`${baseUrl}${pathName}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });

try {
  const contentSave = await adminFetch('/api/admin/content', { method: 'POST', body: JSON.stringify({ slug: 'cms-seo-workflow-guide', title: 'CMS and SEO workflow guide', type: 'help', author: 'Kurukoo Team', body: 'A factual public guide for the test workflow.' }) });
  assert.equal(contentSave.status, 200);
  const resources = await fetch(`${baseUrl}/api/resources`);
  const resourcePayload = await resources.json();
  assert.ok(resourcePayload.resources.some((item: any) => item.slug === 'cms-seo-workflow-guide'), 'saved help content is projected through the public resource API');

  const pageSave = await adminFetch('/api/admin/seo/pages', { method: 'POST', body: JSON.stringify({ url_path: '/resources/cms-seo-workflow-guide', title: 'Initial metadata title', meta_description: 'First factual metadata description.' }) });
  assert.equal(pageSave.status, 200);
  const pageUpdate = await adminFetch('/api/admin/seo/pages', { method: 'POST', body: JSON.stringify({ url_path: '/resources/cms-seo-workflow-guide', title: 'Updated metadata title', meta_description: 'Updated factual metadata description.', keywords: 'cms, seo' }) });
  assert.equal(pageUpdate.status, 200);
  const pages = await adminFetch('/api/admin/seo/pages');
  const pagesPayload = await pages.json();
  assert.equal(pagesPayload.find((item: any) => item.url_path === '/resources/cms-seo-workflow-guide')?.title, 'Updated metadata title', 'metadata upsert performs a real edit at the canonical path key');

  const keywordSave = await adminFetch('/api/admin/seo/keywords', { method: 'POST', body: JSON.stringify({ keyword: 'cms seo workflow', locale: 'en', country: 'ng', search_volume: 0, difficulty: 18, tracked: true }) });
  assert.equal(keywordSave.status, 200);
  const keywordUpdate = await adminFetch('/api/admin/seo/keywords', { method: 'POST', body: JSON.stringify({ keyword: 'cms seo workflow', locale: 'en', country: 'ng', search_volume: 0, difficulty: 24, tracked: false }) });
  assert.equal(keywordUpdate.status, 200);
  const keywords = await adminFetch('/api/admin/seo/keywords');
  const keywordPayload = await keywords.json();
  const keyword = keywordPayload.find((item: any) => item.keyword === 'cms seo workflow');
  assert.equal(keyword?.difficulty, 24); assert.equal(Boolean(keyword?.tracked), false);

  const faqSave = await adminFetch('/api/admin/seo/faqs', { method: 'POST', body: JSON.stringify({ page_url_path: '/resources/cms-seo-workflow-guide', question: 'Can this be edited?', answer: 'Yes, through the canonical FAQ record.', display_order: 1 }) });
  assert.equal(faqSave.status, 200);
  const faqs = await adminFetch('/api/admin/seo/faqs');
  const faqPayload = await faqs.json();
  const faq = faqPayload.find((item: any) => item.question === 'Can this be edited?');
  assert.ok(faq?.id);
  const faqUpdate = await adminFetch(`/api/admin/seo/faqs/${faq.id}`, { method: 'PUT', body: JSON.stringify({ question: 'Can this workflow be edited?', answer: 'Yes, through the canonical FAQ record.', display_order: 2 }) });
  assert.equal(faqUpdate.status, 200);

  const audit = await adminFetch('/api/admin/seo/run-audit', { method: 'POST', body: JSON.stringify({ urlPath: '/resources/cms-seo-workflow-guide' }) });
  const auditPayload = await audit.json(); assert.equal(audit.status, 200); assert.ok(Number.isFinite(Number(auditPayload.score)));
  const settingsSave = await adminFetch('/api/admin/seo/settings', { method: 'POST', body: JSON.stringify({ site_name: 'Kurukoo', default_title: 'CMS workflow', default_description: 'Workflow settings save preserves recorded audit state.' }) });
  assert.equal(settingsSave.status, 200);
  const health = await adminFetch('/api/admin/seo/health');
  const healthPayload = await health.json(); assert.equal(health.status, 200); assert.equal(healthPayload.score.score, auditPayload.score, 'settings save retains the existing recorded audit state');

  const keywordDelete = await adminFetch(`/api/admin/seo/keywords/${keyword.id}`, { method: 'DELETE' }); assert.equal(keywordDelete.status, 200);
  const faqDelete = await adminFetch(`/api/admin/seo/faqs/${faq.id}`, { method: 'DELETE' }); assert.equal(faqDelete.status, 200);
  const pageDelete = await adminFetch('/api/admin/seo/pages', { method: 'DELETE', body: JSON.stringify({ url_path: '/resources/cms-seo-workflow-guide' }) }); assert.equal(pageDelete.status, 200);
  const contentDelete = await adminFetch('/api/admin/content/cms-seo-workflow-guide', { method: 'DELETE' }); assert.equal(contentDelete.status, 200);

  const finalResources = await fetch(`${baseUrl}/api/resources`); const finalResourcePayload = await finalResources.json(); assert.ok(!finalResourcePayload.resources.some((item: any) => item.slug === 'cms-seo-workflow-guide'), 'CMS deletion removes the public resource projection');
  console.log('CMS and SEO workflow regression passed: canonical CMS projection, metadata/key record upserts, FAQ edits, recorded audit retention, and delete actions.');
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const suffix of ['', '-journal', '-wal', '-shm']) { try { fs.unlinkSync(`${dbPath}${suffix}`); } catch {} }
}
