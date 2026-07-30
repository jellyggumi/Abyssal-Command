# VFX spec — item drop, enemy arrival, terrain deformation (cycle 10)

run-id: `20260728-onslaught-action-pivot` · cycle 10 · lane: `design`
owner: VFX designer (drop / spawn / terrain-deformation cues)
engine: **Three.js + WebGL browser only**. No Unity/Unreal concept applies.
narrowest `web-game-development` sub-skill: **`create-game-vfx`**. Adjacent skills
(`design-game-encounters`, `author-game-levels`) are consumed as constraints, not re-specified.

Scope: the three gameplay moments that have **no** visual cue today. Non-goals: audio
(`audio-feedback-dungeon-spec.md`), simulation rules (`item-drop-timed-buff-spec.md`),
HUD (`hud-overhaul-joystick-cutover-spec.md`), dungeon geometry
(`stage-dungeon-composition-spec.md`).

Marks: `[OBSERVED]` = read from source at the cited line **in the implementation tree**;
`[INFERENCE]` = derived, not measured; `[TARGET]` = authored by this spec.
**Every number this spec introduces is `[TARGET]`.**

---

## 0. READ THIS FIRST — citation tree, ownership, and two corrected defects

### 0.1 Every citation below is against the implementation worktree

**All `file:line` citations in this document were re-derived against
`/Users/jangyoung/orca/Abyssal-Surge-dungeon` at commit `033877ad`** — the tree the
implementation actually happens in. **Identify that tree by PATH, never by line count**
— see §0.1's retired-discriminator note below.

`[OBSERVED]` **Tooling trap, confirmed by three agents and the director.** The
`grep` / `read` / `glob` / `edit` tools resolve a **relative** path against
`/Users/jangyoung/orca/Abyssal-Surge` — a different tree carrying a concurrent
session's uncommitted work — not against the dungeon worktree. The same pattern
returns different line numbers and a different snapshot tag depending on which path
form is used. `UiJoystickImpl` further proved the trap applies to **writes**: only the
stale-hash guard prevented a relative `edit` header from clobbering the forbidden
tree, and for a file byte-identical across both trees that guard would not have fired.

Therefore, for every tool call while implementing this spec:

- Pass an **absolute** `/Users/jangyoung/orca/Abyssal-Surge-dungeon/...` path to `grep`, `read`, `glob`, `ast_grep`, and `edit` — including inside the `edit` section header.
- Pass `cwd: /Users/jangyoung/orca/Abyssal-Surge-dungeon` on every `bash` call.
- Re-read via the absolute path immediately before each edit to mint a fresh tag.
- A snapshot tag certifies a **file**, not a repository. If a tag changes between reads without you editing, you switched trees.

`[OBSERVED]` **Line counts are NOT a tree discriminator — ruling v7 R32 retired that
rule.** An earlier revision of this spec listed per-file line counts as a way to
confirm you were in the dungeon tree. They have already expired: implementers grew
`defense-catalog.js` 923 → **1077**, `battle-realtime-three.js` 4846 → **5223+**, and
`app.js` 3807 → **4147** as their work landed correctly. Anyone checking a count today
would conclude they are in the *wrong* tree while standing in the right one, and might
"correct" into the forbidden tree. A line count is a snapshot of a moving target; it
stopped being a valid discriminator the moment implementation began.

The two durable checks:

1. **Path.** Absolute `/Users/jangyoung/orca/Abyssal-Surge-dungeon/...` in every `read` / `grep` / `glob` / `edit` / `write` header, `cwd` on every bash call. Does not decay.
2. **Commit-addressed read.** `git show 033877ad:<path>` returns the base blob regardless of any working tree. The only read that cannot be fooled, and what this spec's `[OBSERVED]` baseline claims are grounded in.
offset; re-grep the symbol.

**The symbol name is the durable anchor, not the line number.** Every citation below
names its symbol. `grep` the symbol, read the surrounding range, confirm the code
matches the text this spec quotes, and only then edit. **If the code differs from what
this spec quotes, stop and DM `Main` — do not adapt silently.**

### 0.2 File ownership — this spec touches exactly one owned file

| File | Owner | What this spec asks of it |
|---|---|---|
| `battle-realtime-three.js` | **`RendererVfxImpl` only** | PR-1…PR-5, all registry entries (§8), both pool-free surfaces (§4.2, §6.4) |
| `scripts/build-stage-vfx-blender.py` | *unowned in the impl roster* | §9 asset authoring — needs an owner assigned |
| `scripts/defense-runtime-assets.mjs` | *unowned* | §9.6 allowlist row 1 |
| `tests/release-closure.test.mjs` | *test-file rule* | §9.6 allowlist rows 2–3 |
| `tests/pages-artifact-smoke.cjs` | *unowned* | §9.6 allowlist row 4 |
| `.github` workflow `PAGES_RUNTIME_PATHS` | *unowned* | §9.6 allowlist row 3 |

`[TARGET]` **This spec requires no change to `defense-run-simulation.js` or
`defense-catalog.js`.** Every event it consumes is either already emitted or is
`DropBuffSystem`'s / `EncounterPacing`'s / `DungeonLevelDesign`'s to emit. A renderer
agent implementing this spec never needs a file it does not own — **except** the four
asset allowlists in §9.6, which no single agent owns. See risk R-3.

### 0.3 Two defects in this spec's own first draft, corrected here

Recorded rather than silently overwritten, because both were load-bearing.

**D-A — the persistent-decal system this spec cited as precedent does not exist.**
The first draft built both pool-free surfaces (§4.2 drop beacon, §6.4 deformation
seam) on `groundDecalGroup` / `corpseGroup` / `corpseMarkers` / `MAX_CORPSE_MARKERS` /
`GROUND_DECAL_LIFT` / `RANGE_RING_*`, and took its grade palette from
`CORPSE_GRADE_COLORS`. `[OBSERVED]` **A grep for all six symbols in
`/Users/jangyoung/orca/Abyssal-Surge-dungeon/battle-realtime-three.js` returns zero
matches.** That system is uncommitted work in the concurrent tree. An implementer at
`033877ad` has no `groundDecalGroup` to attach to and no `CORPSE_GRADE_COLORS` to read.
Both surfaces are therefore respecified in this draft as **new construction that
stands alone** (§4.2, §6.4), and the grade palette is defined here (§3.1).

**D-B — line numbers from the wrong tree.** Roughly half the first draft's renderer
citations were taken from the concurrent tree mid-session, when the file had grown to
5515 lines. Every citation in this draft is re-derived against `033877ad`. The
correction table is §0.4 so that anyone holding the stale draft can diff.

### 0.4 Anchor table — base blob at `033877ad`, NOT the live file

`[OBSERVED]` Right-column values are line numbers **in the base blob**
`git show 033877ad:battle-realtime-three.js`. They are the provenance record for this
spec's baseline claims, not navigation coordinates.

`[OBSERVED]` **This table is already stale for the live file, by design — ruling v7
R33.** The renderer is under active edit and every landed change moves it. Measured
drift: `authoredAnchor` 1144 → **1335**, `ensurePickup` 2928 → **3145**, while
`MAX_VISUAL_EFFECTS` 14, `PROP_BLADE_MESH` 222 and `PROP_RELIC_MESH` 223 held.

**Re-grep the symbol immediately before each edit — every time, not once per task.**
The file moves as your own edits land, and a sibling in the same file moves it further.
Use this table to confirm you found the *right construct*, never to navigate to a line.

| Symbol | Stale draft said | **Implementation tree** |
|---|---|---|
| `MAX_VISUAL_EFFECTS` | 14 | **14** ✓ |
| `STAGE_VFX_GROUND_LIFT` | 53 | **53** ✓ |
| `TARGET_HEIGHT` | 57-65 | **57-65** ✓ |
| `MAX_ORBIT_PITCH` | 131 | **77** |
| `ORBIT_ZOOM_DEFAULT` | 132 | **78** |
| `MIN_ORBIT_DISTANCE` | 135 | **81** |
| `MAX_ORBIT_DISTANCE` | 136 | **82** |
| `VFX_MODELS` | 343-377 | **289-323** |
| `VFX_MODELS.ITEM_COLLECTED` | 307 | **306** |
| `semanticVfxIdForEvent` | 340-354 | **340-354** ✓ |
| `VFX_LIFETIME_TICKS` | 427-457 | **373-403** |
| `VFX_LIFETIME_TICKS.ITEM_COLLECTED` | 440 | **386** |
| `CRITICAL_VFX_EVENT_TYPES` | 458-476 | **404-422** |
| `"BOSS_SPAWNED"` in that array | 462 | **408** |
| `QUEST_VFX_PRESENTATIONS` | 423-442 | **423-442** ✓ |
| `COLORS` | 847 | **793** |
| `COLORS.pickup = 0xffaa00` | 852 | **798** |
| `worldPointInto` | 929-941 | **875-887** |
| the `normalized` test | 932 | **878** |
| `worldPoint` | 943-945 | **889-891** |
| `effectAnchor` | 1190-1211 | **1136-1157** |
| commander-fallback switch arm | 1202-1207 | **1148-1156** |
| `authoredAnchor` check | 1198-1201 | **1144-1147** |
| `instantiateStageVfx` | 1753-1788 | **1753-1788** ✓ |
| `applyStageVfxPolicy` | 1789-1801 | **1789-1801** ✓ |
| `applyTransientVfxPolicy` | 1803-1807 | **1803-1807** ✓ |
| `instantiateVfxModel` | 2136-2144 | **2082-2094** |
| `PerspectiveCamera(35, …)` | 2574 | **2154** |
| base pitch 55° | 2754 | **2321** |
| `ensurePickup` | 2982 | **2928** |
| `retireActor` | 3428-3438 | **3374-3384** |
| `reconcileActors` | 3525 | **3525** ✓ |
| pickups sync loop | 3553-3558 | **3553-3558** ✓ |
| `setReducedMotion` | 3658-3676 | **3658-3676** ✓ |
| `retireVfxRecord` | 4049-4058 | **3995-4004** |
| `trackVfxInstance` | 4060-4072 | **4006-4017** |
| `evictionIndex` line | — | **4013** |
| `spawnVfx` | 4074 | **4020** |
| `pendingVfxLoads` admission gate | 4080 | **4026** |
| `if (!anchor) return;` | 4029 | **4029** ✓ |
| `groundDecalGroup`, `corpseMarkers`, `CORPSE_GRADE_COLORS`, `MAX_CORPSE_MARKERS`, `GROUND_DECAL_LIFT`, `RANGE_RING_*` | cited as existing | **DO NOT EXIST** — see D-A |

`defense-run-simulation.js` @ `033877ad` (3570 lines), citations used below:

| Symbol / site | Line |
|---|---|
| `ENEMY_SPAWNED` emit | **743** |
| `MIDBOSS_SPAWNED` emit | **758** |
| `BOSS_SPAWNED` emit | **817** |
| `ITEM_COLLECTED` emit | **1805** |
| `PICKUP_DENIED` / `ECHO_DENIED` emit | **1785-1786** |
| `applyItem` | **1750** |
| `collectPickups` | **1762** |
| `resolveDeaths` | **2209** |
| echo pickup push | **2215** |
| elite item push (`entry.x + 240`) | **2232** |
| `TERRAIN_RECOVERY` emit | **2775** |
| `combatRng` in run literal | **3217** |
| `combatRng` rehydration guard | **3446** |
| `getRunSnapshot` | **3489** |
| `getRunDigest` | **3555** |
| `SNAPSHOT_VERSION = 7` | **378** |

`defense-catalog.js` @ `033877ad` (923 lines):

| Symbol | Line |
|---|---|
| `ARENA` (`gateX: 22000, gateY: 6000`) | **12** |
| `COMMANDER.basicCooldown = 24` | **22** |
| `ABYSS_DEPTH_PACKAGES` depths 1/2/3 | **300 / 301 / 302** |
| `eliteEscorts: 2` (depth 3) | **302** |
| `ash-surge` hazard | **353** |
| `maxConcurrentEnemies` 8 / 9 / 10 | **474 / 515 / 558** |
| `spawnIntervalTicks` 18 / 24 / 15 | **475 / 516 / 559** |

---

## 1. Vocabulary binding (authority: director rulings v1–v3)

This spec consumes the ruled event vocabulary verbatim and coins nothing.

| Moment | Ruled event type | Position source | Ruling |
|---|---|---|---|
| drop appears | `DROP_SPAWNED` | top-level `x, y` | v2 R1 |
| drop lying in field | *no event* — `snapshot.pickups[]`, `kind === "buff"` | per-entry `x, y` | peer contract |
| pickup success | `ITEM_COLLECTED` **(exists — reused, not redefined)** | `entityId` → collector | v1 |
| drop despawns | `DROP_EXPIRED` | top-level `x, y` | v2 R1 |
| drop suppressed | `DROP_DENIED` | top-level `x, y` | v2 R2 |
| buff starts / renews / ends | `BUFF_APPLIED` / `BUFF_REFRESHED` / `BUFF_EXPIRED` | commander fallback | v2 R6, R10 |
| enemy arrives | `ENEMY_SPAWNED` + `grade` | `enemyId` → snapshot enemy | v2 R4, R12 |
| boss arrives | `BOSS_SPAWNED` **(exists — already mapped)** | `entityId` → boss | v1 |
| terrain deforms | `GIMMICK_ARMED` → `GIMMICK_TRIGGERED` → `GIMMICK_RESOLVED` + `gimmickClass` | top-level `x, y` | v2 R5, R8 |

Rejected names this spec must **not** emit or consume: `ITEM_DROPPED`,
`ITEM_DROP_EXPIRED`, `ITEM_DROP_DENIED`, `TERRAIN_DEFORMED`, `defId`, a `refreshed`
boolean, `DROP_DENIED.reason === "MEASUREMENT_PROFILE"` (withdrawn — unreachable).

- `rarity` ∈ `"common" | "rare" | "resonant" | "relic"` (v2 R3). Absent from `DROP_EXPIRED`; resolve from `itemId`.
- `grade` ∈ `"BASIC" | "SHADOW" | "BOSS"`, read **only** from `event.grade` — never re-derived from the `elite`/`midboss` booleans (v2 R4).
- `gimmickClass` ∈ `"deformation" | "gate" | "mirror" | "hazard"` (v2 R5).
- `DROP_DENIED.reason` has exactly one value, `"FIELD_CAP"`.
- All durations are integer ticks at 60 Hz. No floats in any serialized payload.

`[OBSERVED]` `TERRAIN_RECOVERY` (`defense-run-simulation.js:2775`) is occupation
recovery scoring, is **not** part of the deformation family, and stays unmapped.
`MIDBOSS_SPAWNED` (`:758`) stays and gets no cue of its own (v2 R12).

---

## 2. Existing inventory — all 33 event ids

`[OBSERVED]` `VFX_MODELS` (`battle-realtime-three.js:289-323`, 33 keys) maps every
event to one of **three** authored stage GLBs. `VFX_LIFETIME_TICKS` (`:373-403`)
carries **29** entries; the other 4 fall through to the literal default `30` in
`spawnVfx()`. `CRITICAL_VFX_EVENT_TYPES` (`:404-422`) holds **17** entries. Counts
extracted mechanically from the frozen literals.

