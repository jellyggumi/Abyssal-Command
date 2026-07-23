# QA discovery notes — hypotheses and evidence gaps

## Observed constraints

- The binding contract is a mobile-first, offline, deterministic 60 Hz, movement-first automatic-combat campaign; presentation reads snapshots only; Stage 10 completes the campaign (`docs/abyssal-command-defense-survivor-design.md`).
- The survey records no observed player comprehension, immersion, return, or accessibility outcomes for this proposed 90-second slice (`.survey/abyssal-command-systems-expansion/context.md`, `solutions.md`).
- All new numeric bands in the research packets are targets. They need fixed fixtures, local exports, and participant evidence before use as achieved values.

## Testable discoveries to pursue

```yaml
discovery_hypotheses:
  D01:
    claim_to_falsify: "A bounded MapKey/MapPlan grammar can vary routes and pressure without changing authored objective/campaign semantics."
    evidence_needed: "64-key exact replay corpus, rejection cases, descriptor coverage, and reduced-motion observer differential."
    source: research/pcg-map-grammar.md
  D02:
    claim_to_falsify: "Mandatory relief and role rotation create readable non-repetitive pressure without extra controls."
    evidence_needed: "Card lint plus paired grammar/density study and subjective repetition/fairness reports."
    source: research/wave-encounter-composition.md
  D03:
    claim_to_falsify: "Health, crit, and cooldown feedback is truthful and readable without color, sound, or motion dependence."
    evidence_needed: "Rule-event-to-snapshot joins, capture audit, and modality-separated action/interpretation probes."
    source: research/combat-systems-balance.md
  D04:
    claim_to_falsify: "The five analytical archetypes have distinct viable trade-offs rather than one dominant route."
    evidence_needed: "Paired equal-budget seed sweep; distribution, not mean-only, analysis."
    source: research/combat-systems-balance.md
  D05:
    claim_to_falsify: "Caption-first, local audio/narration enriches meaning while a missing/decode-failed asset changes no rules or comprehension path."
    evidence_needed: "Network-blocked fallback matrix, asset/provenance audit, caption study."
    source: research/elevenlabs-integration.md
  D06:
    claim_to_falsify: "One active-issued, one-settlement Archive Return Permit is idempotent, fair, and non-substitutive."
    evidence_needed: "Clock/save fault property corpus and account parity fixtures; no human motivation claim before moderated study."
    source: research/progression-idle-economy.md
  D07:
    claim_to_falsify: "A stage/world handoff can explain W-01..W-05 from confirmed state without inventing lore, persistence, or Stage 11."
    evidence_needed: "Payload allowlist/schema tests and caption-first recall probe."
    source: research/narrative-stage-presentation.md
  D08:
    claim_to_falsify: "Touch, keyboard, controller, accessibility preferences, and observer cadence normalize to identical rule outcomes."
    evidence_needed: "Fixed normalized action stream differential with focus/rotation/overlay cases."
    source: research/controls-accessibility.md
```

## Known gaps and decision blockers

1. The Stage 1 design/PM/engineering/ops outputs are not input evidence until authored and versioned. QA must bind future measurements to their digests, never infer their content.
2. No fixed MapKey corpus, rules extension, telemetry schema implementation, local export, or participant assignment manifest exists yet. Therefore G1–G8 stay NOT MEASURED.
3. ElevenLabs research permits only a private build-time candidate asset process after rights review; it does not authorize credentials, a provider account, asset generation, or runtime requests.
4. Idle value, cap, 10–20-session parity, feedback recognition, immersion, and loop repeat targets are proposed outcomes—not existing metrics.
5. The no-commerce boundary means a paid/free comparison must be explicitly marked non-applicable for the current product rather than treated as a tested zero difference.

## QA next evidence order

1. Freeze versioned rules/grammar/serializer and fixture manifest.
2. Produce PCG/wave/health/choice/idle deterministic property evidence.
3. Run observer differentials with all presentation/accessibility/provider-failure states.
4. Triage any exact failure into `qa/defect-register.md` and broadcast it.
5. Only then run preregistered, local, consented moderated readability/loop/immersion sessions.

No defect or gate pass is claimed by these notes.