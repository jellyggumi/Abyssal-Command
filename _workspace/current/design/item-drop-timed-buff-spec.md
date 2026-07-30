# Item drop → timed stat buff — system spec

run-id: `20260728-onslaught-action-pivot`
cycle: 10
lane: `design`
owner: DropBuffSystem
status: **design only.** No production source is modified by this document.
authority: `design/master-numeric-contract.md` outranks every number here. Director
rulings v1/v2/v3 outrank every name here.

> ## ⚠ READ FIRST — inline line numbers are for the WRONG TREE
>
> `[OBSERVED]` This spec was authored in `~/orca/Abyssal-Surge`, whose working tree carries
> ~430 uncommitted lines from a concurrent session — `defense-run-simulation.js` is **4002
> lines** there. **Implementation happens in `~/orca/Abyssal-Surge-dungeon` @ `033877ad`,
> where that same file is 3570 lines.** The offsets are large and systematic, and two of my
> inline citations (`:3610`, `:3858`) are **past EOF** in the implementation tree.
>
> Worse, a few citations match by coincidence (`makeOffer`'s `run.rng = seed` really is at
> `:1838` in both), so a spot-check can pass while everything else is off by hundreds of
> lines.
>
> **Use §0 below. It is measured in the implementation tree.** Every inline `:NNNN` in
> §1–§7 is authoring-tree provenance for its `[OBSERVED]` claim — it proves the code was
> read, it does **not** tell you where to edit. Anchor on the symbol name and the quoted
> code text. If the code at your commit differs from what this spec quotes, **stop and
> escalate — do not adapt silently.**

---

## 0. Authoritative anchor table — `~/orca/Abyssal-Surge-dungeon` @ `033877ad`

`[OBSERVED]` Grepped directly in the implementation worktree, then cross-verified against
the director's independent measurement. Both passes agree on every symbol.

> **These are `033877ad` COMMIT coordinates. The WORKING TREE has since moved.** Implementers
> are writing now, and each owner's file grows under them:
>
> | File | @ `033877ad` | working tree, later re-measure | owner |
> |---|---|---|---|
> | `defense-run-simulation.js` | 3570 | **3570 — unchanged** | DropBuffImpl |
> | `defense-catalog.js` | 923 | **1077** | DropBuffImpl |
> | `battle-realtime-three.js` | 4846 | **5223** | RendererVfxImpl |
> | `app.js` | 3807 | **4147** | UiJoystickImpl |
>
> **The `defense-run-simulation.js` column below is still exact** — that file is untouched,
> which is the one that matters for steps 2–11. The `battle-realtime-three.js` sub-table is
> **stale**: `authoredAnchor` has moved 1144 → 1335 and `ensurePickup` 2928 → 3145
> `[OBSERVED]`. `PROP_BLADE_MESH` 222, `PROP_RELIC_MESH` 223, and `MAX_VISUAL_EFFECTS` 14
> are unchanged.
>
> This also retires the line-count tree-identity test (director R21): `923` / `4846` / `3807`
> no longer identify the dungeon tree, because its own owners have grown those files past
> those numbers. Identify the tree by **path**, not by line count. Re-grep the symbol.

### `defense-run-simulation.js`

| Symbol / code | Line | Used by |
|---|---|---|
| `const clone = (value) => JSON.parse(JSON.stringify(value))` | 23 | §3.1 serializability |
| `const nextId = (run, prefix) => \`${prefix}-${++run.nextId}\`` | **47** | §3.1 `buff-<n>`, §4.2 `drop-<n>` |
| `const actor = (id, kind, x, y, hp, maxHp, extra = {})` | 48 | §4.2 — `extra` spreads last, so `kind` overrides |
| `const sortedActors` | 49 | §6.4 sort discipline |
| `const SNAPSHOT_VERSION = 7` | **378** | §6.1 — **do not bump** |
| `const emit = (run, type, payload = {})` | 380 | §7 |
| gate recovery clamp `run.gate.maxIntegrity - run.gate.integrity` | 928 | §3.2 `gateMaxIntegrity` |
| retry floor `objective.retry.gateFloorBp` | 1036 | §3.2 `gateMaxIntegrity` |
| `function processEncounterRecovery` | 1054 | §3.4 Phase A neighbour |
| `function updateEncounterObjective` | 1086 | §3.4 Phase B neighbour |
| `function getCommanderSpeed` | **1142** | §3.2 `moveSpeedBp` — edit in place |
| extra-hit `run.combatRng = rngNext(run.combatRng)` | 1190-1191 | RNG precedent |
| extra-hit `resolveCritical(run, "basic", ...basicDamage...)` | **1192** | §3.2 `basicDamage` read site |
| `function eligibleCompanionItem` (`kind === "item" && ITEMS[...]`) | **1266** | §4.2 — why buff drops are excluded |
| `function assignCompanionItemClaims` | **1274** | §4.2 — same |
| `function resolveCritical` | 1371 | §3.2 `critChanceBp` |
| crit roll `run.combatRng % 10000 < profile.chanceBp` | **1375-1376** | §3.2 `critChanceBp` |
| `chanceBp: profile.chanceBp` | 1382 | §3.2 `critChanceBp` |
| basic attack `resolveCritical(run, "basic", ...basicDamage * mult)` | **1630** | §3.2 `basicDamage` read site |
| `function applyItem` | **1750** | §1 truth statement |
| ↳ `if (run.measurementProfile) return;` | **1751** | §3.6 guard precedent |
| ↳ gate clamp `clamp(..., 0, run.gate.maxIntegrity)` | 1756 | §1 |
| `function collectPickups` | **1762** | §4.3 |
| ↳ `const commanderRadiusSquared = run.commander.pickupRange ** 2` | **1764** | §3.2 `pickupRange` read site |
| ↳ `emit(run, "ITEM_COLLECTED", ...)` (**existing `ITEMS` path**) | **1805** | §7 — see the dual-path warning below |
| `run.rng = seed` in `makeOffer` | 1838 | §6.2 — **coincidentally matches the spec** |
| `const effectiveCooldownTicks = ... * run.commander.cooldownScale` | **1983** | §3.2 `cooldownScaleBp` read site |
| `function resolveDeaths` | **2209** | §6.3 roll site |
| ↳ `const dead = ...sort((a, b) => a.id.localeCompare(b.id))` | **2210** | §6.3 deterministic order |
| ↳ echo pickup creation | 2215 | §4.2 template |
| ↳ elite item creation, `entry.x + 240` | **2232** | §4.2 template, source of `DROP_OFFSET_X` |
| ranged `Math.round(enemy.damage * run.commander.incomingDamageMultiplier)` | **2481** | §3.2 `incomingDamageBp` read site |
| melee `Math.round(commanderDamage * run.commander.incomingDamageMultiplier)` | **2529** | §3.2 `incomingDamageBp` read site |
| gate breach clamp | 2540, 2561 | §3.2 `gateMaxIntegrity` |
| terrain recovery gate clamp | 2768-2770 | §3.2 `gateMaxIntegrity` |
| projectile gate clamp | 2962 | §3.2 `gateMaxIntegrity` |
| `function tick` | 2843 | §3.4 |
| ↳ `if (run.growthOffer) return;` | 2847 | §3.6 pause behaviour |
| ↳ **`processEncounterRecovery(run);`** | **2848** | §3.4 — **Phase A goes after this** |
| ↳ **`const commanderSpeed = getCommanderSpeed(run);`** | **2851** | §3.4 — **Phase A goes before this** |
| ↳ `assignCompanionItemClaims(run);` | 3030 | §3.4 |
| ↳ **`collectPickups(run);`** | **3031** | §3.4 — **Phase B goes after this** |
| ↳ **`updateEncounterObjective(run);`** | **3032** | §3.4 — **Phase B goes before this** |
| `const surpriseRng = rngNext(unsignedSeed ^ 0x6d2b79f5)` | 3180 | §6.1 — constant to avoid |
| **`combatRng: rngNext(unsignedSeed ^ 0x9e3779b9)`** in run literal | **3217** | §6.1 — **`dropRng` goes on the next line** |
| `nextId: 0` in run literal | 3218 | §6.1 |
| `pickupRange: 12000` in commander literal | 3292 | §2.4 baseline |
| **`if (!Number.isInteger(next.combatRng)) ...`** rehydration guard | **3446** | §6.1 — **`dropRng` + `buffs` guards go after** |
| `export function getRunSnapshot` | 3489 | §6.4 |
| `export function getRunDigest` | 3555 | §6.4 |

### `battle-realtime-three.js` (RendererVfxImpl owns this file)

| Symbol / code | Line | Used by |
|---|---|---|
| `const MAX_VISUAL_EFFECTS = 24` | 14 | §7 pool ceilings |
| `const PROP_BLADE_MESH = ".../prop-sprite-sheet-single-object.03/glb/base_basic_pbr.glb"` | **222** | §2.2 |
| `const PROP_RELIC_MESH = ".../prop-sprite-sheet-single-object.05/glb/base_basic_pbr.glb"` | **223** | §2.2 |
| `const authoredAnchor = event?.anchor ?? event?.position ?? event?.point` | **1144** | Open risk 1 / PR-1(a) |
| `function fitHeight` | 1339 | §2.2 — pickup target 0.7 |
| `ensurePickup(pickup)` | **2928** | §2.2 |
| ↳ `const modelPath = pickup.kind === "item" ? PROP_BLADE_MESH : PROP_RELIC_MESH` | **2932** | §2.2 — the line to change |
| `if (!anchor) return;` in `spawnVfx` | **4029** | Open risk 1 — silent drop |

### Determinism facts re-verified in the implementation tree

1. `getRunSnapshot` (3489) serializes **no** `rng`, `combatRng`, or `seed`. RNG state has
   never been in the digest, so `dropRng` adding none is consistent, not novel.
2. `getRunDigest` (3555) is exactly `JSON.stringify(getRunSnapshot(run))`.
3. `SNAPSHOT_VERSION` is `7` at line 378. §6.1's no-bump rule holds.
4. The `growthOffer` early-return (2847) sits ahead of the commander-move block, so §3.6's
   "buffs freeze during a growth offer" is structurally true.

### ⚠ `ITEM_COLLECTED` has two emit paths with two different catalogs

This is the one trap that survives correct line numbers. `ITEM_COLLECTED` is emitted from
**both**:

| Path | Line | `itemId` resolves against |
|---|---|---|
| existing `kind === "item"` branch (permanent stage item from the elite) | **1805** | **`ITEMS`** — `STAGE_ITEM_IDS` values: `ashen-sigil`, `ward-splinter`, `echo-compass` |
| new `kind === "buff"` branch (§4.3) | new code | **`BUFF_ITEMS`** |

`BUFF_ITEMS[itemId]` is `undefined` on the first path, and `.rarity` on that is a
**TypeError**, not a soft miss. Any consumer resolving rarity must write:

```javascript
const rarity = event.rarity ?? BUFF_ITEMS[event.itemId]?.rarity ?? null;  // null => permanent item
```

Cheapest discriminator: `event.dropId` exists only on the buff path. `dropId == null` ⇒
permanent stage item ⇒ no buff cue.

### File ownership (director, exclusive)

`defense-catalog.js` and `defense-run-simulation.js` → **DropBuffImpl only**.
`battle-realtime-three.js` → RendererVfxImpl. `app.js`/`styles.css` → UiJoystickImpl.
`defense-audio.js` → AudioImpl. §8 step 12 is a **RendererVfxImpl** task, not DropBuffImpl's;
AudioImpl must DM DropBuffImpl any `EVENT_CUES` entries rather than editing the catalog.

---

## 1. The truth this is built on

**`applyItem` grants permanent stat deltas. No timed modifier mechanism exists.**

`[OBSERVED]` `defense-run-simulation.js:2066-2075` (as-of 3983-line read), function
`applyItem(run, itemId)`:

```javascript
function applyItem(run, itemId) {
  if (run.measurementProfile) return;
  const item = ITEMS[itemId];
  if (item.damageBonus) run.commander.basicDamage += item.damageBonus;
  if (item.maxIntegrity) {
    run.gate.maxIntegrity += item.maxIntegrity;
    run.gate.integrity = clamp(run.gate.integrity + item.integrity, 0, run.gate.maxIntegrity);
  }
  if (item.pickupRange) run.commander.pickupRange += item.pickupRange;
  if (item.cooldownReduction) run.commander.cooldownScale = clamp(run.commander.cooldownScale - item.cooldownReduction, 0.5, 1);
}
```

Four direct `+=` assignments. No duration, no timer, no expiry, no reversal path.

Corroborating `[OBSERVED]` evidence:

| Claim | Evidence |
|---|---|
| No buff/aura/status mechanism anywhere | `engineering/runtime-surface-maps/map-simulation.md:274-275` — "**Temporary Modifiers: NONE EXISTS** … The system has NO buff, aura, status-effect, or timer-based modifier mechanism." |
| The only time-based effects are 4 unrelated one-shots | `map-simulation.md:277-281` — `cooldownScale` (persistent, not timed), `deniedUntil` (echo denial hold), Warden `≤30%`/`≤15%` one-time thresholds, first-strike flag |
| Renderer picks the pickup mesh from `kind` alone | `battle-realtime-three.js:2932` — `const modelPath = pickup.kind === "item" ? PROP_BLADE_MESH : PROP_RELIC_MESH;` |
| Drops today come only from the elite, one per stage, id from a fixed table | `defense-run-simulation.js:2521-2525` in `resolveDeaths`; `defense-catalog.js:855-859` `STAGE_ITEM_IDS` |

**Everything in this document is additive.** `applyItem` and the five `ITEMS` entries
keep their exact current behavior. Nothing here changes a permanent grant.

