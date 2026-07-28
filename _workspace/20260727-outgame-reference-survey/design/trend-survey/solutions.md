# Solutions — Browser-playable comparables + outgame patterns

Solution landscape for a "make the outgame game-like" redesign of Abyssal Surge. Browser-playable titles first; native-only tagged reference-only. Evidence: `direct page retrieval` / `indexed snippet` / `thin evidence`. Full detail: `../../messages/lane-b-solutions.md`, `lane-c-behavior.md`, `../../qa/benchmark-notes.md` + `reference-images/`.

## Solution List

Browser-playable comparables (each: what / where / outgame shape / evidence):

1. **Idle Zombie Wave: Survivors** — idle survival-defense; CrazyGames+Steam+mobile (Unity 6). Outgame: squad-collection + roster mgmt (25+ survivors), "Adjutant" modifiers, 200+ item inventory, upgrade-defense meta, idle accrual. *Closest structural twin to Abyssal's companions+equipment+traits.* `direct page retrieval`
2. **Immortal: Dark Slayer** — top-down action-survival RPG; CrazyGames+iOS (Unity 6, portrait). Outgame: home-base stat tracks (Damage/Health/Speed), gear-tier inventory, god/passive select persisting across runs. `direct page retrieval`
3. **Autogun Heroes** — auto-shooter survivor; CrazyGames+stores. Outgame: "Basecamp" hub, unlock heroes, between-level gear upgrade, "Alien DNA" skill tree, world/stage map. `direct page retrieval`
4. **Melvor Idle** — menu-driven idle RPG; melvoridle.com browser + Steam/mobile. Outgame: sidebar/top-nav dock of functional tabs (Skills/Combat/Shop/Bank), save-slot lobby, offline progression. *The pure-functional-dock model Abyssal risks feeling like.* `direct page retrieval`
5. **Vampire Survivors (itch.io HTML5 build)** — canonical survivor; free browser build at poncle.itch.io (verified live) + stores. Outgame: title→Stage Selection (left modifier/briefing panel, center stage list, START CTA), Collection unlock grid+detail, PowerUp permanent-upgrade shop. `direct page retrieval`
6. **Doodle RPG Survivor** — browser-native survivor-RPG; CrazyGames HTML5 (captured live). Outgame: paged spell-choice cards + reroll. `direct page retrieval`
7. **Void Idle** — browser idle RPG; voididle.com. Outgame: weapon-specific ability trees, gear-chase (enhancement/tiers/runes), party+world bosses, offline focus. *Mirrors Abyssal skill-tree + 5-tier equipment.* `indexed snippet`
8. **Milky Way Idle** — browser idle "skilling" RPG; milkywayidle.com. Outgame: tabbed skill/action hub, queue-offline tasks, marketplace + inventory. `indexed snippet`
9. **G123 idle-RPG platform** — browser-native licensed idle RPGs; g123.jp instant-play. Outgame: central hub (team+shop+idle-claim), hero-collection+formation grids, gacha/summon, daily-login + daily quests. *Textbook gacha-idle outgame in-browser.* `indexed snippet`
10. **Grimdark Survivors** — HTML5 survivor-roguelite; CrazyGames+Steam. Outgame: hero-select + weapon/loadout screen → run, light meta. `direct page retrieval`
11. **Taming.io / YORG.io** — survival/base-defense .io; browser-native. Outgame: pet/companion taming + base/defense upgrade menu; the built base is the in-session persistent hub. *Nearest .io analog to companion/formation.* `indexed snippet`
12. **Diep.io / EvoWars.io** — arena .io; browser-native. Outgame: in-run stat-point allocation + radial class-evolution tree (Diep), character-model select + mode picker (EvoWars); progression resets per run. `indexed snippet`

Native-only aesthetic/structural references (NOT browser-playable): **Soulstone Survivors** (Steam — top nav-tab dock + radial skill tree + level-up card theater w/ Reroll/Banish/Lock), **HoloCure** (free download — left action-rail shop + explorable garden hub), **Brotato** (Steam/mobile — between-wave shop + character-select; no public menu screenshot), **AFK Arena / AFK Journey** (mobile — animated living hub + "welcome back" recap theater), **Vampire Survivors** stores build. `thin evidence`

## Categories

- **pure-survivor** (thin/no metagame): Grimdark Survivors, PHANTOM CIRCUIT, Galaxy Survivor, itch.io survivor cluster. Ref: Vampire Survivors.
- **survivor + RPG-meta** (closest to Abyssal Surge): Idle Zombie Wave, Immortal: Dark Slayer, Autogun Heroes. Ref: Soulstone Survivors, Brotato.
- **idle-RPG** (offline accrual, dock-nav hub): Melvor Idle, Milky Way Idle, Void Idle, G123. Ref: AFK Arena / AFK Journey.
- **roguelite-hub** (explicit basecamp between runs): Autogun Heroes, Grimdark Survivors. Ref: HoloCure hub.
- **.io-arena** (session growth, base or class tree): Diep.io, EvoWars.io, Taming.io, YORG.io.

## What People Actually Use

