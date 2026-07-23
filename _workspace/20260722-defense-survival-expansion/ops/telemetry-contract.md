# Telemetry contract (offline-safe)

## Boundary and version

`defense-telemetry.js` is a renderer- and rules-neutral observer. It receives detached snapshots, simulation events, input-feedback timestamps, and browser performance probes from `app.js`; it never writes simulation or campaign state. It has no `fetch`, XHR, beacon, WebSocket, account, player identifier, local-storage, or IndexedDB path.

Exports use:

- `format: "abyssal-defense-telemetry"`
- `schemaVersion: 1` on the envelope and every retained record
- `scope: "offline-local-debug"`
- a session-local `run-N` correlation key, which resets on reload and is not a player identifier
- `privacy.playerIdentifiers/networkTransport/persistentStorage: false`

The lobby’s non-primary **진단 내보내기** button downloads `abyssal-defense-telemetry.json`. Exporting reads the bounded in-memory recorder and does not pause or alter a run.

## Record envelope

Every record contains `schemaVersion`, monotonically increasing `sequence`, session-local `runId`, `type`, monotonic `atMs`, and detached JSON `payload`. `exportJson()` returns valid JSON with `bounds.maxRecords`, `retainedRecords`, and `droppedRecords`.

| event/field | producer | required payload / purpose |
|---|---|---|
| `RUN_STARTED` | app | stage ID, deterministic seed, rules version, 60 Hz tick rate, reduced-motion state |
| `RUN_SNAPSHOT` | snapshot observer | tick, defeated count, gate current/max integrity, active enemy count, terminal state |
| `ENEMY_DEFEATED`, `GATE_BREACHED` | simulation event observer | defeat pacing, damage, gate-pressure analysis |
| `GROWTH_OFFER`, `GROWTH_OFFER_VALUES`, `SKILL_SELECTED`, `SKILL_CAST` | simulation + app observer | three-choice offer, selection/cast, displayed current → upgraded values |
| `ITEM_COLLECTED` | simulation event observer | run-item collection |
| `ELITE_CANDIDATE_AVAILABLE`, input `EXTRACT_ELITE`, `ELITE_EXTRACTED` | simulation + input observer | extraction offer, attempt, and success |
| `BOSS_SPAWNED`, `TERMINAL`, `REWARD_OFFER_VALUES`, `REWARD_SELECTED`, `RUN_RESULT` | simulation + campaign observer | boss/result/reward funnel and displayed Archive current → upgraded values |
| `INPUT_VISIBLE` | app presentation boundary | input sequence/type, input and visible timestamps, latency, simulation tick |
| `FRAME_PROBE` | app rAF probe | 60-frame count/mean/p95/max, long-frame count, nullable JS heap sample |
| `REDUCED_MOTION_CHANGED` | app media-query observer | changed state and source |

The version-1 simulation-event allowlist is forward-compatible with the expanded deterministic loop: `objectiveId`, `occupationPointId`, `hazardId`, stable catalog/snapshot `policyId`, `spawnDirection`, `recovery`, HP/max HP, boss TTK ticks, current/upgraded values, and distinct action discriminators (`projectileId`, `sourceId`, `targetId`, `from`, `to`, `hit`, `guardedBy`) are retained when the simulation emits them. The recorder does not invent those outcomes. Occupation, recovery, terrain, hazard, spawn-direction, and enemy-policy emission remain simulation-owned.

## Bounds and sampling

- Default retention is a FIFO ring of 4,096 records, hard-capped at 16,384 by constructor validation. Dropped records are counted in the export.
- Run snapshots emit on the first observation, each 60-tick interval, defeated/gate/result changes, and terminal transition; repeated renders do not create snapshot spam.
- Simulation events are de-duplicated within a tick using the event type plus JSON-stable retained payload fields. This removes repeat-render copies while preserving distinct same-tick movement and projectile impacts.
- Frame durations aggregate into one 60-frame probe. The temporary window is bounded to 60 numbers; a 30-minute 60 Hz run produces about 1,800 frame probes rather than 108,000 frame records.
- Heap is best-effort (`performance.memory.usedJSHeapSize`) and exports `null` where the browser does not expose it.

## Evidence and gate disposition

Direct recorder smoke executed on 2026-07-22:

`node tmp/telemetry-sample-smoke.mjs`

Observed receipt before the one-off generator was removed:

`{"validJson":true,"schemaVersion":1,"boundedRetained":3,"boundedDropped":3,"sampleRecords":18}`

The real recorder output is `_workspace/20260722-defense-survival-expansion/engineering/defense-telemetry-sample.json`. This closes the missing emission/export implementation defect. It does **not** close G6: the required 30-minute target-device frame/heap/input soak remains deferred until measured.

A focused same-tick observer smoke also executed through a removed one-off generator:

`node tmp/telemetry-dedupe-smoke.mjs`

Observed: `{"validJson":true,"retainedRecords":5,"impacts":2,"moves":2,"repeatedRenderDuplicates":0,"maxRecords":16}`. Real output: `_workspace/20260722-defense-survival-expansion/engineering/defense-telemetry-dedupe-sample.json`.