# Concurrent-session collision — `app.js` + `defense-run-simulation.js`

run-id: `20260729-abyssal-lantern-cycle`
owner: Main session (UI/deck + joint-articulation + rename lanes)
status: **UNRESOLVED — external writer still active. Repairs abandoned by decision.**

---

## 1. What happened `[OBSERVED]`

`defense-run-simulation.js` is modified in the working tree and **does not parse**. This
session never edited that file; every path this session touched is listed in §4.

Successive broken states were observed, i.e. an external writer is active:

| time | mtime of file | parse error |
|---|---|---|
| 22:13:25 | 22:13:25 | `:2523` `missing ) after argument list` |
| 22:14:48 | 22:14:48 | `:1608` (different site) |
| 22:16:04 (+75 s) | 22:14:48 (unchanged) | `:1608` still |

Verified with:

```bash
cp defense-run-simulation.js /tmp/c.mjs && node --check /tmp/c.mjs
```

`node --check` on the `.js` path is NOT sufficient — it parses as CommonJS and reports
success on a broken ES module. The copy-to-`.mjs` form above is the check that catches it.

## 2. Nature of the corruption `[OBSERVED]`

Both failures are the same shape: a block of unrelated code spliced into the middle of an
expression, destroying the enclosing call.

- `:2522-2531` — the commander basic-attack cooldown block (which already exists correctly
  at `:2543`) was pasted inside the `sortedActors(run.enemies).find((entry) => ...)`
  predicate of the enemy-impact branch. That destroyed the escort-guard damage application
  and the `emit(run, "PROJECTILE_IMPACT", { ... })` opener; the payload keys at `:2532-2540`
  are left orphaned.
- `:1606-1608` — `emit(run, "SKILL_CAST", { ... })` was pasted inside the object literal of
  `emit(run, "CRITICAL_HIT", { ... })`.

`git diff` shows the writer's intended work is substantial and coherent elsewhere
(a new `commanderBasicAttack(run, mode)`, `updateM4Recovery`/`processM4Decision`
restructuring, an action allowlist). The splices look like an editing-tool defect, not a
design decision.

## 3. Why this session did not repair it

CLAUDE.md §5: *"Never restore, discard, or force-overwrite another session's changes. On
collision: stop, document, resolve explicitly."*

- `git checkout -- defense-run-simulation.js` would discard ~40 lines of in-flight feature
  work that is not this session's to judge.
- Hand-repairing the two splice sites requires guessing the writer's intent for the
  escort-guard removal at `:2522`; HEAD applies the guard through `damageEnemyBody()`
  (`:1089-1096`, still present), so whether the inline copy was meant to be deleted or
  rewritten cannot be determined from the broken state.
- No addressable peer owns it: `irc list` shows only this session and its own
  `NarrativePresentation` subagent, whose lane was `_workspace/current/design/` exclusively.
  The writer is an out-of-process session in the same worktree.

## 4. Blast radius on this session's verification `[OBSERVED]`

`app.js` statically imports `defense-run-simulation.js`, so while it does not parse:

- the app does not mount (`#defense-app` empty, `PAGEERROR` in console);
- every browser measurement returns zeros and reads like a layout regression;
- browser-driven tests cannot pass.

Measurements taken **before 22:13:25** remain valid and are cited in
`ui/dock-removal-plan.md` and the deck comments in `styles.css`. Anything after that
timestamp must be re-taken once the tree boots.

Paths this session owns (nothing else was staged or committed):

```
app.js  styles.css  index.html  manifest.json  privacy.html  package.json
sw.js  README.md  .github/workflows/static.yml
tests/{lobby-system-window,lobby-guide-disclosure,defense-stat-delta,stage-runtime-proof,release-closure}*
tests/{world-presentation,defense-public-contract}-browser.cjs
scripts/{measure-joint-articulation,repair-joint-weights,gate-joint-weight-repair,record-weight-repair-provenance}.py
assets/motion/ingame/characters/**   _workspace/current/**
```

## 5. Resolution required by a human owner

