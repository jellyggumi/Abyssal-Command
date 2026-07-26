# Stage 1, Phase 1b — Cinder Pressure and Agency Redesign Contract

run-id: `20260726-stage1b-cinder-pressure-agency`
status: `scope-review-required`
source-decision: `../20260726-stage2-balance-agency/production/decision-log.md#d-20260726-s2c-03`
next-public-beat: `deferred until a rendered vertical slice reliably shows a persistent Elite Extract decision`

## 1. Why this packet exists

The final Stage 2 remeasurement is a REDO, not a request for a third data-only retune. The current runtime is deterministic and the signed values are present, but the authored Cinder pressure model does not produce a stable agency window across the required rows, and the existing probes conflate runtime behavior with measurement artifacts.

Observed final facts:

- G2: `10/15` Cinder gate-minimum rows breach `55.0–80.0%`; SPLIT seed `403` defeats before a boss TTK exists. The defeat is a pressure outcome: the run reaches growth without a valid offer and later receives terminal pressure, not a runtime exception.
- G3: TURRET is targetable (`derivedFrontCount=1`), but `0/100` VANGUARD+SPLIT runs down a companion. The aggregate damage is too low relative to T1 formation integrity. The rally-to-TURRET probe also labels switch-tick damage before the switch and measures a 30-second boss pressure grace interval where no incoming boss pressure is expected.
- G7: only Cinder seed `901` reaches extraction in the final scripted run; seeds `902/903` defeat before the extraction window. No persistence trace/state-diff bundle exists.
- G8 and human G7 evidence remain unmeasured.

## 2. Frozen boundaries

This packet does not authorize gameplay-number changes. Until director scope review passes, preserve:

- `CINDER_SPAN_WAVE_PLAN` current runtime values: primary counts `14/10/8` at ticks `0/120/240`, including their existing alternatives.
- `STAGES["cinder-span"].gateTicks = 900`.
- `BOSS_RALLY_COOLDOWN_REDUCTION = 0`.
- `STANCE_CONFIG.TURRET.derivedFrontCount = 1`; `VANGUARD.derivedFrontCount = 2`.
- Occupation/extraction geometry and timing, including extraction `windowTicks=600`, hard floor `180`, and one accepted elite handoff per run.
- Runtime IDs, campaign schema, player-visible canon, GLBs, renderer, global enemy stats, rewards, and no-monetization boundary.

A future tuning proposal may be authored only after this packet's evidence surfaces are implemented and reviewed. Existing G2/G3/G7/G8 thresholds remain unchanged.

## 3. Authored model to review

### 3.1 Pressure budget

Represent each authored Cinder packet as a `pressureBudget` with three observable components, without changing the current values in this packet:

1. `arrivalPressure`: enemy arrivals and their authored policy/lane, measured at the packet boundary.
2. `integrityPressure`: gate and commander integrity loss attributable to the packet, including ordinary attacks and terminal pressure pulses.
3. `agencyOpportunity`: actionable windows opened by the packet (`GROWTH_OFFER`, `STANCE_CYCLE`, `EXTRACTION_WINDOW_OPENED`) and whether the player can respond before the next irreversible outcome.

The measurement surface must emit a per-packet record and a run aggregate. It must distinguish authored pressure from the 30-second boss grace interval and from terminal pressure pulses.

### 3.2 Agency windows

The loop must expose a causal chain rather than only terminal outcomes:

`pressure packet → readable threat → player decision → consequence → recovery or extraction choice`.

Every decision record includes the accepted input, the state immediately before it, the state after it, and the next irreversible event. Omniscient controller inputs remain labelled synthetic; they cannot be used as human evidence.

### 3.3 Formation transition

A formation switch is measured from the accepted `STANCE_CYCLE` event sequence, not from the probe's local boolean. Events with `event.tick >= acceptedSwitchTick` are post-switch for attribution. The probe must report:

- accepted switch tick and target stance;
- living FRONT IDs before and after the switch;
- incoming companion damage by phase;
- `COMPANION_DOWNED` events by phase;
- whether the boss grace interval or a non-boss pressure source was active.

This corrects attribution without changing stance geometry, cooldowns, or damage values.

### 3.4 Rendered agency surface [TARGET]

The Cinder Span vertical slice exposes the simulation snapshot as a single read-only agency readout:

- objective phase: gate defense, echo recovery, growth, occupation, extraction, or boss resolution;
- pressure: remaining objective pressure time plus gate and commander integrity;
- growth: current level/XP or the paused growth-offer count;
- formation: active stance and switch cooldown;
- extraction: hold progress, ready/failed state, accepted extraction, and next-sortie/re-entry cue.

The HUD and world overlay may read these snapshot fields and render existing stage/character/terrain assets, but must not write simulation state or alter `getRunDigest()` inputs. These labels are presentation evidence only; scripted output remains synthetic and cannot satisfy G7/G8 human evidence.

## 4. Acceptance before numerical tuning

The director may consider a future bounded tuning proposal only when all are true:

1. Every one of the 15 Cinder rows reports `gateMinPct`, defeat/terminal reason, and a TTK status (`MEASURED` or an explicit non-spawn reason). No null is silently treated as an omitted field.
2. The formation probe proves targetability and phase attribution over 50 rally-to-TURRET conversions and 50 VANGUARD plus 50 SPLIT runs. The required thresholds remain the existing G3 contract.
3. A symmetric evidence exporter produces 20 paired trials per archetype at seeds `401–405`, with equal value budgets and `archetypeId`, `counterProfileId`, `seed`, `winner`; the legal-combo EV series is machine-readable.
4. Cinder seeds `901–903` produce retained event traces and campaign-state before/after diffs for victory, defeat after acceptance, and defeat before acceptance.
5. A rendered-study packet is ready for G7's 10 participants / 20 eligible decisions / 14 voluntary re-entries and G8's five-title survey plus ten first-exposure sessions.

## 5. Stop conditions

Stop and return to director review on any runtime-ID, canon, extraction-boundary, monetization, renderer, GLB, or schema change; any threshold substitution; any hidden fallback; or any attempt to call synthetic scripted output human evidence.