GLB legend: **E** = `cinder-span-ember-wake.glb`, **M** = `abyss-chancel-mirror-static.glb`,
**F** = `echo-throne-fracture-echo.glb`. Distribution `[OBSERVED]`: E 12, M 13, F 8.

| # | Event id | GLB | Lifetime (ticks @60Hz) | Pool-exempt |
|---|---|---|---|---|
| 1 | `INPUT_ACCEPTED` | E | 12 | no |
| 2 | `INPUT_REJECTED` | M | 18 | no |
| 3 | `PICKUP_DENIED` | M | **— default 30** | no |
| 4 | `ECHO_DENIED` | M | **— default 30** | no |
| 5 | `EXTRACTION_REJECTED` | M | **— default 30** | no |
| 6 | `OBJECTIVE_FAILED` | M | 18 | **YES** |
| 7 | `ENCOUNTER_OBJECTIVE_FAILED` | M | 18 | **YES** |
| 8 | `PROJECTILE_BLOCKED` | M | 18 | no |
| 9 | `PROJECTILE_EXPIRED` | E | 12 | no |
| 10 | `BOSS_ATTACK_CANCELLED` | E | **— default 30** | no |
| 11 | `CRITICAL_HIT` | E | 18 | **YES** |
| 12 | `MELEE_IMPACT` | E | 8 | no |
| 13 | `PROJECTILE_IMPACT` | E | 8 | no |
| 14 | `SKILL_RESOLVED_DAMAGE` | F | 10 | no |
| 15 | `COMMANDER_DAMAGED` | F | 12 | no |
| 16 | `COMPANION_DAMAGED` | F | 12 | no |
| 17 | `ITEM_COLLECTED` | E | 24 | no |
| 18 | `OBJECTIVE_PHASE_CHANGED` | M | 36 | **YES** |
| 19 | `ENCOUNTER_OBJECTIVE_STARTED` | M | 36 | **YES** |
| 20 | `OBJECTIVE_COMPLETED` | E | 72 | **YES** |
| 21 | `ENCOUNTER_OBJECTIVE_COMPLETED` | E | 42 | **YES** |
| 22 | `WAVE_CLEARED` | E | 36 | no |
| 23 | `EXTRACTION_WINDOW_OPENED` | M | 60 | **YES** |
| 24 | `OCCUPATION_CAPTURED` | E | 48 | **YES** |
| 25 | `EXTRACTION_COMPLETED` | F | 60 | no |
| 26 | `BOSS_ATTACK_TELEGRAPHED` | M | 45 *(overridden by `event.windupTicks`)* | **YES** |
| 27 | `BOSS_SPAWNED` | F | 90 | **YES** |
| 28 | `BOSS_RALLY_WINDOW` | M | 90 | **YES** |
| 29 | `GATE_BREACHED` | F | 36 | **YES** |
| 30 | `WARDENS_WARD_TRIGGERED` | M | 60 | **YES** |
| 31 | `ECHO_WARDEN_AWAKENING_TRIGGERED` | E | 120 | **YES** |
| 32 | `COMPANION_DOWNED` | F | 48 | **YES** |
| 33 | `TERMINAL` | F | 90 | **YES** |

### 2.1 Two corrections to `map-renderer.md` `[OBSERVED]`

Both re-measured against the implementation tree.

1. `map-renderer.md` line 35 states `CRITICAL_VFX_EVENT_TYPES` has "**6** event
   types". The frozen array at `:404-422` contains **17**, adding `BOSS_SPAWNED`,
   `EXTRACTION_WINDOW_OPENED`, `WARDENS_WARD_TRIGGERED`,
   `ECHO_WARDEN_AWAKENING_TRIGGERED`, `OBJECTIVE_PHASE_CHANGED`,
   `ENCOUNTER_OBJECTIVE_STARTED`, `OBJECTIVE_COMPLETED`,
   `ENCOUNTER_OBJECTIVE_COMPLETED`, `OCCUPATION_CAPTURED`, `OBJECTIVE_FAILED`,
   `ENCOUNTER_OBJECTIVE_FAILED`. **17/33, not 6/33** — a nearly 3× larger
   un-evictable set, which changes the pool budget materially (§8).
2. `map-renderer.md` line 29 states `fitHeight` targets "boss 1.8, enemy 1.2,
   companion 1.6, stageNpc 1.8, pickup 0.7". `TARGET_HEIGHT` (`:57-65`) is
   `commander 1.55, boss 4.5, elite 2.2, enemy 1.7, companion 1.3, stageNpc 1.8,
   pickup 0.7`. Only `stageNpc` and `pickup` still match. §4 uses the live values.

### 2.2 The gap — stated explicitly

**All three moments this spec covers have no cue whatsoever today.** Not a weak cue:
none.

| Moment | Evidence `[OBSERVED]` |
|---|---|
| **Item drop appearing in the field** | `resolveDeaths()` (`defense-run-simulation.js:2209`) pushes the echo at `:2215` and the elite item at `:2232`. **Neither push emits any event.** The only drop-adjacent events are `ITEM_COLLECTED` (`:1805`, on *pickup*) and `PICKUP_DENIED`/`ECHO_DENIED` (`:1785-1786`, on *denial*). No producer exists for a drop-appear cue, so `VFX_MODELS` cannot contain one — and it does not. |
| **Enemy spawn / arrival** | `ENEMY_SPAWNED` **is emitted** (`:743`) and `MIDBOSS_SPAWNED` at `:758`. **Neither key exists in `VFX_MODELS`** (`battle-realtime-three.js:289-323`) or `VFX_LIFETIME_TICKS` (`:373-403`). `spawnVfx()` resolves `relPath = VFX_MODELS[event?.type]` and returns immediately on falsy. Every non-boss arrival is **silently discarded at the first line of the spawn path**. `BOSS_SPAWNED` is the only arrival with a cue. |
| **Terrain deformation** | No deformation event exists in the simulation at all. A search for `TERRAIN`/`DEFORM`/`COLLAPS`/`CAUSEWAY`/`GIMMICK` across the three catalogs returns only `TERRAIN_RECOVERY` (`:2775`, occupation scoring) and the unrelated `TERRAIN_TARGET_HALF_EXTENT` renderer constant. The `GIMMICK_*` family is entirely new this cycle. |

---

## 3. Prerequisites — the cues cannot render without these

`[OBSERVED]` **8 of the 9 new pooled cues resolve to a null anchor and are silently
dropped** under the ruled payloads. Verified against `effectAnchor()`
(`battle-realtime-three.js:1136-1157`), which resolves strictly in this order:

1. quest point, when `questVfxPresentationForEvent(event)` matches;
2. `event.targetId ?? event.entityId ?? event.enemyId ?? event.bossId` → `snapshotEntityById`;
3. `event.anchor ?? event.position ?? event.point`, and only when `.x` **and** `.y` are finite (`:1144-1147`);
4. a 4-case switch — `INPUT_ACCEPTED`, `INPUT_REJECTED`, `WARDENS_WARD_TRIGGERED`, `COMMANDER_DAMAGED` → commander (`:1148-1156`);
5. `null`.

It never reads top-level `event.x` / `event.y`. `spawnVfx()` then hard-returns at
`:4029` — `if (!anchor) return;` — with **no console warning**, so the failure is
invisible in production.

| Ruled event | Anchor outcome today | Why |
|---|---|---|
| `ENEMY_SPAWNED` | ✅ resolves | `enemyId` is in chain (2) and the enemy is live in `snapshot.enemies` |
| `BOSS_SPAWNED` | ✅ resolves | `entityId` is in chain (2) |
| `DROP_SPAWNED`, `DROP_EXPIRED`, `DROP_DENIED` | ❌ **null** | `dropId` is not in chain (2); `x, y` are top-level, not under `anchor` |
| `GIMMICK_ARMED`, `GIMMICK_TRIGGERED`, `GIMMICK_RESOLVED` | ❌ **null** | same — `x, y` top-level per v2 R8 |
| `BUFF_APPLIED`, `BUFF_REFRESHED`, `BUFF_EXPIRED` | ❌ **null** | no id in chain (2), no position, not in switch (4) |

### PR-1 — `effectAnchor()` accepts an event as its own anchor `[TARGET]`

Ratified as v2 R9(a). Insert one branch after the `authoredAnchor` check
(`:1144-1147`), before the switch:

```js
if (Number.isFinite(event?.x) && Number.isFinite(event?.y)) {
  return { x: event.x, y: event.y, elevation: event.elevation ?? 0, normalized: false };
}
```

`[OBSERVED]` Safe by construction: `worldPointInto()` (`:875-887`) reads only `.x`,
`.y` via `finite()` plus an optional `normalized` flag, so this shape is already a
valid anchor. **Additive** — every one of the 33 existing events returns at step
(1)–(4) before reaching it, so no current cue changes position.

### PR-2 — commander fallback covers the buff family `[TARGET]`

Ratified as v2 R9(b). Add three cases to the switch arm at `:1148-1156`:
`BUFF_APPLIED`, `BUFF_REFRESHED`, `BUFF_EXPIRED` →
`snapshot?.commander ?? snapshot?.player ?? null`. No payload change; the buffs are
commander-owned.

### PR-3 — `worldPointInto()` normalized opt-out `[TARGET]`

Ratified as v2 R9(c). `[OBSERVED]` `:878` reads
`entity?.normalized === true || (Math.abs(x) <= 1 && Math.abs(y) <= 1)`, so an
explicit `normalized: false` does not force the raw path. Change to:

```js
entity?.normalized === true || (entity?.normalized !== false && Math.abs(x) <= 1 && Math.abs(y) <= 1)
```

Implementation must first prove no existing caller passes `normalized: false`. PR-1 is
the first producer of that flag.

`[TARGET]` **PR-3 is defence-in-depth, not a live bug for this spec's payloads.** All
four deformation anchors and every slab rect sit far inside the arena interior
(§7.2 verifies `|x| > 1 ∧ |y| > 1` for all four), so no shipping cue can hit the
`(0,0)` misread today. Land PR-3 anyway — a future authored `(0, y)` would silently
teleport to arena centre.

### PR-4 — grade-and-class-aware pool exemption `[TARGET]`

`[OBSERVED]` `CRITICAL_VFX_EVENT_TYPES` is a flat array of **event types**, tested
with `.includes(candidate.eventType)` in `trackVfxInstance()` (`:4006-4017`) and
`.includes(event?.type)` in `spawnVfx()` (`:4025`). It **cannot** express "exempt
`ENEMY_SPAWNED` only when `grade === 'SHADOW'`". Adding `ENEMY_SPAWNED` wholesale
would make every BASIC arrival un-evictable and starve the pool.

Replace the two membership tests with one helper, keeping the array as the type-level
source of truth:

```js
function isCriticalVfxEvent(eventOrRecord) {
  const type = eventOrRecord?.type ?? eventOrRecord?.eventType;
  if (CRITICAL_VFX_EVENT_TYPES.includes(type)) return true;
  if (type === "ENEMY_SPAWNED") return eventOrRecord?.grade === "SHADOW";
  if (type === "GIMMICK_ARMED" || type === "GIMMICK_TRIGGERED") {
    const cls = eventOrRecord?.gimmickClass;
    return cls === "deformation" || cls === "hazard";
  }
  return false;
}
```

`trackVfxInstance` must therefore persist `grade` and `gimmickClass` onto the vfx
record alongside the existing `eventType`. **Additive**: for all 33 existing types the
helper is exactly the old `includes` test.

`"hazard"` is included at `DungeonLevelDesign`'s request — the enforcement argument is
identical to deformation. See §7.6 for the scope boundary that follows.

### PR-5 — new type entries `[TARGET]`

`CRITICAL_VFX_EVENT_TYPES` gains **no new literals**. `BOSS_SPAWNED` is already
present (`:408`); SHADOW arrival and deformation/hazard telegraph+contact are exempted
by the PR-4 predicate. **That is the required `CRITICAL_VFX_EVENT_TYPES` addition:
none to the array, one predicate extension.** Nothing else in the family is exempt.

---

## 4. Readability budget at the observed default camera

`[OBSERVED]` inputs: `PerspectiveCamera(35, 1, 0.05, 50)` (`:2154`),
`ORBIT_ZOOM_DEFAULT = 20.8` (`:78`), `MAX_ORBIT_DISTANCE = ORBIT_ZOOM_DEFAULT * 2 =
41.6` (`:82`), `MIN_ORBIT_DISTANCE = 10.4` (`:81`), base pitch 55° (`:2321`),
`WORLD_SCALE = 14` (`:45`), arena 24000 × 12000 with gate `(22000, 6000)`
(`defense-catalog.js:12`). `instantiateVfxModel()` applies `fitHeight(instance, 1.2)`
then `instance.position.y = 0.6` (`:2082-2094`).

`[TARGET]` derived frustum cross-section — the readability basis for every silhouette:

| Quantity | Value |
|---|---|
| Visible height at D=20.8 | `2 × 20.8 × tan(17.5°)` = **13.116** world units |
| Visible width at 16:9 | **23.318** world units |
| Gameplay units per world unit (X) | `(24000/2) / 14` = **857.1** |
| Visible frame in gameplay units | **19 987 × 11 243** |
| Visible height at max zoom 41.6 | **26.233** world units |

Screen share, and pixels at a 1440×900 viewport `[TARGET]`:

| Silhouette | World height | % of frame height | px @900 (D=20.8) | px @900 (D=41.6) |
|---|---|---|---|---|
| Default VFX `fitHeight` 1.2 | 1.2 | 9.1 % | **82** | 41 |
| Pickup prop `TARGET_HEIGHT.pickup` | 0.7 | 5.3 % | **48** | 24 |
| Enemy `TARGET_HEIGHT.enemy` | 1.7 | 13.0 % | 117 | 58 |
| Boss `TARGET_HEIGHT.boss` | 4.5 | 34.3 % | 309 | 154 |

`[TARGET]` **Readability floor: 44 px at 900 px viewport height**, borrowed from the
G4 touch-target contract so one number governs both. That is **0.641** world units at
D=20.8 and **1.282** world units at D=41.6.

Two consequences that drive the designs below:

1. The default `fitHeight` 1.2 is **1.87×** the floor at default zoom but **41 px —
   below the floor** at max zoom. Any cue that must stay findable while the player
   zooms out cannot rely on the 1.2 default.
2. The pickup prop is only **48 px** at default zoom, 4 px above the floor, and
   **24 px** at max zoom. `[INFERENCE]` A dropped item is effectively invisible at
   range on its own mesh — which is why the idle beacon in §5.2 is a hard requirement
   rather than polish, and why it is authored at 1.35 world units (46 px at max zoom,
   clearing the floor at every zoom tier).

`[INFERENCE]` The frustum cross-section is perpendicular to the view axis; because the
ground plane sits at 55° to it, the visible *ground* footprint along the view
direction is larger by ≈ `1/sin(55°)` = 1.22× (≈ 16.0 world units ≈ 13 715 gameplay
units). The perpendicular figure is used throughout as the conservative bound.

### 4.1 Colour hierarchy

`[OBSERVED]` per-stage accent, agreeing across two independent sources —
`stage-world-catalog.js` `presentation.palette.accent` and the renderer's
`STAGE_PALETTE_TINTS`:

