/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
export type AuthNavPlacement = 'primary-sidebar' | 'secondary-sidebar' | 'header' | 'account-menu' | 'settings-section' | 'context-drawer';
export type AuthNavFrequency = 'core' | 'frequent' | 'occasional' | 'setup' | 'configuration' | 'instant';
export interface AuthNavItem { id: string; label: string; route?: string; placement: AuthNavPlacement; frequency: AuthNavFrequency; purpose: string; reason?: string; }
export const AUTHENTICATED_NAVIGATION: readonly AuthNavItem[] = [
  { id: 'chat', label: 'Chat', route: '/chat', placement: 'primary-sidebar', frequency: 'core', purpose: 'The conversational control surface for asking Kurukoo to get things done.', reason: 'Core daily interaction.' },
  { id: 'home', label: 'Home', route: '/home', placement: 'primary-sidebar', frequency: 'core', purpose: 'Personal starting point for what matters now, ongoing work and useful next actions.', reason: 'Always-visible home.' },
  { id: 'explore', label: 'Explore', route: '/explore', placement: 'primary-sidebar', frequency: 'frequent', purpose: 'Discover useful people, places, services, products, Topics and opportunities.', reason: 'Frequent discovery task.' },
  { id: 'activity', label: 'Activity', route: '/activity', placement: 'primary-sidebar', frequency: 'core', purpose: 'See what is happening, what needs attention and what has finished.', reason: 'Core continuity surface.' },
  { id: 'work', label: 'Work', route: '/tasks', placement: 'primary-sidebar', frequency: 'frequent', purpose: 'Review tasks and follow-through that need attention.', reason: 'Active work surface.' },
  { id: 'reminders', label: 'Reminders', route: '/reminders', placement: 'secondary-sidebar', frequency: 'frequent', purpose: 'View and manage reminders.' },
  { id: 'saved', label: 'Saved', route: '/saved', placement: 'secondary-sidebar', frequency: 'occasional', purpose: 'Return to saved context, offers and items.' },
  { id: 'notifications', label: 'Notifications', route: '/notifications', placement: 'secondary-sidebar', frequency: 'instant', purpose: 'See useful updates about ongoing work, reminders and things that need attention.' },
  { id: 'memory', label: 'Memory', route: '/memory', placement: 'secondary-sidebar', frequency: 'configuration', purpose: 'Review retained personal context and continuity.' },
  { id: 'topics', label: 'Topics', route: '/topics', placement: 'account-menu', frequency: 'occasional', purpose: 'Community and shared topical context.' },
  { id: 'opportunities', label: 'Opportunities', route: '/opportunities', placement: 'account-menu', frequency: 'occasional', purpose: 'Ways to participate in useful network activity.' },
  { id: 'capabilities', label: 'Capabilities', route: '/capabilities', placement: 'account-menu', frequency: 'setup', purpose: 'Manage roles and capabilities under one identity.' },
  { id: 'agents', label: 'Agents', route: '/agents', placement: 'account-menu', frequency: 'setup', purpose: 'Review autonomous objectives and agent work.' },
  { id: 'connect', label: 'Connect', route: '/connect', placement: 'account-menu', frequency: 'setup', purpose: 'Manage connected channels, storage and external sources.' },
  { id: 'points', label: 'Points', route: '/points', placement: 'account-menu', frequency: 'occasional', purpose: 'Access the Kurukoo Points balance and related utility.' },
  { id: 'cart', label: 'Cart', route: '/cart', placement: 'account-menu', frequency: 'instant', purpose: 'Review prepared commerce context before commitment.' },
  { id: 'subscriptions', label: 'Plans', route: '/subscriptions', placement: 'account-menu', frequency: 'occasional', purpose: 'Plans and entitlements.' },
  { id: 'wallet', label: 'Wallet', route: '/wallet', placement: 'account-menu', frequency: 'occasional', purpose: 'View economic balance and financial state.' },
  { id: 'top-up', label: 'Top up', route: '/top-up', placement: 'account-menu', frequency: 'occasional', purpose: 'Add funds when supported.' },
  { id: 'profile', label: 'Profile', route: '/settings#profile', placement: 'settings-section', frequency: 'configuration', purpose: 'Manage personal identity and account profile.' },
  { id: 'settings', label: 'Settings', route: '/settings', placement: 'settings-section', frequency: 'configuration', purpose: 'Central account, privacy, security, accessibility and preference controls.' },
  { id: 'contacts', label: 'Contacts', route: '/settings#contacts', placement: 'settings-section', frequency: 'setup', purpose: 'Manage contact access and consent-bound phone contacts integration.' },
  { id: 'safety', label: 'Safety & check-ins', route: '/settings#safety', placement: 'settings-section', frequency: 'configuration', purpose: 'Manage safety and consent-bound check-in settings.' },
  { id: 'appearance', label: 'Appearance', route: '/settings#appearance', placement: 'settings-section', frequency: 'configuration', purpose: 'Theme and visual preferences.' },
  { id: 'notifications-settings', label: 'Notification settings', route: '/settings#notifications', placement: 'settings-section', frequency: 'configuration', purpose: 'Notification channels, categories and quiet preferences.' },
  { id: 'privacy-settings', label: 'Privacy', route: '/settings#privacy', placement: 'settings-section', frequency: 'configuration', purpose: 'Privacy, permissions and data-use controls.' },
  { id: 'settings-security', label: 'Security', route: '/settings#security', placement: 'settings-section', frequency: 'configuration', purpose: 'Authentication, sessions and security controls.' },
];
export const PRIMARY_SIDEBAR_ITEMS = AUTHENTICATED_NAVIGATION.filter((item) => item.placement === 'primary-sidebar');
export const SECONDARY_SIDEBAR_ITEMS = AUTHENTICATED_NAVIGATION.filter((item) => item.placement === 'secondary-sidebar');
export const HEADER_ITEMS = AUTHENTICATED_NAVIGATION.filter((item) => item.placement === 'header');
export const ACCOUNT_MENU_ITEMS = AUTHENTICATED_NAVIGATION.filter((item) => item.placement === 'account-menu');
export const SETTINGS_SECTION_ITEMS = AUTHENTICATED_NAVIGATION.filter((item) => item.placement === 'settings-section');
