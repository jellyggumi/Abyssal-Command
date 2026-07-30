# Reference video analysis — Korean idle-ARPG combat feel

run-id: `20260728-onslaught-action-pivot`
cycle: 9 (게임 흐름 개선 — 조작·추출·군단·연출)
source: `/Users/jangyoung/Desktop/화면 기록 2026-07-30 오후 9.42.27.mov`
capture: QuickTime/MOV, H.264, `com.apple.quicktime.author = ReplayKitRecording`
duration: 19.4967 s, 965 frames, recording canvas 860×1626

> This document is **reference decode only**. Every number here describes the
> reference video, not Abyssal Lantern. Nothing in this file is a measurement of
> our build and nothing here is a gate result.

---

## 1. Provenance and method

| Item | Value |
|---|---|
| Recording canvas | 860 × 1626 [OBSERVED] `ffprobe` |
| Game viewport inside canvas | **636 × 1402** at offset (112, 76) [OBSERVED] |
| Viewport aspect | 1402 / 636 = **2.204** [OBSERVED] |
| Frame decode | `ffmpeg -ss <t> -frames:v 1 -f rawvideo -pix_fmt rgb24` into numpy |

The recording embeds the phone screen inside a device bezel, so the outer
860×1626 is **not** the game viewport. All ratios below are computed against the
inner 636×1402 viewport. Using the outer canvas would understate every ratio by
~14 % horizontally and ~13 % vertically; that error is why the bounds were
detected rather than assumed.

The title is not identified in the capture. Treat it as an unnamed
Korean idle-ARPG in the Legend-of-Slime presentation family. [INFERENCE]

---

## 2. The one hard measurement: the camera is a locked follow-cam

The player's HP bar (directly under the `Lv.916` label) was located by an
RGB mask (`g>170`, `g−r>60`, `g−b>60`) restricted to the central combat band,
then reduced to its modal row.

| t (s) | bar centroid x | bar row y | bar width px |
|---|---|---|---|
| 3 | 318.33 | 688 | 58 |
| 4 | 318.44 | 688 | 58 |
| 5 | 318.39 | 688 | 58 |
| 7 | 318.39 | 688 | 58 |
| 8 | 318.87 | 688 | 58 |

[OBSERVED] **The anchor row is pixel-identical (688) at every sample, and x
varies by 0.54 px total** while the player is moving and the world is scrolling
underneath.

Derived anchor, viewport-relative:

| Quantity | Value |
|---|---|
| Anchor X | 318.4 / 636 = **50.1 %** (dead centre) |
| Anchor Y | 688 / 1402 = **49.1 %** |

### Why this matters

A sub-pixel-stable anchor across 5 s of movement means the reference camera is
**hard-locked to the player**, not damped. There is no spring, no lookahead
lead, and no dead-zone box — if any of those existed, the anchor would oscillate
by tens of pixels during direction changes. The world moves; the actor does not.

This is a directly implementable target: pin the actor to (50 %, 49 %) of the
battle viewport and translate the world beneath it.

`[TARGET]` for our build: a follow-cam whose anchor error stays within a few px
during sustained movement. Our current camera is a fixed/per-stage envelope
focused on the commander, which is a different behaviour — see
`local://discovery-controls-camera.md` for the code seam.

### Anchor is above centre, not at centre

49.1 % vertical with a 2.204 aspect viewport puts roughly **51 % of the play
area ahead of (below) the actor and 49 % behind**. Combined with the isometric
tilt, the visible ground area in front of the character is larger than behind —
the framing biases toward approaching threats. [INFERENCE]

---

## 3. Actor scale and proportion

Measured from native-resolution crops around the anchor.

| Quantity | Value | Basis |
|---|---|---|
| Player silhouette height | ≈ 95 px | crop inspection at t≈17 s |
| As fraction of viewport height | 95 / 1402 ≈ **6.8 %** | derived |
| Head-to-body proportion | ≈ **2 heads tall** (chibi) | visual [INFERENCE] |
| Legion unit height | same as player, within ~10 % | visual [INFERENCE] |
| Enemy (trash) height | comparable to player; some elites 1.5–2× | visual [INFERENCE] |

