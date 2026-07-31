# Stage difficulty and system variation — the executable contract

*Synthesis of [[wiki/sources/2026-07-31-stage-pattern-difficulty-system-variation-skill-catalog]]
against the shipped code. Every number below was read out of `defense-catalog.js`,
`defense-run-simulation.js`, `scripts/` and `tests/` on 2026-07-31, not out of the capture.*

Sister pages: [[wiki/concepts/stage-map-composition-pipeline]] (where a stage is),
[[wiki/concepts/runtime-presentation-and-arrival-choreography]] (how it looks),
[[wiki/concepts/attack-pattern-presets-and-ai-response]] (how one contact resolves).

---

## 1. The one discipline that survives contact with the code

The capture's core claim — *난이도는 "적 HP 배수"가 아니라 플레이어에게 요구되는 대응의 종류 수* —
is the only line in it that is both testable and load-bearing here. Turned into a measurement
(`scripts/scan-stage-variation.mjs`) it immediately failed on the shipped catalog:

| Stage | order | HP `scale` | hold | response types (before) | response types (after) |
|---|---|---|---|---|---|
| `cinder-span` | 1 | 100 | 170 s | 16 | 16 |
| `abyss-chancel` | 2 | 115 | 175 s | 17 | 17 |
| `echo-throne` | 3 | 130 | 180 s | **16** | **17** |

The HP curve climbed and the *variety* curve fell: the final stage fielded three enemy classes
against stage 2's four, and copied stage 1's mid-boss class (`guardian`), pressure lane
(`chokepath`) and wave-kind rhythm (`nnbm…`) outright. That is "the same fight with bigger
numbers", diagnosed numerically rather than by taste. The retune is recorded in §7.

## 2. Who owns which number

| Layer | Owner | Never |
|---|---|---|
| Stage roster, HP scale, boss, elite | `STAGES` in `defense-catalog.js` | invented in the renderer |
| Wave rhythm, hold, class rotation, mid-boss class | `STAGE_WAVE_DOCTRINE` | hand-written per wave |
| Wave size | derived from the clear budget (§3) | authored as a body count |
| Lanes, hazard, occupation, extraction, seeded jitter | `STAGE_TACTICS` | duplicated in `stage-world-catalog.js` |
| Objectives, wave-slot ownership, concurrency and commitment caps | `STAGE_ENCOUNTER_ROUTES` | redefined by scene decoration |
| Enemy statlines, policies, attack patterns | `ENEMIES`, `ENEMY_POLICIES`, `ATTACK_PATTERNS` | scaled per stage except by `scale` |
| Rule-change packages | `ABYSS_DEPTH_PACKAGES` | a global stat multiplier |
| Whether any of the above is acceptable | `scripts/` + `tests/` | an adjective |

## 3. Difficulty is a budget, not a multiplier

`buildDoctrineWavePlan()` (`defense-catalog.js`) derives every wave from the *floor player's* clear
capacity:

```
clearableHp = (defenseTicks / waveCount / 60) * PLAYER_BASELINE_DPS      // 2250 dps
waveHp      = clearableHp * 0.55 (WAVE_PRESSURE_BP) * kind.countBp * rampBp
count       = waveHp / (ENEMIES[class].hp * scale / 100)
```

- `PLAYER_BASELINE_DPS = 2250` is the bare commander: `COMMANDER.basicDamage 900` per
  `basicCooldown 24` ticks at `TICK_RATE 60`. Companions, items, ranks and carry-over are headroom.
- `WAVE_PRESSURE_BP = 5500` — a normal wave asks for 55 % of one cadence slot.
- `rampBp` climbs 10000 → 13000 linearly across the stage's slots (100 % → 130 %).
- `WAVE_KIND_PROFILE.countBp`: `normal 10000`, `big 17500`, `mid 5000` (mid-boss carrier).
- `MIDBOSS_PROFILE`: `hpBudgetBp 6000` (60 % of one cadence slot), `damageBp 16000`,
  `speedBp 8500`, `radiusBp 14000`, `xpBp 40000`. HP is a share of the budget, never a class multiple.

