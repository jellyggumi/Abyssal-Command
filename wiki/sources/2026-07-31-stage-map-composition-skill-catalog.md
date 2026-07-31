# Source note — stage map / 3D dungeon / stage composition skill catalog (2026-07-31)

Raw capture: [[raw/sources/2026-07-31-stage-map-composition-skill-catalog]]

Three captures were read to answer one question: *how should an Abyssal Surge stage map be composed,
and with which prompts at each step.*

| # | Source | What it settles | What it does not |
|---|---|---|---|
| S1 | Operator catalog of map/dungeon/stage AI skills and tools (sections 1–8, incl. the 7-step recommended order) | the roster of usable local skills, the external tool landscape, and the repository mapping (`stage-world-catalog.js` ↔ `author-game-levels` / `design-game-encounters`, tests as the regression gate) | contains no repository constraint; every tool row is engine-agnostic and several rows are Unity/Unreal-only |
| S2 | prompts.chat README (CC0 prompt data, MIT source) | that prompt content may be adapted freely, and the available access paths (CSV, `PROMPTS.md`, CLI, MCP, Claude Code plugin) | nothing domain-specific |
| S3 | prompts.chat `prompts.csv` rows — `Act as a Procedural Content Generator`, `Procedural 3D Environment Designer`, `Prompt Generator` (C.R.A.F.T.) | the prompt skeleton adopted for `prompts/approved/*` and the PCG framing (pseudocode + data structure + reachability check + seed/entropy/density parameters) | both PCG rows assume *runtime, infinite* generation — the opposite of this repository's static authored-data contract, so they were retargeted, not copied |

Synthesis: [[wiki/concepts/stage-map-composition-pipeline]] — band grid, the executable map contract,
the tool applicability verdicts, and the seven-step pipeline.

Applied artifact: `prompts/README.md`, `prompts/VERSIONS.md`, `prompts/approved/00`–`07`.

Reading note: S1 is the *agenda* and S3 is the *form*, but neither is load-bearing for correctness.
What actually decides whether a stage map is valid is `validateProfile` in `stage-world-catalog.js`
plus the `tests/stage-*` suites; the prompts are only useful because those clauses were transcribed
into them verbatim. The catalog's §4 (Dungeon Architect, Houdini, UE5 PCG) and §7 (Unity/Godot MCP)
rows are inapplicable at runtime here under `CLAUDE.md` §2 — they survive only as offline layout
sketchpads whose coordinates are hand-transcribed.
