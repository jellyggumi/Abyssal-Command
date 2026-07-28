# Production Brief — Lobby → Idle-Style Side-Dock Redesign

```yaml
run_id: 20260727-lobby-dock-redesign
game_type: mobile-first single-player defense-survivor
team_shape: solo dev + AI production harness
engine: vanilla JS + Three.js (no framework), static-hosted (GitHub Pages)
current_stage: post-D9 (unified lobby+battle shell just shipped, commit f6810c8 / cf0706e on feature/first_lee)
next_public_beat: internal playtest re-verification of the shell layout before next release cut
source_packet: >
  User request (Korean): "로비 화면이 위에 뜨는게 아니고, 좌측이랑 우측에
  UI/UX 로 다 표시될수있게 예를들어서 일반 방치형에 경우 로비가 따로없는것처럼"
  (the lobby screen should not appear as a top/full overlay; it should be
  split into left/right side panels, the way idle (방치형) games typically
  have no separate lobby screen at all — sortie/growth/companion/inventory/
  stronghold info surrounds the persistent live view instead of covering it)
main_constraint: >
  Cannot break the D9 invariant: #defense-battle-surface (canvas + edge-HUD)
  is a single persistent node mounted once in mountShell(), never
  re-created. Cannot reintroduce a screen-swap. Cannot break the 3 CI-gated
  browser contracts (hud-responsive, survivor, performance) or the 164
  passing unit tests. Must keep the full-bleed canvas mobile-first contract
  from README.md ("전장은 모바일 화면을 가득 쓰는 full-bleed Canvas").
main_question: >
  Is a top full-width overlay (current #command-shell) still the right
  presentation for the lobby content, or should it become permanent
  left/right docked side rails around the canvas -- closer to the idle-game
  genre norm the user is pointing at -- while still collapsing out of the
  way once a run starts (edge-HUD takes over, same as today)?
```

## Scope

This is a **UI/UX information-architecture and layout revision**, not a new
concept, balance, or revenue cycle. The core loop, balance sheet, worldview,
and monetization design are unchanged and out of scope. Entry point is
Stage 1 Phase 1d equivalent for the `ui-senior-developer` role only
(new `ui/hud-layout-spec.md` direction for the shell), immediately followed
by `game-programmer` implementation and `game-qa` regression — a scoped
micro-cycle, not a full Stage 1→2→3 run.

## Operating mode

**UI Redesign mode** (not New Concept, not Balance Emergency, not Stage-Gate
Review). Team assembled: `ui-senior-developer` (lead), `game-programmer`
(implementation), `game-qa` (regression + accessibility/perf verification).
`game-designer` and `game-pm` are NOT engaged — no core-loop, balance, or
revenue numbers are touched by this change.

## Current-state grounding (read before designing)

- `styles.css` / `app.js` `renderCommandShell()` — `#command-shell` is a
  `position: fixed; inset: 0` full-viewport overlay with a `.command-shell-inner`
  scroll container holding a tabbed deck (출정/성장/동료/인벤토리/요새) that
  sits ON TOP of `#defense-battle-surface` (canvas + edge-HUD), collapsing
  to a small dock-toggle FAB when a run starts or via manual dock toggle.
- This overlay-then-collapse pattern is exactly the "로비가 위에 뜨는" behavior
  the user wants replaced.
- Reference genre: idle/방치형 games (Toss 뱅커, BagelCode 계열, etc. — see
  `_workspace/20260725-outgame-expansion/trend-survey/` if present, else
  fresh visual reference pass by ui-senior-developer) present ALL
  persistent-progression UI as fixed side rails/docks flanking the always-
  visible live simulation view; there is no "lobby screen" to enter or
  leave, only docked panels that can individually collapse.

## Gate relevance

- G4 (immersion/accessibility) input: touch target, contrast, reduced-motion
  parity for the new dock layout.
- G6 (ops) input: DOM count ceiling, UI input latency ≤100ms, must not
  regress the existing perf budget (p95 ≤16.7ms shared frame budget).
- No G1/G2/G3/G5/G7/G8 impact (no worldview, balance, revenue, or loop
  changes).
