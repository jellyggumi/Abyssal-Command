# Reference Systems: The Riftbreaker, Dungeon Defenders, and Orcs Must Die! 3

**Research date:** 2026-07-26  
**Decision served:** Abyssal Surge Cinder Span defense/offense RPG loop  
**Scope:** character action over defense; build/combat alternation; RPG/loadout progression; placement feedback; lane readability; stage pacing; death/recovery; control responsiveness.

## Evidence legend and limits

- **OBSERVED** — directly stated or described by a cited source. This means *source-observed*, not that this research lane personally played the reference title.
- **INFERENCE** — a design conclusion drawn from one or more observations. It is not presented as a feature fact.
- **TARGET** — a proposed Abyssal Surge behavior or evaluation target. It does not claim the current build already behaves this way.
- “Responsiveness” below means control/interaction feel reported by reviewers or implied by documented interaction structure. None of the sources publishes input-latency measurements, so this report makes no millisecond-latency claims.
- The original 2011 **Dungeon Defenders** is the reference, not *Dungeon Defenders II* or *Dungeon Defenders: Awakened*. Death behavior is the least well documented dimension for that original release; the community reference is identified as lower confidence rather than upgraded to an official claim.

## Source register

### The Riftbreaker

- **R1 — primary:** EXOR Studios, official game overview, [https://www.riftbreaker.com/](https://www.riftbreaker.com/)
- **R2 — primary:** Steam store page, [https://store.steampowered.com/app/780310/The_Riftbreaker/](https://store.steampowered.com/app/780310/The_Riftbreaker/)
- **R3 — primary:** EXOR Studios, “The Death Skull System Explained” (2025-07-31), [https://www.exorstudios.com/blog/death-skull-system](https://www.exorstudios.com/blog/death-skull-system)
- **R4 — strong secondary:** Rock Paper Shotgun, “The Rally Point: The Riftbreaker is light on strategy but carries a lot with it” (2021-10-29), [https://www.rockpapershotgun.com/the-rally-point-the-riftbreaker-is-light-on-strategy-but-carries-a-lot-with-it](https://www.rockpapershotgun.com/the-rally-point-the-riftbreaker-is-light-on-strategy-but-carries-a-lot-with-it)

### Dungeon Defenders (2011)

- **D1 — primary:** official game site, [https://dungeondefenders.com/](https://dungeondefenders.com/)
- **D2 — primary:** Steam store page, [https://store.steampowered.com/app/65800/Dungeon_Defenders/](https://store.steampowered.com/app/65800/Dungeon_Defenders/)
- **D3 — strong secondary:** PC Gamer review (2011-11-16), [https://www.pcgamer.com/dungeon-defenders-review/](https://www.pcgamer.com/dungeon-defenders-review/)
- **D4 — secondary, valuable for phase/camera specifics:** TheGamingReview review (2012-01-05), [https://www.thegamingreview.com/3036/2012/01/05/review-dungeon-defenders/](https://www.thegamingreview.com/3036/2012/01/05/review-dungeon-defenders/)
- **D5 — community reference, moderate confidence:** Dungeon Defenders Wiki, “Death,” [https://dungeondefenders.fandom.com/wiki/Death](https://dungeondefenders.fandom.com/wiki/Death)

### Orcs Must Die! 3

- **O1 — primary:** Robot Entertainment official page, [https://robotentertainment.com/omd3](https://robotentertainment.com/omd3)
- **O2 — primary:** Steam store page, [https://store.steampowered.com/app/1522820/Orcs_Must_Die_3/](https://store.steampowered.com/app/1522820/Orcs_Must_Die_3/)
- **O3 — strong secondary:** PC Gamer review (2021-07-26), [https://www.pcgamer.com/orcs-must-die-3-review/](https://www.pcgamer.com/orcs-must-die-3-review/)
- **O4 — strong secondary:** Shacknews review (2021-08-05), [https://www.shacknews.com/article/125992/orcs-must-die-3-review-the-next-generation-of-tower-defense](https://www.shacknews.com/article/125992/orcs-must-die-3-review-the-next-generation-of-tower-defense)
- **O5 — community report on the official developer forum, lower confidence for current behavior:** “Penalty for Dying?” [https://forums.robotentertainment.com/t/penalty-for-dying/2153](https://forums.robotentertainment.com/t/penalty-for-dying/2153)

## Cross-title finding

**INFERENCE:** All three hybrids make the avatar valuable when defenses are imperfect, not as a substitute for understanding the defense state. Their strongest shared pattern is therefore not “tower defense plus attacks.” It is a causal handoff:

`read threat → commit a spatial/systemic preparation → start or absorb pressure → use direct action to correct a leak → see whether the preparation worked → recover and recommit`

**INFERENCE:** Their weakest common failure mode is attention competition. Spectacle, loot, fixed cameras, long traversal, narration, and multi-lane emergencies can all prevent the player from understanding *why* a defense held or failed. That is directly relevant to Cinder Span, whose contract requires the player to read pressure, choose growth/formation/extraction, and see persistence without changing deterministic outcomes.

---

## 1. The Riftbreaker

### System shape

The Riftbreaker is the broadest hybrid in this set: top-down mech action, research and crafting, exploration, automated resource production, base construction, and wave defense. It is useful as a reference for continuous action/management interleaving, but its multi-hour economic campaign is not a compatible scope model for a 30–180 second Cinder sortie.

### Character action layered over defense

- **OBSERVED:** The official store describes a player-controlled mech fighting “countless hordes,” building a base, crafting weapons, and researching inventions; the official site likewise presents base building, survival, and hack-and-slash together rather than as separate modes. [R1][R2]
- **OBSERVED:** Rock Paper Shotgun calls it a hybrid of looter-shooter action RPG and wave-defense base building. The mech can equip three weapons on each arm plus abilities, armor, mines, repair tools, shockwaves, and cloak. The reviewer can personally defend exposed sites or rely on a heavily turreted base. [R4]
- **INFERENCE:** The avatar is a mobile risk budget. Strong fixed defenses buy the player freedom to explore; weak or deliberately cheap outposts demand personal intervention. Direct action is valuable because it can be moved to the currently failing edge.
- **TARGET:** Abyssal Surge should make the Warden/formation the mobile correction layer: formation or skill input should answer a visibly identified pressure packet, not merely add anonymous damage everywhere.

### Build/combat alternation

- **OBSERVED:** The Riftbreaker does not enforce the hard preparation/combat split seen in Dungeon Defenders. RPS describes building, research, exploration, cleanup, and wave emergencies as interleaved, with most tasks able to wait except immediate repair and defense. It also lets the player choose pace through behavior: push into wilderness, teleport home when threatened, or stay and consolidate. [R4]
- **OBSERVED:** Outposts can automate remote extraction and act as places the player revisits; the strategic question becomes whether to create a few defensible sites or many cheap, exposed ones. [R4]
- **INFERENCE:** This is a “soft alternation” model: warnings and local emergencies change priority without changing the ruleset. Its advantage is continuity; its risk is cognitive collision when urgent waves, low-value notifications, and dialogue compete.
- **TARGET:** Cinder Span should retain continuous simulation but create readable micro-handoffs at phase changes: threat cue, bounded decision window, accepted-input confirmation, then consequence. Do not import a separate construction phase.

### RPG/loadout progression

- **OBSERVED:** Research supplies the mech with weapons, defenses, armor, and abilities; RPS reports that unlocks feel additive and that the player can keep multiple weapons rather than simply discard every earlier tool. [R2][R4]
- **OBSERVED:** The source describes both combat gear and base technology as progression outputs, so one research economy feeds both sides of the hybrid. [R2][R4]
- **INFERENCE:** Progression is legible when each unlock widens possible responses—personal weapon, repair, mobility, or fortification—rather than presenting undifferentiated stat gain.
- **TARGET:** A Cinder growth offer should name the affected tactical response and preserve defense context: e.g. show what pressure/formation/extraction consequence the choice changes. The next-sortie Elite state should be visible as a persistent capability, not buried in a generic inventory.

### Tower placement feedback

- **OBSERVED:** The official overview and store establish walls, towers, mines, power systems, and base layouts as manipulable defenses; RPS describes layered walls, repair towers, weapon towers, and deliberately armed or disposable outposts. [R1][R2][R4]
- **OBSERVED:** The critical feedback is systemic and delayed: an exposed resource site either survives, requires the mech, or must be rebuilt. RPS’s own base became an “haphazard mess,” demonstrating that freedom of layout does not itself create clear evaluation. [R4]
- **INFERENCE:** Riftbreaker’s most transferable placement feedback is not its construction cursor. It is the visible ownership of risk: “this site has token defense, so I must cover it.” The incompatible part is its large construction vocabulary and economy.
- **TARGET:** Translate “placement” into formation geometry and objective radius. Before accepting a formation/hold input, preview affected companions/objective zone; after acceptance, show the stance, cooldown, and pressure consequence from the authoritative snapshot.

### Enemy lane readability

- **OBSERVED:** RPS praises the action spectacle but explicitly says still images become unreadable explosions of color and light. It also reports unexplained map icons, low-urgency “storage full” messages, and long conversations colliding with a major wave. [R4]
- **OBSERVED:** Threat direction is spatially broad because multiple base edges/outposts can be attacked, rather than being a single authored corridor. [R2][R4]
- **INFERENCE:** Spectacle can communicate impact while destroying causal readability. A wide perimeter additionally makes direction and priority more important than exact enemy count.
- **TARGET:** Cinder should spend visual priority on one threatened objective/lane and the next irreversible event. VFX may intensify after the threat marker is readable, not cover the marker, objective integrity, or extraction zone.

### Stage pacing

- **OBSERVED:** The campaign lets the player self-pace expansion and recover as long as the HQ remains intact; the reviewer describes scaling down and rebuilding after losses rather than entering an inevitable failure spiral. [R4]
- **OBSERVED:** The same review identifies a pacing failure when dialogue and low-priority notifications continue through a large wave. [R4]
- **INFERENCE:** Player-controlled strategic tempo is valuable in a long campaign, but Cinder’s short authored loop needs controlled cadence. The transferable principle is reprioritization, not freeform expansion time.
- **TARGET:** Keep Cinder inside the existing 30–180 second permitted loop and 45-second intended cadence. Suppress/queue nonessential presentation during the bounded extraction decision; never suppress pressure, integrity, stance, or extraction facts.

### Death/recovery

- **OBSERVED:** EXOR’s 2.0 Death Skull article says the first destruction reconstructs the mech at HQ, drops some weapons, and adds a temporary skull marker. A repeated death within the default 90-second timeout increases revive/reconstruction friction and can cost a percentage of Carbonium/Ironium; custom difficulty exposes the parameters. Co-op can revive a fallen mech on the battlefield. [R3]
- **OBSERVED:** EXOR explains the reason: players weaponized the mech’s death explosion and co-op revive bonuses, making survival trivial, so repeated-death cost was added without making one mistake terminal. [R3]
- **INFERENCE:** This is a recovery-with-memory pattern. The first failure returns the player quickly; repeated reckless use creates a short-lived consequence tied to the exploit.
- **TARGET:** Do not add a new death economy to the frozen simulation. Presentation should instead preserve the existing terminal/defeat reason, show what irreversible event caused failure, and give a clear return/re-entry cue. If later design observes deliberate failure exploitation, measure it before proposing a bounded consequence.

### Control responsiveness

- **OBSERVED:** RPS repeatedly emphasizes immediacy: the initial verbs are understandable quickly, combat continues during consolidation, and the player can teleport back to defend. It also calls the action simple rather than mechanically deep. [R4]
- **OBSERVED:** The source does not provide latency data or a detailed camera-control evaluation. [R4]
- **INFERENCE:** Perceived responsiveness comes from low-friction priority switching and powerful immediate verbs, not only animation speed. The cost is that simple, spectacular action can dominate quieter strategic information.
- **TARGET:** Warden movement/orbit and tactical input need immediate acknowledgement: accepted input, target/stance, and cooldown must update together from the authoritative snapshot. This is a presentation requirement, not permission to write back into the simulation.

### Transferability verdict

- **INFERENCE — transfer:** continuous simulation with soft priority changes; the avatar as a mobile leak-fixer; additive progression; rapid nonterminal recovery; clear risk ownership.
- **INFERENCE — reject:** open-world extraction economy, freeform base sprawl, six-weapon mech complexity, and screen-filling horde spectacle. These assume a long logistics campaign and much larger action budget than Cinder Span.

---

## 2. Dungeon Defenders (2011)

### System shape

Dungeon Defenders is the clearest strict-phase reference: place class-specific defenses, start a combat wave, fight beside the defenses, collect mana/loot, then rebuild. It is especially useful because the reviews document both why the combination works and where camera, traversal, combat feel, and resource ownership break it.

### Character action layered over defense

- **OBSERVED:** The official store calls it a four-player co-op Tower Defense Action-RPG in which the player summons defenses and directly participates in combat. [D2]
- **OBSERVED:** PC Gamer describes a Squire killzone built from a piercing harpoon, damaging barricades, and a knockback turret; the player then helps where enemies leak. The review says multiplayer works because players can own one stream or one defense function. [D3]
- **OBSERVED:** TheGamingReview describes the recurring panic sprint to intercept a goblin that escaped the towers. [D4]
- **INFERENCE:** The defense creates an authored problem for the avatar: cover the leak, repair the weak lane, or reinforce a teammate. This is stronger than simply letting both avatar and tower hit the same target.
- **TARGET:** Cinder’s formation/skill affordance should be presented as a response to a named packet or leak. The HUD should attribute the resulting protection/damage after the accepted switch tick so the player can learn why it worked.

### Build/combat alternation

- **OBSERVED:** TheGamingReview explicitly documents two wave parts. Build phase allows unlimited time to place defenses, change equipment, or change character; the player manually starts combat when ready. [D4]
- **OBSERVED:** PC Gamer reports that solo setup can take too long: gathering mana, placing defenses, and walking between sites all add delay. [D3]
- **INFERENCE:** A hard phase boundary protects thinking time and makes commitment explicit, but unlimited preparation plus spatial errands can turn agency into friction.
- **TARGET:** Borrow the explicit handoff—“decision accepted; pressure resumes”—without borrowing unlimited build time. Cinder’s growth/formation/extraction windows must stay bounded and visible inside its 30–180 second sortie.

### RPG/loadout progression

- **OBSERVED:** The official store promises character customization, leveling, equipment forging, loot, pets, difficulty modes, and challenge/survival missions. [D2]
- **OBSERVED:** PC Gamer reports regularly unlocked class abilities; level points can strengthen hero combat or defenses; randomized items can be improved by investing gold in a chosen magical property. [D3]
- **OBSERVED:** TheGamingReview similarly reports points split between tower characteristics and personal speed/health/damage, plus armor, weapons, and class switching. [D4]
- **INFERENCE:** The compelling choice is role direction—builder strength versus fighter strength—not raw quantity of loot. However, heavy vertical stats and random drops can make encounter comprehension depend on prior grind.
- **TARGET:** Cinder growth should expose one immediate tactical tradeoff and remain comparable across deterministic seeds. Do not import randomized loot, item rarity, or a builder/DPS gear divide into the current loop.

### Trap/tower placement feedback

- **OBSERVED:** PC Gamer’s placement example gives clear geometric intent: put a piercing harpoon off the path, hold enemies in its firing arc with barricades, and knock them back inside the chokepoint. The resulting synergy is understandable as path + arc + displacement. [D3]
- **OBSERVED:** The same review says turret projectiles lack weight, reducing moment-to-moment confirmation that placed defenses are doing work. [D3]
- **OBSERVED:** TheGamingReview says the fixed three-or-four-position camera makes precise tower placement frustrating; similar camera angles can even make a camera-change input appear unrecognized. [D4]
- **INFERENCE:** Placement needs three distinct feedback layers: legal footprint, effective geometry before commitment, and impact attribution after commitment. Missing any one turns planning into memorization or guesswork.
- **TARGET:** For formation changes, show legal/accepted state, which FRONT identities/zone will change, and the post-switch consequence. A camera/orbit input must visibly move or confirm a boundary state; never leave the player unsure whether it registered.

### Enemy lane readability

- **OBSERVED:** PC Gamer describes enemies as streams moving through a maze toward the Eternia Crystal and shows a player owning “one particular path.” [D3]
- **OBSERVED:** TheGamingReview says later maps add crystals and change layouts, forcing strategy adaptation; PC Gamer says solo play requires substantial running between enemy streams. [D3][D4]
- **INFERENCE:** Fixed paths and crystals create a comprehensible defense graph, but multiple objectives plus slow traversal can overload the player. Multiplayer masks this by assigning ownership per stream.
- **TARGET:** Because Abyssal Surge has one commander and a small formation, its presentation must perform the ownership assignment: identify the currently threatened objective/lane, packet policy, remaining pressure time, and next irreversible event without requiring a debug view.

### Stage pacing

- **OBSERVED:** Build time is unbounded and combat is manually started, giving ample time to plan. [D4]
- **OBSERVED:** PC Gamer criticizes long solo cycles of scavenging, placement, and traversal, while praising the strategic pleasure of choosing where to concentrate effort and resources. [D3]
- **INFERENCE:** Deliberation is valuable only when each second contains a meaningful decision. Time spent walking to construction sites or waiting for mana does not improve the defense decision.
- **TARGET:** Cinder should provide short decision pauses/slow points only where the player can actually choose growth, formation, or extraction. World travel and camera motion must not consume the extraction window invisibly.

### Death/recovery

- **OBSERVED (moderate confidence):** The community “Death” reference for the original game documents timed respawn in standard play and distinguishes modes where combat-phase death prevents respawn until the wave ends. This detail is not corroborated by the current official store page. [D5]
- **INFERENCE:** Temporary removal raises pressure on the remaining defense without deleting long-term progression. No-respawn variants work because the wave is a clear recovery boundary.
- **TARGET:** Cinder recovery should use its existing sortie/result boundary and retain the causal failure reason. Do not copy a multiplayer spectator timer or hardcore no-respawn rule into a solo deterministic loop.

### Control responsiveness

- **OBSERVED:** PC Gamer calls combat stiffly animated and unconvincing and says tower projectiles lack weight. [D3]
- **OBSERVED:** TheGamingReview reports precise placement frustration from fixed camera angles and cases where a camera input appears not to have been recognized. [D4]
- **INFERENCE:** Even tactically sound systems feel unresponsive when animation, projectile impact, camera response, and placement confirmation fail to close the input-feedback loop.
- **TARGET:** Treat camera orbit, formation switch, growth choice, and extraction acceptance as four explicit feedback loops: input acknowledged; state changed or rejection explained; visual consequence shown; cooldown/progress remains visible.

### Transferability verdict

- **INFERENCE — transfer:** clear preparation-to-pressure handoff; path/arc/displacement synergy; hero as leak response; progression choices that distinguish personal and defense roles; wave boundary as recovery point.
- **INFERENCE — reject:** unlimited preparation, long construction traversal, random loot grind, multiplayer-only lane ownership, fixed-camera placement, and weak impact feedback. These conflict with a short solo web sortie and its immediate readability goal.

---

## 3. Orcs Must Die! 3

### System shape

Orcs Must Die! 3 is the strongest moment-to-moment reference in this group for authored corridors, killboxes, visually legible trap chains, and a hero who plugs gaps without becoming a full character-action game. It is also a warning that direct combat should remain deliberately simpler than the defense problem.

### Character action layered over defense

- **OBSERVED:** The official store describes slicing, burning, tossing, zapping, grinding, and gibbing hordes with weapons and traps. [O2]
- **OBSERVED:** PC Gamer says combat begins when traditional tower defense might ask the player to sit back. The hero shoots, freezes, knocks back, and personally catches fast enemies that slip through, while traps remain the main strategic structure. [O3]
- **OBSERVED:** PC Gamer explicitly argues that deeper action combat would steal too much focus; it characterizes combat as relatively simple and says its real purpose is dynamically plugging trap gaps. [O3]
- **INFERENCE:** The avatar has a crisp job description: exception handler. The player should feel skillful for noticing and correcting a leak, while the stage still teaches whether the killbox/formation was sound.
- **TARGET:** Warden actions should resolve a readable exception—rusher, exposed front, extraction interruption—not become a parallel DPS game that obscures the formation decision.

### Build/combat alternation

- **OBSERVED:** PC Gamer describes each level beginning with a pre-allocated budget used to buy, rotate, and place traps. Doors then open; after the wave, the player builds out the design and repeats until the final wave. [O3]
- **OBSERVED:** Shacknews describes money awarded after rounds and from kills, with the player able to add traps during an active round when enough money becomes available. [O4]
- **INFERENCE:** The model combines hard macro alternation with soft midwave correction: safe planning establishes the killbox, while limited live resources allow an emergency patch.
- **TARGET:** Cinder already has continuous deterministic pressure, so borrow the explicit state handoff and live correction feedback—not a coin economy or free trap placement.

### RPG/loadout progression

- **OBSERVED:** PC Gamer describes an authored arsenal, specialized trap sequences for combo scoring, a later acid geyser addition, and Scramble mode’s between-stage choice of a buff against an accumulating debuff. [O3]
- **OBSERVED:** The official store describes War Scenarios with oversized machines and Scramble as five levels with accumulating modifiers. [O2]
- **INFERENCE:** OMD3 progression is closer to tactical loadout mastery than loot-RPG verticality. Long-term engagement comes from learning interactions, ordering traps, and adapting a selected kit.
- **TARGET:** Present Cinder growth and Elite persistence as authored modifiers with named consequences. Avoid inventory volume; one visible, attributable choice is more compatible with the short loop.

### Trap placement feedback

- **OBSERVED:** PC Gamer’s basic loop explicitly includes buying, rotating, and placing traps. It highlights readable physical outcomes—launching, burning, electrifying—and learnable geometry such as saw-blade ricochets at predictable 45-degree wall bounces. [O3]
- **OBSERVED:** Shacknews praises the visual/auditory payoff of sequential traps: spring, spike, pound, and coin reward. It also notes that barricades redirect streams into killboxes and that build combinations are a major source of experimentation. [O4]
- **INFERENCE:** OMD3 closes the placement loop exceptionally well: previewed spatial commitment, exaggerated per-trap activation, chain order, and reward all expose causality.
- **TARGET:** A Cinder formation switch should have equivalent causal layers: pre-switch zone/role preview, accepted stance banner, visible companion reposition/protection, and a compact consequence readout. Do not imitate gore/spectacle; imitate attribution.

### Enemy lane readability

- **OBSERVED:** PC Gamer describes enemies entering through doors and moving down halls and stairs toward the portal. Map geometry itself establishes lanes and creates enclosed spaces for predictable ricochet/trap interactions. [O3]
- **OBSERVED:** Shacknews notes that levels can open multiple doorways, requiring the player to scan for which route is active and adjust traps during the round. [O4]
- **INFERENCE:** Authored corridor geometry makes local behavior legible, but third-person ground-level perspective can hide simultaneous doors. The player needs both world cues and a compact global threat summary.
- **TARGET:** Give Cinder one world-space lane/packet cue plus one HUD threat summary. The same source-of-truth snapshot should drive both so direction, objective, and remaining time cannot disagree.

### Stage pacing

- **OBSERVED:** OMD3 repeats budgeted preparation, active wave, result, and added construction until a final wave. [O3]
- **OBSERVED:** War Scenarios magnify the horde scale, while Scramble spans five stages with one shared rift-point pool and escalating buffs/debuffs. [O2][O3]
- **OBSERVED:** Shacknews reports that later waves and multiple doors require continual monitoring and midround adaptation. [O4]
- **INFERENCE:** Escalation remains readable because it is nested: trap activation inside a wave, wave inside a level, level inside a five-stage modifier run. The risk is that scale and simultaneous entrances can exceed camera attention.
- **TARGET:** Cinder’s nesting should remain compact: packet → objective phase → sortie → persistent Elite/re-entry. Each transition should show what changed and what decision becomes available next.

### Death/recovery

- **OBSERVED (lower confidence):** A community answer on Robot Entertainment’s official forum reports that player death respawns at the Rift/portal and does not itself subtract Rift points; Rift points are lost when enemies enter. The thread is not an official rules page and should not be treated as authoritative for every current mode/patch. [O5]
- **INFERENCE:** Low direct death cost keeps attention on the defended objective, but it can make intentional death a mobility/resource exploit if the respawn is advantageous. This report does not find sufficiently strong primary evidence to transfer OMD3’s exact penalty model.
- **TARGET:** Preserve Cinder’s existing outcome rules. Show commander defeat separately from gate/objective loss, state the causal terminal reason, and verify recovery/re-entry in live play rather than assuming OMD3-style forgiveness is appropriate.

### Control responsiveness

- **OBSERVED:** PC Gamer reports fast gap-plugging actions—headshots, freeze bombs, sweeping knockback—but deliberately limited action depth. [O3]
- **OBSERVED:** Shacknews says the game runs smoothly but describes the player needing to constantly check open doorways and repair/adapt defenses. [O4]
- **INFERENCE:** Responsiveness here is functional: aim, fire, knockback, and reposition are quick enough to rescue a leak. The control set stays shallow so attention can return to the defense graph.
- **TARGET:** Keep Cinder’s immediate controls small and role-clear. Movement/orbit, formation, skill/growth, and extraction must be discoverable and acknowledged without opening a debug panel; extra action verbs are out of scope unless real play proves a missing response.

### Transferability verdict

- **INFERENCE — transfer:** avatar as exception handler; explicit build-to-wave handoff; learnable spatial cause/effect; exaggerated but ordered activation feedback; world lane plus global monitoring; authored modifier choices.
- **INFERENCE — reject:** third-person corridor dependence, coin-funded live trap placement, massive War Scenario hordes, gore-driven payoff, and action-combo score chasing. These are genre- and camera-specific assumptions.

---

## Abyssal Surge transfer matrix

| Design dimension | The Riftbreaker evidence | Dungeon Defenders evidence | Orcs Must Die! 3 evidence | Abyssal Surge decision |
|---|---|---|---|---|
| Character action over defense | Mobile mech personally covers risky perimeter/outposts; action is immediate and broad. | Hero reinforces class defenses and intercepts lane leaks; multiplayer assigns stream ownership. | Hero is explicitly a dynamic gap-plugger; deeper action would steal focus. | **TARGET — High transfer:** Warden/formation input answers a named pressure packet or leak. Direct action must reveal, not replace, the defense decision. |
| Build/combat alternation | Soft alternation: tasks coexist; emergencies reprioritize. | Hard, player-started build/combat phases; safe planning but potentially slow. | Hard between-wave planning plus limited midwave correction. | **TARGET — Hybrid:** continuous deterministic simulation with explicit, bounded threat/decision/consequence handoffs. No separate base-building mode. |
| RPG/loadout progression | Additive research widens mech and base options. | Hero-versus-defense stats, class abilities, random loot, item investment. | Authored arsenal mastery and between-stage modifiers. | **TARGET — Selective:** one named growth/Elite modifier with immediate tactical and next-sortie consequence. Reject random loot and grind. |
| Placement/formation feedback | Systemic risk ownership; free layouts can become unreadable sprawl. | Strong path/arc/displacement logic; weak impact weight and fixed camera hurt confirmation. | Strong spatial commitment, exaggerated trap activation, chain attribution, predictable ricochet. | **TARGET — High transfer:** preview affected formation/zone, confirm accepted state, show resulting protection/damage/hold consequence from snapshot. |
| Lane readability | Wide perimeter; spectacle, icons, notifications, and dialogue compete. | Maze streams and crystals are clear locally; multiple objectives/travel overload solo attention. | Corridors/doors are legible locally; multiple doorways demand global scanning. | **TARGET — High transfer:** world cue + HUD threat summary for one current packet, objective integrity, remaining time, next irreversible event. |
| Stage pacing | Player-controlled campaign tempo and recovery; notification collisions are a warning. | Unlimited preparation protects thought but setup/traversal can drag. | Nested preparation/wave/level/Scramble escalation. | **TARGET — Bounded:** retain 45 s intended / 30–180 s permitted loop. Pause or quiet presentation only around real choices; never hide pressure facts. |
| Death/recovery | Official 2.0 system gives quick first recovery and temporary repeated-death memory. | Timed standard respawn and wave-boundary hardcore recovery are community documented. | Official-forum community report says respawn at Rift without direct Rift-point loss; lower confidence. | **TARGET — Presentation only:** preserve current deterministic outcome rules; expose terminal cause and return/re-entry state. No new penalty system. |
| Control responsiveness | Immediacy comes from rapid priority switching and powerful verbs; no latency data. | Fixed camera can make input look ignored; combat/impact feel stiff. | Simple fast verbs let player correct leaks and return attention to strategy. | **TARGET — High transfer:** every input closes acknowledgement → state/rejection → consequence → persistent progress/cooldown loop. No unacknowledged orbit/formation/extract input. |
| Spectacle budget | Gorgeous color/light can make causal state unreadable. | Weak projectile weight makes successful defenses feel inert. | Exaggerated physical/audio trap response makes chain causality readable. | **TARGET — Calibrated:** enough impact to identify cause; never cover threat, integrity, stance, hold, ready/failed, or accepted extraction. |
| Genre compatibility | Low for economy/base scope; high for continuous priority and recovery. | Medium: phase clarity and spatial synergy transfer; co-op/loot assumptions do not. | High for moment-to-moment defense/action causality; camera/coin/gore assumptions do not. | **TARGET:** synthesize priority handoff + geometric attribution + exception-handler action, within a read-only presentation layer. |

## Concrete Cinder Span target sequence

1. **TARGET — Threat:** a world lane/packet cue and HUD line identify the threatened objective, arrival policy, remaining pressure time, gate integrity, and commander integrity.
2. **TARGET — Decision:** the available growth, formation, or extraction action is visually distinct; formation/hold geometry is previewed before commitment where applicable.
3. **TARGET — Acknowledgement:** accepted input immediately reports the accepted event, target stance/choice, cooldown or hold progress, and any rejection reason.
4. **TARGET — Consequence:** post-input protection, damage, companion state, extraction progress, or failure is attributed after the authoritative accepted tick; VFX reinforce rather than obscure it.
5. **TARGET — Recovery/re-entry:** the result names terminal cause or extraction result, then shows the persistent Elite state in the next sortie without changing simulation or campaign authority.

**INFERENCE:** This sequence is the compatible intersection of the three references. It borrows Riftbreaker’s soft priority changes, Dungeon Defenders’ explicit commitment boundary and spatial defense logic, and OMD3’s gap-plugging hero plus strong activation attribution. It deliberately excludes all three titles’ incompatible campaign economies and scale assumptions.

## Five transferable rules

1. **Make the avatar an exception handler, not a second opaque damage engine.** A direct action should answer a named leak, packet, exposed front, or interrupted extraction and visibly close that cause/effect loop.
2. **Separate thinking from pressure with an explicit handoff, even when simulation never stops.** Cue threat, expose a bounded choice, acknowledge commitment, then show the irreversible consequence; do not require a full construction phase.
3. **Give every spatial decision preview, acceptance, and attribution.** Show the affected lane/formation/zone before input, confirm the authoritative state after input, and identify what protection, damage, or progress changed.
4. **Use both world-space and global threat readability.** World cues teach where pressure travels; a compact HUD states objective, integrity, remaining time, stance/cooldown, and extraction state when camera attention is elsewhere.
5. **Recover quickly while preserving causal memory.** A failure/result should name what caused it and make return/re-entry state legible; do not erase learning, and do not invent new punishment without observed exploit evidence.

## Three anti-patterns

1. **Do not import the reference games’ scope:** no open-world base economy, random-loot grind, coin-funded trap builder, multiplayer lane-role dependency, or War Scenario horde scale in a 30–180 second deterministic web sortie.
2. **Do not let spectacle or chatter outrank state:** screen-filling VFX, generic notifications, dialogue, and impact noise must never cover the threatened objective, integrity, formation, extraction window, accepted input, or terminal cause.
3. **Do not accept an ambiguous control loop:** fixed-camera uncertainty, unacknowledged orbit/formation/extraction inputs, visually weightless consequences, and hidden rejection are failures even when the underlying deterministic command executed correctly.
