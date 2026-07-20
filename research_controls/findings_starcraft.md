# StarCraft control fundamentals (selection, commands, camera, minimap, feedback)

**Research scope.** StarCraft II controls were used as a reference point because Blizzard's current public StarCraft II site is a product landing page rather than a complete controls manual. The detailed control evidence below comes from the trusted Liquipedia StarCraft II Encyclopedia. The findings are control principles, not recommendations to copy StarCraft-specific keys or rules. Web research performed 2026-07-19 (four targeted searches; no repository files inspected or edited).

## Sources and provenance

1. **Liquipedia StarCraft II Wiki, “Hotkeys.”** Page context: control-group, command-hotkey, camera-hotkey, and user-interface-hotkey reference; last edited **21 January 2020**. Permanent revision: <https://liquipedia.net/starcraft2/index.php?title=Hotkeys&oldid=1624160> (canonical page: <https://liquipedia.net/starcraft2/Hotkeys>).
2. **Liquipedia StarCraft II Wiki, “Minimap.”** Page context: minimap capabilities, navigation, ping, terrain and team-color controls; last edited **24 December 2012**. Permanent revision: <https://liquipedia.net/starcraft2/index.php?title=Minimap&oldid=435113> (canonical page: <https://liquipedia.net/starcraft2/Minimap>).
3. **Blizzard Entertainment, “StarCraft II” official product site.** Current official context/product page (not a detailed controls reference): <https://starcraft2.blizzard.com/en-us/> (accessed 2026-07-19).

> The Liquipedia pages are cited for the mechanics below. The Blizzard URL is included as the official product context; no publicly retrievable Blizzard page in this search set exposed the detailed key-by-key reference.

## 1. Selection and control groups

### Source-backed facts

- The Hotkeys page says number keys **1–0** can hold groups of units and/or buildings; groups can be redefined and reassigned. To create one, select units/buildings and press **Ctrl + number**. **Shift + number** adds the current selection to an existing group; **Alt + number** creates a new group and removes the selected units from previous groups (the page identifies this as the Legacy of the Void behavior).
- Selection inputs include box selection, left-click/Shift+left-click individual units, and **Ctrl + left-click** to select all units of that type in the main window. The page also describes modifying a group by selecting the group, Shift-clicking units to add/remove, and redefining it with Ctrl+number.
- The page states that a control-group indicator in the lower information area shows the group number and quantity of units/buildings.
- The Hotkeys page explicitly recommends consistency: its strategy section says muscle memory is most effective when each key always does the same thing. It also notes that units can belong to multiple groups, allowing an aggregate group and a narrower specialist group.

### [INFERENCE] Transferable UX principles

- Support both **coarse selection** (box/all-of-type) and **fine selection editing** (add/remove) without forcing a user to start over.
- Treat persistent groups as named, inspectable state: show membership/count and preserve user-defined associations across the moment-to-moment camera view.
- Make reassignment semantics explicit (replace vs add vs remove-from-other-groups); accidental destructive reassignment is a high-cost error in a real-time interface.
- Keep group-slot behavior stable and learnable; consistency matters more than any particular key numbering.

## 2. Movement, attack, stop/hold, and command queue

### Source-backed facts

- The **A** hotkey is overloaded by context: A + click on an enemy unit/building attacks that target; A + left-click on map terrain moves toward that point while engaging enemies encountered on the way.
- **S** stops units. **H** (Hold Position) keeps units in place instead of pursuing enemies that move out of range. **P** creates a patrol; the page describes patrol as attack-move-like movement between the starting point and the target, and says Shift can create a multi-point patrol route.
- The User Interface Hotkeys section states **Shift + any command** creates a series of commands. The page's patrol description says queued points are executed point-to-point and the route returns to its origin after the last destination.
- The page gives a concrete worker example: for Terran and Protoss, a worker holding minerals can receive a build order while holding Shift and pressing C; once the building is finished, the worker returns resources and resumes mining. It explicitly says this does not work for Zerg Drones because they become the structure.

### [INFERENCE] Transferable UX principles

- Separate **intent selection** (move, attack, attack-move, hold, patrol) from **target selection** (ground vs unit/building), and make the resulting behavior legible before execution.
- Provide a modifier-based queue that composes existing commands rather than inventing a second planning language. Show queued order and order in execution order.
- Offer both an immediate interrupt (stop) and a persistent non-chasing stance (hold); users need a fast way to cancel and a different way to constrain future autonomous behavior.
- For compound actions, expose completion handoff (e.g., “build, then resume prior job”) and communicate exceptions where the handoff is impossible.

## 3. Hotkeys and command-card alternatives

### Source-backed facts

- The Hotkeys page defines command hotkeys as predefined keys that issue an instruction to a selected unit/building. It states that hotkeys avoid mouse travel and are faster than clicking a command icon; it also notes that some operations (control groups, base centering, camera bookmarks) are keyboard-only in the described workflow.
- The reference assumes default American QWERTY bindings and warns that nonstandard/hardware-remapped layouts can require adjustment. It distinguishes command hotkeys from location/control-group hotkeys and user-interface hotkeys.
- The page's in-game table lists **Alt+G** for a map ping, **Alt+T** to show/hide minimap terrain, **Alt+F** to toggle minimap unit color, and **F1** to select an idle worker. (Bindings can vary by game version/layout; these are source-page defaults.)

