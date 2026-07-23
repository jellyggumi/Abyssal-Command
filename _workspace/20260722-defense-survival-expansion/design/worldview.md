---
gate: G1
owner: narrative-cinematics-director
status: FIX
authority:
  - "llm-wiki:wiki/reports/2026-07-22-abyssal-command-defense-rpg-production-plan.md"
  - "defense-catalog.js"
audit: "../qa/lore-audit.md"
---
# Worldview and cinematic trace source of truth

## Purpose and boundary

This document preserves the narrative contract for the ten-stage defense-survivor and gives presentation owners a traceable cinematic vocabulary. The active llm-wiki production report defines the canon; `defense-catalog.js` defines the current authored catalog. The exhaustive, string-level inventory and defects are in [`../qa/lore-audit.md`](../qa/lore-audit.md).

This contract does not claim that an authored string, cue, or clip is visible unless its inspected consumer is named in the audit. It does not change simulation state, balance, stage order, or runtime code.

## Canon

- **Dusk Warden** is the player-controlled commander and the only figure established here as able to reverse the obedience signal.
- **Moonless Court** exploits lunar-fracture **Echo Deep** matter as an obedience signal.
- The Dusk Warden reverses that signal at damaged Gates, converting hostile memory into defensive command.
- The defense loop reads: **Gate defense → Echo recovery → growth → occupation/extraction → boss kill**. Occupation is control of a bounded extraction point, never ownership of a kingdom.
- A stage victory restores a containment line; it does not destroy the Echo Deep.
- The campaign has exactly ten ordered stages. The ending occurs at **Gate Zenith**, where the Moonless Court command network is severed and the containment line holds. It does not promise an eleventh gate or the destruction of the abyss.

## Trace dictionary

| trace ID | canonical player language | gameplay/event boundary | presentation boundary |
|---|---|---|---|
| W-01 | Command Echo / Echo / 잔향 | enemy defeat, XP harvest, item residue, elite residue | teal fragments travel toward the Dusk Warden; never a generic mana orb |
| W-02 | Bind / Extract / 결속·추출 | occupation/extraction point, elite candidate, timed extraction, companion unlock | point-state marker plus three-ring or diamond command seal; permanent acquisition is confirmed only after extraction |
| W-03 | Gate Integrity / 관문 내구 / 봉쇄선 | stage entry, chokepath/flank/elevation/hazard pressure, boss threat, victory or defeat | fractured map-line and integrity text; not an unexplained HP bar |
| W-04 | Domain / 영역 | bounded active skill and growth choice | desaturated field plus command lines; no vision-blocking flash |
| W-05 | Archive / 기록실 | persistent reward, recorded companion, campaign result | sealed dossier/card and the next-stage link; no commerce or paid-power language |

Every shipped string, effect, scenario, cue, animation label, and generated-resource entry must cite at least one of W-01…W-05. A trace identifies the canonical concept that explains the entry; it is not evidence that the runtime consumer exists or that a gate passed.

Distinct stage chokepaths, flanks, elevation, hazards, and occupation/extraction points may change movement, range, or recovery only through deterministic 60 Hz simulation-owned state. Cinematics, animation, VFX, audio, and renderers observe those outcomes; they never decide them. The inspected catalog now authors those spatial features for all ten stages and the inspected simulation consumes them; this source inspection is not runtime-test evidence.

## Cinematic beat contract

All four beats are renderer-only observations. They must be skippable from the first frame, must not block movement or action input, and must leave the simulation clock and deterministic state authoritative. Runtime video is never required.

| beat | authoritative trigger | duration | standard presentation | reduced-motion and text fallback | trace |
|---|---|---:|---|---|---|
| Intro | `STAGE_STARTED` carrying `CUTSCENES[stage].intro`, with `CUTSCENES.default.intro` only when no stage-specific entry exists | 8s | stage title, two short text lines, Gate map-line reveal, optional `stage-start` cue | static status overlay with the same title and lines; no camera move, shake, flash, or autoplay media | W-03; W-01/W-02 only when the authored intro names Echo/extraction |
| Extraction | successful recovered-memory resolution after elite defeat **and** spatial hold; candidate/progress events are setup, and current success event names are not sufficient until QA-D003/QA-X002 converge | 6s | occupation point resolves, three-step seal closes around recovered residue, companion/record confirmation, optional extraction-success cue | static “결속 완료” status plus the companion/Archive result; no pulsing rings or camera move | W-01, W-02, W-05 |
| Boss victory | `TERMINAL` with `VICTORY` or `FINAL_COMPLETION`, carrying the stage `victory` line | 8s | boss pressure clears, containment line reconnects, Archive reward handoff | static victory line, outcome, and reward/next action text; no full-screen flash | W-03, W-05 |
| Defeat | `TERMINAL` with `DEFEAT`, carrying the stage `defeat` line | 6s | Gate fracture holds on the last pressure axis and exposes retry/lobby actions | static defeat line plus retry/lobby actions; no shake, strobe, or forced delay | W-03, W-05 |

For `gate-zenith`, `FINAL_COMPLETION` is a distinct ending variation of the boss-victory beat: the Moonless Court command network is severed, the tenth containment line holds, and the Echo Deep remains contained. This is the canonical ending, not a promise that another Gate opens.

### Current implementation evidence boundary

- The inspected app creates a text overlay for authored cutscene events, exposes a `계속` dismissal control, and removes it after eight seconds.
- The recorded automated evidence covers the stage-entry overlay only: `tests/defense-cutscene.test.mjs`, `tests/defense-survivor-browser.cjs`, and the cycle-1 retrospective.
- The inspected terminal events carry victory/defeat cutscene text, but this document does not promote them to verified browser evidence.
- `ELITE_EXTRACTED` and `EXTRACTION_COMPLETED` carry audio cues but no authored cutscene payload. QA additionally observed point extraction before any elite candidate and remote elite Bind without spatial hold, so neither event is yet a truthful recovered-memory cinematic trigger. The six-second extraction beat remains a specification gap, not a claimed runtime feature.
- The inspected reduced-motion CSS removes the overlay shadow while text remains. The complete no-camera/no-flash fallback above is normative and not claimed as browser-verified.

## Content audit and release rule

Generic mana, loot-crate, kingdom, unrelated light-magic, commerce, network-account, or destructive-abyss language is a lore violation unless a narrative-director waiver names a reason and expiry. Ambiguous wording is not silently reinterpreted; it remains a violation until the catalog supplies the missing relationship or the owning role records an approved correction.

The 2026-07-22 resolved-copy audit covers all 136 string/event entries in `CUTSCENES`, `ITEMS`, `REWARDS`, `AUDIO_CUES`, `STAGES`, and `ANIMATION_CLIPS`; zero live lore violations remain in those six groups. It also identifies sampled player-facing app and renderer copy, but does not claim a full shipped-content audit. Presentation gaps remain, so **G1 is FIX and is not PASS**.