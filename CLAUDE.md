# Abyssal Surge — repository operating rules

Repository-scoped instruction set for agent sessions in this project. Apply it
together with the code, the tests, and the live run artifacts under
`_workspace/current/`. `AGENTS.md` points here; there is exactly one contract.

---

## 1. Workspace: one live folder, one archive

**`_workspace/current/` is the only folder any session writes to.** There are no
dated run folders. A new production cycle does not create a sibling directory —
it updates `current/` in place and records the transition in
`current/production/task-manifest.md`.

```
_workspace/
  current/                 <- the single up-to-date working folder
    intake/ design/ engineering/ pm/ qa/ ops/ ui/
    production/task-manifest.md
    messages/ retrospectives/
  archive/<run-id>/        <- frozen prior cycles, READ-ONLY
```

Rules:

- Write only under `_workspace/current/`. Treat `_workspace/archive/**` as
  immutable history: read it for evidence, never edit or delete it.
- Archiving is the only way material leaves `current/`. At cycle close, move the
  superseded lane material to `_workspace/archive/<run-id>/` with `git mv` and
  write `current/retrospectives/cycle-<n>-retrospective.md`. Never delete a
  `_workspace/` artifact to make a gate or a summary look cleaner.
- Place every input and every piece of evidence in its owning lane. A file in
  the wrong lane is a defect, not a detail.
- Mark statements `[OBSERVED]`, `[INFERENCE]`, or `[TARGET]` whenever the status
  could be confused. Never present a target, a proposal, or an inherited
  baseline as a new measurement.
- Cite exact repository-relative paths. A claim is not established by a file
  existing; cite the measurement, command, or test result behind it.
- Preserve append-only decision logs: single writer, reread the tail immediately
  before writing, verify the new ID is unique repository-wide, abort on
  collision. Never silently renumber.
- Generated/local material (`_workspace/**/pipeline/`, `**/models-out/`,
  candidate lanes, `__pycache__`) is not shared source of truth. Do not promote
  it without an explicit provenance/rights/runtime receipt. Never commit
  secrets or machine-local state (`.env.game-audio`, `.omc/`, `.studio-loop/`).

## 2. Engine perspective: Three.js / browser only

This is a **Three.js + WebGL browser game** (`vendor/three.module.js`,
`battle-realtime-three.js`, Canvas fallback in `battle-visualizer.js`). Work the
problem from the `web-game-development` routing pack.

- Classify each task against the 19 upstream sub-skills and name the **single
  narrowest** match before touching code. Combine only when a documented
  boundary genuinely requires it.
- Respect the lifecycle order: prototype → systems → content → assets → feel →
  perf → QA → release. Never build VFX/audio polish before the system it
  communicates (combat, encounter, enemy) is defined. Never ship before
  test-playable proof exists.
- **Never apply Unity/Unreal guidance here.** If a request assumes an engine
  editor, Addressables, GAS, or C#, stop and say so — it is the wrong engine,
  not a translation exercise.
- Renderer/presentation code may read simulation snapshots but must never write
  back into simulation state or alter `getRunDigest()` inputs. Deterministic
  simulation is a hard invariant.

## 3. Asset generation: fixed tool per asset class

Do not improvise a generator. Each class has exactly one owner:

| Asset class | Tool | Invocation |
|---|---|---|
| Concept art, textures, UV atlases, terrain/character/prop plates | **god-tibo-imagen** | `gti --prompt "..." --input <ref> --output <path> --size <WxH>` |
| 2D animated sprites, sprite sheets, 8-direction sets | **perfectpixel** | `ppgen -provider god-tibo-imagen -desc "..." -states "idle,walk,attack" -out <dir> -key dummy -json` |
| Story, scenario, episode script, narrative beats | **webtoon-harness** | phase-rebuilt agent teams; artifacts under `_workspace/current/design/` |
| 3D mesh from concept | **Blender + Rodin bridge** | `scripts/rodin-tpose-regen.py` (see `docs/concept-to-web-game-3d-pipeline.md`) |

Rules:

- `gti --dry-run` first whenever prompt or config is uncertain; it validates
  without consuming quota.
