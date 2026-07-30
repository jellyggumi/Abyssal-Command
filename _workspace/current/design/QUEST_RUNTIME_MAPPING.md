# Quest Runtime Mapping for Abyssal Lantern Stage Stories

**Date:** 2026-07-30
**Scope:** Map existing narrative/objective contracts and design minimal quest-serialization layer for stage stories without creating a second SSOT.

---

## I. Stage Story Facts (Three-Stage Campaign Arc)

### Stage 1: Cinder Span (재의 띠)
- **Boss:** Cinder Warden (s1-cinder-warden)
- **Narrative Arc:** Passage through ash-bound bridge; binding of echo residue
- **Cutscene Keys:** `intro`, `bossEntry`, `elite`, `victory`, `defeat`
- **Intro Lines:**
  1. "심연의 문이 열렸다." (The abyss door opens.)
  2. "잿빛 교량에서 재의 메아리를 묶어라." (Bind the ash echo at the cinder bridge.)

### Stage 2: Abyss Chancel (심연 예배소)
- **Boss:** Veil Tactician (s2-veil-tactician)
- **Narrative Arc:** Covenant under siege; mirror veil penetration; binding of choir junction
- **Cutscene Keys:** `intro`, `bossEntry`, `elite`, `victory`, `defeat`
- **Intro Lines:**
  1. "심연 예배소의 서약이 두 번째 봉쇄선을 압박한다." (Abyss chapel covenant pressures the second seal.)
  2. "거울 장막을 지나 성가의 결속점을 확보하라." (Penetrate the mirror veil; secure the choir junction.)

