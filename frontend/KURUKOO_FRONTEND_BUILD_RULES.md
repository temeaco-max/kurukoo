# Kurukoo frontend build rules

These rules are product invariants for the frontend. New surfaces should reuse them rather than creating a parallel interpretation of Kurukoo.

## Product mental model

- **Field / For You** is the multi-purpose personal operating view. It is not a generic dashboard and not only a request inbox.
- **Conversation** is the universal control surface: users can tell or ask Kurukoo what they want done.
- **Explore** helps people start from a goal; it should lead naturally into Conversation or a canonical action.
- **Nearby / Discover** exposes useful local people, places, offers and activity with clear evidence/freshness/availability states.
- **Work** follows requests and execution.
- **Activity** shows attention, updates and things needing the user's response.
- **Memory** provides private continuity.
- **Topics** provide moderated community context; community context is never presented as fulfilment proof.
- **Resources** is the canonical learning surface. Video is a content format and contextual guide, not another OS silo.
- The public/context rail is supporting context, not a documentation column. Prefer a compact useful guide, current work, nearby context, memory, safety or relevant network signal over explanatory prose.

## Eight Kurukoo participation roles

The network serves eight participation roles. These are roles in one network, not eight separate products, and one person or organisation can participate in more than one.

1. **People who need something** — seek help, services, products, information or coordination.
2. **People who provide it** — offer skills, services and availability.
3. **Businesses** — offer products/services and turn relevant demand into customers and work.
4. **Creators** — publish useful content, ideas and community knowledge.
5. **Contributors** — add useful knowledge, participation and community value.
6. **Partners** — bring services, capabilities or distribution into the network.
7. **Advertisers** — present relevant commercial offers to useful audiences with clear sponsorship disclosure.
8. **Local agents** — represent and coordinate local needs, places and opportunities.

The canonical role definitions live in `src/lib/kurukoo-personas.ts`. Field uses them for role-aware presentation until a canonical backend profile/role signal is available. Public-shell participation cards derive from the same role registry so the eight-role network story cannot drift from the authenticated experience.

## UX language

- Lead with the user's goal or action, not architecture.
- Prefer **Ask Kurukoo**, **Get it done**, **Find**, **Follow**, **Confirm**, **Go Live**, **Open**, **Watch** and similar verbs.
- Do not expose internal terms such as Economic Request, convergence, evidence gates, provider taxonomy or lifecycle in ordinary UI unless a compact status genuinely needs them.
- Truth semantics still apply: distinguish claimed, verified, available, sponsored, preview/demo and stale information without long explanations.
- Never fabricate live providers, availability, pricing, payments, external AI connections or backend capabilities.
- Preserve existing demo/preview content where useful, but label it honestly.
- Avoid multiplying the product into dozens of mini-apps. Use shared task surfaces and canonical flows.

## Field / For You rule

Field should combine:

1. a direct **Tell Kurukoo what needs doing** entry point;
2. role-aware **For You** cards based on the user's current participation role(s);
3. attention and moving work;
4. Radar / nearby signals;
5. useful network/community surfaces;
6. contextual learning through Resources/guides rather than explanatory blocks.

The eight-role network explainer should remain compact. The role cards should be horizontally scrollable without a visible scrollbar so the network can be understood without consuming vertical space.

## Public-shell Home role layout

On the public Home page (not the authenticated Field workspace), keep the network introduction as the left-hand block at desktop widths, using exactly:

**Who Kurukoo serves**

## One network, many ways to participate.

Kurukoo brings together people who need something, people who provide it, businesses and creators, contributors and partners, advertisers and local agents.

The eight participation cards sit to the right in a single horizontal row. They retain their existing typography, font sizing, spacing, card design and copy. The row is horizontally scrollable with no visible scrollbar to conserve vertical space. On smaller screens the introduction may stack above the row.

## Contextual guide rule

The public context rail should use the existing compact visual-demo/video-card language for a contextual **How to** guide. The guide should change with the current page and, where useful, the selected participation role, and should link to the canonical `/resources` guide rather than creating a separate video silo. Do not replace the rail with explanatory documentation.
