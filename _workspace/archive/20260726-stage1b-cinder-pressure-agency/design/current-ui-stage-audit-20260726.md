# Current UI / Stage Audit — 2026-07-26

run-id: `20260726-stage1b-cinder-pressure-agency`  
review surface: current local browser build, Cinder Span lobby → combat → stance/movement → pause/build panel → defeat  
review mode: first-exposure game-UI and stage-readability audit  
concept baseline: `../intake/production-brief.md`, `foundation-20260723-concept.md`, `core-loop.md`, and `pressure-agency-redesign.md`

## Evidence status and method

- **OBSERVED:** Fresh Chromium sessions opened the local build at `1440×900` desktop, `1280×720` desktop control pass, and `390×844` portrait. The portrait launch was checked both with the app's fullscreen request and in a fresh unlocked portrait session. I started Cinder Span, let combat resolve, used movement and formation controls, opened the pause/build surface, and returned to the lobby after defeat.
- **OBSERVED:** The first desktop run progressed from the opening state to defeat before a growth, occupation, or extraction decision was presented. This is current-build play evidence from this browser/environment, not a claim about every seed or machine.
- **OBSERVED:** Desktop layout measurements came from rendered DOM boxes at `1280×720`: mission panel `255×112`, run-state panel `240×116`, bottom edge band `1267×116`, movement cluster `239×44`, and battle-action cluster `116×44`.
- **OBSERVED:** True portrait measurements came from rendered DOM boxes at `390×844`: mission panel `147×153`, run-state panel `129×157`, objective chip `85×63`, integrity panel `164×228`, movement cluster `141×93`, and action cluster `63×96`. The top and bottom combat bands occupy `157 + 228 = 385 px`, leaving only `459 px` (54.4% of viewport height) between them before world composition is considered.
- **INFERENCE:** A first-time player is likely to read the current screen as a telemetry-heavy survival arena rather than the intended command fantasy of one Dusk Warden directing a formation through a hold–surge–extract circuit.
- **TARGET:** This packet recommends presentation-only priorities. It does not authorize simulation, balance, runtime-ID, campaign-schema, or persistence changes.

## Spatial evidence

| Evidence | What it proves |
|---|---|
| [Desktop lobby, 1440×900](current-ui-audit-desktop-lobby.png) | Strong title/CTA hierarchy, but the hero area and campaign map read as a command console rather than a character-led RPG staging area. |
| [Desktop live combat](current-ui-audit-desktop-cutscene.png) | Full-bleed canvas, sparse blockout stage, edge HUD distribution, tiny actors, cyan objective ring, and large unused red void. |
| [Desktop formation switch](current-ui-audit-desktop-stance.png) | Formation label changes to `분산` and button glyph changes to `ψ`, while combat event feedback remains occupied by `CRIT`. |
| [Desktop movement](current-ui-audit-desktop-movement.png) | Movement changes world position and leaves only focus outline on the selected arrow; there is no held-direction or path/velocity readout. |
| [Desktop pause/build panel](current-ui-audit-desktop-paused.png) | RPG information is available during combat, but as a centered inspector-like modal that obscures the battlefield. |
| [Desktop defeat](current-ui-audit-desktop-defeat.png) | Result actions are clear, but the same dense combat HUD remains behind the result and the stage does not visually explain the collapse. |
| [Portrait lobby, 390×844](current-ui-audit-portrait-lobby.png) | The lead CTA remains above the fold and cards stack cleanly; the complete lobby becomes a `2321 px` scroll. |
| [Portrait unlocked combat, 390×844](current-ui-audit-portrait-unlocked-battle.png) | Top panels collide with the camera view, the integrity block and controls consume most of the lower field, and the narrow battlefield cannot preserve lane context. |
| [Portrait movement/result](current-ui-audit-portrait-movement.png) | The defeat/result panel overlaps the already crowded bottom controls and integrity card. |

## Abyssal Surge concept fit

The project contract is not a generic dashboard. It is a responsive defense/offense action RPG in which the player must read a threatened objective, move/orbit, switch formation for a visible reason, choose growth without losing defense context, and complete a persistent elite extraction (`../intake/production-brief.md#player-contract`). The current presentation does expose raw snapshot facts—phase, pressure, integrity, level/XP, stance, and extraction state—matching the data list in `pressure-agency-redesign.md`. It does not yet stage those facts into the causal visual sentence the same document requires:

`pressure packet → readable threat → player decision → consequence → recovery or extraction choice`

