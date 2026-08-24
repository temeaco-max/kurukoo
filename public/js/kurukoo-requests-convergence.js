(() => {
  const body = document.body;
  if (!body || body.dataset.appSection !== 'requests') return;

  const list = document.querySelector('[data-requests-list]');
  if (!list) return;

  const humanize = (value) => String(value || 'Not yet available')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const formatDate = (value) => {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not recorded';
    return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };

  const paymentState = (request) => {
    const status = String(request?.status || '');
    if (status === 'payment_pending') return 'Awaiting verified payment evidence';
    if (status === 'paid') return 'Payment state recorded';
    return 'Not completed';
  };

  const nextAction = (request) => {
    const id = String(request?.id || '').trim();
    const skill = humanize(request?.skill || request?.category || 'request');
    const exactPrompt = `Continue my ${skill} request ${id}`;
    if (['awaiting_confirmation', 'reserved', 'payment_pending'].includes(String(request?.status || ''))) {
      return { label: 'Review request', href: `/confirmation?request=${encodeURIComponent(id)}` };
    }
    if (String(request?.status || '') === 'completed') {
      return { label: 'View confirmation', href: `/confirmation?request=${encodeURIComponent(id)}` };
    }
    return { label: 'Continue in Chat', href: `/chat?prompt=${encodeURIComponent(exactPrompt)}` };
  };

  const parseRequirements = (request) => {
    const source = request?.requirements || request?.requirements_json || {};
    if (!source) return {};
    if (typeof source === 'object') return source;
    try { return JSON.parse(String(source)); } catch { return {}; }
  };

  const requestSummary = (request) => {
    const requirements = parseRequirements(request);
    const details = [requirements.origin, requirements.destination, requirements.location, requirements.items, requirements.service, requirements.event]
      .filter(Boolean).map(String);
    return details.length ? details.slice(0, 2).join(' · ') : 'Details remain in the linked conversation.';
  };

  const participantState = (coordination) => {
    const participants = Array.isArray(coordination?.participants) ? coordination.participants : [];
    if (participants.some((item) => String(item?.status || '').toLowerCase() === 'confirmed')) return 'Provider confirmation recorded';
    if (participants.length) return 'Provider context recorded';
    return 'No provider confirmation recorded';
  };

  const appendMetaRow = (meta, label, value) => {
    const row = document.createElement('div');
    row.className = 'requests-convergence-meta-row';
    const key = document.createElement('span'); key.textContent = label;
    const detail = document.createElement('strong'); detail.textContent = value;
    row.append(key, detail); meta.appendChild(row);
  };

  const appendGoalContinuation = async (meta, linkedGoal) => {
    try {
      const response = await fetch(`/api/agent/goals/${encodeURIComponent(String(linkedGoal.id))}/continuation`, { credentials: 'same-origin' });
      if (!response.ok) return;
      const payload = await response.json();
      const continuation = payload?.continuation;
      if (!continuation) return;
      appendMetaRow(meta, continuation.ready ? 'Agent next' : 'Agent waiting', String(continuation.nextAction || 'Continue objective'));
      const row = document.createElement('div');
      row.className = 'requests-convergence-goal-row';
      const action = document.createElement('a');
      action.href = `/chat?prompt=${encodeURIComponent(`Continue my agent objective ${linkedGoal.id}`)}`;
      action.textContent = continuation.ready ? 'Continue goal' : 'Review blocker';
      action.setAttribute('aria-label', continuation.ready ? 'Continue Agent Goal' : 'Review Agent Goal blocker');
      row.appendChild(action); meta.appendChild(row);
    } catch {
      // Continuation is enrichment only; request truth remains canonical.
    }
  };

  const enrichCard = async (card, request, coordinationPromise) => {
    const requestId = String(request?.id || '').trim();
    if (!requestId || card.dataset.requestsConverged === '1') return;
    card.dataset.requestsConverged = '1'; card.dataset.requestId = requestId;

    const action = card.querySelector('.workspace-text-action');
    const canonicalAction = nextAction(request);
    if (action) {
      action.href = canonicalAction.href;
      action.textContent = canonicalAction.label;
      action.setAttribute('aria-label', `${canonicalAction.label}: ${humanize(request.skill || request.category || 'request')}`);
      action.classList.add('requests-convergence-primary-action');
    }

    const meta = document.createElement('div');
    meta.className = 'requests-convergence-meta';
    meta.setAttribute('aria-label', 'Request context');
    appendMetaRow(meta, 'Request ID', requestId);
    appendMetaRow(meta, 'Created', formatDate(request.created_at || request.createdAt));
    if (request.updated_at || request.updatedAt) appendMetaRow(meta, 'Updated', formatDate(request.updated_at || request.updatedAt));
    appendMetaRow(meta, 'Payment', paymentState(request));
    if (request.quote && typeof request.quote === 'object') appendMetaRow(meta, 'Quote', 'Quote recorded');

    const coordination = await coordinationPromise;
    if (coordination) appendMetaRow(meta, 'Provider', participantState(coordination));

    if (request.id) {
      try {
        const goalResponse = await fetch('/api/agent/goals?includeClosed=true', { credentials: 'same-origin' });
        if (goalResponse.ok) {
          const goalData = await goalResponse.json();
          const goals = Array.isArray(goalData.goals) ? goalData.goals : [];
          const linkedGoal = goals.find(g => String(g.economicRequestId || '') === String(request.id));
          if (linkedGoal) {
            const goalStatus = String(linkedGoal.status || '').replace(/_/g, ' ');
            const goalRow = document.createElement('div'); goalRow.className = 'requests-convergence-goal-row';
            const goalLabel = document.createElement('span'); goalLabel.className = 'requests-convergence-goal-label'; goalLabel.textContent = `Agent Goal · ${goalStatus}`;
            const goalAction = document.createElement('a'); goalAction.href = `/chat?prompt=${encodeURIComponent(`Show me my agent objective ${linkedGoal.id || ''}`)}`; goalAction.textContent = 'Open goal';
            goalAction.setAttribute('aria-label', 'Open Agent Goal for this request');
            goalRow.append(goalLabel, goalAction); meta.appendChild(goalRow);
            await appendGoalContinuation(meta, linkedGoal);
          }
        }
      } catch {
        // Agent Goal lookup fails closed without inventing linkage.
      }
    }

    const detail = card.querySelector('p'); if (detail) detail.textContent = requestSummary(request);
    card.appendChild(meta);
  };

  const loadCanonicalContext = async () => {
    try {
      const response = await fetch('/api/chat/economic-requests', { credentials: 'same-origin' });
      if (!response.ok) return;
      const payload = await response.json();
      const requests = Array.isArray(payload.requests) ? payload.requests : [];
      const cards = Array.from(list.querySelectorAll('.workspace-data-card'));
      const coordinationCache = new Map();
      const getCoordination = (id) => {
        if (!id || coordinationCache.has(id)) return coordinationCache.get(id) || null;
        const promise = fetch(`/api/chat/economic-requests/${encodeURIComponent(id)}/participants`, { credentials: 'same-origin' }).then((result) => result.ok ? result.json() : null).catch(() => null);
        coordinationCache.set(id, promise); return promise;
      };
      await Promise.all(cards.map((card, index) => {
        const request = requests[index]; if (!request) return Promise.resolve();
        const coordinationPromise = index < 12 && request.id ? getCoordination(String(request.id)) : Promise.resolve(null);
        return enrichCard(card, request, coordinationPromise);
      }));
    } catch {
      // The underlying canonical Requests loader remains the source of truth.
    }
  };

  const waitForCards = () => {
    if (list.querySelector('.workspace-data-card')) { void loadCanonicalContext(); return true; }
    return false;
  };

  if (!waitForCards()) {
    const observer = new MutationObserver(() => { if (waitForCards()) observer.disconnect(); });
    observer.observe(list, { childList: true, subtree: true });
  }
})();
