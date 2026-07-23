# Release readiness

## Verdict

**NOT READY — Stage 1 FIX is open.** The immutable reference checked here is Git `dd49f9e13f081bf4390e1c47f836eda24b751fae` (`defense-survivor-v1`), but the active worktree contains uncommitted integration work. No current row below authorizes deployment, release promotion, or a release-ready claim.

`PASS` means the cited, immutable check met its threshold. `FIX` means an implementation or evidence artifact exists but violates or only partially covers the threshold. `BLOCKED` means required evidence cannot yet be collected truthfully. Every checklist row has one of these results.

## Frozen-candidate and Pages checklist

| check | result | evidence |
|---|---|---|
| full reference SHA recorded | PASS | `git rev-parse HEAD` returned `dd49f9e13f081bf4390e1c47f836eda24b751fae` |
| integration candidate frozen | BLOCKED | worktree remained dirty while implementation lanes were active; this reference is not the pending integrated candidate |
| clean candidate worktree | BLOCKED | 2026-07-22 read-only audit observed 29 changed/untracked status rows |
| current-HEAD Pages allowlist files exist | PASS | all 26 workflow allowlist paths exist in the recorded HEAD |
| current-HEAD module closure is allowlisted | PASS | recorded HEAD `app.js` closure contains 9 allowlisted modules and no out-of-list imports |
| active-worktree module closure is allowlisted | FIX | worktree closure adds `defense-cutscene.js` and `defense-telemetry.js`; neither is in `PAGES_RUNTIME_PATHS`, Pages smoke requirements, or current SW precache |
| generated release identity | PASS | static contract: package job generates `version.json` and `validate-pages-version.mjs` enforces full candidate SHA plus `defense-survivor-v1` |
| release DAG/action pinning | PASS | `node --test tests/release-closure.test.mjs`: 2 tests, 0 failures on 2026-07-22 |
| current-HEAD staged artifact smoke | PASS | reference-only evidence: existing receipt records exact allowlist artifact plus `node tests/pages-artifact-smoke.cjs --dir .pages-artifact`; temporary artifact was removed |
| integrated artifact smoke | BLOCKED | must be rebuilt from the frozen integration SHA after allowlist/SW closure is updated |
| service-worker cache versioning | FIX | `sw.js` uses fixed `abyssal-command-defense-survivor-v2`; it is not candidate-SHA-derived and cannot guarantee cache-coherent rollback |
| service-worker core closure | FIX | active runtime imports cutscene/telemetry modules that current `CORE_ASSETS` does not precache |
| PWA manifest/icons | PASS | reference-only evidence: manifest points to SVG, 192 px, and 512 px icons present in the current-HEAD allowlist |
| GitHub Pages deployment | BLOCKED | no deployment run was performed; deployment was prohibited while implementation lanes were active |
| deployed clean-browser smoke | BLOCKED | requires deployed URL, frozen SHA, version match, portrait/landscape run start, and zero errors |
| deployed upgrade-client smoke | BLOCKED | requires a browser already controlled by the preceding SW; current fixed cache namespace prevents a truthful pass |

### Exact current Pages allowlist

The archive allowlist in `.github/workflows/static.yml` contains exactly these 26 repository paths:

```text
index.html
app.js
defense-viewport.js
defense-catalog.js
defense-run-simulation.js
campaign-state.js
defense-storage.js
defense-audio.js
battle-realtime-three.js
battle-visualizer.js
styles.css
react-game-ui.css
sw.js
manifest.json
icon.svg
privacy.html
assets/icons/icon-192.png
assets/icons/icon-512.png
assets/images/battle/dusk-warden-frame-00.png
assets/images/battle/dusk-warden-frame-01.png
assets/images/battle/dusk-warden-frame-02.png
assets/images/battle/dusk-warden-frame-03.png
assets/images/battle/echo-rusher-frame-00.png
assets/images/battle/echo-rusher-frame-01.png
assets/images/battle/echo-rusher-frame-02.png
assets/images/battle/echo-rusher-frame-03.png
```

`version.json` is generated after archive extraction and is the only additional file. At integration freeze, the exact allowlist must equal the frozen runtime/static closure—not a broader directory copy. At minimum, the active worktree currently requires `defense-cutscene.js` and `defense-telemetry.js` to be added everywhere the release and SW closure is asserted. Re-run:

```sh
node --test tests/release-closure.test.mjs
node tests/pages-artifact-smoke.cjs --dir .pages-artifact
node scripts/validate-pages-version.mjs --file .pages-artifact/version.json --sha "$(git rev-parse HEAD)"
```

The artifact must contain only the allowlist plus generated `version.json`; missing and extra files both fail.

### Service-worker release rule

Before deployment, packaging must stamp the full candidate SHA into cache name `abyssal-command-defense-survivor-<candidate_sha>`. The cache suffix, `version.json.candidate_sha`, checked-out revision, and release receipt SHA must be identical. Activation may delete only stale caches with that product prefix, and deployed smoke must cover clean and already-controlled contexts. Detailed recovery and stop conditions are in `ops/rollback-runbook.md`.