- **Play button first; metagame is a detour.** Browser "intent-to-play" behavior: anything between click and combat is friction players route around. If a fast 출정→play path isn't in the thumb zone, players never open 성장/동료/인벤토리. `indexed snippet`
- **Meta-progression is used only when it visibly changes the run**, not as flat "+1% damage." Most-engaged meta unlocks new ways to play (characters/mechanics). `indexed snippet`
- **Deep skill-tree/menus: partial engagement, veterans only.** Melvor's dense screens are tolerated by invested players, avoided/overwhelming for newcomers; many focus one system and wiki the rest. `indexed snippet`
- **Daily/login rewards drive opens, not depth** — reliably lift return frequency but produce "shallow logins" (collect, exit); reward tied to an action ("first win of day") beats passive login. `indexed snippet`
- **The idle "welcome back" recap is genuinely loved** — the one metagame surface players *want* on return ("payday": big numbers, animation, a "double it" choice). Strong case to make Abyssal's idle-return the theatrical centerpiece of re-entry. `indexed snippet`
- **Briefings/story mostly skipped** — read only if ≤ a few seconds and carrying actionable info (what/where the reward is). `indexed snippet`

## Frequency Ranking

Outgame/lobby patterns by recurrence across the 13 browser-playable comparables (count of games exhibiting):

| Rank | Pattern | Count | Abyssal Surge status |
|---|---|---|---|
| 1 | Central Play/Start → run | 12/13 | HAS (sortie FAB) — polish target |
| 2 | Persistent stat/upgrade menu (spend meta-currency) | 9/13 | HAS (growth dock) |
| 3 | Equipment/gear-tier inventory | 7/13 | HAS (inventory dock) |
| 4 | Character/hero select or unlock | 8/13 | PARTIAL (companions, not hero-swap) |
| 5 | Tabbed/sidebar functional-dock hub | 6/13 | HAS (the dock shell itself) |
| 6 | Idle/AFK "welcome back" claim | 6/13 | HAS (idle-return) — under-theatricalized |
| 7 | Skill tree / class tree | 5/13 | HAS (5-node tree) — reads as list, not map |
| 8 | Stage/level/wave progression map | 6/13 | HAS (stage-select) |
| 9 | Companion/pet/squad collection + formation | 5/13 | HAS (extract + FRONT/BACK) |
| 10 | Daily-login / daily-reward hook | 3/13 | MISSING (and contested — see Contradictions) |
| 11 | Save-slot / save export-import | 3/13 | HAS (stronghold export/import) |
| 12 | Gacha / summon screen | 2/13 | MISSING (mostly a mobile pattern) |
| 13 | Animated hub / living "home" with theater (juice) | 1–2/13 | **MISSING — the differentiation gap** |

## Key Gaps

1. **Juice / theater layer (pattern 13) is systematically absent in the browser cohort** — animated hub, reactive characters, motion feedback. This is the redesign's core opportunity and Abyssal Surge is uniquely positioned (live WebGL canvas already behind the dock).
2. **Progression shown as spectacle, not list**: the 5-node skill tree + 5-tier equipment read as short lists; benchmarks (Soulstone radial tree, Melvor rank pips X/99) show depth must be a laid-out, node-linked, rank-annotated *map* with a persistent detail tooltip.
3. **Upgrade choices lack card theater**: benchmark bar is illustrated cards (icon + type tags + full stat breakdown) with a surrounding verb economy (Reroll/Banish/Lock) — Abyssal's nodes/traits/equipment picks are rows.
4. **Collections lack the grid↔detail idiom**: VS Collection / HoloCure shop use icon-grid + selected-detail-panel + cost + locked/owned states; Abyssal's equipment/companions/traits should adopt this "filling a visible set" pattern.
5. **Idle-return is not theatricalized**: it exists but re-entry is a silent balance bump, not the loved "payday" recap moment.
6. **Persistent currency/progression readouts not always framed on-screen**: benchmarks keep gold/souls/XP in framed pills top-corner always; Abyssal's warden points / equipment currency / idle rewards should be first-class permanent framed elements.

## Contradictions

- **Juice vs. mobile-web performance/viewport**: players want a living animated hub, but browser/Three.js/static-Pages budget + a small touch viewport cap how much motion fits — juice must be *cheap* (tweens, sprite FX, pooled particles) and *motion/feedback*, not more panels or heavy shaders.
- **Depth-shown vs. clutter/overwhelm**: benchmarks reward showing lots of game (big tree, many pips), but the #1 documented complaint is "cluttered/overwhelming," "currency soup," nested-menu fatigue → the resolution is progressive disclosure + inline legibility, not maximal exposure.
- **Daily-login hook vs. backlash**: daily rewards lift returns but a vocal segment finds them manipulative/"lazy" → prefer a return-reward tied to play (idle "welcome back", "first win of day"), avoid a forced-login leash.
- **Metagame engagement vs. "just play, don't manage"**: players use meta only when it visibly changes the run, and disengage from screens that feel chore-like → each dock must pay off *felt* next-run change, and a fast play path must always bypass management.

## Key Insight

Abyssal Surge already ships outgame patterns 1–9 and 11 (play button, stat/upgrade menus, gear inventory, dock-nav, idle-return, skill tree, stage map, companions/formation, save export) — structurally it is *complete* and even ahead of the browser cohort in one respect: an **always-visible live 3D canvas behind the dock is the exact "living background" the juice literature prizes and that the browser survivor/idle cohort systematically lacks (pattern 13 appears in only 1–2/13).** The redesign is therefore **not "add missing screens" — it is "add cheap, viewport-safe theater + legibility onto the existing dock so it reads as a game, not a form"**: (a) make docks feel attached to and emit from the live canvas, (b) turn the skill tree / equipment into shown, node-linked, rank-annotated maps with detail tooltips, (c) turn upgrade picks into illustrated cards with a reroll/lock verb economy, (d) turn collections into grid↔detail sets with locked/owned states, (e) theatricalize idle-return as the loved "payday" recap, (f) keep persistent currencies always framed on-screen — all while preserving the dock structure veterans have learned, honoring ≥48dp touch targets, sub-100ms tap feedback, and the cheap-motion performance ceiling.
