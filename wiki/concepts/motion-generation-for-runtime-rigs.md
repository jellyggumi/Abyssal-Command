# Motion generation for runtime rigs — method, prompt shape, and what we actually use

Source capture: [[raw/sources/2026-07-30-motion-generation-and-encounter-pattern-research]]
Applies to: `assets/motion/**`, `scripts/retarget-ingame-motion-blender.py`,
`battle-realtime-three.js` overlay layer, `RUNTIME_ANIMATION_CONTRACT.md`.

---

## 1. The three ways to get motion, and the one this project can ship

| Path | What it produces | Cost to ship here | Verdict |
|---|---|---|---|
| **A. Text-to-motion generative models** (MDM S1, T2M-GPT S2) | novel clips from a text prompt | offline Python + GPU, corpus-scale skeleton (HumanML3D, 22-joint), then a retarget onto `def-humanoid-v1` | **Not in the runtime.** Usable only as an offline *source*, never as a browser dependency |
| **B. Retargeting an authored corpus** (`assets/motion/bench/*.fbx`, Mixamo `mixamorig:*`) | exact, licensed, hand-authored clips | one headless Blender run, already scripted | **This is our pipeline** |
| **C. Procedural motion at runtime** (three.js mixer, S3) | differentiation of existing clips | per-actor `timeScale`, cross-fade envelopes, additive quaternion offsets | **Used on top of B** |

The decisive constraint is the engine boundary (CLAUDE.md §2): this is a Three.js/WebGL browser
game. A diffusion or VQ-VAE sampler is a build-time tool at best; nothing in `vendor/` can run one,
and adding one would be an engine mistake, not a feature.

## 2. Why B beats A here even ignoring runtime cost

S2 records its own limitation verbatim — "the dataset size is a limitation of our approach" — and
S1 notes human "perceptual sensitivity" to motion. Both mean a generated clip lands somewhere on a
distribution, while the game needs a *specific* readable beat: a 12-frame tell, a contact on a known
frame, a recovery long enough to punish. Our bench corpus already contains those beats as authored
performances, and the cost of using them is a mapping table, not a training run.

The honest role for A is **coverage of gaps** — a beat the bench does not contain at all — and the
prompt shapes in §4 are written for exactly that use.

## 3. The retarget method we run (path B, in this repository)

1. **Observe the corpus.** `blender --background --python scripts/audit-fbx-motion-bench.py --
   --bench-dir assets/motion/bench --output <report>.json --expect-count <n>` imports every FBX in
   real Blender and records fps, frame range, bone list and hips displacement. Frame ranges in the
   shipped pack come from this observation, never from an assumption.
2. **Map the skeleton.** `MAPPING_ROWS` in `scripts/retarget-ingame-motion-blender.py` maps 22
   `mixamorig:*` bones onto `DEF-*` bones of `def-humanoid-v1`. Pelvis helpers are deliberately
   unmapped and keep their target rest pose.
3. **Encode rest-relative deltas.** The pack stores
   `delta[X][t] = inverse(target_rest[X]) * absolute_retargeted[X][t]`, so a single pack adapts to
   every compatible rig at load time via `adapted[X][t] = C_rest[X] * delta[X][t]`
   (`RUNTIME_ANIMATION_CONTRACT.md` §5). One retarget, 24 rigs.
4. **Keep locomotion in place.** Hips travel is stripped; the simulation owns world position, so a
   clip that walks itself forward would fight the authoritative snapshot.
5. **Differentiate at runtime, not on disk.** Mesh-size motion profile (`motionProfileFor`) derives
   playback rate from the actor's fitted height, so a 4.5-unit boss reads heavy and a 1.45-unit
   companion reads light *from the same clip*.

## 4. Prompt shapes (concretised)

These are the prompts to use when a beat has to be *generated* (path A) or authored fresh, and they
exist because "make an attack animation" produces unusable output. Each field below exists because
the runtime consumes it.

### 4.1 Combat beat prompt template

```
Beat: <action key: attack_melee | attack_ranged | critical | hit_left | bighit_back | avoid | defence | die | show>
Body: <archetype> — <height in metres>, <mass read: light/heavy>, <silhouette note>
Framing: isometric, camera ~26 world units out, actor occupies ~7% of frame height
Timing (60 Hz, authored): startup <N> ticks · active <N> ticks · recovery <N> ticks
Contact: frame <N> is the ONLY authoritative contact frame; motion before it must telegraph, motion after it must be recoverable
Root: in place — zero hips translation, feet planted on Y=0 at frame 0 and at the last frame
Rig: def-humanoid-v1 (DEF-spine/.001-.005, DEF-shoulder|upper_arm|forearm|hand .L/.R, DEF-thigh|shin|foot|toe .L/.R), rotation only, no scale keys
Loop: <loop | one-shot, clamped on last frame>
Readability: the pose at the contact frame must be identifiable in silhouette alone
Exclusions: no props, no weapon-specific hand shapes, no camera motion, no root translation, no IK targets
```

### 4.2 Locomotion prompt template

```
Beat: <idle | move | run>
Cycle: seamless loop, first frame == last frame pose, <N> frames at 24 fps
Root: in place; forward speed is applied by the simulation, not by the clip
Weight: <light/heavy> — stride length and vertical bob scaled to a <height>m body
Arms: neutral unarmed carriage; no weapon grip
Rig / exclusions: as §4.1
```

### 4.3 Directional reaction set prompt

```
Set: hit_front, hit_back, hit_left, hit_right (light) and bighit_* (heavy)
Rule: the direction names where the blow CAME FROM, expressed in the target's own frame
Light: 12-20 frames, torso-led flinch, feet stay planted
Heavy: 28-40 frames, one recovery step allowed, no full ragdoll
Consistency: all eight clips must return to the same neutral pose so the mixer can blend back to idle
Rig / exclusions: as §4.1
```

### 4.4 Provenance requirement

Any generated output is concept-lane material: it needs an adjacent `.provenance.json` recording
prompt, tool, reference inputs and `runtimeEligible: false`, and it is promoted only after an
explicit audit (CLAUDE.md §3). Nothing generated goes straight into `assets/motion/ingame/`.

## 5. What was applied in this cycle

- The overlay clip roster grew from the original 9 actions to 20, adding the four directional
  `hit_*`, the four directional `bighit_*`, `attack_melee`, `attack_ranged`, `die` and `show`
  (`scripts/retarget-ingame-motion-blender.py` `CLIPS`).
- Those keys were *already routed* by the runtime (`hitReactionKey`, `triggerAttackDelivery`) with a
  deterministic fallback to the flat key, so shipping the clips turns direction-aware reactions on
  for every compatible rig instead of leaving the routing dormant.
- The audit script gained `--expect-count`, so the corpus guard stays mandatory while the observed
  corpus widens from 42 to the full bench.

## 6. Open items

- Path A has not been executed. If a beat is missing from the bench, §4 is the prompt to use, and
  the output must go through the provenance/audit gate before it can be referenced at runtime.
- The pack is rotation-only. Any beat that genuinely needs root translation (a lunge that covers
  ground) has to be expressed as simulation movement plus an in-place clip, not as baked hips travel.

## 7. Related

- [[wiki/reports/2026-07-29-natural-rest-pose-motion-library]] — the 11-asset natural bind-pose
  cutover this pipeline produced, with its evidence and focused regression gates.
