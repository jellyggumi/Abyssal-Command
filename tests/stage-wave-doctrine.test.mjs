import assert from "node:assert/strict";
import test from "node:test";

import {
  CARRY_OVER_MAX_ITEMS, CARRY_OVER_MAX_RANK, ENEMIES, ITEMS, MIDBOSS_PROFILE, OCTANT_VECTORS,
  PLAYER_BASELINE_DPS, SKILLS, STAGES, STAGE_BY_ID, STAGE_WAVE_DOCTRINE, TICK_RATE, WAVE_KIND_PROFILE,
} from "../defense-catalog.js";
import {
  advanceDefenseRun, createDefenseRun, getRunSnapshot, isTerminalRun, queueInput, runCarryOver,
} from "../defense-run-simulation.js";
import { applyRunCarryOver, createCampaign, restoreCampaign, serializeCampaign } from "../campaign-state.js";


/** Advances `ticks`, resolving growth offers as they appear — the run PAUSES on a pending offer. */
function advanceResolving(run, ticks, pick = (snapshot) => snapshot.growthOffer.choices[0], collected = null) {
  let current = run;
  for (let step = 0; step < ticks && !isTerminalRun(current); step += 1) {
    const snapshot = getRunSnapshot(current);
    if (collected) collected.push(...snapshot.events);
    if (snapshot.growthOffer) current = queueInput(current, "GROWTH_OFFER_SELECTED", { skillId: pick(snapshot) });
    current = advanceDefenseRun(current, 1);
  }
  if (collected) collected.push(...getRunSnapshot(current).events);
  return current;
}

const PLAYTIME_MIN_SECONDS = 180;
const PLAYTIME_MAX_SECONDS = 360;

test("every stage publishes a long-form doctrine wave plan", () => {
  for (const { id } of STAGES) {
    const stage = STAGE_BY_ID[id];
    const doctrine = STAGE_WAVE_DOCTRINE[id];
    assert.ok(doctrine, `${id} must have a wave doctrine`);
    assert.equal(stage.gateTicks, doctrine.defenseTicks, `${id} gate hold must come from its doctrine`);

    const holdSeconds = stage.gateTicks / TICK_RATE;
    assert.ok(holdSeconds >= 160 && holdSeconds <= 250,
      `${id} authored hold ${holdSeconds}s must sit in the 160-250s band that produces a 3-6 minute stage`);

    const plan = stage.wavePlan;
    assert.equal(plan.length, doctrine.waveCount, `${id} must schedule every doctrine wave`);
    assert.ok(plan.length >= 10, `${id} must field at least 10 waves, got ${plan.length}`);
    assert.equal(plan[0].tick, 0, `${id} must open on tick 0`);
    assert.equal(plan.at(-1).kind, "big", `${id} must close the hold with a big wave`);
    assert.ok(plan.at(-1).tick < stage.gateTicks,
      `${id} last wave must land before the hold requirement expires`);

    const kinds = plan.map((wave) => wave.kind);
    assert.ok(kinds.filter((kind) => kind === "mid").length >= 2, `${id} must field at least two mid-boss waves`);
    assert.ok(kinds.filter((kind) => kind === "big").length >= 2, `${id} must field at least two big waves`);
    assert.ok(kinds.every((kind) => Object.hasOwn(WAVE_KIND_PROFILE, kind)), `${id} wave kinds must be authored kinds`);

    const gaps = plan.slice(1).map((wave, index) => wave.tick - plan[index].tick);
    assert.equal(new Set(gaps).size, 1, `${id} doctrine cadence must be even`);
    assert.ok(gaps[0] >= 600, `${id} cadence ${gaps[0]} ticks must leave at least 10s of clear-up room`);

    for (const wave of plan) {
      assert.ok(wave.direction, `${id} wave ${wave.slot} must pin an approach lane`);
      // Only the statement waves pin a wave-level policy. A big wave is the map's pressure
      // push and a mid wave escorts its mid-boss, so both must name one. A normal wave must
      // deliberately leave it unpinned: buildWaveSchedule then keeps rolling the seeded
      // policy pool, which is the only place player-pursuit and low-hp-focus reach play.
      // Its lead class still carries its own policy, so the wave is never policy-less.
      if (wave.kind === "big" || wave.kind === "mid") {
        assert.ok(wave.policyId, `${id} wave ${wave.slot} (${wave.kind}) must pin an enemy policy`);
      } else {
        assert.equal(wave.policyId, undefined,
          `${id} wave ${wave.slot} (${wave.kind}) must leave the policy to the seeded pool`);
        assert.ok(ENEMIES[wave.primary.enemy]?.policyId,
          `${id} wave ${wave.slot} lead class ${wave.primary.enemy} must carry its own policy`);
      }
      assert.equal(wave.alternatives.length, 2, `${id} wave ${wave.slot} must keep a seeded remix alternative`);
      for (const alternative of wave.alternatives) {
        assert.ok(alternative.composition.every(({ enemy, count }) => ENEMIES[enemy] && count >= 1),
          `${id} wave ${wave.slot} alternative ${alternative.id} must field real enemies`);
      }
      assert.equal(Boolean(wave.midboss), wave.kind === "mid",
        `${id} wave ${wave.slot}: a mid-boss belongs to a mid wave and nowhere else`);
    }
  }
});

