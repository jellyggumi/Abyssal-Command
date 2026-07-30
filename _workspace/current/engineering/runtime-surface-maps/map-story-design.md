# Map-Story Design Reference — Abyssal Lantern Stage Catalog

**Document purpose:** Complete narrative, objective, and numeric reference for new stage layout authoring.
Dialogue is verbatim from `stage-story-catalog.js`. Numeric contracts quoted with source.

---

## Stage Catalog Inventory

### Stage 1: Cinder Span (`cinder-span`)
**Quest ID:** `cinder-span:unchain-the-descent`  
**Giver NPC:** `cinder-span:ember-lookout`  
**Title:** "사슬 아래의 길" (The Path Beneath the Chains)

**Objectives (in order):**
1. `cross-ember-relay` — "불씨 중계로를 사수하라" (Hold the ember relay)  
   Event: `ENCOUNTER_OBJECTIVE_COMPLETED` with `objectiveId: "cinder-relay-crossing"`

2. `hold-drowned-forge` — "잠긴 용광로의 압력을 끊어라" (Break the locked forge pressure)  
   Event: `ENCOUNTER_OBJECTIVE_COMPLETED` with `objectiveId: "cinder-forge-stand"`

3. `reverse-cinder-seal` — "재의 봉인을 역전하라" (Reverse the ash seal)  
   Event: `OCCUPATION_CAPTURED` with `occupationPointId: "cinder-seal"`

4. `release-the-chains` — "Cinder Warden을 쓰러뜨려 사슬의 진실을 밝혀라"  
   Event: `OBJECTIVE_COMPLETED` with `objectiveId: "boss-kill"`

**Story Beats (with dialogue):**

| Beat ID | Kind | Event | Dialogue |
|---------|------|-------|----------|
| `cinder-span:acquisition` | questAcquisition | `STAGE_STARTED` | **EMBER LOOKOUT:** "서쪽 불씨를 버티고 사슬의 진실을 확인하세요." |
| `cinder-span:reversal` | occupationReversal | `OCCUPATION_CAPTURED` | **CINDER WARDEN:** "봉인을 풀면 길이 열리는 게 아니다. 네 뒤의 다리가 먼저 무너진다." |
| `cinder-span:boss-entry` | bossEntry | `BOSS_SPAWNED` | **CINDER WARDEN:** "등불을 내려라. 네가 찾는 길은 내 사슬 아래서 끝난다." |
| `cinder-span:completion` | questCompletion | `OBJECTIVE_COMPLETED` | **DUSK WARDEN:** "그는 문을 지킨 게 아니었다. 문이 올라오지 못하게 묶고 있었다." |

**Extracted companion:** `ember-cohort` (from `s1-ember-hunter`, rusher elite)  
**Stage item surface:** `ashen-sigil`  
**Appearance reward:** `cinder-span-ember-chain` (back slot)  
**Boss:** `s1-cinder-warden` / Cinder Warden

---

### Stage 2: Abyss Chancel (`abyss-chancel`)
**Quest ID:** `abyss-chancel:refuse-repeated-answer`  
**Giver NPC:** `abyss-chancel:veil-lookout`  
**Title:** "반복되는 답을 거부하라" (Refuse the Repeated Answer)

**Objectives (in order):**
1. `advance-the-nave` — "거울보다 먼저 본당을 돌파하라" (Break the nave before the mirror)  
   Event: `ENCOUNTER_OBJECTIVE_COMPLETED` with `objectiveId: "chancel-nave-advance"`

2. `lock-the-transept` — "교차 회랑의 세 갈래 압력을 끊어라" (Cut the three-way transept pressure)  
   Event: `ENCOUNTER_OBJECTIVE_COMPLETED` with `objectiveId: "chancel-transept-lock"`

3. `refuse-the-oath` — "거울의 답을 따르지 않고 서약을 점령하라" (Occupy the oath without following the mirror)  
   Event: `OCCUPATION_CAPTURED` with `occupationPointId: "chancel-oath"`

