# Stage 2→3 QA benchmark notes

**Run:** `20260718-strategy-control-depth`  
**Operating mode:** Stage 2 balance-cycle discovery entering Stage 3 responsiveness/performance  
**Evidence state:** research and proposed gates only; no simulator, test, browser, profiler, or play session was run for this artifact.

## Scope and evidence rules

These notes calibrate larger tactical maps, deeper strategy balance, fast/error-free control, renderer parity, and measurable responsiveness. They do not authorize production or test changes. Every statement below is labeled either **Observed** (read directly from repository/source) or **Recommended** (an unmeasured QA gate). A recommendation is not a pass verdict.

## Repository facts observed by inspection

| Area | Observed fact | Evidence | QA implication |
|---|---|---|---|
| Rules | `RULES_VERSION` is `abyssal-surge-rules-v6`; `STAGES` contains ten stage definitions. | `campaign-state.js:1`, `campaign-state.js:31-514` | Future balance evidence must stamp rules v6 and report all ten stages. |
| Campaign authority | Campaign transitions, encounter events, rewards, retry, save/restore, and campaign benefits are imported from `campaign-state.js` by the simulator. | `scripts/run-campaign-balance-sim.mjs:7-21` | Live rendering and input probes must compare authoritative state/trace, not presentation objects. |
| Existing simulator limit | The deterministic simulator uses 200 casual trials, 1,000 fuzz sequences × 150 operations, and explicitly does **not** measure player time, fairness, or live-session behavior. | `scripts/run-campaign-balance-sim.mjs:25-30` | It is suitable for deterministic rule invariants, but cannot substantiate TTK, latency, frame time, pathing, camera, or touch claims without a separate probe. |
| Shared v6 simulator baseline | A separately produced v6 summary reports: deterministic rusher 0% (defeat at Echo Throne, 20 actions), comeback 0% (defeat at Howling Sprawl, 47), greedy economy 100%/116 actions, optimal 100%/103; seeded casual 40% over 200 runs, with 78 Echo Throne, 19 Sunken Bastion, 17 Howling Sprawl, and 6 other defeats; 150,000 fuzz operations produced 0 findings; branch fractions span 0.6923–0.8537; the summary is byte-identical over its internal double run. | `/tmp/abyssal-balance-v6.json:17-411,1321-1367,1434` (shared by the studio director after this QA lane was instructed not to execute the simulator) | This is valid reducer/arithmetic baseline evidence. It is **not** human fairness, live TTK, pathing, latency, camera, touch, frame-time, or player-skill evidence. The 0/100% deterministic policy split and casual 40% make Stage 2 balance calibration a priority, but do not alone prove a defect. |
| Tactical grid | Shared navigation is 16×8. The current 3D enemy spawn lanes are `[3,4,5]`. | `stage-navigation.js:4-5`; `battle-realtime-three.js:30-36` | Larger-map proposals require an explicit migration contract and ≥3 materially distinct traversable routes/zones per stage. |
| Movement | Commander speed is 4.1 world units/s and Shift surge is 7.2; enemy advance is 2.4. Movement multiplies by `dt`. | `battle-realtime-three.js:35`, `battle-realtime-three.js:1005-1038` | Distance travel is nominally time-scaled; collision/path completion still needs matched-wall-time testing at multiple frame rates. |
| Frame delta | `frame()` clamps elapsed time to 0.05 s, resets `lastTime` on visibility resume, and clears held input when hidden. | `battle-realtime-three.js:731-748`, `battle-realtime-three.js:1616-1626` | Resume avoids one giant frame, but direct-update/extreme-delta behavior and long-frame collision safety remain unmeasured. |
| Camera | Camera target smoothing uses fixed per-frame `lerp(..., 0.12)` even though `dt` is passed. | `battle-realtime-three.js:1157-1177` | **Known frame-rate-dependence risk:** equal wall time at 30/60/120 Hz does not produce equal camera convergence. No runtime measurement has been run. |
| Focus loss | Canvas blur, window blur, and hidden-document visibility clear held keyboard state; existing unit coverage preserves click-to-move order. | `battle-realtime-three.js:505-519`, `battle-realtime-three.js:1190-1205`; `tests/battle-realtime-three.test.mjs:296-367` | Keep this invariant while adding touch/pointer cancellation and larger-map pathing. Existing test was inspected, not run. |
| 3D pointer intent | 3D treats Manhattan pointer displacement >3 CSS px as drag/orbit; an unmoved primary click requests a personal action and secondary click rallies allies. | `battle-realtime-three.js:1207-1235` | Jitter, mixed pointer types, second contact, and parity with fallback require adversarial coverage. |
| Canvas pointer intent | Canvas fallback treats `dx > 6 || dy > 6` CSS px as box-select; otherwise a click may request a tactical action or issue a move order. It handles `pointercancel`. | `battle-visualizer.js:808-864` | Identical gestures can classify differently between renderers. This is an observed contract mismatch, not a measured player defect. |
| Existing path tests | Current tests inspect shared chasm rejection, elevation, legal-target preservation, and static/live collider contact. | `tests/battle-realtime-three.test.mjs:547-660` | Those tests do not establish end-to-end path completion, detour quality, route diversity, or large-map scaling. Tests were not run. |
| Resource bound | Particle pool capacity is fixed at 360 and an existing test checks recycling. | `tests/battle-realtime-three.test.mjs:945-963` | Useful invariant, but not proof against listener, mixer, geometry, RAF, audio, or heap growth in a one-hour session. |

