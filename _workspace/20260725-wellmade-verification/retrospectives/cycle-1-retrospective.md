# Cycle 1 Retrospective — Well-Made Verification

run-id `20260725-wellmade-verification` · director · 2026-07-25
Operating mode: stage-gate verification review (measure-only)

## Gate table — measured values

| gate | verdict | measured |
|---|---|---|
| G1 narrative | FIX | 1 S1 + 3 S3; 111/119 nouns trace (93.3%); 499 player-visible strings enumerated |
| G2 balance | FIX | 0 defeats / 700 stage clears; RPG-active vs inactive delta 0.0%p; turtle TTK 6/10 stages violate; R1 127/350 (36.3%) over ceiling. PASS: spread 1.261× and pairwise 1.211× vs 1.3× cap |
| G3 diversity | FIX | 7/7 archetypes viable but vacuously; 3-stance structurally real, behaviourally decorative |
| G4 immersion | FIX | 4 boss idles at 0 varying bones; 24 characters share 1 clip library; palette distance median 93.3; textures 0/51 |
| G5 revenue | N/A | no monetization in project scope |
| G6 ops | FIX | desktop/mobile PASS (p95 3.2 ms); low-tier FAIL (p95 24.2 ms, 8.30% long frames); GPU texture leak 52→297 linear; soak 0.056% PASS; input p95 ≤5.6 ms PASS |
| G7 core loop | FIX | modelled 60 s circuit measures 0.02 s; only stage-sortie loop in band; `EXTRACT_ELITE` unreachable |
| G8 novelty | FREQ PASS / IMPRESSION BLOCKED | N2 elite-capture 0 of 11 titles; impression unscoreable because the mechanic is not a player action |

No gate reached PASS. The cycle's deliverable is
`production/improvement-backlog.md`.

## What this cycle actually established

Three prior cycles deferred the formal G2/G3/G6 protocols and G8 was never
measured at all. All four ran here, at larger n than any prior attempt
(7 archetypes × 5 seeds × 10 stages × 2 RPG arms = 700 stage clears; 4 device
tiers; a 30-minute soak; an 11-title genre survey).

The headline is that **the game's problems are not where the prior cycles were
looking.** Determinism, test discipline, rig fit, weight distribution and mesh
quality are all sound. What is not sound: the campaign cannot be lost, every
character plays the same animations, four bosses do not move at all, the 3D
scene has no colour identity while the UI does, and the signature novelty
mechanic is unreachable dead code.

## The cycle's central lesson

Four independent lanes hit the same failure mode:

| lane | instance |
|---|---|
| `NarrativeG1` | commit `2c39fce` changed the lobby h1 one day after an audit cleared the old string; the audit was never re-run and still reads green for text that no longer exists |
| `BalanceG2G3` | cycle-2's committed TTK table was silently invalidated by the in-flight stance redesign |
| rig pipeline | writes `tposeOk: false` into its own report, then installs anyway — `rig-all-characters.sh` gates on process exit code |
| director | two wrong denominators, both retracted mid-cycle |

**An artifact that was true when produced, never rebound to its source, and
trusted afterwards.** A dated markdown audit expires silently; a CI assertion
cannot. Tier 3 of the backlog exists because of this, and it is the cheapest
insurance in the list.

`NarrativeG1` added a second-order version worth keeping: `그림자 1기 추가` was
correctly cleared in isolation, then retroactively gained faction sense once the
h1 named the faction. Row-by-row scoring structurally cannot catch that — it is
a property of the set, not of any row.

## Director errors, recorded

Two of my own findings were wrong and were retracted in writing and by broadcast
before any agent built on them:

1. "The pedestal is skinned to pelvis/spine and swings with the hips." The
   plinth is unskinned and never deforms.
2. "The rig floats — foot bone at 12–49% of mesh height on 20 models." Measured
   against *total* height including plinth. Against **body** height the foot
   bone is at exactly 6% on all 24; the rig is correctly fitted everywhere.

Both from the same root cause: choosing a denominator without verifying what it
contained. I issued this as a method note to the team mid-cycle;
`BalanceG2G3` then applied it to its own R1 denominator fork and discarded a
degenerate basis, and `NarrativeG1` reported it caught them 6 times. The error
was worth more as a broadcast than it cost.

