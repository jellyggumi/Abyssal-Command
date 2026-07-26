#!/usr/bin/env node
/**
 * G7 core-loop instrumentation (game-studio-harness, run-id 20260725-wellmade-verification).
 *
 * MEASUREMENT ONLY — imports the shipped simulation unmodified and observes it.
 * Drives real `createDefenseRun` runs under a *human-plausible* input policy (not the
 * 60 Hz every-input-every-tick spam that `scripts/run-g2-archetype-rotation.mjs` uses for
 * balance sweeps) and records, per run:
 *
 *   - every macro reward event with its tick        -> reward cadence / rewards-per-loop
 *   - every ACCEPTED player action with its tick    -> actions-per-loop
 *   - GROWTH_OFFER boundaries                       -> observed loop period (the level-up circuit
 *                                                      that `vanguard-circuit` models)
 *   - elite/boss encounter boundaries               -> observed nested `formation-assault` period
 *
 * Output: JSON to --output. Nothing in the game is mutated.
 *
 * Usage:
 *   node scripts/measure-g7-core-loop.mjs --output <path.json> [--policy engaged|minimal|bot]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  createDefenseRun, advanceDefenseRun, isTerminalRun, queueInput, TICK_RATE,
} from "../defense-run-simulation.js";
import { STAGES } from "../campaign-state.js";
import { STAGE_BY_ID, OCTANT_VECTORS } from "../defense-catalog.js";

// ---------------------------------------------------------------------------
// Event taxonomy. "Macro reward" = a discrete, player-facing gain the player is
// meant to notice and (sometimes) acknowledge. "Micro reward" = continuous combat
// feedback. G7's "≥1 reward event/loop" is a macro-granularity claim.
// ---------------------------------------------------------------------------
const MACRO_REWARD_EVENTS = new Set([
  "GROWTH_OFFER",            // XP threshold crossed -> 3-choice skill offer
  "SKILL_SELECTED",          // the upgrade actually lands
  "ITEM_COLLECTED",          // in-run power pickup
  "ELITE_CANDIDATE_AVAILABLE", // capture opportunity opens
  "EXTRACTION_WINDOW_OPENED",
  "EXTRACTION_COMPLETED",
  "ELITE_EXTRACTED",         // permanent companion gained
  "OCCUPATION_CAPTURED",
  "OBJECTIVE_COMPLETED",
  "BOSS_RALLY_WINDOW",       // fleet-wide cooldown cut
  "REWARD_SELECTED",
]);
const MICRO_REWARD_EVENTS = new Set(["ENEMY_DEFEATED", "CRITICAL_HIT", "PROJECTILE_IMPACT"]);
// Player-agency actions. MOVE is counted on *direction change* only — re-issuing the
// same octant is a held stick, not a new decision.
const ACTION_INPUT_TYPES = new Set([
  "MOVE", "STANCE_CYCLE", "SKILL_CAST", "SKILL_SELECTED", "GROWTH_OFFER_SELECTED",
  "EXTRACT_ELITE", "REWARD_SELECTED", "M4_CARD_DECISION",
]);

const octantFor = (dx, dy) => {
  let best = "IDLE"; let bestDot = -Infinity;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len; const ny = dy / len;
  for (const [name, vec] of Object.entries(OCTANT_VECTORS)) {
    if (name === "IDLE") continue;
    const vlen = Math.hypot(vec.x, vec.y) || 1;
    const dot = nx * (vec.x / vlen) + ny * (vec.y / vlen);
    if (dot > bestDot) { bestDot = dot; best = name; }
  }
  return best;
};

/**
 * Objective-seeking movement. The commander auto-attacks, so the ONLY thing movement is
 * for is (a) reaching the point the current objective phase requires and (b) staying near
 * the fight so companions and basic attacks connect. It never idles — a survivor-genre
 * player is always repositioning.
 *
 * Phase -> target, straight off `updateObjectivePhase`'s ordered list
 * (defense-run-simulation.js:1241-1249):
 *   gate-defense  -> nearest enemy (clear the wave)
 *   echo-recovery -> nearest elite, else nearest enemy (an elite must die to open capture)
 *   growth        -> nearest enemy (auto-completes on first skill learned)
 *   occupation    -> the occupation point (must be held)
 *   extraction    -> the extraction point (must be held)
 *   boss-kill     -> the boss
 */
