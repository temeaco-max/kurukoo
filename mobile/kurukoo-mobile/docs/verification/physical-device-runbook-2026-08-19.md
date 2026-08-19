# Kurukoo Physical-Device Validation Runbook

This runbook separates repository-deterministic coverage from live device evidence. The current report intentionally claims **no live verification**. A tester should complete each flow on a physical iOS and Android device, attach screenshots or screen recordings, and only then update the machine-readable report.

| Flow | iOS evidence required | Android evidence required | Pass condition |
|---|---|---|---|
| Microphone permission | First capture request, allow and deny states | First capture request, allow and deny states | Permission language is truthful; denied state offers recovery without claiming recording |
| Voice playback | Record, stop, play, pause, replay, discard | Record, stop, play, pause, replay, discard | Review audio is audible, progress follows playback, discard removes the pending clip |
| QR linking | Camera permission, scan, expiry, refresh, confirmation | Camera permission, scan, expiry, refresh, confirmation | Valid QR confirms once; expired or invalid QR fails closed |
| Connected storage | Connect provider, sync, retry/offline, delete | Connect provider, sync, retry/offline, delete | Storage state reflects provider evidence; no unavailable provider is reported as synced |
| First launch persistence | Verify, close/relaunch, resume state | Verify, close/relaunch, resume state | State survives relaunch without leaking private context |

For every run, record device model, operating-system version, app build, UTC timestamp, flow result, and evidence paths. The sandbox test suite covers deterministic contracts for these flows, but it cannot replace microphone hardware, camera hardware, native audio playback, OAuth consent, or provider-side storage evidence.
