# Solutions

Genre frequency scan for G8. 11 comparable titles; each of Abyssal Command's five
candidate elements scored for presence.

## Solution List

Surveyed comparable set (11 titles, ≥5 floor met):

| # | Title | Sub-family | Why comparable |
|---|---|---|---|
| T1 | Vampire Survivors | roguelite-survivor (PC/mobile) | genre-defining auto-attack wave survival |
| T2 | Survivor.io | mobile survivor | auto-attack, pet companions, meta-progression |
| T3 | Brotato | roguelite-survivor | auto-fire, wave-boundary shop cadence |
| T4 | Halls of Torment | roguelite-survivor | auto-attack, permanent meta-progression |
| T5 | 20 Minutes Till Dawn | roguelite-survivor | near-auto fire, rune meta-progression |
| T6 | Soulstone Survivors | roguelite-survivor | active skills on cooldown + wave survival |
| T7 | Deep Rock Galactic: Survivor | roguelite-survivor | auto-fire, stage/objective structure |
| T8 | Archero | mobile action-roguelite | auto-attack when stationary, spirit companions |
| T9 | Yet Another Zombie Survivors | **squad** roguelite-survivor | 3-survivor squad — closest structural peer |
| T10 | Kingshot | mobile 4X/defense hybrid | troop-ratio formation presets, rally combat |
| T11 | Whiteout Survival | mobile 4X/defense hybrid | front/mid/back row formation, auto-resolved |

T9 is the load-bearing comparable: it is the only surveyed title that, like Abyssal
Command, puts a **player-controlled squad** in a survivor loop. T10/T11 are the
load-bearing comparables for formation, being the only two with an explicit named
formation system.

## Frequency Ranking

`Y` = element present in an equivalent form. `~` = partial/adjacent. `N` = absent.

| Candidate element | T1 VS | T2 Svio | T3 Bro | T4 HoT | T5 20MTD | T6 SS | T7 DRGS | T8 Arch | T9 YAZS | T10 King | T11 WoS | **freq** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **N1** whole-squad positional stance toggled *during* a run, on cooldown | N | N | N | N | N | N | N | N | **N** | ~ | ~ | **0/11 exact, 2/11 partial** |
| **N2** defeat a specific elite → capture it → it becomes a *permanent roster companion* | N | N | N | N | N | N | N | N | ~ | N | N | **0/11 exact, 1/11 partial** |
| **N3** boss spawn opens a party-wide cooldown-reduction window gated on formation state | N | N | N | N | N | N | N | N | N | N | N | **0/11 found (see caveat)** |
| **N4** AI companion has a non-terminal DOWNED state distinct from death | N | **Y** | N | N | N | N | N | ~ | ~ | N | N | **1/11 exact, 2/11 partial** |
| **N5** free-orbit player-controlled camera (yaw unrestricted, pitch clamped) | N | N | N | N | N | N | N | N | N | N | N | **0/11** |

### Per-candidate evidence

**N1 — 3-stance formation (VANGUARD / TURRET / SPLIT, derivedFrontCount 2/0/1, 4 s cooldown)**
- T9 Yet Another Zombie Survivors is the closest peer and is an explicit negative:
  "there is **no mechanic to manually change your squad's formation or positioning
  mid-run**… their relative positions are fixed by the game's AI behavior rather than
  player-controlled 'tank' or 'ranged' slots." Positioning is achieved only by kiting
  with your own body. [indexed snippet]
- T11 Whiteout Survival — `~`: real front/mid/back rows, but assignment is **implicit
  from unit type** (Infantry/Lancer/Marksman), and "you cannot manually 'switch' or
  rearrange troop positions while a battle is actively in progress." Presets are chosen
  **before** deployment. [indexed snippet]
- T10 Kingshot — `~`: formation is an Infantry/Cavalry/Archer **percentage ratio preset**
  (50/20/30, 10/10/80, 60/40/0) saved in a Squads menu and selected pre-march, not
  toggled during combat. [indexed snippet]
- T1–T8: single-protagonist; no squad exists to position.
- **Distinguishing axis**: T10/T11 have formation-as-*composition chosen before combat*.
  Abyssal has formation-as-*spatial posture switched during combat on a 4 s cooldown*.
  The partials share the noun, not the verb.

