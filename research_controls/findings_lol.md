# League of Legends control fundamentals (evidence brief)

**Research date:** 2026-07-19  
**Scope:** selection, movement/attack, camera, hotkeys, command/ability sequencing, minimap, and player feedback. This brief extracts mechanics that can inform Abyssal Surge without copying League-specific rules.

## Sources and evidence quality

1. **Riot Games — “Patch 25.24 Notes,” Riot Riru, 2025-12-02.** Official patch notes. The notes document the live rollout of the WASD control scheme in limited queues, its Dynamic Camera and Scout Ahead controls, remapping, and Riot’s request for bug reports/feedback while iterating before ranked availability.  
   URL: <https://www.leagueoflegends.com/en-us/news/game-updates/patch-25-24-notes/>
2. **League of Legends Wiki — “Controls and Hotkeys.”** Trusted community reference used for detailed current control semantics. The page’s WASD section references patch V25.24; its manual-config section is marked “Last updated: December 2, 2024 (patch V14.23).”  
   URL: <https://wiki.leagueoflegends.com/en-us/Controls_and_Hotkeys>
3. **League of Legends Wiki — “Basic attack” (the former “Attack move” page redirects here).** Trusted community reference for attack acquisition and attack-move behavior.  
   URL: <https://wiki.leagueoflegends.com/en-us/Basic_attack#Attack-move>
4. **Riot Games Support — “League of Legends Keyboard + WASD Input FAQ.”** Riot’s official FAQ, linked from the 25.24 patch notes. The support page is dynamically rendered, so the directly readable mechanics in this brief are taken from the official patch notes and cross-checked against the wiki.  
   URL: <https://support-leagueoflegends.riotgames.com/hc/articles/46818184335763>

> **Evidence convention:** Statements tagged **[FACT]** are source-backed descriptions of League behavior. Statements tagged **[INFERENCE]** are general UX interpretations for Abyssal Surge, not claims about League’s implementation.

## 1. Selection, targeting, and cast modes

- **[FACT]** League exposes a distinct **Select** action (default MB1/left mouse button or Shift+MB1); selecting a unit reveals its Target Frame. (Controls and Hotkeys, “Primary” hotkeys.)
- **[FACT]** The Hotkeys UI supports three ability-casting modes: **Normal cast** (press the key, then left-click a target/location while showing an indicator), **Quick cast** (cursor position is assumed to be the target and no indicator is shown), and **Quick cast with indicator** (indicator appears while the key is held and the ability fires on release). (Controls and Hotkeys, “Casting modes.”)
- **[FACT]** Normal-cast targeting can be canceled by a move, attack, or pet-move command, or by Escape. (Controls and Hotkeys, “Casting modes.”)
- **[FACT]** The “Attack move on cursor” option changes target acquisition: when enabled, the attack-move scan is centered around the cursor; otherwise the fallback is the champion’s position. (Basic attack, “Attack-move.”)

**[INFERENCE] Applicable principle:** Keep *selection*, *target confirmation*, and *execution* legible as separate states. Offer a deliberate/preview mode and a fast mode, but make the preview cancellable by an ordinary movement/attack input and provide a visible target acknowledgment.

## 2. Movement, basic attack, and attack-move cadence