| Stage | Accent | Authored VFX core / accent `[OBSERVED]` (`assets/motion/stage-vfx/manifest.json`) |
|---|---|---|
| `cinder-span` | `#f3592c` | `#FFBB66` / `#F23A20` |
| `abyss-chancel` | `#8f67ff` | `#74E4FF` / `#008BC2` |
| `echo-throne` | `#72c8ff` | `#C7A6FF` / `#6B36C9` |

`[TARGET]` **Grade palette — defined here, not inherited.** The first draft read this
from `CORPSE_GRADE_COLORS`; per defect D-A that constant does not exist at `033877ad`.
This spec therefore defines it as new construction, choosing the same three hues the
concurrent tree independently arrived at so the two converge if that work ever lands:

```js
const ARRIVAL_GRADE_COLORS = Object.freeze({
  BASIC:  new THREE.Color(0x66f0bd),   // mint
  SHADOW: new THREE.Color(0xa06bff),   // violet
  BOSS:   new THREE.Color(0xffa43a),   // amber
});
```

`[TARGET]` **Three-channel rule.** Every new cue carries exactly three colour roles:

| Channel | Source | Job |
|---|---|---|
| **Identity** | stage accent (`#f3592c` / `#8f67ff` / `#72c8ff`) | "which world am I in" — the constant |
| **Classifier** | drop → rarity tier; arrival → `ARRIVAL_GRADE_COLORS[grade]`; deformation → fixed hazard amber `#ffa43a` | "what kind of thing is this" |
| **Shadow** | stage `palette.shadow` from the VFX manifest | contrast floor so the cue reads against a lit floor |

`[TARGET]` rarity tier ramp for the classifier channel, chosen to stay separable at
48 px and to avoid collision with the grade palette:

| `rarity` | Colour | Separation note |
|---|---|---|
| `common` | `#9fb4c8` desaturated slate | reads as "ignorable" |
| `rare` | `#5de6ff` cyan | reuses the existing quest-telegraph cyan (`QUEST_VFX_PRESENTATIONS`, `:425`) |
| `resonant` | `#c07bff` orchid | deliberately ≠ SHADOW `#a06bff`, +2 steps of hue |
| `relic` | `#ffd257` gold | deliberately ≠ BOSS `#ffa43a`, +12° hue, higher value |

`[TARGET]` **Identity never competes with classifier.** Stage accent is applied to the
`vfx-decor` group only; the classifier owns `vfx-core`. A rarity or grade read must
never require the player to know the stage.

---

## 5. Item drop cue family

`[TARGET]` Four cues plus one pool-free persistent marker, split along the
`create-game-vfx` axes: **telegraph** (none — a drop is not anticipated), **contact**
(`DROP_SPAWNED`), **success** (`ITEM_COLLECTED`), **lingering status** (idle beacon,
`BUFF_APPLIED`/`REFRESHED`), **failure** (`DROP_EXPIRED`, `DROP_DENIED`).

GLB for the whole family: **`drop-beacon-pillar.glb`** (§9).

### 5.1 `drop-appear` — contact

| Field | Value |
|---|---|
| Trigger | `DROP_SPAWNED` `[TARGET]` |
| Owner | `DropBuffSystem` emits; renderer presents |
| Duration | **14 ticks** (0.233 s) `[TARGET]` |
| Anchor | top-level `x, y` via **PR-1** |
| Gameplay meaning | "an item now exists at this point, and it is worth this much" |
| Silhouette @20.8 | vertical **flare-and-collapse**: a 1.2-world-unit spike that opens to a 0.55-radius ground ring in 6 ticks then collapses in 8. 82 px at peak — 1.87× the floor. Vertical-dominant on purpose: at 55° pitch a vertical form cannot be confused with floor texture. |
| Colour | core = rarity ramp (§4.1); decor ring = stage accent; shadow = stage `palette.shadow` |
| Spawn cap | **3 concurrent** `[TARGET]`, = the `drop` family budget (§8.2). `MAX_FIELD_DROPS = 8` means up to 8 can arrive in one tick; the rest are suppressed at source because their beacons (§5.2) already mark them. |
| Cleanup | pooled transient; `retireVfxRecord()` (`:3995-4004`) stops the mixer and `disposeObject3D`s the root. Idempotent — safe under reset, death and pause. |
| Reduced motion | `applyTransientVfxPolicy` (`:1803-1807`) `[OBSERVED]` calls `action.stop()`, freezing frame 1. `[TARGET]` Author frame 1 as the **fully-open ring at full opacity** so the stopped pose is the readable state. Hard authoring constraint on every new GLB (§9.1). |

### 5.2 `drop-idle-beacon` — lingering, **pool-free**

The load-bearing cue of this family. A 24000 × 12000 arena against a 19 987 × 11 243
visible frame means a drop can sit off-frame, and at 48 px (24 px zoomed out) the
pickup prop cannot be found by looking `[TARGET]` (§4).

**How it avoids consuming the transient pool.** It never enters it. `spawnVfx()` is
the only path that pushes into `vfxInstances[]`, and the beacon is not spawned through
`spawnVfx()` at all — it is snapshot-derived scenery with its own bounded map, its own
group, and its own retirement, all outside `MAX_VISUAL_EFFECTS`.

`[OBSERVED]` **Per defect D-A there is no existing decal system to attach to at
`033877ad`** — `groundDecalGroup`, `corpseGroup`, `corpseMarkers`,
`MAX_CORPSE_MARKERS`, `GROUND_DECAL_LIFT` and `RANGE_RING_*` all return zero matches.
This surface is therefore **new construction, specified standalone**:

```js
// New. Persistent presentation scenery, deliberately OUTSIDE the 24-slot transient
// VFX pool: MAX_VISUAL_EFFECTS is a performance contract and must not be spent on a
// marker that lives as long as its drop does.
const DROP_BEACON_GROUND_LIFT = 0.03;   // avoids z-fighting with the floor
const MAX_DROP_BEACONS = 8;             // == MAX_FIELD_DROPS; cannot grow with waves
const DROP_BEACON_HEIGHT = 1.35;        // 92 px @20.8, 46 px @41.6 -- clears the floor
const DROP_BEACON_WARN_TICKS = 180;     // shared with HUD + audio
```

`[TARGET]` Specification:

| Field | Value |
|---|---|
| Trigger | **no event.** Derived every tick from `snapshot.pickups[]` filtered `kind === "buff"` — `DropBuffSystem`'s contract puts field drops in the existing pickups array under that kind, and adds no new array |
| Host | `this.dropBeacons = new Map()` keyed by `pickup.id`, inside a new `this.dropDecalGroup` (`THREE.Group`, name `"drop-decals"`) added directly to `this.scene`. `[TARGET]` **The name is deliberately distinct from the concurrent session's `groundDecalGroup`** (ruling v4 R23): if that 676-line diff ever merges, a different identifier makes the collision a **visible merge conflict** rather than a silent overwrite of one system by the other. |
| Sync point | inside `reconcileActors()` (`:3525`), in the existing pickups loop (`:3553-3558`) which already iterates `list(snapshot, "pickups", "drops")` and has each `pickup` in hand |
| Lifecycle | created on first sight of the id; positioned from `worldPoint(pickup)` (`:889-891`) + `DROP_BEACON_GROUND_LIFT`; retired the tick the id leaves `snapshot.pickups` — so collection **and** expiry are both covered with no event needed |
| Cap | `MAX_DROP_BEACONS = 8`, equal to the peer `MAX_FIELD_DROPS`, so the bound cannot grow with wave count |
| Pool slots consumed | **0.** Never passed to `spawnVfx()`, never pushed to `vfxInstances[]`, never counted by `trackVfxInstance()` |
| Silhouette @20.8 | **1.35 world units** (92 px @20.8, **46 px @41.6** — clears the 44 px floor at every zoom tier, unlike the 1.2 default). Thin vertical light-shaft, 0.06 radius, over a 0.30-radius ground tick. Height, not area: a shaft survives being behind an enemy silhouette; a floor disc does not. |
| Colour | shaft = rarity ramp; ground tick = stage accent at **0.28** opacity `[TARGET]` |
| Motion | 0.5 Hz vertical opacity travel on the shaft only. No rotation, no scale pulse — that is transient vocabulary and must stay distinct from scenery. |
| Pre-expiry read | `[TARGET]` derived presentation-side from `pickup.expiresAtTick - snapshot.tick`, mirroring the ruling that pre-expiry warnings are derived and get no event (v2 R10b). Under `DROP_BEACON_WARN_TICKS = 180` — the same value `DropBuffSystem` credits as presentation-only, so HUD, audio and VFX warn on the same tick — raise travel to 2 Hz and drop ground-tick opacity to 0.14. **No new event, no new pool slot.** |
| Cleanup | `disposeObject3D(marker.group)` on retire; `dropBeacons.clear()` + group dispose on unmount. `retireActor()` (`:3374-3384`) is the pattern to mirror: delete from the map, remove from the group, dispose. |
| Reduced motion | hold the shaft at full opacity, travel stopped. **Never hidden** — it is the only way to find a drop, so it degrades to a static marker, never to nothing. Wire into `setReducedMotion()` (`:3658-3676`), which already re-applies policy to every live record on toggle. |

`[TARGET]` **Why not a stage cue?** `[OBSERVED]`
`tests/runtime-visual-assets.test.mjs:90` asserts
`profile.presentation.vfxCues.length === 1` per stage, and
`stage-world-catalog.js` validates every cue's `modelPath` and `clip` against the
`stage-vfx::<stageId>::loop::v01` form. A beacon cannot be a stage cue without
breaking both. The standalone group is the only correct host.

### 5.3 `pickup-success` — success

| Field | Value |
|---|---|
| Trigger | `ITEM_COLLECTED` — **existing**, mapped to `cinder-span-ember-wake.glb` (`:306`) with lifetime 24 (`:386`) `[OBSERVED]` |
| Change | **none to the mapping.** This spec does not retune an existing cue. |
| Anchor | `[OBSERVED]` `event.entityId` is the *collector* (`defense-run-simulation.js:1805-1808`: commander or companion), so the cue plays **on the collector, not at the drop site**. Correct for a success read — reward attaches to the actor — and the drop site is simultaneously vacated by the beacon disappearing (§5.2). |
| Spawn cap | **3 concurrent** `[TARGET]`, matching the peer's worst case of 3 items collected in one `collectPickups` (`:1762`) pass |
| Reduced motion | inherited, unchanged |

### 5.4 `drop-expire` — failure

| Field | Value |
|---|---|
| Trigger | `DROP_EXPIRED` `[TARGET]` |
| Duration | **16 ticks** `[TARGET]` |
| Anchor | top-level `x, y` via PR-1 |
| Meaning | "that value is gone — you were too slow" |
| Silhouette @20.8 | inverse of `drop-appear`: ring **contracts** inward to a point over 16 ticks, no vertical spike. Direction of motion is the whole read; appear opens, expire closes. |
| Colour | `[OBSERVED]` the ruled payload is `{ dropId, itemId, x, y }` with **no `rarity`**. Resolve the tier from `itemId` against `BUFF_ITEMS`; if unresolved, fall back to `common` slate. Never guess a high tier. |
| Spawn cap | **2 concurrent** `[TARGET]`. Up to 8 drops can TTL out together; the beacon vanishing is the primary read, so the burst is coalesced to 2 (§8.5 shows this is load-bearing for the budget). |
| Reduced motion | frame 1 = fully-open ring; stopped pose still marks the site |

### 5.5 `drop-denied` — failure, suppressed

| Field | Value |
|---|---|
| Trigger | `DROP_DENIED`, `reason === "FIELD_CAP"` — **the only value** `[TARGET]` |
| Duration | **12 ticks** `[TARGET]` |
| Meaning | "a roll happened and was thrown away because the field is full" |
| Cue | `[TARGET]` a **single** low ground tick at 0.18 opacity, no vertical element, no core colour. `[OBSERVED]` `DropBuffSystem` **withdrew** the second reason value `"MEASUREMENT_PROFILE"`: a measurement-profile run emits nothing at all, so the value was unreachable and emitting it would have broken G2 fixture isolation. This cue therefore branches on nothing. |
| Spawn cap | **1 concurrent** `[TARGET]` |
| Rationale | deliberately the quietest cue in the spec. It communicates a *system* limit, not a player outcome; making it loud would train the player to chase a non-reward. |

### 5.6 Buff lingering visuals

`[TARGET]` The **persistent** "this buff is active" read is the HUD buff strip, owned
by the UI lane — **zero world VFX, zero pool slots**. This spec provides only the
world-space *transition* flashes, all commander-anchored via PR-2:

| Trigger | Duration | Cue | Cap |
|---|---|---|---|
| `BUFF_APPLIED` | **20 ticks** | upward sweep at the commander; core = the `stat` glyph colour the UI lane owns (7-value enum, v3 R17), decor = stage accent | 2 |
| `BUFF_REFRESHED` | **12 ticks** | single ring re-strike, no sweep — visibly *less* than a fresh apply so refresh ≠ new | 2 |
| `BUFF_EXPIRED` | **24 ticks** | downward settle. **`reason === "TIMEOUT"` only.** `"EVICTED"`, `"STAGE_TRANSITION"`, `"DEATH"` emit **no cue** — matching the ratified audio policy (v2 R10a) so the two lanes agree, and preventing a 6-cue flush when `MAX_ACTIVE_BUFFS = 6` clears at a stage change | 1 |

`[OBSERVED]` **`reason` is the most dangerous pre-existing field name in this spec, and
both cues above key on it.** `git show 033877ad:defense-run-simulation.js | grep -n "reason:"`
shows it already carrying **four incompatible vocabularies** across six emits:
lowercase geometry (`:1740` `"bounds"` / `"range"`), SCREAMING_SNAKE reward codes
(`:2018` `"REWARD_ALREADY_OWNED"`, `:2044` `"M4_CARD_INVENTORY_EXHAUSTED"` /
`"M4_CARD_DECISION_INVALID"`), a pass-through (`:2082` `run.m4.fallbackReason`), and a
nullable rejection string (`:2195`, `:2204` — `accepted ? null : rejectionReason`).
`DropBuffSystem` surfaced this; ruling v10 rates it **worse than `telegraphTicks`**.

`[TARGET]` **Why it is worse: it fails silently.** The value sets happen not to overlap
today, so a `reason`-keyed table simply does not match and the cue quietly does not
fire — no exception, no wrong-looking visual, nothing in a test that is not asserting
that specific cue. `telegraphTicks` at least fails loudly by flooding the pool.

**Both branches above are therefore gated on `event.type` first, never on `reason`
alone:**

```js
// RIGHT -- type decides which vocabulary `reason` is drawn from
if (event.type === "DROP_DENIED"  && event.reason === "FIELD_CAP") { … }
if (event.type === "BUFF_EXPIRED" && event.reason === "TIMEOUT")   { … }

// WRONG -- a reason-keyed lookup spanning families. Four vocabularies, no overlap today,
// silent miss tomorrow.
const cue = CUE_BY_REASON[event.reason];
```

`[TARGET]` The same prohibition covers **presence**-keyed dispatch, not just value-keyed:
`UiOverhaulConcept` found that `ENCOUNTER_PATH_CONTESTED` also carries `objectiveId`, so
a presence-keyed gimmick chip would render a **complete, plausible-looking** chip — real
label, real lifetime — for a route contest with no gimmick at all. A defect that looks
correct survives review. Use an explicit allow-set checked before any field read
(`GIMMICK_EVENTS.has(event.type)`), and **never build a shared cross-family telegraph
reader**.

