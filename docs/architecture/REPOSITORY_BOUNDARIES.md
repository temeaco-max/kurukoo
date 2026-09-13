# Kurukoo Repository Boundaries

**Status: canonical.** This document defines where each concern lives. It resolves the consolidation of the Kurukoo web app (EJS), the remix-of-start-the-journey frontend (TanStack), admin, mobile and PWA.

## Governing decision

> **One Kurukoo product, multiple bounded repositories, developed side-by-side in the local workspace. Each repository keeps its own `.git`. No monorepo (`apps/` + `packages/`). No merging the frontend into the backend.**

- **Product consolidation ≠ Git/repository consolidation.**
- **Repository ownership is not the same as product ownership.** Kurukoo consists of multiple repositories and clients, but each capability has one canonical authority. Client repositories consume canonical backend contracts; they must not recreate backend state or business logic. The local workspace contains multiple repositories side by side. Do not merge repositories merely to eliminate folder duplication.

## Repositories

| Repository | Git remote | Role |
|---|---|---|
| `kurukoo` (this repo) | `temeaco-max/kurukoo` | Backend + canonical architecture truth. `src/` stays at root. |
| `remix-of-start-the-journey` | `temeaco-max/remix-of-start-the-journey` | Canonical web frontend. |
| `kurukoo-mobile` | (workspace `mobile/`) | Canonical mobile app (Expo/RN; iOS + Android targets). |
| Admin | (currently inside frontend repo, `public/admin/`) | Privileged client; one UI consuming the canonical Admin API. |

The `frontend/` directory inside this repo is a **workspace integration copy** of the frontend repository — synced from `remix-origin` — not a second independent frontend.

## Canonical owner table

| Concern | Canonical owner |
|---|---|
| Backend API, services, jobs | kurukoo (`src/`) |
| Conversation / chat engine | kurukoo |
| Auth (magic link, sessions, JWT) | kurukoo |
| Memory, identity profiles | kurukoo |
| Economic Requests, payments, commission | kurukoo |
| Providers, businesses, presence | kurukoo |
| Execution, Quick Ride, physical participants | kurukoo |
| Notifications (FCM, SMS, WhatsApp, email) | kurukoo |
| Admin **API** (`src/routes/admin*.ts`) | kurukoo |
| Database, migrations, external integrations | kurukoo |
| SEO endpoints (robots.txt, sitemaps, JSON-LD data) | kurukoo |
| Web UI — marketing pages | frontend repo |
| Web UI — authenticated OS (Chat, Work, Explore, Perch, Artifacts, Connect) | frontend repo |
| Web UI — admin screens | frontend repo (admin client) |
| PWA (manifest, service worker, offline, push client) | frontend repo — a capability of web, **not** a separate app |
| Shared frontend components / visual system / API clients | frontend repo |
| Mobile UI (iOS + Android) | kurukoo-mobile |
| Native device integration (camera, scanner, push SDK) | kurukoo-mobile |
| Shared API contract | kurukoo-owned contract |

## Rules

1. **Clients never copy backend logic.** Web, mobile and admin consume stable backend API contracts. Never create `web/src/services/providerLogic.ts` duplicating `src/services/…` — backend authority → API → presentation.
2. **One backend.** `mobile/kurukoo-mobile/server/` is a template-scaffolded tRPC demo/local server. It is **not** a Kurukoo backend authority. Isolate as demo-only; never extend it with product logic.
3. **EJS retires only through evidence**: replacement exists → replacement connected → consumers migrated → runtime verified → remove. Never mass-delete.
4. **Do not physically restructure folders** for aesthetics. `src/` stays at the kurukoo root; the workspace layout is the integration environment.
5. Any new capability goes to its canonical owner above. If unclear, extend the backend and expose it via API.

## Local workspace shape

```text
Antigravity/Kurukoo v2/        (kurukoo backend repo, .git)
├── src/                       ← canonical backend
├── frontend/                  ← workspace copy of the frontend repo (remotes: remix-origin)
├── mobile/kurukoo-mobile/     ← canonical mobile app
├── android/                   ← native Android build target
└── docs/
```
