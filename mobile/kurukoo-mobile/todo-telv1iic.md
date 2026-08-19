# Project TODO

- [x] Audit all existing Kurukoo screens against the high-fidelity design sets
- [x] Complete the Chat and active conversation experience
- [x] Complete Requests, Reminders, Tasks, and Notifications states
- [x] Complete Discover / Nearby Radar and source-attributed detail flows
- [x] Complete Connect, Memory, Safety, and trusted-device states
- [x] Complete Cart / Checkout provenance and confirmation states
- [x] Complete Settings and appearance controls
- [x] Validate navigation, touch feedback, safe-area behavior, and empty/loading/error states
- [x] Run type-checking, linting, tests, and visual verification
- [x] Save a checkpoint with all completed items marked

- [x] Implement canonical Web Chat screen set from `temeaco-max/kurukoo/docs/design/assets/kurukoo-web-chat-set.png`
- [x] Implement canonical Nearby Radar screen set from `temeaco-max/kurukoo/docs/design/assets/kurukoo-nearby-radar-screen-set.png`
- [x] Check shared branch and recent commits for overlapping Chat or Nearby Radar work before editing
- [x] Validate both screens against the canonical references and save a conflict-checked checkpoint

- [x] Implement Go Live step 1: approximate location consent and privacy boundary
- [x] Implement Go Live step 2: broadcast/source attribution details
- [x] Implement Go Live step 3: review, availability, and invite-to-claim state
- [x] Validate Go Live interactions and save a checkpoint

- [x] Consult canonical Nearby Radar and cross-platform design documentation for result-detail content
- [x] Implement source-evidence detail states for Nearby Radar results
- [x] Validate the aligned result-detail flow and save a checkpoint

- [x] Add Nearby Radar source-evidence timelines and verified-provider transitions
- [x] Add editable custom Nearby Radar broadcast fields and local draft persistence
- [x] Extend documentation-aligned detail treatments to Requests and Reminders
- [x] Validate all requested flows and save a checkpoint

- [x] Re-audit all recent paste-work changes against the canonical contract and design system
- [x] Correct any invented icons, unsupported success language, duplicate authorities, or touch/accessibility regressions
- [x] Refine remaining implementations while preserving Chat ownership and exact context identity
- [x] Update existing design/blueprint documentation with the audit findings
- [x] Run build, lint, tests, accessibility, responsive, and live-route checks, then save a checkpoint

- [x] Inspect canonical repository guidance, relevant assets, service ownership, and recent shared commits
- [x] Identify the next non-conflicting refinement from the repository evidence
- [x] Implement the aligned refinement and update the existing documentation if needed
- [x] Run validation and save a checkpoint

- [x] Audit canonical guidance, shared branch overlap, and owners of remaining Expo warnings
- [x] Add editable reminder content and time controls with fail-closed local validation
- [x] Add deterministic persistence verification covering app relaunch semantics on native storage
- [x] Update the shared runtime owner for shadow, pointerEvents, and web notification warnings
- [x] Run device-oriented, deterministic, visual, and full project validation, then save a checkpoint

- [x] Inventory every canonical visual screen set and current mobile route coverage
- [x] Map missing views to existing Chat, context, notification, request, discovery, and surface authorities
- [x] Implement all missing canonical mobile views and connect their end-to-end flows
- [x] Validate every route, action, state boundary, responsive layout, and accessibility requirement
- [x] Update coverage documentation and save the complete implementation checkpoint

- [x] Prepare trusted canonical screen-set references and comparison criteria
- [x] Compare Chat, Discover, More, Tasks, Go Live, Requests, Reminders, and role surfaces against canonical visuals
- [x] Tune final spacing, typography, status hierarchy, interaction states, and responsive behavior
- [x] Validate all tuned routes and end-to-end transitions at portrait and desktop preview sizes
- [x] Update the existing visual audit documentation and save the tuned checkpoint

