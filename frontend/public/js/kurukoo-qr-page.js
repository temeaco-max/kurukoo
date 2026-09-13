(() => {
  const context = document.getElementById('qr-context'), detail = document.getElementById('qr-detail'), feedback = document.getElementById('qr-feedback'), output = document.getElementById('qr-output'), image = document.getElementById('qr-image'), entry = document.getElementById('qr-entry');
  const say = (node, text) => { node.textContent = text; };
  document.getElementById('generate-qr')?.addEventListener('click', async () => {
    const type = context.value, value = detail.value.trim(); say(feedback, 'Generating…');
    const body = { context: type, ...(value ? (type === 'channel' ? { channel: value.toLowerCase() } : { entity: value, capability: value }) : {}) };
    const response = await fetch('/api/qr/generate', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const data = await response.json().catch(() => ({}));
    if (!response.ok) { say(feedback, response.status === 401 ? 'Sign in to generate a personal Kurukoo QR.' : (data.error || 'QR generation is unavailable.')); output.hidden = true; return; }
    const blob = new Blob([data.svg], { type: 'image/svg+xml' }); image.src = URL.createObjectURL(blob); entry.href = data.entryUrl; entry.textContent = data.description; output.hidden = false; say(feedback, 'QR ready.');
  });
  document.getElementById('qr-image-input')?.addEventListener('change', async event => {
    const file = event.target.files?.[0]; const scanFeedback = document.getElementById('scan-feedback'); if (!file) return; if (!('BarcodeDetector' in window)) { say(scanFeedback, 'QR image scanning is not supported in this browser. Open a Kurukoo QR with your camera instead.'); return; }
    try { const bitmap = await createImageBitmap(file); const detector = new BarcodeDetector({ formats: ['qr_code'] }); const codes = await detector.detect(bitmap); const value = codes[0]?.rawValue; const url = new URL(value, location.origin); if (url.origin !== location.origin || url.pathname !== '/start') throw new Error(); say(scanFeedback, 'Opening Kurukoo context…'); location.assign(url.pathname + url.search); } catch { say(scanFeedback, 'This image does not contain a supported Kurukoo QR code.'); }
  });
})();
