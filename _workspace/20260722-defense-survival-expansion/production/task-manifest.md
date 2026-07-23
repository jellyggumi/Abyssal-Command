# Production Task Manifest — 20260722 defense-survival expansion

| role | owner | lane | artifact | gate | status |
|---|---|---|---|---|---|
| director | game-production-director | intake/arbitration | `intake/production-brief.md`, `production/decision-log.md`, `retrospectives/cycle-1-retrospective.md` | G1/G6 | complete — Stage 1 FIX entered with evidence gaps explicit |
| designer | game-designer | canon/balance/loop/presentation | `design/{concept,worldview,balance-sheet,core-loop,novelty-scorecard,presentation-spec}.md` | G1/G2/G7/G8 | complete — evidence gates pending |
| PM | game-pm | reward economy | `pm/{revenue-map,reward-bands,negotiation-record}.md` | G5 | complete — no-commerce contract |
| programmer | game-programmer | deterministic engine | source + automated test receipt | G2/G6 | partial — cutscene observer and browser regression passed; browser performance measurement pending |
| QA | game-qa | regression/gates | `qa/{test-plan,gate-measurements}.md` | G1–G8 | partial — measurement plan and honest gate state filed |
| systems designer | gameplay-systems-designer | item/growth/reward tables | `defense-catalog.js`, `design/balance-sheet.md` | G2/G7 | complete — current implementation mirrored |
| narrative director | narrative-cinematics-director | canon cutscene beats | `defense-catalog.js:CUTSCENES`, `design/worldview.md` | G1/G8 | partial — complete trace audit pending |
| technical artist | technical-artist-2d5d | texture/2.5D contract | `engineering/resource-manifest.md`, `design/presentation-spec.md` | G4/G6 | partial — provenance policy filed; no new generation |
| animation rigger | animation-rigger | frame/pivot validation | `qa/animation-ledger.json` | G4 | pending — tool/instrumentation required |
| audio designer | audio-designer | cue map | `defense-catalog.js:AUDIO_CUES` | G4/G6 | partial — runtime cue data exists; browser audio test pending |
| VFX designer | vfx-designer | reduced-motion-safe effects | `design/presentation-spec.md` | G4 | partial — specification filed; panel measurement pending |
| release engineer | release-build-engineer | Pages/release receipt | `ops/{telemetry-contract,release-readiness}.md` | G6 | pending — browser soak and release build required |
| playtest researcher | playtest-researcher | browser/video evidence | `qa/playtest-report.md` | G7/G8 | pending — human sessions and video capture required |

## Stage policy

- **Stage 1:** freeze canon, implement item/reward contracts, wire passive textured presentation and audio.
- **Stage 2:** run deterministic balance and regression checks, then tune only catalog constants.
- **Stage 3:** run browser smoke, build the Pages artifact, capture a local playable video, and report any unpassed gate explicitly.

A gate is PASS only with a command, file, or browser evidence path. Blender timeout and missing external audio/video credentials remain explicit blockers, not silent passes.
