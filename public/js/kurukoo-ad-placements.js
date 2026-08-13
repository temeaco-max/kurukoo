(() => {
  'use strict';

  const SLOT_SELECTOR = '[data-kurukoo-ad-placement]';
  const sessionStorageKey = 'kurukoo_ad_session_v1';
  const createElement = (tag, text, className) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const safeString = (value, maximum = 500) => String(value || '').trim().slice(0, maximum);
  const device = () => window.innerWidth < 640 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop';
  const sessionId = () => {
    try {
      let value = window.sessionStorage.getItem(sessionStorageKey);
      if (!value) {
        value = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID().replaceAll('-', '') : `${Date.now()}${Math.random().toString(36).slice(2)}`;
        window.sessionStorage.setItem(sessionStorageKey, value);
      }
      return value;
    } catch { return null; }
  };
  const eventPayload = (slot, item, eventType) => ({
    campaignId: item.campaignId,
    affiliateOfferId: item.affiliateOfferId,
    source: item.source,
    eventType,
    sessionId: sessionId(),
    eventToken: item.eventToken,
    category: slot.dataset.category || undefined,
    country: slot.dataset.country || undefined,
    device: device(),
  });
  const record = (slot, item, eventType) => {
    const placementId = safeString(slot.dataset.kurukooAdPlacement, 100);
    const payload = eventPayload(slot, item, eventType);
    if (!placementId || !payload.sessionId || !payload.eventToken) return;
    void fetch(`/api/advertising/placements/${encodeURIComponent(placementId)}/events`, {
      method: 'POST', credentials: 'same-origin', keepalive: true,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }).catch(() => undefined);
  };
  const render = (slot, item) => {
    const card = createElement('article', undefined, 'kurukoo-ad-card');
    card.dataset.adSource = safeString(item.source, 32);
    const label = createElement('p', safeString(item.disclosure || 'Sponsored', 120), 'kurukoo-ad-card__label');
    const content = createElement('div', undefined, 'kurukoo-ad-card__content');
    const title = createElement('h2', safeString(item.title, 180), 'kurukoo-ad-card__title');
    const detail = createElement('p', safeString(item.description, 500), 'kurukoo-ad-card__detail');
    const boundary = createElement('p', safeString(item.boundary, 420), 'kurukoo-ad-card__boundary');
    content.append(title, detail, boundary);
    if (safeString(item.imageUrl, 1000)) {
      const image = document.createElement('img');
      image.className = 'kurukoo-ad-card__image'; image.src = safeString(item.imageUrl, 1000); image.alt = '';
      image.loading = 'lazy'; image.decoding = 'async'; card.append(label, image, content);
    } else card.append(label, content);
    const ctaLink = safeString(item.ctaLink, 2048);
    if (ctaLink.startsWith('/') || /^https?:\/\//.test(ctaLink)) {
      const action = document.createElement('a');
      action.className = 'kurukoo-ad-card__action'; action.href = ctaLink; action.textContent = safeString(item.ctaText || 'Review', 80);
      if (/^https?:\/\//.test(ctaLink)) { action.rel = 'noopener noreferrer'; action.target = '_blank'; }
      action.addEventListener('click', () => record(slot, item, 'click'), { once: true });
      content.append(action);
    }
    slot.replaceChildren(card); slot.hidden = false; slot.dataset.adState = 'served';
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some(entry => entry.isIntersecting)) { record(slot, item, 'impression'); observer.disconnect(); }
      }, { threshold: 0.5 });
      observer.observe(slot);
    } else record(slot, item, 'impression');
  };
  const load = async (slot) => {
    const placementId = safeString(slot.dataset.kurukooAdPlacement, 100);
    const session = sessionId();
    if (!placementId || !session) return;
    const params = new URLSearchParams({ sessionId: session, device: device() });
    if (safeString(slot.dataset.category, 80)) params.set('category', safeString(slot.dataset.category, 80));
    if (safeString(slot.dataset.country, 8)) params.set('country', safeString(slot.dataset.country, 8));
    try {
      const response = await fetch(`/api/advertising/placements/${encodeURIComponent(placementId)}?${params.toString()}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (!response.ok) return;
      const payload = await response.json();
      if (!payload?.item || payload?.reason !== 'served') return;
      render(slot, payload.item);
    } catch { /* Empty is the truthful fallback. */ }
  };
  const boot = () => {
    const slots = Array.from(document.querySelectorAll(SLOT_SELECTOR));
    if (!slots.length) return;
    slots.forEach((slot) => {
      slot.hidden = true;
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
          if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); void load(slot); }
        }, { rootMargin: '280px 0px' });
        observer.observe(slot);
      } else void load(slot);
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