## Runtime, movement, telemetry, and performance checklist

| check | result | evidence |
|---|---|---|
| deterministic 60 Hz simulation baseline | PASS | reference-only evidence: earlier six targeted suites failed 0; strict 30-stage/3-seed simulation reported 0 failures |
| short responsive browser probes | PASS | QA reran HUD (5 viewports), survivor journey, and performance probe on 2026-07-22; 60 rAF intervals at both viewports averaged 16.665 ms, max 16.8 ms, input 0–0.1 ms, 33 DOM nodes |
| active-worktree deterministic regression | FIX | latest QA run failed 9/23 simulation/campaign tests after combat integration; elite extraction, final victory/rewards, active-skill offer, event ordering, and fallback-cutscene expectations are affected |
| active-worktree balance | FIX | strict simulator’s internal flag did not enforce release balance; fresh seed-17 five-archetype × ten-stage probe was 0/50 wins, outside 45–55% |
| frame p95 ≤16.7 ms over 30 min | BLOCKED | no `durationMs: 1800000` full-SHA soak artifact |
| long frames <0.5% over 30 min | BLOCKED | no full soak using >33.4 ms long-frame definition |
| 30-minute stable heap | BLOCKED | no first/last five-minute medians or heap-slope artifact |
| input feedback ≤100 ms over soak | BLOCKED | short probe passes, but no 30-minute p95/max evidence on frozen candidate |
| movement/path-pressure contract | BLOCKED | no frozen traces for ten distinct chokepaths/flanks/elevation/hazards/points, deterministic wave patterns, or all six enemy policy intents |
| telemetry observer boundary | FIX | mutable worktree module is bounded/offline-only and app observes it, but integration is not frozen and Pages/SW closure omits it |
| telemetry UI export | FIX | mutable browser smoke reports `#export-telemetry` downloads `abyssal-defense-telemetry.json`; direct sample `engineering/defense-telemetry-sample.json` is schema v1 with 18 records, but no frozen-candidate UI-downloaded sample exists |
| audio observer safety | PASS | narrow evidence: audio lane reports syntax pass, no-WebAudio no-throw, 1,000-cue cap 62/64 nodes, stop to 0, and 12-event manifest coverage in `engineering/audio-detail-report.md` |
| full presentation gate | BLOCKED | five-scene immersion/reduced-motion panel and ≤100 ms feedback session evidence remain absent |

The exact 1,800,000 ms command and thresholds are in `engineering/perf-budget.md`; movement/path thresholds and commands are in `engineering/movement-optimization.md`. Mutable short probes must be rerun after the candidate SHA is frozen.

### Telemetry export check

For the frozen candidate, use Playwright against a local or artifact server to start a run, admit movement, select available growth/extraction/reward controls until the lobby returns, then capture the browser download from `#export-telemetry` as `results/abyssal-defense-telemetry-<full-sha>.json`. Validate it with:

```sh
export SHA="$(git rev-parse HEAD)"
export TELEMETRY=\"results/abyssal-defense-telemetry-${SHA}.json\"
jq -e '
  .format == \"abyssal-defense-telemetry\" and
  .schemaVersion == 1 and
  .scope == \"offline-local-debug\" and
  .privacy == {
    \"playerIdentifiers\": false,
    \"networkTransport\": false,
    \"persistentStorage\": false
  } and
  (.bounds.maxRecords >= .bounds.retainedRecords) and
  (.records | type == \"array\" and length > 0) and
  (any(.records[]; .type == \"RUN_STARTED\")) and
  (any(.records[]; .type == \"INPUT_VISIBLE\")) and
  (any(.records[]; .type == \"FRAME_PROBE\")) and
  (any(.records[]; .type == \"RUN_RESULT\"))
' \"$TELEMETRY\"
```

The browser Network panel must show no telemetry request. An empty export, a Node-only synthetic object, or an export from a different SHA does not pass.

## Gameplay and gate checklist

