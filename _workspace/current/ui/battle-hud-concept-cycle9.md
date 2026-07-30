# Battle HUD concept — cycle 9

owner: ui-senior-developer
gate inputs: G4 (몰입/접근성), G8 (최초 노출)
status: `[TARGET]` design contract. No render, no capture, no measurement yet.

---

## 0. Routing disclosure — read this before citing this document

The operator requested `open-design-game-ui-concept` and its sibling
handoff/takeover skills. That skill's generation loop **cannot run in this
environment**. Verified:

| Requirement | Observed state |
|---|---|
| `nexu-io/Open Design` app on `127.0.0.1:5173` | `curl` → HTTP `000`, not running |
| `docs/hard-rules/ui-adaptation-upgrade-only-contract.md` | absent from this repo |
| Codex run pinned to `gpt-5.6-sol` + `ultra` reasoning | not available in-session |
| Skill's capture script expectation | traverses for Darkbone's **five character rigs** |
| Skill's target identity | **Darkbone Archer** — pharaonic stone-gothic, bone-gilt/soul-teal, Wedjat eyes, six meta screens |

The skill is bound to a **different game**. Its six-screen meta-UI shape (Home /
Map Select / Talent / Masks / Fusion / Victory) is not this game's surface set,
and its visual language is not this game's identity.

**What this document is**: the skill's *transferable discipline* — per-screen
player-job table, viewport-specific compositions, player-lens review order,
per-component authority matrix, and its quality gate — applied to Abyssal
Lantern's own identity.

**What this document is not**: an Open Design artifact. There is no project id,
no run id, no `revisionId`, no artifact SHA-256, no preview manifest, and no
`.handoff/` zip. None were produced and none are cited. A later session with the
Open Design app actually running may supersede this with a real artifact.

---

## 1. Surface scope

This cycle touches the **in-battle HUD only**. The lobby command decks and sortie
flow are out of scope — PR #10 just stabilized them and the landscape CTA position
is a browser-contract dependency.

Architecture constraint, from discovery: the battle HUD is **not** lobby-style
decks. Lobby decks are cleared when the run starts; the battle HUD is a
**world-space DOM overlay** positioned via `RealtimeBattle.projectEntityToScreen()`
(`app.js:1873-1883`), with pure-shape anchors staying Canvas2D-only.

---

## 2. Player-job table

The job each element must answer within a three-second read.

| Element | The player must know instantly | Priority |
|---|---|---|
| Wave state | Which wave, how much of it is left | 1 |
| Objective | What the current phase demands of me | 1 |
| **Extraction capability** | *Can I extract yet?* — the midboss gate | 1 (new) |
| **Legion count vs capacity** | `4/6` — am I full, can I take another | 1 (new) |
| Commander integrity | Am I about to die | 1 |
| **Extraction channel** | Is my 2 s channel progressing, and is it contested | 2 (new) |
| **Extractable corpse** | That body is a recruit, and it expires in 10 s | 2 (new) |
| Skill readiness | What can I fire now | 2 |
| Damage feedback | Did that hit, and how hard | 2 |
| Gate integrity | Is the thing I defend failing | 3 |

Rows marked *(new)* are state the simulation begins exposing this cycle. They are
the reason the HUD changes at all — every one of them is a decision the player
cannot currently make because the information does not exist on screen.

---

## 3. What the reference contributes, and where it stops

From `intake/reference-video-analysis.md`, ranked by evidential strength:

**Adopt**
- Player pinned to a stable screen anchor ≈(50 %, 49 %) — [OBSERVED] pixel-stable
- Actors small (≈7 % viewport height); legibility from over-head label + ground
  ring, **not** from scale
- Discrete numbered wave nodes over a fixed dungeon layout — [OBSERVED]
- Damage numbers as the primary feedback channel: stacked, size- and colour-tiered
- Automation state shown *adjacent to the character*, not on a HUD rail
- Bottom-centre round pedestal for the stick — [INFERENCE], partly occluded in capture

**Reject**
- The reference's four-sided HUD density. It frames combat into a small centre
  window because it must host an idle-game's feature surface (passes, events,
  gacha). This game has no such surface and would only lose play area.
- Its number magnitudes (`5.54B`). Idle-game inflation, not our economy.

**Not supported by the reference at all** — our own design, must stand on its own:
extraction, legion capacity, aim targeting, per-character patterns. The capture
contains no extraction mechanic, no capacity UI, no aim reticle, and no midboss
beat. Do not appeal to the video for these.

---

## 4. Compositions per viewport — distinct, not scaled

Viewports are the ones already locked by
`tests/defense-hud-responsive-browser.cjs`.

