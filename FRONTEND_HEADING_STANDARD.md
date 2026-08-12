
Channels and Help were also opened on the fresh build. Channels now uses the shared centered kicker/title/description treatment while preserving truthful Web Chat versus disconnected-channel states. Help inherited the shared heading typography and spacing, but its legacy blue hero background remains a visual override; this should be removed or neutralized so Help fully matches the preferred Discover/Partners palette rather than only matching typography.


After palette normalization, Help renders on the same neutral background as the reference pages, with a terracotta kicker, charcoal Space Grotesk title, muted supporting text, and a cleanly separated search control. Resources renders the same centered heading system above its guide groupings. The Help title/search overlap was corrected with a shared public-header search spacing rule.


Reconciliation note: origin/main’s latest commit `1eb0a5e` is a broader UI/navigation refactor and includes a cleaner canonical `page-container` + `page-header-center` + `badge-pill` + `page-title` + `page-desc` pattern. Its page-shell corrections are better than the previous compatibility-heavy `.public-page-header` layer, so the aligned branch adopts that pattern while excluding unrelated provider-verification/service deletions. Discover was verified on the fresh runtime after waiting for Leaflet assets: the canonical heading renders correctly and the map/sidebar/layout remain intact.


Explore and Partners were then compared on the reconciled build. Both now render the same concise canonical heading proportions, kicker treatment, paragraph measure, and card-start alignment. The user’s origin/main consolidation is preferable to the previous layered alias approach because it removes wrapper-specific max-width rules and makes page intent explicit in markup.
