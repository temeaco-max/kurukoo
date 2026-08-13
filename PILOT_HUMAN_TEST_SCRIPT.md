# Kurukoo Controlled Human Pilot Test Script

**Audience:** Invited Nigerian adult testers using an ordinary mobile browser.
**Scope:** Web Chat Assisted Pilot only. Payment, external provider outreach, dispatch, fulfilment, emergency delivery, and autonomous agents are not active.
**Method:** A facilitator observes but does not lead the tester. Record the exact words, browser/network condition, time, and any confusion. Do not convert an observation into a success claim until reviewed.

## Tester introduction

Tell the tester that Kurukoo is a controlled pilot. It can help them structure a request, use reminders, keep account context, and show a provider response when one exists. They must not assume that a provider is available, payment happened, anyone was contacted externally, dispatch is arranged, or emergency help was sent unless the interface states evidence-backed confirmation. They must not send real money or disclose unnecessary personal, financial, authentication, or safety information.

## Tasks

| # | Tester action | Expected visible result | Expected canonical backend state | Unacceptable result | Severity |
|---:|---|---|---|---|---|
| 1 | Open the supplied Web Chat link on a mobile browser and say naturally what they need help with. | A clear conversation-first response asks useful clarification where needed. | Guest conversation may be created; no Economic Request merely from a greeting. | A fake provider, price, booking, payment, or emergency claim. | P0 |
| 2 | Ask for a realistic supported service, such as a plumber or phone repairer, and give a locality. | Kurukoo clarifies requirements or prepares a request without inventing availability. | Canonical request only after the supported request path has enough information. | An unsupported request becomes “booked,” “dispatched,” or “paid.” | P0 |
| 3 | Authenticate only when prompted, completing name, phone and OTP. | The identity card explains why it is needed and returns the tester to the same conversation. | Guest conversation and request migrate to the authenticated owner. | A new conversation loses prior context or exposes another account’s context. | P0 |
| 4 | Reload the browser during or after authentication. | The tester can return to the same owned conversation/request or receives a truthful recovery state. | No duplicate request or duplicate OTP verification effect. | Duplicate request, switched account, or a hidden failure represented as success. | P0 |
| 5 | Open the Requests workspace. | The request appears with its actual lifecycle status and no fabricated fulfilment claim. | Owner-scoped request query only. | Another user’s request, provider private data, or “paid/fulfilled” without evidence. | P0 |
| 6 | For the scripted provider-response scenario, compare the provider response and quote. | Provider identity and quote are shown as a response/quote; availability and price language remain bounded. | Invitation/response/quote record belongs to the provider and request. | Listed business presented as verified, current, paid, or externally contacted without proof. | P0 |
| 7 | Select the offered provider. | The UI states the selected provider and quote state; it does not imply money or work has happened. | Customer-owned selection; Economic Request may enter `quoted`. | Selection causes payment, escrow, booking, dispatch, or completion. | P0 |
| 8 | Accept the selected quote, then tap again or refresh and repeat. | The UI says accepted/awaiting confirmation and makes no payment or fulfilment claim; repeat action is safe. | Single customer acceptance; request is `awaiting_confirmation`; no payment/escrow side effect. | Duplicate acceptance, hidden duplicate ledger effect, or any “payment successful” label. | P0 |
| 9 | Ask for operator assistance. | A truthful message says the assistance request was recorded; it does not claim the operator is already responding. | One idempotent operator handoff in `requested` state. | Repeated handoffs or a claimed/resolved operator state without operator action. | P1 |
| 10 | Set a reminder for a specific local time, inspect it, and cancel it. | A clear reminder confirmation and status is shown; no external channel delivery is claimed. | Owner-scoped reminder create/read/cancel record. | Reminder attached to another account or “SMS sent” without configured delivery. | P1 |
| 11 | Inspect Memory and Settings, update a permitted profile value, and request data export/delete only in the supervised rehearsal environment. | Controls explain scope and require confirmation where destructive; feedback follows the server result. | Owner-scoped profile/memory/export/delete operations. | Private memory exposed, deletion represented before completion, or data from another account. | P0 |
| 12 | Log out, return to the chat link, and begin a new guest conversation. | The account state is clear and a new guest start does not inherit prior authenticated data. | Auth cookie cleared; guest conversation identity remains separate. | Old private request or memory visible after logout. | P0 |
| 13 | Ask for emergency help or ask whether Kurukoo contacted someone. | Kurukoo gives safety guidance and clearly says it is not an emergency responder; no contact delivery is claimed. | Safety guidance/check-in only; no ordinary Economic Request required by this message. | “Police/ambulance/contact notified” or a normal service request created by emergency language. | P0 |
| 14 | Ask whether WhatsApp, SMS, USSD, or another unconfigured channel can be used. | The page or assistant says the channel is not connected. | No outbound external delivery event. | Any claim that a message was sent or that an adapter is active. | P0 |
| 15 | Leave a request open while the scripted provider becomes unavailable, then try selection/acceptance. | The action stops with an understandable availability/verification message and an operator-help option. | Eligibility revalidation rejects the transition. | Stale/suspended provider selected or accepted. | P0 |

## Facilitator record

For each task, record pass/fail, browser, operating system, approximate network condition, elapsed time, exact confusing words, screenshots only with consent, and the request/conversation reference available to the operator. Record incidents as observations; do not add raw OTPs, full phone numbers, payment information, or private memory in shared notes.

## Stop conditions

Immediately stop the affected session and invoke the pilot shutdown procedure if any P0 unacceptable result occurs; if an operator cannot explain the active request/provider/quote state; if a provider appears eligible without evidence; if any external action is falsely represented; if an account sees another account’s data; or if a cost, security, privacy, payment, safety, or rollback incident is suspected.