**N2 — elite-capture → permanent companion**
- T2/T8 explicit negative: "In Survivor.io (and the similar title Archero), there is **no
  system that allows you to capture enemies and turn them into allies**." Pets come from
  chests/gacha and "are pre-defined creatures… rather than converted enemies." [indexed snippet]
- T3/T4/T5/T6 explicit negative: "there is **no mechanic** that allows you to recruit
  defeated enemies as permanent companions to use between runs." Meta-progression is
  currency/unlock-based (Torment Shards, Souls, materials). In-run summons "are
  ephemeral; they disappear when the run ends." [indexed snippet]
- T9 `~`: you can recruit up to two additional survivors *during* a run, but recruitment
  is not sourced from defeating a specific elite. [indexed snippet]
- The named cross-genre precedents are outside the comparable set: Palworld
  (monster-taming), Shadow of War's Nemesis System (open-world action). Their existence
  is why this is scored as genre-rare, not medium-rare.

**N3 — Boss Rally Window** (`BOSS_RALLY_COOLDOWN_REDUCTION = 0.20`, rpg-catalog.js:108;
fires at boss spawn only when `livingFrontCompanions(run).length` — defense-run-simulation.js:362-367)
- **Caveat, stated plainly**: the search for this returned *game-design advice on how to
  build such a mechanic*, not evidence of shipped titles containing one. That is an
  **absence of found examples, not a confirmed negative.** Scored `0/11 found` and
  deliberately **not** promoted to the recommended candidate on that basis. A boss-spawn
  buff window is a common enough design primitive that a deeper per-title audit would
  plausibly find instances. Treat as thin evidence.

**N4 — DOWNED companion state** (`target.status = "DOWNED"`, defense-run-simulation.js:1195, 1563)
- T2 **confirmed positive**: "If a pet's health reaches zero, it typically becomes
  incapacitated for a period or is simply removed from active fighting for the remainder
  of that specific run, but it is not permanently lost from your account." That is a
  non-terminal downed state for an AI companion — the same shape as Abyssal's. [indexed snippet]
- T8 `~`: spirits are persistent account-side; in-run incapacitation not confirmed either way.
- T9 `~`: squad members exist and can be lost in-run; whether the state is non-terminal
  and distinct from death was not confirmed at source. Marked partial, not counted as Y.
- T1/T3: summons are weapons/turrets with no health-bar identity — "no persistent 'life'
  that can be permanently ended." Not a companion state at all. [indexed snippet]
- N4 **passes ≤2/5 on the numbers** (1 exact, 2 partial) but is the weakest candidate:
  the one confirmed positive is the single closest mobile comparable, which means the
  element is exactly where a player of this genre would already have met it.

**N5 — free-orbit camera** (yaw unrestricted, pitch clamped [30°,85°], default 65°;
`presentation-spec.md` camera block)
- 0/11. The fixed camera is not merely common, it is **constitutive**: "The fixed
  top-down camera perspective is widely considered a **defining convention** of the
  'Survivor' (or bullet heaven/auto-shooter) genre, popularized by Vampire Survivors,
  Brotato, and Halls of Torment." Rotation is avoided deliberately — disorientation,
  control complexity, and the genre's need to *reveal* rather than conceal. [indexed snippet]
- This is the rare case where the survey found not just absence but a documented
  *rationale* for absence. That cuts both ways and is handled in `novelty-scorecard.md`:
  a deviation the genre avoids on purpose is a design risk as much as a novelty asset.

## What People Actually Use

What the 11 surveyed titles actually ship, as distinct from what is theoretically
available in the genre:

- **8 of 11 ship no squad at all.** T1–T8 are single-protagonist. The "companion"
  question does not arise for them; summons are weapons with no identity.
- **The 3 titles that do ship multiple units all take agency away from positioning.**
  T9 fixes squad position to follow-AI. T10 and T11 resolve combat with the player absent
  entirely, having chosen composition beforehand.
- **Acquisition is monetised or gated, never earned in-fight.** Chests and gacha (T2, T8),
  challenge unlocks (T3), currency spend (T4, T5, T6). No surveyed title sources a
  permanent unit from a specific defeated enemy.
- **Every surveyed title uses a fixed camera.** Not one exposes player-controlled orbit.
- **In-run power comes from a level-up choice card** in 7 of 11 — the one convention
  Abyssal shares wholesale, and correspondingly the one place it has no novelty claim.

