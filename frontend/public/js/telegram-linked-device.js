(() => {
  const panel = document.querySelector('[data-telegram-linked-device-panel]');
  if (!panel) return;
  const statusText = panel.querySelector('[data-telegram-linked-device-status]');
  const dot = panel.querySelector('[data-telegram-linked-device-status-dot]');
  const qr = panel.querySelector('[data-telegram-linked-device-qr]');
  const placeholder = panel.querySelector('.linked-device-qr-placeholder');
  const errorNode = panel.querySelector('[data-telegram-linked-device-error]');
  const start = panel.querySelector('[data-telegram-linked-device-start]');
  const stop = panel.querySelector('[data-telegram-linked-device-stop]');
  const logout = panel.querySelector('[data-telegram-linked-device-logout]');
  let timer;

  function showError(message) {
    errorNode.textContent = message || '';
    errorNode.hidden = !message;
  }

  function apply(status) {
    const state = String(status?.state || 'idle');
    statusText.textContent = {
      disabled: 'Disabled for this deployment',
      not_configured: 'Ready for Telegram API activation',
      idle: 'Ready to start pairing',
      connecting: 'Connecting to Telegram…',
      scan_with_telegram: 'Scan this QR with Telegram',
      connected: 'Telegram linked device connected',
      error: 'Telegram linked-device error',
    }[state] || state;
    dot.dataset.state = state;
    const active = ['connecting', 'scan_with_telegram', 'connected'].includes(state);
    start.hidden = active;
    stop.hidden = !active;
    logout.hidden = state !== 'connected';
    if (status?.qrDataUrl) {
      qr.src = status.qrDataUrl;
      qr.hidden = false;
      placeholder.hidden = true;
    } else {
      qr.hidden = true;
      placeholder.hidden = false;
    }
    showError(status?.lastError || (state === 'not_configured' ? 'Configure TELEGRAM_API_ID, TELEGRAM_API_HASH, the owner phone, and both Telegram linked-device gates before pairing.' : ''));
  }

  async function load() {
    try {
      const response = await fetch('/api/telegram-linked-device/status', { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Telegram linked-device status is unavailable.');
      apply(data);
    } catch (error) {
      showError(error.message || 'Telegram linked-device status is unavailable.');
    }
  }

  async function action(path) {
    showError('');
    try {
      const response = await fetch(`/api/telegram-linked-device/${path}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Telegram linked-device action was not accepted.');
      apply(data.status || data);
    } catch (error) {
      showError(error.message || 'Telegram linked-device action failed.');
    }
  }

  start.addEventListener('click', () => action('start'));
  stop.addEventListener('click', () => action('stop'));
  logout.addEventListener('click', () => action('logout'));
  load();
  timer = window.setInterval(load, 2500);
  window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
})();
