# Visual Convergence Audit

## Authoritative references inspected

The cross-platform design system defines a warm cream background (`#F7F2EC`), raised white surfaces, terracotta action accent (`#B95D3C`), charcoal ink (`#24221F`), muted ink (`#6D665F`), soft borders (`#E6DED5`), Inter body typography and Space Grotesk display typography. The web Chat screen set shows a compact Kurukoo mark, Agent header, restrained message groups, a bottom Ask composer with the mark preceding the action, and an inspector/context rail. The website set shows the same mark, warm surfaces, terracotta primary actions, modest rounded cards, and concise hierarchy.

## Initial drift signals

The native handoff has the correct palette tokens and overall warm surface direction. The logo authority is now explicit: `assets/images/kurukoo-logo.png` is the shared runtime mark and is byte-identical to `assets/images/icon.png`; splash, favicon, Android foreground, and monochrome derivatives are generated from the same source with platform-specific safe-area treatment. Remaining visual checks concern typography loading and responsive spacing rather than mark identity.

## Additional screen-set findings

The admin and agents references use a consistent left navigation rhythm, compact orange/terracotta mark, restrained status chips, tabular evidence layouts and explicit lifecycle language such as Active, Needs activation, Paused and External provider not verified. The agents set especially relies on icon-led identity cards, policy-reviewed tool rows, bounded-autonomy metadata and pause/cancel controls. A native surface that only shows paragraphs and a generic button is structurally aligned but not high-fidelity; it needs the same visual grammar at mobile scale, without inventing a second icon family or implying external success.

## Concrete implementation drift

The runtime `BrandMark` now uses `assets/images/kurukoo-logo.png`, the single configured Kurukoo icon source. The launcher icon, splash icon, favicon, legacy runtime filename, and desktop public logo share the same bytes. Android adaptive foreground and monochrome assets use transparent foreground extraction from that source so the circular mask and safe-area crop do not clip the mark. iOS/Expo splash uses the full square source with contain sizing.

The shared UI styles reference `Inter_*` and `SpaceGrotesk_*` font family names, but the native app has no font-loading path or bundled font assets. This means the intended typography is not guaranteed at runtime and is another concrete source of visual drift.

## Paste-contract re-audit

The recent Web Chat, Nearby Radar, Go Live, Requests and Reminders work was rechecked against the pasted canonical implementation contract. The audit removed invented Unicode glyphs from the touched surfaces, replaced status marks with the shared `BrandMark` and `StatusPill` primitives, removed unsupported “live” wording from the Go Live outcome, changed the Chat composer action to the canonical `Ask` label, and kept the persistent composer and context inspector as the primary operating surface.

The audit also corrected a misleading Requests/Reminders continuation claim. Those surfaces now return to Chat without claiming exact context preservation that is not currently backed by the existing context authority. Nearby Radar continues to use source attribution, approximate location, provider lifecycle language and evidence states; the map remains a presentation layer. No new service, router, memory, request, notification, provider or authentication authority was introduced.

Deterministic crop validation confirms the iOS contain preview and Android circular/safe-area preview keep the mark fully visible. Physical iOS and Android validation remains recommended for final platform-specific launcher and splash rendering, while the former authoritative-mark convergence risk is closed.
