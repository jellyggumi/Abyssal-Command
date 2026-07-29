# UI Asset Refresh — routing packet, asset contract, and evidence

run-id: `20260728-onslaught-action-pivot`
lane: `ui/`
scope: lobby → in-game HUD → button/control resources, generated and wired
date: 2026-07-28

---

## 1. Routing packet — `web-game-development`

```markdown
## Routing packet
- Matched sub-skill(s): build-hybrid-game-assets (primary), create-game-vfx (not invoked)
- Why this is narrowest: the task is 2D UI/interface resource authoring plus runtime
  delivery, which the routing table assigns to the hybrid-asset lane ("imported
  meshes, procedural 3D geometry, AI-generated reference art, 2D UI media, sprites,
  VFX, and performance-ready runtime asset delivery"). It is not level authoring,
  not enemy/rig work, not combat, and not encounter design.
- Installed? no — `${SKILLS_ROOT:-$HOME/.agents/skills}` contains only
  `game-studio-harness`; the 19 upstream MengTo sub-skills are not present locally.
  Fetch command: `scripts/fetch-upstream-skills.sh --skill build-hybrid-game-assets`
  (the script itself ships with the routing pack, not with this repository).
- Lifecycle stage: assets (after systems, before feel/perf/QA)
- Route-out: none — stays inside the Three.js/browser family. Unity/Unreal guidance
  is explicitly inapplicable (CLAUDE.md §2).
```

**Lifecycle compliance.** CLAUDE.md §2 fixes the order
`prototype → systems → content → assets → feel → perf → QA → release`. This pass is
the **assets** stage and touched no simulation code: every edit is presentation-layer
(`styles.css`, DOM attributes in `app.js`, `sw.js` precache, three allowlists). No
renderer or UI change writes back into simulation state or alters `getRunDigest()`
inputs. [OBSERVED] `git diff --stat` for this pass lists no
`defense-run-simulation.js` change authored here.

---

## 2. `open-design-game-*` skills — applicability, stated honestly

All three skills were read in full: `open-design-game-ui-concept`,
`open-design-game-ui-handoff`, `open-design-game-ui-takeover`.

**They cannot be executed as written in this repository.** Their machinery targets a
different project (Darkbone Archer, a Phaser title) and depends on scripts and
surfaces that do not exist here:

| Required by skill | Present here? |
|---|---|
| `.agents/skills/open-design-game-ui-concept/scripts/capture_meta_ui_design_audit.mjs` | [OBSERVED] absent — `find` over the repo returns no match |
| `package_open_design_handoff.mjs`, `validate_preservation_contract.mjs`, `capture_open_design_preview.mjs` | [OBSERVED] absent |
| `docs/hard-rules/ui-adaptation-upgrade-only-contract.md` | [OBSERVED] absent |
| Six-screen surfaces (`#home`, mapselect, talent, masks, fusion, victory) | [OBSERVED] absent — this shell is a two-dock + battle-surface layout |
| `window.DARKBONE_VFX_LAB` review API | [OBSERVED] absent |
| Local Open Design app + `gpt-5.6-sol` run binding | [OBSERVED] not available in this session |

Reporting a preservation-contract hash, a preview manifest, or generation evidence
bound to an Open Design revision would therefore have been fabrication.

**What was transferred is the discipline, not the tooling.** Three of their rules are
engine-agnostic and were applied:

1. **Upgrade-only / omission ≠ deletion.** Every icon-bearing element kept its
   existing accessible name, its `aria-hidden` status, its event handlers, and its
   layout role. `LEFT_DOCK_TABS`/`RIGHT_DOCK_TABS` retain the original `icon` glyph
   beside the new `iconId`, and `renderDockSide()`'s `railIcon()` falls back to that
   glyph when `iconId` is absent — a missing asset degrades to the previous readable
   character instead of an empty box.
2. **Rendered-vs-rendered proof, never source inspection alone.** Every claim in §5
   comes from a real browser measuring real computed styles, including one state
   (mid-damage integrity bars) that a full-health screenshot cannot distinguish.
3. **No live behaviour replaced by a static placeholder.** The one place this was at
   risk is documented as a defect and its fix in §6.

---