Measured on the shipped catalog (2026-07-31, after the retune):

| Stage | cadence | clear budget | worst wave HP | ratio | mid-boss HP |
|---|---|---|---|---|---|
| `cinder-span` | 1020 t (17.00 s) | 38 250 | 48 000 | 1.25× | 22 950 ×2 (`guardian`) |
| `abyss-chancel` | 1050 t (17.50 s) | 39 375 | 49 680 | 1.26× | 23 625 ×2 (`flanker`) |
| `echo-throne` | 981 t (16.35 s) | 36 788 | 46 280 | 1.26× | 22 073 ×2 (`ranged`) |

`tests/stage-wave-doctrine.test.mjs` caps the ratio at **2.0×** — beyond that the hold stops being
clearable by the floor player and the stage stalls instead of ending.

## 4. The rhythm each stage is allowed to have

| Stage | waves | rhythm (n/b/m per slot) | class rotation | lane | mid-boss |
|---|---|---|---|---|---|
| `cinder-span` | 10 | `n n b m n n b m n b` | rusher > flanker > ranged | chokepath | guardian |
| `abyss-chancel` | 10 | `n b n m n b n m n b` | ranged > flanker > rusher > guardian | flank | flanker |
| `echo-throne` | 11 | `n m n b n n m n b n b` | flanker > ranged > guardian > rusher | chokepath | ranged |

Invariants enforced by `tests/stage-wave-doctrine.test.mjs`: hold 160–250 s, ≥ 10 waves, first wave
at tick 0, last wave `big` and before the hold expires, ≥ 2 `mid` and ≥ 2 `big`, even cadence ≥ 600
ticks, a pinned policy on every statement wave and **no** pinned policy on a normal wave (that is
what keeps `player-pursuit` / `low-hp-focus` in the seeded pool), two seeded composition
alternatives per wave, and `midboss ⇔ kind === "mid"`.

## 5. The four archetypes and their answers

| Class | HP | speed | dmg | attack | radius | policy | pattern (telegraph/active/recovery) |
|---|---|---|---|---|---|---|---|
| `rusher` | 3000 | 3000 | 10 | 60 t | 260 | gate-pressure | `ember-rush` 18/6/24, r950 |
| `flanker` | 3600 | 3300 | 12 | 60 t | 340 | flank | `veil-flank` 12/4/20 r800 → 24/6/26 r1400 |
| `guardian` | 9000 | 1700 | 20 | 90 t | 540 | elite-escort | `frost-guard` 34/8/40, r1500, field 60 t |
| `ranged` | 2800 | 2000 | 20 | 120 t | 320 | resource-denial | `void-volley` 40/4/44, lead r1100, range 6000 |

Bosses escalate step count, not just numbers: `cinder-warden-cycle` 2 steps (max r3200),
`veil-tactician-cycle` 2 steps (ring r3000 + lead r2400), `gate-sovereign-cycle` 3 steps ending on
`null-collapse` 70/10/60, lead r4200, field 240 t — the widest contact in the game.

`AI_RESPONSE_PATTERNS` is the other half of the difficulty unit: `evade` (45 t window, +35 % speed,
25 % rim clearance), `spread` (≥ 2 bodies, 60 t, 60 % separation), `punish` (60 t, allied cooldowns
×0.70), `brace` (30 t, incoming ×0.65). A telegraph is a decision only because these exist.

## 6. Diversification axes that exist in code today