---

## 6. Enemy arrival cue family

GLB: **`arrival-breach-gate.glb`** (§9). One asset, three grades, three stages — grade
drives scale and classifier colour, stage drives decor accent.

`[TARGET]` **The reaction window is the event's own field — read it, never hardcode.**
`ENEMY_SPAWNED` carries `telegraphTicks`, so the cue lifetime is
`Number.isInteger(event.telegraphTicks) ? event.telegraphTicks : <grade fallback>`. This
mirrors the existing precedent for `BOSS_ATTACK_TELEGRAPHED`, which already prefers
`event.windupTicks` over the table `[OBSERVED]` (inside `spawnVfx`). See §7.4.1 — the
registry integer is a **fallback and clamp**, never the value.

`EncounterPacing` owns the values and has frozen them `[TARGET]`: **BASIC 30**,
**SHADOW 60**, **BOSS 90** (already the shipped `BOSS_SPAWNED` lifetime, unchanged).

Their grounding — **re-derived in ruling v6 C1 from shipped constants only, after the
original rationale was found to cite an unshipped document.** This spec previously
justified 30 as "one full dash cycle (18 ticks — startup 2 / iframe 10 / recovery 6)
plus margin, so a player can always dash out". `[OBSERVED]` **There is no dash.**
`git show 033877ad:defense-catalog.js` `COMMANDER` contains exactly `radius: 360`,
`speed: 4100`, `basicCooldown: 24`, `basicDamage: 900`, `basicRange: 6000`,
`maxIntegrity`, `integrity`, `critProfile`; a blob grep of `defense-catalog.js` and
`defense-run-simulation.js` for `DASH`, `dash`, `iframe`, `invuln`, `startup`,
`LIGHT_1`, `HEAVY` returns **0 occurrences each**. The 18-tick figure came from
`master-numeric-contract.md` — an unshipped design target, the same category R27
fenced off.

Re-grounded on `speed: 4100` over a 60 Hz tick = **68.33 units/tick**:

| Tier | Ticks | Seconds | Units travelled | Body radii (`radius: 360`) | Attack cooldowns (`basicCooldown: 24`) |
|---|---|---|---|---|---|
| BASIC | 30 | 0.50 | 2 050 | **5.7** | **1.25** |
| SHADOW | 60 | 1.00 | 4 100 | 11.4 | 2.50 |
| BOSS | 90 | 1.50 | 6 150 | 17.1 | 3.75 |

The contract is therefore: **30 ticks ≥ one full attack cooldown plus margin, and ≥ 5
body radii of repositioning at shipped commander speed.** No dash required — which is
the point, because none exists. The values survive re-grounding unchanged. **These
lifetimes are a gameplay contract, not a visual preference.**

### 6.1 Per grade

| | **BASIC** | **SHADOW** (elite / midboss) | **BOSS** |
|---|---|---|---|
| Trigger | `ENEMY_SPAWNED`, `grade: "BASIC"` | `ENEMY_SPAWNED`, `grade: "SHADOW"` | `BOSS_SPAWNED` (existing) |
| Lifetime | **30** fallback; value is `event.telegraphTicks` `[TARGET]` | **60** fallback; value is `event.telegraphTicks` `[TARGET]` | 90 `[OBSERVED]`, unchanged |
| Pool-exempt | no | **YES**, via PR-4 predicate on `grade` | **YES** already (`:408`) `[OBSERVED]` |
| Silhouette @20.8 | 0.9 world units (62 px), low wide **ground seam** oriented along `spawnDirection` | 1.6 world units (110 px), a **vertical gate** — two uprights + lintel, opening over the window | unchanged; the 4.5-unit boss mesh (309 px) is its own telegraph |
| Classifier colour | `#66f0bd` mint (`ARRIVAL_GRADE_COLORS.BASIC`) | `#a06bff` violet | `#ffa43a` amber |
| Spawn cap | **4 concurrent** `[TARGET]` — the whole `spawn` budget | shares the same 4 | 1 (natural — one boss) |
| Reduced motion | frame 1 = seam fully open | frame 1 = gate fully open, lintel lit | unchanged |

`[INFERENCE]` One colour per grade across its whole lifecycle — arrival and death — is
cheaper to learn than two, which is why §4.1 picks the same hues the concurrent tree's
corpse markers use.

### 6.2 Per stage

`[TARGET]` Grade owns the form; stage owns only the decor accent and the seam motif, so
a player never re-learns arrival grammar between stages:

| Stage | Decor accent | Seam motif |
|---|---|---|
| `cinder-span` | `#f3592c` | ash blown outward along `spawnDirection`, from the authored motif "embers moving through ash" `[OBSERVED]` |
| `abyss-chancel` | `#8f67ff` | paired oath rings, from "oath rings and violet static" `[OBSERVED]` |
| `echo-throne` | `#72c8ff` | fracture lines radiating once, from "echo fractures and cold blue glass" `[OBSERVED]` |

### 6.3 Concurrency — the confirmed ceiling is 4, once per run

`[OBSERVED]` `EncounterPacing` derived this from the admission code, and it is far
below what this spec's first draft assumed. Routed admission is hard-throttled to
**one body per call**: `processEncounterSpawns()` reads only `spawnQueue[0]`, shifts
exactly one, spawns it, then sets `nextSpawnAt = run.tick + spawnIntervalTicks`, and it
is called once per tick. Routed arrivals are therefore 1 per **18 / 24 / 15** ticks for
`cinder-span` / `abyss-chancel` / `echo-throne` (`defense-catalog.js:475 / 516 / 559`)
— a stream, never a burst. `maxConcurrentEnemies` is 8 / 9 / 10 (`:474 / 515 / 558`).

Three off-queue paths stack on top `[OBSERVED]`:

1. **midboss** — spawned off-queue on the wave beat by `enqueueEncounterWave`, 1 body, SHADOW. The code comment states queuing it would hide the cue.
2. **elite arrival** — `!run.eliteSpawned && gateDefense.completed` → 1 elite.
3. **escorts** — `escortCount = depthPkg?.eliteEscorts ?? 1`, maximum **2** at abyss depth 3 (`defense-catalog.js:302`; depths 1–2 give 1, `:300-301`).

**Worst tick = 4** — 1 routed + 1 elite + 2 escorts, because the routed drain runs
earlier in the same tick than the elite gate. It occurs **exactly once per run**.

`[OBSERVED]` The midboss cannot collide with the elite burst: the last wave beat is
`(waveCount-1) × floor(defenseTicks/waveCount)` = 9 × 1020 = 9180 for `cinder-span`,
while gate-defense completes at `run.tick >= stage.gateTicks` = 10200 — **1020 ticks
apart**. The mid-wave worst tick is therefore only 1 midboss + 1 routed = **2**.

### 6.4 Two assumptions this spec had wrong, and the rule deleted with them

Recorded rather than quietly overwritten, because both changed the design.

1. **The director-blessed default of "10 BASIC + 1 SHADOW in one tick" is unreachable
   — the real ceiling is 4.** The pessimistic default was ~3× too high.
2. **Cycle 9's "legion 3→10" is the *player's companion* cap, not an enemy spawn
   cap.** It never belonged in this arithmetic; the first draft cited it as the driver
   of a batch that cannot occur.

Consequence: **rule B2 (same-tick coalescing by `spawnDirection`) is deleted.** It
existed solely to bound a 10-wide BASIC batch at 4 cues per tick. The simulation
already bounds the whole family at 4 per tick, of which at most 3 are BASIC, so the
rule now guards nothing. `[INFERENCE]` Keeping a coalescing rule whose premise is known
false would make the spec look better defended than it is, and would suppress a cue the
player should see — three separate escort arrivals are three separate threats.

`spawnDirection` (`defense-run-simulation.js:743-753`) `[OBSERVED]` is still used — as
the seam's **orientation** input (§6.2), not as a coalescing key.

### 6.5 Why a telegraph is safe here

`[OBSERVED]` The current code cannot spawn an enemy before its cue: `ENEMY_SPAWNED` is
emitted inside `spawnEnemy()` at `:743`, *after* `run.enemies.push(enemy)` at `:742`,
so the enemy is already live and already in the snapshot when the cue fires. The cue is
an **arrival marker, not a pre-spawn warning** — it plays on top of an existing entity,
which is also why `enemyId` resolves through chain (2) of `effectAnchor` with no
position field needed.

`[TARGET]` **Do not spec or implement a pre-spawn ghost — there is no event before the
body.** If `EncounterPacing` ever wants a true pre-spawn warning it must emit before
the push, a simulation change this spec neither requests nor depends on. Either way the
cue lifetime equals `telegraphTicks`, so the reaction window the pacing spec asks for
is what the player sees.

---

## 7. Terrain deformation cue — presentation only

`[OBSERVED]` **Hard rule, `author-game-levels`:** all gameplay stays on one flat plane
at elevation 0 — no stairs, ramps, pits, or vertical traversal. The renderer is the
wrong place to break it anyway: presentation may read simulation snapshots but must
never write back (CLAUDE.md §2), and every stage NPC/prop placement is validated at
`elevation !== 0` in `stage-world-catalog.js`.

GLB: **`deform-fracture-seam.glb`** (§9). Four phases, one asset.

### 7.1 What changes and what is fixed

| Changes `[TARGET]` | Stays fixed `[OBSERVED]` |
|---|---|
| A seam decal appears along the new corridor edge, in the deformation group | The ground mesh. `instantiateProceduralTerrain()` / `instantiateTerrainModel()` are not re-run, no geometry regenerated, no vertex moved |
| Edge material darkens toward stage `palette.shadow` outside the seam | Terrain **elevation stays 0** everywhere. No `y` displacement, no morph target, no vertex-shader offset |
| Dust/ember motes fall along the seam for 45 ticks, then stop | **Collision and pathing untouched.** The renderer has no collision to change; enemy routes are simulation-owned (`enemy.route`, `spawnRoute()`) |
| Beyond-seam floor loses its decor group so it reads "not for you" | `snapshot` is read-only. No write-back, no `getRunDigest()` (`:3555`) input touched |
| Seam persists as scenery until `GIMMICK_RESOLVED` | Camera pitch/zoom envelope. No new clamp |
| — | The authored `corridorWidth` in the catalog stays at the **before** value, so `validateProfile` keeps passing |

### 7.2 The four deformation gimmicks — frozen contract

`[OBSERVED]` `DungeonLevelDesign` froze 13 gimmicks across 4 classes. **Four** are
`gimmickClass: "deformation"` and are this cue's entire job. All carry integer `x, y` +
`slabId` + `objectiveId` + `gimmickClass` per v2 R5/R8.

`[TARGET]` Seam intensity per §7.3 device 4, from the frozen widths with
`intensity = clamp(((before - after) / before) × 2.8, 0.25, 1.0)`. The gain puts the
largest real loss (500 of 1400) at exactly full intensity; without it every shipping
gimmick would sit in the bottom third of the range and read identically.

`[OBSERVED]` **These widths are `DungeonLevelDesign`'s corrected set and they supersede
the ones this spec first recorded.** The original targets (1200→700, 1200→800,
1000→700, 1100→700) were withdrawn for a reason that changes the cue's meaning:
`COMMANDER.radius = 360` in `git show 033877ad:defense-catalog.js`, so the commander's
**diameter is 720** — a 700-wide band is *narrower than the actor*, and the validator's
own 600 floor is narrower still. The published "narrowing" was therefore not a skill
check but guaranteed chip damage with no damage-free line; the validator would have
passed it and the player could not. Corrected floor: every `corridorWidthAfter` **≥ 900**,
i.e. `> 720` with ≥ 90 units of clearance per side. Re-validated against the real
`validateProfile` (VALIDATOR PASS v4). `[OBSERVED]` Tightest authoring margins, as
corrected in ruling v10: cinder **+49.86** (not the +133.57 first published, which
measured the critical route only, before the detour widened), chancel +301.24, throne
+200.00. Cinder's is a hard geometric limit rather than slack — `collapsed-parapet-prop`
is frozen by test at `(13200, 9300) r900`, leaving 1000 units for a 900-wide corridor, so
the legal window is 100 units split 50/50. `DungeonLevelDesign` swept 597 configurations
and spent it on 90 units of *player* clearance instead of authoring margin.

| Gimmick id | Slab | `x, y` | Width before → after | Lost | Clearance/side | Ratio | **Intensity** |
|---|---|---|---|---|---|---|---|
| `cinder-span:gimmick-ash-causeway-collapse` | `slab-02` | 11400, 5400 | 1400 → **900** | 500 | 90 | 0.3571 | **1.000** |
| `cinder-span:gimmick-warden-chain-fall` | `slab-03` | 19700, 6200 | 1400 → **1000** | 400 | 140 | 0.2857 | **0.800** |
| `abyss-chancel:gimmick-classification-craze` | `slab-03` | 20600, 6000 | 1400 → **900** | 500 | 90 | 0.3571 | **1.000** |
| `echo-throne:gimmick-sovereign-command-shear` | `slab-05` | 20800, 6000 | 1400 → **900** | 500 | 90 | 0.3571 | **1.000** |

`[TARGET]` Only **two** distinct deltas now exist (500 and 400), so only two distinct
intensities do. That is correct, not a loss of fidelity: equal width loss must read as
equal. The cue also gains headroom — a 500-unit delta on a 1400 corridor is a wider
visual change than the same delta on 1200 was.

`[TARGET]` Cross-checked against the frozen slab rects — every anchor is **inside its
declared slab**, inside the arena interior, every `corridorWidthAfter` ≥ 900 **and
> commander diameter 720**, and every anchor clears the `|x| ≤ 1 ∧ |y| ≤ 1`
normalized-coordinate trap (§PR-3):

| Gimmick | Slab rect (`minX..maxX × minY..maxY`) | Inside slab | Clears normalized trap | After > 720 | Ticks to clear |
|---|---|---|---|---|---|
| ash-causeway-collapse | 8600..17000 × 800..11200 | ✅ | ✅ | ✅ 900 | 4 |
| warden-chain-fall | 17000..23400 × 800..11200 | ✅ | ✅ | ✅ 1000 | 3 |
| classification-craze | 16400..23400 × 700..7200 | ✅ | ✅ | ✅ 900 | 4 |
| sovereign-command-shear | 16600..23400 × 600..11400 | ✅ | ✅ | ✅ 900 | 4 |

"Ticks to clear" is walking time at the shipped `speed: 4100` (68.33 u/tick) to vacate
half the delta — the actual reaction requirement the telegraph must cover.

`[OBSERVED]` Max deformation **triggers per run**: `cinder-span` 3 (causeway once,
chain-fall across 2 boss phases), `abyss-chancel` 2, `echo-throne` 2.

