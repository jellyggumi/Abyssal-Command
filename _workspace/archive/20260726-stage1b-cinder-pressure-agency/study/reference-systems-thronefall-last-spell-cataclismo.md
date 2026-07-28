# Reference systems: Thronefall, The Last Spell, and Cataclismo

Research date: 2026-07-26  
Scope: defense/offense loops and RPG-adjacent growth patterns transferable to *Abyssal Surge*, constrained here as a **real-time, single-warden** game. This is desk research, not hands-on play.

## Evidence labels and limits

- **OBSERVED** — explicitly described or shown by a cited official/primary source or a named secondary source. It does not mean observed in the current *Abyssal Surge* build.
- **INFERENCE** — synthesis from multiple observations or a transfer judgment. Genre-fit claims sit here.
- **TARGET** — a proposed *Abyssal Surge* design rule or testable direction; not a statement of current implementation.
- Store pages and official sites were checked on 2026-07-26. Reviews/previews are historical snapshots and may not reflect every later patch. Claims below use stable core-loop features rather than patch-sensitive balance values.

## Executive synthesis

**OBSERVED:** All three references separate **preparation decisions** from a **defense test**, but at radically different scales. *Thronefall* compresses preparation into fixed build sockets and binary upgrades, then makes one directly controlled king the tactical pivot. *The Last Spell* expands the loop into a multi-hero, turn-based optimization marathon with equipment, perks, action points, and roguelite unlocks. *Cataclismo* makes the fortification itself the expressive system through granular, physics-aware construction and real-time RTS control. [T1][T2][L1][L2][C1][C2]

**INFERENCE:** For a real-time single-warden game, *Thronefall* is the closest agency reference; *The Last Spell* is strongest for readable choice consequences and RPG build identity but weakest for control-feel transfer; *Cataclismo* is strongest for spatial cause-and-effect and retryable defense hypotheses but its construction and multi-unit command load are incompatible at full fidelity.

**TARGET:** The transferable synthesis is not “add a build phase.” It is: present a small, legible defensive hypothesis; let the warden actively alter whether it succeeds; resolve the outcome quickly enough that the player can attribute success or failure; then offer one consequential growth decision before pressure resumes.

---

## 1. Thronefall — compressed kingdom defense with a directly controlled king

### 1.1 Defense/offense phase loop

**OBSERVED:** A level alternates between an unpressured build/economy interval and a night defense. Gold-producing structures fund fixed-position buildings and upgrades; the player deliberately starts the next wave, then fights beside AI troops until the threat is cleared. Losing the castle center loses the level. Each world-map region uses its own predetermined building layout and wave problem. [T1][T2]

**INFERENCE:** The important compression is not merely day/night. The safe interval asks, “What is my plan?” and the wave asks, “Can I execute and repair that plan with the king?” Fixed sockets reduce placement ambiguity so the consequence of a spending choice remains traceable.

**TARGET:** Preserve a short commitment boundary before a pressure spike, but do not require a hard pause or literal sunrise. A real-time equivalent could be a clearly telegraphed 5–10 second pressure lull in which one defense/offense commitment is made, followed by an immediately attributable test.

### 1.2 Player-agency cadence

**OBSERVED:** Agency alternates across three layers: economy/build choice before the wave; building upgrade branches and pre-level loadout modifiers; then mounted king movement, attacks, and nearby troop placement/command during the wave. The review describes the king as both active fighter and commander, and notes that perks can intentionally shift power away from the king and toward troops. [T1][T2]

**INFERENCE:** This produces a useful cadence of **commit → pilot → reassess**. Strategic choices do not replace execution, and execution does not erase the consequences of the strategic choice.

**TARGET:** Every macro choice in *Abyssal Surge* should create a warden-facing tactical verb or changed priority within the next encounter—not only a passive percentage increase.

### 1.3 RPG growth

**OBSERVED:** XP unlocks weapons, positive perks, and difficulty-increasing mutations. Weapons substantially change the king’s attack pattern; a limited perk loadout supports role expression; optional mutations increase challenge and XP. Buildings also branch when upgraded, creating within-level specialization. [T1][T2]

**INFERENCE:** This is “RPG growth through verbs” rather than a deep character sheet. Build identity is readable because a weapon or perk changes how the player behaves, while mutators create self-selected mastery goals and replay pressure.

**TARGET:** Favor warden growth choices that change targeting, timing, movement, resource conversion, or companion/defense interaction. Cap simultaneous build-defining effects tightly enough that the player can name why the run feels different.

