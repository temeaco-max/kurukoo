(() => {
  const APP_START = '/chat/';
  const PENDING_KEY = 'kurukoo_pwa_pending_messages_v1';
  let deferredInstallPrompt = null;

  function loadStylesheet(href) {
    if (document.querySelector(`link[data-kurukoo-visual="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.kurukooVisual = href;
    document.head.appendChild(link);
  }

  function ensureClientVisualAuthority() {
    if (!isAppSurface()) return;
    loadStylesheet('/css/kurukoo-platform-state-visual.css?v=1');
    if (window.location.pathname === '/chat' || window.location.pathname === '/chat/') {
      loadStylesheet('/css/kurukoo-chat-visual-completion.css?v=4');
    }
  }

  function setPwaState(state) {
    document.documentElement.dataset.pwaState = state;
    document.documentElement.dataset.pwaOnline = navigator.onLine ? 'true' : 'false';
  }

  setPwaState('loading');

  function isAppSurface() {
    return window.location.pathname === '/chat/' || window.location.pathname === '/chat' || window.location.pathname.startsWith('/dashboard');
  }

  ensureClientVisualAuthority();

  function ensureStatusRegion() {
    if (!isAppSurface() || document.querySelector('[data-pwa-status]')) return null;
    const region = document.createElement('div');
    region.className = 'pwa-status-region';
    region.dataset.pwaStatus = 'true';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
    return region;
  }

  let statusTimer = null;

  function showNotice(message, { tone = 'neutral', actionLabel, action, timeout = 0 } = {}) {
    const region = ensureStatusRegion();
    if (!region) return;
    if (statusTimer) window.clearTimeout(statusTimer);
    region.replaceChildren();
    region.dataset.tone = tone;
    const copy = document.createElement('span');
    copy.className = 'pwa-status-copy';
    copy.textContent = message;
    region.appendChild(copy);
    if (actionLabel && action) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'k-btn k-btn-secondary pwa-status-action';
      button.textContent = actionLabel;
      button.addEventListener('click', action, { once: true });
      region.appendChild(button);
    }
    if (timeout > 0) {
      statusTimer = window.setTimeout(() => {
        region.replaceChildren();
        region.removeAttribute('data-tone');
      }, timeout);
    }
  }

  function showAction(label, action) {
    showNotice('A new Kurukoo version is ready.', { tone: 'update', actionLabel: label, action });
  }

  function readPendingMessages() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.text === 'string').slice(-10) : [];
    } catch {
      return [];
    }
  }

  function writePendingMessages(items) {
    try {
      if (items.length) localStorage.setItem(PENDING_KEY, JSON.stringify(items.slice(-10)));
      else localStorage.removeItem(PENDING_KEY);
    } catch {}
  }

  function queuePendingMessage(text) {
    const value = String(text || '').trim().slice(0, 12000);
    if (!value) return false;
    const existing = readPendingMessages();
    const last = existing[existing.length - 1];
    if (last?.text === value) return true;
    existing.push({ id: `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, text: value, createdAt: new Date().toISOString() });
    writePendingMessages(existing);
    return true;
  }

  function retryPendingMessage(id) {
    if (!navigator.onLine) {
      showNotice('You’re still offline. Kurukoo has kept the message for you.', { tone: 'offline' });
      return;
    }
    const input = document.getElementById('message-input');
    const send = document.getElementById('send-message');
    const queued = readPendingMessages();
    const item = queued.find(entry => entry.id === id);
    if (!item || !input || !send) return;
    writePendingMessages(queued.filter(entry => entry.id !== id));
    input.value = item.text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
    send.click();
    renderPendingNotice();
  }

  function renderPendingNotice() {
    if (!isAppSurface()) return;
    const pending = readPendingMessages();
    const existing = document.querySelector('[data-pwa-pending-list]');
    if (existing) existing.remove();
    if (!pending.length) return;

    const region = ensureStatusRegion();
    if (!region) return;
    region.replaceChildren();
    region.dataset.tone = navigator.onLine ? 'pending' : 'offline';

    const copy = document.createElement('span');
    copy.className = 'pwa-status-copy';
    copy.textContent = navigator.onLine
      ? `${pending.length} message${pending.length === 1 ? '' : 's'} saved while offline. Nothing has been sent automatically.`
      : `${pending.length} message${pending.length === 1 ? '' : 's'} saved while offline.`;
    region.appendChild(copy);

    const list = document.createElement('div');
    list.dataset.pwaPendingList = 'true';
    list.className = 'pwa-pending-list';
    pending.forEach(item => {
      const row = document.createElement('div');
      row.className = 'pwa-pending-item';
      const text = document.createElement('span');
      text.className = 'pwa-pending-text';
      text.textContent = item.text;
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'k-btn k-btn-secondary pwa-status-action';
      retry.textContent = navigator.onLine ? 'Retry' : 'Wait for connection';
      retry.disabled = !navigator.onLine;
      retry.addEventListener('click', () => retryPendingMessage(item.id));
      row.append(text, retry);
      list.appendChild(row);
    });
    region.appendChild(list);
  }

  function captureOfflineIntent(event) {
    if (navigator.onLine || !isAppSurface()) return;
    const input = document.getElementById('message-input');
    if (!input) return;

    const target = event.target instanceof Element ? event.target : null;
    const sendButton = target?.closest('#send-message');
    const quickAction = target?.closest('.composer-quick-actions [data-prompt], .quick-actions [data-prompt]');
    const isEnter = event.type === 'keydown' && target === input && event.key === 'Enter' && !event.shiftKey;
    if (!sendButton && !quickAction && !isEnter) return;

    const text = quickAction?.getAttribute('data-prompt') || input.value;
    if (!String(text || '').trim()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    queuePendingMessage(text);
    if (!quickAction) input.value = String(text).slice(0, 12000);
    renderPendingNotice();
    showNotice('You’re offline. Your message has been saved and will only send when you choose Retry.', { tone: 'offline' });
  }

  function updateConnectivityState() {
    const online = navigator.onLine;
    setPwaState(online ? 'online' : 'offline');
    if (!isAppSurface()) return;
    if (online) {
      showNotice('Back online. Kurukoo can continue your conversation.', { tone: 'online', timeout: 4200 });
      renderPendingNotice();
    } else {
      showNotice('You’re offline. Cached Kurukoo pages remain available; new messages can be saved for manual retry.', { tone: 'offline' });
      renderPendingNotice();
    }
  }

  function routeLegacyStart() {
    if (window.location.pathname !== '/dashboard.html') return;
    const target = `${APP_START}${window.location.search || ''}${window.location.hash || ''}`;
    window.location.replace(target);
  }

  async function registerWorker() {
    ensureClientVisualAuthority();
    if (isAppSurface() && navigator.onLine) showNotice('Checking Kurukoo connection…', { tone: 'loading' });
    if (!("serviceWorker" in navigator)) {
      setPwaState('unsupported');
      return;
    }
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
      setPwaState(navigator.onLine ? 'registered' : 'offline');
      if (navigator.onLine && isAppSurface()) showNotice('Kurukoo is ready to continue your conversation.', { tone: 'online', timeout: 2600 });
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            setPwaState('update-available');
            showAction('Update Kurukoo', () => {
              worker.postMessage({ type: 'SKIP_WAITING' });
              window.location.reload();
            });
          }
        });
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
      await registration.update();
    } catch (error) {
      setPwaState('registration-error');
      console.warn('Kurukoo PWA update registration unavailable', error);
    }
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showAction('Install Kurukoo', async () => {
      if (!deferredInstallPrompt) return;
      const prompt = deferredInstallPrompt;
      deferredInstallPrompt = null;
      await prompt.prompt();
      await prompt.userChoice;
    });
  });

  window.addEventListener('appinstalled', () => {
    setPwaState('installed');
    deferredInstallPrompt = null;
    showNotice('Kurukoo is installed and ready from your home screen.', { tone: 'installed', timeout: 4200 });
  });

  window.addEventListener('online', updateConnectivityState);
  window.addEventListener('offline', updateConnectivityState);
  document.addEventListener('click', captureOfflineIntent, true);
  document.addEventListener('keydown', captureOfflineIntent, true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.serviceWorker?.ready) {
      navigator.serviceWorker.ready.then(registration => registration.update()).catch(() => {});
    }
  });

  window.addEventListener('load', () => {
    routeLegacyStart();
    ensureClientVisualAuthority();
    updateConnectivityState();
    renderPendingNotice();
    registerWorker();
  });
})();