| Viewport | Composition intent |
|---|---|
| `390×844` portrait | Vertical budget is scarce. Wave/objective in one packed top line (PR #10's win — keep). Stick on the bottom-centre pedestal. Legion `n/cap` adjacent to the stick, reachable by thumb. |
| `360×800` portrait | Same composition, tighter insets. No new breakpoint. |
| `844×390` landscape | Height is the constraint. Top line stays single-row; **CTA must not move** (browser-contract dependency). Stick bottom-left, skills bottom-right. |
| `667×375` landscape | Same as above, denser. |
| `2056×1082` desktop | Use the width for simultaneous context. Do **not** merely enlarge phone spacing. Legion roster may expand from a count to named slots; extraction state gets a dedicated readout. |

Portrait safe-edge insets are locked and must not regress:
`.defense-top` → top 11 px, right 17 px, left 29 px;
`.defense-bottom` → bottom 23 px, right 17 px, left 29 px.

---

## 5. Component authority matrix

Runtime is the default owner. Data is **always** runtime-owned.

| Component | Layout | Identity | Motion | Interaction | Copy | Data |
|---|---|---|---|---|---|---|
| Top wave/objective line | concept | runtime | runtime | runtime | runtime | runtime |
| Legion count vs capacity | concept | concept | runtime | runtime | runtime | runtime |
| Extraction capability badge | concept | concept | concept | runtime | runtime | runtime |
| Extraction channel meter | concept | concept | concept | runtime | runtime | runtime |
| Corpse marker | runtime | concept | concept | runtime | — | runtime |
| Joystick pedestal | concept | concept | concept | runtime | — | runtime |
| Damage numbers | runtime | concept | runtime | — | — | runtime |
| Range ring | runtime | concept | runtime | — | — | runtime |
| Growth/reward modal | **runtime (frozen)** | runtime | runtime | runtime | runtime | runtime |
| Skill buttons | runtime | runtime | runtime | runtime | runtime | runtime |

The growth/reward modal is **frozen**: PR #10 just centred it with a scrim off the
top HUD band, and it pauses the simulation. Do not restyle it this cycle.

Omission means **preserve runtime**, never "replace with a static placeholder".
Any component whose motion column says `runtime` keeps its current animation and
timing exactly.

---

## 6. New-state presentation contracts

### Extraction capability (the midboss gate)

Three distinct states, visually distinguishable without copy:

| State | Condition | Treatment |
|---|---|---|
| Locked | `!extractionUnlocked` | badge absent or clearly dormant — must not read as a broken/disabled button |
| Unlocked | `extractionUnlocked` | one-shot arrival moment, then a persistent calm affordance |
| Actionable | extractable corpse within `EXTRACTION_RANGE` (1200) | corpse marker + proximity emphasis |

The unlock is a **capability gained mid-run**. It deserves one orchestrated
arrival beat, then silence — a permanently pulsing badge would compete with
combat for attention for the rest of the run.

### Extraction channel

- 2 s (120 tick) fill, `EXTRACTION_CHANNEL_TICKS`
- Channel **breaks** on leaving range and does not resume from partial progress
  (spec §2) — so the meter must **visibly reset**, not pause. A meter that appears
  to hold progress would misrepresent the rule and teach the player something false.
- Contested state must be distinguishable from out-of-range: different failure
  causes, different player responses.

### Legion count vs capacity

- Render as `current/capacity`, both numbers live — capacity is now dynamic (3→10)
- At capacity, extraction affordances must read as unavailable **for that reason**,
  distinct from the midboss lock. Two different "no" states, two different displays.

### Corpse expiry

Corpses live 600 ticks (10 s). The marker must convey remaining time — a recruit
that vanishes with no warning is a feel-bug, not a difficulty feature.

---

## 7. Quality gate

Adapted from the open-design gate. Reject the concept if any holds:

- The three-second read fails: wave, objective, extraction availability, or legion
  capacity is not immediately locatable
- Any surface reads as a generic web/SaaS dashboard — flat rounded-rect cards,
  bootstrap hues, bare left-aligned headings, plain `#fff` text
- Desktop merely enlarges phone spacing instead of using width for simultaneous context
- Any actionable target is below **44×44 CSS px**
- Any viewport overflows, or actionable controls overlap
- Portrait safe-edge insets regress, or the landscape CTA moves
- A live animation is replaced by a static placeholder
- The extraction-locked state reads as a bug rather than as a locked capability
- The channel meter appears to pause rather than reset on break
- Console or page errors during the captured flow

## 8. Verification required before any G4 claim

- `node tests/defense-hud-responsive-browser.cjs` green, with **no assertion weakened**
- Real-browser capture at each of the five locked viewports
- Zero console errors, zero page errors
- Human play adjudication — G4 immersion is a scored human judgment (median ≥4.0/5)
  and **no automated result substitutes for it**

Nothing in this document is a measurement. It sets targets and names the gate a
later measurement must clear.