| check | result | evidence |
|---|---|---|
| G1 worldview/canon | FIX | `qa/lore-audit.md` inventories 88/88 named-group entries but reports eight lore/continuity violations, five presentation/data gaps, and incomplete all-player-facing copy coverage |
| G2 balance | FIX | latest integrated probe is 0/50 wins and 9/23 affected tests fail; boss TTK ±15%, combo EV ≤1.3× median, and HP/damage/speed/density/spawn matrix also remain incomplete |
| G3 archetype diversity | FIX | five automated controllers were exercised across ten stages but all were 0% win in the latest integrated probe, so ≥3 viable is not met |
| G4 immersion/feedback | FIX | cutscene/browser and narrow audio evidence exist; five-scene median ≥4/5, reduced-motion panel, and full latency evidence are missing |
| G5 fairness | FIX | scope has no commerce/accounts/network, but comeback ≤30% and 10–20-session parity evidence remain absent |
| G6 operations | BLOCKED | Pages integration closure, SHA-derived SW, telemetry export, deployed smokes, and 30-minute soak remain open |
| G7 core loop | FIX | target is Gate defense → Echo recovery → growth → occupation/extraction → boss kill; current affected tests fail extraction/victory/reward/skill paths and no frozen ≥70% repeat evidence exists |
| G8 hook/novelty | FIX | bounded official-source survey found the complete hook in 0/5 comparables (frequency arm passes), but five human impressions averaging ≥4/5 are absent |
| ten playable stages | BLOCKED | strict stage simulation is not a player/browser receipt for all ten distinct stage runs |
| seeded wave/enemy pressure | BLOCKED | no frozen trace proves scout/pressure/flank/ranged/elite/boss patterns and gate/player/flank/denial/escort/low-HP policies |
| progression separation/current → upgraded values | FIX | mutable worktree telemetry/UI additions exist; frozen evidence for separate items, three-choice skills, stats, synergies, companions, stage rewards, and Archive growth is absent |
| rollback procedure | PASS | documented/static evidence: `ops/rollback-runbook.md`; workflow closure and ancestry guards passed |
| actual rollback recovery | BLOCKED | no dispatch, prior-client cache test, save compatibility session, or recovery receipt |

## Generated-resource and tool checklist

| check | result | evidence |
|---|---|---|
| existing asset manifest | PASS | technical-art lane reports `node scripts/build-defense-asset-manifest.mjs --write` plus asset-manifest test 1/1 |
| GodTiboImagen capability | PASS | dry-run-only evidence; no generated runtime asset was ingested |
| PerfectPixel image pilot | BLOCKED | provider `god-tibo-imagen` rejected before submission and required `extractMethod: none` is unavailable; `assets/images/battle/pilot/blocked-verification.json` |
| Blender/animation validation | BLOCKED | interactive and background MCP attempts timed out; local Blender is absent; no production-rig artifact exists |
| optional generated-media provenance | PASS | no-ingestion evidence: no generated file was added to runtime; optional media failure cannot block simulation/input |
| new gameplay capture | BLOCKED | no frozen-candidate public-beat recording and content ledger |
| existing smoke video container | FIX | `ffprobe` confirms H.264 1280×720 at 25 fps, 22.88 s, with no audio stream; it is below the 30–180 s public-beat range and does not prove the required loop |

## Gameplay-video validation

The release recording must be from the frozen local artifact or deployed candidate and must include a visible revision in its sidecar ledger. Required content, with monotonically increasing timestamps, is:

1. Gate defense and real defeat pressure;
2. Echo recovery/harvest;
3. a three-choice growth decision with current → upgraded value;
4. occupation or elite extraction whose movement/range/recovery effect is visible;
5. boss kill, stage reward, and persistent Archive/companion result.

Validate container integrity and media thresholds:

```sh
export VIDEO='results/abyssal-defense-public-beat.mp4'
export LEDGER='results/abyssal-defense-public-beat.validation.json'
export SHA="$(git rev-parse HEAD)"
ffmpeg -v error -i \"$VIDEO\" -f null -
ffprobe -v error -show_streams -show_format -of json \"$VIDEO\" > \"${VIDEO}.ffprobe.json\"
jq -e '
  (.format.duration | tonumber) >= 30 and
  (.format.duration | tonumber) <= 180 and
  any(.streams[]; .codec_type == \"video\" and .codec_name == \"h264\" and .width >= 1280 and .height >= 720) and
  any(.streams[]; .codec_type == \"audio\" and (.codec_name == \"aac\" or .codec_name == \"opus\") and (.sample_rate | tonumber) >= 44100)
' \"${VIDEO}.ffprobe.json\"
jq -e --arg sha \"$SHA\" '
  .candidate_sha == $sha and
  .source == \"frozen-local-or-deployed\" and
  ([.beats.gate_defense, .beats.echo_recovery, .beats.growth,
    .beats.occupation_or_extraction, .beats.boss_kill,
    .beats.stage_reward, .beats.archive_or_companion] | all(type == \"number\")) and
  ([.beats.gate_defense, .beats.echo_recovery, .beats.growth,
    .beats.occupation_or_extraction, .beats.boss_kill,
    .beats.stage_reward, .beats.archive_or_companion] as $t |
    all(range(1; $t | length); $t[.] > $t[. - 1])) and
  .debug_overlays == false and
  .network_dependency == false and
  .reviewed_audio == true and
  .reviewed_legibility == true
' \"$LEDGER\"
```

`ffprobe` proves decodability and technical metadata only. The timestamp ledger plus human playback review prove that the required gameplay beats are visible, legible, audible, and from the candidate SHA.

## Release decision rule

Release remains **NOT READY** while any Stage 1 defect is open, any checklist row is `FIX`/`BLOCKED`, the integration revision is mutable, Pages/SW closure differs from the frozen app, the rollback upgrade-client path is unverified, the 30-minute soak is absent, or the gameplay-video checks fail. Short automated checks are regression evidence, not substitutes for the required public-beat gates.