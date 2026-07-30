// A/B digest comparison: base blob 033877ad vs the post-change dungeon tree, both loaded in ONE
// process, over a wide seed/stage/horizon sweep. Proves spec §9 check 1 as an identity, and
// isolates every divergence to a run where a buff drop demonstrably occurred.
const BASE = "/tmp/dbimpl-base/defense-run-simulation.js";
const HEAD = "/Users/jangyoung/orca/Abyssal-Surge-dungeon/defense-run-simulation.js";
const base = await import(BASE);
const head = await import(HEAD);

function play(mod, stageId, seed, ticks, loadout, measurementProfileId) {
  const opts = { stageId, seed, companionLoadout: loadout };
  if (measurementProfileId) opts.measurementProfileId = measurementProfileId;
  let run = mod.createDefenseRun(opts);
  for (const i of [["MOVE", { octant: "NW" }], ["MOVE", { octant: "SE" }]]) run = mod.queueInput(run, i[0], i[1]);
  for (let t = 0; t < ticks && !mod.isTerminalRun(run); t += 1) {
    const s = mod.getRunSnapshot(run);
    if (s.growthOffer) run = mod.queueInput(run, "SKILL_SELECTED", { skillId: s.growthOffer.choices[0] });
    run = mod.advanceDefenseRun(run, 1);
  }
  return run;
}

// Did the HEAD run ever touch the buff system? Replay watching the event stream.
function buffTouched(stageId, seed, ticks, loadout, measurementProfileId) {
  const opts = { stageId, seed, companionLoadout: loadout };
  if (measurementProfileId) opts.measurementProfileId = measurementProfileId;
  let run = head.createDefenseRun(opts);
  for (const i of [["MOVE", { octant: "NW" }], ["MOVE", { octant: "SE" }]]) run = head.queueInput(run, i[0], i[1]);
  let n = 0;
  for (let t = 0; t < ticks && !head.isTerminalRun(run); t += 1) {
    const s0 = head.getRunSnapshot(run);
    if (s0.growthOffer) run = head.queueInput(run, "SKILL_SELECTED", { skillId: s0.growthOffer.choices[0] });
    run = head.advanceDefenseRun(run, 1);
    for (const e of head.getRunSnapshot(run).events) {
      if (e.type === "DROP_SPAWNED" || e.type === "DROP_DENIED") n += 1;
    }
  }
  return n;
}

const stages = ["cinder-span", "abyss-chancel", "echo-throne"];
const seeds = [1, 4, 5, 12, 17, 42, 71, 99];
const horizons = [300, 500, 900];
const loadout = ["ember-cohort"];

let identical = 0, divergedClean = 0, divergedDirty = [];
for (const stageId of stages) {
  for (const seed of seeds) {
    for (const ticks of horizons) {
      const b = base.getRunDigest(play(base, stageId, seed, ticks, loadout));
      const h = head.getRunDigest(play(head, stageId, seed, ticks, loadout));
      if (b === h) { identical += 1; continue; }
      const rolls = buffTouched(stageId, seed, ticks, loadout);
      if (rolls > 0) divergedClean += 1;
      else divergedDirty.push(`${stageId} seed=${seed} ticks=${ticks} — DIVERGED WITH ZERO DROP ROLLS`);
    }
  }
}
const total = stages.length * seeds.length * horizons.length;
console.log(`\n=== §9 check 1 — zero-buff digest identity, base 033877ad vs HEAD ===`);
console.log(`  runs compared            : ${total}`);
console.log(`  byte-identical           : ${identical}`);
console.log(`  diverged, drops occurred : ${divergedClean}  (legitimate — Open risk 7 id renumber)`);
console.log(`  diverged, NO drops       : ${divergedDirty.length}  <-- must be 0`);
for (const d of divergedDirty) console.log(`      ${d}`);

// Measurement profiles must be identical at ANY horizon: zero draws by construction.
console.log(`\n=== §9 check 17 — measurement fixtures identical at long horizon ===`);
let mIdent = 0, mDiff = [];
for (const profileId of ["striker", "bulwark"]) {
  for (const stageId of stages) {
    for (const ticks of [500, 2000]) {
      const b = base.getRunDigest(play(base, stageId, 71, ticks, loadout, profileId));
      const h = head.getRunDigest(play(head, stageId, 71, ticks, loadout, profileId));
      if (b === h) mIdent += 1; else mDiff.push(`${profileId}/${stageId}/${ticks}`);
    }
  }
}
console.log(`  fixture runs identical   : ${mIdent} / ${mIdent + mDiff.length}`);
if (mDiff.length) console.log(`  DIFFERING: ${mDiff.join(", ")}`);

const failed = divergedDirty.length + mDiff.length;
console.log(`\n=== ${failed === 0 ? "GATE PASS" : "GATE FAIL"} ===`);
process.exit(failed ? 1 : 0);
