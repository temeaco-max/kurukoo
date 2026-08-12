# Kurukoo Phase 6: Capability Matrix

| Blueprint Capability | Existing Implementation | Status | Relevant Service |
| :--- | :--- | :--- | :--- |
| **Conversation** | Full streaming SSE chat | Implemented | `chatConversationService.ts` |
| **Authentication** | OTP-first phone login, JWT | Implemented | `authRoutes.ts`, `otpAuthService.ts` |
| **Onboarding** | Progressive name/goal capture | Implemented | `progressiveOnboarding.ts` |
| **Memory Profile** | Persistent user context | Implemented | `memoryProfile.ts` |
| **Reminders** | Native reminders, background worker | Implemented | `reminderService.ts` |
| **Emergency Contacts** | - | **Missing** | Need `safetyService.ts` expansion |
| **Emergency/Help Requests**| Safety check-ins | Partial | `safetyService.ts` |
| **Tasks** | - | Partial | `taskRoutes.ts` (needs review) |
| **Product Sourcing** | Opportunity engine, offers | Partial | `opportunityEngine.ts` |
| **Food** | Category flow, matching | Implemented | `skillFlows.ts` |
| **Rides/Transport** | Category flow, matching | Implemented | `skillFlows.ts` |
| **Repairs** | Category flow, matching | Implemented | `skillFlows.ts` |
| **Workers/Services** | Skill matching | Implemented | `skillFlows.ts` |
| **Accommodation** | - | **Missing** | - |
| **Tickets** | - | **Missing** | - |
| **Events** | - | **Missing** | - |
| **Artists/Creators** | Shared economic lifecycle | Implemented | `skillFlows.ts` |
| **Businesses** | Provider entity types | Implemented | `providerEntity.ts` |
| **Provider Discovery** | Skill-based matching | Implemented | `providerDiscovery.ts` |
| **Availability** | Provider availability toggle | Implemented | `memoryProfile.ts` |
| **Quotes** | Economic request quotes | Implemented | `skillFlows.ts` |
| **Reservations** | - | **Missing** | - |
| **Payments** | Sandbox provider, Points | Partial | `paymentRoutes.ts` |
| **Escrow** | Lifecycle-based escrow | Implemented | `escrow.ts`, `tradeEngine.ts` |
| **Fulfilment** | Milestone tracking | Implemented | `skillFlows.ts` |
| **Tracking** | - | Partial | Needs visual tracking |
| **Evidence** | Completion evidence storage | Implemented | `skillFlows.ts` |
| **Cancellation** | Lifecycle-based cancellation | Implemented | `skillFlows.ts` |
| **Disputes** | Disputed status, resolution | Implemented | `disputeResolution.ts` |
| **Completion** | Final resolution, points award | Implemented | `skillFlows.ts` |
| **Ratings** | Provider ratings | Implemented | `ratingService.ts` |
| **Points** | Credit economy | Implemented | `pointsEngine.ts` |
| **Referrals** | Referral codes, tracking | Implemented | `referralService.ts` |
| **Contributors** | - | Partial | - |
| **Partners** | - | Partial | - |
| **Channels** | Web, WhatsApp, SMS, USSD | Partial | `channelRoutes.ts` |
| **Web Chat** | Primary streaming client | Implemented | `kurukoo-primary-chat.js` |
| **WhatsApp** | Webhook capture, link generation | Partial | `whatsapp.ts` |
| **SMS** | Webhook capture | Partial | `sms.ts` |
| **USSD** | Webhook capture | Partial | `ussd.ts` |
| **AI Agents** | Multi-agent prompts, execution | Implemented | `aiAgentService.ts` |
| **Execution Connectors** | Constrained execution lifecycle | Implemented | `executionConnector.ts` |
| **Resources** | SEO-backed articles | Implemented | `seoService.ts` |
| **Explore** | Category-based discovery | Implemented | `publicRoutes.ts` |
| **Request Hub** | Authenticated management | Implemented | `dashboard.html` |
| **Notifications** | Internal queue, fallback | Implemented | `pushNotifications.ts` |
| **Settings** | - | **Missing** | Need authenticated settings UI |
| **Offers** | Market opportunities | Implemented | `opportunityEngine.ts` |
| **Adverts** | Ad campaigns | Implemented | `adManager.ts` |
| **Product Presentation** | Card-based cards | Partial | `kurukoo-primary-chat.js` |
| **Cart/Order Presentation**| Milestone-based cards | Partial | `kurukoo-primary-chat.js` |
