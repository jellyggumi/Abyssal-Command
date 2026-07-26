# Stage 1b Rendered Study Protocol

status: `protocol-draft-for-director-review`

## G7 moderated re-entry study

- Participants: `10`.
- Sorties: two independent Cinder sorties per participant, with one neutral one-sentence control explanation.
- Eligible decision: a sortie reaches the post-result staging choice after extraction success or decline. Facilitators do not prompt replay.
- Required evidence for each of `20` eligible decisions: visible elite prompt, movement into extraction zone, hold progress completion, accepted `EXTRACT_ELITE`, visible `ELITE_EXTRACTED`, persisted `ember-cohort` state on return, and voluntary next-Cinder choice.
- Pass threshold: at least `14/20` voluntary re-entries (`>=70%`). Every completed circuit must be `30–90 s` from first actionable movement to staging return.
- Evidence: screen recording plus observer row keyed by participant, sortie, event sequence, and build SHA. Raw recordings are not replaced by screenshots or synthetic replay.

## G8 first-exposure study

- Direct-feature survey: five source-backed comparison titles, each scored for the presence of the exact Elite Extract / persistent-companion hook. Report a reviewed frequency `<=2/5`; do not count approximate genre similarities.
- Human impression: ten first-exposure sessions, raw 1–5 impression scores and a median. Pass threshold is `>=4.0/5`.
- The five-title table and ten-session scores must identify source, date, build, and reviewer. No unsourced consensus or scripted score counts.

## Moderation controls

- No facilitator action may select growth, stance, extraction, or re-entry for the participant.
- No paid path, account, premium currency, ads, gacha, paid power, paid reroll, or paid recovery may be introduced.
- Record comprehension failures as observations; do not patch the UI during the session.
- A missing screen step, missing persistence proof, or missing raw score is an evidence failure, not an inferred pass.

## Review gate

The director reviews the protocol and the machine-readable evidence schema before any new balance numbers are proposed. A failed human threshold leaves G7/G8 blocked and returns the packet to design; it does not authorize a numerical retune.
