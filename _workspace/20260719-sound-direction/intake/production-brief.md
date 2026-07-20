# Abyssal Surge — Sound Direction Production Brief

```yaml
game_type: "deterministic single-player browser RTS / tactical campaign (dark-fantasy abyssal RTS-RPG hybrid)"
team_shape:
  director: game-production-director
  specialists: [game-designer, game-pm, game-programmer, game-qa]
engine: "ES modules + deterministic campaign reducer + Three.js WebGL2 primary renderer + Canvas2D fallback + PWA service worker"
current_stage: "Stage 1 — sound-direction intake and contract; no runtime diff authorized by this packet"
next_public_beat: "Sound-direction candidate drop: Korean-primary, English-parity stage narration and a stage-escalating BGM/SFX cue plan for all ten campaign stages, with accessible text fallback and deployment-safe media inventory; campaign rules, saves, replay, and authoritative traces remain unchanged."
source_packet:
  - "README.md:6-25,27-55,72-100,102-106 (game loop, ten-stage campaign, renderers, offline/PWA, deployment)"
  - "campaign-state.js:3-5,15,89-221,222-514 (rules/save authority and ten-stage content)"
  - "stage-navigation.js:3-38 (24×12 shared navigation and ten authored stage routes)"
  - "app.js:77-119 (effect/encounter cue aliases and lobby/battle music); app.js:120-194 (narration coverage)"
  - "sw.js:137-160 (literal optional audio/media cache inventory)"
  - ".github/workflows/static.yml:32-80,100-150 (committed Pages allowlist and audio paths)"
  - "assets/media-manifest.json:1-68 (audio provenance and observed local procedural records)"
  - "_workspace/20260718-resource-refinement/engineering/audio-report.md:8-76 (prior audio delivery, runtime, cache, and focused verification evidence)"
  - "i18n.js:226-265,788-827 (Korean and English stage/title/objective parity strings)"
  - "skill://game-studio-harness/references/{artifact-contract,quality-gates,stage-cycle}.md"
main_constraint: "Increase sound-direction clarity and stage escalation without creating a second rules authority, changing campaign-state outcomes/save-replay semantics, making audio mandatory for progression, or claiming provider output/secrets that are not present. Every runtime media path must be a shipped file covered by app.js, sw.js, assets/media-manifest.json, and the Pages allowlist before a release claim."
main_question: "How should the existing Korean narration, restrained battle underscore, accepted-event encounter alerts, action SFX, and PWA cache be extended into a coherent ten-stage dark-fantasy sound identity with English parity, accessibility, offline safety, and evidence-backed deployment readiness?"
operating_mode: "sound direction — one mode for this cycle (Stage 1 intake/contract → Stage 2 cue development → Stage 3 accessibility/ops/deployment proof)"
```

## 1. Operating decision and public beat

**Single operating mode:** sound direction. This cycle is not a balance, monetization, map, art, or gameplay-rules cycle. Sound may explain, warn, confirm, and escalate a state transition; it may not author or mutate that transition. The two artifacts in this intake create the coordination contract only. They do not claim that new audio has been generated, integrated, cached, or deployed.

**Next public beat:** a reviewable **sound-direction candidate drop** for the ten-stage campaign. The drop must make the Korean-primary/English-parity scripts, stage escalation map, cue ownership, accessibility fallback, and media delivery contract reviewable. A candidate becomes shippable only after the focused gates in `production/task-manifest.md` have measured evidence; absent evidence remains `NOT RUN`/`FIX`, never an inferred pass.

**Entry decision:** enter Stage 1 sound-direction intake. Existing runtime behavior is the baseline. The director is not authorizing edits to `app.js`, tests, `sw.js`, `.github/workflows/static.yml`, or shared media manifests in this packet.

## 2. Observed game shape