test("wave body counts stay inside the authored clear budget instead of scaling with stage HP", () => {
  for (const { id } of STAGES) {
    const stage = STAGE_BY_ID[id];
    const cadenceSeconds = (stage.wavePlan[1].tick - stage.wavePlan[0].tick) / TICK_RATE;
    const clearableHp = cadenceSeconds * PLAYER_BASELINE_DPS;
    for (const wave of stage.wavePlan) {
      const waveHp = wave.alternatives[0].composition
        .reduce((total, { enemy, count }) => total + (ENEMIES[enemy].hp * stage.scale / 100) * count, 0);
      // A wave may ask for more than one cadence slot of clearing (that is the pressure), but never
      // more than double it — beyond that the hold stops being clearable by the floor player and the
      // stage stalls instead of ending, which is what measurement caught before the budget existed.
      assert.ok(waveHp <= clearableHp * 2,
        `${id} wave ${wave.slot} (${wave.kind}) asks ${Math.round(waveHp)} HP against a ${Math.round(clearableHp)} HP clear budget`);
    }
  }
});

test("a mid-boss is a non-elite budget-sized wall that holds the gate-defense objective open", () => {
  const stage = STAGE_BY_ID["cinder-span"];
  const midWave = stage.wavePlan.find((wave) => wave.kind === "mid");
  const cadenceSeconds = (stage.wavePlan[1].tick - stage.wavePlan[0].tick) / TICK_RATE;
  assert.equal(
    midWave.midboss.hp,
    Math.round((cadenceSeconds * PLAYER_BASELINE_DPS * MIDBOSS_PROFILE.hpBudgetBp) / 10000),
    "mid-boss HP must be the authored share of one cadence clear budget",
  );

  let run = createDefenseRun({ stageId: "cinder-span", seed: 7 });
  const events = [];
  run = advanceResolving(run, midWave.tick + 2, undefined, events);
  const snapshot = getRunSnapshot(run);
  const midbosses = snapshot.enemies.filter((enemy) => enemy.midboss);
  assert.equal(midbosses.length, 1, "a mid wave spawns exactly one mid-boss");
  const [midboss] = midbosses;
  assert.equal(midboss.elite, false, "a mid-boss must not enter the elite extraction flow");
  assert.equal(midboss.midbossId, midWave.midboss.id);
  assert.equal(midboss.maxHp, midWave.midboss.hp);
  assert.ok(midboss.damage > ENEMIES[midWave.midboss.enemy].damage, "a mid-boss hits harder than its base class");
  assert.ok(midboss.speed < ENEMIES[midWave.midboss.enemy].speed, "a mid-boss is slower than its base class");
  assert.ok(events.some((event) => event.type === "MIDBOSS_SPAWNED" && event.midbossId === midWave.midboss.id),
    "a mid-boss spawn is announced");

  // The gate-defense objective may not close while a mid-boss is still on the field.
  let guard = run;
  for (let step = 0; step < 400; step += 1) {
    const state = getRunSnapshot(guard);
    if (!state.enemies.some((enemy) => enemy.midboss)) break;
    assert.equal(state.objectives.gateDefense.completed, false,
      "gate defense cannot complete while a mid-boss is alive");
    guard = advanceResolving(guard, 1);
  }
});