## 3. Asset contract — 16 assets, each bound to a real runtime surface

Generator: **god-tibo-imagen** (`gti`), the fixed owner for concept art under
CLAUDE.md §3. Post-processing: `scripts/build-ui-icon-assets.py`.

| Asset id | Runtime surface (verified) | CSS box | Ships at |
|---|---|---|---|
| `nav-growth` | `.dock-rail-icon[data-ui-icon]` — 성장 tab | 40px | 96² |
| `nav-companions` | 군단 tab | 40px | 96² |
| `nav-inventory` | 인벤토리 tab | 40px | 96² |
| `nav-sortie` | 출정 tab | 40px | 96² |
| `nav-stronghold` | 요새 tab | 40px | 96² |
| `currency-echo-core` | `.rail-currency-glyph` — Echo Core chip | 22px | 64² |
| `currency-bound-fragment` | `.rail-currency-glyph` — Bound Fragment chip | 22px | 64² |
| `stat-commander` | `.gate-panel-bar-icon` beside the commander bar | 13px | 64² |
| `stat-gate-integrity` | `.gate-panel-bar-icon` beside the gate bar | 13px | 64² |
| `stat-echo-xp` | `.hud-xp::before` | 14px | 64² |
| `brand-mark` | `.dock-brand` | 1.9rem | 64² |
| `control-close` | `.dock-panel-close` | 44px | 96² |
| `control-pause` | `#toggle-pause::before` | 15px | 96² |
| `control-sortie` | `.sortie-fab b` | 26px | 64² |
| `lobby-command-plate` | `.page-atmosphere::before` | cover | 1280×720 |
| `seal-atlas-plate` | `.mission-panel.has-atlas-plate::before` | cover | 1280×720 |

Assets ship at 2× their CSS box so a 2× display stays crisp without a third variant.
Total payload **[OBSERVED] 450,064 bytes** for all 16
(`python3 scripts/build-ui-icon-assets.py --json`).

### 3.1 Two attribute families, deliberately separate

- `[data-ui-icon]` — the element **is** the icon. Needs an explicit box because the
  glyph text it replaced is gone.
- `[data-ui-icon-lead]` — the element **keeps its own content** and gains a leading
  icon via `::before`. Never changes the element's layout role, so existing HUD
  geometry assertions still hold.

### 3.2 Accessibility invariant

Every icon-bearing node was already either `aria-hidden="true"` with an adjacent
`.sr-only` label (dock tabs), or carried its own `aria-label` (currency chips,
close, brand, pause). Swapping a glyph for a background image is therefore
invisible to assistive technology. [OBSERVED] phone audit at 390×844 found **zero**
interactive targets below 44×44 and no horizontal overflow.

### 3.3 Provenance

Each of the 16 concept plates has an adjacent `.provenance.json` under
`assets/images/battle/pilot/` recording prompt, revised prompt, tool, model,
response id, SHA-256, `runtimeEligible: false`, the bound runtime surface, the
promotion path, and the number of generation rounds it took to pass the legibility
audit. Promotion into `assets/images/battle/ui/` is performed only by
`scripts/build-ui-icon-assets.py`.

---

## 4. The legibility gate — why 9 assets were regenerated

First-round output was gorgeous at 96px and **unusable** at the real CSS box. Renders
at true size on the actual `.dock-rail` background produced this verdict:

| Assets | Box | Round-1 verdict |
|---|---|---|
| `nav-growth`, `nav-inventory` | 48px | reads |
| `control-close`, `control-pause` | 44px | reads cleanly |
| `brand-mark` | 30px | reads |
| `nav-companions`, `nav-stronghold` | 48px | **mud** — ornate massing collapses |
| currency ×2, `control-sortie` | 20px | **mud** |
| stat ×3 | 18px | **mud** |

**Small icons need different art, not smaller art.** Nine assets were regenerated:
the sub-30px surfaces as bold single-mass silhouettes, and `nav-companions` /
`nav-stronghold` / `nav-sortie` re-framed as ornate medallions with heavy simplified
interiors so the five-tab rail reads as one family. `nav-sortie` took a third round
because round 2 produced an unframed sliver that broke the row's rhythm beside four
framed medallions.

