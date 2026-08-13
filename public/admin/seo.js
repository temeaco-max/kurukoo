(() => {
  'use strict';
  const TOKEN_KEY = 'kurukoo_admin';
  const API = '/api/admin/seo';
  const byId = (id) => document.getElementById(id);
  const state = { pages: [], redirects: [], keywords: [], faqs: [], schemas: [], links: [], backlinks: [], calendar: [], briefs: [], images: [], errors: [], audits: [], orphans: [], settings: null, health: null };

  const field = (name, label, type = 'text', options = {}) => ({ name, label, type, ...options });
  const EDITORS = {
    page: { title: 'Page metadata', endpoint: 'pages', fields: [field('url_path', 'URL path', 'text', { required: true, placeholder: '/resources/example' }), field('title', 'Title', 'text', { required: true }), field('meta_description', 'Meta description', 'textarea'), field('canonical_url', 'Canonical URL', 'url'), field('keywords', 'Keywords', 'text'), field('og_title', 'Open Graph title', 'text'), field('og_description', 'Open Graph description', 'textarea'), field('og_image', 'Open Graph image URL', 'url')] },
    settings: { title: 'Global SEO settings', endpoint: 'settings', fields: [field('site_name', 'Site name'), field('default_title', 'Default title'), field('default_description', 'Default description', 'textarea'), field('robots_txt', 'robots.txt directives', 'textarea'), field('llms_txt', 'llms.txt notes', 'textarea')] },
    redirect: { title: 'Redirect rule', endpoint: 'redirects', fields: [field('from_url', 'From path or URL', 'text', { required: true }), field('to_url', 'Destination URL or path', 'text', { required: true }), field('status_code', 'Status code', 'select', { options: [['301', '301 permanent'], ['302', '302 temporary']] }), field('is_regex', 'Use regular expression', 'checkbox')] },
    keyword: { title: 'Keyword record', endpoint: 'keywords', fields: [field('keyword', 'Keyword', 'text', { required: true }), field('locale', 'Locale', 'text', { value: 'en' }), field('country', 'Country', 'text', { value: 'ng' }), field('search_volume', 'Recorded search volume', 'number', { min: 0 }), field('difficulty', 'Difficulty (0–100)', 'number', { min: 0, max: 100 }), field('tracked', 'Tracked', 'checkbox', { checked: true })] },
    faq: { title: 'FAQ record', endpoint: 'faqs', fields: [field('id', 'ID', 'hidden'), field('url_path', 'Page URL path', 'text', { required: true }), field('question', 'Question', 'text', { required: true }), field('answer', 'Answer', 'textarea', { required: true }), field('display_order', 'Display order', 'number', { min: 0 })] },
    schema: { title: 'Schema template', endpoint: 'schemas', fields: [field('id', 'ID', 'hidden'), field('name', 'Name', 'text', { required: true }), field('type', 'Schema type', 'text', { required: true, placeholder: 'FAQPage, Article, WebPage' }), field('template', 'JSON-LD template', 'textarea', { required: true, value: '{}' }), field('applies_to', 'Applies to URL pattern', 'text', { value: '*' })] },
    link: { title: 'Internal link', endpoint: 'internal-links', fields: [field('id', 'ID', 'hidden'), field('source_url', 'Source path', 'text', { required: true }), field('target_url', 'Target path', 'text', { required: true }), field('anchor_text', 'Anchor text', 'text'), field('link_type', 'Link type', 'select', { options: [['contextual', 'Contextual'], ['image', 'Image'], ['nofollow', 'Nofollow']] })] },
    backlink: { title: 'Backlink record', endpoint: 'backlinks', fields: [field('id', 'ID', 'hidden'), field('source_url', 'Source URL', 'url', { required: true }), field('target_url', 'Target URL', 'text', { required: true }), field('anchor_text', 'Anchor text', 'text'), field('domain_authority', 'Recorded domain authority', 'number', { min: 0, max: 100 })] },
    calendar: { title: 'Content calendar entry', endpoint: 'content-calendar', fields: [field('id', 'ID', 'hidden'), field('title', 'Title', 'text', { required: true }), field('target_keyword', 'Target keyword', 'text'), field('status', 'Status', 'select', { options: [['idea', 'Idea'], ['draft', 'Draft'], ['review', 'Review'], ['published', 'Published']] }), field('publish_date', 'Publish date', 'date'), field('author', 'Owner', 'text')] },
    brief: { title: 'Content brief', endpoint: 'content-briefs', fields: [field('id', 'ID', 'hidden'), field('title', 'Title', 'text', { required: true }), field('target_keyword', 'Target keyword', 'text', { required: true }), field('target_audience', 'Audience', 'text'), field('search_intent', 'Search intent', 'select', { options: [['informational', 'Informational'], ['transactional', 'Transactional'], ['navigational', 'Navigational']] }), field('recommended_word_count', 'Recommended words', 'number', { min: 100 }), field('outline', 'Outline', 'textarea')] },
    image: { title: 'Image metadata', endpoint: 'image-meta', fields: [field('id', 'ID', 'hidden'), field('image_path', 'Image path or URL', 'text', { required: true }), field('alt_text', 'Alt text', 'text'), field('title_text', 'Image title', 'text'), field('page_url_path', 'Page URL path', 'text')] },
    'generate-faqs': { title: 'Generate draft FAQs', submitLabel: 'Generate drafts', fields: [field('urlPath', 'Page URL path', 'text', { required: true }), field('topicName', 'Topic context', 'text')] },
    'generate-brief': { title: 'Generate content brief', submitLabel: 'Generate brief', fields: [field('targetKeyword', 'Target keyword', 'text', { required: true })] },
    'generate-alt': { title: 'Generate image alt text', submitLabel: 'Generate alt text', fields: [field('imagePath', 'Image path or URL', 'text', { required: true }), field('context', 'Image context', 'text'), field('existingAlt', 'Existing alt text (keeps unchanged if supplied)', 'text')] },
    audit: { title: 'Run internal SEO audit', submitLabel: 'Run audit', fields: [field('urlPath', 'URL path', 'text', { value: '/', required: true })] },
  };

  function setStatus(message, error = false) { const target = byId('seo-status'); target.textContent = message; target.classList.toggle('is-error', error); }
  function text(value, fallback = '—') { return value === undefined || value === null || value === '' ? fallback : String(value); }
  function rowEmpty(columns, message) { const row = document.createElement('tr'); const cell = document.createElement('td'); cell.colSpan = columns; cell.className = 'admin-empty-state'; cell.textContent = message; row.append(cell); return row; }
  function cell(value) { const target = document.createElement('td'); target.textContent = text(value); return target; }
  function apiPath(section) { return { pages: 'pages', redirects: 'redirects', keywords: 'keywords', faqs: 'faqs', schemas: 'schemas', links: 'internal-links', backlinks: 'backlinks', calendar: 'content-calendar', briefs: 'content-briefs', images: 'image-meta', errors: '404-log', audits: 'audits', orphans: 'orphans' }[section]; }

  async function adminFetch(path, options = {}) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { window.location.replace('/admin/login'); throw new Error('Admin authentication is required'); }
    const headers = new Headers(options.headers || {}); headers.set('Authorization', `Bearer ${token}`); headers.set('Accept', 'application/json'); if (options.body) headers.set('Content-Type', 'application/json');
    const response = await fetch(path, { credentials: 'same-origin', ...options, headers });
    if (response.status === 401 || response.status === 403) { localStorage.removeItem(TOKEN_KEY); window.location.replace('/admin/login'); throw new Error('Admin session expired'); }
    const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`); return body;
  }

  function recordActions(section, record, deletePath) {
    const container = document.createElement('td'); container.className = 'admin-table-actions';
    const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'admin-table-action'; edit.textContent = 'Edit'; edit.addEventListener('click', () => openEditor(section.slice(0, -1) === 'categorie' ? section : sectionToEditor(section), record));
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'admin-table-action is-danger'; remove.textContent = 'Delete'; remove.addEventListener('click', () => { void deleteRecord(section, record, deletePath); });
    container.append(edit, remove); return container;
  }
  function sectionToEditor(section) { return { pages: 'page', redirects: 'redirect', keywords: 'keyword', faqs: 'faq', schemas: 'schema', links: 'link', backlinks: 'backlink', calendar: 'calendar', briefs: 'brief', images: 'image' }[section]; }

  function renderTable(section, rows, columns, mapper) {
    const target = byId(`seo-${section}`); target.replaceChildren();
    if (!rows.length) { target.append(rowEmpty(columns, section === 'audits' ? 'No internal audit results recorded.' : 'No recorded entries.')); return; }
    rows.forEach((record) => target.append(mapper(record)));
  }

  function renderAll() {
    renderTable('pages', state.pages, 4, (r) => { const row = document.createElement('tr'); row.append(cell(r.url_path), cell(r.title), cell(r.updated_at), recordActions('pages', r, `/pages`)); return row; });
    renderTable('redirects', state.redirects, 4, (r) => { const row = document.createElement('tr'); row.append(cell(r.from_url || r.from_pattern), cell(r.to_url), cell(`${r.status_code || 301}${r.is_regex ? ' · regex' : ''}`), recordActions('redirects', r, `/redirects/${r.id}`)); return row; });
    renderTable('keywords', state.keywords, 4, (r) => { const row = document.createElement('tr'); row.append(cell(r.keyword), cell(`${text(r.locale, 'en')} · ${text(r.country, 'ng')}`), cell(r.tracked ? 'Yes' : 'No'), recordActions('keywords', r, `/keywords/${r.id}`)); return row; });
    renderTable('faqs', state.faqs, 4, (r) => { const row = document.createElement('tr'); row.append(cell(r.url_path || r.page_url_path), cell(r.question), cell(r.display_order), recordActions('faqs', r, `/faqs/${r.id}`)); return row; });
    renderTable('schemas', state.schemas, 4, (r) => { const row = document.createElement('tr'); row.append(cell(r.name), cell(r.schema_type || r.type), cell(r.url_pattern || r.applies_to), recordActions('schemas', r, `/schemas/${r.id}`)); return row; });
    renderTable('links', state.links, 4, (r) => { const row = document.createElement('tr'); row.append(cell(r.source_url), cell(r.target_url), cell(r.anchor_text), recordActions('links', r, `/internal-links/${r.id}`)); return row; });
    renderTable('backlinks', state.backlinks, 4, (r) => { const row = document.createElement('tr'); row.append(cell(r.source_url), cell(r.target_url), cell(r.domain_authority), recordActions('backlinks', r, `/backlinks/${r.id}`)); return row; });
    renderTable('calendar', state.calendar, 4, (r) => { const row = document.createElement('tr'); row.append(cell(r.title || r.cluster_title), cell(r.target_keyword), cell(r.status), recordActions('calendar', r, `/content-calendar/${r.id}`)); return row; });
    renderTable('briefs', state.briefs, 4, (r) => { const row = document.createElement('tr'); row.append(cell(r.title), cell(r.target_keyword), cell(r.target_audience), recordActions('briefs', r, `/content-briefs/${r.id}`)); return row; });
    renderTable('images', state.images, 4, (r) => { const row = document.createElement('tr'); row.append(cell(r.image_path || r.image_url), cell(r.alt_text), cell(r.page_url_path), recordActions('images', r, `/image-meta/${r.id}`)); return row; });
    renderTable('errors', state.errors, 4, (r) => { const row = document.createElement('tr'); const action = document.createElement('td'); const ignore = document.createElement('button'); ignore.type = 'button'; ignore.className = 'admin-table-action'; ignore.textContent = 'Ignore'; ignore.addEventListener('click', async () => { try { await adminFetch(`${API}/404-log/ignore/${r.id}`, { method: 'POST' }); await loadSection('errors'); setStatus('404 record marked ignored.'); } catch (e) { setStatus(e.message, true); } }); action.append(ignore); row.append(cell(r.url_path), cell(r.referer), cell(r.count || r.hit_count), action); return row; });
    renderTable('audits', state.audits, 4, (r) => { const row = document.createElement('tr'); row.append(cell(r.url_path), cell(r.check_name), cell(r.status), cell(r.points)); return row; });
    renderTable('orphans', state.orphans, 2, (r) => { const row = document.createElement('tr'); row.append(cell(r.url_path), cell(r.internal_inlinks)); return row; });
    const healthScore = typeof state.health?.score === 'object' ? state.health.score?.score : state.health?.score;
    byId('metric-pages').textContent = String(state.pages.length); byId('metric-keywords').textContent = String(state.keywords.length); byId('metric-redirects').textContent = String(state.redirects.length); byId('metric-health').textContent = healthScore === undefined || healthScore === null ? '—' : `${healthScore}/100`;
    byId('seo-settings-summary').textContent = state.settings ? `${text(state.settings.site_name)} · default title: ${text(state.settings.default_title)} · metadata is emitted through the shared public head.` : 'No global SEO settings are recorded yet.';
  }

  async function loadSection(section) {
    const path = apiPath(section); if (!path) return;
    const data = await adminFetch(`${API}/${path}`); state[section] = Array.isArray(data) ? data : data; renderAll();
  }
  async function loadAll() {
    setStatus('Refreshing canonical SEO records…');
    const sections = ['pages','redirects','keywords','faqs','schemas','links','backlinks','calendar','briefs','images','errors','audits','orphans'];
    const outcomes = await Promise.allSettled([
      adminFetch(`${API}/settings`),
      adminFetch(`${API}/health`),
      ...sections.map((section) => adminFetch(`${API}/${apiPath(section)}`)),
    ]);
    let failed = 0; state.settings = outcomes[0].status === 'fulfilled' ? outcomes[0].value : null; state.health = outcomes[1].status === 'fulfilled' ? outcomes[1].value : null;
    outcomes.slice(2).forEach((outcome, index) => { if (outcome.status === 'fulfilled') state[sections[index]] = Array.isArray(outcome.value) ? outcome.value : []; else failed += 1; });
    renderAll(); setStatus(failed ? `${failed} SEO record group${failed === 1 ? '' : 's'} could not be refreshed.` : 'Canonical SEO records refreshed.', failed > 0);
  }

  function fieldValue(record, definition) { if (!record) return definition.value ?? (definition.checked ? true : ''); if (definition.name === 'url_path') return record.url_path || record.page_url_path || ''; if (definition.name === 'template') return record.json_template || record.template || '{}'; if (definition.name === 'applies_to') return record.url_pattern || record.applies_to || ''; if (definition.name === 'search_volume') return record.search_volume ?? record.volume ?? ''; if (definition.name === 'publish_date') return record.publish_date || record.planned_publish_date || ''; if (definition.name === 'title') return record.title || record.cluster_title || ''; return record[definition.name] ?? definition.value ?? (definition.checked ? true : ''); }
  function openEditor(kind, record = null) {
    const config = EDITORS[kind]; if (!config) return;
    const dialog = byId('seo-dialog'); const form = byId('seo-dialog-form'); form.replaceChildren(); form.dataset.kind = kind;
    byId('seo-dialog-title').textContent = record ? `Edit ${config.title}` : config.title; byId('seo-dialog-kicker').textContent = record ? 'Update canonical record' : 'Create canonical record';
    config.fields.forEach((definition) => {
      const value = fieldValue(record, definition); let input;
      if (definition.type === 'hidden') { input = document.createElement('input'); input.type = 'hidden'; input.name = definition.name; input.value = value; form.append(input); return; }
      const label = document.createElement('label'); label.textContent = definition.label;
      if (definition.type === 'textarea') { input = document.createElement('textarea'); input.rows = 5; }
      else if (definition.type === 'select') { input = document.createElement('select'); (definition.options || []).forEach(([optionValue, optionLabel]) => { const option = document.createElement('option'); option.value = optionValue; option.textContent = optionLabel; option.selected = String(value) === optionValue; input.append(option); }); }
      else if (definition.type === 'checkbox') { label.className = 'admin-checkbox'; input = document.createElement('input'); input.type = 'checkbox'; input.checked = Boolean(value); label.textContent = ''; label.append(input, document.createTextNode(definition.label)); }
      else { input = document.createElement('input'); input.type = definition.type; input.value = value; }
      input.name = definition.name; if (definition.required) input.required = true; if (definition.placeholder) input.placeholder = definition.placeholder; if (definition.min !== undefined) input.min = definition.min; if (definition.max !== undefined) input.max = definition.max;
      if (definition.type === 'textarea') input.value = value; label.append(input); form.append(label);
    });
    const actions = document.createElement('div'); actions.className = 'admin-dialog-actions'; const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'admin-button admin-button--secondary'; cancel.textContent = 'Cancel'; cancel.addEventListener('click', () => dialog.close()); const save = document.createElement('button'); save.type = 'submit'; save.className = 'admin-button'; save.textContent = config.submitLabel || (record ? 'Save changes' : 'Save record'); actions.append(cancel, save); form.append(actions); dialog.showModal();
  }

  function formData(form) { const values = {}; new FormData(form).forEach((value, key) => { values[key] = String(value); }); form.querySelectorAll('input[type="checkbox"]').forEach((input) => { values[input.name] = input.checked; }); return values; }
  async function submitEditor(event) {
    event.preventDefault(); const form = event.currentTarget; const kind = form.dataset.kind; const payload = formData(form); const config = EDITORS[kind]; const dialog = byId('seo-dialog'); const save = form.querySelector('button[type="submit"]'); save.disabled = true;
    try {
      if (kind === 'generate-faqs') { await adminFetch(`${API}/generate-faqs`, { method: 'POST', body: JSON.stringify(payload) }); await loadSection('faqs'); setStatus('Draft FAQs generated. Review each entry before treating it as public guidance.'); }
      else if (kind === 'generate-brief') { await adminFetch(`${API}/generate-brief`, { method: 'POST', body: JSON.stringify(payload) }); await loadSection('briefs'); setStatus('Content brief generated. Review it before using it.'); }
      else if (kind === 'generate-alt') { const generated = await adminFetch(`${API}/generate-alt-text`, { method: 'POST', body: JSON.stringify(payload) }); dialog.close(); openEditor('image', { image_path: generated.image_path, alt_text: generated.alt_text }); setStatus('Alt-text draft generated. Save the image metadata record after review.'); return; }
      else if (kind === 'audit') { const result = await adminFetch(`${API}/run-audit`, { method: 'POST', body: JSON.stringify(payload) }); await Promise.all([loadSection('audits'), adminFetch(`${API}/health`).then((health) => { state.health = health; renderAll(); })]); setStatus(`Internal audit completed: ${text(result.score, 'no')} / 100.`); }
      else {
        let method = 'POST'; let endpoint = config.endpoint;
        if (kind === 'faq' && payload.id) { method = 'PUT'; endpoint += `/${payload.id}`; }
        if (kind === 'link' && payload.id) { method = 'PUT'; endpoint += `/${payload.id}`; }
        if (kind === 'backlink' && payload.id) { method = 'PUT'; endpoint += `/${payload.id}`; }
        if (kind === 'calendar' && payload.id) { method = 'PUT'; endpoint += `/${payload.id}`; }
        if (kind === 'brief' && payload.id) { method = 'PUT'; endpoint += `/${payload.id}`; }
        await adminFetch(`${API}/${endpoint}`, { method, body: JSON.stringify(payload) });
        const section = Object.entries({ page:'pages', settings:null, redirect:'redirects', keyword:'keywords', faq:'faqs', schema:'schemas', link:'links', backlink:'backlinks', calendar:'calendar', brief:'briefs', image:'images' }).find(([key]) => key === kind)?.[1];
        if (section) await loadSection(section); else { state.settings = await adminFetch(`${API}/settings`); renderAll(); }
        setStatus(`${config.title} saved.`);
      }
      dialog.close();
    } catch (error) { setStatus(error.message || `Could not save ${config.title}.`, true); }
    finally { save.disabled = false; }
  }

  async function deleteRecord(section, record, path) {
    const label = record.url_path || record.keyword || record.title || record.name || record.image_path || record.id;
    if (!confirm(`Delete “${label}”?`)) return;
    try {
      const endpoint = section === 'pages' ? `${API}/pages` : `${API}${path}`;
      const options = section === 'pages' ? { method: 'DELETE', body: JSON.stringify({ url_path: record.url_path }) } : { method: 'DELETE' };
      await adminFetch(endpoint, options); await loadSection(section); setStatus(`Deleted ${label}.`);
    } catch (error) { setStatus(error.message || 'Could not delete record.', true); }
  }

  function initialize() {
    if (!localStorage.getItem(TOKEN_KEY)) { window.location.replace('/admin/login'); return; }
    document.querySelectorAll('[data-seo-add]').forEach((button) => button.addEventListener('click', () => openEditor(button.dataset.seoAdd)));
    document.querySelectorAll('[data-seo-refresh]').forEach((button) => button.addEventListener('click', () => { void loadSection(button.dataset.seoRefresh); }));
    byId('seo-refresh-all').addEventListener('click', () => { void loadAll(); });
    byId('seo-dialog-form').addEventListener('submit', submitEditor); byId('seo-dialog-close').addEventListener('click', () => byId('seo-dialog').close());
    byId('seo-generate-faqs').addEventListener('click', () => openEditor('generate-faqs')); byId('seo-generate-brief').addEventListener('click', () => openEditor('generate-brief')); byId('seo-generate-alt').addEventListener('click', () => openEditor('generate-alt')); byId('seo-run-audit').addEventListener('click', () => openEditor('audit'));
    byId('seo-sign-out').addEventListener('click', () => { localStorage.removeItem(TOKEN_KEY); window.location.replace('/admin/login'); });
    const urlPath = new URLSearchParams(location.search).get('url_path'); if (urlPath) openEditor('page', { url_path: urlPath, canonical_url: `https://kurukoo.com${urlPath}` });
    void loadAll();
  }
  document.addEventListener('DOMContentLoaded', initialize, { once: true });
})();
