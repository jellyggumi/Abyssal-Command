# Novelty Scorecard — G8 measurement (run-id `20260725-wellmade-verification`)

Owner: DesignG7G8 (game-designer). **First actual G8 measurement in any cycle.**

Survey: `design/trend-survey/` (triage / context / solutions), 11 comparable titles.
Prior cycle's scorecard
(`_workspace/20260723-solo-warden-rpg-concept/design/novelty-scorecard.md`) is
**superseded on genre grounds**, not on arithmetic — see §0.

G8 threshold, both halves required:
> ≥1 element appearing in **≤2 of ≥5** surveyed comparable titles (frequency table)
> **AND** QA impression score **≥4/5**.

---

## 0. Why the prior G8 number is void {#g8-prior}

The prior cycle scored candidates against `qa/lane-benchmark-survey.md`: **Diablo IV,
Path of Exile, Solo Leveling: ARISE, Kingshot, Whiteout Survival** — two ARPGs, one gacha
action-RPG, two 4X city-builders. Only Kingshot and Whiteout are arguably comparable, and
neither is a survivor.

Scoring survivor-genre mechanics against ARPGs inflates every count: any survivor
convention scores as "novel" because ARPGs don't have it. Its adopted candidate
("extracted units are immediately combat-viable", frequency 2/5) was also carried at
`qa_impression_score: null`, so it never satisfied G8's second half either. The prior
result was never a pass and is replaced here rather than revised.

## 1. Frequency table {#g8-frequency}

Full evidence and per-cell sourcing: `design/trend-survey/solutions.md`.
11 titles: Vampire Survivors, Survivor.io, Brotato, Halls of Torment, 20 Minutes Till
Dawn, Soulstone Survivors, Deep Rock Galactic: Survivor, Archero, Yet Another Zombie
Survivors, Kingshot, Whiteout Survival.

| # | Candidate element | Exact | Partial | Frequency | ≤2 of ≥5? |
|---|---|---|---|---|---|
| **N1** | 3-stance formation switched **during** a run (VANGUARD/TURRET/SPLIT, `derivedFrontCount` 2/0/1, 4 s cooldown) | **0/11** | 2/11 (Kingshot, Whiteout — both pre-battle only) | **0 exact** | **PASS** |
| **N2** | Elite-capture → **permanent** roster companion | **0/11** | 1/11 (YAZS in-run recruit, not elite-sourced) | **0 exact** | **PASS** |
| **N3** | Boss Rally Window — party-wide 20% CD cut at boss spawn, gated on FRONT≥1 | 0/11 found | — | **thin evidence** | **inconclusive** |
| **N4** | DOWNED companion state (non-terminal, distinct from death) | **1/11** (Survivor.io) | 2/11 (Archero, YAZS) | **1 exact** | PASS on count |
| **N5** | Free-orbit camera (yaw free, pitch 30–85°) | **0/11** | 0/11 | **0** | **PASS** |

Four of five clear the frequency bar. That is a suspiciously good result, so each is
stress-tested in §2 before any is recommended.

## 2. Adversarial pass — attacking each candidate {#g8-adversarial}

### N1 — 3-stance formation · **SURVIVES**
Attack: "Kingshot and Whiteout both ship named formation systems. This is a reskin."
Rebuttal, from source: both are **composition chosen before combat**. Whiteout — "you
cannot manually 'switch' or rearrange troop positions while a battle is actively in
progress"; rows are implied by unit type. Kingshot — Infantry/Cavalry/Archer *percentage
presets* (50/20/30 etc.) selected pre-march. Abyssal's is **spatial posture switched
mid-combat on a 4 s cooldown**, which changes who is enemy-targetable
(`derivedFrontCount` 2/0/1) while the fight is running. Same noun, different verb.
Second attack: "the closest peer, YAZS, is a squad survivor — surely it has this."
It is an explicit negative: "no mechanic to manually change your squad's formation or
positioning mid-run… positions are fixed by the game's AI behavior." Community demand for
it exists there and is unmet. **Survives both attacks.**

### N2 — elite-capture → permanent companion · **SURVIVES**
Attack: "companion collection is ubiquitous — Survivor.io pets, Archero spirits."
Rebuttal: ubiquitous *acquisition*, but every surveyed instance sources from chests,
gacha, or challenge unlocks. Confirmed negatives on both the mechanic and the sourcing:
Survivor.io/Archero — "no system that allows you to capture enemies and turn them into
allies"; pets are "pre-defined creatures… rather than converted enemies." Brotato / HoT /
20MTD / Soulstone — "no mechanic… to recruit defeated enemies as permanent companions,"
in-run summons "are ephemeral."
Second attack: "Palworld and Shadow of War do exactly this." True — and both are outside
the comparable set. Their existence is why this is scored genre-rare rather than
novel-in-general, which is precisely what G8 asks. **Survives.**

