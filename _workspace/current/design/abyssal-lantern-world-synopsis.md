# Abyssal Lantern / 심연의 등불 — Three-Stage World Synopsis

```yaml
run_id: 20260729-abyssal-lantern-world-synopsis
status: "[TARGET] — narrative and presentation contract; not a claim of runtime implementation"
owner_skill: webtoon-harness (scenario discipline only; no image-generation phase)
authority_world: stage-world-catalog.js
authority_encounter: defense-catalog.js
authority_outcome: defense-run-simulation.js
depends_on:
  - design/abyssal-lantern-synopsis.md
  - design/lobby-story-presentation-spec.md
  - design/camera-vfx-direction.md
scope: three-stage world scenario, routed objectives and encounters, dialogue, presentation beats, implementation handoff
non_scope: runtime code, new gameplay systems, image generation, README/package/deploy changes, task manifest
```

This document applies the `webtoon-harness` scenario method as a **writing contract**: dialogue carries information, tension rises through visible action, and each stage ends on a turn that changes the meaning of the victory. It does not run the 27-agent image pipeline, request 50 panels, or claim that the new lines and presentation beats already ship.

Numeric values and combat outcomes remain simulation-owned. World placement comes from `stage-world-catalog.js`; encounter content, objective order, item/reward IDs, and routed tactics come from `defense-catalog.js`; presentation consumes events emitted by `defense-run-simulation.js`. No beat below adds a lantern meter, dialogue choice, quest state, damage rule, teleport, or fourth stage.

---

## 1. Narrative Spine

### 1.1 Player role

The player is the **Dusk Warden**, represented to the simulation as the commander. The Warden is the latest bearer of a lantern lineage, not a chosen monarch and not the inventor of the light. Their playable promise stays direct: cross the field, read the routed threat, select and cast skills, collect stage items, bind an extracted Echo, and kill the stage boss.

### 1.2 Antagonist pressure

The visible antagonist is the **Gate Sovereign** (`s3-gate-sovereign`). His pressure reaches backward as a repeated command: every boundary in the descent asks the Dusk Warden to preserve the old answer.

- **Cinder Warden** (`s1-cinder-warden`) physically holds the first boundary together and warns that passage is destruction.
- **Veil Tactician** (`s2-veil-tactician`) tests whether this bearer will repeat every earlier bearer's answer.
- **Gate Sovereign** reveals the endpoint of that repetition: he was a lantern bearer whose final command became the throne's command.

This through-line does **not** make the first two bosses puppets. Each retains the motive already reconstructed in `abyssal-lantern-synopsis.md`: the Cinder Warden is the bridge's last maintainer; the Veil Tactician is a classifier; the Gate Sovereign is a consumed predecessor trying to prove his decision correct.

### 1.3 Escalating mysteries

| Stage | Mystery introduced | Answer or escalation at the boss turn |
|---|---|---|
| `cinder-span` | Why does the supposed jailer drag chains that look structural rather than punitive? | The Cinder Warden was holding the bridge up. Killing him opens the descent by destroying the retreat. |
| `abyss-chancel` | Why do the mirrors answer before the Dusk Warden moves? | They record earlier lantern bearers. The Tactician has been waiting for one bearer to refuse the repeated answer. |
| `echo-throne` | Why is the lantern motif caged at an empty throne? | The Gate Sovereign is not the throne's owner but its last consumed bearer. Breaking his command leaves the throne empty while the command still echoes. |

The escalation changes axis—space, identity, purpose—so the three stages do not repeat one reveal.

---

## 2. Shared Runtime Vocabulary and Presentation Boundary

### 2.1 Canonical order and IDs

| Sequence | Stage | Boss | Elite state | Extracted companion record |
|---:|---|---|---|---|
| 1 | `cinder-span` / Cinder Span | `s1-cinder-warden` / Cinder Warden | `s1-ember-hunter` (`rusher`) | `ember-cohort` |
| 2 | `abyss-chancel` / Abyss Chancel | `s2-veil-tactician` / Veil Tactician | `s2-veil-sentinel` (`flanker`) | `rift-lens` |
| 3 | `echo-throne` / Echo Throne | `s3-gate-sovereign` / Gate Sovereign | `s3-throne-wraith` (`ranged`) | `throne-echo` |

### 2.2 Objective and escape-route grammar

