# Playtest Report — Stage 2 Phase 2a

run-id: `20260725-defense-rpg-development`  
measured: `2026-07-25T23:37:52.890Z`–`2026-07-25T23:40:53.633Z` UTC  
scope: deterministic simulation and focused headless-browser probes only. These are not human playtests.

## Evidence boundary

**Newly observed in this run.** Five deterministic campaign archetypes, the G7 engaged-policy receipt, extraction contract coverage, HUD responsiveness, growth-delta display, and desktop headless performance were rerun against `defense-survivor-v1`.

**Carried baseline facts.** The prior cycle found 0 defeats / 700 clears, unreachable extraction, low-tier p95 24.2 ms / 8.302% long frames, and an unmeasured human repeat rate. Those facts remain traceable to `_workspace/20260725-wellmade-verification/retrospectives/cycle-1-retrospective.md`; they are not silently converted into current results.

## Protocol and evidence

| probe | exact command | timestamp | evidence |
|---|---|---|---|
| five-archetype rotation | `node scripts/run-g2-archetype-rotation.mjs <rusher|turtle|economy-greed|micro-optimizer|casual> --seeds 301,302,303 --output _workspace/20260725-defense-rpg-development/qa/evidence/archetype-<id>-current.json` | 2026-07-25T23:37:52.890Z | `qa/evidence/archetype-*-current.json`; `qa/evidence/probe-session-20260725T.json` |
| baseline-state/failure probe | `node scripts/run-defense-balance-sim.mjs --output _workspace/20260725-defense-rpg-development/qa/evidence/balance-sim-current.json` | 2026-07-25T23:37:52.890Z | `qa/evidence/balance-sim-current.json` |
| G7 engaged receipt | `node scripts/measure-g7-core-loop.mjs --policy engaged --cadences 15 --output _workspace/20260725-defense-rpg-development/qa/evidence/g7-engaged-4hz-current.json` | 2026-07-25T23:39:59.765Z | `qa/evidence/g7-engaged-4hz-current.json`; `qa/evidence/probe-followup-session-20260725T.json` |
| extraction contract | `node --test tests/defense-run-simulation.test.mjs` | 2026-07-25T23:39:59.765Z | 25/25 pass in `qa/evidence/probe-followup-session-20260725T.json` |
| growth delta | `node --test tests/defense-stat-delta-browser.test.mjs` | 2026-07-25T23:37:52.890Z | 1/1 pass in `qa/evidence/probe-session-20260725T.json` |
| touch/readability | `node tests/defense-hud-responsive-browser.cjs` | 2026-07-25T23:37:52.890Z | exit 1 in `qa/evidence/probe-session-20260725T.json` |
| desktop browser performance | `node tests/defense-performance-browser.cjs` | 2026-07-25T23:37:52.890Z | `qa/evidence/probe-session-20260725T.json` |

## Archetype-rotation sessions — G3 coverage

| archetype | seeds × stages | campaign clears | defeats | mean boss TTK ticks | ratio to five-archetype median (637.17) | observed RPG skills | observed stance |
|---|---:|---:|---:|---:|---:|---|---|
| rusher | 3 × 10 | 3/3 | 0/30 | 562.83 | 0.883× | none | VANGUARD |
| turtle | 3 × 10 | 3/3 | 0/30 | 735.90 | 1.155× | none | VANGUARD |
| economy-greed | 3 × 10 | 3/3 | 0/30 | 732.67 | 1.150× | `echo-backlash`, `wardens-ward` | VANGUARD |
| micro-optimizer | 3 × 10 | 3/3 | 0/30 | 637.17 | 1.000× | none | VANGUARD |
| casual | 3 × 10 | 3/3 | 0/30 | 605.73 | 0.951× | four nodes including `echo-cascade` | VANGUARD |

**Coverage result: 5/5 required archetypes directly tested; 150/150 stage-runs cleared.** The five mean-TTK values stay inside the 1.3× median cap, but this does **not** establish three independently viable archetypes: all five campaign policies cleared all samples and all recorded only `VANGUARD`. It is a saturation result, not proof of healthy role pressure.

The focused non-campaign balance probe contradicts the saturation result: 9/30 deterministic stage samples ended `DEFEAT` (30.0%), specifically `starless-canal` seed 991; `shattered-causeway` seeds 17/991; all three seeds for `abyss-chancel` and `gate-zenith`. Its input policy is idle/macro-driven, so it is not a valid matchup-rate substitute for the campaign policies. The two probes establish a policy-sensitive failure surface that needs one shared adversarial input tape before a 45–55% band can be measured.

