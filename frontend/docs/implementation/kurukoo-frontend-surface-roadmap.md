# Kurukoo frontend surface implementation

Scope: build the authenticated consumer surfaces in sequence: Perch/Home, Explore, Agents, Artifacts, Activity, Connect, Pulse/Nearby, then Work detail.

Principles:
- reuse existing canonical APIs/projections and shell components;
- no fabricated execution, availability, payment, provider acceptance, or outcome;
- Chat/Voice remains the primary interaction surface;
- Work detail presents Goal → Understanding → Options → Decision → Approval → Action → Evidence → Outcome → Follow-up;
- preserve current main architecture and existing backend contracts.

Sequence:
1. Perch/Home command centre
2. Explore discovery
3. Agents
4. Artifacts
5. Activity continuity timeline
6. Connect
7. Pulse/Nearby
8. Work detail execution story
