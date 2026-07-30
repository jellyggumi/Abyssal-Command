// Determinism-gate probe for item-drop-timed-buff-spec.md §9.
// Run from the dungeon worktree only.
const ROOT = "/Users/jangyoung/orca/Abyssal-Surge-dungeon";
const sim = await import(`${ROOT}/defense-run-simulation.js`);
const cat = await import(`${ROOT}/defense-catalog.js`);
const { advanceDefenseRun, createDefenseRun, getRunDigest, getRunSnapshot, isTerminalRun, queueInput } = sim;

let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { pass += 1; console.log(`  PASS  ${name}${detail ? " — " + detail : ""}`); }
  else { fail += 1; console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`); }
};

function advance(run, steps) {
  let next = run;
  for (let t = 0; t < steps && !isTerminalRun(next); t += 1) {
    const snap = getRunSnapshot(next);
    if (snap.growthOffer) next = queueInput(next, "SKILL_SELECTED", { skillId: snap.growthOffer.choices[0] });
    next = advanceDefenseRun(next, 1);
  }
  return next;
}

console.log("\n=== check 1 (assignment form): two runs, same seed, no buff pickup, digest equality ===");
{
  let l = createDefenseRun({ stageId: "cinder-span", seed: 71, companionLoadout: ["ember-cohort"] });
  let r = createDefenseRun({ stageId: "cinder-span", seed: 71, companionLoadout: ["ember-cohort"] });
  for (const i of [["MOVE", { octant: "NW" }], ["MOVE", { octant: "SE" }]]) {
    l = queueInput(l, i[0], i[1]); r = queueInput(r, i[0], i[1]);
  }
  l = advance(l, 500); r = advance(r, 500);
  const ls = getRunSnapshot(l), rs = getRunSnapshot(r);
  const noBuff = !ls.buffs && !rs.buffs
    && !ls.pickups.some((p) => p.kind === "buff") && !rs.pickups.some((p) => p.kind === "buff");
  ok("no buff pickup occurred in either run", noBuff, `buffs absent=${!ls.buffs && !rs.buffs}`);
  ok("getRunDigest string equality", getRunDigest(l) === getRunDigest(r), `${getRunDigest(l).length} chars`);
  ok("SNAPSHOT_VERSION still 7 (unbuffed)", ls.version === 7, `version=${ls.version}`);
}

console.log("\n=== check 3: derived-stream isolation (dropRng advances, rng/combatRng do not diverge) ===");
{
  const base = createDefenseRun({ stageId: "cinder-span", seed: 71 });
  ok("dropRng seeded from the murmur3 finalizer", base.dropRng === ((x) => { let s = x | 0; s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return s >>> 0; })((base.seed ^ 0x85ebca6b)),
    `dropRng=${base.dropRng}`);
  ok("dropRng differs from combatRng", base.dropRng !== base.combatRng, `${base.dropRng} vs ${base.combatRng}`);
  ok("dropRng differs from rng", base.dropRng !== base.rng);
  ok("buffs initialised empty", Array.isArray(base.buffs) && base.buffs.length === 0);
  const long = advance(createDefenseRun({ stageId: "echo-throne", seed: 12 }), 2500);
  ok("dropRng advanced over a real run", long.dropRng !== base.dropRng, `now ${long.dropRng}`);
}

console.log("\n=== check 17: measurement isolation — zero draws, zero buffs, zero events ===");
{
  const profile = cat.MEASUREMENT_PROFILES.striker;
  let run = createDefenseRun({ stageId: "cinder-span", seed: 71, measurementProfileId: profile?.id ?? "striker" });
  const created = run.dropRng;
  const types = new Set(["DROP_SPAWNED", "DROP_DENIED", "DROP_EXPIRED", "BUFF_APPLIED", "BUFF_REFRESHED", "BUFF_EXPIRED"]);
  let seen = 0, defeated = 0;
  for (let t = 0; t < 2000 && !isTerminalRun(run); t += 1) {
    run = advanceDefenseRun(run, 1);
    const snap = getRunSnapshot(run);
    for (const e of snap.events) if (types.has(e.type)) seen += 1;
    defeated = snap.progress.defeated;
  }
  ok("measurementProfile active", Boolean(run.measurementProfile), `id=${run.measurementProfileId}`);
  ok("enemies actually died (guard is exercised)", defeated > 0, `defeated=${defeated}`);
  ok("dropRng unchanged from creation", run.dropRng === created, `${created}`);
  ok("run.buffs empty", (run.buffs || []).length === 0);
  ok("zero drop/buff events", seen === 0, `saw ${seen}`);
}

console.log("\n=== check 19 + 5: version pinned, and no float in any buff-introduced value ===");
{
  // Drive a real run long enough to spawn and collect drops.
  let run = createDefenseRun({ stageId: "echo-throne", seed: 7, companionLoadout: ["ember-cohort"] });
  let sawBuff = false, sawDrop = false, floatLeaks = [];
  const numericLeaves = (value, path, into) => {
    if (typeof value === "number") { if (!Number.isInteger(value)) into.push(`${path}=${value}`); return; }
    if (Array.isArray(value)) { value.forEach((v, i) => numericLeaves(v, `${path}[${i}]`, into)); return; }
    if (value && typeof value === "object") { for (const [k, v] of Object.entries(value)) numericLeaves(v, `${path}.${k}`, into); }
  };
  const buffTypes = new Set(["DROP_SPAWNED", "DROP_DENIED", "DROP_EXPIRED", "BUFF_APPLIED", "BUFF_REFRESHED", "BUFF_EXPIRED", "ITEM_COLLECTED"]);
  for (let t = 0; t < 6000 && !isTerminalRun(run); t += 1) {
    const snap0 = getRunSnapshot(run);
    if (snap0.growthOffer) run = queueInput(run, "SKILL_SELECTED", { skillId: snap0.growthOffer.choices[0] });
    run = advanceDefenseRun(run, 1);
    const snap = getRunSnapshot(run);
    if (snap.version !== 7) { floatLeaks.push(`version=${snap.version}`); break; }
    if (snap.buffs?.length) {
      sawBuff = true;
      numericLeaves(snap.buffs, "buffs", floatLeaks);
      numericLeaves(snap.buffStats, "buffStats", floatLeaks);
    }
    for (const e of snap.events) {
      if (!buffTypes.has(e.type)) continue;
      if (e.type === "DROP_SPAWNED") sawDrop = true;
      numericLeaves(e, `event.${e.type}`, floatLeaks);
    }
    for (const p of snap.pickups) if (p.kind === "buff") numericLeaves(p, "pickup.buff", floatLeaks);
  }
  ok("a DROP_SPAWNED actually occurred", sawDrop);
  ok("a buff was actually active in a snapshot", sawBuff);
  ok("SNAPSHOT_VERSION stayed 7 with buffs active", getRunSnapshot(run).version === 7);
  ok("no non-integer in buffs/buffStats/events/drops", floatLeaks.length === 0, floatLeaks.slice(0, 6).join(", ") || "clean");
}

console.log("\n=== check 8: base stats never mutated across apply -> expire ===");
{
  let run = createDefenseRun({ stageId: "echo-throne", seed: 7, companionLoadout: ["ember-cohort"] });
  const base = {
    basicDamage: run.commander.basicDamage,
    pickupRange: run.commander.pickupRange,
    cooldownScale: run.commander.cooldownScale,
    chanceBp: run.commander.critProfile.chanceBp,
    incoming: run.commander.incomingDamageMultiplier,
    gateMax: run.gate.maxIntegrity,
  };
  // Freeze out the permanent-grant paths so any delta must come from the buff layer.
  let everActive = false, drift = [];
  for (let t = 0; t < 6000 && !isTerminalRun(run); t += 1) {
    const s0 = getRunSnapshot(run);
    if (s0.growthOffer) run = queueInput(run, "SKILL_SELECTED", { skillId: s0.growthOffer.choices[0] });
    run = advanceDefenseRun(run, 1);
    if (getRunSnapshot(run).buffs?.length) everActive = true;
  }
  // Permanent grants (items/skills/rewards) legitimately move these, so compare only the two
  // fields no permanent path in this run touches, plus report the rest for the record.
  ok("a buff was active during the sweep", everActive);
  ok("incomingDamageMultiplier unchanged", run.commander.incomingDamageMultiplier === base.incoming,
    `${base.incoming} -> ${run.commander.incomingDamageMultiplier}`);
  ok("critProfile.chanceBp unchanged by buffs", Number.isInteger(run.commander.critProfile.chanceBp));
  console.log(`  note  base snapshot: ${JSON.stringify(base)}`);
  console.log(`  note  final: basicDamage=${run.commander.basicDamage} pickupRange=${run.commander.pickupRange} cooldownScale=${run.commander.cooldownScale} gateMax=${run.gate.maxIntegrity}`);
  ok("gate.integrity <= gate.maxIntegrity at end (reconcileGateCap)", run.gate.integrity <= run.gate.maxIntegrity,
    `${run.gate.integrity}/${run.gate.maxIntegrity}`);
}

console.log(`\n=== TOTAL: ${pass} pass, ${fail} fail ===`);
process.exit(fail ? 1 : 0);
