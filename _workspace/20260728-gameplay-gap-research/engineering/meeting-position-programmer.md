# Meeting Position — Programmer (architecture / perf / feasibility)

> Domain: perf budget (G6: p95 ≤16.7ms/frame, input ≤100ms, stable soak), build cost/risk of each proposed change, ordering by risk. Read-only; grounded in `current-systems-inventory.md`, `current-structure-baseline.md`, `gap-analysis.md`, `research/comparable-gameplay/report.md`, and direct source (`defense-run-simulation.js`, `campaign-state.js`).

---

## 1. G6 is the standing constraint, and it is FAIL — perf pass must GATE anything that adds actors/effects/density

Baseline (stage1b, `current-structure-baseline.md:35`; `design-intent-digest.md:90`):

| Target | Budget | Measured | Over budget |
|---|---|---|---|
| Desktop frame p95 | ≤16.7 ms | **16.8 ms** | ×1.01 (already over) |
| Midtier mobile p95 | ≤16.7 ms | **33.3 ms** | **×2.0** (long-frame ratio 0.021 vs ≤0.005 = ×4.2) |
| Low mobile p95 | ≤16.7 ms | **50 ms** | **×3.0** (ratio 0.193 vs ≤0.005 = ×38) |
| Soak heap slope | ≤0 (stable) | **0.1138 MiB/min** | `memoryStable=false` |

We are already over budget on the CHEAPEST device (desktop) and 2–3× over on mobile — the platform the pillars call the primary target (`design-intent-digest.md:29`). **Every proposal that raises on-screen actor count, effect count, or per-tick allocation makes the FAILING gate worse.** Two comparable titles corroborate this as the genre's dominant failure mode, not a corner case:

- **Soulstone Survivors — #1 technical complaint is late-game lag**: "even high-end rigs (RTX 3080/4090, i9) hit severe frame drops in deep Overlord loops / Titan hunts due to on-screen chaos (skill-effect math, projectile collision, minions)" (`report.md:90`). Its endless/curse endgame is exactly the ceiling-fix we are considering for G1 — and it is what *breaks* their frame budget even on hardware far above a midtier phone.
- **Vampire Survivors — endgame "watching fireworks" with frame-rate/CPU drops "especially in Endless/cluttered states"** (`report.md:50`).

Both games prove the causal chain we are about to walk into: *more actors/effects → frame collapse*, and they hit it on desktop-class silicon. Our G6 already fails on a phone. **Engineering position: a perf-budget pass is a hard gate on any feature that increases actor/effect/density load. It is not a "feature" line-item; it is the precondition.** The gap-analysis already states this (`gap-analysis.md:18,27`) — I am ratifying it with the numbers and flagging that G2's fix is the one proposal that escapes the gate (below).

### Where the mobile cost actually lives (source-traced)

The 33–50 ms mobile p95 and the heap slope are two different problems in two different layers:

- **Per-frame allocation → heap slope (soak).** The sim allocates fresh objects every tick per actor: a `MOVE` event object per moving actor per tick (`defense-run-simulation.js:1427-1435`), plus `clone()` calls across the tick path. At endless density this is linear-in-actors garbage every frame → GC pressure → `memoryStable=false`.
- **Super-linear targeting → frame p95.** `moveEnemies` iterates all enemies (`:1407`); inside, `elite-escort` calls `sortedActors(run.enemies).find(...)` **per enemy** (`:1368`) and `resource-denial` calls `run.pickups.filter().sort()` **per enemy** (`:1361`). That is O(N²·logN) worst case in enemy count. Companion auto-fire nearest-target is O(companions×enemies). Raising density (any endless/tier ladder) amplifies this quadratically.

---

## 2. Risk-adjusted cost table (build cost / risk of each proposed change)

Risk axes: **Layer** (which subsystem is edited) · **Digest** (does it change `getRunDigest` bytes = `JSON.stringify(getRunSnapshot)`, `defense-run-simulation.js:2360-2361`) · **G6/perf** (does it add actors/effects/allocation) · **Balance** (does it reopen the already-FAIL G2/G3 balance surface).

