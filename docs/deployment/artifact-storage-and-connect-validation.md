# Artifact Storage and Connect Validation Record

**Status:** Code-level contract implemented and provider-free regression verified. **External Google Drive authorization, a live Drive upload, and physical device pairing are deployment gates, not completed evidence.**

Kurukoo now uses one owner-scoped artifact boundary for voice recordings and direct artifact uploads. An authenticated owner receives a canonical artifact record with its owner phone, type, filename, MIME type, byte count, persistence provider, durability classification, transcript state, and created time. A guest cannot persist an artifact through this boundary. Artifact history and open/delete operations require that exact same owner; a different account receives no artifact record or managed bytes.

| Persistence outcome | Record values | Truthful interpretation |
|---|---|---|
| A connected owner’s Drive resumable upload returns a Drive file ID | `storageProvider=google_drive`, `durability=external_verified`, immutable Drive file ID | The external provider confirmed file persistence. |
| Drive is unconfigured, unconnected, or requires reauthorization | `storageProvider=kurukoo_managed`, `durability=managed_fallback` | Kurukoo has verified its managed local fallback only. It does not claim Drive persistence. |
| Audio is saved but transcription fails | `transcriptStatus=failed` | The artifact remains available subject to the configured retention/storage boundary; no transcript is claimed. |
| Reference deletion without `external=true` | Artifact reference is deleted; `externalDeleted=false` | Kurukoo does not delete a Drive file merely because an in-app reference is removed. |
| Explicit owner deletion with `external=true` | Artifact reference is deleted only after Drive deletion confirmation | The external deletion request was explicit and provider-confirmed. |

The Google Drive connector uses the least-privilege `drive.file` scope, a server-side authorization-code flow, 32-byte random state values stored only as hashes, exact owner matching on callback, encrypted access and refresh tokens, refresh-token renewal, and provider revocation. The scope is intentionally restricted to files created by the app or explicitly opened/shared with it, rather than broad access to a user’s Drive.[1] Google’s server OAuth guidance requires an exact registered redirect URI and recommends state, offline refresh access, and secure confidential credential storage.[2] The upload path uses the documented resumable-upload flow and treats the returned file ID as the persistence proof.[3]

Voice transcription now creates an authenticated owner artifact before requesting the existing Mistral transcription adapter. On transcription success, the artifact receives the transcript and `available` state before the text proceeds through the existing canonical chat turn. On transcription failure, it records `failed` when the artifact was retained. This does not create another voice runtime, another chat engine, or a different request authority.

Existing WhatsApp and Telegram linked-device connectors remain separate, owner-gated channel integrations. Their disabled-by-default configuration, pairing state, inbound owner/channel provenance, logout/revocation paths, and current automated route tests remain the canonical Connect implementation. This artifact change does not replace them with a generic OAuth connector.

The authenticated **Connect** workspace now presents the same owner-scoped artifact history. It states whether Drive is connected, managed fallback is active, or Drive has not been configured; it never labels an unavailable external provider as connected. The workspace starts the server-side Drive authorization flow only when the deployment has Drive configuration, returns a completed browser authorization to `/connect`, opens artifacts only through the authenticated artifact boundary, and presents **Remove reference** as a reference-only action. It intentionally provides no ambiguous "delete file" control: external Drive deletion remains a distinct, explicit `external=true` owner request at the canonical API boundary.

## Deployment gates

The production deployment must configure `KURUKOO_GOOGLE_DRIVE_CLIENT_ID`, `KURUKOO_GOOGLE_DRIVE_CLIENT_SECRET`, `KURUKOO_GOOGLE_DRIVE_REDIRECT_URI`, and a dedicated `KURUKOO_STORAGE_ENCRYPTION_KEY` through secure deployment secrets. The Drive API must be enabled, the OAuth consent configuration must declare `drive.file`, and the callback URI must exactly match the Google Cloud OAuth client registration.[1] [2] No credential values belong in source control, browser state, artifact metadata, application logs, or test fixtures.

A real user-authorized Drive connection and upload must be verified only after the deployment configuration exists. The required evidence is an authenticated owner connection, a Drive file ID returned from a resumable upload, a successful owner-scoped artifact-history response, an owner-scoped open operation, a reference-only delete, and a separately confirmed explicit external deletion. Physical WhatsApp or Telegram pairing also remains open until it is performed with a real owned device, connected state is observed, one inbound message traverses the existing canonical chat route, and logout/revocation is verified.

## References

[1] [Choose Google Drive API scopes — Google for Developers](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)

[2] [Using OAuth 2.0 for Web Server Applications — Google for Developers](https://developers.google.com/identity/protocols/oauth2/web-server)

[3] [Upload file data — Google Drive API](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
