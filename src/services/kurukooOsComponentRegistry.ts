/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
export type OsComponentFamily = 'shell' | 'conversation' | 'activity' | 'object' | 'progress' | 'discovery' | 'connection' | 'media';
export type OsComponentVariant = 'default' | 'compact' | 'dense' | 'featured' | 'contextual' | 'sponsored' | 'loading' | 'empty' | 'error';

export interface KurukooOsComponent {
  id: string;
  family: OsComponentFamily;
  purpose: string;
  reusableOn: string[];
  variants: OsComponentVariant[];
  sourcePattern: 'personal-workspace-reference' | 'chat-ui' | 'shared-os';
  mustRemainSemanticallyDistinct?: boolean;
}

/**
 * Shared visual vocabulary extracted from the Personal Workspace and Chat shells.
 * The Desk page owns the composition; these components may be reused elsewhere.
 */
export const KURUKOO_OS_COMPONENTS: readonly KurukooOsComponent[] = [
  { id: 'conversation-continuation-card', family: 'conversation', purpose: 'Resume a meaningful Agent conversation from another OS surface.', reusableOn: ['desk','requests','tasks','opportunities','memory','providers','discover','notifications'], variants: ['default','compact','contextual'], sourcePattern: 'personal-workspace-reference' },
  { id: 'activity-flow-card', family: 'activity', purpose: 'Ordered time-based activity with state and next action.', reusableOn: ['desk','requests','tasks','checkout','confirmations','admin','notifications'], variants: ['default','compact','dense'], sourcePattern: 'personal-workspace-reference' },
  { id: 'object-summary-list-card', family: 'object', purpose: 'Compact list of durable Kurukoo objects with identity and state.', reusableOn: ['desk','requests','tasks','reminders','saved','providers','agents','opportunities','connections','subscriptions'], variants: ['default','compact','dense'], sourcePattern: 'personal-workspace-reference' },
  { id: 'opportunity-card', family: 'discovery', purpose: 'Rich opportunity/entity discovery card with provenance and CTA.', reusableOn: ['desk','discover','opportunities','providers','topics','public-explore'], variants: ['default','featured','sponsored'], sourcePattern: 'personal-workspace-reference' },
  { id: 'place-card', family: 'discovery', purpose: 'Place summary with lifecycle status, leading visions, vote totals and follow action.', reusableOn: ['desk','discover','places','chat','opportunities'], variants: ['default','compact','featured'], sourcePattern: 'personal-workspace-reference' },
  { id: 'metric-progress-card', family: 'progress', purpose: 'Metric with meaningful progress toward a known target.', reusableOn: ['desk','points','subscriptions','agents','tasks','wallet','admin-analytics'], variants: ['default','compact'], sourcePattern: 'personal-workspace-reference' },
  { id: 'topic-cluster', family: 'discovery', purpose: 'Compact taxonomy/topic grouping using shared pills and states.', reusableOn: ['desk','topics','discover','explore','providers','capabilities'], variants: ['default','compact'], sourcePattern: 'personal-workspace-reference' },
  { id: 'media-guide-card', family: 'media', purpose: 'Editorial/resource media card with type, duration and contextual CTA.', reusableOn: ['desk','resources','help','blog','how-it-works','onboarding'], variants: ['default','featured','compact'], sourcePattern: 'personal-workspace-reference' },
  { id: 'connection-status-list', family: 'connection', purpose: 'Connection/integration identity, health, state and action.', reusableOn: ['desk','connect','settings','admin-integrations','providers'], variants: ['default','compact','dense','loading','error'], sourcePattern: 'personal-workspace-reference' },
  { id: 'pulse-timeline', family: 'activity', purpose: 'Contextual timeline of current/upcoming activity and state.', reusableOn: ['desk','requests','tasks','agents','providers','subscriptions','admin'], variants: ['default','compact','contextual'], sourcePattern: 'personal-workspace-reference' },
  { id: 'status-action-card', family: 'progress', purpose: 'Truthful state + explanation + safe next action.', reusableOn: ['desk','safety','connect','checkout','subscriptions','agents','admin-readiness'], variants: ['default','contextual','loading','empty','error'], sourcePattern: 'personal-workspace-reference' },
  { id: 'activity-summary', family: 'activity', purpose: 'Aggregate activity metrics with timeframe and supporting visualisation.', reusableOn: ['desk','requests','tasks','agents','points','admin-analytics','revenue'], variants: ['default','compact'], sourcePattern: 'personal-workspace-reference' },
  { id: 'sponsored-entity-card', family: 'discovery', purpose: 'Clearly disclosed paid placement with entity identity and evidence-backed CTA.', reusableOn: ['desk','discover','explore','providers','public-discovery','admin-advertising'], variants: ['default','compact','sponsored'], sourcePattern: 'personal-workspace-reference', mustRemainSemanticallyDistinct: true },
  { id: 'agent-context-card', family: 'conversation', purpose: 'Expose current Agent objective, context, evidence and continuation.', reusableOn: ['chat','desk','requests','tasks','opportunities','agents'], variants: ['default','contextual','compact'], sourcePattern: 'chat-ui' },
  { id: 'recent-conversations-list', family: 'conversation', purpose: 'Fast return to recent Agent conversations from authenticated shells.', reusableOn: ['chat','desk'], variants: ['default','compact','dense','empty'], sourcePattern: 'chat-ui' },
  { id: 'shell-presence-status', family: 'shell', purpose: 'Identity/presence/memory/connectivity state visible without leaving the shell.', reusableOn: ['chat','desk'], variants: ['default','compact'], sourcePattern: 'chat-ui' },
  { id: 'nearby-radar-control', family: 'connection', purpose: 'Explicit nearby-context control with truth/readiness state.', reusableOn: ['chat','desk','discover'], variants: ['default','compact','loading','error'], sourcePattern: 'chat-ui' },
  { id: 'context-inspector', family: 'shell', purpose: 'Right-side contextual inspector whose contents change with the current object/surface.', reusableOn: ['chat','desk','requests','tasks','agents','opportunities','connect','checkout','admin'], variants: ['default','contextual','empty','error'], sourcePattern: 'chat-ui' },
  { id: 'search-command-drawer', family: 'shell', purpose: 'Universal search/action surface with direct destinations and Agent semantic handoff.', reusableOn: ['chat','desk','all-authenticated'], variants: ['default','dense','empty'], sourcePattern: 'shared-os' },
  { id: 'notification-drawer', family: 'shell', purpose: 'Action-oriented notifications without losing current context.', reusableOn: ['chat','desk','all-authenticated'], variants: ['default','empty','error'], sourcePattern: 'chat-ui' },
  { id: 'account-drawer', family: 'shell', purpose: 'Identity, settings, memory, notification and sign-out controls.', reusableOn: ['chat','desk','all-authenticated'], variants: ['default','compact'], sourcePattern: 'shared-os' },
  { id: 'cart-header-control', family: 'shell', purpose: 'Compact header access to cart without promoting Cart to primary navigation.', reusableOn: ['chat','desk','all-authenticated'], variants: ['default','compact'], sourcePattern: 'chat-ui' },
];

export const PERSONAL_WORKSPACE_DESK_ONLY_COMPONENTS = new Set([
  'today-flow-composition',
  'desk-greeting-hero',
  'desk-guide-strip',
  'desk-opportunity-radar-composition',
]);

export const KURUKOO_BRAND_REFERENCE_BOUNDARY = {
  personalWorkspaceImageIsDeskContentReferenceOnly: true,
  shellInteractionPatternsMayBeReused: true,
  literalLogoTreatmentMayNotBeCopied: true,
  canonicalBrandRegistry: 'src/services/brandPrimitiveRegistry.ts',
};
