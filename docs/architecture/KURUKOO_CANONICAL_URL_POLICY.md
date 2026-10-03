# Kurukoo Canonical URL Policy

This file supersedes any older description that treats `/app/*` as the canonical authenticated browser namespace.

## Product model

- **Kurukoo** is the product.
- **Desk** is the authenticated home/workspace: `/desk`.
- **Agent** is the conversational intelligence users talk to; the conversational surface is `/chat`.
- **Conversation** is durable at `/chat/:conversationId` when addressable.
- **Shared conversation** is `/share/:shareId`.
- **Durable user objects** use clean resource URLs such as `/requests/:id`, `/tasks/:id`, `/agents/:id`, `/opportunities/:id`.
- **Admin** is the operator/control plane under `/admin/*`.
- **API target** is `/api/v1/*`.

## Canonical authenticated browser URLs

`/desk`, `/discover`, `/topics`, `/requests`, `/requests/:id`, `/reminders`, `/reminders/:id`, `/saved`, `/cart`, `/tasks`, `/tasks/:id`, `/connect`, `/connections/:id`, `/agents`, `/agents/:id`, `/capabilities`, `/opportunities`, `/opportunities/:id`, `/wallet`, `/points`, `/top-up`, `/subscriptions`, `/checkout`, `/confirmations`, `/memory`, `/memory/:id`, `/artifacts`, `/artifacts/:id`, `/notifications`, `/safety`, `/call`, `/prayer`, `/settings`.

The authenticated header, primary sidebar and contextual inspector are shared across these surfaces. The inspector is a drawer for the current resource/context, not a second navigation tree.

## Compatibility

`/app/*`, `/app`, `/app/agent`, `/web`, `/workspace`, `/subscription` and `/confirmation` are legacy compatibility addresses. They redirect toward the clean namespace and must not be emitted by new UI code.

## Universal entry

`/chat` is not nested under `/desk`: Agent is a universal product capability and can be entered from public CTAs, QR/context links, notifications, Desk and external channels.

## Public product website

The public site is a product site for Kurukoo, not a mirror of internal services. Public routes explain the product and answer search intent. Core product pages include `/about`, `/features`, `/pricing`, `/discover`, `/network`, `/channels`, `/topics`, `/resources`, `/how-it-works`, `/help`, `/partners`, `/advertise`, `/developers`, `/legal` and `/blog`.

## Page completeness rule

URL cleanup must never delete page content, product functionality, states, user jobs, navigation, SEO structure or a capability. Visual references govern presentation, not product completeness. A capability without a standalone page must be represented through the canonical surface where it naturally belongs: Agent/Chat, Desk, Discover, Requests, Tasks, Connect, notifications, contextual actions or Admin.