### 1.4 Unit/hero readability

**OBSERVED:** The king is a single, continuously player-controlled focal unit; friendly forces are AI units positioned or gathered through simple commands rather than individually micro-managed. The small bounded maps and predetermined build sites constrain the number of competing interactables. [T1][T2]

**INFERENCE:** Readability comes from hierarchy: **king first, formation second, fortification third**. The hero remains locatable because strategic complexity is intentionally flattened around the avatar.

**TARGET:** The warden must remain the brightest and most animation-distinct friendly read at combat zoom. Secondary defenders should communicate role by silhouette/projectile/effect, not by demanding per-unit UI attention.

### 1.5 Stage composition

**OBSERVED:** Levels are authored regions with unique layouts and fixed building positions, not freeform terrain canvases. Economy spots, routes, castle position, and wave composition combine into a spatial puzzle; later enemies and bosses force revisions to strategies that worked on earlier maps. [T1][T2]

**INFERENCE:** Authored constraint is doing more design work than raw content volume. Fixed sockets let the designer stage flanks, economy risk, and defensive coverage without asking the player to solve construction UX.

**TARGET:** Compose each *Abyssal Surge* arena around one dominant pressure question—split lane, exposed resource, long approach, close surround, or elite timing—and allow only a few high-leverage spatial answers.

### 1.6 Failure and retry structure

**OBSERVED:** Castle destruction is a clear terminal failure. The review reports retries caused by newly introduced enemy types and bosses, while optional challenges, weapons, perks, and mutations give completed maps reasons to be replayed. [T1][T2]

**INFERENCE:** Failure is legible but can become “learn the surprise” when a new threat invalidates a build without sufficient warning. Replayability is strongest when the player knowingly opts into constraints, not when the first run is an information tax.

**TARGET:** A failed defense should name the breached lane/threat and preserve enough run history to support an immediate revised hypothesis. New enemy rules must be telegraphed before they can cause terminal loss.

### 1.7 Control feel

**OBSERVED:** The player steers a mounted king, attacks directly with a chosen weapon, moves between threatened fronts, and issues simplified army commands. This keeps the action embodied while avoiding full RTS selection and control groups. [T1][T2]

**INFERENCE:** “Control feel” here derives from traversal-to-intervention latency: the player sees a breach, rides there, and personally changes the outcome. The system tolerates imprecise army control because the king is the fine-control instrument.

**TARGET:** Measure time from visible threat cue to meaningful warden intervention. Warden motion and action startup must be fast enough that a correct read can still matter; defenders may be coarse-commanded or automatic.

### 1.8 Incompatible assumptions

- **INFERENCE — incompatible:** A fully safe, untimed construction phase would interrupt *Abyssal Surge*’s real-time pressure identity unless represented as a brief, diegetic lull.
- **INFERENCE — incompatible:** Army power can intentionally eclipse the king in *Thronefall*; a single-warden concept should not let automation make the warden optional.
- **INFERENCE — incompatible:** Fixed build sockets transfer as bounded choices, but importing kingdom-scale economy, many building classes, and formation management would dilute the warden loop.
- **INFERENCE — incompatible:** Replaying an authored level after castle death is acceptable at *Thronefall*’s run length; it may be too punitive if *Abyssal Surge* has longer continuous sessions without a local retry boundary.

---

## 2. The Last Spell — turn-based horde tactics with deep multi-hero growth

### 2.1 Defense/offense phase loop

**OBSERVED:** The official description explicitly alternates daytime preparation—rebuild the Haven, position defenses, heal and level heroes—with nighttime extermination of hordes using many weapons and skills. The player protects mages performing the Last Spell across several days. [L1][L2]

**INFERENCE:** The production/deployment/combat segmentation creates strong causal bookkeeping: resources become defenses and gear, deployment encodes a threat prediction, and the night exposes whether both were correct. Its long cycle is intentionally deliberative rather than kinetic.

**TARGET:** Borrow the causal sequence, not the duration: resource conversion → positional commitment → pressure test → concise outcome. Keep it real-time and single-avatar.

### 2.2 Player-agency cadence

**OBSERVED:** Night combat is turn-based and grid-based. Each hero spends movement and action resources across weapon-granted skills, allowing the player to choose hero order, targets, areas, and resource expenditure without real-time execution pressure. Daytime adds production, repair, hiring, equipment, level-up, perk, and deployment decisions. [L1][L2][L3]

