# Workspace path migration — dated roots into `current/`

Date: 2026-07-28 (executed 2026-07-29 01:17 local)
Scope: CLAUDE.md §1 compliance — `_workspace/current/` is the only folder a session
writes to; `_workspace/archive/<run-id>/` is frozen history.
Executed with plain filesystem moves. **Zero git commands were run** [OBSERVED].

---

## 1. Before / after counts

| Tree | Before | After (my move) | Final | Note |
|---|---|---|---|---|
| `_workspace/20260726-stage1b-cinder-pressure-agency/` | 434 | 1 | **0, removed** | [OBSERVED] collision later resolved by another session, §3 |
| `_workspace/20260725-wellmade-verification/` | 9 | 0, removed | 0, removed | [OBSERVED] fully relocated |
| `_workspace/archive/20260726-stage1b-cinder-pressure-agency/` | 245 | 245 | 245 | [OBSERVED] unchanged throughout |
| `_workspace/current/` | 897 | 1339 | 1344 | [OBSERVED] +442 moved; later +2 concurrent writes, +1 this report, +1 collision rename, +1 sibling doc |

`_workspace/` root now contains only `archive/`, `current/`, and `.DS_Store`
[OBSERVED] — both dated roots are gone.

**Correction to the briefed baseline** [OBSERVED]: the batch context stated
`20260725-wellmade-verification` held **1** file (`qa/evidence/data/motion.json`).
Direct measurement found **9** files — that one JSON plus
`qa/evidence/data/actor-readability.json` and 7 PNGs under `qa/evidence/screens/`.
All 9 were moved. Acting on the briefed figure would have silently stranded 8 files.

### Arithmetic — zero files lost

```
20260726 root : moved 433 + collided 1 = 434  == original 434   OK
20260725 root : moved   9 + collided 0 =   9  == original   9   OK
current delta : 897 + 442 = 1339                                OK
```

### Path rewrites applied to the payload

- `…/20260726-…/engineering/` → `_workspace/current/engineering/`
- `…/20260726-…/qa/` → `_workspace/current/qa/`
- `…/20260726-…/blender/` → `_workspace/current/engineering/blender/`
- `…/20260726-…/design/` → `_workspace/current/design/` (no files matched; the dated
  root had no `design/` subtree [OBSERVED] — top level was `blender` 24, `engineering`
  395, `qa` 15)
- `…/20260725-…/qa/` → `_workspace/current/qa/`

---

## 2. Archive integrity

`_workspace/archive/20260726-stage1b-cinder-pressure-agency/` holds exactly **245**
files before and after [OBSERVED]. No move destination was inside `archive/` — the
mover refused any such path and reported 0 refusals [OBSERVED].

Cross-check on a separate signal: 36 files under
`archive/…/qa/browser-runtime-1440x900/` carry mtime `2026-07-29 00:58:44`, all within
a single second. That is **19 minutes before** this migration's move window
(`01:17:29`), and **zero** archive files have a ctime inside that window [OBSERVED].
Per `WorkspaceNormalization`, those 36 are the parent session's restore of files it had
deleted earlier in the session, content-verified intact and back to 245.

**Caveat for future readers** [OBSERVED]: those 36 restored files no longer share the
`2026-07-28 22:45` mtime of the other 209 in that tree. mtime is therefore no longer a
reliable provenance signal for them — cite content hashes instead.

---

## 3. Collision list

Exactly **one** collision [OBSERVED]. Two genuinely different files map to one
destination under the Contract rewrites:

| Source | Size | sha256 (16) | Outcome |
|---|---|---|---|
| `…/20260726-…/blender/abyssal-surge-stage-gallery-v01.blend1` | 111,711,128 B | `ee593f609de0b5de` | **moved** to `_workspace/current/engineering/blender/…` |
| `…/20260726-…/engineering/blender/abyssal-surge-stage-gallery-v01.blend1` | 1,390,638 B | `119a342978477705` | **left in place** — collision |

