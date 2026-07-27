# Decision Log — 20260727-lobby-dock-redesign

## D1 — QA-flagged production defects, director arbitration

QA (`DockRegression`) reported 3 defects beyond the 2 spec-anticipated test
casualties, correctly declining to fix them itself (out of its authorized
scope: production code + unauthorized test files). Director investigated
each directly with first-hand evidence before deciding disposition.

```yaml
defect_a:
  what: >
    app.js dropped the canonical brand string "ABYSSAL COMMAND · FARWATCH
    HOLD" entirely (it lived only in the deleted .command-header masthead),
    breaking tests/defense-public-contract-regressions.test.mjs's G1
    narrative-consistency vocabulary check.
  investigation: >
    Confirmed via `node --test` reproduction and `git diff app.js` — the
    string existed nowhere else in the shipped source. This is a genuine
    regression against G1 (narrative consistency: "100% of shipped
    strings/effects/scenarios trace to design/worldview.md"), not a stale
    test needing a selector update — the vocabulary itself was silently
    dropped, which the spec's own content-drop reasoning (hero-copy/masthead
    = "lobby screen theater") did not fully account for.
  disposition: FIX (production code)
  fix: >
    Restored the canonical string as a real accessible name
    (aria-label + title) on .dock-brand, which was previously aria-hidden
    with ZERO accessible name — this simultaneously closes an accessibility
    gap (a screen reader got nothing for the brand mark before) and
    satisfies the narrative-consistency test. Not a cosmetic-only patch.
  verified: "node --test tests/defense-public-contract-regressions.test.mjs -> 5/5 pass"

defect_b:
  what: >
    tests/defense-stat-delta-browser.test.mjs's zero-interaction
    #import-defense reachability assumption broke because the spec's own
    archive-tools consolidation (hud-layout-spec.md §4) moved that control
    into the stronghold dock tab, which is NOT the default active right-dock
    tab (sortie is, per component-contracts.md §1's computeDefaultDockOpen
    — an intentional, spec-authorized decision to keep #start-defense
    zero-interaction reachable, matching genre convention).
  investigation: >
    Manually reproduced in a live browser session (not just reading the
    diff): confirmed clicking into the stronghold tab makes #import-defense
    reachable and the import actually succeeds (status message appears);
    the failure was in the TEST's zero-interaction assumption, not in
    product behavior — a real user importing a save takes one extra tap
    now, which is an accepted, spec-documented trade-off (sortie defaults
    open, not stronghold), not a defect.
  disposition: >
    FIX (test file only) — retarget, not weaken: added the one-tap
    navigation to stronghold before the existing import assertions, matching
    real user interaction under the new IA. No assertion was removed or
    loosened.
  additional_bug_found_during_investigation: >
    The test's post-import wait condition used document.body.innerText,
    which does not see text inside a collapsed <details> element (a
    PRE-EXISTING pattern — .archive-tools was already a <details> before
    this redesign, confirmed via `git show HEAD~:app.js`). Not a redesign
    regression; the old test's wait condition happened to key off text
    ("3/3 슬롯") that lived outside the collapsed disclosure. Fixed by
    switching innerText -> textContent for this one wait condition.
  verified: "node --test tests/defense-stat-delta-browser.test.mjs -> 1/1 pass (25.3s)"

defect_c:
  what: >
    app.js's renderIdleReturnToast() set className="idle-return-toast
    edge-card rc-glass" — the literal "edge-card" token directly
    contradicts the adjacent styles.css doc comment (lines 122-125,
    unchanged by the implementer, authored as part of this same pass) that
    explicitly states the toast must NOT carry .edge-card, because that
    class's position:absolute + var(--defense-safe-top) rule only resolves
    correctly inside #defense-battle-surface -- the toast is a sibling of
    it, not a child.
  investigation: >
    Confirmed via live DOM construction in a browser session: an element
    with className "idle-return-toast rc-glass" (no edge-card) computes
    position:fixed/top:8px as intended; QA's report of the cascade
    collision (position collapsing to absolute/top:0, false-matching
    defense-hud-responsive-browser.cjs's '.edge-card:not(.defense-toast)'
    locator) is consistent with .edge-card's later source-order rule
    (styles.css:187) overriding .idle-return-toast's position:fixed
    (styles.css:126) at equal specificity.
  disposition: FIX (production code, one-token removal)
  fix: 'toast.className = "idle-return-toast edge-card rc-glass" -> "idle-return-toast rc-glass"'
  verified: >
    Live browser check: position:fixed, top:8px (was contradicting itself
    before). tests/defense-hud-responsive-browser.cjs (the contract that
    would have false-matched) -> full suite PASS post-fix.
```

## D2 — Touch-target fix already applied before director review

`DockA11yPerf`'s audit found `.dock-panel-tabs .dock-rail-tab` shipping at
40×40px (below the 48dp floor) and messaged `DockImplement` directly with
the fix; by the time the director inspected, the CSS already read
`width: 48px; height: 48px; min-width: 48px; min-height: 48px;` at both the
rail (`styles.css:46`) and panel-header (`styles.css:84`) selectors.
Director independently verified via live `getBoundingClientRect()` at
390×844 (right-dock default) and after opening the left dock (growth tab):
both measured 48×48px. No further action needed — logged for the record
since the async coordination between two subagents wasn't directly
observed, only its confirmed result.

## D3 — Overall verdict

All 3 genuine defects fixed (2 production-code, 1 test-file), 2
spec-anticipated test casualties correctly retargeted by QA, 1
implementation ambiguity (rail-collapse-on-open) correctly resolved by the
programmer and independently verified by 2 downstream agents against the
spec's own §5.4 canvas-visibility table. Full unit suite: 397/411 pass,
exactly the pre-existing 3-failure baseline, zero new regressions. All 3
CI-gated browser contracts: PASS. See `production/gate-reviews/ui-g4-g6.md`
for the formal gate verdict.
