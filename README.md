# Kurukoo — Everyday, Sorted

**Tagline:** Wake up. Get going.

> **Kurukoo is a service that helps people get things done.**
>
> You tell Kurukoo what you need, want, notice, or are worried about.
>
> Kurukoo understands the situation, works out what it can do, takes appropriate action, gets help from people or services when necessary, keeps you informed, and remembers what matters.

That is the product. Users do not need to understand whether Kurukoo used a skill, capability, agent, AI model, connected device, provider, API, or another internal mechanism. Those are ways Kurukoo gets the job done.

## What Kurukoo can help with

Kurukoo is not limited to a single category or vertical. You can start with a need in your own words and Kurukoo can help with things such as:

- fixing and troubleshooting phones, tablets, computers and other technology;
- checking connected devices, networks and supported IoT resources;
- finding and coordinating people who can do work for you;
- rides, food, deliveries, shopping and other everyday services;
- reminders, tasks, follow-ups and things you want Kurukoo to keep track of;
- discovering useful services, places, opportunities and information;
- buying, sourcing or arranging products and services when supported;
- coordinating providers, businesses, contributors and physical participants;
- monitoring work and telling you when something needs your attention;
- continuing work across Chat and supported external channels;
- helping providers and operators get work done as well as helping consumers.

This list is illustrative, not a hard ceiling. A new need should be considered another thing Kurukoo may be able to help accomplish before a new product or subsystem is proposed.

## How it should feel

You should be able to say:

> “My laptop is slow. Check it.”

Kurukoo should use the information and capabilities actually available to it, ask for permission when required, diagnose what it can, safely fix what it can, verify the result where possible, and tell you plainly what happened. If the problem needs a person, Kurukoo should be able to continue by finding and coordinating the appropriate help rather than making you start again.

The same principle applies to a request such as:

> “Check my Wi-Fi.”

or:

> “I need someone to repair this.”

The user starts with the outcome. Kurukoo works out the route.

## One Kurukoo across the service

Web, PWA, iOS and Android are first-party presentations of the same Kurukoo service. Chat is the primary conversational control surface. WhatsApp, Telegram, SMS, email, FCM, Voice, USSD and other channels are delivery/interaction paths when configured; they do not become separate assistants or separate sources of truth.

Kurukoo can also work with connected resources, providers, businesses, autonomous agents and physical participants. When direct software help is possible, it should prefer that before unnecessary escalation. When a human or external service is needed, Kurukoo should carry the useful context into the handoff.

## Architecture — for people building Kurukoo

The implementation is intentionally composable. Existing skills, behaviour instructions, capabilities, agent tools, connected resources, AI adapters, canonical services, Economic Requests, providers, physical participants, evidence, memory, notifications and channels should be reused and extended before new subsystems are introduced.

The architectural rule is therefore **not** “keep Kurukoo artificially bounded to the features already listed.” It is:

> **Maximise useful capability while preserving genuine safety, privacy, consent, authorization, security, legal and evidence boundaries.**

AI may interpret, reason, communicate and coordinate. Canonical services retain consequential authority, mutation, execution and evidence so that Kurukoo can be both capable and truthful.

## User-facing surfaces

Public and authenticated user surfaces should lead with outcomes rather than internal architecture. They should help answer:

- What can Kurukoo do for me?
- What can I ask it?
- What is happening with something I asked it to do?
- What does it need from me?
- What happened while I was away?
- What can I do next?

The UI should make complex work feel simple without hiding important confirmation, permission, uncertainty or failure states.

## Internal surfaces

Admin, operations, provider and developer surfaces are intentionally different. They expose the information needed to run the service: canonical ownership, lifecycle state, capability/tool availability, agent goals, provider/connector health, evidence and verification, authorization, failures, recovery, audit information and deployment activation.

Internal surfaces operate on the same canonical OS state; they must not create parallel consumer workflows or authorities.

## Repository authorities

