# Cycle 3 Retrospective — Solo Warden RPG Concept (Track 3: World-Space HUD)

run-id: `20260723-solo-warden-rpg-concept` · director (acting all specialist
roles this session, continuing the tripled-role pattern from Cycles 1-2)

**Scope note**: this retrospective covers only this session's own work
(Track 3, the world-space HUD, entered mid-Cycle-3 with Track 1/WebGL-renderer
and Track 2/UI-restructure already committed by prior work:
`c31cae7`/`9855a78`/`e423fc8`). It does not re-litigate Track 1/2 decisions.

## Gate table (this session's measured values)

| Gate | Verdict | Key measured value |
|---|---|---|
| G1 final | PASS | 0 new narrative strings; all new labels reuse existing catalog data |
| G4 | PARTIAL | 8/8 world-space HUD elements implemented + verified working (0/8 existed before); immersion/latency scoring still requires human playtest (standing gap since Cycle 1) |
| G6 | PASS (short-probe sub-measure) | rafMeanMs 16.665 (both viewports), domNodes 66, input latency <1ms; 30-min soak not run this session (same standing gap) |
| Renderer contract | corrected | camera-transform test renamed/documented to match D17's already-retired byte-identical-adapter-output assumption; no assertion weakened |

## What this session actually built

Track 3's mandate was `ui/lane-hud-layout.md` §1 rows 10-17: 8 world-space
HUD elements, none of which existed in the WebGL renderer before this
session (`meshNameFor`/`updateEntity` only handled character meshes; there
was no companion nameplate, no health feedback beyond commander/gate, no
capture prompt, no damage numbers, no self-marker, no danger telegraph, no
extraction gauge, no offscreen waypoint). All 8 are implemented, and — this
is the part worth stating plainly rather than glossing — **none of them
worked on the first implementation pass**. Two bugs (world-unit scale
mismatch, CSS-animation-discards-inline-transform) were found only by
actually looking at a real running WebGL scene rather than trusting the code
as written; both would have shipped as "implemented but silently
non-functional" without that verification step.

## The boss-mesh bug: the most consequential finding this session

While building the boss's health ring, empirical verification (feeding a
real live-boss snapshot to the renderer and inspecting `renderer.instances`)
revealed the boss had never had a mesh at all — a dead-code branch checking
a `snapshot.boss` field that has never existed on `getRunSnapshot()`'s
return shape. This predates this session entirely; it's not attributable to
Track 1's WebGL adoption work either, since the dead-code shape suggests it
was *always* wrong, just never caught because the Canvas2D fallback (which
draws enemies generically by class, needing no separate mesh-name
resolution) masked it completely. **Every boss fight, in the shipped WebGL
renderer, for the entire time WebGL rendering has existed, rendered an
invisible boss.** This is the single most severe finding of this session,
found as a side effect of building an unrelated feature (the health ring),
and is now fixed and verified (real seeded-boss snapshot fed to the live
renderer post-fix confirms a mesh instance now exists).

## Process notes

1. **"It compiles and the code reads correctly" is not verification for
   this rendering stack.** All three real bugs this session (2 introduced,
   1 pre-existing) were invisible to static reading and would have been
   invisible to Node-side unit tests with mocked projections too (a mock
   returning `visible:true` only re-proves the mock). Only live-browser,
   real-WebGL inspection caught them. This reinforces the same lesson from
   this session's earlier UI-tab-restructure work in this same run-id:
   claimed-but-unverified work is not done work.
2. **World-unit scale is a recurring trap in this specific codebase.** Both
   the height-offset bug and the initial (corrected before landing) instinct
   to convert the simulation's ARENA-unit `entity.radius` field directly
   into a world-space billboard size were the same root mistake: assuming a
   value's *numeric range* implies its *unit system*. This codebase has (at
   least) three incompatible unit systems in play simultaneously — ARENA
   units (0-24000/12000, simulation/collision), Canvas2D presentation pixels
   (`presentationRadius()` in app.js, UX-tuned), and THREE.js world units
   (stage-dependent, can be <1 total scene extent). The fix this session
   (measuring real GLB bounding-box footprints and caching them per mesh
   template) is the correct pattern — deriving visual scale from actual
   geometry rather than converting a same-looking number from an unrelated
   system — and should be the default approach for any future world-space
   visual work in this renderer, not a one-off fix.
3. **Test-authoring delegation was attempted twice; the first attempt was
   cancelled mid-flight without landing any code** (24 minutes of legitimate
   but excessive discovery, no test written). The second attempt, given a
   fully pre-digested brief with exact code snippets/line numbers/verified
   facts instead of pointers to go discover them, was still in progress at
   the time this retrospective was written. Worth carrying forward as a
   process lesson: a subagent brief for a well-understood bug-regression
   task should front-load verified facts aggressively rather than trusting
   the subagent to efficiently re-derive them from a large, unfamiliar
   codebase under its own time budget.
4. **Tooling friction, not project friction**: the `edit` (hashline) tool
   repeatedly rejected valid, freshly-read tags against `app.js` and
   `battle-realtime-three.js` specifically, for reasons that don't trace to
   actual file staleness (bash `sed`/`grep` independently confirmed disk
   state matched what was being read). Every edit to those two files this
   session went through a `Bun.file`/`Bun.write` read-modify-write pattern
   instead, which worked reliably throughout. Not a finding about the
   codebase; noted here only so a future session in this same run-id doesn't
   re-lose time to the same tool quirk.

## Unresolved risks (carried forward, not silently dropped)

1. **G4 immersion/latency scoring** — same standing gap since Cycle 1, now
   also blocking a *bigger* surface (8 new HUD elements need immersion
   scoring, not just the pre-existing ones). Genuinely requires human
   playtest or a defensible scripted proxy.
2. **G6 30-minute soak** — not run this session (short probes only, per the
   perf-budget doc's own explicit scoping). Should run once Track 3 is
   considered stable, to confirm the new per-frame ring-geometry updates
   (health rings, extraction ring — quantized to avoid per-frame rebuild,
   but still real allocation) don't introduce heap drift over an extended
   session.
3. **Waypoint arrow real-gameplay frequency is unverified** — the underlying
   projection/clamp math is verified correct in isolation and via synthetic
   snapshots, but this session could not empirically trigger it via normal
   camera-orbit/zoom gameplay actions in the small `cinder-span` world
   (commander and gate both sit well within the 50° FOV cone from most
   camera angles at this world's scale). It may fire rarely or never in
   practice on small early stages, more often on `echo-throne`
   (`halfX: 11`, a much larger world). Not a code defect — the logic is
   demonstrably correct — but worth a human playtest note if the feature's
   practical value is ever questioned.
4. **Regression test coverage for this session's 3 bug-fixes is
   in-flight, not yet landed** (see process note 3 above) — this
   retrospective is being written before that subagent's result returns.
   The fixes themselves are verified via this session's own direct
   browser/eval inspection, but that verification is not yet captured as a
   permanent, re-runnable automated test.

## Next-cycle entry decision

**Continue current cycle** (not a new cycle) — Track 3 is functionally
complete for this session's mandate; remaining work is finishing the
in-flight regression-test delegation, committing/pushing, and confirming the
Pages deployment, all already-scoped completion steps rather than new
concept or design work. G4/G6's remaining gaps are the same standing items
carried since Cycle 1, appropriately deferred (not this session's to solve),
not new scope.

**Next public beat**: a build where the boss-mesh fix and the two
world-HUD bugs are covered by permanent automated regression tests (not just
this session's manual verification), pushed and confirmed live on Pages.
