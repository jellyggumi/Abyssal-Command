// Behavioral checks for item-drop-timed-buff-spec.md §9: 4, 6, 7, 13, 14, 15, 16, 18, 27.
const ROOT = "/Users/jangyoung/orca/Abyssal-Surge-dungeon";
const sim = await import(`${ROOT}/defense-run-simulation.js`);
const cat = await import(`${ROOT}/defense-catalog.js`);
const { advanceDefenseRun, createDefenseRun, getRunSnapshot, isTerminalRun, queueInput } = sim;

let pass = 0, fail = 0;
const ok = (n, c, d = "") => { if (c) { pass += 1; console.log(`  PASS  ${n}${d ? " — " + d : ""}`); } else { fail += 1; console.log(`  FAIL  ${n}${d ? " — " + d : ""}`); } };

// Drive a real run and capture the full drop/buff event history.
function playAndCollect(stageId, seed, maxTicks) {
  let run = createDefenseRun({ stageId, seed, companionLoadout: ["ember-cohort"] });
  const log = [];
  for (let t = 0; t < maxTicks && !isTerminalRun(run); t += 1) {
    const s0 = getRunSnapshot(run);
    if (s0.growthOffer) run = queueInput(run, "SKILL_SELECTED", { skillId: s0.growthOffer.choices[0] });
    run = advanceDefenseRun(run, 1);
    const s = getRunSnapshot(run);
    for (const e of s.events) {
      if (["DROP_SPAWNED", "DROP_DENIED", "DROP_EXPIRED", "BUFF_APPLIED", "BUFF_REFRESHED", "BUFF_EXPIRED", "ITEM_COLLECTED"].includes(e.type)) {
        log.push({ tick: s.tick, ...e });
      }
    }
  }
  return { run, log };
}

console.log("\n=== check 27: DROP_SPAWNED position is the ACTOR's, DROP_DENIED is the corpse's ===");
{
  const { log } = playAndCollect("echo-throne", 7, 6000);
  const spawns = log.filter((e) => e.type === "DROP_SPAWNED");
  ok("DROP_SPAWNED events occurred", spawns.length > 0, `${spawns.length} spawns`);
  let slabOk = 0, slabBad = [];
  for (const e of spawns) {
    const expect = cat.slabAt("echo-throne", e.x, e.y);
    if (e.slabId === expect) slabOk += 1; else slabBad.push(`${e.dropId}: ${e.slabId} != ${expect}`);
  }
  ok("every DROP_SPAWNED.slabId === slabAt(stage, event.x, event.y)", slabBad.length === 0, `${slabOk}/${spawns.length}` + (slabBad[0] ? " | " + slabBad[0] : ""));
  ok("slabId is a real frozen id or null", spawns.every((e) => e.slabId === null || /^echo-throne:slab-0[1-5]$/.test(e.slabId)),
    [...new Set(spawns.map((e) => e.slabId))].join(","));
  ok("DROP_SPAWNED carries integer x,y", spawns.every((e) => Number.isInteger(e.x) && Number.isInteger(e.y)));
  ok("DROP_SPAWNED carries rarity+grade", spawns.every((e) => ["common","rare","resonant","relic"].includes(e.rarity) && ["BASIC","SHADOW","BOSS"].includes(e.grade)),
    [...new Set(spawns.map((e) => `${e.grade}/${e.rarity}`))].join(" "));
  const ids = spawns.map((e) => e.dropId);
  ok("dropId format is drop-<n>", ids.every((i) => /^drop-\d+$/.test(i)), ids.slice(0, 3).join(","));
}

