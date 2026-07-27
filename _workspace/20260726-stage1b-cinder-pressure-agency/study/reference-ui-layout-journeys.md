# Reference UI Layout and Player Journeys

status: `research-complete`

Research date: `2026-07-26`

## Evidence language

- **OBSERVED** — directly visible in a cited storefront screenshot or stated on the cited title page. A screenshot observation is about that captured state, not every state in the game.
- **INFERENCE** — a transferable interpretation of the observed evidence. It is not presented as a fact about the reference title.
- **TARGET** — a proposed behavior or measurable layout rule for Abyssal Surge.

This study compares six defense/RPG references: **Thronefall, The Last Spell, Cataclismo, The Riftbreaker, Dungeon Defenders, and Loop Hero**. Steam product pages establish the marketed loops; the linked Steam-hosted screenshots are the primary layout evidence. The sample deliberately spans sparse and dense HUDs. It does not treat visual style, control scheme, platform, or genre conventions as automatically transferable to a browser game.

## Evidence ledger

| ID | Title | Product/loop evidence | Layout evidence |
|---|---|---|---|
| S1 | Thronefall | [Steam product page](https://store.steampowered.com/app/2239150/Thronefall/) — describes building by day and defending by night | [Steam-hosted 1920×1080 gameplay screenshot](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2239150/ss_7755da74d905e510998b08d36eb9758869e2f768.1920x1080.jpg) |
| S2 | The Last Spell | [Steam product page](https://store.steampowered.com/app/1105670/The_Last_Spell/) — describes daytime rebuilding and nighttime tactical defense | [Steam-hosted 1920×1080 combat screenshot](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1105670/ss_997cf165b7ef317148e5c0835c4c0a831f3473f0.1920x1080.jpg) |
| S3 | Cataclismo | [Steam product page](https://store.steampowered.com/app/1422440/Cataclismo/) — describes brick-by-brick fortress construction and real-time horde defense | [Steam-hosted 1920×1080 fortress screenshot](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1422440/55cdfd7b39b3e1bea00e297c77822666f7936a4d/ss_55cdfd7b39b3e1bea00e297c77822666f7936a4d.1920x1080.jpg) |
| S4 | The Riftbreaker | [Steam product page](https://store.steampowered.com/app/780310/The_Riftbreaker/) — describes action-RPG combat, base building, crafting, and research | [Steam-hosted 1920×1080 build-mode screenshot](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/780310/38f891f3f322b121f4e132cdb692ab31bac47b2b/ss_38f891f3f322b121f4e132cdb692ab31bac47b2b.1920x1080.jpg) |
| S5 | Dungeon Defenders | [Steam product page](https://store.steampowered.com/app/65800/Dungeon_Defenders/) — describes four-player tower-defense/action-RPG play | [Steam-hosted 1024×576 combat screenshot](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/65800/ss_b1d65cd78ad075bbe2c4ba47a28a6a225018b09c.1920x1080.jpg) |
| S6 | Loop Hero | [Steam product page](https://store.steampowered.com/app/1282730/Loop_Hero/) — describes placing cards, equipping loot, and improving the survivors' camp across expeditions | [Steam-hosted 1920×1080 planning screenshot](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1282730/ss_500e7212653fa6586f7a84c89b4c60be4e425fbb.1920x1080.jpg) |

All sources were accessed `2026-07-26`. Store screenshots are publisher-selected rather than a systematic sample; their value here is concrete spatial evidence, not proof of usability or player preference.

## Reference findings by title

### 1. Thronefall — sparse world-first hierarchy

- **OBSERVED [S1]:** The product description separates a preparation fantasy (“build … by day”) from a defense fantasy (“defend … by night”), with economy, fortification, troops, and direct king combat in one loop.
- **OBSERVED [S1]:** The sampled gameplay screenshot leaves the entire frame to the battlefield: hero, castle, walls, units, towers, farms, and roads remain readable without persistent panels or a visible action bar.
- **INFERENCE:** The world itself carries state through silhouette, placement, color, and motion. This preserves situational awareness but cannot alone communicate exact timing, costs, cooldowns, or accessibility text.
- **TRANSFERABLE:** Use world-space defense health, spawn lanes, interaction outlines, and attack-direction cues so the player does not need to translate every threat through a panel.
- **INCOMPATIBLE ASSUMPTION:** A screenshot with no visible HUD is not evidence that Abyssal Surge can remove status, objective, or input communication. Browser players may enter with no remembered controls, a smaller viewport, and lower-contrast displays.
- **TARGET:** Default combat view keeps the central `70%` of viewport width and `65%` of height free of opaque panels; exact values remain available at the edges and through inspect.

### 2. The Last Spell — phase- and character-dense tactics

- **OBSERVED [S2]:** The store copy explicitly alternates daytime rebuilding/defense preparation with nighttime tactical combat.
- **OBSERVED [S2]:** The combat screenshot gives the upper-left to phase and turn state (`Night 7`, `Turn 8`, `HEROES`, `END TURN`) plus a threat strip. The upper-right contains hero portraits and an inspected-enemy card. The lower-left contains the selected hero identity and health/status; the bottom is a wide action/equipment belt with counters. Selection range and health are also drawn in-world.
- **OBSERVED [S2]:** The `END TURN` control sits with phase/turn information rather than among attacks, separating “commit the phase” from “act with this hero.”
- **INFERENCE:** Dense tactical data is manageable when it is partitioned by question: **where am I in the phase**, **who/what is selected**, and **what can I do now**.
- **TRANSFERABLE:** Keep phase commitment, entity inspection, and action selection in stable, different zones. Pair compact edge data with world-space selection/range feedback.
- **INCOMPATIBLE ASSUMPTION:** Turn-based deliberation tolerates persistent micro-stat panels and many bottom-bar slots. Abyssal Surge’s real-time readability should not inherit this total density or its tiny text.
- **TARGET:** During active combat, show no more than `4` primary actions plus `2` context actions; deeper stats live in pause/inspect, not the always-on HUD.

### 3. Cataclismo — construction density with explicit time control

- **OBSERVED [S3]:** The store copy centers three jobs: physically constructing a fortress, managing resources, and holding against hordes.
- **OBSERVED [S3]:** The screenshot holds resource/population counters in a thin upper strip, a phase/time dial and pause/speed controls at upper center, global utility buttons at upper right, and a vertical construction/category rail on the left. The fortress remains the dominant visual surface.
- **OBSERVED [S3]:** Pause/speed state is continuously visible rather than hidden in a settings menu.
- **INFERENCE:** Build-heavy play benefits from persistent time-state and category access, but the controls are pushed to the perimeter so the fort remains inspectable.
- **TRANSFERABLE:** During preparation, expand a build/growth rail and make pause plus “start/advance wave” explicit. During combat, collapse the rail rather than leaving empty chrome.
- **INCOMPATIBLE ASSUMPTION:** Free camera movement, mouse precision, and a 16:9 desktop frame allow slender edge icons. Those unlabeled icons become fragile under touch, localization, narrow widths, or low familiarity.
- **TARGET:** Every preparation-only control disappears or collapses to one labeled `BUILD`/`GROW` entry after combat begins; pause and phase status never move.

### 4. The Riftbreaker — action-RPG status plus inspectable build economy

- **OBSERVED [S4]:** The store page combines direct mech combat with base construction, weapon crafting, and research.
- **OBSERVED [S4]:** In the build screenshot, stacked resource/capacity bars occupy the upper-right, a minimap plus day/time and power readouts occupy the lower-right, a large selected-building description/cost card occupies the lower-left, and a categorized build palette occupies the bottom center. The placement ghost and valid grid are shown in-world.
- **OBSERVED [S4]:** The selected build card exposes description, health, exact cost, requirement, and capacity effect before placement.
- **INFERENCE:** A hybrid can keep fast action status compact while allowing high-information inspection only after the player expresses build intent.
- **TRANSFERABLE:** Growth choices should preview **effect, cost, eligibility, and placement/target result** before commit. Use the world to preview footprint/range.
- **INCOMPATIBLE ASSUMPTION:** The screenshot dedicates roughly a quarter of its width and lower edge to build mode. Scaling that whole composition down would erase the playfield and text rather than create a responsive UI.
- **TARGET:** Inspect uses one reflowing drawer: side sheet at wide widths, bottom sheet at compact widths. It must replace, not stack on top of, other secondary panels.

### 5. Dungeon Defenders — combat goal and dual-role economy

- **OBSERVED [S5]:** The product page defines a tower-defense/action-RPG hybrid with distinct hero classes.
- **OBSERVED [S5]:** The combat screenshot puts wave and `COMBAT` state at upper-right beside `Defense Units 54/100`; a long upper bar shows `112/1936`; hero health/mana and four circular abilities anchor the lower-left; score and hero level sit lower center. Damage/reward text occurs near the action.
- **INFERENCE:** The upper-right cluster answers the defense question (“what phase/capacity remains?”), while the lower-left cluster answers the avatar question (“can my hero fight?”). Both roles stay visible without opening a character sheet.
- **TRANSFERABLE:** Preserve distinct base/goal status and hero status. A player should never mistake personal survivability for objective survivability.
- **INCOMPATIBLE ASSUMPTION:** Score, loot feedback, co-op labels, and class ability density are not equally urgent in a solo browser encounter. Importing all of them would compete with the defend/extract decision.
- **TARGET:** Base/goal health and hero health use different labels, geometry, and locations; neither is represented by color alone.

### 6. Loop Hero — deliberate planning and persistent-growth bridge

- **OBSERVED [S6]:** The product page describes indirect combat, a growing card deck, on-the-fly equipment, an expedition loop, and resources invested in a persistent survivors’ camp.
- **OBSERVED [S6]:** The screenshot names the current state `PLANNING` in a large upper-center plate. Hero health/status sit upper-left; run-speed/state controls occupy the top; a full-width card hand occupies the bottom; a right rail combines equipment, exact hero bars, and a hovered card explanation. The map remains central.
- **OBSERVED [S6]:** The hovered `VILLAGE` card explains its effects in plain text next to the inventory; the choice is inspectable before placement.
- **INFERENCE:** Explicit planning state legitimizes stopping the action and connects immediate placement/equipment decisions to a longer expedition/camp loop.
- **TRANSFERABLE:** Pause should be a named decision state, not merely frozen animation. Explain the consequence of a growth/defense choice at the decision point.
- **INCOMPATIBLE ASSUMPTION:** Auto-combat permits a permanent card hand and equipment grid. A direct-action game should not cover the bottom third while movement and aiming matter.
- **TARGET:** Opening growth or defense planning freezes simulation where allowed, changes the phase label to `PLANNING`, and gives every choice a one-sentence outcome plus exact deltas.

## Cross-title synthesis

### Combat HUD hierarchy

- **OBSERVED [S2, S4, S5]:** Dense references consistently separate action controls along the bottom from strategic state in upper corners and contextual detail on a side.
- **OBSERVED [S1, S3]:** Sparse references preserve battlefield visibility by relying on the world and thin perimeter rails.
- **INFERENCE:** The stable common hierarchy is not a shared art style; it is a shared order of questions: **survive now → protect the goal → understand the phase → choose the next action → inspect detail**.
- **TARGET:** In Abyssal Surge, threat/goal failure and hero survival occupy tier 1; phase/wave and current objective tier 2; actions/resources tier 3; build math and lore tier 4 behind inspect.

### Wave and phase telegraphing

- **OBSERVED [S2]:** Phase and turn are textually named and paired with the commit control.
- **OBSERVED [S3]:** Time-of-day and time controls share a central top cluster.
- **OBSERVED [S5]:** `Wave`, wave number, `COMBAT`, and defense capacity are grouped.
- **OBSERVED [S6]:** `PLANNING` is a large, named global state.
- **INFERENCE:** A phase label is strongest when it combines **state**, **progress**, and **next commitment**, rather than using ambience alone.
- **TARGET:** A fixed top-center phase rail reads `[PREPARE | SURGE n/N | ELITE DECISION | RESULT]`, includes countdown/progress when finite, and uses the same location for the sole phase-advance action.

### Build and growth choices

- **OBSERVED [S4, S6]:** Both screenshots put choice inventories at an edge and reveal exact descriptive consequences in a contextual panel before commit.
- **OBSERVED [S3]:** Build categories remain accessible through a compact edge rail while geometry is evaluated in the world.
- **INFERENCE:** Progressive disclosure is the bridge between meaningful RPG math and a readable battlefield.
- **TARGET:** Every choice card exposes name, cost, immediate delta, persistent/this-run scope, and eligibility before selection; placement choices additionally show footprint/range in-world.

### Character, resource, and goal salience

- **OBSERVED [S2, S5]:** Selected-character health/resources are anchored near the lower-left; strategic phase/goal state sits above or opposite.
- **OBSERVED [S4]:** Large resource inventories are grouped rather than scattered; the build card repeats only the cost relevant to the current choice.
- **INFERENCE:** Repetition is useful only when contextual: total resource in the global cluster, payable cost on the choice, and shortfall beside a disabled action.
- **TARGET:** Persistent HUD shows at most `3` economy values. A choice card repeats its relevant cost and, when unaffordable, states the numeric shortfall.

### Pause and inspect behavior

- **OBSERVED [S3]:** Pause/speed controls are permanently discoverable.
- **OBSERVED [S6]:** Planning is explicitly named and accommodates a large choice/inspect surface.
- **OBSERVED [S2]:** Turn-based state naturally supports close inspection, while selection details remain separate from actions.
- **OBSERVED [S4]:** Build intent expands contextual detail without replacing all world feedback.
- **INFERENCE:** “Pause” and “inspect” solve different needs: pause controls time; inspect explains an entity or decision. They may co-occur but must not be conflated.
- **TARGET:** `Esc/P` and a visible pause button enter `PAUSED`; selecting an entity opens `INSPECT`. The header always states both simulation state and inspected subject. Closing inspect returns to the prior simulation state rather than silently resuming.

### Onboarding

- **OBSERVED [S4, S6]:** The captured build/planning states place effect explanations adjacent to the object currently under consideration.
- **OBSERVED [S2, S4]:** The screenshots pair icons with numeric costs/counts and in-world selection/placement feedback, giving a player multiple ways to connect control and result.
- **OBSERVED LIMITATION:** These storefront captures do not establish each title’s first-session tutorial sequence, completion rate, or accessibility. No tutorial-quality claim is made from them.
- **INFERENCE:** For a browser game, first-use teaching should be contextual and reversible: introduce one edge zone when its decision first becomes possible, then leave a persistent way to inspect it.
- **TARGET:** First sortie teaches only `move/attack`, `protect goal`, `choose one growth`, and `start/face surge` in that order. Each prompt clears only after the corresponding observed action; later mechanics use optional callouts, not modal walls of text.

## Normalized layout map

The map normalizes function, not visual appearance. `Z7` is the protected playfield; other zones may expand only in their relevant mode.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Z1 HERO/GOAL       Z2 PHASE • PROGRESS • COMMIT      Z3 RESOURCES   │
│ compact vitals     fixed global state                + map toggle   │
├──────────────┬────────────────────────────────────────┬──────────────┤
│ Z4 ROSTER /  │                                        │ Z5 CONTEXT / │
│ BUILD ENTRY  │            Z7 PLAYFIELD                │ INSPECT      │
│ mode-only    │ world threats, paths, ranges, health   │ mode-only    │
│              │                                        │              │
├──────────────┴────────────────────────────────────────┴──────────────┤
│ Z8 TRANSIENT FEEDBACK        Z6 PRIMARY ACTION DOCK                 │
│ short toasts near cause      movement-safe, 4 + 2 context maximum  │
└──────────────────────────────────────────────────────────────────────┘
Z9 PAUSE/PLANNING: explicit state layer; one reflowing detail sheet,
not a second HUD stacked over Z4/Z5/Z6.
```

| Zone | Combat | Prepare/build | Pause/inspect | Compact-width behavior |
|---|---|---|---|---|
| Z1 hero/goal | Always visible, tier-1 health/state | Same anchor | Frozen values remain visible | Two labeled compact bars; never icon-only |
| Z2 phase rail | Surge/wave + progress | `PREPARE` + one commit | `PAUSED`/`PLANNING` clearly replaces active state | Full-width top rail, shortened copy, no relocation |
| Z3 resources | Up to 3 relevant values | Up to 3 plus category total on demand | Exact ledger in sheet | One-line chips; overflow opens ledger |
| Z4 roster/build | Collapsed entry only | Category rail or growth choices | Replaced by inspect sheet if open | Bottom-sheet tab, not a left sliver |
| Z5 context | Selected threat/objective only | Cost/effect/eligibility | Primary inspect surface | Bottom sheet at max `45vh` with scroll shadow |
| Z6 actions | 4 primary + 2 context maximum | Choice/build actions | Disabled or replaced by dialog actions | Two rows maximum; `44×44 CSS px` targets minimum |
| Z7 world | Threat and path telemetry | Placement/range/coverage preview | Selection persists under dim layer | Camera safe region excludes top rail and open sheet |
| Z8 feedback | Damage, shortfall, goal hit, result | Purchase/placement result | History available in inspect | Toasts stack to 2; newer replaces oldest after announcement |
| Z9 state layer | Closed | Optional planning state | Explicitly open | Sheet fills width; no whole-canvas scale-down |

## Normalized player journey

| Step | Player question | Required visible information | Reference evidence | **TARGET** Abyssal Surge behavior |
|---|---|---|---|---|
| 1. Enter / orient | “Who am I and what must survive?” | Hero state, defended goal, immediate objective, controls | **OBSERVED [S2, S5]:** hero and defense state occupy distinct clusters. | Spawn with Z1 and one short objective sentence; world outlines identify hero and goal. No build catalog yet. |
| 2. Survey threat | “Where will pressure arrive?” | Lanes/spawns, direction, time until commitment | **OBSERVED [S1, S3]:** paths/fort architecture remain central; time state sits at the perimeter in Cataclismo. | Show world-space lane arrows plus Z2 countdown/ready state; never rely on minimap alone. |
| 3. Prepare / build | “What can I afford, and what changes?” | Relevant currency, choice cost, effect, eligibility, placement result | **OBSERVED [S4, S6]:** contextual cards explain selected build/card; world previews placement in Riftbreaker. | Expand Z4/Z5 only on intent; preview exact offense/defense delta and world coverage before commit. |
| 4. Commit | “Am I starting the dangerous phase?” | Named next phase, remaining prep opportunity, explicit action | **OBSERVED [S2, S5, S6]:** `END TURN`, `COMBAT`, and `PLANNING` make global state textual. | Sole Z2 button changes from `START SURGE` to progress state; first activation has a reversible confirmation only when unspent choices remain. |
| 5. Defend / fight | “What is failing now?” | Hero health, goal health, urgent lane, usable actions, surge progress | **OBSERVED [S2, S5]:** personal and strategic combat state persist while actions remain on the bottom edge. | Collapse build UI; goal hit and hero critical alerts pre-empt economy toasts. Edge alert points toward off-screen breach. |
| 6. Pause / inspect | “Why is this happening, and can I change course?” | Simulation state, inspected subject, causal stats, close/resume behavior | **OBSERVED [S3, S6]:** time/planning state is continuously explicit; **OBSERVED [S4]:** contextual detail expands on build intent. | Pause and inspect are separate controls; open one responsive sheet, preserve selection, and never resume on sheet close unless it was opened from live play. |
| 7. Resolve surge | “Did I succeed, and what changed?” | Outcome, goal damage, resources gained/lost, unlocked decision | **OBSERVED [S1, S2]:** cited loops alternate defense and rebuilding/preparation. | Freeze new threats, summarize at most 3 causal results, then reveal the next meaningful decision. |
| 8. Choose growth / extract | “Do I take immediate power, defense, or persistent value?” | Mutually exclusive outcomes, scope, exact deltas, opportunity cost | **OBSERVED [S6]:** run choices feed persistent camp growth; selected card effects are explained before placement. | Compare choices in one sheet with `THIS SORTIE` vs `PERSISTENT` tags. Elite extraction receives equal visual weight and explicit persistence consequence; no default selection. |
| 9. Re-enter / continue | “What carries forward, and what pressure rises?” | Persisted result, next surge modifier, current build summary | **OBSERVED [S6]:** the store loop connects expedition resources to camp upgrades. | Show one carry-forward receipt, then return to Z2 `PREPARE`; no detached reward screen that hides the next threat. |

### Journey failure paths

- **TARGET — unaffordable choice:** Keep the choice inspectable, disable commit, and show `Need +N [resource]`; do not communicate only through red tint.
- **TARGET — base/goal critical:** Replace lower-priority toasts with a persistent labeled alert and world-direction pointer until recovered or failed.
- **TARGET — hero down:** Preserve goal status and remaining agency; the UI must state respawn/continuation/failure rule in text.
- **TARGET — narrow viewport during a choice:** Convert the side inspect sheet into a bottom sheet while preserving selection and scroll position.
- **TARGET — focus/visibility loss:** Auto-pause single-player simulation, label `PAUSED — WINDOW INACTIVE`, and require explicit resume.
- **TARGET — input method changes:** Swap hint glyphs without moving the control or clearing the current decision.

## Responsive browser adaptation

### Wide: `≥1280 CSS px`

- **TARGET:** Use the normalized map as drawn. Z4 and Z5 may each occupy at most `280px` and never both expand during live combat.
- **TARGET:** Preserve a central no-panel rectangle of at least `min(70vw, viewport width − 560px)` by `60vh`.
- **INFERENCE [S2–S6]:** Stable edge anchors reduce search cost, but exact console/PC dimensions should not be copied.

### Medium: `900–1279 CSS px`

- **TARGET:** Z4 becomes a labeled rail (`BUILD`, `ROSTER`, or `GROW`); Z5 becomes a `360px` overlay sheet. Opening Z5 collapses Z4.
- **TARGET:** Resource labels abbreviate only after first-use expansion; tooltip/accessible name retains the full term.
- **TARGET:** Minimap defaults to a button unless off-screen threat direction cannot be represented in-world.

### Compact landscape / tablet: `600–899 CSS px`

- **TARGET:** Side panels become a bottom sheet; collapsed height `0`, peek height `56px`, expanded maximum `45vh`.
- **TARGET:** Primary actions may wrap to two rows but may not cover hero, defended goal, or the nearest hostile. Camera framing must account for the open sheet.
- **TARGET:** Phase rail remains at top center/full width, with a minimum `16px` phase label and `14px` numeric progress; no uniform whole-HUD shrink.

### Narrow portrait: `<600 CSS px`

- **TARGET:** Do not pretend the desktop battle is playable through scale reduction. Present a rotate-to-landscape gate for active sorties, while pause, settings, codex, and result/growth sheets remain usable in portrait.
- **TARGET:** The gate states the reason, preserves simulation pause, and exposes settings/quit; it is not a dead-end blank screen.
- **INFERENCE:** This rejects incompatible desktop assumptions from dense references rather than squeezing their side rails into unreadable columns.

### Cross-input and accessibility density

- **TARGET:** Interactive targets are at least `44×44 CSS px`, maintain a visible focus ring, and have keyboard order `phase → urgent status → actions → contextual sheet`.
- **TARGET:** Every icon has an accessible name; unfamiliar persistent icons show a visible text label until the player has successfully used them at least once.
- **TARGET:** Critical status uses label + shape + value; color is redundant. World arrows and HUD alerts share the same threat name.
- **TARGET:** Tooltips open on hover and keyboard focus; touch uses tap-to-inspect then explicit commit, never hover-dependent commit.
- **TARGET:** Toasts use an `aria-live` strategy appropriate to urgency, but repeated damage ticks aggregate rather than flooding announcements.

## Ten concrete UI rules

1. **TARGET — Fixed phase rail:** Keep the named phase and its one commit/advance control in Z2 for every viewport. **Test:** switching among prepare, surge, elite decision, result, and pause does not move the phase anchor more than `8 CSS px`.
2. **TARGET — Two survivability channels:** Hero health and defended-goal health must always have visible text labels, numeric or proportional state, and different geometry. **Test:** a grayscale capture remains unambiguous to a first-time reviewer.
3. **TARGET — Combat density cap:** Live combat exposes at most `4` primary actions, `2` context actions, `3` economy values, and one expanded secondary panel. **Test:** automated/state screenshot count plus manual panel check.
4. **TARGET — World-first threat cue:** Every off-screen goal-threatening attack has a world/edge direction cue in addition to any map marker. **Test:** hide the minimap and verify the threatened lane remains locatable.
5. **TARGET — Explain before commit:** A build/growth/extract choice shows cost, immediate outcome, persistence scope, and eligibility before its commit becomes actionable. **Test:** keyboard-only focus reveals all four without activation.
6. **TARGET — Honest pause state:** Pause, planning, and inspect are separately named; closing inspect restores the prior time state. **Test:** open inspect from live and paused states, close it, and confirm time behavior differs correctly.
7. **TARGET — Numeric shortfall:** Disabled purchases state the exact missing amount beside the relevant cost. **Test:** evaluate one affordable and one unaffordable choice without using color.
8. **TARGET — Responsive replacement, not stacking:** Side inspect becomes a bottom sheet below `900px`; opening it collapses any other secondary panel and preserves selection. **Test:** resize across `899/900px` with a choice focused; subject and scroll position persist.
9. **TARGET — Urgency pre-emption:** Goal-critical and hero-critical alerts replace low-priority reward/resource toasts and persist until resolution. **Test:** trigger reward and breach in the same second; breach remains visible and announced first.
10. **TARGET — Contextual onboarding:** First-sortie prompts require observed player actions in the order move/attack → identify goal → make one growth choice → start surge, with skip/reopen available. **Test:** random clicks cannot dismiss a prompt, and the help entry can reopen the last lesson.

## Adoption boundary

- **OBSERVED:** The references demonstrate several viable extremes: Thronefall’s nearly unframed battlefield [S1], The Last Spell’s tactical instrumentation [S2], Cataclismo’s construction/time rails [S3], The Riftbreaker’s contextual build inspection [S4], Dungeon Defenders’ simultaneous hero/defense status [S5], and Loop Hero’s named planning plus persistent-growth bridge [S6].
- **INFERENCE:** No single reference supplies the correct Abyssal Surge layout. The transferable system is a world-first combat surface with stable phase and survival anchors, then intent-driven detail.
- **TARGET:** Adopt functional hierarchy and journey clarity only. Do **not** copy pixel-art framing, gothic ornament, sci-fi blue chrome, radial ability styling, card borders, color palettes, or desktop-scale panel counts. Visual language must remain native to Abyssal Surge and be validated in the actual browser build at the responsive thresholds above.
