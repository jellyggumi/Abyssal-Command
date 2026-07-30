# Attack-pattern presets and the AI response patterns that answer them

Source capture: [[raw/sources/2026-07-30-motion-generation-and-encounter-pattern-research]]
Applies to: `defense-catalog.js` (`ATTACK_PATTERNS`, `AI_RESPONSE_PATTERNS`, `AREA_*`),
`defense-run-simulation.js` (telegraph/strike path, `applyTelegraphResponse`),
`battle-realtime-three.js` (telegraph ring, area rings).

---

## 1. The problem an attack pattern solves

Before this cycle a body had one attack: a cooldown expired, damage was applied, an event fired.
Two consecutive strikes were indistinguishable, so there was nothing for a player — or for an ally
AI — to read, and no reason to move. A "pattern" is the minimum structure that makes an attack a
*decision* instead of a tax.

## 2. Structure: a looping sequence of three-phase steps

Each step is `telegraph → active → recovery`:

- **telegraph** — the tell. Long enough to be seen and answered; it is what the ground ring fills
  over in the renderer.
- **active** — the only window that authors contact. One step, one contact, one action id.
- **recovery** — the punish window. Authored to be at least as long as the active window, so the
  answer to a heavy attack is always "survive it, then hit back".

Steps are ordered and the sequence loops. `samplePattern(patternId, elapsedTicks)` is a pure,
total function from elapsed time to `{ stepId, phase, phaseTick, actionId, cycleTicks }`. Two
properties are load-bearing and tested:

- one `actionId` spans a step's three phases (so a beat is one beat), and
- every loop mints a new `actionId` (so a repeat is a new beat, not a continuation).

Because the sampler is pure, any phase of any pattern is reproducible from `(patternId, elapsed)`
without playing the encounter — that is what makes pattern fixtures reviewable.

## 3. Why a state machine and not a behaviour tree (S4)

S4 describes behaviour trees as "a tree of hierarchical nodes that control the flow of decision
making", whose power is "multiple different courses of action, in order of priority from most
favorable to least favorable", with a `Running` status because "a particular node or branch in the
tree may take many ticks of the game to complete".

We take two things from it and reject a third:

- **Taken — multi-tick actions.** A telegraph is a `Running` node in BT terms: it occupies the body
  for N ticks and can *fail* (target left contact range → `*_ATTACK_CANCELLED`).
- **Taken — priority-ordered fallbacks.** The AI response set is a selector in spirit: evade first,
  brace if evasion cannot clear the disc, and spread when the disc is shared.
- **Rejected — a general BT runtime.** This simulation must stay bit-deterministic and cheap per
  tick (60 Hz, hundreds of bodies). A data-driven step table plus a pure sampler gives the readable
  structure without a per-tick tree walk or a per-body blackboard. S4's own warning about "per tick
  traversal of the entire tree" is the reason.

S4's random selector idea is deliberately **not** used: randomised ordering would break replay
determinism, which is a hard invariant here (CLAUDE.md §2).

## 4. Authored presets

| Pattern | Body | Shape of the cycle |
|---|---|---|
| `ember-rush` | rusher | one short tell, one contact — readable at a glance |
| `veil-flank` | flanker | fast poke, then a wider arc, so spacing alone is not a full answer |
| `frost-guard` | guardian | one slow wide slam that leaves a short field |
| `void-volley` | ranged | long tell, lead-shape ring that punishes standing on the volley |
| `cinder-warden-cycle` | stage 1 boss | cleave, then a lead disc that leaves a 3 s field |
| `veil-tactician-cycle` | stage 2 boss | ring that punishes hugging, then a lead disc that punishes running |
| `gate-sovereign-cycle` | stage 3 boss | three escalating steps ending in the widest contact in the game |

Every step declares `radius`, `damageBp`, optional `weightBp`, optional `fieldTicks` and an optional
`element`. Timing lives only here; behaviour code reads it and never copies it.

## 5. AI response patterns

`AI_RESPONSE_PATTERNS` are read by the simulation at the tick their trigger fires, not by the UI:

| Response | Trigger | Effect in the simulation |
|---|---|---|
| `evade` | a live telegraph disc covers the body | the body's formation anchor is pushed radially outside the disc for the window |
| `spread` | two or more allied bodies are covered by one disc | the anchors fan apart, so the legion stops eating one disc together |
| `brace` | the body is too deep inside the disc to clear it | incoming area share is scaled down for the window |
| `punish` | the attacker entered recovery | allied fire cooldown is scaled down for the window |

Each is a bounded window (≤ 300 ticks) that decays on its own; none is a persistent state, so the
formation always returns to its authored offsets.

## 6. How this pairs with the always-area damage model

Every contact resolves as a disc (`AREA_*` in `defense-catalog.js`), with the share of a body at
distance `d` given by

```
share = falloff(d, radius) x weight(source) x matchup(attackerElement, defenderElement) x sustain(durationTicks)
```

The pattern preset supplies `radius`, `weight`, `element` and `fieldTicks` for the step being
executed. That is the coupling that makes the four balance axes visible in play: a wide, long,
on-element step is the strongest configuration and is also the one with the longest tell, which is
exactly the trade the response patterns exist to answer.

## 7. Verification

`tests/area-combat-model.test.mjs` covers: phase boundaries at every step of every pattern, action
id stability across a step and renewal across a loop, tell/active/recovery authoring invariants,
response-window bounds, live emission of telegraph + response events, per-contact splash structure,
distance monotonicity within an element column, field cadence and expiry, and digest determinism.
