(() => {
  const allowed = new Set(['context','ref','source','entity','capability','channel']);
  const params = new URLSearchParams(location.search); const payload = {};
  for (const [key, value] of params) if (allowed.has(key) && value.length <= 128) payload[key] = value;
  if (!payload.context) return;
  const banner = document.getElementById('qr-context-banner');
  fetch('/api/qr/activate', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, conversationId: localStorage.getItem('kurukoo_conversation_id') || undefined }) })
    .then(async response => ({ response, data: await response.json().catch(() => ({})) }))
    .then(({ response, data }) => { if (!response.ok || !data.conversationId) throw new Error('invalid'); localStorage.setItem('kurukoo_conversation_id', data.conversationId); document.dispatchEvent(new CustomEvent('kurukoo:qr', { detail: data })); if (banner) { banner.hidden = false; banner.textContent = 'You arrived through a Kurukoo QR context. Continue by text or voice.'; } history.replaceState({}, '', '/chat'); })
    .catch(() => { if (banner) { banner.hidden = false; banner.textContent = 'This QR code could not be used. You can continue chatting by text or voice.'; banner.dataset.kind = 'error'; } });
})();
