# Step 2 — Web-Search Supplement: Browser Outgame / Lobby / Shop References

**Topic:** Web browser game outgame/lobby/shop UX comparable to Abyssal Surge (browser-hosted, mobile-first defense-survivor + persistent RPG metagame + idle-return).
**Date:** 2026-07-27 · **Module:** general-web (Reddit / itch.io / CrazyGames / Poki / blogs). One CN cross-route attempted (H5 挂机RPG) — no strong browser-playable CN idle-RPG surfaced beyond generic dev advice, so nothing added from that lane.

**Evidence ladder** (matches survey convention):
- `direct page retrieval` = I loaded the actual game/listing page and read its metadata/body.
- `indexed snippet` = corroborated via search index / third-party writeups, not the live game page.
- `thin evidence` = single mention or AI-summarized; treat as a lead.

> ⚠️ **Discipline note:** AI search overviews for this topic hallucinate plausible-but-fake titles (e.g. "Grindveil", "CinderHold", "Shadow Survivors on CrazyGames", "Bacon Survivor", "Tower Core Survivors"). Every item below was verified against a real, resolvable URL or dropped. Items I could NOT resolve to a live page are omitted rather than guessed.

---

## Verification vs. Existing Framework

The existing 10 browser-playable items + secondary refs remain valid and well-chosen. Gap check against the framework's own frequency table:
- **Gacha/summon (framework ranked 2/13, "mostly mobile") is materially undercounted** for the *browser* cohort once browser MMORPG-idle titles are included — it is now the single biggest missing item-class. Added below.
- **Animated/living hub (framework pattern 13, "the differentiation gap", 1–2/13 and native-only)** actually HAS browser-playable exemplars — Crystal Saga: Nova (town) and Rumble Heroes (village). This weakens the "browser cohort systematically lacks it" claim and gives Abyssal real browser precedents to point at.
- **Prestige/reset (ascension) outgame** is a distinct meta-shape absent from the framework entirely (framework only models additive permanent upgrades). Added.
- **Currency-regen / energy-timer economy** (distinct from idle accrual) is absent. Added.
No existing item is wrong or redundant; the supplement is purely additive.

---

## Supplementary Items

### A. Browser-playable — genuinely additive (fill named gaps)

- **Crystal Saga: Nova** — *why add:* first **browser-playable living-hub + gacha/summon MMORPG-idle** in the set; directly fills the framework's "animated hub (pattern 13)" gap that was previously native-only, and adds a real gacha exemplar. Class-select destiny screen (Paladin/Mage/Priest/Rogue/Ranger), persistent town hub with auto-navigation to NPCs/quests, boss-battle campaign, daily quests, summon/gear economy. **Browser-playable:** yes, CrazyGames (F5 Game, externally-hosted iframe, **desktop-only**, landscape+portrait). **Released July 2026.** — one-line shape: class-destiny select → living-town hub w/ auto-nav → gacha/gear/daily-quest docks around a persistent world. `direct page retrieval` — https://www.crazygames.com/game/crystal-saga-nova

- **Firestone – Idle Clicker Online RPG** — *why add:* the closest **mobile-web** idle-RPG-hub twin to Abyssal that also runs on phones/tablets (unlike desktop-only Crystal Saga); 5-hero party + hero-summon gacha + guild + campaign-map progression is structurally parallel to Abyssal's companions/formation + progression, and proves the pattern works at ≥44px touch scale. **Browser-playable:** yes — CrazyGames **(browser desktop, mobile, tablet)** + firestonegame.com + iOS/Android + Steam (Unity 6). **Released Apr 2024, last updated June 2026.** — one-line shape: town hub → tavern hero-summon + party-of-5 formation + guild + idle campaign accrual + gear shop. `direct page retrieval` — https://www.crazygames.com/game/firestone-idle-rpg

- **Rumble Heroes (Adventure RPG)** — *why add:* second browser-playable **living-hub** case — a persistent **village you rebuild** (gather wood/ore/meat → construct buildings) is the in-session persistent hub, plus hero-team + gacha-summon rescue-quest loop. Shows a "hub = something you visibly build up" alternative to Abyssal's fixed dock. **Browser-playable:** yes — CrazyGames. — one-line shape: rebuildable village hub + hero roster/summon → dispatch team on rescue quests. `direct page retrieval` — https://www.crazygames.com/game/rumble-heroes

- **WikiGacha (Wikipedia Gacha)** — *why add:* purest **pack-opening / gacha theater + currency-regen timer** exemplar in the set, and it is *browser-native* (not a mobile port). The whole outgame IS the shop: open 5-card booster packs (packs auto-regenerate ~1/min up to a cap), rarity reveal (Common→Legend Rare), collection grid, daily missions. Ideal reference for "make claiming/pulling the theatrical centerpiece" + energy-gated return. **Browser-playable:** yes — wikigacha.com (localStorage save, no account needed). **Viral early 2026.** — one-line shape: booster-pack pull theater → rarity-reveal → collection grid + daily missions, gated by regenerating pack timer. `indexed snippet` (corroborated by Forbes/TheGamer/Reddit writeups; not opened live) — https://wikigacha.com

