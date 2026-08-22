# Tasks Route Verification — 2026-08-22

## Scope

This verification covers the dedicated authenticated **Tasks** route and its canonical lifecycle path. It does not claim verification of external execution, provider fulfilment, or real-world work completion.

| Verification area | Status | Evidence |
|---|---|---|
| Repository | **Verified** | The route reads `/api/tasks` through the shared workspace hydrator; the API delegates to `microTasks` and returns available records plus task records assigned to the authenticated owner. |
| Runtime | **Verified** | In a controlled local authenticated session, a disposable canonical task rendered as available, transitioned to in progress through `/api/tasks/accept`, then transitioned to completed through `/api/tasks/complete`; each reload reflected canonical state. |
| Real world | **Blocked external** | The lifecycle exercise used a disposable local-only record. No external execution, provider, payment, or fulfilment outcome was simulated or claimed. |

## Canonical Trace

> `micro_tasks` canonical state → authenticated `/api/tasks` projection → `kurukoo-workspace.js` hydrator → semantic Tasks metrics and queue → source-aware continuation action.

The projection includes globally available unassigned work and lifecycle records owned by the authenticated identity. It does not return work assigned to another identity. The route computes **Available work** from `available`, **In progress** from `in_progress`, and **Completed** from `completed`; it does not infer completion from display, acceptance, or any route-local data.

| Transition | Controlled-runtime result |
|---|---|
| `available` → `in_progress` | Verified through the visible **Accept task** control and canonical `POST /api/tasks/accept`. Available changed from `1` to `0`; In progress changed from `0` to `1`. |
| `in_progress` → `completed` | Verified through canonical `POST /api/tasks/complete` against the disposable local-only record. After reload, In progress changed from `1` to `0`; Completed changed from `0` to `1`. |
| Duplicate, stale, or conflicting acceptance | Verified by focused service coverage. Conditional database updates report a canonical conflict rather than creating a duplicate claim. |
| Context continuation | Verified at route level. Task cards retain canonical `sourceType` and `sourceId`; the controlled record exposed a conversation-context continuation link. |
| Empty and unavailable state | Verified by route contract. An empty queue is distinct from a `data-tasks-error` authority-read failure; neither state is populated with fake records. |

## Checks Run

The isolated branch passed TypeScript checking, focused canonical lifecycle coverage, Tasks route contract coverage, strict and full CSS audits, browser-client syntax checks, public route testing, Chat DOM-safety testing, and patch-integrity checks. Mobile composition is inherited from the established responsive workspace grid and touch-target rules; the route adds no desktop-only persistence or task-specific visual system.

## Constraints

The controlled test record was deliberately local-only and must not be interpreted as a live opportunity, provider assignment, economic request, source-of-truth external action, or evidence of real-world completion.
