# Movement and path-pressure optimization

**Audience:** gameplay programmer, systems designer, QA, and release engineer.  
**Status:** Stage 1 FIX. This document defines the measurable contract; it does not claim that the active worktree implements every row.

## Required gameplay movement contract

The public-beat loop is **Gate defense → Echo recovery → growth → occupation/extraction → boss kill**. Movement is therefore a rule-bearing decision, not decorative steering:

- Each of the ten stages must expose a distinct combination of chokepaths, flanks, elevation, hazards, and occupation/extraction points.
- Occupation/extraction ownership must have deterministic, catalog-authored effects on movement, range, or recovery.
- Seeded waves must express scout → pressure → flank → ranged → elite → boss patterns without changing results across display refresh rates.
- Enemy policy must choose among gate pressure, player pursuit/attack, flanking, resource denial, elite escort, and low-HP focus so failure pressure is real.
- HP, damage, speed, density, spawn direction, and boss TTK must be measured across Gatekeeper, Hunter, Collector, Skirmisher, and Generalist sessions.
- Run items, three-choice skills, stats, synergies, extracted companions, stage rewards, and Archive growth remain separate systems. Any movement/range/recovery modifier must show its current → upgraded value and have one simulation-owned source.

`defense-run-simulation.js` owns deterministic 60 Hz movement and policy state. `defense-catalog.js` owns authored stage, wave, policy, and modifier data. `app.js` only translates keyboard/pointer intent. Renderers interpolate or present snapshots and must never move actors or decide targets.

## Current implementation evidence

| check | current observation | status |
|---|---|---|
| keyboard/touch intent admission | `tests/defense-survivor-browser.cjs` passes keyboard movement during and after the cutscene plus touch movement | PASS |
| input feedback latency | 2026-07-22 short probe: 0–0.1 ms samples, below 100 ms | PASS (short probe only) |
| pointer quantization | worktree `app.js` uses a 120-unit dead zone, 640-unit clamp, and eight directions | PASS (mutable until freeze) |
| blur/visibility release | worktree clears held keys and queues `IDLE` | PASS (mutable until freeze) |
| integrated simulation/campaign regression | latest QA run failed 9/23 affected tests after combat integration | FIX |
| integrated five-archetype × ten-stage balance | latest seed-17 probe was 0/50 wins, so current defeat pressure overshoots the 45–55% target | FIX |
| ten distinct stage path-pressure layouts | no frozen stage-by-stage geometry/effect receipt | BLOCKED |
| six enemy policy intents | no frozen policy trace proves all six choices | BLOCKED |
| seeded wave pattern coverage | no scout/pressure/flank/ranged/elite/boss trace artifact | BLOCKED |
| occupation/extraction movement/range/recovery effects | no frozen rule trace or before/after values | BLOCKED |
| five-archetype HP/damage/speed/density/spawn/boss-TTK matrix | no completed five-archetype session artifact | BLOCKED |
| refresh-rate-independent movement digest | no 30/60/120 Hz presentation comparison artifact | BLOCKED |

## Performance thresholds

| metric | threshold | measurement rule |
|---|---:|---|
| input → visible movement feedback | p95 and maximum ≤100 ms | use `abyssal:defense-input-feedback`; compare `displayedAt - admittedAt` |
| simulation cadence | exactly 60 deterministic ticks/s | equal seed + equal tick-indexed inputs must produce identical digest regardless of rAF cadence |
| simulation step cost under Stage 10 density | p95 ≤4.0 ms, max ≤8.0 ms | include movement, targeting, collision, occupation, extraction, and enemy policy work |
| enemy policy/path work | p95 ≤1.5 ms per simulation tick | measure inside the simulation step, not renderer time |
| movement command pressure | at most one queued `MOVE` per actual direction transition per source | key repeat or same-octant pointer motion must not grow the queue |
| frame interval | p95 ≤16.7 ms | same 30-minute evidence as `perf-budget.md` |
| long frames | <0.5% above 33.4 ms | same 30-minute evidence as `perf-budget.md` |
| path correctness | 0 actors outside authored navigable bounds; 0 permanent stalls >120 ticks unless explicitly controlled | inspect deterministic trace at every tick |
| policy coverage | all six enemy intents observed in authored scenarios; 0 undocumented fallback intents | trace policy choice, actor, target, tick, stage, and seed |

## Optimization order

1. **Preserve rules:** do not approximate, skip, or renderer-drive movement to improve frame time.
2. **Deduplicate input:** queue only direction transitions; key-repeat and same-octant pointer events reuse the current intent.
3. **Precompute authored geometry:** derive immutable lane, choke, flank, elevation, hazard, and occupation-point lookup data when a stage starts, not per actor per tick.
4. **Bound policy work:** evaluate policy at deterministic fixed tick intervals and reuse a valid target/path until its rule-defined invalidation condition occurs.
5. **Avoid hot-loop allocation:** reuse deterministic scratch storage and stable actor iteration; do not create arrays, objects, closures, or full sorts per actor per tick.
6. **Cull presentation last:** reduce decorative particles/overdraw before removing danger, occupation, extraction, range, recovery, or confirmation signals.

Any optimization that changes a terminal digest, wave ordering, target choice, occupation timing, extraction result, or current → upgraded value is a gameplay change and must be rejected or retuned in `defense-catalog.js` with new balance evidence.

## Narrow commands

Run from the repository root after integration freeze:

```sh
node --test tests/defense-run-simulation.test.mjs
node tests/defense-survivor-browser.cjs > results/defense-survivor-browser.json
node tests/defense-performance-browser.cjs > results/defense-performance-browser.json
node scripts/run-defense-balance-sim.mjs --strict --output "results/defense-balance-$(git rev-parse --short HEAD).json"
```

Acceptance of movement/path-pressure work additionally requires a deterministic trace artifact from the frozen implementation containing stage, seed, tick, actor, movement intent, enemy policy intent, target, occupation/extraction state, and terminal digest. No command currently emits that complete trace, so the corresponding rows remain **BLOCKED** rather than inferred from the generic simulation suite.

The exact 1,800,000 ms browser soak command and memory/frame/input thresholds are in `engineering/perf-budget.md`. Run it with Stage 10 or the highest unlocked density, automatically select growth/reward choices, exercise movement continuously, and preserve its full-SHA JSON output.