**OBSERVED:** raw data coverage is stronger than authored moment-to-moment direction.  
**INFERENCE:** the missing layer is not more HUD; it is stronger spatial staging, threat choreography, actor differentiation, and decision feedback using the already retained presentation assets.  
**TARGET:** preserve the snapshot contract while turning every phase transition into an immediately visible change in the world and one concise edge-HUD cue.

## Current hierarchy map

### Lobby / staging

1. **Brand and campaign status** — `Warden Corps 방어선`, archive connection, `0/10` blockade status.
2. **Primary navigation** — sortie, growth, companions, inventory, fortress.
3. **Sortie hero** — imperative headline, objective/threat/formation summary, primary `작전 개시` CTA.
4. **Seal Atlas card** — abstract threat–bind–gate relationship and terrain/landmark/threat/extraction text.
5. **Campaign map** — ten vertically listed fronts, nine disabled on a fresh save.
6. **Tactical briefing and record management** — repeated Cinder description, terrain/threat/reward metadata, local save controls.

**OBSERVED:** desktop gives the start CTA first priority, and portrait keeps it above the fold. Growth and companion sections are logically separated and correctly expose permanent progression versus active formation.  
**INFERENCE:** repetition among the hero summary, Seal Atlas, campaign row, and tactical briefing dilutes the character/formation fantasy. The lobby communicates system completeness more strongly than “this Warden and this squad are about to hold this gate.”

### Live combat

1. **World canvas** — full viewport and simulation-authoritative action.
2. **Top-left mission panel** — stage, domain, terrain string, elapsed state, XP bar.
3. **Top-center run-state panel** — objective phase, pressure/integrity, growth, formation, extraction.
4. **Top-right objective chip** — current command.
5. **World feedback** — cyan objective circle, actors, damage numbers, attack/critical effects.
6. **Bottom-left integrity panel** — commander/gate values, enemies/kills/items, bars.
7. **Bottom-center movement** — five `44×44 px` desktop buttons; portrait reflows to a `141×93 px` cluster.
8. **Bottom-right tactical actions** — formation cycle and pause.
9. **Modal layer** — cutscene/lore, pause/build inspector, growth/result surfaces.

**OBSERVED:** the same integrity numbers appear in both the top-center panel and bottom-left panel. Objective phase and current command appear in separate top panels.  
**INFERENCE:** duplicated values and fragmented decisions make the eye scan UI chrome while the relevant threat remains unlabeled in the world.

## Current stage-layer map

| Layer | OBSERVED current Cinder Span | INFERENCE against the concept | TARGET direction |
|---|---|---|---|
| 0. Atmospheric field | Uniform rust-red void dominates the upper and outer screen. | Reads as renderer clear color, not the Echo Deep / ash-storm environment. | Use the retained Cinder world plate or equivalent dark depth layer; reserve ember red for threat, not the whole void. |
| 1. Macro topology | A broad rectangular platform, a three-slab bridge from the left, and large empty space. | The route does not clearly encode “threat approaches gate, Warden intercepts, then occupies/extracts.” | Compose an unmistakable ingress lane, defendable choke, gate anchor, and later extraction pocket in one camera view. |
| 2. Landmarks/objectives | Bright cyan ring on the right; small dark ground mark; pale bridge slabs. | Ring semantics are ambiguous: rally point, gate, capture zone, or extraction zone are visually interchangeable. | Give gate, occupation, and extraction distinct silhouettes, materials, labels, and phase-specific activation. |
| 3. Actors | Small dark commander; pale-magenta enemies cluster around the same center; boss/elite scale separation is modest from the bird's-eye camera. | Models exist but armor/role silhouettes collapse at play scale and overlap under effects. | Enforce screen-space role hierarchy: commander, companion, grunt, elite, boss each distinct by size, value, outline, and motion cadence. |
| 4. Combat/world HUD | Floating damage numbers, yellow critical starburst, magenta attack/defeat effects. No consistently visible unit role/name/health or directional threat line in captured frames. | Consequences are numerical but not tactical; the player sees damage without learning why the gate or formation is failing. | Show target lock, incoming lane, frontline boundary, formation footprint, and damage ownership without adding omniscient simulation data. |
| 5. Edge HUD | Mission/run-state/objective on top; integrity/movement/actions on bottom. | Raw snapshot coverage is good, but duplication and small type compete with the stage. | One objective ribbon, one integrity cluster, one contextual decision slot, with responsive priority collapse. |
| 6. Modal | Pause/build and result cards dim the stage; cutscene/status copy appears over live combat. | RPG context is detached from the defendable world and can obscure the causal moment it describes. | Keep at least 40% of battlefield visible beside growth/build decisions and freeze all pressure visibly while choosing. |

