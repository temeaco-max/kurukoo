# Kurukoo engineering rules

## Product promise

> **Kurukoo is a service that helps people get things done.**
>
> You tell Kurukoo what you need, want, notice, or are worried about.
>
> Kurukoo understands the situation, works out what it can do, takes appropriate action, gets help from people or services when necessary, keeps you informed, and remembers what matters.

Build the product to make this promise real. Users do not care how Kurukoo accomplishes an outcome. Skills, capabilities, agents, tools, MCP, AI providers, connected resources, Economic Requests, providers, channels and internal services are implementation means.

## Build priorities

1. **Working outcome:** a person can ask for something naturally and reach a useful result.
2. **Excellent experience:** every visible state is polished, clear, responsive and intentional on desktop and mobile.
3. **Continuity:** work survives navigation, interruption, channel changes and time away; Kurukoo knows what happened when the person returns.
4. **Breadth:** the same service helps with personal assistance, information, devices, services, people, products, places, tasks, reminders, discovery, commerce, providers, economic coordination, agents, connected devices, IoT, communication and physical execution.
5. **Reliability:** failures recover gracefully and never leave the person needing to restart unnecessarily.
6. **Internal quality:** implementation should be reusable, maintainable and coherent, but internal cleanliness exists to serve the outcome.

Do not turn an implementation slice into the definition of Kurukoo. Repair is one use case, not the product. The whole service remains in scope.

## User perspective

User-facing surfaces must answer:

- What can Kurukoo do for me?
- What is Kurukoo doing now?
- What does Kurukoo need from me?
- What happened?
- What can I do next?

Use plain language. Lead with outcomes, not architecture. Prefer conversation and sensible defaults over forms and configuration. Do not make users select internal concepts such as skills, capabilities, agents, providers or execution modes unless that choice is genuinely useful to them.

The authenticated OS should feel like one place to get things done. Chat is the conversational control surface, while native surfaces provide useful visual control, history, status and direct access to ongoing work. They are not competing products.

## Internal perspective

Admin, operator, provider and developer surfaces may expose the detail needed to run Kurukoo: ownership, execution, integrations, credentials state, evidence, errors, queues, agent work, recovery controls and technical identifiers. Keep these concerns out of ordinary user experiences.

## Capability composition

Before creating a new subsystem, use what Kurukoo already has. Existing skills, behaviour instructions, capability registrations, agent tools, AI/model adapters, canonical services, connected resources, Economic Requests, providers, channels, notifications and memory should be composed and extended wherever they can accomplish the outcome.

Do not create a parallel device layer, repair engine, agent family, notification system, provider system or orchestration authority when existing Kurukoo primitives can do the job.

Remove artificial product restrictions when existing capabilities can reasonably support more. In particular, do not constrain assistance to a single device type or narrow workflow when the same machinery can understand and act on a broader user need.

Retain genuine safety, privacy, consent, authorization, security and legal protections. These are product requirements, not obstacles to remove.

Kurukoo should prefer direct help before escalation. If it can safely inspect, diagnose, explain, monitor or resolve something with available and authorised capabilities, do that first. If a human, provider, service or connected resource is needed, carry the useful context forward so the person does not repeat themselves.

## Channels and continuity

Web, PWA, iOS, Android, voice, WhatsApp, Telegram, SMS, email, push and future channels are ways for the same Kurukoo service to reach the person. Do not create separate conversations or sources of truth for each channel.

If the person is present in Chat, show the result there. If they are away, use an appropriate enabled notification/channel. When they return, surface important unfinished or completed work naturally and offer the next useful action. Never claim delivery that did not occur.

## Device and connected-resource assistance

When an authorised client can provide device, network or connected-resource information, Kurukoo should use it to reduce unnecessary questions and improve diagnosis. Prefer direct inspection and safe remediation where supported. If the problem requires physical intervention, escalate to an appropriate human provider with the diagnostic context already gathered.

This applies broadly to phones, tablets, computers, Wi-Fi/networking, printers, TVs, cameras, wearables, appliances and IoT—not only phone repair.

## AI and agents

AI may interpret, reason, communicate and coordinate. Agents should reuse the same canonical capabilities and tools available to the service rather than becoming a separate product. Assign work to an agent when ongoing reasoning, monitoring, diagnosis, coordination or instruction-following makes that useful.

Use the cheapest sufficient model/provider for each task, with graceful fallback where possible. Never invent facts, external results or completed actions.

## Memory

Memory is a cross-service continuity capability. Use it for approved identity, preferences, context, request continuity, agent goals and proactive assistance. Do not treat memory as proof of current price, availability, verification, payment or fulfilment.

## Visual quality

Treat visual quality as part of functionality. Build complete states, not bare routes:

- loading
- empty
- active
- progress
- success
- waiting
- needs input
- error
- offline/reconnect
- notification
- returning user
- mobile and desktop layouts.

Use the existing visual system and consolidate rather than multiplying near-duplicate styling authorities. User-facing pages should feel like one coherent, premium Kurukoo OS.

## Implementation discipline

Work directly toward useful product capability. Do not spend implementation cycles producing audit reports, readiness reports, convergence reports, verification snapshots or documentation whose only purpose is to describe work instead of improving the product.

Do not add a new abstraction merely to rename an existing one. Do not leave a capability stranded because an external integration is unavailable: make the locally possible portion useful and give the person a clear next step when an external dependency is genuinely required.

When external credentials or services are absent, keep the underlying feature architecture reusable and make the user experience truthful and actionable. Do not manufacture external success.

`main` is the canonical integration branch. Use short-lived implementation branches and integrate useful work promptly. Avoid parallel product architectures.

The final measure of a change is simple: **does Kurukoo now help a person get something done better, more broadly, more reliably or more beautifully?**