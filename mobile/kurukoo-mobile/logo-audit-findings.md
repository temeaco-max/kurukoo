# Kurukoo Logo Audit Findings

The configured launcher asset `assets/images/icon.png` is a warm off-white square containing a large orange Kurukoo knot/agent mark. The runtime `assets/images/kurukoo-logo.png` is a separate small 55×66 transparent PNG with a different, thin outlined mascot silhouette. Their hashes and visible geometry differ.

The mobile `BrandMark` currently renders a third variant: an inline SVG diamond/knot path from `KURUKOO_MARK_PATH` context, not either PNG. The desktop website currently renders a fourth variant: three CSS petal spans. The first consolidation target is therefore to make mobile runtime and desktop shell/message marks use one shared canonical vector geometry, while preserving the launcher/splash/favicon files as the raster app-branding derivatives.

## Platform crop validation

The iOS/Expo contain preview keeps the full square icon centered without clipping. The Android adaptive preview initially exposed the full square background to the circular mask, so the foreground and monochrome assets were regenerated from the logo foreground with transparent pixels and a 560px mark on a 1024px canvas. The final circular mask and safe-area guide show the orange mark fully contained with clearance on all sides; the monochrome asset is white mark plus alpha only. Physical-device confirmation remains separate from this deterministic crop validation.

## Responsive live-preview validation

Live Expo web captures at 390×844 and 768×1024 show the compact and regular logo treatments centered without distortion. The assistant message mark remains aligned to the bubble edge, the top action mark stays proportionate, and the logo does not create horizontal overflow at either width. Desktop CSS was separately checked for fixed 28px shell and 20px compact message sizing; the desktop workspace does not expose a standalone preview server in this session, so physical desktop rendering remains a separate browser check.

## User-facing branding previews

The generated mobile splash preview shows the shared square logo centered on the warm cream background with the Kurukoo wordmark below. The webpage preview shows the same source in the header, assistant message identity, and favicon treatment; only the rendered size and surrounding shell differ by surface.

## Canonical high-fidelity comparison

The canonical mobile board is a four-device set: the first device is a secure first-device flow with the Kurukoo mark, progress indicator, phone illustration with lock, email row, terracotta `Verify this device` CTA, secondary `Not a Kurukoo provider yet` action, and privacy copy. It is not a blank splash screen.

The canonical public website board is a four-panel website set. Its opening panel has a compact top navigation, Kurukoo mark and wordmark, `Explore`, `Channels`, `About`, `Help`, `Sign in`, and terracotta `Get started`; the hero uses a split layout with `Tell Kurukoo what you need`, `Start with the conversation.`, two CTAs, trust principles, and a conversation preview. The prior previews were simplified mockups and did not represent these high-fidelity screen sets.

## First-launch verification implementation

The canonical first-device board is now the first-launch mobile surface. It precedes the `(tabs)` navigation stack, persists only explicit `verified` or `not-provider` states under `kurukoo.mobile.device-verification.v1`, and fails closed to first launch for missing or malformed state. The Verify action is intentionally truthful while no authenticated device-link callback exists: it reports readiness for activation rather than claiming a link was sent. The non-provider path enters the existing Chat surface without claiming provider verification.

Validation: Expo web export completed, TypeScript compilation completed before the sandbox memory-pressure event, and 26 non-network deterministic tests passed. The existing Chat API reachability probe currently returns 502 because its external configured API proxy is unavailable after backend process cleanup; this is an environment/service issue rather than a first-launch contract failure.