`[OBSERVED]` **Determinism.** Arming is driven by tick and objective state, **not
RNG**. Where an anchor choice is needed the draw comes from the derived stream
`run.gimmickRng = rngNext(seed ^ 0xc2b2ae35)` — distinct from `dropRng`
(`0x85ebca6b`), `combatRng` (`0x9e3779b9`, in the run literal at
`defense-run-simulation.js:3217`, rehydrated at `:3446`) and the surprise roll
(`0x6d2b79f5`). `DungeonLevelDesign` moved this constant off `0x85ebca6b` after
discovering a collision with `dropRng`; two streams seeded identically would be
perfectly correlated, a determinism defect no test would have caught. **Presentation
consumes no RNG at all**, so this cue cannot move a digest byte.

### 7.3 How narrowed *walkable width* reads without moving the plane

`[TARGET]` The plane cannot move, so the cue carries 100 % of the readability. Four
devices, in priority order:

1. **A hard edge where there was none.** A 0.10-world-unit bright line (`#ffd257`) with
   a 0.04 dark core, laid exactly on the new `corridorWidthAfter` boundary.
   `[INFERENCE]` A high-contrast line on a flat floor is the strongest "do not cross"
   signal available without geometry.
2. **Asymmetric decor removal.** Inside the corridor keeps `vfx-decor`; outside loses
   it. The safe region stays visually *busier* than the lost region.
3. **Directional collapse motion during the 45-tick contact phase.** Motes travel from
   the old edge toward the new one, so the *direction* of the loss is animated once and
   then implied by the static seam.
4. **Width-proportional intensity.** Per the §7.2 table, computed from the payload's
   `corridorWidthBefore → corridorWidthAfter`, with no per-gimmick authoring.

`[OBSERVED]` **The narrowing is simulation-enforced**, as a hazard/steering band
**inside the already-authored corridor** — never new collision, never a moved plane.
Precedent for a hazard sitting on a live route: the `ash-surge` hazard at
`(14800, 6000)` r1100 already sits on `cinder-span`'s critical line
(`defense-catalog.js:353`). So the amber hazard form is correct.

`[TARGET]` **The cue never claims a collision it does not have.** The advisory branch
the first draft hedged on **does not apply to any shipping gimmick**. It is retained
only as a rule for future classes: an *unenforced* narrowing must drop to stage accent
at 0.22 opacity and must not use amber. `gimmickClass` remains the switch.

### 7.4 Four phases

`[OBSERVED]` `telegraphTicks = 180` for the four **deformation** gimmicks, and
`GIMMICK_TRIGGERED` fires at **exactly** `T + telegraphTicks` — the confirmed full
player reaction window. At 3.0 s the deformation telegraph is the longest-lived cue in
the game, longer than `ECHO_WARDEN_AWAKENING_TRIGGERED` (120). **Other gimmick classes
use shorter tiers — see §7.4.1. 180 is never hardcoded.**

| Phase | Trigger | Duration | Exempt | Silhouette @20.8 | Cap |
|---|---|---|---|---|---|
| **telegraph** | `GIMMICK_ARMED`, class `deformation` | **`event.telegraphTicks`** — 180 is the deformation tier and this spec's *fallback only*, never the value `[OBSERVED]` | **YES** (PR-4) | dashed pre-seam along the future edge, 0.06 units, 1 Hz pulse; 1.1-unit vertical marker at `x, y` (75 px) so the arming point is findable off-seam | **1** |
| **contact** | `GIMMICK_TRIGGERED`, class `deformation` | **45 ticks** `[TARGET]` | **YES** (PR-4) | dashes fuse into the solid seam; motes fall inward; one-shot | **1** |
| **lingering** | *persistent seam decal* — **pool-free** | until `GIMMICK_RESOLVED` | n/a | static seam, no motion | `MAX_DEFORMATION_SEAMS = 4` `[TARGET]` |
| **settle** | `GIMMICK_RESOLVED`, class `deformation` | **30 ticks** `[TARGET]` | no | seam fades out over 30 ticks; the persistent decal is retired | **1** |

`[OBSERVED]` **The phases can never co-occupy a pool slot.** Armed holds `[T, T+180)`,
triggered starts at exactly `T+180`, settle follows contact. For one gimmick the three
transients are strictly **sequential**, so the whole deformation family needs **one**
slot, not three. That is why the family budget in §8 is 1.

`[TARGET]` The lingering seam uses the **same pool-free mechanism as the drop beacon**
(§5.2) and is likewise new construction: `this.deformationSeams = new Map()` keyed by
`gimmickId`, inside a new `this.deformationSeamGroup` (`THREE.Group`, name
`"deformation-seams"`) added to `this.scene`, retired on `GIMMICK_RESOLVED` or unmount.
**Zero transient pool slots.** `MAX_DEFORMATION_SEAMS = 4` is a constant, so it cannot
grow with wave or gimmick count. Same distinct-naming rationale as §5.2's
`dropDecalGroup` — never reuse an identifier the concurrent session already owns.

### 7.4.1 `telegraphTicks` is per class — read the field, never hardcode

`[OBSERVED]` **Ruling v6 C2.** A single `GIMMICK_ARMED` lifetime of 180 is correct for
the 4 deformation gimmicks and **wrong for the other 9**. `telegraphTicks` has four
tiers, and a 60-tick cue running on a 180 constant **lingers 120 ticks past its own
`GIMMICK_TRIGGERED`** — telling the player a hazard is still arming after it already
fired, which is worse than a cue that is too short. `EncounterPacing`'s check asserts
`tick(TRIGGERED) − tick(ARMED) === telegraphTicks` exactly, so a hardcoded constant
fails it outright.

**Required form. The `event.type` dispatch is mandatory, not stylistic** — see the
collision warning below. This is the landed implementation
(`battle-realtime-three.js:514-527`), reproduced exactly rather than paraphrased,
because an earlier revision of this spec paraphrased it and lost two things:

```js
function telegraphLifetime(value, fallback) {
  // `> 0` as well as integer: a 0 or a float is a payload defect worth falling back on
  // rather than honouring. A bare Number.isInteger check would accept 0 and yield a
  // zero-tick cue that never renders.
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function resolveVfxLifetimeTicks(event) {
  const type = event?.type;
  const table = VFX_LIFETIME_TICKS[type] ?? 30;
  // PRE-EXISTING branch -- do not drop it. BOSS_ATTACK_TELEGRAPHED preferred its own
  // windupTicks before cycle 10 and is the precedent the two new branches follow.
  if (type === "BOSS_ATTACK_TELEGRAPHED") return Math.max(1, finite(event?.windupTicks, table));
  if (type === "ENEMY_SPAWNED") {
    const graded = event?.grade === "SHADOW" ? ENEMY_SPAWNED_SHADOW_LIFETIME_TICKS : table;
    return Math.max(1, telegraphLifetime(event?.telegraphTicks, graded));
  }
  if (type === "GIMMICK_ARMED") return Math.max(1, telegraphLifetime(event?.telegraphTicks, table));
  return table;                    // every other type ignores telegraphTicks entirely
}
```

`[OBSERVED]` **Two corrections this spec had to make to its own snippet**, both caught by
reading the landed code against ruling v10's audit:

1. The guard is `Number.isInteger(value) && value > 0`, not `Number.isInteger(value)` alone. A `telegraphTicks: 0` would otherwise be honoured as a zero-tick lifetime — a cue that spawns and retires in the same tick, i.e. invisible, which is the failure mode hardest to notice in review.
2. The `BOSS_ATTACK_TELEGRAPHED` / `windupTicks` branch is **pre-existing** and was missing from the paraphrase. An implementer copying the shorter version verbatim would have **deleted shipped behaviour** and regressed every boss telegraph to its table constant. This is why the spec now reproduces the function instead of describing it.

`[OBSERVED]` **`telegraphTicks` is NOT a cycle-10 field — it already exists at
`033877ad` on a different event, meaning something else.**
`git show 033877ad:defense-run-simulation.js | grep -n telegraphTicks` returns exactly
one hit, inside the `ENCOUNTER_PATH_CONTESTED` emit:

```js
const contestTicks = Math.max(1, waypoint.contestTicks || objective?.contestTicks || 60);  // :2284
emit(run, "ENCOUNTER_PATH_CONTESTED", {                                                     // :2290
  entityId: enemy.id, routeId: enemy.routeId, waypointId: waypoint.id,
  objectiveId: enemy.encounterObjectiveId, releaseAt: enemy.routeReleaseAt,
  telegraphTicks: contestTicks,                                                             // :2296
});
```

It means **how long a body must hold a contest waypoint** — a routing duration, not a
reaction window. Surfaced by `AudioFeedbackDesign`, blast radius quantified by
`EncounterPacing`, both re-verified here against the blob.

`[OBSERVED]` **The blast radius is pool exhaustion, not one wrong lifetime.**
`ENCOUNTER_PATH_CONTESTED` fires for **every routed body at every contest waypoint**,
and `EncounterPacing`'s doctrine puts **120 / 139 / 137** bodies through the three
stages. A type-agnostic reader would therefore mint one telegraph cue *per arriving
enemy*, at contest durations of 60–105 (objective) and 90–150 (finale waypoints), into a
**24-slot** pool — starving it of the arrival and gimmick cues it was sized for, using
lifetimes 2–5× longer than the drop cues they would evict.

`[TARGET]` The flood needs **two** things to be true at once: a type-agnostic read
**and** `ENCOUNTER_PATH_CONTESTED` present in `VFX_MODELS` (otherwise `spawnVfx()`
returns at `if (!relPath) return;` before any lifetime is resolved). Today neither
holds — but the guard is correct regardless, because each is one edit away from being
true and the second is exactly the kind of registry addition someone makes without
re-reading the lifetime helper.

`[OBSERVED]` **Audited in the live renderer, and it is clean:** `telegraphTicks` appears
at 10 places but only **2 are reads** — both inside the `ENEMY_SPAWNED` and
`GIMMICK_ARMED` branches of `resolveVfxLifetimeTicks`. The other 8 are comments. There
is no shared `effectLifetime(event)` helper, and `ENCOUNTER_PATH_CONTESTED` has **0
occurrences** in the file. The "10 sites" figure in the director's audit counts comments.

`[TARGET]` **One correction to the dispatch snippet circulated by `EncounterPacing`.**
Their version uses `90` as the `ENEMY_SPAWNED` fallback. That is the **BOSS** tier and
is wrong for this event: `BOSS_SPAWNED` is a separate type that already carries 90, so a
`telegraphTicks`-less BASIC arrival would linger **3× its window** and a SHADOW arrival
1.5×. The correct fallbacks are **30 for BASIC and 60 for SHADOW**, selected by `grade`
— which is what §6.1 specifies and what the landed
`ENEMY_SPAWNED_SHADOW_LIFETIME_TICKS = 60` implements. Their dispatch *order* is right
and is adopted; only that constant is not.

`[OBSERVED]` **A second, benign collision.** `recoveryTicks` also pre-exists —
`defense-run-simulation.js:1049` on `ENCOUNTER_RECOVERY_STARTED`, from
`objective.retry.recoveryTicks` (set at `:1031`). This spec consumes no `recoveryTicks`,
so it is out of scope here; recorded because both are integer tick spans, so a mis-read
degrades to a wrong-but-plausible duration rather than a visible flood — the harder
failure to notice. Match on type there too.

`[OBSERVED]` Genuinely new at `033877ad`, **0 occurrences** each: `grade`,
`gimmickClass`, `slabId`, `blockId`. Those four are safe to introduce.

The registry integer in §9.2 is the **fallback and clamp**, never the value.

| Tier | Ticks | Seconds | Repositioning at 68.33 u/tick | Classes |
|---|---|---|---|---|
| deformation | **180** | 3.0 | 12 300 u ≈ 34 body radii | the 4 deformation gimmicks |
| narrowing gate | **120** | 2.0 | 8 200 u ≈ 23 body radii | `transept-three-way-lock`, `crescent-gallery-shutters` |
| progress-ring / mirror | **90** | 1.5 | 6 150 u ≈ 17 body radii | `seal-oath-ring`, `oath-ring-shortcut`, `domain-command-ring`, `mirror-answer-aisle`, `returning-aisle` |
| hazard | **60** | 1.0 | 4 100 u ≈ 11 body radii | `forge-pressure-vents`, `dais-command-echo` |

`[OBSERVED]` **A tier-mapping conflict this spec flagged is now RESOLVED.** An earlier
revision recorded hazard at 90 and mirror at 60, from `DungeonLevelDesign`'s first
frozen table, while ruling v6 C2 assigned hazard 60 and mirror 90 — the two were
swapped. `DungeonLevelDesign` has adopted the v6 tiers verbatim and corrected their own
table: hazard 90 → **60**, the two mirror gimmicks 60 → **90**, the three progress rings
120 → **90**, the two genuinely narrowing gates stay **120**. The table above is the
resolved mapping. Their own published tier list had been wrong for 5 of 13 gimmicks,
which is the concrete reason the field must be read rather than a constant trusted.

`[TARGET]` **Reading the field made this conflict harmless.** Throughout the
disagreement the renderer would have been correct under either mapping, because the cue
takes its lifetime from `event.telegraphTicks`. Only the fallback constant differed, and
it is reached only when the emitter omits the field. That is the whole argument for
field-over-constant in one worked example.

### 7.5 Rule B1 is deleted — the constraint exists upstream

The first draft imposed "at most one deformation gimmick armed during the boss block"
to buy pool headroom. `[OBSERVED]` `DungeonLevelDesign` guarantees something strictly
stronger for the whole run: **max 2 gimmicks armed per stage, of which
`gimmickClass: "deformation"` is at most 1**, and **two gimmicks may never trigger in
the same tick** — ordering is an authored integer `order`, the lower fires at `T`, the
higher defers to `T+1`, no RNG. That is a hard **1-`GIMMICK_TRIGGERED`-per-tick
guarantee** at every point in the run, not just the boss block.

Rule B1 is therefore redundant and removed rather than restated. `[INFERENCE]` A
presentation-side rule duplicating a simulation guarantee is a second source of truth
that can silently drift out of agreement with the first.

### 7.6 Hazard class — exempt here, not designed here

`[OBSERVED]` `DungeonLevelDesign` asks that `gimmickClass: "hazard"` also be
pool-exempt — 2 gimmicks, `cinder-span:gimmick-forge-pressure-vents` (3 anchors) and
`echo-throne:gimmick-dais-command-echo`, both `telegraphTicks` **60** (corrected from 90
per §7.4.1). `gate` and `mirror` classes may be evicted. The enforcement argument is
identical to deformation, so **PR-4's predicate covers `"hazard"`** (§PR-4) — ratified
by ruling v4 R24.

`[TARGET]` **Hazard *visual* design is out of this spec's scope and is not authored
here.** `deform-fracture-seam.glb` must **not** be reused for a hazard cue — a
corridor-narrowing seam and a pressure vent are different claims about the world, and
reusing the asset would make a vent read as a boundary. Unowned handoff, risk R-11.

---

## 8. Pool budget — arithmetic, not assertion

`[OBSERVED]` `MAX_VISUAL_EFFECTS = 24` (`:14`). Two independent gates:

- **Admission** — `spawnVfx()` `:4026`: `if (this.pendingVfxLoads.size >= MAX_VISUAL_EFFECTS && !criticalEvent) return;` Non-critical cues are refused while 24 loads are in flight.
- **Eviction** — `trackVfxInstance()` `:4006-4017`: `while (this.vfxInstances.length > MAX_VISUAL_EFFECTS)`, `findIndex` the first non-critical record, splice it; and at `:4013` **`const evictionIndex = expendableIndex >= 0 ? expendableIndex : 0;`**

