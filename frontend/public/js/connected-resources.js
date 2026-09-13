(() => {
  const ensureStyles = () => {
    if (document.getElementById('connected-resource-style')) return;
    const link = document.createElement('link');
    link.id = 'connected-resource-style';
    link.rel = 'stylesheet';
    link.href = '/css/connected-resources.css?v=2';
    document.head.appendChild(link);
  };
  ensureStyles();

  const isConnectSurface = () => document.querySelector('.workspace-surface[data-surface-view="connect"]');

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderMedia(container, media) {
    container.replaceChildren();
    if (!Array.isArray(media) || !media.length) {
      container.appendChild(make('p', 'empty-state', 'No live view is currently exposed by this connected resource.'));
      return;
    }
    for (const item of media) {
      const kind = String(item?.kind || '');
      const url = String(item?.url || '');
      if (!url) continue;
      if (kind === 'stream' || kind === 'video') {
        const video = document.createElement('video');
        video.controls = true; video.playsInline = true; video.preload = 'metadata'; video.src = url; video.setAttribute('aria-label', 'Connected live view');
        container.appendChild(video);
      } else {
        const image = document.createElement('img'); image.src = url; image.alt = 'Connected device view'; image.loading = 'lazy'; container.appendChild(image);
      }
    }
  }

  async function loadView(card, id) {
    const area = card.querySelector('[data-connected-view]'); if (!area) return;
    area.replaceChildren(make('p', 'empty-state', 'Loading view…'));
    try {
      const response = await fetch(`/api/connect/resources/${encodeURIComponent(id)}/view`, { credentials: 'same-origin' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || 'View unavailable');
      renderMedia(area, data.media);
    } catch (error) { area.replaceChildren(make('p', 'empty-state', String(error?.message || 'Unable to open view.'))); }
  }

  async function control(card, id, command) {
    if (!window.confirm(`Allow Kurukoo to send “${command}” to this connected device?`)) return;
    const status = card.querySelector('[data-connected-status]'); if (status) status.textContent = `Sending ${command}…`;
    try {
      const response = await fetch(`/api/connect/resources/${encodeURIComponent(id)}/control`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command, confirmationGranted: true }) });
      const data = await response.json().catch(() => ({}));
      if (status) status.textContent = data.message || data.reason || data.state || (data.success ? 'Command accepted.' : 'Command not executed.');
    } catch (error) { if (status) status.textContent = String(error?.message || 'Unable to send command.'); }
  }

  async function hydrateAssistantConnectedView(message) {
    if (!message || message.dataset.connectedMediaLoaded === '1') return;
    const id = String(message.dataset.canonicalObjectId || ''); if (!id.startsWith('conn_')) return;
    message.dataset.connectedMediaLoaded = '1';
    const bubble = message.querySelector('.bubble'); if (!bubble) return;
    try {
      const response = await fetch(`/api/connect/resources/${encodeURIComponent(id)}/view`, { credentials: 'same-origin' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !Array.isArray(data.media) || !data.media.length) return;
      const holder = make('div', 'connected-resource-chat-media'); renderMedia(holder, data.media);
      holder.appendChild(make('p', 'workspace-note', 'View shown from the connected resource. Physical status is represented only by the authorised adapter response.'));
      bubble.appendChild(holder);
    } catch { /* preserve the canonical response if the view adapter is unavailable */ }
  }

  function renderResource(resource) {
    const card = make('article', 'workspace-panel connected-resource-card');
    const heading = make('div', 'panel-heading'); const title = make('div');
    title.append(make('span', 'workspace-eyebrow', resource.kind || 'Connected resource'), make('h2', '', resource.label || 'Connected device'));
    heading.append(title, make('span', 'status-pill', resource.status === 'active' ? 'Connected' : 'Setup required')); card.appendChild(heading);
    if (resource.vendor) card.appendChild(make('p', 'workspace-note', `${resource.vendor} · ${resource.protocol || 'connected'}`));
    const capabilities = Array.isArray(resource.capabilities) ? resource.capabilities : [];
    if (capabilities.length) card.appendChild(make('p', 'workspace-note', `Capabilities: ${capabilities.join(', ')}`));
    const actions = make('div', 'workspace-actions');
    if (resource.viewUrl || resource.streamUrl) { const view = make('button', 'workspace-button secondary', 'View'); view.type = 'button'; view.addEventListener('click', () => loadView(card, resource.id)); actions.appendChild(view); }
    for (const command of capabilities.filter(item => item && !['control', 'view', 'stream', 'inspect'].includes(String(item))).slice(0, 8)) { const button = make('button', 'workspace-button secondary', String(command)); button.type = 'button'; button.addEventListener('click', () => control(card, resource.id, String(command))); actions.appendChild(button); }
    card.appendChild(actions);
    card.appendChild(make('p', 'workspace-note connected-resource-note', 'Commands remain owner-scoped and pass through Kurukoo’s canonical action boundary. External device delivery is only claimed when the connected adapter provides evidence.'));
    const viewHolder = make('div', 'connected-resource-view'); viewHolder.dataset.connectedView = '1'; card.appendChild(viewHolder);
    const status = make('p', 'workspace-note', 'Ready'); status.dataset.connectedStatus = '1'; card.appendChild(status);
    return card;
  }

  async function renderConnectSurface() {
    const surface = isConnectSurface(); if (!surface) return;
    const body = surface.querySelector('.surface-body'); if (!body || body.dataset.connectedResourcesLoaded === '1') return;
    body.dataset.connectedResourcesLoaded = '1';
    try {
      const response = await fetch('/api/connect/resources', { credentials: 'same-origin' });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) { body.replaceChildren(make('p', 'empty-state', 'Sign in to connect devices and access their views and controls in Chat.')); return; }
      if (!response.ok || !data.success) throw new Error(data.error || 'Connected resources unavailable');
      const resources = Array.isArray(data.resources) ? data.resources : [];
      const intro = make('section', 'workspace-panel'); const heading = make('div', 'panel-heading'); heading.append(make('div', undefined, 'Connected to Kurukoo'));
      intro.append(heading, make('p', 'workspace-note', 'Anything you connect to Kurukoo can expose its authorised capabilities to the same conversation, subject to its permissions and adapter.'));
      body.replaceChildren(intro);
      if (!resources.length) { body.append(make('section', 'workspace-panel', 'No connected resources yet.'), make('p', 'empty-state', 'Connect a device, camera, channel or other authorised resource, then ask Kurukoo to view or control what it exposes.')); return; }
      for (const resource of resources) body.appendChild(renderResource(resource));
    } catch (error) { body.replaceChildren(make('p', 'empty-state', String(error?.message || 'Connected resources unavailable.'))); }
  }

  function renderAssistantViews() { document.querySelectorAll('.message.assistant[data-canonical-object-id^="conn_"]').forEach(hydrateAssistantConnectedView); }
  let scheduled = false;
  function schedule() { if (scheduled) return; scheduled = true; setTimeout(() => { scheduled = false; void renderConnectSurface(); renderAssistantViews(); }, 60); }

  document.addEventListener('click', event => { const target = event.target instanceof Element ? event.target.closest('[data-surface-view="connect"]') : null; if (target) schedule(); });
  const observer = new MutationObserver(schedule); observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('load', schedule, { once: true });
})();
