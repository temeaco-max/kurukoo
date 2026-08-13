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

  const loadAffiliateOffers = async () => {
    const list = qs('[data-affiliate-offers]');
    const status = qs('[data-affiliate-offers-status]');
    const error = qs('[data-affiliate-offers-error]');
    if (!list) return [];
    clear(list);
    if (status) status.textContent = 'Loading offers';
    if (error) { error.hidden = true; error.textContent = ''; }
    try {
      const payload = await api('/api/affiliate/offers');
      const offers = Array.isArray(payload.offers) ? payload.offers : [];
      offers.forEach((offer) => {
        const action = document.createElement('a');
        action.className = 'workspace-text-action';
        action.href = String(offer.visitUrl || '#');
        action.textContent = offer.visitUrl ? 'Continue to external merchant' : 'Destination unavailable';
        if (!offer.visitUrl) action.setAttribute('aria-disabled', 'true');
        const country = offer.country ? ` · ${String(offer.country).toUpperCase()}` : '';
        const disclosure = String(offer.disclosure || 'Affiliate link. This external merchant is not a verified Kurukoo provider.');
        const description = String(offer.description || 'A disclosed external merchant referral.');
        list.appendChild(makeDataCard({
          eyebrow: `Affiliate link${country}`,
          title: String(offer.title || 'External merchant offer'),
          detail: `${description} ${disclosure}`,
          state: 'Not a verified provider',
          action,
        }));
      });
      setEmpty('[data-affiliate-offers-empty]', offers.length === 0);
      if (status) status.textContent = offers.length ? 'Evidence-backed offers' : 'No offers available';
      return offers;
    } catch (_) {
      setEmpty('[data-affiliate-offers-empty]', false);
      if (status) status.textContent = 'Offers unavailable';
      if (error) { error.textContent = 'Affiliate offers could not be loaded. No external merchant action has been taken.'; error.hidden = false; }
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

  const loadPointsHistory = async () => {
    const list = qs('[data-points-history]');
    const status = qs('[data-points-history-status]');
    const error = qs('[data-points-history-error]');
    if (!list) return;
    clear(list);
    if (status) status.textContent = 'Loading activity';
    if (error) { error.hidden = true; error.textContent = ''; }
    try {
      const payload = await api('/api/points/history?limit=20');
      const history = Array.isArray(payload.history) ? payload.history : [];
      history.forEach((entry) => {
        const amount = Number(entry.amount || 0);
        const signedAmount = amount > 0 ? `+${amount}` : String(amount);
        const detail = String(entry.description || 'Points activity');
        const createdAt = entry.created_at || entry.createdAt;
        list.appendChild(makeDataCard({
          eyebrow: formatDate(createdAt),
          title: `${signedAmount} Points`,
          detail,
          state: humanize(entry.type || (amount >= 0 ? 'credit' : 'debit')),
        }));
      });
      setEmpty('[data-points-history-empty]', history.length === 0);
      if (status) status.textContent = history.length ? 'Current activity' : 'No activity yet';
    } catch (_) {
      setEmpty('[data-points-history-empty]', false);
      if (status) status.textContent = 'Activity unavailable';
      if (error) { error.textContent = 'Points activity could not be loaded. Your balance may still be available above.'; error.hidden = false; }
    }
  };

  const acceptTask = async (taskId, button) => {
    button.disabled = true;
    button.textContent = 'Accepting…';
    try {
      await api('/api/tasks/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId }) });
      await Promise.all([loadTasks(), loadContributorTasks()]);
    } catch (_) {
      button.disabled = false;
      button.textContent = 'Could not accept';
    }
  };

  const submitTaskEvidence = async (task, button) => {
    const summary = window.prompt(`Describe the evidence for “${String(task.title || 'this task')}”. Do not include sensitive personal information.`);
    if (!summary?.trim()) return;
    button.disabled = true;
    button.textContent = 'Submitting…';
    try {
      await api('/api/tasks/evidence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: Number(task.id), evidence: { summary: summary.trim() } }) });
      await Promise.all([loadTasks(), loadContributorTasks(), loadPoints(), loadPointsHistory()]);
    } catch (_) {
      button.disabled = false;
      button.textContent = 'Could not submit';
    }
  };

  const loadTasks = async () => {
    const list = qs('[data-tasks-list]');
    const status = qs('[data-tasks-status]');
    const error = qs('[data-tasks-error]');
    if (!list) return [];
    clear(list);
    if (status) status.textContent = 'Loading tasks';
    if (error) { error.hidden = true; error.textContent = ''; }
    try {
      const payload = await api('/api/tasks');
      const tasks = Array.isArray(payload) ? payload : (Array.isArray(payload.tasks) ? payload.tasks : []);
      tasks.forEach((task) => {
        const accept = document.createElement('button');
        accept.type = 'button';
        accept.className = 'workspace-text-action';
        accept.textContent = 'Accept task';
        accept.addEventListener('click', () => { void acceptTask(Number(task.id), accept); });
        const reward = Number(task.pointsReward || task.credits_reward || task.points_reward || 0);
        const rewardCopy = reward > 0 ? `Potential reward: ${reward} Points after the documented task lifecycle completes.` : 'Potential reward is not specified for this task.';
        list.appendChild(makeDataCard({
          eyebrow: humanize(task.skill_tag || 'Contribution'),
          title: String(task.title || 'Contribution task'),
          detail: `${String(task.description || 'Task details are provided by the contributor service.')} ${rewardCopy}`,
          state: 'Available',
          action: accept,
        }));
      });
      setEmpty('[data-tasks-empty]', tasks.length === 0);
      if (status) status.textContent = tasks.length ? 'Available now' : 'No tasks available';
      return tasks;
    } catch (_) {
      setEmpty('[data-tasks-empty]', false);
      if (status) status.textContent = 'Tasks unavailable';
      if (error) { error.textContent = 'Tasks could not be loaded. No task or reward status has changed.'; error.hidden = false; }
      return [];
    }
  };

  const loadContributorTasks = async () => {
    const list = qs('[data-my-tasks-list]');
    const status = qs('[data-my-tasks-status]');
    const error = qs('[data-my-tasks-error]');
    if (!list) return [];
    clear(list);
    if (status) status.textContent = 'Loading your tasks';
    if (error) { error.hidden = true; error.textContent = ''; }
    try {
      const payload = await api('/api/tasks/mine');
      const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
      tasks.forEach((task) => {
        const taskStatus = String(task.status || 'in_progress');
        const reward = Number(task.pointsReward || task.credits_reward || 0);
        let detail = String(task.description || 'Contribution task');
        let state = humanize(taskStatus);
        let action = null;
        if (taskStatus === 'in_progress') {
          detail = `${detail} Submit a concise evidence summary when the work is ready for review. Points are not awarded until an administrator approves it.`;
          const submit = document.createElement('button');
          submit.type = 'button'; submit.className = 'workspace-text-action'; submit.textContent = 'Submit evidence';
          submit.addEventListener('click', () => { void submitTaskEvidence(task, submit); });
          action = submit;
        } else if (taskStatus === 'submitted') {
          detail = `Evidence submitted${task.submittedAt ? ` ${formatDate(task.submittedAt)}` : ''}. It is awaiting administrator review. No Points have been awarded yet.`;
          state = 'Awaiting review';
        } else if (taskStatus === 'approved') {
          detail = `${task.reviewNote || 'Evidence approved.'}${reward > 0 ? ` ${reward} Points were recorded after approval.` : ''}`;
          state = 'Approved';
        } else if (taskStatus === 'rejected') {
          detail = task.reviewNote || 'The submitted evidence was not approved. No Points were awarded.';
          state = 'Not approved';
        }
        list.appendChild(makeDataCard({ eyebrow: humanize(task.skillTag || task.skill_tag || 'Contribution'), title: String(task.title || 'Contribution task'), detail, state, action }));
      });
      setEmpty('[data-my-tasks-empty]', tasks.length === 0);
      if (status) status.textContent = tasks.length ? 'Your task status' : 'No accepted tasks';
      return tasks;
    } catch (_) {
      setEmpty('[data-my-tasks-empty]', false);
      if (status) status.textContent = 'Tasks unavailable';
      if (error) { error.textContent = 'Your contribution status could not be loaded. No task or Points status has changed.'; error.hidden = false; }
      return [];
    }
  };

  const setProfileFeedback = (selector, message, error = false) => {
    const node = qs(selector);
    if (!node) return;
    node.textContent = message || '';
    node.dataset.kind = error ? 'error' : 'success';
  };

  const loadProfile = async () => {
    const form = qs('[data-profile-form]');
    const memoryProfile = qs('[data-memory-profile]');
    const memoryLocation = qs('[data-memory-location]');
    if (!form && !memoryProfile && !memoryLocation) return null;
    try {
      const payload = await api('/api/profile');
      const profile = payload.profile || {};
      if (form) {
        const fields = new FormData(form);
        form.elements.name.value = String(profile.name || '');
        form.elements.location.value = String(profile.location || '');
        form.elements.country.value = String(profile.country || 'ng');
        qs('[data-profile-phone]')?.replaceChildren(document.createTextNode(String(profile.phone || 'Protected sign-in identity')));
        const status = qs('[data-profile-status]');
        if (status) status.textContent = 'Profile ready';
        void fields;
      }
      if (memoryProfile) memoryProfile.textContent = profile.name ? `Kurukoo uses the profile name “${profile.name}” when you choose to continue your relationship across conversations.` : 'No profile name is available yet.';
      if (memoryLocation) memoryLocation.textContent = profile.location ? `Your current useful location is “${profile.location}”. Update it whenever it stops being relevant.` : 'No useful location is saved yet.';
      return profile;
    } catch (_) {
      const status = qs('[data-profile-status]');
      if (status) status.textContent = 'Profile unavailable';
      if (memoryProfile) memoryProfile.textContent = 'Your profile context is unavailable at the moment.';
      if (memoryLocation) memoryLocation.textContent = 'Your location context is unavailable at the moment.';
      return null;
    }
  };

  const saveProfile = async (form) => {
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    setProfileFeedback('[data-profile-feedback]', 'Saving…');
    try {
      const values = new FormData(form);
      await api('/api/profile/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: String(values.get('name') || '').trim(), location: String(values.get('location') || '').trim(), country: String(values.get('country') || 'ng') }) });
      setProfileFeedback('[data-profile-feedback]', 'Profile saved.');
      await loadProfile();
    } catch (_) {
      setProfileFeedback('[data-profile-feedback]', 'Could not save your profile. Please try again.', true);
    } finally { if (button) button.disabled = false; }
  };

  const exportProfileData = async () => {
    const button = qs('[data-profile-export]');
    if (button) button.disabled = true;
    setProfileFeedback('[data-data-feedback]', 'Preparing your available data…');
    try {
      const payload = await api('/api/profile/export');
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = 'kurukoo-data-export.json'; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      setProfileFeedback('[data-data-feedback]', 'Your available data export has been downloaded.');
    } catch (_) { setProfileFeedback('[data-data-feedback]', 'Could not prepare your data export. Please try again.', true); }
    finally { if (button) button.disabled = false; }
  };

  const deleteProfile = async () => {
    if (!window.confirm('Delete your Kurukoo account and its associated data? This cannot be undone.')) return;
    const button = qs('[data-profile-delete]');
    if (button) button.disabled = true;
    setProfileFeedback('[data-data-feedback]', 'Deleting account…');
    try {
      await api('/api/profile/delete', { method: 'DELETE' });
      localStorage.removeItem('kurukoo_auth_token'); localStorage.removeItem('kurukoo_user_phone'); localStorage.removeItem('kurukoo_user_name');
      window.location.assign('/chat');
    } catch (_) { setProfileFeedback('[data-data-feedback]', 'Could not delete your account. Please try again.', true); if (button) button.disabled = false; }
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
  if (section === 'saved') loadAffiliateOffers();
  qs('[data-profile-form]')?.addEventListener('submit', event => { event.preventDefault(); void saveProfile(event.currentTarget); });
  qs('[data-profile-export]')?.addEventListener('click', () => void exportProfileData());
  qs('[data-profile-delete]')?.addEventListener('click', () => void deleteProfile());
  if (section === 'points') { loadPoints(); loadPointsHistory(); }
  if (section === 'tasks') { loadTasks(); loadContributorTasks(); }
  if (section === 'safety') loadSafety();
  if (section === 'daily-picks') loadDailyPicks();
  if (section === 'settings' || section === 'memory') loadProfile();
})();