| # | Proposal | Layer touched | Digest | G6/perf load | Balance reopen | Build cost | Risk | Leverage (gap consensus) |
|---|---|---|---|---|---|---|---|---|
| **a** | **G2 idle-sink** — wire `settleIdleReturn.awardedProgress`/`totalProgress` (`campaign-state.js:244-248`) into a spendable currency + existing Warden meta sinks | **Meta only** (`campaign-state.js` + `app.js` UI) | **Untouched** ✅ | **Zero new actors/effects** ✅ | No (it is a currency sink, not run balance) | **LOW** | **LOWEST** | **Highest — 8/10 games converge** (`gap-analysis.md:23`); Melvor PRIMARY (`report.md:171`) |
| **d** | **M4 card revive** to player UI (state machine already in sim, `:1128-1196`) | Sim input surface + `app.js` UI (+ combat effect if made non-inert) | Changes bytes for runs that use it (deterministic per input tape) ⚠ | ~0 new actors (a decision, not a spawn) | Only if given a combat effect (currently inert, `inventory §Dead #4`) | **LOW-MED** | **LOW-MED** | Med — cheapest G3 in-run-decision enabler; reuses built machinery (`gap-analysis.md:12`) |
| **b** | **G1 tier ladder** over the 10 stages — scale params + unlock state | **Sim** (`createDefenseRun`/scale `:472-479,2025`) + meta | **Changes bytes** ⚠ needs replay test | **Worsens FAILING G6** (scaling → density) ⚠⚠ | **Yes** — reopens G2 balance envelope per tier | **MED** | **MED (perf-gated)** | High consensus (Soulstone/Survivor.io/20MTD/VS, `report.md:91,151,131`) |
| **c** | **G3 formation/synergy axis** — new in-run synergy-threshold + evolution rules | **Sim, deepest** (`makeOffer`/skill apply `:971-1007` + new rules) | **Changes bytes** ⚠⚠ + rebalance | Adds effect/actor churn ⚠ | **Yes — G3 already FAIL** (`design-intent-digest.md:89`) | **MED-HIGH** | **HIGHEST** | Needed vs "solved build" (`report.md:131`) but riskiest atop a failing gate |

### Risk-adjusted leverage ranking (best first)

1. **(a) G2 idle-sink — do first.** Highest gap consensus, lowest risk, and it is the *only* proposal that touches neither the sim nor the frame budget. The offline-settle architecture already exists and is judged superior to HoloCure's app-open idle (`report.md:111`; `gap-analysis.md:23`). `settleIdleReturn` already computes and banks `awardedProgress` (`campaign-state.js:244-249`); the missing piece is a spend function that mirrors the *proven* earned/spent budget-check pattern in `allocateWardenStatPoint` / `purchaseEquipmentTier` (`campaign-state.js:333,346,373`). Pure meta. **This can ship without the perf gate.**
2. **(d) M4 revive as the G3 in-run decision layer.** The sim state machine is fully built and tested (`:1128-1196`; `inventory §Dead #4`) — reviving it to a player UI is far cheaper than authoring a fresh G3 axis. Keep it a *decision* (digest-safe-ish, deterministic per input tape); only escalate to MED once you attach a real combat effect (which then reopens balance).
3. **(b) G1 tier ladder — perf-gated.** Strong consensus and reuses the 10 stages (zero new authoring, `gap-analysis.md:24`), but it directly worsens the FAILING G6 and reopens the FAILING G2 balance per tier. **Blocked behind the perf-budget pass.**
4. **(c) G3 synergy/evolution axis — last.** Highest engineering + balance risk (deepest sim surface, G2/G3 already FAIL). Do the cheap M4 enabler (d) and the perf pass first; only then add a fresh axis.

---

## 3. Determinism guard (getRunDigest reproducibility) — which proposals touch the sim

`getRunDigest(run) = JSON.stringify(getRunSnapshot(run))` (`defense-run-simulation.js:2360-2361`); the renderer is already contract-proven read-only and cannot observe the digest (`battle-realtime-three.js:450-452`; `design-intent-digest.md:27`). Flags:

