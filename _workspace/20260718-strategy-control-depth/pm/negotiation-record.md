# Designer–PM negotiation record — reward depth and premium fairness

**Run:** `20260718-strategy-control-depth`  
**Owner:** game-pm  
**Operating mode:** Stage 2 reward/balance negotiation entering Stage 3 responsiveness  
**Record status:** **OPEN.** PM bounds are explicit. The game designer was asked for current numeric targets on 2026-07-19; no designer artifact or response was available when this record was authored. No designer signature is inferred.

## Signing and decision semantics

- `signed: [game-pm]` means the PM accepts the stated product/fairness constraint or proposal. It does **not** impersonate or pre-approve the designer.
- `pending_signatures: [game-designer]` and `status: pending-designer` block implementation of the proposed retune. Source facts may still be accepted as observations.
- Product policy—premium PC, no pay-to-win, no monetized combat power, paid/free gameplay delta `0 pp`—is controlling even while designer balance values are pending. The designer may propose a stricter bound but cannot loosen this policy.
- A numeric agreement is not a gate PASS. QA must attach the exact method, command/session reference, sample, timestamp, and observed result.
- Any disagreement or missing response remains pending; it is never silently converted to `agreed`.

## Entry 1 — premium model and zero-power boundary

```yaml
entry: 1
revenue_point: "Premium base-game license only"
balance_number: "paid_free_gameplay_delta_pp=0; paid_free_tempo_delta_pp=0; paid_reward_access_delta_pp=0"
current_observation: "The ten-stage reward table is earned campaign state; no reward purchase is proposed in this discovery packet."
designer_bound: "PENDING ACKNOWLEDGEMENT. May not exceed the product-policy zero delta."
pm_bound: "No purchase, edition, DLC, cosmetic, preorder entitlement, or account state may alter rewards, damage, cooldowns, summons, counter reduction, aegis, integrity, Domain, stage access, controls, information, or authoritative action results."
agreed: "Product policy fixed at 0 pp; designer acknowledgement pending, but cannot weaken policy."
signed: [game-pm]
pending_signatures: [game-designer]
status: accepted-product-policy-pending-designer-ack
source:
  - "user product policy: premium PC; no pay-to-win or monetized combat power"
  - "campaign-state.js:31-514, 648-679, 1069-1102"
verification: "Default versus any paid presentation/edition must produce identical authoritative traces and state hashes under identical inputs/seeds. NOT-RUN."
```

## Entry 2 — current v6 baseline and evidence limits

```yaml
entry: 2
revenue_point: "None; automated balance baseline"
balance_number: "rusher=0%/20 actions; comeback=0%/47; greedy=100%/116; optimal=100%/103; casual=40% over 200; early-pair max/median=1.1684529828; fuzz=150000 ops/0 findings"
current_observation: "Observed in the supplied rules-v6 simulator JSON. Casual defeat histogram: Echo Throne 78, Sunken Bastion 19, Howling Sprawl 17, other stages 6. Branch fractions 0.6923–0.8537."
designer_bound: "PENDING: classify which failures are intended archetype lessons versus retune blockers; name target win/action bands per archetype and stage."
pm_bound: "Use the baseline as automated evidence only. It cannot be labeled human fairness, retention, player-time, or revenue evidence. Later reward stacks, reversal probability, choice entropy, feedback latency, and human build parity remain unmeasured."
agreed: "Observed baseline accepted as evidence; design interpretation pending."
signed: [game-pm]
pending_signatures: [game-designer]
status: evidence-accepted-interpretation-pending
source:
  - "/tmp/abyssal-balance-v6.json:18-411"
  - "/tmp/abyssal-balance-v6.json:1102-1105"
  - "/tmp/abyssal-balance-v6.json:1321-1367, 1434"
  - "scripts/run-campaign-balance-sim.mjs:1-30"
verification: "Reproduce from the recorded simulator and rules version, then expand to all-stage builds and human playtests. Existing supplied result observed; expansion NOT-RUN."
```

## Entry 3 — tempo and cooldown stacking

