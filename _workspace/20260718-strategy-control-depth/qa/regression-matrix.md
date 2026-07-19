# Stage 2→3 regression matrix

**Run:** `20260718-strategy-control-depth`  
**Status:** planned coverage only. `P` means planned, not passed. No test, simulator, browser, or profiler command was run by this QA lane.

## Legend

- **P** — mandatory future probe.
- **—** — not a meaningful axis for this scenario.
- **Exact parity** — normalized intent, accepted/rejected result, campaign state, and authoritative trace must match byte-for-byte after canonical serialization.
- **Presentation parity** — visible meaning/feedback must match; pixels may differ.
- **Rules stamp** — every cell must identify `abyssal-surge-rules-v6`, build/commit, stage, seed, renderer, input, viewport, DPR, refresh rate, and evidence path.

## Scenario-to-surface matrix

| Scenario | WebGL2 | Canvas fallback | Mouse/pen pointer | Keyboard | Touch | 30/60/120 Hz | Offline/context loss | Balance seeds | 60-min soak | Primary gate |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| QA-MAP-001 lane camping | P | P | — | — | — | — | — | P | — | ≥3 lanes; camp ≤60%; lane share ≥15%; win 45–55% |
| QA-CTL-002 click-spam | P | P | P | P | P | P | — | — | — | exact action parity; p95 ≤100 ms; no duplicates |
| QA-CTL-003 drag/click ambiguity | P | P | P | — | P | — | P (`pointercancel`) | — | — | same semantic classification; cancel commits nothing |
| QA-PATH-004 stuck pathing | P | P | P | P | P | P | — | — | — | ≥99% completion; no >500 ms stall; no illegal entry |
| QA-CTL-005 held-key focus loss | P | — | — | P | P | P | P | — | — | no ghost movement/action; preserve specified click order |
| QA-TIME-006 extreme dt | P | P | — | P | — | P | P | — | — | matched-time movement ≤0.05 units; camera cross-rate ≤2 pp |
| QA-RULE-007 cooldown stacking | P | P | P | P | P | — | — | P | — | one acceptance; duplicates reject without mutation |
| QA-BAL-008 thin-legion rush | — | — | — | — | — | — | — | P (200 paired) | — | 45–55% and ≤10 pp gap; TTK ±15% |
| QA-BAL-009 reward snowball | — | — | — | — | — | — | — | P (200 paired campaigns) | — | ≤10 pp gap; reward EV ≤1.3× median; exactly once |
| QA-PAR-010 offline/Canvas | P (source) | P | P | P | P | P | P | — | — | exact authority; feedback p95 ≤100 ms; fallback frame p95 ≤16.7 ms |
| QA-MOB-011 mobile touch | P | P | P (baseline) | P (baseline) | P | P | P | — | — | exact authority; 0 duplicate/cancel action; ≥44 px target |
| QA-SOAK-012 long session | P | P | P | P | P | P | P | — | P | ≤10% heap/perf growth; one RAF; zero uncaught errors |

## Stage and tactical-lane coverage

Every stage is mandatory; no “representative three stages” waiver satisfies map-depth or reducer parity.

| Stage | Observed current ID | Lane/zone graph audit | 1,000-pair path census | A1 camp ×200 | A2 rush ×200 paired | A3 reward campaign contribution | WebGL2/Canvas trace | TTK | Perf stress |
|---:|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | `cinder-span` | P | P | P | P | P | P | P | P |
| 2 | `veil-citadel` | P | P | P | P | P | P | P | P |
| 3 | `echo-throne` | P | P | P | P | P | P | P | P |
| 4 | `sunken-bastion` | P | P | P | P | P | P | P | P |
| 5 | `howling-sprawl` | P | P | P | P | P | P | P | P |
| 6 | `glass-necropolis` | P | P | P | P | P | P | P | P |
| 7 | `starless-canal` | P | P | P | P | P | P | P | P |
| 8 | `shattered-causeway` | P | P | P | P | P | P | P | P |
| 9 | `abyss-chancel` | P | P | P | P | P | P | P | P |
| 10 | `gate-zenith` | P | P | P | P | P | P | P | P |

### Per-stage lane proof required

For each row above, the evidence must list at least three lane/zone IDs and provide:

- origin/objective cells and reachability;
- shortest legal path length;
- elevation/cover count;
- resource/objective nodes;
- hazard/exposure time;
- route share over 200 standardized runs;
- maximum camp interception without repositioning;
- failure/stall path and raw route trace.

A lane counts only if it differs from each peer on at least two of: length ≥15%, elevation/cover ≥2 cells, objective access ≥1 node, or exposure ≥20%. Removing any one lane must leave two legal routes.

## Input-authority parity matrix

