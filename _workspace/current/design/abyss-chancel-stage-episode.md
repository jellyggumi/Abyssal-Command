# Abyss Chancel Stage Episode / 심연의 성전 무대 에피소드

```yaml
run_id: 20260730-abyss-chancel-episode
status: "[TARGET] — webtoon-harness stage scenario with dialogue, objectives, and progression handoff"
episode: "Stage 2: The Oath That Copies"
protagonist: "Dusk Warden"
antagonist: "Veil Tactician (s2-veil-tactician)"
extracted_companion: "rift-lens (from s2-veil-sentinel)"
stage_item_surface: "ward-splinter"
progression_gate: "chancel-oath → chancel-bind"
target_language: "Korean dialogue; English stable IDs"
scope: |
  One NPC-acquired quest, 4 nested objectives, dialogue-driven tension and reversal at boss turn,
  skill extraction beat, wearable appearance reward, motion/VFX/audio cues mapped to existing events.
non_scope: |
  Runtime code edits, quest state machine, new event types, dialogue choice branches, Stage 3 content,
  mirror-control mechanics, image generation, vertical movement.
authority:
  - stage-world-catalog.js (world placement)
  - defense-catalog.js (encounter routing, objective IDs, items, rewards)
  - defense-run-simulation.js (event emission, progression state)
  - abyssal-lantern-world-synopsis.md (narrative spine and boss-turn twist)
  - action-combat-spec.md (motion/VFX/audio semantics)
implementation_handoff:
  - Dialogue text (KR): accessible record in lobby story archive
  - Quest giver NPC (optional): if quest system is runtime-owned, specify NPC id + dialogue trigger
  - Wearable appearance: if appearance system exists, assign `abyss-chancel-ward` item ID
  - Skill extraction: use existing `EXTRACTION_WINDOW_OPENED` + `ELITE_EXTRACTED` events
  - VFX/audio beats: wire existing cues to listed event surfaces
```

---

## 1. Stage Context & Mystery

### 1.1 The Warden's arrival

The Dusk Warden descends the Cinder Span's broken bridge and enters the Abyss Chancel—a vaulted nave bent by S-curves, flanked by paired colonnades that resemble mirrors more than pillars. The silence is immediate: no movement, no warning of entry. The oath-relic glows alone at the apse, distant but readable through the fog-break. Everything else is reflection.

**Mystery posed:** Why do the mirrors answer before the Dusk Warden moves?

### 1.2 Narrative axis

| Narrative layer | Existing thematic surface | Episode contribution |
|---|---|---|
| **Spatial** | Bent nave; mirror-like colonnades; offset relic and shards | S-bends force the Warden to choose which path is real; paired forms become a visual metaphor for choice |
| **Temporal** | Veil Tactician watches with fixed attention | The Tactician has classified every bearer who came before and is waiting for one who will differ |
| **Emotional** | The Warden has killed one ancestor and found he held up a bridge | The Warden must refuse the repeated answer without knowing what the repeated answer is |

---

## 2. NPC Quest Acquisition: The Chancel Witness

### 2.1 Quest giver

**ID:** `npc:chancel-witness` (neutral scholar/oracle figure, voice only, stationed at the apse)
**Trigger:** `STAGE_STARTED: abyss-chancel`
**Type:** Voluntary contextual dialogue (player may dismiss before stage combat)

### 2.2 Acquisition dialogue sequence

**[CHANCEL WITNESS]**

> "등불을 들었군요. 여섯 번째 손이 같은 길을 걷고 있습니다."
> *(The lantern bearer arrives. A sixth hand now treads the same path.)*

**[DUSK WARDEN, if spoken to]**

> "내 앞의 손들은 뭘 했나요?"
> *(What did the hands before me do?)*

**[CHANCEL WITNESS]**

> "그들은 모두 oath를 되풀이했습니다. 거울 속 손이 보여주는 대로요. 당신도 그럴 건가요?"
> *(They all repeated the oath shown by the hand in the mirror. Will you do the same?)*

**[QUEST ACQUIRED: Refuse the Repeated Answer]**

