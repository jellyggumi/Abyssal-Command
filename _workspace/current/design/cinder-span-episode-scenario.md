# Cinder Span Episode Scenario
## 심연의 등불 — Stage 1: Cinder Span (거대한 재의 다리)

```yaml
run_id: 20260730-cinder-span-webtoon-episode
status: "[TARGET] — Implementation-ready stage scenario"
scope: Cinder Span stage episode narrative, dialogue, event map, reward structure
authority: defense-catalog.js, stage-world-catalog.js, abyssal-lantern-world-synopsis.md
contract_version: defense-survivor-v1
```

---

## 1. Stage & NPC Identity

| Field | Value | Authority |
|---|---|---|
| **Stage ID** | `cinder-span` | `STAGES[0].id` |
| **Display Name** | Cinder Span / 거대한 재의 다리 | `STAGE_PRESENTATION_BY_ID["cinder-span"].label` |
| **Boss** | `s1-cinder-warden` / Cinder Warden | `STAGE_BY_ID["cinder-span"].boss` |
| **Elite Enemy** | `s1-ember-hunter` / Ember Hunter (rusher) | `STAGE_BY_ID["cinder-span"].eliteId` |
| **Extracted Companion** | `ember-cohort` / Ember Cohort | `STAGE_BY_ID["cinder-span"].eliteCompanion` |
| **NPC Quest-Giver** | Keeper of the Ash Gate / 재의 문지기 | Stage role; authored in `stage-world-catalog.js#gameplay.npcs` |
| **Stage Item** | `ashen-sigil` / Ashen Sigil | `STAGE_ITEM_IDS["cinder-span"]` |

---

## 2. Episode Hook & Opening

**Scenario:** The Dusk Warden enters the Cinder Span below the Drowned Forge Arch. The bridge reads as a prison gate—chains everywhere, blockades at every waypoint. But the Keeper of the Ash Gate reveals the truth: the chains are structural. The Cinder Warden is not a jailer; he is the bridge itself, slowly failing.

**Event trigger:** `STAGE_STARTED` with `stageId: "cinder-span"`

**Opening Korean Beat (NPC):**
> **재의 문지기 (Keeper of the Ash Gate):** "저 사슬이 보이는가? 그것은 감옥이 아니었다. 그것은 버팀목이었다."

**English ID:** `cinder-npc-intro-01` | **Duration:** Accessible text only (no live combat relay)

---

## 3. Ordered Objectives & Progression

### Objective 1: Gate-Defense / Relay Crossing
| Attribute | Value | Authority |
|---|---|---|
| **Objective ID** | `cinder-relay-crossing` | `STAGE_ENCOUNTER_ROUTES["cinder-span"].objectives[0].id` |
| **Type** | Corridor (wave slots 0–4) | `objectiveDefinition(..., "corridor")` |
| **Location** | `cinder-span:critical-route` via relay toward bridge center | `stage-world-catalog.js#gameplay.routes` |
| **Wave Count** | 5 waves (slots 0–4) | doctrine-authored |
| **Commitment Cap** | 3 enemies | `STAGE_ENCOUNTER_ROUTES["cinder-span"].commitmentCap` |
| **Max Concurrent** | 8 enemies | `STAGE_ENCOUNTER_ROUTES["cinder-span"].maxConcurrentEnemies` |
| **Spawn Interval** | 18 ticks | `STAGE_ENCOUNTER_ROUTES["cinder-span"].spawnIntervalTicks` |
| **Contest Ticks** | 60 ticks | `objectiveDefinition(..., 60)` |
| **Completion Recovery** | Commander +9%, Gate +6% | `STAGE_PLAN_DESCRIPTORS["cinder-span"].recovery[0]` |
| **Max Retry Attempts** | 3 | deterministic retry budget |

**Routed Wave Directions:** W (West) → SW (Southwest)
**Wave Classes:** `rusher`, `flanker`, `ranged` (doctrine-rotated)

**Korean Beat (Mid-Objective):**
> **Dusk Warden (inner monologue):** "첫 번째 관문. 재가 소용돌이친다. 하지만 다리는 아직 버티고 있다."

**English ID:** `cinder-objective-relay-active` | **Event:** `ENCOUNTER_OBJECTIVE_STARTED` with `objectiveId: "cinder-relay-crossing"`