- **(a) G2 idle-sink — PURE META, digest byte-identical.** `campaign-state.js` + `app.js` only; no tick-path edit. Any same-seed replay must produce the *unchanged* digest — that byte-equality is the proof it stayed off the sim. ✅
- **(d) M4 revive — SIM INPUT SURFACE.** `processM4Decision` mutates `run.m4` (`:1144-1147`) → it is in the snapshot, so real runs' digests reflect the decision. Determinism (same seed + same input tape → identical digest) still holds; it must be re-proven with a replay test extending `tests/defense-run-simulation-rpg.test.mjs` (the F2/V4 pattern in `current-core-loop-map-20260726.md:162`). ⚠
- **(b) G1 tier ladder — SIM.** Scale params feed `createDefenseRun`/enemy scale (`:472-479,2025`) → snapshot changes → digest changes; requires a new determinism replay case per tier + the full G2 rebalance export (`maxEV/medianEV ≤1.30`, currently 1.70, `design-intent-digest.md:88`). ⚠
- **(c) G3 synergy axis — SIM, DEEPEST.** New rules in `makeOffer`/skill application (`:971-1007`) → digest changes + rebalance + must not violate the R3 cross-category 1.3× ceiling still un-enforced in code (`inventory §Dead #1`; `design-intent-digest.md:99`). ⚠⚠

Rule I am asserting for the cycle: **meta/UI proposals must prove digest byte-identical; sim proposals must ship a same-seed replay determinism test in the same slice.** No sim edit lands without its replay case.

---

## 4. Movement-path / perf note — the specific lane to run BEFORE endless

**Mobile 33–50 ms is the real blocker, not desktop.** Desktop is 0.1 ms over; midtier is 2× over and low-end 3× over (`design-intent-digest.md:90`). The fix is not "make the sim tick cheaper in aggregate" — it is two named lanes, split by which side of the determinism boundary they live on:

1. **Renderer actor instancing (digest-safe, primary mobile frame lever).** Mobile p95 is dominated by per-object render/JS overhead. Batch actors into three.js `InstancedMesh` in `battle-realtime-three.js` — renderer-side, never touches the snapshot, so it is unconditionally digest-safe. This is the single highest-leverage move for the 33.3 ms → 16.7 ms midtier gap.
2. **Effect/event pooling (attacks the heap slope).** Renderer VFX pooling is digest-safe. **Sim-side event-object reuse** (pre-allocated buffers instead of a fresh `MOVE` object per actor per tick, `:1427-1435`) attacks `memoryStable=false` directly, but must be verified byte-identical against `getRunSnapshot` first (events may be snapshot-observed — confirm before touching).
3. **Spatial partitioning for the O(N²) targeting policies** (`elite-escort` `:1368`, `resource-denial` `:1361`) — sim-side, only worth it once density actually rises (i.e. after/with G1), and only behind a passing replay test.

**Ordering: instancing + pooling get midtier under 16.7 ms and the heap slope to ≤0 FIRST. Only then does any actor/density-adding feature (G1 tier ladder, G3 effects) unlock.** G2 (pure meta) is exempt and proceeds in parallel.

---

## VOTE

**Stage 1 concept shift — but sequenced, not wholesale.** The finite-ceiling→reinvest-loop pivot is the right structural call, and its highest-leverage slice (G2 idle-sink) adds *zero* perf load and *zero* sim risk — it is nearly free and can ship now. The perf-heavy half of the concept shift (G1 endless/tier density, G3 synergy effects) rides behind a mandatory G6 perf-budget pass; shipping endless on a 2–3×-over-budget mobile frame would reproduce Soulstone's #1 complaint (`report.md:90`) as our own.

**Smallest high-leverage step (my domain):** In `campaign-state.js`, make `settleIdleReturn`'s `awardedProgress`/`totalProgress` (`:244-248`) a *spendable* Undertow currency with one Warden meta sink, mirroring the existing `allocateWardenStatPoint` earned/spent budget-check pattern (`:333`), plus a quick-battle sweep in `app.js`. Meta + UI only — no tick-path edit.

**Proof-number (frame/heap target):**
- For the G2 step: same-seed replay `getRunDigest` **byte-identical to pre-change** (proves the wiring never touched the sim) + a settle→spend round-trip that provably decrements the currency.
- For unlocking any endless/density work downstream: **midtier mobile frame p95 ≤16.7 ms (from 33.3) AND soak heap slope ≤0 MiB/min / `memoryStable=true` (from 0.1138)** — the gate that must pass before one added actor ships.
