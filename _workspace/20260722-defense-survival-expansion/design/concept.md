---
stage: 1
owner: game-designer
updated: 2026-07-22
status: FIX-runtime-gaps-and-human-gates-open
source_of_truth: /Users/jangyoung/vaults/llm-wiki/wiki/reports/2026-07-22-abyssal-command-defense-rpg-production-plan.md
runtime_authorities:
  - defense-catalog.js
  - defense-run-simulation.js
  - campaign-state.js
  - app.js
---
# Abyssal Command concept

## Public-beat promise

**Abyssal Command: Abyssal Surge** is an offline, mobile-first 2.5D defense-survivor RPG. The player moves the `Dusk Warden` across one readable battlefield, protects a damaged Gate from the `Moonless Court`, recovers `Echo Deep` residue, chooses growth, occupies a risky `Domain`, extracts a defeated elite's command-memory as a permanent companion, then kills the boss. Ten stage clears culminate at `Gate Zenith`.

**Single striking hook — Echo-command extraction:** an elite is not a loot chest. Its defeated memory opens a ten-second `W-02 Bind / Extract` window at a contested Domain point. Completing the bounded extraction immediately turns that enemy memory into a named allied command and records it locally. This is the only feature presented as the novelty candidate; G8 frequency is measured in `novelty-scorecard.md`, while its impression limb remains unmeasured.

## Canonical loop and player verbs

`Gate defense → Echo recovery → growth → occupation/extraction → boss kill → stage reward/unlock`

| beat | deliberate player verb | rules result | trace |
|---|---|---|---|
| Gate defense | occupy firing space, reposition, cast | keep Gate and Warden alive while auto-attacks resolve | W-03, W-04 |
| Echo recovery | cross pressure lines to collect drops | gain XP and the stage's run item | W-01 |
| Growth | select one of three visible choices | change a current-run skill/stat with current → upgraded values | W-01, W-04 |
| Occupation/extraction | hold a Domain point, then Bind during the elite window | alter movement/range/recovery geometry and add one extracted companion | W-02, W-04 |
| Boss kill | read boss pursuit/attack, reposition, commit a skill | finish the authored stage threat | W-03 |
| Completion | select one of three stage rewards | persist Archive growth and unlock the next stage | W-05 |

Occupation is not a second capture-game ruleset. Each stage has one simulation-owned W-04 occupation point and one W-02 extraction point. Their positions, radii, hold/window ticks and movement/range/recovery effects are catalog data; the renderer only displays resolved state. The current R2 catalog authors these fields, but current-head regressions mean they are candidate bounds rather than validated balance.

## Battlefield contract for ten distinct stages

Current `STAGE_TACTICS` gives every stage a primary chokepath, flank, elevation anchor, hazard, occupation point, extraction point and authored spawn directions. Runtime values remain authoritative:

| stage | chokepath / flank | elevation / hazard | occupation / extraction |
|---|---|---|---|
| Cinder Span | `cinder-center` / `cinder-south` | `cinder-overlook` / `ash-surge` | `cinder-seal` / `cinder-bind` |
| Veil Citadel | `veil-twins` / `veil-north` | `veil-rampart` / `mirror-static` | `veil-signal` / `veil-bind` |
| Echo Throne | `throne-aisle` / `throne-south` | `throne-dais` / `echo-rift` | `throne-domain` / `throne-bind` |
| Sunken Bastion | `bastion-floodgate` / `bastion-channel` | `bastion-anchor` / `flood-pulse` | `bastion-pump` / `bastion-bind` |
| Howling Sprawl | `sprawl-funnel` / `sprawl-crosswind` | `sprawl-ridge` / `howling-gust` | `sprawl-beacon` / `sprawl-bind` |
| Glass Necropolis | `glass-crypt` / `glass-reflection` | `glass-spire` / `glass-shardfall` | `glass-choir` / `glass-bind` |
| Starless Canal | `canal-lock` / `canal-sluice` | `canal-towpath` / `canal-undertow` | `canal-toll` / `canal-bind` |
| Shattered Causeway | `causeway-gap` / `causeway-rubble` | `causeway-keystone` / `causeway-collapse` | `causeway-brace` / `causeway-bind` |
| Abyss Chancel | `chancel-nave` / `chancel-transept` | `chancel-apse` / `oath-pressure` | `chancel-oath` / `chancel-bind` |
| Gate Zenith | `zenith-threshold` / `zenith-umbra` | `zenith-crown` / `deep-command` | `zenith-last-seal` / `zenith-bind` |

R2 candidate bounds are occupation radii 750–950 units, holds 180–360 ticks (3–6 s), movement ×1.04–1.08, range ×1.06–1.12 and integrity recovery +4–12/s; extraction radii 850–1000 and windows 600 ticks (10 s). These are signed pending correctness and retune: QA observed recovery quantized to +60/s, occupation `214/180`, spatial progress before the elite candidate and a remote `EXTRACT_ELITE` bypass. Public-beat behavior requires authored per-second recovery, enemy contest without reward deletion, and the 600-tick clock to begin at elite defeat. Bind is a 120-tick / 2-second spatial hold; it must be the only route to one companion/persistence event. Same seed plus same input stream must reproduce point, hazard, wave, policy and extraction events.

## Threat grammar and real defeat pressure