Every stage uses the existing `STAGE_PLAN_DESCRIPTORS[*].mapPlan.objectiveOrder`:

`gate-defense → echo-recovery → growth → occupation → boss-kill → extraction`

The fiction may call `gate-defense` a seal hold, nave hold, or throne-domain hold, but the integration key remains `gate-defense`. The intermediate escape/recovery route also remains authored data:

| Stage | Recovery plan | Existing safe-lane ID | Fallback surface |
|---|---|---|---|
| `cinder-span` | `cinder-span-safe-lane` | `cinder-center` | `M4_RECOVERY_CHECKPOINT` or `M4_FALLBACK` |
| `abyss-chancel` | `abyss-chancel-safe-lane` | `chancel-nave` | `M4_RECOVERY_CHECKPOINT` or `M4_FALLBACK` |
| `echo-throne` | `echo-throne-safe-lane` | `throne-aisle` | `M4_RECOVERY_CHECKPOINT` or `M4_FALLBACK` |

These are **escape under pressure**, not exits from the stage. Presentation may point the player back through the named safe lane; it must not teleport the commander or independently mark an objective complete.

### 2.3 Event surfaces available to presentation

| Story function | Existing event/objective surface |
|---|---|
| Approach and stage identity | `STAGE_STARTED` (`stageId`, `mapPlanId`, `wavePlanId`, `m4PlanId`, authored intro, `stage-start` cue) |
| Authored traversal and gate ownership | `stage-world-catalog.js#gameplay.routes` plus `defense-catalog.js#STAGE_ENCOUNTER_ROUTES[*].objectives`; these objective IDs assign wave slots and recovery/retry semantics but do not replace simulation events |
| Routed pressure arrives | `WAVE_VARIANT_STARTED`, `ENEMY_SPAWNED`, `ENEMY_POLICY_SELECTED`, `MIDBOSS_SPAWNED` |
| A pressure packet breaks | `WAVE_CLEARED` with `objectiveId: gate-defense` |
| Echo opportunity appears | `ELITE_CANDIDATE_AVAILABLE` with `objectiveId: echo-recovery` |
| Growth becomes a story decision | `GROWTH_OFFER`, `SKILL_SELECTED`, `SKILL_CAST` |
| Intermediate gate is claimed | `OCCUPATION_PROGRESS`, `OCCUPATION_CAPTURED` with `objectiveId: occupation` |
| Binding route opens and resolves | `EXTRACTION_WINDOW_OPENED`, `EXTRACTION_PROGRESS`, `EXTRACTION_COMPLETED`, `ELITE_EXTRACTED` |
| Recovery lane is disclosed | `M4_RECOVERY_CHECKPOINT` or `M4_FALLBACK` with authored `safeLaneId` |
| Boss confrontation begins | `BOSS_SPAWNED`, `BOSS_RALLY_WINDOW`, `BOSS_ATTACK_TELEGRAPHED` |
| Stage turn is licensed | `OBJECTIVE_COMPLETED` with `objectiveId: boss-kill`, then `TERMINAL` |
| Campaign ending is licensed | `TERMINAL` with `outcome: FINAL_COMPLETION` |

Dialogue is not an active-combat rules channel. Per `lobby-story-presentation-spec.md`, approach, confrontation, and aftermath lines belong in the lobby record, accessible text fallback, or a safe pre/post-combat presentation window. During active combat, camera, VFX, audio, objective markers, and telegraphs carry the beat.

---

## 3. Stage One — Cinder Span (`cinder-span`)

### 3.1 Dense world plan

The Cinder Span reads as a bridge held together by the same machinery the player mistakes for a blockade.

