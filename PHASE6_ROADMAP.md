# Kurukoo Phase 6: Roadmap & Consolidation

### 1. Consolidations & Cleanup
- **Consolidated Auth**: Removed redundant `/claim` routes. Guest migration is now unified in `authRoutes.ts` and `conversationalAuthService.ts`.
- **Neutralized Keep-Alive**: Removed the obsolete `analyticsService.ts` and its associated admin endpoints.
- **CSS Tokenization**: Moved all embedded styles into `kurukoo-chat.css`, `kurukoo-home.css`, and `kurukoo-hub.css` using shared tokens.
- **Truthful Copy**: Scrubbed "instant", "guaranteed", and unconfigured channel claims from all public surfaces.

### 2. Remaining Roadmap

#### Build Now (Local)
- **Visual Tracking**: Implement a visual progress bar for Economic Requests in the chat interface.
- **Profile Completion**: Add a dedicated "Profile" edit form in the Settings page.

#### Requires External Integration
- **Channel Delivery**: Configure WhatsApp (Meta), SMS (Africa's Talking), and FCM (Google) adapters.
- **Real-world Payments**: Connect a regulated PSP (e.g. Paystack, Stripe) for real-world escrow settlement.

#### Future Strategic Work
- **Autonomous Hardware**: Implement connectors for IoT, drones, and robots when hardware partners are established.
- **Global Expansion**: Localize intents and resources for additional West African markets (Ghana, Kenya).