### 1.1 Ruled vocabulary this spec binds to

| Ruling | Binding |
|---|---|
| R1 | `DROP_SPAWNED` / `DROP_EXPIRED`. `ITEM_DROPPED` / `ITEM_DROP_EXPIRED` superseded. |
| R2 | `DROP_DENIED` ratified — `PICKUP_DENIED` stays reserved for echo denial. |
| R3 | `rarity` ∈ `"common" \| "rare" \| "resonant" \| "relic"` |
| R6 | `BUFF_REFRESHED` is a separate event. No `refreshed` bool. |
| R13 | `magnitude` is **always an integer in basis points**. |
| R14 | The integrity stat targets the **gate**; compose an effective cap, never mutate. |
| R16 | Catalog id is `itemId` everywhere. `defId` dropped. |
| R17 | `stat` ∈ the 7-value enum in §3.2. |
| R18 | `appliedAtTick`, `expiresAtTick`, `durationTicks`. No un-suffixed spellings. |
| R19 | One concept, one name, across sim / event / renderer / audio / HUD. |

---

## 2. Item definition contract

New frozen catalog **`BUFF_ITEMS`** in `defense-catalog.js`, sibling to `ITEMS`.

**It is a separate catalog, not an extension of `ITEMS`.** Reason `[OBSERVED]`: two live
call sites gate on `ITEMS[pickup.itemId]` — `eligibleCompanionItem` (`:1521-1525`) and
`assignCompanionItemClaims` (`:1548-1550`). Adding buff ids to `ITEMS` would silently make
companions claim, walk to, and collect buff drops. Keeping the catalogs separate means
**companion claiming excludes buff drops with zero code change**, which is a testable
property (§9 check 12), not a hope.

### 2.1 Definition fields

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | yes | Stable id. Equals the map key. Carried on every event as `itemId`. |
| `name` | string | yes | Display name. HUD reads this via `BUFF_ITEMS[itemId].name` — never duplicated into UI. |
| `rarity` | enum | yes | `"common" \| "rare" \| "resonant" \| "relic"` (R3). |
| `iconId` | string | yes | `data-ui-icon` sprite key, shape `buff-<slug>`. Matches the existing convention at `app.js:901,914,1784`. |
| `modelKey` | enum | yes | `"blade" \| "relic"`. Selects the prop GLB. §2.2. |
| `stat` | enum | yes | One of the 7 values in §3.2. |
| `magnitude` | **integer** | yes | Per-stack value in basis points. Never a float (R13). Sign is meaningful: negative = reduction. |
| `durationTicks` | **integer** | yes | Span, 60 Hz. |
| `maxStacks` | integer ≥1 | yes | Stack ceiling for this id. |
| `stacking` | enum | yes | `"REFRESH" \| "STACK"`. §4.4. |
| `stageIds` | string[] | yes | Which stages may roll this item. Sorted, frozen. |

Every field is a JSON primitive or an array of primitives. The catalog survives
`clone = (value) => JSON.parse(JSON.stringify(value))` (`:25`) with no loss — no `Map`,
no `Set`, no `undefined`, no function.

**Reference by id, never by copy.** HUD, renderer, and audio resolve `BUFF_ITEMS[itemId]`.
No lane duplicates `name`, `magnitude`, `rarity`, or `iconId` into its own table.

### 2.2 Prop meshes — only two runtime GLBs exist

`[OBSERVED]` Verified on disk this session (`ls assets/mesh/prop/`): of the six
`prop-sprite-sheet-single-object.NN` entries, **only `.03` and `.05` have a `glb/`
directory**. `.01`, `.02`, `.04`, `.06` are `.png` + `.json` only — sprite plates, not meshes.

| `modelKey` | Exact path | Renderer constant | `[OBSERVED]` at |
|---|---|---|---|
| `"blade"` | `assets/mesh/prop/prop-sprite-sheet-single-object.03/glb/base_basic_pbr.glb` | `PROP_BLADE_MESH` | `battle-realtime-three.js:222` |
| `"relic"` | `assets/mesh/prop/prop-sprite-sheet-single-object.05/glb/base_basic_pbr.glb` | `PROP_RELIC_MESH` | `battle-realtime-three.js:223` |

Both directories also hold `base_basic_shaded.glb`; the runtime uses `_pbr` only.

**No new mesh is authored this cycle.** Rarity is communicated by VFX tier
(VfxCueDesign) and HUD styling (UiOverhaulConcept), not by mesh count.

Renderer change required (additive, presentation-only):
`ensurePickup` (`battle-realtime-three.js:2928-2976`) currently hardcodes
`pickup.kind === "item" ? PROP_BLADE_MESH : PROP_RELIC_MESH` at `:2932`. It must read the
drop's `modelKey` and keep the current expression as the fallback:

```javascript
const modelPath = pickup.modelKey === "blade" ? PROP_BLADE_MESH
  : pickup.modelKey === "relic" ? PROP_RELIC_MESH
  : (pickup.kind === "item" ? PROP_BLADE_MESH : PROP_RELIC_MESH);
```

Every current pickup lacks `modelKey`, so every current pickup takes the fallback and
renders byte-identically. `fitHeight` pickup target stays 0.7 (`:1339-1352`).

### 2.3 Buff catalog — 10 shipped items (11 specified; row 5 withdrawn cycle 10)

Magnitude unit is **fixed by the stat** (§3.2), not by the item. `mulBp` = permille-of-base
in basis points (10000 = ×1.0). `addBp` = added directly to a value already denominated in
basis points.

| # | `id` | rarity | `stat` | `magnitude` | unit | `durationTicks` (s) | `maxStacks` | `stacking` | `modelKey` | stages | Player fantasy |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `ember-edge` | common | `basicDamage` | `+1200` | mulBp | 600 (10) | 3 | STACK | blade | all 3 | 칼날이 달아오른다 — 짧고 자주, 연타로 쌓인다 |
| 2 | `ash-stride` | common | `moveSpeedBp` | `+1000` | mulBp | 600 (10) | 2 | STACK | relic | all 3 | 재를 밟고 미끄러지듯 빠져나간다 |
| 3 | `reclaimer-pulse` | common | `pickupRange` | `+2500` | mulBp | 900 (15) | 2 | STACK | relic | all 3 | 메아리가 스스로 끌려온다 |
| 4 | `cinder-haste` | rare | `cooldownScaleBp` | `-800` | addBp | 900 (15) | 2 | STACK | blade | cinder-span, abyss-chancel | 불티가 스킬을 재촉한다 |
| 5 | ~~`bulwark-echo`~~ | rare | `gateMaxIntegrity` | `+1000` | mulBp | 1200 (20) | 2 | STACK | relic | all 3 | **WITHDRAWN cycle 10 - see "Withdrawal" at the end of this spec. Not present in `BUFF_ITEMS`.** |
| 6 | `oath-keen` | rare | `critChanceBp` | `+600` | addBp | 900 (15) | 2 | STACK | blade | abyss-chancel, echo-throne | 서약이 급소를 읽는다 |
| 7 | `warding-splint` | rare | `incomingDamageBp` | `-1000` | addBp | 900 (15) | 2 | STACK | relic | all 3 | 맞아도 덜 아프다 |
| 8 | `reaver-fervor` | resonant | `basicDamage` | `+2500` | mulBp | 1200 (20) | 2 | STACK | blade | all 3 | 광란 — 눈에 띄게 세진다 |
| 9 | `chancel-tempo` | resonant | `cooldownScaleBp` | `-1500` | addBp | 1200 (20) | 1 | REFRESH | blade | abyss-chancel, echo-throne | 성가가 박자를 당긴다 |
| 10 | `throne-resonance` | relic | `critChanceBp` | `+1500` | addBp | 1800 (30) | 1 | REFRESH | blade | echo-throne | 왕좌의 공명 — 모든 일격이 위협적이다 |
| 11 | `lantern-aegis` | relic | `incomingDamageBp` | `-2000` | addBp | 1800 (30) | 1 | REFRESH | relic | all 3 | 등불이 방패가 된다 |

All 10 shipped magnitudes and durations are **`[TARGET]`**. Row 5 (`bulwark-echo`) ships in no
build this cycle — see "Withdrawal" at the end of this spec.

Stat coverage: all 7 enum values are covered, and each of the four stats `applyItem`
already knows has at least one entry — `basicDamage` (1, 8), `gateMaxIntegrity` (5),
`pickupRange` (3), `cooldownScaleBp` (4, 9).

Rarity distribution: 3 common / 4 rare / 2 resonant / 2 relic.

### 2.4 Balance derivation against the master numeric contract

> **SELF-CORRECTION (director C3).** An earlier revision of this table was headed "Anchors,
> all `[OBSERVED]` from the cited files" and listed the 3343–3510 DPS band among them. That
> was wrong, and it is the same failure C3 names in three other lanes — I am the fourth
> instance. Two rows came from `master-numeric-contract.md`, which self-declares
> `status: [TARGET] — 미측정 설계 목표` at its line 4, and the combat system that band
> describes **does not exist in the blob**: `git show 033877ad:defense-catalog.js
> 033877ad:defense-run-simulation.js | grep -c` returns **0** for each of `DASH`, `dash`,
> `LIGHT_1`, `HEAVY`, `iframe`, `invuln`, `comboWindow`, `cancelWindow`. The rows are
> re-labelled below and the derivation is re-grounded on shipped constants. The cap
> *values* survive unchanged; only their justification does.

**Code-derived anchors `[OBSERVED]`** — every one verified against the `033877ad` blob:

| Anchor | Value | Source |
|---|---|---|
| `COMMANDER.basicDamage` | 900 | `defense-catalog.js` `COMMANDER` block |
| `COMMANDER.basicCooldown` | 24 ticks | same block |
| `COMMANDER.speed` | 4100 | same block |
| `COMMANDER.radius` | 360 | same block |
| `COMMANDER.critProfile.chanceBp` | 1500 | same block |
| `PLAYER_BASELINE_DPS` | 2250 | `defense-catalog.js:682` (blob) |
| `commander.pickupRange` at creation | 12000 | `defense-run-simulation.js` commander literal, worktree **3292** |
| Gate integrity per stage | 1600 / 1700 / 1800 | `STAGE_WAVE_DOCTRINE` |

**Shipped single-target DPS is 2250**, and it is self-consistent: `900 / 24 ticks × 60 =
2250`, which is exactly `PLAYER_BASELINE_DPS`, whose own comment calls it "the shipped bare
commander's single-target output". That is the only DPS figure this spec may balance against.

**Document-derived targets `[TARGET]`** — unshipped design intent, named so they cannot
wear an `[OBSERVED]` costume:

| Target | Value | Source | Shipped? |
|---|---|---|---|
| Cancel-compressed DPS band | 3343–3510 | `master-numeric-contract.md:161-168` | **No.** Requires LIGHT/HEAVY/DASH cancel verbs; 0 occurrences in blob. |
| Stage length band | 18000–28800 ticks | `master-numeric-contract.md:18` | **No.** Shipped gate-hold is 10200/10500/10800 (`STAGE_WAVE_DOCTRINE`) plus pressure. |

Sizing rule: **a single common buff must be felt but must not re-tier the player; a full
relic-tier stack must not double it.** Expressed as multipliers so it survives whichever
combat system is live.

- `ember-edge` ×3 = +3600bp = **×1.36**. Against shipped 2250 → 3060 DPS. (Against the
  unshipped 3510 target it would be 4774.) Time-boxed to 10 s.
- `reaver-fervor` ×2 = +5000bp alone hits the `basicDamage` cap exactly. With `ember-edge`
  the uncapped sum is +8600bp = **×1.86** — shipped 4185 DPS, and 1.86× is the real
  objection regardless of base. The per-stat cap in §3.3 is what prevents it, and it is the
  reason caps exist at all.
- `cooldownScaleBp` floor: base scale 1.0 → 10000bp; `chancel-tempo` + `cinder-haste`×2 =
  −3100bp, clamped by the −3000bp cap to 7000bp = ×0.70. The existing hard clamp floor of
  0.5 (`applyItem`) / 0.4 (reward path) is still respected downstream.
- `gateMaxIntegrity` ×2 = +2000bp = +20% → cinder-span 1600 → 1920 for 20 s.
- `incomingDamageBp` floor −2000bp caps mitigation at 20%, well clear of invulnerability.

**Expected uptime.** Derived from the §5.2 drop counts and the §5.3 resolved pools:

| Stage | BASIC × mean | SHADOW × mean | BOSS × mean | buff-ticks |
|---|---|---|---|---|
| cinder-span | 3.12 × 775 | 0.75 × 1080 | 1.00 × 1500 | **4728** |
| abyss-chancel | 3.20 × 768.8 | 0.90 × 1065 | 1.00 × 1500 | **4918** |
| echo-throne | 3.78 × 775 | 1.05 × 1080 | 1.00 × 1500 | **5564** |

Each per-grade mean is the rarity-weighted (§5.3) mean `durationTicks` of that stage's
resolved pool. Against the 18000–28800 tick band (`master-numeric-contract.md:18`) that is
**16.4–30.9% `[TARGET]`** — and it is an *upper bound* on wall-clock uptime, because two
concurrent buffs spend two buff-ticks inside one wall tick. Overlap only pushes the real
figure down. Buffed is the exception, not the baseline. The floor player's clear budget in
`buildDoctrineWavePlan` is unchanged and remains the sizing authority.

---

## 3. Buff runtime model

### 3.1 `run.buffs` structure