## Comparable-game calibration

The external sources are qualitative calibration; none supplies a transferable Abyssal Surge numeric balance target. The numeric gates in the next section are internal recommendations and must be measured in this game.

| Comparable | Primary/official evidence | QA lesson applied here |
|---|---|---|
| **Age of Empires IV** | Official Update 11.0.782 describes input/selection corrections and a clarified default attack-move behavior: [Age of Empires IV Update 11.0.782](https://www.ageofempires.com/news/age-of-empires-iv-update-11-0-782/). | Command intent must be deterministic at ambiguous targets; selection/hotkey regressions are release-grade failures, not cosmetic issues. Probe click/drag thresholds and modifier release explicitly. |
| **StarCraft II** | Official 5.0.16b hotfix adjusts unit selection subgroup priority and “select all” classification: [StarCraft II 5.0.16b Hotfix Patch Notes](https://news.blizzard.com/en-us/article/24291949/starcraft-ii-5-0-16b-hotfix-patch-notes). | Selection priority and command routing are balance-affecting. One renderer/input must not select or command a materially different set than another. |
| **Company of Heroes 3** | Official Update 1.6.5 states that input processing was changed to reduce input latency and pairs responsiveness work with map-preference/strategy-diversity changes: [Company of Heroes 3 Update 1.6.5](https://store.steampowered.com/news/app/1677280/view/4213757028415519094). | Responsiveness and map strategy must be gated together: a “deeper” map that makes commands feel late is not ready. Measure event-to-visible-feedback, not only reducer completion. |
| **Northgard** | Official game site presents a territory/zone-driven real-time strategy structure: [Northgard](https://northgard.net/). | Spatial depth can come from meaningful zones and constrained adjacency rather than raw area. Each stage therefore needs ≥3 materially distinct lanes/zones with different risk or function. |
| **Warcraft Rumble** | Official site identifies a mobile-first action strategy game with PvE and PvP play: [Warcraft Rumble](https://warcraftrumble.blizzard.com/en-us/). | Touch is a first-class command surface. Touch parity must compare authoritative accepted/rejected actions, not merely whether tapping “works.” |
| **Bad North** | Official game site positions the title as real-time tactics and supports its mobile presentation: [Bad North](https://www.badnorth.com/). | Compact tactical spaces still demand unambiguous tap/drag intent and readable route choices. Larger maps should add decisions, not dead traversal. |
| **Iron Marines** | Official product page calls it a fast-action casual RTS centered on defending bases and deploying forces: [Iron Marines](https://www.ironhidegames.com/Games/iron-marines). | Fast mobile RTS control favors short, visible command acknowledgement and reliable automated traversal. Measure both feedback latency and stuck-path recovery. |

### Web platform calibration

- **Observed external guidance:** The RAIL model asks the application to acknowledge user input within 100 ms: [web.dev — Measure performance with the RAIL model](https://web.dev/articles/rail).
- **Observed external guidance:** `requestAnimationFrame` frequency commonly varies (60, 75, 120, 144 Hz), and animation progress should use the callback timestamp to avoid refresh-rate-dependent behavior: [MDN — `requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame).
- **Observed external behavior:** `pointercancel` may occur on app switching, orientation changes, panning/zooming, or palm rejection: [MDN — `pointercancel`](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event).
- **Observed external behavior:** tab/window visibility changes are signaled and background animation callbacks are normally paused: [MDN — Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API).

## Five player archetypes

| ID | Archetype | Primary behavior | Balance/control risk it is meant to expose | Viability sample |
|---|---|---|---|---|
| A1 | **Anchor Sentinel** | Builds a dense defense at one ingress and waits for enemies. | Lane camping, single-choke dominance, passive wins, stalled enemy paths. | 200 seeded stage trials, fixed legal camp location, no manual reposition after first wave. |
| A2 | **Tempo Raider** | Assaults as soon as minimum legal prerequisites are met, accepting a thin legion. | Thin-legion rush, cooldown sequencing, short TTK dominance, click pressure. | 200 paired seeds versus a capacity-building line on every stage. |
| A3 | **Veil Economist** | Maximizes extraction/reward compounding before assault. | Reward snowball, runaway campaign benefits, slow but inevitable wins. | 200 paired ten-stage campaigns using highest projected campaign-EV reward versus median-EV reward. |
| A4 | **Micro Dispatcher** | Rapidly selects, drags, rallies, attacks, and changes direction across lanes. | Click-spam duplication, drag/click ambiguity, focus loss, stuck pathing, camera lag. | Scripted 10-minute mixed-input burst plus matched 30/60/120 Hz movement/camera traces. |
| A5 | **Field Survivor** | Plays on touch/mobile or fallback renderer, backgrounds/resumes, and continues for long sessions. | Touch divergence, pointer cancellation, offline/Canvas drift, resource leaks, extreme delta-time. | 60-minute session on WebGL2 and Canvas fallback at desktop/mobile viewports, including 20 hide/resume cycles. |

**Recommended G3 gate:** all five archetypes are exercised; at least three strategically distinct archetypes (A1–A3) must each land in the 45–55% target band on the calibrated challenge set, no pair differs by >10 percentage points, and A4/A5 must produce the same authoritative action outcome as their baseline controls. This is unmeasured.

## Proposed numeric pass/fail bands

| Metric | Recommended PASS | FAIL / blocker | Future measurement contract | Status |
|---|---|---|---|---|
| **Win rate** | Each strategic archetype A1–A3: 45–55% over ≥200 deterministic, paired seeds per challenge; 95% Wilson interval must intersect the band; max archetype gap ≤10 pp. | Point estimate <45% or >55%, or gap >10 pp. | Record rules version, stage, seed, action/reward policy, wins, losses, Wilson interval. Existing simulator may supply reducer outcomes only after scenario policies are added. | NOT MEASURED |
| **TTK** | Standard wave median 20–30 s; boss median 35–50 s; every archetype median within ±15% of the stage-approved target; p90 ≤1.5× median. | Outside target band, >15% archetype drift, or p90 tail >1.5× median. | Live deterministic clock from first enemy targetable frame to authoritative wave/boss defeat; separate hit-stop visual time from reducer event time. | NOT MEASURED |
| **Command-to-visible-feedback latency** | p50 ≤50 ms, p95 ≤100 ms, max ≤200 ms; 0 accepted actions without acknowledgement; 0 rejected actions showing success feedback. | p95 >100 ms, any missing/false acknowledgement, or max >200 ms. | Timestamp normalized input event, authoritative accept/reject result, and first visible cue in the same trace. ≥500 commands per renderer/input/device profile. | NOT MEASURED |
| **Path completion** | ≥99% of legal origin→destination trials complete; 0.0% enter unwalkable cells; no progress stall >500 ms while a route exists; duration ≤1.25× ideal travel time +250 ms. | <99%, any chasm/collider penetration, >500 ms unexplained stall, or duration over bound. | Exhaustive legal cell pairs where feasible; otherwise ≥1,000 stratified pairs/stage across all lanes, dynamic blockers, 30/60/120 Hz. | NOT MEASURED |
| **Camera convergence** | After a step target, residual error ≤5% of initial error by 500 ms at 30/60/120 Hz; matched-wall-time residual differs ≤2 percentage points across refresh rates; no overshoot >2%. | Any refresh rate misses 500 ms, cross-rate drift >2 pp, or overshoot >2%. | Record target and camera vectors every frame against wall-clock timestamps. Current fixed 0.12/frame lerp is expected to fail cross-rate equivalence; this expectation is an inference, not a run result. | NOT MEASURED |
| **Frame time** | Desktop WebGL2 p95 ≤16.7 ms and p99 ≤33.3 ms; representative mobile p95 ≤33.3 ms; Canvas fallback p95 ≤16.7 ms; no task/frame >100 ms during input; ≥99% frames remain under profile budget. | Any p95/p99 breach, >100 ms input-adjacent frame, or sustained degradation >10% from minute 5 to minute 60. | Browser Performance trace and in-game frame histogram; warm-up 5 min, sample 10 min active combat and a 60-min soak; report device/browser/DPR/map/unit count. | NOT MEASURED |

## Tactical-map depth gate

**Recommended PASS definition for every stage:**

1. The navigation graph exposes at least **three materially distinct** start-to-objective lanes or zones.
2. “Materially distinct” means each lane differs from each other lane on at least **two** of: path length by ≥15%, cover/elevation count by ≥2 cells, resource/objective access by ≥1 node, or hazard/exposure time by ≥20%.
3. Removing any one lane leaves at least two legal routes; no single camp footprint can intercept >60% of standardized wave traffic without repositioning.
4. Across 200 standardized trials, each lane carries ≥15% of successful routes and no lane exceeds 70% absent an explicit stage mechanic.
5. Route labels, cell counts, path length, elevation/hazard counts, and reachability are exported with the evidence. A painted visual lane that is not mechanically distinct does not count.

No current stage has been scored against this definition.

## Stage decision

This artifact does **not** issue a PASS/FIX/REDO verdict. The camera’s fixed-per-frame smoothing and renderer gesture-threshold mismatch are concrete inspection findings that must be probed before Stage 3. All numeric outcomes remain `NOT MEASURED` until the future commands in `test-plan.md` are implemented and run.