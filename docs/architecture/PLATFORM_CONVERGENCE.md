# Kurukoo Platform Convergence

This document records the implemented convergence direction for the platform recommendations now built on top of the existing Kurukoo architecture.

## Skill / capability separation
Skills remain the user-facing semantic vocabulary. Reusable behaviour is owned by the existing capability registry, capability composition and canonical capability executor. The repository is not migrated to a second fulfillment taxonomy.

## Individual / business surfaces
Individuals remain conversation-first. Business integrations are dashboard/API/integration-shaped, but both surfaces share the same Goal, capability, policy, execution and evidence substrate. No second business runtime is introduced.

## Market profiles
Current country experience remains backward compatible while `KURUKOO_MARKET_PROFILES_JSON` can add or override market metadata without changing TypeScript country unions. Market data includes currency, payment rails, regulatory class, languages and channel availability.

## Cold-start supply
The existing Discovery owner can ingest attributed seed supply through `KURUKOO_DISCOVERY_SEEDS_JSON`. Provenance is mandatory (`licensed_directory`, `curated_seed`, `provider_submitted` or `user_attributed`), so Kurukoo never fabricates businesses or providers to fill the map.

## WhatsApp
Core WhatsApp transport remains the existing Meta WhatsApp Cloud API adapter. Linked-device personal sessions remain explicitly separate and are not treated as the production business transport.

## Learning loop
Low-confidence semantic routing and legacy-router fallbacks are fed into the existing reviewed unknown-intent corpus. Only reviewed candidates are eligible for training lineage; raw traffic is never silently converted into training data.

## Evidence / reputation
Verified Agent Goal outcomes are materialized into a canonical, portable evidence ledger. This makes verified completion history queryable without introducing a second event store. Future provider reputation can build on the same evidence substrate.

## Scope discipline
The platform does not claim real-world fulfilment without external provider evidence, does not invent discovery supply, and does not auto-approve consequential actions.