| Layer | Existing authored surface | Story use |
|---|---|---|
| Critical traversal | `cinder-span:critical-route`: `ingress → relay-objective → blockade-gate → final-gate` | The straight route looks like a prison gate until the jagged brace geometry reads as structural support. |
| Optional escape/detour | `cinder-span:optional-detour`: `detour-entry → ash-cache → detour-exit` | The upper ash-service path exposes the broken parapet and rejoins beyond the relay pressure without teleporting the player. |
| Routed encounter gates | `cinder-relay-crossing` (corridor, wave slots 0–4) → `cinder-forge-stand` (arena, 5–9) | The first hold proves the relay can route power; the second reveals the forge as the true stand. |
| Dense silhouette | `jagged-parapet-blockade`; six authored obstacles including the Drowned Forge Arch, collapsed parapet, two ash walls, and relay debris | Repeated low, tooth-like blockers make the bridge feel maintained and besieged rather than empty. |
| Visibility staging | `relay-light-anchor`, `forge-light-anchor`, `central-fog-break` | Motivated light pulls the eye from relay to forge while the fog break keeps the critical route readable. |
| Intermediate gate | `cinder-span:blockade-gate` waypoint plus `cinder-seal` occupation | The spatial gate and occupation state align as one reveal without creating a new objective type. |
| Binding point | `cinder-bind`; `cinder-span:forge-relic` | The relic catches the elite Echo after the seal is held. |
| Ambient witness | `cinder-span:ember-lookout` | Its watch direction toward the western ingress tells the player where the next routed wave will enter. |
| Stage VFX | `cinder-span:ember-wake` / `cinder-span-ember-wake` | An intact lantern core and seal ring make the first stage the last moment when the lantern appears whole. |

Dense composition is the authored relay/forge cluster plus its critical route, optional detour, visibility anchors, and obstacle field. The synopsis consumes those IDs; it does not add collision or decorative runtime state.

### 3.2 Routed encounter and intermediate reveal

- `STAGE_STARTED` frames the Dusk Warden below the Drowned Forge Arch, then settles on the commander and the `cinder-span:critical-route`.
- `STAGE_ENCOUNTER_ROUTES["cinder-span"]` assigns wave slots 0–4 to `cinder-relay-crossing` and 5–9 to `cinder-forge-stand`, with commitment cap 3, maximum 8 concurrent enemies, and 18-tick spawn staggering. Those catalog values—not synopsis pacing—own density.
- Ten doctrine waves rotate `rusher → flanker → ranged` from `W` and `SW`. Big waves push `cinder-center`; the mid wave adds a guardian-based midboss. `WAVE_VARIANT_STARTED` and `ENEMY_POLICY_SELECTED` remain route authority.
- Clearing each routed gate grants its one authored recovery beat; a stalled gate uses that objective's deterministic retry/recovery contract before re-entering the same gate. The narrative reads this as the bridge bracing itself, not as a checkpoint teleport.
- The upper `cinder-span:optional-detour` exposes `ash-cache` and rejoins at `detour-exit`; `M4_RECOVERY_CHECKPOINT` or `M4_FALLBACK` still names `cinder-center` when the downstream binding route needs an escape line.
- `ELITE_CANDIDATE_AVAILABLE` reveals that one heat-bearing enemy can become the `ember-cohort` record.
- `OCCUPATION_CAPTURED` at `cinder-seal` commits the final assault route. This is the intermediate gate reveal: the relay was a binding switch, not a destination.
- `BOSS_SPAWNED` brings the Cinder Warden and his chains into the same sightline as the forge stand and bridge brace.
- Boss defeat opens the extraction window at `cinder-bind`; `EXTRACTION_COMPLETED` / `ELITE_EXTRACTED` turns enemy heat into an allied record.
- `GROWTH_OFFER` and `SKILL_SELECTED` turn recovered heat into a build choice without moving final extraction ahead of the boss.

### 3.3 Dialogue scenario

1. **Cinder Warden:** “등불을 내려라. 네가 찾는 길은 내 사슬 아래서 끝난다.”
2. **Dusk Warden:** “길을 막는 사슬인가, 길을 붙드는 사슬인가?”
3. **Cinder Warden:** “내가 쓰러지면 네 뒤가 먼저 무너진다.”
4. **Dusk Warden:** “그렇다면 돌아갈 길보다 내려갈 이유를 택하겠다.”
5. **Dusk Warden, aftermath:** “그는 문을 지킨 게 아니었다. 문이 올라오지 못하게 묶고 있었다.”

### 3.4 Boss-turn twist and gameplay link

At `OBJECTIVE_COMPLETED: boss-kill`, the chain tension releases. The boss did not block the bridge; he held it together. The resulting `TERMINAL` victory authorizes the aftermath image: ash falls upward through the broken retreat while the next route glows below.

