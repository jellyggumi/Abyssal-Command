# Release and deployment plan — static browser game

**Mode:** release hardening / operator runbook  
**Status:** prospective. This plan authorizes no deployment and records no launch, gate, rights, accessibility, privacy, or performance pass. The current Stage 1 disposition remains release denied; `qa/gate-measurements.md` is authoritative for G1–G8 status.

## Scope and decision boundary

This plan tells release operators how to promote or roll back the existing GitHub Pages static artifact after the required implementation and evidence exist. It covers the deployed static browser game only. It does **not** change `.github/workflows/static.yml`, deploy a revision, approve third-party rights, or infer player outcomes from a successful workflow.

| Release profile field | Bound value / current source of truth |
|---|---|
| Runtime | Offline deterministic 60 Hz single-player browser defense-survivor; simulation and `defense-catalog.js` remain authoritative. |
| Provider and exposure | GitHub Pages project-site workflow, `.github/workflows/static.yml`; the expected project URL is the workflow output `page_url`, not a manually assumed URL. |
| Artifact | `.pages-artifact` is built from the pinned commit's `PAGES_RUNTIME_PATHS` plus generated `version.json`. `pages-bundle` is the regular downloadable inspection artifact; `actions/upload-pages-artifact` separately uploads the Pages deployment input (default name `github-pages`) from the same directory. No untracked worktree file is eligible. |
| Promotion model | Direct Pages deployment of one pinned commit/artifact; this is not same-artifact promotion across multiple application environments. Record that limitation in the release receipt. |
| Rollout strategy | Replace only, after every named job in the release DAG succeeds. No canary, cohort, remote flag, analytics, or runtime experiment assignment is allowed. |
| Current launch decision | **BLOCKED.** G1, G4, and G6 are `NOT MEASURED` / `NOT PASSED`; the rest are also not passed. |

## Required release tuple and evidence record

Before a human can authorize a release, the release owner creates a local, reviewable release record containing the following exact values from one candidate. A missing value is `BLOCKED`, never inferred from branch name or a Pages badge.

| Field | Source / command or artifact | Owner |
|---|---|---|
| `sourceRevision` / `candidateSha` | `results/resolve_revision.json`; full lowercase 40-character commit SHA | Release operator |
| `buildId`, `MapPlanReplayCorpusVersion`, `targetDeviceBrowserViewport` | Exact values required by `ops/release-readiness.md`; QA evidence headers and target-device trace metadata | Engineering + QA |
| Rules/catalog/grammar/serializer/map/wave versions and fixture IDs | Pinned tuple required by `ops/release-readiness.md`; matching QA evidence headers | Engineering + QA |
| Static artifact identity | `pages-bundle` inspection artifact, `github-pages` Pages deployment artifact, `results/package_pages.json`, and `.pages-artifact/version.json` | Release operator |
| Deployment identity | GitHub Actions run URL; `page_url` directly from the `deploy_pages` job output; `results/deploy_pages.json` status/SHA receipt; `results/release_receipt.json` persisted URL/SHA receipt | Release operator |
| Resource identity | Asset-manifest version/hash and the sanitized per-asset provenance/rights records; no private request or credential is attached | Audio/resource owner |
| Reviewer and decision | Named independent reviewer, timestamp, a current `BLOCKED` verdict or a future evidence-complete recommendation, and all evidence links. Neither value authorizes deployment. | Release owner |

The workflow is already designed to upload result artifacts even when a job fails. Preserve those receipts rather than replacing them with a summary. GitHub Actions describes artifacts as workflow data that can be shared across jobs and retained after a run; that supports this plan's evidence chain but does not prove game quality by itself [GH-ARTIFACTS].

## Gate linkage and release decision

A successful Pages workflow proves only its own declared workflow jobs. It does not change production-cycle gates. The release owner must bind the evidence below to the exact release tuple and obtain independent review before changing the authorization state.

