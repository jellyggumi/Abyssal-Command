# Solo Leveling UI Direction — Stage 1b Lobby / Combat HUD

run-id: `20260726-stage1b-cinder-pressure-agency`
owner: visual/ui
scope: `_workspace/20260726-stage1b-cinder-pressure-agency/visual/ui/` PNG reference generation + lobby/combat HUD direction only

## 1. Generation method and command evidence

- [OBSERVED] I checked the real CLI contract first with `gti --help` before generating anything. The help output exposed `--prompt`, `--output`, `--model`, `--provider`, `--image`, and `--size`, and listed the valid provider values as `private-codex | codex-cli | auto`.
- [OBSERVED] Initial generation attempts using the default provider path with `--size 2048x1152` failed three times with `Error: Private Codex backend request failed with HTTP 429.`
- [OBSERVED] A control test with `gti --provider codex-cli` successfully produced a real PNG, so the final production runs below used `--provider codex-cli`.
- [OBSERVED] No placeholder or fabricated files were created; only successful `gti` outputs were retained.

## 2. Generated reference images

### 2.1 Main HUD reference
- [OBSERVED] Output path: `_workspace/20260726-stage1b-cinder-pressure-agency/visual/ui/solo-leveling-hud.png`
- [OBSERVED] File verification: PNG image, `1672×941`
- [OBSERVED] Prompt:
  - `A UI/UX game interface screenshot of an action RPG mixed with a defense and offense strategy game, set in a Solo Leveling style dark fantasy universe. Neon blue and deep violet holographic system windows, dark glowing aesthetic. Top-left player health and shadow mana bars. Bottom-right tactical command UI for an army of shadow soldiers with formation buttons (Defense and Offense modes). Mini-map showing enemy wave invasion lines. Sleek modern sci-fi fantasy UI design, 4k, UI/UX concept art, 16:9`
- [OBSERVED] Successful command actually run:
  - `cd /Users/jangyoung/orca/Abyssal-Surge && gti --prompt "A UI/UX game interface screenshot of an action RPG mixed with a defense and offense strategy game, set in a Solo Leveling style dark fantasy universe. Neon blue and deep violet holographic system windows, dark glowing aesthetic. Top-left player health and shadow mana bars. Bottom-right tactical command UI for an army of shadow soldiers with formation buttons (Defense and Offense modes). Mini-map showing enemy wave invasion lines. Sleek modern sci-fi fantasy UI design, 4k, UI/UX concept art, 16:9" --output "_workspace/20260726-stage1b-cinder-pressure-agency/visual/ui/solo-leveling-hud.png" --provider codex-cli`

### 2.2 System window / skill tree reference
- [OBSERVED] Output path: `_workspace/20260726-stage1b-cinder-pressure-agency/visual/ui/solo-leveling-system-window.png`
- [OBSERVED] File verification: PNG image, `1672×941`
- [OBSERVED] Prompt:
  - `A game UI design for a leveling up system window. Floating holographic text saying Quest Arrived in glowing blue font. Stat allocation panel for Strength, Agility, Intelligence and Sense. Complex skill tree web with dark blue and purple glowing nodes. Inventory grid with glowing items and shadow extraction slots. Clean immersive futuristic fantasy UI/UX design, dark background, 16:9`
- [OBSERVED] Successful command actually run:
  - `cd /Users/jangyoung/orca/Abyssal-Surge && gti --prompt "A game UI design for a leveling up system window. Floating holographic text saying Quest Arrived in glowing blue font. Stat allocation panel for Strength, Agility, Intelligence and Sense. Complex skill tree web with dark blue and purple glowing nodes. Inventory grid with glowing items and shadow extraction slots. Clean immersive futuristic fantasy UI/UX design, dark background, 16:9" --output "_workspace/20260726-stage1b-cinder-pressure-agency/visual/ui/solo-leveling-system-window.png" --provider codex-cli`

### 2.3 Shadow extraction / legion formation reference
- [OBSERVED] Output path: `_workspace/20260726-stage1b-cinder-pressure-agency/visual/ui/solo-leveling-shadow-extraction.png`
- [OBSERVED] File verification: PNG image, `1672×941`
- [OBSERVED] Prompt:
  - `A game UI screen for a Shadow Extraction mechanic in a dark fantasy action game. A character standing in front of a fallen enemy soul with a glowing text prompt ARISE. A secondary tactical management screen showing slotted shadow soldier units organized for a massive offense wave battle. Dark blue purple and black palette, high-end game UI/UX, digital art, 16:9`
- [OBSERVED] Successful command actually run:
  - `cd /Users/jangyoung/orca/Abyssal-Surge && gti --prompt "A game UI screen for a Shadow Extraction mechanic in a dark fantasy action game. A character standing in front of a fallen enemy soul with a glowing text prompt ARISE. A secondary tactical management screen showing slotted shadow soldier units organized for a massive offense wave battle. Dark blue purple and black palette, high-end game UI/UX, digital art, 16:9" --output "_workspace/20260726-stage1b-cinder-pressure-agency/visual/ui/solo-leveling-shadow-extraction.png" --provider codex-cli`

## 3. Current-screen mapping guidance