The canonical corpus includes every campaign command available anywhere in the ten stages (`hunt`, `extract`, `materialize`, `capture`, `assault`, `possess`, `domain`), plus rally/move/select/orbit presentation gestures. Each authoritative action is exercised once legal, once on cooldown, once without prerequisite, and once as a simultaneous duplicate.

| Source → normalized intent | WebGL2 expected | Canvas expected | Authoritative comparator | Feedback comparator | Failure severity |
|---|---|---|---|---|---|
| Pointer/tap on legal command | One semantic action ID | Same action ID | Exact accept, campaign state, trace | Success cue starts p95 ≤100 ms | S1 state divergence; S2 cue/latency |
| Keyboard mapping on legal command | Same action ID | Same action ID | Exact accept, state, trace | Same semantic cue | S1/S2 |
| Touch on legal command | Same action ID; no synthetic duplicate | Same action ID; no synthetic duplicate | Exact accept, state, trace | Same cue, target ≥44×44 CSS px | S1/S2 |
| Any source on cooldown | Rejected, no mutation | Same | Exact rejection reason and state/trace | No success cue; optional rejection cue equivalent | S1 mutation; S2 false cue |
| Same-frame pointer+key+touch | One logical action only | Same | Exactly one accept, remaining intents reject/dedupe | One success cue only | S1 |
| Drag/orbit/box-select | No authoritative campaign action | Same semantic non-action | State/trace unchanged | Camera/selection only | S2 if action fires |
| `pointercancel`/orientation/app switch | No action | No action | State/trace unchanged | Capture released; no success cue | S2 |
| Focus loss while `W+Shift` held | Held set cleared; no resumed movement | N/A for 2D held movement | Campaign state unchanged | No movement until new input | S2 |
| WebGL context loss → Canvas | Continue from same campaign snapshot | Receives same snapshot | Exact state/trace and save envelope | Explicit fallback, same command meaning | S1/S2 |

## Gesture boundary matrix

The observed implementations use different current thresholds: WebGL2 marks drag when `|dx|+|dy|>3` CSS px, while Canvas marks box-select when `|dx|>6 || |dy|>6`. These are inspection facts, not a test result. Future normalization must be evaluated at physical and normalized motion boundaries.

| Offset / gesture | 1280×720 DPR1 mouse | 390×844 DPR3 touch | WebGL2 | Canvas | Required result |
|---|:---:|:---:|:---:|:---:|---|
| `(0,0)` tap | P | P | P | P | click/tap semantic agrees |
| `(2,1)` jitter | P | P | P | P | same semantic; no accidental drag |
| `(3,1)` boundary | P | P | P | P | same semantic classification |
| `(4,0)` boundary | P | P | P | P | same semantic classification |
| `(6,0)` boundary | P | P | P | P | same semantic classification |
| `(7,0)` drag | P | P | P | P | drag/non-action; no click action |
| 0.5% viewport-short-axis | P | P | P | P | same normalized classification |
| 1% viewport-short-axis | P | P | P | P | same normalized classification |
| 2% viewport-short-axis | P | P | P | P | drag/non-action |
| Cancel before release | P | P | P | P | no action; capture released |
| Second contact during capture | — | P | P | P | no duplicate or pointer corruption |
| Orientation during capture | — | P | P | P | cancel safely; no action |

## Frame-rate, delta-time, and camera matrix

| Timeline | WebGL2 movement | Canvas movement | Camera | Cooldown/combat | Required result |
|---|:---:|:---:|:---:|:---:|---|
| 240 Hz / 4.167 ms steps | P | P | P | P | baseline trajectory |
| 120 Hz / 8.333 ms steps | P | P | P | P | matched result |
| 60 Hz / 16.667 ms steps | P | P | P | P | matched result |
| 30 Hz / 33.333 ms steps | P | P | P | P | matched result |
| 20 Hz / 50 ms steps | P | P | P | P | matched result at supported clamp edge |
| One 250 ms raw frame gap | P | P | P | P | simulation consumes ≤50 ms at public frame boundary; no tunneling |
| Hidden 2,000 ms then resume | P | P | P | P | no catch-up jump; held input cleared |
| Hit-stop active | P | — | P | P | hit-stop presentation does not duplicate/skip authority |

**Numeric comparator:** commander/enemy final-position spread ≤0.05 world units at matched time; identical collision/path outcome; camera residual ≤5% by 500 ms, matched-rate difference ≤2 percentage points, overshoot ≤2%.

## Performance profile matrix

