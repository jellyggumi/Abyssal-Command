# Echo Throne — Stage 3 Final Episode Design

**Status:** Implementation-ready specification
**Stage ID:** `echo-throne`
**Campaign position:** 3 / 3 (Final, campaign payoff)
**Stage name (KO):** 왕좌의 메아리 *(Echo Throne)*
**Boss:** Gate Sovereign (`s3-gate-sovereign`), Elite: Throne Wraith (`s3-throne-wraith`)
**Reward Companion:** Throne Echo (`throne-echo`)

---

## 1. Narrative Arc & Campaign Payoff

### 1.1 Opening Premise
The player has liberated the Cinder Span and sealed the Abyss Chancel. Now the final door opens: the Echo Throne at the heart of the Abyss, where the Gate Sovereign waits. This is **not a sequel hook**—it is the campaign conclusion and the extraction of the ultimate warden's echo.

### 1.2 Story Beats (Korean Dialogue)

| Beat | Event Tick | Speaker/Context | Korean Dialogue | English ID |
|------|-----------|-----------------|-----------------|-----------|
| **Opening Threat** | 0 | Intro Narrator | `왕좌의 메아리가 울린다. 관문의 주권자가 마지막 봉쇄선을 세운다.` | `intro.gate-sovereign-appears` |
| **Quest Giver Introduction** | 0 | NPC: Throne Lookout (`echo-throne:throne-lookout`) cue | `어둠의 끝에서, 수호자여. 네 개의 봉인을 풀어야 한다. 그 너머에 왕좌의 진실이 있다.` | `quest-giver.throne-lookout.initial` |
| **Choke Point Tension** | ~2400 | Elite Engagement | `감시석의 외로운 그림자가 새로운 의지의 목소리를 내뱉는다.` | `elite-encounter.throne-wraith.choke` |
| **Reversal / Realization** | ~5400 | Narrator (mid-run) | `왕좌는 봉쇄선이 아니라, 문이다. 진정한 관문의 힘이 깨어난다.` | `narrative.reversal.gate-opens` |
| **Boss Entry** | ~8100 | Boss Emergence | `거대한 연쇄가 끊어지고, 왕좌의 절대적 고독이 무너진다.` | `boss-entry.gate-sovereign.chains-break` |
| **Victory Payoff** | Condition: Boss Defeated | Outro Narrator | `왕좌의 메아리가 잠든다. 네 선택이 세계를 재구성한다. 다음 새벽은 너의 손에 있다.` | `victory.campaign-conclusion.echo-sleeps` |
| **Defeat Recovery** | Condition: Player Lost | Retreat Narrator | `첫 봉쇄선을 재확보하라. 왕좌의 의지는 아직 물러나지 않았다.` | `defeat.return-to-post.sovereign-endures` |

---

## 2. Quest Acquisition & NPC Handoff

### 2.1 Quest Giver NPC

| Property | Value |
|----------|-------|
| **NPC ID** | `echo-throne:throne-lookout` |
| **NPC Display Name (KO)** | 파수 망원경 |
| **Role** | Sentinel at Gate; guides final phase |
| **Companion Prototype** | `throne-echo` (reward on victory) |
| **Quest Trigger** | Stage entry (intro cutscene at tick 0) |
| **Initial Cue** | `어둠의 끝에서, 수호자여. 세 개의 봉인을 풀어야 한다. 그 너머에 왕좌의 진실이 있다.` |
| **World Placement** | Lookout at gate approach, lookAtX: 20000, lookAtY: 6000 (visual sweep toward throne) |

### 2.2 Quest Objectives (Intermediate → Final)

The stage follows a **four-objective unlock arc**, each tied to an objective and a specific game mechanic:

#### Objective 1: Break the Aisle
- **Objective ID:** `echo-throne:break-the-aisle`
- **Kind:** `encounter` (corridor gate)
- **Location:** Throne aisle, point: (16000, 6000), radius: 1200
- **Korean Label (mapLabels):** `되돌아오는 왕좌 회랑을 돌파하라`
- **Event Binding:** Trigger at wave slot 0–2 (initial corridor waves)
- **Success Condition:** Complete all waves in slot; corridor gate opens
- **Narrative Cue (on success):** `첫 번째 회랑이 뚫린다. 왕좌의 울음이 커진다.`

#### Objective 2: Stand at the Dais
- **Objective ID:** `echo-throne:stand-at-the-dais`
- **Kind:** `encounter` (arena gate)
- **Location:** Throne dais, point: (19500, 6000), radius: 1800
- **Korean Label (mapLabels):** `왕좌를 소유하지 않고 단상을 지켜라`
- **Event Binding:** Trigger at wave slot 3–5 (mid-dais guardian escort waves)
- **Success Condition:** Survive mid-wave guardian pressure; dais gate opens
- **Narrative Cue (on success):** `단상의 의지가 부러진다. 두 번째 봉인이 흔들린다.`
- **Wearable Item Reward (on success):** `echo-throne-crown` (wearable armor cosmetic; equip to warden)

