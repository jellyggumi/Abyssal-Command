# RAW CAPTURE — motion generation + encounter pattern sources (2026-07-30)

> Immutable capture. Corrections belong in `wiki/` pages or a follow-up source note,
> never in a rewrite of this file (CLAUDE.md §4).

Captured by: agent session `feat/motion-vfx-aoe-boss`, 2026-07-30.
Method: `read` on the listed URLs (arXiv API for papers, reader-mode for HTML).

---

## S1 — Human Motion Diffusion Model (MDM)

- URL: https://arxiv.org/abs/2209.14916
- Authors: Guy Tevet, Sigal Raab, Brian Gordon, Yonatan Shafir, Daniel Cohen-Or, Amit H. Bermano
- Published: 2022-09-29 · cs.CV, cs.GR
- Project page cited by the abstract: https://guytevet.github.io/mdm-page/

Verbatim points from the abstract:

- "Natural and expressive human motion generation is the holy grail of computer animation. It is
  a challenging task, due to the diversity of possible motion, human perceptual sensitivity to it,
  and the difficulty of accurately describing it."
- MDM is "a carefully adapted classifier-free diffusion-based generative model for the human
  motion domain", transformer-based.
- "A notable design-choice is the prediction of the sample, rather than the noise, in each
  diffusion step. This facilitates the use of established geometric losses on the locations and
  velocities of the motion, such as the foot contact loss."
- "MDM is a generic approach, enabling different modes of conditioning, and different generation
  tasks", trained "with lightweight resources", state of the art on text-to-motion and
  action-to-motion benchmarks.

## S2 — T2M-GPT: Generating Human Motion from Textual Descriptions with Discrete Representations

- URL: https://arxiv.org/abs/2301.06052
- Authors: Jianrong Zhang, Yangsong Zhang, Xiaodong Cun, Shaoli Huang, Yong Zhang, Hongwei Zhao,
  Hongtao Lu, Xi Shen
- Published: 2023-01-15 · cs.CV

Verbatim points from the abstract:

- Framework is "VQ-VAE ... and GPT ... for human motion generation from textural descriptions".
- "a simple CNN-based VQ-VAE with commonly used training recipes (EMA and Code Reset) allows us to
  obtain high-quality discrete representations."
- "on HumanML3D ... we achieve comparable performance on the consistency between text and generated
  motion (R-Precision), but with FID 0.116 largely outperforming MotionDiffuse of 0.630."
- "we ... observe that the dataset size is a limitation of our approach."

## S3 — three.js animation system (runtime playback contract)

- URL: https://threejs.org/docs/#manual/en/introduction/Animation-system
- Retrieved: 2026-07-30

Observed API surface relevant to this repository (documented class list under Core → Animation):
`AnimationAction`, `AnimationClip`, `AnimationMixer`, `AnimationObjectGroup`, `AnimationUtils`,
`KeyframeTrack`, `QuaternionKeyframeTrack`, `NumberKeyframeTrack`, `VectorKeyframeTrack`,
`PropertyBinding`, `PropertyMixer`.

This is the boundary the runtime already lives on: clips are `AnimationClip` objects whose tracks
are per-property keyframe tracks, played through one `AnimationMixer` per rig; per-action controls
(`timeScale`, `clampWhenFinished`, `fadeIn`/`fadeOut`, `crossFadeTo`) are the only per-actor
differentiation available without re-authoring the clip data.

## S4 — Behaviour trees for AI: how they work (Chris Simpson, Game Developer, 2014-07-18)

- URL: https://www.gamedeveloper.com/programming/behavior-trees-for-ai-how-they-work
- Retrieved: 2026-07-30

Verbatim points:

- "a behaviour tree is a tree of hierarchical nodes that control the flow of decision making of an
  AI entity. At the extents of the tree, the leaves, are the actual commands that control the AI
  entity, and forming the branches are various types of utility nodes."
- Node statuses: "Success  Failure  Running". "The third means that success or failure is not yet
  determined, and the node is still running."
- "A core aspect of Behavior Trees is that unlike a method within your codebase, a particular node
  or branch in the tree may take many ticks of the game to complete."
- Sequence: "will visit each child in order ... If any child fails it will immediately return
  failure to the parent."
- Selector: "will return a success if any of its children succeed and not process any further
  children ... Their main power comes from their ability to represent multiple different courses of
  action, in order of priority from most favorable to least favorable."
- "failure is no longer a critical full stop on whatever I'm trying to do ... but just a natural and
  expected part of the decision making process".
- "Random sequences/selectors work identically to their namesakes, except the actual order the child
  nodes are processed is determined randomly. These can be used to add more unpredictability to an
  AI character in cases where there isn't a clear preferable order of execution."

---

## What these sources do NOT establish

- None of them measures this game. No number here is a gate result for Abyssal Lantern.
- S1/S2 describe offline generative models trained on motion-capture corpora (HumanML3D). Neither
  ships a browser-runtime inference path, and neither was executed in this session.
- S4 is a behaviour-tree tutorial, not an authority on boss attack pacing; the telegraph /
  active / recovery decomposition used in this repository is our own, informed by it.
