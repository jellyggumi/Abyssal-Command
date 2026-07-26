# Context

## Workflow Context

The defense-survivor / roguelite-survivor space converged hard on one blueprint after
Vampire Survivors: a single protagonist, auto-resolved attacks, movement as the only
continuous input, XP pickups feeding a level-up choice card, and a fixed top-down camera.
Player agency lives almost entirely in two places — **where you stand** and **which
upgrade you pick**. Everything else is delegated to the simulation.

The mobile defense/4X wing (Kingshot, Whiteout Survival) reaches similar auto-resolution
from the other direction: combat is resolved server-side or off-screen entirely, and
agency moves *earlier* in the funnel — into pre-battle composition (troop ratios, hero
slotting, formation presets). The player never touches the fight; they touch the loadout.

Abyssal Command sits between the two and takes an option neither wing offers: a
**player-controlled squad whose spatial posture is switchable during the fight**. That is
the structural reason this survey exists — the build is not a straight clone of either
wing, so neither wing's convention set can be assumed to cover it.

## Affected Users

- **Survivor-genre players (PC/Steam)** arrive expecting fixed camera, one character,
  and readability above all. A free-orbit camera and a 3-unit squad both violate learned
  expectations; whether that reads as depth or as friction is exactly what G8's impression
  half is supposed to answer, and has not been answered.
- **Mobile defense/4X players** arrive expecting formation to be a pre-battle screen and
  companions to arrive from a gacha. Elite-capture reframes acquisition as an in-run
  earned event, which is a genuinely different promise.
- **The design lane** needs to know which element to defend under scope pressure. An
  element that is merely uncommon is negotiable; one that is structurally absent from
  every comparable is the identity of the product.

## Current Workarounds

How comparable titles solve the problems Abyssal solves with its candidate elements:

| Problem | Genre's usual answer | Abyssal's answer |
|---|---|---|
| Give the player positional agency over allies | Don't have allies (T1–T8); or fix them to the player and make the player kite (T9) | Switchable stance, 3 presets, 4 s cooldown |
| Let the player acquire allies | Chests/gacha (T2, T8); unlock-by-challenge (T3–T6) | Defeat a named elite, hold an extraction point, capture |
| Make boss arrival feel different | Health-sponge with new attack patterns | 20% party-wide cooldown cut, gated on FRONT≥1 |
| Handle ally death | Ally is a weapon, it just despawns (T1, T3); or incapacitate for the run (T2) | Non-terminal DOWNED, run-scoped |
| Give the player a view of the fight | Fixed top-down, deliberately (all 11) | Free orbit, yaw free, pitch clamped 30–85° |

The pattern: in four of five rows the genre's workaround is *to not have the problem*.
Abyssal has opted into a squad, and therefore into squad problems, and is answering them
with mechanics the comparable set has no equivalent for.

## Adjacent Problems

- **Readability under crowd density** is the genre's central constraint and the stated
  reason the fixed camera is conventional. Abyssal is currently failing readability for
  reasons unrelated to camera (23/24 characters flat untextured mauve; 54–100% render
  height spread per the director's `engineering/rig-pipeline-root-cause.md` D2/D6). The
  free camera is a novelty candidate that *spends* a readability budget the build does
  not currently have.
- **Cooldown-gated inputs in a genre with no inputs.** Survivor players are trained that
  the only button is the stick. A 4 s-cooldown stance button is a new input class; the
  survey found no comparable that teaches it, so onboarding has no precedent to borrow.
- **Turret stance vs Boss Rally Window mutual exclusion** (`derivedFrontCount: 0` can
  never satisfy the rally's FRONT≥1 gate) is a self-inflicted interaction that no
  comparable has an analogue for, precisely because no comparable has both systems.
  Carried forward from the prior cycle's §3.4; still live.

## User Voices

Sourced from the same indexed snippets as `solutions.md`; no primary-page retrieval was
performed, so these are characterisations of aggregated community sentiment rather than
quoted individuals.

- On camera rotation in survivors: developers avoid it because "in a game where you are
  constantly maneuvering based on the positions of surrounding enemies, rotating the
  camera can disorient the player, causing them to move in the wrong direction," and it
  "necessitates additional buttons… which increases the barrier to entry."
- On squad positioning in the closest peer (T9): players "have discussed the desire for
  more tactical positioning or map-based movement mechanics," and those features "are not
  currently present in the game." Demand exists in the comparable set and is unmet there.
- On enemy-recruitment: players asking for the defeat→recruit loop are routinely
  redirected out of the genre entirely, to monster-tamers and Nemesis-system games.

The second and third bullets are the useful ones: they are evidence that N1 and N2 are
not just absent but *wanted and unserved* in the comparable set. That is a stronger
position for a novelty claim than absence alone.
