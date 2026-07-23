# Abyssal Command — narrative stage-presentation survey

**Research date:** 2026-07-22  
**Status:** proposed implementation contract; all numeric values marked **Target** are unverified. This document makes no G1 or G4 pass claim and requests no generated media.

## Decision enabled

This packet gives narrative, audio, UI, and QA owners one event-observed, localization-ready presentation plan for the ten canonical stages. It specifies how the **Dusk Warden**, the lunar-fracture **Echo Deep**, and the **Moonless Court** connect to stage pressure without making a cinematic, caption, cue, or music transition authoritative over the deterministic 60 Hz run.

### Terminology correction and fixed canon

The requested term “Molness Court” has no canonical source. This packet uses **Moonless Court** exclusively; it is not a rename or a new faction.

| Constraint | Canonical rule | Implementation consequence |
| --- | --- | --- |
| Player identity | Dusk Warden is the player-controlled commander and is the only established reverser of the Echo Deep obedience signal. | **Proposal:** keep player battle-callouts non-verbal exertion/command SFX with caption equivalents, and use a neutral command-log narrator for spoken context. This avoids adding character dialogue; it is not asserted as a canon silence rule. |
| World premise | Moonless Court exploits lunar-fracture Echo Deep matter as an obedience signal; the Warden reverses it at damaged Gates. | Lines may state only an observed Gate, Echo, Bind/Extract, Domain, or Archive result; no invented factions, motive, off-screen history, or prophecy. |
| Stage outcome | Victory restores a containment line; it does not destroy the Echo Deep. | Victory language is containment/state language, never conquest or final destruction. |
| Campaign limit | The campaign has exactly ten ordered stages; Stage 10 is Gate Zenith and ends in containment holding after the command network is severed. | `S10` has no “next Gate,” “next stage,” epilogue hook, or Stage-11 cue. |
| Traceability | Every player-facing string, cue, effect, and animation label cites W-01…W-05. | Each timeline row names its trace(s); untraced content is rejected from the cue manifest. |

**Source of truth:** `_workspace/20260722-defense-survival-expansion/design/worldview.md` and `defense-catalog.js`; the current catalog’s ten stage/boss pairs are used below. The artifact does not add a stage, boss, rule, reward, or runtime content.

## Evidence synthesis

| Pattern | Evidence | Narrow application here |
| --- | --- | --- |
| Interactive music can use synchronization, fades, and transition segments. | Audiokinetic’s Wwise Music Transitions documentation describes transitions, synchronization points, fade curves, and transition segments. [E1] | A boss state may request an immediate arrival sting and a separately bar-aligned bed/stem change. Music must not defer the already-resolved arrival. |
| Critical information needs more than one sensory channel; captions distinguish spoken and meaningful non-speech information. | Xbox Accessibility Guidelines 103–105 advise multiple sensory methods, captions/subtitles, and independently configurable output; WCAG caption guidance includes dialogue, speaker identification, and needed non-speech audio. [E2–E5] | Every meaningful narration/arrival/critical cue has text/shape state. Normal automatic-hit texture is intentionally not captioned at combat density. |
| Interaction-triggered nonessential motion must be reducible, and flashes require a safety ceiling. | W3C’s WCAG explanations cover animation-from-interactions and the three-flashes-or-below threshold. [E6–E7] | Camera motion, decorative VFX, and BGM transitions enrich only; the static state/caption is complete without them. No component may exceed three flashes in one second. |
| A presentation listener should be downstream of an immutable result. | Ink documents content tags/metadata and Godot documents signals as decoupled emitted messages. [E8–E9] | Cue metadata is keyed by stable event and localization IDs, not inferred from pixels or voice timing. These sources are analogies, not dependencies. |

The sources establish capabilities and access principles, not an outcome for this game. The cadence, duration, and recognition values below are original hypotheses to be falsified.

## Implementation boundary

```text
simulation commits event/state at simTick
  -> immutable observed event { eventId, simTick, sequence, stageId, type, allowlistedFacts }
  -> narrative/audio router validates cue definition
  -> observer-only actions { showCaption, showStaticMarker, playLocalCue,
                              requestBgmState, requestVfx, suppress }
```

