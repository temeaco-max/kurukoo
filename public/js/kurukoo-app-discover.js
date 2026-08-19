/* Canonical Web App Discover/Nearby Pulse state. */
(function () {
  'use strict';
  const root = document.querySelector('[data-kurukoo-app]');
  if (!root || root.dataset.appSection !== 'discover') return;
  const card = () => root.querySelector('.k-app-main .k-app-card');
  const api = async (url, options = {}) => { const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { Accept: 'application/json', ...(options.headers || {}) } }); const type = response.headers.get('content-type') || ''; const payload = type.includes('application/json') ? await response.json() : { message: await response.text() }; if (!response.ok) throw new Error(payload.error || payload.message || `Request failed (${response.status})`); return payload; };
  const announce = (message) => { let live = root.querySelector('[data-app-live]'); if (!live) { live = document.createElement('div'); live.className = 'k-sr-only'; live.dataset.appLive = ''; live.setAttribute('aria-live', 'polite'); root.appendChild(live); } live.textContent = message; };
  const status = (text, tone = '') => { const span = document.createElement('span'); span.className = `k-status${tone ? ` k-status--${tone}` : ''}`; span.textContent = text; return span; };
  const action = (label, handler) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'k-app-primary'; b.textContent = label; b.addEventListener('click', handler); return b; };
  async function load() {
    const host = card(); if (!host) return;
    host.innerHTML = '<span class="k-app-card-label">Nearby Pulse</span><h2>Local presence, availability and useful nearby signals.</h2><p class="k-muted">Loading the public Pulse projection and your presence state…</p>';
    try {
      const [publicPayload, ownPayload] = await Promise.all([
        api('/api/pulse/providers'),
        api('/api/pulse/status').catch(() => ({ active: false }))
      ]);
      const providers = Array.isArray(publicPayload.providers) ? publicPayload.providers : [];
      const grid = document.createElement('div'); grid.className = 'k-grid k-grid--2'; grid.style.marginTop = '18px';
      const nearby = document.createElement('section'); nearby.className = 'k-app-card'; nearby.innerHTML = '<span class="k-app-card-label">Nearby</span><h3>Live Pulse projection</h3>';
      const list = document.createElement('div'); list.className = 'k-action-row'; list.style.flexDirection = 'column'; list.style.alignItems = 'stretch';
      if (!providers.length) { const p = document.createElement('p'); p.className = 'k-muted'; p.textContent = 'No public Pulse providers are active right now.'; list.appendChild(p); }
      providers.slice(0, 12).forEach((provider) => { const row = document.createElement('div'); row.className = 'k-surface'; row.style.padding = '12px'; const title = document.createElement('strong'); title.textContent = provider.skill || provider.category || provider.type || 'Local provider'; const meta = document.createElement('p'); meta.className = 'k-muted'; meta.textContent = [provider.distance ? `${provider.distance} away` : null, provider.availability || provider.state || 'Active', provider.source || null].filter(Boolean).join(' · '); row.append(title, meta); list.appendChild(row); });
      nearby.appendChild(list);
      const presence = document.createElement('section'); presence.className = 'k-app-card'; presence.innerHTML = '<span class="k-app-card-label">Your Presence</span><h3>Nearby Pulse participation</h3>';
      presence.appendChild(status(ownPayload.active ? 'Active on Pulse' : 'Not active', ownPayload.active ? 'ready' : 'pending'));
      const copy = document.createElement('p'); copy.className = 'k-muted'; copy.textContent = ownPayload.active ? 'Your current Pulse session is active. Deactivate it when you no longer want to be discoverable.' : 'Activate only when you intentionally want to participate in local discovery. Exact coordinates are never exposed through the public projection.'; presence.appendChild(copy);
      if (ownPayload.active) presence.appendChild(action('Deactivate Pulse', async (event) => { event.currentTarget.disabled = true; try { await api('/api/pulse/deactivate', { method: 'POST' }); announce('Pulse deactivated.'); await load(); } catch (error) { event.currentTarget.disabled = false; announce(error.message); } }));
      else presence.appendChild(action('Activate from Web Chat', () => { window.location.assign('/chat?prompt=I%20want%20to%20activate%20Nearby%20Pulse'); }));
      grid.append(nearby, presence); host.replaceChildren(host.querySelector('.k-app-card-label') || document.createElement('span'), grid);
      const label = host.querySelector('.k-app-card-label'); if (label) label.textContent = 'Discover';
      const note = document.createElement('p'); note.className = 'k-muted'; note.style.marginTop = '14px'; note.textContent = 'Public discovery is intentionally privacy-preserving: anonymous consumers receive sanitized Pulse projections, not phone identifiers or exact coordinates.'; host.appendChild(note);
    } catch (error) { host.innerHTML = '<span class="k-app-card-label">Discover</span><h2>Discover state unavailable</h2>'; const p = document.createElement('p'); p.className = 'k-muted'; p.textContent = error.message || 'Nearby Pulse is unavailable right now.'; host.appendChild(p); host.appendChild(action('Open Discover', () => window.location.assign('/discover'))); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true }); else load();
})();
