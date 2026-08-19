/* Canonical Web App Topics state. Community content never becomes an offer/provider claim. */
(function () {
  'use strict';
  const root = document.querySelector('[data-kurukoo-app]');
  if (!root || root.dataset.appSection !== 'topics') return;
  const host = root.querySelector('.k-app-main .k-app-card');
  const api = async (url, options = {}) => { const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { Accept: 'application/json', ...(options.headers || {}) } }); const type = response.headers.get('content-type') || ''; const payload = type.includes('application/json') ? await response.json() : { message: await response.text() }; if (!response.ok) throw new Error(payload.error || payload.message || `Request failed (${response.status})`); return payload; };
  const announce = (message) => { let live = root.querySelector('[data-app-live]'); if (!live) { live = document.createElement('div'); live.className = 'k-sr-only'; live.dataset.appLive = ''; live.setAttribute('aria-live', 'polite'); root.appendChild(live); } live.textContent = message; };
  const button = (label, handler, primary = false) => { const b = document.createElement('button'); b.type = 'button'; b.className = primary ? 'k-app-primary' : 'k-app-card-action'; b.textContent = label; b.addEventListener('click', handler); return b; };
  async function load() {
    if (!host) return;
    host.innerHTML = '<span class="k-app-card-label">Topics</span><h2>Community context that stays separate from fulfilment.</h2><p class="k-muted">Loading public Topics…</p>';
    try {
      const payload = await api('/topics?limit=12');
      const topics = Array.isArray(payload.topics) ? payload.topics : [];
      host.innerHTML = '<span class="k-app-card-label">Topics</span><h2>Community context that stays separate from fulfilment.</h2>';
      const intro = document.createElement('p'); intro.className = 'k-muted'; intro.textContent = 'Topics are durable shared content. They do not by themselves create a provider, offer, payment, execution or Points event.'; host.appendChild(intro);
      const list = document.createElement('div'); list.className = 'k-action-row'; list.style.flexDirection = 'column'; list.style.alignItems = 'stretch'; list.style.marginTop = '16px';
      if (!topics.length) { const p = document.createElement('p'); p.className = 'k-muted'; p.textContent = 'No public Topics are available right now.'; list.appendChild(p); }
      topics.forEach((topic) => { const row = document.createElement('article'); row.className = 'k-surface'; row.style.padding = '16px'; const title = document.createElement('strong'); title.textContent = topic.title || 'Topic'; const body = document.createElement('p'); body.className = 'k-muted'; body.textContent = String(topic.body || '').slice(0, 260); const meta = document.createElement('p'); meta.className = 'k-muted'; meta.textContent = [topic.category, topic.city, topic.replyCount != null ? `${topic.replyCount} replies` : null].filter(Boolean).join(' · '); row.append(title, body, meta); row.appendChild(button('Open Topic →', () => window.location.assign(`/topics/${encodeURIComponent(topic.slug || topic.id)}`), false)); row.appendChild(button('Continue in Chat →', () => window.location.assign(`/chat?prompt=${encodeURIComponent(`Tell me more about the Topic: ${topic.title || ''}`)}`), false)); list.appendChild(row); });
      host.appendChild(list);
      host.appendChild(button('Create a Topic in Chat', () => window.location.assign('/chat?prompt=I%20want%20to%20create%20a%20community%20Topic'), true));
      const note = document.createElement('p'); note.className = 'k-muted'; note.style.marginTop = '14px'; note.textContent = 'Community statements are presented with provenance and moderation boundaries; Kurukoo does not infer provider availability or commercial truth from a Topic.'; host.appendChild(note);
    } catch (error) { host.innerHTML = '<span class="k-app-card-label">Topics</span><h2>Topics unavailable</h2>'; const p = document.createElement('p'); p.className = 'k-muted'; p.textContent = error.message || 'Topics are unavailable right now.'; host.appendChild(p); host.appendChild(button('Open Topics', () => window.location.assign('/topics'), true)); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true }); else load();
})();