- [x] Read relevant Expo documentation and audit reminder/runtime dependency ownership
- [x] Add native reminder date selection and truthful scheduling readiness states
- [x] Add deterministic native-device persistence and scheduling verification
- [x] Evaluate the managed React Native Web pointerEvents warning owner safely
- [x] Run full validation and save the next checkpoint

- [x] Audit all seven canonical design-set assets against current mobile and website coverage
- [x] Build a screen-by-screen parity matrix with exact layout, typography, spacing, asset, control, and state gaps
- [x] Implement faithful parity corrections without creating duplicate authorities or invented behavior
- [x] Validate every canonical view at reference dimensions and mobile adaptation sizes
- [x] Update parity documentation and save the exacted checkpoint

## Desktop Frontend Website workstream

- [x] Inspect canonical Frontend Website design assets and repository guidance
- [x] Establish a separate desktop web project or route authority without modifying mobile routes
- [x] Implement canonical website layout, navigation, content surfaces, and interaction states
- [x] Validate desktop reference dimensions, responsive behavior, and visual tokens
- [x] Document the separate website authority and save a checkpoint

- [x] Implement native expo-audio voice capture with review-before-send and truthful permission/error states
- [x] Add authenticated connected-storage synchronization for voice-note artifacts and portfolio hydration
- [x] Hydrate Opportunity Engine and Network panels from canonical backend services on mobile and desktop
- [ ] Validate Capability Portfolio persistence after first-launch verification on a physical device
- [x] Fix web-safe voice-note storage encoding without expo-file-system native-only APIs
- [x] Add review playback for newly recorded voice notes before sync/send
- [x] Restore the canonical microphone icon and functional voice entry point in the Chat composer
- [x] Add waveform and playback progress feedback to voice-note review
- [x] Add persistent retry queue for failed voice-note storage sync
- [x] Add visible microphone permission readiness and pre-recording prompt
- [x] Add a user-facing Retry now action for queued voice-note syncs
- [x] Drive waveform playback progress from native audio player position when available
- [x] Replace Listen and Discard voice review labels with canonical play and delete icons
- [x] Implement end-to-end authenticated voice-note storage sync with persisted artifact ownership
- [x] Complete Connect/device-linking UI states and authenticated device pairing
- [x] Add QR-code generation and scan/link confirmation flow
- [x] Route user artifacts to connected Google Drive first, with explicit fallback and lifecycle states
- [x] Add artifact history with transcript review, playback, metadata, retry, and safe deletion actions
- [x] Add native camera QR scanning and secure pairing confirmation UI
- [x] Add visual linked-device statuses and revoke-access controls
- [x] Validate Google Drive, artifact, QR, and device-link flows on web and physical devices
- [x] Validate storage sync and Connect flows across mobile/web and document physical-device boundaries
- [x] Add canonical WhatsApp and Telegram QR-ready linked-device channel states
- [x] Add Artifact History search and date filtering
- [x] Add QR expiry countdown and refresh action
- [x] Add explicit Google Drive original deletion with separate reference deletion semantics
- [x] Add eligible fallback-artifact migration into connected Google Drive
- [x] Validate new channel, filtering, deletion, migration, and QR-refresh contracts
- [ ] Validate voice permissions, playback, and retry behavior on physical iOS and Android devices


## Cross-platform Chat and frontend CSS audit

- [x] Inventory active frontend website, desktop web/PWA, iOS, and Android visual authorities
- [x] Capture representative Chat and Partners states at desktop, tablet, iPhone, and Android widths
- [x] Compare web Chat and native Chat shared state language, tokens, composer, message surfaces, and context hierarchy
- [x] Repair the Partners public-entry stylesheet contract so the shared nav/footer authority is loaded
- [x] Verify the mobile opportunity preview remains a contained Partners component and never becomes the route shell
- [x] Consolidate CSS authority and remove route-specific duplicate declarations without collapsing platform interaction models
- [x] Produce the cross-platform remediation plan and responsive validation matrix
- [ ] Implement approved convergence fixes and rerun route-by-route visual validation


## Continued cross-client implementation

