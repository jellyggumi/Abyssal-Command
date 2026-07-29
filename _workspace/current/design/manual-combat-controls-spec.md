# Manual combat controls slice

[OBSERVED] The runtime already supported continuous movement through the D-pad and WASD/arrow keys, while basic attack remained simulation-driven automatic fire. The runtime had active skill buttons and authored Three.js character motion/VFX hooks.

[TARGET] Add an optional manual basic-attack verb without disabling automatic fire: Space/J/F/Numpad0 and the mobile attack medallion queue `ATTACK`; the simulation accepts it only when the basic cooldown is ready and a target is available. Automatic basic fire remains the fallback loop.

[TARGET] The mobile combat cluster keeps the attack medallion and active skills within one thumb reach. Skills are arranged around the medallion, use 44px+ touch targets, safe-area-aware bottom placement, and a reduced-motion branch. The cluster must not cover the integrity panel or movement pad.

[TARGET] `SKILL_CAST` events carry authored `motion` and `vfx` identifiers. The Three.js presentation consumes those fields and reuses the bounded existing stage-VFX pool; simulation state remains authoritative and presentation remains downstream-only.

[OBSERVED] The non-pixel Dusk Warden combat reference is stored at `_workspace/current/design/skill-vfx-reference/dusk-warden-manual-combat.png`; its adjacent provenance receipt marks `runtimeEligible: false`. It is concept/reference material only until an asset audit promotes it.
