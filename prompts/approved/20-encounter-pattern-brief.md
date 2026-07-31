# 20 — Encounter pattern brief

- **Version** v1 (2026-07-31)
- **Skill** `/skill:design-game-encounters` (narrowest match; `/skill:design-action-combat` only for
  a boss-phase timing contract, `/skill:bmad-gds` only when the brief spans a whole milestone)
- **Produces** the *language* version of a stage's pattern for `${stageId}` — objectives, the
  pressure source added per wave block, the archetype-to-answer mapping, and the reward cadence —
  before a single number moves in `defense-catalog.js`.
- **Placeholders** `${stageId}`, `${stageName}`, `${sequence}`, `${changeIntent}`
  (new stage | difficulty retune | variation swap), `${briefPath}`.

---

**CONTEXT:**
*Abyssal Surge* is a Three.js + WebGL browser game whose stage patterns are authored data, not
editor scenes. A stage is a `STAGE_WAVE_DOCTRINE` row (`defense-catalog.js`) that generates its own
wave plan, plus a `STAGE_ENCOUNTER_ROUTES` entry that owns every wave slot exactly once and in
objective order, plus a `STAGE_TACTICS` entry that owns the lanes and fields. The simulation is
deterministic: identical seed ⇒ identical `getRunDigest()`.

Shipped envelope (OBSERVED 2026-07-31) — the brief must state where `${stageId}` sits in it:

| | `cinder-span` | `abyss-chancel` | `echo-throne` |
|---|---|---|---|
| hold / waves / cadence | 170 s / 10 / 1020 t | 175 s / 10 / 1050 t | 180 s / 11 / 981 t |
| rhythm | `n n b m n n b m n b` | `n b n m n b n m n b` | `n m n b n n m n b n b` |
| class rotation | rusher > flanker > ranged | ranged > flanker > rusher > guardian | flanker > ranged > guardian > rusher |
| pressure lane / mid-boss | chokepath / guardian | flank / flanker | chokepath / ranged |
| objectives | corridor(0–4) → arena(5–9) | corridor(0–3) → arena(4–9) | corridor(0–5) → arena(6–10) |
| response types | 16 | 17 | 17 |

**ROLE:**
You are an encounter designer who has shipped live action games for twenty years. You define
difficulty as *the number of distinct answers the player must own*, never as an HP multiplier. You
add exactly one pressure source at a time, and you refuse any archetype that duplicates an answer
another archetype already forces.

**ACTION:**

1. State `${changeIntent}` in one sentence and name the single player experience it buys.
2. Write the objective chain in prose: what objective 1 (`corridor`) asks, what objective 2
   (`arena`) asks, and which wave slots each owns. The slots must partition `0…waveCount-1`
   without gaps or overlap, in ascending objective order — `defense-catalog.js` throws otherwise.
3. Write the pressure ledger: one row per wave block, naming the *single* new pressure source it
   introduces (a class, a lane, a mid-boss, a density step, a rule package) and the answer it forces
   (reposition / focus-fire / area burst / hold the choke / close distance / accept chip damage).
4. Map every fielded archetype to a distinct answer, using the shipped table:
   `rusher` gate-pressure 3000 hp / 3000 speed / `ember-rush` 18-6-24 r950 ·
   `flanker` flank 3600 / 3300 / `veil-flank` 12-4-20 r800 → 24-6-26 r1400 ·
   `guardian` elite-escort 9000 / 1700 / `frost-guard` 34-8-40 r1500 field 60 t ·
   `ranged` resource-denial 2800 / 2000 / `void-volley` 40-4-44 lead r1100 range 6000.
   Two archetypes that force the same answer in this stage is a defect: say which one is redundant.
5. Choose the statement waves. A `big` wave is the map's pressure push (chokepath or flank); a `mid`
   wave is a budget-sized wall the gate-defense objective may not close through. Normal waves must
   stay policy-unpinned so the seeded pool keeps `player-pursuit` and `low-hp-focus` in play.
6. State the reward cadence: which wave clears pay `WAVE_CLEARED` recovery, where the growth offers
   land, and where the elite extraction window opens (`windowTicks 600` on all three stages).
7. State the response-type delta this brief intends: which identifiers are added or removed from the
   stage's response set, and why the campaign still escalates (see prompt 27's ratchet).
8. List the fairness argument: the player can see each pressure source before committing, can
   recover after one mistake (`recoveryTicks` 180–300, `maxAttempts: 3`), and cannot be chain-killed
   off screen.

**FORMAT:**
One markdown brief at `${briefPath}` (default
`_workspace/current/design/stage-pattern-brief-${stageId}.md`) with: intent, objective chain,
pressure ledger table, archetype→answer table, statement-wave list, reward cadence, response-type
delta, fairness argument, and an explicit "numbers deliberately omitted" line. No catalog literals,
no counts, no HP values.

**TARGET AUDIENCE:**
The numeric-balance designer who runs prompt 22 next, and the reviewer who will reject any pressure
source that arrives without a stated answer.

**HARD CONSTRAINTS:**

- No numbers beyond the shipped envelope quoted above. Sizing is prompt 22's job; a brief that
  pre-commits body counts corrupts the clear-budget derivation.
- Exactly two encounter objectives per stage: index 0 `corridor`, index 1 `arena`.
- Every wave slot is owned by exactly one objective, in ascending order.
- ≥ 2 `mid` and ≥ 2 `big` waves; the last wave is always `big`.
- A normal wave never pins a policy.
- Determinism is a hard invariant: no proposal may require wall-clock, `Math.random`, or unordered
  iteration in simulation-facing code.
- No Unity/Unreal concepts. Three.js + WebGL only (`CLAUDE.md` §2).

**DONE WHEN:**
`${briefPath}` exists, every fielded archetype maps to a distinct answer, the wave-slot partition is
stated and total, the response-type delta is explicit, and the brief contains no authored body
count. Nothing in `defense-catalog.js` has been touched yet.
