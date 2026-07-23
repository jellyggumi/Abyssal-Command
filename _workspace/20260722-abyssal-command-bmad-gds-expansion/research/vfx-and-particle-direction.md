# Abyssal Command — VFX and particle direction

**Research date:** 2026-07-22  
**Stage ownership:** Stage 3 presentation/resources/performance input; it supplies Stage 1 core-loop presentation briefs and Stage 2 encounter/reward hooks.  
**Status:** All numerical values marked **Target** are proposals to validate. This packet makes no G4, G6, or G7 PASS claim and reports no measured runtime result.

## Question and fixed boundaries

How should a mobile-first Canvas 2D defense-survivor express automatic attacks, skills, area resolution, critical outcomes, arrivals, damage, loot, and visible progression as one readable Abyssal language without allowing particles, generated assets, or renderer quality to affect deterministic play?

The local product contract is controlling: combat simulation is fixed-step deterministic at **60 Hz**; the battlefield is full-bleed Canvas with edge HUD; the player moves while basic attacks and targeting are automatic; Canvas adapters only observe snapshots; the game is offline/local-first; and reduced motion must preserve danger, damage, and selection through static contrast and text [P0]. No proposed effect creates a collision, target, hit, cooldown, reward, RNG result, persistence write, or command. No Blender, PerfectPixel, or other generator runs at gameplay time. Generated art is a reviewed, local build input only.

## Evidence ledger

