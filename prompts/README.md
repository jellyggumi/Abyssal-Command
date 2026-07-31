# Stage-map prompt library

Curated, repository-bound prompts for composing an Abyssal Surge stage map: layout, encounter
progression, dungeon-style procedural layout curation, dressing, VFX/perf, QA proof, and release.

These prompts are **instructions handed to a skill or an agent**, not documentation. Each file is a
complete, copy-pasteable brief with the repository's hard invariants inlined, so a session that has
never read `stage-world-catalog.js` still cannot author an invalid stage.

## Layout

```
prompts/
  README.md                      this file
  RUNBOOK.md                     stages 1-3: every ${placeholder} resolved from code
  VERSIONS.md                    change log per prompt
  approved/                      prompts cleared for use
    00-stage-map-blueprint.md    map skeleton: bands, gate, corridors, anchor budget
    01-encounter-progression.md  /skill:design-game-encounters — objectives, waves, caps
    02-stage-world-authoring.md  /skill:author-game-levels — the deterministic profile
    03-procedural-layout.md      WFC / BSP / Dungeon Architect output → curated obstacles
    04-stage-dressing-assets.md  props, landmarks, skybox, provenance gate
    05-vfx-and-budget.md         /skill:create-game-vfx → /skill:optimize-threejs-games
    06-regression-and-proof.md   node --test gates + /skill:test-playable-web-games
    07-release.md                /skill:ship-web-games
  drafts/                        unproven prompts; never cited as an approved gate
```

## Order of use

Run `00 → 07` for a new stage; enter at the matching step for a revision. `00` and `01` decide
numbers, `02` writes them into code, `03`–`05` dress and pay back the frame budget, `06` is the only
step that can call the work correct, `07` deploys it.

Skipping `06` is not allowed. `CLAUDE.md` §6: "Numbers gate everything. No adjective passes a gate."

## Authoring rules for this library

1. **Every constraint is a number or an identifier.** No prompt may say "readable" or "balanced"
   without the measurement that decides it.
2. **Constraints are copied from executable truth**, i.e. `validateProfile` in
   `stage-world-catalog.js` and the `tests/` suites — not from prose. When the validator changes,
   the prompt changes in the same commit and gets a `VERSIONS.md` row.
3. **Placeholders use `${name}`** and are listed at the top of each prompt.
4. **C.R.A.F.T. structure** (CONTEXT / ROLE / ACTION / FORMAT / TARGET AUDIENCE) plus two
   repository-specific sections: `HARD CONSTRAINTS` and `DONE WHEN`.
5. **Engine lock.** This is a Three.js + WebGL browser game. A prompt that assumes Unity, Unreal,
   Addressables, GAS, or C# is wrong for this repository — see `CLAUDE.md` §2. Sections 4 and 7 of
   the source catalog (Dungeon Architect, Houdini, UE5 PCG, Unity/Godot MCP) are usable **only as
   offline layout generators whose output is transcribed into `stage-world-catalog.js` by hand**.

## Provenance

- Structure and the C.R.A.F.T. skeleton: [prompts.chat](https://github.com/f/prompts.chat) —
  prompt data is CC0 1.0. Seed rows are captured verbatim in
  `raw/sources/2026-07-31-stage-map-composition-skill-catalog.md`.
- Skill roster and tool catalog: same capture, section 1–7.
- Repository invariants: `stage-world-catalog.js`, `defense-catalog.js`, `tests/**`, `CLAUDE.md`.
- Synthesis and band layout: `wiki/concepts/stage-map-composition-pipeline.md`.
