(() => {
  if (document.body?.dataset.workspaceSection !== 'connect') return;
  const container = document.querySelector('[data-connect-people-root]') || document.querySelector('.k-app-container');
  if (!container) return;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const path = (value) => encodeURIComponent(String(value || ''));
  const api = async (url, options = {}) => {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) throw new Error(payload?.error || `Request failed (${response.status})`);
    return payload;
  };
  const followState = async (personPhone) => {
    try { const result = await api(`/api/relationships/person/${path(personPhone)}?relationshipType=follow`); return result.relationship?.status === 'active'; }
    catch { return false; }
  };
  const follow = async (personPhone, active) => {
    if (active) return api(`/api/relationships/person/${path(personPhone)}?relationshipType=follow`, { method: 'DELETE' });
    return api('/api/relationships', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetType: 'person', targetId: personPhone, relationshipType: 'follow', visibility: 'private' }) });
  };
  const communicationAction = (person) => {
    const message = person.communication?.message ? `<a class="workspace-text-action" href="/chat?prompt=${path(`Message ${person.displayName}`)}" aria-label="Message ${esc(person.displayName)}">Message</a>` : '';
    const call = person.communication?.call ? `<a class="workspace-text-action" href="/call" aria-label="Open Call for ${esc(person.displayName)}">Call</a>` : '';
    const unavailable = !person.communication?.call ? '<span class="k57-contact-meta">Call is unavailable right now.</span>' : '';
    return `${message}${call}${unavailable}`;
  };
  const render = (contacts) => {
    const section = document.createElement('section'); section.className = 'k57-contacts'; section.setAttribute('aria-labelledby', 'k57-contacts-title');
    section.innerHTML = `<div class="k-app-card"><span class="k-app-card-label">People & relationships</span><h2 id="k57-contacts-title">Your contacts</h2><p>Keep the people you know in one place. Messaging and calling are available when the related service is ready.</p><form class="k57-contact-add" data-k57-add><label>Contact phone or identity<input name="personPhone" autocomplete="tel" inputmode="tel" required placeholder="Enter a known Kurukoo contact"></label><button class="k-app-primary" type="submit">Add contact</button></form><div class="k57-contact-state" data-k57-add-state></div></div><section class="k-app-card"><div class="k57-contact-grid" data-k57-list></div><div class="k57-unavailable" data-k57-empty hidden><div><h3>No contacts yet</h3><p>Add a known Kurukoo contact. People are only shown when you add or connect them.</p></div></div></section></section>`;
    const list = section.querySelector('[data-k57-list]');
    contacts.forEach(async (person) => {
      const activeFollow = await followState(person.identityId);
      const card = document.createElement('article'); card.className = 'k57-contact-card';
      const avatar = person.avatar || { initials: '?' };
      card.innerHTML = `<div class="k57-contact-head"><div class="k57-avatar" aria-hidden="true">${esc(avatar.initials)}</div><div><h3>${esc(person.displayName)}</h3><div class="k57-contact-meta"><span>${esc(String(person.participantKind || 'human'))}</span><span>${esc(String(person.presence || 'unknown'))}</span>${person.provider ? `<span>${person.provider.verified ? 'Verified provider' : 'Provider'}${person.provider.available ? ' · available' : ''}</span>` : ''}</div></div></div><div class="k57-contact-meta"><span>Relationship: ${esc(person.relationship?.status || 'none')}</span>${person.relationship?.safetyContact ? '<span>Safety contact</span>' : ''}</div><div class="k57-contact-actions">${communicationAction(person)}<button class="workspace-text-action" type="button" data-k57-follow>${activeFollow ? 'Unfollow' : 'Follow'}</button><button class="workspace-text-action" type="button" data-k57-remove>Remove contact</button></div>`;
      const followButton = card.querySelector('[data-k57-follow]');
      followButton.addEventListener('click', async () => { followButton.disabled = true; try { await follow(person.identityId, activeFollow); await load(); } catch (error) { followButton.disabled = false; followButton.textContent = error instanceof Error ? error.message : 'Could not update'; } });
      card.querySelector('[data-k57-remove]').addEventListener('click', async (event) => { const button = event.currentTarget; button.disabled = true; try { await api(`/api/contacts/${path(person.identityId)}`, { method: 'DELETE' }); await load(); } catch { button.disabled = false; button.textContent = 'Could not remove'; } });
      list.appendChild(card);
    });
    section.querySelector('[data-k57-add]').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; const phone = form.elements.personPhone.value.trim(); const state = section.querySelector('[data-k57-add-state]'); const button = form.querySelector('button'); button.disabled = true; state.textContent = 'Checking contact…'; try { await api('/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ personPhone: phone }) }); form.reset(); state.textContent = 'Contact added.'; await load(); } catch (error) { state.textContent = error instanceof Error ? error.message : 'Unable to add contact'; } finally { button.disabled = false; } });
    return section;
  };
  const loading = () => { const section = document.createElement('section'); section.className = 'k57-contacts'; section.innerHTML = '<section class="k-app-card" aria-live="polite" aria-busy="true"><div class="k-app-list-loading">Loading your contacts…</div></section>'; return section; };
  const load = async () => {
    const prior = container.querySelector('.k57-contacts'); prior?.remove();
    const place = loading(); container.appendChild(place);
    try { const payload = await api('/api/contacts'); const contacts = Array.isArray(payload.contacts) ? payload.contacts : []; const section = render(contacts); place.replaceWith(section); section.querySelector('[data-k57-empty]').hidden = contacts.length > 0; }
    catch { const failed = loading(); failed.innerHTML = '<section class="k-app-card k57-unavailable" role="alert"><div><h3>Contacts are unavailable</h3><p>Kurukoo could not load your contacts. No relationship or communication status is shown until it can be confirmed.</p><button class="k-app-primary" type="button" data-k57-retry>Retry Contacts</button></div></section>'; container.appendChild(failed); failed.querySelector('[data-k57-retry]').addEventListener('click', load); }
  };
  load();
})();