**INFERENCE:** The cadence is a dense sequence of micro-solves embedded in a much larger run-level economy solve. It offers exceptional explicit agency but high decision and UI load.

**TARGET:** Translate only one micro-solve at a time into real-time play: one visible threat cluster, one warden cooldown/resource constraint, and one defense interaction. Do not copy multi-hero turn sequencing.

### 2.3 RPG growth

**OBSERVED:** Heroes level, gain stats and perks, equip gear, and derive active skills from equipped weapons. Across failed and completed attempts, roguelite progression unlocks options and persistent advantages. The official materials frame repeated healing, leveling, and preparing as part of the core loop. [L1][L2][L3]

**INFERENCE:** Weapon-defined skill kits make loot immediately behavioral, while stat/perk rolls create adaptation pressure. Persistent unlocks soften failure, but a wide unlock pool can also make runs depend on menu mastery and option quality rather than action mastery.

**TARGET:** Let warden equipment define a compact active kit, then use a shallow modifier layer for synergy. Persistent progression should broaden viable tactics or accelerate recovery, not serve as the hidden prerequisite for baseline viability.

### 2.4 Unit/hero readability

**OBSERVED:** The game presents a small hero roster against very large enemy counts. Grid cells, turn boundaries, range/area previews, icons, health/status information, and forecasted horde directions make a dense battlefield inspectable. The RPGFan review praises its combat and design while also characterizing the overall experience as extremely demanding and stressful. [L1][L2][L3]

**INFERENCE:** Readability is achieved through time suspension and inspectable overlays. That solution cannot be assumed to survive translation to real-time. Multiple hero panels, equipment tabs, damage details, and a huge horde are affordable because the player can stop and calculate.

**TARGET:** In *Abyssal Surge*, the same information must collapse into pre-attentive cues: lane direction, threat class, remaining response window, and the warden’s next available intervention. Detailed arithmetic belongs behind optional inspection, not on the live combat layer.

### 2.5 Stage composition

**OBSERVED:** A Haven and its magic objective sit inside a grid-based defensive space; hordes approach from forecasted directions, damage outer defenses and city structures, and escalate across successive nights. Heroes deploy before combat and must cover a perimeter too large for one point solution. [L1][L2]

**INFERENCE:** The stage is a perimeter-allocation problem. Its strongest transfer is directional forecast plus meaningful civilian/production loss behind the wall, not the grid itself.

**TARGET:** Use readable approach arcs and protectable interior stakes to make movement decisions meaningful for one warden. Limit simultaneous fronts to the number a single real-time avatar can plausibly read and influence.

### 2.6 Failure and retry structure

**OBSERVED:** The cycle explicitly expects the player to “heal, level up, and repeat” until the Last Spell succeeds; roguelite elements persist across attempts. Failure ends the current settlement attempt, while subsequent attempts begin with a wider or stronger option set. [L1][L2][L3]

**INFERENCE:** Long-run loss is made tolerable by both metaprogression and accumulated system knowledge, but it can turn early attempts into foregone conclusions. The model suits a tactics roguelite marathon better than a direct-action session.

**TARGET:** Prefer checkpointed retry at a pressure segment or encounter boundary. Reward failure with information and perhaps a bounded unlock, but do not require several doomed runs before the warden has a fair baseline kit.

### 2.7 Control feel

**OBSERVED:** Control is cursor/grid/menu driven and turn-based; satisfaction comes from action-point routing, weapon-skill geometry, chained kills, and committing the turn—not from locomotion responsiveness or animation-cancel timing. [L1][L2][L3]

**INFERENCE:** This is a decision-feel reference, not a movement-feel reference. Its useful lesson is that each action advertises range, cost, and consequence before commitment.

**TARGET:** Keep real-time warden movement and attacks fully embodied, while borrowing preview clarity for charged areas, companion orders, placement zones, and costly ultimates.

### 2.8 Incompatible assumptions

- **INFERENCE — incompatible:** Turn-based time suspension makes enormous hordes and layered tooltips readable; a real-time single-warden game cannot copy that battlefield density one-for-one.
- **INFERENCE — incompatible:** Multi-hero roster optimization, equipment administration, workers, buildings, and defenses create excessive parallel ownership for a single-avatar action loop.
- **INFERENCE — incompatible:** Long roguelite runs ending in settlement loss rely on metaprogression as consolation; this risks agency-eroding “lose to unlock enough” pacing.
- **INFERENCE — incompatible:** Grid-perfect skill geometry and deterministic turn order do not validate analog movement feel, collision readability, or response windows.

---