| Axis | Where | Range shipped |
|---|---|---|
| Behaviour | `ENEMY_POLICIES` (6) + the seeded pool in `buildWaveSchedule()` | rusher 3 / flanker 2 / guardian 2 / ranged 2 policy choices |
| Rule package | `ABYSS_DEPTH_PACKAGES` 1–3 (`ABYSS_DEPTH_MAX = 3`) | pins the normal-wave policy mix, elite policy, +1/+2 escorts, affix aura, recovery cap 0.25/0.12/0.20, reward tier |
| Space | `STAGE_TACTICS` chokepath / flank / elevation / hazard | halfWidth 1300–2200, hazard 8–16 dps, elevation ×1.08–1.13 |
| Objective | `STAGE_ENCOUNTER_ROUTES.objectives` | corridor→arena, 4–6 slots each, retry `maxAttempts: 3`, recovery 180–300 t |
| Density | concurrency / interval / commitment | normal 8/9/10 bodies, big 22/24/26; interval 18/24/15 → big 5/6/4; commitment 3–4 → 7–8 |
| Seeded variation | `STAGE_TACTICS.seededVariation` | timing jitter ±12/27/18 t, density ±1, lane ±300/660/420 |
| Surprise | `CINDER_SPAN_SURPRISE_TABLE` | 25 % chance, 2 outcomes, stage 1 only |

Depth packages are the repository's answer to "modifier / weekly ruleset": depth 0 is identity, and
each depth is a *named rule change* (behaviour + escorts + recovery cap + reward tier), not a stat
multiplier. `buildWaveSchedule()` reads the RNG without advancing it when a package pins a policy,
so enabling a depth does not shift the downstream stream.

## 7. The monotony ratchet (new, 2026-07-31)

`scripts/scan-stage-variation.mjs` compares every stage pair across **20 authored axes**
(rhythm, wave count, cadence, hold, gate integrity, class rotation, mid-boss, lane, spawn
directions, normal/big concurrency, interval pair, commitment pair, objective shape, seeded
variation, hazard dps, occupation hold, extraction window, elevation multiplier, elite kind) and
computes the response-type set per stage. `tests/stage-variation-doctrine.test.mjs` enforces:

- `sharedRatio ≤ 0.20` for every pair (4 of 20 axes; the worst shipped pair is 3/20 = 0.15);
- wave-kind rhythm, mid-boss class and class rotation are **stage-unique**;
- HP scale strictly climbs **and** response types never fall, with the last stage strictly above the
  first;
- the final stage fields every class the earlier stages taught;
- every mid-boss wave uses its stage's authored mid-boss class, and only a `mid` wave carries one.

Measured after the `echo-throne` retune: worst pair 3/20 = 0.15 (`abyss-chancel` vs `echo-throne`,
sharing `spawnDirections`, `commitmentCapPair`, `extractionWindowTicks`), response types 16 → 17 → 17,
scan `pass: true`, suite 6/6.

A mid-boss class deliberately *may* sit outside its stage's rotation — `cinder-span` rotates
rusher/flanker/ranged and walls on a `guardian` precisely because that body is an answer the stage
never otherwise asks for.

## 8. Where the numbers are decided

| Instrument | What it decides | Threshold |
|---|---|---|
| `scripts/run-defense-balance-sim.mjs --strict` | every stage × seed {1, 17, 991} reaches a terminal outcome twice with an identical `getRunDigest()` | 0 failures; 24 000-tick runaway guard |
| `scripts/measure-stage-playtime.mjs` | stage length under an objective-seeking bot | 180–360 s |
| `scripts/run-stage1b-symmetric-trials.mjs` | 5 archetypes × ordered/reverse pairs × seeds 401–405 | 100 rows, equal `valueBudgetFingerprint` |
| `scripts/run-stage1b-pressure-packets.mjs` | 15 runs (3 stances × 5 seeds), 3 pressure packets each | retained raw events |
| `scripts/export-stage1b-formation-attribution.mjs` | ≥ 50 rally→TURRET transitions + ≥ 50 VANGUARD and ≥ 50 SPLIT controls | recomputable from raw events |
| `scripts/evaluate-stage1b-gates.mjs` | the gate verdict | §9 |
| `scripts/scan-stage-variation.mjs --strict` | monotony / escalation | §7 |

