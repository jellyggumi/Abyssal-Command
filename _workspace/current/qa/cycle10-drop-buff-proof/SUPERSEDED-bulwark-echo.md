# SUPERSEDED — the `bulwark-echo` / `gateMaxIntegrity` measurements in this folder

`[OBSERVED]` Written at cycle-10 close, after the artifacts in this folder were produced.

## What is superseded

Two artifacts here reference `bulwark-echo`, the only `gateMaxIntegrity` buff item:

- `determinism-gate-receipt.json` — records `effectiveGateMax_bulwarkEchoX2: 1920` against
  `effectiveGateMax: 1600`, plus the reasoning about which gate clamps are inert.
- `dbimpl-behavior.mjs:115` — hardcodes `bulwark-echo` in a six-item list.

**Neither is wrong.** Both were accurate measurements of the code as it stood when they ran.
They are left **byte-unedited** on purpose: editing a receipt to match a later decision
destroys the only record of what was actually observed.

## Why they no longer describe the shipped build

`bulwark-echo` was **withdrawn from `BUFF_ITEMS`** before this cycle landed. The full rationale
is in `_workspace/current/design/item-drop-timed-buff-spec.md` under "Withdrawal —
`bulwark-echo` / `gateMaxIntegrity`, cycle 10". In short: the stat composes an effective cap
without writing `gate.maxIntegrity`, but `getRunSnapshot` publishes `gate: run.gate` verbatim,
so while the buff is live the snapshot reports `integrity 1920` against `maxIntegrity 1600`.
Three consumers assume that cannot happen — the Stage1b pressure runner's `to > max`
invariant (G7 evidence tooling), the `low-hp-focus` enemy policy's
`gateRatio = gate.integrity / gate.maxIntegrity` (a live targeting change, not cosmetic), and
any HUD ratio.

## How it surfaced

`tests/stage1b-pressure-packets.test.mjs`:

```
stage1b-pressure: invalid gate integrity state at tick 1496: from=1600, to=1601, max=1600
```

Attribution was decided by running that same file at base commit `033877ad` in a detached
worktree: **8/8 pass at base**, so the regression belonged to this cycle rather than being
carried. That is the reason the withdrawal is a cycle-10 obligation and not a pre-existing
condition to be noted and passed on.

## What a reader should do with this folder

- Treat every `bulwark-echo` number here as **historical**, valid for the pre-withdrawal tree.
- Do not diff these against a post-withdrawal run and call the difference a regression.
- If `bulwark-echo` is ever re-enabled, these measurements become relevant again **only after**
  the snapshot fix described in the spec's Withdrawal section, because the composed cap they
  measured is exactly what the snapshot must start publishing.
