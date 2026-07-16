#!/usr/bin/env node
// DET9-NUM — quantified balance sweep.
// Enumerates every 3-round command plan (4^3 = 64) per stage through the
// FROZEN reducer and prints the per-stage numeric envelope plus RT presets.
// Usage: node scripts/balance-numbers.mjs [--json]

import {
  CAMPAIGN_SCHEDULES,
  commandCost,
  COMMANDS,
  initialEncounter,
  makeCommand,
  reduceEncounter,
  awardFor,
} from "../game-core.js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// RT presets are presentation constants; parse them from app.js so this
// report can never drift from the shipped values.
const appSource = readFileSync(resolve(root, "app.js"), "utf8");
const presetMatches = [...appSource.matchAll(
  /\{ foeCooldown: ([\d.]+), unitSpeed: ([\d.]+), focusRegen: ([\d.]+) \}/g
)];
const presets = presetMatches.map((m) => ({
  foeCooldown: Number(m[1]),
  unitSpeed: Number(m[2]),
  focusRegen: Number(m[3]),
}));

function sweepStage(stageIndex) {
  const schedule = CAMPAIGN_SCHEDULES[stageIndex];
  const seed = initialEncounter(schedule, stageIndex);
  const outcomes = { VICTORY: 0, HOLD: 0, DEFEAT_INTEGRITY: 0, DEFEAT_PRESSURE: 0, ACTIVE: 0, INVALID: 0 };
  const victoryPlans = [];
  for (const a of COMMANDS) for (const b of COMMANDS) for (const c of COMMANDS) {
    let state = initialEncounter(schedule, stageIndex);
    let sequence = 0;
    let invalid = false;
    for (const cmd of [a, b, c]) {
      if (state.outcome !== "ACTIVE") break;
      const result = reduceEncounter(state, makeCommand(cmd, state.round, ++sequence));
      if (!result.accepted) { invalid = true; break; }
      state = result.state;
    }
    if (invalid) outcomes.INVALID++;
    else {
      outcomes[state.outcome] = (outcomes[state.outcome] || 0) + 1;
      if (state.outcome === "VICTORY") victoryPlans.push([a, b, c].join(","));
    }
  }
  const disruptCosts = [];
  {
    // Escalation curve: cost of the Nth DISRUPT on this stage.
    let probe = initialEncounter(schedule, stageIndex);
    for (let n = 0; n < 3; n++) {
      disruptCosts.push(commandCost(probe, "DISRUPT"));
      probe = { ...probe, disrupt_uses: probe.disrupt_uses + 1 };
    }
  }
  return { stageIndex, schedule, seed, outcomes, victoryPlans, disruptCosts };
}

const rows = CAMPAIGN_SCHEDULES.map((_, i) => sweepStage(i));
const json = rows.map((r, i) => ({
  stage: i + 1,
  schedule: r.schedule,
  seed: {
    integrity: r.seed.max_integrity,
    focus: r.seed.max_focus,
    foe_health: r.seed.max_foe_health,
    start_pressure: r.seed.pressure,
  },
  disrupt_cost_curve: r.disruptCosts,
  rt_preset: presets[i] || null,
  idle_defeat_estimate_s: presets[i]
    ? (r.schedule.includes("SURGE")
        ? Math.ceil(r.seed.max_integrity / 4) * presets[i].foeCooldown
        : Math.ceil(r.seed.max_integrity / 2) * presets[i].foeCooldown)
    : null,
  plan_space_64: r.outcomes,
  victory_plans: r.victoryPlans,
  awards: { VICTORY: awardFor("VICTORY"), HOLD: awardFor("HOLD") },
}));

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(json, null, 2));
} else {
  console.log("# Quantified balance — stage envelopes (frozen reducer sweep)\n");
  console.log("| Stage | Schedule | INT/FOC/FOE | DISRUPT curve | RT cd/speed/regen | Idle defeat ≈ | 64-plan V/H/Di/Dp/A/inv | Victory plans |");
  console.log("|---|---|---|---|---|---|---|---|");
  for (const r of json) {
    const o = r.plan_space_64;
    console.log(
      `| ${r.stage} | ${r.schedule.join("/")} | ${r.seed.integrity}/${r.seed.focus}/${r.seed.foe_health}` +
      ` | ${r.disrupt_cost_curve.join("→")} | ${r.rt_preset ? `${r.rt_preset.foeCooldown}s/${r.rt_preset.unitSpeed}%/${r.rt_preset.focusRegen}` : "-"}` +
      ` | ${r.idle_defeat_estimate_s}s | ${o.VICTORY}/${o.HOLD}/${o.DEFEAT_INTEGRITY}/${o.DEFEAT_PRESSURE}/${o.ACTIVE}/${o.INVALID}` +
      ` | ${r.victory_plans.slice(0, 3).join(" · ") || "—"} |`
    );
  }
  console.log("\nAwards: VICTORY=2 fragments, HOLD=0 (stage1-rules-v2).");
}
