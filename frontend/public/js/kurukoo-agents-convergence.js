(() => {
  'use strict';
  if (document.body?.dataset.appSection !== 'agents') return;
  if (document.documentElement.dataset.kurukooAgentsConvergence === 'true') return;
  document.documentElement.dataset.kurukooAgentsConvergence = 'true';

  const list = document.querySelector('[data-agents-list]');
  const empty = document.querySelector('[data-agents-empty]');
  if (!list) return;

  const esc = (value) => String(value ?? '').replace(/[&<>\"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const humanize = (value) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Unknown';
  const formatDate = (value) => { if (!value) return ''; const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); };
  const live = (message) => { let region = document.querySelector('[data-agents-live]'); if (!region) { region = document.createElement('div'); region.className = 'k-sr-only'; region.dataset.agentsLive = ''; region.setAttribute('aria-live', 'polite'); document.body.appendChild(region); } region.textContent = String(message || ''); };
  const api = async (url, options = {}) => { const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { Accept: 'application/json', ...(options.headers || {}) } }); const type = response.headers.get('content-type') || ''; const payload = type.includes('application/json') ? await response.json().catch(() => null) : null; if (!response.ok) { const err = new Error(payload?.error || `Request failed (${response.status})`); err.status = response.status; throw err; } return payload; };
  const goalPresenceLabel = (status) => ({ active: 'Working on it', running: 'Working on it', working: 'Working on it', waiting: 'Waiting for an update', waiting_on_dependency: 'Waiting for earlier work', needs_user: 'Your decision is needed', paused: 'Paused by you', blocked: 'Needs review', completed: 'Done', cancelled: 'Cancelled', failed: 'Needs recovery', expired: 'Expired', unavailable: 'Unavailable' }[String(status || '').toLowerCase()] || 'Updating');
  const activityLabel = (event) => {
    const kind = String(event?.kind || '');
    const status = String(event?.status || '');
    if (kind === 'goal_started') return 'Kurukoo started working on this objective.';
    if (kind === 'tool_call' && status === 'started') return 'Kurukoo is carrying out the next step.';
    if (kind === 'tool_call' && status === 'completed') return 'Kurukoo completed a step and checked the result.';
    if (kind === 'authorization') return status === 'satisfied' ? 'Permission checks passed.' : 'Permission is required before continuing.';
    if (kind === 'evidence') return 'Kurukoo recorded supporting evidence.';
    if (kind === 'outcome') return status === 'completed' ? 'Kurukoo verified the outcome.' : `Kurukoo updated the objective: ${humanize(status)}.`;
    if (kind === 'execution_stopped') return 'Kurukoo paused safely before the next step.';
    if (kind === 'continuation') return 'Kurukoo scheduled the next step.';
    return 'Kurukoo updated this objective.';
  };

  const safeNextAction = (nextAction) => {
    const value = String(nextAction || '').trim().slice(0, 160);
    if (!value || /(?:goal:|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|token|secret|prompt|argument|payload|canonical|capability|runtime|executor|worker|trace)/i.test(value)) return 'Kurukoo will continue this objective when it is ready.';
    return value;
  };

  const render = (goals, continuations = new Map(), traces = new Map()) => {
    if (empty) empty.hidden = Boolean(goals.length);
    if (!goals.length) { list.innerHTML = ''; return; }
    list.setAttribute('aria-busy', 'false');
    list.innerHTML = goals.slice(0, 25).map((goal) => {
      const status = String(goal.status || '').toLowerCase();
      const objective = esc(String(goal.objective || goal.summary || 'Objective'));
      const presence = esc(goalPresenceLabel(goal.status));
      const updated = esc(formatDate(goal.updatedAt || goal.updated_at));
      const continuation = continuations.get(String(goal.id || ''));
      const next = esc(status === 'paused' ? 'Work is paused. Resume when you want Kurukoo to continue.' : status === 'needs_user' ? 'Review the decision Kurukoo needs before work can continue.' : status === 'blocked' ? 'Review the recorded update before work can continue.' : safeNextAction(continuation?.nextAction));
      const ready = continuation ? Boolean(continuation.ready) : true;
      const activity = (traces.get(String(goal.id || '')) || []).slice(-3).reverse();
      const conversationId = String(goal.conversationId || goal.conversation_id || continuation?.conversationId || '').trim();
      const href = conversationId ? `/chat?conversationId=${encodeURIComponent(conversationId)}` : `/chat?prompt=${encodeURIComponent('Continue this objective.')}`;
      const canPause = ['active', 'running', 'working', 'waiting', 'waiting_on_dependency', 'needs_user', 'blocked', 'paused'].includes(status);
      const canCancel = !['cancelled', 'completed', 'failed', 'expired'].includes(status);
      return `<article class="k-agent-goal-row">
        <div class="k-agent-goal-head">
          <strong class="k-agent-goal-objective">${objective}</strong>
          <span class="k-agent-goal-status" data-agent-goal-status="${esc(status)}">${presence}</span>
        </div>
        ${updated ? `<small class="k-agent-goal-updated">Updated ${updated}</small>` : ''}
        ${activity.length ? `<div class="k-agent-goal-activity" aria-label="Recent activity">${activity.map((event) => `<small>${esc(activityLabel(event))}${event.createdAt ? ` · ${esc(formatDate(event.createdAt))}` : ''}</small>`).join('')}</div>` : ''}
        <small class="k-agent-goal-next" data-agent-goal-ready="${ready ? 'true' : 'false'}">${next}</small>
        <div class="k-agent-goal-actions">
          <a class="k-agent-goal-link" href="${href}">${ready ? 'Continue in Chat' : 'Review in Chat'} →</a>
          ${canPause ? `<button type="button" class="k-agent-goal-link" data-agent-goal-action="${status === 'paused' ? 'resume' : 'pause'}" data-agent-goal-id="${esc(goal.id)}">${status === 'paused' ? 'Resume work' : 'Pause work'}</button>` : ''}
          ${canCancel ? `<button type="button" class="k-agent-goal-link" data-agent-goal-action="cancel" data-agent-goal-id="${esc(goal.id)}">Cancel work</button>` : ''}
        </div>
      </article>`;
    }).join('');
  };

  list.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-agent-goal-action][data-agent-goal-id]');
    if (!button) return;
    const goalId = String(button.dataset.agentGoalId || '').trim();
    const action = String(button.dataset.agentGoalAction || '').trim();
    if (!goalId || !['pause', 'resume', 'cancel'].includes(action)) return;
    if (action === 'cancel' && !window.confirm('Cancel this work item? This stops further automatic progress.')) return;
    button.disabled = true;
    try {
      await api(`/api/agent/goals/${encodeURIComponent(goalId)}/${action}`, { method: 'POST' });
      live(action === 'pause' ? 'Work paused.' : action === 'resume' ? 'Work resumed.' : 'Work cancelled.');
      await load();
    } catch (error) {
      button.disabled = false;
      live(error?.message || 'Unable to update this work item.');
    }
  });

  const load = async () => {
    try {
      const data = await api('/api/agent/goals');
      const goals = Array.isArray(data.goals) ? data.goals : Array.isArray(data) ? data : [];
      const continuations = new Map();
      const traces = new Map();
      await Promise.all(goals.slice(0, 25).map(async (goal) => {
        const goalId = String(goal.id || '');
        try { const result = await api(`/api/agent/goals/${encodeURIComponent(goalId)}/continuation`); if (result?.continuation) continuations.set(goalId, result.continuation); } catch { /* truthful fallback */ }
        try { const result = await api(`/api/agent/goals/${encodeURIComponent(goalId)}/trace?limit=3`); if (Array.isArray(result?.trace)) traces.set(goalId, result.trace); } catch { /* truthful fallback */ }
      }));
      render(goals, continuations, traces);
    } catch {
      if (empty) { empty.hidden = false; const title = empty.querySelector('h3'); if (title) title.textContent = 'Objectives are unavailable'; }
      list.setAttribute('aria-busy', 'false');
      list.innerHTML = '';
    }
  };

  void load();
  let refreshTimer = null;
  const stopRefresh = () => { if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; } };
  const startRefresh = () => { stopRefresh(); refreshTimer = setInterval(() => { void load(); }, 30000); };
  startRefresh();
  window.addEventListener('beforeunload', stopRefresh);
})();
