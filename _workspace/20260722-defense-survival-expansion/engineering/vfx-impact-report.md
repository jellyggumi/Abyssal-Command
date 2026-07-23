# VFX impact report — snapshot-only Canvas 2.5D pass

**Date:** 2026-07-22  
**Public beat:** playable ten-stage defense-survival candidate  
**Gate posture:** G4 remains **FIX**. This pass implements and smoke-checks renderer behavior; it does not replace the required five-scene human panel, feedback-latency measurement, or currently failing gameplay-path evidence.

## Boundary

`battle-realtime-three.js` remains a passive observer. It accepts detached snapshots, derives motion from `snapshot.tick`, and never writes to the snapshot, queues input, advances the 60 Hz simulation, decides an outcome, or touches campaign storage. Its bounded effect records are presentation-only: 24 slots allocated in the constructor, reset on tick rewind, and populated only by events stamped with the currently rendered tick.

The authoritative loop is **Gate defense → Echo recovery → growth → occupation/extraction → boss kill**. The renderer now makes every currently exposed step more legible, but it cannot author or enforce the loop.

## Before → after design evidence

| surface | before | after | reduced-motion semantic fallback |
|---|---|---|---|
| Stage intro / field | Per-frame linear gradient, flat gate arc, no camera language. | Size-cached depth gradient, deterministic commander parallax, map lanes, and a two-second tick-derived camera settle. The cutscene card uses one non-strobing settle and signal pass. | Camera offset, parallax drift, CSS settle, and signal travel are zeroed; static map, border, title, copy, and skip control remain. |
| Tactical stage layout / objective route | Renderer had no stage-layout vocabulary and could not distinguish choke, flank, elevation, hazard, occupation, or extraction geometry. | Snapshot schema v4 raw ARENA coordinates now drive stage-distinct choke corridors, flank routes, elevation/range rings, hazard zones, occupation→extraction linkage, progress/ownership/contested states, and locked/available/completed extraction states. Enemy route, spawn-direction, and policy marks remain subordinate to actor silhouettes. | The same labels, progress rings, ownership colors, route lines, and policy marks remain static; hazard pulse and actor frame motion are disabled. |
| Echo / XP recovery (W-01) | Green pickup circles with no destination or collection reading. | XP motes retain a teal tether to the Dusk Warden; item drops use a distinct gold diamond and ring. | Static mote/icon and tether remain; bob and opacity modulation are removed. |
| Occupation / elite extraction (W-02) | No Canvas extraction anticipation or confirmation. | An available candidate shows three deterministic countdown rings, seal, and `EXTRACT`; `ELITE_EXTRACTED` plays anticipation → seal impact → ring recovery with `ECHO BOUND`. | Three separated static rings, seal, and labels remain; ring contraction is removed. |
| Domain cast (W-04) | No cast impact treatment. | `SKILL_CAST` produces a bounded command ring, orthogonal command lines, and `DOMAIN`, with its envelope derived from event tick. | Static ring, command lines, and `DOMAIN` remain; pulse and camera response are removed. |
| Boss arrival / victory / reward (W-05) | Boss reused the enemy sprite and victory relied on DOM copy alone. | Bosses gain silhouette hierarchy, crown/ring arrival, HP strip, deterministic depth scale, and a victory map-line reconnection with `LINE RESTORED`; selected rewards resolve as `ARCHIVED`. | Static crown/ring, HP strip, reconnected line, and labels remain; shake and expanding rings are removed. |
| Hits / gate danger (W-03) | Projectiles were stationary circles; gate state used one cyan arc. | Projectiles now show anticipation at source, tick/TTL-derived travel, crosshair impact, and recovery ring. `GATE_BREACHED` adds deterministic decaying impact, while integrity ≤50% retains red arc/ring plus `GATE DANGER`. | No shake or danger pulse; red geometry and `GATE HIT` / `GATE DANGER` labels remain. |
| Textured actors | Every actor shared one global frame; untextured fallback was one flat circle. | Frame choice is deterministic from tick and actor position. Motion adds low-amplitude bob/lean, depth scale, ground shadow, facing, elite/boss outlines, and boss health. Fallback glyphs retain inner silhouette and hierarchy. | Bob, lean, facing motion, and depth drift are static; texture/glyph identity, shadow, outline, and health remain. |

The effect grammar is consistent: **anticipation** establishes source/ring, **impact** adds the strongest cross/seal/connection, and **recovery** decays geometry by snapshot ticks rather than wall-clock time. There is no strobe path.

## Determinism and allocation evidence

