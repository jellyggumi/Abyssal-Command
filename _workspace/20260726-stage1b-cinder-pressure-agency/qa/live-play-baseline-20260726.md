# Live Play Baseline — 2026-07-26

## Scope and evidence rules

- **Build exercised:** the repository root served with `Cache-Control: no-store` at a disposable loopback origin; no production code or tests were changed.
- **Desktop viewport:** 1440 × 900 CSS px, DPR 1.
- **Portrait viewport:** 390 × 844 CSS px, DPR 1.
- **Session hygiene — desktop:** before verification, Chromium reported 1 service-worker registration and the cache `abyssal-command-defense-survivor-__CANDIDATE_SHA__`; both were removed. A final clean desktop run again removed 1 registration and that cache, then observed 0 registrations / 0 cache keys.
- **Session hygiene — portrait:** the same registration/cache were removed. Registration raced once with app startup, so cleanup was repeated after 500 ms; the verified final state was 0 registrations / 0 cache keys before the run.
- **Interaction method:** real Chromium keyboard, mouse pointer down/hold/up, pointer drag, and CDP touch/pinch input. A second portrait run used a deterministic `requestAnimationFrame` clock (100 ms per pump) so the live production simulation could be operated through growth and extraction without wall-clock/browser-render variance. All choices and actions were clicked through the rendered production UI.
- **Visual evidence:** transient browser screenshots were inspected at the lobby, battle start, portrait battle, growth offer, post-orbit, and post-pinch states. No extra repository image files were created.
- Labels below use **OBSERVED** for browser evidence, **INFERENCE** only for interpretation, and **TARGET** for a recommended acceptance state.

## Exact player journey

### Desktop — real-time run

| Wall time (UTC) / game time | Journey evidence |
|---|---|
| 2026-07-26T08:51:04.928Z / `시간 0초 · Lv.1` | **OBSERVED:** clicked `#start-defense`; `#defense-battle-surface[data-defense-ready=true]` mounted with WebGL, objective `gate-defense`, extraction `pending`, and `STAGE_STARTED` cutscene. |
| Game time 5–6 s | **OBSERVED:** the battle continued beneath the stage-entry copy. HUD showed pressure 159–160 s, gate dropping from 1000 to 976, commander dropping from 1000 to 964, 31 enemies, 1 kill. The cutscene still covered the upper battle strip at the first visual capture. |
| 2026-07-26T08:51:39.598Z | **OBSERVED:** by the next control check the unattended run was already `전투 종료`; ArrowRight could no longer change `data-defense-input-seq` or `data-defense-move`. This path did not reach growth or extraction. |
| 2026-07-26T08:55:16.927Z / game time 0 s | **OBSERVED:** started a clean second desktop run; WebGL mounted and the cutscene auto-cleared before the first movement sample. |
| 08:55:25.266Z–08:55:26.041Z / game time 0 s | **OBSERVED:** held ArrowRight for 650 ms. Input changed `seq 0 → 1`, `IDLE → E`; release changed `seq 1 → 2`, `E → IDLE`. |
| 08:55:42.951Z–08:55:43.066Z / game time 0 s | **OBSERVED:** held the on-screen north D-pad button for 750 ms. Input changed `seq 2 → 3`, `IDLE → N`; release changed `seq 3 → 4`, `N → IDLE`. |
| Same run | **OBSERVED:** a 317 px diagonal canvas drag visibly rotated the battlefield from an axis-aligned bridge/platform view to a diagonal view. Input sequence and movement remained unchanged, confirming canvas drag affected the camera rather than movement. |
| Same run | **OBSERVED:** the second desktop simulation clock became stuck at `시간 0초 · Lv.1` even while `performance.now()` advanced by 2,009 ms, the document was visible, no growth/cutscene existed, and no page/console error appeared. Stance commands incremented input sequence but were not applied while the clock was stuck. This anomalous path was abandoned rather than treated as stance evidence. |
| Final desktop error check / game time 3 s | **OBSERVED:** a third clean desktop page mounted WebGL and remained active; 0 page errors and 0 console errors were collected. |

### Portrait — real-time baseline and controlled completion

