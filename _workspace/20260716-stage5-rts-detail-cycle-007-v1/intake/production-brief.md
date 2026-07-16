---
run_id: 20260716-stage5-rts-detail-cycle-007-v1
owner: game-production-director
created_at: 2026-07-16T08:20:00Z
immutable: true
status: frozen
predecessor_run: 20260716-stage5-rts-detail-cycle-006-v1
baseline_pin:
  deployed_commit: 9fd1586
  live_url: https://jellyggumi.github.io/Abyssal-Surge/
---
# Production brief — Cycle 007 (Deployment integrity + cinematics + APK path)

## P0 finding (deployment defect)

`sw.js` still declares `CACHE_NAME = "abyssal-surge-v1"` with a cache-first fetch
policy and an asset list frozen before cycles 005/006. Returning PWA users are
served the STALE pre-005 closure (no lane-click, no world-bible titles, no
hostile telegraph, missing unit_*.png sprites). New-visit users are unaffected.
This must be fixed and verified on the live site this cycle.

## Cutscene provider decision

User mandate allows "vox-director 또는 다른 비디오생성 방법". No Atlas Cloud API
key exists in this environment (verified: env/config probe negative), so remote
generation is unavailable. Decision: apply the vox-director LOCAL methodology —
Ken Burns motion (ffmpeg zoompan) over the five existing stage backdrops,
assembled into short visual-only cinematics, compressed with a compresso-style
CRF budget. Narration stays in the existing audio system (no embedded audio →
no double-audio, no autoplay friction, smaller files).

## APK path decision

Tooling probe: `java` present; `bubblewrap`/Android SDK absent. Decision: ship
the complete TWA packaging kit (twa-manifest.json, assetlinks.json template,
PNG icons rasterized from icon.svg, step-by-step build doc) so an APK can be
built with one command on a machine with Android tooling. No fake "APK built"
claim.

## Goals

1. DET7-SW: service-worker cache integrity + update flow (P0).
2. DET7-CINE: five local stage-intro cinematics, skippable overlay, graceful fallback.
3. DET7-READ: stage-5 telegraph readability (spawn flash cue).
4. DET7-APK: TWA packaging kit + manifest hardening.
5. DET7-QA / DET7-DOC: full gate + live-site verification + wiki record.

## Non-goals

- game-core.js semantic changes; monetization/telemetry egress; cycle≤006 record edits.
- Claiming APK build completion without Android tooling.

## Recovery annotation (2026-07-16T17:10Z)

This file was rewritten byte-identically (above this section's addition) after
being deleted from the shared working tree by a concurrent actor before its
first commit. See production/worktree-coop-note-v2.md.
