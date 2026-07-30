# HUD overhaul and keypad → joystick cutover — cycle 10 spec

owner: ui-senior-developer
gate inputs: G4 (몰입/접근성), G8 (최초 노출)
status: design contract. Every new number is `[TARGET]`. No measurement is claimed here.
engine: **Three.js + WebGL browser only**. No Unity/Unreal guidance applies.

This is an **extension** of `design/mobile-joystick-hud-spec.md` and
`design/core-loop-legion-spec.md` §4. It does not re-derive the octant contract.

---

## 1. Supersession statement

### 1.1 Inherited unchanged — do not re-derive, do not restate in code review

> **Scope fence (v5 R27).** `core-loop-legion-spec.md` is **the concurrent session's cycle-9
> spec and is out of scope in its entirety** — not just its analog contract. It sits in this
> worktree's design lane only because the whole directory was synced, and it is **already
> implemented on their side** (their `defense-catalog.js` is 1025 lines against our 923, with
> comments citing its §2/§3/§5). Building anything from it rebuilds existing code and
> guarantees a conflict.
>
> Rows below that cite it are therefore **provenance only, never build instructions.** Each is
> either independently `[OBSERVED]` in our own tree (the `0.22` dead-zone ratio, the octant
> mapping) or explicitly marked as a cycle-9 target that is absent here. **This spec is
> self-contained against `033877ad`:** nothing it asks for depends on cycle-9 code existing.
>
> **Merge shape (v5 R28).** `app.js` is one of four files known to diverge (3807 here vs ~3937
> theirs), and a real reconciliation at cycle close is planned. So:
> - `styles.css` work (§3.4) is **additive plus one deleted gate rule** and that file is *not*
>   in the divergence set — low conflict risk.
> - `app.js` work is the risk. §3.1 and §3.2 both edit **existing method bodies**, which is the
>   shape that conflicts worst. Keep both diffs minimal and local: §3.1 is a predicate-body
>   replacement, §3.2 is a block swap inside one method. **Do not reformat surrounding code**,
>   and do not reflow the `#movement-actions` markup beyond the attribute changes §3.4 names.
> - New symbols this spec introduces (`#battle-route-rail`, `#battle-gimmick-state`,
>   `#battle-buff-strip`, `warnedBuffIds`, `--pad-size`, `--knob-size`, `--stage-accent`,
>   `--canon-oath-violet`, `--canon-echo-ice`) are named distinctly enough that a collision
>   surfaces as a visible conflict rather than a silent overwrite.
> - **Never pre-merge their tree.** Their work is uncommitted and invisible here; CLAUDE.md §5
>   forbids absorbing it.

| Inherited contract | Source | Status |
|---|---|---|
| Octant `send("MOVE", direction)` submission, `inputSeq` increment, `surface.dataset.defenseMove`, `abyssal:defense-input-feedback` event | `mobile-joystick-hud-spec.md` §2.2 | **unchanged** |
| Payload is `{ octant, analog: { x, y } }`, `x`/`y` integer millis in `[-1000,1000]`, `hypot ≤ 1000`, quantized client-side before send | `core-loop-legion-spec.md` §4 "Integer-millis contract" | **cycle-9 TARGET — `[OBSERVED]` NOT present at @033877ad.** Zero matches for `JOYSTICK_ANALOG_SCALE`, `JOYSTICK_ANALOG_RESEND_STEP`, `joystickAnalog`, `moveAnalog` in `app.js` or `defense-run-simulation.js`. `updateJoystick` sends a bare octant string (`app.js:2378`). **Do not implement it here** — this cutover is payload-agnostic. |
| `octant` stays the nearest octant string; `data-defense-move` stays an octant string | `mobile-joystick-hud-spec.md` §2.2; `app.js:2372-2375` `[OBSERVED]` | **unchanged** — and at @033877ad it is the *whole* payload, not a field |
| Dead zone `radius × JOYSTICK_DEAD_ZONE_RATIO`, ratio **0.22**, snaps to `IDLE` | `core-loop-legion-spec.md` §4 "Dead zone and gating"; `app.js:75` (constant), `:2372` (application) `[OBSERVED]` | **unchanged** |
| Max drag = knob travel limit `maxTravel = radius − knobRadius`; knob clamped to it | `app.js:2360-2369` `[OBSERVED]` | **unchanged.** Magnitude-scaled speed is cycle 9's, not present here (row 2). |
| Dead-zone floor coupling: ratio must not drop below ~0.13 or facing silently freezes against renderer `MOVE_EPSILON = 0.01` | `core-loop-legion-spec.md` §4 "Facing survives analog input" | `[INFERENCE]` — the analysis assumes analog input, which does not exist at @033877ad, so the coupling is currently latent. **This spec never touches the ratio**, so it stays latent. |
| Conditional presence: `commander.moveAnalog` emitted only after real analog input; octant-only sessions stay byte-identical | `core-loop-legion-spec.md` §4 "Required pattern" | **cycle-9 TARGET — not present at @033877ad** (`resetJoystick`, `app.js:2382-2389`, has no `hadAnalog` branch). Nothing in this spec creates the field, so every existing digest fixture is untouched by construction. |
| DOM ids preserved: `#movement-actions`, `#battle-actions`, `#toggle-pause`, `#stance-cycle`, `#extract-elite`, `#combat-input-cluster` | `mobile-joystick-hud-spec.md` §2.4 | **unchanged** |
| Keyboard (`WASD`/arrows) and gamepad bindings untouched | `mobile-joystick-hud-spec.md` §2.1 | **unchanged** |
| Renderer/HUD never writes simulation positions; HUD is read-only over snapshots | `mobile-joystick-hud-spec.md` §3 | **unchanged** |
| Camera orbit/pinch on `#defense-canvas` stays independent of movement (D17) | `mobile-joystick-hud-spec.md` §2.3; `defense-survivor-browser.cjs:442-455` | **unchanged** |
| Growth/reward modal is **frozen** — not restyled this cycle | `ui/battle-hud-concept-cycle9.md` §5 | **unchanged** |
| Portrait safe-edge insets: `.defense-top` top 11 / right 17 / left 29 px; `.defense-bottom` bottom 23 / right 17 / left 29 px; offer/result cards top 11 | **`[OBSERVED]` in the blob** — `git show 033877ad:tests/defense-hud-responsive-browser.cjs`, `assert.deepEqual` at `:226` and `:227`, card assertion `:230`, driven by the `--defense-device-safe-*` properties set at `:204-207`. Upgraded from `battle-hud-concept-cycle9.md` §4, which is a design doc and therefore not evidence about code (v6 C3). | **must not regress** |

> **`[OBSERVED]` provenance audit (v6 C3).** Three agents cited a design document as shipped
> behaviour this cycle. I audited my own marks against `git show 033877ad:<path>` — the one read
> a dirty working tree cannot fool — and found **one** instance in this spec: the portrait insets
> above were sourced to `battle-hud-concept-cycle9.md` §4 when they are in fact asserted in a
> test. Re-cited to the blob. Confirmed against the blob at the same time: `styles.css` 3226 and
> `app.js` 3807 lines, and `slabMaterialAt` count **0** in `stage-world-catalog.js` — so §5.3a's
> hook-1 analysis rests on the commit, not on a working tree that has since been modified
> (`styles.css` and `app.js` both now show `M`). Every other `[OBSERVED]` mark in this document
> cites a source file or test I read directly; every number sourced to a `.md` is marked
> `[TARGET]` and names the document.

### 1.2 What this cycle adds

1. Joystick becomes the **primary movement control on every viewport, including a fine
   desktop pointer** (§3).
2. The five `[data-move]` buttons stop being a keypad and become a **visible, focusable,
   pointer-active octant ring** around the pad — retained, not hidden (§3.4).
3. Four **distinct** HUD compositions, not scaled copies (§4).
4. Three dungeon-aware readouts: route/waypoint rail, gimmick state, active-buff strip (§5).
5. Stage-accent identity tokens bound to `presentation.palette.accent` (§6).

### 1.3 Explicit supersessions — stated, not silently diverged

| # | Superseded statement | Source | Replacement | Reason |
|---|---|---|---|---|
| S1 | "The virtual joystick is touch-exclusive and activates only when `session.inputModality === "touch"`" | `mobile-joystick-hud-spec.md` §2.1 | Joystick is available on **every** pointer type. Modality no longer gates availability. | The cycle-10 request is item 8 of the production brief: 가상키패드 → 가상조이스틱 as the primary control. A touch-exclusive stick leaves desktop on the retired keypad, which is the thing being retired. `mobile-joystick-hud-spec.md` §2.1's second clause (keyboard/gamepad unchanged) is **kept** — only the touch-exclusivity clause falls. |
| S2 | "Availability: any coarse pointer, portrait **and** landscape" | `core-loop-legion-spec.md` §4 "Dead zone and gating" table | Any pointer, coarse **or fine**, portrait and landscape. | Strict widening of cycle 9's row. Cycle 9 removed the orientation gate; cycle 10 removes the remaining coarseness gate. Nothing cycle 9 asserted becomes false — every coarse case still gets a stick. |
| S3 | Joystick base re-centres to the touch point: `base.style.transform = translate(relX-80, relY-80)` | `mobile-joystick-hud-spec.md` §4.3 `onJoystickStart` | **Rejected.** The pad is a fixed pedestal; the knob moves, the base never does. | Never shipped — `[OBSERVED]` `updateJoystick` (`app.js:2447-2491`) has no base transform; it writes only `--joystick-x`/`--joystick-y` on the knob. `progression-mobile-ui-browser.cjs:319-331` derives every expected octant from `joystick.boundingBox()` centre; a moving origin invalidates that geometry mid-gesture. A fixed pedestal is also what makes a mouse-driven stick legible. |
| S4 | `#movement-actions` is `160×160` with a `120×120` base and a `48×48` knob | `mobile-joystick-hud-spec.md` §4.2 | Per-composition sizes in §3.5, pad/knob ratio pinned at **0.375–0.39**. | Never shipped — `[OBSERVED]` `styles.css:3067-3068` pad is `7.25rem` (116 px) and `:3105-3106` knob is `44px`, ratio 0.379. Four compositions cannot share one size (§4). The ratio is pinned because `maxTravel = radius − knobRadius` (`app.js:2454`) is the analog resolution denominator. |
| S5 | `.cutscene-frame { margin-left: 200px; margin-right: 220px }` in landscape | `mobile-joystick-hud-spec.md` §5.3 | Clearance expressed as `calc()` over the pad and combat-cluster tokens (§4.5). | Hard-coded 200/220 px was derived from the rejected 160 px pad (S4) and is wrong for all four compositions. |
| S6 | "No Explicit Virtual Joystick Tests in Visible Suite … Joystick implementation lives in `battle-realtime-three.js`" | `map-tests.md:113-114` | **Factually wrong.** Two joystick tests exist and the implementation is in `app.js`. | `[OBSERVED]` `tests/progression-mobile-ui-browser.cjs:299-379` and `:381-398` are joystick tests. The implementation is `app.js:2423-2491` (`joystickActive`, `updateJoystick`, `resetJoystick`). `battle-realtime-three.js` contains **zero** matches for `joystick` or `data-move` — verified by grep this session. See §8.1 — this error hides the one test this cutover actually breaks. |

Nothing else in either source document is contradicted.

---

## 2. `[OBSERVED]` baseline

> ## ⛔ BLOCKING — how to anchor, and one baseline correction
>
> **Identify the tree by PATH, never by line count (v7 R32).** Absolute
> `/Users/jangyoung/orca/Abyssal-Surge-dungeon/...` in every `read` / `grep` / `glob` / `edit` /
> `write` header, and `cwd` on every bash call. That rule does not decay.
>
> An earlier form of this header carried v4 R21's line counts as a tree-identity check. **That is
> retired.** Implementers grew those files — correctly — so `defense-catalog.js` is now 1077 not
> 923, `battle-realtime-three.js` 5223 not 4846, `app.js` 4147 not 3807. Anyone following the old
> counts literally would conclude they are in the *wrong* tree while standing in the right one,
> and might "correct" into the forbidden one. A line count is a snapshot of a moving target.
>
> **The only non-decaying identity check is commit-addressed:** `git show 033877ad:<path>`
> returns the base blob regardless of any working tree. Every number in the tables below is a
> **blob** number, verified that way — not a working-tree number.
>
> **Re-grep the symbol immediately before EACH edit (v7 R33).** Not once at task start. The file
> moves as your own edits land, and a sibling in the same file moves it further. `app.js` has
> already gone 3807 → 4147 under this cycle's own implementers.
>
> **`styles.css` — every citation in this spec is valid against the blob.** Verified via
> `git show 033877ad:styles.css` (3226 lines): `.one-thumb-controls` 602 · `--rc-panel-border`
> 754 · `--canon-cyan-rift` 768 · `.virtual-joystick { display: none; }` 3034 · the
> `@media (pointer: coarse) and (orientation: landscape)` wrapper 3049 · `[data-move="IDLE"]`
> centre rule 3135 · the `max-height: 480px` landscape block 3161. **`styles.css` now shows `M`
> in the dungeon tree**, so these are blob positions, not current ones — re-grep before editing.
>
> **`app.js` — the middle column is the blob. The right column is the authoring tree and is
> wrong for you. NEITHER is the current working tree.**
>
> | Symbol | **Blob @033877ad** | Authoring tree (as cited elsewhere in this spec) |
> |---|---|---|
> | `JOYSTICK_OCTANTS` | **74** | 84 |
> | `JOYSTICK_DEAD_ZONE_RATIO` | **75** | 85 |
> | `.hud-mission` panel / `#battle-status` | **1760** | 1809 |
> | `.gate-panel` | **1771** | 1820 |
> | `#movement-actions` block, five `[data-move]` buttons | **1772-1778** | 1821-1827 |
> | `joystickActive()` | **2350-2353** | 2423-2429 |
> | `updateJoystick()` | **2355-2380** | 2447-2491 |
> | `maxTravel = radius - knobRadius` | **2362** | 2454 |
> | `resetJoystick()` | **2382-2389** | 2493-2508 |
> | `onMoveControlDown()` | **2391-2409** | 2510-2528 |
> | `onMoveControlClick()` | **2428-2431** | 2547-2552 |
>
> Note the drift direction: the implementation tree matches the **original** numbers the
> assignment gave me. A mid-session correction pass in this spec re-pointed `app.js`
> citations at the drifted authoring tree; the middle column above supersedes every one of
> them. `styles.css` was unaffected.
>
> ### Baseline correction — cycle 9's analog contract is NOT in the implementation tree
>
> `[OBSERVED]` at @033877ad, `joystickActive()` (2350-2353) is still the **original**
> orientation-gated form, and grep for `JOYSTICK_ANALOG_SCALE`,
> `JOYSTICK_ANALOG_RESEND_STEP`, `joystickAnalog`, and `moveAnalog` returns **zero** matches
> across both `app.js` and `defense-run-simulation.js`. `updateJoystick` sends a bare
> `this.send("MOVE", direction)` string (2378); `resetJoystick` has no `hadAnalog` branch.
>
> So `core-loop-legion-spec.md` §4's analog contract — `{ octant, analog }`, integer millis,
> `commander.moveAnalog` conditional presence — is a **cycle-9 target, not shipped behaviour
> at this commit.** §1.1 marks those rows accordingly.
>
> **This does not change what to build.** This cutover is **payload-agnostic**: it changes
> visibility, geometry, and hit-test order, never the MOVE payload. It works identically
> whether the payload is a bare octant string or `{ octant, analog }`. Do **not** implement
> the analog contract from this spec — that is cycle 9's slice.
>
> ### Procedure, per edit
>
> An `[OBSERVED]` mark certifies code I read — not a line address in your tree. `grep` the
> symbol → read the surrounding range → confirm the code matches what this spec quotes →
> only then edit. **If the code differs from the quoted text, STOP and DM Main. Do not adapt
> silently.** Confirm before editing:
>
> | Anchor | Confirm |
> |---|---|
> | `joystickActive()` | which of §3.1's two cases you are in. At @033877ad it is **Case B**. |
> | `onMoveControlDown()` | `joystickActive()` branch still precedes `closest("[data-move]")` |
> | `updateJoystick()` | writes `--joystick-x`/`--joystick-y` on the knob, **never** transforms the base (S3) |
> | `#movement-actions` markup | five buttons, DOM order `N, W, IDLE, E, S`, exact `aria-label` strings (C2) |
> | `JOYSTICK_DEAD_ZONE_RATIO` | still `0.22` |
> | `.virtual-joystick { display: none; }` | still the base rule (§3.4 deletes it) |
> | `.one-thumb-controls` | still `display: grid` with a `repeat(N, …)` template (§3.4 deletes those) |
>
> **File ownership.** This spec authorises `app.js` and `styles.css` only, plus the single
> test file §8.1 names (`tests/progression-mobile-ui-browser.cjs`, **398** lines at
> @033877ad). Every simulation, renderer, catalog, and audio citation here is **read-only
> context**. If you need another file, DM its owner and Main.