```javascript
run.buffs = [
  {
    buffId: "buff-7",          // string, per-instance, nextId(run, "buff")
    itemId: "ember-edge",      // string, BUFF_ITEMS key (R16)
    stat: "basicDamage",       // string, 7-value enum (R17)
    magnitude: 1200,           // integer bp, PER STACK (R13)
    stacks: 2,                 // integer, 1..BUFF_ITEMS[itemId].maxStacks
    appliedAtTick: 412,        // integer absolute tick (R18)
    expiresAtTick: 1012,       // integer absolute tick (R18)
    sourceDropId: "drop-3",    // string, the drop actor consumed
  },
];
```

Eight fields. Every value is an integer or a string. **No float, no `undefined`, no
nested object.** `run.buffs` is initialised to `[]` in `createDefenseRun`.

`buffId` uses the shared counter: `nextId = (run, prefix) => \`${prefix}-${++run.nextId}\``
(worktree **47**) `[OBSERVED]`, so the format is `buff-<n>` with a hyphen — **not**
`buff:<n>`. Because the counter is shared, a run that applies zero buffs consumes zero ids
and every downstream `pickup-<n>` / `projectile-<n>` id is unchanged. That is what keeps
existing fixtures byte-identical (§6).

**Identity scope: `buffId` is unique WITHIN a run, not across runs.** `createDefenseRun`
initialises `nextId: 0` (worktree **3218**) `[OBSERVED]`, so a re-entered stage restarts the
counter and re-issues `buff-7` for a different buff — possibly a different `itemId`
entirely, since the counter is shared with pickups, projectiles, and enemies and their
consumption order varies with play.

Consequence for **every presentation consumer**: any cache, `Set`, or map keyed by `buffId`
that outlives a run will collide, and the collision is silent — a stale entry suppresses
handling for a genuinely new buff. Two lanes hit this independently:

| Consumer | Structure | Failure if not cleared |
|---|---|---|
| audio pre-expiry warning | warned-id `Set` | re-entered stage cannot re-warn; the second run's `buff-7` is already "warned" |
| HUD buff strip | per-`buffId` row state | stale row state applied to an unrelated buff |

**Rule: clear every `buffId`-keyed structure on run boundary — both on run start and on
remount.** Clearing only on run start is insufficient: a remount within the same run
rebuilds the consumer with an empty cache while the run's counter keeps climbing, and a
remount *across* runs rebuilds it against a restarted counter. If you need an identifier
stable across runs, there isn't one — use `itemId` (catalog-stable) and accept that two
applications of the same item are indistinguishable, or compose your own key from
`(runId, buffId)`.

This is a presentation-lifetime hazard only. Within a single run `buffId` is unique and
the simulation is unaffected; nothing here touches determinism.

There is deliberately **no `remainingTicks` field**. It would rewrite the array every tick
and put a derived value in serialized state. Consumers compute
`remaining = expiresAtTick - snapshot.tick`.

`sourceDropId` is not redundant with `itemId`: `itemId` is the catalog definition,
`sourceDropId` is the specific physical drop actor consumed. It exists so a QA trace can
correlate a buff back to its `DROP_SPAWNED`.

### 3.2 Stat composition table

Composition **never mutates a base stat.** Base fields keep their current values and
current write paths for the whole run. Buffs are a derived layer read at the point of use.

| `stat` | Base field (unchanged) | Op | Magnitude unit | Composed at `[OBSERVED]` read site |
|---|---|---|---|---|
| `basicDamage` | `run.commander.basicDamage` | mulBp | 10000 = ×1.0 | `commanderBasicAttack` `:1945`; extra-hit `:1447` |
| `gateMaxIntegrity` | `run.gate.maxIntegrity` | mulBp | 10000 = ×1.0 | every `clamp(..., 0, run.gate.maxIntegrity)`: `:2896, :2917, :3332`; recovery `:1182-1183, :3124-3126`; retry floor `:1291` |
| `pickupRange` | `run.commander.pickupRange` | mulBp | 10000 = ×1.0 | `collectPickups` `:2079` |
| `cooldownScaleBp` | `run.commander.cooldownScale` | addBp | −1200 = −12.00%p | `castSkill` `:2298` |
| `moveSpeedBp` | `COMMANDER.speed` | mulBp | 10000 = ×1.0 | `getCommanderSpeed` `:1403` |
| `critChanceBp` | `run.commander.critProfile.chanceBp` | addBp | +600 = +6.00%p | `resolveCritical` `:1631, :1637` |
| `incomingDamageBp` | `run.commander.incomingDamageMultiplier` (**stays a float**) | addBp | −1000 = −10.00%p | `:2837, :2885`, both via `applyIncomingDamage` |

The op is a property of the **stat**, not of the buff entry — so it can never disagree
between two items touching the same stat, and it is not serialized.

Single accessor, the only supported way to read a buffed stat:

```javascript
const BUFF_STAT_OPS = freeze({
  basicDamage:      { op: "mulBp", capBp:  5000 },
  gateMaxIntegrity: { op: "mulBp", capBp:  2000 },
  pickupRange:      { op: "mulBp", capBp:  7000 },
  cooldownScaleBp:  { op: "addBp", capBp: -3000 },
  moveSpeedBp:      { op: "mulBp", capBp:  3000 },
  critChanceBp:     { op: "addBp", capBp:  2000 },
  incomingDamageBp: { op: "addBp", capBp: -2000 },
});

/** Total buff contribution for one stat, in basis points. Integer. Order-independent. */
function buffBp(run, stat) {
  const spec = BUFF_STAT_OPS[stat];
  let sum = 0;
  for (const entry of run.buffs || []) {
    if (entry.stat === stat) sum += entry.magnitude * entry.stacks;
  }
  return spec.capBp < 0 ? Math.max(sum, spec.capBp) : Math.min(sum, spec.capBp);
}
```

Read-site composition, all integer:

```javascript
/**
 * Every accessor short-circuits to the ORIGINAL expression when its stat has no active
 * buff. That is not an optimisation — it is what makes "a run with no buffs is
 * byte-identical to today" a proof rather than a hope (§9 check 1). Never remove a guard.
 */
function effectiveBasicDamage(run) {
  const bp = buffBp(run, "basicDamage");
  return bp === 0 ? run.commander.basicDamage
    : Math.trunc(run.commander.basicDamage * (10000 + bp) / 10000);
}

function effectiveGateMax(run) {
  const bp = buffBp(run, "gateMaxIntegrity");
  return bp === 0 ? run.gate.maxIntegrity
    : Math.trunc(run.gate.maxIntegrity * (10000 + bp) / 10000);
}

function effectivePickupRange(run) {
  const bp = buffBp(run, "pickupRange");
  return bp === 0 ? run.commander.pickupRange
    : Math.trunc(run.commander.pickupRange * (10000 + bp) / 10000);
}

function effectiveCritChanceBp(run) {
  const bp = buffBp(run, "critChanceBp");
  return bp === 0 ? run.commander.critProfile.chanceBp
    : clamp(run.commander.critProfile.chanceBp + bp, 0, 10000);
}

// getCommanderSpeed:1397-1404 is EDITED IN PLACE — `mult` is its own local, so this is not
// a standalone accessor. Only the return line changes:
//   const bp = buffBp(run, "moveSpeedBp");
//   const base = Math.trunc(COMMANDER.speed * mult);          // unchanged expression
//   return bp === 0 ? base : Math.trunc(base * (10000 + bp) / 10000);

/**
 * Incoming damage. `run.commander.incomingDamageMultiplier` is a live FLOAT and this spec
 * deliberately does NOT convert it to basis points — see the note below.
 * Replaces the two read sites at :2837 and :2885.
 */
function applyIncomingDamage(run, damage) {
  const base = Math.round(damage * run.commander.incomingDamageMultiplier);  // unchanged
  const bp = buffBp(run, "incomingDamageBp");
  return bp === 0 ? base : Math.max(0, Math.trunc(base * (10000 + bp) / 10000));
}

// cooldownScale is a live float in state; never store a new one.
function effectiveCooldownScaleBp(run) {
  const baseBp = Math.round(run.commander.cooldownScale * 10000);   // 0.9 -> 9000, kills FP dust
  return clamp(baseBp + buffBp(run, "cooldownScaleBp"), 4000, 10000);
}
// castSkill:2298 becomes:
//   Math.max(1, Math.trunc(skillRankCooldown(...) * effectiveCooldownScaleBp(run) / 10000))
// With no cooldown buff this is Math.trunc(t * round(scale*10000) / 10000) against the
// original Math.trunc(t * scale). Identical for every scale representable in 4 decimals,
// which is every value the shipped catalog produces (1.0, 0.9, 0.85, 0.8, 0.75, 0.5).
// Check 1 is the proof obligation; if it ever fails here, guard this one too.
```

`Math.round(cooldownScale * 10000)` is required, not cosmetic: `0.9 * 10000` is
`9000.000000000002` in IEEE-754. Rounding to the nearest basis point before any integer
math is what keeps the result reproducible.

**Why `incomingDamageMultiplier` is not converted to basis points.** It is the one base
value that is a *product of floats* rather than an authored constant:
`state.commander.incomingDamageMultiplier` accumulates `wardenState.runtime.incomingDamageMultiplier`
and one `×0.95` per vanguard companion (`:3788-3798`) `[OBSERVED]`. Three vanguards give
`0.95³ = 0.857375`, which is **not** representable in 4 decimal places — quantising it to
`8574` bp would change damage for every existing run with that loadout. Converting the read
site from `Math.round(d * m)` to `Math.trunc(d * bp / 10000)` also flips the rounding mode:
for `d=101, m=0.95` the first gives 96 and the second gives 95. `applyIncomingDamage`
therefore keeps the original rounded expression intact and scales the *result*, so a run
with no `incomingDamageBp` buff is bit-for-bit unchanged.

**Why this is exact and idempotent.** `buffBp` is a pure fold over `run.buffs`. Removing
an entry restores the previous sum by construction — there is no inverse operation to get
wrong, no accumulated rounding to unwind, and no ordering dependence (integer addition is
associative and commutative; the cap is applied once, after the sum). Calling `expireBuffs`
twice in one tick produces the same array as calling it once.

### 3.3 Caps

`capBp` in the table above bounds the **composed total per stat**, independent of how many
items or stacks produced it. Rationale: without it, `reaver-fervor`×2 + `ember-edge`×3 =
+8600bp = ×1.86 → 6529 DPS, **1.86× the authoritative 3510 ceiling**
(`master-numeric-contract.md:161-168`). The +5000bp cap holds the burst at ×1.50 → 5265
DPS, which is a visible power spike that still reads as the same game. All caps `[TARGET]`.

### 3.4 Tick-loop position — where expiry runs

`[OBSERVED]` tick phase order re-read this session in `tick(run)`. Two new phases, both
named against their neighbours:

**Phase A — buff expiry.** `expireBuffs(run)` runs **immediately after
`processEncounterRecovery(run)` (`:3204`) and immediately before the commander movement
block that opens with `const commanderFrom = ...` / `getCommanderSpeed(run)` (`:3206-3207`).**

In the 21-phase order of `map-simulation.md:25-47` that is **between phase 5's
`processEncounterRecovery` and the commander-move step of phase 5**, i.e. the first
mutation after input processing (phase 3) and the `growthOffer` early-return (phase 4).

Why exactly there: `getCommanderSpeed` at `:3207` is the **first stat read of the tick**.
Expiring before it guarantees that for the entire remainder of the tick the composed stat
set is constant. Every consumer in phases 6–21 — projectiles, basic attack, enemy attacks,
pickups, pressure — sees one stable set.

**Phase B — field-drop TTL.** `expireFieldDrops(run)` runs **immediately after
`collectPickups(run)` (`:3411`) and immediately before `updateEncounterObjective(run)`
(`:3412`)** — between phases 18 and 19.

Why after collection, not with Phase A: a drop whose `expiresAtTick` equals the current
tick gets its last collection attempt on that tick. Expiring it at the top of the tick
would delete a drop the player is standing on. This is a deliberate one-tick grace.

### 3.5 Expiry semantics

Removal predicate, evaluated in `expireBuffs`:

```javascript
function expireBuffs(run) {
  if (!run.buffs.length) return;                      // provable no-op when unbuffed
  run.buffs = run.buffs.filter((entry) => {
    if (entry.expiresAtTick > run.tick) return true;
    emit(run, "BUFF_EXPIRED", { buffId: entry.buffId, itemId: entry.itemId, stat: entry.stat, reason: "TIMEOUT" });
    return false;
  });
  reconcileGateCap(run);
}
```

`expiresAtTick = appliedAtTick + durationTicks`, both integers.

#### Removing a buff is not always a pure filter — the gate cap must be reconciled

`[OBSERVED]`, found by DropBuffImpl during implementation and verified against the
`033877ad` blob. A pure filter is sufficient for six of the seven stats, but **not** for
`gateMaxIntegrity`, because three sites *raise* `run.gate.integrity` against the composed
cap:

| Blob line | Site | Why it overflows |
|---|---|---|
| 928 / 931 | recovery headroom `maxIntegrity - integrity`, then `run.gate.integrity += gateGain` | **`:931` is completely unclamped** — it trusts the `:928` headroom. Compose the cap at 928 and integrity can reach the raised cap. |
| 1038 | retry floor `Math.max(run.gate.integrity, gateFloor)` | Floor derives from the cap and raises integrity. |
| 2770 | terrain recovery `clamp(integrity + …, 0, cap)` | Clamped to the *composed* cap. |

Concretely: `bulwark-echo` ×2 on cinder-span raises the effective cap 1600 → 1920, recovery
fills to 1920, the buff expires, and integrity is 1920 against a base `maxIntegrity` of
1600. The HUD reads 1920/1600 and the invariant every other gate write maintains is broken.

