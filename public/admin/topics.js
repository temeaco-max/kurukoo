(() => {
  'use strict';
  const status = document.getElementById('topics-admin-status');
  const concise = (value, limit = 180) => { const text = String(value || '').replace(/\s+/g, ' ').trim(); return text.length > limit ? `${text.slice(0, limit)}…` : text; };
  const date = (value) => { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString(); };
  const request = async (path, options = {}) => { const response = await fetch(path, { headers: { 'Content-Type':'application/json', ...(options.headers || {}) }, ...options }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || 'Request failed'); return payload; };
  const clear = (target) => target.replaceChildren();
  const cell = (text) => { const item = document.createElement('td'); item.textContent = text; return item; };
  const button = (label, action, className = 'admin-button admin-button--secondary') => { const item = document.createElement('button'); item.type = 'button'; item.className = className; item.textContent = label; item.addEventListener('click', action); return item; };

  async function moderate(kind, item, decision) {
    const note = window.prompt(`Optional moderation note for this ${kind}:`) || '';
    const endpoint = kind === 'Topic' ? `/api/admin/topics/${encodeURIComponent(item.id)}/moderate` : `/api/admin/topics/replies/${encodeURIComponent(item.id)}/moderate`;
    await request(endpoint, { method:'POST', body:JSON.stringify({ decision, note }) });
    if (kind === 'Topic' && decision === 'public') {
      const verificationKind = window.prompt('Optional: create a contributor verification task? Enter one of: broad_locality, factual_observation, price_observation, public_place_reference, staleness_review. Leave blank to skip.');
      if (verificationKind) await request('/api/admin/tasks/topic-verification', { method:'POST', body:JSON.stringify({ topicId:item.id, verificationKind }) });
      const resourceSlug = window.prompt('Optional: link an existing CMS resource slug to this public Topic. Leave blank to skip.');
      if (resourceSlug) await request(`/api/admin/topics/${encodeURIComponent(item.id)}/resources`, { method:'POST', body:JSON.stringify({ resourceSlug }) });
    }
    status.textContent = `${kind} ${decision}.`;
    await load();
  }

  function decisions(kind, item) {
    const holder = document.createElement('td');
    holder.append(button('Make public', () => moderate(kind, item, 'public'), 'admin-button'));
    holder.append(button('Restrict', () => moderate(kind, item, 'restricted')));
    holder.append(button('Remove', () => moderate(kind, item, 'removed')));
    return holder;
  }

  function renderTopics(topics) {
    const target = document.getElementById('topics-admin-queue'); clear(target);
    if (!topics.length) { const row = document.createElement('tr'); const empty = cell('No submitted or restricted Topics need review.'); empty.colSpan = 4; empty.className = 'admin-empty-state'; row.append(empty); target.append(row); return; }
    topics.forEach((topic) => { const row = document.createElement('tr'); row.append(cell(`${topic.title}\n\n${concise(topic.body)}`), cell([topic.type, topic.category || 'No category', topic.city || 'No locality'].filter(Boolean).join(' · ')), cell(date(topic.updatedAt)), decisions('Topic', topic)); target.append(row); });
  }

  function renderReplies(replies) {
    const target = document.getElementById('topics-admin-replies'); clear(target);
    if (!replies.length) { const row = document.createElement('tr'); const empty = cell('No submitted or restricted replies need review.'); empty.colSpan = 4; empty.className = 'admin-empty-state'; row.append(empty); target.append(row); return; }
    replies.forEach((reply) => { const row = document.createElement('tr'); row.append(cell(concise(reply.body)), cell(reply.topicId), cell(date(reply.updatedAt)), decisions('Reply', reply)); target.append(row); });
  }

  function renderReports(reports) {
    const target = document.getElementById('topics-admin-reports'); clear(target);
    if (!reports.length) { const row = document.createElement('tr'); const empty = cell('No open Topic reports.'); empty.colSpan = 4; empty.className = 'admin-empty-state'; row.append(empty); target.append(row); return; }
    reports.forEach((report) => { const row = document.createElement('tr'); const review = document.createElement('td'); review.append(button('Close report', async () => { const note = window.prompt('Optional review note:') || ''; try { await request(`/api/admin/topics/reports/${encodeURIComponent(report.id)}/close`, { method:'POST', body:JSON.stringify({ note }) }); status.textContent = 'Report closed.'; await load(); } catch (error) { status.textContent = error instanceof Error ? error.message : 'Unable to close report'; } })); row.append(cell(`${report.targetType} · ${report.targetId}`), cell(`${report.reason}${report.detail ? ` — ${concise(report.detail, 90)}` : ''}`), cell(date(report.createdAt)), review); target.append(row); });
  }

  async function load() {
    const hasAdminSession = ['kurukoo_admin', 'kurukoo_admin_token'].some((key) => Boolean(window.localStorage.getItem(key)));
    if (!hasAdminSession) {
      status.textContent = 'Sign in as an administrator to review Topic moderation queues.';
      return;
    }
    status.textContent = 'Loading moderation queues…';
    try { const [topics, replies, reports] = await Promise.all([request('/api/admin/topics/submitted'), request('/api/admin/topics/replies/submitted'), request('/api/admin/topics/reports')]); renderTopics(topics.topics || []); renderReplies(replies.replies || []); renderReports(reports.reports || []); status.textContent = 'Queues are current. Public status only makes reviewed shared context visible.'; }
    catch (error) { status.textContent = error instanceof Error ? error.message : 'Unable to load Topic moderation queues.'; }
  }

  document.querySelector('[data-topics-refresh]')?.addEventListener('click', load);
  load();
})();