```yaml
entry: 3
revenue_point: "Earned tempo rewards; never a purchasable accelerator"
balance_number: "current valid path multiplier=0.8*0.9*0.85*0.9*0.85=0.46818; raw reduction=53.182%; live clamp=50%"
current_observation: "Stillwater also sets autoExtract=true. The live cooldown consumer uses the public clamped reduction."
designer_bound: "PENDING: provide accepted per-pick and cumulative tempo caps and decide whether autoExtract remains bundled with the Stage 1 20% effect."
pm_bound: "Per cooldown pick 8–15% effective reduction; cumulative live reduction <=40%; minimum cooldown fraction >=60%. autoExtract removes one command per Hunt cycle and consumes 10 pp of the tempo budget; a combined autoExtract pick may carry at most 15% cooldown reduction."
agreed: "PENDING"
signed: [game-pm]
pending_signatures: [game-designer]
status: pending-designer
current_effects_at_risk:
  - "stillwater-hourglass: multiplier 0.8 plus autoExtract"
  - "tidebreaker-sigil: multiplier 0.9"
  - "sprawl-hourglass: multiplier 0.85"
  - "glass-chorus: multiplier 0.9"
  - "rite-hourglass: multiplier 0.85"
source:
  - "campaign-state.js:65-69, 195-198, 245-248, 296-299, 449-452"
  - "campaign-state.js:648-679, 686-702"
  - "app.js:2113-2115"
risk: "The final nominal 15% pick can provide only 5.08 pp effective headroom on the maximum tempo path; bundled Stage 1 utility can snowball."
focused_verification: "All-tempo deterministic path plus fake-clock checks for actual and displayed cooldowns after every pick; report clipped marginal value. NOT-RUN."
```

## Entry 4 — offensive and legion power budgets

```yaml
entry: 4
revenue_point: "Earned burst and legion doctrines; never sell combat efficiency"
balance_number: "current possessed reward max=+8; current materialize reward max=+8; proposed possessed cap=+4; proposed materialize cap=+4"
current_observation: "At Stage 10, the source-derived max possessed Assault is 5 base +2 possessed +8 rewards =15 versus 26 boss health. A same-family legion path can make one Materialize summon all 10 shades from empty after capacity clamp."
designer_bound: "PENDING: provide boss-assault-count and setup-action targets for burst/legion archetypes across Stages 5–10."
pm_bound: "Possessed reward +1…+3 per pick and <=+4 cumulative; no single pick >75% of family cap. Materialize +1…+2 per pick and <=+4 cumulative, so one action summons <=6 and filling 10 empty slots still takes >=2 Materialize decisions."
agreed: "PENDING"
signed: [game-pm]
pending_signatures: [game-designer]
status: pending-designer
current_effects_at_risk:
  burst:
    - "rift-lens +4"
    - "howl-lens +2"
    - "concord-lens +2"
  legion:
    - "ember-cohort +2"
    - "abyssal-banner +1"
    - "depth-cohort +1"
    - "pack-banner +1"
    - "starless-cohort +1"
    - "causeway-core +2"
source:
  - "campaign-state.js:65-69, 108-112, 195-198, 245-248, 347-350, 398-401, 449-452"
  - "campaign-state.js:842-846, 978-982"
risk: "Late-stage burst can collapse assault count; legion bonuses can make later legion picks clipped or strategically dead."
focused_verification: "Per-stage assault-count matrix for all Lens paths; empty-to-capacity accepted-action count for all legion paths; equal encounter seeds and frozen policies. NOT-RUN."
```

## Entry 5 — defense, recovery, and comeback caps

