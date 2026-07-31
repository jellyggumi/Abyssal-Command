# 13 — Motion source and retarget

- **Version** v1 (2026-07-31)
- **Skills** `/skill:video-motion-previs` or `/skill:motion-previs-studio` (source), then
  `/skill:threejs-animation` (routing). Cascadeur / Rokoko Vision / Mixamo / DeepMotion are
  interchangeable offline sources.
- **Produces** a new or replaced clip in the in-game motion pack, audited, with its runtime routing
  proven.
- **Placeholders** `${actionKey}`, `${sourceClip}`, `${assetId}`, `${expectCount}`.

---

**CONTEXT:**
The pack is authoritative and narrow. `tests/ingame-motion-pack.test.mjs` pins:

```
11 promoted, self-contained character GLBs
  broken-court-monarch-boss, broken-court-monarch-v04, ember-cohort, guard,
  human-command-boss, lantern-reaver, possessed, scout, shade,
  shadow-commander-boss, shadow-soldier-v04
11 canonical base actions
  idle, move, run, hit, bighit, attack, critical, avoid, defence, die, show
21 overlay clip sources (scripts/retarget-ingame-motion-blender.py CLIPS), which add
  hit_front/back/left/right, bighit_front/back/left/right, attack_melee, attack_ranged
Runtime action set = union of the canonical eleven and the overlay keys
Manifest  assets/motion/ingame/manifest.json   Pack  assets/motion/ingame/unarmed-core.glb
Audit     _workspace/current/engineering/asset-pipeline/motion-bench/fbx-audit-report-FULL-OBSERVED.json
```

The pack is **rotation-only**: clips are finite local quaternion deltas with normalized,
sign-continuous rotation accessors and no baked hips travel. A beat that genuinely covers ground is
expressed as simulation movement plus an in-place clip. Root motion is not available and will not be
added; `updateActorFollow()` owns position.

Playback speed is not authored per clip. `motionProfileFor(targetHeight)` derives it from silhouette
against `MOTION_PROFILE_REFERENCE_HEIGHT = 1.7`: `locomotionRate` bounded 0.7–1.2 with exponent
-0.5, `oneShotRate` bounded 0.72–1.15 with exponent -0.35, `reactionArcScale` bounded 0.6–1.25.
Applied as `timeScale`, so no clip is re-authored and determinism is untouched.

Hit reactions route by `HIT_REACTION_DIRECTIONS = front · right · back · left`, named for where the
blow **came from**, in the target's own frame, with a deterministic fallback to the flat key.

`CLAUDE.md` §3: any generated output is concept-lane material requiring an adjacent
`.provenance.json` recording prompt, tool, reference inputs and `runtimeEligible: false`, promoted
only after an explicit audit. Nothing generated goes straight into `assets/motion/ingame/`.

**ROLE:**
You are a technical animator who treats the rig contract as non-negotiable and the clip as the
cheapest part. You verify a beat exists in the bench before generating one, and you never let a
generated file skip the provenance gate because it happened to look right.

**ROLE ORDER — check before generating:**
Search the existing bench for `${actionKey}` first. Generation is the fallback, not the default.

**ACTION:**

1. Locate the beat. Run the audit over the bench and confirm whether a source clip already covers
   `${actionKey}`:
   `python3 scripts/audit-fbx-motion-bench.py --bench-dir <dir> --output <report.json> --expect-count ${expectCount}`.
   The `--expect-count` guard is mandatory: a silently shrinking corpus is the failure mode.
2. If the beat is absent, acquire it offline — previs pose solve, Cascadeur, Rokoko, Mixamo or
   DeepMotion — and write the adjacent `.provenance.json` with `runtimeEligible: false` before the
   file is referenced anywhere.
3. Author to the pack's rules, not to the tool's defaults:
   - seamless loop for locomotion beats, first frame pose equal to last frame pose
   - root in place; forward speed is applied by the simulation
   - light reactions 12–20 frames, torso-led, feet planted; heavy 28–40 frames, one recovery step,
     no full ragdoll
   - every reaction returns to the same neutral pose so the mixer can blend back to idle
   - neutral unarmed carriage, no weapon grip
4. Retarget with `scripts/rig-and-animate-asset-blender.py` then
   `scripts/retarget-ingame-motion-blender.py`, adding `${actionKey}` to `CLIPS`. Confirm the export
   is finite, local, quaternion-delta, and sign-continuous — the suite reads the accessors directly,
   so a discontinuity fails structurally rather than visually.
5. Do **not** author speed into the clip. If the beat reads wrong on a large body, the lever is
   `motionProfileFor()` bounds, and changing a bound changes every body of that size — state the
   affected `TARGET_HEIGHT` tiers before touching it.
6. Prove runtime routing: the action must resolve through the promoted model's own namespaced
   library, and a failed promoted override must fall back to the actor's standard promoted base
   clips rather than to a T-pose.
7. Measure motion quality with `node scripts/qa-motion-probe.mjs` — real `AnimationMixer` at fixed
   60 Hz, world-space bone-tip travel, per-frame velocity discontinuity, and idle amplitude at
   rendered scale. Report the numbers; a clip that stutters at 60 Hz fails here, not in review.
8. Verify the failure modes: repeated trigger of the same beat (it must restart, never pin at frame
   zero), a queued beat arriving during recovery (presentation weight decides, not arrival order),
   entry and recovery fade weights, death staying terminal, and a beat interrupted by `dispose()`.

**FORMAT:**
Markdown at `_workspace/current/engineering/motion-${actionKey}.md`: the audit result with
`--expect-count`, the provenance record path, the authoring parameters as numbers, the accessor
verification, the `qa-motion-probe` measurements, the routing proof per affected asset id, and the
failure-mode checklist. Every number `[OBSERVED]` with its command.

**TARGET AUDIENCE:**
The runtime engineer wiring the beat and the QA session running prompt 18, which re-runs the pack
contract across all 11 promoted assets.

**HARD CONSTRAINTS:**

- Rotation-only, in place. No root translation, ever. Ground-covering beats are simulation movement
  plus an in-place clip.
- `--expect-count` is mandatory on every audit run.
- Generated output is concept-lane until an explicit audit promotes it; `.provenance.json` with
  `runtimeEligible: false` is written before the file is referenced.
- Playback speed comes from `motionProfileFor()` as `timeScale`. Never bake speed into a clip.
- Hit-reaction direction names where the blow came from, in the target's frame, and must keep the
  deterministic fallback to the flat key.
- All 11 promoted GLBs stay self-contained; a new key must exist on every rig that routes it, or the
  fallback must be proven.
- A repeated beat restarts. Pinning at frame zero is a defect, not a timing quirk.

**DONE WHEN:**
The audit passes with `--expect-count`, accessors verify as finite/local/quaternion-delta/
sign-continuous, `qa-motion-probe` reports no velocity discontinuity above the recorded baseline,
routing is proven for every affected promoted asset, the failure-mode checklist is fully green, and
`node --test tests/ingame-motion-pack.test.mjs tests/realtime-motion-routing.test.mjs` passes.