1. Decide whether the writer's in-flight change is still wanted.
2. If yes: close the `.find(` predicate at `:2523`, restore the escort-guard damage
   application and the `PROJECTILE_IMPACT` emit opener, and move the duplicated
   commander-cooldown block out of the predicate (it already exists at `:2543`). Then remove
   the `SKILL_CAST` splice from inside the `CRITICAL_HIT` literal at `:1608`.
3. If no: `git checkout -- defense-run-simulation.js`, with the writer's consent.
4. Re-run `node --test 'tests/**/*.test.mjs'` and the browser contracts afterwards; the
   deterministic-simulation invariant (CLAUDE.md §2) cannot be evidenced until then.

---

## 6. Recurrence log — why repair was abandoned `[OBSERVED]`

Four splice sites were repaired in this session, each preserving the writer's intent rather
than discarding it (their upgraded `SKILL_CAST` payload was moved to the correct emit; their
`combat-input-cluster` markup was relocated into `mountShell`'s HUD and given the CSS it
lacked). Two of those sites then **recurred**, and two entirely new sites appeared while the
repairs were being made.

| time | file:line | site | note |
|---|---|---|---|
| 22:13:25 | `sim:2523` | escort `.find()` predicate | commander-cooldown block spliced in |
| 22:14:48 | `sim:1608` | `CRITICAL_HIT` object literal | `SKILL_CAST` emit spliced in |
| 22:17:12 | `app:1392` | `spawnSortieBurst` particle loop | HUD markup spliced over `particle.style.left` |
| 22:18:20 | `app:1407` | `requestBattleImmersion` callback | `combat-input-cluster` markup spliced in |
| 22:23:57 | `sim:2528` | escort predicate **again** | recurred after repair |
| 22:24:58 | `app:1939` | `onMoveControlDown` method body | new: method left bodyless |
| 22:25:06 | `sim:2650` | brace imbalance reaches `export` | depth is already 2 at top-level `function tick` (`:2387`), so an unclosed brace exists upstream of every site repaired |

Repair velocity lost to corruption velocity: each fix had roughly a one-minute half-life, and
the writer moved into a class (`onMoveControlDown` / `onAttackControlDown`) this session never
edited. Continuing would be an unwinnable race, so repairs stopped here by decision rather
than by exhaustion.

## 7. What this session committed, and what it held back

**Committed** — independently verified, none of it depends on a booting tree:

- `assets/motion/ingame/characters/**` — 9 of 11 runtime GLBs skin-weight repaired, each
  gated per asset; the 2 that could not pass were left at shipped bytes.
- `scripts/{measure-joint-articulation,repair-joint-weights,gate-joint-weight-repair,record-weight-repair-provenance}.py`
- `_workspace/current/engineering/asset-pipeline/motion-bench/*.json` — baselines, gate
  report, before/after measurements.
- `_workspace/current/design/*` — synopsis, image-driven staging spec, title rationale.
- `README.md`, `sw.js`, `.github/workflows/static.yml`, `tests/release-closure.test.mjs`,
  `manifest.json`, `privacy.html`, `package.json` — the `Abyssal Command`/`Abyssal Surge` →
  **`Abyssal Lantern`** rename, including the three coupled cache-prefix sites.

**Held back** — cannot be committed while the collision is live:

- `app.js`, `styles.css` — the persistent-deck UI. These two are inseparable: committing the
  stylesheet without the renderer would ship the old slide dock with zero CSS for it, and the
  deck CSS with no deck markup to style. Measured green before the collision (portrait /
  landscape / desktop: deck body never scrolls, 0 interactive targets under 48dp on the
  segment bar, accessible names present in all three).
- `tests/{lobby-system-window,lobby-guide-disclosure,defense-stat-delta,stage-runtime-proof}*`,
  `tests/{world-presentation,defense-public-contract}-browser.cjs` — these assert deck
  selectors and must travel with `app.js`, never ahead of it.
- `defense-run-simulation.js` — the writer's file; untouched in the commit.