```yaml
quest_id: "abyss-chancel:refuse-repeated-answer"
quest_giver: "npc:chancel-witness"
stage: "abyss-chancel"
condition_trigger: "OCCUPATION_CAPTURED: chancel-oath"
condition_description: "Reach and hold the oath-gate without following the mirror's prescribed answer"
reward_surface: "progression-badge:mirror-refusal"
reward_flavor_text: "당신의 서약이 거울을 깨뜨렸다. (Your oath shattered the mirror.)"
optional: true
note: |
  This quest is narrative-flavor only. It mirrors the existing occupation progression
  (chancel-oath capture) and unlocks an invisible progression badge that may gate
  future cosmetics or dialogue variations. It does not add a new objective or block stage completion.
```

---

## 3. Four Nested Objectives: The S-Bend Choice

Each objective is mapped to an existing encounter gate, occupation, or final event. The narrative reads progression as the Warden choosing a different path at each moment of reflection.

### 3.1 Objective One: Nave Advance (Gate-Defense Pressure)

**Encounter gate:** `chancel-nave-advance` (slots 0–3)
**Spatial marker:** First S-bend; flanked colonnades begin to cast shadows
**Narrative beat:** *"A test of reading the real path"*

**Event chain:**
1. `STAGE_STARTED: abyss-chancel` → Intro camera settles on the bent nave
2. `WAVE_VARIANT_STARTED` (slot 0) → First enemies enter from W/SW
3. `ENEMY_SPAWNED` → Enemies move through the first S-bend
4. `ENCOUNTER_OBJECTIVE_COMPLETED: chancel-nave-advance` → First pressure breaks

**Motion/VFX/audio:**
- **VFX:** `abyss-chancel-mirror-static` begins with a single bright scan ring; only the real W/SW ingress is illuminated
- **Audio:** `stage-start` cue fades into `active-wave` with a narrow reversed choral tail (ambience, not combat)
- **Motion:** Enemies show, then run along the routed path; Warden may move freely

**Dusk Warden internal monologue (narrative note only, not a spoken line):**

> "처음 굽이에서. 다섯 개의 손이 같은 선택을 했다. 거울 속 손도. 우리가 다른 길을 갈 수 있을까?"
> *(At the first bend. Five hands made the same choice. So did the one in the mirror. Can we take a different path?)*

---

### 3.2 Objective Two: Transept Lock (Secondary Gate-Defense)

**Encounter gate:** `chancel-transept-lock` (slots 4–9)
**Spatial marker:** Second S-bend opens into the transept flank; three ingress directions converge
**Narrative beat:** *"The choice multiplies"*

**Event chain:**
1. `ENCOUNTER_OBJECTIVE_STARTED: chancel-transept-lock` → Camera eases toward the apse
2. `WAVE_VARIANT_STARTED` (slots 4–9) with policy rotation (W, SW, NW) → Pressure increases from three directions
3. `MIDBOSS_SPAWNED` (flanker-based midboss at slot ~6) → A single elite form echoes across the transept
4. `ENCOUNTER_OBJECTIVE_COMPLETED: chancel-transept-lock` → The field falls silent

**Motion/VFX/audio:**
- **VFX:** Mirror-static scan rings brighten; offset shards begin to shimmer, but only the real ingress routes are illuminated; false paths remain shadowed
- **Audio:** `warning-pulse` (priority 64) for each W/SW/NW direction cue; midboss uses `warning-pulse` (priority 82)
- **Motion:** Flanker midboss enters with a scouting run pattern, then defensive positioning; on defeat, one smooth fade-to-idle

**Chancel Witness internal observation:**

> "두 번째 굽이에서. 이제 거울이 흔들린다. 그 위의 손이 당신의 손을 따라가려고 애쓴다. 아직도?"
> *(At the second bend. The mirror begins to waver. The hand above tries to follow yours. Still?)*

---

### 3.3 Objective Three: Oath Capture (Occupation & Reversal)

**Encounter gate:** `chancel-oath` (occupation)
**Spatial marker:** The apse opens; the oath-relic glows at the center; mirrors frame it on both sides
**Narrative beat:** *"The moment of refusal"*

**Event chain:**
1. `ENCOUNTER_OBJECTIVE_STARTED` implicitly (after transept-lock; no explicit event yet, but the stage advances) → Camera bias toward apse
2. `OCCUPATION_PROGRESS` → Warden claims the oath-relic; mirrored images flicker and desynchronize
3. `OCCUPATION_CAPTURED: chancel-oath` → The mirrors stop moving; they hold silhouettes of five earlier bearers
4. **[REVERSAL BEAT]** Veil Tactician voice emerges: *"그렇다면 왕좌도 너를 분류하지 못하겠군."* *(Then the throne cannot classify you either.)*

