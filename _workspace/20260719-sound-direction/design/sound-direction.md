# Abyssal Surge — Sound Direction Bible

**Status:** design artifact only. This document does not assert that any new narration, music, or SFX files have been generated, approved, imported, cached, or wired.

**Scope:** sound direction for the current single-player dark-fantasy RTS-RPG campaign. No `app.js`, asset, test, or manifest is changed by this artifact.

**Decision summary:** keep the deterministic text/UI path as the release-safe baseline; preserve the locked narration for Stages 4–8; revise only the late-campaign lines whose mechanics are materially omitted or whose Korean line contains the English token `unmake`; retain the existing authored action/breach/wave sounds; use procedural combat-alert tones for low-frequency semantic alerts until a small authored boss-alert pass is approved; introduce stage-band music as a future, explicitly wired asset set rather than pretending the current two-scene player is stage-aware.

---

## 1. Evidence basis and runtime truth

The following is the observed source contract used to make this direction. File/line references are source anchors, not generated-asset claims.

| Surface | Observed contract | Sound-direction consequence |
|---|---|---|
| Stage authority | `campaign-state.js:220–573` defines `sunken-bastion`, `howling-sprawl`, `glass-necropolis`, `starless-canal`, `shattered-causeway`, `abyss-chancel`, and `gate-zenith` as Stage 4–10. Each has an objective, boss, node goal, and encounter waves. | Every proposed cue and line below uses the real stage ID, boss, wave ID, or command; no invented encounter is introduced. |
| Stage 4 objective | `sunken-bastion`: raise the legion above waterline, hold the flood node, weather four tide waves, drown the Tide Warden; waves `tide`, `undertow`, `riptide`, `depthguard`. | Water pressure is the first post-trilogy sound escalation; four-wave cadence is audible through repeated but non-identical threat markers. |
| Stage 5 objective | `howling-sprawl`: take the howl node, possess a pack sentinel, survive four hunting waves, silence the Pack Herald; waves `howler`, `packrunner`, `alphaguard`, `direpack`. | Possession and pack identity deserve a distinct timbre, but not a new voice line on every wave. |
| Stage 6 objective | `glass-necropolis`: hold both glass nodes, possess a chorister sentinel, endure four requiem waves, shatter the Requiem Choir; waves `requiem`, `dirge`, `lament`, `threnody`. | The sound field moves from animal pressure to brittle harmonic pressure; do not use literal sung lyrics. |
| Stage 7 objective | `starless-canal`: seize both toll nodes, reopen Lord's Domain, outlast four lantern waves, douse the Lantern Tyrant; waves `lantern`, `bargeguard`, `tollkeeper`, `tyrantwake`. | A recurring toll/lantern pulse can communicate the canal's rule without extra VO. |
| Stage 8 objective | `shattered-causeway`: anchor both span nodes, invoke Domain, break five siege waves, topple the Bridge Colossus; the current encounter data lists `rubble`, `spanwarden`, `keystone`, `colossusguard`. | Make impacts heavier and space wider; keep the Domain cue as the player's agency marker. |
| Stage 8 data discrepancy | The Stage 8 objective says “break five siege waves,” while `campaign-state.js:449–453` currently declares four wave IDs (`rubble`, `spanwarden`, `keystone`, `colossusguard`). | This design invents no fifth audio event. Until the objective/data contract is reconciled, trigger wave sound only for the four literal IDs and keep the fifth-wave wording as a content/engineering risk, not a sound claim. |
| Stage 9 objective | `abyss-chancel`: claim all three rite nodes, possess a signatory, open Domain, survive four oath waves, unbind the Veiled Concordat; waves `acolyte`, `votary`, `oathbound`, `concord`. | Ritual pressure is a stack of layers, not a choir song: rite-node claims, possession, oath waves, then boss unbinding. |
| Stage 10 objective | `gate-zenith`: carry every boon, hold all three crown nodes, spend Domain, outlast five zenith waves, unmake the Abyss Regent; waves `zenithguard`, `stormherald`, `gatewrath`, `regentsown`, `lasttide`. | The final band needs the widest register and a clear final-gate cadence, with no lyrical victory claim before `campaign-complete`. |
| Narration | `app.js:120–194` has audio paths for `intro`, Stages 1–3, `victory`, and `defeat`; Stage 4–10 entries contain text and timing only. `app.js:196–210` supplies English text parity. | Stage 4–10 audio is not present in the current NARRATION entries. Text remains canonical and must remain complete without audio. |
| Narration playback | `app.js:3732–3776` types visible text at `msPerChar` and `holdMs`; `playNarration()` plays `entry.audio` only when present and otherwise removes the audio source. | A missing or failed clip is a supported fallback, not a reason to block combat. Future language-specific clips need an explicit runtime contract; one static `audio` path cannot provide true KO/EN audio parity. |
| Music | `app.js:116–119` maps only `lobby` to `assets/audio/bgm-theme.mp3` and `battle` to `assets/audio/battle-bgm.mp3`; `app.js:3671–3700` sets BGM volume to `0.55` and swaps by scene. | Current BGM is scene-aware, not stage-band-aware. The proposed arc is a production target; it is not an assertion that stage-specific switching exists. |
| Player command cues | `app.js:77–87` maps `hunt`, `extract`, `materialize`, `capture`, `possess`, `domain`, `assault`, `reward`, `breach-alert`, and `wave-spawn` to `assets/audio/*.mp3`. | Preserve these semantic anchors. Do not regenerate them merely for novelty. |
| Encounter/alert cues | `app.js:89–115` and `combat-systems.js:402–416` define `breach`, `start-wave`/`wave-spawn`, `boss-phase`/`phase-change`/`boss-phase-shift`, `boss-low-health`/`low-health`, `guardian-shield`/`guardian-guard`, `enemy-ranged-warning`, and `summon-evolution`/`summon-evolved`. | This is the authoritative SFX taxonomy. Alias names are one semantic event, not separate sounds. |
| Authored vs procedural alerts | `app.js:3642–3663` uses an authored cue only for a mapped source; otherwise `playProceduralCombatAlert()` creates an oscillator based mainly on severity (`critical`, `warning`, `info`). | Current fallback is severity-coded, not fully event-distinct. Keep it for low-priority alerts, but author a boss phase cue first if a stronger semantic read is required. |
| Ambient | `app.js:4041–4065` creates a looping, user-triggered `assets/audio/ambient.mp3`; it is stopped by `stopBattleAudio()`. | Treat ambience as optional shared atmosphere, not a hidden gameplay signal or a substitute for stage-band music. |
| Cache contract | `sw.js:90–160` lists literal optional media, including current action cues, `ambient.mp3`, `breach-alert.mp3`, `wave-spawn.mp3`, `battle-bgm.mp3`, narration for intro/Stages 1–3/victory/defeat, and `bgm-theme.mp3`. | Any future literal audio URL must be added to both the service-worker optional-media list and `assets/media-manifest.json`; this artifact does not make those edits. |
| Existing inventory | `assets/media-manifest.json:1–89` records observed audio files and provenance for `ambient.mp3`, `bgm-theme.mp3`, `battle-bgm.mp3`, `breach-alert.mp3`, `wave-spawn.mp3`, `domain.mp3`, and `extract.mp3`; the filesystem also contains the other mapped action/narration files listed above. | Existing files are evidence of current inventory only. Historical provenance is not permission to claim a new provider output or a new approval. |

