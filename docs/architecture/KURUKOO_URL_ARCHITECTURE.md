# Kurukoo Canonical URL Architecture

**Status:** Canonical product URL contract

## Product model

Kurukoo is one product with three browser planes: public product/discovery, the authenticated operating environment, and Admin/Control Room.

- **Desk** is the authenticated home/workspace.
- **Agent** is the conversational intelligence exposed primarily through `/chat`.
- Durable product objects use clean resource URLs.
- Public discovery and authenticated surfaces may intentionally share a URL when the same product concept has both public and authenticated representations; the server selects the appropriate representation from authentication state.
- The filesystem is never the public URL contract.

## Canonical browser tree

### Public product / discovery

- `/`
- `/about`
- `/features`
- `/pricing`
- `/how-it-works`
- `/explore`
- `/explore/:category`
- `/discover`
- `/network`
- `/channels`
- `/topics`
- `/topics/:slug`
- `/resources`
- `/resources/:slug`
- `/partners`
- `/advertise`
- `/developers`
- `/developers/api`
- `/help`
- `/contact`
- `/blog`
- `/careers`
- `/legal`
- `/legal/:document`

### Authentication entry

- `/login`
- `/signup`

Login and signup share the same centered authentication entry pattern and are reusable from public CTAs. Authenticated state returns users to the requested canonical destination.

### Agent / conversation

- `/chat`
- `/chat/:conversationId`
- `/share/:shareId`
- `/start` is a contextual QR entry resolver that validates context and redirects into `/chat`.

### Authenticated operating environment

The authenticated browser uses clean URLs; `/app/*` is not canonical.

- `/desk`
- `/requests`
- `/requests/:requestId`
- `/reminders`
- `/reminders/:reminderId`
- `/saved`
- `/cart`
- `/tasks`
- `/tasks/:taskId`
- `/connect`
- `/connections/:connectionId`
- `/agents`
- `/agents/:agentId`
- `/capabilities`
- `/opportunities`
- `/opportunities/:opportunityId`
- `/wallet`
- `/points`
- `/top-up`
- `/subscriptions`
- `/checkout`
- `/confirmations`
- `/memory`
- `/memory/:memoryId`
- `/artifacts`
- `/artifacts/:artifactId`
- `/prayer`
- `/call`
- `/notifications`
- `/safety`
- `/settings`

`/discover` and `/topics` are shared public/authenticated surfaces: anonymous users receive the public page; authenticated users receive the authenticated representation using the same canonical URL.

### Admin / Control Room

Canonical Admin browser addresses are clean paths; `.html` filenames and `?section=` are implementation/compatibility details.

- `/admin`
- `/admin/login`
- `/admin/conversations`
- `/admin/providers`
- `/admin/requests`
- `/admin/orders`
- `/admin/economic`
- `/admin/moderation`
- `/admin/compliance`
- `/admin/notifications`
- `/admin/integrations`
- `/admin/agents`
- `/admin/users`
- `/admin/pricing`
- `/admin/referrals`
- `/admin/commissions`
- `/admin/partnerships`
- `/admin/trust`
- `/admin/social`
- `/admin/creators`
- `/admin/celebrity`
- `/admin/analytics`
- `/admin/revenue`
- `/admin/marketing`
- `/admin/advertising`
- `/admin/content`
- `/admin/curation`
- `/admin/settings`
- `/admin/seo`
- `/admin/roadmap`
- nested details such as `/admin/users/:userId`, `/admin/providers/:providerId`, `/admin/requests/:requestId`, `/admin/conversations/:conversationId`, `/admin/agents/:agentId`.

### API

The canonical API namespace is `/api/v1/*`. Existing `/api/*` endpoints remain compatibility surfaces until their individual routers are migrated and must not be emitted by new frontend code.

The current server uses `src/middleware/apiV1Bridge.ts` at `/api/v1`; it translates the versioned path into the existing canonical service-router path without duplicating domain routers. This is an intentional migration boundary, not a second API implementation.

- `/api/v1/auth/*`
- `/api/v1/users/*`
- `/api/v1/conversations/*`
- `/api/v1/chat/*`
- `/api/v1/requests/*`
- `/api/v1/orders/*`
- `/api/v1/cart/*`
- `/api/v1/checkout/*`
- `/api/v1/payments/*`
- `/api/v1/tasks/*`
- `/api/v1/reminders/*`
- `/api/v1/memory/*`
- `/api/v1/notifications/*`
- `/api/v1/discovery/*`
- `/api/v1/opportunities/*`
- `/api/v1/providers/*`
- `/api/v1/capabilities/*`
- `/api/v1/connections/*`
- `/api/v1/channels/*`
- `/api/v1/topics/*`
- `/api/v1/content/*`
- `/api/v1/agents/*`
- `/api/v1/voice/*`
- `/api/v1/calls/*`
- `/api/v1/artifacts/*`
- `/api/v1/qr/*`
- `/api/v1/platform/*`
- `/api/v1/admin/*`

Infrastructure endpoints remain `/health`, `/ready`, `/live`.

## Compatibility aliases

Legacy routes may remain temporarily, but new UI must never emit them.

- `/app` → `/desk`
- `/app/agent` → `/chat`
- `/app/<surface>` → `/<surface>`
- `/web`, `/workspace` → `/desk`
- `/subscription` → `/subscriptions`
- `/confirmation` → `/requests`
- `/admin/*.html` → corresponding `/admin/*` canonical address
- `/admin/?section=<name>` → corresponding `/admin/<name>` canonical address

Compatibility handlers must not create second page owners.

## Native / PWA deep links

Web is the canonical resource address space. PWA, iOS and Android map the same addresses to platform-native presentations when native representations exist.

The Expo Router native intent resolver (`mobile/kurukoo-mobile/app/+native-intent.tsx`) currently maps:

- `/desk` and `/chat` → native Agent/home surface
- `/discover` → native Discover
- `/requests` and `/requests/:id` → native Requests
- `/tasks` and `/tasks/:id` → native Tasks
- `/connect` and `/connections/:id` → native Connect
- unsupported durable resources → native More/overflow until a truthful dedicated detail surface exists

Native builds use `KURUKOO_PUBLIC_BASE_URL` when it is a valid HTTPS origin to configure iOS Universal Links and Android App Links. The development custom scheme remains available independently.

## Product-completeness rule

A visual reference never determines whether product content is allowed to exist. Before visual convergence, every surface must preserve its real-world purpose, user jobs, information architecture, capabilities, states, actions, navigation, truth/evidence boundaries, SEO responsibilities where applicable, canonical data owner and recovery paths.

A page is complete only when canonical URL, product purpose, content structure, navigation, functionality, visual treatment, state coverage, SEO (where public), accessibility and truth boundaries agree.