Each stage follows `scout → pressure → flank → ranged → elite → boss`. Authored timings, counts and policy weights live in the catalog; deterministic variation is sampled by the simulation from the stable run seed before the first tick. `app.js` derives that seed from campaign ID, reset epoch, stage ID and attempt with a stable FNV-1a hash; the simulation uses unsigned xorshift32. The renderer receives resolved spawn direction, path and intent; it never samples randomness.

Enemy intent must be visible and mechanically distinct:

| policy | decision target | defeat pressure created |
|---|---|---|
| gate pressure | shortest available Gate path | W-03 breach clock |
| player pursuit/attack | Warden position within authored aggro/range | personal survival pressure |
| flank | alternate path that bypasses the occupied main choke | forced reposition |
| resource denial | active Domain or unrecovered Echo cluster | delays growth/extraction without deleting rewards |
| elite escort | radius around live elite or extraction point | protects the hook window |
| low-HP focus | lowest eligible living defender below the catalog threshold | punishes exposed Warden/companion state |

The current head now gives the Warden integrity, six authored policy IDs, seeded wave timing/density/direction, and tactical stage data. These are not validated: QA reports 9/23 focused simulation/adapter failures and 0/50 wins across five archetypes × ten stages. The schedule still maps only three authored wave rows before separately spawning elite/boss, so the complete six-phase grammar and mandatory reward order are not proven. HP, damage, speed, density, spawn direction, policy counts and boss-only TTK must be measured by G2/G3 before this section can pass.

## Progression layers — never collapse these labels

| layer | lifetime | choice/display contract |
|---|---|---|
| run item | current stage run | elite drop; named numeric effect |
| skill growth | current run | deterministic three-choice offer; current → upgraded value |
| derived stats | current run | HP, damage, speed, range, recovery, cooldown shown from resolved state |
| synergy | current run | explicit pair/recipe; combined EV ≤1.30× median standalone build |
| extracted companion | permanent collection + current run ally | prototype, current → upgraded combat values, loadout eligibility |
| stage reward | persistent after victory selection | one of three stage-authored records |
| Archive growth | persistent local record | W-05 modifier, stage unlock and campaign-completion state |

No commerce, network, account, energy timer or paid-power lane may be introduced. All persistent state stays in the existing offline campaign store.

## Camera and controls readability

The fixed full-field camera must show the Gate, relevant ingress, Domain points, hazards and the current extraction point without hiding a threat behind decorative depth. Elevation is a 2.5D presentation and path/range input, not free camera control. Keyboard movement remains WASD/arrow input mapped to eight deterministic octants; pointer/touch remains a virtual stick. Active skill, growth choice and Bind are explicit controls with ≥44 CSS-pixel targets. The HUD must expose Gate/Warden health, phase, seed-stable intent telegraphs, Domain state, extraction countdown and every numeric current → upgraded decision. Input feedback target remains ≤100 ms; the renderer/audio may acknowledge input and events but may never alter them.

## Current implementation reconciliation

| capability | observed current state | public-beat requirement |
|---|---|---|
| ten ordered stages and local unlock/save | implemented foundation | retain; current terminal/reward regressions must be fixed |
| deterministic 60 Hz snapshot simulation | implemented with stable campaign seed and xorshift schedule | retain; prove same-seed event replay |
| eight-way movement, auto basic attack, skills | implemented | retain and improve readability |
| XP, three-choice skills, stage item, elite candidate, companion, victory reward | implemented paths, but current-head focused tests regress ordering/terminal behavior | FIX event contract before tuning |
| elite/extraction duration | catalog authors 600 ticks / 10 s; spatial hold is 120 ticks | FIX candidate-relative clock and companion event/persistence chain |
| chokepath/flank/elevation/hazard/occupation/extraction data | authored for all ten stages; simulation has partial behavior | prove rendering, contest, movement/range/recovery and hazard events end to end |
| six policies and Warden integrity pressure | authored/implemented candidate | FIX 0/50 outcomes; validate target selection and telegraphs |
| seeded scout→pressure→flank→ranged→elite→boss variation | seeded 3-row schedule plus separate elite/boss; six labels authored | FIX missing complete phase/event proof |
| five-archetype 45–55% win, boss TTK ±15%, combo EV ≤1.30× | current-head probe 0/50 wins; TTK/EV unresolved | FAIL/FIX: restore correctness, then retune catalog |

## Numeric gates

- G1: zero W-01…W-05 lore violations; full shipped-content audit remains open.
- G2: five-archetype win rate 45–55%, boss TTK within ±15% of target, combo EV ≤1.30× median.
- G3: five archetypes tested, at least three viable.
- G4: immersion median ≥4/5 and input/feedback ≤100 ms.
- G7: one measured loop is 30–180 seconds, includes ≥3 deliberate actions and ≥1 reward; repeat ≥70%.
- G8: candidate hook appears in ≤2/5 bounded comparables and receives ≥4/5 impression score.

**Stage 1 verdict: FIX.** The catalog and simulation now contain candidate terrain, occupation, extraction, policy, Warden-integrity and seeded-variation work, but focused tests and five-archetype outcomes are red. Candidate bounds are signed only pending correctness restoration and retune; value-preview, human and balance evidence remain open. No gate is promoted by this document alone.
