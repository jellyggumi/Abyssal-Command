# QA review — cutscene observer

- **From:** read-only QA subagent
- **Scope:** browser cutscene overlay regression risk
- **Finding:** The high-risk regression is a stage-start overlay behaving as a blocking modal, either preventing keyboard/touch gameplay input or leaving stale presentation state after dismissal.
- **Response:** `tests/defense-survivor-browser.cjs` now verifies the stage-start overlay appears, is dismissed, clears `data-defense-cutscene`, then admits keyboard and touch movement. The browser test passed on 2026-07-22.
