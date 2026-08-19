# Partners Authority Reuse Audit — 2026-08-19

## Decision

The prior `c20c043` Partners implementation is the closest repository-side authority for the supplied Partners screen set. It is materially closer than the current `c6e5c75` custom workspace composition because it preserves the reference hierarchy: a two-column hero with a mobile Opportunities preview, a four-step partner journey, paired capability/onboarding panels, paired Opportunities and Evidence & earnings panels, role cards, and the truthful-design trust band.

The incorrect `c6e5c75` composition introduced a different left rail and workspace-stage dashboard pattern. Although that pattern was polished, it did not match the visual screen set and therefore was not retained.

## Reused authorities

| Authority | Reuse decision |
| --- | --- |
| `views/partners.ejs` from `c20c043` | Restored as the structural and content baseline. Existing Chat handoffs were preserved. |
| `public/css/partners-authority.css` from `c20c043` | Restored as the dedicated layout authority for the Partners screen set. |
| `/assets/brand/logo-icon.png` | Reused as the exact Kurukoo logo asset in the Partners onboarding card. |
| Existing shared head/nav/footer partials | Preserved so public shell, typography loading, navigation and footer remain canonical. |

## Truthfulness boundaries

The surface remains a preview/dashboard composition and does not claim that external providers, payments, notifications, or opportunities are live. The copy continues to separate capability, opportunity, evidence, verification, execution, completion and payment states. Links re-enter the canonical Chat route through explicit prompts rather than introducing a parallel partner transaction flow.

## Verification

The restored route rendered successfully at `http://127.0.0.1:3001/partners/`. The browser page contained the expected authority selectors and all primary links remained visible. The browser console produced no runtime errors. The canonical build, route contracts, public runtime contracts, strict inline-CSS audit, and `git diff --check` passed. The project’s configured package manager is npm; an initial pnpm invocation was rejected by the repository package-manager guard and was not treated as a product failure.

## Future-agent rule

For Partners or similarly structured workspace surfaces, inspect existing authority-specific CSS and prior screen-set implementations before creating a new dashboard composition. Reuse the closest established geometry and only modify content or canonical handoffs when the blueprint requires it.
