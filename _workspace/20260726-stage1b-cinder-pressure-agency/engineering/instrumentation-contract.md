# Stage 1b Instrumentation Contract

run-id: `20260726-stage1b-cinder-pressure-agency`
status: `implementation-slice-authorized-after-scope-review`

## Purpose

Add evidence surfaces without changing gameplay data or player-visible behavior. Every result must be reproducible from a real `createDefenseRun` execution and must identify synthetic-controller assumptions.

## Record schemas

### `pressurePacket`

```json
{
  "runId": "string",
  "stageId": "cinder-span",
  "seed": 401,
  "packetIndex": 0,
  "fromTick": 0,
  "toTick": 120,
  "arrivals": [{"enemyId":"rusher","count":14,"policyId":"gate-pressure","lane":"W"}],
  "gateIntegrityBefore": 1000,
  "gateIntegrityAfter": 900,
  "commanderIntegrityBefore": 1000,
  "commanderIntegrityAfter": 1000,
  "pressureEvents": [{"type":"ENEMY_ATTACK","tick":60,"target":"gate","damage":10}],
  "terminalPressureEvents": [],
  "agencyWindows": [{"type":"GROWTH_OFFER","tick":90,"accepted":true}],
  "controller": {"kind":"synthetic","policy":"engaged","redecideTicks":15}
}
```

Required invariants:

- `toTick > fromTick`; packets are ordered and non-overlapping.
- Every integrity delta is attributable to an event in `pressureEvents` or `terminalPressureEvents`.
- `BOSS_PRESSURE_GRACE_TICKS` is emitted as metadata; damage during grace is not expected boss pressure.
- `controller.kind=synthetic` is mandatory for scripts and never satisfies G7/G8 human evidence.

### `formationTransition`

```json
{
  "runId":"string",
  "stageId":"cinder-span",
  "mode":"rally-then-turret",
  "rallyEventTick":1800,
  "switchEventSequence":42,
  "acceptedSwitchTick":1801,
  "stanceBefore":"VANGUARD",
  "stanceAfter":"TURRET",
  "frontBefore":["companion:0","companion:1"],
  "frontAfter":["companion:0"],
  "companionDamageByPhase":{"before":1234,"switchTick":0,"after":15},
  "downsByPhase":{"before":0,"switchTick":0,"after":1},
  "pressureContext":{"bossGraceActive":true,"nonBossPressureActive":false}
}
```

The phase split is derived from accepted input event sequence/tick, not a post-hoc local flag. A conversion with no non-grace pressure after the switch is reported as `NOT_EXPOSED`, not as proof of immunity.

### `persistenceScenario`

```json
{
  "scenario":"victory|defeat-after-acceptance|defeat-before-acceptance",
  "seed":901,
  "acceptedEliteExtractCount":1,
  "events":[{"eventSequence":1,"tick":1200,"type":"ELITE_CANDIDATE_AVAILABLE"}],
  "campaignBefore":{"capturedEliteIds":[]},
  "campaignAfter":{"capturedEliteIds":["s1-ember-hunter"],"companionLoadout":["ember-cohort"]},
  "writes":[{"kind":"campaign","acceptedExtract":true}],
  "invariants":{"maxAcceptedHandoffs":1,"writesWithoutAcceptedExtract":0}
}
```

## Required machine checks

- 15-row Cinder export has all required fields and explicit TTK status.
- 50 formation conversions have accepted switch ticks and phase attribution.
- 100 non-TURRET runs retain down/defeat counts and pressure context.
- Three persistence scenarios include event traces and before/after campaign diffs.
- Symmetric trial rows carry identical value-budget fingerprints for paired entries.

No field in this contract changes `defense-catalog.js`, `rpg-catalog.js`, extraction values, or the player-facing UI.
