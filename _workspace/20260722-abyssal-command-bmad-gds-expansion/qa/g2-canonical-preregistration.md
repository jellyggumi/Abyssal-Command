# G2 canonical measurement preregistration — BLOCKED

**Recorded:** 2026-07-22  
**Owner:** game-production-director + game-qa  
**State:** `BLOCKED — do not collect full-G2 evidence yet`  
**Scope:** A full, gate-eligible G2 measurement corpus only. The existing bounded Cinder Span diagnostic export is unchanged. The user has separately authorized the bounded runtime expansion defined below to create the deterministic source facts needed for later G2 admission; that implementation authorization is not corpus admission, a G2/G8 result, or release scope.

## What is now available

`qa/evidence/gates/G2-archetype-and-combat-sweep.jsonl` is the correctly named, checksummed 5-profile × 3-seed Cinder Span diagnostic package. Its runner now retains detached public snapshot events on every simulation tick, so it captures active-skill damage, basic damage, criticals, and cooldown events instead of only the terminal tick. The manifest and summary explicitly remain `INCOMPLETE / NOT_PASSED`.

That package removes the **final-tick event-loss defect only**. It does not define or supply full-route outcome, ordinary/elite/Stage-10 TTK, combo comparison, route/movement, or all required mechanics coverage.

## Director synthesis — bound decision registers; collection remains blocked

The decision data below bind exact paths, schemas, and digests. The headless runner's focused fail-closed proof is recorded in `qa/stage-2-reverification.md`; it proves neither candidate admission nor a corpus. This preregistration does **not** attest the remaining fixture adapter, collection authorization, corpus, M6 evidence, a G2 result, a G8 result, or release permission.

| Register | Canonical path | Version | Bound digest |
| --- | --- | --- | --- |
| Assessment units | `design/g2-assessment-units-v1.json` | `g2-assessment-units-v1` / `1.1.0-runtime-backed` | file SHA-256 `1f7a4f9a36e68b27e8d129a50503f284c564251e3765756c6468d1d44a7d6804` |
| TTK cohorts | `design/g2-ttk-cohort-register-v1.json` | `g2-ttk-cohort-register-v1` / `1.1.0-runtime-backed` | file SHA-256 `6471f16bf7ee618b40b14de9a684421ec6c5c42c13f9375894862ad7800bd579` |
| Combo comparator | `pm/g2-combo-comparator-register-v1.json` | `g2-combo-comparator-register/1` | file SHA-256 `d2cc608450c447fa4a5ebd1327f22f1a80030f459f4ad6530acd4125d2da5c43` |
| Full-route seeds | `qa/g2-full-route-seed-register-v1.json` | `g2-full-route-seed-register-v1` | canonical payload digest `sha256:05fca1f271112edd0dfb78244ec4727399eef60ebee24be673ba0f5d7de5f623` |
| Input tapes | `qa/g2-input-tape-register-v1.json` | `g2-input-tape-register-v1` | canonical payload digest `sha256:665ad2b7cf0817b9b4aa9a3856cbdd8edf3f1b8eb583317ff60ac66c42216dcb` |
| Expected tuples | `g2-expected-tuples-v1.json` | `g2-expected-tuples-v1` | canonical payload digest `sha256:e83ec46c671b613e33d009d27bb237acea96019f25cab4d07b5e4acd024bc704` |

The workspace-root expected-tuple register is the sole QA-owned canonical tuple register. The workspace-root seed and input-tape duplicates remain non-authoritative provenance and cannot support collection. Their canonical QA payload digests are respectively `sha256:05fca1f271112edd0dfb78244ec4727399eef60ebee24be673ba0f5d7de5f623` and `sha256:665ad2b7cf0817b9b4aa9a3856cbdd8edf3f1b8eb583317ff60ac66c42216dcb`; the regenerated expected-tuple digest is `sha256:e83ec46c671b613e33d009d27bb237acea96019f25cab4d07b5e4acd024bc704`. This closes provenance only; no collection is admitted.

### Bounded runtime-expansion implementation authorization — not corpus admission

**Recorded user selection (2026-07-22):** actual runtime expansion is authorized only to close the deterministic G2 prerequisites below. Game-programmer and game-qa may implement the following source-backed surfaces; no resulting runtime behavior, catalog fact, test result, or binding is evidence until the ordered admission prerequisites are complete.

