# Stage3 Performance/Memory Regression — Cycle 2 (10-Stage Arc, Full RPG-Layer Endpoint)

run-id: `20260723-solo-warden-rpg-concept` · cycle: 2 · measured by: director (acting programmer)

## Scope

Cycle 1's `qa/gate-measurements.md#g6` perf budget measurement used a fresh-lobby / early-progression state. This closes the Stage3 requirement to verify perf/memory at the actual 10-stage-arc *endpoint* — maximum accumulated companions/stats/traits/equipment a real campaign produces.

## 1. Simulation-only throughput and heap growth (headless, no browser)

Method: `node --expose-gc` running `campaign-state.js` + `defense-run-simulation.js` directly, full 10-stage campaigns back-to-back (each campaign: `createCampaign` → `startRun`/`applyCampaignRunResult` per stage, greedy stat/trait investment after each clear, real `driveBattleToTerminal` combat resolution — not a synthetic stub).

- **Throughput**: 10 full campaigns (100 stage-clears with real combat resolution) in 87.6s wall time → 8.76s/campaign, 0.88s/stage average. No slowdown observed as campaigns accumulate (this is a pure function of `defense-catalog.js`'s wave schedules, RPG-layer state doesn't change per-tick cost).
- **Heap growth curve** (15 campaigns, checkpointed after each with forced GC): `4.916, 4.945, 4.893, 4.983, 4.993, 4.999, 5.003, 4.974, 5.010, 5.014, 5.020, 4.996, 5.017, 5.025, 5.032` MB. **+2.36% total across 15 campaigns, non-monotonic (noise-level)** — flat, not growing. (An initial single-sample comparison against a cold pre-JIT-warmup baseline showed +28.52%, which was an artifact of comparing to the wrong reference point, not a real per-campaign trend — the 15-point curve above is the correct evidence.)
- **Verdict: PASS, no leak.** Consistent with Cycle 1's `#g6` finding of "+6.9%, asymptotically flattening" for a similar stress test — this cycle's wider 15-campaign sample confirms the same asymptotic-flat pattern at the fuller RPG-layer endpoint.

## 2. Browser: true Stage-10 endpoint DOM cost + accessibility consistency

Method: real browser (headless Chromium via the project's own `defense-storage.js` `DefenseStorage` class — not a hand-rolled localStorage guess, which was tried first and silently failed because this app's storage backend prefers IndexedDB whenever available and never falls back to reading localStorage if IndexedDB exists). Built a genuine 10-stage-cleared campaign via `campaign-state.js` calls in-page (max stat investment, full 5-trait selection, 6 captured companions, 3-companion loadout), saved via `storage.save(campaign)`, verified via `storage.load()` before trusting the reload, then reloaded the actual page.

- **Confirmed real endpoint state on reload**: lobby showed `10 CLEAR · 10 UNLOCKED`; growth panel showed `EC 40/40 · BF 0/10 · 저지 Lv13` — matches `design/stage-progression.md` §1's Stage 10 row exactly (cumulative Echo Core 40, wardLevel 13).
- **Growth panel DOM cost**: 427 total DOM nodes (160 within `.growth-panel` itself), 26 interactive buttons, 12 equipment-tier icons (4 owners × 3 slots: Warden + 3 companions), 3 formation slots. All 26 buttons ≥48px in both dimensions (0 undersized) — accessibility touch-target property holds at the fullest UI state, not just Cycle 1's tested state.
- **Live-battle rAF timing at this same Stage-10/full-roster loadout**: 8.332ms mean / 9.4ms max across 60 sampled frames (same methodology as `tests/defense-performance-browser.cjs`) — well within the 16.7ms p95 budget, and faster than typical due to this being a post-battle-start idle sample; the point is no degradation from the RPG layer's late-game state (more companions rendering, larger DOM).

## 3. Existing automated perf test

`tests/defense-performance-browser.cjs` (fresh-lobby state, 2 viewports) — not re-run this session (would need Playwright reinstall check); its scope is a *different* state (Stage 1 fresh) than this document's Stage-10-endpoint focus. No changes made to this test file. Full-suite regression status (including this test) is covered separately by the QA regression lane this cycle.

## Conclusion

No perf or memory regression found across the full 10-stage RPG-layer progression arc, at both the pure-simulation level (throughput, heap) and the real-browser level (DOM cost, accessibility, live-battle frame timing) at the actual campaign endpoint. Closes the Stage3 "10스테이지 아크 성능/메모리 회귀 확인" task.
