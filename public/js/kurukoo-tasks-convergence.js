(() => {
  'use strict';
  if (document.body?.dataset.appSection !== 'tasks') return;

  const list = document.querySelector('[data-tasks-list]');
  const empty = document.querySelector('[data-tasks-empty]');
  const error = document.querySelector('[data-tasks-error]');
  if (!list) return;

  const metrics = {
    available: document.querySelector('[data-task-metric="available"]'),
    progress: document.querySelector('[data-task-metric="progress"]'),
    completed: document.querySelector('[data-task-metric="completed"]'),
  };

  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);

  const live = (message) => {
    let node = document.querySelector('[data-tasks-live]');
    if (!node) {
      node = document.createElement('div');
      node.className = 'k-sr-only';
      node.dataset.tasksLive = '';
      node.setAttribute('aria-live', 'polite');
      document.body.appendChild(node);
    }
    node.textContent = message;
  };

  const api = async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers: { Accept: 'application/json', ...(options.headers || {}) },
    });
    const type = response.headers.get('content-type') || '';
    const payload = type.includes('application/json') ? await response.json() : { error: await response.text() };
    if (!response.ok) {
      const error = new Error(payload?.error || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return payload;
  };

  const normalize = (payload) => (Array.isArray(payload) ? payload : Array.isArray(payload?.tasks) ? payload.tasks : []);
  const state = (task) => String(task?.status || 'available').toLowerCase();
  const isAvailable = (task) => state(task) === 'available' && !task.assignedTo;
  const isProgress = (task) => state(task) === 'in_progress' && Boolean(task.assignedTo);
  const isComplete = (task) => ['completed', 'approved'].includes(state(task));
  const isClosed = (task) => ['cancelled', 'expired', 'blocked', 'failed', 'rejected'].includes(state(task));

  const continuation = (task) => {
    const sourceType = String(task?.sourceType || '').toLowerCase();
    if (sourceType === 'topic' && task?.sourceId) return `/topics/${encodeURIComponent(String(task.sourceId))}`;
    if (sourceType === 'request' || sourceType === 'economic_request') return '/requests';
    if (sourceType === 'agent') return `/chat?prompt=${encodeURIComponent('Continue the objective connected to this task.')}`;
    if (sourceType === 'conversation') return '/chat';
    const title = task?.title || task?.name || 'this task';
    return `/chat?prompt=${encodeURIComponent(`Open the context for ${title}.`)}`;
  };

  const action = (label, kind, taskId, primary = false) => `<button type="button" class="${primary ? 'k-app-primary' : 'k-app-card-action'} k-task-action" data-task-action="${kind}" data-task-id="${escape(taskId)}">${label}</button>`;

  const card = (task) => {
    const currentState = state(task);
    const active = isProgress(task);
    const complete = isComplete(task);
    const closed = isClosed(task);
    const sourceType = String(task.sourceType || '').toLowerCase();
    const source = sourceType === 'agent' ? 'Part of an objective Kurukoo is moving forward' : sourceType === 'request' || sourceType === 'economic_request' ? 'Part of a request' : sourceType === 'conversation' ? 'Started in a conversation' : sourceType === 'topic' ? 'Started from a topic' : 'Source context is not available';
    const statusLabel = { available: 'Ready to do', in_progress: 'Moving forward', waiting: 'Waiting for an update', waiting_on_dependency: 'Waiting for earlier work', needs_user: 'Needs your input', completed: 'Done', approved: 'Done', blocked: 'Paused until something changes', failed: "Couldn't complete this yet", cancelled: 'Stopped', expired: 'No longer available', rejected: 'Unavailable' }[currentState] || 'Updating';
    const continuationHref = continuation(task);
    const resultId = `task-result-${task.id}`;
    const result = active ? `<label class="k-task-result-label" for="${resultId}">Completion note <span>optional</span></label><textarea id="${resultId}" class="k-task-result" data-task-result="${escape(task.id)}" rows="2" maxlength="4000" placeholder="Add evidence or a useful completion note"></textarea>` : '';
    const actions = [];
    if (isAvailable(task)) actions.push(action('Start task', 'accept', task.id, true));
    if (active) actions.push(action('Mark done', 'complete', task.id, true));
    if (continuationHref) {
      const isChat = continuationHref.startsWith('/chat');
      actions.push(`<a class="k-app-card-action" href="${continuationHref}">${isChat ? 'Continue in Chat →' : 'Open source context →'}</a>`);
    }
    if (closed || complete) actions.push(`<span class="k-task-state-note">${complete ? 'Completion recorded.' : 'No action available in this state.'}</span>`);
    return `<article class="k-task-card" data-task-state="${escape(currentState)}"><div class="k-task-card-head"><div><span class="k-app-card-label">${escape(sourceType === 'agent' ? 'Work in progress' : sourceType === 'request' || sourceType === 'economic_request' ? 'Request step' : 'Next action')}</span><h3>${escape(task.title || 'Task')}</h3></div><span class="k-status k-task-status" data-state="${escape(currentState)}">${escape(statusLabel)}</span></div><p>${escape(task.description || 'No additional task instructions were supplied.')}</p><div class="k-task-context"><span>${escape(source)}</span></div>${result}<div class="k-task-actions">${actions.join('') || '<span class="k-task-state-note">Waiting for the next confirmed update.</span>'}</div></article>`;
  };

  const group = (title, description, tasks, emptyLabel) => `<section class="k-task-group" aria-labelledby="${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-title"><div class="k-task-group-head"><div><span class="k-app-card-label">Task state</span><h3 id="${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-title">${title}</h3><p>${description}</p></div><span class="k-task-count">${tasks.length}</span></div><div class="k-task-group-list">${tasks.length ? tasks.map(card).join('') : `<div class="k-task-inline-empty"><strong>${emptyLabel}</strong></div>`}</div></section>`;

  const render = (tasks) => {
    const available = tasks.filter(isAvailable);
    const active = tasks.filter(isProgress);
    const completed = tasks.filter(isComplete);
    const closed = tasks.filter(isClosed);
    list.innerHTML = [
      group('Ready to do', 'Concrete next actions that are ready for you.', available, 'No available work right now.'),
      group('Moving forward', 'Actions already underway, with the work they support kept in context.', active, 'No active work right now.'),
      group('Done', 'Only actions with a recorded completion appear here.', completed, 'No completed work to show yet.'),
      closed.length ? group('Waiting or unavailable', 'Stopped, expired, blocked, failed, or rejected actions remain visible without being called complete.', closed, 'No unavailable action records.') : '',
    ].join('');
    list.setAttribute('aria-busy', 'false');
    empty.hidden = Boolean(tasks.length);
  };

  const load = async () => {
    list.setAttribute('aria-busy', 'true');
    list.innerHTML = '<div class="k-app-list-loading">Loading your task state…</div>';
    empty.hidden = true;
    error.hidden = true;
    try {
      const [tasksPayload, summaryPayload] = await Promise.all([api('/api/tasks'), api('/api/tasks/summary')]);
      const tasks = normalize(tasksPayload);
      const summary = summaryPayload?.metrics || {};
      metrics.available.textContent = String(Number(summary.available ?? tasks.filter(isAvailable).length));
      metrics.progress.textContent = String(Number(summary.inProgress ?? tasks.filter(isProgress).length));
      metrics.completed.textContent = String(Number(summary.completed ?? tasks.filter(isComplete).length));
      render(tasks);
    } catch (loadError) {
      list.setAttribute('aria-busy', 'false');
      list.replaceChildren();
      empty.hidden = true;
      error.hidden = false;
      if (loadError?.status === 401 || loadError?.status === 403) {
        error.querySelector('h3').textContent = 'Task access requires authentication';
        error.querySelector('p').textContent = 'Kurukoo could not verify access to your tasks for this session. No task status is shown until access is restored.';
      }
      live(loadError instanceof Error ? loadError.message : 'Task state is unavailable');
    }
  };

  list.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-task-action]');
    if (!button) return;
    const taskId = Number(button.dataset.taskId);
    if (!Number.isInteger(taskId) || taskId <= 0) return;
    const kind = button.dataset.taskAction;
    button.disabled = true;
    try {
      if (kind === 'accept') {
        await api('/api/tasks/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId }) });
        live('Task started and is now moving forward.');
      } else if (kind === 'complete') {
        const result = list.querySelector(`[data-task-result="${CSS.escape(String(taskId))}"]`)?.value || '';
        await api('/api/tasks/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId, result }) });
        live('Task completion was recorded.');
      }
      await load();
    } catch (actionError) {
      button.disabled = false;
      live(actionError instanceof Error ? actionError.message : 'Task action failed');
      if (actionError?.status === 409) await load();
    }
  });

  void load();
})();
