# Kurukoo Current Product Truth

## Canonical definition

**Kurukoo is a conversational operating system for coordinating everyday intentions with people, services, products, places and bounded agents.**

Kurukoo can help directly, preserve context, discover options, coordinate participants, prepare an Economic Request or continue work over time. External fulfilment remains conditional on availability, authorization, evidence, configured providers and real-world confirmation.

## Discover truth

**Discover is Kurukoo's opportunity and activity surface, not merely a map.** It composes the existing Discovery Network/Pulse, Topics, Opportunities, approved advertising placements, canonical skill catalogue and Chat/agent handoff into six views: **For You, Nearby, Today/Daily Picks, Topics, Opportunities and Explore Kurukoo**. Discover items can be opened in exact Chat context and, where appropriate, watched, followed or saved. A watch is an owner-scoped persistent interest that is designed to become the bridge to bounded background/agent monitoring rather than a duplicate task system.

The map is only a presentation layer. Discover never invents nearby providers, availability, offers or source evidence. Sparse and empty areas remain useful through Explore Kurukoo, Ask Kurukoo, Topics and watch/follow/save actions. Sponsored Discover placements come only from the existing approved `adManager` campaigns targeting `public_discovery` and are explicitly disclosed.

## Integrated control-plane truth

The Admin Control Room is the operator surface over the same canonical platform used by Web, PWA, iOS and Android. It does not own a parallel provider registry, conversation store, payment state, notification queue or fulfilment engine. Its platform projection reads client surfaces, readiness, integration activation, notifications, trust/evidence, economic state and scale-transition prerequisites. Admin mutations re-enter owning domain services; dispute resolution follows the canonical dispute → escrow → Economic Request lifecycle. The legacy Admin dashboard redirects to `/admin/` so there is one canonical Admin home.

## Architecture rule

```text
User → Conversation → Intent/AI → Canonical Skill
     → Native Assistance OR Economic Request OR canonical capability
     → Shared Memory / Presence / Network / Agent / Notification services
     → truthful result → continued conversation

Discover → existing Topics / Nearby / Opportunities / Ads / Skills
         → Chat / Watch / Follow / Save
         → canonical agent or Economic Request when the user chooses to act
```

Category-specific behaviour belongs in configuration, skill metadata and shared capability services. It must not create a separate economic engine unless a genuinely new architectural boundary is proven.

## Deployment truth

The repository is currently a single-process `sql.js` launch architecture. Real external execution remains provider-dependent. FCM delivery, linked WhatsApp/Telegram sessions, Stripe settlement/reconciliation, routable private-number masking, provider onboarding/verification, production dispatch, production object storage, WebRTC relays and MQTT/IoT infrastructure remain separately evidence-gated. UI and Chat must never represent an unavailable external action as completed. The Admin scale-readiness projection also prevents multi-worker configuration from being treated as safe without approved durable persistence and shared coordination state.

## PWA and native-client truth

The PWA is the reference application experience for native iOS and Android clients. Public web remains the discovery/SEO/resources/marketing layer; the installed application remains the conversation-first personal workspace with requests, reminders, saved items, notifications, Discover, tasks, Points, safety, memory and account state. Future native clients inherit the same product interaction model and design system. Native Discover consumes the same canonical `/api/discover/home` experience rather than maintaining a separate discovery catalogue.

## Conversational intelligence truth

`canonicalChatTurnService` remains the sole turn authority. It assembles bounded context, uses Brain/context arbitration, then passes decisions to deterministic routing and `unifiedAiEngine`. Canonical services own consequential state mutation. Local SmolLM2 remains advisory and provider-neutral fallback behaviour stays truthful when hosted AI is unavailable.

## Identity truth

The guest authentication boundary rejects ordinary task, food, location, repair and request-shaped text as an identity name unless the user explicitly introduces a name. “My name is …”, “I’m …” and “Call me …” remain supported, preventing request text from silently becoming canonical Memory Profile identity state.

## Capability, agent and learning truth

The universal capability protocol is advisory and typed; canonical services own permissions, consent, state transition, evidence, execution and recovery. First-class agents reuse `aiAgentService`, `internalCoordinator`, `agentRuntime` and `unifiedAiEngine`. The student-model programme remains guarded by human curation, provenance, coverage, hardware and promotion gates. No trained production student activation is implied without independent evidence.