[OBSERVED] regeneration rounds: `nav-companions` 3, `nav-stronghold` 3,
`nav-sortie` 2, `currency-echo-core` 2, `currency-bound-fragment` 2,
`stat-gate-integrity` 2, `stat-commander` 2, `stat-echo-xp` 2, `control-sortie` 2.

### 4.1 The matte is not a luminance key

These plates are dark-gothic and carry large near-black regions **inside** the glyph.
[OBSERVED] on `concept-ui-stat-commander.png`, 53% of interior pixels fall below
luminance 22 and 68% below 40 — a global black-to-alpha key erases most of the
portrait. `keyed_rgba()` instead labels the field-dark pixels into 4-connected
components and mattes **only the components touching the canvas border**; an
enclosed dark pocket stays fully opaque.

---

## 5. Rendered evidence

Captured against the **simulated Pages bundle** (`git archive` of the staged tree,
served over HTTP), not the dev worktree — so the evidence describes what deploys.

| Artifact | Content |
|---|---|
| `../qa/ui-asset-refresh-20260728/01-lobby-desktop-1440x900.png` | lobby, both docks open, all rail icons + brand + close + currency + FAB |
| `../qa/ui-asset-refresh-20260728/02-battle-desktop-1440x900.png` | live run, combat HUD with stat/XP/pause icons |
| `../qa/ui-asset-refresh-20260728/03-gate-panel-stat-icons.png` | gate panel close-up, both stat icons at 13×13 beside their bars |
| `../qa/ui-asset-refresh-20260728/04-lobby-phone-390x844.png` | phone lobby, 12 visible icons |

[OBSERVED] measured in the bundle:

- all 16 assets decode (`naturalWidth`/`naturalHeight` match their declared size);
- 19 `[data-ui-icon]` nodes mount, every one resolving a `.webp`;
- **zero** console errors, **zero** ≥400 responses;
- the two `stat-*` bar icons measure 0×0 pre-run because
  `#defense-battle-surface[data-defense-started="false"] #defense-edge-hud` is
  `display: none` by design, and 13×13 once a run starts;
- `#toggle-pause::before` → `control-pause.webp` at 15×15;
  `.hud-xp::before` → `stat-echo-xp.webp` at 14×14.

---

## 6. Defects found and fixed during wiring

### 6.1 Integrity bars would have rendered permanently full

The first HUD attempt made the stat icon a flex sibling of the bar fill. `flex: 1`
implies `flex-basis: 0%`, which **overrides** the `style.width = "<ratio>%"` that
`app.js` writes on `#battle-commander-bar-fill` / `#battle-gate-bar-fill`. Both bars
would have pinned to 100% and all damage would have become invisible — and a
full-health screenshot looks identical either way, so this could have shipped.

Second attempt moved the icon to an absolutely positioned `::before` on the track;
that is also wrong, because `.gate-panel-bar-track` carries `overflow: hidden` (it
needs it, to clip the fill to the pill radius), which clips the pseudo-element away.

**Shipped fix:** each icon is a real element and a grid sibling of its track inside
`.gate-panel-bars`. The track keeps its original geometry untouched.

[OBSERVED] proof at a non-full state — real simulation damage, no synthetic write:
commander `988/1000` renders **98.8%**, gate `1588/1600` renders **99.2%**, and
rendered width matched the app-written percentage on every sample.

### 6.2 A global z-index override broke the renderer layering contract

`styles.css` carried `#world-hud-overlay { z-index: 2 }` and
`#defense-battle-surface::after { z-index: 2 }` unscoped, inside another session's
in-flight lobby-cinematic block. That ties the world HUD with `.battle-stage-art`
(also 2) and lets the backplate cover the live combat readout mid-run.
[OBSERVED] `tests/defense-renderer-contract.test.mjs` failed with
`stage art z-index 2 must remain below world HUD z-index 2`; the same test passes
22/0 at HEAD.

**Fix:** scoped both to `[data-defense-started="false"]`. The lobby cinematic only
renders pre-run, so its intent (overlay at z-index 3 above both) is preserved
exactly, and combat-time layering returns to the authored 4/5 order. This narrows
another session's rule rather than reverting it — see §7.

### 6.3 Three assets collided with a deliberate naming guard

