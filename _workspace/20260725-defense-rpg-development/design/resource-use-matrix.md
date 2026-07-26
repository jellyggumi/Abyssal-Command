# Resource-use matrix — retained inventory, Cinder Span roles, and blocks

run-id: `20260725-defense-rpg-development`  
owner: game designer  
status: reuse map only; no asset is newly approved to ship

## Reading rule

`assets/defense-asset-manifest.json` marks the rows below `retain` with `runtimeReference: true`. That is a path/disposition fact, **not** an independent rights, WebGL, fallback, or performance pass. This matrix does not alter the manifest or add a registry. A retained resource is a **reuse candidate only through the existing renderer/manifest path**; it remains blocked from a new shipping claim unless the relevant runtime receipt already exists or is produced.

```yaml
resource_policy:
  allow_new_registry: false
  allow_generated_art_runtime: false
  runtime_authority: defense-run-simulation.js_and_campaign-state.js
  retained_asset_status: reuse_candidate_not_new_shipping_approval
  required_for_any_new_or_unverified_visual:
    - provenance_and_rights_receipt
    - target_glb_embedding_receipt_when_texture_or_generated_media_is_added
    - webgl_load_receipt
    - passive_fallback_or_reduced_motion_receipt
    - performance_receipt_against_applicable_budget
  current_generated_media_status: blocked
```

## Retained runtime candidates

| Class | Retained paths from manifest | Presentation role | Cinder Span use | Status / verification boundary |
|---|---|---|---|---|
| Terrain | `assets/images/battle/glb/terrain/cinder-span.glb`; `abyss-chancel.glb`, `echo-throne-steps.glb`, `gate-zenith.glb`, `glass-necropolis.glb`, `howling-sprawl.glb`, `shattered-causeway.glb`, `starless-canal.glb`, `sunken-bastion.glb`, `veil-citadel.glb` | Stage landmark/readability geometry, not collision/rules authority. | `cinder-span.glb` is the stage plate behind Gate, safe route, `cinder-seal`, and `cinder-bind`; other terrain remains campaign-stage candidate only. | Retained + runtime referenced. The Cinder GLB part sheet proves only a static 256×256 preview; this document has no current browser/fallback/perf receipt, so no new shippable claim. |
| Cinder world plates | `assets/images/battle/world/cinder-span-topdown-plate.webp`; `cinder-span-tactical-paper-plate.webp` | Existing map/briefing or non-WebGL fallback reference. | Use as optional stage-select/briefing/fallback context, never to decide routes/outcomes. | Retained + runtime referenced; no rights/perf/fallback claim beyond manifest path. Block any replacement/generated plate. |
| Bosses | `assets/images/battle/glb/bosses/cinder-warden.glb`; `abyss-regent.glb`, `bridge-colossus.glb`, `gate-sovereign.glb`, `lantern-tyrant.glb`, `pack-herald.glb`, `requiem-choir.glb`, `tide-warden.glb`, `veil-tactician.glb`, `veiled-concordat.glb` | Boss identity and phase marker. | `cinder-warden.glb` is the Cinder boss visual candidate; priority/boss intent must also have text/shape fallback. | Retained + runtime referenced; existing G4 notes include frozen boss-idle problems. Do not call the model/animation readable or shippable until its runtime receipt passes. |
| Enemies | `assets/images/battle/glb/enemies/guard.glb`, `possessed.glb`, `scout.glb`, `shade.glb` | Generic enemy visual candidates; catalog identity mapping is not assumed. | May depict pressure/flank/ranged silhouettes only if the existing renderer mapping already does so; semantic policy comes from snapshot/event labels. | Retained + runtime referenced but mapping-to-policy is unverified here. Block any claim that model choice itself communicates a policy. |
| Commander | `assets/images/battle/glb/commander/dusk-warden.glb`; retained Dusk Warden frame PNGs | Player/Warden visual anchor. | Anchor the Warden integrity label and safe-route origin. | Retained paths are not clearance for the GTI pilot texture/material. Use existing asset path only; generated pilot remains blocked below. |
| Companions | `assets/images/battle/glb/companions/ember-cohort.glb`, `anchor-shard.glb`, `dawnless-crown.glb`, `lantern-reaver.glb`, `pack-warden.glb`, `requiem-warden.glb`, `rift-lens.glb`, `throne-echo.glb`, `veil-vanguard.glb` | Companion roster/formation display. | `ember-cohort.glb` represents only the existing Cinder elite handoff after authoritative `ELITE_EXTRACTED`; it must not appear as a pre-granted reward. | Retained + runtime referenced. No new companion art or progression claim; each visual still needs existing loader/fallback/perf evidence for shipping approval. |
| VFX | `assets/images/battle/glb/vfx/boss-rally-aura.glb`, `companion-downed-fade.glb`, `critical-hit-burst.glb`, `echo-warden-awakening.glb`, `gate-breach-shockwave.glb`, `wardens-ward-shield.glb` | Optional observer feedback for boss, companion, damage, extraction, Gate, and defense state. | Prefer `gate-breach-shockwave` for Gate damage, `echo-warden-awakening` for accepted Bind, and `companion-downed-fade` for downed state, each paired with text/status. | Retained + runtime referenced; blocked from a G4/presentation claim until latency/readability plus low-tier perf receipts exist. Reduced motion must preserve text status without VFX. |
| Props | `assets/images/battle/glb/props/warden-lantern.glb`, `stillwater-hourglass.glb`, `choir-ward-crystal.glb`, `abyssal-banner.glb`, `bulwark-brand.glb`, `tiers/tier-t1.glb`–`tier-t5.glb` | Landmark or reward-context candidate, never hidden mechanical authority. | `warden-lantern` can identify the Gate locale; reward props only appear after their corresponding authoritative item/reward event. | Retained + runtime referenced. Do not use a prop as the only reward/extraction signal or claim visual provenance/perf clearance here. |
| UI frame / image art | **None retained in the runtime manifest.** `assets/images/ui/action-*`, `boss-*`, reward images, narration atlases, and `concept-tactical-surface.*` are marked `delete` and `runtimeReference: false`. | Existing DOM/CSS UI remains the only allowed UI surface for this phase. | Cinder markers, current→upgraded cards, terminal text, and focus rings must use existing UI paths. | **BLOCKED:** do not reintroduce deleted UI frames/images or call them shippable. The 59 ≠ 11 portrait failure remains open. |
| Audio resources | **No retained audio media asset exists in the manifest.** Existing `assets/audio/*` rows, including `defense-audio-manifest.json`, are `delete` / non-runtime-reference rows. | `defense-audio.js` procedural Web Audio is a source-level observer route, not a retained media resource. | Existing semantic events may be observed by the current procedural cues; all gameplay information must remain in text/status. | **BLOCKED as media reuse:** do not ship/reintroduce deleted MP3s or new generated audio. Any cue remains optional and needs fallback/perf evidence. |