- **Kill the Lich (KTL)** — *why add:* the set's only **prestige/reset (ascension) outgame** shape — meta is a *reset ritual* that grants random powers per prestige, not a linear permanent-upgrade menu. Distinct progression-surfacing model worth contrasting against Abyssal's additive skill tree. **Browser-playable:** yes — free at stopsign.github.io/KTL/ + Steam. — one-line shape: incremental run → prestige-reset screen granting randomized powers → re-optimized loop. `indexed snippet` — https://stopsign.github.io/KTL/

### B. Browser-playable — the itch.io "minimum-viable outgame" bar (verified live list, 2026)

The itch.io `survivors-like` "Play in browser" tag (44 live HTML5 results, retrieved 2026-07-27) is the low end of the outgame bar Abyssal is judged against — most are a static splash → Play → in-run-only upgrades, with thin/no metagame. Representative *verified-live* entries that DO carry a between-run shop/loot-meta:

- **Blast Zone 2** — survivors-like with an explicit **between-run weapon-upgrade shop** ("Upgrade your weapon and burst through hordes"). **Browser-playable:** yes. `direct page retrieval` — https://pixum.itch.io/blastzone2
- **Scavengers** — bullet-heaven where the meta hook is **loot-collection** ("loot every weapon off the enemies you kill"). **Browser-playable:** yes. `direct page retrieval` — https://inavvaro.itch.io/scavengers
- **REARGUARD** — auto-drop-turret survivors-like (build-the-gauntlet loadout framing). **Browser-playable:** yes. `direct page retrieval` — https://westicles.itch.io/rearguard
- **Vibe Survivors – Neuro-Juice Edition [BETA]** — thin metagame (weapon upgrades + skill fusions + local leaderboard) but a standout **audio-reactive juice** reference: a procedural Web-Audio soundtrack shifting Calm→Tense→Boss with on-screen chaos — the cheap, viewport-safe "theater" the framework wants. **Browser-playable:** yes (HTML5). **In development 2026.** `direct page retrieval` — https://somehow-dev.itch.io/vibe-survivors
- Full live cluster (lobby-quality floor): https://itch.io/games/html5/platform-web/tag-survivors-like `direct page retrieval`

### C. Secondary refs (NOT browser-playable) — outgame/UI inspiration only

- **Asbury Pines** — Steam Early-Access idle (released **2025-11-19**), won community "Best Game Presentation" praise. *Why note:* its **timeline-chart-as-progression-map** and **narrative-drip-inside-the-idle-loop** UI are directly relevant to the framework's "turn progression into a laid-out map, not a list" and "briefings only if actionable" points. **Browser-playable:** NO (Steam/PC). `indexed snippet` — https://store.steampowered.com/ (search "Asbury Pines")
- Existing framework secondary refs (Soulstone Survivors, HoloCure, Brotato, AFK Journey) remain the best aesthetic/structural anchors — no change.

---

## Recommended Supplementary Fields

Each dimension surfaced repeatedly in this pass and is not (fully) captured by the existing framework.

- **platform_reach_and_orientation** — desktop-only vs desktop+mobile+tablet, and landscape-lock vs portrait vs both. *Why:* Abyssal is mobile-first browser; the set splits sharply (Crystal Saga = **desktop-only**, Firestone = **all-platform**). This is the single strongest predictor of whether an outgame layout survives one-handed phone play — belongs beside `viewport_adaptation`/`touch_target_discipline`.

- **host_model** — externally-hosted iframe vs native HTML5 single-file vs static-Pages (GitHub Pages) build. *Why:* determines first-paint budget and how much thread competes with the live combat canvas. Abyssal (static Pages + Three.js) shares KTL's static-Pages constraint; iframe-hosted MMORPGs (Crystal Saga) pay a different cost. Directly informs the framework's performance-budget contradiction.

- **monetization_surface** — how (or whether) rewarded-ad and IAP appear in the shop/return flow: the "Watch ad to **double** your offline/daily reward" button, ad-for-currency, IAP packs. *Why:* in the browser (CrazyGames/Poki) cohort this is load-bearing and it fuses with the idle-return "payday" moment the framework wants to theatricalize — the "double it" choice is simultaneously juice and monetization. Even a single-player no-IAP build must decide its stance here.

- **summon_gacha_presentation** — pull/summon animation, rarity-reveal theater, pity/duplicate handling, multi-pull. *Why:* gacha is far more common in the *browser* set than the framework's "2/13, mostly mobile" implies (Crystal Saga, Firestone tavern, Rumble, WikiGacha). Even if Abyssal never adds gacha, the *reveal theater* is a directly transplantable pattern for its extract/companion unlocks.

- **currency_regen_economy** — timer-gated regenerating resources (energy, booster packs, summon tickets) as a return lever *distinct from* idle accrual. *Why:* WikiGacha's "~1 pack/min up to a cap" is a different re-entry hook than Abyssal's offline-pile accrual; the framework only models idle accrual + (contested) daily-login. This adds a third, less-manipulative-feeling return mechanic.