#### Objective 3: Claim the Domain
- **Objective ID:** `echo-throne:claim-the-domain`
- **Kind:** `occupy` (domain occupation)
- **Location:** Throne domain, point: (21600, 6000), radius: 1500
- **Korean Label (mapLabels):** `왕좌 영역의 명령을 역전하라`
- **Event Binding:** Trigger at wave slot 6–10 (final waves; elite + ranged pressure)
- **Success Condition:** OCCUPATION_CAPTURED at throne-domain
- **Narrative Cue (on success):** `세 번째 봉인이 열린다. 보이지 않는 관문 위로 빛이 쏟아진다.`
- **Skill/Equipment Reward (on success):** Equipment tier +1 for one slot (purchaseEquipmentTier budget: +1 Bound Fragment)

#### Objective 4: Break the Sovereign Command
- **Objective ID:** `echo-throne:break-the-sovereign-command`
- **Kind:** `boss-defeat`
- **Location:** Throne Apex, point: (22000, 6000), radius: 1500
- **Boss ID:** `s3-gate-sovereign`
- **Elite ID (encounter):** `s3-throne-wraith` (ranged, appears in mid-waves)
- **Boss Stats:** HP 150000, Speed 1500, Damage 300, AttackTicks 75, XP 500, Radius 1000, Policy: `boss-pursuit`
- **Narrative Cue (on success):** `Gate Sovereign의 마지막 명령이 끊긴다. 왕좌의 메아리가 잠든다.`
- **Primary Reward (on success):** Companion `throne-echo`; Stage victory; Campaign end

#### Final Objective: Defeat the Gate Sovereign (Boss)
- **Objective ID:** `echo-throne:final-boss`
- **Kind:** `boss-defeat`
- **Location:** Throne Apex, point: (22000, 6000), radius: 1500
- **Boss ID:** `s3-gate-sovereign`
- **Elite ID (encounter):** `s3-throne-wraith` (ranged, appears in mid-waves)
- **Boss Stats:** HP 150000, Speed 1500, Damage 300, AttackTicks 75, XP 500, Radius 1000, Policy: `boss-pursuit`
- **Narrative Cue (on success):** `왕좌의 메아리가 잠든다. 네 선택이 세계를 재구성한다.`
- **Primary Reward (on success):** Companion `throne-echo`; Stage victory; Campaign end

---

## 3. Motion, VFX & Audio Cues

### 3.1 Camera Motion Beats

| Tick | Motion | Description | Audio Cue |
|------|--------|-------------|-----------|
| 0 | Pullback pan | Reveal throne from above; fog lifts to show gate structure | `audio.intro-swell` |
| ~2400 | Focus zoom | Elite engagement; camera tightens on forecourt | `audio.elite-warning-tone` |
| ~5400 | Shock hold | Reversal moment; brief camera pause as gate opens | `audio.gate-creak-massive` (sustained) |
| ~8100 | Descent track | Boss emerges; camera descends into throne chamber | `audio.boss-theme-entrance` |
| Boss defeat | Ascent + fade | Camera rises out of throne; world fades to calm | `audio.victory-resolution` |

### 3.2 VFX Cue Markers

| Location | Effect | Trigger | Description |
|----------|--------|---------|-------------|
| First Seal point (14000, 6000) | `vfx.seal-crack` | Objective 1 success | Radial crack pattern, golden light |
| Midboss escape route | `vfx.pressure-field` | Mid-wave spawns | Pulsing red area denial visual |
| Throne corridor (21600, 6000) | `vfx.doorway-open` | Objective 3 success | Radial light bloom; column glow |
| Boss arena (22000, 6000) | `vfx.boss-manifest` | Boss spawn | Massive shadow + chain break particles |

### 3.3 Audio Cue Assignments (from defense-catalog.js AUDIO_CUES)

| ID | Usage | Volume/Priority |
|----|-------|-----------------|
| `audio.intro-swell` | Opening cutscene | Ambient fade-in |
| `audio.elite-warning-tone` | Elite encounter (Throne Wraith) | Alert (medium) |
| `audio.gate-creak-massive` | Reversal beat (gate opens) | Atmospheric (sustained) |
| `audio.boss-theme-entrance` | Boss emergence | Dramatic peak |
| `audio.victory-resolution` | Campaign conclusion | Calm resolution |
| `audio.defeat-return` | Defeat retry | Regrouping tone |

---

## 4. Existing Contracts & Implementation Binding