1. A **headless, deterministic 60 Hz full-route measurement runner** that consumes only the bound expected-tuple, QA seed, and QA tape registers; validates their declared cross-register digests before execution; stops `INCOMPLETE / NOT_PASSED` when collection admission is absent; emits the registered terminal/checkpoint/event identity needed for the frozen calculations; retains observer non-interference; and leaves the existing Cinder Span diagnostic runner and its test unchanged.
2. A **source-backed deterministic map/wave/terminal lifecycle**: an exact `MapKey`, immutable pre-tick-0 `MapPlan` digest, immutable `WavePlan`/encounter digest, pressure/fallback inventory, finite terminal tick ceiling, and terminal-outcome mapping. Map or wave state must neither regenerate nor silently fall back after tick 0.
3. **M4 recovery/card semantics** implemented as explicit deterministic source behavior, including the card/recovery facts and event attribution the frozen calculation requires; they must not be inferred from a terminal snapshot.
4. **M5 stable event IDs** implemented for the relevant emitted lifecycle, cast, causal, target, and resolved events so the same bound input produces stable identities without observer-dependent mutation.
5. A **QA-only M6 multi-skill fixture** that admits at least two distinct active-skill ability IDs with explicit linked cast/causal/target/resolved-event identities, a non-empty finite signature registry, and the signed finite map/seed/deck-position comparator population. This addresses `G2-COMBO-MULTISKILL-001`; a one-skill string, inferred median, or substituted row remains forbidden.

The required focused proof set includes `tests/g2-full-route-runner.test.mjs`, `tests/g2-measurement-fixture.test.mjs`, and tests covering each authorized map/wave/terminal, M4, and M5 binding. The test results are prerequisites, not collection evidence. The only permitted evidence destination after a later, separate corpus-admission authorization is QA-owned `qa/evidence/gates/`.

This is the sole limited replacement for the former player-facing/runtime/catalog-change exclusion: only the listed deterministic lifecycle, recovery/card, multi-skill-fixture, and stable-event-ID implementation may change. It does not authorize balance/tuning, rewards, progression, idle/return, monetization, providers, network, telemetry upload, account, release, or deployment work. No collection is authorized by this document.

## User direction and required pre-collection bindings

**Recorded user direction (2026-07-22):** select actual runtime expansion for the bounded implementation scope above, then complete the G2 corpus only after the ordered predecessor chain is satisfied. This is an **implementation authorization and collection intent only**. It is not a role signature, a signed corpus-admission authorization, a runner/fixture attestation, a candidate admission, a collection receipt, an R1/R2 review, or a G2/G8 verdict. The active fail-closed runner must therefore continue to emit `INCOMPLETE / NOT_PASSED` with zero admitted candidates until the factual bindings below exist.

### Current evidenced state

- The active runner no-manifest boundary must emit only `manifest → run_stopped → summary`, with `FAIL_COLLECTION_NOT_AUTHORIZED`, zero started runs, zero terminal runs, and no metric/outcome record.
- Expected tuples now close **112,916** IDs: M1–M7 include the six finite M6 candidates and four M4 cases, including exact decline-then-select retained events. Enumeration, a local trust registry, and a future test-only cryptographic key do not authorize collection.
- The local admission trust registry has no active collection key and no signed admission manifest exists. Future isolated test copies may use test-only Ed25519 keys; every real candidate remains blocked on role signatures, canonical payload digest, expiry, and one-use nonce verification.
- M6 requires linked core cast/causal/target/resolved facts and a finite comparator calculation; any missing, non-finite, or zero-denominator fact is retained invalid and cannot produce a result.

### Factual bindings required before collection

1. **Map/wave/terminal admission:** for every admitted full-route tuple, bind the exact `MapKey`, immutable pre-tick-0 `MapPlan` digest, immutable `WavePlan` digest/encounter plan, pressure/fallback inventory, finite terminal tick ceiling, and terminal-outcome mapping. Map/wave state must not regenerate or silently fall back after tick 0.
2. **Runner-source identity:** fill the runtime-generated source revision, runner/build hash, catalog digest, serializer version, map/wave grammar versions, fixture-adapter revision, and observer-A/B implementation hashes in the candidate/manifest records; each must equal the frozen registers and canonical tuple identity.
3. **M6 fixture/comparator admission:** provide a QA-only fixture with at least two distinct active-skill ability IDs, linked cast/causal/target/resolved-event identities, a non-empty finite signature registry, and the signed finite map/seed/deck-position comparator population. A one-skill string, inferred median, or substituted row remains forbidden.
4. **Execution design closure:** game QA must regenerate the complete expected tuple set from the accepted finite registers and retain exactly one terminal-or-stop/failure row per required ID, including the required observer/cadence replay members and M7's separately scoped raw-action workload. Missing, duplicate, incomplete, or unregistered rows remain blocking evidence, never implied results.
5. **Fail-closed collection record:** the runner must validate every binding before candidate selection, preserve the first failure/divergence, and emit no outcome, TTK, win rate, cooldown share, combo result, or threshold conclusion for an unadmitted or incomplete tuple.

### Exact predecessor order before corpus admission

