# Stage 1b Rendered Human-Study Collection Protocol

**Packet status:** G7 `BLOCKED / UNMEASURED`; G8 `BLOCKED / UNMEASURED`.

No human session or source-review result is included in this packet. A screenshot, scripted controller, browser automation run, synthetic replay, or filled example is not a human observation. Keep the three template files unchanged; for collection, copy the `x-blank-instance` into a separately retained evidence artifact and populate it under the template's JSON Schema.

## Packet files

- [`g7-session-observer-template.json`](./g7-session-observer-template.json) defines the participant, exclusion, decision, event, timing, and G7 calculation fields.
- [`g8-direct-feature-survey-template.json`](./g8-direct-feature-survey-template.json) defines the five source-backed comparison rows and direct-feature calculation fields.
- [`g8-impression-session-template.json`](./g8-impression-session-template.json) defines the ten first-exposure human sessions, raw 1–5 scores, and median calculation fields.

The JSON files are schemas plus intentionally empty `x-blank-instance` objects. Nulls and empty arrays in those blank instances mean **unmeasured**, not zero-valued evidence.

## Shared custody and evidence identifiers

1. Freeze one rendered build before recruitment. Record its full 40-character lowercase Git SHA as `build_sha`; do not combine builds in one collection.
2. Assign opaque participant IDs in collection order: `G7-P01` through `G7-P10` and `G8-P01` through `G8-P10`. Do not put names, email addresses, or other direct identifiers in evidence names or JSON.
3. Number a participant's G7 sorties `01` and `02`; the G8 first-exposure sortie is `01`.
4. Preserve the uninterrupted session recording as event `000`. Name it:
   `<build_sha>__<participant_id>__s<sortie_sequence_2_digits>__e000__session-recording.<ext>`
5. Name every derived clip, event export, or frame:
   `<build_sha>__<participant_id>__s<sortie_sequence_2_digits>__e<event_sequence_3_digits>__<evidence-kind>.<ext>`
6. Event sequences are fixed by the corresponding template and start at `001`. The filename SHA, participant, sortie, and event sequence must equal the JSON row. Record a SHA-256 digest for the uninterrupted recording and every referenced evidence file.
7. Derived clips and stills locate events; they never replace the uninterrupted recording. Retain source files read-only. Record protocol deviations verbatim rather than editing observations after the fact.
8. Survey sources remain externally addressable evidence. Record the HTTPS source URL, source title, source kind, access date, and exact quote or mechanical observation in the survey JSON; do not substitute a local screenshot for the URL.

## Shared eligibility and exclusion rules

### Include

- A participant must be a real human who has consented to the recorded session, can operate the approved controls with any recorded accessibility configuration, and has not already contributed to that gate on the same build.
- An included G7 participant must provide two scheduled Cinder sorties. Prior Abyssal Surge or genre experience is recorded but is not a G7 exclusion.
- An included G8 impression participant must be encountering the `pressure-bound-elite-extraction` choice for the first time. Prior participation in G7 on this candidate/build is prior exposure and is therefore ineligible for G8.

### Exclude only before the relevant observation

- Exclude for no recording consent, a non-human/scripted controller, duplicate participation on the build, an unresolved control/accessibility failure, or a technical failure before the participant reaches the observation boundary.
- For G8, also exclude disclosed prior exposure to the candidate, a recording, a study explanation, or the same rendered route.
- Log every exclusion in the appropriate template with the enumerated reason code and a note. Recruit a replacement so the final included set still contains exactly 10 unique people.
- Once a G7 sortie reaches the post-result staging choice, it is an eligible decision and cannot be removed because of the route outcome, no re-entry, low enthusiasm, missing evidence, facilitator error, or timing miss. Keep the row; the defect blocks the verdict.
- Once a G8 raw score is asked and answered, it cannot be removed because the score is low, the participant declined extraction, or confusion was observed. Keep the row and record the confusion. A missing score is not `0` and is not an included scored session.

## Moderator neutrality

The moderator may resolve a pre-session control or accessibility problem but must not select growth, stance, movement, extraction, re-entry, or an impression response for the participant. Do not mention novelty, desirability, rewards, replay targets, or the pass thresholds. Do not introduce a paid path, account, premium currency, ads, gacha, paid power, paid reroll, or paid recovery. Do not patch the UI or balance data during collection.

Read this one-sentence control explanation exactly once before each participant's first sortie:

> Use the controls shown on screen and make the choices you would make if you were playing on your own.

The scheduled second G7 sortie may be introduced only after the first re-entry decision has been locked, using:

> We will now run the second scheduled sortie.

That transition is not a replay invitation and cannot change the recorded first decision.

## G7 moderated re-entry study

### Required collection

- Exactly `10` included human participants.
- Exactly two eligible decisions per participant, `20` total.
- At least `14` voluntary next-Cinder choices, computed across all 20 eligible decisions.
- Every completed circuit duration is inclusive within `30.000–180.000 s`.
- Every eligible decision has the complete ordered visible/event evidence in `g7-session-observer-template.json`.

