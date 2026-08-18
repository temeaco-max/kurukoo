# Prayer Companion End-to-End Interfaces

- `GET /api/prayer/status` — authenticated agent/capability/status and existing routines.
- `POST /api/prayer/generate` — personalised text prayer.
- `POST /api/prayer/audio` — server-generated prayer audio using the existing TTS boundary.
- `POST /api/prayer/routine` — daily/weekly prayer reminder using the existing reminder engine.
- `GET /api/prayer/routines` — existing prayer routines.
- `POST /api/voice/session` with `mode=prayer` — live prayer conversation through the existing Gemini Live session boundary.

All paths are authenticated and rate limited where consequential generation/audio operations occur. Voice sessions keep the existing conversation identity and end through the existing `/api/voice/end` lifecycle.