## 3. Cataclismo — fortification as a real-time, destructible spatial system

### 3.1 Defense/offense phase loop

**OBSERVED:** The official description frames a day/night loop: gather resources, explore, expand and build during the day; hold against Horrors from the Mist at night. Combat and construction are real-time. The campaign is joined by skirmish, survival/endless-style, creative, and challenge modes. [C1][C2][C3]

**INFERENCE:** Unlike a conventional upgrade menu, preparation produces a physical artifact whose geometry is tested under pressure. The wall itself is the player’s stored plan.

**TARGET:** Make one or two defense interactions physically legible in the arena—coverage, choke, barrier health, or elevation advantage—without importing freeform architecture.

### 3.2 Player-agency cadence

**OBSERVED:** The player allocates resources, automates and improves gathering, places blocks and functional structures, trains and positions units, explores, and uses the protagonist Iris in real-time battles. The PC Gamer hands-on account describes repeated cycles of construction, first-wave validation, expansion, unit recruitment, and adaptation to a later multi-direction attack. [C1][C2][C3]

**INFERENCE:** Agency is unusually granular: many small spatial decisions accumulate into a defense hypothesis, then structural failure exposes exactly where the hypothesis broke. This creates strong authorship but also heavy planning cost.

**TARGET:** Give the warden a compressed authorship cadence: choose a defense behavior, choose its location/coverage, then personally exploit or rescue it. One choice should yield a visible arena change within seconds.

### 3.3 RPG growth

**OBSERVED:** Progression emphasizes new construction pieces, blueprints, production upgrades, troop types, and protagonist powers more than loot-driven character sheets. Functional pieces and height change unit performance; blueprints let players save and redeploy successful structures. [C1][C2][C3]

**INFERENCE:** This is systemic/technological growth, not primarily RPG character growth. The transferable feature is that an unlock expands the design vocabulary and produces a visible new tactic—not that the warden should inherit a large tech tree.

**TARGET:** Treat defensive unlocks as warden-combo verbs: e.g., a barrier that primes enemies for the warden, a beacon that redirects companions, or a ward that converts a successful parry into area control. The warden remains the owner of the payoff.

### 3.4 Unit/hero readability

**OBSERVED:** Unit function is tied to position and height: ranged units exploit elevated firing positions, specialized units handle clusters or slowing, and selected units expose environmental debuffs such as rain-drenched accuracy loss. The Escapist preview specifically reports that even collapsing structures and carnage did not become visually cluttered. [C2][C3]

**INFERENCE:** Readability is carried by spatial role: wall top, lower firing tier, chokepoint, and breach. Structural destruction is readable because it follows visible support relationships, although that clarity depends on an authored camera scale and relatively static defenders.

**TARGET:** Use altitude/zone and attack-shape to communicate defender roles. Any destructible defense must show damage, impending failure, breach direction, and tactical consequence without requiring selection.

### 3.5 Stage composition

**OBSERVED:** Maps combine terrain elevation, resource locations, incoming directions, environmental modifiers, and buildable space. In the PC Gamer skirmish, rain penalizes uncovered soldiers; hill height affects wall strength and unit role; a later wave attacks from both south and east, turning fortification coverage into the central stage question. [C2][C3]

**INFERENCE:** The stage is not background—it specifies construction constraints and combat rules. Environmental modifiers work because they change a visible spatial plan (roofing, height, support, facing), not because they add hidden arithmetic.

**TARGET:** Give each arena one environmental rule with a visible remedy and warden interaction. A rule should alter routing or timing, not merely apply a global stat debuff.

### 3.6 Failure and retry structure

**OBSERVED:** Structures fail component by component when supports are destroyed. PC Gamer reports that defeat can be rolled back to the previous day through generous autosaves, enabling a different construction approach rather than forcing a full campaign restart. [C2][C3]

**INFERENCE:** The checkpoint is placed before the expensive hypothesis, which encourages experimentation. The player retains knowledge of attack direction and structural weakness, so retry effort is focused rather than repetitive.

**TARGET:** Checkpoint immediately before a major pressure composition, then retain a compact failure recap. Retry should reopen the last consequential warden/defense choice rather than replay low-agency traversal or harvesting.

### 3.7 Control feel

**OBSERVED:** Cataclismo uses real-time RTS interaction: select and position troops, direct Iris, place and recycle many building pieces, and monitor a wide battlefield. PC Gamer describes satisfaction from pieces fitting together, clearing a debuff through a correctly built roof, and watching role-complementary defenders repel a wave. [C1][C2][C3]

