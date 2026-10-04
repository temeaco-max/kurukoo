/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
export type DeskReferenceRole = 'desk-content-reference' | 'authenticated-shell-pattern' | 'brand-exclusion';

export interface DeskReferenceBoundary {
  asset: string;
  role: DeskReferenceRole;
  appliesTo: string[];
  doesNotApplyTo: string[];
  requiredPatterns: string[];
}

export const DESK_VISUAL_REFERENCE: DeskReferenceBoundary = {
  asset: 'kurukoo-os-personal-workspace.png',
  role: 'desk-content-reference',
  appliesTo: [
    '/field',
    'Desk content hierarchy',
    'Desk card composition',
    'Desk content density',
    'Desk populated states',
    'Desk contextual right rail',
    'Desk authenticated header interaction pattern',
  ],
  doesNotApplyTo: [
    'Chat page body composition',
    'Requests page content composition',
    'Tasks page content composition',
    'Connect page content composition',
    'Admin page composition',
    'Public marketing page composition',
    'mobile-only navigation composition',
    'literal reuse of the reference logo/wordmark treatment',
  ],
  requiredPatterns: [
    'centred universal search control in the authenticated header',
    'notification control adjacent to account/profile controls',
    'fixed primary left navigation rail',
    'contextual right-side inspector/drawer',
    'welcome/personal context',
    "Today's flow",
    'Continue conversation',
    'Active requests',
    'Tasks and reminders',
    'Opportunity radar',
    'Points',
    'Topics for you',
    'Guide content',
    'connected channels',
    'Pulse/timeline',
    'Safety check-in',
    'Activity summary',
  ],
};

export interface DeskContentModuleContract {
  id: string;
  title: string;
  purpose: string;
  primaryData: string[];
  actions: string[];
  states: string[];
  visualRole: 'hero' | 'primary-grid' | 'secondary-grid' | 'context-rail';
}

export const DESK_CONTENT_MODULES: readonly DeskContentModuleContract[] = [
  { id: 'welcome', title: 'Welcome', purpose: 'Orient the user to what matters now.', primaryData: ['profile', 'day-context', 'recent-context'], actions: ['start-something', 'open-agent'], states: ['ready', 'first-visit', 'returning'], visualRole: 'hero' },
  { id: 'today-flow', title: "Today's flow", purpose: 'Show imminent things that need attention or action.', primaryData: ['tasks', 'reminders', 'request-events'], actions: ['open-item', 'start-something', 'view-all'], states: ['populated', 'empty', 'loading'], visualRole: 'primary-grid' },
  { id: 'continue-conversation', title: 'Continue conversation', purpose: 'Return the user to the most relevant active conversation.', primaryData: ['recent-conversation', 'current-objective'], actions: ['open-chat'], states: ['populated', 'empty'], visualRole: 'primary-grid' },
  { id: 'active-requests', title: 'Active requests', purpose: 'Expose work currently moving through Kurukoo.', primaryData: ['economic-requests'], actions: ['open-request', 'view-all'], states: ['active', 'waiting', 'needs-input', 'empty'], visualRole: 'secondary-grid' },
  { id: 'tasks-reminders', title: 'Tasks & reminders', purpose: 'Keep user-controlled work and time-based follow-up visible.', primaryData: ['tasks', 'reminders'], actions: ['complete', 'pause', 'open', 'view-all'], states: ['active', 'completed', 'overdue', 'empty'], visualRole: 'secondary-grid' },
  { id: 'opportunity-radar', title: 'Opportunity radar', purpose: 'Surface relevant opportunities without implying guaranteed availability.', primaryData: ['opportunities', 'provider-context', 'daily-picks'], actions: ['open', 'save', 'view-all'], states: ['attributed', 'sparse', 'empty', 'unavailable'], visualRole: 'secondary-grid' },
  { id: 'points', title: 'Points', purpose: "Show the user's closed-loop Points position and useful next actions.", primaryData: ['points-balance', 'points-history', 'points-level'], actions: ['view-history', 'top-up', 'learn'], states: ['ready', 'empty', 'payment-unavailable'], visualRole: 'secondary-grid' },
  { id: 'topics-for-you', title: 'Topics for you', purpose: 'Surface community/shared context relevant to the user.', primaryData: ['topics', 'taxonomy', 'saved-context'], actions: ['open-topic', 'manage-topics'], states: ['populated', 'sparse', 'empty'], visualRole: 'secondary-grid' },
  { id: 'guide-content', title: 'Guide content', purpose: 'Provide useful learning/context without pretending media is live if it is not.', primaryData: ['resources', 'guides', 'media'], actions: ['open-resource', 'view-all'], states: ['ready', 'unavailable', 'empty'], visualRole: 'secondary-grid' },
  { id: 'sponsored-provider', title: 'Sponsored provider', purpose: 'Represent paid/promoted provider visibility truthfully.', primaryData: ['sponsorship', 'provider', 'offer'], actions: ['view-offer'], states: ['sponsored', 'unavailable'], visualRole: 'secondary-grid' },
  { id: 'connected-channels', title: 'Connected channels', purpose: 'Expose channel connection/readiness state.', primaryData: ['connections', 'channel-readiness'], actions: ['connect', 'manage', 'view-readiness'], states: ['connected', 'ready', 'requires-setup', 'unavailable'], visualRole: 'secondary-grid' },
  { id: 'pulse', title: 'Pulse', purpose: 'Provide contextual activity/timeline information in the right inspector.', primaryData: ['timeline', 'requests', 'tasks', 'notifications'], actions: ['open-item', 'view-agenda', 'refresh'], states: ['populated', 'empty', 'loading'], visualRole: 'context-rail' },
  { id: 'safety-check-in', title: 'Safety check-in', purpose: 'Surface consent-bound safety status and action.', primaryData: ['safety-state', 'trusted-contacts'], actions: ['run-check-in', 'manage-contacts'], states: ['good', 'attention', 'unavailable'], visualRole: 'context-rail' },
  { id: 'activity-summary', title: 'Activity summary', purpose: 'Summarise user activity without overstating analytics.', primaryData: ['tasks-completed', 'requests', 'time-saved'], actions: ['change-range', 'view-detail'], states: ['populated', 'empty'], visualRole: 'context-rail' },
];

export const DESK_VISUAL_FOUNDATION_VERSION = '1.0.0';
