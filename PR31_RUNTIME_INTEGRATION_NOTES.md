# PR #31 Built-Runtime Integration Notes

## 2026-08-13 initial browser pass

| Route | Result | Finding |
|---|---|---|
| `/` | Pass | The homepage hero renders the updated conversational fulfilment, personal-assistance, provider/inventory, and controlled-coordination positioning cleanly at the desktop viewport. Navigation, CTA controls, illustrative request card, and truthfulness labels render without visible overlap. |
| `/chat` | Partial | The guest chat shell, three-column desktop layout, controls, and inspector render cleanly. However, the initial welcome paragraph is replaced at runtime with older generic copy by the chat client, so the new positioning in `public/chat/index.html` is not visible in the live guest welcome state. This requires a client-copy correction before final approval. |

No screenshot-only claim has been made for authenticated workspace routes; they require an authenticated test session. The route and DOM contracts passed before browser checks.

| `/chat` after client correction | Pass | The client-rendered guest welcome now displays the updated personal-assistance, provider/inventory, bounded-goal, and evidence-gated external-execution positioning. The chat layout, quick actions, navigation, composer, and inspector remained clean at the desktop viewport. |
| `/how-it-works` | Pass | The full operational positioning, four request steps, and explicit conditional execution boundaries render cleanly without overlap in the built application. |
| `/network` | Pass | Provider/inventory positioning and bounded software-agent language render cleanly. The route explicitly preserves the distinction between participation and verification, availability, selection, dispatch, payment, and fulfilment. |

## Messaging documentation reconciliation

`MESSAGING_PRODUCTION_READINESS.md` was checked against the canonical outbox implementation. The documentation was corrected to state both actual worker gates: `KURUKOO_WORKERS` must not be `0`, and `KURUKOO_COMMUNICATION_OUTBOX_ENABLED` must not be `false`. The documented frontend positioning now matches the implementation: external execution is controlled and evidence-gated; provider acceptance is not delivery; unconfigured and suppressed transports do not imply external fulfilment.