### Truth boundary

- **Observed/shipped inventory:** the current `assets/audio/` files and manifest entries; the existing runtime mappings described above.
- **Recommended, not shipped:** all stage-band music, Stage 4–10 voiced clips, boss-alert replacement clips, ducking, and stage-aware music selection.
- **No provider assumption:** a remote voice or sound-generation service requires an existing credential, a recorded provider/model/voice, rights review, loudness measurement, checksum, and human/runtime approval. None is implied by this design document.
- **Fallback requirement:** if an audio request fails, Korean/English text, objective/checklist, and tactical feedback still carry the complete player instruction.

---

## 2. Sound identity

**Identity statement:** *A drowned war machine waking below a ceremonial abyss: cold iron, deep water, restrained occult pressure, and a commander whose calm makes every escalation feel inevitable.*

The sound should be dark fantasy without becoming trailer bombast. The player is a Shadow Lord issuing precise commands, not a heroic action protagonist. Favor negative space, sub pressure, material detail, and short readable transients over constant noise or melodic busyness.

### Palette

- **Foundation:** sub/low drones, bowed metal, damp stone, hull resonance, distant tide, granular ash, and short breath-like noise.
- **Abyss signature:** a narrow abyss-teal upper partial (roughly 2–4 kHz) used sparingly as a control/readability accent, never as an alarm on every event.
- **Authority:** low, dry impacts and descending intervals for command acceptance; avoid triumphant major cadences.
- **Threat:** asymmetric pulses, unstable stereo movement kept within safe mono compatibility, and short reverse swells leading into a readable impact.
- **Prohibited identity drift:** no recognizable song, borrowed franchise sound, spoken enemy dialogue, comedy, EDM drop, or choir lyrics. A distant non-lexical vocal texture may appear in music only if it remains texturally anonymous and never competes with narration.

