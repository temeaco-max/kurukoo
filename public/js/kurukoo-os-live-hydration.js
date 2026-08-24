(() => {
  'use strict';
  if (!document.body?.classList.contains('k-app-page')) return;
  const api = async (url) => {
    const response = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : null;
    if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status})`);
    return payload;
  };
  const text = (node, value) => { if (node) node.textContent = String(value ?? ''); };
  const canonical = (href) => {
    try {
      const url = new URL(String(href || ''), window.location.origin);
      if (url.origin !== window.location.origin) return href;
      const direct = {
        '/app': '/desk',
        '/app/agent': '/chat',
        '/app/discover': '/discover',
        '/app/requests': '/requests',
        '/app/tasks': '/tasks',
        '/app/connect': '/connect',
        '/app/reminders': '/reminders',
        '/app/saved': '/saved',
        '/app/cart': '/cart',
        '/app/agents': '/agents',
        '/app/capabilities': '/capabilities',
        '/app/opportunities': '/opportunities',
        '/app/wallet': '/wallet',
        '/app/points': '/points',
        '/app/top-up': '/top-up',
        '/app/subscriptions': '/subscriptions',
        '/app/checkout': '/checkout',
        '/app/confirmations': '/confirmations',
        '/app/memory': '/memory',
        '/app/artifacts': '/artifacts',
        '/app/prayer': '/prayer',
        '/app/call': '/call',
        '/app/notifications': '/notifications',
        '/app/safety': '/safety',
        '/app/settings': '/settings',
      };
      if (direct[url.pathname]) url.pathname = direct[url.pathname];
      else if (url.pathname.startsWith('/app/requests/')) url.pathname = url.pathname.replace('/app/requests/', '/requests/');
      else if (url.pathname.startsWith('/app/tasks/')) url.pathname = url.pathname.replace('/app/tasks/', '/tasks/');
      else if (url.pathname.startsWith('/app/agents/')) url.pathname = url.pathname.replace('/app/agents/', '/agents/');
      else if (url.pathname.startsWith('/app/opportunities/')) url.pathname = url.pathname.replace('/app/opportunities/', '/opportunities/');
      else if (url.pathname.startsWith('/app/connections/')) url.pathname = url.pathname.replace('/app/connections/', '/connections/');
      else if (url.pathname.startsWith('/app/memory/')) url.pathname = url.pathname.replace('/app/memory/', '/memory/');
      else if (url.pathname.startsWith('/app/artifacts/')) url.pathname = url.pathname.replace('/app/artifacts/', '/artifacts/');
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return href;
    }
  };
  const run = async () => {
    const container = document.querySelector('.os-dashboard');
    if (!container || container.dataset.liveHydrated === 'true') return;
    container.dataset.liveHydrated = 'true';

    try {
      const points = await api('/api/points/balance');
      const value = container.querySelector('.os-points-value');
      if (value) text(value, Number(points?.points ?? 0).toLocaleString());
      const meta = container.querySelector('.os-points-meta span:first-child');
      if (meta) text(meta, 'Current account balance');
      const rawProgress = Number(points?.progressPercent);
      const progress = container.querySelector('.os-progress i');
      if (progress && Number.isFinite(rawProgress)) progress.style.width = `${Math.max(0, Math.min(100, rawProgress))}%`;
    } catch {}

    try {
      const [requestsPayload, remindersPayload] = await Promise.all([
        api('/api/chat/economic-requests'),
        api('/api/reminders?includeCompleted=false'),
      ]);
      const requests = Array.isArray(requestsPayload?.requests) ? requestsPayload.requests : [];
      const reminders = Array.isArray(remindersPayload?.reminders) ? remindersPayload.reminders : [];
      const flow = container.querySelector('.os-today-flow .os-timeline');
      if (flow) {
        const items = [];
        const request = requests[0];
        if (request) items.push({ icon: 'request', title: request.skill || request.category || 'Active request', detail: `${request.status || 'In progress'}${request.id ? ` · ${request.id}` : ''}`, time: 'Now', href: '/requests' });
        const reminder = reminders[0];
        if (reminder) items.push({ icon: 'reminder', title: reminder.title || 'Reminder', detail: reminder.note || 'Scheduled with Kurukoo', time: reminder.dueAt || reminder.due_at || 'Today', href: '/reminders' });
        if (!items.length) items.push({ icon: 'chat', title: 'Start with a conversation', detail: 'Ask Kurukoo for the next useful step.', time: 'Anytime', href: '/chat' });
        flow.innerHTML = items.slice(0, 3).map(item => `<a class="os-timeline-item" href="${escapeHtml(canonical(item.href))}"><span class="os-mini-icon"><svg aria-hidden="true" viewBox="0 0 24 24"><use href="/icons/kurukoo-icons.svg#${escapeHtml(item.icon)}"></use></svg></span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></span><span class="os-timeline-time">${escapeHtml(item.time)}</span></a>`).join('');
      }
      const activeCard = [...container.querySelectorAll('.os-feature-card')].find(card => card.textContent?.includes('Active requests'));
      if (activeCard) {
        const copy = activeCard.querySelector('p');
        text(copy, requests.length ? `${requests.length} active request${requests.length === 1 ? '' : 's'} in your Kurukoo relationship.` : 'No active Economic Requests yet. Start with Chat.');
      }
    } catch {}

    try {
      const feed = await api('/api/proactive/feed');
      const opportunities = Array.isArray(feed?.opportunities) ? feed.opportunities : [];
      const opportunity = container.querySelector('.os-opportunity');
      if (opportunity && opportunities[0]) {
        const item = opportunities[0];
        text(opportunity.querySelector('strong'), item.title || 'Opportunity');
        text(opportunity.querySelector('p'), item.subtitle || item.description || 'Open to see the next supported action.');
      }
      const pulse = container.querySelector('.os-pulse-line');
      if (pulse && opportunities.length) {
        pulse.innerHTML = opportunities.slice(0, 4).map((item, index) => `<a class="os-pulse-item" href="${escapeHtml(canonical(item.ctaLink || '/opportunities'))}"><span class="os-pulse-dot${index === 0 ? ' is-live' : ''}"></span><span class="os-pulse-copy"><strong>${escapeHtml(item.title || 'Opportunity')}</strong><small>${escapeHtml(item.subtitle || item.status || 'Open in Kurukoo')}</small></span><span class="os-pulse-time">${escapeHtml(item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Today')}</span></a>`).join('');
      }
    } catch {}

    try {
      const notifications = await api('/api/notifications');
      const count = Array.isArray(notifications?.notifications) ? notifications.notifications.filter((item) => !item.read && !item.readAt).length : 0;
      const badge = document.querySelector('.notification-badge,#notification-badge,[data-kurukoo-header-notification-badge]');
      if (badge) { badge.textContent = String(count); badge.hidden = count === 0; }
    } catch {}
  };
  const escapeHtml = (value) => String(value).replace(/[&<>\"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[char]));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(run, 250), { once: true }); else setTimeout(run, 250);
})();
