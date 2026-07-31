# Stage runbook — placeholder resolution for stages 1–3

Every `${…}` placeholder in `prompts/approved/00`–`07`, resolved for the three canonical stages.
All values are `[OBSERVED 2026-07-31]` from `defense-catalog.js`, `stage-world-catalog.js`,
`stage-story-catalog.js` and `tests/`. If a value here disagrees with code, code wins and this file
is the defect.

## Identity

| `${sequence}` | `${stageId}` | `${stageName}` | 한글 타이틀 / 맵 라벨 | boss | elite / minion | HP scalar | boss ticks |
|---|---|---|---|---|---|---|---|
| 1 | `cinder-span` | Cinder Span | 사슬 아래의 길 / 잿빛 교량 | Cinder Warden (`s1-cinder-warden`) | `s1-ember-hunter` / rusher | 100 | 900 |
| 2 | `abyss-chancel` | Abyss Chancel | 반복되는 답을 거부하라 / 심연 예배소 | Veil Tactician (`s2-veil-tactician`) | `s2-veil-sentinel` / flanker | 115 | 780 |
| 3 | `echo-throne` | Echo Throne | 왕좌의 명령을 끊어라 / 메아리 왕좌 | Gate Sovereign (`s3-gate-sovereign`) | `s3-throne-wraith` / ranged | 130 | 840 |

There is no fourth stage. `STAGE_SHOWCASE_IDS` asserts exactly three editorial showcases, and
`stage-world-catalog.js` asserts the profile set equals `STAGES` — adding a stage means changing
both assertions deliberately in the same commit.

## Presentation placeholders

| Field | `cinder-span` | `abyss-chancel` | `echo-throne` |
|---|---|---|---|
| `${silhouetteProfile}` | `jagged-parapet-blockade` | `bent-nave-colonnade` | `axial-crescent-court` |
| skyline | `low-wide-forge-teeth` | `paired-apse-arches` | `shattered-dais-crown` |
| `${accentHex}` | `#f3592c` | `#8f67ff` | `#72c8ff` |
| `${motif}` | embers moving through ash | oath rings and violet static | echo fractures and cold blue glass |
| fog near/far | 22.4 / 50.4 | 24 / 54 | 23 / 55 |
| camera focus | (13800, 6000) | (13600, 6000) | (14200, 6000) |
| intro ticks | 90 | 96 | 102 |
| `${effectId}` | `cinder-span-ember-wake` | `abyss-chancel-mirror-static` | `echo-throne-fracture-echo` |
| VFX clip | `stage-vfx::cinder-span::loop::v01` | `stage-vfx::abyss-chancel::loop::v01` | `stage-vfx::echo-throne::loop::v01` |
| terrain (runtime) | `assets/mesh/terrain/terrain-cinder-span/runtime/terrain/terrain-cinder-span-floor.glb` | `…/terrain-abyss-chancel/runtime/terrain/terrain-abyss-chancel-floor.glb` | `…/terrain-echo-throne/runtime/terrain/terrain-echo-throne-floor.glb` |
| walkable bounds | 600–23400 × 800–11200 | 600–23400 × 700–11300 | 600–23400 × 600–11400 |
| obstacles / props / landmarks | 3 / 12 / 6 | 6 / 12 / 6 | 6 / 12 / 6 |

## Encounter placeholders

