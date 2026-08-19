/* Canonical Web App economic readiness layer. No payment success is inferred client-side. */
(function () {
  'use strict';
  const root = document.querySelector('[data-kurukoo-app]');
  if (!root) return;
  const section = root.dataset.appSection || '';
  if (!['wallet', 'subscriptions', 'checkout', 'confirmations'].includes(section)) return;
  const host = root.querySelector('.k-app-main .k-app-card');
  const api = async (url, options = {}) => { const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { Accept: 'application/json', ...(options.headers || {}) } }); const type = response.headers.get('content-type') || ''; const payload = type.includes('application/json') ? await response.json() : { message: await response.text() }; if (!response.ok) throw new Error(payload.error || payload.message || `Request failed (${response.status})`); return payload; };
  const announce = (message) => { let live = root.querySelector('[data-app-live]'); if (!live) { live = document.createElement('div'); live.className = 'k-sr-only'; live.dataset.appLive = ''; live.setAttribute('aria-live', 'polite'); root.appendChild(live); } live.textContent = message; };
  const humanize = (v) => String(v || 'unknown').replaceAll('_', ' ').replace(/\b\w/g, m => m.toUpperCase());
  const pill = (text, ready = false) => { const s = document.createElement('span'); s.className = `k-status${ready ? ' k-status--ready' : ''}`; s.textContent = text; return s; };
  async function load() {
    if (!host) return;
    try {
      const [stripe, requests] = await Promise.all([
        api('/api/payments/stripe/status').catch(() => ({ configured: false, provider: 'stripe' })),
        api('/api/chat/economic-requests').catch(() => ({ requests: [] }))
      ]);
      const items = Array.isArray(requests.requests) ? requests.requests : [];
      const eligible = items.filter((r) => ['quoted','awaiting_confirmation','payment_pending'].includes(r.status) && r.quote && Number(r.quote.amount_minor) > 0);
      host.innerHTML = '<span class="k-app-card-label">Economic readiness</span><h2>Every money state stays evidence-gated.</h2><p class="k-muted">The Web App shows payment readiness from the canonical payment and Economic Request authorities. Client-side UI never treats a request, quote or payment intent as a completed payment.</p>';
      const statusRow = document.createElement('div'); statusRow.className = 'k-action-row'; statusRow.appendChild(pill(stripe.configured ? 'Stripe configured' : 'Stripe not configured', Boolean(stripe.configured))); statusRow.appendChild(pill(`${items.length} economic requests`)); host.appendChild(statusRow);
      const list = document.createElement('div'); list.style.marginTop = '16px'; list.className = 'k-action-row'; list.style.flexDirection = 'column'; list.style.alignItems = 'stretch';
      if (!eligible.length) { const p = document.createElement('p'); p.className = 'k-muted'; p.textContent = section === 'checkout' ? 'No quoted Economic Request is currently ready for checkout.' : 'No current Economic Request requires a payment action.'; list.appendChild(p); }
      eligible.slice(0, 10).forEach((request) => {
        const row = document.createElement('article'); row.className = 'k-surface'; row.style.padding = '14px';
        const title = document.createElement('strong'); title.textContent = request.skill || request.category || 'Economic Request';
        const detail = document.createElement('p'); detail.className = 'k-muted'; detail.textContent = `${humanize(request.status)} · ${request.quote.currency || 'GBP'} ${Number(request.quote.amount_minor) / 100}`;
        row.append(title, detail);
        const action = document.createElement('a'); action.className = 'k-app-card-action'; action.href = `/chat?prompt=${encodeURIComponent(`Continue my ${request.skill || request.category || 'economic request'} and review payment state`)}`; action.textContent = 'Review in Chat →'; row.appendChild(action);
        if (stripe.configured && section === 'checkout') {
          const pay = document.createElement('button'); pay.type = 'button'; pay.className = 'k-app-primary'; pay.textContent = request.status === 'payment_pending' ? 'Payment pending' : 'Start Stripe payment';
          pay.disabled = request.status === 'payment_pending';
          pay.addEventListener('click', async () => { pay.disabled = true; try { const result = await api('/api/payments/stripe/intents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ economicRequestId: request.id }) }); announce(`Payment intent ${result.status}. Continue through the configured Stripe payment surface.`); pay.textContent = `Intent ${humanize(result.status)}`; } catch (error) { pay.disabled = false; announce(error.message); } });
          row.appendChild(pay);
        }
        list.appendChild(row);
      });
      host.appendChild(list);
      const boundary = document.createElement('p'); boundary.className = 'k-muted'; boundary.style.marginTop = '14px'; boundary.textContent = stripe.configured ? 'Stripe is configured at the server boundary. Final payment success requires provider evidence and webhook reconciliation.' : 'Payment provider is not configured for this deployment. No payment action is presented as successful.'; host.appendChild(boundary);
    } catch (error) { if (host) { host.innerHTML = '<span class="k-app-card-label">Economic layer</span><h2>Payment state unavailable</h2>'; const p = document.createElement('p'); p.className = 'k-muted'; p.textContent = error.message || 'Economic state could not be loaded.'; host.appendChild(p); } }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true }); else load();
})();
