# Reference deep research — six bounded comparators

run-id: `20260725-defense-rpg-development`  
owner: game designer  
status: design input; no runtime or human-evidence claim

## Method and evidence boundary

This pass uses official developer/publisher public descriptions. An **observed fact** is only what the linked page says; a **transferable inference** is a proposal for Abyssal Surge. Neither is evidence that the current runtime is readable, balanced, enjoyable, novel, or technically eligible. The proposed mappings preserve the deterministic simulation/campaign authorities; renderer, UI, and audio remain observers.

## Research records

| Comparator | Canonical official source | Observed fact | Transferable inference for Cinder Span | Explicit non-copy constraint | Local mapping and future acceptance |
|---|---|---|---|---|---|
| Into the Breach | [Subset Games — Into the Breach](https://subsetgames.com/itb.html) | **Observed fact:** Subset describes its combat as one where “All enemy attacks are telegraphed” and players analyze an attack before choosing a counter. | **Transferable inference:** put target, threat class, remaining time/order, and consequence on every imminent Cinder threat before the player commits; show the counter-relevant route in that same decision window. | Do not copy tile-grid combat, turns, Vek/mechs, city-power objective, UI art, terminology, or exact combat rules. | Gate-pressure target, priority-threat badge, and safe-route chevron must remain simultaneously visible. Future browser receipt: all three element rectangles present without opening a modal; future human task: correctly identify the priority threat and safe route after a stable full loop. |
| Hades | [Supergiant Games — Hades FAQ](https://www.supergiantgames.com/blog/hades-faq/) | **Observed fact:** Supergiant defines roguelikes as combat-oriented games where players get stronger while fighting, die, and carry knowledge forward; it also says Hades has permanent-progression systems. | **Transferable inference:** make failure and return state explicit: a deterministic run ends with a cause, run-local loss, and only an allowlisted persistent record. | Do not copy Greek-myth fiction, Olympian boons, escape premise, randomized-run formula, God Mode, Pact of Punishment, or named systems. | Cinder failure card distinguishes Gate loss, Warden loss, and extraction expiry; persistent change is only the existing campaign-authorized companion/reward path. Future trace: terminal cause plus persisted IDs prove the boundary. |
| Darkest Dungeon | [Red Hook Studios — Darkest Dungeon](https://www.darkestdungeon.com/darkest-dungeon/) | **Observed fact:** Red Hook frames a team facing stress, disease, darkness, and gameplay-meaningful Affliction quirks. | **Transferable inference:** make pressure consequences legible at party scale: Gate integrity, Warden integrity, companion downed state, and extraction expiry must change the next tactical decision or make recovery/retreat visible. | Do not copy Darkest Dungeon’s setting, stress/Affliction names or values, four-hero formation, permanent-loss model, or turn-based combat. | Failure panel and in-field state expose Gate/Warden/companion/extraction separately. Future screen test: each field has text plus non-color cue; future trace: `DEFEAT` includes one authoritative cause. |
| Monster Hunter Wilds | [CAPCOM — Monster Hunter Wilds](https://www.monsterhunter.com/wilds/en-us/) | **Observed fact:** CAPCOM says the hunter gains resources from hunts and uses them to craft more powerful weapons and armor. | **Transferable inference:** state the named target and the exact reward scope before commitment so the elite/boss choice has a visible progression purpose. | Do not copy monsters, ecosystem/Guild fiction, weapon taxonomy, smithy terminology, hunt structure, material tables, or designs; do not introduce crafting economy or paid power. | Cinder elite is labeled as the existing `ember-cohort` handoff and boss rewards remain the three existing stage IDs. Future trace: accepted Bind and reward-selection IDs are recorded once; no new economy is implied. |
| XCOM 2: War of the Chosen | [2K — XCOM 2: War of the Chosen](https://2k.com/games/xcom/xcom-2-war-of-the-chosen/) | **Observed fact:** 2K describes three factions with unique abilities, hero-class soldiers in tactical missions, and relation management from a command center. | **Transferable inference:** make the existing companion/formation choices contribute visibly different tactical work and connect only allowlisted mission results to the offline campaign layer. | Do not copy factions, hero names, Chosen, command-center fiction, campaign tree, mission content, or combat structure. | Cinder exposes formation/companion state separately from run item and skill. Future five-archetype/tape receipt must record accepted stance/role actions and cannot call roles viable merely because all runs clear. |
| Dead Cells | [Dead Cells — official site](https://dead-cells.com/) | **Observed fact:** Motion Twin’s site frames pattern-based bosses/minions and nonlinear progression with a new path unlocked after death. | **Transferable inference:** make boss/minion patterns and safe-route choices legible in a short action window while any continuation remains an authored, deterministic campaign outcome. | Do not copy 2D RogueVania presentation, permadeath/no-checkpoint rule, roll-centric combat, locations, route content, or fiction. | Cinder boss intent receives text + shape/audio-independent cue; safe route is a world-space marker, not a random branch. Future trace records boss phase and selected route; reduced-motion still exposes both labels. |

## Cross-reference contract

```yaml
research_use:
  source_type: official_public_description
  evidence_limit:
    runtime_result: false
    human_experience_result: false
    balance_result: false
    asset_license_result: false
  allowed_transfers:
    - telegraph threat before commitment
    - expose risk consequence and reward scope
    - retain authored deterministic progression boundaries
  prohibited_transfers:
    - copied fiction_or_content
    - copied rules_or_ui
    - network_account_commerce_or_paid_power
    - renderer_or_audio_authored_outcomes
```

## Decision

The Cinder Span direction should borrow only the **decision shape**: readable threat, visible counter-route, clearly scoped reward, and legible failure. Its future proof remains local: deterministic trace for rule outcomes, browser receipt for hierarchy/touch behavior, and human receipt for comprehension, repeat, immersion, and novelty impression.