---
### Objective 2: Arena Challenge / Forge Stand
| Attribute | Value | Authority |
|---|---|---|
| **Objective ID** | `cinder-forge-stand` | `STAGE_ENCOUNTER_ROUTES["cinder-span"].objectives[1].id` |
| **Type** | Arena (wave slots 5–9) | `objectiveDefinition(..., "arena")` |
| **Location** | `cinder-span:critical-route` at forge blockade | `stage-world-catalog.js#gameplay.routes` |
| **Wave Count** | 5 waves (slots 5–9) | doctrine-authored |
| **Commitment Cap** | 3 enemies | shared stage cap |
| **Max Concurrent** | 8 enemies | shared stage cap |
| **Spawn Interval** | 18 ticks | shared stage interval |
| **Contest Ticks** | 75 ticks (longer hold) | `objectiveDefinition(..., 75)` |
| **Completion Recovery** | Commander +11%, Gate +7% | `STAGE_PLAN_DESCRIPTORS["cinder-span"].recovery[1]` |
| **Wave Slot 7 Special** | Mid-boss (`cinder-span-midboss-7`, guardian-based) | doctrine wave-cycle rule |

**Korean Beat (Forge Stand):**
> **Cinder Warden (distant, first communication):** "더 깊이 내려올 생각인가? 그 아래는 더 무겁다."

**English ID:** `cinder-warden-warning-01` | **Event:** `MIDBOSS_SPAWNED` or `WAVE_VARIANT_STARTED` (wave slot 7)

---

### Objective 3: Occupation / Seal Hold (Mid-Stage Reversal)
| Attribute | Value |
|---|---|
| **Objective ID** | `occupation` at `cinder-seal` waypoint |
| **Event Trigger** | `OCCUPATION_PROGRESS` after both gates complete |
| **Completion Trigger** | `OCCUPATION_CAPTURED` at `cinder-seal` |
| **Narrative Function** | **THE REVERSAL**: The seal is not a lock; it is a load-bearing brace. Capturing it proves the bridge can hold. |

**Korean Beat (Reversal Moment):**
> **Dusk Warden:** "이것이... 문을 잠근 것인가, 아니면 문이 올라오지 못하게 붙잡은 것인가?"
> **Cinder Warden (stronger, revealing):** "내가 쓰러지면, 네 뒤가 먼저 무너진다."

**English IDs:** `cinder-seal-hold`, `cinder-warden-reveal-01` | **Events:** `OCCUPATION_PROGRESS`, `OCCUPATION_CAPTURED`

---

### Objective 4: Final Objective / Boss Kill

## 4. Rewards & Progression

### Stage Item (Collectible)
| Field | Value |
|---|---|
| **Item ID** | `ashen-sigil` |
| **Display Name** | Ashen Sigil / 재의 인장 |
| **Collection Event** | `ITEM_COLLECTED` (auto-triggered on stage clear) |
| **Effect** | Basic attack damage +180 (permanent bonus) |
| **Model Path** | `assets/mesh/item/ashen-sigil.glb` (placeholder) |

**Japanese/Korean Labels:** Use `STAGE_ITEM_IDS["cinder-span"]` value in UI layer.

---

### Extraction & Companion Unlock
| Field | Value |
|---|---|
| **Companion ID** | `ember-cohort` |
| **Display Name** | Ember Cohort / 재의 분대 |
| **Extraction Trigger** | `ELITE_EXTRACTED` event after extraction window |
| **Stats (Base Tier)** | Damage 420, Fire-damage ticks 36, Range 4,600 wu |
| **Appearance** | Fire-touched rusher silhouette with chain-scar visual |
| **Model Path** | `assets/mesh/companion/ember-cohort.glb` |
| **Animation Clips** | Idle, run-forward, attack-melee, death |

**Wearable Item (Cosmetic):**
- **ID:** `ember-sigil-bracers` (example; confirm in catalog)
- **Display Name:** Ember Sigil Bracers / 재의 팔찌
- **Unlock Condition:** Extracted `ember-cohort` first appearance
- **Equip Slot:** `accessory1` (hands/wrist region)
- **Model Path:** `assets/mesh/cosmetic/ember-sigil-bracers.glb`
- **Effect on Companion:** Fire-damage +15% (cosmetic stat boost; visual only)

---