- **[FACT]** A normal basic attack is ordered by right-clicking an enemy (MB2); the default attack-move command is **A**. (Basic attack, opening description.)
- **[FACT]** Attack-move orders a champion toward a destination while scanning for a valid hostile within acquisition range. Regular attack-move (default A) displays the attack-range indicator and requires a left-click to choose a location or target. (Basic attack, “Attack-move.”)
- **[FACT]** Attack-move click performs the same action without a second selection click; the cursor position is treated as the selection position and no range indicator is shown. (Basic attack, “Attack-move.”)
- **[FACT]** When a champion acquires a target, it attempts to move until attack range meets the target’s gameplay radius, then stops and attacks. Acquisition continues until a new target/order, cancellation, or target invalidation. (Basic attack, “Acquisition.”)
- **[FACT]** Issuing a different command can interrupt the attack windup. The reference explicitly notes that manually cycling movement and attack commands is faster and more precise than relying only on automatic orders (the kiting use case). (Basic attack, “Behavior—General/Champion.”)
- **[FACT]** Riot’s 25.24 notes say WASD movement went live in most unranked queues, while Draft and Ranked initially did not support it; the patch describes WASD remapping, Dynamic Camera, and a middle-mouse **Scout Ahead** button that freely moves the camera while held and snaps back on release. (Riot, Patch 25.24 Notes, “WASD Launches in Limited Queues.”)
- **[FACT]** The wiki documents WASD parity adjustments: movement cannot cancel a basic attack command in that scheme, and a delay can be added between ranged basic attacks when movement and attack inputs are both used. (Controls and Hotkeys, “WASD Controls.”)

**[INFERENCE] Applicable principle:** Make movement and attack composable but distinguish their intent. Attack-move should have a predictable scan rule, a preview/confirm variant, and a fast variant; a new command should provide an explicit interruption rule rather than silently fighting the previous command. If multiple control schemes exist, document and test parity exceptions instead of implying identical timing.

## 3. Camera and minimap navigation

- **[FACT]** The **Unlocked** camera can scroll by edge-panning, mouse drag (when enabled), or arrow-key “Scroll Camera” controls; mouse and keyboard camera speeds are configurable. (Controls and Hotkeys, “Camera control.”)
- **[FACT]** The **Locked** camera focuses on and follows the player’s champion; locking immediately jumps back to the champion. A **Semi-Locked** option behaves like an unlocked camera up to a limit that keeps the champion visible. (Controls and Hotkeys, “Camera control.”)
- **[FACT]** Camera lock can be toggled with the minimap camera button or default **Y**. **F1** selects/focuses the player, while **F2–F5** select/focus allies; holding a select key can follow that player. (Controls and Hotkeys, “Camera control.”)
- **[FACT]** The reference lists **Alt+M** to toggle minimap camera drag and MB1 to drag the camera view via the minimap. (Controls and Hotkeys, “Primary” hotkeys.)
- **[FACT]** Riot’s 25.24 WASD feature list adds a Dynamic Camera that follows the mouse, speed settings, and Scout Ahead: middle-mouse hold moves the camera freely and release snaps it back. (Riot, Patch 25.24 Notes, “WASD New Features.”)

**[INFERENCE] Applicable principle:** Camera control should support both local precision and remote scouting through reversible modes: an explicit free/locked toggle, a reliable recenter/follow action, and a temporary “look ahead” gesture that returns to the player without requiring a second navigation sequence.

## 4. Hotkeys and customization

- **[FACT]** League allows players to customize hotkeys/key bindings in the in-game Settings > Hotkeys section; the reference describes bindings for abilities, summoner spells, items, trinket, movement, attack, camera, selection, and interface actions. (Controls and Hotkeys, opening section and “List of Hotkeys.”)
- **[FACT]** The game exposes per-action casting-mode choices in the Quickbind UI and additional casting-mode bindings under Hotkeys > Abilities and Summoner Spells and Items. (Controls and Hotkeys, “Casting modes.”)
- **[FACT]** The reference distinguishes ordinary in-game settings from manual configuration files (`input.ini`, `game.cfg`, and generated `PersistedSettings.json`) and links Riot’s official Hotkeys/Keybindings FAQ as the protocol for manual changes. (Controls and Hotkeys, “Keybind Editing through System Files.”)
- **[FACT]** Riot’s 25.24 patch explicitly advertises WASD remapping (“Remap your keybinds as you wish”) as a new feature. (Riot, Patch 25.24 Notes.)

**[INFERENCE] Applicable principle:** Rebindability is part of accessibility and mastery, not an expert-only afterthought. Group bindings by player intent (select, move, attack, camera, cast), show the current binding beside the action, offer a reset path, and expose control-scheme differences in the UI rather than hiding them in files.

