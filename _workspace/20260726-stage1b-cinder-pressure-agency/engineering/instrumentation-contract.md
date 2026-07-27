# Stage 1b Instrumentation Contract

run-id: `20260726-stage1b-cinder-pressure-agency`
status: `instrumentation-only`

## Scope and frozen boundaries

This packet records deterministic evidence from the shipped Cinder Span simulation. It may read public run state and public events, but it MUST NOT alter gameplay/data tuning, runtime IDs, assets, renderer ownership, campaign schema, `getRunDigest()` bytes, or monetization boundaries. Synthetic evidence is never G7/G8 human evidence.

The canonical population is exactly 15 rows in this order:

- stance outer order: `VANGUARD`, `TURRET`, `SPLIT`
- seed inner order: `401`, `402`, `403`, `404`, `405`
- loadout: `ember-cohort`, `rift-lens`, `veil-vanguard`
- measurement profile: absent/null
- Warden progress: absent/null
- Warden/companion equipment: empty
- rewards: empty
- formation override: empty

The controller uses only public `queueInput` and `advanceDefenseRun` calls. Growth selects `choices[0]` only when offered; otherwise it uses the current commander skill order, casts active skills only, queues the public extraction route request when the elite candidate exists, and accepts/persists it only after the public simulation reports extraction ready. `redecideTicks=15`, setup advances are bounded separately by `0/240/480` for `VANGUARD/TURRET/SPLIT`, and only fight advances count toward `maxAdvanceCalls=20000`. `maxConsecutiveNoProgress=1200`. These values are evidence-controller limits, not simulation settings.

## Temporal observation contract

Every row covers the half-open range `[0, terminalTick+1)` with contiguous, non-overlapping intervals:

1. `pre-system`: `[0,0)`, explicit `empty:true`
2. `authored-wave-0`: `[0,180)`
3. `authored-wave-1`: `[180,390)`
4. `authored-wave-2`: `[390,gateTicks)`
5. `post-system`: `[gateTicks,terminalTick+1)`

Intervals are clipped to the terminal range. An empty interval is retained and MAY have `fromTick===toTick`; no other zero-width interval is inferred. Gaps and overlaps fail closed. `observationBucketIndex` is the temporal interval index and MUST be set from the interval containing the observed tick.

`sourcePacketIndex` is nullable and owns causal attribution only. It is non-null only when all causal sources resolve to one packet; `sourcePacketIndices` retains the complete sorted set for mixed-cause records. It MUST NOT be used as a substitute for `observationBucketIndex`.

## Composite-net integrity ledger

For every public one-tick advance, emit exactly one ledger record for each target in `gate`, `commander`, in target order. The record is a raw before/after state diff:

```json
{
  "tick": 0,
  "target": "gate|commander",
  "from": 1000,
  "to": 1000,
  "max": 1000,
  "appliedDelta": 0,
  "zeroNet": true,
  "causes": [],
  "causalEventSequences": [],
  "causalEventIds": [],
  "causalInputIds": [],
  "causalSpawnEventIds": [],
  "observationBucketIndex": 0,
  "sourcePacketIndex": null,
  "sourcePacketIndices": [],
  "clampFlags": {
    "fromAtFloor": false,
    "fromAtCeiling": true,
    "toAtFloor": false,
    "toAtCeiling": true,
    "deltaClamped": false,
    "recoveryClamped": false,
    "damageClamped": false
  }
}
```

`appliedDelta` MUST equal `to-from` and is the signed composite net from raw public state, including damage, recovery, passive integrity growth, active integrity recovery, and caps. Never sum event payloads to derive integrity. A non-zero delta MUST have resolved causal lineage through event IDs, input IDs, spawn event IDs, and event sequence. Causal cause order is fixed:

`COMMANDER_DAMAGED`, `COMMANDER_GATE_DIVERSION`, `GATE_BREACHED`, `HAZARD_DAMAGE`, `OBJECTIVE_PRESSURE_PULSE`, `OBJECTIVE_PRESSURE_DEADLINE`, `TERRAIN_RECOVERY`, `PROJECTILE_IMPACT`, `SKILL_SELECTED_PASSIVE_INTEGRITY`, `SKILL_CAST_INTEGRITY`.

`GATE_BREACHED` is canonical for an intercepted commander guard; `COMMANDER_GATE_DIVERSION` is its paired mirror annotation. Unknown or ambiguous integrity changes fail closed. Companion HP is outside this ledger and belongs to G3 formation evidence.