4. `shatter-classification` — "Veil Tactician의 분류를 끝내라" (End the Tactician's classification)  
   Event: `OBJECTIVE_COMPLETED` with `objectiveId: "boss-kill"`

**Story Beats (with dialogue):**

| Beat ID | Kind | Event | Dialogue |
|---------|------|-------|----------|
| `abyss-chancel:acquisition` | questAcquisition | `STAGE_STARTED` | **VEIL LOOKOUT:** "거울이 먼저 내놓은 답을 거부하세요." |
| `abyss-chancel:reversal` | occupationReversal | `OCCUPATION_CAPTURED` | **VEIL TACTICIAN:** "그렇다면 왕좌도 너를 분류하지 못하겠군." |
| `abyss-chancel:boss-entry` | bossEntry | `BOSS_SPAWNED` | **VEIL TACTICIAN:** "또 같은 등불, 또 같은 서약." |
| `abyss-chancel:completion` | questCompletion | `OBJECTIVE_COMPLETED` | **VEIL TACTICIAN:** "거울이 깨져도, 왕좌가 사라지는 것은 아니다." |

**Extracted companion:** `rift-lens` (from `s2-veil-sentinel`, flanker elite)  
**Stage item surface:** `ward-splinter`  
**Appearance reward:** `abyss-chancel-ward` (ward slot)  
**Boss:** `s2-veil-tactician` / Veil Tactician

---

### Stage 3: Echo Throne (`echo-throne`)
**Quest ID:** `echo-throne:break-the-command`  
**Giver NPC:** `echo-throne:throne-lookout`  
**Title:** "왕좌의 명령을 끊어라" (Break the Throne's Command)

**Objectives (in order):**
1. `break-the-aisle` — "되돌아오는 왕좌 회랑을 돌파하라" (Break the returning throne aisle)  
   Event: `ENCOUNTER_OBJECTIVE_COMPLETED` with `objectiveId: "throne-aisle-break"`

2. `stand-at-the-dais` — "왕좌를 소유하지 않고 단상을 지켜라" (Hold the dais without owning the throne)  
   Event: `ENCOUNTER_OBJECTIVE_COMPLETED` with `objectiveId: "throne-dais-stand"`

3. `claim-the-domain` — "왕좌 영역의 명령을 역전하라" (Reverse the throne domain's command)  
   Event: `OCCUPATION_CAPTURED` with `occupationPointId: "throne-domain"`

4. `break-the-sovereign-command` — "Gate Sovereign의 마지막 명령을 끊어라" (Break the Gate Sovereign's final command)  
   Event: `OBJECTIVE_COMPLETED` with `objectiveId: "boss-kill"`

**Story Beats (with dialogue):**

| Beat ID | Kind | Event | Dialogue |
|---------|------|-------|----------|
| `echo-throne:acquisition` | questAcquisition | `STAGE_STARTED` | **THRONE LOOKOUT:** "빈 왕좌보다 오래 남은 명령을 끊으세요." |
| `echo-throne:reversal` | occupationReversal | `OCCUPATION_CAPTURED` | **GATE SOVEREIGN:** "단상을 차지해도 왕좌의 명령은 너에게 돌아온다." |
| `echo-throne:boss-entry` | bossEntry | `BOSS_SPAWNED` | **GATE SOVEREIGN:** "마침내 내가 놓았던 등불을 네가 들고 왔다." |
| `echo-throne:completion` | questCompletion | `OBJECTIVE_COMPLETED` | **DUSK WARDEN:** "왕좌는 비었다. 그런데 명령은 내 등불 안에서 계속된다." |

**Extracted companion:** `throne-echo` (from `s3-throne-wraith`, ranged elite)  
**Stage item surface:** `echo-compass`  
**Appearance reward:** `echo-throne-crown` (head slot)  
**Boss:** `s3-gate-sovereign` / Gate Sovereign

---

## Three-Stage Narrative Arc

### Dramatic Function per Stage

**Stage 1 (Cinder Span):** Spatial reveal — the chains are structural, not punitive. Player learns the Cinder Warden was holding the bridge together. Defeating him destroys the retreat, forcing descent into the abyss.

**Stage 2 (Abyss Chancel):** Identity reveal — the mirrors record earlier lantern bearers; the Veil Tactician has been waiting for one bearer to refuse the repeated answer. Player recognizes the lantern lineage and proves they can break pattern.

**Stage 3 (Echo Throne):** Purpose reveal — the Gate Sovereign is not the throne's owner but its last consumed bearer. Breaking his command leaves the throne empty while the command echoes inside the Dusk Warden's lantern.

---

## Authoritative Design Contracts

### Master Numeric Contract (`master-numeric-contract.md`)

**Stage timing (target 5–8 min, baseline 6 min = 360 s = 21600 tick):**

| Key | Value | Source |
|-----|-------|--------|
| `STAGE_TARGET_TICKS` | 21600 (360 s) | Central target |
| `STAGE_BAND_TICKS` | [18000, 28800] (300–480 s) | Playable range |
| `STAGE_HARD_CEILING_TICKS` | 32400 (540 s) | Forced conclusion |

**Stage phases (tick budget, not hard limit for boss phases):**

| Phase | Budget (ticks) | Type | Example |
|-------|---|---|---|
| `DESCENT` | 1800 (30 s) | Time-capped | Spawn cap 8, first contact |
| `SKIRMISH` | 4500 (75 s) | Time-capped | Spawn cap 18, first growth |
| `SURGE` | 4500 (75 s) | Time-capped | Spawn cap 34, AoE necessity |
| `MIDBOSS` | 3600 (60 s expected) | Kill-only | Spawn cap 12 + midboss 1 |
| `BIGWAVE` | 3600 (60 s expected) | Time-capped | Spawn cap 60, max density |
| `FINALE` | 3600 (60 s expected) | Kill-only | Spawn cap 8 + boss 1 |

**Player combat (cancel-compressed DPS):**

| Verb | Startup | Active | Recovery | Total tick | Cancellation rule |
|------|---------|--------|----------|------------|-------------------|
| `LIGHT_1` | 8 | 3 | 8 | 19 | active end → LIGHT_2/DASH/SKILL |
| `LIGHT_2` | 9 | 3 | 9 | 21 | active end → LIGHT_3/DASH/SKILL |
| `LIGHT_3` (finisher) | 12 | 5 | 20 | 37 | recovery tick 10+ → DASH only |
| `HEAVY` | 14 | 6 | 22 | 42 | startup → DASH possible |
| `DASH` | 2 | 10 (iframe) | 6 | 18 | recovery → LIGHT_1 possible |

**Power growth:**

| Currency | Tier | Sources | Values |
|----------|------|---------|--------|
| Echo Shard | Runtime | Wave complete, midboss, boss | 8 per stage (0/1/1/2/1/3) |
| Warden Level | Account | Stage clear XP (40% if defeat) | Levels 1–60, stats cap 19/stat |
| Echo Core | Account | Elite capture + stage resolve | Existing 40-point budget |

---

### Encounter Wave Spec (`encounter-wave-spec.md`)

**Three-stage canonical route:**
```
cinder-span → abyss-chancel → echo-throne
```

**Each stage objective order (immutable):**
```
gate-defense → echo-recovery → growth → occupation → boss-kill → extraction
```

**Stage-specific wave architecture:**

| Stage | Route ID | Wave slots | Doctrine | Concurrent cap | Spawn interval |
|-------|----------|------------|----------|---|---|
| Cinder Span | `cinder-span:critical-route` | 10 total (0–4 relay, 5–9 forge) | `rusher/flanker/ranged` W/SW | 8 | 18 ticks |
| Abyss Chancel | `abyss-chancel:critical-route` | 10 total (0–3 nave, 4–9 transept) | `rusher/flanker/ranged` W/SW/NW | 9 | 24 ticks |
| Echo Throne | `echo-throne:critical-route` | 11 total (0–5 aisle, 6–10 dais) | `flanker/ranged/guardian` W/SW/NW | 10 | 15 ticks |

**Intermediate recovery (dedup, once per clear):**

| Objective | Recovery ticks | Commander floor | Gate floor |
|-----------|---|---|---|
| `cinder-relay-crossing` | 180 | 35% | 30% |
| `cinder-forge-stand` | 210 | 40% | 35% |
| `chancel-nave-advance` | 240 | 40% | 35% |
| `chancel-transept-lock` | 270 | 45% | 40% |
| `throne-aisle-break` | 210 | 45% | 40% |
| `throne-dais-stand` | 300 | 50% | 45% |

---

### PCG Stage Layout (`pcg-stage-layout-spec.md`)

**Grid contract:**
- **Arena:** 24000 × 12000
- **Cell grid:** 3 columns × 2 rows = 6 cells
- **Cell dimensions:** 8000 × 6000 each
- **Cell types:** 3 arenas + 2 transit + 1 boss (fixed allocation)
- **Spawn constraint:** Spawn cell must be edge cell (A/C/D/F), never center (B/E)
- **Boss placement:** Diagonally opposite spawn cell; distance = 17088, time = 4.17 s

**Layer separation (5 independent layers):**
1. Authored cell data (type, module ID, anchor ID, seed)
2. Visual geometry & non-walkable decor (mesh, material)
3. Collision (flat polygons, elevation 0 only)
4. Navigation (walkable region, clearance)
5. Encounter zones (spawn, objective, pickup, extraction, reset anchors)

**Module palette per cell type:**

| Cell | Arena modules | Transit modules | Boss modules |
|------|---|---|---|
| Count | 8 (3 per cell) | 6 (2 per cell) | 4 (1 per cell) |
| Cover | ✓ | ✓ | — |
| Funnel | ✓ | — | — |
| Landmark | ✓ | ✓ | ✓ |
| Hazard | ✓ | — | — |
| Sightline-break | ✓ | — | — (forbidden in boss cell) |

**Determinism:**
- Stage seed: `fnv1a32(${stageId}|${campaignSeed}|${sortieIndex})`
- PRNG: mulberry32 (no Math.random)
- Generation: once at run start, never re-generated on render pause/quality tier change
- Validation: 8 retries with seed increment; fallback to authored layout if generation fails

---

### HUD Information Architecture (`hud-information-architecture.md`)

**Priority tiers (affect placement):**

| Tier | Cognition time | Examples | Location |
|------|---|---|---|
| Immediate | <100 ms (peripheral) | Telegraph hazard, commander position, dash charge | **World space** |
| Immediate | <100 ms | Commander integrity | Character foot ring |
| Glance | <300 ms | Skill cooldown, combo stage, boss HP/phase | Screen edge |
| Glance | <300 ms | Wave warning, phase progress | Top thin bar |

**Combat HUD budget (during `BIGWAVE`):**

| Metric | Limit | Rationale |
|--------|-------|-----------|
| Simultaneous HUD elements | 9 | Move×1 + verbs×3 + skills×4 + boss bar×1 |
| On-screen text characters | 12 | Cooldown nums 4×2 + phase name 4 |
| HUD screen coverage | ≤18% | 82% reserved for battlefield |
| Simultaneous animated elements | 3 | Cooldown sweep only |
| HUD color count | 5 | Camera-vfx-direction palette subset |
| Font sizes | 3 | Numerals, labels, card titles |

**Skill button layout (390×844 / vertical):**
- `LIGHT` (72 px) at (79%, 88%) — largest, most frequent
- `HEAVY` (56 px) at (64%, 90%)
- `DASH` (60 px) at (89%, 77%)
- Skill 1–4 (52 px each) in counter-clockwise arc, upper right
- Skill 5–6 behind toggle if needed (expand only at 3 s idle)

---

## Accessibility & Reduced Motion

**From `abyssal-lantern-world-synopsis.md#6.1`:**

- Stage VFX use `core-static` reduced-motion policy: keep core/readable ring, hide drift/motes
- Boss-entry orbit → static three-frame crossfade (never remove boss silhouette/telegraph)
- Dialogue lines receive Korean text alternatives and speaker labels (not baked into combat VFX)
- Sound never carries unique objective info; UI label, icon, route marker, event state available without audio
- Final hook still reads in one static frame: empty dais, Dusk Warden, persistent inner ring

---

## Narrative Presentation Surfaces (Event Bindings)

**Simulation events consumed by narrative presentation:**

| Story function | Existing event surface | Payload required |
|---|---|---|
| Stage approach | `STAGE_STARTED` (stageId, mapPlanId, wavePlanId, m4PlanId) | Stage ID for routing |
| Wave pressure | `WAVE_VARIANT_STARTED`, `ENEMY_SPAWNED` | Wave index, direction, composition |
| Intermediate gate clear | `WAVE_CLEARED`, `ENCOUNTER_OBJECTIVE_COMPLETED` | Objective ID |
| Echo recovery opportunity | `ELITE_CANDIDATE_AVAILABLE` | Elite state |
| Growth decision | `GROWTH_OFFER`, `SKILL_SELECTED`, `SKILL_CAST` | Skill ID, level |
| Gate occupation | `OCCUPATION_PROGRESS`, `OCCUPATION_CAPTURED` | Occupation point ID |
| Binding phase | `EXTRACTION_WINDOW_OPENED`, `EXTRACTION_PROGRESS`, `ELITE_EXTRACTED` | Extraction point ID |
| Recovery lane | `M4_RECOVERY_CHECKPOINT` or `M4_FALLBACK` | Safe lane ID |
| Boss confrontation | `BOSS_SPAWNED`, `BOSS_ATTACK_TELEGRAPHED` | Boss ID, pattern |
| Stage turn (victory) | `OBJECTIVE_COMPLETED` (objectiveId: boss-kill), then `TERMINAL` | Outcome: VICTORY |
| Campaign ending | `TERMINAL` (outcome: FINAL_COMPLETION) | Final outcome |

---

## Item/Loot/Buff Status

**No dedicated item-drop/buff/stat-modifier spec found.** 

Existing surfaces:
- **Stage items (collected via `ITEM_COLLECTED`):**
  - Cinder Span: `ashen-sigil`
  - Abyss Chancel: `ward-splinter`
  - Echo Throne: `echo-compass`

- **Skill extraction (via `ELITE_EXTRACTED`):** Companion records (`ember-cohort`, `rift-lens`, `throne-echo`) become allied squad members

- **Appearance items (automatic on boss kill):** Slot-based wearables (back, ward, head)

- **Permanent growth:** Echo Shard (skill upgrade) and Warden Level (stat points 1–19 per stat)

**Item drops during waves:** Not yet authored. Placeholder: simulation may emit pickup events; presentation must show world-space collectible visuals keyed to event.

---

## Extension Points for New Stage Layouts

1. **World routes:** Author new cell seeds and module placements via `stage-world-catalog.js#gameplay.routes`
2. **Encounter objectives:** Register new objective IDs and wave slots via `defense-catalog.js#STAGE_ENCOUNTER_ROUTES`
3. **Dialogue lines:** Extend `stage-story-catalog.js` with new beat definitions, binding to same event surfaces
4. **Recovery/extraction points:** Use existing occupation/extraction point patterns (no new objective type needed)
5. **VFX ambience:** Leverage stage-specific cue IDs (`cinder-span-ember-wake`, `abyss-chancel-mirror-static`, `echo-throne-fracture-echo`)
6. **Boss behavior:** Integrate new boss IDs via `defense-catalog.js#STAGE_TACTICS`

**Invariant:** No new gameplay phase, no quest state machine, no dialogue branching. Presentation observes existing simulation events read-only.

