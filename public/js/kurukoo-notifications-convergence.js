(() => {
  if (document.body?.dataset.workspaceSection !== 'notifications') return;
  const container = document.querySelector('[data-notifications-root]') || document.querySelector('.k-app-container');
  if (!container) return;
  const escapePath = (value) => encodeURIComponent(String(value || ''));
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const safeInternalHref = (value) => {
    const link = String(value || '').trim();
    return /^\/(?!\/)/.test(link) ? link : null;
  };
  const formatDate = (value) => {
    if (!value) return 'Time unavailable';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };
  const humanize = (value) => String(value || 'Notification').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const sourceLabel = (notification) => humanize(notification.surface || notification.object_type || 'Kurukoo');
  const deliveryLabel = (state) => ({ queued: 'Delivery queued', accepted: 'Delivery accepted by provider', sent: 'Delivery sent', delivered: 'Delivery confirmed', failed: 'Delivery failed', suppressed: 'Delivery suppressed', dead_letter: 'Delivery stopped', unavailable: 'Delivery unavailable' }[String(state || '')] || 'In-app state recorded');
  const canonicalHref = (notification) => {
    const storedLink = safeInternalHref(notification.link);
    if (storedLink) return storedLink;
    if (notification.conversation_id) return `/chat/${escapePath(notification.conversation_id)}`;
    const type = String(notification.object_type || '').toLowerCase();
    const id = String(notification.object_id || '').trim();
    if (!id) return null;
    if (type === 'request' || type === 'economic_request') return `/requests/${escapePath(id)}`;
    if (type === 'task') return `/tasks/${escapePath(id)}`;
    if (type === 'topic') return `/topics/${escapePath(id)}`;
    if (type === 'opportunity') return `/opportunities/${escapePath(id)}`;
    if (type === 'agent') return `/agents/${escapePath(id)}`;
    return null;
  };
  const api = async (path, options = {}) => {
    const response = await fetch(path, { credentials: 'same-origin', ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) throw new Error(payload?.error || `Request failed (${response.status})`);
    return payload;
  };
  const setInner = (html) => { container.innerHTML = html; };
  const shell = (content) => `<div class="k57-notifications"><div class="k-app-card"><span class="k-app-card-label">Notification centre</span><h2>What needs your attention</h2><p>These notifications stay linked to their canonical source. Kurukoo does not claim external delivery unless the delivery boundary confirms it.</p></div>${content}</div>`;
  const loading = () => shell('<section class="k-app-card" aria-live="polite" aria-busy="true"><div class="k-app-list-loading">Loading canonical notifications…</div></section>');
  const empty = () => shell('<section class="k-app-card k57-unavailable"><div><h3>You are all caught up</h3><p>No unread or recent notifications are currently available to this authenticated account.</p><div class="k57-notification-actions"><a class="k-app-card-action" href="/desk">Open Desk →</a></div></div></section>');
  const error = () => shell('<section class="k-app-card k57-unavailable" role="alert"><div><h3>Notifications are unavailable</h3><p>Kurukoo could not read the canonical notification authority. No notification state is inferred locally.</p><div class="k57-notification-actions"><button class="k-app-primary" type="button" data-k57-retry>Retry Notifications</button></div></div></section>');
  const render = (notifications) => {
    if (!notifications.length) { setInner(empty()); return; }
    const unread = notifications.filter((item) => String(item.status || 'unread') !== 'read');
    const read = notifications.filter((item) => String(item.status || '') === 'read');
    const section = (label, items) => {
      if (!items.length) return '';
      return `<div class="k57-section-label">${escapeHtml(label)}</div><section class="k-app-card"><div class="k-app-data-list">${items.map((item) => {
        const isUnread = String(item.status || '') !== 'read';
        const href = canonicalHref(item);
        const actionLabel = item.available_action ? humanize(item.available_action) : href ? 'Open source' : '';
        const delivery = deliveryLabel(item.delivery_state);
        const source = sourceLabel(item);
        return `<article class="k57-notification-card ${isUnread ? 'is-unread' : ''}" data-notification-id="${escapeHtml(item.id)}"><div><div class="k57-notification-meta"><span class="k57-notification-source">${escapeHtml(source)}</span><span>${escapeHtml(formatDate(item.created_at))}</span><span class="k57-delivery">${escapeHtml(delivery)}</span></div><h3>${escapeHtml(item.title || 'Notification')}</h3><p class="k57-notification-copy">${escapeHtml(item.body || '')}</p>${item.context_id || item.canonical_action ? `<div class="k57-notification-meta"><span>${item.context_id ? escapeHtml(`Context ${item.context_id}`) : ''}</span><span>${item.canonical_action ? escapeHtml(humanize(item.canonical_action)) : ''}</span></div>` : ''}<div class="k57-notification-actions">${href ? `<a class="k-app-card-action k57-notification-action" href="${escapeHtml(href)}" data-k57-open="${escapeHtml(item.id)}">${escapeHtml(actionLabel || 'Open')}</a>` : ''}${isUnread ? `<button class="workspace-text-action k57-notification-action" type="button" data-k57-read="${escapeHtml(item.id)}">Mark read</button>` : ''}</div></div></article>`;
      }).join('')}</div></section>`;
    };
    setInner(shell(`${section('Needs your attention', unread)}${section('Earlier', read)}`));
    container.querySelectorAll('[data-k57-read]').forEach((button) => button.addEventListener('click', async () => {
      const id = button.dataset.k57Read;
      button.disabled = true;
      try { await api(`/api/notifications/${escapePath(id)}/read`, { method: 'POST' }); await load(); }
      catch { button.disabled = false; button.textContent = 'Could not mark read'; }
    }));
    container.querySelectorAll('[data-k57-open]').forEach((link) => link.addEventListener('click', async () => {
      const id = link.dataset.k57Open;
      try { await api(`/api/notifications/${escapePath(id)}/read`, { method: 'POST' }); } catch { /* navigation remains valid even if read acknowledgement is unavailable */ }
    }));
  };
  const load = async () => {
    setInner(loading());
    try { const payload = await api('/api/notifications?limit=100'); render(Array.isArray(payload.notifications) ? payload.notifications : []); }
    catch { setInner(error()); container.querySelector('[data-k57-retry]')?.addEventListener('click', load); }
  };
  load();
})();