### 4.1 STAGE_ENCOUNTER_ROUTES Binding

```javascript
// defense-catalog.js insertion point (line ~575)
"echo-throne": stageEncounterRoute({
  stageId: "echo-throne",
  commitmentCap: 8,
  maxConcurrentEnemies: 22,
  spawnIntervalTicks: 180,
  objectives: [
    objectiveDefinition("echo-throne:break-the-aisle", "encounter", {x:16000, y:6000}, [0,1,2], 1, 120, 60),
    objectiveDefinition("echo-throne:stand-at-the-dais", "encounter", {x:19500, y:6000}, [3,4,5], 1, 150, 90),
    objectiveDefinition("echo-throne:claim-the-domain", "occupy", {x:21600, y:6000}, [6,7,8,9,10], 1, 180, 120),
    objectiveDefinition("echo-throne:break-the-sovereign-command", "boss-defeat", {x:22000, y:6000}, [10], 0, 0, 0),
  ],
  approaches: [
    { direction: "W", via: [
      routeWaypoint("wp-gate-entry", 22000, 6000),
      routeWaypoint("wp-choke-approach", 18000, 6000),
      routeWaypoint("wp-court-entry", 14000, 6000),
    ]},
    { direction: "NW", via: [
      routeWaypoint("wp-flank-north", 20000, 2000),
      routeWaypoint("wp-court-north", 16000, 3000),
    ]},
  ],
  finale: finalePaths("echo-throne", "wp-elite-exit", "wp-boss-arena"),
}),
```

### 4.2 CUTSCENES Binding

```javascript
// defense-catalog.js insertion point (line ~246)
"echo-throne": {
  intro: [
    `왕좌의 메아리가 울린다.`,
    `관문의 주권자가 마지막 봉쇄선을 세운다.`,
  ],
  bossEntry: `거대한 연쇄가 끊어지고, 왕좌의 절대적 고독이 무너진다.`,
  elite: `감시석의 외로운 그림자가 새로운 의지의 목소리를 내뱉는다.`,
  victory: `왕좌의 메아리가 잠든다. 네 선택이 세계를 재구성한다.`,
  defeat: `첫 봉쇄선을 재확보하라. 왕좌의 의지는 아직 물러나지 않았다.`,
},
```

### 4.3 Stage Definition (Line 805)

```javascript
stage(
  "echo-throne",                              // id
  "Echo Throne",                              // display name
  "Gate Sovereign",                           // boss name
  130,                                        // scale (HP multiplier)
  "s3-throne-wraith",                        // eliteId
  "ranged",                                   // eliteKind
  "throne-echo",                              // eliteCompanion (reward)
  "s3-gate-sovereign",                        // boss id
  840,                                        // legacyGateTicks
  [[0, "flanker", 5], [210, "ranged", 3], [480, "guardian", 2]]  // legacy waves (retained for contract)
)
```

### 4.4 New NPC Lookout Binding (stage-world-catalog.js)

```javascript
// Within profiles array for "echo-throne" profile:
lookouts: [
  lookout("echo-throne:throne-lookout", 13000, 6000, 0, 0, 20000, 6000, null),
],
actors: [
  {
    id: "echo-throne:throne-lookout",
    prototype: "throne-echo",
    x: 13000, y: 6000, elevation: 0, yaw: 0,
    cue: `어둠의 끝에서, 수호자여. 세 개의 봉인을 풀어야 한다. 그 너머에 왕좌의 진실이 있다.`,
  },
],
```

---

## 5. Rewards & Progression

### 5.1 Skill/Equipment Progression

| Event | Reward | Mechanism | Campaign Effect |
|-------|--------|-----------|-----------------|
| Objective 1 (First Seal) | Extraction Skill +1 | Field `extraction-skill-level` increment | Unlock: Elite extraction range +1000 units |
| Objective 2 (Containment) | Wearable Cosmetic `echo-throne-crown` | Add to ITEMS catalog, equip to warden | Visual: Warden gains shimmering aura; no stat change |
| Objective 3 (Corridor) | Equipment Tier +1 | Award 1 Bound Fragment | Campaign Carry-Over: One tier upgrade available for next engagement |
| Boss Defeat (Victory) | Companion `throne-echo` | Add to campaign.companionCollection | Permanent: New companion unlocked with `damage: 500`, `fireTicks: 30`, `range: 5200`, `speed: 1200` |

### 5.2 Stage-Clear Rewards (existing STAGE_REWARD_IDS contract)

```javascript
// defense-catalog.js line ~851
"echo-throne": Object.freeze(["throne-echo-record", "veil-vanguard-legacy", "stillwater-hourglass"]),
```

### 5.3 Carry-Over Budget

