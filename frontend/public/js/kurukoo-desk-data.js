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
  const exactChatHref = ({ prompt, objectType, objectId, canonicalAction, conversationId }) => {
    const params = new URLSearchParams({ prompt: String(prompt || 'Open this update.') });
    if (conversationId) params.set('conversationId', String(conversationId).slice(0, 160));
    if (objectType && objectId && canonicalAction) {
      params.set('contextId', `${objectType}:${objectId}`.slice(0, 180));
      params.set('action', 'review');
      params.set('canonicalAction', String(canonicalAction).slice(0, 120));
      params.set('objectType', String(objectType).slice(0, 80));
      params.set('objectId', String(objectId).slice(0, 180));
    }
    return `/chat?${params.toString()}`;
  };
  const exactRequestHref = (request) => {
    const id = String(request?.id || '').trim();
    return id ? exactChatHref({ prompt: 'Open this request.', objectType: 'economic_request', objectId: id, canonicalAction: 'economic_request.open', conversationId: request?.conversationId || request?.conversation_id }) : '/chat?prompt=Continue%20this%20request.';
  };
  const exactTaskHref = (task) => {
    const id = String(task?.id || '').trim();
    return id ? exactChatHref({ prompt: 'Open this task.', objectType: 'task', objectId: id, canonicalAction: 'task.open', conversationId: task?.conversationId || task?.conversation_id }) : '/tasks';
  };
  const exactReminderHref = (reminder) => {
    const id = String(reminder?.id || '').trim();
    return id ? exactChatHref({ prompt: 'Open this reminder.', objectType: 'reminder', objectId: id, canonicalAction: 'reminder.open', conversationId: reminder?.conversationId || reminder?.conversation_id }) : '/reminders';
  };

  const actionNeededStatuses = new Set(['awaiting_confirmation', 'reserved', 'payment_pending', 'failed', 'disputed']);
  const progressStatuses = new Set([
    'requested', 'awaiting_match', 'partially_matched', 'matched', 'quoting', 'quoted',
    'paid', 'in_fulfillment', 'fulfilled',
  ]);

  const flowRow = (label, href, detail, state = '') => {
    const a = document.createElement('a');
    a.className = 'k-desk-flow-item';
    a.href = href;
    if (state) a.dataset.state = state;
    a.innerHTML = `<span>${esc(label)}${detail ? `<small class="k-desk-item-meta">${esc(detail)}</small>` : ''}</span><strong>Open →</strong>`;
    return a;
  };

  const setModuleState = (module, state, title, copy, action) => {
    if (!module) return;
    module.querySelectorAll('.k-desk-state, .k-desk-live-list').forEach((node) => node.remove());
    const wrap = document.createElement('div');
    wrap.className = `k-desk-state k-desk-state-${state}`;
    wrap.dataset.state = state;
    const pill = document.createElement('span');
    pill.className = 'k-desk-state-pill';
    pill.dataset.state = state;
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
    rows.forEach(({ label, href, detail, status }) => list.appendChild(flowRow(label, href, detail, status)));
    module.appendChild(list);
  };

  const goalPresenceLabel = (status) => ({
    active: 'Working on it',
    running: 'Working on it',
    waiting: 'Waiting for an update',
    waiting_on_dependency: 'Waiting for earlier work',
    needs_user: 'Your decision is needed',
    paused: 'Paused by you',
    blocked: 'Needs review',
    completed: 'Done',
    cancelled: 'Cancelled',
    failed: 'Needs recovery',
    expired: 'Expired',
  }[String(status || '').toLowerCase()] || humanize(status));
  const requestStatusLabel = (status) => ({
    requested: 'Preparing your request',
    awaiting_match: 'Waiting for a match',
    partially_matched: 'Reviewing available help',
    matched: 'A match is ready to review',
    quoting: 'Reviewing options',
    quoted: 'Your choice is needed',
    awaiting_confirmation: 'Your decision is needed',
    reserved: 'Your decision is needed',
    payment_pending: 'Payment needs your review',
    paid: 'Payment evidence recorded',
    in_fulfillment: 'Being carried out',
    fulfilled: 'Result recorded',
    completed: 'Completed',
    failed: 'Your review is needed',
    disputed: 'Your review is needed',
    cancelled: 'Cancelled',
  }[String(status || '').toLowerCase()] || humanize(status));
  const requestTitle = (request) => {
    const source = request?.requirements || request?.requirements_json || {};
    let requirements = source;
    if (typeof source === 'string') { try { requirements = JSON.parse(source); } catch { requirements = {}; } }
    const service = String(requirements?.service || '').toLowerCase();
    if (String(request?.skill || '').toLowerCase() === 'find_worker') {
      if (['teacher', 'guitar_teacher'].includes(service)) return 'Finding a tutor';
      if (service === 'mechanic') return 'Finding a mechanic';
      return 'Finding someone to help';
    }
    return ({
      ride_request: 'Getting you there', order_food: 'Food request', product_sourcing: 'Finding the right item',
      phone_repairer: 'Phone repair', repair: 'Repair request', wifi_installer: 'Sorting out your connection',
      hotel_deals: 'Finding a place to stay', rental_tracker: 'Finding a home to rent', job_tracker: 'Finding work',
    }[String(request?.skill || '').toLowerCase()] || humanize(request?.category || request?.skill || 'Request'));
  };
  const taskTitle = (task) => String(task?.title || task?.name || 'Task waiting for attention').trim() || 'Task waiting for attention';
  const notificationHref = (notification) => {
    const direct = String(notification?.link || '').trim();
    if (direct.startsWith('/')) return direct;
    const conversationId = String(notification?.conversationId || notification?.conversation_id || '').trim();
    const type = String(notification?.objectType || notification?.object_type || '').toLowerCase();
    const id = String(notification?.objectId || notification?.object_id || '').trim();
    const mapped = {
      request: ['economic_request', 'economic_request.open'],
      economic_request: ['economic_request', 'economic_request.open'],
      task: ['task', 'task.open'],
      reminder: ['reminder', 'reminder.open'],
      agent: ['agent_goal', 'agent.goal.review'],
      agent_goal: ['agent_goal', 'agent.goal.review'],
    }[type];
    if (mapped && id) return exactChatHref({ prompt: 'Open this update.', objectType: mapped[0], objectId: id, canonicalAction: mapped[1], conversationId });
    return conversationId ? exactChatHref({ prompt: 'Open this update.', conversationId }) : '/notifications';
  };

  const goalActivityLabel = (event) => {
    const kind = String(event?.kind || '');
    const status = String(event?.status || '');
    if (kind === 'goal_started') return 'Kurukoo started working on this objective';
    if (kind === 'tool_call' && status === 'started') return 'Kurukoo is carrying out the next step';
    if (kind === 'tool_call' && status === 'completed') return 'Kurukoo completed a step and checked the result';
    if (kind === 'authorization') return status === 'satisfied' ? 'Permission checks passed' : 'Permission is required before continuing';
    if (kind === 'evidence') return 'Supporting evidence was recorded';
    if (kind === 'outcome') return status === 'completed' ? 'Kurukoo verified the recorded outcome' : `Kurukoo updated this objective: ${humanize(status)}`;
    if (kind === 'quality_evaluated') return status === 'pass' ? 'Kurukoo checked the recorded outcome' : 'Kurukoo paused safely while it checks the outcome';
    if (kind === 'execution_stopped') return 'Kurukoo paused safely at its execution limit';
    if (kind === 'continuation') return 'Kurukoo scheduled the next step';
    return 'Kurukoo updated this objective';
  };

  const safeBlockedByLabel = (blockedBy) => {
    const safe = blockedBy
      .map((value) => String(value || '').trim())
      .filter((value) => value && value.length <= 140)
      .filter((value) => !/(?:^goal:|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|token|secret|prompt|argument|payload)/i.test(value));
    return safe.length ? `Waiting on: ${safe.slice(0, 2).join(', ')}` : blockedBy.length ? 'Waiting on a prerequisite objective' : '';
  };

  const safeNextActionLabel = (nextAction) => {
    const value = String(nextAction || '').trim().slice(0, 160);
    if (!value) return '';
    if (/(?:goal:|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|token|secret|prompt|argument|payload|canonical|capability|runtime|executor|worker|trace)/i.test(value)) return 'Kurukoo will continue this objective when it is ready.';
    return value;
  };

  const goalRow = (goal, continuation, trace, order = 0) => {
    const goalStatus = String(goal?.status || '').toLowerCase();
    const objective = String(goal?.objective || goal?.summary || 'Agent objective').slice(0, 100);
    const latest = Array.isArray(trace) && trace.length ? trace[trace.length - 1] : null;
    const blockers = Array.isArray(continuation?.blockedBy) ? continuation.blockedBy.filter(Boolean).slice(0, 2) : [];
    const detail = [
      goalPresenceLabel(goalStatus),
      safeBlockedByLabel(blockers) || (safeNextActionLabel(continuation?.nextAction) ? `Next: ${safeNextActionLabel(continuation?.nextAction)}` : ''),
      latest ? `Latest: ${goalActivityLabel(latest)}` : '',
      latest?.createdAt ? formatDate(latest.createdAt) : formatDate(goal?.updatedAt || goal?.updated_at),
    ].filter(Boolean).join(' · ');
    return {
      status: goalStatus,
      order,
      label: objective,
      detail,
      href: exactChatHref({ prompt: 'Open this objective.', objectType: 'agent_goal', objectId: String(goal?.id || ''), canonicalAction: 'agent.goal.review', conversationId: goal?.conversationId || goal?.conversation_id || continuation?.conversationId }),
    };
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
    const goalContinuations = new Map();
    const goalTraces = new Map();
    const visibleGoalStatuses = new Set(['active', 'waiting', 'waiting_on_dependency', 'needs_user', 'paused', 'blocked']);
    const goalStatusPriority = { needs_user: 0, paused: 1, blocked: 2, waiting_on_dependency: 3, active: 4, waiting: 5 };
    const goalDetails = goals
      .map((goal, order) => ({ goal, order, status: String(goal?.status || '').toLowerCase() }))
      .filter(({ status }) => visibleGoalStatuses.has(status))
      .sort((a, b) => (goalStatusPriority[a.status] ?? 99) - (goalStatusPriority[b.status] ?? 99) || a.order - b.order)
      .slice(0, 4);
    if (goalsR.ok) {
      for (const { goal } of goalDetails) {
        const goalId = String(goal?.id || '');
        if (!goalId) continue;
        const continuationR = await settle(api(`/api/agent/goals/${encodeURIComponent(goalId)}/continuation`));
        const traceR = await settle(api(`/api/agent/goals/${encodeURIComponent(goalId)}/trace?limit=3`));
        if (continuationR.ok && continuationR.value?.continuation) goalContinuations.set(goalId, continuationR.value.continuation);
        if (traceR.ok && Array.isArray(traceR.value?.trace)) goalTraces.set(goalId, traceR.value.trace);
      }
    }
    const goalRows = goals.map((goal, order) => goalRow(goal, goalContinuations.get(String(goal?.id || '')), goalTraces.get(String(goal?.id || '')), order));

    const attention = [];
    const progress = [];
    const cont = [];

    notifications.filter((n) => !n.read && !n.readAt).slice(0, 6).forEach((n) => {
      const title = n.title || n.body || n.message || 'Notification';
      const link = notificationHref(n);
      attention.push({
        label: String(title).slice(0, 120),
        detail: [humanize(n.surface || n.object_type || 'Kurukoo'), formatDate(n.created_at || n.createdAt)].filter(Boolean).join(' · '),
        href: link,
      });
    });

    requests.forEach((req) => {
      const status = String(req.status || '').toLowerCase();
      const id = String(req.id || '');
      const label = requestTitle(req);
      const detail = [requestStatusLabel(status), req.updated_at || req.updatedAt ? formatDate(req.updated_at || req.updatedAt) : ''].filter(Boolean).join(' · ');
      if (actionNeededStatuses.has(status)) {
        attention.push({ label, detail, href: `/confirmations?request=${encodeURIComponent(id)}` });
      } else if (progressStatuses.has(status)) {
        progress.push({ label, detail, href: exactRequestHref(req) });
      } else if (['completed', 'fulfilled'].includes(status)) {
        cont.push({ label, detail, href: id ? `/requests/${encodeURIComponent(id)}` : '/requests' });
      }
    });

    tasks.forEach((task) => {
      const status = String(task.status || 'available').toLowerCase();
      const label = taskTitle(task);
      const detail = ({ available: 'Ready to take on', in_progress: 'In progress', waiting: 'Waiting for an update', waiting_on_dependency: 'Waiting for earlier work', needs_user: 'Your input is needed', completed: 'Completed', approved: 'Completed', blocked: 'Needs review', failed: 'Needs recovery', cancelled: 'Cancelled', expired: 'Expired' }[status] || humanize(status));
      const href = exactTaskHref(task);
      if (status === 'available' && !task.assignedTo) {
        attention.push({ label, detail, href });
      } else if (status === 'in_progress' && task.assignedTo) {
        progress.push({ label, detail, href });
      } else if (['completed', 'approved'].includes(status)) {
        cont.push({ label, detail, href });
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
      const href = exactReminderHref(rem);
      if (overdue) attention.push({ label, detail, href });
      else progress.push({ label, detail, href });
    });

    // Agent Goals: consume the existing owner-scoped continuation and trace projections.
    goalRows.forEach((row) => {
      if (['needs_user', 'blocked'].includes(row.status)) attention.push(row);
      else if (['active', 'waiting', 'waiting_on_dependency'].includes(row.status)) progress.push(row);
      else if (['paused', 'completed', 'cancelled', 'failed', 'expired'].includes(row.status)) cont.push(row);
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
        hierarchy.forEach((row) => todayList.appendChild(flowRow(row.label, row.href, row.detail, row.status)));
      } else {
        todayList.appendChild(flowRow('Ask Kurukoo', '/chat', 'Nothing needs attention right now'));
        todayList.appendChild(flowRow('Open Activity', '/activity', 'No active requests'));
        todayList.appendChild(flowRow('Open Work', '/tasks', 'No task work waiting'));
      }
    }

    const agentObjectives = composition.querySelector('[data-desk-module="agent-objectives"]');
    if (!goalsR.ok) {
      setModuleState(agentObjectives, 'unavailable', 'Agent objective state unavailable', 'Kurukoo could not read your canonical objective activity.', { label: 'Open Agents', href: '/agents' });
    } else {
      const visibleGoalRows = goalRows
        .filter((row) => visibleGoalStatuses.has(row.status))
        .sort((a, b) => (goalStatusPriority[a.status] ?? 99) - (goalStatusPriority[b.status] ?? 99) || a.order - b.order);
      setModuleList(agentObjectives, visibleGoalRows.slice(0, 6), 'No active Agent objectives', 'No Agent objective is currently active, waiting, paused, blocked or awaiting your input.', '/agents');
    }

    const requestCard = composition.querySelector('[data-desk-module="active-requests"]');
    if (!requestsR.ok) {
      setModuleState(requestCard, 'unavailable', 'Request state unavailable', 'Canonical Economic Request authority could not be read.', { label: 'Retry Requests', href: '/requests' });
    } else {
      const actionRows = requests
        .filter((r) => actionNeededStatuses.has(String(r.status || '').toLowerCase()))
        .slice(0, 5)
        .map((r) => ({
          label: requestTitle(r),
          detail: requestStatusLabel(r.status),
          href: `/confirmations?request=${encodeURIComponent(String(r.id || ''))}`,
        }));
      const progressRows = requests
        .filter((r) => progressStatuses.has(String(r.status || '').toLowerCase()))
        .slice(0, 5)
        .map((r) => ({
          label: requestTitle(r),
          detail: requestStatusLabel(r.status),
          href: exactRequestHref(r),
        }));
      setModuleList(requestCard, [...actionRows, ...progressRows], 'No active requests', 'Start in Chat when you are ready to source, compare or continue a request.', '/chat');
    }

    const taskModule = composition.querySelector('[data-desk-module="tasks-reminders"]');
    if (!tasksR.ok && !remindersR.ok) {
      setModuleState(taskModule, 'unavailable', 'Task state unavailable', 'Task authority could not be read.', { label: 'Retry Tasks', href: '/tasks' });
    } else {
      const rows = tasks.slice(0, 6).map((task) => ({
        label: taskTitle(task),
        detail: ({ available: 'Ready to take on', in_progress: 'In progress', waiting: 'Waiting for an update', waiting_on_dependency: 'Waiting for earlier work', needs_user: 'Your input is needed', completed: 'Completed', approved: 'Completed', blocked: 'Needs review', failed: 'Needs recovery', cancelled: 'Cancelled', expired: 'Expired' }[String(task.status || 'available').toLowerCase()] || humanize(task.status || 'available')),
        href: exactTaskHref(task),
      }));
      reminders
        .filter((r) => !['cancelled', 'completed', 'done'].includes(String(r.status || '').toLowerCase()))
        .slice(0, 4)
        .forEach((rem) => {
          rows.push({
            label: rem.title || rem.note || 'Reminder',
            detail: formatDate(rem.dueAt || rem.due_at) || humanize(rem.status),
            href: exactReminderHref(rem),
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
        href: notificationHref(n),
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
