# 06 — Regression and playable proof

- **Version** v1 (2026-07-31)
- **Skill** `/skill:test-playable-web-games` (with `/skill:build-mobile-threejs-games` for the touch
  matrix)
- **Produces** the evidence that the stage map is correct: deterministic suite results plus a real
  browser playthrough record. This is the only step that may call the work done.
- **Placeholders** `${stageId}`, `${fixtureSeed}`, `${deployTarget}` (local or preview URL).

---

**CONTEXT:**
`CLAUDE.md` §6 fixes the verification contract: the full Node regression is
`node --test 'tests/**/*.test.mjs'` with the glob quoted (a shell-expanded glob is not equivalent),
reports must cite the exact command and observed result, and "numbers gate everything — no adjective
passes a gate." A green build is not gameplay proof; the browser evidence is separate and required.

Stage-map-relevant suites:

| Suite | What it gates |
|---|---|
| `tests/stage-world-quest-points.test.mjs` | one quest giver, four ordered quest points, frozen data |
| `tests/stage-world-encounter-routing-contract.test.mjs` | distinct routed worlds, critical-route clearance per stage, per-stage objective routes, committed-attacker caps, retry idempotence, reward-once |
| `tests/world-presentation-contract.test.mjs` | one frozen presentation profile per stage, allowed projection categories, palette/fog per stage, camera and label behaviour |
| `tests/defense-stage-world-movement.test.mjs` | footprint clamping to bounds, obstacle slide, flat support reacquisition, leash recovery, no tunnelling, digest identity |
| `tests/stage-terrain-environment-contract.test.mjs` | promoted floors and retained sources are finite textured GLBs; proxy-mutation gate |
| `tests/stage-framing-and-motion-profile.test.mjs` | per-stage camera zoom/pitch clamps, finale look offset |
| `tests/stage-wave-doctrine.test.mjs` | wave plan, clear-budget, mid-boss wall, growth offers, carry-over, 3–6 minute play length |
| `tests/stage-runtime-proof-browser.test.mjs` | browser runtime proof of the stage scene |
| `tests/defense-run-simulation.test.mjs` | the deterministic simulation itself |

**[OBSERVED] baseline, 2026-07-31**, on the seven Node suites above (excluding the browser suite):
55 tests, 55 pass, 0 fail after the `stage-wave-doctrine` passive-rank-up assertion was corrected to
check the stat the passive authors (`basicDamage` / `pickupRange` / `maxIntegrity`) instead of
assuming every passive banks damage. Any new failure in these suites belongs to the change under
test.

**ROLE:**
You are a QA engineer who combines deterministic fixtures with short real playthroughs and refuses
to accept a green build as proof of play. You separate new regressions from pre-existing baseline
issues and you report the shortest useful reproduction.

**ACTION:**

1. Run the focused suites first and paste the exact command and the trailing counts:
   `node --test tests/stage-world-quest-points.test.mjs tests/stage-world-encounter-routing-contract.test.mjs tests/world-presentation-contract.test.mjs tests/defense-stage-world-movement.test.mjs tests/stage-terrain-environment-contract.test.mjs tests/stage-framing-and-motion-profile.test.mjs tests/stage-wave-doctrine.test.mjs`
2. Run the full regression exactly as `node --test 'tests/**/*.test.mjs'` and record the counts.
   Diff any failure against the baseline above before attributing it.
3. Prove determinism: run the same seed twice and assert an identical `getRunDigest()`; then prove a
   different seed differs. Cite both digests.
4. Build the browser matrix for `${stageId}`: launch, stage select, ingress, movement along the
   critical route, first encounter objective, retry after a deliberate failure, second objective,
   occupation hold, extraction window, boss kill, reward grant, save/continue, pause, defeat/retry.
5. Repeat the core rows on desktop keyboard/mouse, touch portrait, touch landscape, and
   `prefers-reduced-motion`. Use the repository-approved browser surface and existing harnesses
   (`tests/stage-runtime-proof-browser.test.mjs`, `tests/*-browser.cjs`,
   `scripts/verify-*` runners) rather than inventing a new one.
6. Confirm on screen, not in logs: control response, target state change, damage/resource change, UI
   update, and navigation after every meaningful action. Capture console errors and warnings.
7. Sample performance on the live scene at the busiest wave: frame time, draw calls, triangles, and
   memory stability across a pause/resume cycle.
8. Report each finding with reproduction steps, expected vs actual, severity, device/viewport, and
   the shortest artifact that proves it. Mark whether it is new or pre-existing.
9. Close idle browser pages, dev servers, and benchmarks you opened; leave resources owned by other
   active tasks alone.

**FORMAT:**
Markdown at `_workspace/current/qa/stage-map-${stageId}-proof.md`: a command/result table for every
suite run, the digest pair, the browser matrix as a table with a pass/fail and artifact path per
row, the performance sample, and a findings list. Every row carries `[OBSERVED]` plus the artifact
path. No adjectives in the verdict.

**TARGET AUDIENCE:**
The release session running prompt 07 and any future session picking up this work from the artifact
tree alone, without chat history.

**HARD CONSTRAINTS:**

- Never suppress, skip, or weaken a test to make a gate pass. If an assertion is wrong, fix the
  assertion with a stated reason and prove the underlying behaviour separately.
- Never report a test as run that was not run, and never quote a count you did not observe.
- The full-regression glob must be quoted exactly.
- A browser proof is mandatory; a Node-only pass is not a playable proof.
- Pre-existing failures must be named as pre-existing with evidence, not silently inherited or
  silently fixed inside an unrelated change.

**DONE WHEN:**
Focused suites and the full regression are green (or every failure is attributed with evidence), the
digest pair proves determinism, every browser matrix row has a verdict and an artifact, and the
performance sample is recorded.
