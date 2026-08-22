# Kurukoo OS Weave — Quick Ride Addendum

Quick Ride is the canonical reference implementation of the Kurukoo OS weave.

## User path

```text
single Quick Ride action
  → origin/location + destination
  → optional vehicle choice (any / bike / keke / taxi)
  → Economic Request
  → live provider broadcast
  → provider notification
  → provider accepts
  → Points lead charge at acceptance exactly once
  → request-scoped Provider Communication Session
  → WebRTC data/audio/video where available
  → intermittent GPS + Trickbridge movement optimisation
  → provider marks Arrived
  → user notification + communication affordance
  → provider completes
  → provider becomes available again
  → user review/feedback
```

## Commercial rule

Lead charging occurs at provider acceptance. Completion/review never creates a second lead charge.

## Transport rule

WebRTC is the preferred direct transport for provider communication. Trickbridge reduces GPS/backend traffic. PSTN masking is an explicit fallback adapter, not the primary provider communication model.

## Client rule

Web/mobile clients consume the same canonical Economic Request and Provider Communication Session. They must not implement a second ride lifecycle.
