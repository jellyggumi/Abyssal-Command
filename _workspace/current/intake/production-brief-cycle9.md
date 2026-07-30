# Production brief — cycle 9: 게임 흐름 개선

run-id: `20260728-onslaught-action-pivot`
cycle: 9
director: game-production-director
operating mode: **Stage 2 re-entry — core-loop restructure + control feel**
next public beat: 사람 플레이 판정으로 G4/G7/G8 재측정

---

## 1. bmad-gds intake schema

| Field | Value |
|---|---|
| game_type | Isometric action roguelite, wave-defense → extraction loop, browser |
| team_shape | Single operator + agent studio harness (5 roles) |
| engine | **Three.js + WebGL** (`vendor/three.module.js`), Canvas2D fallback |
| current_stage | Stage 2 (balance / core-loop stability), re-entered from cycle 8 close |
| next_public_beat | Human-play adjudication of G4 / G7 / G8 |
| source_packet | Operator request + `intake/reference-video-analysis.md` + 4 code-discovery reports |
| main_constraint | Deterministic simulation is a hard invariant. `getRunDigest()` byte-identity for depth-0 must survive every change (PR #10 contract). |
| main_question | Does the loop become "dungeon → waves → midboss → extract → build legion" without breaking digest determinism or the HUD responsive contract? |

**One operating mode declared**: this cycle restructures the **core loop and control
feel**. It does not open concept work, does not touch monetization, and does not
start launch ops. Presentation work is admitted only where it communicates a
system this cycle changes (CLAUDE.md §2 lifecycle order).

---

## 2. The request, decomposed

Operator request, split into what it actually requires:

| # | Request (원문) | Reality found in code | Work class |
|---|---|---|---|
| 1 | 정해진 던전에서 적 웨이브 생성, 웨이브 처치 | **Exists.** Seeded `buildWaveSchedule()` + FIFO `spawnQueue` + `processWaveClearRecovery()` | none |
| 2 | 중간보스부터 추출 가능 | **Midboss exists** (`MIDBOSS_PROFILE`, per-wave). **Extraction opens only post-boss** — phase order is `boss-kill → extraction` | **gating change** |
| 3 | 추출하여 군단을 꾸림 | Live extraction sets a **binary `run.extracted` flag**. Corpse→channel→companion pipeline is **deferred, zero imports** | **integration** |
| 4 | 기본 3개, 최대 10개 | `MAX_LOADOUT_SIZE = 3` live (`campaign-state.js:22`). **No unlock mechanic exists** | **new system** |
| 5 | 레벨·비용지불로 해금 | `Bound Fragment` currency + stage-clear gates exist and are reusable | **new system, reusing primitives** |
| 6 | 에임에 맞는 타겟팅 | **Nearest-enemy auto only.** `aimDirection()` derives from nearest, never from player input | **new system** |
| 7 | 캐릭터별 공격 패턴 차이 | Live attack = binary adjacent-melee-else-orb. 12-weapon/5-AoE catalog is **deferred, zero imports** | **integration** |
| 8 | 가상키패드 → 가상조이스틱 | **A joystick already exists** — but emits **8-way quantized octants** and is gated to touch-landscape only | **quantized → analog** |
| 9 | 이동방향으로 캐릭터가 바라보게 | **Already implemented.** `atan2(dx,dz)` from real movement delta, `FACING_TURN_RATE=12` | none (verify only) |
| 10 | 카메라가 플레이어를 따라가게 | **Already implemented.** Commander-targeted orbit, `POSITION_LAMBDA=6`, `LOOK_LAMBDA=11` | none (verify only) |
| 11 | 캐릭터 비율·크기 반영 | No JS scale constants; scale is intrinsic to GLB meshes | **investigate before acting** |
| 12 | 스킬 이팩트 개선 | `spawnVfx()` + `SKILL_VFX_MODELS` + `applySkillVfxSilhouette()`, pool cap 24 | **extend at seam** |
| 13 | UI 전면 개편 (open-design) | See §4 — the named tool is not runnable here | **adapted discipline** |

### The three findings that change the plan

1. **Items 9 and 10 are already done.** The camera already follows the commander
   with exponential smoothing and the character already faces its true movement
   delta. Re-implementing them would be churn. They move to *verification*.

2. **Item 8 is a misdiagnosis with a real defect underneath.** There is no
   "virtual keypad" to replace — there is a joystick that **quantizes to 8
   octants** (`JOYSTICK_OCTANTS`, `app.js:74`). It *feels* like a keypad because
   it is one, functionally. The fix is quantized → continuous analog, plus
   removing the touch-landscape-only gate.

3. **Items 3, 7 and much of 4 are integration, not invention.** Six engineering
   modules were authored in cycle 8 and **never imported by anything** —
   confirmed by grep across the entire runtime and test tree. They are designs,
   not code-in-service.

---

## 3. Blocking defects found during intake

These were found by reading the deferred modules, and they gate item 3.

### D1 — Module-level mutable counters break determinism (S1)

Four counters generate entity IDs from process-lifetime mutable state:

| File | Line | Counter |
|---|---|---|
| `_workspace/current/engineering/extraction-system.js` | 62 | `corpseSeq` |
| `_workspace/current/engineering/extraction-system.js` | 193 | `companionSeq` |
| `_workspace/current/engineering/leveling-system.js` | 104 | `companionCombinationSeq` |
| `_workspace/current/engineering/leveling-system.js` | 105 | `equipmentCombinationSeq` |

Two runs of the same seed in one process produce **different entity IDs**. CLAUDE.md
§2 makes deterministic simulation a hard invariant. Integrating these as-authored
would break replay identity.

**Resolution**: derive IDs from run state, not module state. The repo already has
the canonical primitive — `nextId(run, kind)` is used by `spawnEnemy`/`spawnBoss`,
and the run seed is already coerced to an **xorshift32** state
(`defense-run-simulation.js:3163`). Use `nextId`. Do not introduce a new ID scheme
and do not call `Math.random()` (`engineering/migration-map.md:82` forbids it).

### D2 — Deferred extraction contradicts the requested gating (S2)

`extraction-system.js:4-10` states *"ALL enemy types are extractable — basic,
mid-boss (SHADOW), and boss (BOSS)."* The request is extraction **from the midboss
onward**. Basic trash must not be extractable.

### D3 — `addCompanion()` has no capacity gate (S2)

`defense-run-simulation.js:643-667` pushes to `run.companions` with no length
check. A 4th+ companion can already be added mid-run today. Any capacity system
must gate here, not only in `campaign-state.js`.

### D4 — Digest surface is the whole commander object (S1 risk)

`getRunSnapshot():3510` is `commander: run.commander` — the entire object, so
**any** new commander field enters `getRunDigest()` and breaks depth-0
byte-identity. Mitigation is mandatory and specified in
`design/core-loop-legion-spec.md#analog`.

---

## 4. open-design routing decision — stated honestly

The operator asked for `open-design-game-ui-concept` and related skills. Verified
environment state:

| Requirement of that skill | Actual state |
|---|---|
| `nexu-io/Open Design` app on `127.0.0.1:5173` | **Not running** — `curl` returns HTTP `000` |
| `docs/hard-rules/ui-adaptation-upgrade-only-contract.md` | **Absent** from this repo |
| Codex run locked to `gpt-5.6-sol` + `ultra` reasoning | External model run, not available in-session |
| Its capture script's expectations | Traverses for Darkbone's **five character rigs**; this game has none |
| Target identity | Skill encodes **Darkbone Archer** — pharaonic stone-gothic, bone-gilt/soul-teal, Wedjat eyes, six meta screens |

The skill is bound to a **different game**. Its generation loop cannot run here,
and its visual language is not ours.

**Decision (D-20260730-C9-01)**: adopt the skill's *transferable discipline* —
per-screen player-job table, distinct viewport compositions (not scaled copies),
player-lens review order, per-component authority matrix, and the quality gate
(squint test, 3-second read, ≥44×44 touch targets, zero overflow) — applied to
**Abyssal Lantern's own** identity. Do **not** fabricate an Open Design project
id, run id, artifact SHA-256, or preview manifest. No such artifacts exist and
none will be cited.

---

## 5. Scope boundary for this cycle

**In scope**
- Extraction gating: midboss-onward, corpse→channel→companion integration (D1, D2 fixed first)
- Legion capacity: dynamic 3→10 with level + cost unlocks reusing Bound Fragment
- Analog movement input, digest-safe
- Aim-based targeting alongside existing auto-target
- Range ring + skill-VFX extension at the documented seam
- HUD restructure under the adapted open-design contract

**Out of scope, explicitly**
- Monetization tuning (no G5 work this cycle)
- New asset generation (no `gti` / `ppgen` runs; no new meshes or motion)
- Character mesh rescaling until measured — item 11 is *investigate*, not *change*
- Unity/Unreal anything
- Promoting any deferred module wholesale without the D1 fix

---

## 6. Gate posture entering the cycle

Carried from cycle 8 close, unchanged by this brief:

| Gate | Status entering cycle 9 |
|---|---|
| G1 세계관 | PASS (cycle 8), unaffected |
| G2 밸런스 | 재측정 필요 |
| G3 편성 | **재정의 필요** — capacity system changes the axis |
| G4 몰입/접근성 | 재측정 필요 (사람 플레이) |
| G5 매출 | out of scope this cycle |
| G6 운영/성능 | 재측정 필요 |
| G7 코어 루프 | **재정의 필요** — loop shape changes |
| G8 최초 노출 | 재측정 필요 |

No gate is promoted by this document. A brief is not a measurement.

---

## 7. Concurrent-session boundary — D-20260730-C9-02

**[OBSERVED]** A second session is editing this repository at the same time. Its
brief, `_workspace/current/intake/production-brief-cycle10-stage-dungeon.md`
(untracked, authored ~22:55), declares **cycle 10 — 스테이지 던전 구성** and enters
at Stage 1 (content/asset axis) while this cycle sits at Stage 2 (core-loop axis).

It authored its own ownership table against this brief. Reconciled boundary:

| Concern | Owner |
|---|---|
| Core-loop order, extraction gating | **cycle 9 (this brief)** |
| Legion capacity 3→10 | **cycle 9** |
| Analog input vector + aim **contract** | **cycle 9** — cycle 10 names `design/core-loop-legion-spec.md` as the joystick authority |
| Joystick DOM/CSS surface, visibility cutover | **cycle 10** |
| Full UI overhaul (HUD restructure) | **cycle 10** |
| Stage dungeon layout, routes, terrain assets | **cycle 10** |
| Drop/buff systems, new VFX cues, footstep audio | **cycle 10** |

### Consequence for this cycle's scope

The HUD restructure declared in `ui/battle-hud-concept-cycle9.md` §2 and the
bottom-centre pedestal restyle are **ceded to cycle 10**. `InputHudAnalog` was
steered mid-flight to drop both and keep only:

1. the analog payload contract in `app.js` (the half cycle 10 explicitly ceded), and
2. the minimal `joystickActive()` media-query change at `app.js:2351-2352`, retained
   because analog input is otherwise unreachable in portrait — contract-adjacent,
   not styling.

`ui/battle-hud-concept-cycle9.md` therefore stands as a **design contract for
cycle 10 to consume**, not as this cycle's implementation target. Its player-job
table and quality gate remain valid; its execution moves.

`RendererPresentation` keeps the ground range ring and enrichment of **existing**
skill/impact VFX (both serve this cycle's targeting and extraction work) but must
not add new VFX event types for drops, enemy spawns, or terrain deformation, and
must not re-architect the VFX event catalog.

### Why the boundary was honoured rather than raced

CLAUDE.md §5 forbids restoring, discarding, or force-overwriting another session's
changes, and requires that collisions be stopped, documented, and resolved
explicitly. Both sessions were about to edit `app.js` and `styles.css` for the same
joystick visibility gate. Narrowing this cycle was cheaper and safer than
reconciling two divergent CSS rewrites of the same selectors after the fact.

**Ceding UI execution does not weaken this cycle's acceptance.** The analog input
contract, extraction gating, capacity system, and aim targeting are all verifiable
without the HUD restructure — via digest identity, unit/contract suites, and a
browser check that the stick produces continuous analog movement. What is lost is
the *presentation* of new state (legion `n/cap`, extraction badge), which is
cycle 10's to render and is recorded above as a handoff, not as completed work.

### Boundary correction — lobby capacity is enforcement, not presentation

The §7 rationale above originally described what was ceded as "the *presentation*
of new state (legion `n/cap`, extraction badge)". **That was inaccurate and would
have shipped this cycle's headline feature unreachable.**

`app.js` hardcodes the cap of 3 as **enforcement** in the lobby companion row
[OBSERVED]:

| Site | Code | Effect |
|---|---|---|
| `app.js:632` | `const full = !deployed && loadout.length >= 3;` | computes "roster full" |
| `app.js:634` | `${full ? " disabled" : ""}` | **disables every remaining companion chip** |
| `app.js:637` | `` `${loadout.length}/3` `` | hardcoded count display |
| `app.js:639` | `loadout.length >= 3` | selects the hint branch |
| `app.js:641` | `"최대 3명까지 편성할 수 있습니다."` | hardcoded copy |

Had this stayed ceded: `campaign-state.js` would resolve a capacity of 6, the
simulation would accept 6 companions, every sim and contract test would pass — and
the player would **still be hard-blocked at 3**, because the 4th chip renders
`disabled`. A feature that is green in tests and dead in the product.

**Correction (part of D-20260730-C9-02)**: these five sites are **capacity
derivation**, the same `MAX_LOADOUT_SIZE` blast radius, sitting in a pre-existing
**lobby** surface. They are not the battle-HUD restructure cycle 10 claimed.
Cycle 9 owns their **correctness**; cycle 10 owns their **restyling**.

Acceptance attached: with capacity at base 3 and nothing unlocked, rendered lobby
output must be byte-identical to today (`0/3`, identical disabled behaviour,
identical copy). A player who has unlocked no slot sees no change whatsoever.

**Note for the cycle-10 session**: `app.js` lobby companion-deployment logic is
not the same surface as the battle-HUD overhaul. If you intend to restyle
`#lobby-companion-row`, `#lobby-companion-count`, or `#lobby-companion-hint`, read
the dynamic capacity from `companionCapacityForCampaign(campaign)` rather than
reintroducing a literal `3`. This note is the handoff; the boundary table above is
otherwise unchanged.
