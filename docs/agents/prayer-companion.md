# Kurukoo Prayer Companion

`agent_prayer_companion` is a first-class Kurukoo agent built on the existing Brain, agent runtime, capability registry, memory profile, reminders and voice boundaries.

## User flows

### Personalised prayer

`POST /api/prayer/generate` accepts a topic, optional name, tradition (`christian`, `muslim`, `jewish`, `spiritual`, `general`), tone and length. The agent generates an original prayer and never claims supernatural certainty or guaranteed real-world outcomes.

### Spoken prayer

`POST /api/prayer/audio` converts approved prayer text to server audio through the existing server TTS boundary. This requires the deployment's configured TTS provider/key. The endpoint does not create a second voice system.

### Live prayer conversation

`POST /api/voice/session` may include `{ "mode": "prayer", "tradition": "christian" }`. The existing Gemini Live session boundary then uses a prayer-specific system instruction. The user can talk about what is happening, ask to pray, interrupt, continue, or stop. The session remains the existing Kurukoo voice session and uses the same conversation identity/context.

### Prayer routine

`POST /api/prayer/routine` creates a normal Kurukoo reminder with the existing reminder engine. It can recur daily or weekly. No prayer-specific scheduler is created.

## Provider boundaries

Gemini Live and server TTS are deployment-configured provider boundaries. A connected Gemini/other AI account through MCP is an AI channel and does not automatically grant Kurukoo access to the user's separate provider subscription or API quota.

Mistral voice remains available through the existing Mistral transcription/TTS capabilities where the current provider adapter reports them as configured.

## Safety and truth

The Prayer Companion may use a warm pastoral or preacher-like style when requested, but it does not impersonate a real religious leader and does not claim divine authority, prophecy, guaranteed healing, guaranteed prosperity or guaranteed outcomes. It can encourage the user to seek appropriate real-world medical, emergency or professional support when needed.

Religious tradition is request-scoped by default; Kurukoo does not silently infer or permanently store a user's religion merely because they requested one prayer style.