A third correction came from `VisualG4` against me: my "3.1× sparser sample
rate" on 4 bosses was wrong in mechanism. Sample rate is identical (24 Hz); the
difference is how many bones carry motion. The corrected finding — idle with
**0** moving bones — is more severe than the one I reported.

A fourth came from `NarrativeG1`: my palette hexes used a gamma `c^(1/2.2)`
approximation instead of the sRGB OETF, and my brief said the canon had 4
colours when it has 5. With the correct transfer, `dusk-warden` sits at distance
**0.0** — exact canon hits.

Four director errors, all caught by agents or by re-derivation, none shipped
into a verdict.

## Process notes

1. **Every agent timed out (exit 1) and every agent still delivered.** All five
   produced complete evidence on disk before their harness window closed. Two
   never wrote their final markdown; their JSON evidence was complete enough to
   synthesize verdicts directly. Per `SKILL.md` Step 5, partial results were
   accepted and the timeout is flagged here rather than hidden.
2. **Peer correction worked better than director review.** Three of the four
   director errors were caught by agents pushing back with their own
   measurements, not by me re-checking. The IRC broadcast discipline is what
   made that possible — a correction reached all five lanes in one message.
3. **Two independent methods per load-bearing claim.** The `EXTRACT_ELITE`
   finding stands on runtime probes (1,033 issued / 0 accepted) *and* static
   single-writer analysis. The plinth fix stands on a Blender prototype *and* a
   browser A/B. Neither would have been safe alone.
4. **`_workspace` deletion recurred, and its test signal misdirects.** 155 files
   across 3 prior run-ids were deleted mid-session, restored, and **deleted
   again** before cycle close. Cause unidentified; the obvious suspect — the
   concurrent hourly studio-loop — is exonerated, since it runs in a separate
   worktree and its log records the correct dirty-tree refusal. Causally
   established this cycle: deleted → 237 pass / 10 fail, restored → 247 pass /
   0 fail. But all 10 failures are named `G2 full-route CLI …` and `live product
   closure …`, so the suite points at a measurement-pipeline regression when the
   real fault is a missing fixture directory. A future session will debug the
   wrong thing. First diagnostic should be `git status | grep '^ D _workspace'`
   (`conflicts.md#C1`).

## Unresolved risks — carried forward, not hidden

1. **G4 human immersion scoring** — still unmeasured, as in every prior cycle.
   Automated observation cannot produce a panel median. Structural readability
   was measured instead and it fails on its own terms.
2. **G8 impression score** — blocked on backlog item 0.2. Scoring the current
   automatic capture would measure the wrong mechanic.
3. **Tracked-file edits during a measure-only cycle** — `sw.js`,
   `tests/release-closure.test.mjs`, `scripts/run-g2-archetype-rotation.mjs`
   modified. The `sw.js` change (locally-served SW refetches binaries instead of
   replaying a frozen cache) is a genuine fix for a trap four retrospectives
   re-hit, and should be carried forward as a deliverable rather than discarded
   as stray dirt. Attribution requested, not returned before the agents' windows
   closed (`conflicts.md#C2`).
4. **Turtle TTK ceiling (6/10 stages)** — root cause is in the QA archetype
   policy, not confirmed as a game-numbers defect. Same disposition as the prior
   cycle; still open.
5. **Enemy naming seam** — `guard`/`possessed`/`scout`/`shade` score 0% on canon
   lexemes while the other 29 entities score 100%. Most-seen entities, already
   flat mauve.
6. **The in-flight rig pass is still uncommitted.** This cycle measured it and
   deliberately neither committed, reverted, nor extended it. Backlog items 0.3
   and 1.6 both land in that same pipeline, so whoever picks them up must decide
   the disposition of the working tree first.

## Next-cycle entry decision

**Stage 2 (retune / develop), not Stage 1 (concept shift).**

The concept, worldview, systems and architecture are sound and measured sound.
Nothing in this cycle's findings argues for re-conceiving the game. Every Tier 0
and Tier 1 item is a defect in execution against an existing design — a dead
input path, an unscaled mesh, an unauthored material, an untuned difficulty
budget.

**Next public beat:** a build where the four Tier 0 fixes have landed and been
re-measured — the faction string corrected, `EXTRACT_ELITE` reachable, plinths
stripped (characters rendering at 100% uniformly), and the skeleton texture leak
closed. That build makes the G8 impression score gatherable for the first time
and makes the Tier 1 art work safe to start.