The actor occupies well under a tenth of screen height. The reference does
**not** frame a hero large in screen; it frames a **crowd**, and reads the
player out of that crowd by UI (the `Lv.` label + HP bar riding above the head)
rather than by size. That is the load-bearing insight for our proportion pass:
scale is not how the reference achieves player legibility.

`[TARGET]` implication: if we enlarge the player mesh to make it readable, we
copy the wrong solution. Readability should come from the over-head label, the
ground ring, and silhouette contrast.

---

## 4. Ground range ring — present, diameter not reliably measured

An always-on thin ground ring is centred on the actor in every combat frame
[OBSERVED, visual].

A row-band scan through the ground plane produced diameters of 117–406 px across
samples, i.e. **noise, not a measurement** — the band is polluted by fire VFX,
coin sprites and damage numbers crossing the same rows. Recorded here as a
negative result rather than a fabricated figure.

Visual estimate only: diameter ≈ 60–65 % of viewport width, i.e. radius ≈ 4.5×
the actor's silhouette height. `[INFERENCE]` Do not cite this as measured. If a
precise value is needed, isolate the ring by temporal median across frames where
VFX are absent.

The ring is drawn as a **thin, low-opacity dashed/solid circle on the ground
plane**, under all actors and over the floor texture. It never occludes
characters.

---

## 5. Combat presentation stack

Layer order observed from the floor up:

1. Floor texture / tiles
2. **Ground decals**: the persistent range ring, plus transient radial impact
   glows (red/orange) under the cluster during attacks
3. Coins and pickups scattered on the ground
4. Actors: player, legion units (3–5 visible), enemies
5. **Vertical light spears** — thin yellow/red columns rising from impact
   points, the dominant "big hit" tell
6. Radial burst flashes, embers, slash arcs
7. **Damage numbers** — the loudest layer
8. Screen-fixed HUD

### Damage numbers

- Stacked and overlapping, several concurrent, deliberately not de-conflicted
- Size varies by magnitude/crit tier; larger for bigger hits
- Colour tiers: white/yellow for normal, orange/red for crit or elite damage
- Rendered with heavy outline + drop shadow for legibility over bright VFX
- Values in the B/M range (`5.54B`, `365M`, `2.11B`, `59.2K`) — idle-game
  number inflation, not our scale
- Float upward and fade; lifetime short enough that the screen never fully
  clears during sustained combat

The reference treats damage numbers as the primary feedback channel and accepts
visual clutter to get it. `[INFERENCE]` Our transient VFX pool cap of 24 is a
different design posture — see `local://discovery-hud-vfx.md`.

---

## 6. Legion behaviour in the reference

- 3–5 allied units cluster tightly around the player [OBSERVED, visual]
- They hold a loose cluster, not a rigid formation, and follow the player
  continuously
