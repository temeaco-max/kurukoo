(() => {
  const qs = (selector) => document.querySelector(selector);
  const qsa = (selector) => Array.from(document.querySelectorAll(selector));
  const section = document.body?.dataset.workspaceSection || '';
  const visualFixture = document.body?.dataset.workspaceFixture === 'populated';
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
  const stateTone = (value) => {
    const state = String(value || '').toLowerCase();
    if (['active', 'requested', 'awaiting_match', 'partially_matched', 'matched', 'quoting', 'paid', 'in_fulfillment', 'in_progress'].includes(state)) return 'active';
    if (['waiting', 'waiting_on_dependency', 'quoted', 'reserved'].includes(state)) return 'waiting';
    if (['needs_user', 'awaiting_confirmation', 'payment_pending', 'needs-input'].includes(state)) return 'needs_user';
    if (['blocked', 'failed', 'cancelled', 'expired', 'rejected', 'unavailable', 'disabled'].includes(state)) return state === 'cancelled' || state === 'expired' ? 'unavailable' : state;
    if (['completed', 'approved', 'fulfilled', 'connected', 'ready', 'verified'].includes(state)) return 'completed';
    return '';
  };
  const stateLabel = (value) => ({
    active: 'Working', requested: 'Working', awaiting_match: 'Waiting for a match', partially_matched: 'Working', matched: 'Working', quoting: 'Working', paid: 'Working', in_fulfillment: 'Working', in_progress: 'In progress',
    waiting: 'Waiting', waiting_on_dependency: 'Waiting for earlier work', quoted: 'Waiting for your choice', reserved: 'Waiting for your choice',
    needs_user: 'Your input is needed', awaiting_confirmation: 'Your input is needed', payment_pending: 'Your input is needed',
    blocked: 'Paused safely', failed: 'Needs review', cancelled: 'Stopped', expired: 'Expired', rejected: 'Unavailable', unavailable: 'Unavailable', disabled: 'Disabled',
    completed: 'Completed', approved: 'Completed', fulfilled: 'Completed', connected: 'Connected', ready: 'Ready', verified: 'Verified', available: 'Available',
  }[String(value || '').toLowerCase()] || humanize(value));
  const clear = (element) => { if (element) element.replaceChildren(); };
  const setEmpty = (selector, visible) => qs(selector)?.toggleAttribute('hidden', !visible);

  const makeDataCard = ({ eyebrow, title, detail, state, action }) => {
    const card = document.createElement('article');
    card.className = 'workspace-data-card';
    if (eyebrow) { const label = document.createElement('span'); label.className = 'workspace-eyebrow'; label.textContent = eyebrow; card.appendChild(label); }
    const heading = document.createElement('h3'); heading.textContent = title; card.appendChild(heading);
    if (detail) { const paragraph = document.createElement('p'); paragraph.textContent = detail; card.appendChild(paragraph); }
    const footer = document.createElement('div'); footer.className = 'workspace-data-card-footer';
    if (state) { const status = document.createElement('span'); status.className = 'status-pill'; status.dataset.state = stateTone(state); status.textContent = stateLabel(state); card.dataset.state = status.dataset.state; footer.appendChild(status); }
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
        list.appendChild(makeDataCard({ eyebrow: humanize(request.category || 'Request'), title: humanize(request.skill || request.category || 'Request'), detail: requestSummary(request), state: request.status, action }));
      });
      list.setAttribute('aria-busy', 'false');
      setEmpty('[data-requests-empty]', requests.length === 0);
      setEmpty('[data-requests-error]', false);
      return requests;
    } catch (_) {
      list.setAttribute('aria-busy', 'false');
      clear(list);
      qsa('[data-request-metric]').forEach((node) => { node.textContent = '—'; });
      setEmpty('[data-requests-empty]', false);
      setEmpty('[data-requests-error]', true);
      return [];
    }
  };

  const connectionDetail = (source, provider) => {
    if (source?.connected || source?.status === 'connected') return `${provider} is connected for this authenticated identity. Provider access and data actions remain separately confirmed.`;
    if (source?.configured && source?.enabled) return `${provider} is ready for your owner authorization. No external data is read until the provider confirms the connection.`;
    if (source?.configured) return `${provider} is configured but disabled for this deployment. No external data is read.`;
    return `${provider} is not configured for this deployment. Your external data remains outside Kurukoo.`;
  };

  const connectionState = (source) => {
    if (source?.connected || source?.status === 'connected') return { label: 'Connected', state: 'connected' };
    if (source?.configured && source?.enabled) return { label: 'Ready to connect', state: 'needs-input' };
    if (source?.configured) return { label: 'Disabled for deployment', state: 'unavailable' };
    return { label: 'Not configured', state: 'unavailable' };
  };

  const loadConnections = async () => {
    const list = qs('[data-connect-resource-grid]');
    if (!list) return [];
    const providers = [
      { name: 'Google Drive', endpoint: '/api/artifacts', connect: '/api/artifacts/drive/connect', source: 'storage' },
      { name: 'Google Sheets', endpoint: '/api/artifacts/sheets', connect: '/api/artifacts/sheets/connect' },
      { name: 'Notion', endpoint: '/api/artifacts/notion', connect: '/api/artifacts/notion/connect' },
      { name: 'Outlook Calendar', endpoint: '/api/artifacts/microsoft/calendar', connect: '/api/artifacts/microsoft/calendar/connect' },
      { name: 'OneDrive', endpoint: '/api/artifacts/microsoft/drive', connect: '/api/artifacts/microsoft/drive/connect' },
    ];
    clear(list);
    let failures = 0;
    const outcomes = await Promise.all(providers.map(async (provider) => {
      try {
        const payload = await api(provider.endpoint);
        const source = payload[provider.source || 'source'] || {};
        return { provider, source };
      } catch (_) { failures += 1; return { provider, source: null }; }
    }));
    outcomes.forEach(({ provider, source }) => {
      const card = document.createElement('article');
      card.className = 'workspace-data-card k-connect-resource-card';
      const eyebrow = document.createElement('span'); eyebrow.className = 'workspace-eyebrow'; eyebrow.textContent = 'Connection';
      const heading = document.createElement('h3'); heading.textContent = provider.name;
      const detail = document.createElement('p'); detail.textContent = source ? connectionDetail(source, provider.name) : `${provider.name} readiness is unavailable for this signed-in session. No connection state is inferred.`;
      const footer = document.createElement('div'); footer.className = 'workspace-data-card-footer';
      const state = source ? connectionState(source) : { label: 'Unavailable', state: 'unavailable' };
      const status = document.createElement('span'); status.className = 'status-pill connection-state'; status.dataset.state = state.state; status.textContent = state.label;
      footer.appendChild(status);
      if (source && !(source.connected || source.status === 'connected') && source.configured && source.enabled) {
        const action = document.createElement('button'); action.type = 'button'; action.className = 'workspace-text-action'; action.textContent = `Connect ${provider.name}`;
        action.setAttribute('aria-label', `Connect ${provider.name}`);
        action.addEventListener('click', async () => {
          action.disabled = true;
          try {
            const payload = await api(provider.connect, { method: 'POST' });
            if (payload.authorizationUrl) window.location.assign(payload.authorizationUrl);
            else { action.disabled = false; action.textContent = 'Connection unavailable'; }
          } catch (_) { action.disabled = false; action.textContent = 'Could not start connection'; }
        });
        footer.appendChild(action);
      }
      card.append(eyebrow, heading, detail, footer); list.appendChild(card);
    });
    list.setAttribute('aria-busy', 'false');
    setEmpty('[data-connect-error]', failures === providers.length);
    return outcomes;
  };

  const loadTasks = async () => {
    const list = qs('[data-tasks-list]');
    if (!list) return [];
    const taskStatus = (task) => String(task.status || 'available').toLowerCase();
    const taskTitle = (task) => String(task.title || task.name || `Task ${task.id || ''}`).trim() || 'Task';
    const taskContextHref = (task) => {
      const sourceType = String(task.sourceType || task.source_type || '').toLowerCase();
      const sourceId = task.sourceId || task.source_id;
      if (sourceType === 'topic' && sourceId) return `/topics/${encodeURIComponent(String(sourceId))}`;
      return `/chat?prompt=${encodeURIComponent(`Open my ${taskTitle(task)} context`)}`;
    };
    const taskDetail = (task) => {
      const sourceType = String(task.sourceType || task.source_type || '').trim();
      const sourceId = task.sourceId || task.source_id;
      const source = sourceType ? `Source: ${humanize(sourceType)}${sourceId ? ` #${sourceId}` : ''}.` : '';
      const body = task.description || task.instructions || (task.due_at || task.dueAt ? `Due ${formatDate(task.due_at || task.dueAt)}.` : 'Review the underlying work and evidence in its originating context.');
      return [body, source].filter(Boolean).join(' ');
    };
    try {
      const payload = await api('/api/tasks');
      const tasks = Array.isArray(payload) ? payload : (Array.isArray(payload.tasks) ? payload.tasks : []);
      const metricStatuses = { available: 'available', progress: 'in_progress', completed: 'completed' };
      const order = { available: 0, in_progress: 1, completed: 3 };
      const sortedTasks = [...tasks].sort((left, right) => (order[taskStatus(left)] ?? 2) - (order[taskStatus(right)] ?? 2));
      clear(list);
      qsa('[data-task-metric]').forEach((node) => {
        const metric = node.getAttribute('data-task-metric');
        node.textContent = String(tasks.filter((task) => taskStatus(task) === metricStatuses[metric]).length);
      });
      sortedTasks.forEach((task) => {
        const status = taskStatus(task);
        let action;
        if (task.id && status === 'available') {
          action = document.createElement('button');
          action.type = 'button';
          action.className = 'workspace-text-action';
          action.textContent = 'Accept task';
          action.setAttribute('aria-label', `Accept ${taskTitle(task)}`);
          action.addEventListener('click', async () => {
            action.disabled = true;
            try { await api('/api/tasks/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: task.id }) }); await loadTasks(); }
            catch (_) { action.disabled = false; action.textContent = 'Could not accept — retry'; }
          });
        } else {
          action = document.createElement('a');
          action.className = 'workspace-text-action';
          action.href = taskContextHref(task);
          action.textContent = status === 'in_progress' ? 'Continue task context' : 'Open source context';
          action.setAttribute('aria-label', `${action.textContent}: ${taskTitle(task)}`);
        }
        list.appendChild(makeDataCard({ eyebrow: humanize(task.category || task.kind || 'Task'), title: taskTitle(task), detail: taskDetail(task), state: status, action }));
      });
      list.setAttribute('aria-busy', 'false');
      setEmpty('[data-tasks-empty]', tasks.length === 0);
      setEmpty('[data-tasks-error]', false);
      return tasks;
    } catch (_) {
      list.setAttribute('aria-busy', 'false');
      clear(list);
      qsa('[data-task-metric]').forEach((node) => { node.textContent = '—'; });
      setEmpty('[data-tasks-empty]', false);
      setEmpty('[data-tasks-error]', true);
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
        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'workspace-text-action'; cancel.textContent = 'Cancel reminder';
        cancel.addEventListener('click', () => cancelReminder(reminder.id, cancel));
        list.appendChild(makeDataCard({ eyebrow: formatDate(reminder.dueAt || reminder.due_at), title: reminder.title || 'Reminder', detail: reminder.note || 'Created from your Kurukoo conversation.', state: reminder.status || 'upcoming', action: cancel }));
      });
      setEmpty('[data-reminders-empty]', reminders.length === 0);
      return reminders;
    } catch (_) { setEmpty('[data-reminders-empty]', true); return []; }
  };

  const loadPoints = async () => {
    const balance = qs('[data-points-balance]'); if (!balance) return;
    try {
      const payload = await api('/api/points/balance');
      balance.textContent = String(payload.points ?? '0');
      const tier = qs('[data-points-tier]'); if (tier) tier.textContent = payload.tier ? `${humanize(payload.tier)} tier` : 'Points are available according to the current deployment and policy.';
    } catch (_) {
      balance.textContent = 'Not yet available'; const tier = qs('[data-points-tier]'); if (tier) tier.textContent = 'Points are not available in this deployment.';
    }
  };

  const postSafetyAction = async (path, body, button) => {
    button.disabled = true;
    try { await api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); await loadSafety(); }
    catch (_) { button.disabled = false; button.textContent = 'Could not update'; }
  };

  const loadSafety = async () => {
    const contactsList = qs('[data-safety-contacts]'); const checkinsList = qs('[data-safety-checkins]'); if (!contactsList && !checkinsList) return;
    try {
      const [contactsPayload, checkinsPayload] = await Promise.all([api('/api/safety/contacts'), api('/api/safety/check-ins')]);
      const contacts = Array.isArray(contactsPayload.contacts) ? contactsPayload.contacts : []; const checkIns = Array.isArray(checkinsPayload.checkIns) ? checkinsPayload.checkIns : [];
      clear(contactsList); contacts.forEach((contact) => { const action = document.createElement('button'); action.type = 'button'; action.className = 'workspace-text-action'; const active = contact.status === 'active' || contact.active === true; action.textContent = active ? 'Revoke contact' : 'Activate with consent'; action.addEventListener('click', () => postSafetyAction(`/api/safety/contacts/${encodeURIComponent(contact.id)}/${active ? 'revoke' : 'activate'}`, active ? {} : { consentConfirmed: true }, action)); contactsList?.appendChild(makeDataCard({ eyebrow: contact.relationship || 'Safety contact', title: contact.name || 'Trusted contact', detail: active ? 'Activated by your consent. No notification has been sent.' : 'Pending your owner consent before this contact can be activated.', state: active ? 'Active' : 'Pending consent', action })); });
      clear(checkinsList); checkIns.forEach((checkIn) => { const action = document.createElement('button'); action.type = 'button'; action.className = 'workspace-text-action'; action.textContent = 'Complete check-in'; action.addEventListener('click', () => postSafetyAction(`/api/safety/check-ins/${encodeURIComponent(checkIn.id)}/complete`, {}, action)); checkinsList?.appendChild(makeDataCard({ eyebrow: formatDate(checkIn.dueAt || checkIn.due_at || checkIn.expiresAt || checkIn.expires_at), title: 'Safety check-in', detail: checkIn.routeNote || checkIn.route_note || 'A personal check-in from your Kurukoo conversation.', state: humanize(checkIn.status || 'active'), action })); });
      setEmpty('[data-safety-contacts-empty]', contacts.length === 0); setEmpty('[data-safety-checkins-empty]', checkIns.length === 0);
    } catch (_) { setEmpty('[data-safety-contacts-empty]', true); setEmpty('[data-safety-checkins-empty]', true); }
  };

  const loadDailyPicks = async () => {
    const list = qs('[data-daily-picks]'); if (!list) return;
    const [requests, reminders] = await Promise.all([loadRequests(), loadReminders()]); clear(list);
    const nextReminder = reminders[0]; const recentRequest = requests[0];
    if (nextReminder) { const row = document.createElement('div'); row.append(Object.assign(document.createElement('strong'), { textContent: nextReminder.title || 'Review an upcoming reminder' }), Object.assign(document.createElement('small'), { textContent: `Due ${formatDate(nextReminder.dueAt || nextReminder.due_at)}.` })); list.appendChild(row); }
    if (recentRequest) { const row = document.createElement('div'); row.append(Object.assign(document.createElement('strong'), { textContent: `Continue ${humanize(recentRequest.skill || 'your request')}` }), Object.assign(document.createElement('small'), { textContent: `Current state: ${humanize(recentRequest.status)}.` })); list.appendChild(row); }
    if (!nextReminder && !recentRequest) { const row = document.createElement('div'); row.append(Object.assign(document.createElement('strong'), { textContent: 'No connected picks yet' }), Object.assign(document.createElement('small'), { textContent: 'Start a conversation to create a request or reminder.' })); list.appendChild(row); }
  };

  const loadArtifacts = async () => {
    const list = qs('[data-artifact-list]'); if (!list) return;
    const state = qs('[data-artifact-storage-state]'); const copy = qs('[data-artifact-storage-copy]'); const connect = qs('[data-artifact-connect]'); const note = qs('[data-artifact-action-note]');
    try {
      const payload = await api('/api/artifacts'); const artifacts = Array.isArray(payload.artifacts) ? payload.artifacts : []; const storage = payload.storage || {};
      if (state) state.textContent = storage.connected ? 'Drive connected' : storage.configured && storage.enabled ? 'Managed fallback' : storage.configured ? 'Drive disabled' : 'Drive setup pending';
      if (copy) copy.textContent = storage.connected ? 'New eligible artifacts are saved to your connected Google Drive and recorded here.' : storage.configured && storage.enabled ? 'Google Drive is available to connect. Until you connect it, saved artifacts use Kurukoo managed fallback storage.' : storage.configured ? 'Google Drive credentials are present, but the external storage feature is disabled. Saved artifacts use Kurukoo managed fallback storage.' : 'Google Drive is not configured for this deployment. Saved artifacts use Kurukoo managed fallback storage when available.';
      if (connect) { connect.hidden = Boolean(storage.connected); connect.disabled = !storage.configured || !storage.enabled; connect.textContent = storage.configured && storage.enabled ? 'Connect Google Drive' : storage.configured ? 'Drive disabled' : 'Drive not configured'; }
      if (note) note.textContent = storage.connected ? 'External files are deleted only when you explicitly request it.' : storage.reason || '';
      clear(list);
      artifacts.forEach((artifact) => {
        const open = document.createElement('a'); open.className = 'workspace-text-action'; open.href = `/api/artifacts/${encodeURIComponent(artifact.id)}/open`; open.textContent = 'Open';
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'workspace-text-action'; remove.textContent = 'Remove reference'; remove.addEventListener('click', async () => { remove.disabled = true; try { await api(`/api/artifacts/${encodeURIComponent(artifact.id)}`, { method: 'DELETE' }); await loadArtifacts(); } catch (_) { remove.disabled = false; remove.textContent = 'Could not remove'; } });
        const actions = document.createElement('span'); actions.append(open, document.createTextNode(' · '), remove);
        const detail = `${humanize(artifact.kind)} · ${artifact.bytes || 0} bytes · ${humanize(artifact.durability)}${artifact.transcriptStatus && artifact.transcriptStatus !== 'not_requested' ? ` · Transcript ${humanize(artifact.transcriptStatus)}` : ''}`;
        list.appendChild(makeDataCard({ eyebrow: formatDate(artifact.createdAt), title: artifact.filename || 'Artifact', detail, state: humanize(artifact.storageProvider), action: actions }));
      });
      setEmpty('[data-artifact-empty]', artifacts.length === 0);
    } catch (_) {
      if (state) state.textContent = 'Unavailable'; if (copy) copy.textContent = 'Artifact history is unavailable for this signed-in session.'; setEmpty('[data-artifact-empty]', true);
    }
  };

  const connectArtifactDrive = async (button) => {
    button.disabled = true;
    try { const payload = await api('/api/artifacts/drive/connect', { method: 'POST' }); if (!payload.authorizationUrl) throw new Error('Authorization unavailable'); window.location.assign(payload.authorizationUrl); }
    catch (_) { button.disabled = false; button.textContent = 'Could not start Drive connection'; }
  };

  const loadGoogleSheetsSource = async () => {
    const panel = qs('[data-google-sheets-source]'); if (!panel) return;
    const state = qs('[data-sheets-state]'); const copy = qs('[data-sheets-copy]'); const note = qs('[data-sheets-note]');
    const form = qs('[data-sheets-form]'); const connect = qs('[data-sheets-connect]'); const revoke = qs('[data-sheets-revoke]');
    try {
      const payload = await api('/api/artifacts/sheets'); const source = payload.source || {};
      if (state) state.textContent = source.connected ? 'Sheets connected' : source.configured && source.enabled ? 'Ready to connect' : source.configured ? 'Sheets disabled' : 'Setup pending';
      if (copy) copy.textContent = source.connected ? 'Choose a spreadsheet ID and an A1 range. Reads are bounded previews and spreadsheet values are not saved as Kurukoo artifacts.' : source.configured && source.enabled ? 'Google Sheets is ready for your owner authorization. No spreadsheet data can be read until you connect it.' : source.configured ? 'Google Sheets credentials are present, but this source integration is disabled. No spreadsheet data can be read.' : 'Google Sheets is not configured for this deployment. Your spreadsheets remain outside Kurukoo.';
      if (form) form.hidden = !source.connected;
      if (connect) { connect.hidden = Boolean(source.connected); connect.disabled = !source.configured || !source.enabled; connect.textContent = source.configured && source.enabled ? 'Connect Google Sheets' : source.configured ? 'Sheets disabled' : 'Sheets not configured'; }
      if (revoke) revoke.hidden = !source.connected;
      if (note) note.textContent = source.reason || (source.connected ? 'Revoking removes Kurukoo’s encrypted connection tokens; it does not change your spreadsheet.' : '');
    } catch (_) {
      if (state) state.textContent = 'Unavailable'; if (copy) copy.textContent = 'Google Sheets source status is unavailable for this signed-in session.';
    }
  };

  const renderGoogleSheetsPreview = (source) => {
    const list = qs('[data-sheets-results]'); if (!list) return; clear(list);
    const rows = Array.isArray(source?.values) ? source.values : [];
    rows.slice(0, 12).forEach((row, index) => {
      const values = Array.isArray(row) ? row.slice(0, 8).map((cell) => String(cell ?? '')).join(' · ') : '';
      list.appendChild(makeDataCard({ eyebrow: `Row ${index + 1}`, title: values || 'Blank row', detail: index === 0 ? `${source.range || 'Selected range'} · Bounded preview only` : '', state: index === 0 && source.truncated ? 'Preview truncated' : undefined }));
    });
    setEmpty('[data-sheets-empty]', rows.length === 0);
  };

  const readGoogleSheetsSource = async (button) => {
    const id = qs('[data-sheets-id]')?.value?.trim(); const range = qs('[data-sheets-range]')?.value?.trim();
    if (!id || !range) { const note = qs('[data-sheets-note]'); if (note) note.textContent = 'Enter a spreadsheet ID and an A1 range before reading.'; return; }
    button.disabled = true;
    try { const payload = await api('/api/artifacts/sheets/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ spreadsheetId: id, range }) }); renderGoogleSheetsPreview(payload.source); const note = qs('[data-sheets-note]'); if (note) note.textContent = payload.source?.truncated ? 'The provider confirmed the range. This compact preview is truncated to Kurukoo’s safety limit.' : 'The provider confirmed the requested bounded range.'; }
    catch (_) { const note = qs('[data-sheets-note]'); if (note) note.textContent = 'Kurukoo could not confirm this spreadsheet range. Check the owner connection, ID, range, and provider access.'; }
    finally { button.disabled = false; }
  };

  const connectGoogleSheetsSource = async (button) => {
    button.disabled = true;
    try { const payload = await api('/api/artifacts/sheets/connect', { method: 'POST' }); if (!payload.authorizationUrl) throw new Error('Authorization unavailable'); window.location.assign(payload.authorizationUrl); }
    catch (_) { button.disabled = false; button.textContent = 'Could not start Sheets connection'; }
  };

  const revokeGoogleSheetsSource = async (button) => {
    button.disabled = true;
    try { await api('/api/artifacts/sheets/revoke', { method: 'POST' }); await loadGoogleSheetsSource(); renderGoogleSheetsPreview({ values: [] }); }
    catch (_) { button.disabled = false; button.textContent = 'Could not revoke'; }
  };

  const loadNotionSource = async () => {
    const panel = qs('[data-notion-source]'); if (!panel) return;
    const state = qs('[data-notion-state]'); const copy = qs('[data-notion-copy]'); const note = qs('[data-notion-note]'); const form = qs('[data-notion-form]'); const connect = qs('[data-notion-connect]'); const revoke = qs('[data-notion-revoke]');
    try {
      const payload = await api('/api/artifacts/notion'); const source = payload.source || {};
      if (state) state.textContent = source.connected ? 'Notion connected' : source.configured && source.enabled ? 'Ready to connect' : source.configured ? 'Notion disabled' : 'Setup pending';
      if (copy) copy.textContent = source.connected ? 'Search only the pages you chose to share. Results are a bounded in-memory preview, not a background workspace mirror.' : source.configured && source.enabled ? 'Notion is ready for your owner authorization. No workspace data can be searched until you connect it.' : source.configured ? 'Notion credentials are present, but this source integration is disabled. No workspace data can be searched.' : 'Notion is not configured for this deployment. Your pages remain outside Kurukoo.';
      if (form) form.hidden = !source.connected;
      if (connect) { connect.hidden = Boolean(source.connected); connect.disabled = !source.configured || !source.enabled; connect.textContent = source.configured && source.enabled ? 'Connect Notion' : source.configured ? 'Notion disabled' : 'Notion not configured'; }
      if (revoke) revoke.hidden = !source.connected;
      if (note) note.textContent = source.reason || (source.connected ? 'Revoking removes Kurukoo’s encrypted connection tokens and attempts provider revocation; it does not delete Notion pages.' : '');
    } catch (_) { if (state) state.textContent = 'Unavailable'; if (copy) copy.textContent = 'Notion source status is unavailable for this signed-in session.'; }
  };

  const renderNotionPreview = (source) => {
    const list = qs('[data-notion-results]'); if (!list) return; clear(list); const items = Array.isArray(source?.items) ? source.items : [];
    items.slice(0, 12).forEach((item) => list.appendChild(makeDataCard({ eyebrow: item.object === 'data_source' ? 'Shared data source' : 'Shared page', title: String(item.title || 'Untitled shared item'), detail: item.lastEditedAt ? `Last edited ${new Date(item.lastEditedAt).toLocaleString()}` : 'Confirmed by Notion', action: item.url ? { label: 'Open in Notion', href: item.url } : undefined, state: source.hasMore ? 'More results available' : undefined })));
    setEmpty('[data-notion-empty]', items.length === 0);
  };

  const searchNotionSource = async (button) => {
    button.disabled = true; const query = qs('[data-notion-query]')?.value?.trim() || '';
    try { const payload = await api('/api/artifacts/notion/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) }); renderNotionPreview(payload.source); const note = qs('[data-notion-note]'); if (note) note.textContent = payload.source?.hasMore ? 'Notion confirmed a bounded result set. Refine the title search to narrow it.' : 'Notion confirmed the shared-page search result.'; }
    catch (_) { const note = qs('[data-notion-note]'); if (note) note.textContent = 'Kurukoo could not confirm this Notion search. Check your connection, shared pages, and provider access.'; }
    finally { button.disabled = false; }
  };

  const connectNotionSource = async (button) => { button.disabled = true; try { const payload = await api('/api/artifacts/notion/connect', { method: 'POST' }); if (!payload.authorizationUrl) throw new Error('Authorization unavailable'); window.location.assign(payload.authorizationUrl); } catch (_) { button.disabled = false; button.textContent = 'Could not start Notion connection'; } };
  const revokeNotionSource = async (button) => { button.disabled = true; try { const result = await api('/api/artifacts/notion/revoke', { method: 'POST' }); await loadNotionSource(); renderNotionPreview({ items: [] }); const note = qs('[data-notion-note]'); if (note) note.textContent = result.providerRevocationConfirmed ? 'Kurukoo connection tokens were removed and Notion confirmed revocation.' : 'Kurukoo connection tokens were removed. Notion did not confirm provider revocation; review the connection in Notion if needed.'; } catch (_) { button.disabled = false; button.textContent = 'Could not revoke'; } };

  const microsoftKind = () => qs('[data-microsoft-kind]')?.value === 'onedrive' ? 'onedrive' : 'outlook';
  const renderMicrosoftPreview = (source) => { const list = qs('[data-microsoft-results]'); if (!list) return; clear(list); const items = Array.isArray(source?.items) ? source.items : []; items.slice(0, 12).forEach((item) => list.appendChild(makeDataCard({ eyebrow: item.kind === 'message' ? 'Basic message metadata' : item.kind === 'folder' ? 'Folder' : 'File', title: String(item.title || 'Unnamed item'), detail: item.detail || 'Confirmed by Microsoft Graph', action: item.url ? { label: 'Open in Microsoft', href: item.url } : undefined, state: source.hasMore ? 'More results available' : undefined }))); setEmpty('[data-microsoft-empty]', items.length === 0); };
  const loadMicrosoftSource = async () => { const state = qs('[data-microsoft-state]'); const copy = qs('[data-microsoft-copy]'); const note = qs('[data-microsoft-note]'); const connect = qs('[data-microsoft-connect]'); const revoke = qs('[data-microsoft-revoke]'); const kind = microsoftKind(); try { const payload = await api(`/api/artifacts/microsoft/${kind}`); const source = payload.source || {}; if (state) state.textContent = source.connected ? `${kind === 'outlook' ? 'Outlook' : 'OneDrive'} connected` : source.configured && source.enabled ? 'Ready to connect' : source.configured ? 'Microsoft disabled' : 'Setup pending'; if (copy) copy.textContent = source.connected ? (kind === 'outlook' ? 'Outlook may list only bounded basic message metadata; message bodies are never requested.' : 'OneDrive may list a bounded folder view; files are not imported or synchronized.') : source.configured && source.enabled ? 'Microsoft is ready for owner authorization. No source content is read until you connect this selected source.' : source.configured ? 'Microsoft credentials are present but this selected source is disabled. No content can be read.' : 'Microsoft Graph is not configured for this deployment. Your mailbox and files remain outside Kurukoo.'; if (connect) { connect.hidden = Boolean(source.connected); connect.disabled = !source.configured || !source.enabled; connect.textContent = source.configured && source.enabled ? `Connect ${kind === 'outlook' ? 'Outlook' : 'OneDrive'}` : source.configured ? 'Microsoft source disabled' : 'Microsoft not configured'; } if (revoke) revoke.hidden = !source.connected; if (note) note.textContent = source.reason || (source.connected ? 'Removing this connection deletes Kurukoo’s encrypted tokens. Review Microsoft account permissions separately if you also want to remove application consent.' : ''); } catch (_) { if (state) state.textContent = 'Unavailable'; if (copy) copy.textContent = 'Microsoft source status is unavailable for this signed-in session.'; } };
  const connectMicrosoftSource = async (button) => { button.disabled = true; const kind = microsoftKind(); try { const payload = await api(`/api/artifacts/microsoft/${kind}/connect`, { method: 'POST' }); if (!payload.authorizationUrl) throw new Error('Authorization unavailable'); window.location.assign(payload.authorizationUrl); } catch (_) { button.disabled = false; button.textContent = 'Could not start Microsoft connection'; } };
  const listMicrosoftSource = async (button) => { button.disabled = true; const kind = microsoftKind(); const query = qs('[data-microsoft-query]')?.value?.trim() || ''; try { const payload = await api(`/api/artifacts/microsoft/${kind}/list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) }); renderMicrosoftPreview(payload.source); const note = qs('[data-microsoft-note]'); if (note) note.textContent = payload.source?.hasMore ? 'Microsoft confirmed a bounded first page. Refine the search or browse Microsoft directly for more.' : 'Microsoft confirmed the bounded source list.'; } catch (_) { const note = qs('[data-microsoft-note]'); if (note) note.textContent = 'Kurukoo could not confirm this Microsoft list. Check the selected connection, permissions, and provider access.'; } finally { button.disabled = false; } };
  const revokeMicrosoftSource = async (button) => { button.disabled = true; const kind = microsoftKind(); try { await api(`/api/artifacts/microsoft/${kind}/revoke`, { method: 'POST' }); renderMicrosoftPreview({ items: [] }); await loadMicrosoftSource(); const note = qs('[data-microsoft-note]'); if (note) note.textContent = 'Kurukoo removed its encrypted connection tokens. Microsoft provider consent was not asserted; review your Microsoft account permissions if needed.'; } catch (_) { button.disabled = false; button.textContent = 'Could not remove connection'; } };

  const formatMinorAmount = (amount, currency) => {
    const numeric = Number(amount);
    const code = String(currency || '').trim().toUpperCase();
    if (!Number.isInteger(numeric) || numeric < 0 || !/^[A-Z]{3}$/.test(code)) return 'Price pending confirmation';
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(numeric / 100); }
    catch (_) { return `${numeric} ${code} minor units`; }
  };

  const chatContinuationHref = (request) => {
    const id = String(request?.id || '').trim();
    const skill = humanize(request?.skill || request?.category || 'request');
    const prompt = id ? `Continue my ${skill} request ${id}` : `Continue my ${skill} request`;
    return `/chat?prompt=${encodeURIComponent(prompt)}`;
  };

  const appendDetail = (container, label, value) => {
    const row = document.createElement('div'); row.className = 'workspace-data-card-footer checkout-detail-row';
    const key = document.createElement('span'); key.textContent = label;
    const detail = document.createElement('strong'); detail.textContent = value;
    row.append(key, detail); container.appendChild(row);
  };

  const createWorkspaceButton = (label, secondary = false) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = `workspace-button${secondary ? ' secondary' : ''}`; button.textContent = label; return button;
  };

  const cartRequest = async (path, options = {}) => {
    const response = await fetch(path, { credentials: 'same-origin', ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) throw new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
    return payload;
  };

  const renderCartEmpty = (panel, detail = 'When Kurukoo identifies a product you can request, it can be added here for review.') => {
    const empty = document.createElement('div'); empty.className = 'empty-workspace';
    const title = document.createElement('h3'); title.textContent = 'Your cart is empty';
    const copy = document.createElement('p'); copy.textContent = detail;
    empty.append(title, copy);
    const summary = document.createElement('div'); summary.className = 'cart-summary';
    const boundary = document.createElement('span'); boundary.textContent = 'Request boundary';
    const price = document.createElement('strong'); price.textContent = 'No payment has been taken';
    const note = document.createElement('small'); note.textContent = 'Confirmed prices and payment references appear only after the relevant provider and payment boundary return evidence.';
    const chat = document.createElement('a'); chat.className = 'workspace-button secondary'; chat.href = '/chat'; chat.textContent = 'Source something in Chat';
    summary.append(boundary, price, note, chat); panel.replaceChildren(empty, summary);
  };

  const loadCart = async () => {
    const panel = qs('[data-cart-live]'); if (!panel || visualFixture) return;
    try {
      const payload = await cartRequest('/api/cart'); const items = Array.isArray(payload.items) ? payload.items : [];
      if (!items.length) { renderCartEmpty(panel); return; }
      const list = document.createElement('div'); list.className = 'workspace-data-list';
      items.forEach((item) => {
        const card = document.createElement('article'); card.className = 'workspace-data-card';
        const heading = document.createElement('div'); heading.className = 'panel-heading';
        const headingCopy = document.createElement('div'); const eyebrow = document.createElement('span'); eyebrow.className = 'workspace-eyebrow'; eyebrow.textContent = 'Sourced offer'; const title = document.createElement('h3'); title.textContent = String(item.title || 'Review item'); headingCopy.append(eyebrow, title);
        const state = document.createElement('span'); state.className = 'status-pill'; state.textContent = item.request_id ? 'Request linked' : 'Review required'; heading.append(headingCopy, state); card.appendChild(heading);
        appendDetail(card, 'Quantity', String(Math.max(1, Number(item.quantity) || 1)));
        appendDetail(card, 'Source', String(item.source || item.provenance || 'Source attribution unavailable'));
        appendDetail(card, 'Provider', item.seller ? 'Provider reference recorded' : 'Provider confirmation pending');
        appendDetail(card, 'Listed price', formatMinorAmount(item.price_minor, item.currency));
        if (item.request_id) appendDetail(card, 'Request ID', String(item.request_id));
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'workspace-text-action'; remove.textContent = 'Remove from review cart';
        remove.addEventListener('click', async () => { remove.disabled = true; try { await cartRequest(`/api/cart/items/${encodeURIComponent(item.id)}`, { method: 'DELETE' }); await loadCart(); } catch (error) { remove.disabled = false; remove.textContent = error instanceof Error ? error.message : 'Could not remove'; } });
        const footer = document.createElement('div'); footer.className = 'workspace-data-card-footer'; footer.appendChild(remove); card.appendChild(footer); list.appendChild(card);
      });
      const notice = document.createElement('div'); notice.className = 'workspace-notice'; notice.textContent = 'This is a request review, not an automatic purchase. Availability, final quote, delivery and settlement remain pending until the relevant canonical evidence exists.';
      const summary = document.createElement('div'); summary.className = 'cart-summary';
      const linked = items.length === 1 ? items.find((item) => item.request_id) : null;
      const hasLinkedItems = items.some((item) => item.request_id);
      const label = document.createElement('span'); label.textContent = linked ? 'Request state' : hasLinkedItems ? 'Separate request review required' : 'Confirm request';
      const state = document.createElement('strong'); state.textContent = linked ? 'Economic Request linked' : 'No payment has been taken';
      const note = document.createElement('small'); note.textContent = linked ? 'Review the request evidence, provider state and any verified payment boundary before fulfilment.' : items.length === 1 ? 'Confirming sends one sourced offer to Kurukoo’s canonical Economic Request boundary. It does not take payment.' : 'Review one internal offer at a time so each request, quote, payment and fulfilment state stays separately auditable.';
      const primary = createWorkspaceButton(linked ? 'Open confirmation' : 'Confirm request');
      const status = document.createElement('p'); status.className = 'workspace-action-status'; status.setAttribute('aria-live', 'polite');
      primary.addEventListener('click', async () => {
        if (linked) { window.location.assign(`/confirmation?request=${encodeURIComponent(String(linked.request_id))}`); return; }
        primary.disabled = true; status.textContent = 'Creating an Economic Request…';
        try { const result = await cartRequest('/api/cart/checkout', { method: 'POST' }); const id = String(result.economicRequestId || ''); if (!id) throw new Error('Kurukoo could not confirm the request identity.'); window.location.assign(`/confirmation?request=${encodeURIComponent(id)}`); }
        catch (error) { primary.disabled = false; status.textContent = error instanceof Error ? error.message : 'Kurukoo could not create the request.'; }
      });
      if (!linked && items.length !== 1) primary.disabled = true;
      const chat = document.createElement('a'); chat.className = 'workspace-button secondary'; chat.href = '/chat'; chat.textContent = 'Continue in Chat';
      summary.append(label, state, note, primary, chat, status); panel.replaceChildren(list, notice, summary);
    } catch (_) { renderCartEmpty(panel, 'Your review cart is unavailable for this signed-in session. Continue in Chat and retry when the workspace can reach your account.'); }
  };

  const requestProviderState = (request, coordination) => {
    const participants = Array.isArray(coordination?.participants) ? coordination.participants : [];
    if (participants.some((participant) => String(participant?.status || '').toLowerCase() === 'confirmed')) return 'Provider confirmation recorded';
    if (['fulfilled', 'completed'].includes(String(request?.status || ''))) return 'Fulfilment state recorded';
    return 'Waiting for provider confirmation';
  };

  const requestPaymentState = (request) => {
    const status = String(request?.status || '');
    if (status === 'payment_pending') return 'Awaiting verified payment evidence';
    if (status === 'paid') return 'Payment state recorded';
    return 'Not completed';
  };

  const loadConfirmation = async () => {
    const holder = qs('[data-confirmation-live]'); if (!holder || visualFixture) return;
    try {
      const payload = await cartRequest('/api/economic-requests'); const requests = Array.isArray(payload.requests) ? payload.requests : [];
      const selectedId = new URLSearchParams(window.location.search).get('request');
      const selected = selectedId ? requests.find((request) => String(request.id) === selectedId) : requests[0];
      if (!selected) {
        const empty = document.createElement('section'); empty.className = 'workspace-panel';
        const copy = document.createElement('div'); copy.className = 'empty-workspace'; const title = document.createElement('h3'); title.textContent = 'No request selected'; const detail = document.createElement('p'); detail.textContent = selectedId ? 'That request is unavailable to this account or no longer exists.' : 'Confirmation evidence appears here when a request is created through Kurukoo.'; const chat = document.createElement('a'); chat.className = 'workspace-button secondary'; chat.href = '/chat'; chat.textContent = 'Continue in Chat'; copy.append(title, detail, chat); empty.appendChild(copy); holder.replaceChildren(empty); return;
      }
      const [detailPayload, coordinationPayload] = await Promise.all([
        cartRequest(`/api/economic-requests/${encodeURIComponent(String(selected.id))}`).catch(() => ({ request: selected })),
        cartRequest(`/api/economic-requests/${encodeURIComponent(String(selected.id))}/participants`).catch(() => ({})),
      ]);
      const request = detailPayload.request || selected; const providerState = requestProviderState(request, coordinationPayload); const paymentState = requestPaymentState(request);
      const metrics = document.createElement('div'); metrics.className = 'workspace-grid three confirmation-metrics';
      const metric = (label, value, detail) => { const card = document.createElement('article'); card.className = 'metric-card'; const heading = document.createElement('span'); heading.textContent = label; const strong = document.createElement('strong'); strong.textContent = value; const small = document.createElement('small'); small.textContent = detail; card.append(heading, strong, small); return card; };
      metrics.append(metric('Internal request state', humanize(request.status || 'requested'), 'Kurukoo records this canonical request state; it does not assert external fulfilment.'), metric('Provider state', providerState, providerState === 'Provider confirmation recorded' ? 'Only recorded coordination evidence is shown here.' : 'Availability, final quote and delivery remain pending until evidence arrives.'), metric('Payment status', paymentState, paymentState === 'Not completed' ? 'No payment is taken merely by reviewing this confirmation.' : 'Settlement remains subject to the canonical payment and provider evidence boundary.'));
      const panel = document.createElement('section'); panel.className = 'workspace-panel'; const heading = document.createElement('div'); heading.className = 'panel-heading'; const headingCopy = document.createElement('div'); const eyebrow = document.createElement('span'); eyebrow.className = 'workspace-eyebrow'; eyebrow.textContent = 'Request evidence'; const title = document.createElement('h2'); title.textContent = humanize(request.skill || request.category || 'Request'); headingCopy.append(eyebrow, title); const status = document.createElement('span'); status.className = 'status-pill'; status.textContent = humanize(request.status || 'requested'); heading.append(headingCopy, status); panel.appendChild(heading);
      const evidence = document.createElement('div'); evidence.className = 'workspace-data-list'; const card = document.createElement('article'); card.className = 'workspace-data-card'; appendDetail(card, 'Request ID', String(request.id)); appendDetail(card, 'Request state', humanize(request.status || 'requested')); appendDetail(card, 'Quote', request.quote && typeof request.quote === 'object' ? 'Quote recorded; review the verified payment boundary before settlement.' : 'Price pending confirmation'); appendDetail(card, 'Provider evidence', providerState); appendDetail(card, 'Payment', paymentState); evidence.appendChild(card);
      const timeline = document.createElement('article'); timeline.className = 'workspace-data-card confirmation-timeline'; const timelineTitle = document.createElement('h3'); timelineTitle.textContent = 'What happens next'; timeline.appendChild(timelineTitle); appendDetail(timeline, '1. Request recorded', 'Accepted internally with this request identity.'); appendDetail(timeline, '2. Provider evidence', providerState); appendDetail(timeline, '3. Payment boundary', paymentState); appendDetail(timeline, '4. Fulfilment', ['fulfilled', 'completed'].includes(String(request.status || '')) ? 'A fulfilment state is recorded.' : 'Not claimed until the canonical lifecycle records it.'); evidence.appendChild(timeline); panel.appendChild(evidence);
      const actions = document.createElement('div'); actions.className = 'workspace-actions'; const chat = document.createElement('a'); chat.className = 'workspace-button'; chat.href = chatContinuationHref(request); chat.textContent = 'Continue in Chat'; actions.appendChild(chat);
      if (['awaiting_confirmation', 'reserved'].includes(String(request.status || ''))) {
        const cancel = createWorkspaceButton('Cancel request', true); let awaitingExplicitCancellation = false;
        cancel.addEventListener('click', async () => { if (!awaitingExplicitCancellation) { awaitingExplicitCancellation = true; cancel.textContent = 'Confirm cancellation'; cancel.setAttribute('aria-describedby', 'workspace-confirmation-note'); return; } cancel.disabled = true; try { await cartRequest(`/api/economic-requests/${encodeURIComponent(String(request.id))}/transition`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }) }); await loadConfirmation(); } catch (error) { cancel.disabled = false; awaitingExplicitCancellation = false; cancel.textContent = error instanceof Error ? error.message : 'Could not cancel request'; } }); actions.appendChild(cancel);
      }
      const notice = document.createElement('div'); notice.className = 'workspace-notice'; notice.id = 'workspace-confirmation-note'; notice.textContent = 'External delivery, payment, verification and fulfilment are not claimed until corresponding canonical evidence is recorded.';
      holder.replaceChildren(metrics, panel, actions, notice);
    } catch (_) { const unavailable = document.createElement('section'); unavailable.className = 'workspace-panel'; const copy = document.createElement('div'); copy.className = 'empty-workspace'; const title = document.createElement('h3'); title.textContent = 'Confirmation evidence is unavailable'; const detail = document.createElement('p'); detail.textContent = 'Kurukoo could not load this signed-in request. No provider or payment state is asserted. Continue in Chat to retry.'; const chat = document.createElement('a'); chat.className = 'workspace-button secondary'; chat.href = '/chat'; chat.textContent = 'Continue in Chat'; copy.append(title, detail, chat); unavailable.appendChild(copy); holder.replaceChildren(unavailable); }
  };

  const loadConnectedResources = () => {
    if (document.getElementById('connected-resource-runtime')) return;
    const script = document.createElement('script'); script.id = 'connected-resource-runtime'; script.src = '/js/connected-resources.js?v=2'; script.defer = true; document.head.appendChild(script);
  };

  qs('#open-sidebar')?.addEventListener('click', () => toggleChatSidebar(true));
  qs('#close-sidebar')?.addEventListener('click', () => toggleChatSidebar(false));
  qs('#sidebar-collapse')?.addEventListener('click', () => { const collapsed = document.body.classList.toggle('chat-sidebar-collapsed'); localStorage.setItem('kurukoo_chat_sidebar_collapsed', collapsed ? '1' : '0'); });
  if (localStorage.getItem('kurukoo_chat_sidebar_collapsed') === '1') document.body.classList.add('chat-sidebar-collapsed');
  qs('#workspace-collapse')?.addEventListener('click', () => { const collapsed = workspaceSidebar?.classList.toggle('is-collapsed'); localStorage.setItem('kurukoo_workspace_collapsed', collapsed ? '1' : '0'); });
  const moreToggle = qs('#workspace-more'); const moreItems = qs('#workspace-more-items'); const moreHasActiveItem = Boolean(moreItems?.querySelector('.active, .workspace-link.active'));
  const setMoreOpen = (open) => { if (!moreToggle || !moreItems) return; moreToggle.setAttribute('aria-expanded', String(open)); moreItems.hidden = !open; moreToggle.classList.toggle('is-open', open); };
  moreToggle?.addEventListener('click', () => setMoreOpen(moreItems.hidden)); setMoreOpen(moreHasActiveItem);
  document.addEventListener('click', async (event) => {
    const link = event.target.closest('#workspace-more-items a, #workspace-more-items .workspace-link'); if (link) setMoreOpen(true);
    const promptTarget = event.target.closest('[data-prompt]'); if (promptTarget) { const prompt = promptTarget.dataset.prompt || ''; if (input && (promptTarget.closest('.workspace-nav') || promptTarget.closest('.quick-actions') || promptTarget.closest('.composer-quick-actions'))) { event.preventDefault(); seedPrompt(prompt); return; } }
    const logout = event.target.closest('#workspace-logout');
    if (logout) { event.preventDefault(); logout.disabled = true; try { const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); if (!response.ok) throw new Error('Logout failed'); localStorage.removeItem('kurukoo_auth_token'); localStorage.removeItem('kurukoo_user_phone'); localStorage.removeItem('kurukoo_user_name'); window.location.assign('/chat'); } catch (_) { logout.disabled = false; window.location.assign('/chat'); } }
    if (event.target.closest('[data-surface-view="connect"]')) setTimeout(loadConnectedResources, 60);
  });
  document.addEventListener('click', (event) => { const link = event.target.closest('#workspace-more-items a, #workspace-more-items .workspace-link'); if (link) setMoreOpen(true); });
  if (workspaceSidebar && localStorage.getItem('kurukoo_workspace_collapsed') === '1') workspaceSidebar.classList.add('is-collapsed');
  qs('#workspace-open')?.addEventListener('click', () => workspaceSidebar?.classList.add('open'));
  qs('[data-artifact-connect]')?.addEventListener('click', (event) => connectArtifactDrive(event.currentTarget));
  qs('[data-sheets-connect]')?.addEventListener('click', (event) => connectGoogleSheetsSource(event.currentTarget));
  qs('[data-sheets-revoke]')?.addEventListener('click', (event) => revokeGoogleSheetsSource(event.currentTarget));
  qs('[data-sheets-read]')?.addEventListener('click', (event) => readGoogleSheetsSource(event.currentTarget));
  qs('[data-notion-connect]')?.addEventListener('click', (event) => connectNotionSource(event.currentTarget));
  qs('[data-notion-revoke]')?.addEventListener('click', (event) => revokeNotionSource(event.currentTarget));
  qs('[data-notion-search]')?.addEventListener('click', (event) => searchNotionSource(event.currentTarget));
  qs('[data-microsoft-kind]')?.addEventListener('change', () => { renderMicrosoftPreview({ items: [] }); loadMicrosoftSource(); });
  qs('[data-microsoft-connect]')?.addEventListener('click', (event) => connectMicrosoftSource(event.currentTarget));
  qs('[data-microsoft-revoke]')?.addEventListener('click', (event) => revokeMicrosoftSource(event.currentTarget));
  qs('[data-microsoft-list]')?.addEventListener('click', (event) => listMicrosoftSource(event.currentTarget));
  workspaceSidebar?.addEventListener('click', (event) => { if (event.target.closest('a')) workspaceSidebar.classList.remove('open'); });

  qsa('[data-proactive-dismiss], [data-proactive-response]').forEach((button) => button.addEventListener('click', () => { qs('[data-proactive-card]')?.setAttribute('hidden', ''); localStorage.setItem('kurukoo_proactive_dismissed', '1'); }));
  if (localStorage.getItem('kurukoo_proactive_dismissed') === '1') qs('[data-proactive-card]')?.setAttribute('hidden', '');

  const hydrateWorkspaceSurface = (requestedSection = section) => {
    const target = String(requestedSection || '').trim();
    if (target === 'requests') void loadRequests();
    else if (target === 'tasks') void loadTasks();
    else if (target === 'reminders') void loadReminders();
    else if (target === 'points') void loadPoints();
    else if (target === 'safety') void loadSafety();
    else if (target === 'daily-picks') void loadDailyPicks();
    else if (target === 'cart') void loadCart();
    else if (target === 'confirmation') void loadConfirmation();
    else if (target === 'connect') void loadConnections();
  };
  document.addEventListener('kurukoo:workspace-surface', (event) => hydrateWorkspaceSurface(event.detail?.section));

  const params = new URLSearchParams(window.location.search); const prompt = params.get('prompt'); if (prompt && input) window.requestAnimationFrame(() => seedPrompt(prompt));
  hydrateWorkspaceSurface();

  loadConnectedResources();
})();
