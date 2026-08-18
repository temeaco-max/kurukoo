# Prayer Companion Review Checklist

Before merge, run the existing TypeScript/build/route suites plus `scripts/test-prayer-agent.ts` and `scripts/test-prayer-live-contract.ts`.

Verify with credentials supplied at deployment:
- text prayer generation;
- server TTS audio;
- Gemini Live prayer session;
- daily and weekly prayer routine delivery through the existing reminder engine;
- pause/end/restart voice sessions;
- no fabricated supernatural guarantees;
- no cross-user profile leakage;
- external-key absence fails closed while text prayer remains usable.