1. **Implement:** complete only the five authorized runtime surfaces above: runner; source-backed map/wave/terminal lifecycle; M4 recovery/card semantics; M5 stable event IDs; and the M6 two-skill fixture/comparator surface.
2. **Prove:** execute the focused tests for every implemented surface, including the fail-closed runner and M6 fixture tests; failures, absent tests, or unbound source behavior stop here.
3. **Bind and sign:** populate and sign the map/wave/terminal facts, M4/M5 identities, M6 signature/comparator population, runtime source identity, fixture revision, and execution closure against the frozen registers.
4. **Attest roles:** complete the required designer, QA, programmer, and reconciled M6-owner records below; role assignment or the user's direction alone is insufficient.
5. **Review independently:** R1 package-integrity and R2 metric-reproducibility reviewers independently review the signed bindings and focused proof results without authoring, executing, regenerating, or modifying them.
6. **Admit separately:** only after steps 1–5 exist may the authorized collection control record admit candidates; the fail-closed runner otherwise emits no metric or outcome.

This ordering authorizes implementation work before collection, not a corpus, gate verdict, release decision, or release.

### Required role records — separate from user direction

| Record required | Responsible role(s) | Exact boundary |
| --- | --- | --- |
| Finite route/map/wave/tape, pressure/fallback, terminal, TTK, and multi-skill applicability acceptance | game-designer | Existing measurement-only definitions do not grant collection authorization; the accepted values must be the same values referenced by every tuple. |
| Exact expected-tuple closure, raw-event/failure-row protocol, and corpus custody | game-qa | Countersign the finite population, reject missing/extra rows, and retain first-falsifier evidence without mutating the runner. |
| Runner admission and immutable runtime identity | game-programmer + game-qa | Attest the selected runner/fixture against the exact registers, populate runtime identity facts, and prove observers cannot write canonical state. A passing fail-closed test alone is insufficient. |
| M6 attribution boundary | game-designer + game-qa per `pm/g2-combo-comparator-register-v1.json`; `qa/g2-coverage-matrix.md` additionally names game-pm | Before collection, reconcile this owner-set conflict in a real signed record, then sign the actual multi-skill signature and comparator population. Existing PMD-06 is measurement-only attribution/no-commercial scope, not collection authorization. |
| Independent review assignment and completion | game-production-director; R1 package-integrity reviewer; R2 metric-reproducibility reviewer | Bind R1 and R2 before collection, then independently review the signed bindings and focused proof results; neither reviewer may author, execute, regenerate, or modify the corpus or its reviewed prerequisites. |
| Post-corpus disposition | game-production-director, only after valid R1/R2 | Compare reproduced measurements to this preregistration; no disposition is granted now. |

No entry in this section authorizes collection, candidate execution, a PASS, release, or deployment. G2 remains `NOT MEASURED / NOT PASSED`; Stage 2 remains `REDO`; G8 remains `NOT MEASURED / NOT PASSED`; release remains `BLOCKED`.

## Frozen calculation rules once signed

1. **Coverage:** construct expected tuples from the signed matrix; every declared run/replay must be present, complete, checksum-valid, and digest-identical under every declared observer mode.
2. **Win rate:** `wins / eligible complete full-route runs` within each signed assessment unit. Never pool profiles, cohorts, or input policies.
3. **TTK:** `terminal_tick − spawn_tick` only for a matched target instance that has both spawn and kill events; report p5/p50/p95 by signed assessment unit. Missing terminal events remain `NOT_OBSERVED`.
4. **Combo EV:** sum `finalDamage` for every linked resolved-damage event in a signed combo instance, calculate comparable-combo EV across its declared seed/deck-position population, and reject any value above `1.30 × median` of that comparator set.
5. **Cooldown EV share:** per assessment unit, divide resolved active-skill `finalDamage` by resolved total offensive `finalDamage` in the same signed attribution scope. A zero denominator is `NOT_OBSERVED`, never 0%.

## Gate boundary

Until the ordered implementation, focused proofs, signed bindings, role attestations, and independent R1/R2 reviews are complete and a separate collection control record admits candidates, **G2 remains `NOT MEASURED / NOT PASSED` and Stage 2 remains `REDO`**. G8 remains `NOT MEASURED / NOT PASSED` and independently blocked on a preregistered, consented human first-exposure/impression task; release remains `BLOCKED`. No corpus collection, gate change, release, or deployment is authorized here. Only the bounded runtime-expansion implementation scope above is authorized, and it cannot itself create evidence or change a gate disposition.

## Sources

- `design/g2-assessment-contract.md` — source assessment, terminal, TTK, and combo definition rationale.
- `pm/g2-offense-attribution-contract.md` — source offense/combo attribution and no-commercial-change boundary.
- `engineering/g2-full-route-runner-contract.md` — runner admission/export/stop requirements; no admitted implementation evidence.
- `qa/g2-coverage-matrix.md` — cardinality and R1/R2 review authority.
- `qa/gate-measurements.md` — authoritative G2 threshold and gate state.
- `qa/expanded-stage-test-plan.md` — required encounter, movement, mechanics, and evidence surfaces.
- `design/balance-sheet.md` — numeric target provenance and measurement-only fixture boundary.
- `pm/negotiation-record.md` — active-skill/cooldown accounting and no-retune authority boundary.
- `qa/stage-2-reverification.md` — previous REDO disposition and evidence limits.
- `production/gate-reviews/stage-2-deterministic-measurement.md` — director scope and no-release rule.
