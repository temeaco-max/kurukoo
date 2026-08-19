/* Canonical Web App Reminders + Cart state layer. */
(function () {
  'use strict';
  const root = document.querySelector('[data-kurukoo-app]');
  if (!root) return;
  const section = root.dataset.appSection || '';
  if (!['reminders', 'cart'].includes(section)) return;
  const host = root.querySelector('.k-app-main .k-app-card');
  const api = async (url, options = {}) => { const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { Accept: 'application/json', ...(options.headers || {}) } }); const type = response.headers.get('content-type') || ''; const payload = type.includes('application/json') ? await response.json() : { message: await response.text() }; if (!response.ok) throw new Error(payload.error || payload.message || `Request failed (${response.status})`); return payload; };
  const announce = (message) => { let live = root.querySelector('[data-app-live]'); if (!live) { live = document.createElement('div'); live.className = 'k-sr-only'; live.dataset.appLive = ''; live.setAttribute('aria-live', 'polite'); root.appendChild(live); } live.textContent = message; };
  const button = (label, handler, primary = false) => { const b = document.createElement('button'); b.type = 'button'; b.className = primary ? 'k-app-primary' : 'k-app-card-action'; b.textContent = label; b.addEventListener('click', handler); return b; };
  const field = (labelText, type, name, value = '', placeholder = '') => { const label = document.createElement('label'); label.className = 'k-form'; const caption = document.createElement('span'); caption.textContent = labelText; const input = document.createElement(type === 'textarea' ? 'textarea' : 'input'); if (type !== 'textarea') input.type = type; input.name = name; input.value = value; input.placeholder = placeholder; input.required = type !== 'textarea'; label.append(caption, input); return { label, input }; };

  async function loadReminders() {
    if (!host) return;
    host.innerHTML = '<span class="k-app-card-label">Reminders</span><h2>Scheduled help that stays with your conversations.</h2><p class="k-muted">Loading reminders…</p>';
    try {
      const payload = await api('/api/reminders?includeCompleted=true');
      const reminders = Array.isArray(payload.reminders) ? payload.reminders : [];
      host.innerHTML = '<span class="k-app-card-label">Reminders</span><h2>Scheduled help that stays with your conversations.</h2>';
      const form = document.createElement('form'); form.className = 'k-form'; form.style.marginTop = '16px';
      const title = field('Reminder', 'text', 'title', '', 'Call Mum'); const due = field('When', 'datetime-local', 'dueAt'); const note = field('Note (optional)', 'text', 'note', '', 'What should Kurukoo remember?');
      const submit = button('Create reminder', null, true); submit.type = 'submit'; form.append(title.label, due.label, note.label, submit);
      form.addEventListener('submit', async (event) => { event.preventDefault(); if (!title.input.value.trim() || !due.input.value) { announce('Reminder title and time are required.'); return; } submit.disabled = true; try { await api('/api/reminders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.input.value.trim(), dueAt: new Date(due.input.value).toISOString(), note: note.input.value.trim() || undefined }) }); announce('Reminder created.'); form.reset(); await loadReminders(); } catch (error) { submit.disabled = false; announce(error.message); } });
      host.appendChild(form);
      const list = document.createElement('div'); list.className = 'k-action-row'; list.style.flexDirection = 'column'; list.style.alignItems = 'stretch'; list.style.marginTop = '18px';
      if (!reminders.length) { const p = document.createElement('p'); p.className = 'k-muted'; p.textContent = 'No reminders are currently stored.'; list.appendChild(p); }
      reminders.slice(0, 20).forEach((reminder) => { const row = document.createElement('article'); row.className = 'k-surface'; row.style.padding = '14px'; const strong = document.createElement('strong'); strong.textContent = reminder.title || 'Reminder'; const meta = document.createElement('p'); meta.className = 'k-muted'; meta.textContent = `${reminder.due_at || reminder.dueAt || 'Scheduled'} · ${reminder.status || (reminder.completed ? 'completed' : 'active')}`; row.append(strong, meta); if (!['completed','cancelled','resolved'].includes(String(reminder.status || '').toLowerCase()) && reminder.id) row.appendChild(button('Cancel', async (event) => { event.currentTarget.disabled = true; try { await api(`/api/reminders/${encodeURIComponent(reminder.id)}/cancel`, { method: 'POST' }); announce('Reminder cancelled.'); await loadReminders(); } catch (error) { event.currentTarget.disabled = false; announce(error.message); } })); list.appendChild(row); });
      host.appendChild(list);
      const chat = button('Manage reminders in Chat →', () => window.location.assign('/chat?prompt=Show%20me%20my%20reminders')); host.appendChild(chat);
    } catch (error) { host.innerHTML = '<span class="k-app-card-label">Reminders</span><h2>Reminders unavailable</h2>'; const p = document.createElement('p'); p.className = 'k-muted'; p.textContent = error.message || 'Reminder service is unavailable right now.'; host.appendChild(p); }
  }

  async function loadCart() {
    if (!host) return;
    host.innerHTML = '<span class="k-app-card-label">Cart</span><h2>Review sourced offers before any economic action.</h2><p class="k-muted">Loading your review cart…</p>';
    try {
      const payload = await api('/cart');
      const items = Array.isArray(payload.items) ? payload.items : [];
      host.innerHTML = '<span class="k-app-card-label">Cart</span><h2>Review sourced offers before any economic action.</h2><p class="k-muted">Cart is a review surface. It does not itself mean inventory, payment or fulfilment is confirmed.</p>';
      const list = document.createElement('div'); list.className = 'k-action-row'; list.style.flexDirection = 'column'; list.style.alignItems = 'stretch'; list.style.marginTop = '16px';
      if (!items.length) { const p = document.createElement('p'); p.className = 'k-muted'; p.textContent = 'Your review cart is empty.'; list.appendChild(p); }
      items.forEach((item) => { const row = document.createElement('article'); row.className = 'k-surface'; row.style.padding = '16px'; const title = document.createElement('strong'); title.textContent = item.title || 'Offer'; const meta = document.createElement('p'); meta.className = 'k-muted'; meta.textContent = `${item.seller || 'Seller unknown'} · Qty ${item.quantity || 1} · ${item.price_minor != null ? `${item.currency || 'NGN'} ${(Number(item.price_minor) / 100).toFixed(2)}` : 'Price pending'}`; const source = document.createElement('p'); source.className = 'k-muted'; source.textContent = `State: ${item.status || 'review'}${item.request_id ? ` · Economic Request ${item.request_id}` : ''}`; row.append(title, meta, source); const actions = document.createElement('div'); actions.className = 'k-action-row'; actions.appendChild(button('Remove', async (event) => { event.currentTarget.disabled = true; try { await api(`/cart/items/${encodeURIComponent(item.id)}`, { method: 'DELETE' }); announce('Cart item removed.'); await loadCart(); } catch (error) { event.currentTarget.disabled = false; announce(error.message); } })); if (!item.request_id) actions.appendChild(button('Connect to Economic Request', async (event) => { event.currentTarget.disabled = true; try { const result = await api('/cart/checkout', { method: 'POST' }); announce(result.message || 'Offer connected to Economic Request.'); await loadCart(); } catch (error) { event.currentTarget.disabled = false; announce(error.message); } }, true)); else actions.appendChild(button('Review payment state', () => window.location.assign('/app/checkout'))); row.appendChild(actions); list.appendChild(row); });
      host.appendChild(list);
      const note = document.createElement('p'); note.className = 'k-muted'; note.style.marginTop = '14px'; note.textContent = 'External affiliate offers may require a verified external destination. Local payment is never claimed from the cart alone.'; host.appendChild(note);
      host.appendChild(button('Continue in Chat →', () => window.location.assign('/chat'), true));
    } catch (error) { host.innerHTML = '<span class="k-app-card-label">Cart</span><h2>Cart unavailable</h2>'; const p = document.createElement('p'); p.className = 'k-muted'; p.textContent = error.message || 'Cart is unavailable right now.'; host.appendChild(p); }
  }
  const start = () => { if (section === 'reminders') loadReminders(); else loadCart(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
