# Stat and Item Reward System Schema

The campaign offers one exclusive reward after each victory. Reward effects are calculated from the immutable campaign reward trace, so a saved campaign reproduces the same stats after import.

---

## 1. Implemented reward catalog

### Stage 1 — Cinder Span

| Reward ID | Type | Effect |
|---|---|---|
| `ember-cohort` | Stat | Adds 12 legion capacity for the remaining campaign. |
| `rift-lens` | Item | Adds 1 damage to a possessed Assault from Veil Citadel onward. |
| `stillwater-hourglass` | Item | Reduces every control-pad cooldown by 20%. |
| `shadebreaker-brand` | Stat | Adds 1 damage to every Assault. |

### Stage 2 — Veil Citadel

| Reward ID | Type | Effect |
|---|---|---|
| `veil-vanguard` | Item | Starts Echo Throne with four shades already raised. |
| `anchor-shard` | Item | Restores 2 integrity when entering Echo Throne. |
| `abyssal-banner` | Item | Starts each later stage with one aegis charge and adds one shade to every Materialize. |

### Stage 3 — Echo Throne

`throne-echo` and `dawnless-crown` are terminal archive rewards. They close the campaign and do not need to affect a later combat stage.

---

## 2. Runtime stat contract

`getCampaignBenefits(state)` returns a pure immutable summary used by the boss-spec screen and the battle control pad:

```js
{
  maxIntegrity: 10,
  cooldownReduction: 0, // clamped to 0–0.5
  extraAssaultDamage: 0,
  summonBonus: 0,
  autoExtract: false,
  initialAegis: 0,
  activeItemNames: []
}
```

Legacy capacity, lens, vanguard, and anchor effects remain in the state engine. `cooldownReduction` is applied only to the active control pad; it never changes the deterministic action rules.

## 3. Cooldown formula

Each accepted action starts its own real-time timer. The UI applies the campaign benefit without changing the action’s underlying state transition:

$$\text{Cooldown}_{\text{active}} = \text{Cooldown}_{\text{base}} \times (1 - \text{cooldownReduction})$$

For example, Hunt has a base cooldown of 4.0 seconds. With the Stillwater Hourglass, it becomes $4.0 \times (1 - 0.20) = 3.2$ seconds.

## 4. Wave-pressure interaction

Enemy wave breaches call `applyBattleBreach(state)`. An available aegis absorbs the breach; otherwise integrity loses one point. At zero integrity the current stage moves to `defeat`, and the state transition is recorded in the save trace as `battle-breach`.
