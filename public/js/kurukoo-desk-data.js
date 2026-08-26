(() => {
  'use strict';
  if (document.body?.dataset.workspaceSection !== 'desk' && document.body?.dataset.appSection !== 'desk') return;
  if (document.documentElement.dataset.kurukooDeskData === 'true') return;
  document.documentElement.dataset.kurukooDeskData = 'true';

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const humanize = (value) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Not available';
  const formatDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };

  const api = async (url) => {
    const response = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    const type = response.headers.get('content-type') || '';
    const payload = type.includes('application/json') ? await response.json().catch(() => null) : null;
    if (!response.ok) {
      const err = new Error(payload?.error || `Request failed (${response.status})`);
      err.status = response.status;
      throw err;
    }
    return payload;
  };

  const settle = (promise) => promise.then((value) => ({ ok: true, value })).catch((error) => ({ ok: false, error }));

  const actionNeededStatuses = new Set(['awaiting_confirmation', 'reserved', 'payment_pending']);
  const progressStatuses = new Set([
    'requested', 'awaiting_match', 'partially_matched', 'matched', 'quoting', 'quoted',
    'paid', 'in_fulfillment', 'fulfilled',
  ]);

  const flowRow = (label, href, detail) => {
    const a = document.createElement('a');
    a.className = 'k-desk-flow-item';
    a.href = href;
    a.innerHTML = `<span>${esc(label)}${detail ? `<small class="k-desk-item-meta">${esc(detail)}</small>` : ''}</span><strong>Open →</strong>`;
    return a;
  };

  const setModuleState = (module, state, title, copy, action) => {
    if (!module) return;
    module.querySelectorAll('.k-desk-state, .k-desk-live-list').forEach((node) => node.remove());
    const wrap = document.createElement('div');
    wrap.className = `k-desk-state k-desk-state-${state}`;
    const pill = document.createElement('span');
    pill.className = 'k-desk-state-pill';
    pill.textContent = state === 'unavailable' ? 'Unavailable' : state === 'empty' ? 'Nothing here yet' : state === 'ready' ? 'Ready' : state === 'attention' ? 'Needs attention' : state === 'progress' ? 'In progress' : state;
    const strong = document.createElement('strong');
    strong.textContent = title;
    const text = document.createElement('span');
    text.textContent = copy;
    wrap.append(pill, strong, text);
    if (action) {
      const link = document.createElement('a');
      link.href = action.href;
      link.textContent = action.label;
      wrap.appendChild(link);
    }
    module.appendChild(wrap);
  };

  const setModuleList = (module, rows, emptyTitle, emptyCopy, emptyHref) => {
    if (!module) return;
    module.querySelectorAll('.k-desk-state, .k-desk-live-list').forEach((node) => node.remove());
    if (!rows.length) {
      setModuleState(module, 'empty', emptyTitle, emptyCopy, emptyHref ? { label: 'Open →', href: emptyHref } : null);
      return;
    }
    const list = document.createElement('div');
    list.className = 'k-desk-live-list';
    rows.forEach(({ label, href, detail }) => list.appendChild(flowRow(label, href, detail)));
    module.appendChild(list);
  };

  const waitForComposition = () => new Promise((resolve) => {
    const found = document.querySelector('[data-desk-convergence="phase1"]');
    if (found) return resolve(found);
    const observer = new MutationObserver(() => {
      const node = document.querySelector('[data-desk-convergence="phase1"]');
      if (node) {
        observer.disconnect();
        resolve(node);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(document.querySelector('[data-desk-convergence="phase1"]'));
    }, 4000);
  });

  const load = async () => {
    const composition = await waitForComposition();
    if (!composition) return;

    const [requestsR, tasksR, notificationsR, remindersR, pointsR, goalsR] = await Promise.all([
      settle(api('/api/chat/economic-requests')),
      settle(api('/api/tasks')),
      settle(api('/api/notifications')),
      settle(api('/api/reminders')),
      settle(api('/api/points/balance')),
      settle(api('/api/agent/goals')),
    ]);

    const requests = requestsR.ok
      ? (Array.isArray(requestsR.value?.requests) ? requestsR.value.requests : Array.isArray(requestsR.value) ? requestsR.value : [])
      : [];
    const tasks = tasksR.ok
      ? (Array.isArray(tasksR.value) ? tasksR.value : Array.isArray(tasksR.value?.tasks) ? tasksR.value.tasks : [])
      : [];
    const notifications = notificationsR.ok
      ? (Array.isArray(notificationsR.value?.notifications) ? notificationsR.value.notifications : Array.isArray(notificationsR.value) ? notificationsR.value : [])
      : [];
    const reminders = remindersR.ok
      ? (Array.isArray(remindersR.value?.reminders) ? remindersR.value.reminders : Array.isArray(remindersR.value) ? remindersR.value : [])
      : [];
    const goals = goalsR.ok
      ? (Array.isArray(goalsR.value?.goals) ? goalsR.value.goals : Array.isArray(goalsR.value) ? goalsR.value : [])
      : [];
    const points = pointsR.ok ? Number(pointsR.value?.points ?? pointsR.value?.balance ?? 0) : null;

    const attention = [];
    const progress = [];
    const cont = [];

    notifications.filter((n) => !n.read && !n.readAt).slice(0, 6).forEach((n) => {
      const title = n.title || n.body || n.message || 'Notification';
      const link = typeof n.link === 'string' && n.link.startsWith('/') ? n.link
        : n.conversation_id ? `/chat/${encodeURIComponent(n.conversation_id)}`
        : '/notifications';
      attention.push({
        label: String(title).slice(0, 120),
        detail: [humanize(n.surface || n.object_type || 'Kurukoo'), formatDate(n.created_at || n.createdAt)].filter(Boolean).join(' · '),
        href: link,
      });
    });

    requests.forEach((req) => {
      const status = String(req.status || '').toLowerCase();
      const id = String(req.id || '');
      const skill = humanize(req.skill || req.category || 'request');
      const label = `${skill}${id ? ` · ${id.slice(0, 8)}` : ''}`;
      const detail = `Status: ${humanize(status)}${req.updated_at || req.updatedAt ? ` · ${formatDate(req.updated_at || req.updatedAt)}` : ''}`;
      if (actionNeededStatuses.has(status)) {
        attention.push({ label, detail, href: `/confirmations?request=${encodeURIComponent(id)}` });
      } else if (progressStatuses.has(status)) {
        progress.push({ label, detail, href: `/chat?prompt=${encodeURIComponent(`Continue my ${skill} request ${id}`)}` });
      } else if (['completed', 'fulfilled'].includes(status)) {
        cont.push({ label, detail, href: `/requests/${encodeURIComponent(id)}` });
      }
    });

    tasks.forEach((task) => {
      const status = String(task.status || 'available').toLowerCase();
      const label = task.title || task.name || `Task ${String(task.id || '').slice(0, 8)}`;
      const detail = humanize(status);
      if (status === 'available' && !task.assignedTo) {
        attention.push({ label, detail, href: '/tasks' });
      } else if (status === 'in_progress' && task.assignedTo) {
        progress.push({ label, detail, href: '/tasks' });
      } else if (['completed', 'approved'].includes(status)) {
        cont.push({ label, detail, href: '/tasks' });
      }
    });

    const now = Date.now();
    reminders.forEach((rem) => {
      const status = String(rem.status || 'scheduled').toLowerCase();
      if (['cancelled', 'completed', 'done'].includes(status)) return;
      const due = rem.dueAt || rem.due_at;
      const dueMs = due ? new Date(due).getTime() : NaN;
      const overdue = !Number.isNaN(dueMs) && dueMs < now;
      const label = rem.title || rem.note || 'Reminder';
      const detail = [overdue ? 'Overdue' : humanize(status), formatDate(due)].filter(Boolean).join(' · ');
      const href = `/chat?prompt=${encodeURIComponent(`Show reminder ${rem.id || label}`)}`;
      if (overdue) attention.push({ label, detail, href });
      else progress.push({ label, detail, href });
    });

    // Agent Goals: surface real, owner-scoped Agent Goals in today's flow
    goals.forEach((goal) => {
      const goalStatus = String(goal.status || '').toLowerCase();
      const id = String(goal.id || '').slice(0, 8);
      const label = `${String(goal.objective || goal.summary || 'Agent goal').slice(0, 80)}${id ? ` · ${id}` : ''}`;
      const detail = `Status: ${humanize(goalStatus)}`;
      const href = `/chat?prompt=${encodeURIComponent(`Show me my agent objective ${goal.id || ''}`)}`;
      if (['needs_user', 'blocked'].includes(goalStatus)) {
        attention.push({ label, detail, href });
      } else if (['active', 'waiting'].includes(goalStatus)) {
        progress.push({ label, detail, href });
      } else if (['completed', 'cancelled', 'failed', 'expired'].includes(goalStatus)) {
        cont.push({ label, detail, href });
      }
    });

    const today = composition.querySelector('[data-desk-module="today-flow"]');
    const todayList = today?.querySelector('.k-desk-flow-list');
    if (todayList) {
      todayList.replaceChildren();
      const hierarchy = [
        ...attention.slice(0, 4).map((row) => ({ ...row, label: `Needs attention · ${row.label}` })),
        ...progress.slice(0, 4).map((row) => ({ ...row, label: `In progress · ${row.label}` })),
        ...cont.slice(0, 2).map((row) => ({ ...row, label: `Continue · ${row.label}` })),
      ];
      if (hierarchy.length) {
        hierarchy.forEach((row) => todayList.appendChild(flowRow(row.label, row.href, row.detail)));
      } else {
        todayList.appendChild(flowRow('Ask Kurukoo', '/chat', 'Nothing needs attention right now'));
        todayList.appendChild(flowRow('Open Requests', '/requests', 'No active economic requests'));
        todayList.appendChild(flowRow('Open Tasks', '/tasks', 'No task work waiting'));
      }
    }

    const requestCard = composition.querySelector('[data-desk-module="active-requests"]');
    if (!requestsR.ok) {
      setModuleState(requestCard, 'unavailable', 'Request state unavailable', 'Canonical Economic Request authority could not be read.', { label: 'Retry Requests', href: '/requests' });
    } else {
      const actionRows = requests
        .filter((r) => actionNeededStatuses.has(String(r.status || '').toLowerCase()))
        .slice(0, 5)
        .map((r) => ({
          label: humanize(r.skill || r.category || 'request'),
          detail: humanize(r.status),
          href: `/confirmations?request=${encodeURIComponent(String(r.id || ''))}`,
        }));
      const progressRows = requests
        .filter((r) => progressStatuses.has(String(r.status || '').toLowerCase()))
        .slice(0, 5)
        .map((r) => ({
          label: humanize(r.skill || r.category || 'request'),
          detail: humanize(r.status),
          href: `/chat?prompt=${encodeURIComponent(`Continue my request ${r.id}`)}`,
        }));
      setModuleList(requestCard, [...actionRows, ...progressRows], 'No active requests', 'Start in Chat when you are ready to source, compare or continue a request.', '/chat');
    }

    const taskModule = composition.querySelector('[data-desk-module="tasks-reminders"]');
    if (!tasksR.ok && !remindersR.ok) {
      setModuleState(taskModule, 'unavailable', 'Task state unavailable', 'Task authority could not be read.', { label: 'Retry Tasks', href: '/tasks' });
    } else {
      const rows = tasks.slice(0, 6).map((task) => ({
        label: task.title || task.name || `Task ${String(task.id || '').slice(0, 8)}`,
        detail: humanize(task.status || 'available'),
        href: '/tasks',
      }));
      reminders
        .filter((r) => !['cancelled', 'completed', 'done'].includes(String(r.status || '').toLowerCase()))
        .slice(0, 4)
        .forEach((rem) => {
          rows.push({
            label: rem.title || rem.note || 'Reminder',
            detail: formatDate(rem.dueAt || rem.due_at) || humanize(rem.status),
            href: `/chat?prompt=${encodeURIComponent(`Show reminder ${rem.id || ''}`)}`,
          });
        });
      setModuleList(taskModule, rows, 'No task work waiting', 'No available or in-progress tasks for this identity.', '/tasks');
    }

    const pulse = composition.querySelector('[data-desk-module="pulse"]');
    if (!notificationsR.ok) {
      setModuleState(pulse, 'unavailable', 'Notifications unavailable', 'Notification authority could not be read.', { label: 'Open Notifications', href: '/notifications' });
    } else {
      const unread = notifications.filter((n) => !n.read && !n.readAt);
      const rows = unread.slice(0, 5).map((n) => ({
        label: String(n.title || n.body || n.message || 'Notification').slice(0, 100),
        detail: formatDate(n.created_at || n.createdAt),
        href: typeof n.link === 'string' && n.link.startsWith('/') ? n.link : '/notifications',
      }));
      setModuleList(pulse, rows, 'No live pulse', 'Current notifications remain available from their canonical source.', '/notifications');
    }

    const activity = composition.querySelector('[data-desk-module="activity-summary"]');
    if (activity) {
      const metrics = activity.querySelector('.k-desk-activity-metrics');
      if (metrics) {
        const openRequests = requests.filter((r) => !['completed', 'cancelled', 'failed', 'abandoned'].includes(String(r.status || '').toLowerCase())).length;
        const openTasks = tasks.filter((t) => !['completed', 'approved', 'cancelled', 'expired'].includes(String(t.status || '').toLowerCase())).length;
        const activeReminders = reminders.filter((r) => !['cancelled', 'completed', 'done'].includes(String(r.status || '').toLowerCase())).length;
        const activeGoals = goals.filter((g) => !['completed', 'cancelled', 'failed', 'expired'].includes(String(g.status || '').toLowerCase())).length;
        const cells = metrics.querySelectorAll('div');
        if (cells[0]) cells[0].innerHTML = `<span>Tasks</span><strong>${openTasks}</strong>`;
        if (cells[1]) cells[1].innerHTML = `<span>Requests</span><strong>${openRequests}</strong>`;
        if (cells[2]) cells[2].innerHTML = `<span>Agent goals</span><strong>${activeGoals}</strong>`;
      }
    }

    if (points !== null) {
      document.querySelectorAll('[data-desk-points-value]').forEach((node) => {
        node.textContent = `${points.toLocaleString()} points`;
      });
    }

    composition.dataset.deskHydrated = 'true';
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
  else setTimeout(load, 0);
})();