## 9. Gate thresholds, verbatim from the evaluator

| Gate | Threshold |
|---|---|
| G2 | each archetype **9–11 explicit wins / 20** canonical symmetric pairs (ties are not wins); 15 pressure rows each `gateMinPct` **55.0–80.0 %**, **0–3 defeats**, boss TTK `MEASURED` and **5.95–8.05 s** |
| G3 | `BOSS_RALLY_COOLDOWN_REDUCTION = 0`, exactly one TURRET FRONT, **0** zero-damage post-switch conversions, ≥ 1 control `COMPANION_DOWNED`, control defeat rate ≤ **0.20**, legal-combo `maxEV/medianEV ≤ 1.30` |
| G5 | `N_A` — no monetization surface exists |
| G6 | every full-app tier and the 30-minute soak: frame p95 ≤ **16.7 ms**, long-frame ratio < **0.005**, input p95 ≤ **100 ms**, DOM < **5000**, stable heap; four device tiers; isolated measurement or `BLOCKED_PENDING_ISOLATED_MEASUREMENT` |
| G7 | ≥ **14/20** voluntary re-entries, 10 participants × 2 decisions, every circuit **30–180 s**, ≥ 3 unique canonical player actions and ≥ 1 `ELITE_EXTRACTED` |
| G8 | 5 sourced titles with direct-feature count ≤ **2/5**, and 10 first-exposure scores with median ≥ **4.0/5** |

Readiness artifacts gate the gates: the pressure sample must be exactly 15 runs (3 stances × seeds
401–405) with 3 packets each, and persistence exactly 3 scenarios (`victory`,
`defeat-after-acceptance`, `defeat-before-acceptance`). Anything incomplete is `BLOCKED`, never
`FAIL` — the evaluator refuses to score evidence it cannot recompute.

## 10. The ten-step pipeline (prompts `20`–`29`)

1. `20` encounter brief — objectives, archetypes, pressure sources, reward cadence, in language.
2. `21` behaviour policy — which policy/pattern each archetype answers with, before any number.
3. `22` difficulty budget — the clear-budget arithmetic and the response-type delta.
4. `23` doctrine write — the catalog edit, and only the catalog.
5. `24` variation package — the axis that changes, or the depth package that changes the rules.
6. `25` balance simulation — determinism, terminal outcomes, playtime.
7. `26` gate evaluation — the stage-1b evidence chain and the verdict JSON.
8. `27` monotony scan — the ratchet, plus the duplicate-shape review across stages.
9. `28` regression proof — the suite list and the recorded baseline.
10. `29` balance changelog and release.

## 11. Known gaps

- **Wave HP is proven, wave *pressure* is not.** The budget bounds total HP per wave; nothing bounds
  simultaneous telegraph area, so a composition can be inside budget and still unreadable. The
  concurrency ceilings (22/24/26) are the only proxy, and they are capped by draw calls, not design.
- **The idle-bot balance sim is not a difficulty verdict.** `run-defense-balance-sim.mjs` holds
  `MOVE_IDLE`; on 2026-07-31 it produced `abyss-chancel` DEFEAT on all three seeds and `cinder-span`
  DEFEAT on seed 17 — identical before and after the retune. It proves determinism and termination,
  not clearability. Only `measure-stage-playtime.mjs` (objective-seeking bot) speaks to that.
- **G7/G8 need humans.** Ten participants, screen recordings, observer signatures. No synthetic
  artifact may claim them; the evaluator checks `synthetic_controller === false`.
- **Depth packages are unmeasured.** `ABYSS_DEPTH_PACKAGES` 1–3 change behaviour, escorts and the
  recovery cap, but no script measures a run at depth > 0 and no suite asserts a depth's difficulty
  delta. Novelty is authored, not yet proven.
- **The response-type metric counts identifiers, not skill.** It cannot tell a genuinely new answer
  from a renamed one; it is a floor against repetition, not a ceiling on quality.
