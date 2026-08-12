(() => {
  const qs = (selector) => document.querySelector(selector);
  const qsa = (selector) => Array.from(document.querySelectorAll(selector));
  const section = document.body?.dataset.workspaceSection || '';
  const input = document.getElementById('message-input');
  const chatSidebar = document.getElementById('chat-sidebar');
  const workspaceSidebar = document.getElementById('workspace-sidebar');

  const seedPrompt = (prompt) => {
    if (!input || !prompt) return;
    input.value = prompt;
    input.focus();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    chatSidebar?.classList.remove('open');
  };

  const toggleChatSidebar = (open) => {
    if (!chatSidebar) return;
    chatSidebar.classList.toggle('open', open);
    qs('#open-sidebar')?.setAttribute('aria-expanded', String(open));
  };

  const api = async (path, options = {}) => {
    const response = await fetch(path, { credentials: 'same-origin', ...options });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    const payload = await response.json();
    if (payload?.success === false) throw new Error(payload.error || 'Request failed');
    return payload;
  };

  const formatDate = (value) => {
    if (!value) return 'Schedule unavailable';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Schedule unavailable' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };

  const humanize = (value) => String(value || 'Not yet available').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const clear = (element) => { if (element) element.replaceChildren(); };
  const setEmpty = (selector, visible) => qs(selector)?.toggleAttribute('hidden', !visible);

  const makeDataCard = ({ eyebrow, title, detail, state, action }) => {
    const card = document.createElement('article');
    card.className = 'workspace-data-card';
    if (eyebrow) { const label = document.createElement('span'); label.className = 'workspace-eyebrow'; label.textContent = eyebrow; card.appendChild(label); }
    const heading = document.createElement('h3'); heading.textContent = title; card.appendChild(heading);
    if (detail) { const paragraph = document.createElement('p'); paragraph.textContent = detail; card.appendChild(paragraph); }
    const footer = document.createElement('div'); footer.className = 'workspace-data-card-footer';
    if (state) { const status = document.createElement('span'); status.className = 'status-pill'; status.textContent = state; footer.appendChild(status); }
    if (action) footer.appendChild(action);
    if (footer.childNodes.length) card.appendChild(footer);
    return card;
  };

  const requestSummary = (request) => {
    const source = request.requirements || request.requirements_json || {};
    const requirements = typeof source === 'string' ? (() => { try { return JSON.parse(source); } catch { return {}; } })() : source;
    const details = [requirements.origin, requirements.destination, requirements.location, requirements.items, requirements.service, requirements.event].filter(Boolean).map(String);
    return details.length ? details.slice(0, 2).join(' · ') : 'Details are in the linked conversation.';
  };

  const loadRequests = async () => {
    const list = qs('[data-requests-list]');
    if (!list) return [];
    try {
      const payload = await api('/api/chat/economic-requests');
      const requests = Array.isArray(payload.requests) ? payload.requests : [];
      clear(list);
      const openStatuses = new Set(['requested', 'awaiting_match', 'partially_matched', 'matched', 'quoting', 'quoted', 'awaiting_confirmation', 'reserved', 'payment_pending', 'paid', 'in_fulfillment', 'fulfilled', 'disputed']);
      const actionStatuses = new Set(['awaiting_confirmation', 'payment_pending']);
      qsa('[data-request-metric="open"]').forEach((node) => { node.textContent = String(requests.filter((item) => openStatuses.has(item.status)).length); });
      qsa('[data-request-metric="action"]').forEach((node) => { node.textContent = String(requests.filter((item) => actionStatuses.has(item.status)).length); });
      qsa('[data-request-metric="completed"]').forEach((node) => { node.textContent = String(requests.filter((item) => item.status === 'completed').length); });
      requests.forEach((request) => {
        const action = document.createElement('a');
        action.className = 'workspace-text-action';
        action.href = `/chat?prompt=${encodeURIComponent(`Continue my ${request.skill || 'request'}`)}`;
        action.textContent = 'Continue in chat';
        list.appendChild(makeDataCard({ eyebrow: humanize(request.category || 'Request'), title: humanize(request.skill || request.category || 'Request'), detail: requestSummary(request), state: humanize(request.status), action }));
      });
      setEmpty('[data-requests-empty]', requests.length === 0);
      return requests;
    } catch (_) {
      setEmpty('[data-requests-empty]', true);
      qsa('[data-request-metric]').forEach((node) => { node.textContent = '—'; });
      return [];
    }
  };

  const cancelReminder = async (id, button) => {
    button.disabled = true;
    try { await api(`/api/reminders/${encodeURIComponent(id)}/cancel`, { method: 'POST' }); await loadReminders(); }
    catch (_) { button.disabled = false; button.textContent = 'Could not cancel'; }
  };

  const loadReminders = async () => {
    const list = qs('[data-reminders-list]');
    if (!list) return [];
    try {
      const payload = await api('/api/reminders');
      const reminders = Array.isArray(payload.reminders) ? payload.reminders : [];
      clear(list);
      reminders.forEach((reminder) => {
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'workspace-text-action';
        cancel.textContent = 'Cancel reminder';
        cancel.addEventListener('click', () => cancelReminder(reminder.id, cancel));
        list.appendChild(makeDataCard({ eyebrow: formatDate(reminder.dueAt || reminder.due_at), title: reminder.title || 'Reminder', detail: reminder.note || 'Created from your Kurukoo conversation.', state: humanize(reminder.status || 'upcoming'), action: cancel }));
      });
      setEmpty('[data-reminders-empty]', reminders.length === 0);
      return reminders;
    } catch (_) {
      setEmpty('[data-reminders-empty]', true);
      return [];
    }
  };

  const loadPoints = async () => {
    const balance = qs('[data-points-balance]');
    if (!balance) return;
    try {
      const payload = await api('/api/points/balance');
      balance.textContent = String(payload.points ?? '0');
      const tier = qs('[data-points-tier]');
      if (tier) tier.textContent = payload.tier ? `${humanize(payload.tier)} tier` : 'Points are available according to the current deployment and policy.';
    } catch (_) {
      balance.textContent = 'Not yet available';
      const tier = qs('[data-points-tier]');
      if (tier) tier.textContent = 'Points are not available in this deployment.';
    }
  };

  const postSafetyAction = async (path, body, button) => {
    button.disabled = true;
    try {
      await api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
      await loadSafety();
    } catch (_) {
      button.disabled = false;
      button.textContent = 'Could not update';
    }
  };

  const loadSafety = async () => {
    const contactsList = qs('[data-safety-contacts]');
    const checkinsList = qs('[data-safety-checkins]');
    if (!contactsList && !checkinsList) return;
    try {
      const [contactsPayload, checkinsPayload] = await Promise.all([api('/api/safety/contacts'), api('/api/safety/check-ins')]);
      const contacts = Array.isArray(contactsPayload.contacts) ? contactsPayload.contacts : [];
      const checkIns = Array.isArray(checkinsPayload.checkIns) ? checkinsPayload.checkIns : [];
      clear(contactsList);
      contacts.forEach((contact) => {
        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'workspace-text-action';
        const active = contact.status === 'active' || contact.active === true;
        action.textContent = active ? 'Revoke contact' : 'Activate with consent';
        action.addEventListener('click', () => postSafetyAction(`/api/safety/contacts/${encodeURIComponent(contact.id)}/${active ? 'revoke' : 'activate'}`, active ? {} : { consentConfirmed: true }, action));
        contactsList?.appendChild(makeDataCard({ eyebrow: contact.relationship || 'Safety contact', title: contact.name || 'Trusted contact', detail: active ? 'Activated by your consent. No notification has been sent.' : 'Pending your owner consent before this contact can be activated.', state: active ? 'Active' : 'Pending consent', action }));
      });
      clear(checkinsList);
      checkIns.forEach((checkIn) => {
        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'workspace-text-action';
        action.textContent = 'Complete check-in';
        action.addEventListener('click', () => postSafetyAction(`/api/safety/check-ins/${encodeURIComponent(checkIn.id)}/complete`, {}, action));
        checkinsList?.appendChild(makeDataCard({ eyebrow: formatDate(checkIn.dueAt || checkIn.due_at || checkIn.expiresAt || checkIn.expires_at), title: 'Safety check-in', detail: checkIn.routeNote || checkIn.route_note || 'A personal check-in from your Kurukoo conversation.', state: humanize(checkIn.status || 'active'), action }));
      });
      setEmpty('[data-safety-contacts-empty]', contacts.length === 0);
      setEmpty('[data-safety-checkins-empty]', checkIns.length === 0);
    } catch (_) {
      setEmpty('[data-safety-contacts-empty]', true);
      setEmpty('[data-safety-checkins-empty]', true);
    }
  };

  const loadDailyPicks = async () => {
    const list = qs('[data-daily-picks]');
    if (!list) return;
    const [requests, reminders] = await Promise.all([loadRequests(), loadReminders()]);
    clear(list);
    const nextReminder = reminders[0];
    const recentRequest = requests[0];
    if (nextReminder) {
      const row = document.createElement('div');
      row.append(Object.assign(document.createElement('strong'), { textContent: nextReminder.title || 'Review an upcoming reminder' }), Object.assign(document.createElement('small'), { textContent: `Due ${formatDate(nextReminder.dueAt || nextReminder.due_at)}.` }));
      list.appendChild(row);
    }
    if (recentRequest) {
      const row = document.createElement('div');
      row.append(Object.assign(document.createElement('strong'), { textContent: `Continue ${humanize(recentRequest.skill || 'your request')}` }), Object.assign(document.createElement('small'), { textContent: `Current state: ${humanize(recentRequest.status)}.` }));
      list.appendChild(row);
    }
    if (!nextReminder && !recentRequest) {
      const row = document.createElement('div');
      row.append(Object.assign(document.createElement('strong'), { textContent: 'No connected picks yet' }), Object.assign(document.createElement('small'), { textContent: 'Start a conversation to create a request or reminder.' }));
      list.appendChild(row);
    }
  };

  qs('#open-sidebar')?.addEventListener('click', () => toggleChatSidebar(true));
  qs('#close-sidebar')?.addEventListener('click', () => toggleChatSidebar(false));
  qs('#sidebar-collapse')?.addEventListener('click', () => {
    const collapsed = document.body.classList.toggle('chat-sidebar-collapsed');
    localStorage.setItem('kurukoo_chat_sidebar_collapsed', collapsed ? '1' : '0');
  });
  if (localStorage.getItem('kurukoo_chat_sidebar_collapsed') === '1') document.body.classList.add('chat-sidebar-collapsed');

  qs('#workspace-collapse')?.addEventListener('click', () => {
    const collapsed = workspaceSidebar?.classList.toggle('is-collapsed');
    localStorage.setItem('kurukoo_workspace_collapsed', collapsed ? '1' : '0');
  });
  if (workspaceSidebar && localStorage.getItem('kurukoo_workspace_collapsed') === '1') workspaceSidebar.classList.add('is-collapsed');
  qs('#workspace-open')?.addEventListener('click', () => workspaceSidebar?.classList.add('open'));
  workspaceSidebar?.addEventListener('click', (event) => { if (event.target.closest('a')) workspaceSidebar.classList.remove('open'); });

  document.addEventListener('click', async (event) => {
    const promptTarget = event.target.closest('[data-prompt]');
    if (promptTarget) {
      const prompt = promptTarget.dataset.prompt || '';
      if (input && (promptTarget.closest('.workspace-nav') || promptTarget.closest('.quick-actions') || promptTarget.closest('.composer-quick-actions'))) {
        event.preventDefault(); seedPrompt(prompt); return;
      }
    }
    const logout = event.target.closest('#workspace-logout');
    if (logout) {
      event.preventDefault(); logout.disabled = true;
      try {
        const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
        if (!response.ok) throw new Error('Logout failed');
        localStorage.removeItem('kurukoo_auth_token');
        localStorage.removeItem('kurukoo_user_phone');
        localStorage.removeItem('kurukoo_user_name');
        window.location.assign('/chat');
      } catch (_) {
        logout.disabled = false;
        window.location.assign('/chat');
      }
    }
  });

  qsa('[data-proactive-dismiss], [data-proactive-response]').forEach((button) => button.addEventListener('click', () => {
    qs('[data-proactive-card]')?.setAttribute('hidden', '');
    localStorage.setItem('kurukoo_proactive_dismissed', '1');
  }));
  if (localStorage.getItem('kurukoo_proactive_dismissed') === '1') qs('[data-proactive-card]')?.setAttribute('hidden', '');

  const params = new URLSearchParams(window.location.search);
  const prompt = params.get('prompt');
  if (prompt && input) window.requestAnimationFrame(() => seedPrompt(prompt));

  if (section === 'requests') loadRequests();
  if (section === 'reminders') loadReminders();
  if (section === 'points') loadPoints();
  if (section === 'safety') loadSafety();
  if (section === 'daily-picks') loadDailyPicks();
})();
