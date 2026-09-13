(() => {
  'use strict';
  if (!document.body?.classList.contains('k-app-page')) return;
  if (document.documentElement.dataset.kurukooDeskLiveHydration === 'true') return;
  document.documentElement.dataset.kurukooDeskLiveHydration = 'true';

  const api = async (url) => {
    const response = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    const type = response.headers.get('content-type') || '';
    const payload = type.includes('application/json') ? await response.json() : null;
    if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status})`);
    return payload;
  };

  const notificationButton = () => document.querySelector('.k-desk-header-notifications');

  const ensureBadge = () => {
    const button = notificationButton();
    if (!button) return null;
    let badge = button.querySelector('[data-kurukoo-header-notification-badge]');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'k-desk-header-badge';
      badge.dataset.kurukooHeaderNotificationBadge = 'true';
      badge.hidden = true;
      badge.setAttribute('aria-hidden', 'true');
      button.appendChild(badge);
    }
    return badge;
  };

  const hydratePoints = async () => {
    const button = document.querySelector('.k-desk-header-points');
    if (!button) return;
    try {
      const payload = await api('/api/points/balance');
      const points = Number(payload?.points ?? 0);
      const label = `Points: ${points.toLocaleString()}`;
      button.dataset.pointsBalance = String(points);
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      let value = button.querySelector('[data-kurukoo-points-value]');
      if (!value) {
        value = document.createElement('span');
        value.className = 'k-desk-header-value';
        value.dataset.kurukooPointsValue = 'true';
        button.appendChild(value);
      }
      value.textContent = points.toLocaleString();
    } catch {}
  };

  const hydrateNotifications = async () => {
    const badge = ensureBadge();
    if (!badge) return;
    try {
      const payload = await api('/api/notifications');
      const items = Array.isArray(payload?.notifications) ? payload.notifications : Array.isArray(payload) ? payload : [];
      const unread = items.filter((item) => !item.read && !item.readAt).length;
      badge.textContent = unread > 99 ? '99+' : String(unread);
      badge.hidden = unread === 0;
      notificationButton()?.setAttribute('aria-label', unread ? `Notifications, ${unread} unread` : 'Notifications');
    } catch {
      badge.hidden = true;
    }
  };

  const boot = () => {
    hydratePoints();
    hydrateNotifications();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else setTimeout(boot, 0);
})();
