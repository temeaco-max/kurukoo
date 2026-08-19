/* Canonical Web App Prayer Companion state. */
(function () {
  'use strict';
  const root = document.querySelector('[data-kurukoo-app]');
  if (!root || root.dataset.appSection !== 'prayer') return;
  const host = root.querySelector('.k-app-main .k-app-card');
  const api = async (url, options = {}) => { const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { Accept: 'application/json', ...(options.headers || {}) } }); const type = response.headers.get('content-type') || ''; const payload = type.includes('application/json') ? await response.json() : { message: await response.text() }; if (!response.ok) throw new Error(payload.error || payload.message || `Request failed (${response.status})`); return payload; };
  const announce = (message) => { let live = root.querySelector('[data-app-live]'); if (!live) { live = document.createElement('div'); live.className = 'k-sr-only'; live.dataset.appLive = ''; live.setAttribute('aria-live', 'polite'); root.appendChild(live); } live.textContent = message; };
  const field = (labelText, type, name, value = '', placeholder = '') => { const label = document.createElement('label'); label.className = 'k-form'; const caption = document.createElement('span'); caption.textContent = labelText; const input = document.createElement(type === 'textarea' ? 'textarea' : 'input'); if (type !== 'textarea') input.type = type; input.name = name; input.value = value; input.placeholder = placeholder; if (name !== 'name') input.required = true; label.append(caption, input); return { label, input }; };
  const action = (label, handler, primary = false) => { const b = document.createElement('button'); b.type = 'button'; b.className = primary ? 'k-app-primary' : 'k-app-card-action'; b.textContent = label; b.addEventListener('click', handler); return b; };
  async function load() {
    if (!host) return;
    host.innerHTML = '<span class="k-app-card-label">Prayer Companion</span><h2>Personalised prayer, continuity and routines.</h2><p class="k-muted">Loading Prayer Companion state…</p>';
    try {
      const status = await api('/api/prayer/status');
      const routines = Array.isArray(status.routines) ? status.routines : [];
      host.innerHTML = '<span class="k-app-card-label">Prayer Companion</span><h2>Personalised prayer, continuity and routines.</h2>';
      const form = document.createElement('form'); form.className = 'k-form'; form.style.marginTop = '16px';
      const topic = field('Prayer topic', 'text', 'topic', '', 'What would you like prayer for?');
      const name = field('Name (optional)', 'text', 'name', '', 'Your name');
      const tradition = document.createElement('label'); tradition.className = 'k-form'; tradition.innerHTML = '<span>Tradition</span>'; const select = document.createElement('select'); ['general','christian','muslim','jewish','spiritual'].forEach((value) => { const option = document.createElement('option'); option.value = value; option.textContent = value[0].toUpperCase() + value.slice(1); select.appendChild(option); }); tradition.appendChild(select);
      const length = document.createElement('label'); length.className = 'k-form'; length.innerHTML = '<span>Length</span>'; const lengthSelect = document.createElement('select'); ['short','medium','long'].forEach((value) => { const option = document.createElement('option'); option.value = value; option.textContent = value[0].toUpperCase() + value.slice(1); lengthSelect.appendChild(option); }); length.appendChild(lengthSelect);
      const submit = action('Generate prayer', null, true); submit.type = 'submit'; form.append(topic.label, name.label, tradition, length, submit);
      const output = document.createElement('article'); output.className = 'k-surface'; output.style.marginTop = '16px'; output.style.padding = '16px'; output.setAttribute('aria-live','polite'); output.textContent = 'Your generated prayer will appear here.';
      form.addEventListener('submit', async (event) => { event.preventDefault(); submit.disabled = true; output.textContent = 'Generating…'; try { const result = await api('/api/prayer/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: topic.input.value.trim(), name: name.input.value.trim() || undefined, tradition: select.value, length: lengthSelect.value }) }); const text = result.text || result.prayer || 'Prayer generated.'; output.textContent = text; announce('Prayer generated.'); } catch (error) { output.textContent = error.message; announce(error.message); } finally { submit.disabled = false; } });
      host.append(form, output);
      const routine = document.createElement('section'); routine.className = 'k-surface'; routine.style.marginTop = '14px'; routine.style.padding = '16px'; routine.innerHTML = '<span class="k-app-card-label">Prayer routines</span><h3>Scheduled prayer</h3>';
      const routineForm = document.createElement('form'); routineForm.className = 'k-form'; const rTopic = field('Routine topic', 'text', 'topic', '', 'Morning gratitude'); const due = field('Time', 'time', 'dueAt'); const recurrence = document.createElement('label'); recurrence.className = 'k-form'; recurrence.innerHTML = '<span>Recurrence</span>'; const rs = document.createElement('select'); ['daily','weekly'].forEach(v => { const o = document.createElement('option'); o.value=v; o.textContent=v[0].toUpperCase()+v.slice(1); rs.appendChild(o); }); recurrence.appendChild(rs); const create = action('Schedule routine', null, true); create.type='submit'; routineForm.append(rTopic.label,due.label,recurrence,create); routine.appendChild(routineForm);
      const list = document.createElement('div'); list.className = 'k-action-row'; list.style.flexDirection='column'; list.style.alignItems='stretch'; list.style.marginTop='12px';
      if (!routines.length) { const p=document.createElement('p'); p.className='k-muted'; p.textContent='No prayer routines scheduled.'; list.appendChild(p); } else routines.slice(0,10).forEach(r=>{ const p=document.createElement('p'); p.className='k-muted'; p.textContent=`${r.topic || 'Prayer'} · ${r.due_at || r.dueAt || 'scheduled'} · ${r.recurrence || 'daily'}`; list.appendChild(p); });
      routineForm.addEventListener('submit', async (event) => { event.preventDefault(); create.disabled=true; try { await api('/api/prayer/routine',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:rTopic.input.value.trim(),dueAt:due.input.value,recurrence:rs.value,tradition:select.value,name:name.input.value.trim()||undefined})}); announce('Prayer routine scheduled.'); await load(); } catch(error){create.disabled=false;announce(error.message);} });
      routine.appendChild(list); host.appendChild(routine);
      host.appendChild(action('Open Prayer in Chat →', () => window.location.assign('/chat?prompt=I%20would%20like%20a%20prayer')));
    } catch (error) { host.innerHTML = '<span class="k-app-card-label">Prayer Companion</span><h2>Prayer Companion unavailable</h2>'; const p=document.createElement('p'); p.className='k-muted'; p.textContent=error.message||'Prayer service is unavailable right now.'; host.appendChild(p); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once:true }); else load();
})();
