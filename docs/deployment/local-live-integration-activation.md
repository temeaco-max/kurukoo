# Local live integration activation

This is the operator path for turning local `.env` credentials into real smoke tests without committing secrets.

## Mistral hosted escalation

Normal conversation remains SmolLM2-first. To test the hosted Mistral boundary explicitly, configure:

```env
MISTRAL_API_KEY=...
FF_HOSTED_MISTRAL=true
KURUKOO_AI_HOSTED_PROVIDER=mistral
```

Then run:

```bash
npx tsx scripts/test-mistral-policy.ts
npx tsx scripts/live-activation-harness.ts mistral
```

The policy test must confirm that automatic chat still selects SmolLM2 first while an explicit Mistral request uses Mistral. The smoke test must report `provider: Mistral` when Mistral is explicitly selected. A missing or disabled Mistral configuration must fail closed rather than silently claiming Mistral.

## Google Drive

Configure the registered OAuth client and exact callback:

```env
KURUKOO_GOOGLE_DRIVE_CLIENT_ID=...
KURUKOO_GOOGLE_DRIVE_CLIENT_SECRET=...
KURUKOO_GOOGLE_DRIVE_REDIRECT_URI=https://<host>/api/artifacts/drive/callback
KURUKOO_STORAGE_ENCRYPTION_KEY=...
FF_GOOGLE_DRIVE=true
```

For a local authenticated owner:

```bash
npx tsx scripts/live-activation-harness.ts drive +234...
```

Open the returned authorization URL in a browser while signed into the intended Google account. Complete consent, return through the canonical callback, then verify Connect reports `connected` and a voice/image/document upload produces `external_verified` storage rather than managed fallback.

The artifact boundary remains `drive.file`; Kurukoo stores encrypted refresh credentials and owner-scoped metadata, while Google Drive remains the durable user-owned original store.

## Telegram linked device

Telegram user-client pairing requires an API ID/API hash as well as the existing feature gates:

```env
TELEGRAM_API_ID=...
TELEGRAM_API_HASH=...
KURUKOO_TELEGRAM_LINKED_DEVICE_ENABLED=true
KURUKOO_TELEGRAM_LINKED_DEVICE_ALLOW=true
KURUKOO_TELEGRAM_LINKED_DEVICE_OWNER_PHONE=+234...
```

Then:

```bash
npx tsx scripts/live-activation-harness.ts telegram +234...
```

Scan the displayed Telegram login QR with the Telegram app. If two-step verification is enabled, provide the deployment-local `TELEGRAM_LINKED_DEVICE_2FA_PASSWORD`. After connection, send a real message from the linked Telegram account and confirm:

1. inbound message reaches canonical Chat;
2. the reply is sent through the same Telegram session;
3. channel evidence records the verified linked session;
4. the session can be stopped/revoked cleanly.

## WhatsApp linked device

This is the controlled Baileys linked-device path, not the official Business Platform.

```env
KURUKOO_WHATSAPP_LINKED_DEVICE_ENABLED=true
KURUKOO_WHATSAPP_LINKED_DEVICE_ALLOW=true
KURUKOO_WHATSAPP_LINKED_DEVICE_OWNER_PHONE=+234...
```

Then:

```bash
npx tsx scripts/live-activation-harness.ts whatsapp +234...
```

Scan the QR with WhatsApp > Linked Devices. Send a test message to the linked account and verify canonical Chat ingestion, reply delivery, channel evidence, reconnect behavior and explicit logout.

For production business messaging, use the separate official WhatsApp Business Platform adapter with Meta webhook and Graph API evidence. Do not treat Baileys linked-device evidence as official WhatsApp Business Platform availability.

## Evidence rule

Credentials/configuration alone do not make an integration live-verified. Record:

- configuration state;
- actual connection/pairing;
- real inbound evidence;
- real outbound/provider receipt;
- retry/recovery;
- revocation/logout;
- user-visible readiness state.