test("clearing a wave pays back both bars once, and never past the maximum", () => {
  let run = createDefenseRun({ stageId: "cinder-span", seed: 11 });
  const cleared = [];
  for (let tick = 0; tick < 4000 && !isTerminalRun(run); tick += 1) {
    run = advanceResolving(run, 1);
    const snapshot = getRunSnapshot(run);
    for (const event of snapshot.events.filter((entry) => entry.type === "WAVE_CLEARED")) {
      cleared.push(event);
      assert.ok(snapshot.commander.integrity <= snapshot.commander.maxIntegrity, "commander recovery is capped");
      assert.ok(snapshot.gate.integrity <= snapshot.gate.maxIntegrity, "gate recovery is capped");
      assert.ok(event.commanderRecovered >= 0 && event.gateRecovered >= 0, "recovery is never negative");
    }
  }
  assert.ok(cleared.length >= 1, "at least one wave must be clearable inside its cadence slot");
  assert.equal(new Set(cleared.map((event) => event.waveIndex)).size, cleared.length,
    "each scheduled wave pays its clear recovery at most once");
});

test("re-picking a learned skill ranks it up instead of duplicating it", () => {
  let run = createDefenseRun({ stageId: "cinder-span", seed: 3 });
  let picks = 0;
  let rankUpSeen = false;
  for (let tick = 0; tick < 20000 && !isTerminalRun(run) && !rankUpSeen; tick += 1) {
    const snapshot = getRunSnapshot(run);
    if (snapshot.growthOffer) {
      const owned = snapshot.growthOffer.choices.find((skillId) => snapshot.commander.skills.includes(skillId));
      run = queueInput(run, "GROWTH_OFFER_SELECTED", { skillId: owned ?? snapshot.growthOffer.choices[0] });
      picks += 1;
      if (owned) {
        const beforeDamage = snapshot.commander.basicDamage;
        const beforeRank = snapshot.commander.skillRanks[owned] ?? 1;
        run = advanceDefenseRun(run, 1);
        const after = getRunSnapshot(run);
        rankUpSeen = true;
        assert.equal(after.commander.skillRanks[owned], beforeRank + 1, "re-picking an owned skill raises its rank by one");
        assert.equal(after.commander.skills.filter((skillId) => skillId === owned).length, 1,
          "a rank-up must not duplicate the skill id");
        if (SKILLS[owned].kind === "passive") {
          assert.ok(after.commander.basicDamage > beforeDamage, "a passive rank-up banks more damage");
        }
        break;
      }
    }
    run = advanceDefenseRun(run, 1);
  }
  assert.ok(picks > 0, "growth offers must be reachable during the authored hold, not only after it");
  assert.ok(rankUpSeen, "an owned skill must remain offerable as a rank-up");
});

test("skill rank is worth measurable damage and cooldown on an active skill", () => {
  const skillId = "soul-lance";
  const rankOne = createDefenseRun({ stageId: "cinder-span", seed: 21, carryOver: { skillRanks: { [skillId]: 1 }, itemIds: [] } });
  const rankThree = createDefenseRun({ stageId: "cinder-span", seed: 21, carryOver: { skillRanks: { [skillId]: 3 }, itemIds: [] } });
  assert.equal(getRunSnapshot(rankOne).commander.skillRanks[skillId], 1);
  assert.equal(getRunSnapshot(rankThree).commander.skillRanks[skillId], 3);

  // Total damage dealt by the cast, counting an enemy that died from it as having lost all its HP.
  const castAndRead = (run) => {
    let current = run;
    for (let tick = 0; tick < 2000; tick += 1) {
      const before = getRunSnapshot(current);
      const inRange = before.enemies.some((enemy) => enemy.hp > 0
        && Math.hypot(enemy.x - before.commander.x, enemy.y - before.commander.y) < 5000);
      if (inRange) {
        const beforeHp = new Map(before.enemies.map((enemy) => [enemy.id, enemy.hp]));
        current = queueInput(current, "SKILL_CAST", { skillId });
        current = advanceDefenseRun(current, 1);
        const after = getRunSnapshot(current);
        if ((after.commander.cooldowns[skillId] ?? 0) > 0) {
          const afterHp = new Map(after.enemies.map((enemy) => [enemy.id, enemy.hp]));
          let dealt = 0;
          for (const [id, hp] of beforeHp) dealt += hp - (afterHp.get(id) ?? 0);
          return { cooldown: after.commander.cooldowns[skillId], dealt };
        }
        continue;
      }
      current = advanceDefenseRun(current, 1);
    }
    return null;
  };

  const low = castAndRead(rankOne);
  const high = castAndRead(rankThree);
  assert.ok(low && high, "both runs must land a cast");
  assert.ok(high.cooldown < low.cooldown,
    `rank 3 must cast more often (rank1=${low?.cooldown} rank3=${high?.cooldown})`);
  assert.ok(high.dealt > low.dealt,
    `rank 3 must hit harder than rank 1 on the same seed (rank1=${low?.dealt} rank3=${high?.dealt})`);
});

