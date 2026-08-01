#!/usr/bin/env bash
# Commit the arrival-choreography + presentation-prompt-track slice.
#
# Blocked at authoring time: /tmp/abyssal-surge-git-write.lock was held by `gjc-stage3-throne`,
# so CLAUDE.md §5 ("stop if it already exists") applied. This script exists so the commit is one
# command once that session releases the lock, with the pathspec list already verified rather than
# reconstructed from memory.
#
# EXPLICIT PATHSPECS ONLY. `index.md`, `log.md`, `prompts/README.md`, `prompts/VERSIONS.md` and
# `prompts/RUNBOOK.md` are deliberately EXCLUDED: they carry this session's lines AND
# gjc-stage3-throne's, and staging them would absorb another session's work.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
LOCK=/tmp/abyssal-surge-git-write.lock

if ! mkdir "$LOCK" 2>/dev/null; then
  echo "lock held by another session — stopping per CLAUDE.md §5:" >&2
  cat "$LOCK/owner" >&2 || true
  exit 1
fi
trap 'rmdir "$LOCK/." 2>/dev/null || rm -rf "$LOCK"' EXIT
printf 'owner: gjc-presentation-arrival %s\n' "$(date -u +%FT%TZ)" > "$LOCK/owner"

echo "=== git status BEFORE"
git status --short

PATHS=(
  # simulation: arrival choreography
  defense-run-simulation.js
  tests/arrival-choreography-contract.test.mjs
  scripts/qa-arrival-digest-baseline.mjs
  # fixed at source, exposed by this change
  scripts/run-stage1b-pressure-packets.mjs
  tests/stage-world-encounter-routing-contract.test.mjs
  # presentation prompt track (10-19 only; 00-07 and 20-29 belong to other sessions)
  prompts/approved/10-presentation-cue-spec.md
  prompts/approved/11-arrival-choreography.md
  prompts/approved/12-impact-and-knockback-feel.md
  prompts/approved/13-motion-source-and-retarget.md
  prompts/approved/14-runtime-vfx-implementation.md
  prompts/approved/15-camera-and-cinematic.md
  prompts/approved/16-audio-cue-layer.md
  prompts/approved/17-frame-budget-recovery.md
  prompts/approved/18-presentation-regression-proof.md
  prompts/approved/19-presentation-capture-and-release.md
  # wiki
  raw/sources/2026-07-31-game-vfx-animation-cinematic-skill-catalog.md
  wiki/sources/2026-07-31-game-vfx-animation-cinematic-skill-catalog.md
  wiki/concepts/runtime-presentation-and-arrival-choreography.md
  wiki/concepts/motion-generation-for-runtime-rigs.md
  # evidence
  _workspace/current/engineering/arrival-choreography-cycle11.md
  _workspace/current/qa/arrival-digest-before.json
  _workspace/current/qa/arrival-digest-after.json
  _workspace/current/ops/commit-arrival-choreography.sh
)

git add -- "${PATHS[@]}"

echo
echo "=== STAGED (must contain nothing from another session)"
git diff --cached --name-status

git commit -F - <<'MSG'
feat(sim): arrival choreography — parallel, encircling, emerging and sky-drop entries

Enemy waves entered from an arena edge with same-wave bodies spaced 200 units along one
lane, so an engagement read as a single-file column walking in. Adds four formations
(abreast / encircle / emerge / skydrop) alongside the unchanged `lane`.

Determinism. Formations draw on `arrivalRng`, a derived stream seeded `seed ^ 0x27d4eb2f`,
the same device `combatRng` / `dropRng` / `surpriseRng` / `gimmickRng` already use. `run.rng`
is positional (defense-run-simulation.js:1518) and one extra draw there would shift wave
composition, timing jitter, lane offset, spawn direction, policy selection and every growth
offer. Measured over 3 stages x seeds 1/7/42: 9/9 digests moved, 0/9 wave variants moved.
The four PRE_FEATURE_DIGEST fixtures stay byte-identical, so no re-baseline was required.

Fairness. `encircle` / `emerge` / `skydrop` place a body inside the commander's space, so each
writes its telegraph into BOTH `attackCooldown` and `rangedCooldown` — the advertised window is
the enforced one, and a ranged body cannot open fire from inside the ring. Placement floor is
1800, exactly twice the largest contact range in the catalog (guardian 540 + commander 360).
`arrivalPoint` re-projects to the opposite side when the arena clamp would collapse the ring
onto a wall; that path was measured placing a body at 808 before the guard.

Policy rule. Only `player-pursuit`, `low-hp-focus` and `resource-denial` may arrive near the
player — the three `pressureTarget()` resolves to the player side. A `gate-pressure` body
dropped beside the commander skips the approach the defense loop is built on, and lands at its
objective for free whenever the commander is near the gate.

Budget. At most 4 near arrivals per wave, equal to the renderer's
`NEW_VFX_FAMILY_LIVE_BUDGET.spawn`, so the transient pool can never silently drop an arrival cue.

Dead hook revived. `ENEMY_SPAWNED` now emits `grade`, `telegraphTicks` and `arrivalDistance`.
The renderer has always branched on the first two (`isCriticalVfxEvent`,
`resolveVfxLifetimeTicks`) but nothing emitted them, so the SHADOW pool exemption and the
60-tick arrival telegraph were unreachable and every arrival fell back to 30 ticks, evictable.

Fixed at source, both exposed rather than caused by this change:
- run-stage1b-pressure-packets.mjs attributed passive integrity at rank-1 value;
  applySkillRankEffects grants SKILL_RANK_PASSIVE_SHARE on a rank-up. Reads `event.rank` now.
- stage-world-encounter-routing-contract asserted committed attackers against the flat
  `route.commitmentCap` while refreshAttackerCommitment slices by the raised
  `bigWaveCommitmentCap`. The sibling concurrency assertion already carried this fix
  (decision-log D-20260730-04); the commitment line had been missed.

Also adds prompts/approved/10-19, the presentation prompt track, and its wiki pages.

Verification:
  tests/arrival-choreography-contract.test.mjs                    12/12
  arrival+expansion+routing+quest+variation+wave+stage1b-pressure 64/64
  ten-suite presentation gate                                     129/129

Not included, and not caused by this change (both reproduce at pure HEAD with the current
catalog): defense-run-simulation gate check 1 `echo-throne/12/500`, and stage1b-persistence
test 11. Both belong to the concurrent stage-doctrine session.
MSG

echo
echo "=== git status AFTER"
git status --short
echo
echo "committed. NOT pushed: inspect @{upstream}..HEAD and confirm every commit is known first."