- **Skill:** a `SKILL_CAST` burns an opening through density; it does not consume lantern fuel. The lantern is metaphor, not state.
- **Item:** `ashen-sigil` is the stage item surface. Collection is licensed only by `ITEM_COLLECTED`.
- **Extraction:** `ember-cohort` is the first proof that the Warden can bind what the abyss leaves behind.
- **Reward:** existing Cinder Span offers remain `ember-cohort-legacy`, `stillwater-hourglass`, and `bulwark-brand`; the synopsis does not force a choice.

---

## 4. Stage Two — Abyss Chancel (`abyss-chancel`)

### 4.1 Dense world plan

The Abyss Chancel compresses the player between a nave route, crossing flank, and elevated apse so every reflective surface can disagree about where the true path lies.

| Layer | Existing authored surface | Story use |
|---|---|---|
| Critical traversal | `abyss-chancel:critical-route`: `ingress → nave-objective → oath-gate → final-gate` | The S-bent nave prevents a single clean sightline and makes each turn feel like a changed answer. |
| Optional escape/detour | `abyss-chancel:optional-detour`: `detour-entry → vestry-cache → detour-exit` | The lower vestry route avoids the central oath pressure, then rejoins near the apse without becoming a secret objective system. |
| Routed encounter gates | `chancel-nave-advance` (corridor, wave slots 0–3) → `chancel-transept-lock` (arena, 4–9) | Advance teaches the real nave axis; the lock weaponizes the crossing flank. |
| Dense silhouette | `bent-nave-colonnade`; six authored obstacles including oath apse, nave seal, paired colonnades, vestry debris, and apse wing | Paired forms resemble mirrors while their asymmetric placement reveals which geometry is real. |
| Visibility staging | `apse-light-anchor`, `nave-light-anchor`, `nave-fog-break` | Motivated light separates the real relic and blade from offset mirror shards. |
| Intermediate gate | `abyss-chancel:oath-gate` waypoint plus `chancel-oath` occupation | Reversing the oath opens the next route; no dialogue answer changes state. |
| Binding point | `chancel-bind`; `abyss-chancel:oath-relic` | The same lens that multiplies false paths becomes the binding focus for `rift-lens`. |
| Ambient witness | `abyss-chancel:veil-lookout` | Its fixed attention toward the apse suggests that the answer is behind the player, not ahead. |
| Stage VFX | `abyss-chancel:mirror-static` / `abyss-chancel-mirror-static` | Twin scan rings and offset mirror shards replace the intact lantern image. The stage reflects light rather than owning it. |

### 4.2 Routed encounter and intermediate reveal

- `STAGE_STARTED` begins along the S-bent `abyss-chancel:critical-route` and lets the apse remain occluded until the intro settles.
- `STAGE_ENCOUNTER_ROUTES["abyss-chancel"]` assigns slots 0–3 to `chancel-nave-advance` and 4–9 to `chancel-transept-lock`, with commitment cap 4, maximum 9 concurrent enemies, and 24-tick spawn staggering.
- Ten doctrine waves rotate `rusher → flanker → ranged` from `W`, `SW`, and `NW`. Big waves favor the `chancel-transept` flank; the mid wave uses a flanker-based midboss. Mirrored entries are presentation only.
- Clearing each encounter gate grants one authored recovery beat. A stalled gate follows its deterministic retry/recovery data before the same corridor or arena resumes; it does not skip ahead to Echo recovery.
- Each `WAVE_VARIANT_STARTED` can light only the actual `spawnDirection`. The lower `abyss-chancel:optional-detour` may guide the player through `vestry-cache` to `detour-exit`, but it may not show a reflected lane as safe.
- `ELITE_CANDIDATE_AVAILABLE` identifies the `s2-veil-sentinel` state and opens the possibility of the `rift-lens` record.
- `OCCUPATION_CAPTURED` at `chancel-oath` commits the boss route. The reveal is that the oath controls access, while the mirror only records who accepts it.
- If the downstream route collapses, `M4_RECOVERY_CHECKPOINT` or `M4_FALLBACK` identifies `chancel-nave` as the escape line.
- `BOSS_SPAWNED` places the Veil Tactician between the real oath relic and its offset reflections; boss defeat opens `chancel-bind`.
- `EXTRACTION_COMPLETED` / `ELITE_EXTRACTED` makes the former lens an allied reach record. `GROWTH_OFFER` / `SKILL_SELECTED` remains a mechanical build decision rather than a dialogue branch.

### 4.3 Dialogue scenario

