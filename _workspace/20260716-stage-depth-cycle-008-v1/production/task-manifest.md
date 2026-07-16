---
run_id: 20260716-stage-depth-cycle-008-v1
owner: game-production-director
created_at: 2026-07-16T18:30:00Z
artifact_version: v1
immutable: true
append_only: true
status: ready
decision_ids: [C008-D-001]
worktree: /Users/jangyoung/orca/Abyssal-Surge-c008 (branch cycle-008, base 61a121c)
---
# Task manifest v1 — Cycle 008 (stage depth + balance integration)

C008-D-001. Executed in a DEDICATED WORKTREE per the cycle-007 co-op verdict.
`game-core.js` remains frozen for THIS lane — the peer's semantic balance
commits (737acd6, 61a121c: stage1-rules-v2, S5 SURGE/SURGE/STRIKE, foe 5 hp,
escalating DISRUPT [1,2], HOLD award 0) are consumed as-is from origin/main.

## DET8-GATE — Peer balance integration verification (P0)

1. All unit gates green in the worktree: game-core.test.mjs (14 incl.
   anti-dominance + deliberate-victory-line), playtest-5-stages (S5 VICTORY via
   STRIKE,DISRUPT,STRIKE; settlement 2 fragments), stage1-vertical-slice.
2. Fix applied: vertical-slice expectedRecords now derives rules_version from
   the live game-core export instead of hardcoding v1 (peer missed this pin
   when bumping to v2; broken on main, fixed here).

## DET8-E2E — Anti-dominance + trade-win browser evidence (QA veto)

1. The reactive two-button driver MUST now end Stage 5 in HOLD (not VICTORY):
   assert outcome HOLD on stage 5 and settlement WITHOUT the old "10 fragments"
   expectation (stages 1-4 VICTORY x2 + S5 HOLD 0 = 8 fragments). This is the
   anti-dominance regression assertion — the driver must NOT be tuned to win.
2. A separate deliberate-trade scenario MUST win Stage 5 in the real-time
   browser (STRIKE → DISRUPT-on-SURGE → STRIKE with correct timing), proving
   the victory line exists outside the simulator.
3. Existing cycle-006/007 asserts (telegraph, dispel, cinematic, SW v3) stay.

## DET8-DEPTH — Per-stage foe behavior identity (presentation layer)

1. Stage 2 "feint": telegraph wave pauses ~0.4s mid-lane once per charge cycle
   (visual stutter, arrival time unchanged — speed compensates after pause).
2. Stage 4 "burst pair": the 2-spawn wave staggers into two distinct sub-waves
   (0ms / 450ms) with slightly different lane heights.
3. Stage 5 "boss escalation": foe avatar gains an intensifying crimson aura
   class at foe_health <= 3 and <= 1 (tiers via CSS classes boss-aura-1/2);
   telegraph waves gain +1 unit at foe_health <= 1 (visual pressure only).
4. All read-only over encounter state; no reducer/pipeline changes; null-guarded.

## DET8-QA — Gate

1. Unit suites + browser E2E exit 0 unfiltered + capture-live exit 0 in the
   worktree; desktop/mobile PNGs inspected.
2. Merge to main (ff or merge commit), push, Pages success, live spot-checks
   (BUILD_TAG c008, rules_version v2 visible), retro JSON validated.

## DET8-DOC

1. Coordination brief Cycle 008 section; llm-wiki report + index line.

## Ownership

- game-engineering-lead (subagent Depth008): DET8-DEPTH in app.js/styles.css
- main thread: DET8-GATE, DET8-E2E (tests/), DET8-QA, DET8-DOC, merge/ship
