# Production Brief — Outgame Reference Survey (web survivor/idle games)

```yaml
run_id: 20260727-outgame-reference-survey
survey_slug: web-survivor-outgame-lobby-reference
game_type: mobile-first single-player defense-survivor + persistent RPG metagame (Vampire-Survivors-like autobattler with permanent warden/companion progression), browser-hosted (Three.js/WebGL, static GitHub Pages)
team_shape: solo dev + AI production harness
engine: vanilla JS + Three.js, no framework, static-hosted
current_stage: post lobby-dock redesign (f1fcb5d) — outgame is now a left/right dock shell around the live canvas
next_public_beat: internal playtest of a "game-like" outgame pass, then release cut
source_packet: >
  User request (Korean): survey web games (games that run IN a browser/website)
  similar to this project, identify WHAT each game is, find REFERENCE IMAGES and
  say HOW each is similar, in order to then do a wholesale "make the outgame
  (lobby etc.) feel game-like" revision. "조사 시작해줘" = start the survey now.
main_constraint: >
  Research mode ONLY this cycle (survey skill). Do NOT slide into implementation
  until the user approves a redesign plan off the survey findings. Must stay
  browser-playable-games scoped (the user said "웹사이트에서 구동되는 게임들" —
  games that actually run in a browser), not native-only titles used purely as
  aesthetic mood boards — though native titles MAY appear as secondary
  aesthetic references if clearly labeled as not-browser-playable.
main_question: >
  Among browser-playable web games structurally comparable to this project
  (survivor/autobattler + persistent metagame + idle-return), what does a
  "game-like" outgame/lobby actually look like — layout, entry flow, progression
  surfacing, reward/daily hooks, motion/juice, visual framing — and which
  concrete patterns should a wholesale outgame revision of Abyssal Surge adopt?
operating_mode: market-landscape survey (Stage 1 Phase 1a: designer trend survey ∥ QA benchmark survey)
```

## Scope

Research-only cycle. Two parallel Stage-1 survey lanes per the harness:
- **designer trend survey** (`skill://survey`, market-landscape): genre outgame/lobby UX trends — composition, entry flow, progression surfacing, juice/motion, framing.
- **QA benchmark survey** (`skill://survey`): ≥5 concrete comparable browser-playable titles as calibration benchmarks, each with what-it-is + how-it's-similar + a reference-image capture with provenance.

Output = validated `.survey/web-survivor-outgame-lobby-reference/` artifact package (triage/context/solutions[/platform-map]) + `reference-images/` with per-image provenance, mirrored under `design/trend-survey/`. Ends at a factual summary + a shortlist of adoptable patterns. NO code changes.

## Gate relevance
- Feeds G8 (novelty vs survey frequency table) and G1 (worldview-consistent presentation) for the FUTURE redesign cycle. This cycle produces the survey evidence those gates will later cite; it does not itself pass a gate.
