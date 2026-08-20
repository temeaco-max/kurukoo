# Kurukoo Native Platform Convergence

The Expo application is the native reference client for both iOS and Android. Backend/platform work added after the initial Expo shell must extend the existing native framework rather than create a second mobile architecture.

## Current native boundary

`lib/platform-contract.ts` is the native parity registry. It deliberately separates four states:

- `implemented`: native surface consumes the canonical backend contract now.
- `client_ready`: native framework/routing is present; a deeper UX can be built without changing ownership.
- `server_only`: the capability belongs to protected backend/operator surfaces and is intentionally not exposed in the consumer app.
- `external_required`: native UI can be built, but real activation depends on deployment/provider/device evidence.
- `admin_only`: consumer native clients do not get a parallel operator surface.

The canonical backend continues to own routing, AI model/provider selection, inference budgets, agent execution, Economic Request lifecycle, provider verification, memory, discovery truth, notification delivery and persistence.

## Recent platform convergence represented in native framework

| Capability | Native state | Native framework |
| --- | --- | --- |
| Discover / Daily Picks / Topics / Opportunities | Implemented | `app/(tabs)/discover.tsx` + `lib/platform-client.ts` |
| Canonical Chat / AI routing | Implemented | `lib/chat-client.ts` |
| Watch / Follow / Save continuation | Implemented | `lib/platform-client.ts` + notifications framework |
| Notifications | Client ready | `lib/notifications.ts`, `app/surface/notifications.tsx` |
| First-class agents / budgets | Client ready | surface registry + typed platform contract |
| Economic Requests | Client ready | `app/surface/requests.tsx` + contract |
| Memory | Client ready | surface registry + contract |
| Provider discovery / verification | External required | Discover + provider contract |
| AI health / quotas / telemetry | Server only | Protected admin surface remains web-owned |
| Provider credentials | Admin only | Never exposed to consumer native UI |
| Safety / check-ins | Client ready | existing safety surface + contract |

## Build path

The app retains Expo Router and the existing cross-platform design system. `eas.json` provides development, preview and production profiles for future iOS/Android builds. `pnpm test:platform-contract` fails when a known recent platform capability disappears from the native registry.

This framework does **not** claim that every backend capability is fully available on-device today. It makes the future build path explicit and keeps ownership aligned with the canonical server platform.