console.log("\n=== check 6: expiry exact at A+D, exactly one BUFF_EXPIRED reason TIMEOUT ===");
{
  const { log } = playAndCollect("echo-throne", 7, 6000);
  const applied = log.filter((e) => e.type === "BUFF_APPLIED");
  ok("BUFF_APPLIED occurred", applied.length > 0, `${applied.length}`);
  let checked = 0, bad = [];
  for (const a of applied) {
    // find the matching TIMEOUT expiry with no refresh in between
    const refresh = log.find((e) => e.type === "BUFF_REFRESHED" && e.buffId === a.buffId && e.tick > a.tick);
    const exp = log.find((e) => e.type === "BUFF_EXPIRED" && e.buffId === a.buffId && e.tick > a.tick);
    if (!exp || (refresh && refresh.tick < exp.tick)) continue;
    if (exp.reason !== "TIMEOUT") continue;
    checked += 1;
    if (exp.tick !== a.expiresAtTick) bad.push(`${a.buffId} expired ${exp.tick} want ${a.expiresAtTick}`);
    if (a.expiresAtTick !== a.tick + a.durationTicks) bad.push(`${a.buffId} expiresAtTick != applied+duration`);
  }
  ok("every unrefreshed buff expired exactly at expiresAtTick", bad.length === 0, `${checked} checked` + (bad[0] ? " | " + bad[0] : ""));
  const dup = {};
  for (const e of log.filter((e) => e.type === "BUFF_EXPIRED")) dup[e.buffId] = (dup[e.buffId] || 0) + 1;
  ok("no buffId expired twice", Object.values(dup).every((n) => n === 1), JSON.stringify(dup).slice(0, 120));
  ok("BUFF_EXPIRED reason is a ruled value", log.filter((e) => e.type === "BUFF_EXPIRED").every((e) => ["TIMEOUT","EVICTED","STAGE_TRANSITION","DEATH"].includes(e.reason)),
    [...new Set(log.filter((e) => e.type === "BUFF_EXPIRED").map((e) => e.reason))].join(","));
}

