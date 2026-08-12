# Kurukoo Phase 6: Architecture Map

The following map shows the end-to-end fulfillment journey and the services participating in each stage.

### 1. Intent Capture & Identity
- **Entry**: `kurukoo-primary-chat.js` (Web Chat)
- **Routing**: `intentRouter.ts` -> `classifyWithFastText`
- **Identity**: `conversationalAuthService.ts` -> `otpAuthService.ts`
- **Context**: `memoryProfile.ts`

### 2. Economic Request Lifecycle
- **Initialization**: `skillFlows.ts` (Canonical lifecycle)
- **Discovery**: `providerDiscovery.ts` -> `memory_profiles`
- **Engagement**: `agenticStorefront.ts` (Stage machine)
- **Matching**: `tradeEngine.ts`

### 3. Fulfillment & Escrow
- **Payment**: `paymentRoutes.ts` -> `pointsEngine.ts`
- **Escrow**: `escrow.ts` (Status-based locking)
- **Evidence**: `skillFlows.ts` (Completion evidence storage)
- **Resolution**: `disputeResolution.ts`

### 4. Native Assistance (Out-of-band)
- **Reminders**: `reminderService.ts` -> `backgroundWorkers.ts`
- **Safety**: `safetyService.ts` -> `backgroundWorkers.ts`
- **Notifications**: `pushNotifications.ts` (Internal queue)

### 5. Management & Observability
- **Hub**: `dashboard.html` (Dynamic multi-section)
- **Settings**: `settings.html`
- **Health**: `healthRoutes.ts` -> `adminRoutes.ts`
