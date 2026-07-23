---
gate: G8
owner: game-designer
updated: 2026-07-22
survey_scope: five-bounded-comparables
sample_size: 5
maximum_comparable_frequency: 2
measured_frequency: 0
measured_ratio: 0/5
impression_score_target: 4.0
impression_score_measured: null
status: FIX-frequency-limb-measured-impression-limb-open
---
# Novelty scorecard — Echo-command extraction

## Candidate hook

**A defeated elite opens a 600-tick / 10-second W-02 extraction window at a contested Domain point; completing Bind represents the recovered hostile memory as a named companion, adds it to the current run, and records it permanently in the offline collection.**

This is one conjunction, not four separate novelty claims. A comparable scores a match only when source-visible play includes all four elements:

1. defeat of an elite/enemy;
2. a bounded post-defeat extraction decision;
3. conversion represented as recovered hostile memory rather than ordinary loot/recruitment;
4. a named permanent allied unit/companion result.

The frequency result is a **disclosure-set measurement**, not proof that no obscure mechanic exists anywhere in each title. The bounded scan inspected official publisher/store descriptions plus directly retrievable official pages where available on 2026-07-22. Sources and control/core-loop findings are expanded in `trend-survey/context.md` and `trend-survey/solutions.md`.

## Five-comparable frequency table

| comparable | genre/control/core-loop evidence inspected | strict hook match? | reason | URL | provenance |
|---|---|---:|---|---|---|
| Vampire Survivors | survival against monster hordes; gather gold and upgrades; minimalist control positioning is corroborated by the bounded control scan | 0 | disclosed rewards are run upgrades/meta progression, not bounded elite-memory extraction into a permanent ally | [Steam](https://store.steampowered.com/app/1794680/Vampire_Survivors/), [poncle](https://poncle.games/vampire-survivors/) | direct page retrieval |
| Brotato | top-down arena auto-shooter; up to six weapons; waves, material collection, items/traits and build creation | 0 | disclosed loop uses weapons/items between or during waves, not defeated-enemy memory converted to a permanent companion | [Steam](https://store.steampowered.com/app/1942280/Brotato/), [official site](https://www.brotato-game.com/) | direct page retrieval |
| Arknights | strategic RPG/tower-defense framing; deploy/recruit/train Operators to defend against waves | 0 | persistent Operators are recruitment/progression units, not an elite defeated and extracted as its memory in a timed post-kill window | [official site](https://www.arknights.global/), [Google Play](https://play.google.com/store/apps/details?id=com.YoStarEN.Arknights) | direct page retrieval + indexed snippet |
| Hades | direct-action roguelike escape attempts with Olympian powers; persistent between-attempt progression is disclosed around the House/Mirror loop | 0 | no inspected disclosure converts a defeated elite's hostile memory into a named permanent allied unit via timed extraction | [official page](https://www.supergiantgames.com/games/hades/), [Steam](https://store.steampowered.com/app/1145360/Hades/) | direct page retrieval |
| Death Must Die | action roguelite/hack-and-slash survivor; god-given powers, items, varied heroes and run synergies | 0 | disclosed growth is blessings/items/heroes, not bounded elite-memory extraction into a permanent companion | [Steam](https://store.steampowered.com/app/2334730/Death_Must_Die/) | direct page retrieval |

**Measured strict frequency: 0/5 (0%).** The G8 frequency threshold is `≤2/5`, so this bounded source inspection supports the frequency limb. It does not establish full novelty and does not pass G8.

## Related-pattern frequency — design risk, not hook match

| recurring pattern in disclosures | titles observed | frequency | implication for Abyssal Command |
|---|---|---:|---|
| movement/positioning under automated or dense combat pressure | Vampire Survivors, Brotato, Death Must Die | 3/5 | keep movement readable; auto-fire alone is not distinctive |
| run build choices through weapons/items/powers | Vampire Survivors, Brotato, Hades, Death Must Die | 4/5 | three-choice growth needs numeric current → upgraded values and explicit synergies |
| persistent roster/stat progression | Arknights, Hades; also broader survivor meta loops in store descriptions | at least 2/5 in this bounded coding | permanence is common; hostile-memory extraction must carry the hook |
| lane/goal defense with deployable allies | Arknights | 1/5 | Gate pressure and occupation can differentiate the survivor control scheme without copying operator deployment |

## Hook implementation acceptance

The public beat only earns the hook description when one captured trace shows all of the following in order:

`elite defeated → candidate available with 600-tick expiry → eligible Domain occupied/contested → Bind completed before expiry → companion joins run → same named prototype appears in local persistent collection`

The 2.5D renderer must make the candidate, eligible point, contest state and countdown readable but cannot decide success. Generic loot text, a one-click menu disconnected from battlefield position, or a companion granted only by stage reward fails the hook.

## Impression panel contract

Five independent QA/playtest impressions rate this exact prompt after one observed extraction: **“How striking and specific was converting a defeated enemy memory into a permanent command companion?”** Use a 1–5 scale, record build/trace ID and one sentence of rationale, and report median plus all raw scores. Target is median `≥4/5`; no score is presently filed.

## G8 verdict

**FIX.** The bounded comparable-frequency limb is measured at `0/5`, within the `≤2/5` threshold. The required five-person impression result is absent, and the target spatial Domain/Bind sequence is not fully implemented in the current runtime. No PASS claim is supported.
