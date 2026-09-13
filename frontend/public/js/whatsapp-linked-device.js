(() => {
  const panel = document.querySelector('[data-linked-device-panel]');
  if (!panel) return;
  const statusText = panel.querySelector('[data-linked-device-status]');
  const dot = panel.querySelector('[data-linked-device-status-dot]');
  const qr = panel.querySelector('[data-linked-device-qr]');
  const placeholder = panel.querySelector('.linked-device-qr-placeholder');
  const error = panel.querySelector('[data-linked-device-error]');
  const start = panel.querySelector('[data-linked-device-start]');
  const stop = panel.querySelector('[data-linked-device-stop]');
  const logout = panel.querySelector('[data-linked-device-logout]');
  let timer;
  const setStatus = (value) => { statusText.textContent = value; dot.dataset.state = value.toLowerCase().replace(/\s+/g, '-'); };
  const showError = (value) => { error.hidden = !value; error.textContent = value || ''; };
  const render = (data) => {
    const labels = { disabled: 'Connector disabled', idle: 'Ready to start pairing', pairing: 'Scan with WhatsApp', connecting: 'Connecting', connected: 'WhatsApp linked', logged_out: 'Logged out', error: 'Connection needs attention' };
    setStatus(labels[data.state] || data.state || 'Checking connection');
    showError(data.lastError);
    if (data.qrDataUrl) { qr.src = data.qrDataUrl; qr.hidden = false; placeholder.hidden = true; } else if (data.state !== 'connected') { qr.hidden = true; placeholder.hidden = false; }
    start.hidden = data.state === 'connected' || data.state === 'pairing' || data.state === 'connecting';
    stop.hidden = !(data.state === 'pairing' || data.state === 'connecting' || data.state === 'connected');
    logout.hidden = data.state !== 'connected';
  };
  const poll = async () => { try { const response = await fetch('/api/whatsapp-linked-device/status', { credentials: 'same-origin', headers: { Accept: 'application/json' } }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to read linked-device status'); render(data); } catch (err) { showError(err.message); } };
  start.addEventListener('click', async () => { showError(''); start.disabled = true; try { const response = await fetch('/api/whatsapp-linked-device/start', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to start pairing'); render(data.status || data); } catch (err) { showError(err.message); } finally { start.disabled = false; } });
  stop.addEventListener('click', async () => { await fetch('/api/whatsapp-linked-device/stop', { method: 'POST', credentials: 'same-origin' }); await poll(); });
  logout.addEventListener('click', async () => { if (!window.confirm('Log out this linked WhatsApp device?')) return; await fetch('/api/whatsapp-linked-device/logout', { method: 'POST', credentials: 'same-origin' }); await poll(); });
  poll(); timer = window.setInterval(poll, 2500); window.addEventListener('beforeunload', () => window.clearInterval(timer));
})();