### 2.1 Gate state, per tree — and a defect that exists in one tree only

The assignment's premise — joystick gated to `(pointer: coarse) and (orientation: landscape)`
with `data-defense-portrait !== "true"` — is **exactly correct for the implementation tree**
and **stale for the authoring tree**. The two diverged during this cycle.

| Step | `joystickActive()` body | Where it is `[OBSERVED]` |
|---|---|---|
| 0 | `matchMedia("(pointer: coarse) and (orientation: landscape)").matches && documentElement.dataset.defensePortrait !== "true"` | **implementation tree @033877ad, `app.js:2350-2353` — this is what you will find** |
| 1 | `matchMedia("(pointer: coarse)").matches` — orientation gate removed, no geometry check | authoring tree, mid-session, transient |
| 2 | `matchMedia("(pointer: coarse)").matches` **plus** `rect.width > 0 && rect.height > 0` | authoring tree, current, `app.js:2423-2429` |

`[OBSERVED]` **Step 1 shipped a real defect in the authoring tree, and step 2 closed it. The
implementation tree never had it, because it never left step 0.** Recorded for two reasons: it
is why §3.1's target body keeps a geometry guard rather than a bare widening, and a reader
comparing this spec against the authoring tree would otherwise think §3.1 re-invents a guard
that is already there.

**Why it matters even though your tree is clean:** at step 0 the pad is only ever laid out
where the JS gate is also true, so the two agree by construction. §3.4 breaks that coupling by
giving the pad a box everywhere. Widening the predicate *without* a geometry guard would
reproduce step 1's defect exactly — which is why §3.1 Case B replaces the whole body instead of
deleting a clause.

The step-1 failure mode, in full, since your change must not recreate it:

At step 1 the JS gate and the CSS gate disagreed: `.virtual-joystick { display: none }` is the
base rule, overridden to `display: grid` **only** inside
`@media (pointer: coarse) and (orientation: landscape)` + `html[data-defense-portrait="false"]`
(`styles.css:3034,3049,3075` `[OBSERVED]` — **true in both trees today**). So on a coarse
*portrait* viewport `joystickActive()` returned `true` while the pad was `display: none`.
`onMoveControlDown` took the joystick branch before any `[data-move]` hit-test and called
`updateJoystick`, whose `!joystick || !knob` guard passes because the nodes **exist** (hidden,
not absent). `getBoundingClientRect()` on a `display: none` element is all zeros, so:

- `radius = max(1, min(0,0)/2) = 1`
- `dx = event.clientX − 0`, `dy = event.clientY − 0` → the raw viewport coordinate
- `distance` ≈ several hundred px, so `distance < radius × 0.22` is false → never `IDLE`
- direction = the octant of the vector from the **screen origin** to the finger

`[INFERENCE]` On a phone held upright, tapping `↑` would have emitted an octant derived from
where on the screen the finger was, not from the button — the button's own `data-move` never
read. `progression-mobile-ui-browser.cjs:381-398` could not catch it: it asserts
`display === "none"` and never dispatches a pointer event.

Step 2's guard is the correct shape and §3.1's target body **keeps it**. Its authored comment in
the authoring tree also hands this cycle the remaining half explicitly:

> "Deferring to real layout means this gate needs no further change when the stick's portrait
> visibility lands: whoever owns that CSS turns the analog contract on in portrait by giving
> the element a box."

`[OBSERVED]` The production brief §0 assigns 조이스틱 DOM/CSS 표면 to cycle 10. That CSS is §3.4.

### 2.1a Where each tree actually stands

`[OBSERVED]` The CSS gate (`styles.css:3034,3049,3075`) is **unchanged in both trees** — the pad
is still `display: none` outside coarse landscape. Consequences differ:

| Tree | Coarse portrait behaviour today | Cycle 9 §4 target met? |
|---|---|---|
| implementation @033877ad | gate is step 0, so `joystickActive()` is `false`; movement falls through to the five buttons | **no** — neither the JS nor the CSS half exists |
| authoring | gate is step 2, `rect` is 0×0, so `joystickActive()` is `false`; falls through correctly | **no** — JS half landed, CSS half did not |

Either way the stick is **not** available in portrait in any shipped artifact. Cycle 9 changed
the JS in one tree; **only cycle 10's CSS makes any of it observable.** That is this spec's job.

### 2.2 Keypad and HUD baseline

| Fact | Value | Citation |
|---|---|---|
| Five `[data-move]` buttons always mounted, DOM order `N, W, IDLE, E, S` | `[OBSERVED]` | `app.js:1821-1827` |
| Default pad layout is a 5-column grid of ≥44 px cells | `[OBSERVED]` | `styles.css:602-603` |
| ≤720 px collapses it to `repeat(3, 44px)`, `max-width: 8.8rem` | `[OBSERVED]` | `styles.css:670` |
| In coarse landscape the buttons are `opacity: 0`, `pointer-events: none`, `z-index: 1`, revealed only on `:focus-visible` | `[OBSERVED]` | `styles.css:3120-3139` |
| Pad 116 px, knob 44 px, knob transition `transform 45ms linear` | `[OBSERVED]` | `styles.css:3067-3068,3105-3113` |
| ≥1000 px packs the top HUD panels left with `justify-content: flex-start; flex-wrap: wrap` | `[OBSERVED]` | `styles.css:427-429` |
| At 1440×900 the top HUD clusters top-left and the bottom band holds the keypad bottom-left | `[OBSERVED]` — browser-measured this session (screenshot evidence), and independently derivable from the `styles.css:427-429` + `:602` cascade above | session screenshot evidence + cascade |
| No breakpoint above 1440 exists | `[OBSERVED]` | `styles.css` — largest is `@media (min-width: 1440px)` at `:343`, scoped to `.abyss-depth-control` only |
| Outer z-stack | canvas 1 · surface `::after` 3 · `#world-hud-overlay` 4 · decks 4 · `#defense-edge-hud` 5 · `.edge-card` 6 · cutscene 7 · pause overlay 7 | `[OBSERVED]` `styles.css:1117-1119,456,693,1167` |
| Existing tokens | `--canon-cyan-rift #2cadd6` · `--canon-zenith-gold #ddc869` · `--canon-cinder-ember #f3592c` · `--canon-void-obsidian #3c2c5b` · `--canon-cold-steel #737990` · `--rc-panel-border rgb(150 156 180/.18)` · `--lantern-line rgb(128 216 255/.34)` · `--defense-safe-{top,right,bottom,left}` | `[OBSERVED]` `styles.css:754,765-772,2134,399-402` |
| Reduced-motion block covers only `.integrity-meter i` and `.hud-xp-track i` | `[OBSERVED]` | `styles.css:674-677` |
| Stage accents | `cinder-span #f3592c` · `abyss-chancel #8f67ff` · `echo-throne #72c8ff` | `[OBSERVED]` `stage-world-catalog.js:153,236,319` |
| Stage hook on the battle surface | `data-stage-id`, written at mount and re-asserted every render | `[OBSERVED]` `app.js:1803` (markup), `:3071` (`this.surface.dataset.stageId = this.stageId`) |
| Sprite convention | `[data-ui-icon="<iconId>"]`, plates in `assets/images/battle/ui/hud/` | `[OBSERVED]` `app.js:215-218` (contract comment), `:930`, `:943`, `:1149` (call sites) |

---

## 3. Keypad → joystick cutover

**Landing order is a correctness requirement, not a preference.** Three changes make the
cutover; two orders are safe and one breaks a live contract.

| Step | Change | Safe to land alone? |
|---|---|---|
| §3.1 | delete one line from `joystickActive()` | **yes** — pad stays boxless outside coarse landscape, so the predicate stays false there |
| §3.2 | reorder the hit-test in `onMoveControlDown` | **yes** — provable no-op today (§3.2 `[INFERENCE]`) |
| §3.4 | CSS: give the pad a box everywhere, make the ring pointer-active | **NO — must land after §3.2** |

Landing §3.4 before §3.2 breaks `defense-survivor-browser.cjs:547-583` for the reason in Open
risks R4. Land §3.1 + §3.2 first or in the same commit as §3.4; never §3.4 first.

### 3.1 The replacement gating predicate

**Grep `joystickActive` first and match one of the two cases below.** The authoring tree and
the implementation tree may disagree here: the geometry guard was added by the concurrent
session mid-cycle (§2.1 step 2) and may not be present at your commit. The **target body is
the same either way** — only the size of the diff differs.

**Case A — the rect guard is present** (authoring tree, `[OBSERVED]`):

```js
joystickActive() {
  if (!globalThis.matchMedia?.("(pointer: coarse)").matches) return false;   // ← DELETE this line
  const joystick = this.movementControls?.querySelector("[data-joystick]");
  if (!joystick) return false;
  const rect = joystick.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}
```

Change = **delete the `matchMedia` early-return.** One line. Keep the rest verbatim.

**Case B — no rect guard** (any commit before the concurrent session's fix; the body is a bare
`matchMedia` return, with or without the `and (orientation: landscape)` clause):

```js
joystickActive() {
  return Boolean(globalThis.matchMedia?.("(pointer: coarse)").matches);
}
```

Change = **replace the whole body with the target below.** This is not merely widening
availability: without the rect guard, §3.4's CSS would let a `display: none` pad reach
`updateJoystick`, which is the §2.1 defect. In Case B, §3.1 is therefore a **bug fix plus** the
cutover, and it is blocking rather than cosmetic.

If the body matches neither shape, STOP and DM Main — the predicate has been changed again.

Target body, identical for both cases:

```js
/**
 * Cycle 10 (ui/hud-overhaul-joystick-cutover-spec.md §3.1): the stick is the PRIMARY
 * movement control at every viewport and for EVERY pointer type, so availability is no
 * longer a modality question at all -- the `(pointer: coarse)` test is gone. It is purely a
 * geometry question: has CSS given the pad a box?
 *
 * Reading the same rect updateJoystick() reads is what makes this un-desyncable. The step-1
 * form (coarse-only, no rect check) let a `display: none` pad reach updateJoystick(), whose
 * zeroed rect reported full deflection toward the viewport origin and swallowed the
 * [data-move] fallback presses (spec §2.1). Keeping the rect check and dropping the media
 * query means the CSS in §3.4 is the single switch: give the element a box and the stick is
 * live; take the box away and the five buttons resume ownership with no JS change.
 */
joystickActive() {
  const joystick = this.movementControls?.querySelector("[data-joystick]");
  if (!joystick) return false;
  const rect = joystick.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}
```

Properties:

- **No media query.** Nothing to keep in sync with `styles.css`; §3.4 is the only switch.
- **Self-disabling.** Any future CSS that hides the pad (print, a settings opt-out, a
  narrow-viewport bail) turns the branch off automatically and the buttons resume ownership.
- **Keeps the §2.1 fix.** A zero-rect pad still cannot reach `updateJoystick`.
- `matchMedia` is no longer called in this path, so a test context without `matchMedia`
  degrades to "pad measurable → stick works" instead of "no matchMedia → no stick".
- **Widens, never narrows.** Every viewport that has a stick today keeps one (S2).

### 3.2 Required companion change — hit-test order in `onMoveControlDown`

`[OBSERVED]` `onMoveControlDown`, `app.js:2510-2528`, checks `joystickActive()` at `:2512`
**before** the `[data-move]` hit-test at `:2520`. That order is harmless today only because the
CSS gate keeps the pad boxless — and therefore `joystickActive()` false — everywhere the buttons
are pointer-active. §3.1 plus §3.4 remove both halves of that accident: the predicate becomes
true at every viewport and the buttons become pointer-active at every viewport, so the existing
order would swallow every direct button press. Swap the two blocks; nothing else changes.

```js
onMoveControlDown(event) {
  if (this.controlPointerId !== null || (event.button !== undefined && event.button !== 0)) return;
  // Buttons FIRST. The pad is now visible at every viewport (spec §3.4), so the octant ring
  // and the drag surface share one container. A press that actually landed on a labelled
  // control is that control's press -- resolving it by geometry instead would discard the
  // player's stated intent and break the held-movement contract
  // (tests/defense-survivor-browser.cjs:547-558).
  const button = event.target.closest?.("[data-move]");
  if (button) {
    event.preventDefault();
    this.controlPointerId = event.pointerId;
    this.controlPointerMode = "buttons";
    button.setPointerCapture?.(event.pointerId);
    this.send("MOVE", button.dataset.move);
    if (button.dataset.move !== "IDLE" && this.inLobby()) this.suppressLobbyShowcase();
    return;
  }
  if (!this.joystickActive()) return;
  event.preventDefault();
  this.controlPointerId = event.pointerId;
  this.controlPointerMode = "joystick";
  this.movementControls.setPointerCapture?.(event.pointerId);
  this.updateJoystick(event);
}
```

`[INFERENCE]` The reorder is behaviour-preserving against the current tree: `[OBSERVED]`
`styles.css:3120-3139` sets the ring buttons `pointer-events: none` inside the only media query
where the pad has a box, so wherever `joystickActive()` can currently return `true`,
`closest("[data-move]")` already returns `null` and control falls through to the identical
joystick branch. The swap can therefore land before the CSS without changing observable
behaviour — but it **must not land after** it (Open risks R4).

`onMoveControlMove`, `onMoveControlEnd`, `onMoveControlClick`, `onWindowBlur`, `onVisibility`,
`updateJoystick`, `resetJoystick` are **unchanged**. Neither `send()` nor the payload shape is
touched, so §1.1 holds in full.

### 3.3 Geometry constraint that makes the ring safe

The octant drag test presses at the pad centre (`progression-mobile-ui-browser.cjs:327`).
`[OBSERVED]` `styles.css:3135` currently parks `[data-move="IDLE"]` exactly there, so with
buttons pointer-active a centre press would resolve to `MOVE IDLE` and no drag could start.

