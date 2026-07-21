# Production Brief — Mesh Command Telemetry

- **game type:** Offline dark-fantasy RTS/RPG WebGL campaign
- **team shape:** Director-led game-studio cycle; asset, runtime, UX, QA lanes
- **engine:** Three.js browser runtime plus DOM/Canvas HUD
- **current stage:** Stage 1 — presentation/resources/core interaction; continuation after `492f7a1`
- **next public beat:** Playable battlefield build with role-specific PBR materials, tight mesh-aware navigation, drag/popup command parity, terrain-visible rally paths, and actor status gauges
- **source packet:** User request, current `battle-realtime-three.js`, `stage-navigation.js`, `app.js`, 10-stage campaign assets
- **main constraint:** Preserve the lobby’s stage-specific boss previews; no continuous per-frame allocation, pathing must remain responsive, and applied visuals require captured runtime evidence saved in the repository.
- **main question:** What minimal data and render-path changes produce tight collision/navigation plus readable command/status feedback without exceeding the frame budget?

## Acceptance contract

1. Every rendered 3D resource is assigned either its authored GLB texture set or a role-specific generated texture, with no placeholder-only material path.
2. Navigation rejects actual terrain/obstacle geometry with appropriately tight clearance; broad-phase checks are bounded and allocations are avoided in the movement loop.
3. Drag-to-rally and tactical popup commands both drive the same authoritative movement/action path.
4. The selected route has a terrain-visible destination marker and dashed path; commandable actors show health plus regenerating focus gauge above their head.
5. Browser checks capture the applied textured battlefield in a committed evidence asset, functional interactions work, focused tests pass, and Pages deployment succeeds.