| Field | `cinder-span` | `abyss-chancel` | `echo-throne` |
|---|---|---|---|
| `commitmentCap` | 3 | 4 | 4 |
| `maxConcurrentEnemies` | 8 | 9 | 10 |
| big wave (concurrent / cap / interval) | 22 / 7 / 5 | 24 / 8 / 6 | 26 / 8 / 4 |
| `spawnIntervalTicks` | 18 | 24 | 15 |
| objective 1 (`corridor`) | `cinder-relay-crossing` r1100 @ (14600, 5200), waves 0–4, recovery 180 | `chancel-nave-advance` r1000 @ (15000, 6000), waves 0–3, recovery 240 | `throne-aisle-break` r1050 @ (15200, 6000), waves 0–5, recovery 210 |
| objective 2 (`arena`) | `cinder-forge-stand` r1400 @ (17400, 6000), waves 5–9, recovery 210 | `chancel-transept-lock` r1500 @ (17600, 8200), waves 4–9, recovery 270 | `throne-dais-stand` r1550 @ (18000, 6000), waves 6–10, recovery 300 |
| retry budget | `maxAttempts: 3` on both objectives, all stages |
| chokepath | `cinder-center` x18000 ±2200 | `chancel-nave` x18800 ±1300 | `throne-aisle` x18800 ±1600 |
| flank entry | (12000, 9800) | (12800, 10200) | (12800, 10400) |
| elevation anchor | `cinder-overlook` (16600, 2600) ×1.08 | `chancel-apse` (18000, 2600) ×1.13 | `throne-dais` (18200, 6000) ×1.10 |
| hazard | `ash-surge` (14800, 6000) r1100, 8 dps | `oath-pressure` (15600, 7000) r1450, 16 dps | `echo-rift` (16000, 6000) r1250, 10 dps |
| occupation | `cinder-seal` (17600, 6000) r900, hold 180 | `chancel-oath` (18200, 5200) r800, hold 330 | `throne-domain` (18400, 6000) r800, hold 240 |
| extraction | `cinder-bind` (15400, 6000) r1000, window 600 | `chancel-bind` (16000, 7000) r850, window 600 | `throne-bind` (16200, 7600) r900, window 600 |
| spawn directions | W, SW | W, SW, NW | W, SW, NW |
| seeded variation | jitter 12 / +1 / lane 300 | jitter 27 / +1 / lane 660 | jitter 18 / +1 / lane 420 |
| boss threshold | (19000, 6000) contest 120 | (19300, 6000) contest 135 | (19400, 6000) contest 150 |
| wave triples | 0/rusher×4, 180/flanker×3, 390/ranged×2 | 0/rusher×5, 180/flanker×4, 420/ranged×3 | 0/flanker×5, 210/ranged×3, 480/guardian×2 |

Only `cinder-span` carries a `mapVariant` (v1, modules `ember-relay-spire` + `drowned-forge-arch`,
protected corridor declared) and a surprise table.

## Quest layer — the exact coordinates prompt 02 must reproduce

| Stage | `questId` | giver | 1 `route-objective` | 2 `route-gate` | 3 `occupation-focus` | 4 `extraction-beacon` |
|---|---|---|---|---|---|---|
| 1 | `cinder-span:unchain-the-descent` | `cinder-span:ember-lookout` (17100, 2700) | (14600, 5200) | (17400, 6000) | (17600, 6000) | (15400, 6000) |
| 2 | `abyss-chancel:refuse-repeated-answer` | `abyss-chancel:veil-lookout` (17300, 7850) | (15000, 6000) | (17600, 8200) | (18200, 5200) | (16000, 7000) |
| 3 | `echo-throne:break-the-command` | `echo-throne:throne-lookout` (17800, 8100) | (15200, 6000) | (18000, 6000) | (18400, 6000) | (16200, 7600) |

Quest point 4 always binds `{ type: "OBJECTIVE_COMPLETED", objectiveId: "boss-kill" }`.

## Rewards

| Stage | item | run rewards | extraction skill | appearance |
|---|---|---|---|---|
| 1 | `ashen-sigil` | `ember-cohort-legacy`, `stillwater-hourglass`, `bulwark-brand` | `rift-bolt` L1 | `cinder-span-ember-chain` (back) |
| 2 | `ward-splinter` | `rift-lens-archive`, `anchor-shard-archive`, `abyssal-banner` | see `stage-story-catalog.js` | see `stage-story-catalog.js` |
| 3 | `echo-compass` | `throne-echo-record`, `veil-vanguard-legacy`, `stillwater-hourglass` | see `stage-story-catalog.js` | see `stage-story-catalog.js` |

## `${fixtureSeed}` — seeds already used by the suites

| Stage | Seeds in `tests/` | Note |
|---|---|---|
| 1 | `71` (dominant), `73`, `5`, `3`, `21`, `211` | `71` is the de-facto regression fixture |
| 2 | `9`, `5`, `3`, `71` | |
| 3 | `3`, `12`, `19`, `37` | |

Reuse an existing seed when comparing against the baseline; introduce a new one only for a new
fixture, and record it here.

## Entry point per intent

| Intent for stages 1–3 | Enter at | Must re-clear |
|---|---|---|
| Re-lay a stage's routes/obstacles/props | `00` → `02` | quest-points, routing-contract, presentation, movement |
| Retune objectives, waves, caps, hold/extraction | `01` (then `02` only if a bound coordinate moved) | wave-doctrine, routing-contract |
| Dungeon-ify a stage (modular obstacle lattice) | `00` → `03` → `02` | all of the above + terrain contract |
| Re-dress props / skybox only | `04` | presentation, terrain |
| Add or retune the stage VFX cue | `05` | presentation + frame budget |
| Verify only | `06` | full quoted regression + browser |
| Deploy | `07` | `06` first, always |

A coordinate that appears in the quest table above cannot move in isolation: moving an encounter
objective, the occupation, or the extraction point forces the matching quest point in the same
commit, or the module throws on import.