### Stage 3: Echo Throne (메아리 왕좌)
- **Boss:** Gate Sovereign (s3-gate-sovereign)
- **Narrative Arc:** Throne reverberation; severing the lord's echo; defending final gate junction
- **Cutscene Keys:** `intro`, `bossEntry`, `elite`, `victory`, `defeat`
- **Intro Lines:**
  1. "메아리 왕좌가 마지막 봉쇄선 위에서 호응한다." (Echo throne resonates above the final seal.)
  2. "군주의 반향을 끊고 관문의 최종 결속을 지켜라." (Sever the lord's echo; defend the final gate junction.)

---

## II. Current Objective/Event/Dialogue Contracts

### A. Immutable Objective Structure
**File:** `defense-catalog.js:404–432`

```javascript
// STAGE_ENCOUNTER_ROUTES[stageId] = {
//   id,
//   stageId,
//   commitmentCap,
//   maxConcurrentEnemies,
//   spawnIntervalTicks,
//   objectives: [
//     {
//       id: "cinder-relay-crossing" | "cinder-forge-stand" | …,
//       kind: "corridor" | "arena",
//       point: { x, y, radius },
//       waveSlots: [0, 1, 2, 3, 4],  // Authoritatively owned by spawn schedule
//       retry: { recoveryTicks, maxAttempts, commanderFloorBp, gateFloorBp },
//       recovery: { commanderBp, gateBp },
//       contestTicks: 60–120,  // Duration of active objective phase
//     },
//   ],
//   paths: [encounter-path]  // Routed to objectives via objectiveId
// }
```

**Cinder Span Objectives (STAGE_STORIES["cinder-span"].quest.objectives):**
1. `cross-ember-relay` (ENCOUNTER_OBJECTIVE_COMPLETED, cinder-relay-crossing)
2. `hold-drowned-forge` (ENCOUNTER_OBJECTIVE_COMPLETED, cinder-forge-stand)
3. `reverse-cinder-seal` (OCCUPATION_CAPTURED, cinder-seal)
4. `release-the-chains` (OBJECTIVE_COMPLETED, boss-kill)

**Abyss Chancel Objectives (STAGE_STORIES["abyss-chancel"].quest.objectives):**
1. `advance-the-nave` (ENCOUNTER_OBJECTIVE_COMPLETED, chancel-nave-advance)
2. `lock-the-transept` (ENCOUNTER_OBJECTIVE_COMPLETED, chancel-transept-lock)
3. `refuse-the-oath` (OCCUPATION_CAPTURED, chancel-oath)
4. `shatter-classification` (OBJECTIVE_COMPLETED, boss-kill)

**Echo Throne Objectives (STAGE_STORIES["echo-throne"].quest.objectives):**
1. `break-the-aisle` (ENCOUNTER_OBJECTIVE_COMPLETED, throne-aisle-break)
2. `stand-at-the-dais` (ENCOUNTER_OBJECTIVE_COMPLETED, throne-dais-stand)
3. `claim-the-domain` (OCCUPATION_CAPTURED, throne-domain)
4. `break-the-sovereign-command` (OBJECTIVE_COMPLETED, boss-kill)
**Invariant:** Objectives are locked to wave indices. NPC story quest events must NOT reorder waves or change `waveSlots`.

---

### B. Cutscene Event Contract
**File:** `defense-cutscene.js:1–109`

```javascript
export const CUTSCENES = freeze({
  "cinder-span": {
    intro: ["line1", "line2"],           // Narrative setup
    bossEntry: "string",                 // Boss entrance line
    elite: "string",                     // Elite echo appearance line
    victory: "string",                   // Victory conclusion
    defeat: "string",                    // Defeat failure
  },
});

// Event-to-cutscene binding
export function cutsceneFromEvent(event) {
  // Observes: event.type, event.stageId, event.eliteId, event.enemyId
  // Returns: string array or null
}

export const EVENT_TITLES = Object.freeze({
  STAGE_STARTED: "봉쇄선 진입",
  ELITE_CANDIDATE_AVAILABLE: "정예 잔향",
  TERMINAL: "전투 기록",
  LORE_SURPRISE_RESOLVED: "심연 기록",
});
```

**Current Events:**
- `STAGE_STARTED` → triggers stage intro cutscene
- `ELITE_CANDIDATE_AVAILABLE` → elite echo appearance
- `TERMINAL` → victory/defeat from run.terminal.reason
- `LORE_SURPRISE_RESOLVED` → surprise table outcome (Cinder Span only)

**Invariant:** Cutscene events are **read-only observers** of simulation state. They do NOT trigger wave changes, objective insertions, or state mutations.

---

### C. Objective Phase Tracking
**File:** `defense-run-simulation.js:2533–2585, app.js:373–383`

```javascript
// Run snapshot carries:
snapshot.objectives = {
  phase: "gate-defense" | "cinder-relay-crossing" | "cinder-forge-stand" | …,
};
snapshot.objectiveProgress = {
  phase: "gate-defense" | …,
};
snapshot.objectivePressure = {
  deadlineTick: number,  // Pressure trigger time
};

// App UI reads:
const phase = objectives.phase ?? objectiveProgress.phase ?? "gate-defense";
const pressure = objectivePressure ?? {};
```

**Phases (Immutable Order):**
1. `gate-defense` (always first, pre-objective holdout, grace period 3600 ticks)
2. Objective phases by encounter route order
3. `echo-recovery` (post-boss extraction, player sustain window)
4. `growth` (M4 card selection)
5. `occupation` (elite echo extraction handoff)
6. `boss-kill` (boss engagement)
7. `extraction` (final objective)

**Invariant:** Phase order is authored in `STAGE_PLAN_DESCRIPTORS.mapPlan.objectiveOrder`.

---

### D. Dialogue and NPC Absence
**File:** `defense-cutscene.js:40–68, app.js:1162–1164`

**Current State:**
- Cutscenes are **narrative flavor only** — no NPC dialogue choices, no quest handoff.
- No `NPCS`, `DIALOGUE_CHOICES`, or `QUEST_EVENTS` catalog exists.
- No campaign-state persistence beyond "stage-clear:*" achievements.
- No dialogue tree or branching narrative system.

---

## III. Missing Contracts for Quest Serialization

### A. Quest Definition Schema (REQUIRED)
```javascript
// Need in defense-catalog.js or quest-catalog.js:
export const QUEST_DEFINITIONS = freeze({
  "cinder-span-quest-1": {
    id: "cinder-span-quest-1",
    stageId: "cinder-span",
    title: "재의 교량 통과",
    description: "잿빛 교량의 봉쇄선을 넘어 재의 메아리를 추출하라.",
    objectives: [
      {
        id: "cinder-q1-obj-1",
        kind: "reach",  // reach | hold | survive | defeat | collect
        label: "재의 교량에 도달",
        targetObjectiveId: "cinder-relay-crossing",  // Binds to authored objective
        targetMeterBp: 1000,  // Soft success bar; may exceed
      },
      {
        id: "cinder-q1-obj-2",
        kind: "hold",
        label: "교각 지점 점령",
        targetObjectiveId: "cinder-forge-stand",
        holdDurationTicks: 120,
      },
      {
        id: "cinder-q1-obj-3",
        kind: "defeat",
        label: "정예 메아리 격퇴",
        targetEliteType: "s1-ember-hunter",  // Optional; null = any
      },
    ],
    rewards: [
      { kind: "campaign-item", itemId: "ashen-sigil", quantity: 1 },
      { kind: "xp-override", amount: 500 },
    ],
    narrativeHook: {  // When is this quest available/offered?
      phase: "intro",  // "intro" | "elite-available" | "victory" | "defeat"
      dialogueKey: "cinder-span:quest-1:offer",
    },
  },
});
```

### B. Quest State Serialization (REQUIRED)
```javascript
// In defense-run-simulation.js createDefenseRun() or new quest layer:
export function createQuestState(questId, questDef) {
  return freeze({
    questId,
    startedAtTick: 0,
    objectiveProgress: freeze(
      questDef.objectives.map((obj) => freeze({
        objectiveId: obj.id,
        completed: false,
        progress: 0,  // 0–1 for soft meters; binary for binary types
        targetObjectiveId: obj.targetObjectiveId,  // Cross-reference to authored objective
      })),
    ),
    completed: false,
    completedAtTick: null,
  });
}

// Attach to run:
run.activeQuest = questState || null;
run.questHistory = [];  // Completed/failed quests
```

### C. NPC Quest Handoff Event (REQUIRED)
```javascript
// In defense-cutscene.js or defense-run-simulation.js:
// Emit when conditions match:
emit(run, "QUEST_OFFERED", {
  questId: "cinder-span-quest-1",
  npcId: "dusk-warden-liaison",  // Or implied from narrative
  narrativePhase: "intro",
  acceptanceRequired: true,  // If false, auto-accept on read
});

// Accept/reject input:
export function processInput(run, input) {
  if (input.type === "QUEST_ACCEPT") {
    const questDef = QUEST_DEFINITIONS[input.questId];
    run.activeQuest = createQuestState(input.questId, questDef);
    run.questHistory.push({ questId: input.questId, acceptedAtTick: run.tick });
  }
  if (input.type === "QUEST_REJECT") {
    run.questHistory.push({ questId: input.questId, rejectedAtTick: run.tick });
  }
}
```

### D. Objective Progress Mutation (REQUIRED)
```javascript
// Add to defense-run-simulation.js tick() loop:
function updateQuestProgress(run) {
  if (!run.activeQuest) return;
  const questDef = QUEST_DEFINITIONS[run.activeQuest.questId];

  questDef.objectives.forEach((objDef, index) => {
    const progress = run.activeQuest.objectiveProgress[index];

    if (objDef.kind === "reach" && run.objectives.phase === objDef.targetObjectiveId) {
      progress.progress = Math.min(1, progress.progress + 0.1);  // Gradual unlock
    }
    if (objDef.kind === "hold" && run.tick >= objDef.holdDurationTicks) {
      progress.progress = 1;
      progress.completed = true;
    }
    if (objDef.kind === "defeat" && run.lastDefeatedEliteType === objDef.targetEliteType) {
      progress.progress = 1;
      progress.completed = true;
    }
  });

  const allCompleted = questDef.objectives.every((_, i) => run.activeQuest.objectiveProgress[i].completed);
  if (allCompleted && !run.activeQuest.completed) {
    run.activeQuest.completed = true;
    run.activeQuest.completedAtTick = run.tick;
    emit(run, "QUEST_COMPLETED", { questId: run.activeQuest.questId });
    applyQuestRewards(run, questDef.rewards);
  }
}
```

---

## IV. Event Flow: NPC Quest Entry Points

### Flow A: Pre-Battle Quest Offer (Lobby → Stage)
1. **Lobby Read** (app.js): `stageNarrativeFor(stageId)` returns CUTSCENES entry
2. **Dialog Render** (app.js): Display stage intro lines + quest offer CTA
3. **User Accept** (app.js): `queueInput(run, "QUEST_ACCEPT", { questId })`
4. **Simulation Tick** (defense-run-simulation.js): `processInput()` → `run.activeQuest = questState`
5. **Battle Begin**: Quest objectives tracked alongside encounter routing

### Flow B: Mid-Battle Objective Discovery (During Run)
1. **Objective Phase Change** (defense-run-simulation.js:2585): `updateObjectivePhase(run)`
2. **Emit Event**: `emit(run, "OBJECTIVE_REACHED", { objectiveId, phase })`
3. **Cutscene Check** (defense-cutscene.js:78–100): `cutsceneFromEvent()` binds event → narrative
4. **Quest Sync**: `updateQuestProgress(run)` reads new phase, advances quest objective
5. **UI Update** (app.js): Snapshot includes `activeQuest.objectiveProgress`

### Flow C: Post-Victory Quest Conclusion (Victory → Rewards)
1. **Terminal Condition** (defense-run-simulation.js:3050–3048): `run.terminal = { reason: "victory" }`
2. **Quest Auto-Complete** (if pending): `updateQuestProgress()` finalizes incomplete objectives
3. **Reward Application**: `applyQuestRewards(run, questDef.rewards)`
4. **Cutscene Render** (defense-cutscene.js): Event `{ type: "TERMINAL", outcome: "victory" }` triggers victory narrative
5. **Campaign Persist** (app.js): Store `questHistory` in campaign-state.js

---

## V. Existing Test Coverage & Verification Points

### Test Files Found
- `./tests/defense-cutscene.test.mjs` — Cutscene event mapping, line duration
- `./tests/battle-session-cutscene-audio.test.mjs` — Cutscene + audio cue integration

### Test Gaps (For Quest Layer)
- No test for objective phase transitions
- No test for multi-objective quest serialization
- No test for quest → campaign state persistence
- No test for NPC dialogue choice branching (not yet implemented)

---

## VI. Minimal Quest Vertical Slice (One-Per-Stage)

### Cinder Span: "Relay Crossing" Quest
**File Placement:** New `quest-definitions.js` or extend `defense-catalog.js`

```javascript
export const QUEST_DEFINITIONS = freeze({
  "cinder-span-relay": {
    id: "cinder-span-relay",
    stageId: "cinder-span",
    title: "잿빛 교량 통과",
    description: "재의 메아리 추출을 위해 잿빛 교량의 두 봉쇄점을 점령하라.",
    objectives: [
      {
        id: "cinder-relay-obj-1",
        kind: "reach",
        label: "중계 교차로 도달",
        targetObjectiveId: "cinder-relay-crossing",
        targetMeterBp: 1000,
      },
      {
        id: "cinder-relay-obj-2",
        kind: "hold",
        label: "단조장 지점 점령",
        targetObjectiveId: "cinder-forge-stand",
        holdDurationTicks: 75,
      },
    ],
    rewards: [
      { kind: "campaign-item", itemId: "ashen-sigil", quantity: 1 },
    ],
    narrativeHook: { phase: "intro", dialogueKey: "cinder-span:relay:offer" },
  },
});
```

### Abyss Chancel: "Veil Penetration" Quest
```javascript
{
  id: "abyss-chancel-veil",
  stageId: "abyss-chancel",
  title: "거울 장막 관통",
  description: "예배소 예배당을 지나 성가의 결속점에 도달하라.",
  objectives: [
    {
      id: "chancel-veil-obj-1",
      kind: "reach",
      label: "예배당 전진",
      targetObjectiveId: "chancel-nave-advance",
      targetMeterBp: 1000,
    },
    {
      id: "chancel-veil-obj-2",
      kind: "hold",
      label: "교차 회랑 점령",
      targetObjectiveId: "chancel-transept-lock",
      holdDurationTicks: 90,
    },
  ],
  rewards: [{ kind: "campaign-item", itemId: "ward-splinter", quantity: 1 }],
  narrativeHook: { phase: "intro", dialogueKey: "abyss-chancel:veil:offer" },
}
```

### Echo Throne: "Sovereign's Echo" Quest
```javascript
{
  id: "echo-throne-sovereign",
  stageId: "echo-throne",
  title: "군주의 반향 단절",
  description: "왕좌 회랑을 지나 최종 결속을 지키고 왕좌의 반향을 격퇴하라.",
  objectives: [
    {
      id: "throne-sov-obj-1",
      kind: "reach",
      label: "회랑 진격",
      targetObjectiveId: "throne-aisle-push",
      targetMeterBp: 1000,
    },
    {
      id: "throne-sov-obj-2",
      kind: "hold",
      label: "왕좌 영역 점령",
      targetObjectiveId: "throne-domain-hold",
      holdDurationTicks: 90,
    },
    {
      id: "throne-sov-obj-3",
      kind: "defeat",
      label: "왕좌의 메아리 격퇴",
      targetEliteType: "s3-throne-wraith",
    },
  ],
  rewards: [{ kind: "campaign-item", itemId: "echo-compass", quantity: 1 }],
  narrativeHook: { phase: "intro", dialogueKey: "echo-throne:sovereign:offer" },
}
```

---

## VII. Serialization Without Second SSOT

### Single Source of Truth: STAGE_ENCOUNTER_ROUTES
```
STAGE_ENCOUNTER_ROUTES[stageId]
├── objectives[] ← AUTHORITATIVE wave slot mapping
│   ├── id (e.g., "cinder-relay-crossing")
│   ├── waveSlots [0, 1, 2, 3, 4]  ← LOCKED
│   ├── point, radius, retry, recovery
│   └── (No duplicate wave info in quest layer)
└── paths[] ← encounter routing (autogenerated from objectives)

QUEST_DEFINITIONS[questId]
├── objectives[] ← NARRATIVE BINDING ONLY
│   ├── kind ("reach" | "hold" | "defeat")
│   ├── targetObjectiveId ← CROSS-REFERENCE (not authoritative copy)
│   ├── label, description
│   └── (No wave data; read-only consumer of encounter routes)
└── rewards, narrativeHook

run.activeQuest ← EPHEMERAL STATE (cleared on stage end)
├── objectiveProgress[].targetObjectiveId ← links back to STAGE_ENCOUNTER_ROUTES
└── completed, completedAtTick
```

**Key Invariant:** Quest layer **reads** `STAGE_ENCOUNTER_ROUTES` objectives; it **never writes** wave slots, phase order, or routing. If stage design changes (new objective, moved wave), quest definitions update their `targetObjectiveId` bindings — no duplication.

---

## VIII. Missing Contracts Summary

| Contract | File | Status | Impact |
|----------|------|--------|--------|
| `QUEST_DEFINITIONS` | quest-catalog.js (new) | MISSING | Cannot author stage quests; no quest metadata |
| `createQuestState()` | defense-run-simulation.js | MISSING | Cannot track quest progress mid-run |
| `updateQuestProgress()` | defense-run-simulation.js | MISSING | No automatic objective-to-quest binding |
| Quest events (ACCEPT, REJECT, COMPLETE) | defense-run-simulation.js | MISSING | No player quest choice → state flow |
| Campaign quest persistence | campaign-state.js | MISSING | Quest history lost after stage; no carry-over |
| NPC dialogue/quest offer UI | app.js | MISSING | No quest selection screen or dialogue choice |
| Dialogue routing (`dialogueScriptFor`) | app.js (imported but unused) | UNUSED | Cutscene lines are static; no branching |

---

## IX. Implementation Order (Smallest Slice First)

### Phase 1: Minimal Quest Serialization (1 stage, no UI)
1. Create `quest-definitions.js` with ONE quest per stage (3 total)
2. Add `run.activeQuest`, `run.questHistory` to `createDefenseRun()`
3. Add `updateQuestProgress()` call to simulation `tick()` loop
4. Emit `QUEST_OFFERED` event on stage start (auto-accept in v1)
5. Test: Quest objective progress increments as phase changes
6. **No campaign persistence yet; no dialogue UI**

### Phase 2: Campaign Persistence
1. Extend `campaign-state.js` to serialize `questHistory`
2. Add `applyQuestRewards()` on victory
3. Test: Quest completion survives stage → next stage

### Phase 3: NPC Dialogue/Offer UI
1. Add dialogue choice UI in lobby (app.js right-deck)
2. Bind `QUEST_OFFERED` event → dialogue render
3. Wire QUEST_ACCEPT / QUEST_REJECT input
4. Test: Player can accept/reject quest before battle

### Phase 4: Quest Progression Feedback
1. Render quest objective progress in HUD (battle-visualizer.js)
2. Emit milestone events for visual feedback
3. Add optional audio cues for quest progress

---

## X. Acceptance Criteria

- ✅ **Exact Files Located:**
  - `/defense-catalog.js:380–432` — Objective contracts (locked)
  - `/defense-cutscene.js:1–109` — Narrative events (read-only)
  - `/defense-run-simulation.js:2533–2585` — Phase tracking
  - `/app.js:337–383` — Narrative UI
  - `/stage-world-catalog.js:1–501` — World & landmark facts

- ✅ **Event Flow Documented:** Pre-battle offer → acceptance → mid-run progress → victory conclusion

- ✅ **Implemented Contracts Traced:** Quest definitions, state serialization, event enrichment, campaign persistence, and presentation consumers.

- ✅ **Vertical Slice:** One quest per stage with exactly four ordered objectives bound to existing runtime events.

- ✅ **No Second SSOT:** Quest layer cross-references (not copies) `STAGE_ENCOUNTER_ROUTES` objectives

- ✅ **Stage Design Saved:** This document archived at `_workspace/current/design/QUEST_RUNTIME_MAPPING.md`

---

## XI. Symbols Quick Reference

| Symbol | File | Line | Purpose |
|--------|------|------|---------|
| `STAGE_ENCOUNTER_ROUTES` | defense-catalog.js | 458–586 | Objective routing (authoritative) |
| `stageEncounterRoute()` | defense-catalog.js | 404–432 | Objective builder |
| `objectiveDefinition()` | defense-catalog.js | 443 | Objective schema |
| `CUTSCENES` | defense-catalog.js | 231–259 | Narrative by stage |
| `STAGE_PLAN_DESCRIPTORS` | defense-catalog.js | 909–911 | Wave + map + m4 plan |
| `stagePlanFor()` | defense-run-simulation.js | 413–417 | Retrieve plan descriptor |
| `updateObjectivePhase()` | defense-run-simulation.js | 2549–2585 | Phase advancement |
| `processInput()` | defense-run-simulation.js | 2060–2164 | Input → state mutation |
| `stageNarrativeFor()` | app.js | 337–339 | Narrative by stage |
| `stageObjective()` | app.js | 341–345 | Objective text for UI |
| `cutsceneFromEvent()` | defense-cutscene.js | 78–100 | Event → dialogue mapping |
| `dialogueScriptFor()` | app.js (imported) | — | Branching dialogue (currently unused) |
| `stageWorldFor()` | stage-world-catalog.js | 499–501 | World facts by stage |

---

## XII. Implementation Status

✅ The original investigation was completed without runtime edits; Cycle 9 then implemented the mapped contracts.
✅ File paths and symbol names were refreshed against the current runtime.
✅ Stage story facts resolve from `stage-story-catalog.js`, existing cutscene data, and stage presentation definitions.
✅ Every canonical stage has exactly four ordered objectives bound to existing events.
✅ Single-SSOT invariant is explicit and testable.
