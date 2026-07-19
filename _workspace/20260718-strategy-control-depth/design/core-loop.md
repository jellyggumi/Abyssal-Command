# Frozen Stage 2→3 tactical core loop

## Contract

A stage lasts **30–180s**, offers **3 materially distinct lanes** (≥50% nonshared, ≥1 affordance each, longest≤1.35× shortest), contains forecastable **14–16s** pressure where encounters exist, resolves through the single `campaign-state.js` reducer, yields ≥1 reward event, and shows feedback at **p50/p95/max≤50/100/200ms** over ≥500 samples/profile.

## Loop

1. **Read (0–6s):** show portal, objective, three lane silhouettes, pressure timer and ≤5 primary controls.
2. **Commit (4–17s):** walk 4.1 u/s, surge 7.2, or point-order into exposed-short, objective-medium or protected-long lane.
3. **Contest (8–74s):** enemies advance 2.4 u/s; first junction permits a real redirect; lane families stay ≥50% nonshared.
4. **Convert (3–5s reducer cooldowns):** hunt/extract/materialize/capture/possess/Domain/assault remain phase-gated; ≤4 enabled at once.
5. **Resolve (60–165s stage targets):** encounter/boss, integrity and exactly one reward close the stage.
6. **Reflect:** receipt names action/target/consequence and exposes the next lane/pressure choice.

## Decision horizons

| Horizon | Player question | Bound | Owner |
|---|---|---:|---|
| Immediate | Registered? click or drag? | 50/100/200ms; drag 6px mouse/pen, 12px touch | input→reducer receipt |
| Tactical | Which lane balances time, affordance and exposure? | 28–40 cells; lane success 15–70% | navigation profile |
| Strategic | Greed/materialize, node control or assault before pressure? | 14–16s waves; stage 30–180s | reducer |

## Stage progression

| Stages | Added decision | Loop target |
|---|---|---:|
| 1–3 | three-lane read; split nodes; Domain timing | 60–120s |
| 4–6 | waves, exposure/cover trade, separated-node defense | 85–135s |
| 7–8 | two-node pressure; S7 Undertow trial only after base pass | 100–145s |
| 9–10 | three nodes, four/five waves; S9 second/final Undertow trial | 110–165s |

## Control invariants

- Fixed simulation 1/60s, max delta .10s, max 6 catch-up steps.
- Speeds 4.1/7.2/2.4; commander acceleration 28, deceleration 36 u/s².
- Camera exponential follow τ=.1304s; equivalent at 30/60/120Hz.
- Cumulative threshold: 6 CSS px mouse/pen, 12 CSS px touch. At/above threshold never calls `pick()`.
- Pointer, keyboard and touch submit identical semantic intent; only `applyAction` accepts/rejects.
- Three.js/fallback never differ in navigation, cooldown, damage, reward, wave or Undertow outcome.
- Static-camp time ≤60% successful-stage duration.

## Failure rules

| Failure | Response |
|---|---|
| Lane success <15% or >70% | Re-author exposure/objective/path; do not globally alter speed. |
| Ratio >1.35 or nonshared <50% | Geometry FAIL; it is not a lane. |
| Casual outside 45–55% | Inspect defeat/contact/bypass; change one numeric family only. |
| Stage outside 30–180s | Fix route/pressure first. |
| Feedback exceeds 50/100/200ms | Stage 3 FAIL even if reducer tests pass. |
| Renderer trace diverges | Fix shared fact/reducer projection; no renderer compensation. |

## Evidence packet

- Balance: existing simulator, ≥200 seeded casual, 45–55%, CI, defeat histogram, identical double-run.
- Topology: 3 lane families, ≥50% pairwise nonshared, affordances, ratio≤1.35, 2 reconnects, ≥4 frontage, anchors reachable.
- Session: timings, actions, route at junctions, contacts, stationary ratio, integrity/reward, voluntary repeat proxy≥70%.
- Responsiveness: input→reducer→receipt→first changed RAF; p50/p95/max; ≥500 samples/device-input profile.
- Rate parity: 30/60/120Hz plus 250ms stall; movement endpoint≤.05 world units, camera endpoint≤.5%.

**G7 disposition:** numeric model complete; playtest repeat-rate evidence not run, so G7 is not a PASS.