### N3 — Boss Rally Window · **FAILS the evidence bar, withdrawn**
The search returned *design advice on how to build such a mechanic*, not evidence about
shipped titles. That is **absence of found examples, not a confirmed negative**. A
boss-spawn buff window is a common enough primitive that a deeper per-title audit would
plausibly find instances. Promoting it on a null search result would be manufacturing a
novelty claim. **Withdrawn from candidacy this cycle**; re-testable with a per-title audit.

### N4 — DOWNED companion state · **SURVIVES on count, WEAK on substance**
Passes 1/11 exact. But the one confirmed positive is **Survivor.io** — the single closest
mobile comparable, where "if a pet's health reaches zero, it typically becomes
incapacitated for a period… not permanently lost." A target player has likely already met
this exact mechanic in the most obvious neighbouring title. Frequency-legal, but a weak
basis for "striking". **Not recommended as the G8 element.**

### N5 — free-orbit camera · **SURVIVES on count, CARRIES A COUNTER-ARGUMENT**
0/11 — the cleanest frequency result. But the survey found not just absence, a documented
*rationale* for absence: the fixed top-down camera is "widely considered a **defining
convention**" of the genre; rotation is avoided because it "can disorient the player,
causing them to move in the wrong direction" and "necessitates additional buttons…
increas[ing] the barrier to entry."
Deliberate deviation from a convention can be exactly what G8 rewards. But the genre's
stated reason for the convention is **readability under crowd density**, and per the
director's `engineering/rig-pipeline-root-cause.md` the build is already failing
readability for unrelated reasons — D6 (23/24 characters one flat untextured mauve,
`textures: 0` project-wide) and D2 (`fitHeight()` includes the plinth, so characters
render at **54–100%** of intended height, a 46-point spread). Spending the genre's
riskiest camera deviation while the readability budget is already overdrawn compounds two
independent problems. **Frequency-qualified; recommended as secondary, not primary.**

## 3. Recommended G8 element {#g8-recommend}

**N2 — elite-capture → permanent roster companion.**

```yaml
novelty_candidate: elite-capture-to-permanent-companion
survey_frequency: "0 of 11 exact (1 partial); 0 of any 5-title subset"
survey_titles: 11
threshold_required: "<=2 of >=5"
frequency_verdict: PASS
qa_impression_score: null
qa_impression_status: PENDING
status: FREQUENCY_PASS_IMPRESSION_PENDING
```

Chosen over N1 on one tiebreak: N2 occupies a **structurally empty cell** in the
comparable set (survey category 7, "companion-as-captured-elite" — no surveyed title
occupies it), whereas N1's nearest neighbours at least share the vocabulary of formation.
Both are defensible; N2 is the harder one to argue away.

### Caveat that does not change the frequency verdict but does change the pitch

Measured this session (`design/core-loop.md#g7-extract`, two standalone probes):
**the capture is not a player action in the shipped build.** `EXTRACT_ELITE` was accepted
**0 times in 108 runs**; issuing it every tick for a full run gave **1,033 attempts, 0
accepted**. The precondition the input requires
(`extractionProgress.completed && !run.extracted`) exists for **0 ticks** of a run,
because the auto-completion path (`defense-run-simulation.js:1397-1431`) sets both flags
and calls `addCompanion` in one block. A run driven with only `MOVE` and `SKILL_SELECTED`
still gains the 4th companion.

What survives: the mechanic is real, the elite really does join the permanent roster, and
**the 0-of-11 frequency result is unaffected** — no surveyed title has this loop whether
it is pressed or automatic.

What changes: the pitch. "Defeat a boss-tier elite, then choose to capture it" and "stand
in a zone for N seconds and it happens" are different experiences, and only the first is
what the design documents describe. An impression score gathered on the current build
would be scoring the second.

**Consequence for G8 sequencing**: fixing the dead input path is a prerequisite for a
*meaningful* impression score on N2, alongside the material work in §6. Scoring N2 before
then measures an automatic event, not the designed mechanic.

Secondary, in order: **N1** (in-combat stance switching, 0/11 exact, unmet demand
documented in the closest peer), then **N5** (free camera, 0/11, counter-argument above).

