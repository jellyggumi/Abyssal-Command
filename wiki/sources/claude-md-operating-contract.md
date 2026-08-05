# Source: CLAUDE.md (repository operating rules)

**Repo path:** `CLAUDE.md` (`AGENTS.md` redirects here for non-Claude runtimes)
**Changed:** +177/-? lines in the 2026-07-28 merge (`2166c52..12c550b`)
**Immutability note:** repo-tracked file, git history is the version record;
not duplicated into `raw/`.

## Summary

Repository-scoped operating contract, six sections:

1. **Workspace** — `_workspace/current/` is the only live write target, no
   dated sibling run folders; `_workspace/archive/**` is read-only history.
   Append-only decision logs, single writer, reread-tail-before-write,
   collision abort.
2. **Engine perspective** — Three.js + WebGL browser game only
   (`vendor/three.module.js`, `battle-realtime-three.js`,
   `battle-visualizer.js` fallback). Never apply Unity/Unreal guidance.
   Renderer reads simulation snapshots only, never writes back —
   `getRunDigest()` inputs are a hard invariant.
3. **Asset generation** — fixed tool per asset class (see
   [[wiki/concepts/character-3d-asset-pipeline]]). `gti --dry-run` before
   spending quota; every generated image gets a `.provenance.json`
   (`runtimeEligible: false` until audited).
4. **Wiki** — **this repository root is the llm-wiki vault root**, not
   `~/vaults/llm-wiki`. `index.md`/`log.md`/`raw/`/`wiki/` schema, synced via
   `bash scripts/wiki-sync.sh`. (This page is itself part of that vault.)
5. **Concurrent-session git safety** — assume parallel sessions; isolated
   worktree/branch preferred, atomic lock file
   `/tmp/abyssal-surge-git-write.lock` if a shared worktree is unavoidable.
   Explicit pathspec staging only, never `git add -A`/`-A`/wildcard. Never
   force-push; fetch + inspect `@{upstream}..HEAD` before pushing.
6. **Verification and reporting** — full regression is the quoted glob
   `node --test 'tests/**/*.test.mjs'`; numbers gate everything, no adjective
   passes a gate.

## Synthesis

The wiki section (§4) is this vault's own operating contract — see
[[wiki/entities/abyssal-surge]] for how it's applied. The asset-generation
table (§3) is fully expanded in
[[wiki/concepts/character-3d-asset-pipeline]].