> **Cycle 10 outcome — this paragraph identified the defect and `reconcileGateCap` solved only
> half of it.** `reconcileGateCap` restores the invariant *after removal*. It does nothing
> *during* the buff, and `getRunSnapshot` publishes `gate: run.gate` verbatim
> (`defense-run-simulation.js:3921`), so for the whole 20 s window the snapshot reports
> `integrity 1920` against `maxIntegrity 1600`. Three consumers read that pair and assume it
> cannot happen: `scripts/run-stage1b-pressure-packets.mjs` (`to > max` invariant — G7
> evidence tooling), the `low-hp-focus` enemy policy at `:2705`
> (`gateRatio = gate.integrity / gate.maxIntegrity`, which a gate buff pushes above 1 and
> which flips target selection toward the commander — a live behavioural change, not a
> display artifact), and any HUD ratio. `bulwark-echo` is therefore WITHDRAWN this cycle.

The three *damage* clamps (blob 2540, 2561, 2962) are **provably inert** by arithmetic:
`clamp(x − d, 0, cap)` with `d ≥ 0` and `x ≤ cap` can never reach the upper bound. Compose
them anyway for fidelity, so a future healing path added there inherits correct behaviour.

```javascript
/** Re-establish integrity <= effective cap after ANY buff removal. Never raises. */
function reconcileGateCap(run) {
  run.gate.integrity = Math.min(run.gate.integrity, effectiveGateMax(run));
}
```

**Call it from all three removal paths** — `expireBuffs`, `evictOldestBuff`, `clearBuffs`.
Expiry alone is not enough: eviction removes a buff at phase 18, so integrity would stay
above the cap through phases 19–21 and into the end-of-tick snapshot, and `clearBuffs` on
terminal would ship a final snapshot with `integrity > maxIntegrity`.

Why this does not violate R14: it **never writes `run.gate.maxIntegrity`** — the base cap is
untouched and composition remains the only source of the effective cap. It is `Math.min`,
not `clamp`, so it can only lower, never raise. It is the exact analogue of `applyItem`'s
own `clamp(run.gate.integrity + item.integrity, 0, run.gate.maxIntegrity)` (blob 1756) when
a cap moves. And it is a **provable no-op** in any run with no `gateMaxIntegrity` buff: the
`bp === 0` identity guard makes `effectiveGateMax === maxIntegrity`, and `integrity <=
maxIntegrity` already holds — so check 1's digest identity is unaffected.

Game-feel note: the player *does* lose the overflow when the buff ends. That is correct for
a timed cap — keeping it would make the buff a permanent integrity gain, contradicting the
entire system. Presentation can react to the accompanying `BUFF_EXPIRED`.

**Honest statement of the active window `[OBSERVED]` from phase order.** A buff is applied
in `collectPickups` (`:3411`, phase 18) and expired in `expireBuffs` (phase 5-adjacent).
So a buff applied at tick `A` with duration `D`:

- is active for phases 19–21 of tick `A` (objectives, pressure, boss spawn, terminal),
- is active for **all** phases of ticks `A+1 … A+D−1`,
- is gone from phase A onward on tick `A+D`.

That is `D−1` full ticks plus one tail. At 60 Hz the shortfall is 16.7 ms on a 10 000 ms
buff. It is documented rather than papered over with an off-by-one, because the alternative
— `expiresAtTick = appliedAtTick + durationTicks + 1` — makes the HUD read
"601 ticks remaining" for a 600-tick buff, which is a worse lie.

### 3.6 Required behaviors

| Case | Rule |
|---|---|
| **Duplicate pickup** | §4.4. Never a second entry for the same `itemId`. |
| **Expiry during damage resolution** | Cannot happen. Expiry runs once per tick at Phase A; no phase between 6 and 21 mutates `run.buffs`. Every damage event inside one tick composes from an identical `run.buffs`. Two `PROJECTILE_IMPACT`s in the same tick therefore cannot see different `effectiveBasicDamage`. |
| **Death / retry** | On `run.terminal` being set, and in the `RETRY_OBJECTIVE` input branch, call `clearBuffs(run, "DEATH")`: emit `BUFF_EXPIRED` with `reason: "DEATH"` for each entry in ascending `buffId`, then `run.buffs = []`. Field drops are **not** cleared on retry — the arena state persists. |
| **Stage transition** | A new stage is a new `createDefenseRun`, which sets `buffs: []` and reseeds `dropRng` from the new run seed. Buffs never cross a stage. `reason: "STAGE_TRANSITION"` is retained in the ruled enum (R10a) but is **currently unreachable** — no in-run stage transition exists. Documented, not silently dropped, so the enum stays honest. |
| **Growth-offer pause** | `tick` returns at `:3203` before Phase A while `run.growthOffer` is set. Buffs freeze; they do not tick down during a skill selection. Correct — the player is not playing. |
| **Measurement profile** | `run.measurementProfile` truthy ⇒ no roll, no draw, no entry, no event. Mirrors the existing `applyItem` guard at `:2067`. Preserves G2 fixture isolation. |

---

## 4. Drop and buff lifecycle

### 4.1 Constants

| Constant | Value | Unit | Status |
|---|---|---|---|
| `DROP_TTL_TICKS` | 1800 | ticks (30 s) | `[TARGET]` |
| `MAX_FIELD_DROPS` | 8 | concurrent buff drops | `[TARGET]` |
| `MAX_ACTIVE_BUFFS` | 6 | distinct `itemId` | `[TARGET]` |
| `DROP_OFFSET_X` | 240 | gameplay units | matches the existing elite-item offset `:2522` `[OBSERVED]` |

### 4.2 The drop actor

Created in `resolveDeaths`, in the existing per-dead loop, which is already deterministic:
`dead` is sorted by `a.id.localeCompare(b.id)` at `:2500` `[OBSERVED]`.

```javascript
const drop = actor(nextId(run, "drop"), "pickup", entry.x + DROP_OFFSET_X, entry.y, 1, 1, {
  kind: "buff",
  itemId,
  rarity: BUFF_ITEMS[itemId].rarity,
  modelKey: BUFF_ITEMS[itemId].modelKey,
  grade,
  slabId,
  expiresAtTick: run.tick + DROP_TTL_TICKS,
  elevation: entry.elevation || 0,
});
placeOnTerrain(run, drop, drop);
run.pickups.push(drop);
```

`kind: "buff"` is the discriminator and it does real work:

- `actor()` spreads `extra` last (`:50`) `[OBSERVED]`, so `extra.kind` overrides the
  positional `"pickup"` — the same mechanism echo (`kind: "echo"`) and item
  (`kind: "item"`) already use.
- `eligibleCompanionItem` (`:1522`) and `assignCompanionItemClaims` (`:1549`) both require
  `pickup.kind === "item"` **and** `ITEMS[pickup.itemId]`. A buff drop fails both. Companions
  cannot claim buff drops, and no code changes to achieve it.
- The `applyItem` branch in `collectPickups` (`:2108`) is `kind === "item"`, so a buff drop
  can never reach `applyItem` and can never grant a permanent stat.

The drop lives in `run.pickups`, so `sortedActors(run.pickups)` in the snapshot
(`getRunSnapshot`) already sorts and serializes it. No new snapshot array.

### 4.3 Collection

New branch in `collectPickups`, placed **after the `kind === "echo"` branch and before the
`kind === "item"` branch**. It must precede the trailing fallback
(`gained += pickup.xp; return false;` at `:2118-2120`), because a buff drop has no `xp` and
would otherwise add `undefined` to `run.commander.xp` and poison it to `NaN` — a silent
digest break.

```javascript
if (pickup.kind === "buff") {
  if (distanceSquared(pickup, run.commander) > effectivePickupRange(run) ** 2) return true;
  applyBuff(run, pickup);
  run.progress.itemsCollected += 1;
  emit(run, "ITEM_COLLECTED", {
    itemId: pickup.itemId,
    entityId: run.commander.id,
    companionId: null,
    dropId: pickup.id,
    rarity: pickup.rarity,
    cue: eventCue("itemCollected"),
  });
  return false;
}
```

Commander-only by design: companions cannot claim buff drops (§4.2), so there is no
claimant to consult. Collection uses the **buffed** pickup range, so `reclaimer-pulse`
composes on itself — intended and readable.

### 4.4 `applyBuff` — stacking and refresh

```javascript
function applyBuff(run, drop) {
  const def = BUFF_ITEMS[drop.itemId];
  const existing = run.buffs.find((entry) => entry.itemId === drop.itemId);

  if (existing) {
    if (def.stacking === "STACK" && existing.stacks < def.maxStacks) {
      existing.stacks += 1;
    }
    existing.expiresAtTick = run.tick + def.durationTicks;   // always refresh the window
    emit(run, "BUFF_REFRESHED", {
      buffId: existing.buffId, itemId: existing.itemId,
      stacks: existing.stacks, expiresAtTick: existing.expiresAtTick,
    });
    return;
  }

  if (run.buffs.length >= MAX_ACTIVE_BUFFS) evictOldestBuff(run);

  const entry = {
    buffId: nextId(run, "buff"),
    itemId: drop.itemId,
    stat: def.stat,
    magnitude: def.magnitude,
    stacks: 1,
    appliedAtTick: run.tick,
    expiresAtTick: run.tick + def.durationTicks,
    sourceDropId: drop.id,
  };
  run.buffs.push(entry);
  emit(run, "BUFF_APPLIED", {
    buffId: entry.buffId, itemId: entry.itemId, stat: entry.stat,
    magnitude: entry.magnitude, durationTicks: def.durationTicks,
    stacks: entry.stacks, expiresAtTick: entry.expiresAtTick,
  });
}
```

| `stacking` | At `maxStacks` | Below `maxStacks` |
|---|---|---|
| `"REFRESH"` (`maxStacks: 1`) | window refreshed, `stacks` stays 1 | n/a |
| `"STACK"` | window refreshed, `stacks` unchanged | `stacks += 1` **and** window refreshed |

**Refresh-vs-stack policy, stated once:** a duplicate pickup **always** refreshes the
window; it additionally increments `stacks` only when `stacking === "STACK"` and the entry
is below `maxStacks`. A duplicate is never wasted and never creates a second entry. The
duration always restarts from the moment of the latest pickup — a partially elapsed window
is never preserved, so the player never has to reason about which of two timers is running.

Eviction is deterministic — no RNG:

```javascript
function evictOldestBuff(run) {
  const victim = [...run.buffs].sort((a, b) =>
    a.expiresAtTick - b.expiresAtTick || a.buffId.localeCompare(b.buffId))[0];
  run.buffs = run.buffs.filter((entry) => entry.buffId !== victim.buffId);
  emit(run, "BUFF_EXPIRED", { buffId: victim.buffId, itemId: victim.itemId, stat: victim.stat, reason: "EVICTED" });
}
```

Smallest `expiresAtTick` wins; ties broken by `buffId.localeCompare` — the same tiebreak
discipline `sortedActors` uses (`:51`).

### 4.5 Field-drop TTL

```javascript
function expireFieldDrops(run) {
  run.pickups = run.pickups.filter((pickup) => {
    if (pickup.kind !== "buff" || pickup.expiresAtTick > run.tick) return true;
    emit(run, "DROP_EXPIRED", { dropId: pickup.id, itemId: pickup.itemId, x: pickup.x, y: pickup.y });
    return false;
  });
}
```

---

## 5. Drop tables

### 5.1 Grade

`grade` ∈ `"BASIC" | "SHADOW" | "BOSS"`, matching `ENEMY_GRADES` in
`_workspace/current/engineering/enemy-grade-system.js:23-27` `[OBSERVED]`.

Derived at the roll site from live flags, **not** from a mesh path — `gradeForMeshPath`
is an authoring-time helper and dead enemies carry no mesh path in simulation state:

```javascript
const grade = entry.class === "boss" ? "BOSS"
  : (entry.elite || entry.midboss) ? "SHADOW"
  : "BASIC";
```

Per R4 this is the only derivation site. Presentation reads `grade` and never re-derives.

### 5.2 Chance table — integer basis points

| Stage | BASIC | SHADOW | BOSS |
|---|---|---|---|
| `cinder-span` | **600** | **2500** | **10000** |
| `abyss-chancel` | **800** | **3000** | **10000** |
| `echo-throne` | **1400** | **3500** | **10000** |

All `[TARGET]`. All integers. Denominator is 10000, matching every existing bp roll
(`run.combatRng % 10000 < profile.chanceBp`, `:1631`) `[OBSERVED]`.

**Why BASIC climbs 600 → 1400 while stages get harder.** It compensates for body count,
not for difficulty. `buildDoctrineWavePlan` sizes each wave from a fixed **HP** budget
(`waveHp = cadenceSeconds × PLAYER_BASELINE_DPS × WAVE_PRESSURE_BP × countBp × rampBp / 1e12`,
`defense-catalog.js:790`) `[OBSERVED]`, then divides by `enemyHp × stageScale / 100`. Stage
scale is 100 / 115 / 130 (`defense-catalog.js:904-906`) `[OBSERVED]`, so a later stage
fields **fewer, tougher** bodies for the same budget. A flat rate would make Echo Throne
feel barren. Equal drop *cadence* is the design goal; equal drop *rate* would defeat it.

Derivation `[TARGET]`, from the shipped doctrine (`defense-catalog.js:748-750`):

