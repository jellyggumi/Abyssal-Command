# Decision log — vertical-slice implementation

| id | decision | evidence / rationale | owner | status |
| --- | --- | --- | --- | --- |
| I-01 | Enter Stage 1 FIX implementation, not concept work | Prior cycle retrospective required a bounded implementation-and-measurement run | director | locked |
| I-02 | Keep `defense-catalog.js` as sole numeric/data authority | Existing catalog/simulation ownership and replay invariant | designer | locked |
| I-03 | Isolate crit/map randomness from current run RNG | Existing run RNG drives wave planning then growth offers; new draws must not perturb prior offer sequence | programmer | locked |
| I-04 | Keep reward choice certain; probability result non-mechanical and fully disclosed | No-commerce fairness contract; avoids pay/progression advantage | PM | locked |
| I-05 | Idle return is explicit-time, cap-bound, one-settlement local receipt | Existing campaign persistence has one hash-checked envelope; idempotency must be durable | PM | locked |
| I-06 | PCG stays finite, pre-tick, catalog-declared and collision-free | Existing movement has no obstacle/collision model; objective anchors must remain fixed | PCG | locked |
| I-07 | Procedural local audio and text fallback are required | Runtime has no audio media/provider surface; ElevenLabs is build-only optional | audio | locked |
