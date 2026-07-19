# Frozen topology and controls

**Designer-approved discovery contract; unimplemented.** Final content uses 24×12; 40×24 is stress-fixture only. Coordinates are `(x,y)` cell centers on the proposed grid.

## Global topology rules

- `stage-navigation.js`: `STAGE_GRID_WIDTH=24`, `STAGE_GRID_HEIGHT=12`; portal `(1,5.5)`, boss `(22,5.5)`.
- Exactly 3 routes, 2 reconnect junctions, ≥4-cell frontage.
- Each route has ≥50% nonshared cells between junctions and ≥1 distinct affordance.
- Longest portal→boss lane ≤1.35× shortest; measured lane success share 15–70% each; static-camp time ≤60%.
- `campaign-state.js` remains sole authority; Three.js/fallback project identical facts.

## Ten-stage matrix

| Stage | Exact routes | Reconnects | Exact node anchors | Shortest cells | Derived walk/surge/enemy | Waves; loop target |
|---|---|---|---|---:|---:|---|
| 1 Cinder Span | Ash Shelf short/exposed; Forge Bridge node/direct; Smelter Catwalk long/cover | x6,x18 y3–8 | `(12,5.5)` | 28 | 6.8/3.9/11.7s | 8/22/36; 60–90s |
| 2 Veil Citadel | Signal Terrace north-node/high; Veil Gate short/exposed; Relay Ramp south-node/long | x6,x18 y2–9 | `(9,2.5)`, `(9,8.5)` | 30 | 7.3/4.2/12.5s | 14–16s command beats; 70–105s |
| 3 Echo Throne | Whisper Stair long/cover; Grand Ascent node/direct; Servitor Ramp short/exposed | x7,x17 y2–9 | `(14,5.5)` | 32 | 7.8/4.4/13.3s | 14–16s command beats; 80–120s |
| 4 Sunken Bastion | Breakwater short/exposed; Flood Causeway node/hazard; Sea Wall long/cover | x6,x18 y2–9 | `(12,5.5)` | 32 | 7.8/4.4/13.3s | 10/24/38/52; 85–125s |
| 5 Howling Sprawl | Ruin Arcade cover; Howling Plaza node/exposed; Collapsed Alleys long/two-bend | x7,x17 y2–9 | `(13,5.5)` | 34 | 8.3/4.7/14.2s | 10/24/38/52; 90–130s |
| 6 Glass Necropolis | Grave Terrace north-node/high; Crystal Nave short/exposed; Crypt Walk south-node/cover | x7,x18 y2–9 | `(10,2.5)`, `(10,8.5)` | 34 | 8.3/4.7/14.2s | 10/26/42/58; 95–135s |
| 7 Starless Canal | Moonless Quay north-node/cover; Twin Bridge Chain short/exposed; Barge Deck south-node/reversible | x6,x18 y2–9 | `(9,2.5)`, `(9,8.5)` | 36 | 8.8/5.0/15.0s | 10/26/42/58; 100–140s |
| 8 Shattered Causeway | Upper Span north-node/high; Shard Steps short/hazard; Underbridge south-node/cover | x7,x17 y2–9 | `(10,2.5)`, `(10,8.5)` | 36 | 8.8/5.0/15.0s | 10/26/42/58; 105–145s |
| 9 Abyss Chancel | Cantor Chain north-node/high; Rite Bridge center-node/reversible; Choir Walk south-node/cover | x6,x18 y2–9 | `(8,2.5)`, `(12,5.5)`, `(8,8.5)` | 38 | 9.3/5.3/15.8s | 10/26/42/58; 110–155s |
| 10 Gate Zenith | Crown Spiral north-node/long; Grand Stair center-node/direct; Pilgrim Stair south-node/cover | x7,x17 y2–9 | `(9,2.5)`, `(12,5.5)`, `(9,8.5)` | 40 | 9.8/5.6/16.7s | 10/26/42/58/74; 120–165s |

Medium/long paths are shortest+2/+4 cells, satisfying ratio ≤1.35. Traversal is calculated from current 4.1/7.2/2.4 speeds, not measured.

## Frozen control targets

| Target | Exact value | Existing mapping | Verification |
|---|---|---|---|
| Simulation | fixed 1/60s; max delta .10s; max 6 catch-up | realtime RAF/update | 30/60/120Hz + 250ms stall |
| Speeds | hold 4.1/7.2/2.4 u/s | realtime speed constants | endpoint difference ≤.05 world units |
| Commander feel | accel 28, decel 36 u/s² | `updateCommander` | start/stop traces |
| Camera | exponential τ=.1304s; zoom hold 18, clamp 9–30 | `updateCamera(dt)`, `onWheel` | endpoint ±.5% at 30/60/120Hz |
| Click/drag | cumulative Euclidean threshold: 6 CSS px mouse/pen, 12 CSS px touch | pointer handlers + `pointerType` | below-boundary release clicks once; at/above boundary segmented drag never picks |
| Input parity | 100% action/target/accepted/state parity | `app.js`→`applyAction`, requestAction, fallback | receipt traces by pointer/keyboard/touch |
| Feedback | p50≤50, p95≤100, max≤200ms | input→reducer→changed RAF | ≥500 samples/device-input profile |
| Command density | ≤5 visible, ≤4 enabled | stage commands, `[data-action]` | enumerate reachable states |

## Verification order

Graph-enumerate route count, nonshared fraction, affordance, ratio, reconnects, frontage and node reachability; then renderer parity; then fixed-step/control traces; then ≥500 responsiveness samples/profile; then unchanged deterministic simulator with casual 45–55% and identical double-run. Undertow trials only after base S7/S9 topology passes.

Sources: [context](context.md), https://web.dev/articles/rail, https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events, https://threejs.org/docs/api/en/math/MathUtils.html#damp.