## G7 loop receipt

Policy: engaged, 4 Hz re-decision, three stages (`cinder-span`, `echo-throne`, `howling-sprawl`) × seeds 901–903. The receipt counts only accepted deliberate input types and macro reward events; `MOVE` repetition is not a separate class.

| whole-stage outcome | value | G7 limb |
|---|---:|---|
| samples | 9/9 victories | deterministic only |
| duration | 26.90–58.43 s; median 40.25 s | **6/9** within 30–180 s; three `cinder-span` samples are 26.90–27.70 s |
| deliberate action classes | 3–4 per sample; median 4 | meets ≥3 in all 9 samples (`MOVE`, `STANCE_CYCLE`, `EXTRACT_ELITE`, and sometimes `SKILL_CAST`) |
| macro reward events | 13–14 per sample | meets the scripted macro-reward limb; every sample includes `ELITE_EXTRACTED` after accepted `EXTRACT_ELITE` |
| extraction | 9/9 `extracted: true` | current deterministic reachability observed |
| L1 growth-offer circuit | 0.02 s median, 0 action types, 2 macro rewards | fails duration and action limbs |
| voluntary re-entry | unmeasured | human playtest unavailable; do not infer the ≥70% repeat proxy |

**Loop verdict: BLOCKED.** Six whole-stage samples satisfy duration/action/macro-reward measurement, but three are too short and no human voluntary-repeat receipt exists. This report does not claim a qualifying G7 loop.

## Readability, growth, and performance observations

- `node --test tests/defense-stat-delta-browser.test.mjs` passed 1/1: the browser rendered three growth choices with a truthful `current → upgraded` rank delta.
- `node tests/defense-hud-responsive-browser.cjs` failed before the responsive report completed: portrait safe-area assertion was `59 !== 11` for the top-cutout condition. Therefore this run does **not** clear the ≥44 CSS-px / mobile-readability checklist.
- `node tests/defense-performance-browser.cjs` passed its narrow desktop-headless checks. At 844×390 and 2056×1082 it recorded 73 DOM nodes, rAF means 16.665/16.667 ms, input samples 0.2–0.4 ms, and input sequence 0→2. It neither simulates the low-tier profile nor remeasures p95/long-frame budget; carried low-tier G6 failure remains open.

## Human-only limits

No participant was available to observe comprehension, voluntary rerun, impression, or immersion. G4 human immersion, G7 repeat rate, and G8 impression remain unmeasured rather than estimated.

## Follow-up verification — 2026-07-25T23:56Z

The prior HUD failure was test drift: the responsive probe selected the intentional camera toast (`.defense-toast`, top 59 px) as if it were a base edge card. The corrected probe separates transient toasts from base cards and passes all five viewports plus portrait resize. The corrected survivor browser contract also passes the pre-Bind route CTA journey:

- initial prompt: `Bind 대기 · Ember Cohort`, action enabled with `disabled=false` and `aria-disabled="false"`;
- after one route-start click and the authored hold: `추출 가능 · Ember Cohort`, action remains enabled with `aria-disabled="false"`;
- boss scene graph: live `bosses/cinder-warden.glb`, 2 mesh descendants, no page/console errors;
- portrait and public browser contracts pass.

The current G7 receipt is `qa/evidence/g7-engaged-followup-20260725T235642Z.json`: 9/9 victories at 60/10/4 Hz with 39.27/39.28/40.25-second medians; 2 Hz stress is 5/9 victories at 84.18 seconds. Whole-stage traces contain 3–4 deliberate action classes and 13 macro rewards. Human comprehension/repeat and low-tier performance remain unmeasured, so the gate remains HOLD.

## Running-browser autoplay smoke — 2026-07-26T00:06Z

Playwriter attached to an extension-connected Chrome profile and served the current repository locally at `http://127.0.0.1:4173/index.html`. The real UI flow completed without console/page errors:

1. Selected `Cinder Span` and launched the battle.
2. Waited through automatic combat until the authored growth offer appeared.
3. Selected `rift-bolt`; the battle resumed at Lv.2.
4. Reached `정예 추출 · Ember Cohort`, selected the extraction action, then selected `Ember Cohort Legacy`.
5. Reached `관문 방어 성공`, returned to the lobby, and verified the permanent reward count increased from 1 to 2.

Evidence: browser snapshots after every action and `/tmp/abyssal-autoplay-lobby.png`. This is an end-to-end smoke pass; it does not promote G7/G8 because low-tier performance and human comprehension/repeat remain unmeasured.