---

## 3. Narrator bible

### Role and performance

The narrator is the **Abyssal Field Warden**: an impartial voice that frames the next tactical decision and names the cost of failure. The Warden is not a companion, villain monologue, announcer, or reward host. The delivery should make a short imperative feel like a ritual command entered into a battlefield ledger.

- **Voice:** low-to-mid register, controlled breath, clear Korean consonants, restrained ceremonial authority, no growl, no theatrical whisper, no recognizable performer imitation.
- **Emotion arc:** composed at Stage 4; more urgent but still measured by Stage 6; nearly liturgical at Stage 9; quiet finality at Stage 10. Do not shout. Let lower pitch, shorter pauses, and denser consonants carry escalation.
- **Mic/treatment target:** intimate dry centre vocal with minimal room; a short dark tail may be added after the final word, but the spoken consonants must remain dry enough for captions and mobile speakers. No wide stereo effect on speech.
- **Take discipline:** one clean take per line plus one alternate take for timing. Do not use an AI voice clone or an unlicensed recognizable voice.

### Script and pacing rules

1. **Place → pressure → imperative/consequence.** Name the place first, establish one threat, then issue the action.
2. Default to **two short lines**. Use a third line only when a late-game objective genuinely has several linked gates (Stage 9 and Stage 10).
3. Match the player's visible vocabulary: `영혼`, `실체화`, `점거`, `빙의`, `군주의 영역`, `웨이브`, and `총공격` where appropriate. Do not introduce a mechanic that is not in the objective/checklist.
4. The current typewriter pacing is `45 ms/character`, with roughly `2,000 ms` holds for Stages 4–10 (`app.js:147–180`). Treat this as the visible timing contract. A voiced line may breathe inside that window, but must not force the player to wait before `start-combat` is usable.
5. Leave a short pause (about 250–400 ms) after a place name and before the imperative. This is a production timing target, not a claim about current files.
6. The English version is a meaning-parity adaptation, not a literal syllable translation. Keep the same objective order and number of commands. Captions/text remain the fallback for either language.

### Loudness and ducking intent

These are **design targets for a future mix, not measurements of current assets**:

- Narration: target about **−16 LUFS-I**, **−1 dBTP** ceiling, with clear consonants on phone speakers.
- Battle BGM: target about **−24 LUFS-I** while active combat is readable; lower it by **6–8 dB** during narration and critical alerts.
- One-shot SFX: target about **−12 to −9 LUFS short-term** depending on category, with no clipping; breach and boss-phase may briefly lead the mix without masking speech.
- Ducking: attack 40–70 ms, release 250–450 ms after narration/critical alert. Prefer gain automation over hard mute so the battlefield never feels disconnected.
- Current code only sets the BGM element's `volume = 0.55` (`app.js:3671–3676`) and independently plays narration/cues. Do not describe this as ducking or loudness compliance until a measurement and runtime observation exist.

### Language parity

- Korean is the primary voiced script for the dark-fantasy identity. English receives a meaning-parity text script and, only if separately generated and approved, a matching English clip.
- Current `NARRATION_EN` swaps visible text, but `playNarration()` still uses the one `entry.audio` field. Therefore the current runtime does **not** prove language-specific audio parity. A future implementation must choose and document either `audioByLang` or a deliberate Korean-voice/English-text fallback.
- Never silently play Korean audio under an English text line and call that parity. If only Korean VO is shipped, label English as text/caption parity and preserve the text-only path.

---

## 4. Stage-aware BGM arc

The current `battle-bgm.mp3` is a restrained low-drone loop (the manifest describes phase-aligned 55/82.5/110 Hz drones, cold stereo overtones, and a two-second pulse). Keep that as the tonal baseline. The arc below is a **three-band production design**, not an assertion that the current player can select it.