### 3.1 Lobby / staging surface
- [OBSERVED] The current lobby render in `app.js` builds a command-deck shell with `Warden Corps 방어선` header, a dedicated `시스템 상태창` (`#monarch-status`), command tabs (`출정 / 성장 / 군단 / 인벤토리 / 요새`), a sortie hero block with `작전 개시`, a stage atlas, and a tactical briefing panel.
- [OBSERVED] The current `시스템 상태창` already exposes read-only progression facts relevant to this concept: 저지 레벨, 그림자 마력(Echo Core), 군단 정원, 결속 병력, 추출 기록, plus an `ARISE` hint.
- [TARGET] Use `solo-leveling-system-window.png` as the primary style reference for the lobby’s `#monarch-status`, growth, inventory, and companions surfaces. Keep the existing information architecture, but restyle panels as dark translucent system windows with neon-blue / deep-violet holographic edges, luminous section dividers, and denser “system notice” hierarchy.
- [TARGET] Treat the current `그림자 마력 (Echo Core)` gauge as the Solo Leveling-style shadow mana readout. Preserve the existing value semantics, but present the fill, label, and rank badge as a premium holographic resource bar rather than a conventional sci-fi dashboard meter.
- [TARGET] Map the reference’s stat-allocation and skill-web language onto the current 성장 tab (`스탯 / 스킬트리 / 특성`) without inventing new mechanics. The visual goal is a floating “system window” that makes permanent growth feel diegetic and monarch-driven.
- [TARGET] Map the reference’s inventory grid language onto the current 인벤토리 tab and the reference’s shadow-extraction slots onto the current 군단/편성 surfaces. Existing companion slots should read like shadow legion roster sockets, not generic card slots.
- [TARGET] Apply `solo-leveling-shadow-extraction.png` to the lobby-side companion presentation by framing slotted allies as summoned shadow units under monarch control. This should affect portrait frames, slot borders, active/inactive state treatment, and extraction-history emphasis.
- [TARGET] In the sortie hero and tactical briefing, push the fantasy from “command archive” toward “monarch preparing a shadow legion deployment”: dark background planes, blue-violet runic light, stronger character-centric focal framing, and one decisive highlighted CTA.

### 3.2 Combat HUD / battle surface
- [OBSERVED] The current battle surface in `app.js` renders a full-screen combat shell with: top-left mission panel (`.hud-mission`), top-center loop-state panel (`.hud-loop-state`), top-right objective chip and skill stack, bottom-left commander/gate integrity panel, bottom-center one-thumb movement cluster, and bottom-right battle actions including stance cycle, pause, and contextual extract action.
- [OBSERVED] The current battle HUD already contains data that aligns with the requested concept: objective phase, pressure, growth, formation state, extraction state, commander/gate integrity, active skills, passives, and a `SHADOW LEGION` panel with mana track and roster.
- [TARGET] Use `solo-leveling-hud.png` as the direct reference for the combat frame. The closest one-to-one mapping is:
  - top-left health / shadow mana bars → current commander integrity + `SHADOW LEGION` mana presentation
  - bottom-right tactical command UI → current stance cycle + extract action cluster
  - enemy-wave map language → current objective/pressure/extraction messaging and any minimap-like invasion guidance in future presentation passes
- [TARGET] Merge the current combat chrome into a more authored “system authority” look: black glass base planes, neon-blue primaries, deep-violet secondary glows, subtle rune-line separators, and brighter emergency accents only for threat or extraction urgency.
- [TARGET] Present the current stance switch (`전열 / 포대 / 분산`) as a shadow-army formation command, not only a glyph swap. The button cluster should visually imply “Defense / Offense / Formation doctrine” and inherit the regal monarch-command tone from the reference.
- [TARGET] When the current contextual extract button appears, it should inherit the `ARISE` ceremony from `solo-leveling-shadow-extraction.png`: a stronger summoning cue, sharper prompt contrast, and a clearly elevated reward moment relative to ordinary combat controls.
- [TARGET] Preserve existing HUD placement logic where possible, but visually group it into three clearer fantasy clusters: monarch vitality/resources, battlefield objective/threat, and shadow legion command. The style shift should reduce the present debug-panel feeling without changing simulation ownership.

### 3.3 Cross-screen style rules
- [TARGET] Primary palette: near-black / charcoal base, electric blue system glow, deep violet secondary glow, restrained white typography, and minimal warm contrast only for enemy danger or urgent breach states.
- [TARGET] Typography treatment: floating holographic labels, compact uppercase micro-labels for system metadata, and one high-contrast Korean action verb per key decision.
- [TARGET] Frame language: thin luminous borders, inner glow, subtle panel transparency, soft volumetric bloom, and layered hologram depth rather than flat opaque cards.
- [TARGET] Iconography: shadow soldier slots, rune-like stat nodes, monarch-rank emblems, extraction sigils, and formation-mode glyphs should all feel part of one “System” rather than mixed dashboard conventions.
- [TARGET] Maintain responsiveness and presentational-only safety: this direction changes visual treatment and grouping cues, not simulation values, extraction rules, campaign schema, or runtime ownership.

## 4. Failure record retained for traceability

- [OBSERVED] Failed command family: the initial HUD generation was attempted with the default provider path and `--size 2048x1152`, but the provider returned `HTTP 429` repeatedly.
- [OBSERVED] Recorded failure text: `Error: Private Codex backend request failed with HTTP 429.`
- [OBSERVED] Resolution: switched to the documented `--provider codex-cli` path and reran the three requested prompts successfully.
