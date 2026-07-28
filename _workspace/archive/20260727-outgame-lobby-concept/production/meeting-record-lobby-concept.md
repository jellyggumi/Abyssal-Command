# Meeting Record — Outgame Lobby (+Shop) Concept, decided direction

```yaml
run_id: 20260727-outgame-lobby-concept
meeting_type: concept/direction (lobby-first), NOT implementation
attendees: [game-production-director (chair), game-designer, ui-senior-developer, game-programmer]
constraints_held_by_chair_for: [game-pm (economy/retention), game-qa (accessibility/perf gates)]
inputs:
  - _workspace/20260727-outgame-reference-survey/  (survey: 13 browser comparables, 9 reference images, A1-A6 shortlist)
  - research/web-outgame-lobby-shop-reference/  (deep-research outline + fields + 12-month web supplement)
  - messages/position-{designer,ui,programmer}.md  (3 independent positions)
scope_this_pass: the 출정 sortie/launch LOBBY + its shop-adjacent surfaces (currency readout, reward claim, idle-return payday)
out_of_scope_this_pass: full growth/companion/inventory/stronghold dock interiors (touched only where they meet the lobby)
```

## New evidence since the survey (deep-research 12-month supplement)

- **Correction that changes the thesis**: the "living hub" (pattern 13) is **NOT browser-absent**. Crystal Saga: Nova (auto-nav town) and Rumble Heroes (rebuildable village) are live browser proof. So our always-visible live-canvas hub is an **achievable browser-tier target, not a native-only aspiration** — it strengthens the A6 "docks emit from the world" direction rather than making it exotic.
- **Firestone – Idle Clicker Online RPG** (all-platform browser, mobile+tablet) is now the closest mobile-web idle-RPG-hub twin: town hub + tavern hero-summon + party-of-5 formation + gear shop + idle accrual — proof the exact pattern set survives one-handed phone play.
- **Shop/economy sharpened** (the user explicitly added 상점/shop to scope): WikiGacha = pull/pack-open theater + **currency-regen timer** return economy; the browser cohort's shop juice centers on **rarity-reveal theater** + a **"watch ad to DOUBLE your reward"** button that fuses monetization with the idle-return payday.
- **New dimensions worth holding in mind** even if unused now: `monetization_surface`, `summon_gacha_presentation`, `prestige_reset_surface`, `notification_badge_system`, `audio_feedback_model` (Vibe Survivors' cheap Calm/Tense/Boss adaptive audio is a real juice channel we ignored).

## The three positions (one line each)

- **Designer** — the 출정 lobby becomes a **war-room aperture onto the 심연**: Dusk Warden at the 재의 봉쇄선 looking OUT into the dark, docks bolted to the rim, live canvas = diegetic map (stage-select re-focuses the scene), briefing `<dl>` demoted to a reward-forward threat-read, idle-return = zenith-gold "payday" count-up. Palette discipline: **gold = reward only**.
- **UI** — theater budget is **viewport-asymmetric**: full canvas loadout-theater on desktop/wide; on mobile (273px panel leaves a ~61px canvas sliver) theater is panel-internal and the "see the world" moment is the dock-*closed* state. Two structural fixes first: a **persistent 2-pill currency rail** (Echo Core + Bound Fragment — A5 is 100% absent today) and a **payoff-led progressively-disclosed briefing**.
- **Programmer** — key fact: **the live canvas already draws a full 60Hz WebGL frame in the lobby** (sim JS is idle). So the cost is **GPU draw + backdrop-blur, not CPU**; cheap juice = compositor-thread transform/opacity + one self-terminating count-up + pooled DOM particles. Hard "no" to new blur panels, fanned-out glow rings, and three.js scene VFX for lobby juice. Every effect must have a reduced-motion **resting state** or it fails G4.

## Disagreements → chair resolutions (numeric/constraint-based)

1. **"Living scene everywhere" (Designer) vs "viewport-asymmetric" (UI).**
   → **RESOLVED to UI's tiering, with Designer's aperture as the wide-tier + dock-closed read.** Decision: the diegetic-aperture theater is the canonical **desktop/wide AND mobile-dock-closed** experience; with the 출정 panel open on mobile (~61px sliver) theater is **panel-internal** (card motion, reward chips, tap juice). Canvas reactivity on stage-select is kept but **minimal**: reuse existing `meshRootForStageBoss`/`stagePresentationFor` focus/tint (a bounded transform+opacity+material-tint tween), never a per-frame camera-coupled parallax in pass 1.

2. **Canvas reactivity + payday cost (Designer) vs single-thread GPU budget (Programmer).**
   → **RESOLVED to Programmer's ceiling.** Allowed in pass 1: compositor-thread transform/opacity only; ONE self-terminating count-up (sim idle, free); pooled DOM/CSS-sprite particles in screen-space; the existing single `rc-glow-ring` capped to the selected stage card; the existing panel `transform 200ms` slide as the A6 "emit" + a **static** 1px cyan-rift edge seam. **Deferred (needs `recordFrameProbe` before/after on a mid-tier device):** camera-coupled dock parallax, any new `backdrop-filter:blur` surface, any new three.js scene VFX/inhabitants. Designer's "some reactivity is non-negotiable" is honored via the cheap focus/tint on stage-select — pattern 13 is preserved without a new shader.

3. **Briefing `<dl>` demotion + spine/chips crowding (Designer) vs learned-structure/mobile-tightness (UI, constraint #5).**
   → **RESOLVED: keep the DATA, change only default visibility.** The five 지형/위협/점유/랜드마크/보상 rows are preserved but collapsed behind a **"전황 상세 ▸" disclosure**, closed by default; the briefing leads with boss portrait + one threat line + a promoted **"승리 시 → [다음 보상]" zenith-gold chip**. The 봉쇄선-spine connector + on-card chips ship on **wide tier**; on mobile the stage rail is the A4 **grid↔selected-detail** read (expanded selected card + compact rows) without the connector, to protect the 273px width. No dock nav/tab/FAB relocation.

4. **Economy/retention (chair holding PM + the survey backlash evidence).**
   → **Decisions:** (a) currency rail capped at **exactly 2 pills** (Echo Core + Bound Fragment) — explicitly reject Soulstone's 6-currency "soup" (constraint #4). (b) idle-return is a **reward for real elapsed time, tap-skippable, never blocks the FAB** — NOT a daily-login leash (documented "manipulative/shallow-login" backlash). (c) The browser-cohort **"watch ad to DOUBLE"** payday button and gacha/summon are **noted, not adopted** this pass — Abyssal is single-player/offline/no-IAP; the *reveal theater* from gacha is transplanted only as the **extract/companion + reward reveal** juice, not a monetized pull. (d) A daily hook, if ever added later, ties to **"first sortie of the day,"** never bare login.

5. **Accessibility/perf gates (chair holding QA).**
   → **Non-negotiable for pass 1:** every juice effect lands on a meaningful **reduced-motion resting state** (count-up → final number; selected card → static border; tap → static pressed state; panels → final position) or it fails **G4**. ≥48dp targets, sub-100ms tap feedback, currency pills are static DOM animating only on value-change. None of the juice is load-bearing on first paint (**G6** first-paint protected; ~53% >3s bounce risk respected).

## DECIDED DIRECTION (lobby-first, pass 1)

> **"War-room aperture onto the 심연" — a loadout theater, not a form — built as cheap compositor-thread theater + legibility layered onto the existing dock, viewport-tiered, gold-means-reward.**

Concrete pass-1 scope (all tie to a survey pattern + a position + a constraint):

1. **Aperture framing (A6)** — center = live 3D scene read as the map into the 심연; docks read as bolted to the rim via the existing 200ms slide + a static cyan-rift edge seam. Stage-select does a bounded focus/tint of the scene (no new shader). Wide-tier + mobile-dock-closed only.
2. **Currency rail (A5)** — 2 framed pills (Echo Core ◈ cyan-rim, Bound Fragment ✦ gold-rim) top-left screen-space, pre-run only, yields to battle HUD on start, each ≥48dp and deep-links to its spend dock.
3. **Reward-forward briefing (A2 + Lane C)** — boss portrait + one threat line + promoted **"승리 시 → 다음 보상"** gold chip; the 5 terrain rows collapse behind **"전황 상세 ▸"**.
4. **Stage rail as grid↔detail / 봉쇄선 spine (A3/A4)** — selected card expands (art + boss + state); others compact with 잠김/CLEAR/선택됨 chips; wide-tier adds the connected blockade-line spine + node dots.
5. **Idle-return "payday" (A1)** — top-center count-up of accrued Echo Core/Bound Fragment over the live scene, eased, then "lands" into the currency pills; tap-skippable, never blocks the FAB, real-elapsed-time only.
6. **작전 개시 CTA (pattern #1)** — stays the persistent bottom-center thumb-zone FAB; the **only cinder-ember-filled element** on screen; sub-100ms scale + one pooled-particle tap burst + slow ambient breathe.
7. **Palette discipline (A5 + constraint #4)** — void-obsidian/cold-steel chrome, cyan-rift world/seams/selected-glow, **zenith-gold exclusively on reward/payday numbers**, cinder-ember exclusively on the commit CTA + the abyss's heat. Gold-means-reward is the anti-currency-soup rule made visual.

Explicitly deferred to a later pass (recorded, not dropped): camera-coupled parallax, new blur surfaces, three.js scene inhabitants, gacha/summon theater, adaptive audio (Vibe Survivors), prestige-reset, daily-login, notification badges, monetization "double it".

## Next step

Generate a **mockup image** of this decided direction (wide-tier war-room aperture + labeled mobile-compact read) and save to the run workspace, then — on user approval — a Stage-1 presentation-spec that turns items 1–7 into an implementable contract gated on G4/G6. No code until that spec is approved.