The router may not mutate simulation, input, Gate integrity, combat targeting, RNG, stage order, extraction, rewards, local persistence, or replay state. Audio decoding, mute, missing assets, caption dismissal, reduced motion, and BGM bar alignment all resolve to presentation delay, fallback, or suppression only. Runtime network/provider access is forbidden; all assets are local, reviewed build outputs or absent.
### Canonical trigger compatibility

The router consumes the active cinematic contract directly. An optional immutable adapter may expose aliases for a display layer, but it must preserve the source trigger, payload, and terminal result:

| Canonical source trigger | Required observed payload | Permitted presentation request |
| --- | --- | --- |
| `STAGE_STARTED` | `stageId`, `CUTSCENES[stage].intro`, committed stage plan / labels | Entry title and optional W-01/W-03/W-04 edge caption. |
| `BOSS_SPAWNED` | `eventId`, `simTick`, `stageId`, boss ID, committed Gate snapshot | Boss identity/arrival cue and independent BGM request. |
| `TERMINAL` + `VICTORY` (S01–S09) | committed result, W-05 Archive/reward payload, committed next-stage link | Result caption/card after state commit; it may show the existing next-stage action but cannot unlock it. |
| `TERMINAL` + `FINAL_COMPLETION` (S10) | committed completion result | W-05 completion recap only—no next-stage action, cue, or music-entry request. |
| `TERMINAL` + `DEFEAT` | committed defeat result | W-03/W-05 factual defeat state and existing retry/lobby action. |

`objectiveRevealed` is a proposed display adapter event only when it is derived from the committed stage plan. It is never a substitute source for `STAGE_STARTED`, `BOSS_SPAWNED`, or `TERMINAL`.

## Ten-stage narration and world-link timeline

**Timeline convention:** `t+` values are maximum presentation windows after a confirmed event, not simulation scheduling. “No narration” means an optional cue may be suppressed; rules continue. All wording is an authored slot template, not approved final player copy.