```yaml
entry: 5
revenue_point: "Earned defense/recovery only; no paid revive, shield, refill, or extra use"
balance_number: "current counterReduction max=6; entryAegis max=6; Domain current max restore/aegis=4/3; proposed counter cap=3, entryAegis cap=2, total stage aegis cap=3, Domain max=4/2, reversal<=0.30"
current_observation: "Counter reduction adds and floors at 1; entry aegis adds without a family cap; Stage 10 Domain grants 3 aegis. Targeted +2 recovery can be partly or fully absorbed by entry floors/cap."
designer_bound: "PENDING: define intended minimum late-stage attrition, Domain timing, and targeted-recovery realization band."
pm_bound: "Counter reduction -1 per pick and <=3 cumulative; persistent entry aegis <=2; total stage-available aegis including Domain <=3. Domain one earned use, restore <=4, grant <=2 aegis, measured instant-reversal probability <=30%. Targeted +2 entry recovery must realize >=1 effective integrity in >=80% of eligible observed entries or be redesigned."
agreed: "PENDING"
signed: [game-pm]
pending_signatures: [game-designer]
status: pending-designer
current_effects_at_risk:
  counter:
    - "shadebreaker-brand -2"
    - "necropolis-plate -1"
    - "tyrant-chain -1"
    - "colossus-plate -2"
  aegis:
    - "abyssal-banner +1"
    - "coral-aegis +1"
    - "pack-banner +1"
    - "canal-lantern +1"
    - "chancel-veil +2"
  recovery:
    - "anchor-shard +2 integrity entering Echo Throne"
    - "choir-shard +2 integrity entering Starless Canal"
    - "rewardIntegrityRestore 1 on Stages 1–2, 3 on Stages 3–9"
    - "entry floor 4 default and 7 entering Glass Necropolis"
  comeback:
    - "Stage 10 Domain +4 integrity/+3 aegis"
source:
  - "campaign-state.js:65-69, 108-112, 195-198, 245-248, 296-299, 347-350, 398-401, 449-452"
  - "campaign-state.js:329, 380, 431, 482, 831-839, 882-918, 947-997, 1084-1099"
risk: "Stacked reduction plus full-hit negation can erase attrition; recovery copy can overstate effective value; a three-aegis Domain exceeds the proposed comeback budget."
focused_verification: "Reachable-legion defense matrix with breaches and Domain; legal incoming integrity 0–10 for nominal/effective recovery; pre-registered <=4-integrity Domain scenarios with victory within 60 s or three accepted combat actions. NOT-RUN."
```

## Entry 6 — targeted rewards and the Stage 3 dead-pick decision

```yaml
entry: 6
revenue_point: "Earned campaign choice presentation; no premium replacement reward"
balance_number: "Veil Vanguard +4 legion to Echo Throne; Anchor +2 integrity to Echo Throne; Span Sigil +4 legion to Abyss Chancel; Echo Throne rewards effects={}; Gate Zenith rewards effects={}"
current_observation: "Echo Throne's two reward choices have empty effects while seven later combat stages remain. Gate Zenith's empty effects are terminal and therefore carry no forward combat expectation."
designer_bound: "PENDING: classify Echo Throne rewards as explicitly commemorative or provide a bounded noncombat role; define the expected setup actions saved by +4 vanguard rewards."
pm_bound: "Targeted vanguard +3…+4 to one named stage, saving <=2 setup actions and never satisfying node, possession, wave, Domain, or assault gates. Combat power of commemorative rewards remains exactly 0. Do not sell a stronger Stage 3 alternative."
agreed: "PENDING"
signed: [game-pm]
pending_signatures: [game-designer]
status: pending-designer
source:
  - "campaign-state.js:108-112, 149-152, 398-401, 501-503"
risk: "Stage 3 is a source-confirmed zero-effect gameplay choice in a continuing campaign; targeted rewards compete against persistent rewards over unequal horizons."
focused_verification: "Reward-screen comprehension test, projected-value audit, and setup-action counts for targeted entries. NOT-RUN."
```

## Entry 7 — whole-build parity and strategy-diversity telemetry