**Requirement C1 — the pad centre is drag-only. BINDING FORM: point exclusion.**

```
elementFromPoint(padCentre).closest("[data-move]") === null
```

`IDLE` moves from the centre to the **south-east ring slot** (the only one of eight unoccupied
by `N/W/E/S`). That single CSS change satisfies C1 at every composition, because the four
cardinals are edge-anchored and the centre point falls between them.

Ratified as the binding form by director ruling **v4 R22**. It is what the octant drag test
actually presses (`progression-mobile-ui-browser.cjs:327`), and it is satisfiable everywhere.

**Recommended, NOT binding — the dead-zone guard.** Point exclusion is a one-pixel guarantee: a
future 1 px nudge of a cardinal could break the octant drag with no assertion firing. A stronger
*computable* form exists and is satisfied at every composition, so implement it as a warning
rather than a gate:

```
min over the five buttons of (distance from pad centre to nearest edge) > padRadius × 0.22
```

Keyed to the same `JOYSTICK_DEAD_ZONE_RATIO` that `updateJoystick` reads, so the two cannot
drift apart. With the 44 px ring buttons of §3.4 edge-anchored, each cardinal's nearest edge
sits `padSize/2 − 44` from the centre:

| Pad | `padRadius` | dead-zone radius | nearest edge | margin |
|---|---|---|---|---|
| 116 px (A, B) | 58 | 12.76 | 14 | **+1.24** |
| 144 px (C) | 72 | 15.84 | 28 | +12.16 |
| 160 px (D) | 80 | 17.60 | 36 | +18.40 |

Two consequences follow, and both are binding on the CSS even though the guard itself is not:

- **Do not shrink the pad below `7.25rem`, and do not inset the cardinals further.** Either
  consumes the 1.24 px margin at compositions A and B.
- **Growing the pad to widen that margin is not available at composition A.** `8rem` (128 px)
  would give +5.92 px, but costs 12 px of bottom-band height against the ~8 px of slack
  `exposedHeight ≥ 180` leaves there (Open risks R5).

**Superseded — do not re-derive this.** An earlier form of C1 required clearance of
`padRadius × 0.45`. It is not merely violated at 116 px, it is **unsatisfiable in principle**: a
44 px button whose nearest edge must sit ≥26.1 px from the centre would have its far edge at
70.1 px, outside the 58 px pad radius entirely, so no placement exists. Required clearance
26.1 / 32.4 / 36.0 px against actual edge distances 14 / 28 / 36 px. It also contradicted the
44 px accessibility floor (§7.1), which outranks a geometric nicety. Caught by `UiJoystickImpl`
during implementation, confirmed by me, ratified superseded by v4 R22.

**Requirement C2.** DOM order stays `N, W, IDLE, E, S` — position is CSS-only.
`defense-survivor-browser.cjs:399-409` `deepEqual`s that exact ordered array with its labels.

### 3.4 Exact CSS and attribute changes

**Delete** (each is either the gate itself or fights the new pad box):

| Delete | Line | Why |
|---|---|---|
| `.virtual-joystick { display: none; }` | `styles.css:3034` | the gate |
| the `html[data-defense-portrait="false"]` prefix on `styles.css:3063-3139` | `:3063-3139` | promote every rule to unconditional |
| `.one-thumb-controls { display: grid; grid-template-columns: repeat(5, minmax(44px,1fr)); }` | `:602` | pad is `position: relative; display: block` |
| `.one-thumb-controls { grid-template-columns: repeat(3, 44px); max-width: 8.8rem; }` | `:670` | ditto |
| `.defense-bottom > #movement-actions { grid-template-columns: repeat(3, 44px); }` | `:2508` | ditto |
| `#movement-actions > button[data-move="IDLE"] { top: calc(50% - 22px); left: calc(50% - 22px); }` | `:3135` | violates C1 |
| the whole `@media (pointer: coarse) and (orientation: landscape)` wrapper | `:3049` | its contents become unconditional or move into §4 compositions |

**Add / replace** (unconditional base; per-composition overrides in §4):

```css
/* ── Movement pad: PRIMARY control at every viewport ────────────────────────────
   Cycle 10 §3. The pad is a fixed pedestal (never re-centres on press) and the five
   labelled octant controls ring it, visible and pointer-active. The former
   `(pointer: coarse) and (orientation: landscape)` gate is gone: it left a hidden,
   zero-rect pad reachable by the JS branch (spec §2.1). --pad-size / --knob-size are
   the only per-composition knobs; the 0.375-0.39 ratio between them is the analog
   resolution denominator (maxTravel = radius - knobRadius, app.js:2454) and is pinned. */
#movement-actions {
  --pad-size: 7.25rem;
  --knob-size: 44px;
  position: relative;
  display: block;
  width: var(--pad-size);
  height: var(--pad-size);
  max-width: none;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}
.virtual-joystick {
  position: absolute;
  inset: 0;
  z-index: 2;                 /* local to #defense-edge-hud (z-index 5) */
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 2px solid rgb(137 173 201 / .62);
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 50%, rgb(30 48 67 / .82) 0 18%, transparent 19%),
    repeating-conic-gradient(from 22.5deg, rgb(129 216 255 / .08) 0 43deg, transparent 43deg 45deg),
    radial-gradient(circle, rgb(11 21 36 / .94), rgb(4 8 17 / .9));
  box-shadow:
    inset 0 0 0 .35rem rgb(3 7 17 / .62),
    inset 0 0 1.4rem rgb(89 190 232 / .18),
    0 .55rem 1.4rem rgb(0 0 0 / .52);
}
.virtual-joystick-rune {
  position: absolute; inset: 16%;
  border: 1px solid color-mix(in srgb, var(--stage-accent) 34%, transparent);
  transform: rotate(45deg);
  pointer-events: none;
}
.virtual-joystick-knob {
  --joystick-x: 0px;
  --joystick-y: 0px;
  position: relative;
  z-index: 1;
  width: var(--knob-size);
  height: var(--knob-size);
  border: 2px solid var(--canon-zenith-gold);
  border-radius: 50%;
  background: radial-gradient(circle at 35% 28%, #8bdcff, #304c67 46%, #101a28 72%);
  box-shadow: inset 0 0 .65rem rgb(255 255 255 / .2), 0 0 1rem rgb(111 208 255 / .38), 0 .35rem .7rem #000;
  transform: translate3d(var(--joystick-x), var(--joystick-y), 0);
  transition: transform 45ms linear;
  pointer-events: none;
}
#movement-actions[data-joystick-direction="IDLE"] .virtual-joystick-knob {
  border-color: rgb(189 202 213 / .72);
  box-shadow: inset 0 0 .65rem rgb(255 255 255 / .15), 0 .35rem .7rem #000;
}

/* Octant ring: retained, VISIBLE, pointer-active, keyboard-focusable. These are the
   accessible fallback the tests assert (spec §8) and simultaneously the pad's legend.
   z-index 3 puts them above the drag disc so a deliberate press wins; C1 keeps them
   clear of the centre so a drag that starts at the centre is never intercepted. */
#movement-actions > button[data-move] {
  position: absolute;
  z-index: 3;
  width: 44px; height: 44px;
  min-width: 44px; min-height: 44px;
  padding: 0;
  opacity: 1;
  pointer-events: auto;
  border-radius: 50%;
  font-size: 1rem;
  font-weight: 900;
}
#movement-actions > button[data-move="N"]    { top: 0;    left: calc(50% - 22px); }
#movement-actions > button[data-move="S"]    { bottom: 0; left: calc(50% - 22px); }
#movement-actions > button[data-move="W"]    { top: calc(50% - 22px); left: 0; }
#movement-actions > button[data-move="E"]    { top: calc(50% - 22px); right: 0; }
/* C1: IDLE vacates the centre for the SE ring slot. DOM order is untouched (C2). */
#movement-actions > button[data-move="IDLE"] { right: 2%; bottom: 2%; }
#movement-actions > button[data-move]:focus-visible { z-index: 4; outline: 2px solid var(--lantern-focus); outline-offset: 2px; }
```

**Attribute changes on `app.js` markup** (`app.js:1814-1820`):

| Node | Change | Reason |
|---|---|---|
| `<div class="virtual-joystick" data-joystick aria-hidden="true">` | `aria-hidden="true"` → `role="application" aria-label="이동 스틱" aria-describedby="movement-hint"` **plus** `data-joystick` retained | §7.3. `aria-hidden` was defensible while the pad was a decorative touch-only overlay; a primary control cannot be absent from the tree. |
| `#movement-actions` | keep `id`, `class="one-thumb-controls"`, `data-movement-control="octant-joystick"`, `role="group"`, `aria-label="한 손 이동 조작"` **verbatim** | `defense-survivor-browser.cjs:399-401` `deepEqual`s `role` and `aria-label` |
| five `<button data-move>` | **no change whatsoever** — same order, same `aria-label` strings, same glyphs | `defense-survivor-browser.cjs:402-408` |
| new sibling | `<span id="movement-hint" class="sr-only">스틱을 끌어 이동. 방향 버튼은 키보드로도 사용할 수 있습니다.</span>` | non-visual description target for `aria-describedby` |

### 3.5 Per-composition pad sizing

`maxTravel = padSize/2 − knobSize/2`. Larger `maxTravel` = finer analog resolution.

| Composition | `--pad-size` | `--knob-size` | ratio | `maxTravel` | dead zone (`r × 0.22`) |
|---|---|---|---|---|---|
| phone landscape 844×390 | `7.25rem` (116 px) | `44px` | 0.379 | **36 px** | 12.8 px |
| phone portrait 390×844 | `7.25rem` (116 px) | `44px` | 0.379 | **36 px** | 12.8 px |
| desktop 1440×900 | `9rem` (144 px) | `56px` | 0.389 | **44 px** | 15.8 px |
| 1920×1080 | `10rem` (160 px) | `60px` | 0.375 | **50 px** | 17.6 px |

All `[TARGET]`. Knob ≥44 px at every composition, so §7.1 holds. The ratio band 0.375–0.39 is
a hard constraint: leaving it changes analog feel without changing the ratio constant, which is
exactly the invisible coupling `core-loop-legion-spec.md` §4 warns about.

---

## 4. HUD reorganization — four distinct compositions

Panels: `.hud-mission`, `.hud-loop-state`, `.hud-legion`, `.top-right-hud` (top);
`.gate-panel`, `#movement-actions`, `#combat-input-cluster`, `#battle-actions` (bottom).
z-index values are **local to `#defense-edge-hud`** (itself z-index 5); the outer stack in
§2.2 is not touched, so `.edge-card` (6) and the pause overlay (7) still outrank every HUD panel.

### 4.1 Composition A — phone landscape 844×390

Height is the constraint. Single top row, single bottom row, nothing stacks.

| Panel | Anchor | Max width | z |
|---|---|---|---|
| `.hud-mission` | top band col 1 | `minmax(0,.9fr)` ≈ 190 px | 1 |
| `.hud-loop-state` (+ route rail §5.1) | top band col 2 | `minmax(9rem,1fr)` ≈ 260 px | 1 |
| `.hud-legion` | top band col 3 | `minmax(0,.8fr)` ≈ 165 px | 1 |
| `.top-right-hud` | top band col 4, right | `minmax(0,1.1fr)` ≈ 210 px | 1 |
| `.gate-panel` (+ buff strip §5.3) | bottom band col 2 | `1fr`, min `7.5rem` | 1 |
| `#movement-actions` | bottom band col 1, `justify-self: start` | 116 px fixed | 2 (pad) / 3 (ring) |
| `#battle-actions` | bottom band col 3 | `minmax(5.5rem,7rem)` | 1 |
| `#combat-input-cluster` | bottom band col 4, `justify-self: end` | `9.4rem` (150 px) | 2 |
| gimmick chip (§5.2) | inside `.hud-loop-state` | inherits | 1 |
| off-screen gimmick arrow (§5.2) | viewport edge, `pointer-events: none` | 44 px | 4 |

Retain `styles.css:3053-3054` bottom grid and `:3165` top grid verbatim.
`[TARGET]` top band ≤ **78 px**; bottom band = pad height **116 px**; central clear band
≥ **190 px**. `[INFERENCE]` The 78 px ceiling is a trim against a derived — **not measured** —
current height of ≈86 px (from the `styles.css:3162-3201` landscape top grid), taken to widen
the thin margin R5 names. Measure it before treating 86 as a baseline.

### 4.2 Composition B — phone portrait 390×844

Vertical budget is generous, width is scarce. Two-row top, three-row bottom.

```
.defense-top     grid-template-areas: "mission objective"     /* 2 × minmax(0,1fr) */
                                      "run     run"
.defense-bottom  grid-template-areas: "gate    actions"       /* minmax(0,1fr) 9.4rem */
                                      "movement combat"
```

| Panel | Anchor | Max width | z |
|---|---|---|---|
| `.hud-mission` | top row 1, left | `1fr` ≈ 176 px | 1 |
| `.top-right-hud` | top row 1, right | `1fr` ≈ 176 px | 1 |
| `.hud-loop-state` (+ route rail) | top row 2, full span | `none` (≈ 360 px) | 1 |
| `.hud-legion` | `clip-path: inset(50%)`, 1×1 px — retained in the a11y tree | — | 1 |
| `.gate-panel` (+ buff strip) | bottom row 1, left | `1fr` | 1 |
| `#battle-actions` | bottom row 1, right | `9.4rem` | 1 |
| `#movement-actions` | bottom row 2, `justify-self: start` | 116 px fixed | 2 / 3 |
| `#combat-input-cluster` | bottom row 2, `justify-self: end` | `9.4rem` × `7.9rem` | 2 |

Retain `styles.css:2450-2523` and the `.hud-legion` clip at `:1577-1581`.
`[TARGET]` top band ≤ **250 px** (assertion ceiling is `0.38 × 844 = 320.7`);
bottom band ≤ **225 px**; central clear band ≥ **330 px**.

**Not a scaled A.** A's single top row becomes two; A's single bottom row becomes two;
`.hud-legion` is present in A and visually suppressed in B.

### 4.3 Composition C — desktop 1440×900

Width buys **simultaneous context**, not larger phone spacing. This is where the route rail
expands from pips to named waypoints and the legion roster from a count to named slots.

| Panel | Anchor | Max width | z |
|---|---|---|---|
| `.hud-mission` | top band, left, one row | `min(24vw, 340px)` | 1 |
| `.hud-loop-state` + **expanded route rail** | top band, 2nd in row | `min(30vw, 420px)` | 1 |
| `.hud-legion` (**named slots**) | top band, 3rd in row | `min(24vw, 340px)` | 1 |
| `.top-right-hud` | top band, 4th in row | `min(26vw, 360px)` | 1 |
| `.gate-panel` + buff strip (**6 slots + labels**) | bottom band, left | `min(34vw, 460px)` | 1 |
| `#movement-actions` | bottom band, left of centre, `9rem` | 144 px fixed | 2 / 3 |
| `#combat-input-cluster` | bottom band, right | `12rem` | 2 |
| `#battle-actions` | bottom band, far right | `min(18vw, 260px)` | 1 |
| gimmick chip | inside `.hud-loop-state`, **with named gimmick label** | inherits | 1 |

