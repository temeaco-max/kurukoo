# Nairaland → Kurukoo Community / Topics Convergence Audit

**Status:** Architecture audit only. **No Topic, forum, social-graph, or replacement content code has been created by this audit.**

## Decision

Kurukoo should adopt **Topic** as its durable shared-content primitive, but it should not become a forum clone. The appropriate product model is **Conversation ↔ Topic ↔ Action**: a conversation remains private and interactive, a Topic is a shared and quality-governed record, and an Action continues through the existing request, provider, reminder, economic, and execution boundaries.

> **A Topic is public or shared context. It is not evidence of a live provider, price, availability, event, transaction, verification, payment, delivery, or fulfilment.**

The repository does not currently contain an active, safe Topic authority. The legacy `community_posts` table is schema-only: a repository-wide usage search found no service, route, public surface, or regression that reads or writes it. It has only `id`, `author`, and `content`, so it cannot safely support ownership, visibility, moderation, taxonomy, replies, location privacy, quality, SEO eligibility, contributor evidence, or action handoff. It should be treated as **obsolete schema residue**, not revived as the product foundation.

The smallest justified addition is therefore a narrowly scoped canonical **Topics persistence and service boundary** within the existing application database. It is not `TopicEngineV2`, a social graph, a duplicate identity model, a separate search cluster, a second SEO engine, a new Points currency, or a transaction system. Its purpose is only to own durable, authenticated, quality-governed community records and their replies. Existing components remain authoritative for all other concerns.

## What Is Worth Adapting

Nairaland’s current public materials demonstrate three transferable mechanisms: a durable topic index organised by context, concise topic metadata that makes genuine discussions discoverable, and explicit section-targeted advertising with approval, prepaid credit, disclosure, and measurement. [1] [2] Kurukoo should adapt those mechanisms—not Nairaland’s forum hierarchy, dense tables, raw-view incentives, or legacy presentation.

Kurukoo’s advantage is that a genuine Topic can be classified into existing categories and skills, verified by contributors, connected back into private chat, and handed into the existing action lifecycle only after user intent and canonical evidence are present. This creates a clean acquisition-to-action path while preserving the conversation-first mandate.

| Adapted mechanism | Kurukoo adaptation | Explicitly not adopted |
|---|---|---|
| Durable user-created pages | Quality-gated public Topic URLs with real authoring, replies, provenance, and freshness | Mass-generated thin SEO pages |
| Context organisation | Existing category, skill-flow, and broad location context | A second forum taxonomy |
| Recurring discovery | Discover and search projections of public, quality-qualified Topics | Fabricated trends, activity, views, or popularity |
| Community input | Authenticated Topics and replies, with contributor verification tasks | Fake users, AI-written community activity, or raw engagement farming |
| Contextual commercial inventory | Later, disclosed use of existing `adManager` after public Topic quality is proven | Hidden sponsorship, personal-conversation targeting, or safety-flow ads |

## Repository-Backed Convergence Map