1. **Veil Tactician:** “또 같은 등불, 또 같은 서약.”
2. **Dusk Warden:** “거울 속 손이 나보다 먼저 움직였다.”
3. **Veil Tactician:** “그들은 모두 자기 빛을 길이라고 불렀다.”
4. **Dusk Warden:** “나는 답을 고르러 온 게 아니다. 질문을 끝내러 왔다.”
5. **Veil Tactician, boss turn:** “그렇다면 왕좌도 너를 분류하지 못하겠군.”

### 4.4 Boss-turn twist and gameplay link

At `OBJECTIVE_COMPLETED: boss-kill`, the mirrors stop copying the current Dusk Warden and hold the silhouettes of earlier bearers. The Tactician was not trying to protect the answer; he was waiting for a bearer who could invalidate it. The `TERMINAL` aftermath opens the existing route toward Echo Throne.

- **Skill:** the chosen skill is the Warden's refusal to repeat an earlier build verbatim; it remains `SKILL_SELECTED` / `SKILL_CAST`, not a conversation choice.
- **Item:** `ward-splinter` is the stage item surface, confirmed only by `ITEM_COLLECTED`.
- **Extraction:** `rift-lens` turns deceptive reflection into greater squad reach without adding a mirror-control mechanic.
- **Reward:** existing offers remain `rift-lens-archive`, `anchor-shard-archive`, and `abyssal-banner`.

---

## 5. Stage Three — Echo Throne (`echo-throne`)

### 5.1 Dense world plan

The Echo Throne is an empty court arranged to make every forward action return through the same aisle.

| Layer | Existing authored surface | Story use |
|---|---|---|
| Critical traversal | `echo-throne:critical-route`: `ingress → aisle-objective → dais-gate → final-gate` | The axial court returns every advance to the same throne sightline. |
| Optional escape/detour | `echo-throne:optional-detour`: `detour-entry → gallery-cache → detour-exit` | The upper whisper-gallery path gives a lateral recovery read while preserving the throne as the orientation anchor. |
| Routed encounter gates | `throne-aisle-break` (corridor, wave slots 0–5) → `throne-dais-stand` (arena, 6–10) | Breaking the aisle gets the Warden into the court; standing at the dais proves the court can be claimed without owning the throne. |
| Dense silhouette | `axial-crescent-court`; six authored obstacles including fractured dais, echo aisle, paired fractured wings, gallery debris, and crown shard | Crescent wings focus the eye on the empty throne while broken symmetry makes recurrence feel unstable. |
| Visibility staging | stage-authored throne light anchors and fog break | The dais remains readable through dense pressure, and the optional gallery never becomes an off-screen damage lane. |
| Intermediate gate | `echo-throne:dais-gate` waypoint plus `throne-domain` occupation | The court domain opens; the throne itself remains narratively unowned. |
| Binding point | `throne-bind`; `echo-throne:dais-relic` | The caged lantern image and binding point occupy one dramatic axis without becoming a new objective. |
| Ambient witness | `echo-throne:throne-lookout` | Its fixed watch over the court makes the absent ruler conspicuous. |
| Stage VFX | `echo-throne:fracture-echo` / `echo-throne-fracture-echo` | A caged lantern core, three echo rings, and crown-like fractures make the title image visibly captive. |

### 5.2 Routed encounter and intermediate reveal

- `STAGE_STARTED` travels down the axial `echo-throne:critical-route` and ends with the empty dais centered beyond the commander.
- `STAGE_ENCOUNTER_ROUTES["echo-throne"]` assigns slots 0–5 to `throne-aisle-break` and 6–10 to `throne-dais-stand`, with commitment cap 4, maximum 10 concurrent enemies, and 15-tick spawn staggering.
- Eleven doctrine waves rotate `flanker → ranged → guardian` from `W`, `SW`, and `NW`. Big waves pressure `throne-aisle`; the mid wave uses a guardian-based midboss. This remains the densest canonical plan by wave count.
- Clearing each gate grants one deduplicated authored recovery beat; deterministic stall recovery retries the same gate before the existing Echo/occupation/boss/extraction chain resumes.
- `WAVE_VARIANT_STARTED` establishes the real attack direction. The upper `echo-throne:optional-detour` may route through `gallery-cache`, but any visual or audio echo must follow emitted actions and may not schedule a second hit.
- `ELITE_CANDIDATE_AVAILABLE` exposes `s3-throne-wraith` as a recoverable state and points toward `throne-echo`.
- `OCCUPATION_CAPTURED` at `throne-domain` commits the throne assault. The intermediate reveal is that the court can be claimed, but the throne cannot be owned.
- `M4_RECOVERY_CHECKPOINT` or `M4_FALLBACK` names `throne-aisle` as the downstream escape route. The aisle stays visible even under stage fog.
- `BOSS_SPAWNED` brings the Gate Sovereign into the empty seat's axis; `BOSS_ATTACK_TELEGRAPHED` remains the authority for danger timing.
- Boss defeat opens `throne-bind`; `EXTRACTION_COMPLETED` / `ELITE_EXTRACTED` binds `throne-echo`, leaving a readable record of recurrence rather than a new time-rewind system.