`tests/defense-asset-manifest.test.mjs:84` forbids any **retained** asset whose
basename starts with `action-`. [OBSERVED] the guard exists because 7 legacy
`assets/images/ui/action-*.png` RTS action-button icons were deleted in the no-RTS
closure, and it prevents their reintroduction.

`action-close` / `action-pause` / `action-sortie` were renamed to `control-*` across
the concept lane, provenance bodies, runtime lane, `styles.css`, `app.js`, `sw.js`,
`scripts/defense-runtime-assets.mjs`, `scripts/build-ui-icon-assets.py`, and the
workflow allowlist. They are UI controls, not RTS actions, so the rename respects
the guard instead of weakening it.

---

## 7. Co-owned files — another session's in-flight work

CLAUDE.md §5 forbids absorbing or discarding another session's changes silently.
Three items are recorded rather than quietly taken:

1. **`app.js` is co-owned.** Its index carried a prior session's staged slice-2
   combat work (`COMBAT_TARGETING`, none-target geometry) and its worktree carried
   that session's lobby-cinematic wiring interleaved with this pass's icon wiring.
   Git cannot split one file's hunks by pathspec, and the verified tree includes all
   of it, so the **full worktree `app.js` was committed** — the pushed tree equals
   the tree that passed the gates. Not reverted, not cherry-picked.
2. **`lobby-cinematic.js` was untracked and is now a hard dependency.**
   [OBSERVED] `app.js:51` statically imports `./lobby-cinematic.js`, the file was
   untracked, and it appeared in **none** of the release surfaces. Left alone, the
   Pages bundle would have shipped an `app.js` importing a file absent from the
   artifact — the deployed game would not boot at all. It is now tracked and
   registered in `PAGES_RUNTIME_PATHS`, `sw.js` `CORE_ASSETS`, and the
   `release-closure` expected list.
3. **The z-index narrowing in §6.2** modifies that session's CSS. It is a scope
   narrowing that preserves their stated intent, applied because the unscoped form
   fails a CI-gated test.

Also registered: `stage-world-catalog.js` was in `PAGES_RUNTIME_PATHS` but missing
from `sw.js` `CORE_ASSETS` despite being a static `app.js` import — a pre-existing
cold-offline gap, fixed in the same edit.

---

## 8. What this pass did NOT do

- **No world plates for stages 2–10 were generated.** [OBSERVED] `WORLD_TEXTURES`
  exists only in `battle-visualizer.js:22-25` (the Canvas2D fallback) and is gated
  by `if (projection?.stageId !== "cinder-span") return;` at :232.
  `battle-realtime-three.js` never references it, so **no player on the WebGL
  primary path sees a world plate on any stage**. Producing 18 more files for a path
  most players never reach would have been waste. The gap is recorded in
  `../design/stage-composition-map-stages-2-10.md` as systemic gap S1, which is a
  2-part asset **and code** job.
- **No gate was moved to PASS.** This is an assets-stage pass. G2/G4/G6 still require
  re-measurement and G8 remains blocked per
  `../production/task-manifest.md`. Icon legibility and touch-target measurements are
  component evidence, not a G4 immersion/accessibility verdict.
- **No Open Design artifact, preservation contract, or generation-evidence hash is
  claimed** — see §2.

---

## 9. Reproduction

```bash
# regenerate the runtime lane from the concept plates (idempotent)
python3 scripts/build-ui-icon-assets.py --json

# staleness check: every runtime asset present and newer than its concept plate
python3 scripts/build-ui-icon-assets.py --check --json

# re-sync the manifest after staging new assets (reads git ls-files)
node scripts/build-defense-asset-manifest.mjs --write
```

Regenerating a concept plate requires `gti` and consumes quota; use
`gti --dry-run` first (CLAUDE.md §3). The three allowlists that must stay in sync are
`scripts/defense-runtime-assets.mjs` `RETAINED_ASSET_PATHS`,
`assets/defense-asset-manifest.json`, and `.github/workflows/static.yml`
`PAGES_RUNTIME_PATHS` — plus `sw.js` `CORE_ASSETS` for offline boot and
`tests/release-closure.test.mjs` `UI_ICON_ASSETS` for the closure gate.