| # / catalog stage | World-link and required beat | Boss arrival / canonical trace | Narrative and BGM plan | Localization-ready IDs | Measurement hypothesis / gate |
| --- | --- | --- | --- | --- | --- |
| S01 `cinder-span` — Cinder Warden | `STAGE_STARTED`: W-03 damaged containment line; W-01 Echo recovery identifies the first readable pressure loop. | `BOSS_SPAWNED`: Cinder Warden is an observed W-03 pressure escalation, not a speaker or new lore source. | Entry caption is eligible at `t+0–2s`; use abyssal bed only. Boss sting is immediate; pressure rhythm may fade at next musical boundary. | `NAR.S01.ENTRY.W03`; `MUS.S01.BED`; `SFX.BOSS.S01.ARRIVE`; `MUS.S01.PRESSURE`; `NAR.S01.RESULT.W05` | **Target G1:** every cue maps to W-01/W-03/W-05. **Target G4:** entry marker and Gate state remain visible with motion/audio absent. |
| S02 `veil-citadel` — Veil Tactician | `STAGE_STARTED`: W-04 domain/route identity, then W-02 confirmed extraction-point status; no “possession” claim is added. | `BOSS_SPAWNED`: W-03 Gate threat; boss identity is displayed in the anchored plate. | Entry may name only the authored stage/objective labels. Add command texture after confirmed objective reveal; boss state requests boss-weight stem. | `NAR.S02.ENTRY.W04`; `NAR.S02.OBJECTIVE.W02`; `SFX.BOSS.S02.ARRIVE`; `MUS.S02.COMMAND`; `MUS.S02.BOSS`; `NAR.S02.RESULT.W05` | **Target G1:** slot validator rejects unsupported ability/history claims. **Target G4:** boss plate survives reduced motion and mute. |
| S03 `echo-throne` — Gate Sovereign | `STAGE_STARTED`: W-01 command Echo meets W-03 containment line; this is stage three, not campaign finality. | `BOSS_SPAWNED`: Gate Sovereign arrival is W-03 only; it cannot imply throne succession or a campaign ending. | Objective confirmation can add a sparse Echo signature. Boss sting then BGM boss-weight layer; never restart the base bed. | `NAR.S03.ENTRY.W01W03`; `SFX.W01.ECHO`; `SFX.BOSS.S03.ARRIVE`; `MUS.S03.BOSS`; `NAR.S03.RESULT.W05` | **Target G1:** no “last sea,” crown, or final-completion language. **Target G4:** no central overlay during boss cue. |
| S04 `sunken-bastion` — Tide Warden | `STAGE_STARTED`: W-03 fourth containment line and W-02 confirmed anchor/extraction state. | `BOSS_SPAWNED`: Tide Warden is an observed Gate escalation. | Let the static route/Gate marker carry information first; optional command-log line follows only if no P0 threat is active. Pressure rhythm follows state. | `NAR.S04.ENTRY.W03`; `NAR.S04.BIND.W02`; `SFX.BOSS.S04.ARRIVE`; `MUS.S04.PRESSURE`; `NAR.S04.RESULT.W05` | **Target G1:** no fabricated water-route history. **Target G4:** no narration collision with P0 cue. |
| S05 `howling-sprawl` — Pack Herald | `STAGE_STARTED`: W-03 fifth containment line; W-01 residual signal and W-02 flank extraction are only confirmed-state labels. | `BOSS_SPAWNED`: Pack Herald is a W-03 identity arrival, never a tactical command. | Entry and objective captions use one edge lane. Boss arrival stinger pre-empts P3 attack texture; boss-weight may transition independently. | `NAR.S05.ENTRY.W03`; `NAR.S05.OBJECTIVE.W02`; `SFX.BOSS.S05.ARRIVE`; `MUS.S05.BOSS`; `NAR.S05.RESULT.W05` | **Target G1:** one primary objective only. **Target G4:** P3 cue suppression during arrival. |
| S06 `glass-necropolis` — Requiem Choir | `STAGE_STARTED`: W-01 reflection/record imagery remains an authored domain label; W-03 preserves sixth Gate pressure. | `BOSS_SPAWNED`: Requiem Choir is a W-03 boss identity; it does not establish literal historical voices. | Sparse W-01 signature on confirmed objective state, not on cosmetic reflection. Boss sting is captioned as an arrival when captions are enabled. | `NAR.S06.ENTRY.W01W03`; `SFX.W01.ECHO`; `CAP.SFX.BOSS.S06.ARRIVE`; `MUS.S06.BOSS`; `NAR.S06.RESULT.W05` | **Target G1:** reject visual-only inferred facts. **Target G4:** caption avoids hazards and vital HUD. |
| S07 `starless-canal` — Lantern Tyrant | `STAGE_STARTED`: W-03 seventh Gate and W-02 confirmed canal extraction point; “starless” is a stage label, not cosmology. | `BOSS_SPAWNED`: Lantern Tyrant signals a W-03 arrival and boss plate. | A W-02 marker acknowledgment may occur only after objective state confirmation. Arrival sting is immediate; BGM crossfade waits locally for a musical point. | `NAR.S07.ENTRY.W03`; `NAR.S07.BIND.W02`; `SFX.BOSS.S07.ARRIVE`; `MUS.S07.BOSS`; `NAR.S07.RESULT.W05` | **Target G1:** map label must come from stage plan. **Target G4:** arrival legible in mono/mute. |
| S08 `shattered-causeway` — Bridge Colossus | `STAGE_STARTED`: W-03 eighth containment line; W-02 bridge extraction state remains a bounded local objective. | `BOSS_SPAWNED`: Bridge Colossus is a threat observation, not an animation-triggered spawn. | Entry placard fades without input lock. Boss state introduces boss-weight; a static boss frame persists after the sting. | `NAR.S08.ENTRY.W03`; `NAR.S08.OBJECTIVE.W02`; `SFX.BOSS.S08.ARRIVE`; `MUS.S08.BOSS`; `NAR.S08.RESULT.W05` | **Target G1:** no newly named geography beyond authored labels. **Target G4:** full control during visual transition. |
| S09 `abyss-chancel` — Veiled Concordat | `STAGE_STARTED`: W-01 Command Echo and W-03 ninth line frame a constrained final approach; W-05 appears only after committed result. | `BOSS_SPAWNED`: Veiled Concordat arrival is W-03, not proof of an unseen oath or new faction. | Command texture may rise on confirmed objective; boss-weight adds only on state. `TERMINAL/VICTORY` uses the committed W-05 Archive card and its existing next-stage link. | `NAR.S09.ENTRY.W01W03`; `SFX.BOSS.S09.ARRIVE`; `MUS.S09.COMMAND`; `MUS.S09.BOSS`; `NAR.S09.RESULT.W05` | **Target G1:** result template contains only committed milestone/link. **Target G4:** result copy is static/dismissible. |
| S10 `gate-zenith` — Abyss Regent | `STAGE_STARTED`: W-03 tenth Gate plus W-01 Echo Deep/Moonless Court network context; W-05 resolves only committed campaign completion. | `BOSS_SPAWNED`: Abyss Regent is the last boss identity in the fixed campaign; its arrival does not advance or unlock anything. | Entry can state final extraction/Gate defense as committed labels. Boss sting + boss-weight are observers. `TERMINAL/FINAL_COMPLETION` requests a restrained W-05 recap and resolution fade; it never requests a next-stage music/entry cue. | `NAR.S10.ENTRY.W01W03`; `SFX.BOSS.S10.ARRIVE`; `MUS.S10.BOSS`; `NAR.S10.FINAL.W05`; `MUS.S10.RESOLVE` | **Target G1:** 0 next-stage/Stage-11 strings. **Target G4:** completion remains readable if all audio/motion fail. |