The practical consequence: a player arriving from any of these 11 has been trained that
allies are either absent, automatic, or purchased, and that the camera is not theirs.
All three of Abyssal's surviving candidates break a trained expectation rather than
extending one.

## Contradictions

- **The genre's reason for its fixed camera is the axis this build is already failing.**
  Sources justify the fixed camera by readability under crowd density. Abyssal adopts
  free orbit — the genre's riskiest camera deviation — while 23/24 characters are one
  flat untextured mauve and render at 54–100% of intended height (director's
  `engineering/rig-pipeline-root-cause.md` D2/D6). The novelty and the defect load the
  same axis in opposite directions.
- **The closest structural peer has unmet demand for the exact mechanic Abyssal ships.**
  T9 players "have discussed the desire for more tactical positioning," and those
  features "are not currently present." That is simultaneously the strongest evidence N1
  is wanted and a caution that a shipped squad-survivor chose not to build it.
- **Formation is both common and absent, depending on the verb.** T10/T11 have named
  formation systems, so "formation" reads as a genre-standard noun; neither permits
  changing it during combat, so the mechanic Abyssal ships is unrepresented. A frequency
  count keyed on the word rather than the behaviour would score N1 as 2/11 common and be
  wrong.
- **N3's evidence is absence-of-search-results, not a confirmed negative** — recorded
  here rather than buried, and the reason N3 is withdrawn from candidacy in
  `design/novelty-scorecard.md#g8-adversarial` despite scoring 0/11.

## Categories

1. **Formation-as-composition** (T10, T11) — pre-combat ratio/slot selection. Strategy-layer.
2. **Formation-as-emergent** (T9) — squad clusters on the player; positioning only via kiting.
3. **No formation** (T1–T8) — single protagonist.
4. **Companion-as-weapon** (T1, T3) — summons with no identity or persistent state.
5. **Companion-as-account-asset** (T2, T8) — gacha/chest pets, persistent, in-run incapacitation.
6. **Companion-as-in-run-recruit** (T9) — recruited mid-run, run-scoped.
7. **Companion-as-captured-elite** (Abyssal only) — sourced from a defeated named elite,
   persists to the campaign roster.

## Key Gaps

- **No surveyed title occupies category 7.** The elite-capture loop is the one candidate
  with a structurally empty cell in the comparable set rather than a partial neighbour.
- **No surveyed title lets the player change squad posture during combat.** The two
  titles with a real formation system lock it before the fight; the one title with a real
  squad does not expose formation at all.
- **Free camera is absent by deliberate convention, not oversight.** Novel, and risky.
- **Contradiction worth recording**: the genre's own stated reason for the fixed camera
  (preserving readability of a dense field) is the same axis the build is currently
  failing for unrelated reasons (flat-mauve cast, 54–100% render-height spread). Adopting
  the genre's riskiest camera deviation while readability is already compromised
  compounds two independent problems.

## Key Insight

Two of the five candidates are **structurally absent** from the comparable set rather
than merely uncommon: elite-capture-to-permanent-companion (N2) and in-combat squad
stance switching (N1). Both clear ≤2/5 with room. The remaining three are weaker for
three different reasons — N3 on thin evidence, N4 because the one confirmed positive is
the closest mobile peer, N5 because its absence is a deliberate genre choice the build
has not yet earned the readability budget to override.

## Curated Sources

All retrieval this session was via search-engine synthesis over the listed domains;
labelled `indexed snippet` throughout, none upgraded to `direct page retrieval`.

- Genre camera convention — steamcommunity.com, medium.com, xmodhub.com, reddit.com, gamegrin.com
- Survivor.io / Archero pets — onechilledgamer.com, pocketgamer.com, allclash.com, reddit.com
- Brotato / HoT / 20MTD / Soulstone meta-progression — steamcommunity.com, steamdb.info, spellsandguns.com, levelwinner.com
- Deep Rock Galactic: Survivor solo structure — gamepressure.com, fundaygames.dk, ginx.tv
- Yet Another Zombie Survivors squad — reddit.com, steamdb.info, summerengine.com, steamcommunity.com
- Kingshot troop ratios — kingshotcalculator.net, kingshotguide.org, wizardstower.com
- Whiteout Survival formation — helpshift.com, bluestacks.com, outof.games
- Ally permanence across VS/Svio/Brotato — reddit.com, dualshockers.com, steamcommunity.com