| Profile | Viewport / DPR | Renderer | Load | Duration | PASS bands |
|---|---|---|---|---|---|
| Desktop nominal | 1440×900 / DPR2 | WebGL2 | largest map, median legal units | 5-min warm-up +10-min capture | p95 ≤16.7 ms; p99 ≤33.3 ms; input p95 ≤100 ms |
| Desktop stress | 1920×1080 / DPR2 | WebGL2 | largest map, max legal units, combat/particles | 10 min | ≥99% frames within profile budget; no input-adjacent >100 ms |
| Mobile representative | 390×844 / DPR3 (renderer cap observed separately) | WebGL2 | largest map, max legal units | 10 min | p95 ≤33.3 ms; input p95 ≤100 ms |
| Small mobile | 320×568 / DPR2 | WebGL2 | median units | 10 min | p95 ≤33.3 ms; all controls reachable |
| Tablet | 768×1024 / DPR2 | WebGL2 | largest map, max legal units | 10 min | p95 ≤33.3 ms; exact touch parity |
| Fallback nominal | 1280×720 / DPR1 | Canvas | largest map, max legal units | 10 min | p95 ≤16.7 ms; input p95 ≤100 ms |
| Desktop soak | 1440×900 / DPR2 | WebGL2 | max units, 100k inputs, lifecycle churn | 60 min after warm-up | p95 degradation ≤10%; heap/object growth ≤10%; one RAF |
| Mobile/fallback soak | 390×844 DPR3 WebGL2 and 1280×720 Canvas | both | same soak operations | 60 min each | same growth/latency gates; zero uncaught errors |

## Balance matrix by archetype

| Archetype | Policy corpus | Samples | Comparator | Win gate | TTK gate | Additional gate |
|---|---|---:|---|---|---|---|
| A1 Anchor Sentinel | fixed best-intersection camp; no reposition after wave 1 | 200 paired seeds/stage | three-lane rotating defense | 45–55%, gap ≤10 pp | target ±15% | camp intercept ≤60%; no lane starvation |
| A2 Tempo Raider | minimum legal legion/first assault | 200 paired seeds/stage | capacity builder, same RNG/reward | 45–55%, gap ≤10 pp | target ±15% | no stage is a deterministic hard wall without telegraphed counterplay |
| A3 Veil Economist | highest campaign-EV rewards | 200 paired campaigns | median-EV rewards, same action/RNG | 45–55%, gap ≤10 pp | target ±15% | reward pair ≤1.3× median EV; exactly-once persistence |
| A4 Micro Dispatcher | legal adaptive policy plus 10 Hz inputs | 200 seeds +500 latency samples/surface | same policy at baseline input rate | outcome gap ≤10 pp | target ±15% | no duplicate action; path ≥99%; p95 ≤100 ms |
| A5 Field Survivor | same policy on mobile/fallback with lifecycle interruptions | 200 seeds +60-min soak | desktop WebGL2 uninterrupted | outcome gap ≤10 pp | target ±15% | exact trace parity; growth ≤10%; p95 ≤100 ms |

### Existing reducer baseline placement

The shared `/tmp/abyssal-balance-v6.json` is recorded as baseline evidence only:

| Existing policy | Observed result | Matrix use | What it cannot prove |
|---|---|---|---|
| Rusher | 0%; defeat Echo Throne; 20 actions | deterministic regression fixture for A2 | paired strategy viability, human execution, live TTK |
| Comeback | 0%; defeat Howling Sprawl; 47 actions | deterministic failure-path fixture | fairness or recovery usability |
| Greedy economy | 100%; 116 actions | deterministic A3 reference | reward dominance across seeds/humans |
| Optimal | 100%; 103 actions | deterministic control | reasonable player discoverability |
| Casual | 40% over 200; 120 defeats | seeded reducer baseline; stage hotspot locator | live difficulty, input skill, timing, fairness |
| Fuzz | 150,000 ops; 0 findings | reducer invariant confidence | DOM races, pathing, rendering, latency, touch, soak |
| Branch census | 0.6923–0.8537 | arithmetic decision-availability baseline | meaningful strategic depth or lane diversity |

## Required raw evidence paths

Future execution should write immutable artifacts under:

```text
_workspace/20260718-strategy-control-depth/qa/evidence/<scenario-id>/
  manifest.json
  samples.jsonl
  summary.json
  trace-authority.jsonl
  trace-performance.jsonl        # runtime scenarios only
  screenshot-or-video-index.json # visible-feedback scenarios only
```

`manifest.json` must include the future command, exit code, UTC, device/browser, build/commit, rules version, setup hash, threshold source, and artifact checksums. Missing evidence makes the cell `NOT RUN`, not PASS.

## Release blocking rules

1. Any S1 blocks all Stage 3 gates.
2. Any WebGL2/Canvas or pointer/keyboard/touch authoritative divergence is S1.
3. Any stage with fewer than three measured material lanes/zones fails map-depth acceptance.
4. Any unrun required matrix cell prevents a completeness verdict.
5. A passing reducer simulator does not override a failing live control/performance cell, and a passing browser session does not override reducer/state divergence.