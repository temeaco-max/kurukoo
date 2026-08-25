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
  const api = async (url) => { const response = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } }); const type = response.headers.get('content-type') || ''; const payload = type.includes('application/json') ? await response.json().catch(() => null) : null; if (!response.ok) { const err = new Error(payload?.error || `Request failed (${response.status})`); err.status = response.status; throw err; } return payload; };
  const goalPresenceLabel = (status) => ({ active: 'Working', waiting: 'Waiting', needs_user: 'Needs your input', blocked: 'Blocked', completed: 'Completed', cancelled: 'Cancelled', failed: 'Failed', expired: 'Expired' }[String(status || '')] || humanize(status));
  const activityLabel = (event) => {
    const kind = String(event?.kind || '');
    const status = String(event?.status || '');
    if (kind === 'goal_started') return 'Kurukoo started working on this objective.';
    if (kind === 'tool_call' && status === 'started') return 'Kurukoo is carrying out the next step.';
    if (kind === 'tool_call' && status === 'completed') return 'Kurukoo completed a step and checked the result.';
    if (kind === 'authorization') return status === 'satisfied' ? 'Permission checks passed.' : 'Permission is required before continuing.';
    if (kind === 'evidence') return 'Kurukoo recorded supporting evidence.';
    if (kind === 'outcome') return status === 'completed' ? 'Kurukoo verified the outcome.' : `Kurukoo updated the objective: ${humanize(status)}.`;
    if (kind === 'execution_stopped') return 'Kurukoo paused safely at its execution limit.';
    if (kind === 'continuation') return 'Kurukoo scheduled the next step.';
    return 'Kurukoo updated this objective.';
  };

  const render = (goals, continuations = new Map(), traces = new Map()) => {
    if (empty) empty.hidden = Boolean(goals.length);
    if (!goals.length) { list.innerHTML = ''; return; }
    list.setAttribute('aria-busy', 'false');
    list.innerHTML = goals.slice(0, 25).map((goal) => {
      const status = String(goal.status || '').toLowerCase();
      const id = esc(String(goal.id || '').slice(0, 8));
      const objective = esc(String(goal.objective || goal.summary || 'Agent goal'));
      const presence = esc(goalPresenceLabel(goal.status));
      const updated = esc(formatDate(goal.updatedAt || goal.updated_at));
      const continuation = continuations.get(String(goal.id || ''));
      const next = esc(continuation?.nextAction || 'Continue the objective');
      const ready = continuation ? Boolean(continuation.ready) : true;
      const activity = (traces.get(String(goal.id || '')) || []).slice(-3).reverse();
      const href = `/chat?prompt=${encodeURIComponent(`Continue my agent objective ${goal.id || ''}`)}`;
      return `<article class="k-agent-goal-row">
        <div class="k-agent-goal-head">
          <strong class="k-agent-goal-objective">${objective}${id ? ` <small>· ${id}</small>` : ''}</strong>
          <span class="k-agent-goal-status" data-agent-goal-status="${esc(status)}">${presence}</span>
        </div>
        ${updated ? `<small class="k-agent-goal-updated">Updated ${updated}</small>` : ''}
        ${activity.length ? `<div class="k-agent-goal-activity" aria-label="Recent activity">${activity.map((event) => `<small>${esc(activityLabel(event))}${event.createdAt ? ` · ${esc(formatDate(event.createdAt))}` : ''}</small>`).join('')}</div>` : ''}
        <small class="k-agent-goal-next" data-agent-goal-ready="${ready ? 'true' : 'false'}">${next}</small>
        <a class="k-agent-goal-link" href="${href}">${ready ? 'Continue in Chat' : 'Review blocker'} →</a>
      </article>`;
    }).join('');
  };

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
      if (empty) { empty.hidden = false; const title = empty.querySelector('h3'); if (title) title.textContent = 'Agent goals are unavailable'; }
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
