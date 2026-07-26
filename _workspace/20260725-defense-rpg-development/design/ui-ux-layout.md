# UI/UX Layout — Stage 2 Readability Slice

run-id: `20260725-defense-rpg-development`

This layout extends the existing lobby/HUD contract. It is a design proposal and measurement checklist, not evidence that the current UI passes. The existing contract requires distinct progression layers, `current → upgraded` values, a readable Gate/threat/Domain/extraction field, and primary targets ≥44 CSS px (`_workspace/20260722-defense-survival-expansion/design/core-loop.md:67-69`).

## Hierarchy by surface

| surface | primary hierarchy | required actions / states | mobile target and fallback |
|---|---|---|---|
| Lobby | 1) stage/objective, 2) Warden + companion summary, 3) loadout and Archive growth, 4) single **Deploy** CTA | stage select, growth/companions/inventory/stronghold tabs, deterministic seed/status | Deploy and tabs ≥44×44 CSS px; stack cards at narrow width; no commerce or network affordance |
| HUD | 1) Gate integrity + Warden integrity, 2) current ingress/priority threat, 3) movement control, 4) skill/item state, 5) compact event feed | move, cast, collect, read telegraph, pause/return | D-pad, skill, extraction and reward controls ≥44×44 CSS px; keep combat focus clear of controls; text fallback for color/audio cues |
| Growth | 1) choice title/role, 2) `current → upgraded`, 3) run lifetime, 4) synergy/eligibility note, 5) confirm | choose exactly one of three authored options | Three cards each ≥44 px tap target; horizontal overflow prohibited; reduced-motion uses static values/status |
| Companion | 1) extracted identity, 2) role/DPS or recovery stat, 3) formation slot, 4) run vs persistent scope | inspect, assign up to three deduplicated companions, read downed/available state | Slot and assign controls ≥44×44; portrait has text/glyph fallback; never hide state in color alone |
| Extraction | 1) elite identity + eligibility, 2) point marker, 3) countdown/Bind progress, 4) success/expiry outcome | enter point, hold Bind, cancel/relocate, read expiry | Bind target and cancel ≥44×44; countdown text remains when motion/audio disabled; marker must not occlude Gate or threat |
| Boss | 1) boss intent/phase, 2) boss HP/TTK, 3) Gate/Warden risk, 4) skill/item cooldowns, 5) route to safe space | evade/pursue, cast, preserve Gate, select reward after victory | Boss intent and HP are text + shape/icon; no strobe-only warning; reward cards ≥44×44 |
| Failure | 1) cause, 2) Gate/Warden/companion state at failure, 3) earned run reward scope, 4) retry/return choices | retry deterministic seed policy, return to lobby, inspect Archive | Retry/return ≥44×44; explicitly distinguish run-local loss from persistent unlock; no shame copy or paid recovery |

## Field readability order

At any combat frame, the player must be able to locate **Gate, priority threat, active Domain, extraction marker, and safe route** without opening a modal. This is a design check derived from `_workspace/20260722-defense-survival-expansion/qa/benchmark-notes.md` and the current core-loop contract, not a human result. If effects overlap, the renderer keeps the status label and geometry marker while reducing decorative particles.

The HUD must keep these layers separate: run item; three-choice skill; derived stat; synergy; extracted companion; stage reward; Archive growth. Every numeric upgrade renders both before and after values. No generic “stronger” label substitutes for a delta (`_workspace/20260722-defense-survival-expansion/design/core-loop.md:44-50,67-69`).

## Verification checklist

- [ ] All actionable controls measure ≥44×44 CSS px at mobile viewport.
- [ ] Gate, threat, Domain, extraction, and safe route each have a non-color cue.
- [ ] Reduced-motion mode preserves text/status/reward semantics.
- [ ] Touch/input p95 is recorded separately from frame p95; the latest baseline worst input p95 is 5.6 ms, while low-tier frame p95 is 24.2 ms (`_workspace/20260725-wellmade-verification/production/gate-reviews/stage-gate-review.md:75-86`).
- [ ] No human-impression score is reported until a reviewer observes a complete stable loop and records the prescribed receipt.