`[OBSERVED]` **The exemption is not absolute.** When every live record is critical,
`expendableIndex` is `-1` and index **0 — the oldest critical — is evicted.** With 17
of 33 existing types already exempt (§2.1), that is a reachable state, so any budget
must keep the critical population strictly under 24, not merely rely on the flag.

### 8.1 The cap is structural; the real question is eviction

`[OBSERVED]` `vfxInstances.length` **cannot** exceed 24 — `trackVfxInstance` loops
until it does not. So "prove the cap is not exceeded" is trivially true. The question
that matters is: **does the new work push out a cue the player needs?** Two failure
modes:

1. A new cue evicts an existing combat cue the player needed.
2. The critical population reaches 24 and `evictionIndex = 0` starts evicting
   criticals — boss telegraphs, objective changes, deformation warnings.

### 8.2 Family budgets `[TARGET]`

The new families get a **hard combined live budget of 10**, enforced at spawn time
before a record enters the pool. The existing 33 events keep the remaining **14** with
today's behavior unchanged.

| Family | Members | Live budget | Basis |
|---|---|---|---|
| `drop` | `DROP_SPAWNED`, `DROP_EXPIRED`, `DROP_DENIED` | **3** | `MAX_FIELD_DROPS = 8` may be offered; 3 admitted, rest suppressed at source because 8 pool-free beacons already mark every drop |
| `buff` | `BUFF_APPLIED`, `BUFF_REFRESHED`, `BUFF_EXPIRED` | **2** | `MAX_ACTIVE_BUFFS = 6`, worst 3 applied in one `collectPickups` pass; the HUD strip is the persistent channel |
| `spawn` | `ENEMY_SPAWNED`, all grades | **4** | exactly the `[OBSERVED]` ceiling (§6.3): 1 routed + 1 elite + 2 escorts. **No real arrival is ever clipped.** |
| `deform` | `GIMMICK_ARMED`, `GIMMICK_TRIGGERED`, `GIMMICK_RESOLVED` | **1** | max 1 deformation armed per stage, 1 trigger per tick, phases strictly sequential (§7.4) |
| | **new total** | **10** | |
| | existing 33 reserve | **14** | |
| | **`MAX_VISUAL_EFFECTS`** | **24** | |

A family at budget **drops the cue at source** — it never reaches `trackVfxInstance`,
so it can never evict an existing cue. `ITEM_COLLECTED` stays in the existing reserve
because it is one of the 33, not a new type.

`spawn` was raised from an earlier 2 to **4** once `EncounterPacing` confirmed the
ceiling. A budget below the confirmed ceiling would silently drop one of the four
elite/escort arrivals at the single most important arrival moment in the run — **the
budget must never be tighter than the thing it is budgeting.**

### 8.3 Reachable-maximum arithmetic

Term by term, each bounded by a confirmed simulation cap rather than a guess:

| Family | Slots | Basis |
|---|---|---|
| `spawn` | **4** | `[OBSERVED]` §6.3 — 1 routed + 1 elite + 2 escorts, depth 3, once per run |
| `deform` | **1** | `[OBSERVED]` §7.4 — 1 armed/stage, phases sequential, 1 trigger/tick |
| `drop` | **3** | `[TARGET]` budget; 8 offered, 5 suppressed at source |
| `buff` | **2** | `[TARGET]` budget; 6 active max, 3 applied/tick worst |
| existing 33 | **14** | reserve. Measured peak in reachable scenarios: **9–11** |
| **total** | **24** | = `MAX_VISUAL_EFFECTS` |

**Reachable ceiling = 4 + 1 + 3 + 2 + 14 = 24.** Since the existing families never
reach 14 in any reachable scenario (measured 9–11), the true reachable peak is **23,
with 1 slot spare**.

### 8.4 Simulated verification

Occupancy model: a record holds a slot over `[start, start + lifetime)`. Existing
lifetimes are the `[OBSERVED]` §2 values; new ones are §5–§7. Computed in an
in-memory arithmetic model — **no test suite was executed** (§10 note).

| Scenario | Peak live | At tick | Headroom | Ticks over 24 | new live | existing live | criticals live |
|---|---|---|---|---|---|---|---|
| **Reachable worst** — `echo-throne`, elite 4-burst, deformation armed 180 t → triggered → resolved, 8-drop burst, 3 collected + 3 buffs, 8 TTL expiries, 6-buff flush, full combat cadence | **20** | 162 | **4** | **0** | 9 | 11 | 5 |
| **Boss block** — `BOSS_SPAWNED` + `BOSS_RALLY_WINDOW` + `ECHO_WARDEN_AWAKENING_TRIGGERED` + repeating `BOSS_ATTACK_TELEGRAPHED`, deformation armed across boss phases | **18** | 162 | **6** | **0** | 8 | 10 | 7 |
| **Adversarial (unreachable)** — every new family offered 12 simultaneous cues, every long-lived critical live, 2-tick melee and 4-tick crit cadence | **29** | 43 | **−5** | **20** | 11 | 19 | 14 |

**The adversarial row breaches, and it is recorded rather than dropped.** Its inputs
are unreachable: it requires 12 simultaneous `ENEMY_SPAWNED` (ceiling 4), 12
`GIMMICK_ARMED` (ceiling 1), and melee impacts every 2 ticks sustained for 170 ticks.
`[INFERENCE]` The honest reading: the budget bounds the **new** work at 11 there — it
never exceeds its own total — while the **existing** 33 events climb to 19 on their
own. The pool cannot hold 29, so `trackVfxInstance` would evict 5 of the oldest
non-critical records, all 8-tick `MELEE_IMPACT` / 10-tick `SKILL_RESOLVED_DAMAGE` cues
that are individually redundant in a burst that dense. Criticals peak at 14, still 10
below the 24 that would force a critical eviction.

So even in a scenario the simulation cannot produce, **no critical cue is evicted**, and
degradation is confined to the shortest-lived impact cues. That is the correct failure
mode, but it is a degradation and this spec does not claim otherwise.

### 8.5 The suppression rules that make it work

The first two are load-bearing; the last two were **deleted** once their premises turned
out to be false.

| Rule | Status | Without it | With it |
|---|---|---|---|
| §5.4 `DROP_EXPIRED` coalesced 8 → 2 | **live** | 8 simultaneous TTLs at 16 ticks each | peak fell from **29** (6 ticks over cap) to 24 |
| §5.6 `BUFF_EXPIRED` cue on `TIMEOUT` only | **live** | 6-cue flush at every stage transition | 6 slots recovered at the worst moment; matches the ratified audio policy |
| §6.4 rule B2 direction coalescing | **deleted** | *premise false* — bounded a 10-wide BASIC batch the admission code cannot produce | simulation bounds the family at 4/tick already |
| §7.5 rule B1 boss-block single arming | **deleted** | *premise false* — duplicated a stronger upstream guarantee | `DungeonLevelDesign` guarantees ≤1 deformation armed per stage, run-wide |

`[TARGET]` Every suppressed cue is dropped **at source**, before `spawnVfx()`. Nothing
in this spec relies on eviction to stay inside the cap — eviction remains the
last-resort safety net it already is.

---

## 9. Registry entries and asset production

### 9.1 `VFX_MODELS` (`:289-323`) `[TARGET]`

```js
  DROP_SPAWNED:      "assets/motion/stage-vfx/drop-beacon-pillar.glb",
  DROP_EXPIRED:      "assets/motion/stage-vfx/drop-beacon-pillar.glb",
  DROP_DENIED:       "assets/motion/stage-vfx/drop-beacon-pillar.glb",
  BUFF_APPLIED:      "assets/motion/stage-vfx/drop-beacon-pillar.glb",
  BUFF_REFRESHED:    "assets/motion/stage-vfx/drop-beacon-pillar.glb",
  BUFF_EXPIRED:      "assets/motion/stage-vfx/drop-beacon-pillar.glb",
  ENEMY_SPAWNED:     "assets/motion/stage-vfx/arrival-breach-gate.glb",
  GIMMICK_ARMED:     "assets/motion/stage-vfx/deform-fracture-seam.glb",
  GIMMICK_TRIGGERED: "assets/motion/stage-vfx/deform-fracture-seam.glb",
  GIMMICK_RESOLVED:  "assets/motion/stage-vfx/deform-fracture-seam.glb",
```

### 9.2 `VFX_LIFETIME_TICKS` (`:373-403`) `[TARGET]`

Defaults; `ENEMY_SPAWNED` and `GIMMICK_ARMED` prefer `event.telegraphTicks` at the
spawn site (§6, §7.4).

```js
  DROP_SPAWNED: 14,
  DROP_EXPIRED: 16,
  DROP_DENIED: 12,
  BUFF_APPLIED: 20,
  BUFF_REFRESHED: 12,
  BUFF_EXPIRED: 24,
  ENEMY_SPAWNED: 30,      // FALLBACK ONLY -- event.telegraphTicks is the value (§7.4.1)
  GIMMICK_ARMED: 180,     // FALLBACK ONLY -- deformation tier; 120/90/60 also exist
  GIMMICK_TRIGGERED: 45,
  GIMMICK_RESOLVED: 30,
```

`CRITICAL_VFX_EVENT_TYPES` (`:404-422`): **no new literals** (PR-5).

`[TARGET]` `semanticVfxIdForEvent()` (`:340-354`) needs no new case — its default
branch lowercases and hyphenates, yielding `drop-spawned`, `enemy-spawned`,
`gimmick-triggered`, which is the desired id shape.

### 9.3 Blender authoring

`[TARGET]` Extend `scripts/build-stage-vfx-blender.py` — do not add a second
generator. `[OBSERVED]` It runs under Blender, not system Python:

```
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python scripts/build-stage-vfx-blender.py -- --output-dir assets/motion/stage-vfx
```

**Three new GLBs, not eleven.** `[INFERENCE]` The established pattern is 3 GLBs serving
33 events (§2); per-event assets would multiply the four path allowlists (§9.6) by 11
for no readability gain, since stage and rarity variation is colour, not geometry.

Loader contract every new GLB must satisfy `[OBSERVED]`, from `instantiateVfxModel()`
(`:2082-2094`):

| Requirement | Source |
|---|---|
| Clip matching `/::loop::/i`, else first clip | `gltf.animations?.find(({ name }) => /::loop::/i.test(name)) ?? gltf.animations?.[0]` |
| Looped forever | `action.setLoop(THREE.LoopRepeat, Infinity).reset().play()` |
| Height fitted to **1.2** | `fitHeight(instance, 1.2)` |
| Spawned at **Y = 0.6** | `instance.position.y = 0.6` |
| Cloneable, own resources | `SkeletonUtils.clone` + `ownRenderableResources` |

`[TARGET]` Additional authoring constraints:

- Clip name `vfx::<effectId>::loop::v01`. Matches `/::loop::/i` for the transient path while staying clear of `stage-vfx::<stageId>::loop::v01`, which the stage-cue validator requires verbatim `[OBSERVED]`.
- Quality groups named exactly `vfx-core`, `vfx-detail`, `vfx-decor` (existing convention), so quality tiers and reduced-motion group hiding work unchanged.
- **Frame 1 must be the readable resting pose.** `applyTransientVfxPolicy` stops the action under reduced motion (`:1803-1807`) `[OBSERVED]`, so frame 1 is what a reduced-motion player sees for the cue's entire lifetime. Rings fully open, cores at full opacity.
- Silhouettes authored to the §4 world heights **before** `fitHeight(1.2)`, so the core:decor ratio survives the uniform rescale.

### 9.4 `EFFECTS` additions

`[TARGET]` Append to the `EFFECTS` tuple, adding a `scope` key that existing entries
omit (they default to `"stage"`):

```python
    {
        "scope": "transient", "effectId": "drop-beacon-pillar", "stageId": None,
        "durationSeconds": 2.0,
        "palette": {"core": "#FFD257", "accent": "#5DE6FF", "shadow": "#1A1206"},
        "meaning": "Field item lifecycle: appear, expire, deny, and buff transitions.",
        "silhouette": "Vertical flare spike over a thin ground ring; separable at 48 px.",
        "reducedMotion": "Hold the open ring and lit core; hide falling motes.",
        "builder": "build_drop_pillar",
    },
    {
        "scope": "transient", "effectId": "arrival-breach-gate", "stageId": None,
        "durationSeconds": 1.5,
        "palette": {"core": "#66F0BD", "accent": "#A06BFF", "shadow": "#04140E"},
        "meaning": "Enemy arrival marker; grade drives scale, stage drives decor accent.",
        "silhouette": "Low wide ground seam (BASIC) or vertical gate with lintel (SHADOW).",
        "reducedMotion": "Hold the seam or gate fully open; stop mote travel.",
        "builder": "build_arrival_gate",
    },
    {
        "scope": "transient", "effectId": "deform-fracture-seam", "stageId": None,
        "durationSeconds": 2.5,
        "palette": {"core": "#FFD257", "accent": "#F3592C", "shadow": "#140A04"},
        "meaning": "Presentation-only corridor-width change. Never alters elevation or collision.",
        "silhouette": "Hairline ground seam, 0.10 bright over 0.04 dark, plus a 1.1-unit arming marker.",
        "reducedMotion": "Hold the solid seam; hide falling dust and the pulse.",
        "builder": "build_deform_seam",
    },
```

### 9.5 Builder recipes

`[TARGET]` Three new functions using only the existing primitive helpers (`cube`,
`ico`, `torus`, `cone`, `cylinder`, `curve_ribbon`) `[OBSERVED]` — no new dependency,
no imported mesh, no sampled texture.

**`build_drop_pillar(effect, groups, mats)`**
- `vfx-core`: `cylinder("drop-shaft", core, (0,0,0.62), radius 0.055, depth 1.24, mats["core"], vertices 8)`.
- `vfx-core`: `ico("drop-crown", core, (0,0,1.24), 0.085, mats["core"], subdivisions 2)` — top terminator.
- `vfx-detail`: `torus("drop-ring", detail, (0,0,0.03), major 0.55, minor 0.018, mats["accent"])`.
- `vfx-detail`: `torus("drop-ring-inner", detail, (0,0,0.03), major 0.30, minor 0.012, mats["accent"])` — the beacon-scale tick.
- `vfx-decor`: 6 × `ico(f"drop-mote-{i:02d}", decor, …, 0.022, mats["accent"])` on a 0.42 circle at z 0.18–0.95.

**`build_arrival_gate(effect, groups, mats)`**
- `vfx-core`: 2 × `cube("gate-upright-{L,R}", core, (±0.45, 0, 0.8), (0.07, 0.07, 1.6), mats["core"])` — SHADOW uprights.
- `vfx-core`: `cube("gate-lintel", core, (0,0,1.58), (1.04, 0.08, 0.09), mats["core"])`.
- `vfx-detail`: `cube("gate-seam", detail, (0,0,0.03), (1.5, 0.10, 0.02), mats["accent"])` — the BASIC ground seam; the only group BASIC shows at full strength.
- `vfx-detail`: 2 × `curve_ribbon("gate-arc-{i}", detail, <5-point arc (−0.6,0,0.05)→(0.6,0,0.05) bowing to z 0.55>, mats["accent"], 0.016)`.
- `vfx-decor`: 8 × `ico(f"gate-mote-{i:02d}", decor, …, 0.02, mats["accent"])` along the seam.