### 5.3 Dialogue scenario

1. **Gate Sovereign:** “마침내 내가 놓았던 등불을 네가 들고 왔다.”
2. **Dusk Warden:** “당신이 왕좌의 주인인가?”
3. **Gate Sovereign:** “아니다. 왕좌가 나의 주인이다.”
4. **Dusk Warden:** “그렇다면 군주가 아니라 명령을 끊겠다.”
5. **Gate Sovereign, boss turn:** “명령이 끊겨도, 왕좌가 사라지는 것은 아니다.”
6. **Dusk Warden, aftermath:** “왕좌는 비었다. 그런데 명령은 내 등불 안에서 계속된다.”

### 5.4 Boss-turn twist and gameplay link

At `OBJECTIVE_COMPLETED: boss-kill`, the Sovereign's silhouette separates from the throne fractures for one readable beat. He was the last bearer consumed by the command, not its author. `TERMINAL: FINAL_COMPLETION` ends the current three-stage campaign; the hook concerns the surviving command, not an unannounced Stage Four.

- **Skill:** every `SKILL_CAST` answers the returning pattern with player timing. Presentation may echo its light but never replay its damage.
- **Item:** `echo-compass` is the stage item surface, confirmed by `ITEM_COLLECTED`.
- **Extraction:** `throne-echo` is a record of recurrence, not a rewind or resurrection mechanic.
- **Reward:** existing offers remain `throne-echo-record`, `veil-vanguard-legacy`, and `stillwater-hourglass`.

---

## 6. Camera, VFX, and Game-Sound Beat Sheet

All presentation is event-driven and read-only. Stage-specific treatment may key off the `stageId` already present at `STAGE_STARTED`; it must not emit a replacement combat event.