| Wall time (UTC) / game time | Journey evidence |
|---|---|
| Lobby | **OBSERVED:** 390 × 844 viewport; document height 2,321 px with no horizontal overflow. `#start-defense` was visible at y=456–500. The five command tabs were 44 px high. |
| 2026-07-26T09:00:04.623Z / game time 2 s | **OBSERVED:** started the real-time portrait run; WebGL mounted with stage cutscene, objective `gate-defense`, extraction `pending`. |
| Game time 11 s | **OBSERVED:** gate was 500/1000 and commander 492/1000; HUD reported 20 enemies and 4 kills. The next observation was `전투 종료`, so growth and extraction were unreachable on this unattended real-time baseline. |
| 2026-07-26T09:00:58.879Z / controlled game time 0 s | **OBSERVED:** started a new portrait run with deterministic 100 ms frame pumping after final service-worker/cache cleanup. |
| Game time 0.0–0.6 s | **OBSERVED:** held keyboard `D`; `seq 0 → 1`, `IDLE → E`; release produced `seq 2`, `IDLE`. |
| Game time 0.6–1.2 s | **OBSERVED:** held the north D-pad by pointer; `seq 2 → 3`, `IDLE → N`; release produced `seq 4`, `IDLE`; status reached game time 1 s. |
| Game time 1 s | **OBSERVED:** clicked stance. ARIA changed from `편성 스탠스: 전열` to `편성 스탠스: 포대 (전환까지 4초)`, input `seq 4 → 5`, and the button acquired `is-switched`. |
| Game time 13 s | **OBSERVED:** no growth offer yet. |
| Game time 28 s | **OBSERVED:** no growth offer; HUD was still `성장 Lv.1 · XP 174` and objective had advanced to `echo-recovery`. |
| Game time ≈34 s | **OBSERVED:** growth finally appeared, paused combat, and simultaneously exposed `Bind 대기 · Ember Cohort`. Initial choices were Echo Bolt (`rift-bolt`), Echo Magnet (`soul-magnet`), and Echo Pulse (`grave-pulse`). |
| Growth pause | **OBSERVED:** selected Echo Bolt. `data-defense-skill` became `rift-bolt`; a new three-choice offer appeared immediately. Selected Zenith Binder and then Echo Lance; queued growth closed at `Lv.4`, `XP 36`, and active skill `soul-lance`. |
| Game time 33 s | **OBSERVED:** clicked enabled `Bind 시작 · Ember Cohort`; prompt became `결속 홀드 0/2초`, button became disabled / `aria-disabled=true`. |
| Game time 33–36 s | **OBSERVED:** prompt stayed at `0/2초` through 2.5 seconds of measured game time. |
| Game time 39 s | **OBSERVED:** extraction became `ready`; prompt changed to `추출 가능 · Ember Cohort` and enabled `정예 추출`. |
| Game time 40 s | **OBSERVED:** clicked extraction; state became `extracted`, prompt/button disappeared, and objective advanced to `boss-kill`. |
| Game time 40 s | **OBSERVED:** dragged canvas from (195,422) to (304,287). Input remained `seq 10`, `IDLE`, while the rendered battlefield view changed; orbit did not queue movement. |
| Game time 40 s | **OBSERVED:** exercised pinch zoom twice: raw two-touch distance 70→200 px and Chromium `synthesizePinchGesture(scaleFactor=1.8)`. Page zoom stayed 1.0, input remained `seq 10`/`IDLE`, and no visible battlefield-scale change was discernible in before/after captures. Zoom was exercised but its game-camera effect was **not proven**. |

## Action/effect matrix

| Viewport | Action | Measured effect | Result |
|---|---|---|---|
| Desktop | Click `#start-defense` | Lobby → WebGL battle; `gate-defense`, extraction `pending`, game time 0 s | **OBSERVED — success** |
| Desktop | Hold ArrowRight 650 ms | `seq 0→1`, move `IDLE→E`; key-up `seq 2`, `IDLE` | **OBSERVED — success** |
| Desktop | Hold north D-pad 750 ms | `seq 2→3`, move `IDLE→N`; pointer-up `seq 4`, `IDLE` | **OBSERVED — success** |
| Desktop | Canvas diagonal pointer drag | Battlefield visibly rotated; movement/input sequence unchanged | **OBSERVED — orbit success** |
| Desktop | Stance click after clock anomaly | Command input sequence advanced, but stance remained `전열` while game clock was stuck at 0 s | **OBSERVED — blocked on anomalous run** |
| Portrait | Click `#start-defense` | Lobby → WebGL battle at 390×844 | **OBSERVED — success** |
| Portrait | Hold keyboard `D` | `seq 0→1`, `IDLE→E`; release `seq 2`, `IDLE` | **OBSERVED — success** |
| Portrait | Hold north D-pad | `seq 2→3`, `IDLE→N`; release `seq 4`, `IDLE` | **OBSERVED — success** |
| Portrait | Click stance | `전열→포대`, 4 s cooldown label, `is-switched`, `seq 4→5` | **OBSERVED — success** |
| Portrait | Select Echo Bolt | `data-defense-skill="rift-bolt"`; immediate next growth offer | **OBSERVED — success** |
| Portrait | Select two queued skills | Growth closed at Lv.4; active skill `soul-lance` | **OBSERVED — success** |
| Portrait | Click Bind start | `Bind 대기→결속 홀드 0/2초`; action disabled | **OBSERVED — success** |
| Portrait | Wait/pump extraction route | Ready at game time 39 s, roughly 6 s after bind start | **OBSERVED — success, feedback mismatch** |
| Portrait | Click Extract | `extraction=extracted`; objective `boss-kill` at game time 40 s | **OBSERVED — success** |
| Portrait | Canvas diagonal drag | View changed; `seq 10`, `IDLE` unchanged | **OBSERVED — orbit success** |
| Portrait | Two-touch pinch + synthesized pinch | No input/movement side effect, but no discernible battlefield zoom | **OBSERVED — effect not proven** |