## Explicit generated/unverified blocks

| Resource set | Observed status | Block |
|---|---|---|
| `assets/images/battle/pilot/concept-terrain-cinder-span.png` and its provenance sidecar | `concept-pilot-not-runtime`; generated by `god-tibo-imagen`; rights pending; `runtimeEligible: false`. | **BLOCKED:** no texture/GLB/material/runtime use until rights, target-GLB embedding, WebGL, fallback, and perf receipts all pass. |
| Dusk Warden GTI pilot / `dusk-warden-cartoon-albedo` | Resource provenance records requested 1024² vs observed 1254², pending rights, no GLB re-embedding, no runtime verification. | **BLOCKED:** concept/texture pilot only; do not wire into the renderer or claim visual appearance. |
| PerfectPixel idle pilot and `blocked-verification.json` | Output was not created; provider unsupported and required extraction mode unavailable; runtime ingestion explicitly unapproved. | **BLOCKED:** no asset exists to ship; do not substitute a dry-run or prompt for a resource. |
| All `assets/images/battle/pilot/concept-*` images and sidecars | Manifest marks each `delete` / `runtimeReference: false`. | **BLOCKED:** concept reference only; no UI/GLB/material runtime ingestion. |
| Retained GLBs/world plates without a Cinder-specific WebGL/fallback/perf receipt | Manifest proves retention/path, not the full gate. | **BLOCKED from new shipping approval:** may only stay on the existing path; no claim that they safely ship today. |

## Source records

- Asset disposition: `assets/defense-asset-manifest.json` rows for GLB categories and Cinder world plates.
- Cinder GLB preview evidence: `assets/images/battle/glb/.parts/cinder-span.json` (static source/preview metadata; not a runtime receipt).
- Generated-media gate: `engineering/resource-provenance.md` and pilot sidecars.
- Audio semantics/fallback boundary: `assets/audio/defense-audio-manifest.json` (existing procedural observer declaration; not a retained-media approval).
