# Kurukoo — User Outcome Contract

**Status:** Canonical product-direction contract
**Date:** 2026-08-27

## The product in one statement

> **Kurukoo is a service that helps people get things done.**
>
> You tell Kurukoo what you need, want, notice, or are worried about.
>
> Kurukoo understands the situation, works out what it can do, takes appropriate action, gets help from people or services when necessary, keeps you informed, and remembers what matters.

This is the product definition to use when making product, UX, architecture, implementation, testing, and operational decisions. Users experience Kurukoo as one service; they do not need to understand the internal machinery used to complete a job.

## What the user should experience

A user should be able to start with an intention rather than a product category, form, provider directory, workflow, or technical diagnosis.

Examples:

- “My phone is running slowly. Check it.”
- “Check my Wi-Fi.”
- “My laptop won't connect to the printer.”
- “I need someone to repair this.”
- “Find me somewhere good to eat tonight.”
- “I need to get to the airport tomorrow.”
- “Remind me to call Mum tomorrow.”
- “Keep an eye on this and tell me if anything changes.”

Kurukoo should determine what information, permissions, tools, people, services, connected resources, or other participants are useful. It should ask only for what is genuinely needed, take safe and authorised action, verify what happened where possible, and give the user a clear result.

## Capability breadth

Kurukoo is not defined by a single vertical. Device support, repairs, rides, food, delivery, shopping, discovery, reminders, tasks, memory, safety, providers, business services, connected devices, IoT, autonomous work, and physical fulfilment are examples of things Kurukoo can help people accomplish.

A new user need must first be treated as another thing Kurukoo may help get done. Do not create a separate product merely because the need belongs to a different domain.

## Direct help before escalation

When Kurukoo can safely inspect, diagnose, explain, monitor, or resolve a problem using information and capabilities available to it, it should do that before asking the user to find a human provider.

For connected devices and environments, Kurukoo should use the existing connected-resource, capability, skill, tool, agent, instruction, evidence, and execution facilities. The user should experience this as “Kurukoo checked/fixed it”, not as a device-specific subsystem.

When the required action is outside Kurukoo's available or authorised capabilities, Kurukoo should explain the boundary plainly and offer the best available continuation, including a human provider or other service when appropriate.

## No artificial capability ceilings

Do not restrict Kurukoo to a narrow list of hard-coded problem categories when the existing general-purpose reasoning, skills, capabilities, tools, instructions, connected resources, providers, or integrations can support the need.

A limitation is justified when it is caused by a real constraint such as:

- the device or platform does not expose the required capability;
- the user has not granted a required permission;
- an action is unsafe or consequential and requires confirmation/authorization;
- a provider, connector, credential, or external service is unavailable;
- reliable evidence cannot establish the claimed result;
- law, policy, privacy, or security requires a boundary.

Do not create artificial product boundaries simply because a new use case was not listed previously.

## Safety and truth still apply

“Total functionality” means removing unnecessary product and architectural restrictions, not removing safety, privacy, authorization, evidence, consent, or truthfulness requirements.

Kurukoo must never claim that it performed an action, contacted a person, fixed a problem, received a response, completed a transaction, or verified an outcome unless the relevant evidence exists.

AI may reason, communicate, plan, and coordinate. Canonical services remain responsible for consequential authority, state mutation, authorization, execution, and evidence.

## One service, many ways of getting things done

Kurukoo may use any appropriate existing mechanism:

- conversational reasoning;
- deterministic routing;
- AI models;
- skills and behaviour instructions;
- capabilities and agent tools;
- connected devices/resources;
- browser/native device facilities;
- external APIs and adapters;
- providers and businesses;
- Economic Requests;
- physical participants;
- autonomous agents;
- memory and context;
- notifications and proactive attention;
- Chat, PWA, native clients, WhatsApp, Telegram, SMS, email, voice, USSD, or other supported channels.

These are means to an outcome, not separate products in the user's mental model.

## User-facing surfaces

Every public/user-facing surface should answer one or more of these questions in plain language:

1. **What can Kurukoo help me get done?**
2. **What can I tell Kurukoo?**
3. **What is happening with something I asked Kurukoo to do?**
4. **What happened while I was away?**
5. **What does Kurukoo need from me?**
6. **What did Kurukoo discover or complete?**
7. **What can I do next?**

User surfaces should lead with outcomes, examples, choices, status, and next actions. Internal architecture terms such as capability, agent, connector, evidence, Economic Request, or execution state should not be required to understand or use the service.

## Internal / operator surfaces

Admin, operations, provider, developer, and control surfaces serve the people who run and support Kurukoo. They should expose the operational detail that users should not need to see:

- canonical object and lifecycle state;
- authority/ownership;
- capability and tool availability;
- agent goals and execution state;
- provider and connector state;
- evidence and verification state;
- permission/authorization state;
- failures, retries, expiry, idempotency and recovery;
- external activation state;
- observability and audit information;
- deployment/configuration boundaries.

Internal surfaces should be explicit and operational rather than dressed up as consumer experiences. They must still operate on the same canonical OS state and must not create parallel domain authorities.

## Notification and channel continuity

There is one Kurukoo state and conversation, regardless of where the user is interacting.

If the user is present in Chat, important results should normally appear there instead of generating redundant external notices. If the user is away, an appropriate notification/channel adapter may alert them according to their preferences, privacy settings, urgency, and channel availability.

When the user returns, Kurukoo should surface meaningful things that happened while they were away and let them continue the exact underlying work without starting again.

External channels are delivery surfaces, not separate assistants or separate sources of truth.

## Product completion test

A feature is valuable when a user can reliably get something done with it. The implementation should therefore be judged by:

- the user intention it understands;
- the outcome it can produce;
- the amount of unnecessary work it removes from the user;
- whether it can continue when the user is away;
- whether it can resolve directly before escalating;
- whether it can bring in the right person/service/device when needed;
- whether it reports uncertainty and failure honestly;
- whether the result is remembered when useful.

Internal elegance matters, but it is subordinate to useful, trustworthy outcomes.

## Whole-Kurukoo continuity rule

Every meaningful change must be checked against the whole service: public experience, authenticated Chat, PWA/native clients, memory, tasks, reminders, notifications, discovery, providers, Economic Requests, agents, connected resources, IoT, external channels, payments, physical execution, admin/operator surfaces, observability, safety, and deployment activation.

A change must not make a feature locally better while silently narrowing what Kurukoo can do elsewhere.

This contract does not replace `BLUEPRINT.md` or `CURRENT_PRODUCT_TRUTH.md`. It establishes the user-outcome lens through which those authorities and the canonical code are interpreted.