Both rewrite to `_workspace/current/engineering/blender/abyssal-surge-stage-gallery-v01.blend1`
(`blender/` re-nests under `engineering/`, while `engineering/blender/` maps identically).
They are not duplicates — different sizes, different hashes.

Tie-break [INFERENCE]: the `blender/` copy was moved because it is the backup partner of
`blender/abyssal-surge-stage-gallery-v01.blend`, part of the authored v01–v06 series
(23 further files); the `engineering/blender/` copy was that directory's only file and
has no `.blend` sibling. Nothing was renamed, overwritten, or deleted — both copies
survive.

**Consequence at the time of my move**: `_workspace/20260726-stage1b-cinder-pressure-agency/`
still existed, holding exactly that one file at
`engineering/blender/abyssal-surge-stage-gallery-v01.blend1`. Every other directory in
both dated roots was removed only after becoming genuinely empty
(`find … -type d -empty -delete`). `_workspace/20260725-wellmade-verification/` was gone.

### Resolution by another session [OBSERVED]

At `01:23:37`, after my move and while I was verifying, another session resolved the
collision by relocating the 1,390,638 B file to
`_workspace/current/engineering/blender/abyssal-surge-stage-gallery-v01.from-dated-root.blend1`.
I re-verified the bytes: size `1390638`, sha256 prefix `119a342978477705` — **byte-identical
to the original** [OBSERVED]. Both distinct payloads are now present in
`current/engineering/blender/` under distinct names:

| File | Size | sha256 (16) |
|---|---|---|
| `abyssal-surge-stage-gallery-v01.blend1` | 111,711,128 B | `ee593f609de0b5de` |
| `abyssal-surge-stage-gallery-v01.from-dated-root.blend1` | 1,390,638 B | `119a342978477705` |

That emptied the dated root, which was then removed. **Both dated roots no longer
exist** [OBSERVED]. The naming question (which copy is canonical) remains a human call
[TARGET], but no bytes were lost by either session.

---

## 4. Reference repointing — 26 files

The brief said 25 files; grep returned **26** [OBSERVED] (the first page capped at 20).
All 26 were rewritten, 36 occurrences total. Rules applied in order, `blender/` first
because it re-nests.

Split string literals are handled correctly because every split falls *after* the
rewritten prefix — e.g. `"…/engineering/asset-pipeline"` + `"/runtime-candidates/…"`
rewrites cleanly on the first fragment.

| File | Rewrite (count) |
|---|---|
| `tests/asset-lane-separation.test.mjs` | engineering → current/engineering (1) |
| `tests/character-albedo-bake.test.mjs` | engineering → current/engineering (1) |
| `tests/commander-guard-pose.test.mjs` | engineering → current/engineering (3) |
| `tests/promoted-character-assets.test.mjs` | engineering → current/engineering (2) |
| `tests/stage-cartoon-texture-pack.test.mjs` | engineering → current/engineering (1) |
| `tests/stage-runtime-proof-browser.test.mjs` | qa → current/qa (1) |
| `tests/stage2-balance-retune.test.mjs` | design → current/design (1) |
| `scripts/apply-cartoon-texture-blender.py` | engineering → current/engineering (3) |
| `scripts/audit-mesh-detail-blender.py` | engineering → current/engineering (2) |
| `scripts/audit-stage-scenes.mjs` | engineering → current/engineering (1) |
| `scripts/author-wholebody-clips-blender.py` | engineering → current/engineering (1) |
| `scripts/bake-character-albedo.py` | engineering → current/engineering (1) |
| `scripts/bind-static-lower-mesh.py` | engineering → current/engineering (1) |
| `scripts/export-stage1b-formation-attribution.mjs` | engineering → current/engineering (1) |
| `scripts/export-stage1b-persistence-scenarios.mjs` | engineering → current/engineering (1) |
| `scripts/export-stage1b-pressure-packets.mjs` | engineering → current/engineering (1) |
| `scripts/promote-character-assets.py` | engineering → current/engineering (4) |
| `scripts/qa-actor-readability-probe.mjs` | qa → current/qa (1) |
| `scripts/qa-clip-track-census.mjs` | qa → current/qa (1) |
| `scripts/qa-idle-track-probe.mjs` | qa → current/qa (1) |
| `scripts/qa-motion-probe.mjs` | qa → current/qa (2) |
| `scripts/qa-visual-verification.mjs` | qa → current/qa (1) |
| `scripts/rig-all-characters.sh` | engineering → current/engineering (1) |
| `scripts/rodin-tpose-regen.py` | engineering → current/engineering (1) |
| `scripts/run-stage1b-pressure-packets.mjs` | engineering → current/engineering (1) |
| `scripts/stage-cartoon-texture-pack.py` | engineering → current/engineering (1) |

