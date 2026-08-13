(() => {
  'use strict';

  const scanButton = document.getElementById('qr-scan');
  const modal = document.getElementById('qr-modal');
  const closeButton = document.getElementById('qr-close');
  const video = document.getElementById('qr-video');
  const canvas = document.getElementById('qr-canvas');
  const status = document.getElementById('qr-status');
  const result = document.getElementById('qr-result');
  const resultTitle = document.getElementById('qr-result-title');
  const resultText = document.getElementById('qr-result-text');
  const continueButton = document.getElementById('qr-continue');
  const fileInput = document.getElementById('qr-file');
  const scanFileButton = document.getElementById('qr-file-button');

  if (!scanButton || !modal || !video || !canvas) return;

  let stream = null;
  let frameHandle = null;
  let pendingContext = null;

  const allowedHosts = new Set([window.location.host, 'kurukoo.ai', 'www.kurukoo.ai']);
  const contextLabels = {
    referral: 'Referral invitation',
    contributor: 'Contributor invitation',
    network: 'Kurukoo Network',
    offer: 'Kurukoo offer',
    product: 'Product or service',
    location: 'Kurukoo location',
    channel: 'Channel connection',
    continue: 'Continue on another device',
    public: 'Kurukoo',
  };

  function setStatus(text) {
    if (status) status.textContent = text;
  }

  function stopCamera() {
    if (frameHandle) cancelAnimationFrame(frameHandle);
    frameHandle = null;
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    video.srcObject = null;
  }

  function closeModal() {
    stopCamera();
    modal.hidden = true;
    result.hidden = true;
    pendingContext = null;
  }

  function safeContextFromUrl(raw) {
    let url;
    try { url = new URL(raw, window.location.origin); } catch (_) { return null; }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!allowedHosts.has(url.host)) return null;

    const context = url.searchParams.get('context') || 'public';
    const allowedContexts = new Set(Object.keys(contextLabels));
    const type = allowedContexts.has(context) ? context : 'public';
    const ref = url.searchParams.get('ref') || '';
    const source = url.searchParams.get('source') || '';
    const entity = url.searchParams.get('entity') || '';
    const capability = url.searchParams.get('capability') || '';
    const channel = url.searchParams.get('channel') || '';
    const token = url.searchParams.get('token') || '';

    return {
      url: url.toString(),
      type,
      label: contextLabels[type],
      ref: ref.slice(0, 128),
      source: source.slice(0, 128),
      entity: entity.slice(0, 128),
      capability: capability.slice(0, 128),
      channel: channel.slice(0, 32),
      token: token.slice(0, 256),
    };
  }

  function safeKurukooPayload(raw) {
    const text = String(raw || '').trim();
    if (text.startsWith('kurukoo://')) {
      return safeContextFromUrl(text.replace(/^kurukoo:\/\//, 'https://kurukoo.ai/'));
    }
    return safeContextFromUrl(text);
  }

  function showContext(context) {
    pendingContext = context;
    result.hidden = false;
    resultTitle.textContent = context.label;
    const parts = [];
    if (context.entity) parts.push(`For: ${context.entity}`);
    if (context.capability) parts.push(`Capability: ${context.capability}`);
    if (context.source) parts.push(`Source: ${context.source}`);
    if (context.channel) parts.push(`Channel: ${context.channel}`);
    if (context.ref) parts.push('Referral information detected');
    resultText.textContent = parts.length ? parts.join(' • ') : 'This QR code can open a Kurukoo conversation context.';
    setStatus('QR code recognised. Review the context before continuing.');
  }

  function handleDecoded(raw) {
    const context = safeKurukooPayload(raw);
    if (!context) {
      setStatus('That QR code is not a recognised Kurukoo code.');
      return;
    }
    showContext(context);
    stopCamera();
  }

  function scanFrame() {
    if (modal.hidden || !stream) return;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      frameHandle = requestAnimationFrame(scanFrame);
      return;
    }
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, width, height);

    if ('BarcodeDetector' in window) {
      const detector = scanFrame.detector || (scanFrame.detector = new BarcodeDetector({ formats: ['qr_code'] }));
      detector.detect(canvas).then(codes => {
        if (codes[0]?.rawValue) handleDecoded(codes[0].rawValue);
        else if (!modal.hidden && stream) frameHandle = requestAnimationFrame(scanFrame);
      }).catch(() => { if (!modal.hidden && stream) frameHandle = requestAnimationFrame(scanFrame); });
      return;
    }

    if (window.jsQR) {
      const image = ctx.getImageData(0, 0, width, height);
      const code = window.jsQR(image.data, width, height, { inversionAttempts: 'dontInvert' });
      if (code?.data) {
        handleDecoded(code.data);
        return;
      }
    }

    frameHandle = requestAnimationFrame(scanFrame);
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('Camera scanning is unavailable in this browser. You can scan a QR with your device camera and open Kurukoo normally.');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      video.srcObject = stream;
      await video.play();
      setStatus('Point your camera at a Kurukoo QR code.');
      frameHandle = requestAnimationFrame(scanFrame);
    } catch (error) {
      setStatus(error?.name === 'NotAllowedError' ? 'Camera permission is required to scan a QR code.' : 'The camera could not be started.');
    }
  }

  function openModal() {
    modal.hidden = false;
    result.hidden = true;
    pendingContext = null;
    setStatus('Starting camera…');
    startCamera();
  }

  function continueContext() {
    if (!pendingContext) return;
    const params = new URLSearchParams();
    params.set('context', pendingContext.type);
    if (pendingContext.ref) params.set('ref', pendingContext.ref);
    if (pendingContext.source) params.set('source', pendingContext.source);
    if (pendingContext.entity) params.set('entity', pendingContext.entity);
    if (pendingContext.capability) params.set('capability', pendingContext.capability);
    if (pendingContext.channel) params.set('channel', pendingContext.channel);

    // Preserve the context for the existing guest-first conversation. Do not put
    // authentication/session credentials into QR payloads or local storage.
    sessionStorage.setItem('kurukoo_qr_context', params.toString());
    const prompt = pendingContext.capability
      ? `I scanned a Kurukoo QR code about ${pendingContext.capability}. Help me with this.`
      : pendingContext.type === 'referral'
        ? 'I joined Kurukoo from a referral. Help me get started.'
        : pendingContext.type === 'contributor'
          ? 'I scanned a contributor invitation. Show me how I can contribute.'
          : pendingContext.type === 'channel'
            ? `I want to connect my ${pendingContext.channel || 'chosen'} channel to Kurukoo.`
            : 'I scanned a Kurukoo QR code. Help me with what I found.';
    sessionStorage.setItem('kurukoo_qr_prompt', prompt);
    window.location.href = '/chat/';
  }

  async function decodeFile(file) {
    if (!file || !window.jsQR) {
      setStatus('Image QR scanning is unavailable here. Use the camera scanner instead.');
      return;
    }
    const bitmap = await createImageBitmap(file);
    const max = 1600;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = window.jsQR(image.data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' });
    bitmap.close();
    if (code?.data) handleDecoded(code.data);
    else setStatus('No QR code was found in that image.');
  }

  scanButton.addEventListener('click', openModal);
  closeButton?.addEventListener('click', closeModal);
  modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
  continueButton?.addEventListener('click', continueContext);
  scanFileButton?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', event => decodeFile(event.target.files?.[0]));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modal.hidden) closeModal(); });

  window.kurukooQR = {
    open: openModal,
    close: closeModal,
    parse: safeKurukooPayload,
    getPendingContext: () => pendingContext,
  };
})();
