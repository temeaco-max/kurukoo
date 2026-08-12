# Phase 5 Browser Validation Findings

## Verified Journeys

| Journey | Observation | Outcome |
|---|---|---|
| Guest conversation entry | A first-time visitor can open `/chat`, enter a plumbing or known-offer request, and receive an identity gate only once the request reaches a protected fulfilment action. | Passed after the optional-auth and guest-session changes. |
| OTP return to conversation | The login page returns the user to the exact `conversationId`; guest messages are visible after authentication. | Passed. |
| Post-login request continuity | A previously displayed sign-in gate is rendered as **You’re signed in** after authentication. The backend marks the claimed profile onboarding-complete so the next message is not diverted into onboarding. | Passed after correction. |
| Known-offer continuity | A guest request for "Ada’s blue generator" is safely held behind authentication. After signing in, the original read-only offer card is restored and the user can choose it to create one canonical product-sourcing request. | Passed with an isolated local fixture. |
| Request Hub access and logout | `/web` opens for an authenticated user, exposes a visible logout control, and redirects an unauthenticated user to `/login?return=%2Fweb`. | Passed. |

## UX Corrections Made During Testing

The testing found two continuity defects. First, an authenticated user who resumed a guest request was being diverted into onboarding. The profile is now marked onboarding-complete only when it claims an anonymous request history. Second, the guest identity gate discarded the pre-auth storefront card. The gate now retains the safe card projection and renders it only after the user has authenticated.

## Local Test Conditions

All OTP browser checks used a development-only server with `OTP_DEBUG=true` and a locally supplied test JWT secret. No external messaging, payment, provider-contact, or execution integration was invoked. The known-offer view used an explicitly marked temporary local fixture and no live provider relationship.

## 2026-08-12 browser validation checkpoint

The first desktop homepage inspection rendered the updated server template and showed the Web Chat availability treatment. The subsequent `/chat/` inspection revealed that the running development server was serving a stale built static chat shell: it still showed the retired multi-channel footer, old quick actions, and the old Points prompt. This is a build/runtime-boundary finding, not an accepted validation result. The public assets must be rebuilt and the server restarted before the required six-viewport validation continues.

### 360px responsive capture

The rebuilt homepage and Web Chat shell render without visible horizontal overflow at 360px. The homepage collapses its hero actions into full-width, tappable controls and preserves the Web Chat access treatment. The chat shell collapses to a compact mobile header and retains a visible composer with the request quick actions. The capture is suitable for the next responsive comparison; the homepage body copy still uses the generic phrase “Find trusted providers,” which will be corrected before final acceptance because it overstates verified availability.

### 414px responsive capture

The rebuilt 414px homepage renders the corrected conditional lead copy, retains two comfortably sized stacked CTAs, and keeps the header controls within the viewport. The 414px Web Chat view wraps all quick actions cleanly, preserves readable body text, and keeps the composer controls within the viewport. No clipped text or horizontal overflow was visible in either capture.

### 768px responsive capture

At the tablet breakpoint, the homepage keeps a clear single-column hero and the conversation preview remains fully contained. The chat shell introduces its sidebar without crowding the message area; the header, quick actions, and composer remain readable and usable. No horizontal overflow or clipped controls were visible.

### 900px responsive capture

At 900px, the homepage retains a balanced hero and contained request preview while mobile navigation remains intentionally active at this breakpoint. The chat workspace maintains a stable sidebar, centered welcome state, and un-clipped composer. No layout collision, overflow, or stale channel copy was visible.

### 1280px responsive capture

At 1280px, the homepage transitions to full desktop navigation and a balanced two-column hero without crowding the primary actions. The chat workspace displays stable left navigation, central conversation space, and right request-context panel; all persistent controls remain visible and its public language correctly limits access to Web Chat.

### 1440px responsive capture

At 1440px, full navigation, primary actions, and the homepage request illustration have ample space and clear hierarchy. The Web Chat layout maintains balanced three-column workspace proportions, a visible composer, readable supporting context, and the Web Chat-only availability message. No layout regressions were visible.

## Responsive conclusion

Responsive screenshots were captured and visually reviewed at 360px, 414px, 768px, 900px, 1280px, and 1440px for both the homepage and the Web Chat shell. The final rebuilt runtime showed no visible horizontal overflow, clipped controls, or stale multi-channel copy across these viewports.

## Guest-to-auth browser checkpoint

A fresh guest request in the correctly bound current server produced the updated gate copy: it says to review the next supported action and no longer promises provider connection, quotes, or booking. The browser also exposed an operational testing caveat: the default local SQLite database contained an earlier pre-fix conversation, so historical messages can still display old copy. The new request itself used the corrected current route behavior; this is not a production data migration requirement because the stale text is persisted test data.

## Route and channel browser checkpoint

The unauthenticated `/web` visit redirected to `/login?return=%2Fweb` as required. The Channels page rendered Web Chat as the only active access point, showed WhatsApp, USSD, and SMS as not connected, and exposed only Web Chat links for those unavailable entries. No unsupported external channel link was present.

## Support and partnership browser checkpoint

The rebuilt Contact page contains no non-functional form and directs users to Web Chat; it explicitly states that WhatsApp, USSD, SMS, and direct email support are not configured. The rebuilt Partners page uses scoped Web Chat, contact, and API-docs routes and describes verification, payment, and integration as conditional on configured boundaries. No unsupported outbound channel or marketplace claim was visible.