Coverage included string literals, split literals, comments, docstrings, `--help` text,
and default argument values. Each write asserted that the file's count of
`_workspace/archive/` occurrences was unchanged, so no archive read could be rewritten
by accident [OBSERVED].

`scripts/audit-stage-scenes.mjs` behaved exactly as the brief required: line 8
`OUTPUT_PATH` moved to `current/`, line 10 `ALL_MESH_PROVENANCE_PATH` still reads the
archive [OBSERVED].

---

## 5. Surviving dated references

`grep -E "_workspace/2026072[56]-"` across `tests/` and `scripts/` returns
**no matches** [OBSERVED]. That pattern cannot match an archive path, since
`_workspace/archive/20260726-…` does not contain the substring `_workspace/20260726-`.

The broader pattern `2026072[56]-` surfaces two justified categories.

### 5a. Deliberate `_workspace/archive/` reads — 3 sites, all resolve [OBSERVED]

| Site | Justification |
|---|---|
| `scripts/audit-stage-scenes.mjs:10` | `ALL_MESH_PROVENANCE_PATH` — reads frozen v2 texture-candidate provenance; the brief names this as legitimately archive-bound. Target exists. |
| `tests/stage-terrain-environment-contract.test.mjs:38` | Same archived `audit.json`; the contract test pins terrain provenance against frozen history. Target exists. |
| `scripts/bake-character-albedo.py:63` | `DETAIL_TILE` — reads the archived `abyssal-toon-surface-subtle-v01.png` detail texture. Target exists. |

### 5b. Run-id provenance labels, not filesystem paths — 11 sites

`scripts/measure-g7-core-loop.mjs` (L3, L368), `scripts/qa-actor-readability-probe.mjs`
(L1), `scripts/qa-clip-track-census.mjs` (L1), `scripts/qa-idle-track-probe.mjs` (L1),
`scripts/qa-motion-probe.mjs` (L1), `scripts/qa-visual-verification.mjs` (L1, L486),
`scripts/run-g2-margin-probe.mjs` (L2), `scripts/run-g3-exploit-probe.mjs` (L2),
`scripts/run-g3-stance-events.mjs` (L24), `scripts/run-g6-perf-budget.mjs` (L3).

