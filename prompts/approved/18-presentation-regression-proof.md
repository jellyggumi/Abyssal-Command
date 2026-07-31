# 18 — Presentation regression proof

- **Version** v1 (2026-07-31)
- **Skills** `/skill:test-playable-web-games` for the browser half
- **Produces** the only artifact that can call presentation work correct.
- **Placeholders** `${changeId}`, `${stageId}`, `${fixtureSeed}`.

---

**CONTEXT:**
`CLAUDE.md` §6: full Node regression uses the quoted glob exactly —
`node --test 'tests/**/*.test.mjs'`. A shell-expanded glob is not equivalent. Numbers gate
everything; no adjective passes a gate.

The presentation gate is these ten suites:

```
tests/combat-presentation-contract.test.mjs        pool, anchoring, beats, intro dolly, cel shading
tests/world-presentation-contract.test.mjs         per-stage frozen profile, palette, follow camera
tests/stage-framing-and-motion-profile.test.mjs    zoom clamp, pitch floor, finale offset, motion profile, hit direction
tests/realtime-motion-routing.test.mjs             promoted model routing, retry-once, failure marker
tests/ingame-motion-pack.test.mjs                  manifest, accessors, 11 promoted GLBs, fallback
tests/runtime-visual-assets.test.mjs               retained manifest, per-stage prop/VFX/lookout counts
tests/aoe-burst-wide-hit-contract.test.mjs         authoritative radius, density, software tier, reduced motion
tests/audio-feedback-runtime.test.mjs              cue policy, priority, throttle, footsteps, soundscape
tests/audio-sample-hybrid.test.mjs                 procedural fallback, sample map, index integrity
tests/battle-session-cutscene-audio.test.mjs       cutscene ordering, pause/resume, stale dismissal
```

**Baseline recorded 2026-07-31 [OBSERVED]**, re-measured as the presentation slices landed:
arrival entries added six contracts and knockback weight added five (129 -> 135 -> 140) — the ten suites above run together in one command:

```
node --test tests/combat-presentation-contract.test.mjs tests/world-presentation-contract.test.mjs \
  tests/stage-framing-and-motion-profile.test.mjs tests/realtime-motion-routing.test.mjs \
  tests/ingame-motion-pack.test.mjs tests/runtime-visual-assets.test.mjs \
  tests/aoe-burst-wide-hit-contract.test.mjs tests/audio-feedback-runtime.test.mjs \
  tests/audio-sample-hybrid.test.mjs tests/battle-session-cutscene-audio.test.mjs

tests 140 · pass 140 · fail 0 · cancelled 0 · skipped 0 · todo 0 · duration_ms 15475
```

Expected, non-failing stderr in that baseline — do **not** "fix" these, and do not let them mask a
real new warning: `THREE.Material: parameter 'normalScale'/'emissive' has value of undefined`,
`THREE.GLTFLoader: Couldn't load texture blob:nodedata:…`, and the deliberate synthetic load
failures (`Simulated model load failure`, `Failed to parse URL from ./assets/…`) that the
fail-closed and retry-once tests inject on purpose.

Separately, `tests/stage-wave-doctrine.test.mjs` carries a pre-existing failure recorded in
`prompts/VERSIONS.md` for the map track. It is not caused by presentation work and must not be
claimed as fixed or as newly broken by this step.

If the change touched arrival choreography (prompt 11), the gate additionally includes
`tests/defense-run-simulation.test.mjs` and the stage-doctrine suites, because spawn placement is
digest-visible.

**ROLE:**
You are the QA owner. You do not accept a description of a result; you accept the command and its
output. You distinguish carried evidence from new evidence, and you never let a suite that was
already red be silently absorbed into a green claim.

**ACTION:**

1. Re-run the ten-suite presentation gate above and record `tests / pass / fail / duration_ms`
   verbatim. Compare against the baseline: 140 / 140 / 0 / ~15.5 s.
2. If the change touched simulation state — arrival formations, `ENEMY_SPAWNED` payload, anything
   that draws from the RNG — run `node --test 'tests/**/*.test.mjs'` with the quoted glob and report
   `getRunDigest()` on `${fixtureSeed}` for all three stages, before and after.
3. Account for every delta. A new pass count is fine if new tests were added and are named. A new
   failure is a stop. A test that disappeared is a stop.
4. Prove the change is actually covered. Name the assertion that would fail if the change were
   reverted. If no such assertion exists, the change is untested and the step is not done — write the
   test.
5. Hunt silent absence specifically. For a new cue, assert the record exists, is anchored at the
   expected world point, has the expected lifetime, and is retired. `spawnVfx()` hard-returns without
   a warning, so "no error" proves nothing.
6. Run the browser proof for anything a headless suite cannot see: actual rendering, input, both
   orientations, and the reduced-motion toggle at runtime. Record the artifact path for each.
7. Verify the three quality tiers explicitly: `full`, software renderer, and
   `prefers-reduced-motion`. Reduced motion must remain legible, not absent.
8. State clearly what was **not** verified and why. Human-only judgements — whether an effect reads
   as intended — are labelled as such and never presented as a passing gate.

**FORMAT:**
Markdown at `_workspace/current/qa/presentation-regression-${changeId}.md`: the exact command per
run, the verbatim counts, the delta against the recorded baseline, the digest table if simulation was
touched, the named covering assertion, browser artifact paths, the three-tier table, and an explicit
list of unverified items with reasons. Every claim `[OBSERVED]`, `[INFERENCE]` or `[TARGET]`.

**TARGET AUDIENCE:**
The release owner running prompt 19, and the next session, which must be able to pick this up from
the artifact tree without chat history.

**HARD CONSTRAINTS:**

- The full-regression glob is quoted: `node --test 'tests/**/*.test.mjs'`. A shell-expanded glob is
  not equivalent and does not count.
- Never suppress a test, a warning, or a console error to make a gate pass.
- Never claim a pre-existing failure as fixed, and never absorb it into a green summary.
- A change with no assertion that would fail on revert is untested. Write the test.
- "No error" is not proof a cue spawned. Assert the record.
- Human judgement is labelled human judgement, never a gate result.
- Report the exact command and its observed output, not a paraphrase.

**DONE WHEN:**
The ten-suite gate is re-run with its counts recorded and reconciled against 140/140/0, any
simulation-touching change reports before/after digests for all three stages, a covering assertion is
named, browser proof artifacts exist for anything headless cannot see, all three quality tiers are
verified, and unverified items are listed with reasons.
