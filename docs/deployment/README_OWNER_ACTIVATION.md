# Owner activation entrypoint

Use `docs/deployment/OWNER_INTEGRATION_ACTIVATION.md` for the canonical local activation runbook and `scripts/live-activation-harness.ts` for Mistral, Drive, Telegram and WhatsApp smoke paths.

Security-sensitive linked-device sessions require encrypted application secrets for Telegram and a private persistent auth volume for WhatsApp. Credentials alone never change readiness to live-verified.