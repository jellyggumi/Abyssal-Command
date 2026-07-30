# Log

Append-only timeline of meaningful wiki operations.

Use headings in this format:

```md
## [YYYY-MM-DD] ingest | Source title
## [YYYY-MM-DD] query  | Question title
## [YYYY-MM-DD] lint   | Pass summary
```

Each entry should list the files touched, the reason for the change, and any follow-up work.

## [2026-07-29] report | Natural rest-pose motion library

- Added `wiki/reports/2026-07-29-natural-rest-pose-motion-library.md` to record the 11-asset natural bind-pose cutover, its evidence, and its focused regression gates.
- Updated `index.md` so the report is discoverable from the vault entry point.

## [2026-07-30] ingest | Motion generation + encounter pattern research

- Added `raw/sources/2026-07-30-motion-generation-and-encounter-pattern-research.md` (immutable
  capture of MDM arXiv:2209.14916, T2M-GPT arXiv:2301.06052, the three.js animation-system docs and
  the Game Developer behaviour-tree article).
- Added `wiki/sources/2026-07-30-motion-generation-and-encounter-pattern-research.md` summarising
  what each source settles and what it does not.
- Added `wiki/concepts/motion-generation-for-runtime-rigs.md` (method comparison, the Blender
  retarget pipeline we run, and the concretised motion prompt templates) and
  `wiki/concepts/attack-pattern-presets-and-ai-response.md` (three-phase step structure, authored
  presets, and the four AI response patterns).
- Updated `index.md` so both concepts and the source note are reachable from the vault entry point.
- Follow-up: the generative path (S1/S2) has not been executed; the prompt templates exist for the
  case where a beat is missing from `assets/motion/bench`, and any output must clear the
  provenance/audit gate in `CLAUDE.md` §3 before it can be referenced at runtime.
