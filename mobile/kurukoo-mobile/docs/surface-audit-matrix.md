# Kurukoo Surface Audit Matrix

This matrix records the current independent recheck against the authoritative design inventory. A row is marked **validated** only when the relevant implementation contract and available exact-size capture have been checked. Desktop rows remain explicitly open where the managed desktop preview or package manifest is unavailable.

| Surface | Authority/reference | Target viewport | Current owner | Current result | Classification | Evidence/status |
|---|---|---:|---|---|---|---|
| Mobile first-launch verification | `authoritative-assets/pasted_file_lZf52W_image.webp`; mobile handoff | 390×844 portrait; native iOS/Android release follow-up | `components/first-launch-verification.tsx`, `app/_layout.tsx` | Implemented with email OTP request/code states, truthful errors, local gate, and Chat handoff animation | Validated implementation; physical-device callback still required | Live 390×844 capture and 26 deterministic tests; native OTP requires device/provider |
| Desktop public hero/opening board | `authoritative-assets/pasted_file_3meWAy_image.webp` | Reference board 2048×1152; responsive targets 1440×900, 1024×768, 390×844 | `kurukoo-website/client/src/App.tsx`, `client/src/index.css` | Existing JSX plus canonical split-hero/opening-board CSS authority | Source-aligned; exact visual capture open | Reference dimension confirmed; desktop managed capture pending |
| Desktop authenticated Chat composer | Cross-platform design system, Ask-control rules | 1440×900 and 1024×768 | `client/src/App.tsx`, `client/src/index.css` | Stacked editor/footer composer, 44px Ask/Stop, context and clear-draft controls, focus/pressed states | Source-validated; exact visual capture open | Source assertions pass; desktop screenshot pending |
| Mobile Chat composer | Cross-platform design system, mobile Chat reference | 390×844 and 768×1024 | `app/(tabs)/index.tsx` | Multiline input, context reveal, clear draft, private/editing state, Ask/Stop, keyboard submit | Validated implementation | Mobile type-check, deterministic tests, live preview |
| Public Explore/Topics | Authoritative implementation map and public topic contracts | Desktop/tablet/mobile reference sizes where available | `kurukoo-website/client/src/App.tsx` | Canonical content/topic hydration and explicit unavailable/loading states | Existing implementation; full diff open | No new correction in this pass |
| Nearby Radar/Pulse | Radar screen set and mobile handoff | Desktop and portrait mobile reference sizes | Existing mobile/desktop Radar surfaces | Source attribution, privacy, loading/empty states preserved | Existing implementation; full diff open | Prior checkpoint evidence |
| Tasks/Requests/Reminders | Mobile handoff and work-surface screen sets | Portrait reference sizes | Mobile work-surface routes | Local persistence and truthful state controls preserved | Existing implementation; full diff open | Prior deterministic tests |
| Checkout/Confirmation | Transactional screen sets and service boundaries | Portrait and desktop reference sizes | Mobile transactional surfaces and desktop routes | Payment/evidence/pending semantics remain explicit | Existing implementation; full diff open | Prior boundary validation |
| Partners/Agents/Opportunities | Partner/agent screen sets and implementation map | Responsive reference sizes | Mobile/desktop workspace surfaces | Existing governed states preserved; demo-model replacement remains open | Existing implementation; follow-up required | No new correction in this pass |
| Admin | Admin screen set and admin route authority | Desktop reference sizes | Canonical admin routes | Admin analytics remains aggregate-only and admin-authenticated | Existing implementation; exact diff open | Backend privacy integration passed |

## Evidence rule

Exact pixel-diff completion remains open for desktop/PWA surfaces until the managed desktop implementation can be captured at the stated target dimensions. No visual pass is claimed from source inspection alone. Responsive adaptations that differ from a desktop reference are retained when they preserve the documented mobile/tablet behavior, safe areas, focus order, and 44px interaction targets.


## Responsive capture findings

Live preview captures completed at **1440×900**, **1024×768**, and **390×844**. The desktop and tablet states preserve the split hero composition, centered navigation, paired CTAs, conversation preview, and three-part trust band. The mobile state collapses navigation into the compact header, stacks the CTAs, keeps the conversation preview readable below the copy, and preserves the terracotta action hierarchy. The captures are implementation evidence; a formal pixel-diff score against the 2048×1152 reference board still requires a normalized crop/overlay comparison rather than visual inspection alone.


## Pixel-diff artifact qualification

The generated normalized overlay and amplified diff artifacts are reproducible, but the selected implementation PNG (`webdev-preview-root-1787122309968505837-8461.png`) is a composite multi-surface board rather than a single 1440×900 hero frame. Its mean difference is therefore not a valid hero-quality score. The artifacts are retained as a diagnostic warning, not as completion evidence. A valid score requires a fresh single-frame desktop hero capture at the same composition and a crop/normalization policy agreed with the reference board.


## Browser harness findings

The desktop test workspace now has a package manifest, Playwright configuration, installed `@playwright/test`, a pinned Chromium executable, serialized workers, and shared-memory protection. The hosted `/chat/` runs are not yet passing: the preview route either crashes Chromium during hydration or does not expose the expected `Show exact context status`, `Clear draft`, and `Ask Kurukoo` controls before the test timeout. This is an environment/route readiness failure, not evidence that the source handlers are absent. The test suite remains intentionally failing until the correct authenticated Chat fixture or stable preview route is supplied.


## Canonical hero crop finding

The authoritative `pasted_file_3meWAy_image.webp` is a 2×2 frontend website screen set, not a single full-board hero. Its top-left quadrant is the canonical public hero/opening board. Therefore the valid comparison must crop the top-left quadrant (approximately 1024×576 in source coordinates), normalize that crop to the dedicated implementation frame’s aspect ratio, and report the crop policy alongside the diff score. The full-board mean difference remains invalid for hero parity.


## Crop-corrected hero diff

A crop-corrected artifact set now compares the canonical top-left hero quadrant `(0,0,1024,576)` against the dedicated implementation frame crop `(0,0,1440,810)`, with both normalized to 2048×1152. The reported mean channel difference is `274.4348` on the generated RGB histogram metric. This is a reproducible diagnostic score, not a perceptual pass/fail threshold; the overlay should be used to guide composition corrections because the source reference and implementation use different rasterization, font rendering, and content-density conditions.