### Per-stage event order

Each stage uses the same bounded sequence; variation changes only approved labels/assets, never phase meaning:

1. `STAGE_STARTED` → edge title / optional W-01, W-03, or W-04 caption.
2. Proposed `objectiveRevealed` adapter → static W-02 or W-04 marker only from the committed stage plan; optional sparse narration.
3. `damageResolved`, `attackResolved`, and `criticalResolved` → combat callout policy below.
4. `BOSS_SPAWNED` → instant visual boss identity and arrival SFX; independently requested BGM state.
5. `TERMINAL` + `VICTORY` / `FINAL_COMPLETION` / `DEFEAT` → W-03/W-05 result presentation only after the terminal result exists.

## Combat callouts and BGM transition policy

| Situation | Required cue/caption ID family | Trace | Priority / frequency target | Player-facing rule |
| --- | --- | --- | --- | --- |
| Normal automatic attack resolves | `SFX.WARDEN.ATTACK.NORMAL`, `VFX.COMBAT.NORMAL`, optional `CAP.COMBAT.NORMAL` **disabled by default** | W-01 Command Echo | P3; bucket in 125 ms windows, at most 8 emitted impacts/s. | This is texture, not a battle cry or essential information; it yields to all higher priorities. |
| Critical resolves | `SFX.WARDEN.ATTACK.CRIT`, `VFX.COMBAT.CRIT`, `CAP.COMBAT.CRIT` | W-01 Command Echo | P2; one request per resolved `eventId`; no more than one visual flash component above 3/s. | Static angular glyph + `CRIT` text/icon remains in mute/reduced motion; audio cannot change damage. |
| Warden exertion / player battle-callout | `SFX.WARDEN.EXERTION.{01..04}`, `CAP.WARDEN.EXERTION` | W-01 Command Echo | P3; **Target:** no more than one per 8 s and suppress during narration/P0/P1. | **Proposal:** non-verbal only; do not add spoken Warden dialogue in this slice. |
| Boss arrival | `SFX.BOSS.Snn.ARRIVE`, `CAP.SFX.BOSS.Snn.ARRIVE`, `VFX.BOSS.Snn.IDENTITY` | W-03 Gate Integrity | P1; once per `(eventId, bossId)`; **Target:** enqueue ≤100 ms. | Boss already exists in authoritative state. The plate/locator is primary; sting is optional. |
| Gate danger / player damage | `SFX.GATE.DANGER`, `SFX.WARDEN.DAMAGE`, corresponding static HUD/contour IDs | W-03 Gate Integrity | P0; never ducked or displaced by attack/crit/narration. | Danger location and Gate/player distinction are visible without audio. |
| Stage entry/objective | `MUS.Snn.BED`, `MUS.Snn.COMMAND`, `NAR.Snn.ENTRY.*`, `NAR.Snn.OBJECTIVE.*` | Bed: W-04 Domain; command: W-01/W-02 as named | P2 narrative; **Target:** <=12 words/line and >=8 s between non-emergency lines. | BGM/narration are optional and cannot gate first movement. |
| Boss state / result | `MUS.Snn.PRESSURE`, `MUS.Snn.BOSS`, `MUS.S10.RESOLVE` | Pressure/boss: W-03; resolve: W-05 | P1 BGM; **Target:** no more than one full-bed transition request/4 s and no base-bed restart in a 60-s boss fixture. | Arrival/result event occurs immediately; the musical change may align to a bar or be omitted. |

