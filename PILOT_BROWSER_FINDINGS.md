# Pilot Browser Findings

The latest compiled runtime was started on port 3001 with `KURUKOO_WORKERS=0`, so the browser evidence reflects the current pilot-hardening build rather than a stale development server.

All tested public routes returned expected responses: 200 for directly rendered pages and 301 for canonical redirect routes such as `/advertise`, `/discover`, `/partners`, `/resources`, and `/chat`.

At 360px, the homepage retained readable heading scale, full-width touch targets, visible Web Chat availability, and no horizontal clipping. At 1440px, the canonical page container, navigation, hero copy, and conversational preview retained balanced alignment and expected margins. No new padding, margin, or overflow regression was observed from the pilot-hardening changes.

The runtime health endpoint returned `status: ok`, `database: ok`, `payment_provider: sandbox`, and `economic_payments_enabled: false`. The runtime log explicitly reported workers disabled and unconfigured external secrets without claiming those integrations were active.

The browser matrix is evidence of repository/runtime behaviour only; no unrestricted human test group or production payment/provider/channel delivery was performed.
