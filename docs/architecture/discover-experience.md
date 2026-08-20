# Kurukoo Discover Experience

Discover is Kurukoo's opportunity/activity surface, not only a map.

## Product contract

Discover composes existing canonical systems into one user-facing surface:

- **For You** — relevant fresh items from nearby discovery, topics and current opportunity state.
- **Nearby** — source-attributed local places, businesses, services, events and providers.
- **Today** — time-sensitive and expiring opportunities/offers/events that have explicit freshness/expiry evidence.
- **Topics** — public Topics that users can follow, discuss or hand into Chat.
- **Opportunities** — candidate/opportunity/invited/available discovery entities that can lead to contribution, provider onboarding or Economic Request flows.
- **Explore Kurukoo** — a curated view over the canonical skill catalogue so users can discover what Kurukoo can help them do.

Every item can hand the exact context into canonical Chat. Discover does not execute economic, provider, identity or safety authority itself.

## Actions

Discover supports persistent `watch`, `follow` and `save` actions through `discover_interests`. These are owner-scoped and do not themselves create a booking, payment, provider claim or completed outcome.

`watch` is intended to become the user-facing bridge to agent/background monitoring: price changes, availability, replies, event changes and other future conditions can be attached to the same persisted interest without creating a second task system.

## Ranking and truth

The current composer ranks discovery entities using explicit evidence, availability, lifecycle, freshness, proximity and near-expiry signals. Sponsored content is not implicitly created by the feed composer; commercial placement remains owned by the advertising system and must be disclosed when introduced into a Discover feed.

The system distinguishes `rich`, `sparse` and `empty` local density. A sparse/empty area must remain useful through Explore Kurukoo, Chat handoff, Topics and watch creation rather than fabricated map fixtures.

The map remains a presentation layer and public coordinates are coarse/fuzzed. Discovery results are never proof of provider availability merely because an entity is visible.

## Architectural composition

```text
Topics ───────┐
Nearby/Pulse ─┤
Providers ────┤
Opportunities ┤
Offers/Ads ───┤
Skills ───────┤──> Discover composer ──> Chat / Watch / Follow / Save / Act
Agents ───────┤
Capabilities ─┘
```

The composer is intentionally thin. It reuses existing authorities instead of introducing a new provider directory, marketplace, agent runtime, payment engine or social graph.
