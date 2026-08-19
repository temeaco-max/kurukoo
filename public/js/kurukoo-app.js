/* Canonical authenticated Web App interaction layer. It never invents server state. */
(function () {
  'use strict';
  const root = document.querySelector('[data-kurukoo-app]') || document.querySelector('.k-app-page');
  if (!root) return;
  const section = root.dataset.appSection || document.body?.dataset.appSection || '';
  const q = (selector) => root.querySelector(selector);
  const api = async (url, options = {}) => {
    const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { Accept: 'application/json', ...(options.headers || {}) } });
    const type = response.headers.get('content-type') || '';
    const payload = type.includes('application/json') ? await response.json() : { message: await response.text() };
    if (!response.ok) throw new Error(payload.error || payload.message || `Request failed (${response.status})`);
    return payload;
  };
  const announce = (message) => {
    let live = q('[data-app-live]');
    if (!live) { live = document.createElement('div'); live.dataset.appLive = ''; live.className = 'k-sr-only'; live.setAttribute('aria-live', 'polite'); root.appendChild(live); }
    live.textContent = message;
  };
  const humanize = (value) => String(value || 'Not available').replaceAll('_', ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  const setLoading = (node, value) => { if (node) node.textContent = value; };
  const setText = (selector, value) => { root.querySelectorAll(selector).forEach((node) => { node.textContent = value; }); };

  async function loadTasks() {
    const host = q('[data-task-list]'); if (!host) return;
    setLoading(host, 'Loading available tasks…');
    try {
      const payload = await api('/api/tasks');
      const tasks = Array.isArray(payload) ? payload : Array.isArray(payload.tasks) ? payload.tasks : [];
      host.replaceChildren();
      if (!tasks.length) { const empty = document.createElement('p'); empty.className = 'k-muted'; empty.textContent = 'No available tasks right now.'; host.appendChild(empty); return; }
      tasks.forEach((task) => {
        const card = document.createElement('article'); card.className = 'k-app-card';
        const title = document.createElement('h3'); title.textContent = task.title || task.name || `Task ${task.id}`;
        const detail = document.createElement('p'); detail.textContent = task.description || task.instructions || 'Complete this task according to the supplied instructions.';
        const state = document.createElement('span'); state.className = 'k-status k-status--ready'; state.textContent = humanize(task.status || 'available');
        const action = document.createElement('button'); action.type = 'button'; action.className = 'k-app-primary'; action.textContent = 'Accept task';
        action.addEventListener('click', async () => { action.disabled = true; try { await api('/api/tasks/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: task.id }) }); announce('Task accepted.'); await loadTasks(); } catch (error) { action.disabled = false; announce(error.message); } });
        card.append(title, detail, state, action); host.appendChild(card);
      });
    } catch (error) { setLoading(host, error.message || 'Tasks are unavailable right now.'); }
  }

  async function loadRequests() {
    const list = q('[data-request-list]'); if (!list) return;
    setLoading(list, 'Loading canonical request state…');
    try {
      const payload = await api('/api/chat/economic-requests');
      const requests = Array.isArray(payload.requests) ? payload.requests : [];
      list.replaceChildren();
      const counts = { open: 0, action: 0, completed: 0 };
      const open = new Set(['requested','awaiting_match','partially_matched','matched','quoting','quoted','awaiting_confirmation','reserved','payment_pending','paid','in_fulfillment','fulfilled','disputed']);
      requests.forEach((r) => { if (open.has(r.status)) counts.open++; if (['awaiting_confirmation','payment_pending'].includes(r.status)) counts.action++; if (r.status === 'completed' || r.status === 'fulfilled') counts.completed++; });
      setText('[data-request-count="open"]', counts.open); setText('[data-request-count="action"]', counts.action); setText('[data-request-count="completed"]', counts.completed);
      if (!requests.length) { const empty = document.createElement('p'); empty.className = 'k-muted'; empty.textContent = 'No requests have been created yet. Start in Chat to create one.'; list.appendChild(empty); return; }
      requests.forEach((request) => {
        const card = document.createElement('article'); card.className = 'k-app-card';
        const title = document.createElement('h3'); title.textContent = humanize(request.skill || request.category || 'Request');
        const detail = document.createElement('p'); detail.textContent = humanize(request.status || 'unknown');
        const action = document.createElement('a'); action.className = 'k-app-card-action'; action.href = `/chat?prompt=${encodeURIComponent(`Continue my ${request.skill || request.category || 'request'}`)}`; action.textContent = 'Continue in Chat →';
        card.append(title, detail, action); list.appendChild(card);
      });
    } catch (error) { setLoading(list, error.message || 'Requests are unavailable right now.'); }
  }

  async function loadNotifications() {
    const list = q('[data-notification-list]'); if (!list) return;
    setLoading(list, 'Loading notification state…');
    try {
      const payload = await api('/api/notifications');
      const items = Array.isArray(payload.notifications) ? payload.notifications : Array.isArray(payload) ? payload : [];
      list.replaceChildren();
      if (!items.length) { const empty = document.createElement('p'); empty.className = 'k-muted'; empty.textContent = 'No notifications right now.'; list.appendChild(empty); return; }
      items.forEach((item) => {
        const card = document.createElement('article'); card.className = 'k-app-card';
        const title = document.createElement('h3'); title.textContent = item.title || item.type || 'Notification';
        const body = document.createElement('p'); body.textContent = item.body || item.message || 'Notification from Kurukoo.';
        card.append(title, body);
        if (item.id && !item.readAt && !item.read) { const button = document.createElement('button'); button.type = 'button'; button.className = 'k-app-card-action'; button.textContent = 'Mark as read'; button.addEventListener('click', async () => { button.disabled = true; try { await api(`/api/notifications/${encodeURIComponent(item.id)}/read`, { method: 'POST' }); card.classList.add('is-read'); announce('Notification marked as read.'); } catch (error) { button.disabled = false; announce(error.message); } }); card.appendChild(button); }
        list.appendChild(card);
      });
    } catch (error) { setLoading(list, error.message || 'Notifications are unavailable right now.'); }
  }

  async function loadPoints() {
    const balance = q('[data-points-balance]'); if (!balance) return;
    setLoading(balance, 'Loading…'); setText('[data-points-tier]', 'Loading…');
    try {
      const payload = await api('/api/points/balance');
      setText('[data-points-balance]', Number.isFinite(Number(payload.points)) ? String(payload.points) : '0');
      setText('[data-points-tier]', payload.tier || 'Base');
      const disabled = payload.currency === 'NGN' && Number(payload.points) === 0 && payload.tier === 'Base';
      const note = q('[data-points-note]'); if (note) note.textContent = disabled ? 'Points may be disabled for this account or region; the canonical service returned a zero balance.' : 'Balance is supplied by the canonical Points service.';
    } catch (error) { setLoading(balance, 'Unavailable'); setText('[data-points-tier]', 'Unavailable'); const note = q('[data-points-note]'); if (note) note.textContent = error.message || 'Points are unavailable right now.'; }
  }

  async function topUpPoints() {
    const form = q('[data-points-topup]'); if (!form) return;
    const button = form.querySelector('button[type="submit"]'); const input = form.querySelector('input[name="amount_points"]');
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); const amount = Number(input?.value); if (!Number.isInteger(amount) || amount <= 0) { announce('Enter a positive whole number of Points.'); input?.focus(); return; }
      if (button) button.disabled = true;
      try { const payload = await api('/api/points/topup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount_points: amount }) }); announce(payload.message || 'Points credited.'); form.reset(); await loadPoints(); }
      catch (error) { announce(error.message || 'Top-up is unavailable.'); }
      finally { if (button) button.disabled = false; }
    });
  }

  function bindRefresh() {
    root.querySelectorAll('[data-action="refresh"]').forEach((button) => button.addEventListener('click', () => { if (section === 'tasks') loadTasks(); if (section === 'requests') loadRequests(); if (section === 'notifications') loadNotifications(); if (section === 'points') loadPoints(); }));
  }
  function bindSidebar() { const menu = q('[data-action="toggle-sidebar"]'); const sidebar = document.getElementById('app-sidebar') || q('.k-app-sidebar'); if (!menu || !sidebar) return; menu.addEventListener('click', () => sidebar.classList.toggle('is-open')); root.querySelectorAll('.k-app-sidebar a').forEach((link) => link.addEventListener('click', () => sidebar.classList.remove('is-open'))); }

  bindSidebar(); bindRefresh();
  if (section === 'tasks') loadTasks();
  if (section === 'requests') loadRequests();
  if (section === 'notifications') loadNotifications();
  if (section === 'points') loadPoints();
  if (section === 'top-up') { loadPoints(); topUpPoints(); }
})();