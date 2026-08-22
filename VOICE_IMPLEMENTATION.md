# Kurukoo Web Voice Implementation

## Scope

Web Voice is a realtime interface inside `/chat`, not a separate product, conversation store, identity flow, request engine, or telephone channel. Browser voice remains attached to the current Kurukoo conversation and delegates business actions to the same routing, skill, Economic Request, reminder, memory, safety, and authorization services used by text chat.

## Three speech modes

1. **Voice input / push-to-talk:** browser microphone input enters the same canonical conversation. Browser/device speech recognition may be used where supported; hosted transcription remains an adapter.
2. **Realtime voice conversation:** the existing Gemini Live boundary provides natural bidirectional audio when explicitly enabled. It uses short-lived ephemeral tokens and is not permanently connected.
3. **Spoken response / brief:** browser/device `SpeechSynthesis` is the preferred zero-cost baseline. `public/js/kurukoo-speech-output.js` is the provider-free browser adapter and is injected into the canonical `/chat` page by `chatPageRoutes.ts`. It uses no Kurukoo inference, API key or hosted TTS request.

Hosted TTS (Gemini or Mistral) is optional. It exists for consistent/richer voice where the cost and UX justify it, never as the default requirement for ordinary spoken responses.

## Zero-cost speech output

```text
canonical Chat response text
        ↓
public/js/kurukoo-speech-output.js
        ↓
window.speechSynthesis
        ↓
user's device/browser voice
```

This avoids server inference and audio-generation charges. Browser voice availability varies by device/browser and installed voices. Kurukoo therefore exposes this as an enhancement and retains text as the authoritative presentation.

The adapter exposes `window.KurukooSpeechOutput.speak(text, options)` and `stop()` plus `kurukoo:voice-presence` events. It does not store audio, clone voices or contact a provider.

Automatic speaking must remain an explicit user preference/interaction mode; Kurukoo must not unexpectedly speak simply because a user logged in. Future proactive briefs require explicit opt-in, quiet-hour/attention policy and privacy controls.

## Realtime session

`voiceService.ts` and `voiceRouter.ts` remain the canonical realtime voice boundary. Gemini receives a short-lived ephemeral token; the browser connects directly to the bounded Live session. The session uses the same conversation identity, compact context and canonical voice tools as text Chat.

## Hosted TTS

`serverTtsService.ts` remains the canonical optional hosted TTS adapter. Gemini and Mistral are provider implementations, not authorities. Mistral requires an approved model, externally managed saved voice, server key and feature gates. Live provider evidence remains separate from repository configuration.

## Memory use

Voice uses the same canonical Memory Profile and conversation context model as text. It may use approved identity, location, preferences and stable facts to avoid repeated questions. Memory provenance remains internal and must never be spoken back as metadata. Memory never becomes evidence of current provider availability, price, payment, safety delivery or fulfilment.

## Proactive/JARVIS-like future mode

A future opt-in proactive mode may assemble a deterministic brief from Requests, Tasks, Notifications, Memory and Agent state, then speak the brief using browser/device SpeechSynthesis. The expensive realtime model must not continuously monitor the account. Attention policy decides whether an event is spoken immediately, shown as a quiet notification, deferred to the next brief or kept silent.

## Truth and verification

Repository presence, runtime availability and real-world provider activation are separate verification dimensions. A configured Gemini/Mistral key does not prove provider availability; a voice route does not prove successful audio delivery; a browser adapter does not prove every browser has a usable voice.

The canonical truth authority is `docs/architecture/CURRENT_PRODUCT_TRUTH.md`.
