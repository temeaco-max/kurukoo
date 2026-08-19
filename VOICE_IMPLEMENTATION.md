# Kurukoo Web Voice Implementation

## Scope

Web Voice is a **realtime interface inside `/chat`**, not a separate product, conversation store, identity flow, request engine, or telephone channel. Browser voice remains attached to the current Kurukoo conversation and delegates business actions to the same routing, skill, Economic Request, reminder, memory, safety, and authorization services used by text chat.

## Provider and model

The supported realtime surface is the Gemini Live API through the repository’s existing `@google/genai` dependency. The cost-conscious text default is `gemini-2.5-flash`, but text, TTS, and Live audio are separate capabilities. The bounded Live default is `gemini-2.5-flash-native-audio-live`; it is configurable because Live model availability, quota, acceptable-use terms, and regional availability require owner verification before production rollout. [1] [2]

The browser connects directly to Gemini Live using a **short-lived ephemeral token**, not a long-lived Gemini API key. This reduces streaming latency and keeps the permanent provider credential on the Kurukoo backend. Google documents one-minute new-session validity and a short, configurable active-session lifetime for this token pattern. [1]

## Environment configuration

```dotenv
KURUKOO_VOICE_ENABLED=true
KURUKOO_VOICE_PROVIDER=gemini-live
KURUKOO_VOICE_MODEL=gemini-2.5-flash-native-audio-live
KURUKOO_VOICE_EXPERIMENTAL_BROWSER_SPEECH=false
KURUKOO_VOICE_TTS_PROVIDER=disabled
KURUKOO_VOICE_TTS_MODEL=
# Optional Mistral Voxtral TTS: an externally managed saved voice only; user audio is never used as a clone source at this boundary.
MISTRAL_API_KEY=owner-managed-server-secret
MISTRAL_TTS_MODEL=approved-voxtral-model
MISTRAL_TTS_VOICE_ID=approved-saved-voice-id
MISTRAL_TTS_RESPONSE_FORMAT=mp3
FF_HOSTED_MISTRAL=false
FF_MISTRAL_TTS=false
KURUKOO_VOICE_MAX_SESSION_SECONDS=900
KURUKOO_VOICE_IDLE_TIMEOUT_SECONDS=120
KURUKOO_VOICE_MAX_CONCURRENT_SESSIONS=2
KURUKOO_VOICE_SESSION_RATE_LIMIT=5
GEMINI_API_KEY=owner-managed-server-secret
```

Do not commit a real provider credential. `GEMINI_API_KEY` is read only by the server-side singleton Google client; it is never returned by the voice status, session, transcript, tool, or chat APIs. If the flag or provider credential is absent, `/api/voice/status` reports the feature as unavailable and the chat control tells the user to continue typing.

## Session flow

```text
Web Chat microphone
  → POST /api/voice/session (same cookie / guest identity model)
  → existing conversation ownership resolution
  → compact safe context + restricted live configuration
  → Gemini Live ephemeral token from Kurukoo backend
  → browser-to-Gemini Live WebSocket
  → browser microphone PCM stream / Gemini audio stream
  → existing messages table for transcripts
```

`POST /api/voice/session` resolves the supplied conversation ID only for its owner. If no conversation exists, it creates the ordinary canonical conversation through `ensureConversation`. It rate-limits issuance, caps active sessions per identity, uses one-time tokens, caps session duration, and supplies an idle timeout. Browser cleanup closes the Live session, stops microphone tracks, closes the audio context, clears timers, and tells the backend to end the session.

## Conversation continuity and transcripts

Voice uses the existing `chat_conversations`, `messages`, and `chat_message_meta` storage. Transcript messages are stored as `web_voice` with small metadata such as `voice: true`, provider, model, and non-secret session ID. Raw audio is not stored. The current conversation ID remains in the same client state and local storage used by text chat; no voice thread or voice conversation is created.

Text and voice may therefore alternate in one request. The chat controller safely renders the same saved transcript messages and reuses normal storefront-card rendering for any card returned by canonical routing.

## Tool boundary