**Motion/VFX/audio:**
- **VFX:** Mirror-static scan rings collapse toward the oath-relic; offset shards shatter silently; the scan rings reform as five concentric rings, each one holding a frozen silhouette in profile (visual proof of earlier bearers)
- **Audio:** `occupation-captured` cue (existing) transitions into a reversal sting: low, sustained tone that fades the ambient choral tail; the Tactician's voice emerges over a brief silence
- **Motion:** Warden reaches the relic and plants a stance (idle with raised hand); if an enemy is nearby, the Warden defends rather than attacking

**Narrative significance:**

The oath-capture is the Warden's explicit refusal. He does not repeat the answer; he claims the oath-relic itself, breaking the cycle. The mirrors—which have been reflecting current action—now reveal they were always recording past action. The Veil Tactician's surprise is not that the Warden fought well, but that the Warden broke the classification system.

---

### 3.4 Objective Four: Boss Confrontation & Extraction (Boss-Kill + Finale)

**Encounter route:** `encounter-path:abyss-chancel:boss-kill`
**Boss:** `s2-veil-tactician` (The Veil Tactician, the classifier consumed by classification)
**Spatial marker:** The dais at the apse center; the five mirror rings persist above
**Narrative beat:** *"Proof of recurrence without repetition"*

**Event chain:**
1. `BOSS_SPAWNED: s2-veil-tactician` → Boss enters along the boss-kill route; the five mirror rings brighten
2. `BOSS_ATTACK_TELEGRAPHED` (each pattern) → Telegraph shows the Tactician's attack shape in the rings above as well (visual echo, no damage)
3. `SKILL_CAST` (Warden skill) → The chosen skill illuminates one ring; the other four darken (Warden's refusal to be one of five)
4. `BOSS_ATTACK_CANCELLED` or `CRITICAL_HIT` → Tactician staggers; one mirror ring shatters (proof the pattern can break)
5. `OBJECTIVE_COMPLETED: boss-kill` → Final ring shatters; the Tactician's silhouette falls; no more mirrors answer
6. **[BOSS-TURN TWIST]** Veil Tactician's final line: *"거울이 깨져도, 왕좌가 사라지는 것은 아니다."* *(Even if the mirrors shatter, the throne remains.)*

**Motion/VFX/audio:**
- **VFX:** Fracture echo replaces mirror-static; three concentric echo rings persist; on skill cast, the ring matching the Warden's chosen skill glows and spreads; on boss defeat, the innermost ring holds a ghostly Tactician silhouette (proof of recurrence, not a second boss)
- **Audio:** `boss-spawned` cue (priority 90) then `active-wave` loop; each attack telegraph uses `warning-pulse` (priority 88); boss defeat uses the terminal victory rising cue (priority 100)
- **Motion:** Tactician opens with a defensive stance, then cycles attack → reaction → reposition; on each critical hit, the Tactician performs `bighit` fade and briefly `defence` before returning to stance; on final defeat, a held `hit` transition to partial collapse, then the silhouette fades

---

## 4. Skill Extraction Beat & Companion Binding

### 4.1 Skill Extraction Unlock

**Trigger:** `BOSS_SPAWNED: s2-veil-tactician` (explicitly, the boss spawning unlocks the possibility)

**Routed objective:** `encounter-path:abyss-chancel:echo-recovery`

**Event sequence:**
1. During boss phase, `ELITE_CANDIDATE_AVAILABLE` is emitted if `s2-veil-sentinel` (flanker elite) has been encountered and not yet extracted
2. Player may trigger `EXTRACT_ELITE` during the boss fight or after boss defeat, before `EXTRACTION_WINDOW_OPENED`
3. `EXTRACTION_WINDOW_OPENED` authorizes the final binding route to `chancel-bind`
4. `EXTRACTION_PROGRESS` → Warden channels the binding (visual: the oath-relic rises, pulling the elite silhouette into form)
5. `EXTRACTION_COMPLETED` → `rift-lens` companion record is bound

**Motion/VFX/audio:**
- **VFX:** The oath-relic core rises; the echo rings collapse inward; the elite silhouette (veil-sentinel form) crystallizes as a lens-shaped companion form
- **Audio:** `extraction-ready` cue, then `elite-extracted` (existing surface from action-combat-spec)
- **Motion:** Warden holds a reaching pose; the elite shows a brief stabilize animation, then transforms into the companion lens shape

**Extracted companion ID:** `rift-lens`

**Lore flavor:**
> "거울을 깨뜨린 그 순간, 거울 안의 렌즈가 진짜가 되었다."
> *(The moment the mirrors shattered, the lens inside the mirror became real.)*

---

## 5. Wearable Item Reward: Oath-Breaker Ward

### 5.1 Item acquisition

**Item ID:** `abyss-chancel-ward` (wearable appearance item, ward slot)

**Trigger:** `OBJECTIVE_COMPLETED: boss-kill` (automatic reward grant on boss defeat)

**Acquisition surface:** `ITEM_COLLECTED` event with `itemId: abyss-chancel-ward`

**Appearance description:**
- **Base form:** A cracked mirror shard bound in pale cord, forming a wrist-guard or shoulder-guard silhouette
- **Visual effect in-world:** When equipped, the Warden's ward slot displays a faint, fragmentary reflection of the last enemy attacked (visual-only, no gameplay impact)
- **Thematic link:** The broken mirrors from the boss fight reforged into one refusal-token

### 5.2 Item progression

**Tier:** Wearable cosmetic (not part of the equipment tier ladder; purely appearance)

**Lore text:**
> **Oath-Breaker Ward** / 서약 거부의 보호구
> "거울을 깨뜨린 손이 이제 그 조각을 들었다. 반복하지 않겠다는 誓い (일본어: 서약)로."
> *(The hand that shattered mirrors now holds their shards. A pledge never to repeat.)*

### 5.3 Flavor & accessibility

- The item is automatically offered to the Warden after `OBJECTIVE_COMPLETED: boss-kill`
- If the Warden already owns an appearance item in the ward slot, the `abyss-chancel-ward` is stored in the item archive as a selectable alternative
- No quest gate or choice blocks the item; it is a direct reward for completing the stage

---

## 6. Progression & Equipment Rewards

### 6.1 Stage completion reward pool

**Existing reward surface:** `STAGE_REWARD_IDS["abyss-chancel"]`

**Available rewards (unchanged):**
- `rift-lens-archive` (companion record deepening; lore text)
- `anchor-shard-archive` (bind-stability progression; utility)
- `abyssal-banner` (campaign cosmetic; visual)

**Selection mechanism:**
- After `EXTRACTION_COMPLETED`, `GROWTH_OFFER` is emitted with three offer slots
- Player chooses one reward; the choice is permanent for this run
- Existing `REWARD_SELECTED` event surfaces the choice to the lobby record

### 6.2 Skill rank carry-over

**Existing surface:** `SKILL_SELECTED` + `SKILL_CAST` during growth phase

- If the Warden acquired a skill in Stage 1, it may be ranked up with echo-core
- New skills are available in the standard growth-offer rotation
- Each skill rank increases damage, reduces cooldown, or strengthens passive (existing ladder applies)

### 6.3 Extraction sequence

**Binding order:**
1. `EXTRACTION_WINDOW_OPENED` after boss defeat
2. Player navigates the binding route to `chancel-bind` (flat world, existing waypoint)
3. `EXTRACTION_PROGRESS` tracks progress along the route
4. `EXTRACTION_COMPLETED` finalizes the companion binding

**Companion record:** `rift-lens`

**Lore entry upon extraction:**
> **Rift Lens** / 틈새의 렌즈
> "Extracted from the Veil Sentinel. Once a reflection of answers, now a companion of refusals."

---

## 7. Motion, VFX, and Audio Beat Sheet

All presentation is event-driven. These are the explicit triggers and visual/sonic responses.

### 7.1 Stage entry to first bend

| Event | Motion intent | VFX direction | Audio cue |
|---|---|---|---|
| `STAGE_STARTED: abyss-chancel` | Warden `show` into idle; commander settle on the nave | Mirror-static begins with single ring, oriented toward the apse; offset shards visible but shadowed | `stage-start`; ambience: sine-led choral tail, dry and high |

### 7.2 Gate-defense pressure (objective 1 & 2)

| Event | Motion intent | VFX direction | Audio cue |
|---|---|---|---|
| `WAVE_VARIANT_STARTED` (slot 0–3) | Spawned enemies `show`, routed locomotion | Mirror-static rings brighten toward emitted spawnDirection; only the real ingress glows; false paths stay low value | `warning-pulse` (priority 64); `active-wave` |
| `MIDBOSS_SPAWNED` | Midboss `show`, then scouting run | All rings brighten briefly; the midboss casts a silhouette across all rings simultaneously | `warning-pulse` (priority 82) |
| `WAVE_CLEARED` (implicit between slots) | Surviving enemies move to next ingress; brief pause | Mirror rings dim to half-brightness during quiet moment | Ambient choral loop continues; no new cue |
| `ENCOUNTER_OBJECTIVE_COMPLETED: chancel-nave-advance` | Enemies transition off-stage or hold ground beyond contest range | Rings stabilize at full brightness | `objective-complete` (reuse priority 64 surface) |

### 7.3 Occupation & reversal (objective 3)

| Event | Motion intent | VFX direction | Audio cue |
|---|---|---|---|
| `OCCUPATION_PROGRESS` | Warden approach and stance plant | Mirror shards begin to shimmer and desynchronize | No new cue; ambience sustains |
| `OCCUPATION_CAPTURED: chancel-oath` | Warden planted stance (reach/raise); nearby enemies `defence` or hold | Mirror shards shatter silently; five concentric scan rings collapse inward and reform, each holding a frozen bearer silhouette in profile; rings remain in place | `occupation-captured` (existing); Veil Tactician voice line over a held silence (priority 85) |

**Veil Tactician's reversal line (emitted as a story dialogue surface, not gameplay voice):**

> **s2-veil-tactician:** "그렇다면 왕좌도 너를 분류하지 못하겠군."
> *(Then the throne cannot classify you either.)*

This line is text-based in the lobby story archive; it may be read aloud in a separate audio channel if the UI supports it, but it does not interrupt active combat.

### 7.4 Boss confrontation & extraction (objective 4)

| Event | Motion intent | VFX direction | Audio cue |
|---|---|---|---|
| `BOSS_SPAWNED: s2-veil-tactician` | Boss `show`, then defensive stance | Fracture echo replaces mirror-static; three echo rings establish around the boss; Tactician silhouette reads as solid (not a reflection) | `boss-spawned` (priority 90); brief stinger, then `active-wave` resumes |
| `BOSS_ATTACK_TELEGRAPHED` | Telegraph shows, boss prepares | The emitted attack pattern echoes in one ring above the boss; no damage, only visual feedback | `warning-pulse` (priority 88) |
| `SKILL_CAST` (Warden) | Warden action clip plays (semantic motion matched to skill) | One echo ring glows to match the skill's elemental tone; other rings dim slightly (visual proof the Warden is choosing, not repeating) | `skill-cast`; skill-specific VFX attachments remain semantic |
| `CRITICAL_HIT` or `SKILL_RESOLVED_DAMAGE` | Boss `bighit`, then reaction | The glowing ring shatters; another echo ring breaks; silhouettes fade from the remaining rings | `critical-hit` (priority 68) or `impact-hit` |
| `OBJECTIVE_COMPLETED: boss-kill` | Boss held death pose; Warden idle; no auto-attack | Final echo ring shatters; the innermost ring persists faintly with a ghostly Tactician form (not a threat, only a memory) | Terminal victory cue (priority 100); rising stinger that fades to silence |

### 7.5 Extraction window & binding

| Event | Motion intent | VFX direction | Audio cue |
|---|---|---|---|
| `EXTRACTION_WINDOW_OPENED` | No change; combat state cleared | Oath-relic begins to glow and rise; the innermost echo ring pulses in sync with the rising relic | `extraction-ready` (existing surface) |
| `EXTRACTION_PROGRESS` | Warden channels binding (raised pose); elite silhouette crystallizes | Relic rises fully; elite form assembles around the glowing core; echo rings collapse inward toward the relic | Fading active-wave loop; subtle crystallization texture |
| `ELITE_EXTRACTED` / `EXTRACTION_COMPLETED` | Elite transforms into companion `rift-lens` form (lens-shaped silhouette) | Relic stabilizes; echo rings align as one unified lens structure; the companion form settles into stance | `elite-extracted` (existing) |

---

## 8. Dialogue Accessibility & Spoiler Safety

### 8.1 Korean dialogue script

**Approach (stage entry):**

| Speaker | ID | Korean | English (reference only) |
|---|---|---|---|
| Chancel Witness | `dial:abyss-chancel:witness-greeting` | "등불을 들었군요. 여섯 번째 손이 같은 길을 걷고 있습니다." | "The lantern bearer arrives. A sixth hand now treads the same path." |
| Dusk Warden (optional response) | `dial:abyss-chancel:warden-question` | "내 앞의 손들은 뭘 했나요?" | "What did the hands before me do?" |
| Chancel Witness | `dial:abyss-chancel:witness-answer` | "그들은 모두 oath를 되풀이했습니다. 거울 속 손이 보여주는 대로요. 당신도 그럴 건가요?" | "They all repeated the oath shown by the hand in the mirror. Will you do the same?" |

**Boss turn (reversal):**

| Speaker | ID | Korean | English (reference only) |
|---|---|---|---|
| Veil Tactician | `dial:abyss-chancel:boss-reversal` | "그렇다면 왕좌도 너를 분류하지 못하겠군." | "Then the throne cannot classify you either." |

**Boss defeat (aftermath):**

| Speaker | ID | Korean | English (reference only) |
|---|---|---|---|
| Veil Tactician | `dial:abyss-chancel:boss-final` | "거울이 깨져도, 왕좌가 사라지는 것은 아니다." | "Even if the mirrors shatter, the throne remains." |
| Dusk Warden | `dial:abyss-chancel:warden-aftermath` | "거울을 깨뜨린 건 나다. 그리고 내가 들은 등불은 그것을 반복하지 않을 것이다." | "I shattered the mirrors. And the lantern I carry will not repeat it." |

### 8.2 Presentation surfaces

**Lobby story archive (accessible anytime, after stage unlock):**
- Dialogue lines are readable with speaker labels and flavor text
- No active-combat text overlay obscures the player's controls or field of view
- The reversal and aftermath lines are locked until `OBJECTIVE_COMPLETED: boss-kill` is first observed
- If the Warden selects `rift-lens` or `rift-lens-archive` reward later, the lobby archive deepens with companion lore

**Cutscene / cinematic presentation (post-stage, before lobby):**
- The final aftermath image (Warden, empty dais at distance, persistent inner echo ring) is static
- The Warden's final line may accompany this image as a brief readable caption or optional audio
- The image is skippable; no progression gate blocks its dismissal

---

## 9. Implementation Handoff

### 9.1 Level design (stage-world-catalog.js owner)

**Deliverable:** Preserve `abyss-chancel:critical-route`, `abyss-chancel:optional-detour`, obstacles, visibility anchors, and the four stage waypoints (ingress, oath-gate, binding-point, recovery-lane).

**Acceptance proof:**
- Stage capture shows exact critical-route IDs and intermediate waypoints
- Oath-gate and binding-point remain on elevation 0
- No parallel route source is introduced

### 9.2 Encounter design (defense-catalog.js owner)

**Deliverable:** Preserve each `STAGE_ENCOUNTER_ROUTES["abyss-chancel"]` corridor→arena objective order, wave-slot ownership, commitment cap 4, concurrency cap 9, spawn staggering 24 ticks.

**Acceptance proof:**
- Event trace shows `chancel-nave-advance` (slots 0–3) then `chancel-transept-lock` (slots 4–9) own their waves exclusively
- `chancel-oath` occupation completes only after both gates clear
- `encounter-path:abyss-chancel:boss-kill` opens only after occupation capture

### 9.3 Narrative & dialogue (quest record owner)

**Deliverable:** Place dialogue text in an accessible lobby story record.

**Acceptance proof:**
- Three dialogue lines minimum per stage are readable with speaker labels
- Reversal and aftermath lines are spoiler-locked until boss defeat
- No dialogue output blocks active combat UI

### 9.4 Animation & motion (battle-realtime-three.js owner)

**Deliverable:** Route `STAGE_STARTED`, `WAVE_VARIANT_STARTED`, `OCCUPATION_CAPTURED`, `BOSS_SPAWNED`, `BOSS_ATTACK_TELEGRAPHED`, `SKILL_CAST`, `CRITICAL_HIT`, `OBJECTIVE_COMPLETED: boss-kill`, and `EXTRACTION_*` events to the semantic motion clips for Warden and enemies.

**Acceptance proof:**
- Warden shows `show` at stage entry
- Enemies show and run on `WAVE_VARIANT_STARTED`
- Warden holds a `stance` during occupation capture (no auto-attack)
- Boss `show` then cycles `defensive` stance → `attack` → `reaction` → `attack` chain
- Extraction shows a `channel` pose → `transform` on `EXTRACTION_COMPLETED`

### 9.5 VFX & graphics (presentation layer owner)

**Deliverable:** Wire `abyss-chancel-mirror-static` and `echo-throne-fracture-echo` ambient VFX to stage-specific cues.

**Acceptance proof:**
- Mirror-static shows only real ingress routes as illuminated; false paths remain shadowed
- Five bearer silhouettes appear in the rings after `OCCUPATION_CAPTURED`
- Echo rings respond only to emitted `SKILL_CAST` and `CRITICAL_HIT` events
- Innermost ring persists after `OBJECTIVE_COMPLETED: boss-kill` as a faint silhouette (not a threat)

### 9.6 Audio (defense-audio.js owner)

**Deliverable:** Preserve existing cue surfaces; wire stage-specific timbre to ambient/danger/completion priority slots.

**Acceptance proof:**
- `stage-start` cue at `STAGE_STARTED`
- `warning-pulse` (priority 64) at `ENCOUNTER_OBJECTIVE_STARTED`
- `warning-pulse` (priority 82) at `MIDBOSS_SPAWNED`
- `occupation-captured` cue at `OCCUPATION_CAPTURED`
- `boss-spawned` (priority 90) at `BOSS_SPAWNED`
- Terminal victory cue (priority 100) at `OBJECTIVE_COMPLETED: boss-kill`
- Ambience: sine-led choral tail fades during occupation capture; resumes after reversal

### 9.7 Quest & progression (campaign-state owner, optional)

**If quest system is implemented:**

- Quest ID: `abyss-chancel:refuse-repeated-answer`
- Trigger: `STAGE_STARTED: abyss-chancel` (quest offered; dismissible)
- Condition: `OCCUPATION_CAPTURED: chancel-oath` (quest completes when Warden holds oath-relic)
- Reward: Invisible progression badge (`progression-badge:mirror-refusal`) that may unlock cosmetics in future stages

**If quest system is not yet implemented:**
- Treat this as narrative flavor; the progression badge is implicit in the Warden's refusal to repeat

---

## 10. Wearable Appearance Progression

### 10.1 Ward appearance chain

If an appearance system is in production, the `abyss-chancel-ward` may evolve across future stages.

**Tier 1 (Abyss Chancel):** Cracked mirror shard bound in pale cord; faint reflective shimmer

**Future tiers (design-space only, not in this episode):**
- Tier 2: Shard edges glow faintly (if the Warden equips rift-lens)
- Tier 3: Mirror shard reforms partially; reflection shows the Warden's current form, not past forms

### 10.2 Cosmetic lock

- The `abyss-chancel-ward` is automatically awarded on boss defeat
- It occupies the ward slot until replaced
- If the Warden already owns an appearance item, the new ward is stored as an alternative and may be swapped in the lobby

---

## 11. Narrative Anchor: The Three Mysteries Escalate

| Stage | Mystery | Answer | Turn |
|---|---|---|---|
| Cinder Span | Why does the supposed jailer drag chains that look structural? | The Cinder Warden was holding the bridge up. | Destruction of the retreat opens the descent. |
| Abyss Chancel | Why do the mirrors answer before the Dusk Warden moves? | They record earlier lantern bearers. The Tactician waits for a bearer who will refuse the answer. | **The Warden breaks the cycle by holding the oath.** |
| Echo Throne | Why is the lantern caged at an empty throne? | The Gate Sovereign is not the throne's owner but its last consumed bearer. | Breaking his command leaves the throne empty and the command still echoing. |

The Abyss Chancel turn is the pivot: it is the moment the Warden proves the cycle can break, not by fighting harder, but by refusing the repeated answer. This sets up Stage 3's revelation that refusal is not enough; the command persists even when the commander falls.

---

## 12. Measurable Acceptance Criteria

| Criterion | Pass condition | Verifiable by |
|---|---|---|
| **Quest acquisition** | Dialogue box appears at `STAGE_STARTED:abyss-chancel`; player may dismiss and continue | Stage entry capture |
| **Four objectives** | `chancel-nave-advance`, `chancel-transept-lock`, `chancel-oath`, `boss-kill` complete in order; no objectives skip | Event trace |
| **Dialogue-driven tension** | Three named dialogue surfaces exist (`witness-greeting`, `boss-reversal`, `warden-aftermath`); each surface carries Korean text and English ID | Lobby story archive |
| **Reversal at boss turn** | `OCCUPATION_CAPTURED` emits Tactician's reversal line; mirrors hold five earlier silhouettes; no new objective is created | VFX event log + event trace |
| **Skill extraction beat** | `EXTRACTION_WINDOW_OPENED` fires after `OBJECTIVE_COMPLETED:boss-kill`; `ELITE_EXTRACTED` binds `rift-lens` | Event trace |
| **Wearable reward** | `ITEM_COLLECTED: abyss-chancel-ward` fires on boss defeat; item appears in Warden's ward slot or inventory | Inventory snapshot |
| **Motion/VFX/audio cues** | Each event (Stage Started, Wave Started, Occupation Captured, Boss Spawned, Boss Defeated) produces distinct semantic motion, VFX response, and audio cue | Normal and reduced-motion captures |
| **Flat-world constraint** | All route points, objectives, boss path, occupation, and extraction resolve at elevation 0; no vertical movement | Level geometry capture |
| **No Stage 4 content** | No stage ID beyond `abyss-chancel` appears in scenario or handoff; progression points only to Echo Throne | Git diff / source audit |

---

## 13. Non-Goals & Scope Boundary

This scenario **does not:**
- Implement quest state machine in runtime code
- Add new event types or modify existing event payloads
- Create a dialogue choice branch that changes objective order or boss behavior
- Design Stage 3 (Echo Throne) content
- Implement mirror-control mechanics (player cannot manipulate mirrors)
- Generate images, videos, or 50-panel webtoon viewer
- Modify the progression/equipment system itself (only uses existing progression surfaces)

This scenario **only:**
- Authors dialogue text tied to existing stage events
- Maps narrative beats to existing objective gates, VFX cues, and audio surfaces
- Specifies motion intent, VFX direction, and audio priority for existing event types
- Names one wearable item and one invisible progression badge
- Defines the NPC quest as flavor (narrative-only, blocking nothing)
- Hands off to existing systems (encounter routing, simulation, presentation) for execution

---

## 14. Changelog & Future Hooks

### 14.1 What this episode reveals

- The Veil Tactician is not a tyrant; he is a classifier waiting for a bearer who refuses classification
- The mirrors record past, not future; the Warden's choice proves the past is not destiny
- The extracted `rift-lens` companion is a proof that even deceptive tools can become allies when the cycle breaks

### 14.2 Hook for Stage 3

The Tactician's final line — *"거울이 깨져도, 왕좌가 사라지는 것은 아니다"* (Even if the mirrors shatter, the throne remains) — points toward Echo Throne's central question: the Warden has broken the cycle, but the throne persists. The command still echoes even when the commander is defeated.

### 14.3 Optional future cosmetics

- `mirror-refusal-mark` (cosmetic facial mark, unlocked if the hidden `mirror-refusal` progression badge is earned)
- `shattered-lens-trail` (VFX trail for extracted `rift-lens`, shows the companion's origin)
- `oath-breaker-set` (cosmetic armor set, unlocked if Warden completes both Stage 2 and Stage 3 with the hidden `mirror-refusal` badge)

---

## References

- **Authority sources:**
  - `stage-world-catalog.js` — world placement, routes, visibility anchors
  - `defense-catalog.js` — encounter routing, objectives, reward IDs
  - `defense-run-simulation.js` — event emission, progression state
  - `abyssal-lantern-world-synopsis.md` — narrative spine, boss-turn twist
  - `action-combat-spec.md` — motion clips, VFX semantics, audio priority

- **Related design documents:**
  - `encounter-wave-spec.md` — routed wave ingress, objective gates, recovery
  - `camera-vfx-direction.md` — stage VFX direction, ambient loop policy
  - `lobby-story-presentation-spec.md` — dialogue accessibility, spoiler safety

---

**End of Abyss Chancel Stage Episode**

*This document is a design handoff. It does not claim runtime implementation of dialogue, quest state, or new cosmetics. All dialogue text is accessible narrative flavor; all motion, VFX, and audio beats are routed to existing event surfaces. Implementation teams own the final choice of where dialogue lives, whether quests are tracked, and how cosmetics are awarded.*