A sortie becomes an **eligible decision** at the first rendered frame where the post-result staging choice is visible after extraction success or a deliberate extraction decline. Reaching this boundary fixes the row in the denominator. A technical failure before that boundary is an exclusion; a failure at or after it is retained evidence failure.

### Exact G7 moderator sequence

1. Before the participant enters, verify the frozen build SHA, clear other participants' local data, load the approved neutral pre-Cinder state, verify recording capacity, and open a new observer row. Do not rehearse extraction.
2. Confirm consent, human participation, build-unique participation, and usable controls. Assign the next opaque G7 ID. Start the uninterrupted screen recording before reading the control sentence.
3. Read the control sentence verbatim. Answer control questions only by repeating it or pointing to the controls already shown on screen.
4. For sortie `01`, expose the actionable Cinder build and remain silent. `timing_start_recording_ms` is the recording timestamp of the participant's first movement input that changes the controlled unit's rendered position after control is handed over. Menu navigation, camera motion, and moderator setup do not start the timer.
5. Record events `001–007` in the template's fixed order. An event is complete only when its required state is visible in the rendered build and the evidence reference resolves to the matching recording/clip. Also record the unique authored `player_action_ids` actually visible in the uninterrupted recording and the unique `reward_event_ids` visibly emitted; do not infer either list from simulation state. Event `004` must show accepted `EXTRACT_ELITE`; event `005` must show `ELITE_EXTRACTED`; event `006` must show persisted `ember-cohort` after return. A deliberate-decline row remains eligible but cannot be marked as having those events occurred; because G7 requires all event evidence, that evidence miss keeps G7 blocked.
6. `timing_end_recording_ms` is the timestamp of the first rendered frame on which staging is visible and accepts player input after the sortie result. Compute duration from the two timestamps; do not use event logs, simulation ticks, or facilitator estimates as substitutes.
7. At staging, say nothing. Record event `008` when the participant voluntarily selects the next Cinder circuit, instead chooses another visible action, explicitly says they are done, or takes no action for 30 seconds. Only an unprompted next-Cinder selection is `voluntary_reentry=true`; every other case is `false`.
8. Lock sortie `01`'s re-entry value. If the participant voluntarily entered Cinder, that run is sortie `02`. Otherwise read the scheduled-second-sortie transition verbatim and load the approved neutral pre-Cinder state without describing replay benefits.
9. Repeat steps 4–7 for sortie `02`. After its event `008`, end the recording. Do not solicit a reason until all behavioral fields are locked; any optional quote remains a note and never changes the boolean.
10. The observer verifies filenames, SHA-256 digests, timestamps, fixed event order, and protocol deviations, then signs the row in UTC. Do not infer a missing screen step from a simulation trace.

### G7 deterministic calculation

For the completed G7 collection:

```text
included_participant_count = count(participants where included = true)
eligible_decision_count = count(decisions where eligible_decision = true)
voluntary_reentry_count = count(eligible decisions where voluntary_reentry = true)
voluntary_reentry_rate =
  null, when eligible_decision_count = 0
  voluntary_reentry_count / eligible_decision_count, otherwise
circuit_duration_seconds = (timing_end_recording_ms - timing_start_recording_ms) / 1000
player_action_count = count(unique player_action_ids recorded for the decision)
reward_event_count = count(unique reward_event_ids recorded for the decision)
```

Set `all_participants_have_two_decisions=true` only when each of 10 unique included participant IDs has exactly sorties `01` and `02`. Set `all_event_sequences_complete_and_ordered=true` only when every decision has exactly the eight event types in template order with matching `001–008` filenames and digests. Set `all_required_events_occurred_and_visible=true` only when all eight events in all 20 rows have both `occurred=true` and `visible_in_rendered_build=true`. Set `all_circuit_durations_in_30_to_180_seconds=true` only when every recomputed duration satisfies `30.000 <= duration <= 180.000`. Set `all_circuits_have_minimum_actions_and_reward=true` only when every decision has at least three unique `player_action_ids` and at least one `reward_event_ids` entry.

G7 is `PASS` if and only if all of the following are true:

```text
included_participant_count = 10
eligible_decision_count = 20
all_participants_have_two_decisions = true
all_decisions_match_build_sha = true
voluntary_reentry_count >= 14
all_event_sequences_complete_and_ordered = true
all_required_events_occurred_and_visible = true
all_circuit_durations_in_30_to_180_seconds = true
all_circuits_have_minimum_actions_and_reward = true
```

Any false or missing condition yields G7 `BLOCKED`; do not reduce the denominator or round `13/20` upward. The blank template computes `0` participants, `0` decisions, a `null` rate, and `BLOCKED_UNMEASURED`.

## G8 direct-feature survey

### Candidate and taxonomy

Review exactly the five titles fixed in `g8-direct-feature-survey-template.json`: Arknights, Kingdom Rush, Dungeon Warfare 2, Vampire Survivors, and Hades.

The exact direct feature is the conjunction of all three source-established properties:

1. the player chooses the interaction during a live PvE run;
2. the interaction requires a spatial or time commitment under active combat pressure; and
3. it grants a persistent ally or companion into later play.