- `BLUEPRINT.md` — canonical long-range product and architecture intent.
- `docs/product/KURUKOO_USER_OUTCOME_CONTRACT.md` — canonical user-outcome lens for product and implementation decisions.
- `docs/architecture/CURRENT_PRODUCT_TRUTH.md` — current-state truth and verification authority.
- `AGENTS.md` — engineering rules for keeping implementation aligned with the whole service.
- `BLUEPRINT_IMPLEMENTATION_ADDENDUM.md` — implementation companion.
- `BLUEPRINT_AI_MODEL_ADDENDUM.md` — AI/student-model extension.
- `docs/KURUKOO_AI_MODEL_SYSTEM.md` — AI model architecture and completion contract.
- `docs/KURUKOO_PRODUCTION_AND_LEARNING_PIPELINES.md` — production and offline learning pipelines.
- `BUILD_STATUS.md` — route ownership and release verification status.
- `SECURITY_AUDIT_STATUS.md` — security posture, manual operator actions and scale transition criteria.
- `ECOSYSTEM.md` — economic taxonomy.
- `CONTROLLED_PILOT.md` — production environment, release, rollback and external activation profile.
- `CACHING.md`, `DATA_RETENTION_POLICY.md`, `POINTS_COMPLIANCE.md`, and `WHATSAPP_CONTINGENCY.md` — operating policies.

## Current implementation

| Area | Current implementation |
|---|---|
| Composition root | `src/index.ts` performs startup and mounts canonical route boundaries. |
| HTTP boundaries | `src/routes/*` owns HTTP routes and canonical public/authenticated/admin boundaries. |
| Services and skills | `src/services/*` owns business orchestration. `skillFlows.ts` is the canonical Economic Request skill, requirement, capability and lifecycle catalogue. |
| Economy | A single economic lifecycle handles rides, food, repair, work, product sourcing, tickets, and other supported requests. |
| Identity | One canonical authenticated identity and Memory Profile model; no parallel consumer identity silos. |
| Authorization | Consequential user-owned operations require explicit authentication/authorization at their canonical boundaries. |
| Database | `sql.js` runs in-process and persists to `kurukoo.sqlite` (`DB_PATH` override); the current launch model is single-process until PostgreSQL/Redis transition criteria are met. |
| Channels | Web Chat is active; external channels remain adapter boundaries whose availability depends on truthful configuration and independent verification. |
| Connected resources | Existing connected-resource services support device/IoT-style resources and exposed capabilities; actual device capability depends on the device, client, protocol and granted permissions. |
| Agents | The canonical agent runtime composes goals, instructions, skills, tools, capabilities and existing OS services; it is not a collection of isolated vertical assistants. |
| Evidence | Consequential outcomes remain evidence-bound and independently verifiable. |

## Quick Start

Kurukoo uses **npm 10.9.2** and commits `package-lock.json` for reproducible installs. Use Node.js 22.

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run dev
npm run lint
npm run build
npm run test:routes
npm run audit:complete
npm run audit:css:all
npm run audit:security
npm run pilot:readiness
npm run test:pilot-readiness
npm run test:pilot-production-guards
npm run test:whatsapp-webhook-boundary
npm run test:fresh-database
```

## Controlled development/test Chat

The verified canonical release branch is `main`, which is also the GitHub default branch. Kurukoo includes an explicit development/test authentication mode for exercising the real canonical Chat without a live OTP delivery provider. Enable it only outside production with `KURUKOO_DEV_AUTH=true`, `KURUKOO_TEST_PHONE` and optionally `KURUKOO_TEST_NAME`. The deterministic development code is accepted only for that configured identity while `NODE_ENV` is not `production` and does not bypass provider verification, payment, Economic Request ownership, or other execution boundaries.

The authenticated Chat uses the same conversation, Memory Profile, Living Memory, routing, skill, native-assistance, Economic Request, deferred-request, agent, notification and response-persistence services as other user journeys.

## Production transition points

The current launch architecture is intentionally cost-effective but has clear boundaries. Do not run multiple application replicas against the `sql.js` file or assume process-local rate limits coordinate across replicas. Move to PostgreSQL and Redis when high availability, concurrent multi-instance writes, distributed rate limiting/presence, or sustained scale requires them.

Payment, regulated escrow, real provider/identity verification, malware-scanned object storage, external FCM delivery, and provider-console credential rotation remain operational requirements. The application must not claim that a database record, indicative rate, sandbox payment, or profile is proof of an external financial, verification, availability or fulfilment event.

## Security notes

Current CI includes build, test, custom audit, FastText, and secret-scan jobs. The current environment templates contain placeholders only. See `SECURITY_AUDIT_STATUS.md` for the current status and residual risks.

## Stack

`express` · `ejs` · `sql.js` · `mqtt` (Universal Remote/IoT) · `dotenv` · `tsx` · `typescript` (strict)
