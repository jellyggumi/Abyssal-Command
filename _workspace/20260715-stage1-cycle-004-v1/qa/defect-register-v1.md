# P4 defect register v1 — Cycle 004 Stage 1

This is the first P4 defect register for Cycle 004.

| ID | Severity | Status | Closure evidence |
|---|---|---|---|
| DEF-001 | High | **Closed** | CORS protocol block over `file://` for app.js ES module resolved by spinning up a lightweight local HTTP server at `http://127.0.0.1:8080` inside `tests/playtest-browser.cjs`. |
| DEF-002 | High | **Closed** | Service Worker cache pollution across Chrome profile runs resolved by unregistering service workers and calling `page.reload` during initialization in the E2E script. |
| DEF-003 | High | **Closed** | RTS animation loop (`rtsLoop`) was never started for real-time mode on play screen transition. Resolved by adding `requestAnimationFrame(rtsLoop)` trigger in `showSurface("play")`. |
| DEF-004 | High | **Closed** | `rAFId` animation frame state leak on Stage transitions, which locked subsequent stages from ticking. Resolved by setting `rAFId = null` at the very start of `rtsLoop`. |
| DEF-005 | Medium | **Closed** | Typo in E2E playtest campaign settlement selector (`#settlement` instead of `#settlement-summary`). Resolved by updating the selector to `#settlement-summary`. |
| DEF-006 | High | **Closed** | `cloneState` was missing/deleted in `game-core.js`, causing a ReferenceError on reduce. Resolved by restoring the `cloneState` helper function. |

No open Critical or High defects remain in the current cycle.
