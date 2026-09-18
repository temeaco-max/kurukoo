# Phase G — Activity continuity

Activity now exposes a canonical Actions tab backed by `/api/v1/chat/economic-requests`.

The surface is intentionally evidence-based:
- request state is read from the platform;
- users can open the canonical Work detail route;
- payment, provider acceptance and fulfilment are not inferred from UI interaction;
- unavailable API state is shown as unavailable rather than replaced with fixtures.

This keeps the intended Kurukoo loop intact: Conversation → Action → Work → evidence → Activity.
