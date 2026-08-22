(() => {
  const allowed = new Set(['idle', 'thinking', 'speaking', 'working', 'waiting', 'needs-attention']);
  const labels = { idle: 'Available', thinking: 'Thinking', speaking: 'Speaking', working: 'Working', waiting: 'Waiting', 'needs-attention': 'Needs attention' };
  const state = { current: 'idle', beforeSpeech: 'idle' };

  function normalise(value) { return allowed.has(value) ? value : 'idle'; }

  function apply(next, source = 'agent') {
    const presence = normalise(next);
    state.current = presence;
    document.querySelectorAll('[data-agent-presence]').forEach(element => {
      element.dataset.agentPresence = presence;
      element.setAttribute('aria-label', `Kurukoo is ${labels[presence].toLowerCase()}`);
      if (element.matches('[data-agent-presence-label]')) element.textContent = labels[presence];
    });
    window.dispatchEvent(new CustomEvent('kurukoo:agent-presence', { detail: { state: presence, source } }));
    return presence;
  }

  window.addEventListener('kurukoo:voice-presence', event => {
    const detail = event.detail || {};
    if (detail.status === 'speaking' || detail.speaking) {
      if (state.current !== 'speaking') state.beforeSpeech = state.current;
      apply('speaking', 'browser-speech');
    } else if (state.current === 'speaking') {
      apply(state.beforeSpeech, 'browser-speech');
    }
  });

  window.KurukooAgentPresence = {
    set: (next, source) => apply(next, source || 'agent'),
    get: () => state.current,
    states: [...allowed],
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => apply('idle'));
  else apply('idle');
})();