Retain `styles.css:427-429` (`justify-content: flex-start`) — it is what makes the four top
panels one left strip and keeps the viewport centre free for the frozen growth modal
(`styles.css:470-479`).
`[TARGET]` top band ≤ **96 px**; bottom band ≤ **170 px**; central clear band ≥ **560 px**
(assertion floor is 400).

**Must keep** `mission.left < runState.left < objective.left` and pairwise non-overlap —
`defense-phone-battle-hud-browser.test.cjs:326-329` asserts the order and the one-row property.

### 4.4 Composition D — 1920×1080

New breakpoint `@media (min-width: 1600px)`. **Not** a wider C: at 1920 the four top panels
consume 1480 px of a 1920 band packed left, leaving 440 px of dead right edge. D uses it.

| Panel | Anchor | Max width | z |
|---|---|---|---|
| `.hud-mission` | top band, left | `340px` | 1 |
| `.hud-loop-state` + route rail | top band, 2nd | `440px` | 1 |
| `.hud-legion` | top band, 3rd | `360px` | 1 |
| `.top-right-hud` | **top band, right-anchored** (`margin-left: auto`) — the split C does not have | `380px` | 1 |
| `.gate-panel` + buff strip | bottom band, left | `520px` | 1 |
| `#movement-actions` | bottom band, left, `10rem` | 160 px fixed | 2 / 3 |
| `#combat-input-cluster` | bottom band, right | `13rem` | 2 |
| `#battle-actions` | bottom band, far right | `280px` | 1 |
| gimmick chip | inside `.hud-loop-state` | inherits | 1 |

```css
@media (min-width: 1600px) {
  .defense-top { flex-wrap: nowrap; }
  .defense-top > .top-right-hud { margin-left: auto; }
  #movement-actions { --pad-size: 10rem; --knob-size: 60px; }
}
```

`[TARGET]` top band ≤ **104 px**; bottom band ≤ **190 px**; central clear band ≥ **700 px**.

### 4.5 Central clear band and cutscene clearance

**Requirement.** In every composition the horizontal band between `.defense-top`'s bottom and
`.defense-bottom`'s top is free of HUD hit-testing at its centre point. This is exactly
`defense-phone-battle-hud-browser.test.cjs:308-310`: `exposedHeight ≥ 180`,
`exposedPoint.hitsSurface === true`, `exposedPoint.hitsHud === false`. The floating
gimmick arrow (§5.2) is edge-anchored and `pointer-events: none`, so it cannot be the
`elementFromPoint` hit.

Replacing S5's hard-coded margins:

```css
.defense-cutscene .cutscene-frame {
  --pad-clearance:    calc(var(--pad-size, 7.25rem) + 1rem);
  --combat-clearance: calc(var(--combat-cluster-width, 9.4rem) + 1rem);
  margin-left:  var(--pad-clearance);
  margin-right: var(--combat-clearance);
}
```

`--combat-cluster-width` is a new token declared per composition alongside the existing
`#combat-input-cluster` widths (`styles.css:2515,3053`), so clearance tracks the boxes instead
of restating their pixel sizes.

---

## 5. Dungeon-aware HUD additions

### 5.1 Route / objective readout — `#battle-route-rail`

Bound to the authored named waypoints of the stage's `critical` route
(`stage-world-catalog.js:33-38,138-149,221-232,304-315`), read-only.

`[OBSERVED]` Every stage's critical route is exactly four waypoints with the roles
`ingress → intermediate-objective → intermediate-gate → final-gate`, and the validator
enforces ≥2 `intermediate-*` plus termination at the canonical gate `(22000, 6000)`
(`stage-world-catalog.js:448-450`). So the rail is **fixed at four nodes** for all three stages
and needs no dynamic node count.

| Stage | Node 1 | Node 2 | Node 3 | Node 4 |
|---|---|---|---|---|
| `cinder-span` | `ingress` | `cinder-relay-crossing` | `cinder-forge-stand` | `final-gate` |
| `abyss-chancel` | `ingress` | `chancel-nave-advance` | `chancel-transept-lock` | `final-gate` |
| `echo-throne` | `ingress` | `throne-aisle-break` | `throne-dais-stand` | `final-gate` |

Markup, inside `.hud-loop-state` after `#battle-loop-phase`:

```html
<ol class="hud-route-rail" id="battle-route-rail" role="list" aria-label="던전 동선">
  <li class="route-node" data-route-role="ingress"               data-route-state="cleared"><span class="route-pip" aria-hidden="true"></span><b></b></li>
  <li class="route-node" data-route-role="intermediate-objective" data-route-state="active"><span class="route-pip" aria-hidden="true"></span><b></b></li>
  <li class="route-node" data-route-role="intermediate-gate"     data-route-state="pending"><span class="route-pip" aria-hidden="true"></span><b></b></li>
  <li class="route-node" data-route-role="final-gate"            data-route-state="pending"><span class="route-pip" aria-hidden="true"></span><b></b></li>
</ol>
```

| Rule | Value |
|---|---|
| `data-route-state` | `cleared` \| `active` \| `pending` |
| Non-colour channel | `cleared` = filled pip + 1px inner ring; `active` = filled pip at 1.35× diameter; `pending` = hollow pip. Diameter and fill, never hue alone. |
| Label `<b>` visibility | A/B: only the `active` node's label renders (width budget). C/D: all four render. |
| Also written | `#defense-battle-surface[data-route-waypoint="<waypoint id>"]` — the full authored id, e.g. `cinder-span:cinder-relay-crossing` |
| Detour | The `optional-detour` route is **not** on the rail. It is optional, and putting it there implies obligation. It surfaces only as a world-space landmark. |
| Pip size | 10 px A/B, 12 px C/D. Not actionable → §7.1's 44 px floor does not apply. |
| Advance source | **`snapshot.objectives.route`, read as a LEVEL — not accumulated from events.** See "Advance" below. |

`aria-live` is **off**. Route advance is a beat the world already narrates; announcing it would
add to the `BIGWAVE` announcement noise `hud-information-architecture.md` §7 rejects.

**Advance — read the level, do not accumulate the edge.**

`[OBSERVED]` The simulation already publishes exactly the state this rail needs, and it is in the
snapshot: `run.objectives.route = { version, id, phase, order, completed }`
(`git show 033877ad:defense-run-simulation.js:3448-3456`, serialized by `getRunSnapshot` via
`objectives: run.objectives` at `:3544`). `phase` is `encounter.objectiveId || "complete"`
(`:1114,1119`), and `completed` is `encounter.status === "COMPLETE"` (`:1120`).

**An earlier form of this spec advanced the rail on `ENCOUNTER_OBJECTIVE_COMPLETED`. That was
edge-accumulation and it is superseded.** Three reasons, in order of severity:

1. **It cannot self-correct.** Miss the event once — a stage remount, a mount after the objective
   cleared, a frame dropped while paused — and the rail is permanently wrong for the rest of the
   run, with no path back to truth. A level read is right on the very next frame.
2. **It is exposed to the `objectiveId` collision class.** `[OBSERVED]` roughly **40** distinct
   event types in the blob carry an `objectiveId` field — `WAVE_CLEARED`, `GROWTH_OFFER`,
   `PICKUP_DENIED`, `OCCUPATION_*`, `EXTRACTION_*`, `OBJECTIVE_PHASE_CHANGED`,
   `ENCOUNTER_PATH_CONTESTED`, and more. Any reader keyed loosely on that field advances the rail
   on unrelated traffic. Reading `objectives.route` touches no event at all, so the entire class
   is designed out rather than guarded against.
3. It needs no `event.type` allow-set, no dedupe, and no replay handling.

**`order` is NOT the rail.** `[OBSERVED]` `objectives.route.order` is the *encounter* route's
objective ids, and there are exactly **two** per stage — `defense-catalog.js:630-649`
`STAGE_ENCOUNTER_ROUTES["cinder-span"].objectives` is `["cinder-relay-crossing",
"cinder-forge-stand"]`, and the catalog validator requires only `>= 2` (`:936`). The rail's four
nodes come from the **authored critical route** in `stage-world-catalog.js`, which adds `ingress`
and `final-gate` at the ends. The two lists overlap on the middle two ids and **must not be
conflated** — substituting `order` wholesale would silently drop both endpoints.

So: **node identity from the authored waypoints, node state from `phase`.**

```js
const route = snapshot.objectives?.route;           // conditional-safe
const order = Array.isArray(route?.order) ? route.order : [];
const phaseIndex = route?.completed ? order.length : order.indexOf(route?.phase ?? "");
// nodes[0] is `ingress`, nodes[n-1] is `final-gate`; the middle nodes align with `order`.
const stateFor = (node) => {
  if (node.role === "ingress") return "cleared";                       // passed before combat
  if (node.role === "final-gate") return route?.completed ? "active" : "pending";
  const i = order.indexOf(node.waypointSuffix);
  if (i < 0) return "pending";                                         // not an encounter objective
  if (phaseIndex < 0) return "pending";
  return i < phaseIndex ? "cleared" : i === phaseIndex ? "active" : "pending";
};
```

`phaseIndex < 0` covers `phase` values outside `order` (`"gate-defense"` pre-encounter,
`"complete"` is handled by the `completed` branch) — every such case renders `pending` rather
than throwing or guessing.

### 5.2 Gimmick-state indicator — `#battle-gimmick-state`

Reads the director-ruled `GIMMICK_ARMED` / `GIMMICK_TRIGGERED` / `GIMMICK_RESOLVED` family
(ruling v2 R5/R8): payloads carry `gimmickId`, `slabId`, `objectiveId`, `telegraphTicks`,
`gimmickClass ∈ deformation | gate | mirror | hazard`, and integer `x, y`.

> **MANDATORY: gate on `event.type` FIRST. `telegraphTicks` is not unique to this family.**
>
> `[OBSERVED]` `git show 033877ad:defense-run-simulation.js:2290-2297` emits
> `ENCOUNTER_PATH_CONTESTED` with `telegraphTicks: contestTicks` — a **different quantity with
> the same field name**, and the *only* occurrence of `telegraphTicks` in the blob. Reported by
> `AudioFeedbackDesign`; verified here.
>
> It is worse than a one-field clash: that payload also carries **`objectiveId`**, which this
> chip reads as well. So a reader keyed on field presence rather than on `event.type` would
> render a gimmick chip — with a plausible label and a plausible lifetime — for a route
> contest that has no gimmick at all.
>
> Required shape:
>
> ```js
> const GIMMICK_EVENTS = new Set(["GIMMICK_ARMED", "GIMMICK_TRIGGERED", "GIMMICK_RESOLVED"]);
> if (!GIMMICK_EVENTS.has(event.type)) return;   // BEFORE any field read
> ```
>
> Never `if (event.telegraphTicks)`. Never a shared "telegraph reader" helper used across
> families. `[INFERENCE]` `RendererVfxImpl` reads `telegraphTicks` at 10 sites; each needs the
> same type gate, and that is worth one dedicated check (26d).

**Subordinate by contract.** `hud-information-architecture.md` §4.1-4.2 forbids HUD-only
telegraphs and forbids duplicating an on-screen world decal. Therefore:

| State | Condition | Treatment |
|---|---|---|
| absent | no armed/triggered gimmick | chip not rendered (auto-hide, §6.2 pattern) |
| `armed` | `GIMMICK_ARMED` … `GIMMICK_TRIGGERED` | chip in `.hud-loop-state`: class glyph + `objectiveId`. **No countdown number** — the world decal's fill is that information. |
| `triggered` | `GIMMICK_TRIGGERED` … `GIMMICK_RESOLVED` | chip switches to the resolved-pending treatment; for `gimmickClass="deformation"` it additionally shows the corridor delta as `▮▮▯` proportion bars from `corridorWidthBefore`/`corridorWidthAfter` |
| `resolved` | `GIMMICK_RESOLVED` | chip clears after 600 ms |
| off-screen | gimmick `x,y` outside the projected viewport | **and only then** a 44×44 edge arrow at `z-index: 4`, `pointer-events: none`. On-screen → no arrow. |

`data-gimmick-state` is mirrored onto `#defense-battle-surface` so CSS can key stage-accent
emphasis without JS style writes.

**Measured concurrency and corridor data**, published by `DungeonLevelDesign` and adopted
verbatim — the numbers this section previously deferred:

| Gimmick | Stage | `corridorWidthBefore` → `After` | Δ | bars |
|---|---|---|---|---|
| `cinder-span:gimmick-ash-causeway-collapse` | cinder-span | 1400 → 900 | −36 % | `▮▮▮▯▯` |
| `cinder-span:gimmick-warden-chain-fall` | cinder-span | 1400 → 1000 | −29 % | `▮▮▮▮▯` |
| `abyss-chancel:gimmick-classification-craze` | abyss-chancel | 1400 → 900 | −36 % | `▮▮▮▯▯` |
| `echo-throne:gimmick-sovereign-command-shear` | echo-throne | 1400 → 900 | −36 % | `▮▮▮▯▯` |

Bars render `round(after / before × 5)` filled of 5 → **3 / 4 / 3 / 3**. Four deformation
gimmicks, one per stage except cinder-span's two.

**Superseded (`DungeonLevelDesign`, self-corrected).** The first published widths were
1200→700 / 1200→800 / 1000→700 / 1100→700, giving bars 2/3/3/2. Those narrowed bands were
**impassable**: `[OBSERVED]` `git show 033877ad:defense-catalog.js` `COMMANDER.radius = 360`, so
commander **diameter is 720** and a 700-wide band is narrower than the actor. Corrected to a
`corridorWidthAfter` floor of **≥ 900** — 720 plus 90 units of clearance per side.

**A false claim of mine went with it.** This section previously read "every
`corridorWidthAfter ≥ 600`, so the narrowed corridor still clears the catalog's corridor floor —
the chip never has to depict an impassable route." The conclusion was right but the reasoning was
backwards: **600 is narrower than the 720 actor**, so that floor guaranteed the opposite of what
I claimed. I repeated a published floor without dividing it by the actor it had to admit — the
same failure the Director's v6 C1 corrects in its own dash rationale. The claim is now true for a
checkable reason: **900 > 720**.

**Bar resolution is now coarser than the data.** Three of four gimmicks render an identical
`▮▮▮▯▯`, where the old spread gave 2/3/3/2. Five bars cannot separate 900/1400 (3.21) from
1000/1400 (3.57) by more than one step. That is **acceptable and not worth more bars**: the bars
answer *"how much of my lane is left"*, not *"which gimmick is this"* — and with max 1 deformation
armed per stage the player never sees two side by side to compare. Do **not** raise the bar count
to restore variety; a 22–26 px chip cannot carry finer granularity legibly, and the old spread
was an artifact of impassable widths rather than a design property.