**INFERENCE:** Its feel is tactile at the construction cursor and strategic at combat scale, not primarily avatar-action responsiveness. Feedback is strong because placement produces immediate geometry and units visibly use it.

**TARGET:** Borrow immediate world-state confirmation—snap, coverage preview, valid/invalid state, visible defender response—but keep warden locomotion/combat on a separate, low-friction control layer.

### 3.8 Incompatible assumptions

- **INFERENCE — incompatible:** Brick-by-brick construction, support physics, blueprints, recycling, and 100+ pieces constitute a full creative RTS; they would overwhelm a warden-led combat loop.
- **INFERENCE — incompatible:** Multi-unit selection, production chains, gatherers, and wide-map monitoring split player ownership away from the single hero.
- **INFERENCE — incompatible:** A defense can be the primary authored object in *Cataclismo*; in *Abyssal Surge*, the warden must remain the primary authored and controlled object.
- **INFERENCE — incompatible:** Daytime construction and rollback can tolerate long planning intervals; continuous action pressure needs smaller, faster experiments and nearer retry points.

---

## 4. Cross-title transfer matrix

| Design dimension | Thronefall | The Last Spell | Cataclismo | *Abyssal Surge* transfer | Confidence |
|---|---|---|---|---|---|
| Defense/offense rhythm | Safe build/economy commitment → active king-led wave | Production/deployment → turn-based night | Real-time build/economy → real-time night siege | **TARGET:** brief telegraphed commitment window → real-time warden test → rapid reassessment; do not require literal day/night | High |
| Agency cadence | Commit → pilot king/army → upgrade/retry | Many inspectable hero actions → long economy phase | Many spatial micro-decisions → structural test | **TARGET:** one macro commitment should change the warden’s next 20–60 seconds of play; keep decision ownership singular | High |
| RPG identity | Weapon verbs + capped perks + optional mutators | Weapon skill kits + stats/perks/gear + meta unlocks | Tech vocabulary, structures, troops, hero powers | **TARGET:** weapon/skill verbs first, a small synergy layer second, defensive unlocks only when they feed back into warden action | High |
| Hero primacy | King is focal fighter/commander, but army builds can dominate | Several equal heroes; no single avatar | Iris plus army and fortification system | **TARGET:** warden remains necessary for damage, rescue, routing, or conversion at every pressure peak | High |
| Readability solution | Bounded map, fixed sockets, simple unit command hierarchy | Paused turns, grid, overlays, forecasts | Height/role spatialization and physical destruction | **TARGET:** bounded arena + pre-attentive threat forecast + spatial role cues; reject turn-dependent UI density | High |
| Stage composition | Authored sockets/routes/economy risks | Forecasted perimeter fronts around central objective | Terrain, resources, height, weather, multiple fronts | **TARGET:** one dominant spatial question per stage and no more simultaneous fronts than one warden can influence | High |
| Failure attribution | Castle terminal; threat reveal may force retry | Long-run settlement loss plus meta progression | Component failure; rollback before defense hypothesis | **TARGET:** identify breach/threat/cause, checkpoint before the costly commitment, and reopen the failed choice | High |
| Control feel | Direct mounted hero plus coarse army orders | Turn-based decision feel, not movement feel | RTS selection/build cursor plus hero | **TARGET:** use *Thronefall* for intervention latency, *Last Spell* for action previews, *Cataclismo* for immediate spatial confirmation | Medium–High |
| Construction depth | Fixed sites and branch upgrades | Grid defenses and city economy | Freeform physics-aware construction | **TARGET:** bounded placement or defense-mode choice only; no general construction editor | High |
| Retry motivation | New loadouts, challenges, optional difficulty | Meta unlocks and build discovery | Revised blueprint/layout from nearby autosave | **TARGET:** revised tactic and clear information are primary; persistent reward is secondary | High |
| Continuous real-time compatibility | Closest of the three | Low without major translation | Medium at combat layer, low at management layer | **TARGET:** synthesize, do not clone: single-avatar real-time execution is the non-negotiable filter | High |

### Transfer priority by title

1. **INFERENCE — Thronefall / highest fit:** Copy the hero-as-intervention-pivot, compact authored stage puzzle, capped verb-changing loadout, and coarse rather than granular defender control.
2. **INFERENCE — Cataclismo / selective fit:** Copy visible spatial causality, environment-as-rule, defender role by position, and retry-before-hypothesis. Reject the construction editor and RTS economy.
3. **INFERENCE — The Last Spell / conceptual fit:** Copy forecast clarity, weapon-defined skill identity, and explicit action consequences. Reject time suspension, roster administration, horde density, and long-run failure structure.

