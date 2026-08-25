# Kurukoo Platform Convergence

The convergence work is additive: Kurukoo keeps one conversation-first operating system, one Goal model, one capability registry, one canonical capability executor, one evidence/quality boundary, and one continuation mechanism.

## Skill / capability separation
Skills remain the user-facing semantic vocabulary. Reusable behaviour is owned by the existing capability registry, capability composition and canonical capability executor. New categories should prefer declarative composition over new execution engines. A skill may be thin; its capabilities, adapters, policy and evidence are what make it executable.

## Individual / business surfaces
Individuals remain conversation-first. Businesses use dashboard/API/integration-shaped surfaces, while both sides share the same Goal, capability, policy, execution, evidence and notification substrate. No second business runtime is introduced.

## Market profiles
Built-in Nigeria, Ghana, UK, Canada and US experiences remain backward compatible. `KURUKOO_MARKET_PROFILES_JSON` can add or override market metadata without a TypeScript country union. Market data includes currency, payment rails, regulatory class, languages and channel availability.

## Cold-start supply
Discovery accepts explicitly attributed seed supply through `KURUKOO_DISCOVERY_SEEDS_JSON`. Provenance is mandatory (`licensed_directory`, `curated_seed`, `provider_submitted` or `user_attributed`). Kurukoo never invents providers to make a market appear populated. Real seed data remains a deployment input, not fabricated repository content.

## WhatsApp
Core WhatsApp transport is the existing Meta WhatsApp Cloud API adapter with signed webhook verification, canonical Chat routing and webhook deduplication. Personal linked-device support remains separate and is never treated as the production business transport.

## Learning loop
Low-confidence semantic routing and legacy-router fallbacks are fed into the existing reviewed unknown-intent corpus. Raw traffic is not silently promoted to training. Review and training-lineage infrastructure remains the existing unknown-intent owner.

## Evidence / reputation
Verified Agent Goal outcomes are materialized into a canonical portable evidence ledger. The ledger is generic by subject, so later provider/business reputation can be computed from verified completion evidence without creating another audit/event store.

## Scope discipline
No model may bypass the Tool Registry or canonical executor, consequential actions remain approval-gated, external completion requires evidence, and external fulfilment remains activation-dependent where provider integrations are not configured.