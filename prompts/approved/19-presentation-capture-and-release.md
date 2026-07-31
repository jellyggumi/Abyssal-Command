# 19 — Presentation capture and release

- **Version** v1 (2026-07-31)
- **Skills** `/skill:browser-video-recording` (in-game capture), `/skill:video-shotcraft` (shot
  cards), `/skill:video-production` (batch render, subtitle/localized variants), `/skill:ship-web-games`
- **Produces** the release-facing capture of the presentation work, and the handoff record.
- **Placeholders** `${changeId}`, `${stageId}`, `${fixtureSeed}`.

---

**CONTEXT:**
This step runs only after prompt 18 is green. `CLAUDE.md` §2 forbids shipping before test-playable
proof exists, and a capture is not proof — it is a *record* of proof that already exists.

Capture sources available in-repo:

```
scripts/render-clip-frames.py            clip frame strips
scripts/render-pose-contact-sheet.py     pose contact sheets
scripts/render-review-thumbnails.py      review thumbnails
design/assets/cinematic/scene_01_shot_sheet.csv    shot ledger (shot_id, duration_sec, transition, motion_tag)
design/assets/cinematic/scene_01_subtitles_kr.csv  subtitle ledger
```

Git safety is not optional here. `CLAUDE.md` §5: assume other sessions are editing this repository.
Prefer an isolated worktree and branch per committing session; if a shared worktree is unavoidable,
acquire `/tmp/abyssal-surge-git-write.lock` with `mkdir`, record owner and session inside it, hold it
through staging, commit and push, and stop if it already exists.

**ROLE:**
You are the release owner. You publish what was proven and nothing more. You stage explicit paths,
you never absorb another session's work, and you never force-push.

**ACTION:**

1. Confirm prompt 18 is green and cite its artifact path. If it is not, stop — there is nothing to
   release.
2. Capture the runtime, not a mock. Record on the deterministic fixture `${fixtureSeed}` at
   `${stageId}` so the capture is reproducible, and state the seed and tick range in the artifact.
3. Capture all three quality tiers when the change touched any of them: `full`, software renderer,
   and `prefers-reduced-motion`. A release note that shows only the full tier misrepresents the
   accessible experience.
4. Capture both orientations for anything touch-facing, and state device and viewport for every clip.
5. For a cutscene, render from the CSV ledgers so the video and the ledger cannot disagree, and
   produce the subtitle variant from `scene_01_subtitles_kr.csv` rather than burning text in by hand.
6. Write generated capture output to the concept lane with an adjacent `.provenance.json` recording
   prompt, tool, inputs and `runtimeEligible: false`. A capture is never a runtime asset.
7. Run `git status --short` before edits and again immediately before committing. Treat unexpected
   changes as another session's work.
8. Stage with explicit pathspecs only. Never `git add -A`, `git add .`, a broad wildcard, or a
   cleanup that absorbs unrelated work.
9. Before pushing, fetch the explicit upstream, inspect the full `@{upstream}..HEAD` range, and abort
   if any commit is unknown.
10. Leave the artifact tree pickup-ready: the QA record, the capture paths, the provenance files, and
    the `VERSIONS.md` row if a prompt in this track changed.

**FORMAT:**
Markdown at `_workspace/current/ops/presentation-release-${changeId}.md`: the prompt-18 artifact
citation, the capture inventory with seed/tick/device/viewport/tier per clip, the provenance paths,
the `git status --short` output before and after, the exact staged pathspecs, and the
`@{upstream}..HEAD` range inspected.

**TARGET AUDIENCE:**
The repository owner and the next session, which must reconstruct what shipped from the artifact tree
alone.

**HARD CONSTRAINTS:**

- Prompt 18 green is a precondition. A capture is a record of proof, never a substitute for it.
- Every capture states seed, tick range, device, viewport and quality tier. A clip without them is
  not evidence.
- Generated captures are concept-lane with `.provenance.json` and `runtimeEligible: false`.
- Explicit pathspecs only. Never `git add -A` or `git add .`.
- Never revert, stash, commit, push or delete another session's work.
- Never force-push. History remediation is a human-owner operation.
- Acquire `/tmp/abyssal-surge-git-write.lock` with `mkdir` before staging in a shared worktree, and
  stop if it already exists.
- Never commit secrets or machine-local state (`.env.game-audio`, `.omc/`, `.studio-loop/`,
  `tmp/defense-audio-results.json`).

**DONE WHEN:**
The prompt-18 artifact is cited, captures exist for every affected quality tier with seed, tick,
device, viewport and tier recorded, provenance files are written, `git status --short` is recorded
before and after, staging used explicit pathspecs only, the `@{upstream}..HEAD` range contains only
known commits, and the artifact tree can be picked up without chat history.
