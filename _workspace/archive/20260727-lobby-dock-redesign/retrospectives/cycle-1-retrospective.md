# Cycle 1 Retrospective — 20260727-lobby-dock-redesign

## What shipped

Replaced the D9 unified shell's `#command-shell` (full-viewport top overlay
lobby, collapsing to a FAB) with a permanent left/right idle-genre dock
system per the user's explicit request. Commit `f1fcb5d`. Scoped UI/IA
micro-cycle — no worldview, balance, revenue, or core-loop content touched.

## Gate table (measured values)

| Gate | Scope this cycle | Verdict | Measured value | Evidence |
|---|---|---|---|---|
| G4 | Accessibility inputs only (no new scenes/effects, so immersion score N/A) | PASS | touch targets 48/44px (documented exception)/56px; contrast 8.58:1 (AAA clears 7.0); reduced-motion suppressed live | `qa/gate-measurements.md#g4`, `ui/accessibility-audit.md`, `production/gate-reviews/ui-g4-g6.md` |
| G6 | UI perf inputs only (ops/telemetry/runbook content untouched) | PASS | DOM worst-case 296/5000 (5.9%); input latency 1.2ms/100ms (1.2%); full perf-budget table green at both required viewports | `qa/gate-measurements.md#g6`, `ui/perf-notes.md`, `production/gate-reviews/ui-g4-g6.md` |
| G1 | Not formally in scope; one G1-relevant regression found as a QA-regression byproduct | Fixed, not formally audited | canonical vocabulary restored + verified 5/5 pass | `production/decision-log.md#D1/defect_a` |
| G2/G3/G5/G7/G8 | N/A — no balance/revenue/loop/worldview content changed | N/A | — | — |

## Process notes

- **Two-lane parallel verification worked**: dispatching QA regression and
  UI accessibility/perf audit as independent, simultaneous subagent lanes
  (rather than sequential) caught issues neither would have found alone —
  QA found the 40×40px touch-target regression from a functional-testing
  angle while auditing the implementation; DockA11yPerf found it
  independently from a pure measurement angle and messaged the fix
  directly to the implementer via IRC before the director even reviewed.
  Cross-verification, not single-source trust, is what surfaced it fast.
- **QA correctly refused to silently patch production code** when it found
  3 genuine defects beyond its authorized scope (2 spec-anticipated test
  retargets it *was* authorized for). This is the harness working as
  designed: QA reports, director arbitrates with first-hand evidence
  before deciding fix vs. waive vs. escalate. Every one of the 3 defects
  needed actual investigation (not rubber-stamping QA's read) — one
  (import-defense reachability) turned out to be a correct, spec-
  intentional trade-off with only the *test's* assumption needing an
  update, not the product; the other two (dropped vocabulary, edge-card
  class collision) were genuine product bugs.
- **Spec quality mattered directly to defect rate**: the implementer's own
  report noted resolving a genuine internal ambiguity between two spec
  sections (§3.1 vs §5's rail-collapse mechanism) — a well-written spec
  with an inherent seam still needs an implementer with the authority to
  interpret and the downstream verification lanes to confirm the
  interpretation matched intent (both DockRegression and DockA11yPerf
  independently re-derived the spec's own §5.4 canvas-visibility numbers
  from live measurement and confirmed the implementer chose correctly).
- **One coordination gap**: the director's `resume`/`steer` call to
  `DockImplement` after the touch-target finding hit an expired-session
  error (subagent had already gone idle past the resumable window). The
  actual fix had already landed — likely via the implementer's own
  proactive IRC coordination with DockA11yPerf, per that agent's own
  report ("DockImplement had already messaged proactively with deviation
  context before this audit"). Director independently re-verified the fix
  live rather than assuming the IRC exchange alone was sufficient
  evidence — correct caution, though the session-expiry near-miss is worth
  noting: subagent resumability windows are not unlimited, and
  a director's own direct-write authority (app.js/styles.css are
  explicitly in scope for this harness's direct-edit allowlist) is the
  right fallback when a subagent has already gone cold, not a queued
  message that may never be read.

## Unresolved risks

- None blocking. `ui/perf-notes.md` and `qa/gate-measurements.md` note the
  spec's own structural DOM-count estimates undercounted real measured
  values by 26–45% at 3 of 4 measured states (still <6% of the 5000
  ceiling in absolute terms) — attributable to `hydratePortraits()`-
  injected mesh-thumbnail subtrees the static markup-function inspection
  couldn't see. Not a risk at current scale; worth remembering if a future
  cycle adds substantially heavier per-panel content, since the estimation
  methodology (markup-function inspection) should account for portrait
  hydration next time.
- The 3 pre-existing, out-of-scope unit-test failures (`battle-session-
  cutscene-audio.test.mjs`, `world-presentation-contract.test.mjs`,
  `stage1b-evidence-exporters.test.mjs`) remain unresolved — confirmed
  unchanged, not touched by this cycle, but still open technical debt for
  a future cycle to address.

## Next-cycle entry decision

**No re-entry required this cycle** — the scoped micro-cycle closed clean
(PASS on both reviewed gates, zero open defects). If a future need arises:
this was Stage 1d-equivalent work (new IA/HUD direction), so a follow-up
UI cycle re-enters at Stage 1 Phase 1d-equivalent again (not Stage 2 —
no balance/QA-exploit content exists to retune). Next public beat per the
original brief: **internal playtest re-verification of the shell layout**
before the next release cut — this cycle's own verification (browser
contracts, unit suite, accessibility/perf, manual multi-viewport check)
satisfies that beat's technical bar; an actual human playtest session
against the new layout is the recommended next step before shipping to
`main`/a release branch.
