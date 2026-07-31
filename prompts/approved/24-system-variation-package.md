# 24 — System variation package (modifiers, depths, rule variants)

- **Version** v1 (2026-07-31)
- **Skill** `/skill:game-studio-harness` (freshness gate) with `/skill:tune-enemy-ai` for the
  behaviour half; `/skill:build-game-inventory` when the package touches drops or carry-over
- **Produces** a *rule change* rather than a stat change: a new or retuned `ABYSS_DEPTH_PACKAGES`
  entry, or a swap along one named variation axis for `${stageId}`.
- **Placeholders** `${stageId}`, `${depth}`, `${axis}`, `${packageName}`, `${briefPath}`.

---

**CONTEXT:**
The repository already owns the modifier concept. `ABYSS_DEPTH_PACKAGES` (`defense-catalog.js`,
`ABYSS_DEPTH_MAX = 3`, unlocked by cleared stage count in `app.js`) is a *named rule package*, not a
global multiplier:

| depth | name | policy mix (per wave index) | elite policy | escorts | aura | recovery cap | reward tier |
|---|---|---|---|---|---|---|---|
| 1 | 재의 추격 | pursuit, pursuit, gate-pressure | player-pursuit | +1 | ember | 0.25 | 1 |
| 2 | 메아리 기근 | denial, denial, flank | resource-denial | +1 | frost | 0.12 | 2 |
| 3 | 협공의 장막 | flank, low-hp-focus, flank | flank | +2 | veil | 0.20 | 3 |

Depth 0 is identity (no package). `buildWaveSchedule()` reads the package to pin the normal-wave
policy per wave index and **does not advance the RNG** to do it, so enabling a depth does not shift
the downstream stream. Presentation reads it for naming, toast and tint only.

The other authored variation axes (`scripts/scan-stage-variation.mjs`, 20 axes): wave-kind rhythm,
wave count, cadence, hold, gate integrity, class rotation, mid-boss class, pressure lane, spawn
directions, normal/big concurrency, spawn interval pair, commitment pair, objective shape, seeded
variation triple, hazard dps, occupation hold, extraction window, elevation multiplier, elite kind.
Shipped ranges: hazard 8–16 dps, occupation hold 180–330 t, jitter ±12/27/18 t, lane ±300/660/420,
elevation ×1.08–1.13, concurrency 8/9/10 → 22/24/26, interval 18/24/15 → 5/6/4.

**ROLE:**
You are the freshness owner. Your test for a variation is: *does the player have to do something
different, or only more of the same?* A package that changes numbers without changing a required
answer is rejected by definition.

**ACTION:**

1. Name the axis `${axis}` (or the depth `${depth}`) and state the single rule it changes.
2. Write the before/after in behaviour terms: which policy each wave index now carries, which extra
   escort appears, which recovery is cut, which reward tier is paid. Quote the identifiers.
3. Prove the change is not a multiplier in disguise: list the stat values before and after. If any
   HP, damage, or count changed, this is a balance change and belongs in prompt 22.
4. State the novelty claim as a set difference on the stage's response set (prompt 27's
   `responseSetFor`): which identifiers enter, which leave, and the resulting count.
5. State the interaction with the seeded pool. Pinning a policy per wave index removes the roll for
   that index; say which behaviours the player will no longer see at this depth and why that trade
   is worth it.
6. State the RNG contract explicitly: the package must be *read*, never *rolled*. If the change
   requires a draw, it is a digest-visible simulation change and needs the simulation owner's
   decision plus a before/after `getRunDigest()` for every stage.
7. Define the measurement. A package that is never measured is decoration: name the seeds, the
   stage, and the metric (playtime, gate-integrity floor, defeat count) you will compare at depth 0
   vs `${depth}` in prompt 25.
8. State the presentation contract: the package's name, dominant label and tint are display-only
   (`app.js` toast + `dataset.abyssDepth`), and may never feed back into simulation state.

**FORMAT:**
A markdown section appended to `${briefPath}`: axis/depth statement, behaviour diff table, stat
non-diff proof, response-set delta, seeded-pool trade, RNG contract line, measurement plan,
presentation contract. Plus the exact catalog literal when `ABYSS_DEPTH_PACKAGES` changes.

**TARGET AUDIENCE:**
The freshness reviewer and the simulation owner, who will check that the RNG stream is untouched and
that the novelty claim is a set difference rather than an adjective.

**HARD CONSTRAINTS:**

- A package changes RULES (policy, escorts, recovery cap, reward tier). It never becomes a global
  stat multiplier — that path is closed deliberately.
- Depth 0 must stay byte-identical to no package at all.
- The package is read without advancing the RNG. Any added draw is a reported digest change.
- Presentation is downstream: naming/tint/toast may not alter simulation state (`CLAUDE.md` §2).
- One axis per change. Two simultaneous axis swaps cannot be attributed by measurement.
- `scripts/scan-stage-variation.mjs --strict` must still pass afterwards (no pair above 0.20 shared
  axes, response types never falling across the campaign).
- No Unity/Unreal "modifier stack" abstractions; this is frozen plain data.

**DONE WHEN:**
The behaviour diff is stated in identifiers, the stat non-diff is proven, the response-set delta is
computed, the RNG contract line is explicit, the measurement plan names seeds and metrics, and
`node scripts/scan-stage-variation.mjs --strict` exits 0.