- They engage nearby enemies without player input
- Same visual scale as the player; distinguished by colour (gold/amber vs the
  player's white/cyan) rather than size
- No per-unit UI (no individual HP bars) — the crowd is read as one mass

This matches our design direction (companions auto-follow, `FORMATION_STANCES`
deprecated) rather than contradicting it.

---

## 7. Control surface

- **Bottom-centre radial pedestal**: a circular control base with a dial ring.
  In this capture it is largely occupied by a loot/chest widget, so the
  joystick's resting appearance is partly obscured. What is visible is a
  **round pedestal footprint with a rotating outer dial**, consistent with a
  virtual analog stick rather than a d-pad or discrete buttons. [INFERENCE]
- **Auto-hunt toggle** (`자동 사냥`) sits directly beneath the actor, in world-
  adjacent screen space rather than on the HUD rail — the automation state is
  presented as a property of the character, not of the interface.
- **Left rail**: a vertical stack of ~8 icon buttons (events, passes, shop,
  quests), each with its own badge/timer.
- **Top band**: currency/resource strip, then a second row of feature buttons.
- **Right edge**: floating event buttons with notification dots.
- **Bottom action row**: 5 large squarish buttons (upgrade, weapon, inventory
  ×10, two shop/gacha entries).

Overall the HUD is dense and frames the play area on all four sides, leaving a
roughly centre-screen combat window. The play area is never full-bleed.

---

## 8. Wave and stage structure

Frame at t ≈ 14 s shows a **chapter/wave node map** overlay (`챕터 3 침공당한 도시`):

- A horizontal strip of **7 numbered wave nodes** with progress ticks
- Cleared nodes carry a check/tick, the current node is highlighted, later nodes
  are locked
- The map view shows per-node level requirements (`Lv.400`, `Lv.390`, `Lv.360`,
  `Lv.330`, `Lv.260`, `Lv.230`) placed on a spatial dungeon layout
- Left/right arrows page between chapters
- A countdown timer (`08:13`) is visible on the map

[OBSERVED] Waves are **discrete, numbered, ordered, and individually gated by a
level requirement**, and progression is presented spatially over a fixed dungeon
layout — not as an endless timer-only survival stream.

This is directly relevant: our target loop is "fixed dungeon → enemy waves →
clear waves → extraction unlocked from the midboss onward". The reference
validates the *discrete numbered wave node* presentation for that loop. It does
**not** show an extraction mechanic; extraction is our own design and has no
reference support in this capture.

---

## 9. What this capture does NOT show

Stated explicitly so later work does not over-claim reference backing:

- **No extraction / recruit-from-corpse mechanic** anywhere in the 19 s
- **No legion capacity UI**, no slot count, no 3→10 cap, no slot-unlock purchase
- **No aim-based targeting** — the visible mode is `자동 사냥` (auto-hunt);
  a manual aim cone or aim-driven target pick is never demonstrated
- **No midboss beat** — no boss encounter occurs in the capture
- **No character-specific attack-pattern variation** — only one player character
  is shown
- **No skill-cast UI** — no skill buttons are pressed on camera

Therefore the reference constrains **camera, actor scale, VFX density, damage-
number treatment, wave-node presentation, and control-surface layout**. It does
not constrain extraction, legion capacity, aim targeting, or per-character
patterns. Those four remain our own design and must be justified on their own
terms, not by appeal to this video.

---

## 10. Extracted transferable targets

Ranked by evidential strength.

| # | Target | Strength |
|---|---|---|
| 1 | Lock the battle camera to a player anchor at ≈(50 %, 49 %) of the viewport, world-translating beneath | [OBSERVED] pixel-stable |
| 2 | Keep actors small (≈7 % of viewport height); achieve player legibility via over-head label + ground ring, not scale | [OBSERVED] size, [INFERENCE] intent |
| 3 | Present waves as discrete numbered, ordered, individually gated nodes over a fixed dungeon layout | [OBSERVED] |
| 4 | Persistent thin ground range ring centred on the actor, under all actors | [OBSERVED] presence, [INFERENCE] dimension |
| 5 | Damage numbers as the primary feedback channel: stacked, size- and colour-tiered by magnitude, outlined | [OBSERVED] |
| 6 | Vertical light-spear columns as the signature big-hit tell | [OBSERVED] |
| 7 | Legion as an unindividuated cluster: no per-unit HP bars, colour-distinguished, auto-engaging | [OBSERVED] |
| 8 | Bottom-centre radial pedestal for the analog stick | [INFERENCE] |
| 9 | Automation state presented adjacent to the character, not on the HUD rail | [OBSERVED] placement |

## 11. Reproduction commands

```bash
# viewport bounds + anchor measurement (numpy, no PIL dependency)
ffmpeg -v error -ss <t> -i "<source.mov>" -frames:v 1 \
  -f rawvideo -pix_fmt rgb24 - | # reshape to (1626, 860, 3)

# contact-sheet frames used for visual claims
ffmpeg -v error -i "<source.mov>" -vf "fps=1,scale=430:-1" -q:v 3 tmp/ref-video-frames/f_%02d.jpg
ffmpeg -v error -i "<source.mov>" -vf "fps=2,scale=860:-1,crop=700:520:80:560" -q:v 2 tmp/ref-video-frames/act_%03d.jpg
```

Frames are scratch under `tmp/` and are not committed. The source `.mov` lives
outside the repository on the operator's Desktop and is not vendored.