| Gate | Release-relevant condition | Required evidence | Release consequence |
|---|---|---|---|
| **G1 — narrative/worldview consistency** | All player-visible strings, narration/captions, effects, W-01…W-05 handoffs, and Stage-10 terminality match canon. | `qa/evidence/gates/G1-narrative-canon-audit.json` and `qa/narrative/stage-world-linkage-audit.json` | Missing, mismatched, or unreviewed canon audit blocks release; a correct `version.json` is not a substitute. |
| **G4 — effects and animation immersion/readability** | Meaning survives normal, reduced-motion, muted, missing-audio, and fallback-renderer paths; no essential state is color-, sound-, motion-, or haptic-only. | `qa/evidence/gates/G4-presentation-readability-and-playtest.json`, `qa/accessibility/control-and-feedback-audit.json`, `qa/accessibility/audio-vfx-fallback-capture.json`, and `qa/replay-corpus/audio-observer-differential.json` | Any unreadable semantic state, unresolved S1/S2 finding, or failed fallback blocks release and may require asset-only rollback. |
| **G6 — operations, performance, telemetry** | Local-only/no-network operation, release/rollback evidence, target-device performance, 30-minute allocation/memory soak, and local choice/export integrity satisfy the approved targets. | `qa/evidence/gates/G6-ops-perf-and-local-telemetry.json`, `qa/performance/{tick-backlog-trace,input-chain-trace,frame-samples,presentation-delta,allocation-soak,vfx-density-audit,audio-cue-audit}.json`, `qa/accessibility/flash-analysis.json`, `qa/telemetry/choice-commit-chain.json`, `qa/ops/network-disabled-export-trace.json`, and `qa/ops/rollback-recovery-report.json` | Any absent trace; p95 frame interval >16.7 ms; >=0.5% frames >33.4 ms; input admission p95 >2 ticks; input-to-presented p95 >100 ms; presentation-added movement latency p95 >1 frame; positive allocation or retained-memory slope; paired VFX CPU >2.0 ms or GPU >2.5 ms p95; rank-4 >6 emitters or >2 aggregate labels/500 ms in 160dp; rank-4 coverage >18% viewport or >8% protected zone; basic impacts >1 candidate/125 ms or >8 emitted/s; overlapping non-emergency narration or <8 s between lines; >3 flashes/s; unreported backlog drop; incomplete choice chain; or network/transport dependency blocks release. |

**Current gate state:** the paths above are future targets and no gate has passed. Until their matching reports exist and are independently reviewed, the only valid decision is **BLOCKED — do not deploy**.

## Stage 3 release-evidence admission matrix

This is an evidence-admission checklist, not a release command. Every path below is a **required future evidence location** unless it is explicitly described as a current incomplete receipt. A numeric target is not a measured result. The package remains **BLOCKED — do not deploy** until one exact tuple binds every row, a reviewer verifies it, and a separate authorized release process decides whether to act.