### Reward Selection (Campaign Carry-Over)
| Reward ID | Display Name | Type | Carry-Over Effect | Authority |
|---|---|---|---|---|
| `ember-cohort-legacy` | Ember Cohort Legacy | Companion record | `ember-cohort` spawns in next stage if selected | `STAGE_REWARD_IDS["cinder-span"][0]` |
| `stillwater-hourglass` | Stillwater Hourglass | Passive item | Skill cooldown −10% for next stage | `STAGE_REWARD_IDS["cinder-span"][1]` |
| `bulwark-brand` | Bulwark Brand | Defense item | Gate integrity +100 hp for next stage | `STAGE_REWARD_IDS["cinder-span"][2]` |

**Selection Mechanism:** `GROWTH_OFFER` event after extraction window. Player chooses one via UI; `SKILL_SELECTED` (or equivalent reward-select event) confirms choice. Reward applies to `CARRY_OVER_MAX_ITEMS` (3 total per campaign).

---

## 5. Motion, VFX, & Audio Cue Map

### Stage VFX Identity
| Cue ID | Visual Effect | Trigger Event | Stage Context |
|---|---|---|---|
| `cinder-span-ember-wake` | Ember wake core + seal ring, intact lantern silhouette with ash decor | `STAGE_STARTED` | Ambient throughout stage; core remains readable |
| `cinder-relay-crossing-warn` | Routed wave direction indicator (W or SW) | `WAVE_VARIANT_STARTED` with matching direction | Never marks a false lane; stays behind telegraphs |
| `cinder-forge-stand-warn` | Forge arena emphasis glow | `WAVE_VARIANT_STARTED` for arena waves (slots 5–9) | Bounds the arena without occluding threats |
| `cinder-seal-capture` | Seal ring closes; extraction core rises on progress | `OCCUPATION_PROGRESS` → `OCCUPATION_CAPTURED` → `EXTRACTION_*` | Holds seal and binding point in one frame |
| `cinder-boss-reveal` | Intact lantern core sheds outer ember wake; core remains | `BOSS_SPAWNED` | Aftermath settles on released chains |

**Reduced-Motion Policy:** `core-static` mode keeps core and readable ring; hide drift, motes, parallax. Never remove silhouette or telegraph.

---

### Audio Cue Chain (Event-Driven)

| Event | Cue ID | Cue Profile | Priority | Audio Intent |
|---|---|---|---|---|
| `STAGE_STARTED` | `stage-start` | Opening descent | 80 | Dry ash ambience; one distant chain drag may color soundscape |
| `WAVE_VARIANT_STARTED` | `active-wave` | Combat pulse | 64 | Cycle on big/normal wave; existing weapon/impact textures only |
| `MIDBOSS_SPAWNED` | `warning-pulse` | Threat alert | 82 | Mid-boss entry signal; no dual cue (no "echo") |
| `OCCUPATION_CAPTURED` | `occupation-captured` | State achievement | 68 | Seal hold confirmation |
| `EXTRACTION_READY` | `extraction-ready` | Binding ready | 70 | Binding point opens for channeling |
| `ELITE_EXTRACTED` | `elite-extracted` | Companion arrival | 72 | New ally joins; distinct from combat |
| `BOSS_SPAWNED` | `boss-spawned` | Boss presence | 90 | Cinder Warden entry; maintains threat hierarchy |
| `TERMINAL` with victory | `terminal:FINAL_COMPLETION` or `terminal:STAGE_COMPLETE` | Victory ascent | 100 | Rising cue profile; chain release as foley (not gameplay signal) |

**Audio Authority:** `defense-audio.js#EVENT_CUE_IDS`, `#AUDIO_CUES`, `#CUE_PROFILES`

**Accessibility:** Sound never carries unique objective information. UI labels, route markers, event state remain available without audio. Test at 12-voice cap.

---

## 6. Completion Semantics & Retry Safety