| Concurrency fact | Value | HUD consequence |
|---|---|---|
| `telegraphTicks` | **PER CLASS, four tiers** — deformation **180**, narrowing gate **120**, progress-ring/mirror **90**, hazard **60** (v6 C2). It **is** the full reaction window: `ARMED` at `T`, `TRIGGERED` at exactly `T + telegraphTicks`. | **The chip MUST read `event.telegraphTicks`, never a constant.** Required form: `lifetime = Number.isInteger(event.telegraphTicks) ? event.telegraphTicks : 180`, where 180 is fallback and clamp only. Hardcoding 180 makes a 60-tick hazard chip linger **120 ticks past its own TRIGGERED** — telling the player something is still arming after it fired, which is worse than a chip that is too short. |
| max deformation armed per stage | **1** | the deformation bars are never ambiguous about which gimmick they describe |
| max armed of any class per stage | **2** | so the `+1` overflow count below is **exhaustive** — `+2` can never occur |
| `GIMMICK_TRIGGERED` per tick, stage-wide | **1**, ties broken by an authored integer `order`, loser defers one tick, **no RNG** | the chip's trigger transition is single-valued per frame; no batching needed |
| narrowing enforcement | simulation-enforced hazard/steering band **inside** the already-authored corridor — never new collision, never a moved plane | the chip describes a hazard, not a geometry change; copy must not imply the floor moved |

`[TARGET]` Chip height 22 px A/B, 26 px C/D. Concurrency: the chip shows the **single** gimmick
with the smallest `telegraphTicks` remaining; a second concurrent gimmick adds a `+1` count, not
a second chip. With the measured cap of 2 armed per stage, `+1` is the only overflow state that
can exist. Rationale for not showing both: two competing telegraph chips is two things to read
under wave pressure, which the §6 simultaneous-element budget of 9 does not fund.

### 5.3 Active-buff strip — `#battle-buff-strip`

Field names below were negotiated with `DropBuffSystem` over IRC and are bound to director
ruling v2 R7/R13/R17 and v3 R16/R17/R18. **This strip reads their actual structure.**

| Contract | Value |
|---|---|
| Snapshot path | top-level `snapshot.buffs` — **not** `snapshot.commander.buffs` |
| Presence | **conditional**, emitted only when `run.buffs.length > 0`, mirroring `abyssDepth` (`defense-run-simulation.js:3498`). HUD **must** read `snapshot.buffs ?? []`. |
| Entry shape (8 fields) | `{ buffId, itemId, stat, magnitude, stacks, appliedAtTick, expiresAtTick, sourceDropId }` — final, per `design/item-drop-timed-buff-spec.md` §7.1. `sourceDropId` (was `sourcePickupId` in an earlier IRC draft) correlates the buff back to its `DROP_SPAWNED` instance; **nothing in the HUD reads it** — ignore it in the strip. |
| `buffId` | per-instance, `buff-<n>` from `nextId(run,"buff")` |
| `itemId` | catalog definition id; **one name everywhere** (R16). `defId` is dropped. |
| Order | ascending `buffId`, guaranteed stable frame-to-frame. **HUD must not re-sort.** Sorting by remaining time makes icons swap position as they tick. |
| Icon | `data-ui-icon="${BUFF_ITEMS[itemId].iconId}"`, values shaped `buff-<slug>`. Direct index `BUFF_ITEMS[itemId]`, frozen catalog, no lookup fn. **Never derive the icon from `stat`** — several items share a stat. |
| `stat` | `basicDamage` \| `gateMaxIntegrity` \| `pickupRange` \| `cooldownScaleBp` \| `moveSpeedBp` \| `critChanceBp` \| `incomingDamageBp` (R17). Used only as a secondary grouping/colour key; **unknown values render as the neutral group**, so a future enum change cannot break the strip. |
| `magnitude` | always an **integer in basis points** (R13). Divide by 100 for a percent label at the read site; never store a float. |
| Remaining | `remaining = entry.expiresAtTick − snapshot.tick`; seconds = `Math.ceil(remaining / 60)`. There is deliberately no `remainingTicks` field — it would rewrite the array every tick. |
| Slots | `MAX_ACTIVE_BUFFS = 6` distinct `itemId`; `MAX_BUFF_STACKS = 3`. Eviction is simulation-side, so the HUD needs **no overflow mode**. |
| Pre-expiry warning | derived, no event (R10b). `[TARGET]` `BUFF_WARN_TICKS = 180` (3 s). **No longer presentation-only** — see §5.3a. `AudioFeedbackDesign` consumes the same derivation via `signalBuffExpiring(buffId)`, so this number is now shared and changing it changes audio timing. |
| Rarity | **not an entry field** — resolve from the catalog, `BUFF_ITEMS[itemId].rarity`. Four tiers (R3): `common` \| `rare` \| `resonant` \| `relic`. Mirrored to `data-buff-rarity` for styling. **Encoded with no hue at all** — border weight 1/1/2/2 px plus corner treatment none/none/cut/cut. Deliberate: four rarity hues on one strip would consume the entire ≤5 HUD colour budget (`hud-information-architecture.md` §6) by itself, and rarity is "requested" grade information, not the glance-grade signal that earns a colour. |
| Events | `BUFF_APPLIED` / `BUFF_REFRESHED` / `BUFF_EXPIRED` (R6: refresh is its own event; no `refreshed` flag). Used only for one-shot arrival/refresh/expiry accents. **Steady state renders from `snapshot.buffs`, not from events** — so the strip is unaffected by the `effectAnchor()` defect (ruling v2 D1) that blocks VFX cues for these same events. |
| `BUFF_EXPIRED.reason` | `TIMEOUT` \| `EVICTED` \| `STAGE_TRANSITION` \| `DEATH` (R10a). Expiry accent plays on **`TIMEOUT` only** — an "it ran out" flourish on an `EVICTED` buff would claim time expired when a 7th pickup displaced it, and on `DEATH`/`STAGE_TRANSITION` it would compete with a run-ending or stage-change beat. The other three remove the slot silently. **MANDATORY conjunctive form** — see the box below. |

> **`reason` MUST be gated on `event.type` in the same condition. It fails SILENTLY otherwise.**
>
> Required: `event.type === "BUFF_EXPIRED" && event.reason === "TIMEOUT"`.
> Forbidden: any bare `event.reason` switch, lookup table, or `reason`-keyed map.
>
> `[OBSERVED]` `reason` already carries **four incompatible vocabularies across six emit sites**
> in the blob (`git show 033877ad:defense-run-simulation.js`):
>
> | Site | Value | Vocabulary |
> |---|---|---|
> | `:1740` `PROJECTILE_EXPIRED` | `"bounds"` / `"range"` | lowercase |
> | `:2018` `REWARD_SELECTION_DUPLICATE_IGNORED` | `"REWARD_ALREADY_OWNED"` | SCREAMING |
> | `:2044` reward-selection failure | `"M4_CARD_INVENTORY_EXHAUSTED"` / `"M4_CARD_DECISION_INVALID"` | SCREAMING |
> | `:2082` m4 fallback | `run.m4.fallbackReason` | dynamic |
> | `:2195` `EXTRACTION_REJECTED` | `rejectionReason` | dynamic |
> | `:2204` | `accepted ? null : rejectionReason` | dynamic, **may be `null`** |
>
> This collision is **more dangerous than `telegraphTicks`**, and for the opposite reason. The
> value sets happen not to overlap today, so a bare `reason` gate throws nothing, logs nothing,
> and renders nothing wrong — **it just never fires.** A missing accent is invisible in review
> and invisible in a passing test. `telegraphTicks` fails loudly; `reason` fails silently, and
> silence is the failure mode that ships.
>
> Reported by `DropBuffSystem`, sharpened by `AudioFeedbackDesign` (two `reason`-carrying events
> already have audio policies and so are reachable); the `null` at `:2204` is verified here.
> `DROP_DENIED.reason === "FIELD_CAP"` carries the identical requirement wherever it is read.

#### 5.3a Shared threshold and the two audio call sites in `app.js`

`BUFF_WARN_TICKS` was declared presentation-only by both this spec and `DropBuffSystem`. That
is **superseded**: `design/audio-feedback-dungeon-spec.md` §7.2 needs `signalBuffExpiring(buffId)`
driven off the same pre-expiry derivation, and the only place that comparison exists is this
strip's render pass. So the threshold is **shared**, with one comparison and two consumers.

This is the right shape — the strip and the audio sting can never disagree, because neither owns
a second copy of the number. But it means **changing 180 changes audio timing**, and that
coupling must be written where the constant is declared.

`app.js` is this spec's file (§2 ownership), so both hooks are specified here even though
`AudioFeedbackDesign` authors their behaviour. Both are **optional-call guarded**, so a build
without the audio methods degrades rather than throwing inside the render loop.

| Hook | Call site | Form | Degradation if absent |
|---|---|---|---|
| surface resolver | beside the `this.audio.start()` call in `beginRun()` | see "Hook 1" below — **not** a bare `slabMaterialAt` identifier | footsteps use one base timbre; nothing else changes |
| buff pre-expiry | inside `renderBuffStrip`, reading the **same** computed `warning` flag that sets `data-buff-warning` | `this.audio?.signalBuffExpiring?.(buffId)` | strip still shows the hatched warning; no sting |

**Anchor by symbol, never by line.** `app.js` is under active edit and every line citation this
cycle went stale on arrival: the assignment said 2350-2399; I measured 2117/2155; the audio lane
said 2147, then 2155/2193; I re-measured 2169/2208 at 4147 lines. **Every one was correct when
taken.** Anchor on `beginRun()`, `remountForStage()`, `renderBuffStrip`, and the
`this.audio.start()` call. Do not reintroduce line numbers here.

**Placement inside `renderBuffStrip` is load-bearing.** The audio edge must fire **ahead of any
render-signature early-return**. If it sat after, a frame whose only change is the warning flip
would sometimes be diffed away and the sting would miss its edge entirely. The audio edge must
not depend on DOM diffing.

**Hook 1 — UNBLOCKED. It is in `defense-catalog.js`, and `app.js` already imports that module.**

`[OBSERVED]` `slabMaterialAt` is exported from **`defense-catalog.js:332`** (with `slabAt:320` and
the frozen `STAGE_SLABS:288`), signature
`slabMaterialAt(stageId, x, y) -> { slabId, materialId } | null`. It is **not** in
`stage-world-catalog.js` — 0 matches there (v9 R38). `defense-catalog.js` is the right home: the
slab rects are stage data, and `stage-world-catalog.js` imports *from* that module, not the
reverse. No re-export is being added, because two import paths to one symbol is the translation
layer R19 forbids.

**No new import is needed.** `[OBSERVED]` `app.js:53` already carries
`import * as defenseCatalog from "./defense-catalog.js"` — added for `BUFF_ITEMS` under this
spec's §5.3 for exactly the missing-export reason below. Reuse it:

```js
// slabMaterialAt is authored in defense-catalog.js (v9 R38). The `typeof` guard is kept per
// R38 so the line stays safe if module load order ever changes, and it costs nothing.
const resolveSlabMaterial = typeof defenseCatalog.slabMaterialAt === "function"
  ? (stageId, x, y) => defenseCatalog.slabMaterialAt(stageId, x, y)?.materialId ?? null
  : () => null;
this.audio.setSurfaceResolver?.(resolveSlabMaterial);
```

**Two forms that must NOT be used**, recorded because both were proposed and one was nearly
landed:

| Form | Failure |
|---|---|
| `this.audio.setSurfaceResolver?.(slabMaterialAt)` with no import | `?.` guards the missing **method**, not the argument. A bare undefined identifier throws `ReferenceError` at evaluation, before the optional call is consulted. It sits in the run-start path, so it reds every browser suite. |
| `import { slabMaterialAt } from "./stage-world-catalog.js"` | **Wrong module** — 0 matches there. A named import of a non-existent export is a **module-link error** thrown at load, before any statement runs: it blanks the whole app before first paint and the `typeof` guard never executes. |

The namespace form is what makes the guard real: a namespace import cannot throw on a missing
member, it yields `undefined`. That property is why it was chosen for `BUFF_ITEMS` and why it is
correct here even now that the export exists — the line survives any future move of the symbol.

**Warned-id Set — an EDGE detector, not a lifetime ledger.**

`this.warnedBuffIds` is a `Set<string>`. Per frame, for each rendered slot:

| Condition | Action |
|---|---|
| `warning && !has(buffId)` | `add(buffId)`, then fire `signalBuffExpiring` |
| `!warning` | `delete(buffId)` |

**A buff warns once per APPROACH, not once per lifetime.** An earlier form of this spec said
"warns once" and held the id permanently. That is a defect: `BUFF_REFRESHED` extends
`expiresAtTick` (R6 makes refresh its own event precisely so it can), so `remaining` rises back
above `BUFF_WARN_TICKS` and the buff approaches expiry a **second** time — but with a permanent
entry its id is still in the Set and it never warns again for the rest of the run. Silent, and no
existing test would catch it. Caught by `UiJoystickImpl` during implementation. The delete branch
also bounds the Set for free: ids leave as they recover instead of accumulating all run.

| Reset point | Reason |
|---|---|
| `beginRun()` | named by `audio-feedback-dungeon-spec.md` §7.2 |
| `remountForStage()` | **added here.** `buffId` is `buff-<n>` from a run-local counter, so a re-entered stage reuses ids. |

Both sweeps are **still required** alongside the delete branch: a buff that *vanishes* while
warning — stage remount, `DEATH`, `EVICTED` — never evaluates `!warning`, so its id would linger.
The delete branch covers recovery; the sweeps cover disappearance.

Markup, appended inside `.gate-panel` after `.integrity-meter`:

```html
<ul class="hud-buff-strip" id="battle-buff-strip" role="list" aria-label="활성 강화" aria-live="off"></ul>
```

Per-slot template:

```html
<li class="buff-slot" data-buff-id="buff-12" data-buff-item="ember-edge"
    data-buff-stat="basicDamage" data-buff-rarity="rare" data-buff-warning="false">
  <span class="buff-icon" data-ui-icon="buff-ember-edge" aria-hidden="true"></span>
  <span class="buff-stacks" aria-hidden="true">×2</span>
  <span class="buff-remaining" aria-hidden="true">7s</span>
  <span class="sr-only">Ember Edge, 2중첩, 남은 7초</span>
</li>
```

**Test-safety requirement (blocking).** Slots are `<li>`/`<span>`, **never `<button>`**.
`defense-phone-battle-hud-browser.test.cjs:201-205,315-319` collects
`bottom.querySelectorAll("button")` and requires every result visible and ≥44×44. Six 30 px
readout chips inside `.gate-panel` as buttons would fail that on both counts. The strip is a
readout with no actionable target, so the 44 px floor does not apply to it.

| Composition | Slot box | Strip width | Placement inside `.gate-panel` |
|---|---|---|---|
| A 844×390 | 26 × 26 px | ≤ 171 px | one line above the bars |
| B 390×844 | 30 × 30 px | ≤ 204 px | one line below `.integrity-meter` |
| C 1440×900 | 34 × 34 px | ≤ 234 px | own line, `+` percent labels |
| D 1920×1080 | 36 × 36 px | ≤ 252 px | own line, `+` percent and stat labels |

**Why inside `.gate-panel` and not a floating strip.** Two reasons, one design and one
structural. Design: the warden panel already pairs commander integrity with gate integrity —
"am I dying" — and active buffs are the "am I strong right now" half of the same question, so
they belong to the same glance. Structural: `[OBSERVED]` in composition A the pad and the gate
panel share one grid row (`styles.css:3053-3054`, areas `"movement gate actions combat"`), so
the row height is `max(padHeight, gateHeight)`. `[INFERENCE]` with the pad at 116 px and the
gate panel deriving to ≈86 px, a 26 px strip lifts the panel to ≈112 px — still under 116 —
which means **composition A should gain zero band height and the central clear band should not
shrink**. That is the load-bearing reason for this placement and it is **derived, not
measured**: check 15 must confirm it, and Open risks R5 records the ≈8 px of margin the whole
argument protects. A free-floating strip would need its own row, which A cannot fund.