| Scope | Owner | Verification method | Required evidence path | Exact blocker |
|---|---|---|---|---|
| G1 canon/world | Narrative owner + QA | Audit the candidate’s player-visible strings, W-01…W-05 payloads, captions, effects, and Stage-10 negative path against the canon; independently compare report tuple/hash. | `qa/evidence/gates/G1-narrative-canon-audit.json`; `qa/narrative/stage-world-linkage-audit.json` | Missing report, untraced/contradictory fact, Stage-11 continuation, tuple mismatch, or absent independent review. |
| G2 rules/balance | Systems owner + Game QA | Complete the approved full-G2 preregistration and paired equal-budget full-route/matchup sweep; preserve TTK, combo-comparator, coverage, EV, cooldown-share, failure rows, and threshold decision. | `qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl` | The canonical JSONL exists and is integrity-valid for a bounded 5-profile × 3-seed / 360-tick Cinder Span diagnostic. XR-13/XR-14 are resolved for that observation surface, but its `INCOMPLETE / NOT_PASSED` manifest lacks the preregistered full-route/matchup, TTK, combo, coverage, and threshold evidence; G2 remains **NOT MEASURED / NOT PASSED** and release remains **BLOCKED — do not deploy**. |
| G3 diversity | Systems/design owner + Game QA | Evaluate five archetypes over matched seed/card families and recorded movement policies; independently reconcile stratified outcomes with moderated records. | `qa/evidence/gates/G3-archetype-rotation-and-playtest.jsonl` | Missing fixture corpus, missing moderated records, pooled-mean-only conclusion, dominance/viability breach, tuple mismatch, or unreviewed data. |
| G4 feedback/readability | Feedback/accessibility owner + Game QA | Capture standard, reduced-motion, muted, missing-audio, and fallback-renderer runs; measure source-to-presentation latency and complete the counterbalanced readability/immersion study. | `qa/evidence/gates/G4-presentation-readability-and-playtest.json`; `qa/accessibility/control-and-feedback-audit.json`; `qa/accessibility/audio-vfx-fallback-capture.json`; `qa/replay-corpus/audio-observer-differential.json` | Missing capture/study, unresolved S1/S2 defect, essential color/sound/motion/haptic-only meaning, observer divergence, threshold breach, or absent independent review. |
| G5 fairness/no-commerce | Progression/PM owner + Game QA | Verify no paid path, then run reward, idle, account-parity, and 10/20-session property evidence without hidden odds or return-only combat outcome. | `qa/evidence/gates/G5-no-commerce-fairness-and-idle.jsonl` | Missing property/session export, paid path, hidden chance, duplicate/false grant, parity breach, tuple mismatch, or unreviewed evidence. |
| G6 operations/performance/telemetry | Performance/release owner + QA | On each named target device/browser/viewport, collect warm-up and dense 90-second runs, a 30-minute allocation/retained-memory soak, tick/backlog/input/presentation traces, local export/delete, and network-disabled evidence. | `qa/evidence/gates/G6-ops-perf-and-local-telemetry.json`; `qa/performance/{tick-backlog-trace,input-chain-trace,frame-samples,presentation-delta,allocation-soak,vfx-density-audit,audio-cue-audit}.json`; `qa/accessibility/flash-analysis.json`; `qa/telemetry/choice-commit-chain.json`; `qa/ops/network-disabled-export-trace.json`; `qa/ops/rollback-recovery-report.json` | Any absent named-device trace, p95 frame interval >16.7 ms, >=0.5% frames >33.4 ms, input admission p95 >2 ticks, input-to-presented p95 >100 ms, tick/backlog loss, positive retained-memory slope, transport/provider surface, failed recovery, tuple mismatch, or unreviewed evidence. |
| G7 core loop | Design/playtest owner + Game QA | Bind a 30–180-second deterministic fixture, >=3 actions, >=1 reward, offer/commit chain, and preregistered moderated voluntary-repeat result to the candidate tuple. | `qa/evidence/gates/G7-loop-trace-and-repeat-study.jsonl` | Missing fixture/participant record, non-voluntary proxy, absent result/return trace, target breach, tuple mismatch, or unreviewed evidence. |
| G8 novelty | Narrative/PCG owner + Game QA | Reconcile the five-comparable ledger with a fixed-seed implemented slice and a QA impression session; review provenance and score records. | `qa/evidence/gates/G8-novelty-comparison-and-impression.json` | The current artifact explicitly records no human impression session and G8 **NOT PASSED**; missing session, insufficient comparison, target breach, tuple mismatch, or unreviewed evidence blocks release. |
| Pinned tuple and independent review | Release owner + independent reviewer | Hash and compare every evidence header with one `buildId`, full `sourceRevision`/candidate SHA, rules/catalog/map/wave/serializer versions, replay corpus version, asset-manifest version/hash, named device/browser/viewport, fixture IDs, and report hashes. The reviewer must not author the candidate or the evidence under review. | `ops/release-records/<buildId>/tuple-and-independent-review.json` | Any absent/mutable/short revision, missing tuple field, hash/header mismatch, self-review, unsigned review, or use of evidence from another candidate. |
| Asset provenance admission | Technical-art/audio owner + rights reviewer | Admit only final content-addressed same-origin bytes after per-asset SHA-256, decoded measurements, fallback, sanitized provenance, terms date/URL, rights decision, and compiled-output provider/secret/remote-path scan. | `qa/resource-audit/resource-manifest-validation.json`; `qa/resource-audit/media-measurements.json`; `qa/resource-audit/runtime-provider-scan.json` | Any missing rights/provenance/hash/measurement/fallback, mutable or remote path, provider host/SDK/token/private URL/raw response, or unreviewed byte replacement. Current tool constraints remain blockers: gti is dry-run only; ppgen has no compatible provider; Blender inspection timed out; ElevenLabs credentials/rights are unavailable; Vox lacks an approved beat map. |
| Browser accessibility/performance proof | Accessibility + performance owners + QA | Preserve browser-produced proof for the same candidate on the named device/browser/viewport: keyboard/focus and reduced-motion/muted fallback capture plus frame/input/backlog evidence. CI viewport output is supplemental, not a device substitute. | `qa/browser-proof/<buildId>/accessibility-performance-browser-proof.json`; linked G4/G6 paths above | Browser proof absent, wrong tuple, target device/browser/viewport missing, focus/fallback failure, or CI-only proof offered as target-device evidence. |
| Local playable-video proof | QA capture owner + accessibility reviewer | Record local playback of the packaged candidate using the pinned fixture; retain a content hash, tuple metadata, mode/device/viewport, start-to-terminal sequence, and caption/fallback state. The recording proves playback only, not quality, rights, accessibility conformance, or a gate pass. | `qa/browser-proof/<buildId>/local-playable-video-proof.json`; `qa/browser-proof/<buildId>/local-playable-video.webm` | Missing recording/metadata/hash, non-local or wrong build playback, missing pinned fixture/caption-fallback state, or any attempt to treat video as a gate substitute. No such proof currently exists. |
| GitHub Pages deployment and rollback prerequisites | Release operator + independent reviewer | Before any separate deployment decision, verify the externally supplied workflow/repository settings can package one immutable artifact, emit the candidate SHA and `page_url`, retain `package_pages`, `artifact_smoke`, `deploy_pages`, deployed-smoke, and release receipts, and accept a prior known-good full SHA for rollback. This workspace does not contain a workflow receipt or Pages configuration. | `ops/release-records/<buildId>/github-pages-prerequisites.json`; later workflow `results/{resolve_revision,package_pages,artifact_smoke,deploy_pages,deployed_smoke,release_receipt}.json`; rollback `qa/ops/rollback-recovery-report.json` | Missing workflow/config/permissions/environment/receipt, guessed URL, artifact/SHA mismatch, no qualifying prior tuple, failed deployed smoke/recovery, or any attempt to deploy from this evidence package. |