## Desktop observations

- **OBSERVED:** The lobby is the strongest current surface: high-contrast headline, cyan accent, obvious start CTA, and concise first-stage summary. The tactical identity is conveyed through language and linework, not through Warden, enemy, terrain, or companion imagery.
- **OBSERVED:** Combat edge controls meet a `44×44 px` minimum on the `1280×720` pass, and the canvas remains full-bleed.
- **OBSERVED:** At `1280×720`, the mission and run-state panels are each about one-sixth of viewport width; the top-right objective is separated by a large empty gap. The three panels do not form one scan line.
- **OBSERVED:** The stage uses a pale mauve/pink bridge and platform against a flat rust field. This diverges sharply from the existing Cinder concept art's black stone, ember cracks, depth, ruined arches, and smoke.
- **OBSERVED:** The Warden and enemy meshes animate/change pose, damage numbers appear, and a critical starburst is visible. The small scale and similar magenta/purple combat palette make friend/foe and attack ownership difficult to parse.
- **OBSERVED:** Formation cycling changes the button glyph from `▲` to `ψ`, the accessible label to `편성 스탠스: 분산`, and the small top-center line to `편성 분산 · 전환 가능`. The central event feed still displayed `CRIT · 치명타 확정`, so the tactical command had no dedicated consequence message.
- **OBSERVED:** Movement changes the Warden's position, but the chosen arrow has no `aria-pressed`, active class, held state, or persistent directional feedback; only browser focus outline remained after click.
- **OBSERVED:** The pause surface exposes stats, inventory, and companions, which supports the RPG contract. It presents base rows such as `결속력 ... 0/10` rather than a combat-relevant before/after build summary.

## Portrait observations

- **OBSERVED:** The `390×844` lobby stacks without horizontal overflow. Its start CTA, objective, threat, and formation summary are visible in the first viewport. The whole lobby is `2321 px` tall, so campaign map and tactical briefing are far below the decision point.
- **OBSERVED:** A real pointer launch requested fullscreen/landscape, consistent with the README contract. The fresh unlocked portrait session stayed at `390×844`, proving the no-lock fallback path.
- **OBSERVED:** In unlocked portrait combat, top panels occupy `157 px` height and bottom HUD reaches `228 px`; the mission panel (`147 px`) and run-state panel (`129 px`) sit side by side with very narrow copy widths. Korean and English strings wrap to 4–7 lines.
- **OBSERVED:** The objective chip shrinks to `85×63 px`, reducing the command to a narrow block while it also covers the top-right world view.
- **OBSERVED:** The integrity panel becomes `164×228 px`; movement/actions occupy most of the remaining bottom width. The playable world is visible, but lane continuity from left bridge to ring is clipped and harder to read than on desktop.
- **OBSERVED:** Result controls overlay the same crowded lower field instead of replacing or cleanly dismissing movement controls.
- **INFERENCE:** Portrait technically preserves every control and fact, but prioritizes parity over readability. The concept requires logical landscape continuity, not merely fitting all desktop panels into portrait.

## Asset-utilization gaps

The generated manifest contains `207` rows; `63` are retained runtime rows: `50 GLB`, `10 PNG`, `2 WEBP`, and the manifest JSON. Retained GLBs break down as `10` bosses, `1` commander, `9` companions, `4` enemies, `10` props (including tiers), `10` terrain, and `6` VFX. The ten retained PNGs are two app icons plus four Dusk Warden and four Echo Rusher animation frames. The two retained WEBPs are Cinder world plates. Separately, `60` `pilot/concept-*.png` images exist in the repository but are marked non-runtime/delete by the manifest, so they are visual direction only unless re-reviewed.