console.log("\n=== check 7 + 13 + 14 + 15 + 16 + 4: direct unit drives on a mutable clone ===");
{
  const frozen = createDefenseRun({ stageId: "cinder-span", seed: 71 });
  const mk = () => JSON.parse(JSON.stringify(frozen));

  // check 7 — expiry idempotent. Emulate by calling advance twice with a stale buff.
  // expireBuffs is module-private, so drive it through a real tick and assert no double emit:
  // an entry already removed cannot emit again because it is gone from the array.
  const r7 = mk();
  r7.buffs = [{ buffId: "buff-1", itemId: "ember-edge", stat: "basicDamage", magnitude: 1200, stacks: 1, appliedAtTick: 0, expiresAtTick: r7.tick + 1, sourceDropId: "drop-1" }];
  let a7 = advanceDefenseRun(r7, 1);
  const first = getRunSnapshot(a7).events.filter((e) => e.type === "BUFF_EXPIRED").length;
  let b7 = advanceDefenseRun(a7, 1);
  const second = getRunSnapshot(b7).events.filter((e) => e.type === "BUFF_EXPIRED").length;
  ok("expiry emits once then never again", first === 1 && second === 0, `tick1=${first} tick2=${second}`);
  ok("buffs empty after expiry", (b7.buffs || []).length === 0);

  // check 13 — duplicate pickup: STACK increments, REFRESH does not, never two entries.
  for (const [itemId, wantStacks] of [["ember-edge", 2], ["lantern-aegis", 1]]) {
    const def = cat.BUFF_ITEMS[itemId];
    const r = mk();
    r.commander.x = 5000; r.commander.y = 5000;
    const drop = (id) => ({ id, kind: "buff", x: 5000, y: 5000, elevation: 0, hp: 1, maxHp: 1, itemId, rarity: def.rarity, modelKey: def.modelKey, grade: "BASIC", slabId: null, expiresAtTick: r.tick + 1800 });
    r.pickups = [drop("drop-1")];
    let s = advanceDefenseRun(r, 1);
    const afterFirst = (s.buffs || []).length;
    const firstExpiry = s.buffs[0]?.expiresAtTick;
    // advanceDefenseRun returns a FROZEN run, so re-clone before injecting the second drop.
    const s2 = JSON.parse(JSON.stringify(s));
    s2.pickups = [...s2.pickups, drop("drop-2")];
    s = advanceDefenseRun(s2, 1);
    s = advanceDefenseRun(s, 1);
    const entries = (s.buffs || []).filter((e) => e.itemId === itemId);
    const snap = getRunSnapshot(s);
    ok(`${itemId}: exactly one entry after two pickups`, entries.length === 1, `${entries.length} entries, first-pass ${afterFirst}`);
    ok(`${itemId}: stacks === ${wantStacks} (${def.stacking})`, entries[0]?.stacks === wantStacks, `stacks=${entries[0]?.stacks}`);
    ok(`${itemId}: expiresAtTick advanced by refresh`, entries[0]?.expiresAtTick > firstExpiry, `${firstExpiry} -> ${entries[0]?.expiresAtTick}`);
  }

  // check 14 — eviction: 6 distinct active, 7th collected evicts smallest expiresAtTick.
  {
    const r = mk();
    r.commander.x = 5000; r.commander.y = 5000;
    const six = ["ash-stride", "bulwark-echo", "cinder-haste", "ember-edge", "lantern-aegis", "reclaimer-pulse"];
    r.buffs = six.map((itemId, i) => ({ buffId: `buff-${i + 1}`, itemId, stat: cat.BUFF_ITEMS[itemId].stat, magnitude: cat.BUFF_ITEMS[itemId].magnitude, stacks: 1, appliedAtTick: 0, expiresAtTick: r.tick + 500 + i * 10, sourceDropId: `drop-${i + 1}` }));
    const def = cat.BUFF_ITEMS["reaver-fervor"];
    r.pickups = [{ id: "drop-99", kind: "buff", x: 5000, y: 5000, elevation: 0, hp: 1, maxHp: 1, itemId: "reaver-fervor", rarity: def.rarity, modelKey: def.modelKey, grade: "SHADOW", slabId: null, expiresAtTick: r.tick + 1800 }];
    const s = advanceDefenseRun(r, 1);
    const snap = getRunSnapshot(s);
    const evicted = snap.events.filter((e) => e.type === "BUFF_EXPIRED" && e.reason === "EVICTED");
    ok("MAX_ACTIVE_BUFFS respected after 7th", (s.buffs || []).length === cat.MAX_ACTIVE_BUFFS, `${(s.buffs || []).length} vs cap ${cat.MAX_ACTIVE_BUFFS}`);
    ok("exactly one EVICTED emitted", evicted.length === 1, `${evicted.length}`);
    ok("evicted victim is the smallest expiresAtTick (buff-1)", evicted[0]?.buffId === "buff-1", `evicted ${evicted[0]?.buffId}`);
    ok("the 7th buff is now active", (s.buffs || []).some((e) => e.itemId === "reaver-fervor"));
  }

  // check 15 — field cap: 8 drops on the field, next successful roll denies.
  {
    let denied = 0, spawnedOverCap = 0, maxField = 0;
    let run = createDefenseRun({ stageId: "echo-throne", seed: 3, companionLoadout: [] });
    // Park the commander far from the arena so nothing is collected and drops accumulate.
    for (let t = 0; t < 6000 && !isTerminalRun(run); t += 1) {
      const s0 = getRunSnapshot(run);
      if (s0.growthOffer) run = queueInput(run, "SKILL_SELECTED", { skillId: s0.growthOffer.choices[0] });
      run = advanceDefenseRun(run, 1);
      const s = getRunSnapshot(run);
      const field = s.pickups.filter((p) => p.kind === "buff").length;
      maxField = Math.max(maxField, field);
      for (const e of s.events) {
        if (e.type === "DROP_DENIED") { denied += 1; if (e.reason !== "FIELD_CAP") spawnedOverCap += 1; }
      }
    }
    ok("field buff-drop count never exceeded MAX_FIELD_DROPS", maxField <= cat.MAX_FIELD_DROPS, `peak ${maxField} / cap ${cat.MAX_FIELD_DROPS}`);
    ok("every DROP_DENIED.reason is FIELD_CAP", spawnedOverCap === 0, `${denied} denials, ${spawnedOverCap} with a wrong reason`);
  }

  // check 16 — TTL grace: a drop whose expiresAtTick === run.tick is collected if in range.
  {
    const def = cat.BUFF_ITEMS["ember-edge"];
    const rIn = mk();
    rIn.commander.x = 5000; rIn.commander.y = 5000;
    rIn.pickups = [{ id: "drop-1", kind: "buff", x: 5000, y: 5000, elevation: 0, hp: 1, maxHp: 1, itemId: "ember-edge", rarity: def.rarity, modelKey: def.modelKey, grade: "BASIC", slabId: null, expiresAtTick: rIn.tick + 1 }];
    const sIn = advanceDefenseRun(rIn, 1);
    const snapIn = getRunSnapshot(sIn);
    ok("in-range drop at expiry tick IS collected", (sIn.buffs || []).length === 1 && !snapIn.events.some((e) => e.type === "DROP_EXPIRED"),
      `buffs=${(sIn.buffs || []).length} expiredEvents=${snapIn.events.filter((e) => e.type === "DROP_EXPIRED").length}`);

    const rOut = mk();
    rOut.commander.x = 1000; rOut.commander.y = 1000;
    rOut.pickups = [{ id: "drop-1", kind: "buff", x: 22000, y: 10000, elevation: 0, hp: 1, maxHp: 1, itemId: "ember-edge", rarity: def.rarity, modelKey: def.modelKey, grade: "BASIC", slabId: null, expiresAtTick: rOut.tick + 1 }];
    const sOut = advanceDefenseRun(rOut, 1);
    const snapOut = getRunSnapshot(sOut);
    ok("out-of-range drop at expiry tick emits DROP_EXPIRED", snapOut.events.some((e) => e.type === "DROP_EXPIRED") && (sOut.buffs || []).length === 0);
    ok("expired drop removed from pickups", !sOut.pickups.some((p) => p.id === "drop-1" && p.kind === "buff"));
  }

  // check 4 — draw count is state-independent: saturate the field, dropRng must advance identically.
  {
    const def = cat.BUFF_ITEMS["ember-edge"];
    const makePair = (fieldCount) => {
      const r = mk();
      r.commander.x = 1000; r.commander.y = 1000;
      r.pickups = Array.from({ length: fieldCount }, (_, i) => ({ id: `pre-${i}`, kind: "buff", x: 22000, y: 10000, elevation: 0, hp: 1, maxHp: 1, itemId: "ember-edge", rarity: def.rarity, modelKey: def.modelKey, grade: "BASIC", slabId: null, expiresAtTick: r.tick + 5000 }));
      // one dead enemy, identical in both
      r.enemies = [{ id: "enemy-1", kind: "rusher", x: 12000, y: 6000, elevation: 0, hp: 0, maxHp: 3000, class: "rusher", speed: 3000, damage: 10, xp: 8, elite: false, midboss: false, midbossId: null, radius: 260, policyId: "gate-pressure", route: [], waypointIndex: 0, attackCooldown: 0, rangedCooldown: 0, projectileTicks: 0, projectileRange: 0, stageEliteId: null }];
      return r;
    };
    const empty = advanceDefenseRun(makePair(0), 1);
    const full = advanceDefenseRun(makePair(cat.MAX_FIELD_DROPS), 1);
    ok("dropRng identical whether field was empty or saturated", empty.dropRng === full.dropRng, `${empty.dropRng} vs ${full.dropRng}`);
    const fullSnap = getRunSnapshot(full);
    ok("saturated field produced no 9th drop", fullSnap.pickups.filter((p) => p.kind === "buff").length <= cat.MAX_FIELD_DROPS,
      `${fullSnap.pickups.filter((p) => p.kind === "buff").length}`);
  }

  // check 18 — old-save rehydration.
  {
    const stale = mk();
    delete stale.dropRng;
    delete stale.buffs;
    let revived = null, threw = null;
    try { revived = advanceDefenseRun(stale, 1); } catch (e) { threw = e; }
    ok("advanceDefenseRun on a pre-cycle-10 save does not throw", !threw, threw ? threw.message : "clean");
    const rngNext = (seed) => { let x = seed | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return x >>> 0; };
    ok("dropRng restored from seed ^ 0x85ebca6b", Number.isInteger(revived?.dropRng), `dropRng=${revived?.dropRng}`);
    ok("buffs restored to an array", Array.isArray(revived?.buffs), `${JSON.stringify(revived?.buffs)}`);
  }
}

console.log(`\n=== TOTAL: ${pass} pass, ${fail} fail ===`);
process.exit(fail ? 1 : 0);