### Exact blocker semantics

| Marker | Meaning | Required disposition |
|---|---|---|
| `TARGET` / `PROPOSED` | A planned threshold, path, or method; it is not a result. | **BLOCKED — do not deploy.** |
| `MISSING` | The named report, recording, receipt, or tuple field does not exist. | **BLOCKED — do not deploy.** |
| `INCOMPLETE` | A receipt exists but explicitly does not meet the named evidence contract. This is the current G2 integrity-only receipt and G8 no-human-session artifact. | **BLOCKED — do not deploy.** |
| `TUPLE_MISMATCH` | Any evidence header/hash/device/fixture/asset-manifest/version differs from the pinned candidate. | **BLOCKED — do not deploy; preserve evidence and investigate.** |
| `FAILED` | A threshold, exclusion, browser proof, asset admission, deployed smoke, or rollback recovery requirement failed. | **BLOCKED — do not deploy; follow `ops/rollback-runbook.md` if a prior deployment is affected.** |
| `UNREVIEWED` | Required independent review is missing, self-authored, unsigned, or not bound to the tuple. | **BLOCKED — do not deploy.** |
| `EVIDENCE-COMPLETE` | A future reviewer finding that every named row is present and tuple-matched. | It is an input to a separate authorized decision only; this document still does not authorize deployment. |

The only current package state is `BLOCKED`: G1–G8 remain `NOT MEASURED / NOT PASSED`; G2 is integrity-only and G8 remains incomplete. `ops/rollback-runbook.md` governs recovery actions; a successful rollback changes no gate state.

## Preflight checklist

Run this checklist against a candidate only after all required implementation evidence is available. Commands below are expected evidence-producing commands; this document does not execute them.

