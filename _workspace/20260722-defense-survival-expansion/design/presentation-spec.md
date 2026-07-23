# Presentation specification — 2.5D command readability

| scene/event | intent | visual/sound behavior | reduced-motion fallback | trace |
|---|---|---|---|---|
| stage intro | enter a hostile containment line | 6–10s skippable text overlay, slow camera settle | static map + text | W-03 |
| XP collection | command signal returns | teal path to Warden, ≤100ms cue | icon count increments | W-01 |
| elite extraction | a memory is bound | three rings shrink, player-controlled prompt | static seal + countdown text | W-02 |
| Domain cast | command briefly overrides panic | desaturation, crisp command lines, no strobe | color shift omitted; state label retained | W-04 |
| boss victory | line is restored | gate map-line reconnects, Archive card appears | same card/no shake | W-05 |

## Rendering constraints
- Primary: WebGL 2.5D GLB actors; fallback: passive Canvas snapshot renderer.
- Actor clips: idle, walk, strike, cast; effects use anticipation → impact → recovery.
- GodTiboImagen/Blender/Vox Director outputs require provenance before runtime use.
- PerfectPixel extraction is prohibited (`extract method=none`): no pixel-art conversion or copied pixel source.
- QA must score immersion per scene and report any S1/S2 readability issue. G4 is pending measurement.