| Band | Stages and actual IDs | Musical direction | Escalation rule |
|---|---|---|---|
| **I — Drowned threshold** | Existing baseline for `cinder-span`, `veil-citadel`, `echo-throne`; the first newly directed band starts at `sunken-bastion`. | Low drone, sparse two-second pulse, damp iron, little high-frequency motion. Let commands and objective text dominate. | No heroic lift. Stage 3's Domain/sovereign resolution should feel like earned knowledge carried into Stage 4, not a reset. |
| **II — Living pressure** | `sunken-bastion`, `howling-sprawl`, `glass-necropolis` (Stages 4–6). | Add tidal sub movement, irregular pack-like breaths, and brittle glass partials in separate variants. The underlying pulse remains recognizable so the campaign still feels like one world. | Increase density by texture, not volume: water/pack/choir layers enter at wave starts and recede after `wave-cleared`; never loop a permanent alarm. |
| **III — Toll and fracture** | `starless-canal`, `shattered-causeway` (Stages 7–8). | Make space wider and impacts heavier: lantern toll interval, barge/chain resonance, stone fracture, slower low-mid strikes. Leave a deliberate hole before the next wave. | Domain activation is the band signature: briefly remove the pulse, expose the abyss-teal upper partial, then return with a controlled low impact. |
| **IV — Rite and zenith** | `abyss-chancel`, `gate-zenith` (Stages 9–10). | Stack a restrained non-lexical choral pad or bowed-metal fifth over the drone, add a three-step threshold figure for crown/rite nodes, and widen only the final band. Keep the music instrumental/textural; no lyric tells the player what to do. | Boss phase and low-health events can open the upper layer; after `campaign-complete`, release to silence or the existing victory narration rather than looping combat triumph. |

### Runtime tradeoff

- **Lowest-risk release:** reuse current `battle-bgm.mp3` for every battle and deliver the arc through procedural alert timbres plus the text briefing. This preserves offline behavior and requires no new code, but it is not truly stage-aware.
- **Smallest stage-aware music pass:** add one loop per new band (II, III, IV), not one loop per stage. This reduces memory and authoring cost while making the campaign turn audible at Stages 4, 7, and 9. It requires a future stage-band selector and literal cache/manifest entries.
- **Avoid:** seven near-identical loops. They increase download/cache cost and make balancing harder without adding readable information.

---

## 5. SFX taxonomy mapped to real runtime events

The taxonomy separates **player agency**, **world breach/wave pressure**, **boss state**, and **positive progression**. Repeated aliases map to one semantic event so the player learns the sound once.

### 5.1 Existing authored cues to preserve

| Semantic class | Runtime event/action | Current source evidence | Direction |
|---|---|---|---|
| Command — search | `hunt` | `CUE_BY_EFFECT.hunt` → `assets/audio/hunt.mp3` | Low sonar ping/void echo. Keep sparse; this is a request for information, not a success fanfare. |
| Command — extraction | `extract` | `extract.mp3` | Wet pull/release with a short tonal confirmation; no voice. |
| Command — formation | `materialize` | `materialize.mp3` | Smoke/coalescence into a solid low-mid body; use a short descending tail. |
| Command — capture | `capture` | `capture.mp3` | Banner/anchor slam on stone; readable transient, not a damage hit. |
| Command — possession | `possess` | `possess.mp3` | Narrow spectral grip moving into the centre; avoid horror sting that sounds like player damage. |
| Command — Domain | `domain` | `domain.mp3` | Wide but controlled ward opening; momentarily make room in the BGM. |
| Command — assault | `assault` | `assault.mp3` | Heavy abyssal strike; reserve the deepest impact for the boss hit, not every UI click. |
| Progression — reward | `reward` | `reward.mp3` | Dark choral shimmer/ancient blessing; short and non-triumphal so the next stage still has tension. |
| Threat — breach | `breach` → `breach-alert` | `ENCOUNTER_CUE_BY_EVENT` and `CUE_BY_EFFECT`; `breach-alert.mp3` | Three urgent pulses plus a low hull strike, as already described in the manifest. This is the global danger anchor. |
| Threat — wave arrival | `start-wave`/`wave-spawn` → `wave-spawn` | `combat-systems.js:404–406`; `wave-spawn.mp3` | Spectral rise → portal impact → short confirmation. Keep it distinct from breach: wave is imminent, breach is damage/violation. |

