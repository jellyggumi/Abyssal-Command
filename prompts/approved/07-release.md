# 07 — Release the stage

- **Version** v1 (2026-07-31)
- **Skill** `/skill:ship-web-games`
- **Produces** a deployed, browser-proven build of the stage plus its release and rollback record.
- **Placeholders** `${stageId}`, `${commitSha}`, `${proofPath}` (output of prompt 06),
  `${deployTarget}`.

---

**CONTEXT:**
Abyssal Surge is a static browser game (`index.html`, `app.js`, `battle-realtime-three.js`,
`vendor/three.module.js`, `sw.js`, `manifest.json`) with a service worker, so a release that does
not account for cache invalidation ships an old stage to returning players. `CLAUDE.md` §5 governs
git: assume other sessions are editing the repository, prefer an isolated worktree and branch, stage
with explicit pathspecs only, never `git add -A`, never force-push, and inspect the full
`@{upstream}..HEAD` range before pushing, aborting on any unknown commit.

**ROLE:**
You are a release engineer who deploys only a verified commit and proves the deployed artifact, not
the local build. You keep a rollback target ready before you start and you never absorb another
session's work into your commit.

**ACTION:**

1. Run `git status --short` and identify every change that is yours. Treat anything else as another
   session's work and leave it untouched.
2. Confirm `${proofPath}` exists and is green; a release without prompt 06's evidence stops here.
3. Stage explicit pathspecs only — typically `stage-world-catalog.js`, `defense-catalog.js`, the
   affected `tests/`, `assets/`, and `prompts/` files — and re-run `git status --short` immediately
   before committing.
4. Re-run the focused suites and the quoted full regression on the exact commit being shipped.
5. Fetch the explicit upstream, inspect `@{upstream}..HEAD` in full, abort if any commit is unknown,
   then push. Never force-push.
6. Deploy `${commitSha}` to `${deployTarget}` and poll until the deployment reports ready. Record
   the deployed commit and the previous deployment as the rollback target.
7. Open the production URL in the repository-approved browser and verify: load, service-worker
   update (hard reload and a returning-visitor path), first input, stage select, one full encounter
   on `${stageId}`, asset load with no 404s, save/settings round-trip, portrait and landscape
   layout, console health, and a representative frame-time sample.
8. Write the release record: commit, deployed URL, verified rows, rollback target and command, and
   any deferred issue with its severity.
9. Close temporary servers, benchmarks, and QA tabs you opened.

**FORMAT:**
Markdown at `_workspace/current/ops/release-${stageId}.md`: a commit/deploy header, a production
verification table (row, expected, observed, artifact), and a rollback section with the exact
command. Report local readiness and deployed state as two separate verdicts.

**TARGET AUDIENCE:**
The operator on call and the next release session. Both need the rollback command without reading
chat history.

**HARD CONSTRAINTS:**

- Never revert, stash, discard, or force-overwrite another session's changes. On collision: stop,
  document, resolve explicitly.
- Explicit pathspecs only. No `git add -A`, no `git add .`, no wildcard staging, no cleanup that
  absorbs unrelated work.
- Never commit secrets or machine-local state (`.env.game-audio`, `.omc/`, `.studio-loop/`).
- Before any destructive asset operation, tag the pre-state (`git tag -f pre-<operation>-<date>`)
  and confirm every target path is tracked.
- The deployed artifact — not the local build — is the thing being proven.

**DONE WHEN:**
The deployed commit matches `${commitSha}`, every production verification row has an observed result
and an artifact, the rollback target and command are recorded, and temporary resources are closed.
