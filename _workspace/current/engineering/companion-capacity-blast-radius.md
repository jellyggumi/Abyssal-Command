# Companion capacity blast radius — every hardcoded cap of 3

owner: game-programmer (cycle 9)
purpose: the complete site list that must change for capacity 3→10, found by audit
status: `[OBSERVED]` — every row read directly from source at commit `033877ad`

---

## Why this document exists

The 3→10 capacity feature is enforced in **nine** independent places across three
files. Six were not in the original plan. Two of them fail **silently** — they drop
companions with no error, no event, and no user feedback.

A change that touches only `MAX_LOADOUT_SIZE` produces a feature that passes every
simulation test and is **dead in the product**. That failure mode is why this audit
was run before the implementation landed rather than after a playtest.

Audit method: `grep` for `>= 3`, `> 3`, `.slice(0, 3)`, `` /3` ``, `최대 3`,
`length === 3` across `app.js`, `defense-run-simulation.js`, `campaign-state.js`,
`rpg-catalog.js`, `defense-catalog.js`.

---

## The nine sites

### `campaign-state.js` — the declared constant (2 sites)

| Line | Code | Role |
|---|---|---|
| 22 | `const MAX_LOADOUT_SIZE = 3;` | the constant; **not exported** |
| 281 | `candidate.companionLoadout.prototypeIds.length > MAX_LOADOUT_SIZE` | load-time validation, inside `validCampaign()` |
| 503 | `prototypeIds.length > MAX_LOADOUT_SIZE` | mutation-time guard, inside `setCompanionLoadout()` |

Validation-order hazard [OBSERVED]: line 281 runs **before** `resolvedIds` is
validated at line 282, and there is **no precedent** in this file for
derived-budget validation inside `validCampaign()` — the Bound Fragment budget
check runs only in the mutator `purchaseEquipmentTier()` (:574). Therefore line 281
must validate against the literal ceiling (10), never against a resolver, or a
tampered save could self-certify its own capacity.

### `defense-run-simulation.js` — the silent truncator (2 sites)

| Line | Code | Role |
|---|---|---|
| 48 | `validLoadout = (loadout) => [...new Set(...)].sort().slice(0, 3)` | **SILENT** truncation at run creation |
| 643-667 | `addCompanion(run, companionId, ...)` | mid-run add with **no capacity gate at all** |

`:48` is the most severe site in the audit. It is called from `resolveFormation()`
during `createDefenseRun()`, so a campaign carrying 6 deployed companions enters the
run with exactly 3 — no error, no event. It would defeat a correct fix in all eight
other places.

The `[...new Set(...)].filter(...).sort()` chain is **determinism-load-bearing**.
Change only the clamp bound; preserve set-dedup and sort ordering exactly.

`:643-667` is defect **D3**: `addCompanion` pushes to `run.companions` with no
length check, so a 4th+ companion can already be added mid-run **today**, before any
of this cycle's work. Extraction will drive this path, so it must gate.

### `app.js` — lobby enforcement (5 sites)

| Line | Code | Failure mode if unchanged |
|---|---|---|
| 632 | `const full = !deployed && loadout.length >= 3;` | computes "roster full" at 3 |
| 634 | `${full ? " disabled" : ""}` | **disables every remaining chip** — player hard-blocked |
| 637 | `` `${loadout.length}/3` `` | count display stuck at `/3` |
| 639 | `loadout.length >= 3` | wrong hint branch |
| 641 | `"최대 3명까지 편성할 수 있습니다."` | copy asserts a false rule |
| 1187 | `[...current, prototype].slice(0, 3)` | **SILENT** — toggle drops the 4th companion on click |
| 1372 | `"최대 3명을 출전 편성하세요."` | guide copy asserts a false rule |

`:634` and `:1187` are two **independent** hard blocks. Fixing only the `disabled`
attribute leaves the click handler silently discarding the selection; fixing only
the handler leaves the chip unclickable.

---

## Failure-mode summary

| Class | Sites | Symptom |
|---|---|---|
| Hard block (visible) | `app.js:632`, `:634` | chip greyed out, player cannot try |
| **Silent drop** | `app.js:1187`, `defense-run-simulation.js:48` | selection or companion vanishes, no message |
| Missing gate | `defense-run-simulation.js:643-667` | over-capacity roster accepted (pre-existing bug) |
| False copy | `app.js:641`, `:1372` | UI states a rule the game no longer has |
| Display only | `app.js:637` | count reads `/3` |
| Validation | `campaign-state.js:281`, `:503` | save rejected or accepted at the wrong bound |

The two silent-drop sites are the dangerous ones. A visible block gets reported by
the first playtester; a silent drop gets reported as "the game feels wrong" three
weeks later, or never.

---

## Required bounds — three different values, deliberately

| Checkpoint | Bound | Reason |
|---|---|---|
| `validCampaign()` load time | literal **10** (`COMPANION_CAPACITY_MAX`) | runs before `resolvedIds` validation; must not trust the candidate's own progression |
| `setCompanionLoadout()` mutation | `companionCapacityForCampaign(campaign)` | authoritative derived capacity |
| `addCompanion()` run time | resolved run capacity | gates extraction-driven adds |
| `validLoadout()` run creation | resolved capacity, else `COMPANION_CAPACITY_MAX` | must not truncate silently |
| `app.js` all 7 sites | resolved capacity | display and enforcement must agree |

Using one bound everywhere is wrong. The load-time bound must be the literal
ceiling precisely because it cannot trust derived state.

---

## Acceptance

**Base-3 no-change rule**: with capacity at base 3 and no slots unlocked, every one
of the nine sites must behave byte-identically to commit `033877ad` — `0/3`
rendered, identical `disabled` behaviour, identical copy, identical clamp at 3,
identical run digest. The literals are being replaced by a resolver that *returns*
3 for a base campaign; the clamps are not being removed.

Any observable difference for a player who has unlocked nothing is a regression,
not a feature.

---

## Note for the cycle-10 session

`app.js` lobby companion-deployment logic is **not** the battle-HUD overhaul. If you
restyle `#lobby-companion-row`, `#lobby-companion-count`, or
`#lobby-companion-hint`, read capacity from `companionCapacityForCampaign(campaign)`
rather than reintroducing a literal `3`. Cycle 9 owns the correctness of these
sites; cycle 10 owns their appearance.