function desiredOctant(run) {
  const c = run.commander;
  const phase = run.objectives?.phase;
  const layout = run.tactics || {};
  const enemies = run.enemies || [];
  const nearestOf = (list) => {
    let best = null; let bd = Infinity;
    for (const e of list) {
      const d = (e.x - c.x) ** 2 + (e.y - c.y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  };
  let target = null;
  if (phase === "occupation") target = layout.occupation ?? null;
  else if (phase === "extraction") target = layout.extraction ?? null;
  else if (phase === "boss-kill") target = nearestOf(enemies.filter((e) => e.class === "boss")) ?? nearestOf(enemies);
  else if (phase === "echo-recovery") target = nearestOf(enemies.filter((e) => e.elite)) ?? nearestOf(enemies);
  else target = nearestOf(enemies);
  if (!target) target = layout.occupation ?? layout.extraction ?? null;
  if (!target) return "IDLE";
  const dx = target.x - c.x; const dy = target.y - c.y;
  // Already on the point: hold it rather than overshoot (occupation/extraction need presence).
  if (Math.hypot(dx, dy) < (target.radius ?? 400) * 0.5) return "IDLE";
  return octantFor(dx, dy);
}

/**
 * Policies:
 *  - minimal : move + take growth offers only (lower bound on actions/loop)
 *  - engaged : + cast ready skills, extract elites, switch stance on *situation change* (realistic)
 *  - bot     : + attempt STANCE_CYCLE whenever the 4 s cooldown allows (upper bound)
 *
 * `redecideTicks` = how often the player re-aims. This is SWEPT, not guessed: stage duration
 * turns out to be highly sensitive to it, so a single hand-picked value would be reporting a
 * property of the harness rather than of the game.
 *   1  tick  = 60 Hz  (physically impossible for a human; upper bound on play quality)
 *   6  ticks = 10 Hz  (fast expert thumb)
 *   15 ticks =  4 Hz  (attentive play)
 *   30 ticks =  2 Hz  (casual)
 */
function buildInputs(run, policy, memo, redecideTicks) {
  let r = run;
  const issued = [];
  const push = (type, payload) => { r = queueInput(r, type, payload); issued.push(type); };

  if (run.growthOffer) {
    push("SKILL_SELECTED", { skillId: run.growthOffer.choices[0] });
    return { run: r, issued };
  }

  if (run.tick - (memo.lastMoveTick ?? -Infinity) >= redecideTicks) {
    const want = desiredOctant(run);
    if (want !== memo.lastOctant) { push("MOVE", { octant: want }); memo.lastOctant = want; }
    memo.lastMoveTick = run.tick;
  }

  if (policy === "minimal") return { run: r, issued };

  // Only cast a skill the commander actually owns and that is off cooldown — spamming a
  // cooling skill inflates the rejected-input count without representing player intent.
  for (const skillId of run.commander.skills) {
    if ((run.commander.cooldowns?.[skillId] ?? 0) <= 0) push("SKILL_CAST", { skillId });
  }

  // Only attempt extraction once the hold is actually complete (the UI only offers it then).
  if (run.eliteCandidate && !run.extracted && run.extractionProgress?.completed) {
    push("EXTRACT_ELITE", { enemyId: run.eliteCandidate.enemyId });
  }

  if (policy === "bot") {
    if (run.tick >= (run.stanceCooldownUntilTick ?? 0)) push("STANCE_CYCLE", {});
  } else {
    // Situational stance switching: react to a discrete tactical change, not a metronome.
    const integrityBand = Math.floor((run.commander.integrity / run.commander.maxIntegrity) * 4);
    const situation = [
      run.bossSpawned ? 1 : 0,
      run.eliteCandidate ? 1 : 0,
      run.objectives?.phase ?? "",
      integrityBand,
    ].join("|");
    if (situation !== memo.lastSituation) {
      if (memo.lastSituation !== null && run.tick >= (run.stanceCooldownUntilTick ?? 0)) push("STANCE_CYCLE", {});
      memo.lastSituation = situation;
    }
  }
  return { run: r, issued };
}


function measureRun({ stageId, seed, loadout, policy, redecideTicks, maxSteps = 40000 }) {
  let run = createDefenseRun({ stageId, seed, companionLoadout: loadout });
  const memo = { lastOctant: null, lastSituation: null };
  let seenEventSeq = 0;

  const macroRewards = [];   // {tick, type}
  const microRewardCount = { total: 0 };
  const actions = [];        // {tick, type}
  const growthOffers = [];   // ticks
  const encounters = [];     // {tick, type} elite/boss encounter boundaries
  const waveStarts = [];     // ticks — WAVE_VARIANT_STARTED
  const phaseChanges = [];   // {tick, phase} — OBJECTIVE_PHASE_CHANGED
  const stanceSwitches = [];
  let acceptedInputs = 0; let rejectedInputs = 0;

  for (let step = 0; step < maxSteps && !isTerminalRun(run); step += 1) {
    const { run: withInputs } = buildInputs(run, policy, memo, redecideTicks);
    run = advanceDefenseRun(withInputs, 1);

    for (const ev of run.events) {
      if (ev.eventSequence <= seenEventSeq) continue;
      seenEventSeq = ev.eventSequence;
      if (ev.type === "INPUT_ACCEPTED") {
        acceptedInputs += 1;
        if (ACTION_INPUT_TYPES.has(ev.inputType)) actions.push({ tick: ev.tick, type: ev.inputType });
        if (ev.inputType === "STANCE_CYCLE") stanceSwitches.push(ev.tick);
        continue;
      }
      if (ev.type === "INPUT_REJECTED") { rejectedInputs += 1; continue; }
      if (MACRO_REWARD_EVENTS.has(ev.type)) macroRewards.push({ tick: ev.tick, type: ev.type });
      if (MICRO_REWARD_EVENTS.has(ev.type)) microRewardCount.total += 1;
      if (ev.type === "GROWTH_OFFER") growthOffers.push(ev.tick);
      if (ev.type === "ELITE_CANDIDATE_AVAILABLE") encounters.push({ tick: ev.tick, type: "elite" });
      if (ev.type === "WAVE_VARIANT_STARTED") waveStarts.push(ev.tick);
      if (ev.type === "OBJECTIVE_PHASE_CHANGED") phaseChanges.push({ tick: ev.tick, phase: ev.phase ?? ev.to ?? null });
      if (ev.type === "BOSS_SPAWNED") encounters.push({ tick: ev.tick, type: "boss" });
    }
  }

  const ticks = run.tick;
  const seconds = ticks / TICK_RATE;
  const deltas = (arr) => arr.slice(1).map((t, i) => (t - arr[i]) / TICK_RATE);
  const macroTicks = macroRewards.map((r) => r.tick);

  // Three competing loop-boundary definitions, all measured against the same run:
  //   L1 growth-offer circuit  — what `vanguard-circuit` models (XP threshold -> upgrade -> re-engage)
  //   L2 wave circuit          — WAVE_VARIANT_STARTED to WAVE_VARIANT_STARTED
  //   L3 objective-phase beat  — OBJECTIVE_PHASE_CHANGED to OBJECTIVE_PHASE_CHANGED
  // Plus L4 = the whole stage run, treated as one loop (campaign-level re-entry unit).
  const windowsBetween = (ticksArr) => {
    const out = [];
    for (let i = 0; i < ticksArr.length - 1; i += 1) {
      const from = ticksArr[i]; const to = ticksArr[i + 1];
      const inWin = actions.filter((a) => a.tick > from && a.tick <= to);
      out.push({
        fromTick: from, toTick: to, periodS: (to - from) / TICK_RATE,
        actions: inWin.length,
        distinctActionTypes: new Set(inWin.map((a) => a.type)).size,
        macroRewards: macroRewards.filter((r) => r.tick > from && r.tick <= to).length,
      });
    }
    return out;
  };
  const loopWindows = windowsBetween(growthOffers);
  const waveWindows = windowsBetween(waveStarts);
  const phaseWindows = windowsBetween(phaseChanges.map((p) => p.tick));
  const wholeRunWindow = {
    fromTick: 0, toTick: run.tick, periodS: run.tick / TICK_RATE,
    actions: actions.length,
    distinctActionTypes: new Set(actions.map((a) => a.type)).size,
    macroRewards: macroRewards.length,
  };

  const byType = {};
  for (const r of macroRewards) byType[r.type] = (byType[r.type] || 0) + 1;
  const actionsByType = {};
  for (const a of actions) actionsByType[a.type] = (actionsByType[a.type] || 0) + 1;

  return {
    stageId, seed, policy, redecideTicks, redecideHz: Number((TICK_RATE / redecideTicks).toFixed(2)),
    terminal: run.terminal, ticks, seconds: Number(seconds.toFixed(2)),
    finalLevel: run.commander.level, extracted: run.extracted, bossSpawned: run.bossSpawned,
    counts: {
      macroRewards: macroRewards.length, microRewards: microRewardCount.total,
      actions: actions.length, acceptedInputs, rejectedInputs,
      growthOffers: growthOffers.length, stanceSwitches: stanceSwitches.length,
    },
    macroRewardsByType: byType,
    actionsByType,
    macroRewardTimeline: macroRewards.map((r) => ({ atS: Number((r.tick / TICK_RATE).toFixed(2)), type: r.type })),
    interMacroRewardS: deltas(macroTicks),
    interGrowthOfferS: deltas(growthOffers),
    interWaveS: deltas(waveStarts),
    phaseChanges: phaseChanges.map((p) => ({ atS: Number((p.tick / TICK_RATE).toFixed(2)), phase: p.phase })),
    encounters,
    interEncounterS: deltas(encounters.map((e) => e.tick)),
    loopWindows, waveWindows, phaseWindows, wholeRunWindow,
  };
}

const stats = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const sum = s.reduce((a, b) => a + b, 0);
  const q = (p) => s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
  return {
    n: s.length,
    min: Number(s[0].toFixed(2)), p25: Number(q(0.25).toFixed(2)), median: Number(q(0.5).toFixed(2)),
    p75: Number(q(0.75).toFixed(2)), max: Number(s[s.length - 1].toFixed(2)),
    mean: Number((sum / s.length).toFixed(2)),
  };
};

// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const outIdx = args.indexOf("--output");
const output = outIdx === -1 ? null : args[outIdx + 1];
const polIdx = args.indexOf("--policy");
const policies = polIdx === -1 ? ["minimal", "engaged", "bot"] : [args[polIdx + 1]];
if (!output) { console.error("usage: measure-g7-core-loop.mjs --output <path.json> [--policy p]"); process.exit(2); }

const stageIds = ["cinder-span", STAGES[2]?.id, STAGES[4]?.id].filter(Boolean);
const seeds = [901, 902, 903];
const cadIdx = args.indexOf("--cadences");
const cadences = cadIdx === -1 ? [1, 6, 15, 30] : args[cadIdx + 1].split(",").map(Number);
const t0 = Date.now();
const runs = [];
for (const policy of policies) {
  for (const stageId of stageIds) {
    const stage = STAGE_BY_ID[stageId];
    if (!stage) { console.error(`skip unknown stage ${stageId}`); continue; }
    for (const seed of seeds) {
      for (const redecideTicks of cadences) {
        runs.push(measureRun({ stageId, seed, loadout: ["ember-cohort", "rift-lens", "veil-vanguard"], policy, redecideTicks }));
      }
    }
  }
}

const candidateStats = (windows) => ({
  windowCount: windows.length,
  periodS: stats(windows.map((l) => l.periodS)),
  actionsPerLoop: stats(windows.map((l) => l.actions)),
  distinctActionTypesPerLoop: stats(windows.map((l) => l.distinctActionTypes)),
  macroRewardsPerLoop: stats(windows.map((l) => l.macroRewards)),
});

const summaryFor = (policy, redecideTicks) => {
  const rs = runs.filter((r) => r.policy === policy && r.redecideTicks === redecideTicks);
  if (!rs.length) return null;
  return {
    policy, redecideTicks, redecideHz: Number((TICK_RATE / redecideTicks).toFixed(2)), runs: rs.length,
    outcomes: rs.reduce((acc, r) => { acc[r.terminal ?? "TIMEOUT"] = (acc[r.terminal ?? "TIMEOUT"] || 0) + 1; return acc; }, {}),
    victoryRate: Number((rs.filter((r) => r.terminal === "VICTORY" || r.terminal === "FINAL_COMPLETION").length / rs.length).toFixed(3)),
    runSeconds: stats(rs.map((r) => r.seconds)),
    interMacroRewardS: stats(rs.flatMap((r) => r.interMacroRewardS)),
    interGrowthOfferS: stats(rs.flatMap((r) => r.interGrowthOfferS)),
    interWaveS: stats(rs.flatMap((r) => r.interWaveS)),
    interEncounterS: stats(rs.flatMap((r) => r.interEncounterS)),
    loopCandidates: {
      L1_growthOfferCircuit: candidateStats(rs.flatMap((r) => r.loopWindows)),
      L2_waveCircuit: candidateStats(rs.flatMap((r) => r.waveWindows)),
      L3_objectivePhaseBeat: candidateStats(rs.flatMap((r) => r.phaseWindows)),
      L4_wholeStageRun: candidateStats(rs.map((r) => r.wholeRunWindow)),
    },
    macroRewardsPerMinute: stats(rs.map((r) => (r.counts.macroRewards / r.seconds) * 60)),
    actionsPerMinute: stats(rs.map((r) => (r.counts.actions / r.seconds) * 60)),
  };
};

const payload = {
  generatedAt: new Date().toISOString(),
  runId: "20260725-wellmade-verification",
  tickRate: TICK_RATE,
  method: "real createDefenseRun/advanceDefenseRun instrumented per-tick; events deduped by eventSequence; sim unmodified",
  stageIds, seeds, cadences,
  macroRewardEventTypes: [...MACRO_REWARD_EVENTS],
  summaries: policies.flatMap((p) => cadences.map((c) => summaryFor(p, c))).filter(Boolean),
  runs,
};
const outPath = resolve(output);
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(payload, null, 2), "utf8");
console.log(`g7: ${runs.length} runs in ${Date.now() - t0}ms -> ${outPath}`);
for (const s of payload.summaries) {
  console.log(`  [${s.policy} @${s.redecideHz}Hz] run=${s.runSeconds?.median}s win=${s.victoryRate} ${JSON.stringify(s.outcomes)} interMacroReward=${s.interMacroRewardS?.median}s`);
  for (const [id, c] of Object.entries(s.loopCandidates)) {
    console.log(`      ${id.padEnd(24)} n=${String(c.windowCount).padStart(3)} period=${c.periodS?.median ?? "-"}s actions=${c.actionsPerLoop?.median ?? "-"} types=${c.distinctActionTypesPerLoop?.median ?? "-"} rewards=${c.macroRewardsPerLoop?.median ?? "-"}`);
  }
}