**`build_deform_seam(effect, groups, mats)`**
- `vfx-core`: `cube("seam-bright", core, (0,0,0.032), (2.4, 0.10, 0.014), mats["core"])` — the hard edge.
- `vfx-core`: `cube("seam-dark", core, (0,0,0.030), (2.4, 0.040, 0.012), mats["frame"])` — dark core for contrast on a lit floor.
- `vfx-core`: `cone("seam-marker", core, (0,0,0.55), radius 0.10, depth 1.10, mats["core"], vertices 5)` — the 1.1-unit arming marker.
- `vfx-detail`: 5 × `cube(f"seam-dash-{i:02d}", detail, (−0.96 + i*0.48, 0, 0.031), (0.30, 0.06, 0.012), mats["accent"])` — telegraph dashes that fuse into the solid line.
- `vfx-decor`: 10 × `ico(f"seam-dust-{i:02d}", decor, …, 0.016, mats["accent"])` above the seam, travelling inward.

**`animate_root` extension.** `[OBSERVED]` It hard-codes
`action.name = f"stage-vfx::{effect['stageId']}::loop::v01"` and a full-turn Z
rotation. `[TARGET]` Branch on `scope`:

```python
    if effect.get("scope") == "transient":
        action.name = f"vfx::{effect['effectId']}::loop::v01"
    else:
        action.name = f"stage-vfx::{effect['stageId']}::loop::v01"
```

`[TARGET]` Transients need a different curve: the ambient cues rotate a full
`math.tau` over 4–6 s, wrong for a 14-tick burst. For `scope == "transient"`, keyframe
**scale only** — frame 1 at the open readable pose (1.0), a 6 % overshoot at ¼
duration, settling to 1.0 — and **no Z rotation**, so a stopped reduced-motion action
leaves the cue at its open pose. `build_effect` dispatches through the existing
`builders` dict keyed by `stageId`; add the `builder` key and prefer it when present so
the three ambient cues are untouched. `spawnCap` in the manifest row becomes the
§5–§7 per-cue cap instead of the hard-coded `1`.

### 9.6 Output paths and registration — four allowlists, one commit

| Artifact | Path |
|---|---|
| GLBs | `assets/motion/stage-vfx/drop-beacon-pillar.glb`, `arrival-breach-gate.glb`, `deform-fracture-seam.glb` |
| Provenance | `assets/motion/stage-vfx/<effectId>.provenance.json` |
| QA preview + provenance | `assets/motion/stage-vfx/qa/<effectId>-preview.png` |
| Manifest (regenerated, gains 3 rows) | `assets/motion/stage-vfx/manifest.json` |

`[OBSERVED]` `runtimeReceipt.runtimeEligible: true` is written automatically and is
correct here: repository-authored deterministic procedural geometry, reference atlas
recorded but never embedded.

`[OBSERVED]` A new runtime asset path must be added in **four** places or the release
gate fails:

1. `scripts/defense-runtime-assets.mjs:69-72` — `RETAINED_ASSET_PATHS` (frozen array starts at `:1`; stage-vfx block now `:69-72`, shifted by the terrain-floor promotion).
2. `tests/release-closure.test.mjs:71-74` — `DIRECT_RUNTIME_ASSETS`, which feeds `RUNTIME_PATHS` (`:76-84`).
3. `.github/workflows/static.yml` `PAGES_RUNTIME_PATHS` — asserted **order-sensitively** by `assert.deepEqual(pagesRuntimePaths, RUNTIME_PATHS)` (`tests/release-closure.test.mjs:138`), with a second check that every `RETAINED_ASSET_PATHS` entry is in the Pages set (`:140-142`).
4. `tests/pages-artifact-smoke.cjs:73-76` — the packaged-artifact smoke list.

`[OBSERVED]` **The procedure is proven but has NOT yet been applied to these three
GLBs.** Ruling v5 R29 closed the *terrain-floor* case: `Main` moved three promoted
floor paths through all four lists in one commit. A grep of all four lists for
`drop-beacon-pillar`, `arrival-breach-gate` and `deform-fracture-seam` returns **zero
matches** — only the three pre-existing stage-vfx GLBs are listed. So the terrain
precedent shows the mechanism works; the VFX rows are still outstanding and belong to
whoever authors the GLBs. `scripts/build-stage-vfx-blender.py` itself needs no
allowlist row — it authors assets, it is not a runtime asset.

Then regenerate `assets/defense-asset-manifest.json` via
`scripts/build-defense-asset-manifest.mjs`; `tests/defense-asset-manifest.test.mjs`
requires a manifest row per retained path.

---

## 10. Reduced motion — consolidated

`[OBSERVED]` Two policies exist today and this spec adds a third for its own decals:

| Surface | Policy | Source |
|---|---|---|
| Transient pooled VFX | `reducedMotion` → `action.stop()`; else `reset().play()` | `applyTransientVfxPolicy` `:1803-1807` |
| Stage ambient VFX | hide `detail` + `decor`, stop loop, `quality = "reduced-motion"` | `applyStageVfxPolicy` `:1789-1801` |
| **New pool-free decals** | `[TARGET]` hold at full opacity, stop travel/pulse, never hide | §5.2, §7.4 |

`[TARGET]` Per-family mapping:

| Family | Reduced-motion equivalent |
|---|---|
| drop transients (§5.1, 5.4, 5.5) | frame 1 open pose held; motes hidden with `vfx-decor` |
| drop idle beacon (§5.2) | shaft at full opacity, travel stopped, ground tick static. **Never hidden** — the only way to find a drop |
| buff transitions (§5.6) | held open pose; the HUD strip is the reduced-motion channel of record |
| arrival (§6) | seam / gate held fully open at frame 1; mote travel stopped |
| deformation telegraph (§7.4) | **dashes held solid instead of pulsing.** The pulse is the only animated part of the warning, so the static form must already read as "this edge is about to matter" |
| deformation lingering seam | already static; unchanged |

`[TARGET]` `setReducedMotion()` (`:3658-3676`) already re-applies policy to every live
record on toggle; both new decal maps must be added to that sweep.

---

## Verification matrix

> **NOTHING IN THIS SPEC'S OWN MATRIX WAS RUN BY ITS AUTHOR.** Per the director's hard
> stop on test execution during the design phase, this spec executed **zero** tests — no
> `node --test`, no single test file, no browser proof, no script writing under `qa/`.
> The only computation performed was an in-memory arithmetic occupancy model (§8.4) with
> no repo I/O.
>
> `[OBSERVED]` **Checks 1–4, 7, 8, 10 and 11 were subsequently executed by the director
> after the renderer lane landed: `tests/combat-presentation-contract.test.mjs` +
> `tests/runtime-visual-assets.test.mjs` = 37/37 PASS, 0 fail**, with
> `node --check battle-realtime-three.js` clean. Checks 9, 12, 13, 14 remain unrun.
>
> `[OBSERVED]` **Ruling v8 R35 — test-invocation discipline.** The default bash cwd is
> `/Users/jangyoung/orca/Abyssal-Surge`, the forbidden tree. A bare
> `node --test tests/...` therefore exercises the *concurrent session's* source, so a
> pass proves nothing about this change and a failure is not this change's regression.
> Every invocation must be
> `cd /Users/jangyoung/orca/Abyssal-Surge-dungeon && node --test --test-concurrency=2 tests/<file>`.
> The full glob is the director's alone, once, in the worktree, and only in the quoted
> form `node --test 'tests/**/*.test.mjs'` (CLAUDE.md §6 — a shell-expanded glob is not
> equivalent).

| # | Assertion | Where measured |
|---|---|---|
| 1 | `VFX_MODELS` has exactly **43** keys (33 + 10 new), and every value resolves to a file on disk. | New case in `tests/runtime-visual-assets.test.mjs`, beside the existing model-existence loop (`:44-69`). |
| 2 | `VFX_LIFETIME_TICKS` contains all 10 new keys with the §9.2 integers, every value a positive integer (no float — v2 R15). **And the two telegraph types resolve from the field, not the constant:** `resolveVfxLifetimeTicks({type:"GIMMICK_ARMED", telegraphTicks:60})` returns **60**, not 180; `{type:"ENEMY_SPAWNED", grade:"BASIC", telegraphTicks:120}` returns **120**, not 30. A hardcoded constant fails this. | Same file. |
| 3 | `CRITICAL_VFX_EVENT_TYPES` still has exactly **17** literals after the change — new exemptions must come from the PR-4 predicate, not the array. Guards against the wholesale `ENEMY_SPAWNED` exemption that would starve the pool. | New case in `tests/defense-renderer-contract.test.mjs`. |
| 4 | `isCriticalVfxEvent()` returns `true` for `{type:"ENEMY_SPAWNED",grade:"SHADOW"}`, `false` for `grade:"BASIC"`; `true` for `gimmickClass:"deformation"` and `"hazard"`, `false` for `"gate"` and `"mirror"`; and for all 33 existing types agrees exactly with `CRITICAL_VFX_EVENT_TYPES.includes(type)`. | Same file, table-driven over the 33 types. |
| 5 | **PR-1 regression:** `effectAnchor(snapshot, {type:"DROP_SPAWNED", x:15400, y:6000})` returns `{x:15400,y:6000,elevation:0,normalized:false}`; and for each of the 33 existing types the returned anchor is **byte-identical** to the pre-change result. The proof that PR-1 is additive. | Same file. |
| 6 | **PR-3 precondition:** no existing call site passes `normalized: false`. Static check — fail if any is found outside PR-1's return. | Same file. |
| 7 | Pool bound: replay a synthetic 220-tick stream saturating all four new families plus full combat; assert `vfxInstances.length <= 24` on **every** tick and that no record whose `isCriticalVfxEvent()` is true is retired before `untilTick`. §8.4's reachable-worst row as an executable test. | New case in `tests/combat-presentation-contract.test.mjs`, which already builds synthetic VFX scenes. |
| 8 | Family budgets hold: offer 12 simultaneous cues per family; assert live counts never exceed drop 3 / buff 2 / spawn 4 / deform 1, and that over-budget cues are absent from `vfxInstances` (dropped at source, not evicted). | Same file. |
| 9 | Determinism unchanged: `getRunDigest()` (`defense-run-simulation.js:3555`) depth-0 bytes identical before and after the change set. Presentation-only work must not move a digest byte. `SNAPSHOT_VERSION` stays **7** (`:378`). | `node --test 'tests/**/*.test.mjs'` — existing determinism suites, director-owned run. |
| 10 | Drop beacon consumes **zero** pool slots: with 8 `kind:"buff"` pickups in the snapshot, `debugPresentationState()` reports 8 live beacons and `vfxInstances.length === 0`. | New case in `tests/combat-presentation-contract.test.mjs`. |
| 11 | Beacon lifecycle: a beacon appears the tick its pickup id enters `snapshot.pickups`, is retired the tick the id leaves, and `dropBeacons.size === 0` after `dispose()`. Leak check for reset / death / pause. | Same file. |
| 12 | Terrain invariance: after `GIMMICK_TRIGGERED`, terrain vertex positions and the terrain root's world matrix are **unchanged**, `elevation` is still 0 at every authored placement, and no simulation field was written. The hard `author-game-levels` rule as a test. | New case in `tests/stage-terrain-environment-contract.test.mjs`. |
| 13 | Readability floor: in a real-WebGL session at `ORBIT_ZOOM_DEFAULT` and at `MAX_ORBIT_DISTANCE`, each new cue's on-screen height is ≥ 44 px at 1440×900. Measure by projecting the bounding box, not by eye. | Browser probe in `tests/stage-runtime-proof-browser.test.mjs`, which already captures VFX records per stage. |
| 14 | Reduced-motion readability: with `setReducedMotion(true)`, every new cue's frame-1 pose still clears the 44 px floor and the beacon is still present (not hidden). | Same browser probe. |

`[TARGET]` **No gate flips on this spec.** Design and assets are not measurements
(production brief §3).

---

## Open risks

Each risk names the concrete existing test or contract it would break.