| Required capability | Canonical owner | State | Decision |
|---|---|---:|---|
| Private conversation, memory, and requests | `chatRouter`, `chatConversationService`, `intentRouter`, Economic Request boundary | Active | Reuse unchanged. A Topic link only opens the existing chat/request path. |
| Public editorial CMS resources | `contentManager`, `content` table, `contentRoutes`, admin Content Studio | Active but editorial | Extend only as an optional, human-reviewed promotion target. It cannot directly own user Topics because it lacks user ownership, privacy, moderation, replies, and topic context. |
| Legacy community posts | `community_posts` table | Obsolete/incomplete | Do not revive. No active route/service/test uses it and the schema cannot satisfy the safety requirements. |
| Topic persistence, visibility, replies, reports, and lifecycle | No existing adequate owner | Genuine new requirement | Add the smallest `topics` and `topic_replies` persistence with a single service and route boundary. |
| Category and skill interpretation | Existing `intentRouter`, FastText, skill flows, category data | Active | Reuse. A Topic stores validated references; it never defines an independent category hierarchy. |
| Low-cost classification | `fastTextService`, deterministic router rules/cache, `unifiedAiEngine` | Active | Reuse in the stated escalation order. No per-Topic expensive-model default. |
| Contributor evidence and moderation reward | `microTasks`, `taskRoutes`, `pointsEngine`, `credit_transactions` | Active | Extend task linkage to a Topic; preserve evidence submission, moderation, idempotent approval, and existing Points ledger. |
| General content moderation | No complete public-content moderation workflow | Incomplete | Add Topic-specific report/review states inside the new narrow Topic boundary; reuse existing safety controls and admin review patterns. |
| Public content projection | `contentRoutes` and public EJS routes | Active for CMS only | Add public Topic listing/detail routes separately, never dilute CMS resource rules. |
| SEO metadata, FAQ, schemas, audit, redirects | `seoService`, SEO admin routes, shared public head | Active but static-page oriented | Extend the existing SEO service with Topic metadata/sitemap projection only after a Topic passes quality gates. |
| Sitemap | `seoService.getSitemapIndex/getChildSitemap` | Incomplete for dynamic content | Extend the existing sitemap owner with a Topic child sitemap; do not create another sitemap engine. |
| Discover / Nearby Radar | `discoveryRoutes`, `nearbyPulse` | Active but provider-presence-only | Keep the map unchanged. Add a separate non-geocoordinate Topic projection to the Discover page only after publication and locality eligibility. |
| Daily Picks | `dailyPicks.ts` | Dormant / unsafe legacy sample | Do not feed Topics into it yet. Current fallback copy claims inventory, price, and delivery that are not recorded evidence; it first needs truthfulness refactoring. |
| Opportunities | `opportunityEngine` | Active, owner-scoped | Leave unchanged in the first release. It currently projects only deferred intentions and disclosed active ads; Topic source types would be a later extension requiring explicit owner consent. |
| Provider/business relationships | Existing provider entity, supply, presence, verification, coordination services | Active | Store only optional references. A reference never upgrades a business or provider, proves availability, or creates ranking. |
| Advertisements / sponsorship | `adManager` and advertising-disclosure regression | Active but keyword-level | Stage later. Existing disclosure fields are reusable, but Topic/category targeting and exclusions must be explicitly extended and tested. |
| Media handling | Chat attachment endpoint | Incomplete for public UGC | Do not use in Topic V1. The current chat upload path is not a public-topic media moderation/storage model. Start text-only. |
| Surveys | `surveyEngine` | Narrow legacy/dormant feature | Do not use as the Topic polling engine. A future Topic poll format needs its own quality/moderation decision. |
| Analytics | Existing analytics/commercial metrics surfaces | Active | Add only non-PII Topic lifecycle counters after the core owner exists; do not manufacture engagement. |
| Existing tests | Content, CMS/SEO, FastText, contributor, discovery, advertising, chat, request, route suites | Active | Extend the current suite; do not create a detached test harness. |

## Proposed Topic Data Model

The new model should be minimal, relational, and stored in the existing SQL.js database. It requires no new service deployment, cache, broker, search engine, identity store, or media provider.

| Record | Minimum owned fields | Rules |
|---|---|---|
| `topics` | stable ID, canonical slug, author identity reference, title, body, type, visibility, moderation status, category reference, skills JSON, broad location fields, optional linked entity/request/opportunity references, created/updated/published timestamps, duplicate-of reference, quality state | Author identity is an existing authenticated profile. `public` is not the default for content derived from a private conversation. Location is city/LGA-level or omitted; exact private coordinates are never stored for public projection. |
| `topic_replies` | stable ID, topic ID, author identity reference, body, moderation status, created/updated timestamps | Authenticated authors only in V1. Replies do not earn points merely for existing. |
| `topic_reports` | stable ID, topic/reply target, reporter identity reference, reason, optional bounded detail, status, moderator outcome | Reporter identity is private; public pages never display reporter data. |
| Optional linkage additions to `micro_tasks` | source type, source ID, idempotency key | Enables a contributor verification task to point at a Topic without creating a second workforce or reward ledger. |

`type` should be a constrained field, not a separate set of engines: `question`, `discussion`, `recommendation`, `review`, `local_report`, `price_report`, `guide`, `story`, `meme`, `poll`, `event`, `alert`, `opportunity`, and `opinion`. The user can begin with plain-language **Create**; the system may suggest a type but the author confirms it. In the initial text-only release, `meme`, `poll`, and `event` must either remain unavailable or render as ordinary text types until dedicated safe capabilities are proven.

## Taxonomy and Classification

Topics reuse the current category/skill authorities. A Topic stores the selected category and a bounded list of skill-flow-compatible skill references. A reference is validated at write time against the canonical catalogues; it does not create a new label. Country, city, and LGA are optional broad context, not a second location system.

Classification follows Kurukoo’s established cost order:

| Order | Mechanism | Topic use |
|---:|---|---|
| 1 | Deterministic validation and rules | Length, disallowed content, slug normalisation, type selection, exact/near title duplicate candidates, taxonomy validation, privacy checks |
| 2 | FastText | Coarse intent/content-type suggestion and routing to existing category/skill candidates when confidence is sufficient |
| 3 | Existing skill/category lookup | Candidate validation and user-visible corrections |
| 4 | Cache | Deduplicate repeated classification work |
| 5 | Local SmolLM2 only when configured | Optional draft summary, title, or tag suggestion after the deterministic path cannot resolve it |
| 6 | Configured hosted inference | Optional, quota-governed assistance for an author or moderator; never automatic community authorship |
| 7 | Bounded agent runtime | Not required for Topic creation. Consider later only for bounded, auditable queues such as stale public-content review. |

No model may create a Topic, reply, provider, price, availability claim, engagement record, local report, or verification. AI output is a private suggestion or moderated draft only.

## Conversation ↔ Topic ↔ Action

A Topic must be a context and acquisition layer, never an execution layer.

| Direction | Correct flow | Guardrails |
|---|---|---|
| Topic → Conversation | Public Topic action opens `/chat?prompt=…` through the existing chat client | The prompt is contextual, not an instruction to act. It never asserts that a provider, quote, inventory item, or event is available. |
| Topic → Action | User describes a need in the existing conversation; `intentRouter` and the existing request lifecycle decide the next step | No Topic route creates payment, escrow, dispatch, provider verification, or fulfilment. |
| Conversation → Topic | A signed-in user explicitly chooses **Ask community** or **Share as Topic**, reviews the exact public text and context, then creates a draft | Private messages, memory, attachments, locations, participants, and request data are never copied automatically. |
| Action → Topic | A user may publish a consented, redacted experience or question after the existing action path; no automatic request publication | A successful request does not create a public testimonial, provider claim, rating, or SEO page by itself. |

## Publication, Moderation, and Quality

The public page lifecycle should be `draft → submitted → public | restricted | removed`. A user sees drafts and their own restricted content; search engines, Discover, and public feeds consume only `public` Topics. A report moves a record into a reviewable state without exposing reporter details.

V1 quality gates should require a substantive user-authored title/body, a valid taxonomy reference where supplied, no exact duplicate, a permitted type, and a passing deterministic safety check. A conservative indexing gate should additionally require moderation/public status, a meaningful body threshold, uniqueness, an unexpired freshness policy where relevant, and either a legitimate reply, contributor verification, or editorial review. Exact thresholds should be versioned configuration, not hidden magic values.

Health, legal, finance, emergency, high-risk commercial, and impersonation-sensitive Topics require stricter review or non-indexing. The Topic UI must distinguish **community report**, **contributor-verified observation**, **provider statement**, and **Kurukoo record**; none may be merged into a generic truth badge.

## Contributor and Points Model

The existing `microTasks` lifecycle is the correct contributor authority: tasks are claimed by an authenticated contributor, evidence is submitted, an operator approves or rejects it, and a reward is written idempotently through the existing `credit_transactions` ledger. Topic verification should create a task such as **Verify broad location**, **Review price evidence**, or **Check public factual claim**, with a typed Topic source link.

There should be **no Points reward** for posting, replying, viewing, liking, or raw engagement in the initial release. Later rewards may arise only through approved contributor evidence or a separately designed, idempotent, quality-based accepted-answer process. Kurukoo must not create a community currency or use reputation to imply provider verification or payment safety.

## SEO, Discovery, and Internal Linking

The SEO service remains the only metadata, sitemap, canonical, FAQ, schema, redirect, and audit authority. A published Topic detail route should resolve metadata from its Topic record through that service, then enter a new Topic child sitemap only after passing the indexing gate. The existing static sitemap functions need an extension; the current sitemap is not a dynamic Topic owner.

The first schema should be conservative `DiscussionForumPosting` or `Article` only where content and moderation state make it truthful. FAQ structured data is not automatically derived from replies; it requires a reviewed extract. Canonical URLs should be stable, human-readable, and redirect from changed slugs through the existing redirect service. No rank, crawler, backlink, search-console, provider, or popularity claim may be shown until a verified source writes it.

Discover integration should be a compact **Topics** stream on the existing Discover page, not a change to Nearby Radar. It projects only public, quality-qualified content with broad declared locality. It must never use a Topic to infer a person’s current position, distance, provider presence, event attendance, or market availability. Internal links can connect to existing Explore, Resources, Discover, and chat surfaces only when the link target exists.

## Monetisation and Staging

The existing ad manager already contains disclosed campaign fields and keyword matching. It is not yet a Topic sponsorship system. The safe business plan is staged.