### Retry-Safe Determinism
| Phase | Invariant | Verification |
|---|---|---|
| **Wave Slot Ownership** | Each wave slot belongs to exactly one objective; no duplicate/missing/backward ownership | `STAGE_ENCOUNTER_ROUTES["cinder-span"].objectives[i].waveSlots` immutable |
| **Objective Completion** | Completes ONLY when all owned waves started + pending queue empty + zero living enemies | `ENCOUNTER_OBJECTIVE_COMPLETED` event guards with checks |
| **Recovery Ticks** | `cinder-relay-crossing` = 180 ticks; `cinder-forge-stand` = 210 ticks; no frame variance | `STAGE_PLAN_DESCRIPTORS["cinder-span"].recovery[*].recoveryTicks` |
| **Commander/Gate Floors** | Recovery applies only to authored `recovery.floors` (e.g., relay: commander 35%, gate 30%), never above current | simulation floor-check before heal |
| **Retry Limit** | Max 3 attempts per objective before cascade | `RETRY_OBJECTIVE` input guard; `maxAttempts: 3` |
| **Enemy Withdrawal** | On recovery trigger, objective-owned enemies withdraw; pending spawns removed; no hidden damage | `ENCOUNTER_RECOVERY_STARTED` event lists withdrawn IDs |
| **Reward Dedup** | Wave-clear recovery and objective completion each grant reward once per `wave:<index>` or `objective:<id>` key | `ENCOUNTER_REWARD_GRANTED.rewardKey` checked before issue |
| **Carry-Over State** | After stage completion, selected reward (`ember-cohort-legacy`, `stillwater-hourglass`, or `bulwark-brand`) is locked in carry-over and applied to next stage | `CARRY_OVER_MAX_ITEMS`, `CARRY_OVER_MAX_RANK` limits enforced |

---

## 7. Implementation Checklist

### Exact Handoff Points
| Owner | Canonical Data | Acceptance Proof |
|---|---|---|
| **Encounter** | `STAGE_ENCOUNTER_ROUTES["cinder-span"]` objectives, wave slots 0–9, commitment/concurrency caps, spawn interval | Event trace: relay (0–4) → forge (5–9) → boss → extraction, each objective owns only its slots |
| **Progression** | `STAGE_ITEM_IDS["cinder-span"]` = `"ashen-sigil"`, `STAGE_REWARD_IDS["cinder-span"]` = `["ember-cohort-legacy", "stillwater-hourglass", "bulwark-brand"]` | Item collected on stage clear; one reward selected and applied to carry-over state |
| **Companion** | `COMPANIONS["ember-cohort"]` stats (damage 420, fireTicks 36, range 4600), appearance model `ember-cohort.glb` | Extraction event binds `ember-cohort` record; companion appears in next stage if carry-over selected |
| **Cosmetic** | Wearable item `ember-sigil-bracers` (or catalog ID TBD) in slot `accessory1` | Cosmetic synced to companion model on render |
| **Dialogue** | Korean lines in `CUTSCENES["cinder-span"]` or accessible fallback records (non-live-combat text) | Text appears in lobby record with speaker labels; matches video/in-engine intro timing |
| **Camera** | Intro (90 ticks, distance 6, azimuth −0.24, polar −0.34); boss-entry orbit; aftermath on chains/retreat | Normal and reduced-motion captures preserve commander, objective, threats, safe lane |
| **VFX** | `cinder-span-ember-wake` core/ring readable; seal ring closes at occupation; no false lanes or hazard decals | `core-static` mode functional; VFX responds only after events; no precede/duplicate damage |
| **Audio** | Cue chain: `stage-start` → `active-wave` → `warning-pulse` (midboss) → `occupation-captured` → `elite-extracted` → `boss-spawned` → terminal | Event-to-cue trace at 12-voice cap; one semantic cue per emitted event |

---

## 8. Non-Goals

- ❌ No invented Stage 4 or beyond
- ❌ No vertical traversal (z-axis locked at 0)
- ❌ No dialogue choice system (story beats are linear, visual/audio-driven)
- ❌ No new gameplay systems (all mechanics use existing contracts)
- ❌ No image generation or 50-panel viewer (this is a design handoff, not a production asset)
- ❌ No changes to `defense-run-simulation.js` or core runtime logic

---

## 9. Source Authority

- `defense-catalog.js#STAGE_ENCOUNTER_ROUTES`, `#STAGE_WAVE_DOCTRINE`, `#STAGES`, `#BOSSES`, `#SKILLS`, `#REWARDS`
- `stage-world-catalog.js#STAGE_WORLD_PROFILES["cinder-span"]`, `#gameplay.routes`, `#gameplay.npcs`
- `abyssal-lantern-world-synopsis.md` § 3 (Cinder Span narrative spine, dialogue, world plan)
- `encounter-wave-spec.md` § 3–7 (objective gates, recovery, routed ingress)
- `camera-vfx-direction.md` (intro/boss/aftermath staging, reduced-motion rules)
- `combat-extraction-systems-design.md` § 5 (extraction window, companion stats)
- `lobby-story-presentation-spec.md` § 2–3 (dialogue fallback, media surfaces, spoiler discipline)

---

**End of Scenario Document**