| Beat | Runtime surface | Camera staging | Stage VFX direction | Audio direction and existing cue |
|---|---|---|---|---|
| Cinder approach | `STAGE_STARTED:cinder-span` | Use the authored 90-tick intro from distance 6 / azimuth −0.24 / polar −0.34, ending on commander authority. Reveal forge arch before seal. | Keep `cinder-span-ember-wake` core and seal ring readable; ash decor stays behind telegraphs. | `stage-start`; dry ash and one distant chain drag may color ambience, but the event cue remains authoritative. |
| Cinder routed wave | `WAVE_VARIANT_STARTED`, `ENEMY_SPAWNED` | Small route-leading pan inside commander-follow bounds; no cut away from immediate threats. Big-wave framing may pull back only within the camera contract. | Ember wake leans toward the emitted `spawnDirection`; it never marks a false lane. | Combat cues remain `weapon-fire`, `impact-hit`, `enemy-defeated`; do not add a second wave-timing authority. |
| Cinder bind | `OCCUPATION_CAPTURED` → `EXTRACTION_*` | Hold seal and binding point in one frame; if escape is needed, bias the look toward `cinder-center`. | Seal ring closes, then the extraction core rises only on emitted progress/completion. | `occupation-captured` → `extraction-ready` → `elite-extracted`. |
| Cinder boss turn | `BOSS_SPAWNED` → `TERMINAL` | Use the camera contract's boss-entry orbit only at spawn; aftermath settles on released chains and broken retreat. | Intact lantern silhouette sheds its outer ember wake; core remains. | `boss-spawned`; terminal victory cue after outcome, with chain release as presentation foley rather than a gameplay signal. |
| Chancel approach | `STAGE_STARTED:abyss-chancel` | Use the authored 96-tick intro from distance 6.4 / azimuth 0.3 / polar −0.3. Keep the apse partly occluded until settle. | `abyss-chancel-mirror-static` shows one real lens and offset shards; no false hazard decals. | `stage-start`; violet static and a narrow reversed choral tail may color ambience without masking cues. |
| Chancel routed wave | `WAVE_VARIANT_STARTED`, `ENEMY_POLICY_SELECTED` | Favor the emitted W/SW/NW route just enough to preserve transept orientation; commander stays the authority target. | Only the actual route gets the bright scan ring; reflections stay lower value and saturation. | Existing combat cue family; stereo reflection may follow the same event but cannot precede it. |
| Chancel bind | `OCCUPATION_CAPTURED` → `EXTRACTION_*` | Frame `chancel-oath` and `chancel-bind`; recovery framing points to `chancel-nave` only when the recovery/fallback event names it. | Scan rings align at occupation capture; mirror shards collapse toward the lens at extraction completion. | `occupation-captured` → `extraction-ready` → `elite-extracted`; interrupted/rejected states retain `impact-hit`. |
| Chancel boss turn | `BOSS_SPAWNED` → `TERMINAL` | Boss-entry orbit resolves on the real Tactician, then aftermath holds earlier Warden silhouettes as static reflections. | Mirror static stops tracking the commander after terminal; it must not obscure the boss or telegraphs before then. | `boss-spawned` then terminal victory; no combat dialogue relay over the boss pattern. |
| Throne approach | `STAGE_STARTED:echo-throne` | Use the authored 102-tick intro from distance 6.8 / azimuth −0.4 / polar −0.28. Travel down the aisle and preserve the empty dais in depth. | `echo-throne-fracture-echo` holds a caged core and three rings; crown fractures remain decorative. | `stage-start`; a low, delayed room response may color ambience, never duplicate combat timing. |
| Throne routed wave | `WAVE_VARIANT_STARTED`, `MIDBOSS_SPAWNED` | Preserve the aisle and south escape in frame at dense beats. No flourish may hide the safe lane or telegraph. | Echo rings respond to emitted attacks only. They may trail a visual afterimage, never schedule damage. | Existing `weapon-fire`, `impact-hit`, and `boss-spawned` for midboss/boss surfaces as already mapped. |
| Throne bind | `OCCUPATION_CAPTURED` → `EXTRACTION_*` | Claim the domain in foreground with the empty dais behind; recovery bias follows `throne-aisle`. | Outer rings align at occupation capture; innermost ring persists after extraction to foreshadow the surviving command. | `occupation-captured` → `extraction-ready` → `elite-extracted`. |
| Throne finale and hook | `BOSS_SPAWNED` → `OBJECTIVE_COMPLETED:boss-kill` → `TERMINAL:FINAL_COMPLETION` | Boss-entry orbit; readable defeat separation; final static composition of Dusk Warden, empty dais, caged core. | Crown fractures dim on terminal while the innermost ring remains. This is aftermath presentation, not live state. | `boss-spawned` then the existing `terminal:TERMINAL:FINAL_COMPLETION` rising cue profile. Preserve its distinction from ordinary victory. |

### 6.1 Accessibility and reduced motion

- Stage VFX uses the existing `core-static` reduced-motion policy: keep the core/readable ring, hide drift and motes.
- Replace boss-entry orbit with the camera contract's static three-frame crossfade; never remove the boss silhouette or telegraph.
- Dialogue lines receive Korean text alternatives and speaker labels. They are not baked into active-combat VFX.
- Sound never carries unique objective information. UI label, icon, route marker, and event state remain available without audio.
- The final hook still reads in one static frame: empty dais, Dusk Warden, persistent inner ring.

---

## 7. Final Echo Throne Hook

The campaign is complete when the simulation emits `TERMINAL` with `FINAL_COMPLETION`. After that outcome—never before—the aftermath record may present the Dusk Warden's final line:

> **Dusk Warden:** “왕좌는 비었다. 그런데 명령은 내 등불 안에서 계속된다.”

The caged core's innermost ring remains visible while the throne itself is empty. If the player later selects `throne-echo-record`, the lobby archive may preserve this same line as the record description; selecting it must not unlock a hidden stage or modify the completed outcome. The hook leaves a question for future narrative work while respecting `Echo Throne` as the current campaign ending.

---

## 8. Implementation Handoff

