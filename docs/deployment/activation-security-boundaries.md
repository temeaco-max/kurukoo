# Live activation security boundaries

The owner activation harness supports Mistral, Google Drive, Telegram linked-device, and WhatsApp linked-device smoke paths.

## Mistral

Use `MISTRAL_API_KEY`, `FF_HOSTED_MISTRAL=true`, and either `KURUKOO_AI_PRIMARY_PROVIDER=mistral` or `KURUKOO_AI_BYPASS_SMOLLM2=true`. The canonical conversational generation path resolves Mistral before the local SmolLM2 path. `scripts/test-mistral-bypass-policy.ts` verifies the selection contract; `scripts/live-activation-harness.ts mistral` verifies real provider execution.

## Google Drive

Use the exact registered OAuth callback in `KURUKOO_GOOGLE_DRIVE_REDIRECT_URI`, enable `FF_GOOGLE_DRIVE`, and configure `KURUKOO_STORAGE_ENCRYPTION_KEY`. The OAuth state is owner-bound and short-lived; provider credentials are encrypted at rest. Connected artifacts are written to the owner's Drive using `drive.file` and verified by returned file ID. Kurukoo keeps only owner-scoped metadata and uses managed storage only as a truthful fallback.

## Telegram linked device

Telegram user-client QR login requires `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, the owner phone, and one of the application encryption secrets (`KURUKOO_STORAGE_ENCRYPTION_KEY`, `MEMORY_ENCRYPTION_KEY`, or a 32+ character `JWT_SECRET`). The saved StringSession is encrypted with AES-256-GCM and stored in a private 0700 directory. Logout removes the encrypted session. `scripts/verify-owner-activations.ts` fails when linked-device mode is enabled without encrypted session storage.

## WhatsApp linked device

Baileys remains a controlled linked-device/pilot connector and is deliberately separate from the official WhatsApp Business Platform adapter. The Baileys multi-file auth store is confined to a private 0700 directory; production deployment must place that directory on an encrypted/persistent volume. Do not represent linked-device evidence as official WhatsApp Business availability.

## Evidence boundary

A secret or feature flag never equals live verification. A live activation requires an actual provider/device response, inbound turn, outbound receipt, retry/recovery evidence, and revocation/logout evidence.