Non-colour channels, per §7: stacks are a numeral **and** a stack-count notch group;
`data-buff-warning="true"` adds a hatched overlay, not just a hue shift.

---

## 6. Visual identity

### 6.1 Alignment, per stage

| Stage | `presentation.palette.accent` `[OBSERVED]` | Motif `[OBSERVED]` | HUD concept |
|---|---|---|---|
| `cinder-span` | `#f3592c` | "embers moving through ash" (`:154`) | Forge-plate. Hard 45° cut corners, ember rim on the active route node, ash-grey neutrals. |
| `abyss-chancel` | `#8f67ff` | "oath rings and violet static" (`:237`) | Reliquary. Concentric oath ring behind the pad rune; panel corner marks read as seal brackets. |
| `echo-throne` | `#72c8ff` | "echo fractures and cold blue glass" (`:320`) | Fractured glass. Panel border is a two-segment break instead of a continuous line; route pips are faceted. |

Applied per-stage without JS style writes, keyed on the existing `data-stage-id`
(`[OBSERVED]` `app.js:1803` markup, `:3071` per-render re-assert):

```css
/* Stage accent indirection. Two NEW tokens; the cinder value reuses the existing ember token
   rather than restating #f3592c. Panel chrome keeps the canon cyan/gold pair -- the stage
   accent is a single emphasis hue on state-carrying elements only, never a panel repaint. */
:root {
  --canon-oath-violet: #8f67ff;   /* NEW  — abyss-chancel presentation.palette.accent */
  --canon-echo-ice:    #72c8ff;   /* NEW  — echo-throne presentation.palette.accent   */
  --stage-accent: var(--canon-cyan-rift);          /* neutral default */
}
#defense-battle-surface[data-stage-id="cinder-span"]   { --stage-accent: var(--canon-cinder-ember); }
#defense-battle-surface[data-stage-id="abyss-chancel"] { --stage-accent: var(--canon-oath-violet); }
#defense-battle-surface[data-stage-id="echo-throne"]   { --stage-accent: var(--canon-echo-ice); }
```

**New tokens, named explicitly:** `--canon-oath-violet`, `--canon-echo-ice`, `--stage-accent`,
`--pad-size`, `--knob-size`, `--combat-cluster-width`. Nothing else is added.

**Reused, unchanged:** `--canon-cyan-rift` (panel border, cooldown ring, "confirmed entry" hue),
`--canon-zenith-gold` (knob rim, objective chip right edge, numerals),
`--canon-cinder-ember` (cinder accent), `--canon-void-obsidian` / `--canon-cold-steel`
(neutrals), `--rc-panel-border`, `--rc-panel-glass`, `--lantern-line`, `--lantern-focus`,
`--defense-safe-*`.

### 6.2 Where the stage accent may and may not appear

| May | Must not |
|---|---|
| Active route pip fill; armed-gimmick chip border; pad rune (`.virtual-joystick-rune`); buff-arrival one-shot accent | Panel background, panel body border, body text, the knob (stays gold — it is the same object on every stage) |

Cap: **≤3** simultaneously accent-tinted elements, inside the ≤5 HUD colour budget of
`hud-information-architecture.md` §6.

### 6.3 Anti-dashboard constraints

Reject the composition if any holds — carried from `battle-hud-concept-cycle9.md` §7:

- A flat rounded-rect card with no rim light, no scanline, and no corner mark. Every panel keeps
  the `::before` rim gradient and `::after` scanline (`styles.css:436-437`) and `.hud-loop-state`
  keeps its corner brackets (`:441-442`).
- Bootstrap-family hues, or bare `#fff` body text. Panel text stays in the existing
  `#e8f4ff`/`#b7c9dc` pair (`:443-444`).
- A bare left-aligned heading with no eyebrow. `.hud-eyebrow` stays on every panel.
- Uniform 8 px radii everywhere. Radii stay per-role: 6 px panels, 50 % pad and ring, 999 px
  tracks — as already shipped.
- The route rail reading as a generic progress bar. It is four discrete nodes with per-node
  state, matching the reference's `[OBSERVED]` numbered-node treatment
  (`battle-hud-concept-cycle9.md` §3), not a continuous fill.

---

## 7. Accessibility

### 7.1 Targets ≥ 44×44 CSS px

| Actionable | Size | Note |
|---|---|---|
| five `[data-move]` ring controls | 44×44 all compositions | `styles.css` §3.4; unchanged floor |
| joystick knob | 44 / 44 / 56 / 60 px | §3.5 |
| whole pad as a drag surface | 116 / 116 / 144 / 160 px | `progression-mobile-ui-browser.cjs:320` asserts ≥44 |
| `#manual-attack`, skills, `#battle-actions` | `min-height: 44px` retained | `styles.css:449-450,2323-2328` |
| off-screen gimmick arrow | 44×44 | `pointer-events: none` — a readout that happens to be arrow-sized |
| buff slots, route pips, gimmick chip | 26–36 / 10–12 / 22–26 px | **not actionable**; floor does not apply |

Spacing ≥ 8 px between actionable targets. C1's centre exclusion disc gives the ring controls
≥ 8 px separation from each other at every pad size in §3.5 `[TARGET]`.

### 7.2 No horizontal overflow

`documentElement.scrollWidth ≤ clientWidth` at all four compositions. Enforced by: every panel
`max-width` in §4 expressed as `min(<vw>, <px>)` or a grid fraction; `#movement-actions` and
`#combat-input-cluster` fixed-width with `justify-self`; `.defense-top`/`.defense-bottom`
anchored on `--defense-safe-*` so notch insets shrink content instead of pushing it out
(`styles.css:420-421`). Asserted by `defense-phone-battle-hud-browser.test.cjs:321,331`.

### 7.3 ARIA

**Joystick.**

```html
<div class="virtual-joystick" data-joystick
     role="application" aria-label="이동 스틱" aria-describedby="movement-hint">
```

`role="application"` (not `slider`) because the control is two-dimensional and its state is a
direction plus a magnitude, which no single-value `aria-valuenow` can express honestly. The five
ring buttons remain the **complete** keyboard/AT path — every octant the stick reaches is also
reachable by `[data-move]` activation plus the existing `WASD`/arrow bindings, so nothing is
AT-only-unreachable. `#movement-actions` keeps `role="group"` and
`aria-label="한 손 이동 조작"` verbatim (`defense-survivor-browser.cjs:399-401`).

`aria-hidden="true"` is **removed** from `[data-joystick]` (S1 consequence): a primary control
must not be absent from the accessibility tree. `.virtual-joystick-rune` and
`.virtual-joystick-knob` are decorative and stay `aria-hidden` / non-focusable.

**Buff strip.** `role="list"` + `aria-label="활성 강화"`, `aria-live="off"`. Each `<li>` carries
one `.sr-only` sentence (`"<name>, <n>중첩, 남은 <s>초"`); numeric spans are `aria-hidden` so a
screen reader hears one sentence, not four fragments. Live regions are **off** here for the
reason `hud-information-architecture.md` §7 gives: values that change every tick become noise.
`#battle-status` keeps its existing `aria-live="polite"` and stays the single combat announcer
(`app.js:1809`; asserted `defense-survivor-browser.cjs:398`).

**Route rail.** `role="list"` + `aria-label="던전 동선"`. Pips `aria-hidden`; the active node's
name is in `<b>`. No live region.

**Gimmick chip.** `role="status"`, `aria-live="off"`; the world decal is the primary telegraph
(§5.2) and duplicating it as speech would arrive later than the decal.

### 7.4 Focus order

DOM order is the focus order; no `tabindex > 0` anywhere.

1. `.defense-top` panels — no focusables (readouts only)
2. `.gate-panel` — no focusables; the buff strip is a list, not a control
3. `#movement-actions` → `N`, `W`, `IDLE`, `E`, `S` in **DOM order** (C2)
4. `#combat-input-cluster` → `#manual-attack`, then `#skill-actions`
5. `#battle-actions` → `#stance-cycle`, `#toggle-pause`, `#extract-elite`

`:focus-visible` on a ring control raises it to `z-index: 4` with a
`2px var(--lantern-focus)` outline at `outline-offset: 2px`, so a focused control is never
occluded by the pad. `[data-joystick]` is **not** in the tab order — it has no `tabindex`, and
`role="application"` alone does not make it focusable, so the ring stays the keyboard path.

### 7.5 Reduced motion

Extend `styles.css:674-677`; every removal keeps the information in a static channel.

```css
@media (prefers-reduced-motion: reduce) {
  .virtual-joystick-knob { transition: none; }            /* was transform 45ms linear */
  .route-node[data-route-state="active"] .route-pip { animation: none; }
  .buff-slot[data-buff-warning="true"] { animation: none; }
  .buff-slot[data-buff-accent] { animation: none; }        /* arrival / refresh / TIMEOUT expiry */
  #battle-gimmick-state { animation: none; }
}
```

| Removed | Static equivalent that carries the same information |
|---|---|
| knob easing | knob still tracks the pointer 1:1 — `transform` is set directly, only the interpolation is dropped |
| active-pip pulse | pip stays at 1.35× diameter — the size, not the pulse, is the state |
| buff pre-expiry blink | hatched overlay + the numeric seconds label |
| buff arrival / refresh flourish | the slot's presence **is** the arrival; the stack numeral **is** the refresh. Both are already static state, so the accent was pure decoration. |
| buff `TIMEOUT` expiry flourish | the slot is removed. Removal is the information; the flourish only paced it. |
| gimmick-armed pulse | static class glyph + `objectiveId` label |

No information exists only in motion. `[OBSERVED]` `defense-phone-battle-hud-browser.test.cjs`
already runs `reducedMotion: "reduce"` by default (`:46`), so the entire phone/desktop HUD
contract is measured in the reduced-motion state.

---

## 8. The nine movement-control assertions in `map-tests.md` §3

Enumerated exactly as `map-tests.md:97-114` states them, with how each stays green.

| # | Assertion (`map-tests.md` line) | Stays green because |
|---|---|---|
| **A1** | `data-move` covers cardinal `E,W,N,S` and diagonal `NE,NW,SE,SW` inferred from `OCTANT_VECTORS` (`:99`) | Neither `OCTANT_VECTORS` nor `JOYSTICK_OCTANTS` (`app.js:84`) is touched. The four cardinal buttons keep their `data-move` values; the four diagonals were never buttons and are still reached by drag through the unchanged `Math.round(atan2/(π/4))` mapping at `app.js:2475-2477`. |
| **A2** | Browser tests reference `[data-move="E"]`, `[data-move="W"]`, `[data-move]` (`:100`) | All five buttons stay mounted with unchanged `data-move` values (§3.4 "no change whatsoever"). Only `position`, `opacity`, `pointer-events`, `z-index`, `border-radius` change — none is part of an attribute selector. |
| **A3** | `defense-phone-battle-hud-browser.test.cjs` activates `#movement-actions [data-move="E"]` with `Enter` (`:103`, actual `:494-495`) | `Enter` on a focused `<button>` fires `click`, which reaches `onMoveControlClick` (`app.js:2547-2552`). That method is **not modified** and `event.detail === 0` still holds for keyboard activation, so it sends `MOVE E` and `data-defense-move === "E"` follows. The §3.2 reorder affects `pointerdown` only. |
| **A4** | `progression-mobile-ui-browser.cjs` iterates `movement.locator("button[data-move]")` and activates each direction (`:104`, actual `:307-317`) | `count() === 5` holds — no button is removed. `focus()` succeeds because the buttons are now `opacity: 1` rather than `opacity: 0` (strictly easier). Per-direction `Enter` follows A3. `data-defense-move === direction` for `N,W,IDLE,E,S`. |
| **A5** | `defense-survivor-browser.cjs` focus/hover on `[data-move="E"]`, `[data-move="W"]` (`:105`, actual `:410,433,547`) | `focus()`/`hover()` need a hit-testable box: the buttons become `pointer-events: auto` at every viewport, where previously they were `none` in coarse landscape. The held-movement contract (`:547-558`, hover W → `mouse.down()` → expect held `MOVE W`) is why §3.2 puts the `[data-move]` hit-test **first**: once §3.4 gives the pad a box at every viewport, `joystickActive()` is true wherever that press lands, and the un-reordered method would route it into the joystick branch and emit an octant derived from pad geometry instead of `W`. See Open risks R4 for the required landing order. `deepEqual` on `role`, `aria-label`, and the ordered five-button array (`:399-409`) holds by C2 and the §3.4 "no change" row. |
| **A6** | `step(run, octant, ticks)` queues a MOVE input with an octant vector (`:109`; `defense-stage-world-movement.test.mjs:29-31`) | Simulation-side, no DOM. This spec adds no simulation code and changes no payload shape (§1.1). `processInput`'s `typeof payload === "string" ? payload : payload?.octant` branch is untouched. |
| **A7** | Diagonal `NE` naive motion `x + v.x*speed/1000/TICK_RATE` (`:110`) | Same — integer-millis representation and `Math.trunc` path unchanged. HUD/CSS cannot reach it. |
| **A8** | Obstacle contact removes the inward component, slides tangent, clearance ≥ `radius − 1` (`:111`) | Same — collision resolution is simulation-side and untouched. |
| **A9** | "No explicit virtual joystick tests in the visible suite; joystick implementation lives in `battle-realtime-three.js`; tests assume the button/octant abstraction only" (`:113-114`) | **This one does not stay green, because it is false.** See §8.1. |

### 8.1 A9 is wrong, and it conceals the one test this cutover breaks

`[OBSERVED]` Two joystick tests exist, and the implementation is `app.js:2423-2491`
(`joystickActive`, `updateJoystick`, `resetJoystick`) — not `battle-realtime-three.js`, which
returned **zero** grep matches for `joystick` and for `data-move` this session.

| Test | Verdict under this spec |
|---|---|
| `progression-mobile-ui-browser.cjs:299-379` — "coarse-landscape joystick resolves eight octants and every cancellation path returns movement to IDLE" | **Stays green, unmodified.** It runs at `844×390` with `hasTouch: true`, where the pad is visible before and after. `display === "grid"` (`:305`) still holds. Button count 5 (`:308`) holds. Per-direction focus + `Enter` (`:309-317`) is strictly easier once the buttons are opaque and pointer-active. The eight-octant drag (`:326-334`) presses the pad **centre**, which C1 keeps clear of every `[data-move]` box, so §3.2's reorder finds no button and takes the joystick branch exactly as today. Dead-zone (`:336-340`), `pointercancel` / `lostpointercapture` (`:354-361`), blur (`:362-364`), and visibility-loss (`:366-374`) paths all go through the unmodified `onMoveControlEnd` / `resetJoystick`. |
| `progression-mobile-ui-browser.cjs:381-398` — "the joystick stays hidden outside coarse landscape": asserts `getComputedStyle([data-joystick]).display === "none"` for coarse-portrait **and** fine-pointer-landscape | **Breaks. Must be rewritten, and the rewrite is the point of the cycle.** |

This is an **intentional contract inversion, not a weakened assertion.** That test encodes the
gate the production brief item 8 exists to remove; keeping it would mean the cutover did not
happen. The replacement must be **at least as strong** — same two contexts, same strict
equality, opposite expectation, plus the two invariants that make the change safe:

```js
test("the joystick is the primary movement control at every viewport", async () => {
  for (const options of [
    { hasTouch: true,  viewport: PORTRAIT,         label: "coarse portrait" },
    { hasTouch: false, viewport: COARSE_LANDSCAPE, label: "fine-pointer landscape" },
    { hasTouch: false, viewport: { width: 1440, height: 900 },  label: "desktop pointer" },
    { hasTouch: false, viewport: { width: 1920, height: 1080 }, label: "wide desktop pointer" },
  ]) {
    const run = await openPage(options);
    try {
      await launch(run);
      const joystick = run.page.locator("[data-joystick]");
      // 1. present and laid out -- the inverted assertion
      assert.equal(await joystick.evaluate((n) => getComputedStyle(n).display), "grid",
        `${options.label} must expose the drag joystick`);
      const box = await joystick.boundingBox();
      assert.ok(box && box.width >= 44 && box.height >= 44,
        `${options.label} joystick must expose a reachable target`);
      // 2. the five controls survive as the accessible fallback -- retained strength
      const buttons = run.page.locator("#movement-actions button[data-move]");
      assert.equal(await buttons.count(), 5,
        `${options.label} must keep the five keyboard movement controls`);
      for (const direction of ["N", "W", "IDLE", "E", "S"]) {
        const button = run.page.locator(`#movement-actions button[data-move="${direction}"]`);
        const rect = await button.boundingBox();
        assert.ok(rect && rect.width >= 44 && rect.height >= 44,
          `${options.label} ${direction} must retain a 44px target`);
        await button.focus();
        assert.equal(await button.evaluate((n) => document.activeElement === n), true,
          `${options.label} ${direction} must stay keyboard focusable`);
      }
      // 3. NEW strength the old test could not have: the centre stays drag-only (spec C1)
      const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const hit = await run.page.evaluate(({ x, y }) =>
        document.elementFromPoint(x, y)?.closest("[data-move]")?.dataset.move ?? null, centre);
      assert.equal(hit, null,
        `${options.label} pad centre must be drag-only, no [data-move] may intercept it`);
      // 4. NEW strength: the JS predicate and the CSS visibility cannot disagree (spec §2.1)
      assert.equal(
        await run.page.evaluate(() => {
          const pad = document.querySelector("[data-joystick]");
          const r = pad.getBoundingClientRect();
          return getComputedStyle(pad).display !== "none" && r.width > 0 && r.height > 0;
        }),
        true, `${options.label} pad geometry must be measurable wherever it is displayed`);
      assert.deepEqual(run.errors, [], `${options.label} must not emit browser errors`);
    } finally {
      await run.context.close();
    }
  }
});
```

Net assertion count for that test rises from 2 per context × 2 contexts = 4, to
≥ 15 per context × 4 contexts. `map-tests.md:113-114` must be corrected in the same change so
the next reader is not told this test does not exist.

---

## Verification matrix

Each check names the concrete assertion and where it is measured. `[TARGET]` throughout — none
of this has been run.

| # | Check | Assertion | Measured in |
|---|---|---|---|
| 1 | joystick present, every viewport | `getComputedStyle("[data-joystick]").display === "grid"` at `390×844` coarse, `844×390` fine, `1440×900`, `1920×1080` | `tests/progression-mobile-ui-browser.cjs` — rewritten test, §8.1 |
| 2 | pad target size | `boundingBox().width ≥ 44 && height ≥ 44`; equals 116/116/144/160 px per §3.5 | same |
| 3 | five controls retained and focusable | `count("#movement-actions button[data-move]") === 5`; each `boundingBox` ≥44×44; each `focus()` leaves it `document.activeElement` | same |
| 4 | pad centre is drag-only (C1) | **GATE (v4 R22):** `elementFromPoint(padCentre).closest("[data-move]") === null`, at all four compositions. **WARNING, not a gate:** `min over the five buttons of (distance from pad centre to nearest edge) > padRadius × 0.22`; expected margins +1.24 / +1.24 / +12.16 / +18.40 px at 116/116/144/160 px. Report the warning form's margin in the measurement output so a future 1 px nudge is visible before it breaks the gate. | same |
| 5 | JS/CSS gate cannot desync (§2.1) | for the displayed pad, `rect.width > 0 && rect.height > 0`; and `joystickActive() === (display !== "none")` | same, plus a unit assertion on `joystickActive()` with a stubbed rect |
| 6 | eight octants still resolve | drag to `0.36 × box` in each of 8 vectors → `dataset.joystickDirection === dir` and `data-defense-move === dir` | `progression-mobile-ui-browser.cjs:326-334` (unmodified) |
| 7 | dead zone unchanged | drag `0.05 × width` → `data-joystick-direction === "IDLE"` | `progression-mobile-ui-browser.cjs:336-340` (unmodified) |
| 8 | every cancellation returns IDLE | `pointercancel`, `lostpointercapture`, window `blur`, `visibilitychange` each → `data-defense-move === "IDLE"` | `progression-mobile-ui-browser.cjs:342-374` (unmodified) |
| 9 | held-movement contract survives the reorder | hover `[data-move="W"]` → `mouse.down()` → `data-defense-move === "W"` held across a public simulation-second boundary | `defense-survivor-browser.cjs:547-583` (unmodified) |
| 10 | keyboard/Enter path intact | `Enter` on `#movement-actions [data-move="E"]` → `data-defense-move === "E"`, `inputSeq` advanced | `defense-phone-battle-hud-browser.test.cjs:494-495` (unmodified) |
| 11 | movement a11y contract byte-identical | `deepEqual` on `{role:"group", label:"한 손 이동 조작", buttons:[N,W,IDLE,E,S with labels]}` | `defense-survivor-browser.cjs:399-409` (unmodified) |
| 12 | canvas/movement still decoupled (D17) | canvas tap leaves `data-defense-input-seq` and `data-defense-move` unchanged; portrait canvas drag likewise | `defense-survivor-browser.cjs:442-455`; `defense-hud-responsive-browser.cjs:288-297` |
| 13 | five buttons rendered and visible, phone | `movementButtonCount === 5`; every `.defense-bottom button` `visible === true` and ≥44×44 and inside the viewport | `defense-phone-battle-hud-browser.test.cjs:313-320` at `390×844` and `320×568` |
| 14 | buff slots are not buttons | `#battle-buff-strip button` count `=== 0`; `bottom.querySelectorAll("button").length` unchanged by the strip | new assertion in `defense-phone-battle-hud-browser.test.cjs` |
| 15 | central clear band, A/B | `exposedHeight ≥ 180`; `exposedPoint.hitsSurface === true`; `hitsHud === false`. `[TARGET]` ≥190 at `844×390`, ≥330 at `390×844` | `defense-phone-battle-hud-browser.test.cjs:308-310` |
| 16 | central clear band, C/D | `exposedHeight ≥ 400`. `[TARGET]` ≥560 at `1440×900`, ≥700 at `1920×1080` | `defense-phone-battle-hud-browser.test.cjs:330`, extended with a `1920×1080` case |
| 17 | no horizontal overflow, all four | `scrollWidth ≤ clientWidth` (and `scrollHeight ≤ clientHeight` on phone) | `defense-phone-battle-hud-browser.test.cjs:321,331` |
| 18 | desktop top row order and non-overlap | `allShareOneRow === true`; `mission.left < runState.left < objective.left`; pairwise `right ≤ next.left + 1` | `defense-phone-battle-hud-browser.test.cjs:326-329` |
| 19 | phone zones never overlap | all ten pairs from `objective/health/movement/combat/actions` → `overlapArea ≤ 1` | `defense-phone-battle-hud-browser.test.cjs:261-279` |
| 20 | phone panels reflow, not side-by-side | `allShareOneRow === false`; every panel width ≥144 px; top band ≤ `0.38 × height` | `defense-phone-battle-hud-browser.test.cjs:282-307` |
| 21 | portrait safe-edge insets do not regress | `.defense-top` top 11 / right 17 / left 29; `.defense-bottom` bottom 23 / right 17 / left 29 | `defense-hud-responsive-browser.cjs` portrait contract |
| 22 | five locked viewports emit zero errors | `errors.deepEqual([])` at `390×844`, `360×800`, `844×390`, `667×375`, `2056×1082` | `defense-hud-responsive-browser.cjs:452-479` |
| 23 | buff strip reads the real structure | with `snapshot.buffs` absent → `#battle-buff-strip` has 0 children and no throw; with 6 entries → 6 `<li>` in ascending `buffId`; `data-ui-icon` equals `BUFF_ITEMS[itemId].iconId`; label seconds equal `Math.ceil((expiresAtTick − tick)/60)` | new browser probe: seed `snapshot.buffs` via a renderer-contract fixture, then read the DOM |
| 24 | buff strip order is stable while ticking | across 120 pumped frames the sequence of `data-buff-id` never permutes | same probe |
| 24a | rarity is hue-free and 4-tier | for each of `common`/`rare`/`resonant`/`relic`: `data-buff-rarity` set from `BUFF_ITEMS[itemId].rarity`; `border-width` ∈ {1,1,2,2} px in that order; computed `border-color` **identical across all four tiers** (proving no hue channel is used) | same probe |
| 24b | expiry accent fires on `TIMEOUT` only | dispatch `BUFF_EXPIRED` with each of `TIMEOUT`/`EVICTED`/`STAGE_TRANSITION`/`DEATH`: `data-buff-accent` appears only for `TIMEOUT`; the slot is removed in all four cases | same probe |
| 24b-1 | **the `reason` gate is conjunctive, and the silent form is detected** | dispatch the four foreign `reason` carriers from the blob — `PROJECTILE_EXPIRED{reason:"range"}`, `REWARD_SELECTION_DUPLICATE_IGNORED{reason:"REWARD_ALREADY_OWNED"}`, `EXTRACTION_REJECTED{reason:null}`, and the m4 fallback — and assert `data-buff-accent` never appears and no slot changes. **Then the positive half, which is what catches the silent failure:** a real `BUFF_EXPIRED{reason:"TIMEOUT"}` **must** set `data-buff-accent`. A bare `reason` lookup passes the negative half by luck (the value sets do not overlap) and fails only here — so the positive assertion is mandatory, not optional. | same probe |
| 24c | strip ignores `sourceDropId` | mutating `sourceDropId` between frames produces no DOM change and no re-render of the slot | same probe |
| 24d | pre-expiry fires once per buff, and audio shares the derivation | across 180 pumped frames a warned `buffId` triggers `signalBuffExpiring` **exactly once**, and `data-buff-warning="true"` appears on the **same frame** as that call — proving one comparison, two consumers | same probe, with `signalBuffExpiring` spied |
| 24e | audio hooks degrade, never throw | with `audio.setSurfaceResolver` and `audio.signalBuffExpiring` both `undefined`: zero page errors, strip still renders, `data-buff-warning` still set | same probe |
| 24f | warned-id Set resets | after `beginRun()` and after a stage remount, a reissued `buff-<n>` id warns again | same probe |
| 24g | **a refreshed buff warns AGAIN** | warn a buff (`remaining ≤ 180` → one `signalBuffExpiring`), then `BUFF_REFRESHED` pushes `expiresAtTick` back so `remaining > 180`, then let it decay again → a **SECOND** `signalBuffExpiring` for the same `buffId`. This is the regression the lifetime-ledger form would silently fail. | same probe |
| 24h | warned-id Set is bounded | after a buff recovers above threshold its id is **absent** from `warnedBuffIds`; across a run with repeated refreshes the Set size never exceeds the live warning count | same probe |
| 24i | hook 1 resolves the right module and cannot throw | `resolveSlabMaterial("cinder-span", 4000, 6000)` returns `"ash-drift"` (slab-01, `defense-catalog.js` `STAGE_SLABS`); a point outside every slab returns `null`; and with `defenseCatalog.slabMaterialAt` stubbed `undefined` the module graph still loads, `beginRun()` completes, the resolver returns `null`, and page errors are zero — proving the namespace form, not a named import from the wrong module | same probe |
| 25 | route rail binds authored waypoints | 4 `<li>`; `data-route-role` equals the authored roles in order; `#defense-battle-surface[data-route-waypoint]` equals the authored id for each of the three stages | new probe against `stage-world-catalog.js` route data |
| 25a | **rail state is a LEVEL read, and self-corrects** | set `snapshot.objectives.route.phase` directly to each of `"gate-defense"` (pre-encounter), both `order` ids, and `completed: true` — the rail renders the right `data-route-state` set **without any event being dispatched**. Then mount fresh at a mid-run phase: the rail is correct on the **first** frame. An edge-accumulating implementation fails the fresh-mount case. | new probe |
| 25b | **rail ignores the ~40 other `objectiveId` carriers** | dispatch `WAVE_CLEARED`, `GROWTH_OFFER`, `PICKUP_DENIED`, `OCCUPATION_CAPTURED`, `EXTRACTION_COMPLETED`, `OBJECTIVE_PHASE_CHANGED`, and `ENCOUNTER_PATH_CONTESTED` — all carry `objectiveId` in the blob — and assert every `data-route-state` is unchanged. Proves the rail reads `objectives.route`, not events. | same probe |
| 25c | `order` is never substituted for the rail | rail node count stays **4** while `objectives.route.order.length === 2`; `ingress` and `final-gate` remain present. Guards the endpoint-dropping mistake §5.1 names. | same probe |
| 26 | gimmick indicator never replaces a decal | with the gimmick's `x,y` inside the projected viewport, the edge arrow is absent; outside, present, 44×44, and `pointer-events: none` | new probe |
| 26a | gimmick chip matches the corrected corridor data | for each of the four deformation gimmicks, filled bars equal `round(after/before × 5)` → **3 / 4 / 3 / 3**; a second armed gimmick yields `+1` and never a second chip; `+2` never appears | new probe seeded from `design/stage-dungeon-composition-spec.md` |
| 26b | **armed lifetime tracks the payload, not a constant** | for one gimmick of each class (deformation 180, gate 120, mirror 90, hazard 60): `tickOf(chip clears) − tickOf(chip appears) === event.telegraphTicks` **exactly**, and the chip is gone by `TRIGGERED + 1`. A hardcoded 180 fails three of the four. Also assert the fallback: `telegraphTicks` absent or non-integer → lifetime 180, no throw. | same probe |
| 26c | **the chip can never depict an impassable lane** | for every gimmick carrying a corridor delta, `corridorWidthAfter > 720` (commander diameter, `[OBSERVED]` `COMMANDER.radius = 360` in the blob). Assert against the payload, not against a hardcoded 900 — the check must fail if a rebalance ever drops a band below the actor. | same probe |
| 26d | **`ENCOUNTER_PATH_CONTESTED` must not render a gimmick chip** | dispatch the real blob payload — `{ type: "ENCOUNTER_PATH_CONTESTED", entityId, routeId, waypointId, objectiveId, releaseAt, telegraphTicks: contestTicks }` (`git show 033877ad:defense-run-simulation.js:2290-2297`) — and assert `#battle-gimmick-state` stays absent and `data-gimmick-state` is unset. It carries **both** `telegraphTicks` and `objectiveId`, so a presence-keyed reader would render a plausible-looking chip for a route contest. Proves the `event.type` gate exists. | new probe |
| 27 | reduced motion keeps information | under `prefers-reduced-motion: reduce`: `transition`/`animation` = `none` on knob, active pip, warning slot, **accent slot**, gimmick chip; active pip diameter still 1.35×; seconds label still present; stack numeral still present | new assertion; suite already defaults to `reducedMotion: "reduce"` |
| 28 | focus order is DOM order | tab from `.gate-panel` → `N,W,IDLE,E,S` → `#manual-attack` → skills → `#battle-actions`; no element has `tabindex > 0`; `[data-joystick]` never receives focus | new probe |
| 29 | focused ring control is never occluded | after `focus()`, `elementFromPoint(centre of that button)` resolves to that button | new probe |
| 30 | stage accent switches without JS style writes | for each of three `data-stage-id` values, computed `--stage-accent` equals `#f3592c` / `#8f67ff` / `#72c8ff`; zero inline `style` attributes on `.hud-panel` | new probe |
| 31 | determinism untouched | `getRunDigest()` byte-identical to `qa/cycle9-digest-baseline.json` for a keyboard-only and a button-only seeded run | `defense-run-simulation.test.mjs` digest cases |
| 32 | HUD writes no simulation state | grep proof: no assignment to `snapshot.*`/`run.*` in the HUD render path | `defense-renderer-contract.test.mjs` |