| # | Owner | Check and command/artifact expected | Stop condition |
|---:|---|---|---|
| P1 | Release operator | Confirm the candidate is a full 40-character lowercase SHA on `main`; record the SHA and intended run URL. For a rollback, the existing workflow accepts only a SHA that is an ancestor of `origin/main`. | Short SHA, mutable branch label, non-ancestor rollback SHA, or missing candidate record. |
| P2 | Engineering | Run the existing release closure gate: `node --test tests/release-closure.test.mjs`. Expected: exit 0, which verifies the Pages release DAG, pinned actions, allowlist closure, candidate-version contract, and receipt logic. | Nonzero exit or a proposed runtime path absent from the tested allowlist. |
| P3 | QA | Run the existing CI Chromium viewport checks: `node tests/defense-hud-responsive-browser.cjs`, `node tests/defense-survivor-browser.cjs`, and `node tests/defense-performance-browser.cjs`. Expected: their browser-contract artifact receipts plus `results/browser_contract.json`; bind candidate identity through the matching `results/resolve_revision.json`. | Any command failure. This is CI viewport coverage only; a passing current probe alone does **not** satisfy G4 or G6 target-device evidence. |
| P4 | Release operator | Package and smoke the candidate artifact using the workflow's `package_pages` and `artifact_smoke` receipts. Expected: inspection `pages-bundle`, Pages deployment artifact `github-pages`, `results/package_pages.json`, `results/artifact_smoke.json`, and `.pages-artifact/version.json` parsing to exactly `candidate_sha: "<SHA>"` and `rules_version: "defense-survivor-v1"`. | Missing artifact/receipt, extra or missing allowlisted file, unresolved `__CANDIDATE_SHA__`, or `version.json` mismatch. |
| P5 | QA + performance owner | Review the complete G6 packet: 60 Hz/no silent tick loss; target-device 30-minute allocation **and** retained-memory soak; input admission p95 ≤2 ticks and input-to-presented p95 ≤100 ms; frame p95 ≤16.7 ms and <0.5% >33.4 ms; presentation-added movement p95 ≤1 frame; paired VFX CPU/GPU p95 ≤2.0/2.5 ms; rank-4 ≤6 emitters and ≤2 aggregate labels per 500 ms in 160dp, coverage ≤18% viewport and ≤8% protected zone; basic-hit audio ≤1 candidate/125 ms and ≤8 emitted/s; no overlapping non-emergency narration and ≥8 s between lines; flash ≤3/s; plus tick/backlog, choice-commit, local export/delete, network-disabled, and rollback traces. Expected: every G6 evidence path in the gate table, bound to this tuple. | Any G6 numerical breach or unmeasured/missing evidence. Do not replace p95/paired measurements with average FPS. |
| P6 | Canon + accessibility owners | Review the complete G1/G4 packet. Expected: `G1-narrative-canon-audit.json`, `stage-world-linkage-audit.json`, G4 captures/accessibility evidence, and `audio-observer-differential.json` proving normal/reduced-motion/muted/missing-audio paths retain canonical outcome; canonical captions/transcripts, static/semantic fallbacks, keyboard/focus results, and no unresolved high-severity issue. | Any missing caption/status, focus failure, motion/sound/color-only essential state, canon mismatch, or observer differential. |
| P7 | Audio/resource owner + rights reviewer | Validate every newly shipped generated or imported resource against `engineering/resource-manifest.md`. Expected: `qa/resource-audit/{runtime-provider-scan,resource-manifest-validation,media-measurements}.json`; each asset has final SHA-256, decoded media measurements, content-addressed path, fallback ID, sanitized provenance, terms URL/date, rights decision, and approver. | Missing provenance/rights/fallback/hash; provider host/SDK/token/private URL/raw response in compiled output; unreviewed same-name byte replacement. |
| P8 | Privacy reviewer | Inspect `privacy.html` and the local telemetry/export evidence. Expected: no gameplay transport, analytics, account, cloud sync, remote cohort assignment, or consent-bypass claim; any explicit local diagnostic export remains user/facilitator initiated and deletable. | A runtime data transfer, prohibited identifier, automatic persistence contrary to the contract, or inaccurate privacy declaration. |
| P9 | Independent release reviewer | Compare every evidence header and report hash to the release tuple; record `EVIDENCE-COMPLETE` only when all P1–P8 are present and gate requirements have actually passed. This is not deployment authorization. | Reviewer is missing, author self-approves, any value is from another candidate, or the review is presented as authorization. |

## Cache and version strategy

The current service worker is the release cache contract; do not create an additional cache/version scheme during release.

