# Kurukoo Client Feature Coverage Matrix

This matrix prevents client work from forgetting OS capabilities. It is a coverage map, not a claim that every external provider is live.

## Client families

- **Web App:** marketing + authenticated browser application.
- **PWA:** mobile-oriented Web App client with install/offline/update capabilities.
- **Native:** iOS + Android Expo client.
- **Admin:** operator/control plane.

## Feature coverage

| OS capability | Web | PWA | iOS/Android | Admin | Canonical authority |
|---|---|---|---|---|---|
| Identity / progressive trust | Yes | Yes | Yes | Operator view | auth/progressiveIdentity |
| Chat / conversation | Yes | Yes | Yes | diagnostics | canonicalChatTurnService |
| Context arbitration | Yes | Yes | Yes | telemetry | contextArbitration |
| Memory Profile | Yes | Yes | Yes | operator tools | memoryProfile |
| Safety / emergency | Yes | Yes | Yes | directory/controls | safety + interaction policy |
| Reminders | Yes | Yes | Yes | runtime telemetry | reminderService |
| Notifications | Yes | Yes | Yes | delivery readiness | notification services |
| Economic Requests | Yes | Yes | Yes | operations | economicRequest lifecycle |
| Requests / Orders | Yes | Yes | Yes | operations | request/order services |
| Checkout / Confirmation | Yes | Yes | Yes | payment ops | checkout/economic services |
| Discover / Nearby Pulse | Yes | Yes | Yes | network ops | discovery + nearbyPulse |
| Opportunities | Yes | Yes | Yes | campaign/ops | opportunityEngine |
| Agents | Yes | Yes | Yes | agent controls | agentRuntime |
| Agent goals / pause / resume | Yes | Yes | Yes | controls | agentRuntime |
| Skills / Skill Flows | yes via Chat/workspaces | yes | yes | registry | skill registry/flows |
| Capability Portfolio | Yes | Yes | Yes | operator view | capability registry/portfolio |
| Provider / contributor roles | Yes | Yes | Yes | onboarding/ops | capability + provider services |
| Go Live / presence | Yes | Yes | Yes | network ops | Pulse/presence |
| Artifact History | Yes | Yes | Yes | retention/audit | ArtifactService |
| Google Drive storage | Yes | Yes | Yes | readiness | StorageRouter/Drive adapter |
| Voice notes | Yes | Yes | Yes | diagnostics | voiceRouter + ArtifactService |
| AI live voice | Yes where supported | Yes where supported | yes | provider readiness | voiceService |
| Kurukoo Call | Yes | Yes | Yes/native validation | diagnostics | WebRTC signalling + client |
| Channels / external integrations | Yes | Yes | Yes | readiness matrix | externalIntegrationReadiness |
| WhatsApp | Yes | Yes | Yes | channel ops | WhatsApp adapter |
| Telegram | Yes | Yes | Yes | channel ops | Telegram adapter |
| Email / push | Yes | Yes | Yes | delivery ops | channel adapters |
| Wallet | Yes | Yes | Yes | finance ops | wallet/payment services |
| Top Up | Yes | Yes | Yes | finance ops | topup/payment services |
| Points | Yes | Yes | Yes | economy ops | points services |
| Subscriptions | Yes | Yes | Yes | revenue ops | subscription services |
| Ads / Sponsored content | Yes | Yes | Yes where surfaced | campaign ops | advertising services |
| Topics / community | Yes | Yes | Yes | moderation | topic services |
| Resources / Help | Yes | Yes | Yes | content | content routes/services |
| Partners | Yes | Yes | Yes | partnership ops | partnership services |
| Contributor tasks | Yes | Yes | Yes | task ops | task/contributor services |
| Sports / events | Via canonical skills | via mobile surfaces | via native surfaces | operations | skills/agents/events |
| Prayer Companion | Yes | Yes | Yes | agent controls | prayer agent/capability |
| Student model runtime | indirect through OS | indirect | indirect | model controls | studentModelRegistry/runtime |
| Teacher network | not direct | not direct | not direct | provider controls | unified AI/provider router |
| Training pipeline | no end-user action required | no | no | yes | Behaviour Pack/ML/registry |
| Audit/security | implicit | implicit | implicit | Yes | audit/security services |

## Representation rule

If a feature exists in the OS but is not useful as a full standalone navigation destination, represent it through the appropriate canonical surface: Chat, Agent, Requests, Tasks, Discover, Connect, Account, contextual cards, notifications or Admin.

Do not hide a capability simply because an external provider is not configured. Show the appropriate readiness/disabled/setup-required state.

Calls and participant messaging are represented only after a canonical provider or peer conversation exists. A selected-provider conversation can expose request-linked messaging, a Call icon when its session reports an enabled WebRTC room, and a Nearby Radar handoff only after the provider has shared tracking activity. Global header controls must not imply a call target or active external channel.

## Client navigation rule

### Mobile/PWA primary navigation

1. Agent
2. Discover
3. Requests
4. Tasks
5. More

Connect, Wallet, Points, Top Up, Subscriptions, Profile, Memory, Artifacts, Notifications, Capabilities and Settings remain reachable through More/account configuration rather than competing for a high-frequency tab.

### Web App

The authenticated Web App uses clean canonical routes. `/desk` is the workspace home and `/chat` is the one user-facing Agent/conversation surface. `/agents` is the separate Agent directory/runtime surface. Legacy `/app/*` paths are compatibility aliases only and must normalize to their clean canonical destinations; `/app/agent` specifically normalizes to `/chat`, never `/desk`.

The Web App must retain the mobile/PWA information architecture beneath its responsive composition. Dedicated product jobs remain on their canonical surfaces rather than being replaced by a generic Desk or Chat fallback.

### Marketing

Marketing pages explain and attract; they do not implement a parallel version of authenticated OS behavior. CTAs hand off to the Web App/Chat using canonical routes and identity.

### Admin

Admin surfaces operational controls and evidence; it does not become another user-facing execution engine.

## Completion states

Each feature is tracked independently as:

- represented;
- implemented;
- contract-tested;
- credential/device-ready;
- live-verified;
- production-active.

This prevents “present UI” from being mistaken for “complete system” and prevents missing keys from being mistaken for missing code.
