# Frozen novelty — Undertow Reversal

## Rule

On **Stage 7 Starless Canal** and **Stage 9 Abyss Chancel** only, reverse one marked lane's directional current for **6s**. Cooldown **30s**; maximum **1 active**. It changes travel/pressure direction, never walkability, teleport, damage, or required-node reachability.

**Eligible lanes:** S7 **Barge Deck**; S9 **Rite Bridge**. Base three-lane topology must pass before trial.

## Survey frequency

| Comparable | Closest pattern | Matching player-triggered temporary terrain-current route reversal? |
|---|---|---|
| StarCraft II [S1] | ramps/destructibles/map mobility | Not found in reviewed official source. |
| Age of Empires IV [S2] | crossings/walls/sacred sites | Not found in reviewed official source. |
| Company of Heroes 3 [S3] | bridges/cover/cutoffs | Not found in reviewed official source. |
| Dune: Spice Wars [S4] | regions/storms/sandworms/sabotage | Not found in reviewed official source. |
| Northgard [S5] | adjacency/seasons/territory hazards | Not found in reviewed official source. |
| Command & Conquer Remastered [S6] | bridges/chokes/harvest exposure | Not found in reviewed official/upstream source. |

Bounded sample frequency **0/6**, satisfying ≤2 of ≥5. This is not a universal absence claim.

## State and gates

1. Reducer validates stage, cooldown, active count and eligible route.
2. Accepted state records route ID, direction, deterministic duration/cooldown.
3. Both renderers project identical arrow, timer and receipt.
4. Units keep position; expiry restores direction deterministically.
5. Every required node remains reachable by ≥2 routes before/during/after.
6. Retry, save/restore, fallback and tab suspension cannot duplicate/extend.
7. Feedback p50/p95/max≤50/100/200ms over ≥500 samples/profile.
8. Casual 45–55%; causal A/B delta≤5pp; each lane success 15–70%; static camp≤60%; direction/expiry comprehension≥90% in five-second probes.

## Scorecard (0–5; candidate pass ≥20/30, none <3)

| Dimension | Score | Evidence/risk |
|---|---:|---|
| Mechanical fit | 4 | bounded route timing; direction projection unproven |
| Strategic depth | 4 | timing/counter-routes; fails if merely speed buff |
| Readability | 3 | one lane/arrow/6s; mobile/fallback unmeasured |
| Feasibility | 3 | reuses reducer/cooldown; new directional state |
| Accessibility/parity | 4 | semantic action; no gesture/color-only dependency |
| Survey novelty | 5 | 0/6 bounded official/upstream sample |
| **Total** | **23/30 candidate PASS** | implementation/QA remains blocked |

Remove/redesign if any gate above fails or any renderer/input/save trace diverges.

## Sources

[S1] https://starcraft2.blizzard.com/en-us/  
[S2] https://support.ageofempires.com/ and https://www.ageofempires.com/games/age-of-empires-iv/  
[S3] https://www.companyofheroes.com/  
[S4] https://www.dunespicewars.com/  
[S5] https://northgard.net/game/  
[S6] https://www.ea.com/games/command-and-conquer/command-and-conquer-remastered and https://github.com/electronicarts/CnC_Remastered_Collection  
Response basis: https://web.dev/articles/rail

**G8 disposition:** survey-frequency criterion passes (0/6); QA impression score is not run, so G8 is not a PASS.