| Stage | cadence | normal-wave HP | avg enemy HP | bodies/normal | wave mix | est. BASIC kills | SHADOW | BOSS |
|---|---|---|---|---|---|---|---|---|
| cinder-span | 10200/10 = 1020 t = 17.0 s | ≈21038 | 3133 (r/f/rg @100) | ≈6.7 | 5n / 3big / 2mid | **≈52** | 3 | 1 |
| abyss-chancel | 10500/10 = 1050 t = 17.5 s | ≈21656 | 4485 (r/f/rg/g @115) | ≈4.8 | 4n / 4big / 2mid | **≈40** | 3 | 1 |
| echo-throne | 10800/11 ≈ 981 t = 16.4 s | ≈20233 | 6673 (f/rg/g @130) | ≈3.0 | 6n / 3big / 2mid | **≈27** | 3 | 1 |

Expected drops per full stage:

| Stage | from BASIC | from SHADOW | from BOSS | **total** |
|---|---|---|---|---|
| cinder-span | 52 × 0.0600 = 3.12 | 3 × 0.25 = 0.75 | 1.00 | **4.87** |
| abyss-chancel | 40 × 0.0800 = 3.20 | 3 × 0.30 = 0.90 | 1.00 | **5.10** |
| echo-throne | 27 × 0.1400 = 3.78 | 3 × 0.35 = 1.05 | 1.00 | **5.83** |

Convergence within 4.87–5.83 across three stages of very different body counts. §2.4 turns
these counts into the 16.4–30.9% uptime bound. Wave-mix counts follow each
stage's `kindCycle` with the final wave forced to `big` (`defense-catalog.js:781-783`)
`[OBSERVED]`.

### 5.3 Rarity pools

Second draw picks rarity, third picks the item. Pools are the catalog filtered by
`stageIds` and rarity, **sorted by `id`** so index selection is stable.

| Grade | common | rare | resonant | relic |
|---|---|---|---|---|
| BASIC | 7500 | 2500 | 0 | 0 |
| SHADOW | 0 | 6000 | 4000 | 0 |
| BOSS | 0 | 0 | 5000 | 5000 |

Integer bp, each row sums to 10000. All `[TARGET]`.

Resolved pools per stage (from §2.3 `stageIds`, sorted):

| Stage | common | rare | resonant | relic |
|---|---|---|---|---|
| cinder-span | `ash-stride`, `ember-edge`, `reclaimer-pulse` | ~~`bulwark-echo`~~ (WITHDRAWN), `cinder-haste`, `warding-splint` | `reaver-fervor` | `lantern-aegis` |
| abyss-chancel | `ash-stride`, `ember-edge`, `reclaimer-pulse` | ~~`bulwark-echo`~~ (WITHDRAWN), `cinder-haste`, `oath-keen`, `warding-splint` | `chancel-tempo`, `reaver-fervor` | `lantern-aegis` |
| echo-throne | `ash-stride`, `ember-edge`, `reclaimer-pulse` | ~~`bulwark-echo`~~ (WITHDRAWN), `oath-keen`, `warding-splint` | `chancel-tempo`, `reaver-fervor` | `lantern-aegis`, `throne-resonance` |

Every (stage, grade, rarity) cell reachable by the table above is non-empty. If a future
edit empties one, the roll **must** fall through to the next lower non-empty rarity rather
than throw or silently skip — a throw in `resolveDeaths` would abort the tick.

---

## 6. Determinism

### 6.1 `run.dropRng` — a new derived stream

**XOR constant: `0x85ebca6b`** (a MurmurHash3 finalizer constant).

`[OBSERVED]` verified free: `grep -rn '0x85ebca6b' --include=*.js --include=*.mjs .`
(excluding `node_modules`, `_workspace`) returned no matches.

**Derived-stream constant registry.** Every stream must use a distinct constant; two streams
seeded from the same constant are perfectly correlated, which is a determinism defect no
existing test would catch. Check the registry before adding a stream.

| Stream | Constant | Owner | Status |
|---|---|---|---|
| `run.combatRng` | `0x9e3779b9` | shipped, run literal **3217** | `[OBSERVED]` |
| lore-surprise roll | `0x6d2b79f5` | shipped, `:3180` | `[OBSERVED]` |
| `run.dropRng` | **`0x85ebca6b`** | this spec | `[TARGET]` |
| `run.gimmickRng` | `0xc2b2ae35` | `stage-dungeon-composition-spec.md` | `[TARGET]` |

`[OBSERVED]` DungeonLevelDesign independently selected `0x85ebca6b` for `gimmickRng` and
moved to `0xc2b2ae35` (the other MurmurHash3 finalizer) after we compared notes. Had both
shipped, gimmick rolls and drop rolls would have produced identical sequences from the same
seed. Recorded here so the next author checks the table instead of reaching for the
best-known constant.

Creation, in the `createDefenseRun` state literal, on the line after `combatRng`:

```javascript
combatRng: rngNext(unsignedSeed ^ 0x9e3779b9),
dropRng:   rngNext(unsignedSeed ^ 0x85ebca6b),
```

Rehydration, in `advanceDefenseRun` beside the existing `combatRng` guard (`:3858`):

```javascript
if (!Number.isInteger(next.combatRng)) next.combatRng = rngNext(next.seed ^ 0x9e3779b9);
if (!Number.isInteger(next.dropRng))   next.dropRng   = rngNext(next.seed ^ 0x85ebca6b);
if (!Array.isArray(next.buffs))        next.buffs     = [];
```

Migration: both guards are shape checks, exactly the pattern the file already uses for
`terrainRecovery`, `objectiveRoute`, `engaged`, and `combatRng`. A pre-cycle-10 save has
neither field, both guards fire, and it rehydrates to a run seeded identically to a fresh
one at the same seed. **No `SNAPSHOT_VERSION` bump** — `abyssDepth` and
`measurementProfileId` set the precedent for conditional additive fields
(`getRunSnapshot`) `[OBSERVED]`, and bumping 7 → 8 would change the `version` field in
every digest and break every stored comparison for a change that touches no existing run.

### 6.2 `run.rng` must not be consumed

**`run.rng` MUST NOT be read or advanced by any code in this spec.**

`[OBSERVED]` `run.rng` is the wave-schedule and growth-offer stream: `buildWaveSchedule`
advances it through `rngNext` (`:478-507`) and `makeOffer` writes it back (`run.rng = seed`,
`:1838` region). Every draw is positional. Inserting one extra `rngNext(run.rng)` anywhere
shifts every subsequent draw, which changes wave composition, timing jitter, lane offset,
spawn direction, policy selection, and growth-offer contents — for every seed, on every
stage, from that point forward.

Named casualties if this rule is violated:

| Test | File:line | How it breaks |
|---|---|---|
| `equal seeds and identical inputs produce identical deterministic digests` | `tests/defense-run-simulation.test.mjs:265-275` | Compares two live runs, so it survives a *uniform* shift — but fails the moment drop rolls differ between them by kill order. |
| `an item pickup applies both gate maximum and current integrity` | `tests/defense-run-simulation.test.mjs:963-980` | Asserts exact `gate.maxIntegrity == doctrine.gateIntegrity + 80` and `gate.integrity == previous + 80`; a shifted wave schedule moves the elite spawn and the assertion's search window (`gateTicks + 9000`) can expire. |
| `repeated ticks after an item pickup do not compound Abyssal Banner companion damage` | `tests/defense-run-simulation.test.mjs:982-1017` | Same elite-timing dependency, exact companion damage triple `480/600/420`. |
| `owned Warden's Lantern increases commander pickupRange by exactly 400 over baseline` | `tests/defense-run-simulation.test.mjs:912-921` | Exact `pickupRange` delta; also breaks if `pickupRange` is composed into the **base** field instead of at the read site. |
| `owned Choir Ward Crystal increases commander crit chance by exactly 300bp over baseline` | `tests/defense-run-simulation.test.mjs:923-943` | Exact `critProfile.chanceBp` delta; breaks if `critChanceBp` mutates the base. |
| `Warden's Lantern and Choir Ward Crystal are applied once at run creation and never compound across ticks` | `tests/defense-run-simulation.test.mjs:945-961` | Directly asserts no per-tick stat drift — the exact failure a mutating buff would cause. |
| `measurement fixtures remain isolated through a deterministic combat interval` | `tests/defense-run-simulation.test.mjs:784` | Fails if the `measurementProfile` guard is missing and drops roll inside a fixture. |
| `M4 selected and declined paths retain deterministic committed-card traces` | `tests/g2-measurement-fixture.test.mjs:84` | Seed-71 committed-card ordering shifts with `run.rng`. |
| `critical visual and audio observation is idempotent and cannot alter the deterministic outcome` | `tests/defense-public-contract-regressions.test.mjs:49` | Fails if presentation reads of buff state write back. |

The last one is also the guard for the renderer boundary: buffs are read-only to
presentation, per `CLAUDE.md §2` and `map-renderer.md:123`.

### 6.3 Draw protocol — fixed order, fixed count

In `resolveDeaths`, per dead enemy, in the existing `id.localeCompare` order (`:2500`):

```javascript
if (!run.measurementProfile) {
  const chanceBp = DROP_CHANCE_BP[run.stage.id][grade];
  run.dropRng = rngNext(run.dropRng);                 // DRAW 1 — always, unconditionally
  if (run.dropRng % 10000 < chanceBp) {
    run.dropRng = rngNext(run.dropRng);               // DRAW 2 — rarity
    const rarity = pickRarity(run.dropRng % 10000, grade);
    const pool = poolFor(run.stage.id, rarity);       // sorted by id
    run.dropRng = rngNext(run.dropRng);               // DRAW 3 — item
    const itemId = pool[run.dropRng % pool.length];
    const fieldDrops = run.pickups.reduce((n, p) => n + (p.kind === "buff" ? 1 : 0), 0);
    if (fieldDrops >= MAX_FIELD_DROPS) {
      emit(run, "DROP_DENIED", { itemId, rarity, grade, reason: "FIELD_CAP", x: entry.x, y: entry.y, slabId });
    } else {
      /* create the drop actor (§4.2) and emit DROP_SPAWNED */
    }
  }
}
```

Three invariants, in priority order:

1. **Draw 1 is unconditional** for every death outside a measurement profile. It never
   depends on field state.
2. **The field-cap check happens after all three draws.** A denied drop consumes the
   identical number of draws as a spawned one, so `dropRng` advances the same way whether
   the field is full or empty. Checking the cap first would make the stream depend on how
   many drops the player happened to leave lying around — a state-dependent RNG position,
   which is the subtle class of non-determinism that survives casual testing and dies in
   replay.
3. **`measurementProfile` consumes zero draws and emits nothing.** `dropRng` is untouched
   for the whole fixture run.

### 6.4 Snapshot and serialization

`getRunSnapshot` additions, both conditional:

```javascript
...(run.buffs?.length ? {
  buffs: [...run.buffs].sort((a, b) => a.buffId.localeCompare(b.buffId)),
  buffStats: composedBuffStats(run),
} : {}),
```

- **`dropRng` is NOT in the snapshot.** Neither are `rng`, `combatRng`, or `seed`
  `[OBSERVED]` — verified by reading the full `getRunSnapshot` literal. RNG state has never
  been part of the digest and this spec does not change that.
- **`buffs` and `buffStats` are absent when no buff is active.** A run that never picks up a
  buff produces a **byte-identical** snapshot to today's. This is the property that keeps
  every existing fixture green, and §9 check 1 measures it.
- Sorted by `buffId.localeCompare`, matching `sortedActors` (`:51`), so HUD ordering is
  stable frame to frame.
- `composedBuffStats(run)` is `{ [stat]: buffBp(run, stat) }` for stats with a non-zero
  total — all integers. It is a convenience for presentation so no consumer re-implements
  the fold.
- Buff drops need no snapshot work: they are in `run.pickups`, already serialized through
  `sortedActors(run.pickups)`.
- **No float is serialized.** Every value introduced by this spec — `magnitude`, `stacks`,
  `appliedAtTick`, `expiresAtTick`, `expiresAtTick` on the drop, every `buffStats` entry,
  every event payload number — is an integer. `cooldownScale` remains the pre-existing float
  it already is; this spec adds none.

---

## 7. Events

All payload field names are ruled (v1 §SIMULATION EVENT TYPES, v2 R1/R2/R6, v3 R16/R18).
`emit(run, type, payload)` (`:382`) merges the payload and appends `version`, `tick`,
`type`, `eventSequence`, `eventId` `[OBSERVED]`.

| Type | New? | Payload | Emitted in |
|---|---|---|---|
| `DROP_SPAWNED` | new | `{ dropId, itemId, rarity, grade, x, y, slabId }` | `resolveDeaths` |
| `DROP_DENIED` | new (R2) | `{ itemId, rarity, grade, reason, x, y, slabId }` | `resolveDeaths` |
| `DROP_EXPIRED` | new | `{ dropId, itemId, x, y }` | `expireFieldDrops` |
| `ITEM_COLLECTED` | **reused** | existing `{ itemId, entityId, companionId, cue }` **plus** `{ dropId, rarity }` | `collectPickups` |
| `BUFF_APPLIED` | new | `{ buffId, itemId, stat, magnitude, durationTicks, stacks, expiresAtTick }` | `applyBuff` |
| `BUFF_REFRESHED` | new (R6) | `{ buffId, itemId, stacks, expiresAtTick }` | `applyBuff` |
| `BUFF_EXPIRED` | new | `{ buffId, itemId, stat, reason }` | `expireBuffs`, `evictOldestBuff`, `clearBuffs` |

`reason` enums: `DROP_DENIED.reason` = `"FIELD_CAP"` only.
`BUFF_EXPIRED.reason` ∈ `"TIMEOUT" | "EVICTED" | "STAGE_TRANSITION" | "DEATH"` (R10a).

#### ⚠ `reason` is a SHARED field name with disjoint per-type vocabularies

