(() => {
  if (document.body?.dataset.workspaceSection !== 'memory') return;
  const container = document.querySelector('[data-memory-root]') || document.querySelector('.k-app-container');
  if (!container) return;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const api = async (url, options = {}) => {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) throw new Error(payload?.error || `Request failed (${response.status})`);
    return payload;
  };
  const path = (value) => encodeURIComponent(String(value || ''));
  const profileHref = '/chat?prompt=Review%20my%20memory%20profile';
  const formatDate = (value) => {
    if (!value) return 'Observed time unavailable';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Observed time unavailable' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };
  const humanize = (value) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const stateShell = (message, role = '') => `<section class="k57-memory"><div class="k-app-card k57-unavailable" ${role ? `role="${role}"` : ''}><div><h3>${esc(message)}</h3><p>Your memory is unavailable right now. Kurukoo does not show a saved detail until it can be confirmed.</p></div></div></section>`;
  const render = (profile, facts, brief) => {
    const safeBrief = brief && typeof brief === 'object' ? brief : {};
    const quiet = safeBrief.quiet_hours && typeof safeBrief.quiet_hours === 'object' ? safeBrief.quiet_hours : {};
    const section = document.createElement('section'); section.className = 'k57-memory'; section.setAttribute('aria-labelledby', 'k57-memory-title');
    section.innerHTML = `<div class="k-app-card"><span class="k-app-card-label">Memory Profile</span><h2 id="k57-memory-title">What Kurukoo remembers about you</h2><p>These details are yours to review and edit where supported. Sensitive information is not shown simply because it exists in storage.</p><div class="k57-memory-actions"><a class="k-app-primary" href="${profileHref}">Continue in Chat</a></div></div><div class="k57-memory-grid"><section class="k57-memory-card"><h3>Profile</h3><form class="k57-memory-form" data-k57-profile-form><label>Name<input name="name" value="${esc(profile?.name || '')}" autocomplete="name"></label><label>Location<input name="location" value="${esc(profile?.location || '')}" autocomplete="address-level2"></label><label>Country<input name="country" value="${esc(profile?.country || '')}" autocomplete="country-name"></label><div class="k57-memory-actions"><button class="k-app-primary k57-memory-action" type="submit">Save profile</button></div><div class="k57-memory-notice" data-k57-profile-state></div></form></section><section class="k57-memory-card"><h3>Communication preferences</h3><form class="k57-memory-form" data-k57-brief-form><label>Voice enabled<select name="voice_enabled"><option value="false" ${safeBrief.voice_enabled === false ? 'selected' : ''}>Off</option><option value="true" ${safeBrief.voice_enabled === true ? 'selected' : ''}>On</option></select></label><label>Brief style<select name="style"><option value="concise" ${safeBrief.style !== 'detailed' ? 'selected' : ''}>Concise</option><option value="detailed" ${safeBrief.style === 'detailed' ? 'selected' : ''}>Detailed</option></select></label><label>Interruption sensitivity<select name="interruption_sensitivity"><option value="minimal" ${safeBrief.interruption_sensitivity === 'minimal' ? 'selected' : ''}>Minimal</option><option value="standard" ${!['minimal','interruptive'].includes(safeBrief.interruption_sensitivity) ? 'selected' : ''}>Standard</option><option value="interruptive" ${safeBrief.interruption_sensitivity === 'interruptive' ? 'selected' : ''}>Interruptive</option></select></label><label>Critical interruptions<select name="allow_critical_interruption"><option value="false" ${safeBrief.allow_critical_interruption === false ? 'selected' : ''}>Off</option><option value="true" ${safeBrief.allow_critical_interruption === true ? 'selected' : ''}>On</option></select></label><label>Quiet hours start<input type="time" name="quiet_start" value="${esc(quiet.start || '')}"></label><label>Quiet hours end<input type="time" name="quiet_end" value="${esc(quiet.end || '')}"></label><div class="k57-memory-actions"><button class="k-app-primary k57-memory-action" type="submit">Save preferences</button></div><div class="k57-memory-notice" data-k57-brief-state></div></form></section></div><section class="k57-memory-card"><h3>Remembered details</h3><p class="k57-memory-notice">Details are shown only while current. Their source and confidence help Kurukoo keep them accurate.</p><div data-k57-facts>${facts.length ? facts.map((fact) => `<div class="k57-memory-row"><div><strong>${esc(humanize(fact.field))}</strong><div>${esc(fact.value)}</div><div class="k57-memory-meta">${esc(humanize(fact.provenance))} · ${fact.confidence == null ? 'confidence not supplied' : `confidence ${Math.round(Number(fact.confidence) * 100)}%`} · observed ${esc(formatDate(fact.observedAt))}</div></div><button class="workspace-text-action k57-memory-action" type="button" data-k57-revoke="${esc(fact.id)}">Remove fact</button></div>`).join('') : '<div class="k57-memory-notice">No remembered details are currently available.</div>'}</div></section>`;
    section.querySelector('[data-k57-profile-form]').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; const state = section.querySelector('[data-k57-profile-state]'); const button = form.querySelector('button'); button.disabled = true; state.textContent = 'Saving profile…'; try { await api('/api/profile/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.elements.name.value.trim(), location: form.elements.location.value.trim(), country: form.elements.country.value.trim() }) }); state.textContent = 'Profile saved.'; } catch (error) { state.textContent = error instanceof Error ? error.message : 'Profile update failed'; } finally { button.disabled = false; } });
    section.querySelector('[data-k57-brief-form]').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; const state = section.querySelector('[data-k57-brief-state]'); const button = form.querySelector('button'); const payload = { proactive_brief: { voice_enabled: form.elements.voice_enabled.value === 'true', style: form.elements.style.value, interruption_sensitivity: form.elements.interruption_sensitivity.value, allow_critical_interruption: form.elements.allow_critical_interruption.value === 'true' } }; if (form.elements.quiet_start.value && form.elements.quiet_end.value) payload.proactive_brief.quiet_hours = { start: form.elements.quiet_start.value, end: form.elements.quiet_end.value }; button.disabled = true; state.textContent = 'Saving preferences…'; try { await api('/api/profile/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); state.textContent = 'Preferences saved.'; } catch (error) { state.textContent = error instanceof Error ? error.message : 'Brief preference update failed'; } finally { button.disabled = false; } });
    section.querySelectorAll('[data-k57-revoke]').forEach((button) => button.addEventListener('click', async () => { button.disabled = true; try { await api(`/api/chat/economic-requests/memory/facts/${path(button.dataset.k57Revoke)}`, { method: 'DELETE' }); await load(); } catch (error) { button.disabled = false; button.textContent = error instanceof Error ? error.message : 'Could not remove'; } }));
    return section;
  };
  const load = async () => {
    container.innerHTML = stateShell('Loading your memory…');
    try {
      const [profilePayload, factsPayload] = await Promise.all([api('/api/memory/profile'), api('/api/chat/economic-requests/memory/facts')]);
      const profile = profilePayload.profile || null;
      const brief = profilePayload.proactiveBrief || {};
      const facts = Array.isArray(factsPayload.facts) ? factsPayload.facts : [];
      container.innerHTML = '';
      container.appendChild(render(profile, facts, brief));
    } catch { container.innerHTML = stateShell('Memory is unavailable', 'alert'); }
  };
  load();
})();
