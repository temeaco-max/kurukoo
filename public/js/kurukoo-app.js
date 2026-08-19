/* Kurukoo canonical app interaction layer. It never invents server state: every view is driven by explicit API responses. */
(function () {
  'use strict';
  const root = document.querySelector('[data-kurukoo-app]');
  if (!root) return;

  const state = { busy: new Set() };
  const jsonHeaders = { Accept: 'application/json', 'Content-Type': 'application/json' };

  function setBusy(key, busy) {
    const nodes = root.querySelectorAll('[data-action="' + key + '"]');
    nodes.forEach((node) => {
      node.disabled = busy;
      node.setAttribute('aria-busy', busy ? 'true' : 'false');
    });
    busy ? state.busy.add(key) : state.busy.delete(key);
  }

  function announce(message, tone) {
    let live = root.querySelector('[data-app-live]');
    if (!live) {
      live = document.createElement('div');
      live.dataset.appLive = '';
      live.className = 'k-sr-only';
      live.setAttribute('aria-live', 'polite');
      root.appendChild(live);
    }
    live.textContent = message;
    if (tone) root.dataset.appNoticeTone = tone;
  }

  async function request(url, options) {
    const response = await fetch(url, Object.assign({ credentials: 'same-origin', headers: jsonHeaders }, options || {}));
    const type = response.headers.get('content-type') || '';
    const payload = type.includes('application/json') ? await response.json() : { message: await response.text() };
    if (!response.ok) {
      const error = new Error(payload.message || payload.error || 'Kurukoo could not complete that action.');
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  function bindAction(key, handler) {
    root.querySelectorAll('[data-action="' + key + '"]').forEach((node) => {
      node.addEventListener('click', async () => {
        if (state.busy.has(key)) return;
        setBusy(key, true);
        try {
          await handler(node);
        } catch (error) {
          announce(error.message || 'That action could not be completed.', 'error');
        } finally {
          setBusy(key, false);
        }
      });
    });
  }

  bindAction('refresh', async (node) => {
    const target = node.dataset.refreshTarget || window.location.href;
    window.location.assign(target);
  });

  bindAction('open-chat', async (node) => {
    const prompt = node.dataset.prompt;
    const url = prompt ? '/chat?prompt=' + encodeURIComponent(prompt) : '/chat';
    window.location.assign(url);
  });

  bindAction('accept-task', async (node) => {
    const id = node.dataset.taskId;
    if (!id) throw new Error('This task is missing its identifier.');
    const result = await request('/api/tasks/' + encodeURIComponent(id) + '/accept', { method: 'POST', body: '{}' });
    announce(result.message || 'Task accepted.');
    window.location.reload();
  });

  bindAction('complete-task', async (node) => {
    const id = node.dataset.taskId;
    if (!id) throw new Error('This task is missing its identifier.');
    const result = await request('/api/tasks/' + encodeURIComponent(id) + '/complete', { method: 'POST', body: '{}' });
    announce(result.message || 'Task completed.');
    window.location.reload();
  });

  bindAction('mark-notification-read', async (node) => {
    const id = node.dataset.notificationId;
    if (!id) throw new Error('This notification is missing its identifier.');
    await request('/api/notifications/' + encodeURIComponent(id) + '/read', { method: 'POST', body: '{}' });
    node.closest('[data-notification]')?.classList.add('is-read');
    announce('Notification marked as read.');
  });

  bindAction('save', async (node) => {
    const id = node.dataset.savedId;
    if (!id) throw new Error('This item is missing its identifier.');
    const result = await request('/api/saved/' + encodeURIComponent(id), { method: 'POST', body: JSON.stringify({}) });
    announce(result.message || 'Saved.');
    node.classList.add('is-active');
  });

  bindAction('dismiss', async (node) => {
    const id = node.dataset.itemId;
    const url = node.dataset.dismissUrl;
    if (!url) throw new Error('This action is not configured.');
    const result = await request(url.replace(':id', encodeURIComponent(id || '')), { method: 'POST', body: '{}' });
    announce(result.message || 'Updated.');
    node.closest('[data-action-item]')?.remove();
  });

  root.querySelectorAll('[data-confirm-action]').forEach((node) => {
    node.addEventListener('click', (event) => {
      const message = node.dataset.confirmAction;
      if (message && !window.confirm(message)) event.preventDefault();
    });
  });

  root.querySelectorAll('[data-copy-value]').forEach((node) => {
    node.addEventListener('click', async () => {
      const value = node.dataset.copyValue || '';
      if (!value || !navigator.clipboard) return announce('Copy is not available in this browser.', 'error');
      await navigator.clipboard.writeText(value);
      announce('Copied.');
    });
  });
})();
