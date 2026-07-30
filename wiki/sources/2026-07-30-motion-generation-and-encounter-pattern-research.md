# Source note — motion generation + encounter pattern research (2026-07-30)

Raw capture: [[raw/sources/2026-07-30-motion-generation-and-encounter-pattern-research]]

Four sources were read to answer two questions this cycle: *how should motion for the boss, player
and enemies be produced*, and *how should attack patterns and the AI that answers them be built*.

| # | Source | What it settles | What it does not |
|---|---|---|---|
| S1 | MDM, arXiv 2209.14916 | text/action-conditioned motion generation is feasible offline; geometric losses (foot contact) are what make it land | says nothing about browser runtime cost; not executed here |
| S2 | T2M-GPT, arXiv 2301.06052 | a VQ-VAE + GPT stack beats diffusion on FID at HumanML3D scale; the authors name dataset size as the limit | same — offline only, and the limitation is why we prefer an authored corpus |
| S3 | three.js animation system docs | the runtime boundary: clips are keyframe-track objects driven by one mixer per rig; per-action `timeScale`/fades are the only free differentiation | does not provide clip content |
| S4 | Behaviour trees for AI (Game Developer, 2014) | multi-tick `Running` actions and priority-ordered fallbacks are the useful shape for encounter AI | a general BT runtime is rejected here for determinism and per-tick cost |

Synthesis pages:

- [[wiki/concepts/motion-generation-for-runtime-rigs]] — method comparison, the retarget pipeline we
  actually run, and the concretised prompt templates.
- [[wiki/concepts/attack-pattern-presets-and-ai-response]] — the three-phase step structure, the
  authored presets, and the four response patterns.

Reading note: S1 and S2 are the strongest *evidence* but the weakest *fit*; the load-bearing
decision of this cycle — retarget the authored bench corpus and differentiate at runtime — is
justified by S3's runtime boundary plus the engine rule in `CLAUDE.md` §2, not by S1/S2.
