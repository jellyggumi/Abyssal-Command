# Abyssal Surge
- Static mobile-first single-player defense-survivor; player movement is manual, baseline combat/targeting automatic.
- Product contract: `docs/abyssal-command-defense-survivor-design.md`; production operating boundary: `docs/abyssal-surge-production-cycle.md`.
- Deterministic 60 Hz simulation and offline local-first persistence are non-negotiable. Snapshot renderers/audio observe simulation; presentation must never alter outcomes.
- Runtime authority: `defense-catalog.js` authored data; simulation owns ticks, RNG/event order, campaign state persists meta progression; run-only skills reset.
- Current game-production evidence and prior cycle artifacts live in `_workspace/20260722-defense-survival-expansion/`; dated 20260716 workspaces are archival.
- Read `mem:tech_stack` for runtime/tools, `mem:conventions` before edits, and `mem:task_completion` for relevant verification.