## UI geometry and collisions

- **OBSERVED:** desktop battle surface fit 1440 × 900 with no document overflow. D-pad occupied x=722–962, y=850–894; battle actions occupied x=1318–1434, y=850–894.
- **OBSERVED:** portrait D-pad occupied x=175–316, y=745–838; battle actions occupied x=321–384, y=741–838. These did not geometrically overlap, but together with the commander panel they consumed nearly the entire bottom band.
- **OBSERVED:** portrait combat feedback was at x=0, y=0, size 121×18 while the left HUD card began at x≈6, y≈6. The critical message was visibly clipped behind the HUD.
- **OBSERVED:** portrait growth container reported x=31, y=8, w=328, h=110, but its three buttons extended to y=209. The visible offer overflowed its own container and overlaid the underlying top HUD; the growth heading appeared duplicated/stacked.
- **OBSERVED:** portrait extract action was only 63×77 at x=321, y=761 and wrapped `Bind 시작 · Ember Cohort` into many short lines. The world capture prompt also rendered as a narrow vertical strip.

## UX findings

Severity: **S1** blocks core comprehension/interaction, **S2** materially harms the run, **S3** polish/readability issue.

| ID | Severity | Finding | Evidence / reachability |
|---|---:|---|---|
| LP-01 | **S1** | Lobby instruction says to drag in the central battlefield to move, but live canvas drag orbits the camera; movement is actually keyboard/D-pad. | **OBSERVED:** lobby copy: `중앙 전장에서 손가락을 끌어 이동하세요`; desktop/portrait drags changed camera while movement/sequence stayed idle. |
| LP-02 | **S1** | Portrait overlay hierarchy hides critical combat feedback. | **OBSERVED:** feedback x=0,y=0,121×18 overlaps the left HUD card starting near 6,6; `CRIT · 치명타 확정` was only partly visible behind cards. |
| LP-03 | **S1** | The portrait growth modal does not contain its own options and collides with the persistent HUD. | **OBSERVED:** container ended at y≈118 while choices extended to y≈209; screenshot showed duplicated/stacked heading and options drawn over HUD. Selection remained possible, but comparison readability was compromised. |
| LP-04 | **S1** | The new-player battle continues during stage-entry presentation and can defeat an unattended player before growth is introduced. | **OBSERVED:** desktop HP dropped while `STAGE_STARTED` copy remained; portrait was near half HP at 11 s and `전투 종료` by the next observation. Growth did not appear until ≈34 s in the controlled surviving run. |
| LP-05 | **S2** | Growth agency arrives as a long drought followed by a burst. | **OBSERVED:** at 28 s the player was still Lv.1 with XP 174; growth appeared around 34 s, then three choices in immediate succession jumped the run to Lv.4. |
| LP-06 | **S2** | Bind timing copy is misleading and lacks visible progress. | **OBSERVED:** `결속 홀드 0/2초` remained `0/2초` for the first measured 2.5 game seconds; ready arrived about 6 game seconds after start. |
| LP-07 | **S2** | Portrait extraction affordances collapse into narrow vertical text. | **OBSERVED:** 63×77 extract button wrapped four words across many lines; world prompt rendered as a narrow vertical strip. The action worked but was hard to scan during combat. |
| LP-08 | **S2** | Portrait leaves a small, visually quiet combat window between dense top and bottom control bands. | **OBSERVED:** three top state cards span nearly all 390 px; commander panel, D-pad, and actions fill the bottom ~199 px. Commander/enemy silhouettes were tiny relative to terrain. |
| LP-09 | **S2** | Enemy-count/combat-state readability does not match the visual field. | **OBSERVED:** at portrait time 11 s HUD reported 20 enemies, but the playfield showed a small clustered silhouette with no clear target priority or threat-direction read. |
| LP-10 | **S2** | Camera zoom has no observable confirmation or state readout. | **OBSERVED:** two independent pinch deliveries caused no discernible before/after scale change and exposed no zoom value; movement correctly stayed idle. **Unresolved:** renderer-internal zoom may have changed below visual detectability. |
| LP-11 | **S2** | A desktop run entered an active-but-frozen simulation state without an error. | **OBSERVED:** status stayed time 0 for 2,009 ms of visible-page wall time; no growth/cutscene; inputs queued but stance did not apply; 0 captured errors. **INFERENCE:** this is a session/runtime anomaly until independently reproduced. |
| LP-12 | **S3** | Stance success feedback is easy to miss amid combat. | **OBSERVED:** switch changed the glyph/ARIA label and added `is-switched`, but the main event feedback remained unrelated lore/critical text rather than announcing `포대`. |
| LP-13 | **S3** | Camera orbit has no persistent angle/reset affordance. | **OBSERVED:** drag clearly rotated the view, but no camera state or reset control appeared; the one-shot hint was already gone at later checks. |
| LP-14 | **S3** | Core action language mixes Korean with unexplained English system terms. | **OBSERVED:** `Bind`, `Extract`, `Echo Bolt`, `Echo Lance`, `RUN STATE · AGENCY`, `Lv.`, and `XP` coexist with Korean task copy. |
| LP-15 | **S3** | Portrait lobby is vertically long before stage-detail completion. | **OBSERVED:** 2,321 px document height at 844 px viewport. Positive counter-evidence: the primary start action was still above the fold at y=456–500 and no horizontal overflow occurred. |

