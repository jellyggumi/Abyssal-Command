# Presentation Spec — the visual contract the build is failing (run-id `20260725-wellmade-verification`)

Owner: DesignG7G8 (game-designer). **Specification, not implementation.** No asset,
material, or renderer change was made this cycle. This is the contract a future art pass
implements against, written now because the current build has no stated per-class visual
contract to fail *against* — which is why 23 of 24 characters shipped identical without
tripping anything.

Supersedes nothing: the prior cycle's
`_workspace/20260723-solo-warden-rpg-concept/design/presentation-spec.md` specifies art
*style* (cel-shading, palette family) and camera. It never specifies **per-class material
or readability intent**, and that omission is the gap this document fills. Style
decisions there remain in force.

Measured inputs (all from the director's direct measurement, not re-derived here):
`_workspace/20260725-wellmade-verification/qa/asset-audit-baseline.md` and
`engineering/rig-pipeline-root-cause.md`.

---

## 1. Canon palette {#canon}

**Five** colours, defined in `styles.css:381-388` as `--canon-*` tokens. Four are
character-material colours; the fifth is an environment tint. Verified directly this
session; the five-colour count was flagged by NarrativeG1 and confirmed at source.

| token | hex (canon) | hex (as measured in `commander/dusk-warden.glb`) | role |
|---|---|---|---|
| Void Obsidian | `#3c2c5b` | `#3e305c` | base / shadow mass |
| Cold Steel | `#737990` | `#72788f` | structural / neutral |
| Cyan Rift | `#2cadd6` | `#30acd5` | player-aligned energy |
| Zenith Void Gold | `#ddc869` | `#dcc768` | authority / apex |
| **Cinder Ember** | `#f3592c` | *(absent — not a character colour)* | **stage environment tint only** |

Measured values differ from canon by ≤4 per channel — within bake tolerance, treat as
compliant. **`dusk-warden` is the only model carrying any of them.** The other 23
characters are one flat desaturated mauve each (`#a9809f`, `#9a5c78`, `#b36174`, …), and
`textures = 0` across all 51 GLB in the project.

### 1.1 Stage tints already claim three of the four character colours {#tints}

`battle-realtime-three.js:325-336` (`STAGE_PALETTE_TINTS`) assigns a canon colour as a
full-scene environment wash per stage:

| tint | stages | count |
|---|---|---|
| Cyan Rift `#2cadd6` | veil-citadel, sunken-bastion, glass-necropolis | 3 |
| Void Obsidian `#3c2c5b` | echo-throne, abyss-chancel | 2 |
| Zenith Gold `#ddc869` | howling-sprawl, gate-zenith | 2 |
| Cinder Ember `#f3592c` | cinder-span, shattered-causeway | 2 |
| Cold Steel `#737990` | starless-canal | 1 |

**This constrains §5 and I am revising the reservation rules because of it.** A colour
cannot simultaneously be a per-actor semantic mark and a whole-scene wash: on
`glass-necropolis` the entire scene is tinted Cyan Rift, so a Cyan Rift faction mark on
companions has near-zero separation from its background. Same collision for Zenith Gold
on `gate-zenith` (the campaign's final stage, where boss gold accents matter most).

Revised rule, replacing a flat hue reservation:

1. **Character marks must be specified as luminance/saturation contrast against the
   active stage tint, not as absolute hex.** Cyan Rift stays the faction hue, but the
   binding contract is the separation, not the swatch.
2. **Minimum separation**: any character faction/role mark must differ from the active
   stage tint by **ΔE ≥ 25** (CIE76) or **≥25% relative luminance**. On a stage whose
   tint equals the mark hue, satisfy this by luminance — e.g. a brighter, higher-emissive
   Cyan Rift against a desaturated cyan wash.
3. **Cinder Ember is not available as a character colour.** It is environment-only, and
   the two stages carrying it are the ones where a warm character accent would read most
   strongly — do not spend it.
4. **Zenith Gold's ≤10% surface cap (§5.2) is a floor for legibility, not just
   restraint**: on the two gold-tinted stages a large gold area disappears into the wash.

### 1.2 Naming inconsistencies — hand-off, not this lane's fix {#naming}

Flagged by NarrativeG1 (`qa/narrative-audit.md`); recorded here because presentation
owns the visual/text surface contract, and one Korean subtitle must be chosen:

- `<title>` says **심연 방어선**; `<h1>` (`app.js:585`) says **그림자군단 방어선**. Two
  different Korean subtitles for the same product. Pick one.
- Canon calls the hub **Farwatch Hold** (`design/worldview.md:22`); shipped UI says
  **DEEP REFUGE**; "Farwatch" survives only in a comment at `campaign-state.js:217`.
- `그림자군단` ("Shadow Legion") is not in any canon doc — canon names the player faction
  **Warden Corps**. NarrativeG1 rates this an S1 lore violation and IP-adjacent.

No fix applied here (measure-only cycle, and the strings are G1's lane). The contract
this spec asserts: **one Korean subtitle, one hub name, used everywhere.**

## 2. The three defects this spec must answer {#defects}

| id | measured | consequence for readability |
|---|---|---|
| **D6** | `textures: 0` project-wide; `materials: 1` on 23/24 characters; each a single flat mauve | A 39,264-body-tri boss and an 11,043-body-tri trash enemy read as the same pink mass at gameplay camera distance. Silhouette is the *only* surviving identity channel, and the palette distinguishes neither faction, threat tier, nor role. |
| **D2** | `fitHeight()` (`battle-realtime-three.js:462`) builds its `Box3` over the whole GLB **including the uncut plinth**, so 20 of 24 characters render at **54–100%** of intended height — a 46-point spread | Scale, the one channel that survives a monochrome cast, is itself corrupted. **A boss can render shorter than another boss.** Worst: pack-herald 54%, abyss-regent 56%, requiem-choir 56%, pack-warden 59%. The 4 plinth-free bosses render at 100%. |
| **D5** | Commander `dusk-warden` is a **1,002-tri** procedural blockout (cone body, sphere head, crown spikes) against 8,676–39,264-tri sculpts | The always-on-screen, camera-followed, center-frame avatar is the lowest-fidelity object in the scene. **This is a placeholder, not a shipped design** — it is specified here as a target, not described as an asset. |

D2 is the most player-visible of the three and is a **renderer** bug, not an art bug:
the art is authored to a consistent height; `fitHeight` measures the wrong box.

## 3. Scale contract — per class {#scale}

Intended heights already exist in code (`battle-realtime-three.js:34-40`,
`TARGET_HEIGHT`). They are correct as authored. The contract is that they be **honoured**.

| class | intended height (world units) | rendered today | required |
|---|---|---|---|
| boss | **4.5** | 2.43–4.5 (54–100%) | 4.5 ±2% |
| commander | **2.9** | 2.9 (plinth-free) | 2.9 ±2% |
| elite | **2.2** | scaled by plinth fraction | 2.2 ±2% |
| enemy | **1.7** | scaled by plinth fraction | 1.7 ±2% |
| companion | **1.3** | 0.77–1.3 (59–100%) | 1.3 ±2% |

**Silhouette-height ratio contract**, derived from the intended values — this is the
readability property the numbers exist to produce:

```
boss : commander : elite : enemy : companion
4.5  : 2.9       : 2.2   : 1.7   : 1.3
= 3.46 : 2.23 : 1.69 : 1.31 : 1.00   (normalised to companion)
```

Every adjacent pair differs by ≥1.29×, which is above the ~1.2× threshold at which a
height difference is reliably read at a glance. The ladder is well designed. It is simply
not being delivered: at 54% a boss renders at 2.43, i.e. **shorter than the 2.9 commander
standing next to it**, inverting the single most important rank cue in the scene.

**Acceptance**: for every character GLB, `renderedHeight / TARGET_HEIGHT[class]` ∈
[0.98, 1.02]. Measure post-`fitHeight`, over the **body mesh only**, excluding any
`*_pedestal` mesh. The fix is to exclude the plinth from the `Box3` (or cut it in the
pipeline); the fix is not to re-author art.

## 4. Readability channels — what carries what {#channels}

Three orthogonal facts must be readable at gameplay camera distance, each on its **own**
channel. No fact may depend on a channel another fact owns.

| fact the player must read | channel | why this channel |
|---|---|---|
| **Threat tier** (boss / elite / enemy / companion / commander) | **silhouette height** (§3) | Survives colour-blindness, survives low contrast, survives the free-orbit camera at any yaw. The ratio ladder already encodes it. |
| **Faction** (player-aligned vs hostile) | **hue family** (§5) | The only binary fact in the scene; the cheapest channel is the coarsest. Must not be carried by brightness alone (fails in the dark palette). |
| **Role** (vanguard / striker / support; FRONT vs BACK) | **accent-mark shape + accent placement** (§6) | Hue is taken by faction and height by tier. Role is the third fact and needs a third, non-colour channel — this is also the accessibility-safe choice. |

**Rule**: any two actors that differ in threat tier must differ in rendered height by
≥1.25×. Any two that differ in faction must differ in dominant hue by ≥60° on the hue
wheel. Any two that differ in role must differ in accent-mark silhouette, independent of
colour.

## 5. Material intent — per actor class {#materials}

Budget: **≤3 materials per character**, plus one shared accent material. Rationale: the
commander already proves 4 is bakeable, and 23 of 24 characters currently ship 1. Three
is the smallest number that carries base + secondary + accent, i.e. the three channels
in §4. `textures: 0` may remain — this spec is satisfiable with **flat materials only**,
consistent with the cel-shaded style already locked in the prior spec. Textures are
permitted, not required.

### 5.1 Commander — `dusk-warden` (1 model)
- **Status: placeholder.** 1,002 tris, procedural blockout. Specify the target; do not
  preserve the current asset.
- Target geometry: **8,700–13,700 body tris**, i.e. companion tier (measured companion
  range 8,676–13,705). Justification is screen time, not importance: this is the only
  model that is never off-screen, always center-frame, and camera-followed. Current
  allocation is **1/39th** of the largest boss — inverse to screen time.
- Materials (4, the existing canon set): Void Obsidian base, Cold Steel structure,
  **Cyan Rift** accent, **Zenith Void Gold** apex.
- Uniqueness rule: **Zenith Void Gold is reserved.** The commander and stage bosses are
  the only actors permitted to carry it. Gold on screen means "apex actor", nothing else.
  Subject to §1.1 rule 4 — on `howling-sprawl` and `gate-zenith` the stage tint *is*
  gold, so the mark must clear the wash on luminance (§1.1 rule 2), not hue.
- Silhouette: must be identifiable at **≥1.25× the largest companion's** apparent size
  from any camera yaw — the free-orbit camera means it has no guaranteed viewing angle.

### 5.2 Bosses (10) — `abyss-regent`, `bridge-colossus`, `cinder-warden`, `gate-sovereign`, `lantern-tyrant`, `pack-herald`, `requiem-choir`, `tide-warden`, `veil-tactician`, `veiled-concordat`
- Height **4.5** (§3). Tallest class; the ratio ladder does the tier work unaided.
- Materials (3): Void Obsidian base + one **per-boss identity hue** + Zenith Void Gold accent.
- **Per-boss identity hue is mandatory and must be ≥30° apart between any two bosses.**
  10 bosses over the wheel gives 36° spacing — achievable with no two adjacent. This is
  the one class where individual identity outranks class identity: each boss is a
  once-per-campaign climax and must not read as "another boss".
- Gold accent is capped at **≤10% of visible surface** — it marks apex status, and if
  large areas carry it the reservation in §5.1 stops meaning anything.
- Note for the art lane: 4 bosses (`gate-sovereign`, `lantern-tyrant`, `tide-warden`,
  `veiled-concordat`) also carry the 3.1× animation-density deficit (D4, 6.73 vs 20.87
  kf/bone/s; idle 1.2 vs 11.0). A boss idles while the player clears its adds, so this is
  the longest-observed motion in the game. Out of scope for this spec, flagged because it
  lands on the same 4 models.

### 5.3 Elites
- Height **2.2**. Between enemy (1.7) and commander (2.9) — 1.29× above enemy, readable.
- Materials (3): hostile base hue + **capture-affordance accent** + neutral secondary.
- **The capture-affordance accent is load-bearing and is currently missing entirely.**
  Elite-capture is the recommended G8 novelty element
  (`design/novelty-scorecard.md#g8-recommend`), and an elite is the only enemy the player
  must *recognise before killing* in order to act on. It requires a channel that says
  "capturable" and no other actor may borrow it.
- Proposed: **Cyan Rift** on the elite only, at ≤15% surface — a hostile actor carrying
  a player-aligned hue reads as "this one can become yours", which is the mechanic stated
  in colour. Cyan is otherwise player-side only (§5.5), so the exception is legible.

### 5.4 Enemies (4) — `guard`, `possessed`, `scout`, `shade`
- Height **1.7**. Shortest hostile class.
- Materials (2, deliberately the leanest budget): hostile base + one policy-tier accent.
  These spawn in the largest numbers; per-unit material cost multiplies hardest here.
- **Per-archetype silhouette differentiation is required**, since with only 4 types and a
  shared hue family, shape is the only channel left. Each of the 4 must be distinguishable
  by outline alone at gameplay distance. They map to distinct behaviours
  (`gate-pressure` / `flank` / `elite-escort` / `resource-denial`), and a player who
  cannot tell a `flanker` from a `rusher` cannot make a positioning decision — which is
  the game's primary input.

### 5.5 Companions (9) — `anchor-shard`, `dawnless-crown`, `ember-cohort`, `lantern-reaver`, `pack-warden`, `requiem-warden`, `rift-lens`, `throne-echo`, `veil-vanguard`
- Height **1.3**. Shortest class overall — correct: 3 of them are on screen continuously
  and must not compete with the commander for attention.
- Materials (3): Cold Steel base + **Cyan Rift** faction mark + per-role accent.
- **Cyan Rift is the player-faction mark and is mandatory on every companion.** This is
  the faction channel from §4 and the single highest-value change in this document: it is
  what stops 3 allies reading as 3 more mauve enemies in a crowd. Subject to §1.1 rule 2:
  on the 3 cyan-tinted stages (`veil-citadel`, `sunken-bastion`, `glass-necropolis`) the
  mark must clear the wash by luminance, since hue separation is unavailable there.
- **Per-role accent shape** (not colour — colour is spent on faction):
  | role | accent-mark silhouette | rationale |
  |---|---|---|
  | vanguard | angular / shield-like, **low** on the body | reads as a barrier; low placement reads as grounded |
  | striker | sharp / blade-like, **high and forward** | reads as reach and intent |
  | support | rounded / halo-like, **above** the silhouette | reads as non-combat, sits outside the body outline |
- **FRONT vs BACK must be readable.** The 3-stance system's whole mechanical payload is
  `derivedFrontCount` 2/0/1 — which companions are enemy-targetable and DOWNED-capable.
  Today this has **no visual channel whatsoever**; it is inferable only from position.
  Required: FRONT companions carry a **persistent** state mark (proposed: the Cyan Rift
  faction mark at raised emissive intensity, ≥1.5× the BACK value). It must be persistent,
  not a transition flash — the player needs to read current formation state at any moment,
  not only at the instant it changes.
- **DOWNED state**: distinct from both ACTIVE and dead. Proposed: desaturate the body to
  Void Obsidian while the role accent-mark **stays lit** — reads as "this unit is out but
  still yours", which is exactly the non-terminal semantics of the state
  (`defense-run-simulation.js:1195`, `:1563`).

## 6. Stance readability {#stance}

The 3-stance formation is a G8 candidate (`novelty-scorecard.md#g8-adversarial`, N1) and
currently renders **only** as the spatial arrangement of 3 companions — no icon, no
colour, no VFX. Offsets from `rpg-catalog.js` `STANCE_CONFIG`:

| stance | companion offsets | `derivedFrontCount` | lateral footprint |
|---|---|---|---|
| VANGUARD | 2 forward at magnitude 1400 (NW/SW), 1 trailing 500 (E) | 2 | ~2,000 |
| TURRET | all 3 clustered at magnitude 300 (E/NE/SE) | 0 | ~600 |
| SPLIT | 1 N + 1 S at magnitude 2000, 1 trailing 300 (E) | 1 | ~4,000 |

Footprint differs by up to **6.7×** between TURRET and SPLIT, in a 24,000×12,000 arena —
so the layouts *should* be distinguishable on geometry alone. Whether they are at
gameplay camera distance is being measured by VisualG4 this cycle; treat the result as
the acceptance test for this section.

**Required regardless of that result**: a persistent stance indicator that does not
depend on reading three companion positions simultaneously. The mechanic has a 4-second
cooldown, which means the player must know current stance *before* committing to a
switch. Position-only communication forces a visual scan of the whole formation to answer
a question the HUD should answer in one glance.

## 7. Acceptance criteria {#acceptance}

Implementable, measurable, and none of them require a human judgement call:

1. **Scale** — for all 24 characters, `renderedHeight / TARGET_HEIGHT[class]` ∈
   [0.98, 1.02], measured over body geometry excluding any `*_pedestal` mesh.
2. **Tier separation** — any two actors of different threat tier differ in rendered
   height by ≥1.25×.
3. **Faction separation** — dominant hue of any player-aligned actor differs from any
   hostile actor by ≥60° on the hue wheel.
4. **Faction mark** — 100% of companions and the commander carry Cyan Rift; 0% of
   non-elite hostiles do.
5. **Stage-tint separation** — on every one of the 10 stages, each character's
   faction/role mark clears the active `STAGE_PALETTE_TINTS` wash by **ΔE ≥ 25 (CIE76)**
   or **≥25% relative luminance**. This is the criterion most at risk of being missed,
   because a mark can pass criteria 3–4 in isolation and still vanish in-scene.
6. **Gold reservation** — Zenith Void Gold appears on the commander and bosses only, at
   ≤10% of visible surface.
7. **Material budget** — ≤3 materials per character (commander exempt at 4); no character
   ships at 1.
8. **Enemy silhouette** — the 4 enemy archetypes are distinguishable by outline alone at
   gameplay camera distance.
9. **Formation state** — FRONT vs BACK companions are distinguishable without inferring
   from position.
10. **Elite affordance** — elites are distinguishable from non-elite hostiles of the same
    archetype before engagement.
11. **Commander fidelity** — commander body-triangle count ≥0.5× the companion-class
    floor (currently **1,002 vs 8,676**: **0.12×**, failing by ~4.3×).
12. **One Korean subtitle, one hub name** (§1.2) — `<title>` and `<h1>` agree; the hub is
    named identically in UI and canon.

Criteria 1–2 are unblocked today and require **no art**: they are a renderer fix to
`fitHeight`'s `Box3`. That is the highest-value item in this document — it repairs the
one readability channel that currently still works, before any material work begins.

## 8. Ranked improvements {#improve}

1. **Exclude the plinth from `fitHeight`'s `Box3`** (`battle-realtime-three.js:462-468`).
   Fixes criteria 1–2 for 20 of 24 characters. No art authoring, no balance impact,
   repairs the most player-visible defect (a boss rendering shorter than a companion).
2. **Cyan Rift faction mark on all 9 companions + commander.** Smallest material change
   that restores the faction channel and stops allies reading as enemies in a crowd.
3. **Per-boss identity hue, ≥30° apart.** 10 bosses currently share one mauve family;
   each is a once-per-campaign climax beat and they are mutually indistinguishable.
4. **Capture-affordance accent on elites.** Directly unblocks the G8 recommended novelty
   element — an uncapturable-looking capturable is a mechanic the player cannot find.
5. **Replace the commander blockout** (~15k tris, canon palette). Largest single art cost
   here, and correctly ranked last: it is the *most* visible model but also the one whose
   current state is a known placeholder rather than a defect introduced by the pipeline.
