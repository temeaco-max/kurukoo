(() => {
  'use strict';

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const speechSynthesis = window.speechSynthesis;
  const input = document.getElementById('message-input');
  const voiceButton = document.getElementById('voice-input');
  const chatContent = document.getElementById('chat-content');
  const composer = document.querySelector('.composer');

  if (!input || !voiceButton) return;

  const state = {
    listening: false,
    speaking: false,
    expectingResponse: false,
    recognition: null,
    manuallyStopped: false,
    responseTimer: null,
    lastSpokenText: ''
  };

  const supported = Boolean(SpeechRecognition && speechSynthesis);

  function createStatus() {
    let status = document.getElementById('voice-status');
    if (status) return status;
    status = document.createElement('div');
    status.id = 'voice-status';
    status.className = 'voice-status';
    status.hidden = true;
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    composer?.parentElement?.insertBefore(status, composer);
    return status;
  }

  const status = createStatus();

  function setStatus(message, visible = true) {
    if (!status) return;
    status.textContent = message;
    status.hidden = !visible;
  }

  function setButton(active, disabled = false) {
    voiceButton.classList.toggle('voice-active', active);
    voiceButton.classList.toggle('voice-unavailable', disabled);
    voiceButton.setAttribute('aria-pressed', String(active));
    voiceButton.setAttribute('aria-label', active ? 'Stop voice conversation' : 'Start voice conversation');
    voiceButton.title = active ? 'Stop voice conversation' : 'Start voice conversation';
  }

  function stopSpeaking() {
    speechSynthesis?.cancel();
    state.speaking = false;
  }

  function stopListening() {
    state.manuallyStopped = true;
    state.listening = false;
    try { state.recognition?.stop(); } catch (_) { /* already stopped */ }
    setButton(false);
  }

  function speak(text) {
    if (!speechSynthesis || !text || !state.expectingResponse) return;
    const clean = String(text).replace(/\s+/g, ' ').trim();
    if (!clean || clean === state.lastSpokenText) return;
    state.lastSpokenText = clean;
    stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = document.documentElement.lang || 'en-GB';
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => {
      state.speaking = true;
      setStatus('Kurukoo is speaking…');
      setButton(true);
    };
    utterance.onend = () => {
      state.speaking = false;
      if (state.listening && !state.manuallyStopped) {
        setStatus('Listening…');
        beginRecognition();
      } else if (state.expectingResponse) {
        state.expectingResponse = false;
        setStatus('Voice conversation paused.', true);
        setTimeout(() => { if (!state.listening) setStatus('', false); }, 1800);
      }
    };
    utterance.onerror = () => {
      state.speaking = false;
      setStatus('Voice playback is unavailable.');
    };
    speechSynthesis.speak(utterance);
  }

  function submitTranscript(transcript) {
    const text = String(transcript || '').trim();
    if (!text) return;
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    state.expectingResponse = true;
    state.lastSpokenText = '';
    document.getElementById('send-message')?.click();
    setStatus('Kurukoo is thinking…');
  }

  function beginRecognition() {
    if (!state.listening || !state.recognition || state.speaking) return;
    state.manuallyStopped = false;
    try { state.recognition.start(); } catch (_) { /* browser may already be listening */ }
  }

  function createRecognition() {
    if (!SpeechRecognition) return null;
    const recognition = new SpeechRecognition();
    recognition.lang = document.documentElement.lang || 'en-GB';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      state.listening = true;
      setStatus('Listening…');
      setButton(true);
    };

    recognition.onresult = event => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalTranscript += result[0].transcript;
        else interimTranscript += result[0].transcript;
      }
      if (interimTranscript) setStatus(`Listening: ${interimTranscript}`);
      if (finalTranscript.trim()) submitTranscript(finalTranscript);
    };

    recognition.onerror = event => {
      state.listening = false;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setStatus('Microphone permission is required for voice.');
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setStatus('Voice input is unavailable right now.');
      }
      setButton(false);
    };

    recognition.onend = () => {
      if (state.listening && !state.speaking && !state.manuallyStopped) {
        setTimeout(beginRecognition, 120);
      }
    };

    return recognition;
  }

  function extractAssistantText(node) {
    if (!(node instanceof Element) || !node.classList.contains('assistant')) return '';
    const bubble = node.querySelector('.markdown-body');
    return bubble?.innerText?.trim() || '';
  }

  function watchAssistantResponses() {
    if (!chatContent || !state.expectingResponse) return;
    const observer = new MutationObserver(() => {
      if (!state.expectingResponse) return;
      clearTimeout(state.responseTimer);
      state.responseTimer = setTimeout(() => {
        const messages = [...chatContent.querySelectorAll('.message.assistant')];
        const latest = messages[messages.length - 1];
        const text = extractAssistantText(latest);
        if (text && text !== state.lastSpokenText) speak(text);
      }, 700);
    });
    observer.observe(chatContent, { childList: true, subtree: true, characterData: true });
  }

  function startVoice() {
    if (!supported) {
      setStatus('Voice is not supported in this browser. Try a current Chrome or Edge browser.');
      setButton(false, true);
      return;
    }
    stopSpeaking();
    state.listening = true;
    state.manuallyStopped = false;
    state.expectingResponse = false;
    state.recognition = state.recognition || createRecognition();
    setButton(true);
    setStatus('Listening…');
    beginRecognition();
  }

  function stopVoice() {
    state.expectingResponse = false;
    stopListening();
    stopSpeaking();
    setStatus('Voice conversation paused.', true);
    setTimeout(() => setStatus('', false), 1400);
  }

  voiceButton.addEventListener('click', () => {
    if (state.listening || state.speaking) stopVoice();
    else startVoice();
  });

  voiceButton.addEventListener('keydown', event => {
    if (event.key === 'Escape') stopVoice();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (state.listening || state.speaking)) stopVoice();
  });

  if (!supported) setButton(false, true);
  watchAssistantResponses();
  window.kurukooVoice = {
    start: startVoice,
    stop: stopVoice,
    supported,
    getState: () => ({ listening: state.listening, speaking: state.speaking })
  };
})();