### 5.2 Alert events and procedural/authored decision

| Runtime event aliases | Meaning and player read | Recommended treatment | Smallest-asset decision |
|---|---|---|---|
| `enemy-ranged-warning` | A ranged threat is acquiring a target. | Keep procedural initially, but use a short two-note spatial ping with a rising second partial; do not use the same critical square oscillator as boss phase. | **Procedural acceptable** because this can recur and the UI label carries the exact meaning. Author only if playtest shows it is missed. |
| `boss-phase`, `phase-change`, `boss-phase-shift` | Boss phase has shifted. `combat-systems.js` normalizes all three to `boss-phase-change`. | Highest-priority authored alert candidate: brittle armour fracture + sub drop + one clean abyss-teal confirmation. It should be unmistakable and under 1.0 s. | **Generate one authored `boss-phase-change` cue** if any new SFX is funded; all aliases reuse it. Current `CUE_BY_EFFECT` has no source for this ID, so a file alone would not wire itself. |
| `boss-low-health`, `low-health` | Boss integrity is critical. | Procedural descending pulse with a longer release than ranged warning; never a looping siren. Fire on threshold transition, not every frame. | **Procedural acceptable** until frequency/threshold QA proves otherwise. |
| `guardian-shield`, `guardian-guard` | Guardian shield/guard is active. | Procedural filtered ward shimmer with a short stone tick; positive-warning hybrid, not a damage alert. | **Procedural acceptable**; no additional file required for the first shippable pass. |
| `summon-evolution`, `summon-evolved` | A summon evolution is accepted. | Procedural positive arpeggio or retain the existing `reward`-family colour; keep it quieter than Domain. | **Procedural acceptable**; both aliases reuse one pattern. |

**Important implementation truth:** `playProceduralCombatAlert()` currently keys the oscillator primarily from `cue.severity`, so two `warning` events can sound too similar. The taxonomy is a direction for future event-specific parameterization, not evidence that event-specific procedural timbres already exist.

### 5.3 Event-to-stage texture accents

These accents must remain subordinate to the semantic cue and should not require seven new SFX files:

- `tide`, `undertow`, `riptide`, `depthguard` (Stage 4) can alter the wave-spawn low layer from rounded water pulse to denser sub surge.
- `howler`, `packrunner`, `alphaguard`, `direpack` (Stage 5) can add a filtered breath/grit layer to the same wave-spawn envelope.
- `requiem`, `dirge`, `lament`, `threnody` (Stage 6) can add a brittle partial or short reverse glass swell.
- `lantern`, `bargeguard`, `tollkeeper`, `tyrantwake` (Stage 7) can add one distant toll overtone.
- `rubble`, `spanwarden`, `keystone`, `colossusguard` (Stage 8) can add stone/chain resonance to the same impact family.
- `acolyte`, `votary`, `oathbound`, `concord` (Stage 9) can add a restrained rite interval.
- `zenithguard`, `stormherald`, `gatewrath`, `regentsown`, `lasttide` (Stage 10) can add a rising storm layer, with `lasttide` reserved for the final wave.

This is a conscious tradeoff: one learned wave-spawn identity plus stage texture is more readable and cheaper than 29 bespoke wave files.

---

## 6. Korean narration decisions for Stages 4–10

The locked text in `app.js:147–180` is the current canonical fallback. The rule here is **do not rewrite a line merely to add lore**. Preserve a line when it names the place and the decisive action accurately; revise only when the observed objective makes the line misleading/incomplete at a meaningful late-campaign turn or the text itself contains a language defect.

