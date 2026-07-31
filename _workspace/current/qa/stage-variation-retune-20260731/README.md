# echo-throne doctrine retune — evidence (2026-07-31)

Change under test: the `echo-throne` row of `STAGE_WAVE_DOCTRINE` in `defense-catalog.js`
(`classes` → flanker/ranged/guardian/rusher, `kindCycle` → normal,mid,normal,big,normal,
`midbossEnemy` → ranged). Nothing else moved.

**Isolation.** Another session was concurrently editing `defense-run-simulation.js` (arrival
choreography). Every measurement below was therefore taken in a sandbox built by **copying**
`git show HEAD:<file>` for every root `*.js` (never symlinking — Node resolves a symlinked module
from its realpath and would silently load the working-tree file), then swapping in exactly one
candidate `defense-catalog.js`.

| File | Produced by | Reads |
|---|---|---|
| `balance-head.json` | `node scripts/run-defense-balance-sim.mjs --strict` in the HEAD sandbox | determinism + termination baseline |
| `balance-mycatalog.json` | same command, HEAD simulation + retuned catalog | `pass: true`, stages 1–2 digests byte-identical, `echo-throne` FINAL_COMPLETION ×3 |
| `playtime-baseline-head.json` | `node scripts/measure-stage-playtime.mjs --seeds 3` in the HEAD sandbox | 192.13 / 205.27 / 210.08 s medians |
| `playtime-mycatalog.json` | same command with the retuned catalog | 192.13 / 205.27 / 209.68 s medians, 9/9 victories, 9/9 in the 180–360 s target |
| `stage-variation-before.json` | `node scripts/scan-stage-variation.mjs` before the retune | response types 16 → 17 → **16**, two escalation failures |
| `stage-variation-after.json` | `node scripts/scan-stage-variation.mjs --strict` after | `pass: true`, worst pair 3/20 = 0.15, response types 16 → 17 → 17 |
| `probe-digest.mjs` | `node _workspace/current/qa/stage-variation-retune-20260731/probe-digest.mjs` | the three pinned `<stage>/<seed>/500 bare` digests, for recomputing the fixture in `tests/defense-run-simulation.test.mjs` |

Resolved: the pinned `echo-throne/12/500 bare` fixture in `tests/defense-run-simulation.test.mjs`
was re-baselined to `01972547729aa402735cb70eef54c126a816ec062bc2e165a511e04de825107a` — the value
both the HEAD sandbox and the working tree produce for this catalog, once the concurrent arrival
work had become digest-neutral at every pinned checkpoint (the `cinder-span` and `abyss-chancel`
rows are unchanged). `node --test tests/defense-run-simulation.test.mjs` → **40 / 40 / 0**.

Still open and NOT owned by this change: `tests/defense-expansion-contract.test.mjs` fails
`gate pressure advances toward the gate` (15/17) in the working tree. HEAD simulation + HEAD catalog
is 17/17 and HEAD simulation + this catalog is 17/17, so the assertion belongs to the in-flight
arrival work in `defense-run-simulation.js`.