| Stage | What may ship | What must not ship yet |
|---|---|---|
| 1 — community foundation | Authenticated text Topics, replies, reports, taxonomy, quality gate, chat handoff, public detail/listing, CMS/SEO projection after quality, contributor verification tasks | Paid Topic promotion, automatic Points, public media, polls/events, provider ranking, external execution |
| 2 — quality and local discovery | Verified/local report treatment, Discover Topic stream, reviewed topic-to-guide promotion, freshness controls, approved Topic/category contextual advertising extension | Personal conversation targeting, emergency or safety ads, sponsored ranking, automatic testimonial publication |
| 3 — intent-aware commercial use | Clearly disclosed category/skill placements, business/provider promotion subject to existing evidence rules, measurable non-PII inventory | Sales of private topic or chat data, safety-critical placement, unverified provider claims |
| 4 — action economics | Existing lead/coordination/economic lifecycle can be reached by voluntary chat handoff | Topic-driven payment, escrow, dispatch, or completion shortcuts |

## Minimal Implementation Sequence

The smallest implementation sequence is deliberately narrow.

| Phase | Exact extension | Why it is first |
|---:|---|---|
| 1 | Add Topic/reply/report persistence, a single service, authenticated author routes, public read routes, V1 text-only UI, and deterministic lifecycle/moderation states | Establishes the missing canonical authority without copying a forum or adding execution. |
| 2 | Add taxonomy validation, deterministic/FastText suggestions, duplicate candidates, chat handoff, explicit conversation-to-draft consent, and Topic action cards | Connects existing categories, skills, chat, and requests without exposing private data. |
| 3 | Add contributor task references, moderated verification presentation, quality-gated SEO metadata and Topic sitemap projection, and Discover stream cards | Produces the durable knowledge/SEO flywheel only after quality and provenance exist. |
| 4 | Refactor Daily Picks truthfulness; then assess it and the opportunity engine as projections, not owners. Extend existing advertising only after disclosure and exclusion tests pass. | Prevents fake inventory/delivery copy, recommendation duplication, and unsafe monetisation. |

## Required Behavioural Tests

The existing route suite should gain a `test-topics-convergence` contract, while existing content, CMS/SEO, contributor, discovery, chat-safety, advertising, FastText, and economic tests continue unchanged. The new contract must cover Topic creation, owner-only draft access, public/private visibility, edit/delete ownership, reply ownership, deterministic category/skill validation, duplicate suggestion behavior, content report lifecycle, moderation outcomes, contributor task evidence linkage, idempotent approved contributor reward, public index gating, sitemap inclusion and exclusion, canonical redirect behavior, internal-link validity, Discover projection, chat handoff, explicit conversation publication consent, no provider/price/availability/activity fabrication, no automatic payment/dispatch, disclosed advertising separation, text-only media policy, query limits, and idempotency.

## Dormant and Incomplete Findings

| Component | Finding | Audit disposition |
|---|---|---|
| `community_posts` | Unused legacy three-field schema with no lifecycle | Retire or migrate only after a data check; do not use as Topic base. |
| `dailyPicks.ts` | Static fallback describes goods, price, and delivery without a recorded evidence source | Do not wire Topics into it. Refactor or retire its unverified fallback before it is a public projection. |
| `surveyEngine` | Narrow scheduler/card pattern with direct messages and small reward | Leave untouched for V1. It is not a topic/reply/poll authority. |
| `opportunityEngine` | Correctly owner-scoped to deferred intentions and disclosed campaigns | Leave intact for V1. Consider a new source type only after consent and Topic quality rules exist. |
| SEO sitemap | Static child sitemap functions only | Extend through the existing SEO service in Phase 3; do not create a parallel generator. |
| Chat attachments | Supports bounded file types and sizes but is not a public UGC media governance system | Text-only Topic V1; no public media reuse until the security/storage lifecycle is proven. |

## Cost and Operating Model

The first release stays inside the existing Node/Express/SQL.js architecture. It uses deterministic validation, existing FastText, taxonomy lookup, cache, the current authenticated user model, `microTasks`, `pointsEngine`, `seoService`, and public routes. It requires no Elasticsearch, Redis, Kafka, social graph database, new queue, separate recommendation model, background worker, or automatic LLM pass. Costly AI and agent actions remain optional, quota-governed, and human-confirmed.

## Approval Gate

The proposed direction creates a **new but minimal Topic persistence boundary** because the audit proved that the only nominal community table is inactive and unsafe, while the existing CMS is editorial rather than user-generated. All adjacent concerns are reused through their current owners. Approval is required before implementation begins because this adds durable public UGC, moderation obligations, public routes, and quality-gated SEO projection.

## References

[1]: https://www.nairaland.com/topics "Nairaland New Topics"
[2]: https://www.nairaland.com/howtoplaceads "How To Place Targeted Ads — Nairaland Ads"
[3]: https://www.nairaland.com/ads "Nairaland Ads"