- `ppgen`: prove style with a single state (`-states idle`) before generating a
  full set. Force a magenta `#FF00FF` key background in the prompt and keep
  magenta/pink/purple **out of the character design**, or matting erases the
  character. Always pass `-json`.
- Every generated image gets an adjacent `.provenance.json` recording prompt,
  reference inputs, tool, and `runtimeEligible: false`. Generated output starts
  in the concept lane and is promoted only after an explicit audit.
- Storytelling output is a `webtoon-harness` deliverable, not free-form prose:
  keep the dialogue-driven, high-tension, twist-per-episode contract and
  preserve every intermediate artifact.

## 4. Wiki: this repository root is the vault

The `llm-wiki` vault root is **this project root** — not `~/vaults/llm-wiki`.
Obsidian and graphify both resolve against that same root.

```
index.md            wiki navigation entry point (README.md stays the code readme)
log.md              chronological ingest / query / lint log
raw/sources/        immutable captures  — NEVER edit after writing
raw/assets/         downloaded images and attachments
wiki/sources/       per-source summaries
wiki/entities/      durable subject pages
wiki/concepts/      durable synthesis pages
wiki/queries/       filed answers to durable questions
wiki/reports/       memos, comparisons, higher-value synthesis
wiki/graph/         graphify Obsidian export — GENERATED, gitignored
```

Rules:

- `raw/` is source of truth and immutable. Corrections go into wiki pages or a
  follow-up source note, never into a rewritten raw capture.
- Every ingest updates: the source page, the affected entity/concept pages,
  `index.md`, and `log.md`. All four, every time.
- Answer from the wiki first: read `index.md`, open the relevant pages, and drill
  into `raw/` only to ground or resolve a conflict. File durable answers back
  into `wiki/queries/` or `wiki/reports/`.
- Obsidian vault config is tracked (`.obsidian/app.json`,
  `.obsidian/core-plugins.json`); pane layout and plugins are ignored. New notes
  land in `wiki/`, attachments in `raw/assets/`.
- graphify indexes this root and exports into the wiki:
  `graphify export obsidian --dir wiki/graph`. `wiki/graph/` is derived — never
  hand-edit it, never cite it as evidence. `.graphify/` is scratch index state.
- Sync and lint with `bash scripts/wiki-sync.sh` (export + lint),
  `--export` or `--lint` to run one half. The upstream linter would otherwise
  walk `node_modules/`, `.claude/`, `_workspace/archive/`, and the generated
  `wiki/graph/` notes; the wrapper scopes it to the authored vault. Fix
  structural findings before adding more sources.

## 5. Concurrent-session Git safety

- Assume other sessions are editing this repository. Prefer an isolated worktree
  and branch per committing session. If a shared worktree is unavoidable,
  acquire the atomic directory lock `/tmp/abyssal-surge-git-write.lock` with
  `mkdir`, record owner/session inside it, hold it through staging, commit, and
  push, and stop if it already exists.
- Run `git status --short` before edits and again immediately before committing.
  Treat unexpected changes as another session's work.
- Stage with explicit pathspecs only. Never `git add -A`, `git add .`, broad
  wildcard staging, or a cleanup/reset that absorbs unrelated work.
- Never restore, discard, or force-overwrite another session's changes. On
  collision: stop, document, resolve explicitly.
- Before pushing, fetch the explicit upstream, inspect the full
  `@{upstream}..HEAD` range, and abort if any commit is unknown. Never
  force-push. History remediation is a human-owner operation.
- Before a destructive asset operation, tag the pre-state
  (`git tag -f pre-<operation>-<date>`) and confirm every target path is tracked,
  so the deletion is recoverable.

## 6. Verification and reporting

- Full Node regression uses the quoted glob exactly:
  `node --test 'tests/**/*.test.mjs'`. A shell-expanded glob is not equivalent.
- Report what was actually checked: the exact command or artifact path and the
  observed result. Distinguish carried evidence, new evidence, unresolved
  blockers, and human-only judgments.
- Numbers gate everything. No adjective passes a gate.
- Leave the artifact tree in a state another session can pick up without relying
  on chat history.