## Top 3 gameplay/UI blockers

1. **S1 — Control contract contradiction:** the lobby teaches drag-to-move while the live canvas implements drag-to-orbit. This directly invalidates the first movement instruction.
2. **S1 — Portrait overlay collisions:** critical events are hidden behind the top HUD and growth choices overflow/collide with it, obscuring the decisions and warnings that matter most.
3. **S1 — Hostile onboarding timing:** combat damages and can defeat the player during/just after the stage-entry presentation, while the first growth decision is delayed until roughly game time 34 s.

## Reachability ledger

| Path | Status |
|---|---|
| Lobby → defense run | **OBSERVED reachable** at both viewports. |
| Keyboard movement | **OBSERVED reachable and effective** at both viewports. |
| Hold-based pointer/D-pad movement | **OBSERVED reachable and effective** at both viewports. |
| Stance switching | **OBSERVED reachable and effective** in portrait; desktop attempt was blocked by the frozen-clock anomaly. |
| Growth/skill selection | **OBSERVED reachable** in controlled portrait at ≈34 s; three actual selections completed. |
| Bind and elite extraction | **OBSERVED reachable**; extracted Ember Cohort at game time 40 s. |
| Camera orbit | **OBSERVED reachable with visible view change**; no movement side effect. |
| Camera zoom | **OBSERVED exercised, effect not proven**; two pinch mechanisms produced no discernible scale change. |
| Boss kill, stage clear, rewards, return-to-lobby | **UNREACHABLE in this baseline:** the run was intentionally stopped after proving extraction and boss-kill transition. No claims are made about these paths. |

## Console/runtime evidence

- **OBSERVED desktop clean run:** WebGL active at game time 3 s; **0 page errors, 0 console errors**.
- **OBSERVED portrait full controlled journey through extraction:** **0 page errors, 0 console errors**.
- **OBSERVED browser-harness incident:** the first desktop tab died after a browser-tool timeout during a screenshot/drag attempt. This was a harness/tab-lifecycle failure, not a page console error, and is not attributed to production code.

## Cycle targets

- **TARGET:** replace all drag-to-move copy with an explicit split contract: keyboard/D-pad moves; drag orbits; pinch zooms.
- **TARGET:** reserve non-overlapping portrait layers for persistent HUD, transient combat events, growth modal, and capture prompt; every interactive option must remain within its modal bounds.
- **TARGET:** pause or shield the initial presentation, or make the first actionable movement/growth decision arrive before lethal pressure.
- **TARGET:** show monotonic bind progress and truthful total time, including route-to-zone time versus the 2 s hold.
- **TARGET:** expose visible zoom feedback or a reset/zoom indicator and add a browser-observable camera-state hook for QA.
