# Architecture contract

| owner | authoritative responsibility | must not do |
|---|---|---|
| `defense-run-simulation.js` | deterministic 60 Hz run state, event ordering, combat/items/extraction | read DOM or mutate campaign storage |
| `campaign-state.js` | persistent companions, rewards, achievements | decide battle outcomes |
| `app.js` | input, HUD, overlays, audio lifecycle, persistence orchestration | alter a renderer snapshot into rules state |
| `battle-realtime-three.js` | primary WebGL snapshot presentation | mutate run/campaign state |
| `battle-visualizer.js` | Canvas fallback/reduced-motion presentation | mutate run/campaign state |
| `defense-catalog.js` | immutable authored data | contain runtime side effects |
| `defense-cutscene.js` | normalize authored simulation cutscene events for the UI observer | mutate run/campaign state or depend on a renderer |

## Extensibility rules
New content enters catalog data, is emitted as a simulation event, then is rendered/audio-cued by an observer. A visual, video, audio, or generated resource failure must leave simulation state and input usable. Test every newly added event with deterministic state and one presentation fallback.