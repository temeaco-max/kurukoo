/* Canonical Web App Safety + Memory state layer. Uses only existing owner-scoped authorities. */
(function () {
  'use strict';
  const root = document.querySelector('[data-kurukoo-app]');
  if (!root) return;
  const section = root.dataset.appSection || '';
  const q = (selector) => root.querySelector(selector);
  const api = async (url, options = {}) => {
    const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { Accept: 'application/json', ...(options.headers || {}) } });
    const type = response.headers.get('content-type') || '';
    const payload = type.includes('application/json') ? await response.json() : { message: await response.text() };
    if (!response.ok) throw new Error(payload.error || payload.message || `Request failed (${response.status})`);
    return payload;
  };
  const announce = (message) => {
    let live = q('[data-app-live]');
    if (!live) { live = document.createElement('div'); live.className = 'k-sr-only'; live.dataset.appLive = ''; live.setAttribute('aria-live', 'polite'); root.appendChild(live); }
    live.textContent = message;
  };
  const humanize = (value) => String(value || 'Not available').replaceAll('_', ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  const card = () => root.querySelector('.k-app-main .k-app-card');
  const action = (label, handler, secondary = false) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = secondary ? 'k-app-card-action' : 'k-app-primary'; button.textContent = label;
    button.addEventListener('click', handler); return button;
  };
  const field = (labelText, type, name, value = '', placeholder = '') => {
    const label = document.createElement('label'); label.className = 'k-form'; label.style.gap = '6px'; label.style.marginBottom = '10px';
    const caption = document.createElement('span'); caption.textContent = labelText;
    const input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
    if (type !== 'textarea') input.type = type;
    input.name = name; input.value = value || ''; input.placeholder = placeholder; input.autocomplete = 'off';
    label.append(caption, input); return { label, input };
  };

  async function loadSafety() {
    const host = card(); if (!host) return;
    host.innerHTML = '<span class="k-app-card-label">Safety</span><h2>Safety plans stay explicit and owner-controlled.</h2><p class="k-muted">Loading trusted contacts and active check-ins…</p>';
    const shell = document.createElement('div'); shell.className = 'k-grid k-grid--2'; shell.style.marginTop = '18px';
    const contactsCard = document.createElement('section'); contactsCard.className = 'k-app-card';
    const checkinsCard = document.createElement('section'); checkinsCard.className = 'k-app-card';
    contactsCard.innerHTML = '<span class="k-app-card-label">Trusted contacts</span><h3>Contacts</h3><div data-safety-contacts>Loading…</div>';
    checkinsCard.innerHTML = '<span class="k-app-card-label">Check-ins</span><h3>Active safety instructions</h3><div data-safety-checkins>Loading…</div>';
    shell.append(contactsCard, checkinsCard); host.replaceChildren(host.querySelector('.k-app-card-label') || document.createElement('span'), shell);
    const originalLabel = host.querySelector('span.k-app-card-label'); if (originalLabel) originalLabel.textContent = 'Safety';

    const contactList = contactsCard.querySelector('[data-safety-contacts]');
    const checkinList = checkinsCard.querySelector('[data-safety-checkins]');

    try {
      const [contactsPayload, checkinsPayload] = await Promise.all([api('/api/safety/contacts'), api('/api/safety/check-ins')]);
      const contacts = Array.isArray(contactsPayload.contacts) ? contactsPayload.contacts : [];
      const checkins = Array.isArray(checkinsPayload.checkIns) ? checkinsPayload.checkIns : [];
      contactList.replaceChildren(); checkinList.replaceChildren();
      if (!contacts.length) {
        const empty = document.createElement('p'); empty.className = 'k-muted'; empty.textContent = 'No trusted contacts yet.'; contactList.appendChild(empty);
      }
      contacts.forEach((contact) => {
        const row = document.createElement('article'); row.className = 'k-surface'; row.style.padding = '14px'; row.style.marginBottom = '10px';
        const title = document.createElement('strong'); title.textContent = contact.name;
        const meta = document.createElement('p'); meta.className = 'k-muted'; meta.textContent = `${contact.phone}${contact.relationship ? ` · ${contact.relationship}` : ''} · ${humanize(contact.status)}`;
        row.append(title, meta);
        const actions = document.createElement('div'); actions.className = 'k-action-row'; actions.style.marginTop = '8px';
        if (contact.status === 'pending') {
          actions.appendChild(action('Activate with my consent', async () => {
            const button = actions.querySelector('button'); if (button) button.disabled = true;
            try { await api(`/api/safety/contacts/${encodeURIComponent(contact.id)}/activate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consentConfirmed: true }) }); announce('Safety contact activated. No notification was sent to the contact.'); await loadSafety(); }
            catch (error) { if (button) button.disabled = false; announce(error.message); }
          }));
        }
        actions.appendChild(action('Revoke', async (event) => {
          event.currentTarget.disabled = true;
          try { await api(`/api/safety/contacts/${encodeURIComponent(contact.id)}/revoke`, { method: 'POST' }); announce('Safety contact revoked.'); await loadSafety(); }
          catch (error) { event.currentTarget.disabled = false; announce(error.message); }
        }, true));
        row.appendChild(actions); contactList.appendChild(row);
      });

      const activeContacts = contacts.filter((c) => c.status === 'active');
      if (activeContacts.length) {
        const start = document.createElement('form'); start.className = 'k-form'; start.style.marginTop = '14px';
        const contactField = document.createElement('label'); contactField.textContent = 'Trusted contact';
        const select = document.createElement('select'); select.name = 'contactId'; activeContacts.forEach((contact) => { const option = document.createElement('option'); option.value = contact.id; option.textContent = `${contact.name} · ${contact.phone}`; select.appendChild(option); }); contactField.appendChild(select);
        const duration = field('Duration (minutes)', 'number', 'durationMinutes', '60');
        const note = field('Route note (optional)', 'textarea', 'routeNote', '', 'Where you are going / what you want remembered');
        const submit = action('Start check-in', null); submit.type = 'submit';
        start.append(contactField, duration.label, note.label, submit);
        start.addEventListener('submit', async (event) => {
          event.preventDefault(); submit.disabled = true;
          try { await api('/api/safety/check-ins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactId: select.value, durationMinutes: Number(duration.input.value), routeNote: note.input.value }) }); announce('Safety check-in started.'); start.reset(); await loadSafety(); }
          catch (error) { submit.disabled = false; announce(error.message); }
        });
        checkinList.appendChild(start);
      }

      const active = checkins.filter((item) => item.status === 'active');
      if (!active.length) {
        const empty = document.createElement('p'); empty.className = 'k-muted'; empty.textContent = 'No active check-ins.'; checkinList.appendChild(empty);
      }
      checkins.slice(0, 8).forEach((item) => {
        const row = document.createElement('article'); row.className = 'k-surface'; row.style.padding = '14px'; row.style.marginTop = '10px';
        const title = document.createElement('strong'); title.textContent = `${humanize(item.status)} · expires ${new Date(item.expires_at).toLocaleString()}`;
        const meta = document.createElement('p'); meta.className = 'k-muted'; meta.textContent = item.route_note || 'No route note.';
        row.append(title, meta);
        if (item.status === 'active') row.appendChild(action('Complete check-in', async (event) => { event.currentTarget.disabled = true; try { await api(`/api/safety/check-ins/${encodeURIComponent(item.id)}/complete`, { method: 'POST' }); announce('Check-in completed.'); await loadSafety(); } catch (error) { event.currentTarget.disabled = false; announce(error.message); } }, true));
        checkinList.appendChild(row);
      });
      const note = document.createElement('p'); note.className = 'k-muted'; note.style.marginTop = '14px'; note.textContent = 'Kurukoo does not claim emergency-service delivery. An expired check-in becomes escalation_pending until an authorised delivery transport provides evidence.'; host.appendChild(note);

      const add = action('Add trusted contact', async () => {
        const name = window.prompt('Contact name'); if (!name) return;
        const phone = window.prompt('Contact phone number'); if (!phone) return;
        const relationship = window.prompt('Relationship (optional)') || '';
        add.disabled = true;
        try { await api('/api/safety/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, phone, relationship, activate: false }) }); announce('Pending safety contact added. Activation requires explicit consent.'); await loadSafety(); }
        catch (error) { add.disabled = false; announce(error.message); }
      }, true);
      contactsCard.appendChild(add);
    } catch (error) {
      host.innerHTML = '<span class="k-app-card-label">Safety</span><h2>Safety state unavailable</h2>';
      const p = document.createElement('p'); p.className = 'k-muted'; p.textContent = error.message || 'Safety services are unavailable right now.'; host.appendChild(p);
    }
  }

  async function loadMemory() {
    const host = card(); if (!host) return;
    host.innerHTML = '<span class="k-app-card-label">Memory Profile</span><h2>Your memory stays owner-scoped.</h2><p class="k-muted">Loading your profile and saved context…</p>';
    try {
      const payload = await api('/api/profile');
      const profile = payload.profile || {}; const skills = Array.isArray(payload.skills) ? payload.skills : [];
      host.innerHTML = '<span class="k-app-card-label">Memory Profile</span><h2>Your memory stays owner-scoped.</h2>';
      const grid = document.createElement('div'); grid.className = 'k-grid k-grid--2'; grid.style.marginTop = '16px';
      const summary = document.createElement('section'); summary.className = 'k-app-card';
      summary.innerHTML = `<strong>${profile.name || 'Your profile'}</strong><p class="k-muted">${profile.location || 'Location not set'}${profile.country ? ` · ${profile.country}` : ''}</p><p class="k-muted">Availability: ${profile.is_available ? 'Available' : 'Not available'}</p>`;
      const controls = document.createElement('section'); controls.className = 'k-app-card';
      const form = document.createElement('form'); form.className = 'k-form';
      const name = field('Name', 'text', 'name', profile.name || ''); const location = field('Location', 'text', 'location', profile.location || ''); const country = field('Country', 'text', 'country', profile.country || '');
      const availability = document.createElement('label'); availability.style.display = 'flex'; availability.style.alignItems = 'center'; availability.style.gap = '8px'; const check = document.createElement('input'); check.type = 'checkbox'; check.name = 'is_available'; check.checked = Boolean(profile.is_available); check.style.width = '18px'; check.style.height = '18px'; availability.append(check, document.createTextNode('Available for relevant opportunities'));
      const save = action('Save profile', null); save.type = 'submit'; form.append(name.label, location.label, country.label, availability, save);
      form.addEventListener('submit', async (event) => { event.preventDefault(); save.disabled = true; try { await api('/api/profile/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.input.value, location: location.input.value, country: country.input.value, is_available: check.checked }) }); announce('Memory profile updated.'); await loadMemory(); } catch (error) { save.disabled = false; announce(error.message); } });
      controls.append(form);
      grid.append(summary, controls); host.appendChild(grid);
      const skillsCard = document.createElement('section'); skillsCard.className = 'k-app-card'; skillsCard.style.marginTop = '14px'; skillsCard.innerHTML = '<span class="k-app-card-label">Skills</span><h3>Your declared skills</h3>';
      if (skills.length) { const list = document.createElement('div'); list.className = 'k-action-row'; skills.forEach((skill) => { const item = document.createElement('span'); item.className = 'k-status'; item.textContent = `${skill.skill || skill.name || 'Skill'}${skill.is_available ? ' · available' : ''}`; list.appendChild(item); }); skillsCard.appendChild(list); } else { const p = document.createElement('p'); p.className = 'k-muted'; p.textContent = 'No skills declared yet.'; skillsCard.appendChild(p); }
      const dataActions = document.createElement('div'); dataActions.className = 'k-action-row'; dataActions.style.marginTop = '14px';
      dataActions.appendChild(action('Export my data', async (event) => { event.currentTarget.disabled = true; try { const exportData = await api('/api/profile/export'); const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'kurukoo-profile-export.json'; a.click(); URL.revokeObjectURL(url); announce('Profile export prepared.'); } catch (error) { announce(error.message); } finally { event.currentTarget.disabled = false; } }, true));
      dataActions.appendChild(action('Request account deletion', async (event) => { if (!window.confirm('Delete your Kurukoo data? This cannot be undone.')) return; event.currentTarget.disabled = true; try { await api('/api/profile/delete', { method: 'DELETE' }); announce('Account data deletion completed.'); window.location.assign('/login'); } catch (error) { event.currentTarget.disabled = false; announce(error.message); } }, true));
      skillsCard.appendChild(dataActions); host.appendChild(skillsCard);
    } catch (error) {
      host.innerHTML = '<span class="k-app-card-label">Memory Profile</span><h2>Memory unavailable</h2>'; const p = document.createElement('p'); p.className = 'k-muted'; p.textContent = error.message || 'Your profile could not be loaded right now.'; host.appendChild(p);
    }
  }

  const start = () => { if (section === 'safety') loadSafety(); if (section === 'memory') loadMemory(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