test("growth offers are reachable during the gate-defense hold", () => {
  let run = createDefenseRun({ stageId: "cinder-span", seed: 5 });
  let offerDuringHold = false;
  for (let tick = 0; tick < 9000 && !isTerminalRun(run) && !offerDuringHold; tick += 1) {
    const snapshot = getRunSnapshot(run);
    if (snapshot.growthOffer && !snapshot.objectives.gateDefense.completed) offerDuringHold = true;
    if (snapshot.growthOffer) run = queueInput(run, "GROWTH_OFFER_SELECTED", { skillId: snapshot.growthOffer.choices[0] });
    run = advanceDefenseRun(run, 1);
  }
  assert.ok(offerDuringHold, "the 160-250s hold must be playable with upgrades, not locked at level 1");
});

test("carry-over decays one rank, caps ranks and items, and re-applies at the next stage", () => {
  const carried = runCarryOver({
    commander: { skillRanks: { "rift-bolt": 5, "eclipse-edge": 1, "not-a-skill": 4 } },
    itemIds: ["ashen-sigil", "ward-splinter", "echo-compass", "hourglass-fragment"],
  });
  assert.ok(!Object.hasOwn(carried.skillRanks, "not-a-skill"), "unknown skill ids never carry");
  assert.equal(carried.skillRanks["rift-bolt"], CARRY_OVER_MAX_RANK, "ranks decay by one and cap at the authored max");
  assert.equal(carried.skillRanks["eclipse-edge"], 1, "rank 1 never decays below 1");
  assert.equal(carried.itemIds.length, CARRY_OVER_MAX_ITEMS, "at most the authored number of items carry");

  const baseline = createDefenseRun({ stageId: "abyss-chancel", seed: 9 });
  const carriedRun = createDefenseRun({ stageId: "abyss-chancel", seed: 9, carryOver: carried });
  const baseSnapshot = getRunSnapshot(baseline);
  const carriedSnapshot = getRunSnapshot(carriedRun);
  assert.deepEqual(carriedSnapshot.commander.skills, ["eclipse-edge", "rift-bolt"], "carried skills start the run learned");
  assert.equal(carriedSnapshot.commander.skillRanks["rift-bolt"], CARRY_OVER_MAX_RANK);
  assert.ok(carriedSnapshot.commander.basicDamage > baseSnapshot.commander.basicDamage,
    "a carried passive rank is worth real damage at the next stage");
  assert.ok(carriedSnapshot.commander.pickupRange >= baseSnapshot.commander.pickupRange,
    "carried item effects apply at run start");
  assert.ok(carriedSnapshot.events.some((event) => event.type === "CARRY_OVER_APPLIED"),
    "carry-over application is announced");
  assert.ok(carried.itemIds.every((itemId) => ITEMS[itemId]), "only authored items carry");
});

