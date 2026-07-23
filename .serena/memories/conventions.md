# Conventions
- Keep one rules authority: authored values in `defense-catalog.js`; do not duplicate executable balance rules in UI/render/audio/docs.
- Rendering adapters consume deterministic snapshots only; renderer fallback must preserve gameplay outcomes.
- Input focuses movement; HUD stays peripheral and all critical feedback has reduced-motion readable static/text form.
- Persist companions/campaign separately from run skills/XP. Preserve deterministic replay: stable time/RNG/tie handling and event order.
- Workspace production artifacts use the game-studio contract: YAML for gate-checkable numbers, evidence path + method for every measurement, never claim unmeasured gates passed.