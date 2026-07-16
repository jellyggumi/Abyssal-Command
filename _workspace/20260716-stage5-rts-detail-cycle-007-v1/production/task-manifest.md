---
run_id: 20260716-stage5-rts-detail-cycle-007-v1
owner: game-production-director
created_at: 2026-07-16T08:22:00Z
artifact_version: v1
immutable: true
append_only: true
status: ready
decision_ids: [C007-D-001]
input_artifacts:
  - /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260716-stage5-rts-detail-cycle-007-v1/intake/production-brief.md
---
# Task manifest v1 — Cycle 007 directives

C007-D-001. `game-core.js` FROZEN. QA (DET7-QA) holds stop-ship veto.

## DET7-SW — Service-worker deployment integrity (P0)

1. Bump `CACHE_NAME` to `abyssal-surge-v3` (v2 may exist in some clients from manual tests; skip it).
2. Asset list: add `assets/images/unit_strike.png`, `unit_brace.png`, `unit_disrupt.png`, `unit_voidspawn.png`, and the five cinematics `assets/video/stage_intro_1..5.mp4` (allSettled tolerance already handles missing files in dev).
3. Fetch policy: NETWORK-FIRST with cache fallback for the five core closure files (`./`, `index.html`, `app.js`, `game-core.js`, `styles.css`) so deploys propagate on next load while offline keeps working; cache-first stays for immutable media (audio/images/video).
4. `self.skipWaiting()` on install + `clients.claim()` on activate so the new worker takes over without a second manual reload.

## DET7-CINE — Local stage-intro cinematics (vox-director local methodology)

1. Generate `assets/video/stage_intro_N.mp4` (N=1..5): input `assets/images/stageN.png`, ffmpeg zoompan Ken Burns (per-stage motion: slow push-in for 1/3/5, drift-pan for 2/4), 6.0s, 24fps, 960x540, libx264 CRF 30 preset slow, `-an` (visual-only), `+faststart`, yuv420p. Budget: ≤1.2MB per file, ≤6MB total (compresso principle: quality-per-byte, re-tune CRF upward only if over budget).
2. app.js overlay: on stage entry (showSurface("play") new-encounter path), display a full-lane cinematic overlay `<video muted autoplay playsinline preload="none">` with letterbox bars + the existing typed narration continuing beneath; ends (or click/keypress skips) → fade 300ms → normal play view. Video `error`/`stalled` → immediate fallback to current backdrop cross-fade (no black screen ever). Null-guarded for fake-DOM tests. prefers-reduced-motion: skip cinematic entirely.
3. Replays of the SAME encounter (post-defeat retry, saved-state resume) do NOT replay the cinematic (session flag per encounterIndex).

## DET7-READ — Stage-5 telegraph readability

1. On hostile wave spawn, flash the lane's right edge (brief 250ms red gradient pulse, class `lane-spawn-flash`) so 2.5s-cooldown waves are noticed peripherally; reduced-motion collapses to a static border tint.

## DET7-APK — TWA packaging kit + manifest hardening

1. Rasterize `icon.svg` → `assets/icons/icon-512.png`, `icon-192.png` (headless Chromium screenshot, exact px), reference both in manifest.json (keep svg entry).
2. `apk/twa-manifest.json` (bubblewrap init-compatible: host jellyggumi.github.io, path /Abyssal-Surge/, themeColor #0b0d14, orientation any, fallback custom-tabs), `apk/assetlinks-template.json` (placeholder SHA256 fingerprint), `apk/BUILD.md` (exact bubblewrap install/init/build + Pages assetlinks upload steps + signing note). No APK build claim.

## DET7-QA — Gate (stop-ship veto)

1. Unit: stage1-vertical-slice, playtest-5-stages PASS.
2. Browser E2E exit 0 unfiltered incl. new assert: first stage entry shows the cinematic overlay then reaches play state (or documented-skip), and sw registration under v3 serves fresh app.js after reload.
3. capture-live exit 0; desktop+mobile PNGs inspected.
4. Post-push live verification: Pages workflow success, then `curl` live sw.js shows v3 + spot-check one unit sprite and one cinematic return HTTP 200.
5. Retrospective cycle-007 JSON validates (pydantic v2 validator).

## DET7-DOC

1. Coordination brief Cycle 007 section (append-only); llm-wiki report + index line.

## Ownership

- game-engineering-lead: DET7-SW, DET7-CINE(wiring), DET7-READ
- media-pipeline-lead: DET7-CINE(generation/compression), DET7-APK(icons)
- platform-lead: DET7-APK(kit/docs)
- adversarial-qa-lead: DET7-QA · knowledge-ops-lead: DET7-DOC

## Recovery annotation (2026-07-16T17:10Z)

Rewritten byte-identically (above this section) after concurrent-actor deletion
before first commit. See production/worktree-coop-note-v2.md.
