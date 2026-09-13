/* Kurukoo zero-cost speech output adapter. Uses browser/device SpeechSynthesis only. */
(() => {
  'use strict';
  const state = { speaking: false, supported: typeof window !== 'undefined' && 'speechSynthesis' in window };
  const clean = text => String(text || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000);
  function chooseVoice(preferredLanguage) {
    if (!state.supported) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const language = String(preferredLanguage || document.documentElement.lang || navigator.language || 'en').toLowerCase();
    return voices.find(v => String(v.lang || '').toLowerCase() === language)
      || voices.find(v => String(v.lang || '').toLowerCase().startsWith(language.split('-')[0]))
      || voices.find(v => /^en(-|_)/i.test(String(v.lang || '')))
      || voices[0];
  }
  function emit(status) { window.dispatchEvent(new CustomEvent('kurukoo:voice-presence', { detail: { status, speaking: state.speaking, provider: 'browser' } })); }
  function speak(text, options = {}) {
    const value = clean(text);
    if (!value || !state.supported) return false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(value);
    const voice = chooseVoice(options.language);
    if (voice) utterance.voice = voice;
    utterance.rate = Number.isFinite(options.rate) ? Math.max(0.75, Math.min(1.25, options.rate)) : 1;
    utterance.pitch = Number.isFinite(options.pitch) ? Math.max(0.75, Math.min(1.25, options.pitch)) : 1;
    utterance.volume = Number.isFinite(options.volume) ? Math.max(0, Math.min(1, options.volume)) : 1;
    utterance.onstart = () => { state.speaking = true; emit('speaking'); };
    utterance.onend = () => { state.speaking = false; emit('idle'); };
    utterance.onerror = () => { state.speaking = false; emit('idle'); };
    window.speechSynthesis.speak(utterance);
    return true;
  }
  function stop() { if (!state.supported) return; window.speechSynthesis.cancel(); state.speaking = false; emit('idle'); }
  window.KurukooSpeechOutput = { speak, stop, isSupported: () => state.supported, get speaking() { return state.speaking; }, provider: 'browser' };
  window.speechSynthesis?.addEventListener?.('voiceschanged', () => emit(state.speaking ? 'speaking' : 'idle'));
})();
