(() => {
  'use strict';
  const TOKEN_KEY = 'kurukoo_admin';
  const byId = (id) => document.getElementById(id);
  const state = { records: [], editingSlug: null };

  function setStatus(message, error = false) {
    const element = byId('content-status');
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('is-error', error);
  }

  function setBusy(button, busy, busyLabel) {
    if (!button) return;
    if (busy) { button.dataset.label = button.textContent; button.disabled = true; button.textContent = busyLabel || 'Working…'; button.setAttribute('aria-busy', 'true'); }
    else { button.disabled = false; button.textContent = button.dataset.label || button.textContent; button.removeAttribute('aria-busy'); }
  }

  async function adminFetch(path, options = {}) {
    const token = localStorage.getItem(TOKEN_KEY) || localStorage.getItem('kurukoo_admin_token');
    if (!token) { window.location.replace('/admin/login'); throw new Error('Admin authentication is required'); }
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`); headers.set('Accept', 'application/json');
    if (options.body) headers.set('Content-Type', 'application/json');
    const response = await fetch(path, { credentials: 'same-origin', ...options, headers });
    if (response.status === 401 || response.status === 403) { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem('kurukoo_admin_token'); window.location.replace('/admin/login'); throw new Error('Admin session expired'); }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  }

  function dateLabel(value) { if (!value) return 'Not recorded'; const date = new Date(value); return Number.isNaN(date.valueOf()) ? String(value) : date.toLocaleString(); }
  function publicRoute(type, slug) { return slug && type !== 'blog' ? `/resources/${encodeURIComponent(slug)}` : ''; }
  function seoRoute(type, slug) { return slug ? (type === 'blog' ? `/blog/${slug}` : `/resources/${slug}`) : ''; }
  function previewDescription() { return byId('content-body').value.replace(/[#*_`>-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 155); }

  function updateRouteNotes() {
    const type = byId('content-type').value; const slug = byId('content-slug').value.trim();
    const route = publicRoute(type, slug); const seoPath = seoRoute(type, slug);
    byId('content-public-route').textContent = route ? `Public resource path: ${route}` : slug ? 'Blog metadata is stored in the CMS; a public blog article route must be approved before it can be previewed.' : 'Save a help, page, or legal record to make it available through Resources.';
    byId('content-seo-route').textContent = seoPath ? `SEO metadata route: ${seoPath}` : 'Enter a slug to prepare a matching SEO metadata record.';
    byId('content-preview-public').disabled = !route;
  }

  function renderPreview() {
    const target = byId('content-preview'); const body = byId('content-body').value; const title = byId('content-title').value.trim();
    target.replaceChildren();
    if (!body.trim() && !title) { const empty = document.createElement('p'); empty.className = 'admin-empty-state'; empty.textContent = 'Your draft preview will appear here.'; target.append(empty); updateRouteNotes(); return; }
    if (title) { const heading = document.createElement('h3'); heading.textContent = title; target.append(heading); }
    let list = null;
    for (const rawLine of body.split(/\r?\n/)) {
      const line = rawLine.trim(); if (!line) { list = null; continue; }
      if (line.startsWith('### ') || line.startsWith('## ') || line.startsWith('# ')) { const heading = document.createElement(line.startsWith('### ') ? 'h5' : line.startsWith('## ') ? 'h4' : 'h3'); heading.textContent = line.replace(/^#{1,3}\s*/, ''); target.append(heading); list = null; }
      else if (line.startsWith('- ')) { if (!list) { list = document.createElement('ul'); target.append(list); } const item = document.createElement('li'); item.textContent = line.slice(2); list.append(item); }
      else { const paragraph = document.createElement('p'); paragraph.textContent = line; target.append(paragraph); list = null; }
    }
    updateRouteNotes();
  }

  function actionButton(label, action, slug, danger = false) {
    const button = document.createElement('button'); button.type = 'button'; button.className = danger ? 'admin-table-action is-danger' : 'admin-table-action'; button.textContent = label;
    button.addEventListener('click', async () => { setBusy(button, true, danger ? 'Deleting…' : `${label}…`); try { await action(slug); } finally { if (document.body.contains(button)) setBusy(button, false); } });
    return button;
  }

  function renderRecords() {
    const target = byId('content-list'); const filter = byId('content-filter').value; const records = state.records.filter((record) => filter === 'all' || record.type === filter);
    target.replaceChildren();
    if (!records.length) { const row = document.createElement('tr'); const cell = document.createElement('td'); cell.colSpan = 5; cell.className = 'admin-empty-state'; cell.textContent = state.records.length ? 'No records match this filter.' : 'No content records exist yet. Create a factual resource draft to begin.'; row.append(cell); target.append(row); return; }
    records.forEach((record) => {
      const row = document.createElement('tr'); const title = document.createElement('td'); const titleStrong = document.createElement('strong'); titleStrong.textContent = record.title || 'Untitled'; title.append(titleStrong);
      const slug = document.createElement('td'); slug.textContent = record.slug; const type = document.createElement('td'); type.textContent = record.type; const updated = document.createElement('td'); updated.textContent = dateLabel(record.updated_at);
      const actions = document.createElement('td'); actions.className = 'admin-table-actions'; actions.append(actionButton('Edit', loadRecord, record.slug), actionButton('SEO', openSeo, record.slug));
      if (publicRoute(record.type, record.slug)) actions.append(actionButton('Preview', openPublic, record.slug));
      actions.append(actionButton('Delete', deleteRecord, record.slug, true)); row.append(title, slug, type, updated, actions); target.append(row);
    });
  }

  async function loadRepository() {
    const refresh = byId('content-refresh'); setBusy(refresh, true, 'Refreshing…'); setStatus('Loading content repository…');
    try { state.records = await adminFetch('/api/admin/content'); renderRecords(); setStatus(`${state.records.length} content record${state.records.length === 1 ? '' : 's'} loaded from the canonical CMS.`); }
    catch (error) { setStatus(error.message || 'Could not load content.', true); }
    finally { setBusy(refresh, false); }
  }

  async function loadRecord(slug) {
    try {
      const item = await adminFetch(`/api/admin/content/${encodeURIComponent(slug)}`); state.editingSlug = item.slug;
      byId('content-title').value = item.title || ''; byId('content-slug').value = item.slug || ''; byId('content-slug').readOnly = true; byId('content-type').value = item.type || 'help'; byId('content-author').value = item.author || 'Kurukoo Team'; byId('content-body').value = item.body || '';
      byId('content-mode').textContent = `Editing ${item.slug}`; byId('content-save').textContent = 'Save changes'; renderPreview(); byId('content-title').focus(); setStatus(`Loaded ${item.slug} for editing.`);
    } catch (error) { setStatus(error.message || 'Could not load content.', true); }
  }

  function resetForm() {
    state.editingSlug = null; byId('content-form').reset(); byId('content-author').value = 'Kurukoo Team'; byId('content-type').value = 'help'; byId('content-slug').readOnly = false; byId('content-mode').textContent = 'New record'; byId('content-save').textContent = 'Save content'; renderPreview();
  }

  function contentPayload() { return { slug: byId('content-slug').value.trim(), title: byId('content-title').value.trim(), type: byId('content-type').value, author: byId('content-author').value.trim(), body: byId('content-body').value }; }

  async function persistContent({ openSeo = false } = {}) {
    const payload = contentPayload();
    const button = openSeo ? byId('content-save-seo') : byId('content-save'); setBusy(button, true, openSeo ? 'Saving…' : 'Saving…');
    try {
      const response = await adminFetch('/api/admin/content', { method: 'POST', body: JSON.stringify(payload) });
      const savedSlug = response.slug || payload.slug; const route = seoRoute(payload.type, savedSlug); setStatus(`Saved ${savedSlug} to the canonical CMS.`); await loadRepository();
      if (openSeo) {
        if (!route) { setStatus('Content saved. Enter a slug before preparing SEO metadata.', true); return; }
        const query = new URLSearchParams({ url_path: route, title: payload.title, meta_description: previewDescription(), keywords: byId('content-seo-keyword').value.trim() });
        window.location.assign(`/admin/seo.html?${query.toString()}`); return;
      }
      state.editingSlug = savedSlug; byId('content-slug').readOnly = true; byId('content-mode').textContent = `Editing ${savedSlug}`; byId('content-save').textContent = 'Save changes'; renderPreview();
    } catch (error) { setStatus(error.message || 'Could not save content.', true); }
    finally { setBusy(button, false); }
  }

  async function saveRecord(event) { event.preventDefault(); await persistContent(); }
  async function deleteRecord(slug) {
    if (!window.confirm(`Delete “${slug}”? This removes the CMS record and its public resource projection.`)) return;
    try { await adminFetch(`/api/admin/content/${encodeURIComponent(slug)}`, { method: 'DELETE' }); if (state.editingSlug === slug) resetForm(); await loadRepository(); setStatus(`Deleted ${slug} from the CMS and its public resource projection.`); }
    catch (error) { setStatus(error.message || 'Could not delete content.', true); }
  }

  function openSeo(slug) { const record = state.records.find((item) => item.slug === slug); const urlPath = seoRoute(record?.type || 'help', slug); const query = new URLSearchParams({ url_path: urlPath, title: record?.title || '', meta_description: String(record?.body || '').replace(/\s+/g, ' ').slice(0, 155) }); window.location.assign(`/admin/seo.html?${query.toString()}`); }
  function openPublic(slug) { const record = state.records.find((item) => item.slug === slug); const route = publicRoute(record?.type || 'help', slug); if (route) window.open(route, '_blank', 'noopener'); }

  async function generateDraft() {
    const title = byId('content-title').value.trim(); if (!title) { setStatus('Enter a title before generating a draft.', true); byId('content-title').focus(); return; }
    const button = byId('content-generate'); setBusy(button, true, 'Generating…');
    try { const response = await adminFetch('/api/admin/content/generate', { method: 'POST', body: JSON.stringify({ topic: title }) }); byId('content-body').value = response.generatedBody || ''; if (!byId('content-slug').value) byId('content-slug').value = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); renderPreview(); setStatus('Draft generated. Review and save it before it can appear on a public resource path.'); }
    catch (error) { setStatus(error.message || 'Could not generate a draft.', true); }
    finally { setBusy(button, false); }
  }

  function applySeoBriefQuery() {
    const query = new URLSearchParams(window.location.search); const title = query.get('title'); const keyword = query.get('keyword'); const outline = query.get('outline');
    if (!title && !keyword && !outline) return;
    if (title) byId('content-title').value = title; if (keyword) byId('content-seo-keyword').value = keyword; if (outline) byId('content-body').value = outline;
    if (title && !byId('content-slug').value) byId('content-slug').value = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    renderPreview(); setStatus('SEO brief loaded into a CMS draft. Review the generated plan before saving public content.');
  }

  function initialize() {
    if (!(localStorage.getItem(TOKEN_KEY) || localStorage.getItem('kurukoo_admin_token'))) { window.location.replace('/admin/login'); return; }
    byId('content-form').addEventListener('submit', saveRecord); byId('content-save-seo').addEventListener('click', () => { if (byId('content-form').reportValidity()) void persistContent({ openSeo: true }); });
    byId('content-preview-public').addEventListener('click', () => openPublic(byId('content-slug').value.trim())); byId('content-reset').addEventListener('click', resetForm); byId('content-generate').addEventListener('click', () => { void generateDraft(); }); byId('content-refresh').addEventListener('click', () => { void loadRepository(); }); byId('content-filter').addEventListener('change', renderRecords);
    ['content-title', 'content-slug', 'content-type', 'content-body', 'content-seo-keyword'].forEach((id) => byId(id).addEventListener(id === 'content-type' ? 'change' : 'input', renderPreview));
    byId('content-sign-out').addEventListener('click', () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem('kurukoo_admin_token'); window.location.replace('/admin/login'); }); resetForm(); applySeoBriefQuery(); void loadRepository();
  }
  document.addEventListener('DOMContentLoaded', initialize, { once: true });
})();