| Surface | Existing behavior | Operator verification | Failure / response |
|---|---|---|---|
| Cache identity | `sw.js` replaces `__CANDIDATE_SHA__` during packaging and uses `abyssal-command-defense-survivor-<candidate SHA>`. | Inspect the packaged `sw.js`; run `node scripts/validate-pages-version.mjs --file .pages-artifact/version.json --sha <SHA>`. | Placeholder remains or cache name is not the candidate SHA: block package/deploy. |
| Static core assets | Install precaches the explicit `CORE_ASSETS`; activation removes old caches matching the project prefix and claims clients. | Run `node tests/release-closure.test.mjs`; exercise fresh install and an existing install after update in the deployed smoke evidence. | Missing required asset, stale project cache surviving activation, or update breaks offline load: block or roll back the whole pinned tuple. |
| Navigation | Navigation is network-first with cached `index.html` fallback; same-origin static assets are cache-first then network-first. | Record online reload, network-disabled reload after cache install, and cache-update result in the G6 packet. | Navigation serves a mixed revision, fails offline after a valid install, or changes deterministic outcome: block/rollback. |
| `version.json` | Never served from the service worker cache path; requests use `cache: "no-store"`. | Deployed smoke executes `node tests/deployed-defense-smoke.cjs --url "$PAGE_URL" --sha "$RESOLVED_SHA" --rules-version "defense-survivor-v1"`; expected exact candidate/rules values. | HTTP failure or JSON mismatch: treat as stale/wrong deployment and roll back. |
| Generated static media | Only reviewed, content-addressed same-origin files may enter the runtime allowlist/precache; static bundle is the immutable shipped output. | P7 resource scan/manifest/media receipts and exact artifact path listing. | A mutable URL, remote media URL, cache entry without approved provenance, or client-side generation: block/rollback. |

The service worker intentionally makes a new build observable through the candidate-stamped cache and uncached `version.json`. Cache behavior is a browser implementation detail and must be verified in the actual supported-browser smoke, not claimed from code inspection alone [MDN-CACHE].

## Release execution checklist

The following is a conditional GitHub Pages receipt checklist for a separately authorized release; this document does not grant that authorization.

| # | Owner | Action | Expected receipt | Abort / rollback trigger |
|---:|---|---|---|---|
| R1 | Release operator | Push the reviewed candidate to `main` through the approved change process, or use the existing `workflow_dispatch` rollback input only for a full qualifying SHA. Do not alter CI or manually upload files. | Actions workflow run begins with `resolve_revision` recording the candidate SHA. | Candidate differs from the reviewed tuple or input validation fails. |
| R2 | GitHub Actions (observed by release operator) | Allow the existing DAG to complete: `resolve_revision` → `engine_contract`, `release_closure`, `browser_contract` → `package_pages` → `artifact_smoke` → `deploy_pages` → `deployed_smoke` → `release_receipt`. | Named workflow artifacts and JSON result receipts; all upstream results are `success`. | Any job is failed, cancelled, skipped where success is required, or `release_receipt.all_gate_pass` is false. |
| R3 | Release operator | Capture `page_url` directly from the `deploy_pages` job output and save it in the release record; do not substitute a badge or guessed renamed-repository URL. | `results/deploy_pages.json` confirms deployment status and SHA; `results/release_receipt.json` persists the matching SHA and `page_url`. | Missing/mismatched URL or receipt. |
| R4 | Release operator + QA | Confirm the deployed smoke runs against that `page_url` and candidate SHA. | `results/deployed_smoke.json` reports job status/SHA `passed`; detailed `results/deployed-smoke.json` records matching candidate/rules version and viewport smoke. | Deployed smoke fails, is unsupported, or runs against another version. |
| R5 | Independent reviewer | Reconcile the resulting deployment receipt against P1–P9 and record `released` only after all gates and receipts are complete. | Signed release record with tuple, reviewer, timestamp, and receipt links. | Any mismatch; label candidate `BLOCKED`, not released. |

GitHub's official Pages action is intended to deploy an artifact uploaded earlier in the workflow and emits the deployment `page_url`; the existing workflow follows that artifact-to-deployment shape [GH-DEPLOY-PAGES]. The workflow's own receipts remain the repository-specific evidence source.