| Stage ID | Current Korean line status | Decision and reason |
|---|---|---|
| `sunken-bastion` (Stage 4) | `가라앉은 보루, 선큰 바스티온.` / `방파제 위에서 조수의 감시자를 수장시켜라.` | **Retain locked lines.** They establish the drowned breakwater and Tide Warden; the flood node and four waves remain visible in the objective/checklist and do not need to be spoken. |
| `howling-sprawl` (Stage 5) | `울부짖는 폐허, 하울링 스프롤.` / `무리의 파수꾼을 빙의해 전령의 목을 조여라.` | **Retain locked lines.** Possession and Pack Herald pressure are clearly framed; wave names and node state remain UI responsibilities. |
| `glass-necropolis` (Stage 6) | `유리 묘역, 글래스 네크로폴리스.` / `두 유리 단상을 장악하고 진혼곡을 침묵시켜라.` | **Retain locked lines.** Both nodes and the Requiem Choir are present; adding possession and four wave names would overload the entry beat. |
| `starless-canal` (Stage 7) | `별 없는 운하, 스타리스 커낼.` / `군주의 영역이 돌아온다. 폭군의 등불을 모두 꺼라.` | **Retain locked lines.** The Domain return is the story turn and the lantern objective is explicit; toll nodes/waves remain readable in the checklist. |
| `shattered-causeway` (Stage 8) | `부서진 둑길, 섀터드 코즈웨이.` / `다리를 지키는 거상을 그 다리 아래로 무너뜨려라.` | **Retain locked lines.** The spatially specific colossus image is strong and maps to the actual Bridge Colossus objective; Domain and five waves are tactical setup, not a required spoken list. |
| `abyss-chancel` (Stage 9) | `심연 예배당, 어비스 챈슬.` / `세 의식 단상을 모두 점거하고 계약을 파기하라.` | **Revise.** The existing line names the three nodes and end boss intent but omits the new signatory-possession and Domain gates at the point where ritual complexity is the campaign story. Exact replacement below. |
| `gate-zenith` (Stage 10) | `게이트 제니스, 마지막 정점.` / `모든 은총을 걸고 심연의 섭정을 unmake하라.` / `문은 오늘 닫힌다.` | **Revise.** The mixed Korean/English token `unmake` is a visible language defect, and the line does not name the three crown nodes, Domain spend, or five-wave final ordeal. Exact replacement below. |

### Exact proposed Stage 9 lines (text proposal, not shipped)

**Korean:**

1. `심연 예배당, 어비스 챈슬.`
2. `세 의식 단상을 점거하고 서명자에 빙의하라.`
3. `군주의 영역을 열어 네 번의 맹세 웨이브를 뚫고 베일드 콩코다트의 속박을 풀어라.`

**English meaning-parity companion:**

1. `The Abyss Chancel.`
2. `Seize all three ritual platforms and possess a signatory.`
3. `Open the Lord's Domain, outlast four oath waves, and unbind the Veiled Concordat.`

**Why this is better:** it follows the real order `nodeGoal: 3` → `possess requiresNodes: 2` → `domain requiresNodes: 3` → four waves → boss unbinding, without inventing a reward or claiming that possession itself wins the stage.

### Exact proposed Stage 10 lines (text proposal, not shipped)

**Korean:**

1. `게이트 제니스, 마지막 정점.`
2. `모든 은총을 짊어지고 세 왕관 거점을 점거하라.`
3. `군주의 영역을 소진해 다섯 번의 정점 웨이브를 견디고 심연의 섭정을 해체하라.`
4. `오늘, 문은 닫힌다.`

**English meaning-parity companion:**

1. `Gate Zenith, the final peak.`
2. `Carry every boon and claim all three crown nodes.`
3. `Spend the Lord's Domain, outlast five zenith waves, and unmake the Abyss Regent.`
4. `The gate closes today.`

**Why this is better:** it removes the visible English token from the Korean line, names the actual `nodeGoal: 3`, Domain spend, five-wave structure, and `Abyss Regent`, and preserves the current finality beat without promising anything after `campaign-complete`.

**Timing choice:** the proposed three/four-line late-stage scripts are intentionally denser. If the briefing window cannot support them, keep the first two lines visible and expose the remaining clauses in the objective/checklist; do not make the player wait on VO to start combat. The current 45 ms/character and 2,000 ms hold remain the fallback contract.

---

## 7. Smallest shippable generated-asset set

This section distinguishes a **complete parity package** from a **small first pass** and from the **honest no-credential baseline**.

### Recommended complete parity package (future, pending provider and approval)

| Count | Asset set | Why it is the minimum complete package |
|---:|---|---|
| 14 | Seven Korean + seven English Stage 4–10 narration clips, paired to the final approved scripts | One clip per stage/language gives true parity without silently reusing a Korean file for English text. Stage 4–8 use locked text; Stage 9–10 use the proposed revisions only after copy approval. |
| 3 | One loop for each new BGM band: Stages 4–6, 7–8, and 9–10 | Three loops create audible stage turns without seven near-duplicates. Existing lobby and early-battle loops remain the baseline. |
| 1 | Authored `boss-phase-change` one-shot shared by `boss-phase`, `phase-change`, and `boss-phase-shift` | This is the highest-value missing semantic alert; aliases should not multiply files. |
| **18** | **Total new generated/imported files in the complete package** | SFX action/breach/wave inventory is preserved; the remaining alert classes stay procedural. |