- [x] Repair the actual server-rendered and static Partners stylesheet manifests
- [x] Add Web-family and route-style ownership markers to Partners entrypoints
- [x] Add deterministic route-style manifest verification for Web Chat and Partners
- [x] Add a mirrored Web/Mobile Chat presentation fixture contract
- [x] Add deterministic Web/Mobile Chat contract parity verification
- [x] Remove Partners inline event handlers and preserve functional delegated chat actions
- [x] Document external integration implementation and activation-readiness dimensions
- [x] Consolidate the remaining duplicate CSS authorities and complete route-by-route responsive convergence
- [ ] Run physical iOS and Android validation for native voice, camera, and storage flows


## Coherent Kurukoo consumer systems

- [x] Define and document the Web/PWA consumer visual system
- [x] Define and document the iOS/Android native consumer visual system
- [x] Enforce explicit ownership boundaries so Web/PWA screens cannot contaminate native screen sets
- [x] Enforce explicit ownership boundaries so native screen previews cannot become Web/PWA route shells
- [x] Converge shared Chat, capability, status, artifact, voice, opportunity, and provider semantics across clients
- [x] Add one-to-one state fixtures for empty, loading, streaming, error, unavailable, ready, paused, queued, and completed states
- [x] Capture Web, PWA, iOS, and Android evidence at target responsive sizes
- [x] Run screen-contamination, route-style, contract-parity, and responsive evidence guards
- [x] Update completion records with implementation, contract-tested, mock-verified, credential-ready, live-verified, feature-flag, and production-active status


## Remaining convergence implementation

- [x] Audit and classify remaining duplicate Web CSS authorities by route and ownership
- [x] Consolidate safe duplicate Web CSS blocks without changing the Native consumer system
- [x] Add route-level responsive evidence guards for Chat, Partners, Discover, Checkout, Admin, Agents, and Opportunities
- [x] Add state evidence fixtures for streaming, error, queued voice, completed artifact, paused agent, and provider unavailable
- [x] Complete repository-side integration readiness and observability gaps for configured providers
- [x] Validate all new guards and update truthful implementation/activation status


## Remaining rendered evidence and desktop website workstream

- [x] Inventory remaining Web route entrypoints and separate desktop website gaps
- [x] Implement missing desktop website route authority and meaningful lifecycle states
- [x] Capture Chat, Partners, Discover, Checkout, Admin, Agents, and Opportunities at target desktop, tablet, PWA phone, iPhone SE, and Pixel 7 sizes
- [x] Add one-to-one DOM/state assertions for each captured route and lifecycle state
- [x] Update evidence manifests and truthful external activation status
- [x] Run final validation and save a recoverable checkpoint


## Resumed Web/PWA convergence implementation

- [x] Recheck current Web, desktop website, and Native repository ownership before editing
- [x] Repair the live server-rendered Partners shell stylesheet manifest and route ownership
- [x] Add or verify shared Web/Mobile Chat semantic fixture coverage without cloning markup
- [x] Add explicit responsive ownership guards for contained previews versus route shells
- [x] Consolidate only safe duplicate Web CSS authorities and rerun strict CSS checks
- [x] Capture before/after route evidence and update the audit report
- [x] Run final validation and save a recoverable checkpoint


## Continued remaining-work implementation pass

- [x] Recheck repositories and classify all remaining open gates
- [x] Complete remaining Web route evidence captures and inspect rendered states
- [x] Apply only evidence-backed Web/PWA visual or state corrections
- [x] Validate mobile-native voice, camera, storage, and first-launch boundaries with deterministic fallbacks
- [x] Update implementation/activation status and save a final recoverable checkpoint


## Web/PWA Chat voice and composer parity

- [x] Inspect Web/PWA Chat voice fallback, mobile voice lifecycle, agent icon authority, and composer contracts
- [x] Implement Web/PWA microphone capture and truthful permission/error states
- [x] Add Web/PWA voice review with play, delete, waveform/progress, and Connect storage lifecycle states
- [x] Replace remaining Web/PWA agent icon usage with the canonical Kurukoo mark
- [x] Rebuild the Web/PWA Chat composer to match the mobile hierarchy while preserving Web keyboard behavior
- [x] Add deterministic browser/contract validation and responsive evidence
- [x] Update truthful status and save a recoverable checkpoint