## Post-release checklist

Complete these checks after an actual deployment; they are not launch claims until a receipt exists.

| # | Owner | Check | Expected artifact / decision |
|---:|---|---|---|
| O1 | Release operator | Download/save the `release_receipt` and all job-result artifacts. Verify one candidate SHA across them. | Immutable release record with workflow run URL, `page_url`, SHA, rules version, deployment time, and artifact references. |
| O2 | QA | Run/review deployed smoke on the published `page_url`; test the exact `version.json`, supported mobile and desktop viewport smoke, and deterministic boot path. | `deployed-smoke-results` with matching tuple; failure starts rollback triage. |
| O3 | QA + performance owner | Reconcile and archive the **already completed** tuple-matched G6 target-device/30-minute evidence with the deployment receipt; do not use post-release work to backfill a gate. | Reviewed `qa/evidence/gates/G6-ops-perf-and-local-telemetry.json` and linked preflight traces referenced by the immutable release record. |
| O4 | Accessibility + audio owners | Reconcile and archive the **already completed** G1/G4 canon, reduced-motion, muted, missing/decode-failed media, keyboard/focus, and screen-reader evidence against the deployed tuple; deployment smoke supplements but does not replace it. | Complete G1/G4 preflight packet, including `qa/replay-corpus/audio-observer-differential.json` and `qa/accessibility/audio-vfx-fallback-capture.json`; defects trigger rollback triage. |
| O5 | Privacy reviewer | Reconcile and archive the **already completed** no-network and local export/delete evidence with the deployment receipt; recheck the page's limited hosting disclosure. | `qa/ops/network-disabled-export-trace.json`, `qa/telemetry/choice-commit-chain.json`, redaction/export-delete record, and privacy-page review; any discrepancy triggers rollback triage. |
| O6 | Release owner | Monitor only the workflow/deployment receipt and explicitly permitted local QA evidence. Do not add remote product analytics, tracking pixels, accounts, or telemetry to diagnose a release. | Close the release record as `verified`, `blocked`, or `rolled back`; no player-behavior claim without the separately required study. |

## Rollback plan

### Trigger

Immediately stop promotion and start rollback when any reproducible item occurs:

1. deployed `version.json` does not exactly match the approved candidate SHA and `defense-survivor-v1`;
2. any release-DAG job or deployed smoke fails, is missing, or has a mismatched receipt;
3. a canonical replay, input/RNG cursor, map/wave digest, combat/cooldown result, Stage-10 result, or persistent total differs across required observer/device dimensions;
4. G1 or G4 reveals canon drift, missing captions/status, inaccessible focus/control behavior, or an essential meaning available only through color, sound, motion, or haptic;
5. G6 finds a threshold breach, positive 30-minute retained-memory slope, unreported backlog/tick loss, runtime network dependency, telemetry transport, or privacy/export violation;
6. compiled output contains a provider hostname/endpoint, SDK, credential/token, signed/private URL, remote audio/media path, or an asset lacks provenance/rights/hash/fallback approval.

### Operator response

1. Mark the candidate **BLOCKED** and preserve the candidate SHA, prior known-good full SHA, workflow URL, `page_url`, browser/device/viewport, fixture, first failing sample/tick, asset-manifest hash, redaction state, and all result artifacts.
2. Do not force-push, delete local saves, clear player storage remotely, mutate rules to hide a presentation defect, or run client-side provider generation.
3. Select the previous known-good **full lowercase SHA** whose complete pinned tuple is recorded. Invoke the existing workflow's `workflow_dispatch` rollback input with that SHA; the workflow verifies it resolves to an ancestor of `origin/main` before packaging and redeploying it.
4. Treat the restored revision as a new release candidate. It must complete the same artifact, deployed-smoke, tuple, affected evidence, and independent-review steps. A page that merely loads is not recovery proof.
5. For a separable asset-only issue, restore the previous approved content-addressed asset-manifest mapping or its reviewed local fallback, then release through the same static-artifact flow. Do not mix a new asset/grammar/rules revision with old evidence.

`ops/rollback-runbook.md` remains the detailed recovery authority. Rollback completion never changes a G1, G4, or G6 state by itself.

## Generated resources, privacy, consent, and accessibility declaration