---

## 5. Source register

### Thronefall

- **[T1] Official/primary — Steam store:** *Thronefall*, GrizzlyGames / Mythwright. Core description, build-and-defend premise, direct king role, castle failure, features. <https://store.steampowered.com/app/2239150/Thronefall/>
- **[T2] Secondary — Try Hard Guides:** Erik Hodges, “Thronefall Review — Tower Defense (With a Lot of Twists),” 2024-10-11. Fixed building sites, economy/defense tradeoff, king command, XP weapons/perks/mutations, upgrade branches, enemy reveals and retries. <https://tryhardguides.com/thronefall-review/>
- **[T3] Official/primary — Steam news hub:** Developer patch/update record used only as a currency check; no patch-sensitive balance claims are taken from it. <https://store.steampowered.com/news/app/2239150>

### The Last Spell

- **[L1] Official/primary — Steam store:** *The Last Spell*, Ishtar Games / The Arcade Crew. Day preparation, night combat, city defense, weapons/skills, roguelite framing. <https://store.steampowered.com/app/1105670/The_Last_Spell/>
- **[L2] Official/primary — Ishtar Games project page:** *The Last Spell*. Tactical RPG/roguelite premise and defense of humanity’s last bastion. <https://ishtar.games/project/the-last-spell/>
- **[L3] Secondary — RPGFan:** “The Last Spell Review,” 2023. Critical assessment of combat depth, demanding/stressful structure, horde tactics, progression, and presentation. <https://www.rpgfan.com/review/the-last-spell/>

### Cataclismo

- **[C1] Official/primary — Steam store:** *Cataclismo*, Digital Sun / Hooded Horse. Real-time strategy, brick-by-brick fortification, resource management, siege defense, exploration, campaign and modes. <https://store.steampowered.com/app/1422440/Cataclismo/>
- **[C2] Secondary — PC Gamer:** Robin Valentine, “This clever survival RTS has such a fun and in-depth building system…,” 2024-03-07. Hands-on evidence for height, rain/roofing, unit roles, construction constraints, multi-direction pressure, autosave rollback and retry. <https://www.pcgamer.com/games/rts/this-clever-survival-rts-has-such-a-fun-and-in-depth-building-system-that-its-got-me-making-little-roofs-to-keep-my-soldiers-dry-when-it-rains/>
- **[C3] Secondary — The Escapist:** Francisco Ruiz, “Cataclismo Smartly Mixes LEGO With the RTS Genre [Preview],” 2024-07-12. Campaign hands-on evidence for preparation/gathering, base defense, automatic resources, units/hero, blueprints, structural collapse, readability and difficulty. <https://www.escapistmagazine.com/cataclismo-smartly-mixes-lego-with-rts-tradition-preview/>

## 6. Five highest-confidence transferable rules

1. **TARGET — Preserve the player’s causal chain:** every cycle must expose **commitment → real-time warden intervention → visible outcome → revised choice**; never let passive simulation obscure why the result changed.
2. **TARGET — Keep the warden indispensable:** defenses and companions may delay, shape, prime, or expose threats, but pressure peaks must contain an outcome-changing action only the warden can perform.
3. **TARGET — Make growth change verbs before numbers:** a weapon, skill, or defense synergy should alter targeting, timing, movement, conversion, or rescue behavior within the next encounter; cap simultaneous build-defining effects.
4. **TARGET — Author one readable spatial question per stage:** telegraph approach direction and environmental rule, limit simultaneous fronts to warden-reachable scope, and make defender roles readable by position and effect.
5. **TARGET — Put retry before the expensive hypothesis:** checkpoint near the last consequential commitment, report breach/threat/cause, and let the player revise that choice without replaying low-agency setup.

## 7. Three anti-patterns

1. **TARGET — Do not import management breadth as depth:** no brick editor, worker economy, multi-hero inventory administration, or granular unit micro in the live single-warden loop.
2. **TARGET — Do not solve real-time readability with hidden pauses or UI density:** huge hordes, grid-perfect previews, stacked tooltips, and many simultaneous fronts are only legible in *The Last Spell* because time can stop.
3. **TARGET — Do not make failure an information tax or metaprogression gate:** never introduce an untelegraphed run-ending counter, then require repetition or permanent upgrades before the baseline warden can respond fairly.
