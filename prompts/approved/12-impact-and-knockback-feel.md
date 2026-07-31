# 12 — Impact and knockback feel

- **Version** v1 (2026-07-31)
- **Skills** `/skill:create-game-vfx`, `/skill:design-action-combat` (timing only)
- **Produces** the contact-feel change — knockback, hit flash, camera impulse, area burst — with the
  proof that no authoritative state moved.
- **Placeholders** `${contactEvent}`, `${semanticVfxId}`, `${fixtureSeed}`.

---

**CONTEXT:**
The entire contact-feel model is renderer-local, `battle-realtime-three.js:1054-1075`:

```
IMPACT_KNOCKBACK_MS 160          IMPACT_KNOCKBACK_HEAVY_MS 260
IMPACT_KNOCKBACK_DISTANCE 0.12   IMPACT_KNOCKBACK_HEAVY_DISTANCE 0.26   (world units)
IMPACT_FLASH_PEAK 0.55           IMPACT_FLASH_HEAVY_PEAK
IMPACT_SHAKE_MS 220              IMPACT_SHAKE_FREQUENCY 38
IMPACT_SHAKE_AMPLITUDE 0.07      IMPACT_SHAKE_BOSS_AMPLITUDE 0.13      IMPACT_SHAKE_MAX_AMPLITUDE 0.13
AOE_BURST_BUDGET.full     ringSegments 48, arcSegments 12, maxArcs 6, core true
AOE_BURST_BUDGET.software ringSegments 20, arcSegments 6,  maxArcs 0, core false
AoE camera impulse admitted only when density > 0.25 and not reduced motion
```

Knockback is a **render-space offset along the attacker→target axis**. `updateActorFollow()` pulls
the root back to the authoritative position every frame, which is why 0.26 is the heavy ceiling: it
stays well under one actor width so the offset can never be mistaken for a position.
`grep -n knockback defense-run-simulation.js` returns nothing — there is no authoritative knockback
anywhere in this game. Adding one is a simulation change with a `getRunDigest()` consequence and
belongs in a separate, explicitly approved slice, not in a feel pass.

`IMPACT_FEEDBACK_SOURCES` maps contact events only. Windup and fire events are deliberately absent
because they are not authoritative hits.

**ROLE:**
You are a combat-feel engineer who makes contact legible without lying about it. You know the
difference between a body that was pushed and a body that was drawn pushed, and you never let the
second one leak into the first. You bound every impulse so it cannot disturb authored framing.

**ACTION:**

1. Confirm `${contactEvent}` is in `IMPACT_FEEDBACK_SOURCES` and is an authoritative contact. If it
   is a windup or a fire event, stop — the correct cue is a telegraph, prompt 10.
2. State the feel budget you are changing, one row per constant, with the current value, the proposed
   value, and the reason expressed as a readability or timing number. "Feels weak" is not a reason.
3. Keep knockback strictly under one actor width. `TARGET_HEIGHT` is
   `commander 1.55 · boss 4.5 · elite 2.2 · enemy 1.7 · companion 1.45 · stageNpc 1.8`; the smallest
   body that can be knocked back sets the ceiling. Any distance a player could read as a position
   change is a defect, because the next frame will snap it back.
4. Keep the camera impulse inside `IMPACT_SHAKE_MAX_AMPLITUDE = 0.13`. It is admitted only for heavy,
   critical, or boss contacts and must not disturb the authored orbit framing — the per-stage zoom
   clamps are `cinder-span 10.4–41.6`, `abyss-chancel 12–36`, `echo-throne 10.4–41.6`, and
   `abyss-chancel` additionally holds a 35° pitch floor in `DESCENT` and `SKIRMISH`. Prove the shake
   cannot push the camera outside its stage clamp.
5. For area contacts, scale through `aoeDensityFactor(targetCount)` and the authored budget rather
   than by adding geometry. The software tier drops arcs to 0 and the core entirely; whatever you add
   must still communicate radius with the ring alone, because the ring is the part that states the
   radius.
6. Handle reduced motion at every branch you touch. `advanceAoeBurst()` under reduced motion sets
   sweep to 1, brightness to 0.45 and locks arc yaw to `baseYaw`; `advanceImpactSignature()` pins the
   spear at 0.85 scale / 0.6 opacity and the glow at scale 1 / 0.4 opacity;
   `setReducedMotion(true)` clears `knockbacks`, nulls `cameraShake`, and immediately re-poses every
   live signature at progress 0 so nothing is left half-risen. A runtime toggle must not require a
   tick to take effect.
7. Measure before and after on the deterministic fixture `${fixtureSeed}` at a fixed tick: frame
   time, draw calls, triangles, and the live pool count. Report the delta per metric.
8. Verify the failure modes: simultaneous heavy contacts on one target, a boss contact during an
   active stage intro dolly, a contact at the pool cap of 40, contact during pause/resume, the
   software renderer tier, `prefers-reduced-motion`, and a runtime reduced-motion toggle mid-impulse.

**FORMAT:**
Markdown at `_workspace/current/qa/impact-feel-${contactEvent}.md`: the constant table with
current/proposed/reason, the knockback ceiling arithmetic against `TARGET_HEIGHT`, the camera-clamp
proof, the reduced-motion branch table, a before/after metrics table with an explicit delta column,
and the failure-mode checklist with pass/fail per row. Every number `[OBSERVED]` with its command.

**TARGET AUDIENCE:**
The QA session running prompt 18 and the performance owner, who compare like with like and reject any
measurement without a stated device, viewport, and fixture.

**HARD CONSTRAINTS:**

- Knockback is render-space only. It must never write back to simulation state or alter
  `getRunDigest()` inputs. Authoritative knockback is a separate, separately approved change.
- Knockback distance stays well under one actor width; the frame-by-frame snap-back is the reason.
- Camera impulse stays at or below `IMPACT_SHAKE_MAX_AMPLITUDE = 0.13` and may never push the camera
  outside its per-stage zoom clamp or below the `abyss-chancel` 35° pitch floor.
- Feel effects attach to authoritative contact events only. Never to windup or fire.
- Area burst scales through `aoeDensityFactor()` and `AOE_BURST_BUDGET`; the software tier must stay
  arc-free and core-free.
- Every reduced-motion branch you touch is re-posed synchronously on toggle, not on the next tick.
- Never suppress a console warning or lower a quality tier to hide a regression.

**DONE WHEN:**
Before/after metrics exist for the same fixture and tick, frame time is at or below baseline or the
regression is accepted with a number and a reason, the knockback ceiling and camera-clamp proofs are
numeric, every reduced-motion branch is covered, the failure-mode checklist is fully green, and
`node --test tests/combat-presentation-contract.test.mjs tests/aoe-burst-wide-hit-contract.test.mjs`
passes.