`[OBSERVED]` in the `033877ad` blob, `reason` already appears on **six** existing events
with **four mutually incompatible value sets**. This is the same collision class
AudioFeedbackDesign found on `telegraphTicks` (which exists at blob `:2296` on
`ENCOUNTER_PATH_CONTESTED`, meaning something unrelated); I audited my own payload field
names after their report and found `reason` is mine.

| Event | `reason` values | Blob |
|---|---|---|
| `PROJECTILE_EXPIRED` | `"bounds"` \| `"range"` — **lowercase** | 1740 |
| `REWARD_SELECTION_DUPLICATE_IGNORED` | `"REWARD_ALREADY_OWNED"` | 2018 |
| M4 decision | `"M4_CARD_INVENTORY_EXHAUSTED"` \| `"M4_CARD_DECISION_INVALID"` | 2044 |
| `EXTRACTION_REJECTED` | `rejectionReason` | 2195 |
| `INPUT_REJECTED` | `rejectionReason` or `null` | 2204 |
| `ENCOUNTER_OBJECTIVE_FAILED` | passthrough | 1042 |
| **`DROP_DENIED`** (new) | `"FIELD_CAP"` | — |
| **`BUFF_EXPIRED`** (new) | `"TIMEOUT"` \| `"EVICTED"` \| `"STAGE_TRANSITION"` \| `"DEATH"` | — |

**Rule: gate on `event.type` and `event.reason` CONJUNCTIVELY. Never look up `reason`
alone.** The correct form is an allow-set or an explicit pair check, never presence-keying:

```javascript
// RIGHT — conjunctive, and the type test comes first
if (event.type === "BUFF_EXPIRED" && event.reason === "TIMEOUT") { … }
if (event.type === "DROP_DENIED"  && event.reason === "FIELD_CAP") { … }

// RIGHT — allow-set checked BEFORE any field read
const BUFF_EVENTS = new Set(["BUFF_APPLIED", "BUFF_REFRESHED", "BUFF_EXPIRED"]);
if (!BUFF_EVENTS.has(event.type)) return;

// WRONG — reason-keyed table. No throw, no wrong cue, just a gate that never fires.
const policy = REASON_POLICY[event.reason];
// WRONG — presence-keyed. Renders a complete, plausible artefact for the wrong event.
if (event.reason) { … }
```

**Why this fails in the worst possible way.** The value sets happen not to overlap today, so
a `reason`-keyed table throws nothing and produces no visibly wrong output — it produces a
gate that silently never fires. That is invisible in review and invisible in test.
UiOverhaulConcept stated the general form best, on `objectiveId`: because
`ENCOUNTER_PATH_CONTESTED` also carries it, a presence-keyed consumer renders a **complete,
plausible-looking artefact** — real label, real lifetime — for an event that has nothing to
do with it. **A defect that looks correct survives review.**

**The risk is live, not latent** `[OBSERVED]`, per AudioFeedbackDesign's audit: two of the
six `reason`-carrying events already have audio policies and are therefore reachable in
`play()` — `PROJECTILE_EXPIRED` → attack-miss (priority 28) and `EXTRACTION_REJECTED` →
input-rejected (62). A bare `reason` lookup in the audio lane would collide with a shipped,
live path, not a hypothetical future one.

The audit generalises, and the director has made it standing policy: **grep the blob for a
payload field name before introducing it** — `git show 033877ad:<path> | grep -n <field>`.
My other 10 field names (`dropId`, `buffId`, `slabId`, `rarity`, `grade`, `stat`,
`magnitude`, `stacks`, `durationTicks`, `expiresAtTick`) return **0 occurrences** each and
are collision-free. Only `reason` and `itemId` are shared, and `itemId`'s dual-catalog
hazard is documented in §0.

**Reverse direction, checked and closed `[OBSERVED]`.** The mirror risk is a renderer-side
generic lifetime reader picking up *my* duration fields — `BUFF_APPLIED.durationTicks` is
600–1800 ticks, so one leaking into a VFX lifetime would pin a slot of the 24 for **10 to 30
seconds**, far worse than any contest cue. `grep -n 'durationTicks\|expiresAtTick'
battle-realtime-three.js` returns **0**. Nothing in the renderer reads either field, and
`resolveVfxLifetimeTicks` (`:517-527`) dispatches on `event.type` first with the field read
only inside the `ENEMY_SPAWNED` and `GIMMICK_ARMED` branches. Closed by construction rather
than by discipline.

> **Correction to my own earlier IRC to Main.** I proposed
> `DROP_DENIED.reason ∈ "FIELD_CAP" | "MEASUREMENT_PROFILE"`. `"MEASUREMENT_PROFILE"` is
> **withdrawn**: §6.3 requires a measurement-profile run to emit nothing at all, so the value
> is unreachable by construction. Emitting it would inject an event into a G2 fixture tick
> and break `measurement fixtures remain isolated…`. One value only.

### 7.2 Position and `slabId` resolution

`x`, `y` are integers in gameplay units. **Which position depends on the event**, and the
two differ by `DROP_OFFSET_X`:

| Event | Position | Why |
|---|---|---|
| `DROP_SPAWNED` | the **drop actor's** final `x, y` — i.e. after `entry.x + DROP_OFFSET_X` and after `placeOnTerrain` | The cue must land on the mesh. Using the death position would render the spawn cue 240 units off from the prop the player walks to. |
| `DROP_EXPIRED` | the drop actor's `x, y` | Same actor, same place. |
| `DROP_DENIED` | the **dead enemy's** `x, y` | No actor was created, so there is no other position to report. |

`slabId` is resolved from **that same position**, so a `DROP_SPAWNED` near a seam reports
the slab its mesh actually sits on.

**Slab table `[OBSERVED]`** — final and frozen, published by DungeonLevelDesign in
`design/stage-dungeon-composition-spec.md`. 12 ids, `{stageId}:slab-{nn}`:

**These are the literal `slabId` values.** Bind the full string, never the bare `slab-nn`.

| `slabId` | material | minX | maxX | minY | maxY |
|---|---|---|---|---|---|
| `cinder-span:slab-01` | `ash-drift` | 600 | 8600 | 800 | 11200 |
| `cinder-span:slab-02` | `basalt-ember` | 8600 | 17000 | 800 | 11200 |
| `cinder-span:slab-03` | `forge-plate` | 17000 | 23400 | 800 | 11200 |
| `abyss-chancel:slab-01` | `flagstone-oath` | 600 | 8000 | 700 | 11300 |
| `abyss-chancel:slab-02` | `flagstone-oath` | 8000 | 16400 | 700 | 11300 |
| `abyss-chancel:slab-03` | `oath-inlay` | 16400 | 23400 | 700 | 7200 |
| `abyss-chancel:slab-04` | `vestry-tile` | 16400 | 23400 | 7200 | 11300 |
| `echo-throne:slab-01` | `polished-echo` | 600 | 6800 | 600 | 11400 |
| `echo-throne:slab-02` | `fracture-glass` | 6800 | 16600 | 600 | 4000 |
| `echo-throne:slab-03` | `gilt-compass` | 6800 | 16600 | 4000 | 8000 |
| `echo-throne:slab-04` | `fracture-glass` | 6800 | 16600 | 8000 | 11400 |
| `echo-throne:slab-05` | `polished-echo` | 16600 | 23400 | 600 | 11400 |

Ranges are gameplay units, all integers. `material` is not carried on any event of mine —
AudioImpl resolves it from `slabId` against DungeonLevelDesign's table. Note
`abyss-chancel:slab-01` and `abyss-chancel:slab-02` share `flagstone-oath`; a consumer
keying purely on material cannot distinguish them, which is intended.

Lookup is a pure function of position, **read-only, no simulation state written**:

```javascript
/** Authored floor bounds per stage — the outer rectangle the slabs exactly tile. */
const STAGE_FLOOR_BOUNDS = freeze({
  "cinder-span":   { minX: 600, maxX: 23400, minY: 800, maxY: 11200 },
  "abyss-chancel": { minX: 600, maxX: 23400, minY: 700, maxY: 11300 },
  "echo-throne":   { minX: 600, maxX: 23400, minY: 600, maxY: 11400 },
});

/** Canonical slab id at a gameplay point, or null outside the authored floor. */
function slabAt(stageId, x, y) {
  const bounds = STAGE_FLOOR_BOUNDS[stageId];
  for (const slab of STAGE_SLABS[stageId]) {          // authored order, slab-01 first
    const closedX = slab.maxX === bounds.maxX;        // only the stage's outer edge is closed
    const closedY = slab.maxY === bounds.maxY;
    if (x >= slab.minX && (closedX ? x <= slab.maxX : x < slab.maxX)
     && y >= slab.minY && (closedY ? y <= slab.maxY : y < slab.maxY)) return slab.id;
  }
  return null;
}
```