These are bare run-id strings in comments and `runId:` / `RUN_ID` fields — they carry no
`_workspace/` prefix and open no file [OBSERVED]. They record which production cycle
produced a measurement. Rewriting them would falsify the provenance of past
measurements, directly against CLAUDE.md §1 ("never present an inherited baseline as a
new measurement"). Deliberately left unchanged.

---

## 6. Spot-check test runs (verbatim outcomes)

### `node --test tests/character-albedo-bake.test.mjs` — **PASS** [OBSERVED]

```
# tests 53
# suites 0
# pass 53
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 86225.807125
```

Wall time 86.34 s. This exercises the rewritten `LANE_MANIFEST` path — subtest 7
("re-running the bake reproduces the shipped atlases byte for byte") reads
`_workspace/current/engineering/asset-pipeline/runtime-candidates/character-albedo/character-albedo.manifest.json`
and passed, so the rewrite resolves against real relocated content.

### `node --test tests/commander-guard-pose.test.mjs` — **FAIL, pre-existing** [OBSERVED]

```
not ok 1 - deployed commander is the byte-exact audited guard-pose candidate
  error: "ENOENT: no such file or directory, open
    '/Users/jangyoung/orca/Abyssal-Surge/_workspace/current/engineering/asset-pipeline/
     player-combat-animation-candidate/author_player_combat_clips.py'"
not ok 2 - deployed commander preserves readable idle, attack, critical, melee, and ranged silhouettes
  error: "ENOENT: no such file or directory, open
    '/Users/jangyoung/orca/Abyssal-Surge/_workspace/current/engineering/asset-pipeline/
     player-combat-animation-candidate/audit.json'"
# tests 2
# pass 0
# fail 2
```

**This failure is not caused by the migration** [OBSERVED]. Proof from the inventory
captured *before* any file was moved: the dated root's
`engineering/asset-pipeline/player-combat-animation-candidate/` contained exactly two
entries —

```
__pycache__/author_player_combat_clips.cpython-314.pyc
dusk-warden.glb
```

Neither `author_player_combat_clips.py` nor `audit.json` was there. The test was already
failing with ENOENT at the **old** path; the rewrite changed the path in the error
message, not the outcome. Both files exist only under
`_workspace/archive/20260726-…/engineering/asset-pipeline/player-combat-animation-candidate/`.

No path was fabricated and no assertion weakened to make this pass.

---

## 7. Dangling references for parent decision

Three rewritten references now point at `current/` paths that hold no file. All three
were **already dangling at the dated root before the migration** — none appeared in the
pre-move inventory; each exists only in the archive [OBSERVED]. Behaviour is unchanged
by this work.

| Reference target (now) | Referenced from | Content actually lives at |
|---|---|---|
| `_workspace/current/engineering/asset-pipeline/all-mesh-texture-candidates-v2/audit.json` | `tests/stage-cartoon-texture-pack.test.mjs`, `scripts/stage-cartoon-texture-pack.py` | `archive/20260726-…/engineering/asset-pipeline/all-mesh-texture-candidates-v2/audit.json` |
| `_workspace/current/engineering/instrumentation-contract.md` | `scripts/export-stage1b-{formation-attribution,persistence-scenarios,pressure-packets}.mjs`, `scripts/run-stage1b-pressure-packets.mjs` | `archive/20260726-…/engineering/instrumentation-contract.md` |
| `_workspace/current/design/stage-playtime-doctrine.md` | `tests/stage2-balance-retune.test.mjs` (comment only) | `archive/20260726-…/design/stage-playtime-doctrine.md` |

Plus the two files behind the §6 failure
(`player-combat-animation-candidate/{author_player_combat_clips.py,audit.json}`), same
situation.

Note `_workspace/current/engineering/asset-pipeline/all-mesh-texture-candidates/`
exists (no `-v2` suffix) — a possible version drift, not investigated here [INFERENCE].

**Not resolved here, deliberately** [TARGET]: repointing these at `_workspace/archive/…`
would be a semantic change beyond the Contract rewrites this task authorised, and the
brief scoped archive references as out of bounds. The parent should decide whether each
consumer wants frozen archive provenance (point at `archive/`) or a live `current/` copy
(promote the artefact into `current/`).

---

## 8. Constraint compliance

- Zero git commands executed [OBSERVED].
- `_workspace/archive/**` never written, moved onto, or deleted; count 245 → 245 [OBSERVED].
- No payload regenerated or deleted; the one collision preserved both copies [OBSERVED].
- No new dated folder created [OBSERVED].
- Runtime source untouched — only `tests/**`, `scripts/**`, and this report were written [OBSERVED].
- No formatter, linter, or full test suite run; only the two briefed single-file tests [OBSERVED].
