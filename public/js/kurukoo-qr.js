(() => {
  const params = new URLSearchParams(location.search);
  const token = params.get('qr') || '';
  const invalid = params.get('qr_error') === 'invalid';
  const banner = document.getElementById('qr-context-banner');

  function showBanner(message, kind = '') {
    if (!banner || banner.dataset.qrShown === message) return;
    banner.hidden = false;
    banner.textContent = message;
    banner.dataset.qrShown = message;
    if (kind) banner.dataset.kind = kind;
    else delete banner.dataset.kind;
  }

  if (invalid) {
    showBanner('This QR code could not be used. You can continue chatting by text or voice.', 'error');
    history.replaceState({}, '', '/chat');
    return;
  }
  if (!token) return;

  fetch('/api/qr/activate', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qr: token, conversationId: localStorage.getItem('kurukoo_conversation_id') || undefined }),
  })
    .then(async response => ({ response, data: await response.json().catch(() => ({})) }))
    .then(({ response, data }) => {
      if (!response.ok || !data.conversationId) throw new Error('invalid');
      localStorage.setItem('kurukoo_conversation_id', data.conversationId);
      document.dispatchEvent(new CustomEvent('kurukoo:qr', { detail: data }));
      showBanner('You arrived through a Kurukoo QR context. Continue by text or voice.');
      history.replaceState({}, '', '/chat');
    })
    .catch(() => showBanner('This QR code could not be used. You can continue chatting by text or voice.', 'error'));
})();