### [INFERENCE] Transferable UX principles

- Make every high-frequency command available through both direct manipulation and a low-travel keyboard path; never make hotkeys the only discoverable route.
- Surface the active binding at the command affordance and support rebinding for different keyboard layouts, while preserving semantic command names.
- Distinguish **world commands**, **selection/group commands**, **camera commands**, and **UI commands** in the help/settings taxonomy; users form different mental models for each.

## 4. Camera navigation and bookmarks

### Source-backed facts

- By default, StarCraft II's Hotkeys page describes **Ctrl+F5–F8** to save camera locations and **F5–F8** to jump to them. It lists expansion bases, enemy locations, and chokepoints as common bookmark targets.
- **Backspace** focuses the camera on a town structure and cycles through multiple town structures; the page notes edge cases, including that floating Command Centers/Orbital Command Centers are not focused.
- **Spacebar** focuses the camera on the location of the last event notification; pressing it again cycles through recent events.

### [INFERENCE] Transferable UX principles

- Provide both continuous navigation and discrete, persistent bookmarks. Bookmarks should be quick to save, quick to recall, and resilient while the world changes.
- Treat alerts as actionable navigation targets: a notification should carry a location, and a single input should take the player there without losing the ability to cycle through recent events.
- Define camera-target rules for exceptional objects/states; predictable exclusions are better than silently selecting an unexpected target.

## 5. Minimap and map-mediated commands

### Source-backed facts

- Liquipedia's Minimap page defines the minimap as the lower-left UI element showing the current field of view plus visible/owned units and buildings; previously seen objects remain but become dark under fog of war. The page calls minimap watching critical for awareness of enemy and friendly positions.
- Clicking the minimap moves the main window to the clicked location. With units selected, clicking there can issue **move**, **patrol**, or **attack/scan-move** commands just as in the main window. The page also lists some abilities that can be cast through the minimap.
- Ping controls are listed as **Ctrl+Alt + click** on the main screen to signal on the minimap and **Alt+G + click** on the minimap to ping. The page also lists Alt+T (terrain visibility) and Alt+F (team-color toggle) as minimap presentation controls.

### [INFERENCE] Transferable UX principles

- A minimap is not merely decoration: it should be a second command surface with clear separation between **navigate camera**, **issue unit order**, and **communicate/ping** modes.
- Preserve information hierarchy under fog/limited visibility (current view, known-but-not-currently-visible entities, terrain and objectives) and provide display toggles for readability.
- Pings should be spatial, fast, and visible to the intended audience; their visual lifetime and color should make urgency and ownership unambiguous.

## 6. Player feedback and error recovery

### Source-backed facts

- The Hotkeys page ties Spacebar directly to the “last event notification” location and allows repeated presses to cycle recent events. Its in-game hotkey table also labels Spacebar “View last warning area.”
- The control-group indicator shows group number and quantity in the information area. The Minimap page says the viewport rectangle and unit/building markers provide ongoing positional awareness, while fog-of-war state changes previously seen objects to a darker representation.
- The Hotkeys page's S/H distinction is behavioral feedback in itself: stopping cancels movement immediately, whereas holding constrains pursuit. The page's command queue description says queued actions execute as a series, making order and completion state meaningful to the player.

### [INFERENCE] Transferable UX principles

- Feedback must answer three questions quickly: **what is selected**, **what order is active/queued**, and **where/why did the important event occur**.
- Couple every high-impact alert with an immediate recovery action (jump-to-alert, cycle recent alerts, inspect affected selection), not just a sound or transient text banner.
- Make hidden-state changes legible: selection membership, fog/knowledge status, queued order sequence, and stance should have persistent or inspectable indicators.

## Principles-only synthesis for Abyssal Surge (not StarCraft rules)

1. **Selection is editable state.** Combine fast broad selection with precise add/remove operations, persistent groups, visible membership/count, and explicit replace/add/remove semantics.
2. **Commands should compose.** Use a small set of distinct intents (move, attack, attack-move, stop, hold, patrol) with target-context rules, modifier-based queues, visible order previews, and clear interruption behavior.
3. **Camera is part of control.** Provide edge/drag/minimap navigation plus saved bookmarks, group-to-camera focus, and alert-to-location recovery; do not make players search the map to respond to events.
4. **One map, multiple interaction modes.** The minimap should support camera movement, unit orders, and communication while clearly indicating the active mode and maintaining readability under limited vision.
5. **Keyboard and pointer paths must agree.** Mirror core actions across command card, pointer, and rebinding-friendly hotkeys; label bindings and keep command categories coherent.
6. **Feedback closes the loop.** Persist enough information to verify selection, order queue, stance, location, event priority, and visibility state; every consequential alert should provide a direct route to investigate or recover.

## Scope/limitations

- These are StarCraft II references, not a claim that StarCraft: Brood War/Remastered shares every binding or command behavior. Apply the abstractions, not the exact keys, queue limits, race-specific worker behavior, or camera exceptions.
- Liquipedia is a trusted secondary reference rather than an official Blizzard manual. The official Blizzard product page is included for provenance, but the detailed mechanics in this report are attributed to the Liquipedia pages and their stated page contexts.
