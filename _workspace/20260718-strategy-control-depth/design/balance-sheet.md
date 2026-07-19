# Frozen Stage 2→3 balance sheet

**Design contract only; no production/test changes and no measurement run.** `campaign-state.js` rules v6 remains current.

## Gate dispositions (director owns final verdict)

| Gate | Required | Observed | Designer disposition |
|---|---|---|---|
| **G2 rules/balance** | 100% mechanics covered; wins 45–55%; TTK ±15%; max combo≤1.3× median | existing casual 40%/200; existing early-pair max/median 1.16845; new topology/rewards unmeasured | **FIX / BLOCKED** |
| **G3 player diversity** | ≥5 archetypes tested; ≥3 independently viable; no >50% optimal dominance | no post-topology archetype rotation; deterministic policy results are not human viability | **FIX / NOT RUN** |
| **G7 core loop** | 30–180s, ≥3 actions, ≥1 reward, repeat proxy≥70% | numeric model frozen in `core-loop.md`; repeat proxy unmeasured | **FIX / MODEL COMPLETE, PLAYTEST NOT RUN** |
| **G8 novelty** | ≤2 of ≥5 titles; impression≥4/5 | Undertow 0/6 source sample; impression unmeasured | **FIX / SURVEY PASS, IMPRESSION NOT RUN** |

## Core numeric ledger

| Knob | Observed | Frozen target | Existing file/symbol | Risk / focused verification |
|---|---:|---:|---|---|
| Final/stress grid | 16×8 / none | **24×12 final; 40×24 stress-only** | navigation grid constants/fixture | content exclusion + viewport/path audit |
| Lanes | 1–2 apparent | **3; 2 reconnects; ≥4 frontage; ≥50% nonshared; ≥1 affordance; longest≤1.35× shortest** | `createStageNavigation` | graph enumeration |
| Lane outcomes | unmeasured | **15–70% success each; static camp≤60%** | route/position session trace | histogram/stationary ratio |
| Simulation | variable RAF | **1/60s fixed; max delta .10s; 6 catch-up** | realtime update loop | 30/60/120Hz + 250ms stall |
| Movement | 4.1/7.2/2.4 u/s | **hold; accel 28, decel 36 u/s²** | realtime speed constants, `updateCommander` | endpoint/start-stop traces |
| Path cells S1–10 | ≤16-cell width | **28,30,32,32,34,34,36,36,38,40** | navigation profiles/anchors | path + browser timing |
| Camera | .12/frame; zoom 18 (9–30) | **τ=.1304s; hold zoom** | `updateCamera(dt)`, `onWheel` | convergence ±.5% at 30/60/120Hz |
| Drag | >3px per-event Manhattan | **6px mouse/pen; 12px touch, cumulative Euclidean** | pointer handlers/`pointerType` | boundary matrix/slow segmented drags |
| Feedback | unmeasured | **p50≤50, p95≤100, max≤200ms** | input→`applyAction`→changed RAF | ≥500 samples/profile |
| Commands | 5–7 verbs | **≤5 visible, ≤4 enabled** | stage commands/app `[data-action]` | reachable-state audit |
| Waves/loops | 14–16s gaps | **hold; loops S1–10: 60–90,70–105,80–120,85–125,90–130,95–135,100–140,105–145,110–155,120–165s** | wave times/stage actions | browser p50/p90, all 30–180s |
| Casual win | 40%/200 | **45–55%, aim 50%** | existing sim casual policy + stage rules | ≥200 seeded, CI, defeat histogram, double-run |
| Undertow | absent | **S7/S9 only; 6s; 30s CD; max1** | proposed reducer command/state | causal A/B + parity |

## Reward-family decisions (designer acceptance of PM bounds)

All rewards remain earned campaign state. Premium/free/edition/cosmetic deltas are **0 percentage points** for combat power, tempo, access, controls, tactical information and authoritative traces.

| Family | Frozen bound | Existing effects at issue | Verification |
|---|---|---|---|
| Cooldown/tempo | **8–15% effective reduction per pick; ≤40% cumulative; minimum cooldown fraction 60%.** `autoExtract` consumes 10 pp of tempo budget; any pick bundling it has ≤15% cooldown reduction. | `cooldownMultiplier`, `autoExtract`, live clamp currently 50% | exhaustive reward stacks; effective clipped value logged |
| Possessed burst | **+1…+3/pick; ≤+4 cumulative; no pick >75% cap** | `possessedAssaultBonus` current max +8 | assault-count/TTK by S5–10 |
| Materialize legion | **+1…+2/pick; ≤+4 cumulative; one action summons ≤6; empty capacity 10 needs ≥2 decisions** | `materializeBonus` current max +8 | setup-action count/capacity clamp |
| Counter | **−1/pick; ≤−3 cumulative** | `counterReduction` | counter floor/late attrition |
| Aegis/Domain | persistent entry aegis **≤2**; total stage-available aegis including Domain **≤3**; Domain one earned use, restore **≤4 integrity**, grant **≤2 aegis**, instant reversal **≤30%** | `entryAegis`, Domain S10 +4/+3 currently | before/after outcome window and reversal rate |
| Targeted recovery | +2 target must realize **≥1 effective integrity in ≥80%** eligible entries or redesign | targeted integrity rewards/entry floors | clipped-value realization |
| Targeted vanguard | **+3…+4** to one named stage; saves **≤2 setup actions**; never satisfies node/possess/wave/Domain/assault gates | Veil Vanguard +4, Span Sigil +4 | target-stage setup counts |
| Echo Throne rewards | **commemorative; exactly 0 combat/tempo effect**, plainly labeled | current empty `effects={}` while campaign continues | reward-screen comprehension; zero trace delta |
| Gate Zenith rewards | terminal commemorative **0 forward combat effect** | terminal empty effects | copy/trace audit |
| Whole-build diversity | combo max/median **≤1.30** (warn >1.20); clear-time p50 spread≤20%; equal-skill build win spread≤10pp; normalized choice entropy≥.75; zero-effect selection≤5% | existing early 12-pair 1.16845 only | all-stage stratified builds; freeze score/seeds first |

## Isolated Echo Throne probe disposition

**APPROVE as the next integrated G2 candidate; REJECT as a standalone release retune.** A `/tmp`-only one-family probe changed `campaign-state.js` Echo Throne `commands.assault.counter.baseDamage` **8→6** and moved seeded casual **40.0%→51.5%/200**, with Echo Throne defeats **78→49**, deterministic fuzz **150,000/0 findings**. However rusher/comeback remained **0%** and greedy/optimal **100%**, so G3 remains blocked and the value is not final. Keep the source unchanged until the 24×12 topology baseline is measured; then apply only this delta in the integrated candidate and require casual 45–55%, all stage loops 30–180s, identical double-run, and ≥3 independently viable archetypes before retention.

No boss HP, damage or reward source value is changed before topology/control measurement. Retune one numeric family at a time; retain only changes restoring 45–55% without breaking 30–180s or determinism.
