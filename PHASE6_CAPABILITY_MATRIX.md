# Kurukoo Phase 6: Capability Matrix

| Blueprint Capability | Existing Implementation | Status | Relevant Service |
| :--- | :--- | :--- | :--- |
| **Conversation** | Full streaming SSE chat | Implemented | `chatConversationService.ts` |
| **Authentication** | OTP-first phone login, JWT, Conversational Auth | Implemented | `authRoutes.ts`, `conversationalAuthService.ts` |
| **Onboarding** | Progressive name/goal capture | Implemented | `progressiveOnboarding.ts` |
| **Memory Profile** | Persistent user context | Implemented | `memoryProfile.ts` |
| **Reminders** | Native reminders, background worker | Implemented | `reminderService.ts` |
| **Emergency Contacts** | Conversational capture, activation, management | Implemented | `safetyService.ts` |
| **Emergency/Help Requests**| Safety check-ins, escalation boundary | Implemented | `safetyService.ts` |
| **Tasks** | Universal Economic Request flow | Implemented | `skillFlows.ts` |
| **Product Sourcing** | Known offer flow, coordination cards | Implemented | `agenticStorefront.ts` |
| **Food** | Category flow, matching, dispatch | Implemented | `skillFlows.ts` |
| **Rides/Transport** | Category flow, matching, dispatch | Implemented | `skillFlows.ts` |
| **Repairs** | Category flow, matching | Implemented | `skillFlows.ts` |
| **Workers/Services** | Skill matching, availability | Implemented | `skillFlows.ts` |
| **Accommodation** | Shared economic lifecycle | Implemented | `skillFlows.ts` |
| **Tickets** | Shared economic lifecycle | Implemented | `skillFlows.ts` |
| **Events** | Shared economic lifecycle | Implemented | `skillFlows.ts` |
| **Artists/Creators** | Shared economic lifecycle | Implemented | `skillFlows.ts` |
| **Businesses** | Provider entity types | Implemented | `providerEntity.ts` |
| **Provider Discovery** | Skill-based matching, nearby radar | Implemented | `providerDiscovery.ts` |
| **Availability** | Provider availability toggle | Implemented | `memoryProfile.ts` |
| **Quotes** | Economic request quotes, indicative rates | Implemented | `skillFlows.ts` |
| **Reservations** | Slot-fill, requirement capture | Implemented | `skillFlows.ts` |
| **Payments** | Sandbox provider, Points, escrow locking | Implemented | `paymentRoutes.ts` |
| **Escrow** | Lifecycle-based escrow, dispute freeze | Implemented | `escrow.ts`, `tradeEngine.ts` |
| **Fulfilment** | Milestone tracking, handover evidence | Implemented | `skillFlows.ts` |
| **Tracking** | Visual progress tracking in chat cards | Implemented | `kurukoo-primary-chat.js` |
| **Evidence** | Completion evidence storage | Implemented | `skillFlows.ts` |
| **Cancellation** | Lifecycle-based cancellation | Implemented | `skillFlows.ts` |
| **Disputes** | Disputed status, resolution, cooling-off | Implemented | `disputeResolution.ts` |
| **Completion** | Final resolution, points award | Implemented | `skillFlows.ts` |
| **Ratings** | Provider ratings | Implemented | `ratingService.ts` |
| **Points** | Credit economy, wallet balance | Implemented | `pointsEngine.ts` |
| **Referrals** | Referral codes, tracking | Implemented | `referralService.ts` |
| **Contributors** | Role-based contribution flows | Implemented | `memoryProfile.ts` |
| **Partners** | External organization boundaries | Implemented | `memoryProfile.ts` |
| **Channels** | Web, WhatsApp, SMS, USSD (Truthful status) | Implemented | `channels.ejs` |
| **Web Chat** | Primary streaming client, sidebar, inspector | Implemented | `kurukoo-primary-chat.js` |
| **WhatsApp** | Webhook capture, truthful unavailability | Implemented | `whatsapp.ts` |
| **SMS** | Webhook capture, truthful unavailability | Implemented | `sms.ts` |
| **USSD** | Webhook capture, truthful unavailability | Implemented | `ussd.ts` |
| **AI Agents** | Multi-agent prompts, representation | Implemented | `aiAgentService.ts` |
| **Execution Connectors** | Constrained execution lifecycle | Implemented | `executionConnector.ts` |
| **Resources** | SEO-backed articles, FAQs | Implemented | `seoService.ts` |
| **Explore** | Category-based discovery | Implemented | `publicRoutes.ts` |
| **Request Hub** | Dynamic authenticated management | Implemented | `dashboard.html` |
| **Notifications** | Internal queue, fallback, admin stats | Implemented | `pushNotifications.ts` |
| **Settings** | Authenticated profile & privacy management | Implemented | `settings.html` |
| **Offers** | Market opportunities, known offers flow | Implemented | `opportunityEngine.ts` |
| **Adverts** | Ad campaigns, sponsored suggestions | Implemented | `adManager.ts` |
| **Product Presentation** | Agentic storefront cards, rich media | Implemented | `kurukoo-primary-chat.js` |
| **Cart/Order Presentation**| Milestone-based coordination cards | Implemented | `kurukoo-primary-chat.js` |
