# 10 — Presentation cue specification

- **Version** v1 (2026-07-31)
- **Skills** `/skill:game-vfx` (spec + lifecycle), `/skill:design-action-combat` (timing only)
- **Produces** the written cue contract that every later step implements against. No asset, no code.
- **Placeholders** `${cueId}`, `${eventType}`, `${family}` (one of `drop` `buff` `spawn` `deform`
  or `none`), `${stageId}`, `${fixtureSeed}`.

---

**CONTEXT:**
The transient VFX pool is capped at `MAX_VISUAL_EFFECTS = 40` (exported from
`battle-realtime-three.js`, imported by `tests/combat-presentation-contract.test.mjs` so the budget
lives in one file). Inside that 40, `NEW_VFX_FAMILY_LIVE_BUDGET` caps each new family separately:
`drop 3`, `buff 2`, `spawn 4`, `deform 1`. `VFX_MODELS` carries 88 event ids;
`CRITICAL_VFX_EVENT_TYPES` exempts 17 of them from eviction by type, and `isCriticalVfxEvent()` adds
two payload-conditional cases (`ENEMY_SPAWNED` when `grade === "SHADOW"`; `GIMMICK_ARMED` /
`GIMMICK_TRIGGERED` when `gimmickClass` is `deformation` or `hazard`).

The failure mode this step exists to prevent is **silent absence**: `effectAnchor()` returns null for
an unanchorable event and `spawnVfx()` hard-returns with no console warning, so a cue that never
spawns is indistinguishable in production from a cue that was never requested. A cue that is not
specified here cannot be proven to exist later.

`CLAUDE.md` §2 forbids building presentation polish before the system it communicates is defined.
If `${eventType}` is not already emitted by `defense-run-simulation.js`, stop: the simulation work
comes first.

**ROLE:**
You are a VFX director for a browser game who states gameplay meaning before spectacle. You treat
every cue as a claim the player will act on, so a cue whose lifetime disagrees with the rule it
communicates is a lie, not a polish issue. You know the pool is small and you spend it deliberately.

**ACTION:**

1. Confirm `${eventType}` is emitted. Cite the exact emit site as `file:line` and list the payload
   keys verbatim. A field you intend to read that is not in that list does not exist yet — record it
   as a required simulation change, not as an assumption.
2. State the cue contract, one row per item, no adjectives:
   trigger event · owner entity · anchor (`effectAnchor()` source) · lifetime in ticks and the field
   it comes from · gameplay meaning in one sentence · silhouette at the real camera distance ·
   colour against the stage motif · family and its live cap · eviction class · cleanup rule ·
   reduced-motion equivalent.
3. Resolve the lifetime through `resolveVfxLifetimeTicks()` order, and say which branch applies:
   `BOSS_ATTACK_TELEGRAPHED` → `event.windupTicks` fallback 45; `ENEMY_SPAWNED` →
   `event.telegraphTicks`, fallback 60 for `grade === "SHADOW"` else 30; `GIMMICK_ARMED` →
   `event.telegraphTicks` fallback 180; `SKILL_CAST` → `SKILL_VFX_LIFETIME_TICKS[semanticVfxId]`;
   otherwise `VFX_LIFETIME_TICKS[type]` with a global fallback of 30.
4. Decide eviction class explicitly. Exempting a cue removes a pool slot from everything else; a cue
   is exempt only if evicting it would hide live gameplay information the player must act on. State
   which of the 40 slots you are taking away and from what.
5. Separate the five visual states — telegraph, contact, success, failure, lingering status — and say
   which of the five this cue is. One cue never covers two.
6. Specify the reduced-motion equivalent as a **static state that still carries the same meaning**,
   not as removal. `applyStageVfxPolicy()` resolves quality to exactly `full` / `low` /
   `reduced-motion`; `low` and `reduced-motion` both hide the `detail` and `decor` groups, and
   `reduced-motion` additionally stops the loop action.
7. Name the contract test that will prove the cue spawns, anchors, and retires, and the assertion
   that would fail if the cue silently never spawned.

**FORMAT:**
Markdown at `_workspace/current/design/presentation-cue-${cueId}.md`: the emit-site citation with
payload keys, the cue contract table, the lifetime derivation showing the branch taken, the eviction
justification with the slot arithmetic, the five-state table with four rows marked N/A, the
reduced-motion equivalent, and the named test assertion. Mark every statement `[OBSERVED]`,
`[INFERENCE]` or `[TARGET]`.

**TARGET AUDIENCE:**
The engineer running prompts 12–14, who will implement exactly what this file says and nothing else,
and the QA session running prompt 18, which will reject any cue whose lifetime cannot be traced to a
named field.

**HARD CONSTRAINTS:**

- The pool budget is `MAX_VISUAL_EFFECTS`, imported — never restate 40 as a literal in new code.
- A cue in family `${family}` may not exceed its live budget: `drop 3`, `buff 2`, `spawn 4`,
  `deform 1`. More simultaneous instances than that is a formation cue, not N cues.
- Payload beats table, always. A hardcoded lifetime that is right for one tier is wrong for the rest.
- Presentation may read simulation snapshots and must never write back or alter `getRunDigest()`
  inputs.
- Windup and fire events are not authoritative hits; `IMPACT_FEEDBACK_SOURCES` maps contact events
  only. A feel effect keyed off a windup event is a defect.
- Reduced motion is a supported mode with a static equivalent, never a removal.
- No new asset, no code edit, and no test run in this step.

**DONE WHEN:**
The emit site and its payload keys are cited as `file:line`, every row of the cue contract is a
number or an identifier, the lifetime traces to one named branch of `resolveVfxLifetimeTicks()`, the
eviction decision states the slot cost, the reduced-motion equivalent communicates the same meaning
statically, and the test assertion that would catch silent absence is named.
