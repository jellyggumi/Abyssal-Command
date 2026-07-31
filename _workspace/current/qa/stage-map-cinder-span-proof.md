# Stage map proof — cinder-span phase 1 (prompt 06)

Prompt: `prompts/approved/06-regression-and-proof.md` v1. Branch `feat/cinder-span-dungeon-layout`
rebased onto `origin/main` @ `012ea15d`. All results `[OBSERVED 2026-07-31]` from an isolated
worktree, with a pristine detached `origin/main` worktree used for every baseline claim.

## 1. Focused suites

`node --test tests/stage-world-quest-points.test.mjs tests/stage-world-encounter-routing-contract.test.mjs tests/world-presentation-contract.test.mjs tests/defense-stage-world-movement.test.mjs tests/stage-terrain-environment-contract.test.mjs tests/stage-framing-and-motion-profile.test.mjs tests/stage-wave-doctrine.test.mjs tests/runtime-visual-assets.test.mjs tests/combat-presentation-contract.test.mjs`

→ **101 tests, 101 pass, 0 fail.**

`node --test --test-name-pattern "gate check" tests/defense-run-simulation.test.mjs` → 11/11 pass.

## 2. Full regression

`node --test 'tests/**/*.test.mjs'` (glob quoted per `CLAUDE.md` §6)

→ **607 tests, 577 pass, 5 fail, 25 skipped, 1805 s.**

**Every one of the five failures is pre-existing on `origin/main` and none is touched by this
branch.** Each was re-run in the pristine baseline worktree and reproduced there:

| Test | Baseline verdict |
|---|---|
| `Stage1b pressure exporter retains composite-net ledger evidence` | red on `012ea15d` |
| `Stage1b G2 canonical pressure exporter exercises real CLI and fails closed` | red on `012ea15d` |
| `G3 accepted stance attribution precedes INPUT_ACCEPTED and preserves boss-grace NOT_EXPOSED` | red on `012ea15d` |
| `G7 shipped controller casts active skills only and reaches accepted extraction` | red on `012ea15d` |
| `Stage 1b persistence exporter exercises the real CLI and fails closed on missing or tampered inputs` | red on `012ea15d` (and on `c139b508` before it) |

This branch introduces **zero** new failures. The stage1b/G3/G7 exporter pins belong to whoever
moved them; repinning them here would bundle unexplained drift into a stage-layout change.

## 3. Determinism and digest gates

The two new obstacles change what a cinder-span tick does, so cinder-span digests moved. Scope was
measured, not assumed:

| Fixture | Before | After |
|---|---|---|
| `cinder-span/71/500 +ember-cohort` | `50860301…` | `396a06a4…` (repinned) |
| `cinder-span/71/500 bare` | `c250e10f…` | `980f019e…` (repinned) |
| `abyss-chancel/71/1000 bare` | `ade3e989…` | `ade3e989…` **unchanged** |
| `echo-throne/12/500 bare` | `cf3f32b1…` | `cf3f32b1…` **unchanged** |
| rng@3000 `cinder-span/9` | `745195808` | **unchanged** |
| rng@3000 `cinder-span/3` | `3246667586` | **unchanged** |
| rng@3000 `abyss-chancel/5` | `3688787054` | **unchanged** |

Preconditions re-measured for both repinned windows: zero `DROP_SPAWNED`, zero `BUFF_APPLIED`,
window ran to completion, `dropRng` advanced, `buffs`/`buffStats` absent at `SNAPSHOT_VERSION` 7,
`waveVariant` identical to creation. Same-seed digest identity on the flat plane is re-proven by
`tests/defense-stage-world-movement.test.mjs`.

## 4. Pacing measurement

`node scripts/measure-stage-pacing.mjs cinder-span 101 71 73 5` — the objective-seeking bot the
doctrine suite uses, run on both builds:

| build | seed 101 | seed 71 | seed 73 | seed 5 | peak committed (cap 3) | objective attempts |
|---|---|---|---|---|---|---|
| `origin/main` @ `012ea15d` | 192 s | 191 s | 320 s | 190 s | 3 | 1 / 1 |
| this branch | 192 s | 191 s | 320 s | 190 s | 3 | 1 / 1 |

Identical, inside the 180–360 s doctrine window. The doorway changes *where* the fight happens, not
how long the bot needs; that is why no balance number was retuned in this branch.

## 5. Browser proof

`tests/stage-runtime-proof-browser.test.mjs` (Playwright Chromium, fresh `BrowserContext` per stage,
service workers blocked, cache disabled), regenerated at `2026-07-31T04:23:28Z` as part of the full
run above.

| Stage | Verdict | Terrain | Props loaded | Console errors | Screenshot |
|---|---|---|---|---|---|
| cinder-span | pass | `promoted-glb` | 12 / 12 | 0 | `_workspace/current/qa/stage-runtime-proof/01-cinder-span.png` |
| abyss-chancel | pass | `promoted-glb` | 12 / 12 | 0 | `02-abyss-chancel.png` |
| echo-throne | pass | `promoted-glb` | 12 / 12 | 0 | `03-echo-throne.png` |

The cinder-span prop records include `cinder-span:ash-gatehouse-north-prop` and
`cinder-span:ash-gatehouse-south-prop`, each resolving to its own pack node. Visual check of
`01-cinder-span.png`: both pillars render on the ash plane at their new footprints, the HUD,
joystick, objective flow and quest banner are intact, and the engagement plays at the authored
camera distance. Summary artifact:
`_workspace/current/qa/stage-runtime-proof/stage-runtime-summary.json`.

## 6. Not covered

- Touch portrait/landscape and reduced-motion passes targeting the new doorway specifically. The
  existing mobile suites in the full regression stayed green.
- No production deploy: `prompts/approved/07-release.md` is deliberately not executed here.
