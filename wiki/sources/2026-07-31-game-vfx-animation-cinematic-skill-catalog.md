# 2026-07-31 — Game 3D VFX / animation / cinematic skill catalog

- Raw: [[raw/sources/2026-07-31-game-vfx-animation-cinematic-skill-catalog]]
- Kind: user-supplied catalog (chat), 9 sections + a second-message addendum
- Sibling: [[wiki/sources/2026-07-31-stage-map-composition-skill-catalog]] (map/dungeon/stage track)
- Produced: [[wiki/concepts/runtime-presentation-and-arrival-choreography]], `prompts/approved/10`–`19`

## What the source is

A roster of agent skills and external tools for the presentation half of the game —
real-time VFX and shaders, character motion, cinematic/video direction, audio direction,
and concept image sources — plus a repository mapping table and an eight-step recommended
order for adding one new effect or motion.

Sections 1–5 are local agent skills (`~/.agents/skills/*/SKILL.md` `source` frontmatter).
Sections 6–8 are external products; the capture states their links were **not** live-verified,
so nothing in this vault treats those URLs as checked. Section 9 maps skills onto real
repository paths and is the only section that carries repository authority, because every path
it names was confirmed present.

## Addendum (second message)

A second requirement landed in the same session: strengthen knockback, and stop enemy
engagement from reading as a serial single-file column — wanted parallel/abreast entry,
circular encirclement, emergence from the ground around the player, and drop-from-sky.
This is arrival and engagement choreography and it straddles the simulation/renderer boundary,
which the catalog itself does not address.

## Verification performed against this repository

Every repository path in section 9 exists (14/14 scripts and tests checked with `find`).
The recommended order is usable, but it is a *procedure*, not a contract: it names no number,
so on its own it cannot pass `CLAUDE.md` §6 ("Numbers gate everything"). The numbers were
recovered from the runtime instead and are recorded in the concept page.

Two findings the catalog does not contain, both established from code:

1. **Knockback is presentation-only.** `grep -n knockback defense-run-simulation.js` returns
   nothing; the entire knockback model is four renderer constants
   (`battle-realtime-three.js:1057-1060`) applied as a render-space offset that
   `updateActorFollow()` pulls back every frame. Strengthening it therefore cannot touch
   authoritative positions.
2. **The arrival-grade hook is dead in production.** `ENEMY_SPAWNED` is emitted from exactly
   one site (`defense-run-simulation.js:1036`) whose payload carries neither `grade` nor
   `telegraphTicks`. The renderer branches on both
   (`isCriticalVfxEvent()`, `resolveVfxLifetimeTicks()`), so the SHADOW pool exemption and the
   60-tick arrival telegraph are currently unreachable, and every arrival falls back to the
   30-tick table value and stays evictable.

## What was built from it

- [[wiki/concepts/runtime-presentation-and-arrival-choreography]] — the executable presentation
  contract (numbers), the arrival/knockback gap, tool verdicts, and the ten-step pipeline.
- `prompts/approved/10-presentation-cue-spec.md` … `19-presentation-capture-and-release.md` —
  one prompt per step of that pipeline, each bound to code constants rather than to prose.

## Limits

- Sections 6–8 tool claims are vendor claims. None was exercised here.
- `/skill:dalamud-vfx-editor` is FFXIV-format tooling; it is reference material for data
  structure only and produces nothing this runtime can load.
- Unity VFX Graph, Unreal Niagara and Houdini are engine-locked out by `CLAUDE.md` §2. They are
  usable only as offline authoring that exports a flipbook texture or a baked GLB.
