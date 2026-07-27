# Context — Outgame / Lobby for browser survivor·autobattler·idle-RPG

One bounded question: what makes the OUTGAME (lobby/metagame shell between runs) of a **browser-playable** survivor/idle-RPG feel game-like vs. flat, and what constrains a redesign of Abyssal Surge's dock shell. Evidence labels use the survey ladder: `direct page retrieval`, `indexed snippet`, `thin evidence`. Native-only titles are tagged reference-only. Full source lists in `../../messages/lane-a-context.md` and `lane-c-behavior.md`.

## Workflow Context

The outgame is the **between-runs staging room** — where a finished/failed run becomes permanent power, the next objective is chosen, and the "one more run" impulse is re-armed. In this genre the menu is half the loop, not a load screen.

- The run→menu→run spiral is the game: the pre-run upgrade screen is a "mechanical anchor" that guarantees forward momentum win or lose, converting last run's effort into next run's potential (Vampire Survivors, native — reference only). `indexed snippet`
- In the menu players (1) bank rewards into permanent upgrades, (2) re-allocate stat/skill/equipment loadout (VS removes "analysis paralysis" via free refund/re-allocate), (3) read the next micro-objective, (4) collect idle accrual. `indexed snippet`
- Idle-RPG variant = the "check-back ritual": log in → collect offline pile → reinvest → set next target. The "big number" return payoff is the genre's dopamine backbone; offline caps tuned to 8–24h. `indexed snippet`
- A game-like outgame treats the menu as an extension of the world: a live/diegetic background (interactive scene, in-world character, drifting light) plus juice (button scale, particle burst, eased tweens, layered SFX). Abyssal Surge's **always-visible live 3D canvas + dock shell is already this "live background" pattern** — the win is making docks react to and emit from that canvas, not float beside it. `thin evidence`

## Affected Users

- **Instant-play, snackable browser players** (CrazyGames/Poki/itch.io): expect interactivity in seconds, abandon on slow load; first-session clarity + return hooks are load-bearing (cited retention bar D1 35–40%, D7 10–15%). `indexed snippet`
- **Mobile-web, one-handed, touch players** (Abyssal Surge is mobile-first browser): thumb navigation on a small viewport, ≥44–48px targets, thumb-zone primary actions, tap-feedback (no hover), progressive disclosure. `indexed snippet`
- **Idle/incremental veterans**: value systems depth + number-go-up, allergic to hidden info and manipulative check-ins; tolerate dense "zen" UI *if it respects their time*. `indexed snippet`
- **Roguelite/survivor players**: accept death-as-currency but need each defeat translated into a *visible* next step (an Unlocks/objectives surface turning the systems wall into bite-sized goals). `indexed snippet`
- Direct browser-playable competitive set (itch.io "Play in browser", verified live): PHANTOM CIRCUIT, Galaxy Survivor, Shape Ward, Star Harvest — the lobby-quality bar Abyssal Surge is judged against. `direct page retrieval`

## Current Workarounds

- **"Functional is good enough"** (VS): survives on frictionless clarity + audio/number feedback, but its UI is widely called "aesthetically basic/cluttered" — it earns juice mechanically, not presentationally. `indexed snippet`
- **Text-heavy nested menus** (Melvor Idle, browser-playable): ships density instead of animation; recurring cost is "cluttered and overwhelming," "multiple nested menus to perform a single action," wiki-dependence. `indexed snippet`
- **Community mods patch missing juice/clarity** (Melvor): when a lobby is under-juiced, engaged players route around it — but veterans fear a full overhaul that relocates critical info. Implication: add theater *around* the existing dock, don't relocate everything. `indexed snippet`
- **itch.io "Click to play" + static splash**: minimum-viable outgame framing (static image behind a Play button) many web games never exceed — a stand-in for the "living background" juice literature wants. `direct page retrieval`
- What players say is still missing under these workarounds: character ("boring/lacking character, want modern polished look, same functionality") and legibility (info new players skip). `indexed snippet`

## Adjacent Problems

- **First-session clarity vs. systems overload**: Abyssal Surge front-loads warden stats + 5-node skill tree + 5-tier equipment + traits + companions/formation + idle-return — a heavy first-open. Mitigation: an Unlocks/objectives surface + non-skippable-value tooltips; browser onboarding must reach the core loop fast. `indexed snippet`
- **Progression legibility** (Melvor failure mode): each dock must answer "what does this point/tier/node buy me *right now*" inline, not via drill-down. `indexed snippet`
- **Retention hooks / idle-return**: theatricalize the return (motion+sound on the accrued pile) — but a documented backlash exists against "forced daily login" as manipulative; design welcome-back as a reward for returning, not a leash. `indexed snippet`
- **Mobile-web viewport limits**: small screen + touch caps how much juice fits; a left/right dock around a live canvas is viewport-tight on phones — juice must be motion/feedback, not more panels. `indexed snippet`
- **Performance budget** (static Pages + Three.js): every lobby particle/shader competes with the live combat canvas for one browser thread; juice must be cheap (tweens, sprite-sheet FX, pooled particles). Load-time abandonment is real (~53% mobile bounce >3s). `direct page retrieval`
- **"Living hub" north-star** (AFK Journey, native — reference only): animated collected characters that "move, interact, inhabit" the hub; Abyssal Surge can approximate cheaply via its live canvas + reactive FRONT/BACK companions. `indexed snippet`

## User Voices

- On the menu as reward: *"the power-up screen… is a mechanical anchor… you always walk away with a sense of forward momentum."* — VS synthesis (native, ref only). `indexed snippet`
- On flat aesthetics as the complaint even when function is fine: *"a subset of players finds the UI 'boring' or lacking in character, wishing for a more modern, polished look that maintains the same functionality."* — Melvor Idle (browser-playable). `indexed snippet`
- On clutter: *"the sheer number of progress bars, stats, and items often forces players to navigate through multiple nested menus just to perform a single action."* — Melvor Idle. `indexed snippet`
- On legibility pushing players out: *"some skills clearly display expected XP/mastery gains… others do not, leading to confusion and reliance on external wikis."* — Melvor Idle. `indexed snippet`
- On mobile-web lobby jank: *"scrolling through long lists can feel clunky… scaling bugs can cause the interface to appear too large or disjointed on smaller screens."* — Melvor Idle mobile. `indexed snippet`
- On what "alive" means: *"you will see them move, interact with the environment, and inhabit these spaces… vs the static menus typical of many idle RPGs."* — AFK Journey (native, ref only). `indexed snippet`
- On daily-reward backlash: *"a subset find 'forced' daily login rewards manipulative or 'lazy'… a game should be fun enough to warrant a login on its own."* — r/incremental_games. `indexed snippet`
- On juice = redundant feedback: *"a subtle button scale-up, a particle burst… a layered sound effect with randomized pitch… easing functions that make movement feel organic."* — game-feel synthesis. `thin evidence`
- On instant-play impatience: *"users can abandon a game instantly if it doesn't meet performance expectations."* — browser-portal retention synthesis. `indexed snippet`
- Direct browser-playable peer copy: PHANTOM CIRCUIT — *"weapons auto-fire, you move. 12 upgradeable weapons, boss waves, 10-minute runs. HTML5 browser game."* `direct page retrieval`