## 4. Impression half — BLOCKED-ON-FIX {#g8-impression}

**QA impression score: BLOCKED-ON-FIX. No value. Not estimated.**

Status upgraded from PENDING at the director's direction after the `EXTRACT_ELITE`
dead-code finding was confirmed by two independent methods (§3 caveat,
`design/core-loop.md#g7-extract`). The distinction matters: PENDING would mean "nobody
scored it yet, go score it." **BLOCKED-ON-FIX means scoring it now would produce a
number that measures the wrong mechanic** — the automatic zone-hold capture, not the
designed press-to-capture. A number gathered against the current build would be worse
than no number, because it would look like evidence.

Attribution, confirmed with the QA lane this session: **no QA impression scoring was
performed this cycle.** VisualG4's G4 work is deliberately narrow — structural
observability only (readability, feedback presence, motion quality, visual hierarchy)
from one automated observer, with the human-panel portion itself marked PENDING. A
novelty-impression score from that method would carry the same caveat and so would not
close this half even if produced.

A designer cannot self-award an impression score; G8 assigns it to QA by construction.

### The precondition problem, which is the real finding

The recommended element must be *perceivable* before it can impress, and the build's
current asset state actively works against all three surviving candidates:

| candidate | how it renders | blocked by |
|---|---|---|
| N2 elite-capture | the captured elite joins as a companion model | D6 — the captured elite and the 3 existing companions are all **the same flat untextured mauve**. "I captured that specific boss" is not legible when the reward looks like the units you already had. |
| N1 3-stance | **purely** as spatial layout of 3 companions; no icon, no colour, no VFX | D6 + D2 — identical-looking units at 54–100% render height. Which companions are FRONT (enemy-targetable, `derivedFrontCount` 2/0/1) has **no visual channel at all**. |
| N5 free camera | the camera itself | D2 — orbiting a scene whose characters render at inconsistent scale makes the scale error more visible, not less. |

An observability probe on N1 has been requested from VisualG4 (can the three stance
layouts be told apart at gameplay camera distance from companion placement alone; and is
the FRONT/BACK distinction readable given a uniform-colour cast). That returns an
observability **fact**, not an impression score — it bounds this half from below without
satisfying it.

**To close**: score ≥1 surviving candidate with human testers, on a build where the
element is visually distinguishable. Both conditions are currently unmet.

## 5. G8 verdict input {#g8-verdict}

**Recommended verdict: FIX.**

| half | required | measured | result |
|---|---|---|---|
| survey frequency | ≤2 of ≥5 titles | 0 of 11 exact (N2); 3 candidates at 0–1 of 11 | **PASS** |
| QA impression | ≥4/5 | **no value** | **BLOCKED-ON-FIX** |

G8 is conjunctive. One half passes decisively — the frequency result is not marginal, it
is 0/11 on a comparable set more than double the required size, with confirmed negatives
rather than mere absence on N1 and N2. The other half has no value, cannot be produced
by this lane, and must not be produced against the current build (§4).

Not FAIL: the honest adversarial read went looking for a reason to fail this gate and the
frequency evidence did not provide one. Not PASS: half the gate is unmeasured, and
`quality-gates.md` is explicit that missing evidence is not a pass. The blocker is now
named and has a specific fix (`#g8-improve` item 3), so this is a FIX with a known
unblock path rather than an open-ended gap.

## 6. Ranked improvements {#g8-improve}

1. **Give the captured elite a distinct material.** N2 is the recommended novelty element
   and its entire payload is "*that* boss now fights for me" — which D6 erases by making
   every companion the same mauve. This is the cheapest change that converts a
   frequency-qualified mechanic into a *perceivable* one. Highest value per unit of work
   for G8 specifically. Spec: `design/presentation-spec.md` §5.3 (elite class) and §5.5.
2. **Give stance a non-spatial channel.** N1 currently communicates through companion
   position only. A FRONT/BACK visual distinction (spec: `presentation-spec.md` §4
   threat-role channel) would make the mechanic readable without touching balance.
3. **Make the capture a player action again.** `EXTRACT_ELITE`
   (`defense-run-simulation.js:894-910`) is unreachable dead code; the auto-hold path
   claims the capture first. This is a code fix, not an art one, and it is the difference
   between the recommended novelty element being a decision and being a timer.
4. **Run the impression scoring.** ≥5 human testers, on a build where 1–3 have landed.
   Until then G8's second half stays PENDING regardless of how good the frequency number
   is — and scoring it before 3 lands would measure the wrong mechanic.