| Asset family | OBSERVED use | Gap / opportunity |
|---|---|---|
| Cinder terrain GLB | Blocky bridge/platform geometry is visibly present. | The current material/lighting result discards the black-stone, ember-crack, ruined-bridge readability visible in `pilot/concept-terrain-cinder-span.png`. |
| Cinder world plates | Neither retained plate is visibly recognizable in the captured Three.js battle; the background is flat rust. | Use one retained plate as atmosphere/depth or derive a stage palette from it, with a renderer-safe fallback. |
| Commander/enemy/boss GLBs | Warden, multiple enemies, and a larger threat are visible and animated/posed. | Play-scale silhouette, faction value, and role separation are insufficient; the models read as small purple clusters rather than authored identities. |
| Companion GLBs | No companion is available on a fresh save; lobby shows three empty text slots. | The permanent-companion promise lacks a visual tease, locked silhouette, or formation preview before first extraction. |
| Props | No lantern, banner, crystal, hourglass, tier prop, or equivalent landmark was recognizable in the Cinder frames. | Reuse two Cinder-compatible props to define gate/choke/extraction before commissioning new assets. |
| VFX GLBs | Critical burst / attack effects are visible; exact asset identity was not established from browser evidence. | Map one reserved VFX language per tactical event: formation, gate pressure, elite candidate, extraction hold, extraction accepted, and breach. |
| 2.5D animation frames | Mesh animation/pose change was visible; the retained Warden/Rusher PNG frame sets were not visibly identifiable in the active Three.js presentation. | Avoid parallel visual languages. Choose GLB motion as primary and reserve frame assets for deterministic fallback/loading/portrait affordances. |
| Concept PNGs | No hero/boss/terrain concept illustration appears in the fresh lobby. | They provide useful art direction but are marked for deletion; do not wire them into runtime without manifest and rights/provenance review. |

## Twelve severity-rated findings

1. **CRITICAL — Portrait combat loses tactical field to HUD.** **OBSERVED:** only `459/844 px` remain between the measured top and bottom bands; panels wrap aggressively and lane continuity is clipped. **IMPACT:** movement, incoming threat, and objective relationships become harder to read precisely where the mobile-first contract matters most.
2. **HIGH — Cinder Span does not visually deliver its authored world.** **OBSERVED:** pale block platforms on flat rust replace the concept's black masonry, ember fissures, ash, ruins, and abyssal depth. **IMPACT:** the stage lacks identity and the bridge/choke fantasy is not credible.
3. **HIGH — Pressure is reported, not staged.** **OBSERVED:** seconds and integrity values are duplicated in HUD panels, while enemy ingress, threatened lane, and next irreversible event are not consistently marked in world space. **IMPACT:** players can read numbers without understanding what to do.
4. **HIGH — Objective geometry is semantically ambiguous.** **OBSERVED:** a cyan ring is the main landmark, but its role is not labeled in the world and does not visibly transform across gate/occupation/extraction phases in captured play. **IMPACT:** the core hold–occupy–extract route cannot be learned spatially.
5. **HIGH — Actor silhouettes and allegiance collapse at bird's-eye scale.** **OBSERVED:** the Warden and clustered enemies share dark/magenta values and overlap with effects; role and attack ownership are difficult to separate. **IMPACT:** automatic combat reads as visual noise rather than commanded formation behavior.
6. **HIGH — Formation input lacks a dedicated cause/effect beat.** **OBSERVED:** switch feedback is a glyph, accessible label, and small text line; the event feed remained `CRIT`. **IMPACT:** the player cannot tell why `VANGUARD`, `TURRET`, or `SPLIT` mattered, blocking a core concept action.
7. **HIGH — First-exposure agency can end before it becomes visible.** **OBSERVED:** the fresh desktop run reached defeat before growth, occupation, or extraction was offered in this session. **IMPACT:** even if simulation outcomes are correct, the presentation teaches collapse before the intended decision chain.
8. **HIGH — RPG information is separated from combat consequence.** **OBSERVED:** pause exposes stats/inventory/companions in an inspector-like central modal, while the stage is dimmed and rows show base progression rather than current-run deltas. **IMPACT:** growth is legible as data but not as “this choice changes the defense now.”
9. **MEDIUM — World-space HUD is underused.** **OBSERVED:** damage numbers and bursts exist, but captured frames lack persistent unit role/health, target ownership, lane warning, formation footprint, or gate-direction cues. **IMPACT:** edge HUD carries work the world should perform.
10. **MEDIUM — Movement feedback is too subtle for touch play.** **OBSERVED:** movement works, but buttons expose no held/pressed state and the post-click state is primarily a focus outline; event feedback is unrelated combat text. **IMPACT:** players cannot confidently distinguish tap, hold, release, or movement vector.
11. **MEDIUM — Lobby IA repeats briefing data and hides character fantasy.** **OBSERVED:** stage name, threat, terrain, extraction, and reward recur across hero, atlas, map, and briefing; no Warden/companion/boss visual anchors appear. **IMPACT:** the lobby feels like an operational database rather than a sortie lineup.
12. **MEDIUM — Mixed telemetry language and small edge type weaken urgency.** **OBSERVED:** `RUN STATE · AGENCY`, `stable`, `CRIT`, stage metadata, and Korean commands coexist at small sizes; portrait wrapping intensifies the problem. **IMPACT:** system status requires reading instead of immediate recognition.

