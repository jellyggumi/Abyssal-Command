# Core loop — move, read, commit, record

**Stage 1 status:** proposal only. All timings and gates are **UNVERIFIED / UNPASSED**. This is a design handoff, not a claim that any loop exists at runtime.

## Run loop

```text
choose existing stage / local settings
  -> materialize authored-spec + saved-key MapPlan before tick 0
  -> ingress and orientation: read Domain/objective/Gate route
  -> movement-first pressure: auto-combat resolves, player routes
  -> XP threshold: compare 3 run-only choices
  -> objective/bind/extraction state under bounded waves
  -> Gate / boss result
  -> factual W-05 recap and existing campaign transition
  -> optional one-settlement Archive Return Permit on a later resume
```

### 1. Pre-run contract

The player chooses only available local settings and an existing stage. Handedness, sensitivity, sound, high-contrast, and reduced-motion preference can change projection/input ergonomics only; they cannot alter seed choice, PCG result, event order, combat RNG, reward outcome, or campaign state.

Before tick 0, authoritative state commits an authored `StageMapSpec`, versioned `MapKey`, validated `MapPlan`, and digest. A bare UI seed is insufficient. The phase backbone remains `Ingress -> Orientation -> Approach -> ObjectiveAnchor -> Gate -> Resolution`; optional detours rejoin and cannot replace the objective or Gate.

### 2. Movement and automatic combat

The player uses movement to make route and hazard decisions. Basic attack and companion targeting are catalog-owned automatic outcomes. Avoidable danger receives pre-impact, impact, and recovery states at its world location; player damage is confirmed after resolution; health and W-03 Gate Integrity persist at the edge. No manual aim, target ID, combo input, or command queue enters the loop.

A skill may be an authored player-facing affordance, but its accepted/cooldown/unavailable result is deterministic on the next eligible simulation tick and the catalog still owns its target/result. A cooldown is feedback for a meaningful route/elite decision, not a reflex prompt for arbitrary manual targeting.

### 3. Build choice

At an XP threshold, the rules offer at most three simultaneous, run-only options. Each must expose one mechanical effect, one tactical role, and before/after values where numerical. A recommendation may state its build reason but never removes choice. The offer is immutable for the same seed/input state and commits exactly one valid option.

Temporary skills remain run-only. The existing persistent layer may hold campaign/companion state as already authorized; it does not retain the temporary build after defeat/restart.

### 4. Seeded route and varied waves

Map variation is constrained by an authored module palette, ports, integer ranges, branch cap, pressure budget, and finite candidate budget. Candidate rejection is logged; an exhausted budget is a content/build failure, never a silent fresh seed or wall-clock fallback.

Encounter variation uses authored cards and stable, domain-separated seeded selection. The **UNVERIFIED TARGET** anti-boredom contract for a 12-card window is:

- at most two exact encounter-signature duplicates;
- no repeated three-card n-gram;
- no consecutive objective card;
- at least three primary role families across four non-relief cards;
- each pressure segment has a **900–1,500 tick** relief interval with zero major spawns and a reachable lane.

Wave variety is subordinate to the map's authored objective and pressure envelope. It may alter approach, flank, hazard, support, and relief composition, but cannot make an objective disappear, change a reward, advance stage order, or break a valid route.

### 5. Objective, Gate, and world result

W-01/W-04 orient the player to a committed stage plan. W-02 acknowledges a confirmed objective/bind/extraction edge. W-03 presents persistent integrity/boss state. W-05 summarizes only a committed result.

Boss victory may expose the existing authored reward and unlock transition. Stages 1–9 may hand forward the committed next-stage milestone. **Stage 10 victory ends the campaign.** It never starts a Stage 11 run or implies one through a recap, BGM cue, or narrator line.

### 6. Archive return, not idle combat

An active run conclusion may issue one local `Archive Return Permit`. On later resume, it can settle once using a fixed-point, capped formula with a static receipt. Its **UNVERIFIED TARGET** model caps accepted absence at 12 hours and credit at 20% of the active record value. It can prepare only an equal-power Archive sidegrade, needs at least 80% active Field Seals plus a distinct active confirmation, and cannot grant XP, stage/boss progress, extraction success, companion unlock, campaign completion, or combat stats.

## Feedback loop inside the core loop

| Resolved state | Essential player reading | Allowed enrichment | Must not happen |
| --- | --- | --- | --- |
| Threat / W-03 danger | Static non-color world boundary + edge health/integrity state. | P0 cue, restrained haptic, motion. | Audio/motion cannot provide the only warning or alter timing. |
| Player damage | Stable HUD change plus directional wedge. | Brief impact sound/haptic. | Full-screen red wash, predicted damage, or bar-driven rules. |
| Critical | Distinct static fracture-ring/`CRIT` identity. | Brief angular motion and cue. | Reroll, damage boost, flash/strobe, or telegraph occlusion. |
| Skill/cooldown | Confirmed area/result plus ready/not-ready shape. | Sparse local VFX/cue. | Manual targeting by HUD or a cooldown clock based on render elapsed time. |
| Boss / stage result | Persistent elite/boss identity or factual result caption. | BGM stem, optional local narration. | A cinematic or cue completion that blocks input or owns progression. |

## Proof obligations

| Loop claim | Future proof artifact | Status |
| --- | --- | --- |
| Same seed/input produces the same map, events, offers, rewards, and hash under 30/60/120 Hz projections and accessibility modes. | Fixed replay corpus, checkpoints, observer logs. | **UNPASSED** |
| Every seed stays inside map/encounter authored bounds and retains objective/Gate readability. | Seed corpus, candidate logs, objective probes. | **UNPASSED** |
| A reduced-motion/muted projection retains health, hazard, crit, cooldown, and stage-result semantics. | Semantic snapshots and first-seen probe results. | **UNPASSED** |
| Archive return stays small, transparent, local, and idempotent. | Clock/save fault matrix and parity fixtures. | **UNPASSED** |

## Research basis

- `research/pcg-map-grammar.md`, `research/stage-world-procedural.md`, `research/wave-encounter-composition.md`
- `research/combat-systems-balance.md`, `research/combat-feedback-controls.md`, `research/controls-accessibility.md`
- `research/progression-rewards-idle.md`, `research/progression-idle-economy.md`
- `research/vfx-hud-feedback.md`, `research/narrative-stage-presentation.md`
- `research/telemetry-playtest-contract.md`, `research/qa-measurement-protocol.md`
- Current product contract: `_workspace/20260722-defense-survival-expansion/design/gameplay-contract.md`