## 5. Command queue and ability sequencing

- **[FACT]** League’s documented ability sequencing is built from cast mode plus a specific setting: “Cast the pressed spell upon pressing another spell” makes the currently pressed ability/item/summoner-spell key cast only when a new valid ability/item/summoner-spell key is used. (Controls and Hotkeys, end of “Casting modes.”)
- **[FACT]** Quick cast with indicator uses key release as the execution event; charged abilities use hold/release; vector-targeted abilities use a hold-and-drag interaction. (Controls and Hotkeys, “Casting modes.”)
- **[FACT]** A Normal-cast targeting prompt is canceled by movement, attack, pet-move, or Escape. (Controls and Hotkeys, “Casting modes.”)
- **[FACT]** The consulted references do **not** establish a universal multi-command queue for arbitrary movement, attacks, and abilities. The evidence supports a narrower model of pending cast intent, release/next-valid-spell execution, and explicit cancellation/override.

**[INFERENCE] Applicable principle:** Treat sequencing as an intentional state machine: capture intent, show what is pending, execute on a clearly defined event (confirm, release, or next-valid-action), and define which new inputs cancel or override it. Do not claim a general queue unless every command category and interruption rule is specified and tested.

## 6. Player feedback and error prevention

- **[FACT]** Normal cast shows an ability range/effect indicator before confirmation; Quick cast omits the indicator; Quick cast with indicator shows it while the key is held. (Controls and Hotkeys, “Casting modes.”)
- **[FACT]** Regular attack-move shows an attack-range indicator; attack-move click does not. (Basic attack, “Attack-move.”)
- **[FACT]** Selecting a unit reveals its Target Frame, giving a persistent target acknowledgment. (Controls and Hotkeys, “Primary” hotkeys.)
- **[FACT]** Riot labels WASD as beta/actively iterating in the 25.24 notes, says certain queues/champions may be disabled if player experience degrades, and asks players to report issues to Player Support; the notes state Riot would use live data before considering Ranked availability. (Riot, Patch 25.24 Notes, “WASD Launches in Limited Queues.”)
- **[FACT]** The same Riot section says the team would continue releasing promised features and invites player feedback/bug reports during the rollout. (Riot, Patch 25.24 Notes.)

**[INFERENCE] Applicable principle:** Every high-consequence input should have immediate, mode-appropriate feedback: target frame/highlight, range/effect preview, pending-state cue, camera-follow state, and a visible result when an action is accepted or rejected. Ship novel control schemes behind a measured rollout, collect player reports, and preserve a fallback scheme when the experience degrades.

## Principles-only synthesis for Abyssal Surge

1. **Separate intent from execution.** Selection, targeting, cast preview, confirmation, and cancellation should be observable states rather than one ambiguous click.
2. **Make target acquisition deterministic.** State whether an attack-move scan uses champion position, cursor position, or an explicitly selected target; show the relevant radius/indicator when precision matters.
3. **Design movement and attacks as a cadence.** Support fast command alternation, but document interruption, windup, and queue behavior so players can predict what a new input will do.
4. **Offer reversible camera modes.** Provide locked/follow, free scouting, temporary look-ahead, and a dependable recenter action; camera state must be visible and recoverable.
5. **Treat the minimap as both navigation and a risk surface.** Separate camera navigation from movement/attack commands, and provide a safe toggle or modifier for accidental minimap clicks.
6. **Make hotkeys discoverable and rebindable.** Bind by intent, show conflicts/current assignments, support reset, and keep control-scheme-specific behavior in the settings UI.
7. **Define sequencing as a state machine, not folklore.** Specify pending-action lifetime, execution trigger, cancellation, override priority, and feedback for accepted/rejected commands.
8. **Close the feedback loop.** Use indicators, target frames, pending cues, and result states, then validate new schemes in limited rollout/practice contexts with telemetry and player reports before broad competitive deployment.