---

## Open risks

| # | Risk | What it breaks, by name |
|---|---|---|
| R1 | **`progression-mobile-ui-browser.cjs:381-398` breaks by design.** It asserts `display === "none"` in coarse portrait and fine-pointer landscape — the exact gate being removed. | That test. Mitigation: the §8.1 rewrite, which raises the assertion count per context from 2 to ≥15 and adds the C1 and gate-desync checks. If a reviewer treats the rewrite as a weakening, the cutover cannot ship at all — the two are the same decision. `map-tests.md:113-114` must be corrected alongside it. |
| R2 | **`map-tests.md` §3 misleads.** A9 claims no joystick tests exist and points at the wrong file, so a reader relying on it would not know R1 is coming. | The discovery report's own credibility. This spec's §8.1 is the correction; the report should be amended in the same change. |
| R3 | **Making the ring pointer-active could steal a drag.** A press that lands on a ring control now resolves to that control, not to the stick. | `progression-mobile-ui-browser.cjs:326-334` (octant drags). Bounded by C1 — the drag test presses the pad centre, which no `[data-move]` may occupy. But a **player** starting a drag from the ring edge gets a discrete octant instead of an analog vector. `[TARGET]` accepted: the ring is 44 px of a 116–160 px pad and is labelled; a press on `↑` producing `N` is not a surprise. Check 4 is the guard. |
| R4 | **The held-movement contract is the fragile one, and the hazard is a landing ORDER, not a single change.** `defense-survivor-browser.cjs:547-583` hovers `W`, presses, and requires `MOVE W` held across a public simulation-second boundary. The break is specifically **§3.4 (CSS gives the pad a box everywhere) landing before §3.2 (hit-test reorder)**: at that instant `joystickActive()` is true at every viewport *and* the ring buttons are `pointer-events: auto`, so `onMoveControlDown` takes the joystick branch on a press that landed on `W` and emits a pad-geometry octant instead. Note the two other orders are safe: §3.1 alone leaves the pad boxless outside coarse landscape so the predicate stays false there; §3.2 alone is a no-op because the ring is still `pointer-events: none` wherever the pad has a box (§3.2 `[INFERENCE]`). | `defense-survivor-browser.cjs:547-583`. **Required order: §3.1 and §3.2 first or same commit, §3.4 never before §3.2.** Check 9. |
| R5 | **Composition A's vertical slack is thin — and unmeasured.** `[INFERENCE]` 390 − ≈86 top − 116 pad ≈ 188 px against the `exposedHeight ≥ 180` floor, i.e. ~8 px of margin. Both the 86 and the 188 are **derived from the CSS cascade, not measured** — the assignment's browser evidence covered 1440×900, not 844×390. Any panel growth in the 844×390 top band pushes it under. | `defense-phone-battle-hud-browser.test.cjs:308`. Mitigations: top band `[TARGET]` trimmed to ≤78 px, and the buff strip placed **inside** `.gate-panel` where A's row height is already `max(116, gate)` so the strip adds zero band height (§5.3). Check 15 is the measurement; treat 188 as a hypothesis until it runs. |
| R6 | **Buff slots as `<button>` would fail two phone assertions at once** — every `.defense-bottom` button must be `visible` and ≥44×44, and 26–36 px readout chips are neither. | `defense-phone-battle-hud-browser.test.cjs:315-319`. Blocking requirement in §5.3: `<li>`/`<span>` only. Check 14. |
| R7 | **`aria-hidden` removal on `[data-joystick]`** adds a `role="application"` node to the battle a11y tree, which `hud-information-architecture.md` §7 otherwise keeps quiet. | `defense-survivor-browser.cjs:383-398` reads `#defense-battle-surface` a11y attributes; it does not enumerate descendants, so it should hold — `[INFERENCE]`, must be measured. The node carries no live region, so it cannot add announcement noise. Check 28. |
| R8 | **Conditional presence of `snapshot.buffs`.** `DropBuffSystem` emits it only when `run.buffs.length > 0`, so a HUD reading `snapshot.buffs.length` throws on every pre-drop frame — which is every frame of every existing digest fixture. | Every browser test that launches a run. Mitigation: `snapshot.buffs ?? []` is a blocking requirement in §5.3. Check 23 exercises the absent case first. |
| R9 | **Entry field names arrived through three rulings.** v1 said `defId`/`maxIntegrity`/`cooldownScale`/`appliedAt`; v2 R7 rejected `defId`; v3 R16/R17/R18 settled on `itemId`, the 7-value `stat` enum, and `appliedAtTick`/`expiresAtTick`. A stale reader may implement the v1 names. | `#battle-buff-strip` would resolve `BUFF_ITEMS[undefined]` and render six empty slots. Mitigation: §5.3 states the final 8-field shape once and cites the ruling per field; the strip keys its icon off `iconId` and never off `stat`, and treats unknown `stat` values as the neutral group — so a further enum change cannot break it. |
| R10 | **`--stage-accent` collides with `--abyss-tint-color`.** `[OBSERVED]` `styles.css:409-412` already tints the surface per abyss depth (`ember`/`frost`/`veil`). At depth > 0 on `cinder-span`, ember tint and ember accent stack and the accent stops reading as emphasis. | No named test. `[TARGET]` cap of ≤3 accent-tinted elements (§6.2) plus the rule that the accent never touches panel backgrounds. Needs a human look at each depth × stage pair; check 30 verifies the token value, not the perceptual result. |
| R11 | **New 1600 px breakpoint is unmeasured.** The five locked viewports in `defense-hud-responsive-browser.cjs:13` top out at `2056×1082`, which **does** match `min-width: 1600px` — so composition D is exercised there today, but 1920×1080 specifically is not in any suite. | `defense-hud-responsive-browser.cjs:452-479` covers 2056 but not 1920. Check 16 adds the 1920 case. Until it runs, every D number is `[TARGET]`. |
| R12 | **Pad/knob ratio is a silent coupling.** `maxTravel = radius − knobRadius` (`app.js:2454`) is the analog resolution denominator, and nothing in code links `--pad-size` to `--knob-size`. A future CSS-only knob change alters movement feel with no test failing — the same class of hidden coupling `core-loop-legion-spec.md` §4 flags between `JOYSTICK_DEAD_ZONE_RATIO` and `MOVE_EPSILON`. | Nothing named. Mitigation: §3.5 pins the ratio to 0.375–0.39 and requires the constraint to be written as a comment where both tokens are declared. A ratio assertion in the suite would be stronger and is recommended. |
| R12a | **`BUFF_WARN_TICKS` is no longer mine alone.** It was documented presentation-only by this spec *and* by `DropBuffSystem`; `audio-feedback-dungeon-spec.md` §7.2 then bound `signalBuffExpiring(buffId)` to the same derivation. Changing 180 now silently changes audio sting timing. | Nothing named — this is a cross-lane coupling with no test that spans both. Mitigation: §5.3a states it where the constant is declared, and there is exactly **one** comparison feeding both consumers, so they cannot disagree. Check 24d asserts the same-frame property. A second copy of the number in the audio lane would be the defect; the shared derivation is the fix. |
| R12b | **CLOSED (v9 R38).** Two `app.js` hooks are authored by `AudioFeedbackDesign` but live in this spec's file. Hook 1 was blocked while `slabMaterialAt` did not exist and was twice proposed against the wrong module; it is now exported from `defense-catalog.js:332` and `app.js:53` already namespace-imports that module, so it needs **no new import**. | Both hooks landed or landable. Residual: the `typeof` guard is retained per R38 even though the export now exists, so the line survives a future move of the symbol; a named import from `stage-world-catalog.js` would blank the app at load and must never be used (§5.3a records both rejected forms). Check 24i. |
| R12c | **A one-shot warning is the wrong default under refresh, and this spec shipped it wrong once.** The first form of §5.3a held warned ids permanently. `BUFF_REFRESHED` extends `expiresAtTick`, so a buff approaches expiry more than once per lifetime and a permanent ledger silences every approach after the first — silent, and no existing test covers it. Caught by `UiJoystickImpl` in implementation, not by me in design. | Fixed to an edge detector (add on rising edge, delete on falling). Checks **24g** (a refreshed buff must warn again) and **24h** (Set stays bounded) are the regression guards. Generalise the lesson: any "fire once" flag over a value that can move **away** from its threshold needs a reset branch, not a ledger. |
| R13 | **CLOSED, with two corrections folded in.** §5.2 carries `DungeonLevelDesign`'s data: 4 deformation gimmicks, corridors **1400→900 / 1400→1000 / 1400→900 / 1400→900**, bars **3/4/3/3**, max 1 deformation and 2 total armed per stage, one `GIMMICK_TRIGGERED` per tick with a no-RNG `order` tiebreak. Two things I had wrong: (a) `telegraphTicks` is **not** a flat 180 — four tiers 180/120/90/60, and 180 is right for only 4 of 13 gimmicks (v6 C2); (b) I repeated a `corridorWidthAfter ≥ 600` floor as proof the lane stays passable when **600 < the 720 commander diameter**, so that floor proved the opposite (v8, `DungeonLevelDesign`'s catch). | `#battle-gimmick-state`. Bars compute from the payload and lifetime reads `event.telegraphTicks`, so a rebalance changes rendering with no code change. Checks 26a, **26b**, **26c** — 26c asserts `corridorWidthAfter > 720` against the payload rather than a hardcoded 900, so it fails loudly if a future rebalance drops a band below the actor again. |
| R13a | **`BUFF_WARN_TICKS = 180` and the deformation telegraph tier of 180 are numerically identical and semantically unrelated.** One is my presentation threshold for buff pre-expiry; the other is `DungeonLevelDesign`'s deformation reaction window. A reader who notices the coincidence may "unify" them into one constant, coupling the buff strip to gimmick rebalancing. | Nothing named — a merge-time readability hazard, not a runtime one. Mitigation: the two must never share a symbol, and neither may be expressed in terms of the other. §5.2's lifetime reads `event.telegraphTicks` from the payload; §5.3a's threshold is a local constant. They cannot converge as long as one is read and the other is declared. |
| R13b | **`telegraphTicks` and `objectiveId` are NOT unique to the gimmick family.** `[OBSERVED]` `ENCOUNTER_PATH_CONTESTED` (`git show 033877ad:defense-run-simulation.js:2290-2297`) carries **both** — `telegraphTicks: contestTicks` meaning something else entirely, and it is the *only* `telegraphTicks` occurrence in the blob. Any reader keyed on field presence renders a plausible gimmick chip, with a plausible label and lifetime, for a route contest that has no gimmick. Reported by `AudioFeedbackDesign`; the `objectiveId` half is my own addition. | `#battle-gimmick-state`. Mitigation: §5.2 mandates an `event.type` allow-set gated **before any field read**, and forbids a shared cross-family "telegraph reader" helper. Check **26d** dispatches the real blob payload and asserts the chip stays absent. `[INFERENCE]` the same exposure applies to `RendererVfxImpl`'s 10 `telegraphTicks` read sites and to any audio cue keyed the same way — flagged to both lanes. |
| R13c | **The route rail originally read the wrong kind of thing, and I found it by auditing my own readouts after a peer's finding.** §5.1 advanced on `ENCOUNTER_OBJECTIVE_COMPLETED` — edge accumulation. That cannot self-correct (one missed event and the rail is wrong for the whole run, with no path back to truth) and it sits inside the `objectiveId` collision class: `[OBSERVED]` ~**40** event types in the blob carry that field. Superseded by a level read of `snapshot.objectives.route`, which the simulation already publishes (`:3448-3456`, serialized at `:3544`). | `#battle-route-rail`. The collision class is now designed out rather than guarded — the rail touches no event. Checks **25a** (level read + correct on first frame after a fresh mid-run mount), **25b** (7 other `objectiveId` carriers leave it unchanged), **25c** (`order` is never substituted, since it holds **2** encounter ids while the rail has 4 authored nodes and swapping it would silently drop `ingress` and `final-gate`). |
| R13d | **`reason` is the worst of the three field collisions, because it fails SILENTLY.** `[OBSERVED]` four incompatible vocabularies across six emit sites in the blob — lowercase (`:1740`), SCREAMING (`:2018`, `:2044`), dynamic (`:2082`, `:2195`), and **`null`** (`:2204`). My strip gates its expiry accent on `reason === "TIMEOUT"`. Because the value sets do not overlap today, a bare `reason` gate throws nothing, logs nothing, and renders nothing wrong — **it just never fires**, which is invisible in review and in a passing negative test. Reported by `DropBuffSystem`, sharpened by `AudioFeedbackDesign` (two `reason`-carrying events already have audio policies, so they are reachable); the `null` verified here. | `#battle-buff-strip` expiry accent. Mitigation: §5.3 mandates the conjunctive form `event.type === "BUFF_EXPIRED" && event.reason === "TIMEOUT"` and forbids any `reason`-keyed table. Check **24b-1** is built specifically to catch the silent form: its negative half passes by luck under a bare lookup, so the **positive** assertion (`TIMEOUT` must set `data-buff-accent`) is the one that fails. Contrast `telegraphTicks`, which fails loudly — silence is the mode that ships. |
| R14 | **Route rail assumes a 4-waypoint critical route.** `[OBSERVED]` true for all three stages today and enforced at `stage-world-catalog.js:448-450` (≥2 intermediates + canonical gate) — but that validator permits **more** than four. A 5-waypoint dungeon would overflow a fixed 4-node rail. | `stage-world-quest-points.test.mjs:179-222` freezes the current topology, so a 5th waypoint would fail there first and surface the rail as a follow-up rather than as a silent clip. Recommend the rail render `waypoints.length` nodes and cap the label row at 4. |
| R15 | **This spec is design only from my side, but implementation has begun.** I have made no `app.js`, `styles.css`, or `tests/**` change, and I ran no test — so every number here is `[TARGET]` and no gate moves on my evidence. `UiJoystickImpl` reports §3.1/§3.2 and audio hook 2 landed in the implementation tree; those are **their** measurements to report, not mine, and I have not verified them. | G4 and G8 both require human play adjudication (`battle-hud-concept-cycle9.md` §8); no automated result substitutes for it. The **60-check** matrix names the measuring file per check; none has been run under the Director's test freeze. |
