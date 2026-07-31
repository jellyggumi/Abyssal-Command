# 26 — Gate evaluation

- **Version** v1 (2026-07-31)
- **Skill** `/skill:game-studio-harness` (the numeric quality gates) with `/skill:data-analysis` to
  decompose a failing gate
- **Produces** the gate verdict JSON for the change, and — when a gate fails — the decomposition of
  *which observed value* missed *which threshold*.
- **Placeholders** `${stageId}`, `${evidenceDir}` (default `qa/evidence/gates/`),
  `${verdictPath}`, `${buildSha}`.

---

**CONTEXT:**
`scripts/evaluate-stage1b-gates.mjs` is the gate. It reads twelve artifacts, recomputes every claim
from raw events, and emits `stage1b-gate-verdict-v1` with `PASS` / `FAIL` / `BLOCKED` per gate.
`BLOCKED` means "evidence not recomputable", and it is never downgraded to `FAIL`.

Thresholds, verbatim from the evaluator:

| Gate | Threshold |
|---|---|
| G2 | each of 5 archetypes **9–11 explicit wins / 20** canonical symmetric pairs (ties are not wins); 15 pressure rows each `gateMinPct` **55.0–80.0 %**, defeats **0–3/15**, boss TTK `MEASURED` and **5.95–8.05 s** |
| G3 | `BOSS_RALLY_COOLDOWN_REDUCTION = 0`; exactly one TURRET FRONT companion per accepted transition; **0** zero-damage post-switch conversions across ≥ 50 rally→TURRET transitions; ≥ 1 `COMPANION_DOWNED` across ≥ 50 VANGUARD + ≥ 50 SPLIT controls; control defeat rate ≤ **0.20**; legal-combo `maxEV/medianEV ≤ 1.30` over the 5 canonical seeds |
| G5 | `N_A` — no monetization surface exists in this build |
| G6 | four device tiers + a 30-minute soak: frame p95 ≤ **16.7 ms**, long-frame ratio < **0.005**, input p95 ≤ **100 ms**, DOM < **5000**, stable heap slope; telemetry/rollback/release-readiness/UI-browser provenance present with matching sha256; unisolated measurement ⇒ `BLOCKED_PENDING_ISOLATED_MEASUREMENT` |
| G7 | ≥ **14/20** voluntary re-entries, 10 participants × exactly 2 eligible decisions, every circuit **30–180 s**, ≥ 3 unique canonical player actions, ≥ 1 `ELITE_EXTRACTED`, human-confirmed, non-synthetic, recorded and observer-signed |
| G8 | 5 sourced titles with direct-feature count ≤ **2/5**; 10 first-exposure raw scores, median ≥ **4.0/5**, verbatim question and 1–5 scale |

Readiness gates the gates: the pressure artifact must be exactly 15 runs (stances
VANGUARD/TURRET/SPLIT × seeds 401–405) with 3 packets each and retained raw events; persistence must
be exactly the three scenarios `victory`, `defeat-after-acceptance`, `defeat-before-acceptance`.

**ROLE:**
You are the verification-strict programmer of the harness. You do not accept a summary field when
the raw events are available; you recompute. A gate you cannot recompute is `BLOCKED`, and `BLOCKED`
blocks release.

**ACTION:**

1. Regenerate the machine evidence the change invalidates, in this order:
   `run-stage1b-symmetric-trials.mjs` → `export-stage1b-formation-attribution.mjs` →
   `run-stage1b-pressure-packets.mjs` → `run-stage1b-persistence-scenarios.mjs`. Keep every output
   under `${evidenceDir}` with its receipt.
2. Run the evaluator with all twelve inputs and `--output ${verdictPath}`. Record
   `overallDisposition` and the full `failures` array verbatim.
3. For each non-`PASS` gate, decompose: the observed value, the threshold, the row/seed/stance that
   produced it, and whether it is a *miss* (FAIL) or *missing evidence* (BLOCKED).
4. Attribute each miss to the change under review, to a pre-existing condition, or to another
   session's concurrent work. Quote the baseline verdict for comparison.
5. State the human-gate position honestly. G7 and G8 require ten human participants, screen
   recordings with sha256, and observer signatures; a synthetic artifact may not claim them
   (`synthetic_controller` must be `false`, and the producers mark themselves
   `deterministic-scripted-measurement-not-human-playtest`).
6. If G6 evidence exists but is not marked isolated, report `BLOCKED_PENDING_ISOLATED_MEASUREMENT`
   rather than re-running until a number looks better.
7. Update `tests/stage1b-gate-evaluator.test.mjs` expectations ONLY when the threshold itself
   changed by decision — never to accommodate an observation.

**FORMAT:**
`${verdictPath}` (the evaluator's JSON) plus a markdown summary next to it: per-gate verdict,
observed vs threshold, decomposition of every failure, attribution, and the explicit list of gates
that are human-blocked rather than failed.

**TARGET AUDIENCE:**
The release owner, who may not ship on a `BLOCKED` disposition, and the designer who must decide
whether a `FAIL` is a tuning miss or a design error.

**HARD CONSTRAINTS:**

- Numbers gate everything; no adjective passes a gate (`CLAUDE.md` §6).
- Never weaken a threshold to pass. Threshold changes are a separate, argued decision with their own
  `VERSIONS.md` row.
- Never label synthetic evidence as human evidence, and never re-label `BLOCKED` as `FAIL`.
- Regenerate evidence with the shipped producers; hand-edited JSON is not evidence.
- Every claim must be recomputable from retained raw events; that is what the evaluator checks.
- Report the exact command lines and artifact paths.

**DONE WHEN:**
`${verdictPath}` exists, its `overallDisposition` is recorded with every failure decomposed and
attributed, `node --test tests/stage1b-gate-evaluator.test.mjs tests/stage1b-g3-g7-verification.test.mjs
tests/stage1b-pressure-packets.test.mjs tests/stage1b-persistence.test.mjs
tests/stage1b-evidence-exporters.test.mjs` passes, and no threshold was moved to obtain the result.