```yaml
entry: 7
revenue_point: "Quality/retention learning only; telemetry may not drive paid power offers"
balance_number: "combo max/median<=1.30; warning>1.20; clear-time p50 spread<=20%; equal-skill build win-rate spread<=10pp; normalized choice entropy>=0.75; zero-effect selection<=5%"
current_observation: "The supplied simulator covers all 12 Stage 1×Stage 2 pairs at max/median 1.16845, but not exhaustive later reward stacks. Its branch fractions 0.6923–0.8537 are policy branch counts, not reward entropy."
designer_bound: "PENDING: approve outcome-score definition, archetype set, scenario tuning, sample sizes, and any stricter stage-specific bands before results are viewed."
pm_bound: "Freeze metrics before measurement. Report each stage and complete build; do not average away a dominant late path. Paid/default/cosmetic/edition state must have 0 authoritative trace divergence."
agreed: "PENDING"
signed: [game-pm]
pending_signatures: [game-designer]
status: pending-designer
required_telemetry:
  - "stage_started: build and entry state"
  - "reward_offered/chosen: projected effective value and clipped flag"
  - "action_resolved: accepted result, cooldown, input and visible-feedback timestamps, modality"
  - "boss_assault_resolved: damage, counter, aegis, integrity"
  - "domain_activated: before/after state and outcome window"
  - "stage_ended/campaign_ended: result, actions, time, retries, full build"
source:
  - "/tmp/abyssal-balance-v6.json:413-427, 1102-1105, 1333-1367"
  - "pm/reward-bands.md#telemetry-required-before-any-balance-or-forecast-claim"
risk: "Without projected effective value, later picks can be silently clipped; without modality/timing fields, strategy and responsiveness effects are confounded."
focused_verification: "Stratified all-stage builds, frozen seeds/policies, human sessions, entropy and confidence intervals; input modalities must resolve identical authoritative actions with p95 feedback <=100 ms. NOT-RUN."
```

## Entry 8 — premium revenue scenario boundary

```yaml
entry: 8
revenue_point: "Premium base-game unit sales"
balance_number: "combat_monetization_revenue=0; paid_gameplay_delta_pp=0; illustrative 12-month unit scenarios=20000/60000/150000"
current_observation: "No approved list price, regional price table, wishlists, demo funnel, unit sales, refunds, realized ASP, remittance contract, costs, or scenario probabilities were supplied."
designer_bound: "PENDING ACKNOWLEDGEMENT: all ten stages and every earned reward remain available to every full-game owner; no edition-specific combat or tactical-information difference."
pm_bound: "Forecast base-game unit sales only. The scenario rows in revenue-forecast.md are hypotheses, not expected revenue. No weighted forecast, net revenue, or break-even claim until demand, contract, finance, and cost inputs exist."
agreed: "Commercial model fixed; numeric forecast remains unapproved and unmeasured."
signed: [game-pm]
pending_signatures: [game-designer]
status: accepted-commercial-scope-pending-designer-ack
source:
  - "pm/revenue-forecast.md"
  - "https://partner.steamgames.com/doc/store/pricing"
  - "https://partner.steamgames.com/doc/marketing/wishlist"
  - "https://store.steampowered.com/steam_refunds/"
risk: "Treating wishlist interest, bot completion, list price, or illustrative remittance as sales/revenue fact would create a false forecast."
focused_verification: "Replace assumptions only from approved pricing, platform traffic/wishlist, sales/finance, refund, contract, and cost reports with source dates. NOT-RUN because inputs are absent."
```

## Consolidated open decisions

| Pending ID | Designer response required | Default while pending |
|---|---|---|
| D-01 | Accept or counterpropose cooldown per-pick/cumulative caps and price `autoExtract` inside the tempo budget. | No retune authorized; current effects remain identified risks. |
| D-02 | Set burst and legion assault/setup targets across Stages 5–10. | PM caps `+4/+4` remain proposals. |
| D-03 | Set minimum late-stage attrition, Domain `+4/2` cap, and recovery realization band. | No increase, purchase, refresh, or extra Domain use. |
| D-04 | Classify Echo Throne's zero-effect rewards and targeted reward horizon parity. | No combat-power filler and no premium alternative. |
| D-05 | Freeze build outcome score, archetype definitions, scenarios, and samples. | Existing early-pair result cannot certify all-stage parity. |
| D-06 | Acknowledge full-game content parity across any edition/cosmetic. | Product policy `0 pp` controls. |
| D-07 | Provide approved price/value positioning only after comparable-title and player-value evidence. | Revenue scenarios remain unlabeled hypotheses, not an expected case. |

## Escalation and closure rule

An entry closes only when the designer supplies a numeric bound or explicit policy acknowledgement, both roles appear in `signed`, the `agreed` field is concrete, and QA names a focused measurement artifact. Any counterproposal must identify the exact `campaign-state.js` reward or command effect, the tradeoff it protects, the risk it introduces, and the verification that can falsify it. Until then, implementation is blocked by `pending-designer`; product-policy zero combat monetization remains non-negotiable.