- **prestige_reset_surface** — presence/shape of a meta-reset/ascension ritual (reset for randomized or multiplied power) vs purely additive permanent upgrades. *Why:* KTL shows an outgame whose *centerpiece* is the reset screen. The framework assumes additive-only progression; this dimension flags a whole alternative meta-loop.

- **onboarding_disclosure** — how much of the outgame is revealed on first open vs progressively unlocked (locked/greyed docks, staged reveals). *Why:* Abyssal's documented risk is a heavy first-open (warden stats + skill tree + equipment + traits + companions + idle). This field lets the survey record who front-loads vs who drip-unlocks docks — the direct mitigation lever.

- **hub_inhabitant_level** — static background vs populated hub (idle NPCs, wandering/collected characters, auto-nav town). *Why:* refines the framework's binary `live_background_present` / "living hub" into a gradient, and — importantly — now has **browser-playable** anchors (Crystal Saga town, Rumble village), not just native AFK Journey. Lets Abyssal target a realistic browser tier (reactive FRONT/BACK companions on the live canvas) rather than an unreachable native bar.

- **notification_badge_system** — unclaimed-reward badges/dots/counters on dock entries that pull re-entry. *Why:* a cheap, viewport-safe retention surface repeatedly cited in the daily-login/return literature; not currently a framework dimension though Abyssal's docks are the natural carrier.

- **audio_feedback_model** — reactive/adaptive music + layered SFX (randomized pitch) as outgame juice. *Why:* the framework's juice axis (`motion_juice_level`, `tap_feedback`) is visual-only; Vibe Survivors' Calm/Tense/Boss engine and the game-feel literature both put *audio* as a primary, cheap juice channel — a missing sibling field to the motion ones.

- **save_persistence_model** — localStorage vs account/cloud vs cross-device sync, plus export/import. *Why:* browser cache-loss is a real churn risk (called out for itch.io/localStorage games); Abyssal already has stronghold export/import — this field lets the survey position that as a genuine differentiator and flag peers that lose progress on cache clear.

---

## Sources

Primary (direct page retrieval, 2026-07-27):
- [itch.io — survivors-like HTML5 tag (44 live browser games)](https://itch.io/games/html5/tag-survivors-like)
- [itch.io — survivors-like, Play-in-browser filter](https://itch.io/games/html5/platform-web/tag-survivors-like)
- [Crystal Saga: Nova — CrazyGames](https://www.crazygames.com/game/crystal-saga-nova)
- [Firestone – Idle Clicker Online RPG — CrazyGames](https://www.crazygames.com/game/firestone-idle-rpg)
- [Rumble Heroes — CrazyGames](https://www.crazygames.com/game/rumble-heroes)
- [CrazyGames — New games (recent-release listing)](https://www.crazygames.com/new)
- [Blast Zone 2 — itch.io](https://pixum.itch.io/blastzone2)
- [Scavengers — itch.io](https://inavvaro.itch.io/scavengers)
- [REARGUARD — itch.io](https://westicles.itch.io/rearguard)
- [Vibe Survivors – Neuro-Juice Edition — itch.io](https://somehow-dev.itch.io/vibe-survivors)

Corroborating (indexed snippet / third-party):
- [WikiGacha — official site](https://wikigacha.com) + [Forbes / TheGamer coverage of WikiGacha (viral early 2026)](https://www.thegamer.com/)
- [Kill the Lich — browser build](https://stopsign.github.io/KTL/) + [r/incremental_games discussion](https://www.reddit.com/r/incremental_games/)
- [r/incremental_games — Best Web Games 2025 community results (Shark Incremental, Kill the Lich, Biotomata, Asbury Pines)](https://www.reddit.com/r/incremental_games/)
- [Asbury Pines — Steam (narrative-first idle UI; NOT browser)](https://store.steampowered.com/)
- [IdleDB — browser-idle database (platform filter)](https://idledb.org)
- Web-game retention/UX practice (welcome-back count-up + "double it", daily-login streaks, battle-pass countdown, rewarded-ad hybrid monetization, glassmorphism) — synthesized from GDC/dev writeups surfaced this pass (gameanatomy.blog, balancy.co, teamofkeys.com); `thin evidence`, treat as pattern leads not specific-game claims.

---

### Handoff note to parent
Merge the 5 "Section A" items as new browser-playable comparables (gacha + living-hub + prestige gaps), keep Section B as the itch.io floor reference, and Asbury Pines as a secondary UI ref. The 11 supplementary fields extend — not replace — the existing dimensions; `platform_reach_and_orientation`, `monetization_surface`, `summon_gacha_presentation`, and `hub_inhabitant_level` are the highest-value additions for an evidence-led "make the outgame game-like" pass. Note the corrected finding: the "living hub" pattern is NOT browser-absent — Crystal Saga and Rumble are live browser proof, so Abyssal's live-canvas hub is an achievable-tier target, not a native-only aspiration.
