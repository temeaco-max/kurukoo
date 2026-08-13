# Kurukoo Voice — browser-first implementation

## Current implementation

Kurukoo now has a provider-neutral browser voice adapter in `public/js/kurukoo-voice.js`.

It deliberately does **not** create a second conversation, intent engine, request lifecycle, or AI model. Voice is an interface to the existing chat composer and conversation flow.

```text
Microphone
  -> Browser SpeechRecognition
  -> existing Kurukoo chat composer
  -> existing /api/chat flow
  -> assistant response already rendered by chat
  -> Browser SpeechSynthesis
  -> speaker
```

## Cost

The initial implementation requires no Kurukoo API key and no paid voice provider. Speech recognition and speech synthesis are supplied by the browser when supported.

This makes it suitable for immediate testing on supported desktop browsers, including current Chromium-based browsers. Actual recognition availability and speech quality are browser/platform dependent, and browser speech recognition may use a browser vendor's remote speech service. Kurukoo does not claim that browser speech is locally processed.

## Behaviour

- Tap **Voice** to enter a conversational listening state.
- Interim recognition is shown in the voice status region.
- A final utterance is submitted through the existing Send action.
- Kurukoo's existing response is spoken after it appears in the chat.
- After speech playback ends, voice listening resumes for the next turn.
- The user can stop voice mode at any time.
- Voice stops when the page becomes hidden.
- Microphone permission failures are surfaced explicitly.
- Unsupported browsers expose a disabled voice state rather than pretending the feature works.

## Provider-neutral boundary

The browser adapter is intentionally isolated so a later higher-quality STT/TTS provider can replace either side without changing Kurukoo's conversation or Economic Request architecture.

Possible future adapters include hosted STT/TTS or a WebRTC/realtime provider. Those are **not required for the free browser implementation** and must not be represented as active until configured.

## Product truthfulness

Voice availability means browser voice input/output is available. It does not mean Kurukoo has a telephone number, PSTN calling, WhatsApp calling, or an active remote call service.

Those remain separate channel integrations and must use the existing channel architecture.
