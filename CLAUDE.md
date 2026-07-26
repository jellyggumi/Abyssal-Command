# Abyssal Surge — shared workspace rules

This file is the repository-scoped instruction set for Claude sessions working in this project. Apply it together with the code, tests, and the run artifacts under `_workspace/`.

## Shared-document source of truth

- Treat tracked `_workspace/` documents as the checked-in, shared production-document surface for Abyssal Surge / Abyssal-Command, and retain only the latest accepted dated run folder. The current retained run is `_workspace/20260726-stage2-balance-agency/`; when a newer run is accepted, update this path and remove superseded run folders under the explicit retention policy.
- Before changing gameplay, assets, renderer behavior, production policy, or gate status, read the relevant run folder's `production/task-manifest.md` and the latest applicable `intake/`, `design/`, `engineering/`, `qa/`, `ops/`, `pm/`, `messages/`, and `retrospectives/` artifacts.
- Prefer the newest authoritative run manifest and its gate review over older summaries. If runs disagree, preserve both records and state the conflict; do not silently merge claims.
- Use exact repository-relative paths when citing evidence. A claim is not established by a file existing; cite the measurement, command, or test result that supports it.

## Run artifacts and writing rules

- Keep the retained production pass in a dated `_workspace/<run-id>/` folder with a `production/task-manifest.md`; place inputs and evidence in the owning lane (`intake/`, `design/`, `engineering/`, `qa/`, `ops/`, `pm/`, `messages/`, or `retrospectives/`).
- Mark statements as `[OBSERVED]`, `[INFERENCE]`, or `[TARGET]` when their status could be confused. Never present a target, proposal, or inherited baseline as a new measurement.
- Preserve append-only decision logs. Use a single writer per log, or acquire an agreed single-writer lock before allocation. Reread the tail immediately before writing, use a stale-content-protected edit, verify the new ID is unique repository-wide after writing and before commit, and abort on collision; never silently renumber.
- Do not delete, rename, or rewrite files inside the retained run to make a gate or summary look cleaner. Superseded run folders may be removed only as part of the explicit latest-run retention policy. If an artifact contains a secret, credential, personal data, restricted asset, or other sensitive value, stop propagation: do not quote or copy it, quarantine/redact the value, rotate or revoke credentials, and preserve only a dated redacted audit/tombstone note. A human owner must approve any separate history-remediation procedure; this rule never authorizes an agent to rewrite history or retain the sensitive payload.
- `_workspace/*/pipeline/`, `_workspace/*/models-out/`, ignored production keyframes, and ignored previs source/output descendants are generated/local material and are not shared source-of-truth documents. Do not promote them without an explicit provenance/rights/runtime receipt. Do not commit secrets or machine-local runtime state such as `.env.game-audio`, `.omc/`, or `.studio-loop/`.

## Concurrent-session Git safety

- Assume other sessions may be editing this repository. Prefer an isolated worktree and branch per committing session. If a shared worktree is unavoidable, acquire the atomic directory lock `/tmp/abyssal-surge-git-write.lock` with `mkdir`, record the owner/session inside it, hold it through staging, commit, and push, and stop if it already exists; remove it only when the owning session exits.
- Run `git status --short` before edits and immediately before committing; treat unexpected changes as owned by another session. Before commit, inspect both the complete staged path list and cached diff, and abort if any path or hunk is not owned by this session.
- Stage and commit only the intended files with explicit pathspecs. Never use `git add -A`, `git add .`, broad wildcard staging, or a cleanup/reset command to absorb unrelated work.
- Never restore, discard, or force-overwrite another session's changes. If a shared artifact collides, stop the edit, document the conflict, and resolve it explicitly.
- Before pushing, identify the branch's explicit upstream, fetch it, inspect the complete `@{upstream}..HEAD` commit range, and abort if any commit is unknown or unreviewed. Push only to that explicit branch with no history rewrite and never force-push; sensitive-history remediation is a separately approved human-owner operation, not an agent action.

## Verification and reporting

- Preserve deterministic simulation behavior: renderer/presentation code may read snapshots but must not write back into simulation state or alter `getRunDigest()` inputs.
- For the full Node regression, use the quoted glob exactly: `node --test 'tests/**/*.test.mjs'`. Do not substitute a shell-expanded glob and call it equivalent.
- Report what was actually checked, with the exact command or artifact path and observed result. Distinguish carried evidence, new evidence, unresolved blockers, and human-only judgments.
- When a request is complete, leave the shared artifact and code tree in a state another session can pick up without relying on chat history.
