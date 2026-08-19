# Kurukoo user-owned artifact storage

Kurukoo treats connected user-owned storage as the preferred durable home for user artifacts. Google Drive is the first provider implementation and uses the least-privilege `https://www.googleapis.com/auth/drive.file` scope. Kurukoo-managed storage remains a temporary processing, retry, cache, and explicit fallback layer; it is not presented as the user's canonical permanent library.

## Configuration

The server supports these environment variables:

| Variable | Purpose |
| --- | --- |
| `GOOGLE_DRIVE_CLIENT_ID` | Google Cloud OAuth 2.0 web application client ID. |
| `GOOGLE_DRIVE_CLIENT_SECRET` | Server-only OAuth client secret. Never expose it to the browser. |
| `GOOGLE_DRIVE_REDIRECT_URI` | Exact authorized Google OAuth callback URI, for example `https://<api-host>/api/connect/google/callback`. |
| `GOOGLE_DRIVE_POST_AUTH_REDIRECT` | Optional app/web deep link used after callback; defaults to the Kurukoo surface link. |

When the credentials are absent, the Connect surface shows **Not configured** and authorization fails closed. No fake Drive connection or successful Drive persistence state is created.

## Flow and ownership

The server creates a one-time, expiring OAuth state bound to the authenticated Kurukoo user. The callback consumes that state before exchanging the authorization code, requests offline access, verifies the Google account identity, creates or resolves the Kurukoo folder and Voice subfolder, and stores only encrypted refresh-token material plus Drive references. Artifact reads, writes, playback retrieval, and metadata deletion verify the authenticated Kurukoo owner server-side.

Voice notes are staged for transcription and processing. If Drive is connected, the original is uploaded to the user's Voice folder, verified by Drive file lookup, and recorded as a `google-drive` artifact with its external file ID. If Drive is unavailable, the artifact is explicitly marked as Kurukoo-managed fallback storage. Transcription failure does not invalidate an audio upload. Drive upload failure is represented as `pending_external_storage` and must not be shown as verified Drive persistence.

## Artifact history and deletion

Artifact History displays recording metadata, duration, transcript state, provider, storage status, playback, transcript visibility, Drive opening, and safe deletion of the Kurukoo metadata reference. Deleting a reference does not delete the user's Drive original. External Drive deletion requires a separate explicit action and must never happen silently.

## QR device linking

Device pairing uses expiring one-time tokens bound to the authenticated user. The native app requests camera permission, scans only QR payloads, passes the token to the existing server confirmation procedure, and rejects invalid, expired, or replayed tokens. Web uses the existing token-entry fallback. Linked-device cards show active/inactive/revoked status, verified state, connected date, last-seen evidence, and explicit revoke-access confirmation.

## Validation boundary

Deterministic tests cover no-credential readiness, OAuth scope and state contracts, provider routing, artifact ownership, history actions, QR scanner contracts, and device revocation. Physical iOS and Android validation is still required for real Google consent, camera permission/scanning, Drive persistence/retrieval, microphone playback, retry behavior, and device revocation.
