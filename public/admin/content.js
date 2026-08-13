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

  async function adminFetch(path, options = {}) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { window.location.replace('/admin/login'); throw new Error('Admin authentication is required'); }
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Accept', 'application/json');
    if (options.body) headers.set('Content-Type', 'application/json');
    const response = await fetch(path, { credentials: 'same-origin', ...options, headers });
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.replace('/admin/login');
      throw new Error('Admin session expired');
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  }

  function dateLabel(value) {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? String(value) : date.toLocaleString();
  }

  function safeRoute() {
    const type = byId('content-type').value;
    const slug = byId('content-slug').value.trim();
    const route = byId('content-public-route');
    if (!slug) { route.textContent = 'Save a help, page, or legal record to make it available through Resources.'; return; }
    if (type === 'blog') { route.textContent = `Blog metadata is exposed at /api/blog/${slug}; create a public article route only when that publishing surface is approved.`; return; }
    route.textContent = `Public resource path: /resources/${slug}`;
  }

  function renderPreview() {
    const target = byId('content-preview');
    const body = byId('content-body').value;
    const title = byId('content-title').value.trim();
    target.replaceChildren();
    if (!body.trim() && !title) {
      const empty = document.createElement('p'); empty.className = 'admin-empty-state'; empty.textContent = 'Your draft preview will appear here.'; target.append(empty); safeRoute(); return;
    }
    if (title) { const heading = document.createElement('h3'); heading.textContent = title; target.append(heading); }
    let list = null;
    for (const rawLine of body.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) { list = null; continue; }
      if (line.startsWith('### ') || line.startsWith('## ') || line.startsWith('# ')) {
        const heading = document.createElement(line.startsWith('### ') ? 'h5' : line.startsWith('## ') ? 'h4' : 'h3');
        heading.textContent = line.replace(/^#{1,3}\s*/, ''); target.append(heading); list = null;
      } else if (line.startsWith('- ')) {
        if (!list) { list = document.createElement('ul'); target.append(list); }
        const item = document.createElement('li'); item.textContent = line.slice(2); list.append(item);
      } else {
        const paragraph = document.createElement('p'); paragraph.textContent = line; target.append(paragraph); list = null;
      }
    }
    safeRoute();
  }

  function actionButton(label, action, slug, danger = false) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = danger ? 'admin-table-action is-danger' : 'admin-table-action'; button.textContent = label;
    button.addEventListener('click', () => action(slug));
    return button;
  }

  function renderRecords() {
    const target = byId('content-list');
    const filter = byId('content-filter').value;
    const records = state.records.filter((record) => filter === 'all' || record.type === filter);
    target.replaceChildren();
    if (!records.length) {
      const row = document.createElement('tr'); const cell = document.createElement('td'); cell.colSpan = 5; cell.className = 'admin-empty-state'; cell.textContent = state.records.length ? 'No records match this filter.' : 'No content records exist yet.'; row.append(cell); target.append(row); return;
    }
    records.forEach((record) => {
      const row = document.createElement('tr');
      const title = document.createElement('td'); const titleStrong = document.createElement('strong'); titleStrong.textContent = record.title || 'Untitled'; title.append(titleStrong);
      const slug = document.createElement('td'); slug.textContent = record.slug;
      const type = document.createElement('td'); type.textContent = record.type;
      const updated = document.createElement('td'); updated.textContent = dateLabel(record.updated_at);
      const actions = document.createElement('td'); actions.className = 'admin-table-actions';
      actions.append(
        actionButton('Edit', loadRecord, record.slug),
        actionButton('SEO', openSeo, record.slug),
        actionButton('Delete', deleteRecord, record.slug, true),
      );
      row.append(title, slug, type, updated, actions); target.append(row);
    });
  }

  async function loadRepository() {
    setStatus('Loading content repository…');
    try { state.records = await adminFetch('/api/admin/content'); renderRecords(); setStatus(`${state.records.length} content record${state.records.length === 1 ? '' : 's'} loaded.`); }
    catch (error) { setStatus(error.message || 'Could not load content.', true); }
  }

  async function loadRecord(slug) {
    try {
      const item = await adminFetch(`/api/admin/content/${encodeURIComponent(slug)}`);
      state.editingSlug = item.slug;
      byId('content-title').value = item.title || '';
      byId('content-slug').value = item.slug || '';
      byId('content-slug').readOnly = true;
      byId('content-type').value = item.type || 'help';
      byId('content-author').value = item.author || 'Kurukoo Team';
      byId('content-body').value = item.body || '';
      byId('content-mode').textContent = `Editing ${item.slug}`;
      byId('content-save').textContent = 'Save changes';
      renderPreview();
      byId('content-title').focus();
      setStatus(`Loaded ${item.slug} for editing.`);
    } catch (error) { setStatus(error.message || 'Could not load content.', true); }
  }

  function resetForm() {
    state.editingSlug = null;
    byId('content-form').reset();
    byId('content-author').value = 'Kurukoo Team';
    byId('content-type').value = 'help';
    byId('content-slug').readOnly = false;
    byId('content-mode').textContent = 'New record';
    byId('content-save').textContent = 'Save content';
    renderPreview();
  }

  async function saveRecord(event) {
    event.preventDefault();
    const button = byId('content-save'); button.disabled = true;
    const payload = { slug: byId('content-slug').value, title: byId('content-title').value, type: byId('content-type').value, author: byId('content-author').value, body: byId('content-body').value };
    try {
      const response = await adminFetch('/api/admin/content', { method: 'POST', body: JSON.stringify(payload) });
      setStatus(`Saved ${response.slug || payload.slug}.`); resetForm(); await loadRepository();
    } catch (error) { setStatus(error.message || 'Could not save content.', true); }
    finally { button.disabled = false; }
  }

  async function deleteRecord(slug) {
    if (!window.confirm(`Delete “${slug}”? This removes the CMS record and its public resource projection.`)) return;
    try { await adminFetch(`/api/admin/content/${encodeURIComponent(slug)}`, { method: 'DELETE' }); if (state.editingSlug === slug) resetForm(); await loadRepository(); setStatus(`Deleted ${slug}.`); }
    catch (error) { setStatus(error.message || 'Could not delete content.', true); }
  }

  function openSeo(slug) {
    const record = state.records.find((item) => item.slug === slug);
    const urlPath = record?.type === 'blog' ? `/blog/${slug}` : `/resources/${slug}`;
    window.location.assign(`/admin/seo.html?url_path=${encodeURIComponent(urlPath)}`);
  }

  async function generateDraft() {
    const title = byId('content-title').value.trim();
    if (!title) { setStatus('Enter a title before generating a draft.', true); byId('content-title').focus(); return; }
    const button = byId('content-generate'); button.disabled = true; const original = button.textContent; button.textContent = 'Generating…';
    try {
      const response = await adminFetch('/api/admin/content/generate', { method: 'POST', body: JSON.stringify({ topic: title }) });
      byId('content-body').value = response.generatedBody || '';
      if (!byId('content-slug').value) byId('content-slug').value = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      renderPreview(); setStatus('Draft generated. Review it before saving.');
    } catch (error) { setStatus(error.message || 'Could not generate a draft.', true); }
    finally { button.disabled = false; button.textContent = original; }
  }

  function initialize() {
    if (!localStorage.getItem(TOKEN_KEY)) { window.location.replace('/admin/login'); return; }
    byId('content-form').addEventListener('submit', saveRecord);
    byId('content-reset').addEventListener('click', resetForm);
    byId('content-generate').addEventListener('click', () => { void generateDraft(); });
    byId('content-refresh').addEventListener('click', () => { void loadRepository(); });
    byId('content-filter').addEventListener('change', renderRecords);
    ['content-title', 'content-slug', 'content-type', 'content-body'].forEach((id) => byId(id).addEventListener('input', renderPreview));
    byId('content-sign-out').addEventListener('click', () => { localStorage.removeItem(TOKEN_KEY); window.location.replace('/admin/login'); });
    resetForm(); void loadRepository();
  }
  document.addEventListener('DOMContentLoaded', initialize, { once: true });
})();