## Localization and asset contract

IDs are stable ASCII integration keys; localized text and local media are separate manifest data. Do not concatenate stage names, interpolate unvalidated text, or select voice files from a rendered string.

```text
NarrativeCueDefinition {
  cueId: "NAR.Snn.PHASE.TRACE",
  eventType, allowedStageId, canonicalTraces[], priority,
  captionKey, voiceAssetId?, sfxId?, bgmStateId?,
  allowedFacts[], fallbackCaptionKey, maxWords,
  cooldownTicks, variantIds[], manifestVersion
}

CaptionCatalogEntry {
  captionKey, locale, speakerKey?, text,
  nonSpeechDescriptionKey?, bidiPolicy, maxLineCount
}
```

| ID pattern | Example | Required facts | Localization/fallback rule |
| --- | --- | --- | --- |
| Stage narration | `NAR.S06.ENTRY.W01W03` | `stageId`, authorized stage/objective labels, W trace | `captionKey` is required; optional local voice must use the same speaker/semantic key. |
| Objective acknowledgment | `NAR.S07.BIND.W02` | confirmed objective/extraction state only | If payload/schema fails, suppress instead of free-writing. |
| Boss arrival | `SFX.BOSS.S04.ARRIVE` / `CAP.SFX.BOSS.S04.ARRIVE` | `eventId`, `bossId`, stage ID | Boss plate and caption remain if asset is missing or audio muted. |
| Normal/critical combat | `SFX.WARDEN.ATTACK.NORMAL` / `.CRIT` | resolved damage event ID, `critFlag` | Crit gets a semantic text/icon fallback; normal may be silent. |
| Non-verbal player exertion (proposal) | `SFX.WARDEN.EXERTION.01` | confirmed sustained movement/attack state, not raw input | Caption key describes non-speech exertion only when this optional setting is enabled. |
| Intermediate result | `NAR.S01.RESULT.W05` … `NAR.S09.RESULT.W05` | `TERMINAL` + `VICTORY`, committed Archive/reward payload and next-stage link | Caption/card uses only committed result fields and the existing next-stage action; it cannot unlock it. |
| Final result | `NAR.S10.FINAL.W05` | `TERMINAL` + `FINAL_COMPLETION` | Caption says campaign completion using only committed result fields; no follow-on stage key exists. |

## Player-control and cinematic safety rules

1. **Input remains live from the first frame.** Every entry, boss, extraction-result, victory, defeat, and final-completion presentation is immediately skippable and must not lock movement or automatic combat.
2. **No cinematic owns time.** A requested 8 s entry/result layout is a maximum presentation window, not a pause, simulation-clock hold, or required viewing period. There is no runtime video requirement.
3. **Critical gameplay remains visible.** No central opaque panel may cover enemies, projectiles, hazards, or stable player/Gate HUD. P0 threat/damage occupies priority over all narration, normal hits, and decoration.
4. **Static parity is mandatory.** Mute, mono, missing assets, reduced audio, and `prefers-reduced-motion` retain the same event identity, caption/static marker, boss/Gate status, and control availability. Nonessential camera shake, flash, bloom, and transition motion are removed.
5. **Caption lane is single-owner.** A new non-emergency narration line cannot overlap another; P0/arrival captions pre-empt narration. Captions identify a non-obvious speaker or meaningful sound where enabled, but basic-hit spam is excluded.
6. **Cinematic facts are allowlisted.** Valid slots are `stageId`, authored stage/objective/domain labels, committed boss/Gate state, confirmed result, and authorized milestone. No line predicts survival, reveals a probability, invents a speaker’s thoughts, or fabricates history.
7. **Presentation cannot become replay authority.** Log `eventId`, `simTick`, `cueId`, chosen `variantId`, suppression reason, and fallback outcome locally. The simulation hash before/after every delivery must be equal.