## Prioritized design direction and measurable targets

### P0 — Recompose combat around the causal loop

**TARGET:** one world-first Cinder composition where the gate, incoming lane, Warden/formation, occupation point, and extraction point are identifiable without reading the debug-style run-state list.

- At `1280×720` and `390×844`, keep at least **65% of viewport area unobscured by opaque HUD/modal surfaces** during live control.
- In portrait, reduce the normal top combat band to **≤110 px** and bottom opaque band to **≤160 px**; no text panel may overlap another panel or a touch control.
- Give every objective phase one distinct world marker and one verb: **DEFEND / RECOVER / CHOOSE / OCCUPY / EXTRACT / RESOLVE** (localized in the final UI). A five-second screenshot test must yield **≥8/10** correct phase identifications.
- Show the next irreversible event and time-to-it in the same objective ribbon; remove duplicate integrity/pressure values elsewhere.
- Present one directional warning for each active arrival lane at least **1.0 s** before contact, using only snapshot-authorized information.

### P0 — Restore Cinder identity with retained assets

**TARGET:** make the current vertical slice visibly belong to Cinder Span before requesting new art.

- Use the retained Cinder terrain GLB plus **one retained Cinder WEBP depth/atmosphere plate**, with fallback parity verified.
- Place at least **two retained props** as functional landmarks (gate/choke and extraction), and use at least **three distinct retained VFX cues** for pressure, formation, and extraction/breach.
- No single flat untextured color field should occupy more than **20% of a combat screenshot**.
- At the opening camera, show **two unique landmarks** plus the defendable gate/choke; the route from ingress to gate must be traceable in one still frame.

### P1 — Make actors and formation readable

**TARGET:** command relationships should read before damage numbers.

- Maintain a minimum on-screen silhouette of **36 px** for the commander and **60 px** for boss/elite during actionable combat; companions must remain separable from the commander at the active formation distance.
- Reserve cyan/teal edge light for player/ally ownership and ember/orange for Cinder threat; magenta may remain effect color but cannot be the only allegiance cue.
- On formation switch, show a **0.8–1.2 s** dedicated confirmation, projected formation footprint, moved-unit trails, and one consequence phrase; combat crit text must not overwrite it.
- In a first-exposure test, **≥8/10** players must correctly identify active stance and its visible frontline/backline change after one switch.

### P1 — Replace telemetry parity with responsive priority

**TARGET:** desktop and portrait expose the same decisions, not the same panel count.

- Desktop: combine objective phase, next event, and pressure into one top ribbon; keep a single integrity cluster and contextual action slot.
- Portrait: switch mission metadata to a one-line stage chip; use one collapsible objective ribbon and side-anchored integrity bars; preserve a center world corridor at least **220 px wide** from top objective to bottom controls.
- Touch controls must expose visible **pressed/held/released** states within **100 ms**, and the Warden's intended vector must remain visible until release/stop.
- Result mode must remove/disable live movement controls and place result actions in a non-overlapping surface.

### P2 — Bind RPG growth to the active defense

**TARGET:** every growth/companion decision explains its immediate battlefield effect while preserving defense context.

- Growth choices show **before → after** values and one affected combat affordance (damage, cooldown, integrity, radius, or formation), not only permanent base rows.
- While a growth choice is open, display an unmistakable paused/frozen pressure state and retain **≥40% of the battlefield** visible.
- Lobby sortie hero should show the Dusk Warden plus three formation slots and the next extractable silhouette; remove at least **one** repeated briefing block on both desktop and portrait.
- Preserve the project gate: a valid G7 study still needs **14/20** voluntary human re-entries and complete visible extraction/persistence evidence. This audit does not relabel browser observation as that gate.

## Direction summary

**OBSERVED:** the current build already has the right data surfaces, a coherent lobby shell, responsive full-bleed canvas, working movement, stance control, pause/build access, retained 3D asset coverage, and deterministic presentation boundaries.  
**INFERENCE:** adding more cards or smaller text would deepen the failure. The next design pass should spend existing assets and screen space on stage authorship, actor hierarchy, threat direction, and visible decision consequence.  
**TARGET:** the next Cinder vertical slice should be understandable from one live frame: *what is threatened, where pressure comes from, which formation is active, what decision is available next, and how an extracted elite persists into the next sortie*.
