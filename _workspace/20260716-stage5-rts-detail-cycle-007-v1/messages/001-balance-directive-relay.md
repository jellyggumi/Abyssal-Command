---
run_id: 20260716-stage5-rts-detail-cycle-007-v1
owner: game-production-director
created_at: 2026-07-16T17:55:00Z
immutable: true
append_only: true
message_type: user-directive-relay
to: rts-hero-rework-20260716-a (game-systems/economy designer lane)
channel: shared-memory key balance-directive-20260716 (+ this git record)
---
# User directive relay — 밸런스 강화 (balance strengthening)

## Directive (project owner, 2026-07-16, verbatim)

"밸런스강화하라고 전달해" — strengthen game balance. Relayed to the session that
owns the balance surface (P2 systems/economy: rule-contract, balance-model,
economy-ledger, simulator-evidence).

## Live balance evidence from the shipped runtime (cycle-007 E2E logs)

1. **DISRUPT-lock dominance (HIGH):** Stage 5 (SURGE-heavy schedule) is cleared
   by pure DISRUPT repetition — the scripted driver disrupted every SURGE
   (~14 consecutive cycles), foe health 15→0, VICTORY with zero strategy
   variation. Counterplay cost (1 focus) is fully covered by real-time focus
   regen at max_focus 5, so the counter never runs dry. No tension at the
   finale.
2. **Reactive two-button clear (HIGH):** the adaptive driver (STRIKE when
   intent=STRIKE, DISRUPT when SURGE) clears ALL five stages first-try, every
   run, across dozens of E2E executions. No stage has ever produced a loss
   under this trivial policy.
3. **Passive floor always HOLD (MEDIUM):** BRACE-only play reaches HOLD on
   every stage in the deterministic 3-round sim — settlement still awards
   fragments (5 total). Passivity is never punished.
4. **Focus economy slack (MEDIUM):** real-time regen (+0.5/s, up to +1.5/s in
   recover channel) outpaces command costs from stage 3 onward; focus is
   effectively unconstrained in the late campaign.

## Request to the balance owner

Fold the above into P2 balance-model + simulator evidence under the harness
hard gates: dominant-strategy detection (DISRUPT-lock must have a cost, cap,
or foe adaptation), counterplay cost curves per stage, p50/p90 progression,
and loss-condition reachability (a policy this simple should not be a
guaranteed clear of stage 5). Economy: HOLD-floor reward review.

## Boundary

- Semantic rule changes (game-core.js reducer, schedules, costs, awards) flow
  through YOUR P2→P3 pipeline — my lane keeps game-core.js frozen.
- Real-time presentation tuning (foeCooldown/unitSpeed presets, telegraph
  pacing) is my lane; send numbers and I will implement + E2E-verify them.
- Exchange via commits/shared-memory only (worktree co-op verdict v3 stands).
