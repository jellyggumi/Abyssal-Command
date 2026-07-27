# Current Verification Audit

**Scope:** current working tree, prior Stage 2/Stage 1b artifacts, deployment workflow, in-game browser scenarios, and local/GitHub scheduling.
**Verdict:** **NOT RELEASE-READY**. Static asset/release checks pass, but the current uncommitted gameplay retune and missing historical QA fixtures leave the full regression and the primary playthrough red.

## Evidence run

| Area | Command / observation | Result |
|---|---|---|
| Dependencies | `npm ci` | PASS |
| GitHub Actions syntax | `actionlint .github/workflows/*.yml` | PASS |
| Release/asset focused tests | `node --test tests/release-closure.test.mjs tests/asset-lane-separation.test.mjs` | 10/10 PASS |
| Asset lanes | `python3 scripts/validate-asset-lanes.py --json --allow-missing-candidates` | 198 files, 0 violations |
| Full Node regression | `node --test 'tests/**/*.test.mjs'` | 266 total: 241 pass, 24 fail, 1 skip |
| HUD in-game browser | `node tests/defense-hud-responsive-browser.cjs` | PASS |
| Performance browser | `node tests/defense-performance-browser.cjs` | PASS; DOM 79, input <=0.3ms, rAF mean 16.67–17.22ms |
| Portrait/browser layout | `node tests/defense-portrait-viewport-browser.cjs` | PASS |
| World presentation | `node tests/world-presentation-browser.cjs` | PASS |
| Public browser contract | `node tests/defense-public-contract-browser.cjs` | PASS |
| Main survivor playthrough | `node tests/defense-survivor-browser.cjs` | FAIL; growth offer absent after the opening route, 30s timeout |
| Soak smoke | `SOAK_REVISION=<HEAD> SOAK_MS=60000 SOAK_TEST_MODE=1 SOAK_SELF_HOST=1 node tests/defense-soak-browser.cjs` | FAIL; lobby did not expose `#start-defense` |
A direct Playwright probe against the same static server found `#start-defense` visible/enabled after a 3-second settle at 1280x720 with no page or console errors; the soak failure therefore remains a timing/readiness failure in the soak scenario, not evidence that the lobby is permanently absent. A 30-second 390x844 smoke after starting still ended at `전투 종료` without exposing the growth offer.

## Failure groups

1. The current uncommitted `defense-catalog.js` and `rpg-catalog.js` changes do not match the signed regression contract: occupation recovery/growth/telemetry routes fail, a companion-down timing assertion moved, and TURRET exposes one FRONT companion while the signed contract requires zero.
2. The in-game growth route does not reach `#defense-growth-offer`, so the main survivor journey cannot be called playable.
3. The full route includes missing historical fixtures under `_workspace/20260725-defense-rpg-development/` and `_workspace/20260722-abyssal-command-bmad-gds-expansion/`; the G2 CLI tests fail closed with `ENOENT`.
4. The current Stage 2 retrospective is REDO and the Stage 1b scope review is DRAFT/NO GO. The next public beat is explicitly deferred.

## Scheduling audit

- **macOS LaunchAgent:** `com.abyssalsurge.studio-loop` is loaded, configured for every hour at minute `00`, currently `state = not running` with `active count = 0`. Its script targets the separate `Abyssal-Surge-studio-loop` worktree. The driver can auto-push `studio-loop/main` only after its own green-suite gate.
- **GitHub Actions:** `.github/workflows/pr-guard.yml` contains `*/30 * * * *`. `.github/workflows/static.yml` has no cron schedule; it runs on `push` to `main` or manual dispatch.
- **No local cron/at jobs:** `crontab -l` has no entries and `atq` is empty.

No scheduler was unloaded or deleted during this audit.