| Area | Observed fact | Source | Boundary of the observation |
|---|---|---|---|
| Campaign | A browser-local, deterministic single-player RTS-RPG hybrid uses `Hunt → Extract → Materialize`, `Capture`, `Possess`, `Domain`, and `Assault`; local save/replay is trace-validated. | `README.md:6-25`; `campaign-state.js:3-5,15` | Sound behavior must not become a second campaign authority. |
| Stages | The campaign declares stages 1–10, from Cinder Span through Gate Zenith; shared tactical navigation is 24×12 and has three named route/affordance families per stage. | `campaign-state.js:89-514`; `stage-navigation.js:3-38` | This is content/topology shape, not proof that all ten stages have audio assets or browser-complete evidence. |
| Renderers | Three.js WebGL2 is primary; Canvas2D is a fallback, including reduced-motion or initialization-failure paths. | `README.md:24-25,50-55`; source packet above | Cue semantics and text fallback must remain renderer-independent. |
| Current BGM | `app.js` selects `assets/audio/bgm-theme.mp3` in lobby and `assets/audio/battle-bgm.mp3` in battle. | `app.js:116-119` | No stage-specific BGM selection is currently declared in this intake. |
| Current event SFX | `CUE_BY_EFFECT` points action effects to shipped files and includes `breach-alert` and `wave-spawn`; `ENCOUNTER_CUE_BY_EVENT` maps accepted `breach` and `start-wave` events to those cues. | `app.js:77-101` | Other combat-alert keys are feedback aliases; this brief does not claim that each alias has a shipped audio file. |
| Current narration audio | Audio is declared for `intro`, Cinder Span, Veil Citadel, Echo Throne, `victory`, and `defeat`. | `app.js:120-144,182-193` | Stages 4–10 currently define text lines but no `audio` field. |
| Current narration text | Stage 4–10 text narration exists in Korean in `NARRATION`; corresponding Korean and English stage/title/objective strings exist in `i18n.js`. | `app.js:145-180`; `i18n.js:226-265,788-827` | English text parity is present in localization; English voice parity is not claimed because no corresponding voice files were observed. |
| Existing audio delivery | The audio directory contains the current action cues, ambient/lobby/battle music, breach/wave alerts, and intro/stage1–3/victory/defeat narration. The prior report records local procedural generation for `breach-alert`, `wave-spawn`, and `battle-bgm`, with no provider key or network generation used in that run. | `assets/audio/`; `assets/media-manifest.json:1-68`; prior `audio-report.md:6,18-35` | Prior report values are carry-forward evidence, not new measurements in this intake. |
| Cache/deployment | `sw.js` lists the literal audio paths in `OPTIONAL_MEDIA`; `.github/workflows/static.yml` has a committed runtime allowlist containing the current audio files and related media. | `sw.js:137-160`; `.github/workflows/static.yml:32-80,100-150` | A future audio path is not shippable until all four path surfaces agree. |
| Delivery posture | The repository is a static GitHub Pages/PWA deployment and does not claim an online service or cloud sync. | `README.md:6-8,96-100` | Deployment evidence must be focused on the static allowlist/cache path, not a server API. |

## 3. Sound identity contract

- **World:** dark fantasy at the edge of a drowned abyss. The sound palette is low, sparse, and material: iron, drowned stone, tide pressure, portal resonance, ash, and restrained choral overtones.
- **Narration:** Korean is the primary spoken language. Every spoken line has an English parity script/caption row with matching intent and timing notes. English voice assets are only a future acceptance item until actual shipped files exist; no English voice is implied by existing localization strings.
- **BGM:** lobby remains an invocation/threshold; battle remains a restrained low-drone underscore. Stage escalation should be achieved by declared layers, transitions, or cue treatment, not by making the mix continuously louder or denser. Current `battle-bgm.mp3` is the observed baseline, not proof of stage-aware switching.
- **SFX:** diegetic tactical cues confirm accepted actions and warn about accepted encounter events. `breach-alert` and `wave-spawn` are the observed reference behaviors. Duplicate/rejected events must not author a cue; audio failure must not block campaign progression.
- **Silence and hierarchy:** narration owns briefing/result moments; BGM supports rather than masks speech; high-priority breach/boss/wave cues outrank low-priority ambience; noncritical texture may be dropped before command feedback.
- **Accessibility:** every meaningful audio cue has an equivalent visible text/status path. Volume/mute controls, captions or transcript parity, reduced-motion compatibility, and no audio-only progression requirement are acceptance criteria, not optional polish.

## 4. Immutable boundaries and non-goals

1. `campaign-state.js` remains the authority for actions, encounter acceptance, rewards, retries, traces, save, and replay.
2. Presentation code may request or display a cue only after the existing accepted-event/action path; it may not infer a successful action from audio playback.
3. Missing, blocked, rejected, or undecodable audio must leave the deterministic campaign path usable through text/status feedback.
4. No new remote provider request is assumed. Local deterministic synthesis is preferred where a new cue is genuinely required; provenance, procedure, bytes, and digest must be recorded before any asset is called shipped.
5. This intake does not edit app code, tests, the service worker, deployment workflow, or shared media manifest. It does not claim a provider-generated asset, a new stage voice, an English recording, a stage-aware music switch, an offline session, a Pages run, or a gate verdict.
6. No paid power, entitlement, store, multiplayer, cloud-save, account, or campaign-rule change is in scope.

## 5. Evidence policy

The harness defaults (for example G4 immersion median ≥4.0/5, feedback latency ≤100 ms, G6 p95 frame ≤16.7 ms, G7 loop period 30–180 s, and G8 impression ≥4.0/5) are **thresholds**, not observations. The production manifest reserves evidence paths for G1–G8; each later measurement must include an observed value, method/command or session, numerator/denominator where applicable, timestamp, build/revision, and evidence path. A missing value is `NOT RUN` and blocks a PASS.

Prior audio evidence in `_workspace/20260718-resource-refinement/engineering/audio-report.md` may be linked as a baseline for the already shipped three procedural assets. It cannot be relabeled as proof of the ten-stage narration, English voice parity, accessibility, offline reload, or deployment of future sound assets.
