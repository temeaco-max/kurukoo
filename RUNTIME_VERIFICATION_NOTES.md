# Built Runtime Verification Notes

**Verification date:** 2026-08-13

The freshly built application was started from `dist` on local port 3100. The `/chat` route rendered successfully in guest mode, including the existing conversation inspector. The runtime page exposed the new notification-delivery inspector card in its HTML; because the session was a guest, the client correctly left authenticated notification data hidden rather than making an external delivery claim.

The `/saved` route redirected a guest session to `/login?return=%2Fsaved`. This confirms that the new affiliate-offer workspace projection remains behind the existing authenticated route boundary and is not publicly listed to unauthenticated visitors.

No live external messaging, payment, affiliate merchant action, or fulfilment was invoked during this verification.