test("campaign persists carry-over on victory, clears it on defeat, and survives a save round-trip", () => {
  let campaign = createCampaign({ campaignId: "carry-over-test" });
  const carryOver = { version: 1, skillRanks: { "rift-bolt": 9, "not-a-skill": 2 }, itemIds: ["ashen-sigil", "not-an-item"] };
  campaign = applyRunCarryOver(campaign, { stageId: "cinder-span", outcome: "victory", carryOver });
  assert.deepEqual(campaign.stageCarryOver, {
    version: 1,
    stageId: "cinder-span",
    skillRanks: { "rift-bolt": CARRY_OVER_MAX_RANK },
    itemIds: ["ashen-sigil"],
  }, "unknown ids are dropped and ranks clamp to the authored cap");

  const restored = restoreCampaign(JSON.stringify(serializeCampaign(campaign)));
  assert.deepEqual(restored.stageCarryOver, campaign.stageCarryOver, "carry-over survives serialization");

  const defeated = applyRunCarryOver(campaign, { stageId: "cinder-span", outcome: "defeat" });
  assert.deepEqual(defeated.stageCarryOver, { version: 1, stageId: null, skillRanks: {}, itemIds: [] },
    "a defeat clears carry-over");

  const legacy = { ...serializeCampaign(campaign) };
  delete legacy.stageCarryOver;
  assert.ok(restoreCampaign(JSON.stringify(legacy)), "a pre-carry-over save still restores");
});

test("cinder-span plays for 3-6 minutes under an objective-seeking bot", () => {
  const octantFor = (dx, dy) => {
    let best = "IDLE";
    let bestDot = -Infinity;
    const length = Math.hypot(dx, dy) || 1;
    for (const [name, vector] of Object.entries(OCTANT_VECTORS)) {
      if (name === "IDLE") continue;
      const vectorLength = Math.hypot(vector.x, vector.y) || 1;
      const dot = (dx / length) * (vector.x / vectorLength) + (dy / length) * (vector.y / vectorLength);
      if (dot > bestDot) { bestDot = dot; best = name; }
    }
    return best;
  };

  let run = createDefenseRun({ stageId: "cinder-span", seed: 101 });
  let ticks = 0;
  let lastOctant = null;
  while (!isTerminalRun(run) && ticks < TICK_RATE * 60 * 8) {
    const snapshot = getRunSnapshot(run);
    if (snapshot.growthOffer) {
      run = queueInput(run, "GROWTH_OFFER_SELECTED", { skillId: snapshot.growthOffer.choices[0] });
    } else {
      const ready = snapshot.commander.skills
        .filter((skillId) => SKILLS[skillId]?.kind === "active" && (snapshot.commander.cooldowns?.[skillId] ?? 0) === 0);
      if (ready.length) run = queueInput(run, "SKILL_CAST", { skillId: ready[0] });
      if (snapshot.eliteCandidate) run = queueInput(run, "EXTRACT_ELITE", { enemyId: snapshot.eliteCandidate.enemyId });
    }
    const phase = snapshot.objectives.phase;
    const living = snapshot.enemies.filter((enemy) => enemy.hp > 0);
    let target = null;
    if (phase === "occupation") target = snapshot.tactics.occupation;
    else if (phase === "extraction") target = snapshot.tactics.extraction;
    else if (living.length) {
      target = living.slice().sort((left, right) =>
        ((left.x - snapshot.commander.x) ** 2 + (left.y - snapshot.commander.y) ** 2)
        - ((right.x - snapshot.commander.x) ** 2 + (right.y - snapshot.commander.y) ** 2))[0];
    }
    if (target) {
      const distance = Math.hypot(target.x - snapshot.commander.x, target.y - snapshot.commander.y);
      const octant = target.radius && distance < target.radius * 0.5
        ? "IDLE"
        : octantFor(target.x - snapshot.commander.x, target.y - snapshot.commander.y);
      if (octant !== lastOctant) {
        run = queueInput(run, "MOVE", { octant });
        lastOctant = octant;
      }
    }
    run = advanceDefenseRun(run, 1);
    ticks += 1;
  }
  const finished = getRunSnapshot(run);
  const seconds = ticks / TICK_RATE;
  assert.equal(finished.terminal, "VICTORY", `bot run ended as ${finished.terminal} after ${seconds}s`);
  assert.ok(seconds >= PLAYTIME_MIN_SECONDS && seconds <= PLAYTIME_MAX_SECONDS,
    `a stage must last 3-6 minutes; measured ${seconds}s`);
});