Half-open on every interior edge, closed on the stage's outer edge. Without that rule a
point exactly on a seam matches two slabs and the answer depends on iteration order — a
silent nondeterminism. DungeonLevelDesign verified zero overlap and exact tiling
(237,120,000 / 241,680,000 / 246,240,000 unit², equal to each stage's bounds rectangle).

**`null` is still reachable and still specified.** The slabs cover 600–23400 × 800–11200
(cinder), not the full 24000 × 12000 arena, and enemies spawn from the W/NW/SW edges. A
death at `x < 600` — or a drop pushed outside by `DROP_OFFSET_X` — resolves to `null`.
Consumers must handle it; it is not an error.

`ITEM_COLLECTED` keeps `entityId` and `companionId` for compatibility with existing
consumers; for a buff drop `entityId` is always `run.commander.id` and `companionId` is
always `null`, because companions cannot claim buff drops (§4.2).

### 7.1 Consumption

**Presentation reads snapshots; it never writes back** (`CLAUDE.md §2`,
`map-renderer.md:123`).

| Consumer | Reads | Notes |
|---|---|---|
| VFX (VfxCueDesign) | all 7 types; `snapshot.pickups[]` filtered `kind === "buff"` for the persistent idle beacon | Blocked on PR-1 (§10 risk 1). |
| Audio (AudioFeedbackDesign) | `DROP_SPAWNED`, `ITEM_COLLECTED`, `BUFF_APPLIED`, `BUFF_REFRESHED`, `BUFF_EXPIRED` | Sting on `reason: "TIMEOUT"` only; the other three reasons are bookkeeping and would produce a wall of stings on clear-out. |
| HUD (UiOverhaulConcept) | `snapshot.buffs ?? []`, `snapshot.buffStats` | `remaining = expiresAtTick - snapshot.tick`; seconds `Math.ceil(remaining / 60)`; icon `BUFF_ITEMS[itemId].iconId`; pre-expiry warning derived at `BUFF_WARN_TICKS = 180`, presentation-only, no event. |

**Both consumers key structures by `buffId`, which is run-scoped, not globally unique
(§3.1).** Clear every such structure on run start **and** on remount. Audio's warned-id
`Set` and the HUD's per-row state both fail silently otherwise: a re-entered stage restarts
`nextId` at 0 and re-issues `buff-7` for an unrelated buff, and the stale entry suppresses
handling for it.

Rarity is on `DROP_SPAWNED`, `DROP_DENIED`, `ITEM_COLLECTED`. It is **not** on
`DROP_EXPIRED` or the buff events — resolve it from `itemId` via `BUFF_ITEMS`.

Per-tick emission ceilings, for pool sizing against the 24-slot VFX cap
(`battle-realtime-three.js:14`) `[OBSERVED]`:

| Event | Ceiling | Why |
|---|---|---|
| `DROP_SPAWNED` | 8 | `MAX_FIELD_DROPS`; a 9th becomes `DROP_DENIED` |
| `BUFF_APPLIED` + `BUFF_REFRESHED` | 3 `[TARGET]` | bounded by drops collected in one `collectPickups` pass |
| `BUFF_EXPIRED` | 6 | `MAX_ACTIVE_BUFFS`, worst case a `clearBuffs` sweep |

---

## 8. Implementation checklist

Ordered. No step guesses a name. **Every line number below is a `~/orca/Abyssal-Surge-dungeon`
@ `033877ad` coordinate from §0** — not an authoring-tree number. Insert positions are given
as "between X and Y" so a small local drift cannot silently land the edit in the wrong phase.

| # | File | Change |
|---|---|---|
| 1 | `defense-catalog.js` | Add `BUFF_ITEMS` (§2.3), `DROP_CHANCE_BP` (§5.2), `RARITY_WEIGHTS_BP` (§5.3), `DROP_TTL_TICKS`, `MAX_FIELD_DROPS`, `MAX_ACTIVE_BUFFS`, `BUFF_STAT_OPS` (§3.2). All `freeze()`d. 923-line file. |
| 2 | `defense-run-simulation.js` | Import them. Add `dropRng: rngNext(unsignedSeed ^ 0x85ebca6b)` **immediately after line 3217** (`combatRng:`) and `buffs: []` in the same literal near `nextId: 0` (3218). |
| 3 | `defense-run-simulation.js` | Add `buffBp`, the five `effective*` accessors, `applyIncomingDamage`, `effectiveCooldownScaleBp`, `composedBuffStats` (§3.2). Every one carries its `bp === 0` identity guard. |
| 4 | `defense-run-simulation.js` | Route the seven base-stat reads through their accessor: `basicDamage` **1192, 1630** · `gateMaxIntegrity` **928, 1036, 2540, 2561, 2768-2770, 2962** · `pickupRange` **1764** · `cooldownScaleBp` **1983** · `critChanceBp` **1375-1376, 1382** · `incomingDamageBp` **2481, 2529** · `moveSpeedBp` = edit `getCommanderSpeed` (**1142**) in place. **Read sites only — no base field is written.** |
| 5 | `defense-run-simulation.js` | Add `expireBuffs`, `clearBuffs`, `evictOldestBuff`, `applyBuff`, `expireFieldDrops`, **`reconcileGateCap`**. Call `reconcileGateCap` at the end of all three removal paths — `expireBuffs`, `evictOldestBuff`, `clearBuffs` (§3.5). |
| 6 | `defense-run-simulation.js` | Wire Phase A **between 2848 (`processEncounterRecovery(run);`) and 2851 (`getCommanderSpeed(run)`)**; Phase B **between 3031 (`collectPickups(run);`) and 3032 (`updateEncounterObjective(run);`)** (§3.4). |
| 7 | `defense-run-simulation.js` | Add the roll block inside `resolveDeaths` (**2209**), in the existing `dead.forEach` loop; the elite-item creation at **2232** is the placement template (§6.3). |
| 8 | `defense-run-simulation.js` | Add the `kind === "buff"` branch to `collectPickups` (**1762**), **after** the `kind === "echo"` branch, **before** the `kind === "item"` branch (**1793** region) and before the trailing xp fallback (§4.3). |
| 9 | `defense-run-simulation.js` | Add the `dropRng` + `buffs` rehydration guards immediately after **3446** (the `combatRng` guard) in `advanceDefenseRun` (§6.1). |
| 10 | `defense-run-simulation.js` | Add the conditional `buffs` / `buffStats` block to `getRunSnapshot` (§6.4). |
| 11 | `defense-run-simulation.js` | Call `clearBuffs(run, "DEATH")` on terminal and in the `RETRY_OBJECTIVE` branch (§3.6). |
| 12 | `battle-realtime-three.js` | **RendererVfxImpl owns this file — DropBuffImpl must not edit it.** `ensurePickup` (**2928**) line **2932** reads `pickup.modelKey` with the current expression as fallback (§2.2). |
| 13 | `battle-realtime-three.js` | **RendererVfxImpl.** PR-1 (a)(b)(c) — specified by VfxCueDesign, prerequisite for any cue (§10 risk 1). Touches `effectAnchor` **1144** and `spawnVfx` **4029**. |

Steps 1–11 are simulation and self-contained. Steps 12–13 are presentation and cannot
alter simulation state.

### 8.1 Merge safety (director R28)

A real merge with the concurrent session is a **planned** cycle-close task, not a surprise.
Both files this spec touches are among the four that diverge: `defense-run-simulation.js`
3570 vs 4002, `defense-catalog.js` 923 vs 1025.

**Symbol collision check `[OBSERVED]`.** I grepped all 25 new symbols and all 6 new event
type names in this spec against `defense-catalog.js`, `defense-run-simulation.js`,
`battle-realtime-three.js`, and `app.js` in the concurrent session's tree
(`~/orca/Abyssal-Surge`, read-only). **Zero collisions.** `BUFF_ITEMS`, `DROP_CHANCE_BP`,
`RARITY_WEIGHTS_BP`, `BUFF_STAT_OPS`, `DROP_TTL_TICKS`, `MAX_FIELD_DROPS`,
`MAX_ACTIVE_BUFFS`, `DROP_OFFSET_X`, `STAGE_FLOOR_BOUNDS`, `dropRng`, `run.buffs`,
`expireBuffs`, `expireFieldDrops`, `applyBuff`, `evictOldestBuff`, `clearBuffs`, `buffBp`,
`composedBuffStats`, `applyIncomingDamage`, the five `effective*` accessors, `slabAt`, and
`DROP_SPAWNED` / `DROP_EXPIRED` / `DROP_DENIED` / `BUFF_APPLIED` / `BUFF_REFRESHED` /
`BUFF_EXPIRED` are all absent from their tree. Their catalog delta is `AIM_BIAS_BP`,
`EXTRACTION*`, `COMPANION_CAPACITY_BASE`, `ash-nova`, `regents-verdict` — disjoint from
ours. Any future rename must re-run this check.

**Steps 1–3, 5–11 are pure insertions** — new catalog entries, new functions, new lines
between named existing phases. Those merge cleanly.

**Step 4 is the one conflict-prone step** and needs discipline. It touches ~14 existing
read sites scattered across the diverging file. Rules:

1. **Single-line, in-place substitution only.** Replace `run.commander.basicDamage` with
   `effectiveBasicDamage(run)` inside the existing expression. Nothing else on the line
   moves.
2. **Do not reformat the surrounding block**, do not extract a local, do not reorder
   statements, do not re-wrap a long line. An isolated single-line edit merges; a
   reflowed region conflicts across every line it touched.
3. **Do not "tidy" adjacent code** you did not need to change. Every incidental line is a
   conflict the reconciler has to adjudicate without context.
4. If the concurrent session has already modified one of the 14 lines, that is a genuine
   semantic conflict — **stop and escalate**, do not resolve it unilaterally.

**Never pre-merge their work into this branch.** Their tree is uncommitted and unreadable
as a coherent state; `CLAUDE.md §5` forbids absorbing another session's changes. The
collision grep above is a read-only name check, which is the opposite operation.

`core-loop-legion-spec.md` is **out of scope** (R27) — it is the concurrent session's
cycle-9 spec and is already implemented on their side. Nothing in this document derives
from it. `moveSpeedBp` composes onto `COMMANDER.speed` inside `getCommanderSpeed` and is
independent of their analog input contract; the MOVE payload is untouched by this spec.

---

## 9. Verification matrix

| # | Check | Assertion | Measured where |
|---|---|---|---|
| 1 | **Zero-buff digest identity** | `getRunDigest(run)` for a run that collects no buff drop is byte-identical to the pre-change digest at the same seed. Capture the baseline string **before** step 1 of §8. | New test in `tests/defense-run-simulation.test.mjs`, seed 71, `cinder-span`, 500 ticks — the same setup as `:265-275`. |
| 2 | **`run.rng` untouched** | After 3000 ticks with drops enabled, `run.waveVariant.schedule` deep-equals the schedule from a build with the drop block deleted. | `tests/defense-run-simulation.test.mjs`; compare against `stage-wave-doctrine.test.mjs` expectations. |
| 3 | **Derived stream isolated** | Two runs, same seed, differing only in `dropRng` seeding constant, produce identical `waveVariant` and identical `combatRng` after 1000 ticks. | New test, `tests/defense-run-simulation.test.mjs`. |
| 4 | **Draw count is state-independent** | Force `MAX_FIELD_DROPS` saturation; `run.dropRng` after the tick equals `run.dropRng` from an unsaturated run with the same kill sequence. | New test; drive `resolveDeaths` with a fixed dead list. |
| 5 | **No float serialized** | `JSON.parse(getRunDigest(run))` — walk `buffs[]`, `buffStats`, every `events[]` payload from the 7 types in §7; assert `Number.isInteger(v)` for every numeric leaf. | New test, run until ≥1 buff active. |
| 6 | **Expiry is exact** | Buff applied at tick `A`, `durationTicks = D`: `snapshot.buffs` contains it at `A+D-1` and is absent at `A+D`; exactly one `BUFF_EXPIRED` with `reason: "TIMEOUT"` at `A+D`. | New test, deterministic seed. |
| 7 | **Expiry is idempotent** | Calling `expireBuffs(run)` twice in one tick yields an identical `run.buffs` and emits no second `BUFF_EXPIRED`. | Direct unit call on an unfrozen run clone. |
| 8 | **Base stats never mutated** | Across a full buff apply → expire cycle, `run.commander.basicDamage`, `.pickupRange`, `.cooldownScale`, `.critProfile.chanceBp`, `.incomingDamageMultiplier`, and `run.gate.maxIntegrity` all equal their pre-buff values. | New test — this is the direct guard for `:945-961`. |
| 9 | **Composition is exact** | With `ember-edge` ×2 active, `effectiveBasicDamage(run) === Math.trunc(base * 12400 / 10000)`; after expiry it returns exactly `base`. | New unit test on the accessor. |
| 10 | **Cap holds** | `reaver-fervor` ×2 + `ember-edge` ×3 ⇒ `buffBp(run,"basicDamage") === 5000`, not 8600. | New unit test. |
| 10a | **Identity guard on every accessor** | With `run.buffs = []`, each of `effectiveBasicDamage`, `effectiveGateMax`, `effectivePickupRange`, `effectiveCritChanceBp`, `effectiveCooldownScaleBp`, `applyIncomingDamage`, and the edited `getCommanderSpeed` returns a value `Object.is`-equal to the original expression it replaced. | New unit test, table-driven over the 7 accessors. |
| 10b | **Incoming-damage rounding preserved** | With `companionLoadout` of 3 vanguard companions (`incomingDamageMultiplier = 0.95³ = 0.857375`) and no `incomingDamageBp` buff, `applyIncomingDamage(run, d)` equals `Math.round(d * run.commander.incomingDamageMultiplier)` for every `d` in 1..2000. Guards the quantisation and rounding-mode trap in §3.2. | New unit test. |
| 11 | **Gate cap composes, never mutates, and reconciles on removal** | (a) With `bulwark-echo` ×2 on `cinder-span`, `effectiveGateMax` is 1920 while `run.gate.maxIntegrity` stays **1600** — the base is never written. (b) Recovery fills integrity to 1920, then on **each of the three removal paths independently** — timeout, eviction, and `clearBuffs` — `gate.integrity <= gate.maxIntegrity` holds **within the same tick**, including in that tick's snapshot. Eviction is the one that fails a filter-only implementation: it removes at phase 18, so a missing `reconcileGateCap` leaves integrity above cap through phases 19–21 and into the end-of-tick snapshot. (c) `reconcileGateCap` never raises: with no gate buff it is `Object.is`-identity on `gate.integrity`. | New test, three cases — the direct guard for `an item pickup applies both gate maximum and current integrity` (`tests/defense-run-simulation.test.mjs:963-980`). |
| 11-PARKED | **Gate cap check 11 is PARKED, not passed — cycle 10.** Clauses (a)/(b)/(c) above are unimplementable as written: they name `bulwark-echo`, and no catalog item carries `gateMaxIntegrity` after the withdrawal. `effectiveGateMax` and `reconcileGateCap` remain live code and keep unit coverage via a **synthetic** buff entry at `tests/defense-run-simulation.test.mjs:1683` (identical arithmetic: magnitude 1000 × 2 stacks = ×1.2). What is NOT covered is the three-removal-path reconciliation, because no reachable drop can produce a gate buff. Re-enabling the item must restore this check **and** carry the snapshot fix. | Parked — see "Withdrawal". |
| 12 | **Companions ignore buff drops** | With 3 companions and a buff drop in leash range, no companion reaches `aiState === "COLLECT"` targeting it, and `applyItem` is never called for a `BUFF_ITEMS` id. | New test; `tests/companion-autonomy.test.mjs` for the regression side. |
| 13 | **Duplicate pickup never duplicates the entry** | Collect the same `itemId` twice: `run.buffs.filter(e => e.itemId === id).length === 1`; `STACK` ⇒ `stacks === 2` + one `BUFF_REFRESHED`; `REFRESH` ⇒ `stacks === 1` + one `BUFF_REFRESHED`; `expiresAtTick` advanced in both. | New test. |
| 14 | **Eviction is deterministic** | With 6 distinct buffs active and a 7th collected, the evicted entry is the smallest `expiresAtTick` (tie → smallest `buffId`); `run.buffs.length === 6`; one `BUFF_EXPIRED` with `reason: "EVICTED"`. | New test. |
| 15 | **Field cap** | With 8 buff drops on the field, the next successful roll emits `DROP_DENIED` with `reason: "FIELD_CAP"` and `run.pickups` gains no drop. | New test. |
| 16 | **Drop TTL grace** | A drop with `expiresAtTick === run.tick` inside pickup range **is collected** on that tick; the same drop out of range emits `DROP_EXPIRED` on that tick. | New test — proves the Phase B ordering choice. |
| 17 | **Measurement isolation** | With `MEASUREMENT_PROFILES.striker`, after 2000 ticks: `run.dropRng` unchanged from creation, `run.buffs` empty, zero events of the 7 types in §7. | Extend `tests/defense-run-simulation.test.mjs:784`. |
| 18 | **Old-save rehydration** | `advanceDefenseRun` on a run object with `dropRng` and `buffs` deleted does not throw; both are restored; `dropRng === rngNext(seed ^ 0x85ebca6b)`. | New test. |
| 19 | **`SNAPSHOT_VERSION` unchanged** | `getRunSnapshot(run).version === 7` for both buffed and unbuffed runs. | New test. |
| 20 | **Existing suite green** | `node --test 'tests/**/*.test.mjs'` — quoted glob per `CLAUDE.md §6`. The nine tests named in §6.2 must pass unchanged. | Full regression. |
| 21 | **Renderer boundary** | After a render pass over a snapshot with active buffs, `getRunDigest(run)` is unchanged. | `tests/defense-renderer-contract.test.mjs`; `tests/defense-public-contract-regressions.test.mjs:49`. |
| 22 | **Prop GLBs load** | Both `modelKey` values resolve to a loadable GLB; a drop with an unknown `modelKey` falls back and still renders. | `tests/combat-presentation-contract.test.mjs` (prop mesh pack caching); browser probe on `assets/mesh/prop/prop-sprite-sheet-single-object.{03,05}/glb/base_basic_pbr.glb`. |
| 23 | **Drop cadence in band** | Full-stage runs across ≥20 seeds per stage: mean total drops within 4.0–7.5, and every stage's mean within ±1.5 of the others. | Browser/CLI soak, `tests/defense-soak-browser.cjs` harness. |
| 24 | **Uptime in band** | Same runs: buffed **wall-clock** ticks / total ticks ∈ [0.10, 0.35]. Separately, buff-ticks (overlap double-counted) ∈ [0.16, 0.31] per §2.4 — if the wall-clock figure exceeds the buff-tick figure the accounting is wrong. | Same soak. |
| 25 | **DPS ceiling** | Peak `effectiveBasicDamage` never exceeds `Math.trunc(base * 15000 / 10000)`. | Assert in the soak; cross-check against `master-numeric-contract.md:161-168`. |
| 26 | **`slabAt` is total and unambiguous** | For each stage, over every slab-edge coordinate plus a coarse interior grid: every point inside the authored floor bounds matches **exactly one** slab (never 0, never 2), and the five out-of-bounds probes return `null`. Also assert area closure — 237,120,000 / 241,680,000 / 246,240,000 unit² equal to each stage's bounds rectangle — and pairwise overlap 0. **Pre-verified `[TARGET]`: I ran this arithmetic against the frozen slab table and all three stages pass**, independently reproducing DungeonLevelDesign's areas. It is in the matrix so a future slab edit cannot silently break it. | New test beside the catalog-shape test (§10 risk 10). |
| 27 | **Drop position is the actor's, not the corpse's** | For a `DROP_SPAWNED`, `event.x === drop.x` and `event.y === drop.y` after `DROP_OFFSET_X` and `placeOnTerrain` — not `entry.x`. `event.slabId === slabAt(stageId, event.x, event.y)`. For `DROP_DENIED`, `event.x === entry.x` (no actor exists). | New test — guards the 240-unit cue offset in §7.2. |
| 28 | **`buffId` is run-scoped, and consumers clear on that boundary** | Two runs from the same seed both produce a `buff-1` for their first applied buff — assert the ids collide, which is the property consumers must defend against. Then assert every `buffId`-keyed presentation structure (audio warned-id `Set`, HUD row state) is empty immediately after run start and after remount. | New test for the sim half (id collision across runs); presentation half belongs to `audio-feedback-runtime.test.mjs` and the HUD suite, owned by AudioImpl / UiJoystickImpl. |

Checks 1, 2, 5, 8, 10a, 17, 20 are the determinism gate. **If any of those seven fails,
the feature does not ship** — no adjective overrides them.

---

## 10. Open risks

| # | Risk | Breaks | Mitigation |
|---|---|---|---|
| 1 | **PR-1 not landed ⇒ every drop/buff cue is silently invisible.** `effectAnchor` (`battle-realtime-three.js:1194-1210`) never reads top-level `event.x`/`event.y`, and `spawnVfx` hard-returns on a null anchor at `:4029` with no warning (Main, D1, `[OBSERVED]`). `DROP_SPAWNED` carries `dropId` + top-level `x`/`y` — neither is in the resolution chain. | Nothing in simulation. VFX and any audio keyed off a cue instance produce **nothing, without an error**. | Ruled PR-1 (a)(b)(c), owned by VfxCueDesign, listed as step 13. Purely additive: every current caller returns before the new branch. Prerequisite for VFX acceptance, **not** for simulation acceptance. |
| 2 | ~~**`slabId` is a promise.**~~ **RESOLVED.** DungeonLevelDesign published the final frozen 12-id slab table; §7.2 binds it with an explicit half-open edge rule. | Was: audio could not key drop timbre to floor material. | Closed. Residual: `slabId` is `null` outside the authored floor (slabs do not cover the full arena and enemies spawn from the W/NW/SW edges), which is specified behaviour, not an error. A consumer that assumes non-null will throw on an edge-spawn kill. |
| 3 | **Base-stat mutation regression.** An implementer who "simplifies" step 4 by writing into `run.commander.basicDamage` instead of composing at the read site reintroduces exactly the permanent-grant bug this spec exists to avoid — and it will look like it works. | `owned Warden's Lantern…` (`:912`), `owned Choir Ward Crystal…` (`:923`), `Warden's Lantern and Choir Ward Crystal are applied once…` (`:945-961`). | Check 8 asserts base fields are unchanged across a full apply→expire cycle. Check 9 asserts exact restoration. |
| 4 | **`run.rng` consumption.** A drop roll that reaches for the nearest RNG finds `run.rng` first. | All nine tests in §6.2. `getRunDigest` byte-identity, every seeded fixture, `stage-wave-doctrine.test.mjs`, `g2-measurement-fixture.test.mjs:84`. | §6.1 mandates `dropRng`. Check 2 asserts the wave schedule is untouched; check 3 asserts stream isolation. |
| 5 | **Field-cap check before the draws.** Cheaper and obviously wrong: it makes RNG position depend on how many drops are lying around. Survives casual testing, dies in replay. | Digest equality on any replay where field occupancy differed. | §6.3 invariant 2 mandates draw-then-check. Check 4 measures it directly. |
| 6 | **Float leakage via `cooldownScale`.** `Math.round(0.9 * 10000)` is required because `0.9 * 10000 === 9000.000000000002`. Omitting the round admits a float into integer math. | `getRunDigest` byte-identity between machines/engines; `master-numeric-contract` integer discipline; `map-simulation.md:411`. | §3.2 mandates the round. Check 5 walks every numeric leaf for `Number.isInteger`. |
| 7 | **Shared `nextId` counter shifts downstream ids.** `nextId(run, "buff")` and `nextId(run, "drop")` share `run.nextId` with pickups, projectiles, and enemies (`:49`). Once a drop spawns, every later `pickup-<n>` renumbers. | Any test asserting a literal actor id after a drop. None found in the current suite. | Intended and unavoidable — it is the same counter the whole sim uses. A zero-drop run consumes zero ids, so every existing fixture is unaffected (check 1). If a future test pins a literal id, it must pin it in a `measurementProfile` run. |
| 8 | **`pickupRange` self-composition.** `reclaimer-pulse` widens the radius used to collect the drop that granted it, so a chain of drops at the radius edge can cascade in one tick. | Nothing today. Could surprise a QA reading collection order. | Intended and readable. Bounded by the +7000bp cap and by `MAX_FIELD_DROPS = 8`. Collection order stays deterministic — `run.pickups` is filtered in array order and the array is snapshot-sorted. |
| 9 | **`clearBuffs` emits up to 6 `BUFF_EXPIRED` in one tick.** Bounded by `MAX_ACTIVE_BUFFS = 6`. The reachable trigger is **`reason: "DEATH"`** — `run.terminal` being set, and the `RETRY_OBJECTIVE` branch. `"STAGE_TRANSITION"` is in the ruled enum but **unreachable today** (§3.6): a new stage is a new `createDefenseRun`, so buffs never cross a stage. | Any test asserting an exact `events.length` on the terminal tick — none found. Downstream: AudioFeedbackDesign reports a **12-voice pool**, so an ungated burst is **6 of 12 voices** in the terminal tick, arriving exactly when the defeat cue wants the mix. | Reason-gate: audible sting on `"TIMEOUT"` only (R10a). **Justify that gate by `DEATH`, not by `STAGE_TRANSITION`** — a reader who checks reachability of the latter will find it dead, conclude the gate is unnecessary, and remove the protection that death and retry actually need. `"EVICTED"` is the secondary case and fires one at a time mid-combat. Only fires when buffs are active, so unbuffed fixtures are unaffected. |
| 10 | **Empty rarity pool after a catalog edit.** Removing an item could empty a (stage, grade, rarity) cell; `pool[n % 0]` is `undefined` and would create a drop with `itemId: undefined`, which serializes as a missing key and corrupts the digest. | `getRunDigest` shape; `BUFF_ITEMS[undefined]` throws inside `resolveDeaths`, aborting the tick. | §5.3 mandates fall-through to the next lower non-empty rarity, never a throw. Add a catalog-shape test asserting every reachable cell is non-empty. |
| 11 | **Numbers are all `[TARGET]`.** Every chance, magnitude, duration, and cap is unmeasured. §5.2's kill estimates are derived from the shipped `buildDoctrineWavePlan` formula, not from a run. | G2 balance if shipped unmeasured. | Checks 23–25 are the measurement. **This cycle changes no gate to PASS** (production brief §3). |
| 12 | **Every inline line number in §1–§7 is wrong for the implementation tree.** `[OBSERVED]` This spec was authored in `~/orca/Abyssal-Surge` (`defense-run-simulation.js` = 4002 lines, ~430 uncommitted lines from a concurrent session); implementation is `~/orca/Abyssal-Surge-dungeon` @ `033877ad` where the file is **3570**. `:3610` and `:3858` are **past EOF** there. Root cause `[OBSERVED]`, found by AudioImpl: the grep/read tools resolve **relative** paths against the workspace root — the authoring tree — so a relative grep silently measures the forbidden tree. A few numbers match by coincidence (`run.rng = seed` at 1838), so a spot-check can pass while the rest are off by hundreds. | An implementer patching by inline number lands in the wrong function, or past EOF. Phase A/B would land in the wrong tick phase and break the "stats constant for the whole tick" invariant that §3.6 depends on. | **§0 is the authoritative table**, measured with absolute paths in the implementation tree and cross-verified against the director's independent grep — both passes agree on every symbol. §8 carries worktree coordinates. Always pass absolute `~/orca/Abyssal-Surge-dungeon/...` paths to grep/read/edit and `cwd` on every bash call. Anchor on symbol + quoted code text; if the code differs from what this spec quotes, stop and escalate. |
| 13 | **Float quantisation via basis-point conversion.** The tempting cleanup is to convert `incomingDamageMultiplier` to basis points for uniformity with the other six stats. `0.95³ = 0.857375` is not representable in 4 decimals, and `Math.round(d*m)` vs `Math.trunc(d*bp/10000)` disagree at `d=101, m=0.95` (96 vs 95). | Damage taken changes for every existing run with a vanguard companion — a silent balance and digest regression, invisible in an unbuffed fixture. | §3.2 keeps the float and scales the already-rounded result. Check 10b sweeps `d` in 1..2000 against the original expression; check 10a asserts the zero-buff identity for all seven accessors. |

---

## Withdrawal — `bulwark-echo` / `gateMaxIntegrity`, cycle 10

`[OBSERVED]` **Status: withdrawn from the shipped catalog. 10 of 11 specified items ship.**

### What happened

§4's overflow table already predicted the defect ("The HUD reads 1920/1600 and the invariant
every other gate write maintains is broken") and `reconcileGateCap` was written to answer it.
`reconcileGateCap` restores the invariant **after removal** and does nothing **during** the
buff. `getRunSnapshot` publishes `gate: run.gate` verbatim
(`defense-run-simulation.js:3921`), so for the entire 20 s window the serialized snapshot
reports `integrity 1920` against `maxIntegrity 1600`.

### How it was found

Not by reasoning. `tests/stage1b-pressure-packets.test.mjs` failed with
`stage1b-pressure: invalid gate integrity state at tick 1496: from=1600, to=1601, max=1600`.
Attribution was decided by running the same file at the base commit `033877ad` in a detached
worktree: **8/8 pass there, so the regression is cycle 10's, not carried.** §10 risk 7 had
assessed the neighbouring `nextId` hazard as "None found in the current suite" — that
assessment was about a different mechanism and was not what fired.

### Why withdrawal rather than publishing the composed cap

Three consumers read `gate.integrity` against `gate.maxIntegrity` and assume the invariant:

1. `scripts/run-stage1b-pressure-packets.mjs` — its `to > max` bound **and** its
   `Math.min(max, …)` delta model. This is **G7 evidence tooling**; relaxing its invariant is
   an evidence supersession that makes previously exported G7 pressure evidence
   non-comparable.
2. The `low-hp-focus` enemy policy at `:2705` —
   `gateRatio = run.gate.integrity / run.gate.maxIntegrity`. A gate buff pushes that ratio
   above 1 and flips target selection toward the commander. **A live behavioural change**,
   not a display artifact.
3. Any HUD ratio reading the same pair.

Publishing a composed cap in the snapshot changes the canonical digest bytes, which forces a
full G7 evidence re-export, and rerouting `:2705` changes shipped targeting behaviour that
needs its own proof. Both at cycle close, against a red suite, with no measured before-number
for the pacing gates. Withdrawing one rare item touches no invariant and no evidence.

### Cost of the withdrawal — stated, not hidden

- Check 11 is **PARKED**, not passed (see the 11-PARKED row). Its three-removal-path
  reconciliation is uncovered because no reachable drop can produce a gate buff.
- `effectiveGateMax` and `reconcileGateCap` stay live behind their other read sites and keep
  accessor coverage through a **synthetic** entry
  (`tests/defense-run-simulation.test.mjs:1683`), not a catalog item.
- `tests/defense-run-simulation.test.mjs:1544` (gate check 5) swapped its far drop to
  `lantern-aegis`; that drop is never collected, so the check's `buffStats` assertion is
  unaffected.
- `_workspace/current/qa/cycle10-drop-buff-proof/determinism-gate-receipt.json` and
  `dbimpl-behavior.mjs` record `bulwark-echo` measurements that were **accurate when taken**.
  They are superseded, not wrong, and are left unedited as history.
- Every reachable (stage, rarity) cell stays non-empty after the removal — verified
  (cinder-span rare = 2, chancel rare = 3, throne rare = 2), so §5.3's fall-through is not
  exercised and risk 10 does not trigger.

### Re-enabling — one line is NOT enough

`BUFF_STAT_OPS.gateMaxIntegrity` and `effectiveGateMax` are deliberately retained, so the
catalog row is one line. **That line alone reintroduces the defect.** Re-enabling must carry:
publish the composed cap in the snapshot (e.g. `gate.effectiveMaxIntegrity`, leaving
`gate.maxIntegrity` byte-identical), route all three consumers at it, add a check asserting
the snapshot never reports `integrity > published cap`, restore check 11, and accept the G7
evidence supersession.