On victory:
- **Skill Ranks:** Extraction Skill rank +1 (if equipped; max rank 5)
- **Items:** `echo-throne-crown` (cosmetic, no carry-over penalty)
- **Warden Stat Points:** +1 available for next run
- **Companion Slots:** `throne-echo` unlocked (permanent)

On defeat:
- All carry-over cleared (reset to baseline)
- Retry from Abyss Chancel (stage 2) permitted

---

## 6. Flat-World Constraints & Determinism

### 6.1 Arena Bound Check
- All objectives remain within ARENA bounds: [0, 24000] × [0, 12000]
- First seal: (14000, 6000) ✓
- Midboss containment: (18000, 6000) ✓
- Corridor extract: (21600, 6000) ✓
- Boss arena: (22000, 6000) ✓

### 6.2 Terrain Collision & Obstacles
- No vertical elevation changes; all waypoints y-elevation = 0
- Route approaches use only horizontal waypoints
- Gate structure props (terrain GLB) define visual-only obstacles; paths stay clear

### 6.3 Determinism & Idempotency
- Objective completion state is read-only once set in campaign state
- Wave plan is deterministic (STAGE_WAVE_DOCTRINE + buildDoctrineWavePlan seed)
- Narrative cues trigger only once per event tick (no re-triggering on state refresh)
- Quest giver NPC placement is static; no respawn or state transition

---

## 7. Campaign Completion Semantics

### 7.1 Victory Condition
- Boss `s3-gate-sovereign` defeated (HP → 0)
- All intermediate objectives completed (states: `complete`)
- Campaign state: `resolvedIds` appends `"echo-throne"` (idempotent, once-only)
- Outcome record: stage `id`, outcome `victory`, reward `throne-echo`

### 7.2 Defeat Condition
- Player gate breach (Gate Integrity → 0)
- Campaign stage not added to `resolvedIds`
- Carry-over reset to empty
- Player may retry from Abyss Chancel (stage 2) or select Cinder Span (stage 1)

### 7.3 No Sequel Stage 4
- Echo Throne is explicitly final
- STAGES array remains `[cinder-span, abyss-chancel, echo-throne]` (3 stages)
- Campaign completion state: `unlockedStageIndex = 2` (no further progression)
- Victory returns to the completed three-stage lobby; a dedicated credits/ascension surface remains optional presentation work.

---

## 8. Implementation Checklist

- [x] Publish four Echo Throne quest objectives in `stage-story-catalog.js` and bind them to existing encounter, occupation, and boss-kill events.
- [x] Publish acquisition, reversal, boss-entry, and completion story beats through the existing cutscene adapter.
- [x] Bind `echo-throne:throne-lookout` and four ordered quest points in `stage-world-catalog.js`.
- [x] Preserve the authored `throne-echo` stage reward.
- [x] Grant the `echo-throne-crown` head appearance and `void-aegis` extraction skill once on first clear.
- [x] Persist and validate extraction-skill levels in `campaign-state.js`.
- [x] Preserve the authored Echo Throne wave doctrine and three-stage campaign cap.
- [x] Test four-objective progression and once-only rewards through the public campaign/runtime contracts.
- [x] Verify victory/defeat cutscenes and final-stage completion semantics.
- [ ] Add a dedicated campaign-conclusion credits surface; the current runtime returns to the completed lobby without a Stage 4 prompt.

---

## 9. Sources & Existing Invariants

**Authority:** defense-catalog.js (STAGE_ENCOUNTER_ROUTES, CUTSCENES, STAGES definitions)
**World contracts:** stage-world-catalog.js (stageWorldFor, world profiles, lookout placements)
**Campaign state:** campaign-state.js (resolvedIds, carry-over, progression tracking)
**Flat-world:** ARENA bounds (24000 × 12000), all waypoints y-elevation = 0
**Three-stage catalog:** STAGES array hard-coded, no dynamic stage loading

`storyProgress` is versioned optional progression metadata with migration defaults for historical saves.

---

## 10. Notes for Integration

1. **Quest Giver NPC** (`echo-throne:throne-lookout`) is a **static world actor**, not a spawned enemy. It is bound through the Echo Throne world profile.
2. **Four-objective arc** maps to existing encounter, occupation, and boss-kill event contracts; no duplicate simulation schema is introduced.
3. **Reversal beat** at ~5400 ticks is narrative-only; achieved via cutscene dialogue + audio cue, not a game mechanic change.
4. **Campaign payoff** confirmed by victory cutscene + throne-echo companion unlock (permanent, no carry-decay).
5. **Flat-world compliance**: All four objectives and boss arena stay on single plane (y-elevation = 0).
6. **Deterministic completion**: Stage marked `resolvedIds` once on victory; idempotent (no double-clear exploit).