## Device validation, reference crops, and CI package verification

- [x] Recheck current device-test capabilities, canonical crop assets, and CI/package configuration
- [x] Run deterministic substitutes and document physical iOS/Android validation boundaries for microphone, playback, QR, and storage
- [x] Inventory and prepare canonical one-to-one reference crops for remaining route pixel-diff scoring
- [x] Resolve the pnpm esbuild approval gate and add a package-level CI verification command
- [x] Run final checks, update truthful status, and save a recoverable checkpoint


## Continued repository-side completion pass

- [x] Recheck latest checkpoint, open TODO gates, and repository workflow state
- [x] Map canonical crop files to semantic route and lifecycle states
- [x] Add a pixel-diff input manifest and crop validation guard
- [x] Add mobile CI workflow coverage for the package-level verification command
- [x] Add device-test reporting hooks without claiming physical execution
- [x] Run final validation and update the physical-device activation checklist
- [x] Save the next recoverable checkpoint


## Route evidence and physical-flow validation pass

- [x] Recheck the canonical capture harness, target widths, crop manifest, and physical-test boundaries
- [x] Capture Discover, Admin, Agents, Checkout, and Opportunities at all canonical widths
- [x] Complete semantic one-to-one crop assets and pixel-diff input validation
- [x] Run deterministic voice, QR-linking, connected-storage, and device-report checks
- [x] Update evidence/status, run final validation, and save a recoverable checkpoint


## Authenticated evidence and pixel-diff completion pass

- [x] Recheck latest checkpoint, protected route fixtures, crop manifest, and device report
- [x] Create authenticated or deterministic fixture evidence for Admin, Checkout, and Opportunities
- [x] Implement pixel-diff scoring inputs and route-level comparison reporting
- [x] Strengthen physical-device activation checklist and deterministic evidence handoff
- [x] Run final validation, update TODO/status, and save a recoverable checkpoint


## Authenticated fixture and CI threshold completion pass

- [x] Recheck latest protected routes, pixel-diff reports, CI workflows, and device status
- [x] Implement deterministic authenticated populated-state fixture mode for Admin, Checkout, and Opportunities
- [x] Add pixel-diff threshold configuration and CI enforcement with pending-state handling
- [x] Complete physical-device evidence handoff and activation status reporting
- [x] Run final validation, update TODO/status, and save a recoverable checkpoint


## Full 27-reference and authenticated-fixture completion pass

- [ ] Recheck crop manifest, scoring outputs, fixture captures, and device report
- [ ] Resolve and validate all remaining crop semantic labels
- [ ] Connect all 27 canonical references to automated pixel-diff scoring
- [ ] Capture valid populated Admin, Checkout, and Opportunities fixture evidence
- [ ] Preserve truthful physical iOS/Android not-run status and update handoff
- [ ] Run final validation and save a recoverable checkpoint


## Authenticated visual evidence and complete crop scoring pass

- [x] Generate valid populated desktop fixture captures for Admin, Checkout, and Opportunities
- [x] Inspect populated fixture screenshots and document truthful fixture-only evidence
- [x] Expand the pixel-diff manifest from the semantic crop registry to all 27 canonical comparisons
- [x] Run pixel-diff scoring and threshold verification for all 27 canonical references
- [ ] Execute physical iOS and Android validation for microphone, playback, QR scanning, connected storage, and first-launch persistence when hardware is available


## Continued remaining-work implementation pass — 2026-08-19

- [x] Recheck current Web, desktop website, and Native ownership boundaries after the latest evidence checkpoint
- [x] Inspect remaining visual convergence and state-aligned evidence gaps without overwriting concurrent agent work
- [x] Implement the highest-priority repository-side fix that is evidence-backed and non-conflicting
- [x] Run deterministic Web and Native validation plus memory-safe evidence checks
- [x] Update truthful implementation and activation status, then save a recoverable checkpoint
