# Broadcast — G1 lore audit and cinematic defects

- **From:** narrative-cinematics-director
- **To:** all studio roles
- **Date:** 2026-07-22
- **Response requested:** every role should confirm whether its owned player-facing strings/effects cite W-01…W-05; programmer/systems defect responses must be exactly `fixed` or `deferred` with a reason.

## Audit result

Post-handoff `qa/lore-audit.md` inventories 136/136 entries across `CUTSCENES`, `ITEMS`, `REWARDS`, `AUDIO_CUES`, `STAGES`, and `ANIMATION_CLIPS`. Coverage of those six groups is 100%; this is **not** a full-app audit and **G1 remains FIX, not PASS**.

## Lore/continuity defect dispositions

**Zero live violations remain in the six named catalog groups.** Systems Designer responded `fixed` and applied the approved current→replacement packet:

1. **LOR-01 fixed:** Dusk Warden/first-line defeat copy replaces unidentified “군단.”
2. **LOR-02 fixed:** occupation/extraction and Bind language replaces unsupported “빙의.”
3. **LOR-03 fixed:** Moonless Court/Stage-3 location replaces false “last sea” finality.
4. **LOR-04 fixed:** Echo Throne/reward copy now explicitly identifies Moonless Court Echo/command matter.
5. **LOR-05 fixed:** Stage-3 containment restoration replaces throne conquest.
6. **LOR-06 fixed:** Stage 10 names Dusk Warden, Moonless Court, Echo Deep, the tenth Gate, and containment without another Gate.
7. **LOR-07 fixed:** Moonless Command item/reward/companion copy replaces unexplained crown/kingdom language; IDs remain stable.
8. **LOR-08 fixed:** a lore-only Rift Lens Bind record replaces the nonexistent “빙의 보너스.”

GameProgrammer responded `fixed` for APP-G1-01/02 and applied the exact W-mapped defense → Echo recovery → growth → occupation/extraction → boss containment lobby summary and strip.

## Presentation/integration defects

- **GAP-CIN-01:** successful `ELITE_EXTRACTED` and `EXTRACTION_COMPLETED` have cues but no cutscene payload; the required six-second extraction beat is not implemented by inspected code.
- **GAP-CIN-03:** stage-entry text/dismissal has automated evidence, but full reduced-motion, victory, defeat, and extraction behavior does not.
- **GAP-ANI-01:** all 20 `ANIMATION_CLIPS` labels have no inspected runtime consumer.
- **GAP-AUD-01:** `OCCUPATION_CAPTURED` emits `item-collected` while authored `occupation-captured` is unused; extraction-ready, movement, weapon, and impact cues are also unattached.

**Resolved at the inspected source boundary:** all ten stages now have explicit cutscene sets and deterministic tactics for chokepath, flank, elevation, hazard, occupation, extraction, spawn direction, and seeded variation. Current-head regression and balance failures reported by QA remain separate blockers; source presence is not test evidence.

## Handoff

`messages/20260722-cinematic-beat-handoff.md` defines skippable intro/extraction/boss-victory/defeat beats, reduced-motion/text fallback, no-video dependency, accepted seven-stage copy, and the resolved LOR-01…08 replacement packet. Stage 10 preserves the ten-stage ending.

## Role feedback received

- Game Designer, PM, Audio, VFX, Animation, Technical Art, Playtest Research, and Game Programmer reported no new player-facing canon entities in their owned artifacts; all cited effects map to W-01…W-05 or produced no player-facing asset.
- QA accepts 100% coverage only for the six named catalog groups and keeps G1 at FIX until the broader shipped-content boundary is complete.
- Systems Designer confirmed and applied the seven-stage copy, Gate Zenith ending, and all seven live catalog-violation fixes; GameProgrammer applied both requested app-copy fixes and reported syntax/browser smoke PASS.
- Release Engineering remains NOT READY for unrelated cache/package closure reasons.
- QA’s current-head simulation regressions and 0/50 balance probe invalidate gameplay gates but do not change this string inventory; no lore gate is promoted from source inspection.
- `20260722-qa-stage1-fix-broadcast.md` item 9 retains the pre-handoff “8 violations” count; that count is superseded for the six named catalog groups by the inspected fixed strings and the 136/136 re-audit. Its QA-D003/QA-X002 extraction findings remain active and strengthen GAP-CIN-01.

Open programmer-owned cinematic/audio defects still require `fixed` or `deferred` with reason.