The ledger is observational only: no simulation events or snapshot fields are added.

## Causal packets and G3 formation evidence

Each pressure packet retains raw arrivals, pressure/terminal-pressure events, recovery events, agency windows, and the composite ledger records whose ticks fall in that interval. Packet totals are descriptive; reconciliation uses the ledger, not event payload sums.

G3 attribution is anchored to the accepted `INPUT_ACCEPTED` `STANCE_CYCLE` record and its same-tick `STANCE_SWITCHED` causal transition. Damage/downs at the accepted tick belong to the post-switch phase. Boss pressure before `bossSpawnTick + 1800` is `NOT_EXPOSED`; a conversion with no non-grace non-boss pressure MUST remain `NOT_EXPOSED`, never an immunity claim. Fifty rally-to-TURRET conversions and fifty VANGUARD plus fifty SPLIT controls are required for the canonical formation artifact.

## Persistence lifecycle

`applyEliteExtractionEvents(campaign, events)` is pure. It consumes actual `eventId`, `eliteId`, and `prototype` values and returns the identical campaign reference for an identical event replay or an already-captured elite with the same prototype. Missing/invalid fields, conflicting payloads for one event ID, an elite mapped to another prototype, or two distinct new handoffs in one run/batch throw. The one-handoff cap is per run/batch, not campaign lifetime. The app passes the ordered cumulative `ELITE_EXTRACTED` list to this reducer before `applyCampaignRunResult` on every terminal path and persists only when the reference changes; it never auto-equips the captured companion.

The persistence artifact contains three deterministic traces and campaign diffs:

- `victory`, seed `901`, accepted extraction
- `defeat-before-acceptance`, seed `902`, no accepted extraction
- `defeat-after-acceptance`, seed `901`, accepted extraction followed by MOVE-only pressure-deadline defeat

Each scenario uses `createCampaign({campaignId:"stage1b-cinder-persistence",resetEpoch:0})`, then `startRun(campaign,"cinder-span")`, and records initial, post-start, post-extraction, and final state.

## Canonical serialization, receipts, and checks

Evidence and receipts use canonical UTF-8 JSON, two-space indentation, recursively sorted object keys, fixed scenario/event/input order, and one trailing newline. Receipts contain `schemaVersion`, `artifactPath`, injected `sourceRevision`, exact `inputDigests`, `outputSha256`, `outputByteLength`, and the invoking `command`; they contain no live HEAD or wall-clock values. `--check` validates source/input digests and output bytes without overwriting canonical evidence or requiring current HEAD equality. All tests use in-memory data or fixed repo-local evidence paths; `/tmp` is prohibited.

Required canonical artifacts:

- `qa/evidence/gates/G2/g2-adversarial-tape-evidence.json` and `.receipt.json`
- `qa/evidence/gates/G2/g2-adversarial-tape-fixture.receipt.json`
- `qa/evidence/gates/G2/stage1b-cinder-pressure-packets.json` and `.receipt.json`
- `qa/evidence/gates/G3/stage1b-formation-attribution.json` and `.receipt.json`
- `qa/evidence/gates/G7/stage1b-persistence-scenarios.json` and `.receipt.json`

Required focused checks:

```sh
node --test tests/stage1b-g3-g7-verification.test.mjs tests/stage1b-pressure-packets.test.mjs tests/stage1b-persistence.test.mjs tests/g2-adversarial-tape-cli.test.mjs
node scripts/run-g2-adversarial-tape.mjs --fixture qa/fixtures/g2-adversarial-tape-fixture-v1.json --output qa/evidence/gates/G2/g2-adversarial-tape-evidence.json --source-revision <revision> --check
node scripts/export-stage1b-pressure-packets.mjs --output qa/evidence/gates/G2/stage1b-cinder-pressure-packets.json --source-revision <revision> --check
node scripts/export-stage1b-formation-attribution.mjs --output qa/evidence/gates/G3/stage1b-formation-attribution.json --source-revision <revision> --check
node scripts/export-stage1b-persistence-scenarios.mjs --output qa/evidence/gates/G7/stage1b-persistence-scenarios.json --source-revision <revision> --check
node --test 'tests/**/*.test.mjs'
```

These artifacts prove instrumentation and fail-closed behavior only. They do not promote G2/G3/G7/G8, substitute human evidence, authorize a numerical retune, or create a monetization surface.