## Testable hypotheses and gate linkage

| Gate | Proposed evidence / measurable hypothesis | Target / falsifier | Status |
| --- | --- | --- | --- |
| **G1 — narrative/worldview consistency** | Audit every `NAR.*`, `CAP.*`, `SFX.*`, `MUS.*`, and authored line against W-01…W-05 plus canonical trigger/payload schema. | 100% traced cue IDs; 0 unallowlisted facts; 0 trigger substitutions without the compatibility mapping; 0 Stage-11/next-Gate result keys; 100% of `S10` result fixtures resolve only W-05 campaign completion. | **UNPASSED / not measured** |
| **G1 — stage-world comprehension** | Static caption/marker task across all ten `STAGE_STARTED`, `BOSS_SPAWNED`, and `TERMINAL` fixtures. | **Target:** preregister >=80% correct identification of stage objective/Gate status with audio absent; revise copy/placement if below target. | **UNPASSED / not measured** |
| **G4 — control-safe presentation** | Replay identical seed/input with captions on/off, voice asset present/missing, mute/mono, normal/reduced motion, and delayed BGM. | Byte-identical authoritative state/event hashes and 0 input-lock assertions; any divergence is a failure. | **UNPASSED / not measured** |
| **G4 — readability and timing** | First-seen boss-arrival/crit capture, static fallback audit, and event-to-presentation trace. | **Target:** >=95% of eligible P0/P1 presentation requests enqueue within 100 ms in controlled runs; 0 central-panel or P3-over-P0 occlusions; <=3 flashes/s/component. | **UNPASSED / not measured** |
| **G4 — narration load** | 60-s boss fixture records trigger, queue, caption start/end, pre-emption, and cue disposition. | **Target:** 0 overlapping non-emergency lines; >=8 s narrative spacing; no P0/P1 drop caused by P3 audio. | **UNPASSED / not measured** |

## References

**Local primary sources**

- Active canon and cinematic contract: `_workspace/20260722-defense-survival-expansion/design/worldview.md` (accessed 2026-07-22).
- Current authoritative stage/boss catalog: `defense-catalog.js:425–436` (accessed 2026-07-22).
- Product control/determinism contract: `docs/abyssal-command-defense-survivor-design.md` (accessed 2026-07-22).
- Existing observer/audio proposals: `research/narrative-stage-presentation.md`, `research/audio-narration-direction.md`, and `design/presentation-spec.md` in this active workspace (accessed 2026-07-22).

**External sources**

- **E1:** Audiokinetic, [Wwise Help: Music transitions](https://www.audiokinetic.com/en/library/edge/?source=Help&id=music_transitions.html) — transition rules, synchronization, fades, and segments; accessed 2026-07-22.
- **E2:** Microsoft, [Xbox Accessibility Guideline 103: Visual and audio cues](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/103) — multimodal critical cues; accessed 2026-07-22.
- **E3:** Microsoft, [Xbox Accessibility Guideline 104: Subtitles and captions](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/104) — speech/non-speech text equivalents and speaker context; accessed 2026-07-22.
- **E4:** Microsoft, [Xbox Accessibility Guideline 105: Audio customization](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/105) — independently configurable audio output; accessed 2026-07-22.
- **E5:** W3C, [Understanding SC 1.2.2: Captions (Prerecorded)](https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html) — meaningful audio and speaker identification in captions; accessed 2026-07-22.
- **E6:** W3C, [Understanding SC 2.3.3: Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) — reduce nonessential interaction-triggered motion; accessed 2026-07-22.
- **E7:** W3C, [Understanding SC 2.3.1: Three Flashes or Below Threshold](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html) — three-flashes safety ceiling; accessed 2026-07-22.
- **E8:** inkle, [Running your ink](https://github.com/inkle/ink/blob/master/Documentation/RunningYourInk.md) — tags/metadata as an authoring example; accessed 2026-07-22.
- **E9:** Godot Engine, [Using signals](https://docs.godotengine.org/en/stable/getting_started/step_by_step/signals.html) — decoupled observer/message pattern; accessed 2026-07-22.
