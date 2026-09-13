# Kurukoo ↔ ChatGPT App / MCP

Kurukoo exposes a remote MCP app surface so a user can connect their Kurukoo account to ChatGPT and use ChatGPT as an external controller of the same Kurukoo OS.

MCP endpoint: `/mcp`

OAuth metadata: `/.well-known/oauth-authorization-server`

Protected resource metadata: `/.well-known/oauth-protected-resource`

Authorization: `/oauth/authorize`

Token: `/oauth/token`

The integration uses Kurukoo's existing OTP-first identity, Brain/context arbitration, universal capability registry, canonical capability executor, exact ownership checks, idempotency, confirmation policy and evidence/external-activation boundaries. Kurukoo does not collect a user's ChatGPT password or session credential.

Configure a production HTTPS issuer with `KURUKOO_MCP_ISSUER`, enable `KURUKOO_MCP_ENABLED=true`, and configure the OAuth client/redirect relationship required by the ChatGPT app surface. See the repository documentation at `docs/CHATGPT_KURUKOO_APP.md` for the complete deployment and security contract.
