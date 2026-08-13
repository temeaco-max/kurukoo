(() => {
  'use strict';

  const token = localStorage.getItem('kurukoo_admin');
  if (!token) { window.location.assign('/admin/login'); return; }

  const feedback = document.getElementById('operations-feedback');
  const $ = (selector) => document.querySelector(selector);
  const state = { entities: [] };

  function setFeedback(message, kind = 'info') {
    feedback.textContent = message;
    feedback.dataset.state = kind;
  }

  async function adminFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Accept', 'application/json');
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const response = await fetch(path, { ...options, headers, credentials: 'same-origin' });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('kurukoo_admin');
      window.location.assign('/admin/login');
      throw new Error('Your admin session has expired.');
    }
    if (!response.ok || payload.success === false) throw new Error(payload.error || payload.message || `Request failed (${response.status})`);
    return payload;
  }

  function text(value, fallback = '—') {
    if (value === null || value === undefined || value === '') return fallback;
    return String(value);
  }

  function empty(target, message, columns) {
    const node = document.createElement(columns ? 'tr' : 'p');
    node.className = 'admin-empty-state';
    node.textContent = message;
    if (columns) { const cell = document.createElement('td'); cell.colSpan = columns; cell.textContent = message; node.replaceChildren(cell); }
    target.replaceChildren(node);
  }

  function button(label, handler, className = 'admin-button admin-button--secondary') {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = className;
    node.textContent = label;
    node.addEventListener('click', handler);
    return node;
  }

  function summaryLine(label, value) {
    const row = document.createElement('p');
    const strong = document.createElement('strong'); strong.textContent = `${label}: `;
    row.append(strong, document.createTextNode(value));
    return row;
  }

  function populateEntityFields(entity) {
    $('form#supply-review-form [name="entityId"]').value = entity.id;
    $('form#supply-lifecycle-form [name="entityId"]').value = entity.id;
    window.scrollTo({ top: $('form#supply-review-form').getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
  }

  function renderEntities(entities) {
    const target = $('#supply-entity-list');
    state.entities = Array.isArray(entities) ? entities : [];
    if (!state.entities.length) { empty(target, 'No supply entities are recorded.', 5); return; }
    const fragment = document.createDocumentFragment();
    for (const entity of state.entities) {
      const row = document.createElement('tr');
      const name = document.createElement('td');
      const title = document.createElement('strong'); title.textContent = text(entity.businessName);
      const sub = document.createElement('small'); sub.textContent = `${text(entity.entityType, 'business')} · ${text(entity.id)}`;
      name.append(title, document.createElement('br'), sub);
      const place = document.createElement('td'); place.textContent = [entity.country, entity.state, entity.lga].filter(Boolean).join(' · ') || 'Location not recorded';
      const status = document.createElement('td'); status.textContent = `${text(entity.status)} · ${text(entity.reviewStatus, 'review required')}`;
      const evidence = document.createElement('td'); evidence.textContent = `${text(entity.sourceType)} · freshness: ${text(entity.freshnessState)}`;
      const actions = document.createElement('td');
      actions.append(button('Review', () => populateEntityFields(entity), 'admin-text-link'));
      row.append(name, place, status, evidence, actions);
      fragment.append(row);
    }
    target.replaceChildren(fragment);
  }

  function renderClaims(claims) {
    const target = $('#supply-claim-list');
    if (!Array.isArray(claims) || !claims.length) { empty(target, 'No supply claims require review.'); return; }
    const fragment = document.createDocumentFragment();
    for (const claim of claims) {
      const card = document.createElement('article'); card.className = 'admin-state-card';
      card.append(summaryLine('Claim', text(claim.id)), summaryLine('Entity', text(claim.entityId)), summaryLine('State', text(claim.status)));
      const evidence = document.createElement('input'); evidence.placeholder = 'Evidence reference'; evidence.maxLength = 500;
      const actions = document.createElement('div'); actions.className = 'admin-inline-actions';
      for (const decision of ['approved', 'rejected']) actions.append(button(decision === 'approved' ? 'Approve claim' : 'Reject claim', async () => {
        if (!evidence.value.trim()) { setFeedback('A claim decision requires an evidence reference.', 'error'); evidence.focus(); return; }
        try {
          await adminFetch(`/api/supply-registry/admin/claims/${encodeURIComponent(claim.id)}/review`, { method: 'POST', body: JSON.stringify({ decision, evidenceRef: evidence.value.trim() }) });
          setFeedback(`Claim ${decision}.`, 'success'); await loadAll();
        } catch (error) { setFeedback(error.message, 'error'); }
      }));
      card.append(evidence, actions); fragment.append(card);
    }
    target.replaceChildren(fragment);
  }

  function renderTasks(tasks) {
    const target = $('#task-submission-list');
    if (!Array.isArray(tasks) || !tasks.length) { empty(target, 'No submitted task evidence is awaiting moderation.'); return; }
    const fragment = document.createDocumentFragment();
    for (const task of tasks) {
      const card = document.createElement('article'); card.className = 'admin-state-card';
      card.append(summaryLine('Task', text(task.id)), summaryLine('Contributor', text(task.contributor_phone || task.phone)), summaryLine('Evidence', text(task.evidence || task.result, 'No summary recorded')));
      const note = document.createElement('input'); note.placeholder = 'Moderator note (optional)'; note.maxLength = 500;
      const actions = document.createElement('div'); actions.className = 'admin-inline-actions';
      for (const decision of ['approved', 'rejected']) actions.append(button(decision === 'approved' ? 'Approve evidence' : 'Reject evidence', async () => {
        try {
          await adminFetch(`/api/admin/tasks/${encodeURIComponent(task.id)}/moderate`, { method: 'POST', body: JSON.stringify({ decision, note: note.value.trim() || undefined }) });
          setFeedback(`Task evidence ${decision}.`, 'success'); await loadAll();
        } catch (error) { setFeedback(error.message, 'error'); }
      }));
      card.append(note, actions); fragment.append(card);
    }
    target.replaceChildren(fragment);
  }

  function renderDisputes(disputes) {
    const target = $('#dispute-list');
    if (!Array.isArray(disputes) || !disputes.length) { empty(target, 'No disputes are recorded.'); return; }
    const fragment = document.createDocumentFragment();
    for (const dispute of disputes) {
      const card = document.createElement('article'); card.className = 'admin-state-card';
      card.append(summaryLine('Dispute', `#${text(dispute.id)}`), summaryLine('Request / order', text(dispute.order_id)), summaryLine('State', text(dispute.status)), summaryLine('Reason', text(dispute.reason, 'No reason recorded')));
      const actions = document.createElement('div'); actions.className = 'admin-inline-actions';
      if (['open', 'pending', 'escalated'].includes(String(dispute.status))) {
        actions.append(button('Escalate', async () => {
          try { await adminFetch('/api/admin/disputes/escalate', { method: 'POST', body: JSON.stringify({ disputeId: dispute.id }) }); setFeedback(`Dispute #${dispute.id} escalated.`, 'success'); await loadAll(); }
          catch (error) { setFeedback(error.message, 'error'); }
        }));
        for (const action of ['release', 'refund']) actions.append(button(action === 'release' ? 'Resolve: release' : 'Resolve: refund', async () => {
          try { await adminFetch('/api/admin/disputes/resolve', { method: 'POST', body: JSON.stringify({ disputeId: dispute.id, action }) }); setFeedback(`Dispute #${dispute.id} resolution recorded.`, 'success'); await loadAll(); }
          catch (error) { setFeedback(error.message, 'error'); }
        }, 'admin-text-link'));
      }
      card.append(actions); fragment.append(card);
    }
    target.replaceChildren(fragment);
  }

  function renderCommunications(data) {
    $('#communications-boundary').textContent = text(data.boundary, 'Communication records are unavailable.');
    const target = $('#communications-list');
    const fragment = document.createDocumentFragment();
    const groups = [['Outbox', data.outbox], ['Delivery states', data.deliveries], ['Consent states', data.consents]];
    for (const [label, records] of groups) {
      const card = document.createElement('article'); card.className = 'admin-state-card';
      const heading = document.createElement('strong'); heading.textContent = label; card.append(heading);
      if (!Array.isArray(records) || !records.length) { const note = document.createElement('p'); note.textContent = 'No recorded entries.'; card.append(note); }
      else for (const record of records) { const note = document.createElement('p'); note.textContent = [record.channel, record.state, `${text(record.count, '0')} record(s)`].filter(Boolean).join(' · '); card.append(note); }
      fragment.append(card);
    }
    target.replaceChildren(fragment);
  }

  async function loadAll() {
    setFeedback('Refreshing recorded operational state…');
    const results = await Promise.allSettled([
      adminFetch('/api/supply-registry/admin/entities?limit=50'),
      adminFetch('/api/supply-registry/admin/claims'),
      adminFetch('/api/admin/tasks/submitted'),
      adminFetch('/api/admin/disputes'),
      adminFetch('/api/admin/communications'),
    ]);
    const [entities, claims, tasks, disputes, communications] = results;
    if (entities.status === 'fulfilled') { renderEntities(entities.value.entities); $('#supply-summary').replaceChildren(summaryLine('Recorded entities', String((entities.value.entities || []).length))); } else { empty($('#supply-entity-list'), 'Supply registry could not be loaded.', 5); }
    if (claims.status === 'fulfilled') renderClaims(claims.value.claims); else empty($('#supply-claim-list'), 'Claim queue could not be loaded.');
    if (tasks.status === 'fulfilled') renderTasks(tasks.value.tasks); else empty($('#task-submission-list'), 'Task evidence queue could not be loaded.');
    if (disputes.status === 'fulfilled') renderDisputes(disputes.value.disputes); else empty($('#dispute-list'), 'Dispute queue could not be loaded.');
    if (communications.status === 'fulfilled') renderCommunications(communications.value); else { $('#communications-boundary').textContent = 'Communication observability could not be loaded.'; empty($('#communications-list'), 'No communication state is available.'); }
    const failures = results.filter((result) => result.status === 'rejected').length;
    setFeedback(failures ? `${failures} control group(s) could not be refreshed. Existing state remains visible.` : `Operational state refreshed at ${new Date().toLocaleTimeString()}.`, failures ? 'error' : 'success');
  }

  $('#supply-entity-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const services = String(form.get('services') || '').split(',').map((value) => value.trim()).filter(Boolean);
    const body = Object.fromEntries(form.entries()); body.services = services;
    for (const key of ['sourceRetrievedAt']) if (body[key]) body[key] = new Date(String(body[key])).toISOString();
    try { await adminFetch('/api/supply-registry/admin/entities', { method: 'POST', body: JSON.stringify(body) }); event.currentTarget.reset(); setFeedback('Supply entity recorded. It remains unverified until the canonical review path records evidence.', 'success'); await loadAll(); }
    catch (error) { setFeedback(error.message, 'error'); }
  });

  $('#supply-review-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const entityId = String(form.get('entityId') || '');
    const body = Object.fromEntries(form.entries()); delete body.entityId;
    if (body.sourceRetrievedAt) body.sourceRetrievedAt = new Date(String(body.sourceRetrievedAt)).toISOString();
    try { await adminFetch(`/api/supply-registry/admin/entities/${encodeURIComponent(entityId)}/review`, { method: 'POST', body: JSON.stringify(body) }); setFeedback('Supply review recorded.', 'success'); await loadAll(); }
    catch (error) { setFeedback(error.message, 'error'); }
  });

  $('#supply-lifecycle-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const entityId = String(form.get('entityId') || ''); const action = String(form.get('action') || '');
    const evidenceRef = String(form.get('evidenceRef') || '').trim(); const expiresInDays = Number(form.get('expiresInDays') || 14);
    const route = action === 'invite' ? 'invitation' : action === 'start-readiness' ? 'provider-readiness/start' : action === 'approve-readiness' ? 'provider-readiness' : 'activate';
    const body = action === 'invite' ? { expiresInDays } : action === 'approve-readiness' ? { evidenceRef } : {};
    try { const result = await adminFetch(`/api/supply-registry/admin/entities/${encodeURIComponent(entityId)}/${route}`, { method: 'POST', body: JSON.stringify(body) }); setFeedback(result.claim_url ? `Claim invitation issued: ${result.claim_url}` : 'Provider lifecycle action recorded.', 'success'); await loadAll(); }
    catch (error) { setFeedback(error.message, 'error'); }
  });

  $('#supply-revalidate').addEventListener('click', async () => {
    try { const result = await adminFetch('/api/supply-registry/admin/freshness/revalidate-overdue', { method: 'POST' }); setFeedback(`${text(result.stale_marked, '0')} overdue supply record(s) marked stale. No external fetch was performed.`, 'success'); await loadAll(); }
    catch (error) { setFeedback(error.message, 'error'); }
  });
  $('#operations-refresh').addEventListener('click', () => { void loadAll(); });
  $('#operations-sign-out').addEventListener('click', () => { localStorage.removeItem('kurukoo_admin'); window.location.assign('/admin/login'); });
  void loadAll();
})();