### Resource provenance boundary

- Generated audio is optional and private build-time input only. The shipped client must contain only reviewed, static, same-origin, content-addressed files; it must contain no provider request path, SDK, credential, private URL, raw response, account identifier, retry path, or gameplay dependency.
- Each shipped resource requires its sanitized provenance and rights record: source class, prompt/script ID and hashes, actual provider/model/voice only when supplied, final SHA-256, media measurements, terms URL/date, plan/license context, reviewer decision, event mapping, and fallback ID. Secrets and private request records stay outside the repository/artifact.
- Audio decode/load failure, mute, no permission, cache absence, or provider unavailability must resolve to a local fallback or silence while visible caption/status and deterministic simulation remain intact. No resource is authoritative for health, threat, cooldown, objective, reward, or ending.

### Privacy and consent boundary

- The game runtime is local-only: no analytics SDK, `fetch`/XHR/beacon/WebSocket telemetry, account, cloud sync, remote cohort, commerce, or gameplay-time provider call. A diagnostic export is allowed only after an explicit local user/facilitator action, with redaction metadata and local deletion.
- Do not collect names, contacts, account IDs, IP addresses, advertising IDs, fingerprints, exact locations, raw gesture paths, voice recordings, free text, or credentials in diagnostic data. Any moderated study uses a separate consent/code sheet and must not join identity to gameplay exports.
- `privacy.html` must retain the accurate distinction: the app does not receive/store gameplay or identity data, while the static hosting provider may process ordinary HTTP delivery requests under its own policy. GitHub documents that Pages logs visitor IP addresses for security; do not describe Pages as an anonymous transport [GH-PAGES].
- No consent banner is needed merely for the current no-tracking local game flow. If a future change adds non-essential storage, remote diagnostics, analytics, third-party media, or a study UI, it is out of this plan: pause release, obtain applicable legal/privacy review, define consent before collection, and update the disclosure.

### Accessibility declaration for the release record

The release record may state only: **"Accessibility evidence reviewed for this pinned build"** when the G4 evidence has been completed and independently reviewed. It may not claim broad WCAG conformance from this plan or a workflow pass. Required release assertions are:

1. all essential gameplay information has a persistent visual/textual, non-color alternative; audio/haptics/motion only supplement it;
2. reduced-motion and mute preserve text/status and deterministic outcomes;
3. meaningful narration/SFX have captions or transcript/status equivalents, consistent with W3C media guidance [WAI-MEDIA];
4. focusable HUD/overlay controls remain keyboard-operable, visibly focused, not obscured, escapable, and return focus appropriately; and
5. release evidence identifies known exceptions and unresolved defects rather than silently treating them as conformant.

## Evidence sources (accessed 2026-07-22)

- **[GH-DEPLOY-PAGES]** GitHub Actions, [deploy-pages action README](https://github.com/actions/deploy-pages): Pages deployment consumes an earlier uploaded artifact and exposes `page_url`; deployment permissions and environment guidance.
- **[GH-ARTIFACTS]** GitHub Docs, [Store and share data with workflow artifacts](https://docs.github.com/en/actions/tutorials/store-and-share-data): artifacts share workflow data and can retain build/test evidence.
- **[GH-PAGES]** GitHub Docs, [What is GitHub Pages?](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages): Pages static hosting and visitor IP logging disclosure.
- **[MDN-CACHE]** MDN, [CacheStorage](https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage): named cache storage and cache lifecycle API background; browser behavior still requires release smoke evidence.
- **[WCAG-22]** W3C, [Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/): keyboard, focus, target, motion, perception, and accessibility baseline.
- **[WAI-MEDIA]** W3C WAI, [Making Audio and Video Media Accessible](https://www.w3.org/WAI/media/av/): captions and transcripts for speech and meaningful non-speech audio.
- Repository sources: `.github/workflows/static.yml`, `sw.js`, `tests/release-closure.test.mjs`, `tests/pages-artifact-smoke.cjs`, `tests/deployed-defense-smoke.cjs`, `ops/release-readiness.md`, `ops/rollback-runbook.md`, `engineering/resource-manifest.md`, `engineering/perf-budget.md`, `ops/telemetry-contract.md`, and `qa/gate-measurements.md`.