| Owner | Implementable handoff | Existing authority/surfaces | Acceptance proof for that owner |
|---|---|---|---|
| Level | Compose the authored silhouette, critical route, optional detour, obstacle field, visibility anchors, occupation point, binding point, landmarks, props, ambient VFX, and lookout listed in §§3–5. Preserve every waypoint role and keep detour exits and recovery lanes visible. | `stage-world-catalog.js#gameplay.routes`, `#presentation.silhouette`, `#visibilityAnchors`; `STAGE_TACTICS`; `STAGE_PLAN_DESCRIPTORS[*].m4Plan` | Stage capture shows the exact `critical-route` and `optional-detour` IDs plus their intermediate objective/gate waypoints; no parallel route source is introduced. |
| Encounter | Preserve each `STAGE_ENCOUNTER_ROUTES` corridor→arena objective order, wave-slot ownership, commitment/concurrency caps, spawn staggering, deduped clear recovery, deterministic stall retry, doctrine classes/directions, and boss ID. Do not derive spawns from synopsis timing. | `defense-catalog.js#STAGE_ENCOUNTER_ROUTES`, `#STAGE_WAVE_DOCTRINE`, `#STAGE_TACTICS`; existing wave/objective events | Event trace shows each authored encounter objective owns only its wave slots, recovers once on clear, and cannot skip the existing Echo/occupation/extraction/boss chain. |
| Camera | Bind approach, routed-pressure, occupation/extraction, boss-entry, and aftermath staging to emitted events. Commander remains authority target; safe lane and telegraphs stay visible. | `stage-world-catalog.js#presentation.cinematic`; `camera-vfx-direction.md`; events in §2.3 | Normal and reduced-motion captures preserve commander, objective, threat, and safe lane without a camera-authored state transition. |
| VFX | Use the stage-specific ambient IDs exactly as listed. Change emphasis by event, but never create false lanes, hazards, hits, extraction progress, or boss repeats. | `presentation.vfxCues`; `cinder-span-ember-wake`, `abyss-chancel-mirror-static`, `echo-throne-fracture-echo` | VFX responds only after matching events and `core-static` remains informative under reduced motion. |
| Audio | Keep the existing cue chain: `stage-start`; combat cues; `occupation-captured`; `extraction-ready`; `elite-extracted`; `boss-spawned`; terminal variant. Add stage timbre only in the presentation layer keyed by stage context. | `defense-audio.js#EVENT_CUE_IDS`, `#CUE_PROFILES`, `#CUE_VARIANTS` | Event-to-cue trace proves one semantic cue per emitted event and distinguishes final completion from ordinary victory. |
| UI | Surface Korean dialogue in approach/confrontation/aftermath records and accessible fallback, not as an active-combat text relay. Keep objective IDs internal while using stage-specific Korean labels. Reveal recovery route only from recovery/fallback events. | `CUTSCENES`; `lobby-story-presentation-spec.md`; events/objectives in §2 | Three dialogue lines minimum per stage are readable with speaker labels; combat remains unobscured; locked aftermath stays spoiler-safe. |

---

## 9. Contract Check

| Requirement | Coverage |
|---|---|
| Three canonical stages in order | §§3–5: `cinder-span → abyss-chancel → echo-throne` |
| Named player and antagonist pressure | §1: Dusk Warden; Gate Sovereign's repeated command, without puppeteering the other bosses |
| One escalating mystery per stage | §1.3 and each stage's boss-turn section |
| Environmental storytelling | §§3.1, 4.1, 5.1 using only authored world IDs |
| Intermediate objective/gate reveals and escape routes | §§2.2, 3.2, 4.2, 5.2 |
| Routed enemy wave encounters | §§3.2, 4.2, 5.2 using doctrine classes, directions, pressure lanes, and midboss classes |
| Gameplay-to-story links | §§3.4, 4.4, 5.4 for skill, item, extraction, reward |
| At least three Korean dialogue lines per stage | Cinder 5; Chancel 5; Throne 6 |
| Camera/VFX/audio direction | §6, including reduced-motion and event authority |
| Final Echo Throne hook | §7, after `FINAL_COMPLETION`, without a fourth-stage claim |
| Owner handoff | §8: level, encounter, camera, VFX, audio, UI |

This file is a design handoff only. It makes no claim that the new dialogue, stage timbres, camera beats, or aftermath turns are implemented.