Gemini is a realtime conversational interface, not an authority for Kurukoo actions. The model has a small declared tool set:

| Tool | Delegation target | Boundary |
|---|---|---|
| `get_current_conversation` | Existing message history | Compact recent-turn read only. |
| `get_request_state` | Canonical Economic Request data | Reports stored state only. |
| `get_reminders` | `reminderService` | Authenticated profile only. |
| `get_memory_context` | `memoryProfile` | Minimal name/location context; no internal preference, score, or audit disclosure. |
| `get_points_summary` | `pointsEngine` | Read-only profile summary. |
| `route_user_intent` | `intentRouter` plus normal guest auth state | Existing skills, FastText classification, request lifecycle, and progressive identity behavior. |

The registry does **not** expose payment, escrow release, provider dispatch, emergency-contact notification, security changes, account deletion, or arbitrary database/HTTP access. Tool names and arguments are validated by `/api/voice/tools`; a browser-provided function name cannot create a new permission.

## Safety and truthfulness

The Gemini Live system instruction requires the same user-facing Kurukoo persona: calm, concise, helpful, action-oriented, and truthful. It prohibits fabricated availability, prices, provider verification, payment, escrow, dispatch, emergency-contact delivery, fulfilment, private memory disclosure, credentials, OTPs, hidden reasoning, and bypasses of progressive identity or request confirmation.

Conversation content is treated as untrusted. A spoken request cannot override the system rules or gain access to undeclared tools. Existing Kurukoo services remain the sole authority for skills, requirements, provider eligibility, payment, execution, safety, and memory permissions.

## Audio behavior and accessibility

The existing `/chat` microphone button opens the realtime voice session. The chat displays text status for connecting, listening, thinking, speaking, interruption, error, and disconnection. It uses the existing SVG microphone icon and preserves a 44px control target. A visible **End voice** control allows immediate cleanup. The user may always return to text.

Audio uses browser microphone capture, 16 kHz signed PCM input to the supported Gemini Live boundary, and 24 kHz PCM output playback. Starting new microphone audio stops queued assistant playback for barge-in. Browser Speech APIs are an experimental, turn-based pilot only; they are not represented as server transcription. Server speech uses one explicitly selected provider only. The repository includes both the pre-existing Gemini path and a canonical Mistral Voxtral TTS adapter. Mistral requires an approved model and externally managed saved `voice_id`, a Mistral key, both `hosted_mistral` and `mistral_tts` flags, a bounded 300-word/2,000-character input, non-stream base64 audio validation, and provider/model attribution in private response headers. It never uploads a user artifact as a voice-clone source and never returns synthetic fallback audio under Mistral attribution. If microphone permission, device access, provider availability, moderation, quota, network, autoplay, or browser support fails, the control returns a plain-language text fallback.

## Free-tier development and production requirements

The implementation is designed for bounded Gemini Live development access where it is available; it does not promise a permanent free production tier. Kurukoo makes no production commitment to free-tier processing of private conversations until privacy, retention, quota, regional processing, and provider-terms decisions are explicit. Quotas, preview model availability, rate limits, and token behavior are controlled by providers and must be verified by the owner before production release. Mistral Voxtral transcription and Mistral TTS both have canonical repository adapters and deterministic contracts, but neither is production-active or live-verified merely because a secret is configured. Mistral TTS can be selected only after its explicit model, saved voice, key and dual flags are configured; its live evidence must include actual returned audio, attribution, moderation/timeout recovery, and text fallback. The explicit upgrade path is to adjust the configured model/provider and session limits or add a future provider adapter—without changing chat, conversations, Economic Requests, skills, reminders, memory, or cards.

Browser voice is distinct from the existing IVR and call-placeholder surfaces. It does not activate WhatsApp voice, telephone calling, Telegram voice, SMS, USSD, remote peer calling, or a payment/dispatch integration.

## References

[1]: https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens "Gemini Live API ephemeral tokens"
[2]: https://ai.google.dev/gemini-api/docs/live-api "Gemini Live API overview"
[3]: https://docs.mistral.ai/studio-api/audio/text_to_speech "Mistral Text-to-Speech API"
