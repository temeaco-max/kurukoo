# Prayer Companion Contract

Kurukoo's `agent_prayer_companion` is a first-class agent backed by the canonical capability `skill.prayer`.

Text, audio, live voice, and routines share the existing Brain, conversation, agent, memory, capability, reminder and voice boundaries. No prayer-specific scheduler, memory, payment or chat system exists.

Tradition hints (`christian`, `muslim`, `jewish`, `spiritual`, `general`) are request-scoped. The agent may use a name supplied by the user or an authoritative profile value. It does not silently infer or persist religion from a single request.

The agent can provide a personalised prayer, spoken prayer audio, daily/weekly prayer routines, or a live conversational prayer session. Live prayer uses the existing Gemini Live boundary with a prayer-specific system instruction. Server TTS uses the existing TTS adapter. Mistral audio capabilities remain accessible through the existing provider boundary when configured.

The agent may use a warm pastoral/preacher-like style when requested but never impersonates a real religious leader, claims divine authority or prophecy, guarantees prosperity/healing/financial outcomes, fabricates scripture quotations, or treats prayer as a substitute for emergency or professional help.

MCP-connected personal AI accounts and Kurukoo provider credentials remain separate: an external AI may control Kurukoo through MCP, but a connected account does not transfer its subscription or API quota to Kurukoo.
