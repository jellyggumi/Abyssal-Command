# 29 — Balance changelog and release

- **Version** v1 (2026-07-31)
- **Skill** `/skill:build-game-changelog` then `/skill:ship-web-games`
- **Produces** the player-facing ledger entry for a pattern / difficulty / variation change, and the
  release of exactly the verified commit.
- **Placeholders** `${stageId}`, `${changeSummary}`, `${verdictPath}` (26), `${receiptPath}` (28),
  `${releaseTag}`.

---

**CONTEXT:**
A balance change that ships without a ledger entry is indistinguishable from a bug report next
patch. The repository already carries the machinery: `RULES_VERSION` (`defense-survivor-v1`) is
stamped into every simulation artifact, `scripts/read-defense-rules-version.mjs` reads it, and
release closure is asserted by `tests/release-closure.test.mjs`.

Concurrency rules are load-bearing here (`CLAUDE.md` §5): assume other sessions are editing this
repository; prefer an isolated worktree and branch per committing session; otherwise acquire the
atomic directory lock `/tmp/abyssal-surge-git-write.lock` with `mkdir`, record owner/session inside
it, hold it through staging, commit and push, and stop if it already exists.

**ROLE:**
You are the release owner. You ship verified commits only, you describe changes in the player's
vocabulary, and you never let a summary claim more than the receipt proves.

**ACTION:**

1. Read `${verdictPath}` and `${receiptPath}`. If the disposition is `BLOCKED` or any systems suite
   is red for a reason attributable to this change, stop and report — this step does not proceed.
2. Write the ledger entry in the player's language, one line per observable change:
   *what fight changed*, *what the player must now do differently*, *what did not change*. Name the
   stage, the wave kinds, and the archetype whose answer moved. Never publish an internal identifier
   without a plain-language gloss.
3. Record the numeric provenance alongside it: doctrine fields changed, response-type delta, worst
   shared-axis ratio, playtime median/range per stage, balance-sim outcomes, and the gate verdict.
4. State the save/compatibility position: whether a rehydrated save from before this change resolves
   to the same schedule, and which guard makes that true. A doctrine change alters a stage's wave
   plan, so an in-flight save of that stage will differ — say so explicitly.
5. Verify the tree before staging: `git status --short`, then stage **explicit pathspecs only** —
   never `git add -A`, never a wildcard that could absorb another session's work.
6. Before pushing, fetch the explicit upstream and inspect the full `@{upstream}..HEAD` range; abort
   if any commit is unknown. Never force-push.
7. Run the production smoke after deploy: the stage loads, the first wave arrives, a mid-boss
   announces, the gate-defense objective closes, and the browser console is error-free.
8. Update `log.md` with the ingest/change entry, and `prompts/VERSIONS.md` if any prompt in this
   track encoded a value that moved.

**FORMAT:**
(a) The changelog entry in the in-game release ledger, player-facing. (b) A provenance block with
the numbers from steps 3–4. (c) The release record: commit sha, `${releaseTag}`, smoke result.

**TARGET AUDIENCE:**
Players reading the patch notes, and the next session reconstructing why a stage feels different.

**HARD CONSTRAINTS:**

- Ship only what prompts 25–28 proved. A `BLOCKED` gate is not a soft warning.
- Never revert, stash, commit, push, or delete another session's work.
- Explicit pathspecs; no broad staging; no cleanup that absorbs unrelated changes.
- Never force-push; history remediation is a human-owner operation.
- Player-facing text stays in the game's voice (Korean UI strings live in the catalogs); do not ship
  an internal identifier as a patch note.
- The changelog states what did NOT change as precisely as what did — that is what prevents the next
  session from re-tuning a stage that was already tuned.

**DONE WHEN:**
The ledger entry exists with its provenance block, the tree was staged by explicit pathspec under
the write lock or in an isolated worktree, `@{upstream}..HEAD` contained only known commits, the
production smoke passed, and `log.md` carries the entry.