| ID | Evidence and access | Direct support | Bounded use |
| --- | --- | --- | --- |
| P0 | [Abyssal Command defense/survivor design](../../../docs/abyssal-command-defense-survivor-design.md), local primary contract, accessed 2026-07-22 | Defines 60 Hz determinism, snapshot-only Canvas projection, offline/local-first operation, movement-first automatic combat, edge HUD, and reduced-motion static readability. | Binding authority and no-feedback boundary. |
| E1 | [MDN: Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas), accessed 2026-07-22 | Recommends pre-rendering repeated primitives, integer coordinates, avoiding per-draw image scaling and `shadowBlur`, batching/state-change reduction, layered canvases, and `requestAnimationFrame`. | Supports a degraded Canvas strategy; it does not establish this game's frame budget. |
| E2 | [MDN: `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion), accessed 2026-07-22 | Describes detecting a user preference to remove, reduce, or replace nonessential motion. | Supports an equivalent semantic motion-reduced path. |
| E3 | [W3C WCAG 2.2 SC 2.3.1 understanding](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html), accessed 2026-07-22 | Content must not flash more than three times in one second unless below specified thresholds; saturated red is specifically sensitive; assess at largest scale. | Safety ceiling for clips. This does not assert whole-game WCAG conformance. |
| E4 | [Xbox Accessibility Guideline 103](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/103), accessed 2026-07-22 | Critical information should be available through more than one sensory method; color alone is insufficient; haptics needs an accompanying cue. | Requires non-color static semantic signatures for critical states. |
| E5 | [Blender Manual: Emission](https://docs.blender.org/manual/en/latest/render/shader_nodes/shader/emission.html), accessed 2026-07-22 | Documents an Emission shader node that produces a light-emitting material appearance. | Confirms an available authored-tool route for baked luminous source art; no Blender pipeline is mandated or executed here. |
| E6 | [PerfectPixel Studio commit `a1385cc`](https://github.com/gykim80/perfectpixel-studio/tree/a1385cc99eb4b6983c945adb8cca7b2b71f53d0f), accessed 2026-07-22 | Its pinned repository snapshot describes generated character sprite sheets with eight directions and action sets. | Supports generator-compatible character brief fields only. It does not validate generated output or license a game asset without review. |

**Evidence boundary.** E1–E6 do not justify any target particle count, asset size, readability rate, or performance result. Those are original design targets. Comparable-game art, characters, names, UI, and effects are not references to copy.

## Art thesis: controlled bioluminescence, not visual noise

Abyssal Command should read as a dark, mineral oceanic command space where **geometry identifies meaning before color supplies emotion**. The battlefield is quiet enough for a player to see a route; confirmed automatic combat is compact; a skill creates a legible authored shape; danger and survival state are always stronger than reward texture.

### Palette language

| Token | Hex target | Meaning and permitted use | Non-color signature / exclusion |
| --- | --- | --- | --- |
| `ABYSS_BACK` | `#08111C` | World recesses, unlit water/mineral negative space; default backdrop. | Never carries a state alone. |
| `DOMAIN_SLATE` | `#294154` | Terrain, dormant structures, common-enemy low-priority material. | Rounded/organic silhouettes; not a warning. |
| `ECHO_CYAN` | `#55D7E8` | W-01 Command Echo: automatic contact, signals, ordinary resolved action. | Thin crescent or broken line; not health or loot. |
| `BIND_MINT` | `#78E0B2` | W-02 Bind/Extract: confirmed bind/extraction/loot eligibility. | Paired bracket or linked chevrons; no use for hostile AoE. |
| `GATE_AMBER` | `#F3B35A` | W-03 Gate Integrity: warning, gate/boss urgency, high-priority boundary. | Heavy segmented contour + notch; protected from rank-4 overlap. |
| `DOMAIN_VIOLET` | `#A889FF` | W-04 Domain: skill family and authored area identity. | Unique geometry family is required; never only a recolor. |
| `ARCHIVE_IVORY` | `#F4F1DD` | W-05 Archive: resolved recap/progression/persistent collection. | Rectilinear seal/page notch; no hostile use. |
| `DAMAGE_RUST` | `#C46A62` | Confirmed health loss only, locally bounded. | Broken chevron plus directional wedge; no full-screen red wash or pulse. |
| `OUTLINE_LIGHT/DARK` | `#F7FBFF` / `#071019` | Adaptive backing outline for meaningful glyphs, bars, and labels. | Required for rank 1–3 assets. |

**Target palette rule:** each rank-1–3 effect has a silhouette or pattern readable in monochrome and an adaptive light/dark outline; color can reinforce but cannot be the sole signal. Bright `ARCHIVE_IVORY` is limited to small resolved detail. `DAMAGE_RUST` may not alternate against black or fill more than a local wedge; no effect component flashes more than three times in any one-second period [E3].

### Readability layering and protected zones

The render stack is ordered, then culled by semantic rank. A lower layer is removed rather than obscuring a higher one.

| Layer | Contents | Priority and protection | Allowed motion |
| --- | --- | --- | --- |
| L0 — terrain | Static world tiles, low-contrast Domain dressing. | Never carries combat state; cache/offscreen when stable. | None or slow decorative drift; removed first. |
| L1 — threat | Active hostile telegraph boundary, incoming player/Gate danger, boss spawn location. | Highest. A 160 dp radius around active rank-1 boundary is protected; no L3/L4 alpha overlap. | Time boundary may progress only from observed simulation state. |
| L2 — command | Confirmed skill origin/path/area, critical glyph, boss phase marker. | Must clip to observed resolved area/path; remains below L1. | Short local movement, never camera movement. |
| L3 — identity | Player/avatar costume accent, selected elite/boss plate, loot/extract marker, progress seal. | One persistent target plate maximum; edge HUD persists separately. | Subtle, nonessential motion only. |
| L4 — texture | Normal impact sparks, residue, ambient motes, optional damage aggregate. | Disposable. It may never cover L1 or communicate required state by itself. | Short local burst only. |
| L5 — HUD/caption | Edge health/Gate/cooldown, compact text/icon, static accessible equivalent. | Above effects but outside the central playfield. | No pulse required for meaning. |

**Target density rules:** rank-4 translucent coverage is at most **18%** of playable viewport at alpha >= 0.15 and at most **8%** inside a rank-1 protected zone; at most **6** L4 emitters and **2** aggregate floating labels may exist within 160 dp of the avatar in any 500 ms window. A rank-1 telegraph preempts every lower rank immediately. These inherit the intent of the existing VFX/HUD feedback packet and remain unmeasured targets.

## Event-to-effect contract

`source event` below is an **implementation proposal** for a read-only normalized presentation adapter, not a claim that every named event exists today. Each request is keyed by `(simTick, entityId, kind, ordinal)` from an immutable observed snapshot/event. Existing confirmed simulation events such as `BOSS_SPAWNED` or `GATE_BREACHED` remain upstream only. Missing, delayed, culled, or failed art resolves to no flourish/static fallback and cannot change rules.

All time values are simulation ticks at 60 Hz; the renderer may interpolate but cannot advance state. `Particle` means one pre-baked sprite quad/draw request, not a physics object. Counts are simultaneous active maxima **per source event** before the global governor.

| Source event / observed state | Effect and visual reading | Rank; anchor; asset brief | **Target** duration / particles / draws | **Target** rate or global cap | Reduced-motion equivalent | Gate link |
| --- | --- | --- | --- | --- | --- | --- |
| `basicDamageConfirmed {source,target,amount}` | `ECHO_CYAN` contact crescent points source→target, then one impact stamp. It confirms automatic fire without damage-number spam. | L4; target world position; `VFX-ATK-01` | 9–14 ticks; <=4 particles; <=2 draws | 1 flourish/target/20 ticks; later hits coalesce into one 30-tick aggregate stamp. | Crescent and static stamp for 12 ticks; no travel, scale, or fragments. | G4 readability; G6 render cost |
| `skillResolved {skillId, origin, affectedShape, presentationFamily}` | Skill has an original W-01/W-02/W-04 geometry family: origin sigil + observed affected boundary/path + resolve mark. `presentationFamily` is authored data mapping only to the three IDs in the skill selection table below. | L2; observed origin/area; `VFX-SKL-01..03` | 24–42 ticks; <=12 particles; <=4 draws | <=2 simultaneous skill emitters globally; cannot intersect L1 boundary. | Static origin sigil, outlined affected area, resolve icon for 30 ticks. | G4 area recognition; G7 core-loop consequence |
| `areaDamageResolved {area, source}` | A **Domain lattice** expands only inside the authoritative resolved area; it is a result marker, not a telegraph. | L2; world area mask; `VFX-AOE-01` | 18–30 ticks; <=10 particles; <=3 draws | One lattice per area/30 ticks; overlaps merge by earliest event ID. | Fixed patterned outline + impact disks at affected positions for 18 ticks. | G4; G6 |
| `criticalDamageConfirmed {target, amount}` | `ECHO_CYAN` + `ARCHIVE_IVORY` angular fracture-ring and compact `CRIT` token; never merely a larger normal hit. | L2; target; `VFX-CRT-01` | 12–18 ticks; <=6 fragments; <=3 draws | 1 flourish/target/20 ticks; extra crits glyph-only. | Static fracture ring + token for 18 ticks. No strobe, hit-stop, shake, or red wash. | G4 clarity; G6 safety capture |
| `enemySpawned {enemyClass, position}` | Common arrival: low-opacity Domain ripple beneath actual spawn; elite adds rank-shape marker. Neither predicts an offscreen spawn. | L3 common / L2 elite; spawn world point; `VFX-ENY-01/02` | common 12 ticks, <=2 particles, <=1 draw; elite 24 ticks, <=6, <=2 | common: <=4 arrivals/30 ticks per screen sector; overflow is a one-sector marker. | Static ripple or rank marker for 12/18 ticks. | G4 threat distinction; G6 density |
| `BOSS_SPAWNED` plus committed spawn position | **Abyssal breach frame:** edge-to-world locator line, silhouette/rank glyph at actual spawn, then persistent boss plate. Existing hazards are never dimmed. | L1 for 72-tick arrival, then L3 plate; `VFX-BOS-01` | 72 ticks: 18 reveal / 36 settle / 18 release; <=8 particles; <=4 draws | Exactly 1 per boss event ID. Existing L4 effects culled within protected zone first. | Static spawn frame + boss glyph/plate; opacity crossfade <=18 ticks only. | G4 arrival comprehension; G6 performance; G7 climax beat |
| `playerHealthChanged` / `GATE_BREACHED` observed decrease | Stable L5 health/Gate fill changes, with **local** `DAMAGE_RUST` directional wedge at player/Gate. A damage source may add a small arrow only when known. | L1 + L5; edge HUD and affected point; `VFX-HLT-01`, `HUD-HLT-01` | wedge 24 ticks; <=1 wedge + <=2 flecks; <=2 draws | one wedge/12 ticks; coalesce damage in the same interval. | Same edge fill, number/icon, and static wedge; no vignette, pulse, heartbeat, or full-screen wash. | G4 survival clarity; G6 snapshot invariance |
| `lootDropConfirmed` / `extractionOpportunityConfirmed` | W-02 paired brackets settle around actual loot/extract world point; `BIND_MINT` dot marks pickup/eligibility, not a new input. | L3; world item/marker; `VFX-LUT-01` | 30–45 ticks settle; <=6 particles; <=2 draws | max 3 concurrent markers; farther/older items use static icon only. | Static paired brackets + item icon until observed state changes. | G4 reward identity; G7 reward event visibility |
| `companionUnlocked` / authorized persistent progression state | W-05 Archive seal stamps into post-run/collection edge surface; character/costume progression is visible as silhouette, trim, and one icon, not combat glow. | L3/L5; post-run or safe edge HUD; `VFX-PRG-01`, `CHR-CST-01..03` | 30 ticks; <=8 paper/mineral flecks; <=3 draws | one presentation per committed progression event; never during active boss warning. | Static Archive seal, companion silhouette, and label; no confetti flight. | G4 progression interpretation; G7 loop payoff |
| `costumeEquipped` from already-authorized local collection state | Persistent **three-value costume read:** base silhouette, 1–2 color accents, and a non-color badge/trim. It is cosmetic and has no rules path. | L3; avatar and collection card; `CHR-CST-01..03` | persistent; 0 runtime particles; <=1 accent draw/avatar | no combat VFX variance by costume; effects retain canonical semantics. | Identical still silhouette/badge. | G4 identity; G6 asset budget |

### Semantic geometry families

| Canon anchor | Geometry family | Valid event families | Prohibited confusion |
| --- | --- | --- | --- |
| W-01 Command Echo | Broken crescent, signal line, compact contact ring. | Basic attack, crit base, orientation. | Never used as health damage or loot. |
| W-02 Bind/Extract | Paired brackets / linked chevrons. | Loot, extraction, eligible reward. | Never marks hostile AoE or a boss attack. |
| W-03 Gate Integrity | Segmented heavy contour with a notch. | Gate health, boss/gate urgency, inbound danger. | Never a decoration or ordinary skill. |
| W-04 Domain | Nested lattice / asymmetric polygon with stable side count per skill family. | Skills, area resolution, stage-local identity. | Never implies collision extent outside observed area. |
| W-05 Archive | Rectilinear seal/page notch and a calm ivory stamp. | Post-run recap, unlock, cosmetic collection. | Never indicates immediate danger or damage. |
### Skill asset selection

| `presentationFamily` | Asset ID | Required geometry | Fallback if unmapped |
| --- | --- | --- | --- |
| `echo` | `VFX-SKL-01` | W-01 broken signal ring | Static Echo sigil; log `unknownSkillFamily`. |
| `bind` | `VFX-SKL-02` | W-02 linked chevrons/brackets | Static Bind brackets; log `unknownSkillFamily`. |
| `domain` | `VFX-SKL-03` | W-04 asymmetric lattice | Static Domain lattice; log `unknownSkillFamily`. |

`presentationFamily` is an authored presentation-only enumeration validated before use. It must not derive from sprite pixels, gameplay-time generator output, or a new rules choice; an unmapped skill receives the static fallback and cannot modify the confirmed action.


## Particle caps and Canvas 2D degradation ladder

### Frame-level budgets

These values are initial engineering/art targets for a **480×270 logical low target** and an **844×390 logical baseline** capture. They are budgets to profile, not current metrics or guarantees.

| Budget | **Target** | Enforcement intent |
| --- | ---: | --- |
| Transient particle sprites, whole viewport | <=96 active | Fixed-size pool; no runtime allocation in the render loop. |
| L1/L2 semantic sprites, whole viewport | <=24 active | Never culled for density; use static fallback if an asset is unavailable. |
| L4 texture sprites within 160 dp of avatar | <=24 active | Cull oldest/lowest priority, then aggregate. |
| Concurrent particle emitters | <=14 total / <=6 L4 near avatar | Emitters are presentation requests, not autonomous simulation systems. |
| Max particle lifetime | 72 ticks (1.2 s) | Most normal bursts are <=18 ticks; no implicit loops. |
| Persistent passive VFX | 0 particle loops | Health/cooldown/progression use stable HUD/static art, not endless motes. |
| Sprite atlas page | <=2048×2048 RGBA page per presentation family | Pre-baked, padded, point/nearest or declared smoothing mode; no gameplay-time fetch. |
| Draw calls for all L4 texture | <=32/frame | Batch atlas draws by blend/mode; semantic layer can spend its separate cap. |
| Runtime blur/shadow | 0 `shadowBlur` in dense combat | Use pre-baked halo; E1 warns against `shadowBlur` where possible. |
| Art scale in `drawImage` | 0 per-frame arbitrary scaling for particles | Pre-bake 1×/2× sizes or choose one declared scale; integer destination coordinates where visual style permits [E1]. |

### Degradation ladder

The renderer chooses a level from measured local renderer pressure only; the choice is presentation-local, logged, and cannot change the simulation. Escalation may happen during a frame, but recovery requires a stable window to avoid flicker. `prefers-reduced-motion` is a user semantic mode, not a performance tier [E2].

| Level | Entry condition (**Target** implementation policy) | Keep | Remove/substitute | Visual invariant |
| --- | --- | --- | --- | --- |
| D0 — authored | Presentation is under its device-specific profiled budget. | Full table budgets and short local travel. | Nothing. | All meanings available. |
| D1 — texture cull | Two consecutive 30-frame windows exceed local presentation budget. | L1/L2/L5, boss/elite plates, static loot marker. | Halve L4 spawn rate; merge normal hits and common arrivals by sector. | Threat, confirmed health loss, skill area, crit identity survive. |
| D2 — sprite LOD | D1 remains over budget for 120 rendered frames. | One key frame per semantic event; L1 geometry; stable HUD. | L4 particles become pre-baked stamps; disable residue/ambient drift; cap L4 at 12 active near avatar. | Location, area, source direction, and event class survive. |
| D3 — semantic static | D2 remains over budget for 300 rendered frames, or reduced motion is enabled. | Static glyph, boundary, icon, text/number, outline. | Translation, rotation, scale punch, fragment bursts, camera movement, and decorative opacity cycling. | Same rank, anchor, timing source, and event identity as D0. |
| D4 — fallback adapter | Canvas presentation error or failed asset/pool initialization. | Snapshot-backed edge HUD, geometric shapes, labels, and rank-1 boundaries. | Atlas particles and nonessential art. | A renderer change cannot alter combat, offers, extraction, or campaign progress [P0]. |

**Implementation notes.** Pre-render repeated stamps/halos on an offscreen canvas or atlas; layer static terrain, combat, and UI rather than re-rasterizing unchanged content; batch by texture/blend state; use `requestAnimationFrame` only for projection scheduling; do not route frame duration into rule time [E1, P0]. The initial G6 evidence must report D-level distribution, cull counts by reason, max active sprites, asset/pool failures, and paired presentation-on/off timings—never infer a PASS from the design budget.

## Generated-asset briefs

These are production briefs, not requests to generate or ship assets. Every output requires human art-direction review, provenance/rights review, export validation, static fallback review, and a local manifest before integration. The generator must not reproduce proprietary title art, logos, characters, or named content.

### Common delivery contract

| Field | Requirement |
| --- | --- |
| Canvas-ready source | Transparent RGBA PNG/WebP atlas plus JSON frame manifest: `assetId`, `frameRect`, `pivot`, `semanticRank`, `eventKind`, `maxLifetimeTicks`, `reducedMotionFrame`, `paletteTokens`, `blendMode`, `sourceRevision`. |
| Dimensions | VFX tiles: 64×64 or 128×128 px, padded by 4 px. Character cells: 96×96 px at 1× source, fixed baseline/pivot; export a declared 2× derivative when needed. |
| Deterministic use | Atlas frame selection derives only from the immutable presentation event ID. Generated art never supplies random timing, hit bounds, or progression facts. |
| Blender-compatible source brief | Orthographic, front/three-quarter locked camera; transparent film; unlit/emission-baked output; no dynamic lighting dependency; separate still frames on a fixed grid; no motion blur, depth-of-field, or shader-only semantic state. E5 merely confirms an Emission shader route; artists choose the approved rendering method. |
| PerfectPixel-compatible source brief | One character description, explicit `pixel` or `retro16` style, **magenta `#FF00FF` background only when a matte workflow requires it**, named state set, fixed frame count/fps, five generated directions plus three permitted horizontal mirrors only where anatomy/costume is symmetric. Review each frame for identity drift, stray pixels, and asymmetry before atlas packing. E6 supports the tool's stated sprite-sheet/action capability; it is not a license or quality guarantee. |
| Accessibility/semantic gate | Rank 1–3 assets need a non-color shape, static frame, and adaptive outline. Rank 4 can be omitted at D1+ with no loss of game meaning. |

### Brief register

| Asset ID | Deliverable and visual brief | Tool-compatible production notes | Acceptance targets / exclusions |
| --- | --- | --- | --- |
| `VFX-ATK-01` | 8-frame `ECHO_CYAN` contact crescent + 4-frame impact stamp, 64×64. Directional origin→target reading; thin broken-line silhouette. | Blender: bake each frame orthographically with unlit/emission look. Canvas: rotate only from source vector. | <=14 tick runtime; <=4 fragments; no weapon mesh, no copied projectile design, no glow that hides telegraphs. |
| `VFX-SKL-01` | W-01 Echo skill: 12-frame broken signal ring, 128×128. | Bake ring + still static key frame; transparent background. | Observed area clips the art; static frame must read as Echo. |
| `VFX-SKL-02` | W-02 Bind skill: 12-frame linked chevrons/brackets, 128×128. | Fixed three-quarter or top-down orthographic projection; no text baked into art. | Must not resemble enemy hostile zone; static paired bracket included. |
| `VFX-SKL-03` | W-04 Domain skill: 12-frame asymmetric lattice, 128×128, stable side count. | Blender frames or hand-authored vector/raster source; atlas has padding. | Must read in grayscale and never exceed authoritative area. |
| `VFX-AOE-01` | 10-frame ground lattice resolve mark, 128×128, alpha decays without flash. | Pre-bake 1×/2×, no runtime `shadowBlur`/scaling. | <=30 tick runtime; no telegraph semantics unless separately authorized. |
| `VFX-CRT-01` | 8-frame fracture ring plus localized `CRIT` token slot, 64×64. | Token is a UI text layer or localized sprite slot, not hard-coded language in particle art. | Static ring must distinguish critical from normal with audio muted; no strobe/shake. |
| `VFX-ENY-01/02` | 6-frame common ripple and 8-frame elite rank-marker, 64×64. | Use neutral Domain Slate with class shape, not a distinct named enemy identity. | Common ripple can be culled; elite marker cannot visually masquerade as boss. |
| `VFX-BOS-01` | 12-frame breach-frame/locator/silhouette marker, 128×128. | Separate locator line, glyph, and boss plate elements for independent culling/layout. | Actual spawn location only; 72-tick max; static spawn frame included; no screen dim/strobe. |
| `VFX-HLT-01` | 6-frame directional damage wedge, 64×64. | Flat local wedge; `DAMAGE_RUST` plus broken-chevron geometry. | <=24 ticks; never full-screen or color-only. |
| `HUD-HLT-01` | Static 32×32 player/Gate health icon pair plus a 1× segmented fill texture; no animated frames. | Raster/vector source with adaptive `OUTLINE_LIGHT/DARK`; no generator-dependent text. | Edge-HUD-only, semantic in D0–D4; icon/pattern distinguishes player from Gate without color alone. |
| `VFX-LUT-01` | 8-frame W-02 loot/extract brackets and 1 static item dot, 64×64. | Treat as world marker, not a pickup button or asset-specific reward art. | Must survive D3 as brackets + icon; max 3 active markers. |
| `VFX-PRG-01` | 10-frame W-05 Archive seal stamp, 128×128; 1 still unlock card icon. | Blender or 2D authored source; bake calm ivory stamp with no flying confetti requirement. | Post-run only; no gameplay-time persistence write. |
| `CHR-CST-01..03` | Character base plus three costume accent variants: silhouette, two palette accents, badge/trim. 96×96 cells; `idle-combat`, `walk`, `hurt`, `victory` states. | PerfectPixel brief uses one canonical silhouette description, explicit state keys, five-direction generation and only approved mirrors; hand review/asymmetry repair required. | Cosmetics never alter effect colors/geometry or combat data. `hurt` uses static readable pose; no mandatory particles. |

## Implementation boundary and measurable hypotheses

### Required presentation metadata

```text
PresentationEffectDefinition {
  assetId, semanticRank, eventKind, eventSchemaVersion,
  anchor: world | hud | worldArea, protectedZonePolicy,
  maxLifetimeTicks, maxParticles, maxDraws, maxInstances,
  paletteTokens, geometryFamily, reducedMotionAssetId,
  degradationPolicy, localizableTokenKey?, sourceRevision
}

PresentationObservation {
  eventId, simTick, entityId, kind, worldPosition?, worldArea?,
  sourceVector?, stateBucket?, immutablePayload
}
```

The adapter validates the observation against the effect definition and emits only presentation commands. A failed schema, unknown asset, exhausted pool, or renderer error produces `suppressed`/`fallback` telemetry and leaves simulation untouched. Art has no callback into targeting, health, Gate integrity, loot, cooldown, damage, persistence, or progression.

| Hypothesis | **Target** measurement and falsifier | Gate relevance |
| --- | --- | --- |
| Semantic priority survives density. | In fixed dense replay captures, **0** L3/L4 alpha-mask intersections with an active L1 protected boundary and **100%** active L1 boundaries have a non-color outline/pattern. Any intersection fails the target. | G4 immersion/readability; G6 capture evidence. |
| Normal, crit, skill area, health loss, and boss arrival remain distinguishable without motion/audio. | First-view static/reduced-motion cards target >=90% normal-vs-critical, >=95% skill-area/boss-location/health-state classification. Participant study is required; color simulation is a prefilter only. | G4; G7 confirms loop consequence reading. |
| Effects remain a bounded Canvas observer. | Same replay with D0–D4/reduced-motion/assets missing targets identical authoritative state/event hashes, damage, movement, cooldown, extraction, offers, and campaign result. Any mismatch is an authority-leak defect. | G6 release/performance and deterministic projection boundary. |
| Generated asset workflow is safe to integrate. | 100% rank 1–3 manifest rows contain static fallback, semantic geometry, source revision, and rights/provenance review record; 0 runtime network fetches or unreviewed generator outputs. | G6 resource/release readiness; G4 content consistency. |
| The loop pays off visibly without adding a control. | In a 90-second vertical-slice capture, every confirmed skill/reward/progression event maps to one non-blocking table row and no effect introduces aim/attack/pickup interaction. Player testing target: >=80% can state the immediate result/reward of a completed loop. | G7 core loop; G4 feedback. |

## Stage handoff

- **Stage 1:** prove one attack, one skill/AoE, one crit, one health-loss cue, one enemy/boss arrival, and one loot/progression seal in a fixed 90-second Cinder Span capture. Author static equivalents before motion. This is a concept slice, not a gate result.
- **Stage 2:** map each added encounter/reward to an existing geometry family and enforce the global governor. A new visual family needs a documented semantic role, not merely a brighter palette.
- **Stage 3:** profile D0–D4 and capture normal/reduced-motion/high-contrast/effects-muted variants at both logical targets. QA measures G4 perception/latency and G6 paired performance/replay invariance; the director alone issues any gate verdict.

## Risks and decisions

| Risk | Decision / guard |
| --- | --- |
| More particles make auto-combat look responsive but hide threats. | L4 is disposable; cull/aggregate it before L1–L3. Coverage/protected-zone tests make the decision measurable. |
| A reduced-motion mode merely removes information. | Static shapes/icons/text are authored first for every rank 1–3 effect, with identical anchor and observed-state semantics. |
| A generated costume introduces inconsistent silhouettes or copied imagery. | Use a canonical brief, local provenance review, and human frame review; reject identity drift/proprietary resemblance. Generated art never becomes a rule input. |
| Canvas pressure becomes device-dependent visual advantage. | D-level changes texture only. The same observed semantic event maps to the same static rank/anchor at every level; replay invariance test is release-blocking. |
| Health damage or critical effect uses unsafe red flashing. | `DAMAGE_RUST` is local and shape-backed; no full-screen red, pulse, or more-than-three-flash component in any one second [E3]. |

## Decision

Build spectacle as a finite, semantic observer: **threat and survival first, confirmed command result second, identity/reward third, texture last**. The production baseline is static, high-contrast, asset-manifested meaning; particles and motion only enrich that baseline within pooled Canvas budgets. This preserves G4’s eventual immersion test, provides measurable G6 performance/resource evidence, and makes the G7 core-loop reward visible without adding a control or weakening deterministic authority.