- Renderer motion uses only finite snapshot values, event tick, projectile TTL, and fixed trigonometric phase. It contains no `requestAnimationFrame`, listener, input, campaign, or outcome authority.
- Background paint is cached by Canvas dimensions; it is not recreated each frame.
- The eight authored images use a module-level source cache and are prewarmed at mount. Per-actor rendering performs cache lookup only; it does not construct `Image`, bitmap, gradient, path cache, or effect objects per frame.
- Effect capacity is fixed at construction. Re-rendering one snapshot tick does not re-enqueue its events, persistent event histories cannot replay old events, and tick rewind clears presentation records.
- Actor and effect traversal uses indexed loops over snapshot arrays. Compatibility boss shapes are identity/ID deduplicated without a per-frame `Set`.
- Tactical rendering reads existing `stageLayout`, `objectiveProgress`, and actor route/policy arrays in place. It creates no per-frame collection, geometry cache, image, or gradient; route work is capped at the next two waypoints per enemy.
- `dispose()` is idempotent, clears Canvas references and cached paint, and leaves the shared immutable image cache bounded to the eight authored sources.

Async image readiness may switch a glyph fallback to its authored texture after decoding; this is an optional presentation-resource transition and cannot change simulation state, positions, targeting, timing, or outcomes.

## Five-scene recorder spot check

An in-memory Canvas recorder rendered the presentation-spec snapshots in normal and `reducedMotion: true` modes:

- Stage intro normal translation was `(0, -19.8)` at tick 0; reduced-motion translation was `(0, 0)`.
- Elite extraction retained `ECHO BOUND` in both modes.
- Domain cast retained `DOMAIN` in both modes.
- Boss victory retained `LINE RESTORED` in both modes.
- XP recovery rendered the mote-to-Warden path in both modes; its normal bob is absent in reduced motion.
- Snapshot v4 tactical recorder retained `CHOKE`, `FLANK`, `RANGE`, `HAZARD`, `CONTESTED`, `EXTRACT`, and `GATE DANGER` in reduced motion; camera translation remained `(0, 0)`.
- Changing only the supplied layout moved `CHOKE` from `(505, 102.5)` to `(371.6667, 126.5)`, confirming that stage identity comes from snapshot geometry rather than a renderer-authored map.

This is a renderer branch spot check, not a human immersion score and not proof that the current simulation reaches all five scenes.

## Narrow smoke receipt

- `node --check battle-realtime-three.js` — exit 0, no syntax diagnostics.
- `node --test tests/defense-renderer-contract.test.mjs` — **3 tests passed, 0 failed**: passive API surface, mocked Canvas projection, and no loop/input/campaign/outcome ownership.
- `node tests/defense-survivor-browser.cjs` — `{ "pass": true }`; lobby and battle visible, movement accepted during and after cutscene, cutscene dismissed, touch movement accepted, growth selected (`soul-lance`), and `errors: []`.
- Independent read-only renderer re-review after fixes — **PASS, 0 blocking findings**. It specifically rechecked duplicate bosses, Canvas stroke state, event replay, reduced-motion extraction rings, and CSS reduced-motion behavior.
- Focused frozen-snapshot Canvas recorder — **pass**: 22 finite arcs and 60 route/intent lines across two reduced-motion renders; all seven tactical labels present; module image count remained exactly 8; actor texture remained `echo-rusher-frame-00.png` at ticks 240 and 247; no snapshot mutation exception.
- Independent tactical correction review — **PASS, 0 blocker findings** after checking stable reduced-motion frame, next-two-waypoint bounds, spawn direction without policy ID, and finite occupation progress.

## Snapshot v4 tactical follow-up and remaining boundaries

The prior terrain/objective dependency is resolved in the presentation lane: snapshot schema v4 now exposes `stageLayout`, `objectives`, `objectiveProgress`, and actor `policyId` / `spawnDirection` / `route`, and the renderer consumes those fields directly without adding a second authority.

| snapshot evidence | passive presentation |
|---|---|
| `chokepath.x` / `halfWidth` | bounded corridor into the Gate |
| flank entry | alternate route and entry seal |
| elevation multiplier | position plus proportional range ring |
| hazard center / radius | danger fill, boundary, and cross-lines |
| occupation hold / captured / local enemy presence | progress, `OCCUPY`, `CONTESTED`, or `OCCUPIED` |
| extraction hold / window / completed / failed | locked, available, progress, success, or failure state |
| enemy route / waypoint index | at most the next two tactical segments |
| spawn direction / policy | restrained source tail plus distinct intent glyph |

No tactical mark changes movement, range, recovery, policy selection, progress, ownership, extraction validity, or outcome. Missing/legacy layout fields simply omit tactical decoration while preserving the existing actor/gate fallback.

Current→upgraded numeric stat and synergy comparisons are still not renderer-owned: they require authored values and HUD/app copy, not inferred Canvas state. G2, G4, G6, and release readiness remain governed by QA measurements and are not cleared by this renderer receipt.