Every file in this package would still need actual provider/model/voice or local-procedure provenance, source script/prompt ID, duration, loudness/true-peak measurement, checksum, human approval, and runtime/cache mapping. No row above says that file exists today.

### Smallest first pass when English audio is intentionally deferred

**11 files:** seven Korean Stage 4–10 narration clips, three BGM band loops, and one authored boss-phase cue. English keeps meaning-parity text/captions but is not voiced. This is a valid cost tradeoff only if release notes and accessibility copy clearly call it **Korean voice + English text parity**, not bilingual audio.

### Honest baseline when no audio credential or approved source is available

**Zero new files.** Ship the existing text/UI path, existing authored action/breach/wave/ambient/BGM files, and the current procedural fallback alerts. This baseline is deterministic and playable, but it does **not** deliver voiced Stage 4–10 narration or stage-band BGM. Do not fabricate provider output, checksums, or approval records to make the baseline sound complete.

### Sounds that can remain procedural

- `enemy-ranged-warning`, `boss-low-health`, `guardian-shield`, and `summon-evolution`/`summon-evolved` can remain procedural for the first pass because they are infrequent, short, and accompanied by a visible combat alert.
- Stage-specific wave identities can remain procedural overlays on the shared `wave-spawn` event; the 29 wave IDs do not justify 29 files.
- A generic command rejection/cooldown tick can remain procedural if added later, but it is outside the current authored cue map and must not be implied as shipped here.
- Do **not** replace authored `hunt`, `extract`, `materialize`, `capture`, `possess`, `domain`, `assault`, `reward`, `breach-alert`, or `wave-spawn` merely to make the taxonomy look new; they are already the player's learned action vocabulary.

---

## 8. Future runtime handoff (not implemented in this artifact)

When an implementation lane is opened, it should make the following changes as one reviewable contract. This section is a handoff, not a claim that any change happened.

1. Add a language-aware narration source contract for Stage 4–10 (for example `audioByLang.ko` / `audioByLang.en`) or explicitly keep Korean audio + English text fallback. Update the final script and caption/transcript record together.
2. Add stage-band BGM selection keyed by actual stage IDs or a small stage-band function. Preserve lobby/battle fallback if the band asset fails.
3. Add the authored `boss-phase-change` path only if the file passes review; otherwise keep the procedural cue and tune its event-specific timbre rather than adding a dead path.
4. Add every literal runtime URL to `sw.js:OPTIONAL_MEDIA` and `assets/media-manifest.json`. A file on disk that is not in both surfaces is not an offline-safe shipped asset.
5. Add narration/BGM ducking in the shared audio control surface. `volume = 0.55` is not a ducking implementation.
6. Verify at least: Stage 4 wave 1 and breach, Stage 6 glass/requiem alert, Stage 7 Domain, Stage 9 possession/Domain/boss-phase, Stage 10 last wave and boss-low-health, language toggle, missing-audio fallback, reduced motion, and offline cache coverage.

### Acceptance checklist for the next implementation pass

- [ ] Every voiced clip has an exact script ID, language, source/provider or deterministic procedure, rights/provenance record, checksum, loudness/true-peak measurement, and human approval.
- [ ] Every `NARRATION` audio path points to a real shipped asset; text-only Stage 4–10 remains valid when no clip exists.
- [ ] English text and any English audio preserve the same objective order as Korean.
- [ ] Stage-band music can fail without hiding objectives or preventing `start-combat`.
- [ ] `breach`, `start-wave`, boss-phase aliases, boss-low-health aliases, guardian aliases, ranged warning, and summon-evolution aliases each produce an intentional, testable semantic read.
- [ ] BGM ducking is measured in the browser, not inferred from an element volume constant.
- [ ] `sw.js` and `assets/media-manifest.json` cover every literal runtime media URL.
- [ ] No design artifact, manifest, or release note claims that a recommended file exists before its file/hash/runtime evidence is recorded.