For each property record `PRESENT`, `ABSENT`, or `UNKNOWN`. Derive the row:

- `DIRECT` and `exact_feature_present=true` only when all three properties are `PRESENT`;
- `ADJACENT` and `exact_feature_present=false` when one or two are `PRESENT`;
- `ABSENT` and `exact_feature_present=false` when the reviewed sources affirmatively contradict all three;
- `UNKNOWN` and `exact_feature_present=false` when the sources cannot establish a classification.

Approximate genre similarity never counts as direct. `UNKNOWN` is not evidence of absence.

### Exact survey reviewer sequence

1. Assign one accountable reviewer ID and review date for each title row.
2. Open a primary or official source first. Secondary references may supplement but not replace available primary evidence.
3. Record every relied-on HTTPS URL, page title, source kind, access date, and exact quote or mechanical observation.
4. Score the three properties separately, then derive taxonomy and `exact_feature_present`; do not start from the desired frequency.
5. Record uncertainty, including contradictory or inaccessible sources. Never silently resolve `UNKNOWN` to `ABSENT`.
6. Confirm that each of the five expected titles occurs exactly once before calculating the result.

### Survey calculation

```text
completed_unique_title_count = count(unique completed expected-title rows)
direct_feature_count = sum(1 where exact_feature_present = true)
direct_feature_frequency =
  null, until completed_unique_title_count = 5
  direct_feature_count / 5, when all five rows are complete
```

The survey half of G8 is `PASS` if and only if all five expected titles appear once, every row has at least one source with URL/date/exact evidence, every row has reviewer/date, every taxonomy matches its three properties, and `direct_feature_count <= 2`. Missing, duplicate, unsourced, or underived rows yield `BLOCKED`, even if the provisional count is `<=2`.

## G8 first-exposure impression study

### Required collection

Collect one rendered Cinder first exposure from exactly `10` unique eligible human participants on one frozen build. Record every raw integer response; no average, transcript sentiment, scripted score, or observer estimate may replace the ten values.

### Exact G8 moderator sequence

1. Before recruitment, screen out prior exposure to this candidate/build, G7 participation on it, or viewing its study materials. Before the participant enters, verify the frozen SHA, neutral pre-Cinder state, recording capacity, and blank session row.
2. Confirm consent and eligibility, assign the next opaque G8 ID, start recording, and read the shared control sentence exactly once. Do not use the words distinctive, memorable, novel, extraction, companion, or future runs before play.
3. Expose one Cinder sortie and remain silent. Record events `001–007` in the template. Continue until the participant completes or deliberately declines the first visible extraction opportunity and returns to staging.
4. A technical failure before the first extraction opportunity permits a logged exclusion and replacement. A visible or comprehension failure at the opportunity is not discarded: preserve it, mark `unresolved_comprehension_failure=true`, and keep G8 blocked pending director disposition.
5. Immediately after the first completed or deliberately declined opportunity, ask exactly:

   > How distinctive and memorable was choosing to leave the fight to bind this elite for future runs?

6. Present the integer scale once: `1 = not distinctive`, `5 = very distinctive`. Accept only one raw integer from 1 through 5. If the participant gives a range or prose, say only, “Please choose one whole number from 1 to 5.” Do not interpret for them.
7. Record the raw integer as event `008`, together with route outcome, visibility, comprehension, any exact confusion quote, and the evidence reference. Do not change or normalize the score.
8. End recording. The observer verifies the SHA, first-exposure confirmation, filename/digest chain, fixed event sequence, exact question, raw value, and any protocol deviation, then signs the row in UTC.

### Impression calculation

Order the ten included sessions by participant number and copy their raw integers to `raw_scores_in_participant_order`. Sort the same ten values in nondecreasing order as `sorted_raw_scores = [s1, ..., s10]`. Then:

```text
median = (s5 + s6) / 2
```

The impression half of G8 is `PASS` if and only if there are exactly 10 unique eligible first-exposure participants and 10 raw integer scores, all sessions match the frozen build, all recordings and fixed event sequences are complete, `unresolved_comprehension_failure_count = 0`, the stored arrays reproduce the session rows, and `median >= 4.0`. A low value remains in the calculation; a missing value yields `BLOCKED`, not zero.

## Mechanical G8 verdict

G8 is `PASS` only when both independently calculated halves pass:

```text
G8_PASS =
  survey_verdict = PASS
  AND impression_verdict = PASS
```

Otherwise G8 is `BLOCKED`. In the supplied blank templates, the survey has `0/5` completed rows and `null` frequency, while impressions have `0/10` scored sessions and `null` median; therefore the current G8 verdict is `BLOCKED_UNMEASURED`.

## Review gate

The reviewer must parse the completed JSON artifacts against these templates, recompute every derived field from raw rows, spot-check each evidence reference against its uninterrupted recording or source URL, and compare the recomputed values to the stored calculation. A mismatch, missing source, missing human recording, missing raw score, missing required visible event, protocol deviation affecting neutrality, or threshold miss leaves the relevant gate `BLOCKED`. It does not authorize a balance retune and cannot be repaired with screenshots, scripted runs, inferred values, or fabricated replacement observations.
