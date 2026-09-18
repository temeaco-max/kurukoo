# Frontend ↔ Backend Vertical Build Rule

This document is intentionally short. It exists to prevent the frontend from becoming a collection of screens disconnected from Kurukoo's real execution system.

## Locked pairing

Canonical frontend: `temeaco-max/remix-of-start-the-journey`

Canonical backend: `temeaco-max/kurukoo`

Integration branch: `main`

For every product capability, implementation proceeds as one vertical slice:

1. **User intent** — the user can state the goal naturally.
2. **Frontend state** — the UI shows understanding, progress, choice, consent, waiting and completion states.
3. **Canonical API** — the frontend calls the existing backend boundary rather than inventing local business logic.
4. **Backend state** — the request, participant, execution and evidence state is persisted by the canonical service.
5. **Execution** — digital, physical, hybrid or user-assisted action occurs only within its authorization and evidence boundary.
6. **Outcome** — Work/Activity reflects the canonical state.
7. **Proof** — completion claims are tied to actual evidence.
8. **Recovery** — failure, missing input, external dependency and escalation states are visible and actionable.
9. **Tests** — the backend has a behaviour check and the frontend has a render/interaction check where appropriate.

## First-class verticals

The implementation order is outcome-led, not page-led:

- conversational assistance;
- discovery and selection;
- provider/business coordination;
- product and commerce outcomes;
- reminders and follow-up;
- digital/browser execution;
- physical execution;
- hybrid execution;
- cross-border execution;
- memory and continuity;
- trust, consent and evidence;
- payments and transaction state;
- messaging and external channels;
- agents and bounded autonomy;
- resources/content/topics/opportunities that can lead into action.

Existing components and backend services should be reused before creating parallel engines.

## Definition of done

A feature is not complete because a screen exists, and it is not complete because an endpoint exists.

It is complete when a real user can enter the intended goal, Kurukoo can truthfully process the request through the supported path, and the UI can show the resulting state or the precise reason it cannot proceed.