| # | Risk | Breaks | Mitigation |
|---|---|---|---|
| R-1 | **The persistent-decal system this spec's first draft cited does not exist at `033877ad`** (defect D-A). `groundDecalGroup`, `corpseGroup`, `corpseMarkers`, `MAX_CORPSE_MARKERS`, `GROUND_DECAL_LIFT`, `RANGE_RING_*`, `CORPSE_GRADE_COLORS` — zero matches in the implementation tree. | Nothing — but an implementer following the stale draft would attach both pool-free surfaces to a group that does not exist, and read a colour constant that does not exist. Two compile errors, or worse, an invented approximation. | §5.2 and §7.4 respecified as standalone new construction with their own constants; §4.1 defines `ARRIVAL_GRADE_COLORS` here. Same three hues as the concurrent tree so the two converge if that work lands. |
| R-2 | **Half the first draft's renderer citations were from the wrong tree** (defect D-B), off by up to ~670 lines and increasing. | Every `file:line` in the stale draft. `edit` by stale line number would corrupt unrelated code. | §0.4 correction table; §0.1 mandates absolute dungeon paths and symbol-first anchoring. Verified per file — drift is **not** uniform (`styles.css` differs by 1 line, `app.js` matched). |
| R-3 | **Four allowlists must change in one commit for the 3 new GLBs.** Ruling v5 R29 closed the *terrain-floor* instance of this risk — `Main` moved three promoted floor paths through all four lists together — but `[OBSERVED]` a grep of all four lists finds **zero matches** for `drop-beacon-pillar` / `arrival-breach-gate` / `deform-fracture-seam`. The VFX instance is **still open**. | `tests/release-closure.test.mjs:138` — `assert.deepEqual(pagesRuntimePaths, RUNTIME_PATHS)` is **order-sensitive**, so a right-set-wrong-order edit fails. `:140-142` fails if a retained path is missing from Pages. `tests/defense-asset-manifest.test.mjs` fails without a manifest row. `tests/pages-artifact-smoke.cjs` fails on a missing packaged file. | §9.6 lists all four with post-terrain line numbers plus the manifest regeneration. The terrain promotion is the worked example to copy. Ownership resolved: `Main` owns the allowlist commit; the GLB author supplies the three paths in identical relative order in every list. |
| R-4 | **PR-4 changes a hot-path predicate.** `trackVfxInstance` runs per spawn; a wrong predicate either starves the pool (over-exemption) or drops boss telegraphs (under-exemption). | Existing exempt-cue behavior across all 17 critical types — nothing asserts eviction order today, so a regression would be silent. | Verifications #3, #4, #7. #4's table over all 33 types is the additive proof. |
| R-5 | **A 4th grade or `gimmickClass` would silently lose exemption.** The predicate enumerates `"SHADOW"`, `"deformation"`, `"hazard"` literally. | Nothing immediately — the cue would render but become evictable, degrading in exactly the busy moment it matters. | v2 R4 fixes `grade` at 3 values, R5 fixes `gimmickClass` at 4. Verification #4 must gain a row per new value if either enum grows. |
| R-6 | **The beacon is the only way to find a drop and is covered by no existing test.** At 48 px (24 px zoomed out) the pickup prop is effectively invisible at range (§4). | Nothing today — `tests/runtime-visual-assets.test.mjs:90` asserts exactly **one** `vfxCue` per stage, so the beacon **cannot** be a stage cue without breaking it. That is why §5.2 uses a standalone group. | Verifications #10, #11 cover presence, count and leak; #13/#14 cover the readability floor including reduced motion. |
| R-7 | **`ITEM_COLLECTED` fires on the collector, not the drop site** (`defense-run-simulation.js:1805-1808`). A companion collecting an item 3000 units away plays the success cue off-screen from where the player was looking. | Nothing — existing shipped behavior this spec deliberately does not change. | Documented in §5.3. The beacon vanishing marks the site simultaneously. Retuning it is a separate change with its own evidence. |
| R-8 | **`map-renderer.md` is stale in two places** (§2.1): critical-type count 6 vs **17**, and `TARGET_HEIGHT` values. Any lane that sized a budget from "6" is wrong. | Nothing mechanical — but §8's budget would be badly wrong on 6, since 17/33 exempt is what makes the all-critical eviction path (`evictionIndex = 0`, `:4013`) reachable. | Corrected inline with `file:line`. Broadcast to peers. The report itself is `MapRenderer`'s to amend. |
| R-9 | **`kind: "buff"` may break the pickup mesh branch.** `[OBSERVED]` `ensurePickup()` (`:2928`) selects its mesh with `pickup.kind === "item" ? PROP_BLADE_MESH : PROP_RELIC_MESH`. Field drops arrive as `kind: "buff"`, so **every buff drop falls to the else branch and renders as the relic mesh**, ignoring `modelKey`. | No test asserts drop mesh selection today, so it would ship silently — every rarity tier looking identical, which also undercuts §4.1's classifier channel. | Out of this spec's scope (the pickup mesh branch is not a VFX cue), but flagged for `RendererVfxImpl` and `DropBuffSystem`: read `pickup.modelKey` with the current branch as fallback. The beacon's rarity colour (§5.2) is unaffected and carries the tier read regardless. |
| R-10 | **Frame 1 is load-bearing and easy to author wrong.** `applyTransientVfxPolicy` stops the action under reduced motion, so a GLB whose frame 1 is closed or zero-opacity renders **nothing at all** for reduced-motion players. | No existing test asserts frame-1 readability for any of the 3 current GLBs, so the same latent bug may already be present there. | §9.3 makes it an explicit authoring constraint; §9.5 removes Z-rotation for transients so a stopped action holds the open pose. Verification #14 is the guard. |
| R-11 | **Hazard-class visual design is unowned, and ships that way.** PR-4 exempts `gimmickClass: "hazard"` (2 gimmicks — `forge-pressure-vents`, `dais-command-echo`, `telegraphTicks` **60** per §7.4.1) but this spec authors no hazard cue. | Nothing breaks: the pool plumbing is correct, so the two hazards get correct eviction behaviour with **no dedicated visual**. | **Ruling v5 R30: stays OPEN by explicit director decision** — recorded in the retrospective as an unresolved gap, not as done. §7.6 keeps the prohibition on reusing `deform-fracture-seam.glb` for a vent: a narrowing seam and a pressure vent are different claims about the world, and a cue that conflates them lies about the rules. Closing this needs a hazard cue spec, not an asset reuse. |
| R-12 | **The dungeon-tree copy of this spec must be re-synced after every revision.** `[OBSERVED]` `_workspace/` is **per-worktree**: `/Users/jangyoung/orca/Abyssal-Surge-dungeon/_workspace/current/design/vfx-drop-spawn-terrain-spec.md` is a **separate file** (different inode), not a link. `Main` synced a 72 801-byte copy in ruling v4, but that snapshot predates the §0.3/§0.4 provenance rewrite, the §6.3 spawn-ceiling correction, the §7.2 frozen-gimmick table, the §8 reachable-maximum proof, and the v4 R23 group rename. | An implementer reading a stale copy gets the wrong spawn ceiling (10+1 instead of 4), the wrong deformation telegraph (90 instead of 180), deleted rules B1/B2 as if live, `groundDecalGroup` as if it existed, and renderer line numbers off by up to ~670. | **This revision is synced to the dungeon path by its author** — permitted per v4 ("syncing your own deliverable across worktrees is not a violation"). Verify before implementing: the authoritative copy is the one whose §0.4 correction table lists `groundDecalGroup … DO NOT EXIST` and whose §8.2 shows a `spawn` budget of **4**. If either is missing, the copy is stale. |
| R-13 | **Verification #4's hazard assertion was already correct and is now ratified.** Ruling v4 R24 warned that a `false` assertion for `gimmickClass: "hazard"` would be superseded. This spec asserts **`true`** for both `"deformation"` and `"hazard"` (PR-4 predicate and Verification #4), because the narrowing is simulation-enforced and evicting the cue would hide an active hazard. | Nothing — the spec and the ruling agree. Recorded so a reader holding the pre-v4 draft does not "fix" it in the wrong direction. | No change required. `"gate"` and `"mirror"` remain evictable, which is also what R24 specifies. |
| R-14 | **Three lifetime constants were wrong in the live renderer edit, taken from this spec's stale draft.** `[OBSERVED]` `ENEMY_SPAWNED: 20`, `ENEMY_SPAWNED_SHADOW_LIFETIME_TICKS = 45`, `GIMMICK_ARMED: 90` — my pre-confirmation guesses, corrected to **30 / 60 / 180** as *fallbacks*. | At 20 the arrival window drops below one full attack cooldown (24 ticks) and under 5 body radii of repositioning. At `GIMMICK_ARMED: 90` a deformation telegraph dies halfway through the 180-tick window it exists to cover. | **Ruling v5 R31 ratified the corrections; v6 C1/C2 then corrected their *rationale* and scope.** All four landed in the renderer before its abort, and the director's audit confirms them. Verification #2 now guards both the integers and the field-resolution. Also ratified: delete the dead `DROP_DENIED.reason === "MEASUREMENT_PROFILE"` branch. |
| R-15 | **Scope fence — `core-loop-legion-spec.md` is cycle 9's and is already implemented on the concurrent side.** `[OBSERVED]` Ruling v5 R27: their `defense-catalog.js` is 1025 lines against our 923, carrying `AIM_BIAS_BP`, `EXTRACTION_GRADE_BY_ENEMY`, `COMPANION_CAPACITY_BASE`, and the `ash-nova` / `regents-verdict` skills, with comments citing that spec. | Building from it would rebuild existing code and guarantee a merge conflict. | This spec is clean by construction: its **only** reference to cycle 9 is §6.4's correction that the legion 3→10 cap is the *player's companion* cap and never belonged in the arrival arithmetic. No cue, budget, or prerequisite here depends on the analog contract or on any cycle-9 symbol. |
| R-16 | **Four files diverge and will need a real merge at cycle close.** Counts move constantly (v7 R32), so treat the *fact* of divergence as the invariant, not any number: `defense-catalog.js`, `defense-run-simulation.js`, `app.js` and `battle-realtime-three.js` all differ between this branch and the concurrent session's. | A reflowed region conflicts across hundreds of lines; a silently reused identifier overwrites the other session's system. | **Ruling v5 R28: planned task, not a surprise.** This spec is additive by design and needs no reflow: PR-1/PR-2 insert branches into `effectAnchor` ahead of existing returns, PR-3 adds one opt-out clause, PR-4 replaces two membership tests with one helper byte-equivalent for all 33 existing types, PR-5 adds nothing to the array, §9.1/§9.2 append registry keys. Both new surfaces use deliberately distinct identifiers (`dropDecalGroup`, `deformationSeamGroup`) so a collision with the concurrent `groundDecalGroup` is a **visible conflict**, never a silent overwrite. |
| R-17 | **This spec cited an unshipped design document as shipped behaviour.** `[OBSERVED]` Ruling v6 C1: the original justification for the 30/60 arrival windows was "one full dash cycle (18 ticks — startup 2 / iframe 10 / recovery 6)". A blob grep of `defense-catalog.js` and `defense-run-simulation.js` for `DASH`, `dash`, `iframe`, `invuln`, `startup`, `LIGHT_1`, `HEAVY` returns **0 each**. There is no dash; the 18-tick figure came from `master-numeric-contract.md`, an unshipped target. | Nothing shipped — the *values* survived re-grounding on `speed: 4100`, `radius: 360`, `basicCooldown: 24`. But the rationale would have justified a future change in the wrong direction, and it wore an `[OBSERVED]` costume. | §6 re-derived from shipped constants only. **Standing lesson (v6 C3), and this spec is one of three instances that cycle:** a spec is a claim about intent; only a blob is a claim about code. When a number's justification traces to a `.md`, mark it `[TARGET]` and name the document. `git show <sha>:<path>` is the read that cannot be fooled. |
| R-18 | **A telegraph tier-mapping conflict between two authorities — now RESOLVED.** `[OBSERVED]` This spec recorded hazard 90 / mirror 60 from `DungeonLevelDesign`'s first frozen table, while ruling v6 C2 assigned hazard 60 / mirror 90 — swapped. `DungeonLevelDesign` has adopted the v6 tiers verbatim; their own published list had been wrong for **5 of 13** gimmicks. | Nothing, and that is the point: reading `event.telegraphTicks` kept the renderer correct under *either* mapping throughout the disagreement. Only the fallback constant differed, and it is reached only when the emitter omits the field. | Resolved mapping tabled in §7.4.1 with per-class gimmick ids; §7.6 and R-11 corrected to hazard **60**. This is the worked example for why §7.4.1 mandates field-over-constant. |
| R-19 | **The corridor widths this spec first recorded were unplayable.** `[OBSERVED]` `COMMANDER.radius = 360` → **diameter 720**, so `DungeonLevelDesign`'s original narrowed bands of 700 were *narrower than the actor*, and `validateProfile`'s own 600 floor is narrower still. The "narrowing" was guaranteed chip damage with no damage-free line — a defect the validator passes and the player cannot survive. | My §7.2 intensity table was computed from those widths, so all four intensity values were derived from unplayable geometry. | Corrected set adopted: corridors **1400**, every `corridorWidthAfter` **≥ 900** (> 720 with ≥ 90 units clearance per side), re-validated (VALIDATOR PASS v4). Intensity gain recalibrated 2.4 → **2.8** so the largest real loss still reads full; two distinct deltas now yield two distinct intensities, which is correct — equal width loss must read equal. `[OBSERVED]` **Margin figures corrected again in ruling v10:** cinder's tightest is **+49.86**, not the +133.57 first published, which measured the critical route only before the detour widened. It is a hard geometric limit, not slack — `collapsed-parapet-prop` is frozen by test at `(13200, 9300) r900`, leaving 1000 units for a 900-wide corridor, so the legal window is 100 units split 50/50. `DungeonLevelDesign` swept 597 configurations and chose 90 units of player clearance over 100 units of authoring margin. Correct trade: a felt runtime constraint beats a design-time convenience. |
| R-20 | **`telegraphTicks` is a pre-existing field on an unrelated event — CLOSED in the renderer, but the guard must stay.** `[OBSERVED]` One hit in the blob: `defense-run-simulation.js:2296  telegraphTicks: contestTicks,` on `ENCOUNTER_PATH_CONTESTED` — a contest-hold duration, not an arming window. Found by `AudioFeedbackDesign`; blast radius quantified by `EncounterPacing`; independently confirmed by five agents. | `EncounterPacing`'s vector: `ENCOUNTER_PATH_CONTESTED` fires per routed body per contest waypoint at **120 / 139 / 137** bodies per stage, so a type-agnostic reader mints one telegraph cue per arriving enemy at 60–150 ticks each into a **24-slot** pool, evicting the arrival and gimmick cues it was sized for. | **Ruling v10 CLOSED it by audit, not assumption:** `resolveVfxLifetimeTicks` (`:517-527`) dispatches on `event.type` first; of 10 grep hits **8 are comments and exactly 2 are reads** (`:523` inside `ENEMY_SPAWNED`, `:525` inside `GIMMICK_ARMED`); no shared `effectLifetime(event)` exists; `ENCOUNTER_PATH_CONTESTED` falls to `return table` and is unmapped so `spawnVfx` returns first. §7.4.1 now reproduces the landed function verbatim. **Do not hoist the field read.** |
| R-21 | **This spec's own snippet had two defects, one of them a regression.** `[OBSERVED]` My paraphrase of `resolveVfxLifetimeTicks` (a) guarded with `Number.isInteger(value)` where the landed `telegraphLifetime` (`:514-516`) requires `Number.isInteger(value) && value > 0`, and (b) **omitted the pre-existing `BOSS_ATTACK_TELEGRAPHED` / `windupTicks` branch** (`:520`). | (a) A `telegraphTicks: 0` would be honoured as a zero-tick lifetime — a cue that spawns and retires in the same tick, invisible, and the hardest failure mode to catch in review. (b) An implementer copying the paraphrase verbatim would have **deleted shipped behaviour**, regressing every boss telegraph to its table constant. | §7.4.1 now reproduces the landed function **exactly** rather than describing it, with both the `> 0` guard and the pre-existing branch present and commented as do-not-drop. **Lesson: a spec that paraphrases code it did not write will silently drop the parts it did not think to mention.** |
| R-22 | **Field-name collisions are standing policy, and `reason` — the worst offender — has NO safety barrier in this spec's own pool path.** `[OBSERVED]` Ruling v10: grep the blob before introducing any payload field. `reason` already carries **four incompatible vocabularies** across six emits: lowercase geometry (`:1740` `"bounds"`/`"range"`), SCREAMING_SNAKE reward codes (`:2018`, `:2044`), a pass-through (`:2082`), and a **nullable** rejection string (`:2195`, `:2204`). `recoveryTicks` also pre-exists (`:1049`). Collision-free and safe to introduce: `grade`, `gimmickClass`, `slabId`, `blockId`, `dropId`, `buffId`, `rarity`, `stat`, `magnitude`, `stacks`, `durationTicks`, `expiresAtTick`. | **Strictly more exposed than R-20.** R-20 is protected by `ENCOUNTER_PATH_CONTESTED` being absent from `VFX_MODELS`, so `spawnVfx()` returns before any field read. `reason` has no such barrier: `[OBSERVED]` **`PROJECTILE_EXPIRED` and `EXTRACTION_REJECTED` are BOTH already in `VFX_MODELS`** (inventory rows 9 and 5), so they reach `spawnVfx` on every projectile expiry and every extraction rejection **today**, carrying `"bounds"` / `"range"` / `null`. A `reason`-keyed table would be consulted for them immediately. And it **fails silently** — the value sets do not overlap, so no throw, no wrong-looking visual, nothing in any test not already asserting that exact cue. | My §5.5 (`DROP_DENIED`) and §5.6 (`BUFF_EXPIRED`) both branch on `reason`, so both are written `event.type === "…" && event.reason === "…"` — type **first**, never a bare `reason` lookup. §5.6 carries the right/wrong pair inline. Extends to **presence**-keyed dispatch: `UiOverhaulConcept` showed `ENCOUNTER_PATH_CONTESTED` also carries `objectiveId`, so a presence-keyed chip renders a complete, plausible-looking artefact for a gimmick that does not exist — a defect that looks correct survives review. Allow-set (`GIMMICK_EVENTS.has(event.type)`) before any field read; **never a shared cross-family reader**. |
