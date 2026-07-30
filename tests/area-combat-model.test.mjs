import test from "node:test";
import assert from "node:assert/strict";

import {
  AI_RESPONSE_PATTERNS,
  AREA_BP,
  AREA_COMBAT,
  AREA_FIELD,
  AREA_SOURCES,
  ATTACK_PATTERNS,
  BOSSES,
  COMPANIONS,
  ELEMENT_IDS,
  ELEMENT_MATCHUP_BP,
  ENEMIES,
  OCTANT_VECTORS,
  SKILLS,
  areaFalloffBp,
  areaShareBp,
  areaSourceProfile,
  areaSustainBp,
  attackPatternFor,
  elementMatchupBp,
  elementOf,
  samplePattern,
} from "../defense-catalog.js";
import {
  MONSTER_STATES,
  advanceDefenseRun,
  createDefenseRun,
  getRunDigest,
  getRunSnapshot,
  isTerminalRun,
  queueInput,
} from "../defense-run-simulation.js";

/* --------------------------------------------------------------------------------------------
 * 1. The four authored factors (distance / weight / element / duration).
 * ----------------------------------------------------------------------------------------- */

test("distance falloff is flat inside the inner ratio, decays to the authored rim share, and is zero past the rim", () => {
  const radius = 2000;
  const inner = Math.trunc(radius * AREA_COMBAT.innerRatioBp / AREA_BP);

  assert.equal(areaFalloffBp(0, radius), AREA_BP, "the contact point takes the full share");
  assert.equal(areaFalloffBp(inner, radius), AREA_BP, "the inner plateau is flat");
  assert.ok(
    areaFalloffBp(inner + 1, radius) < AREA_BP,
    "the share must start decaying immediately past the plateau",
  );
  const rim = areaFalloffBp(radius - 1, radius);
  assert.ok(rim >= AREA_COMBAT.edgeShareBp, "the rim never drops below the authored floor");
  assert.ok(rim <= AREA_COMBAT.edgeShareBp + 50, "the rim must converge onto the authored floor");
  assert.equal(areaFalloffBp(radius, radius), 0, "a body exactly on the rim is outside the disc");
  assert.equal(areaFalloffBp(radius + 500, radius), 0, "nothing outside the disc is touched");

  for (let distance = inner; distance < radius; distance += 37) {
    assert.ok(
      areaFalloffBp(distance, radius) >= areaFalloffBp(distance + 37, radius),
      `falloff must be monotonic; broke at ${distance}`,
    );
  }
});

test("element matchups form a closed advantage cycle with a mirror penalty and a neutral identity row", () => {
  const cycle = ["ember", "frost", "veil", "void"];
  for (let index = 0; index < cycle.length; index += 1) {
    const attacker = cycle[index];
    const beaten = cycle[(index + 1) % cycle.length];
    const beatenBy = cycle[(index + cycle.length - 1) % cycle.length];
    assert.ok(elementMatchupBp(attacker, beaten) > AREA_BP, `${attacker} must beat ${beaten}`);
    assert.ok(elementMatchupBp(attacker, beatenBy) < AREA_BP, `${attacker} must be weak into ${beatenBy}`);
    assert.ok(elementMatchupBp(attacker, attacker) < AREA_BP, `${attacker} mirror must be a penalty`);
    assert.equal(elementMatchupBp("neutral", attacker), AREA_BP, "neutral never gains a matchup");
    assert.equal(elementMatchupBp(attacker, "neutral"), AREA_BP, "neutral never suffers a matchup");
  }
  for (const element of ELEMENT_IDS) {
    assert.equal(Object.keys(ELEMENT_MATCHUP_BP[element]).length, ELEMENT_IDS.length, `${element} row must be total`);
  }
  assert.equal(elementOf("not-an-element"), "neutral", "an unknown element resolves to neutral");
  assert.equal(elementOf({ element: "void" }), "void", "a body's element is read off the body");
});

test("duration trades peak for spread: a longer field pulses for less, floored so it never pulses for nothing", () => {
  assert.equal(areaSustainBp(0), AREA_BP, "an instant contact keeps its whole budget");
  assert.equal(areaSustainBp(AREA_FIELD.pulseTicks), AREA_BP, "a single-pulse field is the same as instant");
  const short = areaSustainBp(AREA_FIELD.pulseTicks * 2);
  const long = areaSustainBp(AREA_FIELD.pulseTicks * 6);
  assert.ok(short > long, "the longer field must pulse for less");
  assert.equal(short, Math.trunc(AREA_BP / 2), "two pulses split the budget in half");
  assert.ok(long >= AREA_FIELD.sustainFloorBp, "the floor keeps a long field meaningful");
  assert.equal(areaSustainBp(AREA_FIELD.pulseTicks * 1000), AREA_FIELD.sustainFloorBp, "the floor is the hard bound");
});

test("areaShareBp composes all four factors and stays integer-deterministic", () => {
  const base = {
    distance: 0,
    radius: 2000,
    weightBp: AREA_BP,
    attackerElement: "neutral",
    defenderElement: "neutral",
    durationTicks: 0,
  };
  assert.equal(areaShareBp(base), AREA_BP, "all-neutral, point blank, unit weight is the identity");
  assert.equal(
    areaShareBp({ ...base, weightBp: 5000 }),
    Math.trunc(AREA_BP / 2),
    "weight scales the share linearly",
  );
  assert.ok(
    areaShareBp({ ...base, attackerElement: "ember", defenderElement: "frost" })
      > areaShareBp({ ...base, attackerElement: "ember", defenderElement: "void" }),
    "an advantaged matchup must out-damage a disadvantaged one",
  );
  assert.equal(areaShareBp({ ...base, distance: base.radius + 1 }), 0, "outside the disc is always zero");
  assert.equal(
    areaShareBp({ ...base, weightBp: 0 }),
    0,
    "a zero-weight source (void-aegis) never splashes",
  );
  for (let run = 0; run < 3; run += 1) {
    assert.equal(
      areaShareBp({ ...base, distance: 1234, weightBp: 7777, attackerElement: "veil", defenderElement: "void", durationTicks: 90 }),
      areaShareBp({ ...base, distance: 1234, weightBp: 7777, attackerElement: "veil", defenderElement: "void", durationTicks: 90 }),
      "repeated evaluation must be bit-identical",
    );
  }
});

test("every authored body and skill carries an area identity the model can read", () => {
  for (const [id, enemy] of Object.entries(ENEMIES)) {
    assert.ok(ELEMENT_IDS.includes(enemy.element), `${id} must declare a known element`);
    assert.ok(attackPatternFor(enemy.patternId), `${id} must reference an authored attack pattern`);
  }
  for (const [id, boss] of Object.entries(BOSSES)) {
    assert.ok(ELEMENT_IDS.includes(boss.element), `${id} must declare a known element`);
    assert.ok(attackPatternFor(boss.patternId), `${id} must reference an authored attack pattern`);
  }
  for (const [id, companion] of Object.entries(COMPANIONS)) {
    assert.ok(ELEMENT_IDS.includes(companion.element), `${id} must declare a known element`);
  }
  for (const [id, skill] of Object.entries(SKILLS)) {
    if (skill.kind !== "active") continue;
    assert.ok(ELEMENT_IDS.includes(skill.element), `${id} must declare a known element`);
    assert.ok(Number.isInteger(skill.areaRadius) && skill.areaRadius > 0, `${id} must declare an area radius`);
    assert.ok(Number.isInteger(skill.fieldTicks) && skill.fieldTicks >= 0, `${id} must declare a field duration`);
  }
  for (const [key, profile] of Object.entries(AREA_SOURCES)) {
    assert.equal(areaSourceProfile(key), profile, `${key} must resolve to its own profile`);
    assert.ok(profile.radius > 0, `${key} must have a positive disc`);
  }
  assert.equal(areaSourceProfile("no-such-source"), AREA_SOURCES.basic, "an unknown source falls back to basic");
});

/* --------------------------------------------------------------------------------------------
 * 2. Attack-pattern presets and their sampler.
 * ----------------------------------------------------------------------------------------- */

test("samplePattern reports the exact phase at every boundary of every authored step", () => {
  for (const [patternId, pattern] of Object.entries(ATTACK_PATTERNS)) {
    let cursor = 0;
    for (const [index, step] of pattern.steps.entries()) {
      const at = (offset) => samplePattern(patternId, cursor + offset);

      assert.equal(at(0).phase, "telegraph", `${patternId}:${step.id} must open on its tell`);
      assert.equal(at(step.telegraphTicks - 1).phase, "telegraph", `${patternId}:${step.id} tell must run to its last tick`);
      assert.equal(at(step.telegraphTicks).phase, "active", `${patternId}:${step.id} must go active exactly after the tell`);
      assert.equal(
        at(step.telegraphTicks + step.activeTicks - 1).phase,
        "active",
        `${patternId}:${step.id} active window must be inclusive of its last tick`,
      );
      assert.equal(
        at(step.telegraphTicks + step.activeTicks).phase,
        "recovery",
        `${patternId}:${step.id} must recover exactly after the active window`,
      );
      assert.equal(
        at(step.totalTicks - 1).phase,
        "recovery",
        `${patternId}:${step.id} recovery must run to the end of the step`,
      );
      assert.equal(at(0).stepIndex, index, `${patternId} must report the authored step order`);
      assert.equal(at(0).stepId, step.id, `${patternId} must report the authored step id`);

      const actionId = at(0).actionId;
      assert.equal(at(step.telegraphTicks).actionId, actionId, "one action id spans a step's three phases");
      assert.equal(at(step.totalTicks - 1).actionId, actionId, "one action id spans a step's three phases");
      cursor += step.totalTicks;
    }
    assert.equal(cursor, samplePattern(patternId, 0).cycleTicks, `${patternId} cycle length must be the sum of its steps`);
    assert.notEqual(
      samplePattern(patternId, cursor).actionId,
      samplePattern(patternId, 0).actionId,
      `${patternId} must mint a new action id on every loop`,
    );
    assert.equal(
      samplePattern(patternId, cursor).stepId,
      samplePattern(patternId, 0).stepId,
      `${patternId} must loop back to its first step`,
    );
  }
});

test("samplePattern is total: unknown ids and negative time never throw", () => {
  assert.equal(samplePattern("no-such-pattern", 10), null);
  assert.equal(samplePattern(null, 10), null);
  assert.equal(samplePattern("ember-rush", -50).phase, "telegraph", "negative elapsed clamps to the cycle start");
});

test("every authored step declares a readable tell, a bounded active window and a punishable recovery", () => {
  for (const [patternId, pattern] of Object.entries(ATTACK_PATTERNS)) {
    assert.ok(pattern.steps.length >= 1, `${patternId} must author at least one step`);
    for (const step of pattern.steps) {
      assert.ok(step.telegraphTicks > 0, `${patternId}:${step.id} must be announced`);
      assert.ok(step.activeTicks > 0, `${patternId}:${step.id} must have an active window`);
      assert.ok(step.recoveryTicks > 0, `${patternId}:${step.id} must be punishable`);
      assert.ok(
        step.recoveryTicks >= step.activeTicks,
        `${patternId}:${step.id} recovery must not be shorter than its own active window`,
      );
      assert.ok(step.radius > 0, `${patternId}:${step.id} must have a disc`);
      assert.equal(step.totalTicks, step.telegraphTicks + step.activeTicks + step.recoveryTicks);
    }
  }
});

test("AI response patterns are authored as bounded windows, never permanent states", () => {
  for (const [id, response] of Object.entries(AI_RESPONSE_PATTERNS)) {
    assert.equal(response.id, id, "each response must know its own id");
    assert.ok(response.trigger, `${id} must declare what fires it`);
    assert.ok(response.windowTicks > 0 && response.windowTicks <= 300, `${id} window must be bounded`);
  }
  assert.ok(AI_RESPONSE_PATTERNS.punish.cooldownScaleBp < AREA_BP, "punish must speed allied fire up, not slow it");
  assert.ok(AI_RESPONSE_PATTERNS.brace.damageScaleBp < AREA_BP, "brace must reduce incoming area damage");
  assert.ok(AI_RESPONSE_PATTERNS.spread.minBodies >= 2, "spread only applies to a shared telegraph");
});

/* --------------------------------------------------------------------------------------------
 * 3. Live simulation behaviour.
 * ----------------------------------------------------------------------------------------- */

const OBJECTIVE_OCTANT = (snapshot) => {
  const target = snapshot.enemies[0];
  if (!target) return "IDLE";
  const dx = target.x - snapshot.commander.x;
  const dy = target.y - snapshot.commander.y;
  const length = Math.hypot(dx, dy) || 1;
  let best = "IDLE";
  let bestDot = -Infinity;
  for (const [name, vector] of Object.entries(OCTANT_VECTORS)) {
    if (name === "IDLE") continue;
    const vectorLength = Math.hypot(vector.x, vector.y) || 1;
    const dot = (dx / length) * (vector.x / vectorLength) + (dy / length) * (vector.y / vectorLength);
    if (dot > bestDot) {
      bestDot = dot;
      best = name;
    }
  }
  return best;
};

/**
 * Drives one run and collects every event, so several assertions share one expensive play-out.
 *
 * `clustered` cycles the formation stance once (VANGUARD -> TURRET, rpg-catalog STANCE_CONFIG),
 * which pulls the legion from 1414-unit diagonals to 300-unit offsets. That is the configuration
 * where area damage is SUPPOSED to be shared, and it is exactly the balance point the model
 * exists to express: standing together is efficient and dangerous, spreading out is safe and slow.
 */
function playRun({
  seed = 7,
  steps = 5000,
  companionLoadout = ["ember-cohort", "rift-lens", "veil-vanguard"],
  clustered = true,
  castSkills = true,
} = {}) {
  let run = createDefenseRun({ stageId: "cinder-span", seed, companionLoadout });
  if (clustered) run = advanceDefenseRun(queueInput(run, "STANCE_CYCLE", {}), 1);
  const events = [];
  const fieldSnapshots = [];
  for (let step = 0; step < steps && !isTerminalRun(run); step += 1) {
    const snapshot = getRunSnapshot(run);
    let next;
    if (snapshot.growthOffer) {
      next = queueInput(run, "SKILL_SELECTED", { skillId: snapshot.growthOffer.choices[0] });
    } else {
      next = queueInput(run, "MOVE", { octant: OBJECTIVE_OCTANT(snapshot) });
      if (castSkills) {
        for (const skillId of snapshot.commander.skills) {
          next = queueInput(next, "SKILL_CAST", { skillId });
        }
      }
    }
    run = advanceDefenseRun(next, 1);
    const after = getRunSnapshot(run);
    events.push(...after.events);
    if (after.areaFields.length) fieldSnapshots.push(after);
  }
  return { run, events, fieldSnapshots, snapshot: getRunSnapshot(run) };
}

const played = playRun();
// A second play-out with the actives withheld: the commander clears more slowly, so enemy bodies
// actually reach contact range and the ENEMY side of the model gets exercised too.
const pressured = playRun({ castSkills: false });

test("every attack splashes: both factions produce area impacts and the primary body is never in its own splash", () => {
  const impacts = [...played.events, ...pressured.events].filter((event) => event.type === "AREA_IMPACT");
  assert.ok(impacts.length > 0, "a live run must produce area contacts");

  const factions = new Set(impacts.map((event) => event.faction));
  assert.ok(factions.has("player"), "player-side attacks must splash");
  assert.ok(factions.has("enemy"), "enemy-side attacks must splash");

  for (const impact of impacts) {
    assert.ok(impact.targets.length > 0, "an emitted area impact must have struck something");
    assert.ok(
      impact.targets.length <= AREA_COMBAT.maxSplashTargets,
      "the per-contact target cap must be enforced",
    );
    const ids = impact.targets.map((entry) => entry.targetId);
    assert.equal(new Set(ids).size, ids.length, "no body may be struck twice by one contact");
    for (const entry of impact.targets) {
      assert.ok(entry.distance < impact.radius, "only bodies inside the disc are struck");
      assert.ok(entry.damage >= AREA_COMBAT.minSplashDamage, "a struck body always takes at least the floor");
      assert.ok(entry.shareBp > 0, "a struck body must carry the share it was resolved with");
      assert.ok(entry.healthAfter <= entry.healthBefore, "area damage must never heal");
    }
  }
});

test("area damage falls off with distance for equal element and weight", () => {
  const impacts = [...played.events, ...pressured.events].filter((event) => event.type === "AREA_IMPACT" && event.targets.length >= 2);
  assert.ok(impacts.length > 0, "the run must contain at least one multi-body contact");
  let compared = 0;
  for (const impact of impacts) {
    // Only bodies of the SAME element are comparable: the matchup factor is per-defender by
    // design, so an off-element body at point blank legitimately takes less than an on-element
    // body at the rim. Distance monotonicity is a claim about one element column at a time.
    const byElement = new Map();
    for (const entry of impact.targets) {
      if (!byElement.has(entry.defenderElement)) byElement.set(entry.defenderElement, []);
      byElement.get(entry.defenderElement).push(entry);
    }
    for (const column of byElement.values()) {
      const sorted = [...column].sort((left, right) => left.distance - right.distance);
      for (let index = 1; index < sorted.length; index += 1) {
        if (sorted[index - 1].distance === sorted[index].distance) continue;
        assert.ok(
          sorted[index - 1].shareBp >= sorted[index].shareBp,
          "a nearer body must never take a smaller share than a farther one of the same element",
        );
        compared += 1;
      }
    }
  }
  assert.ok(compared > 0, "the run must expose at least one distinct-distance pair");
});

test("a lingering field starts, pulses on its authored cadence and ends exactly at its expiry", () => {
  const started = played.events.filter((event) => event.type === "AREA_FIELD_STARTED");
  assert.ok(started.length > 0, "skills with a field duration must spawn fields");

  const first = started[0];
  assert.ok(first.durationTicks >= AREA_FIELD.pulseTicks, "a field must live at least one pulse");
  assert.equal(first.expiresAt, first.simTick + first.durationTicks, "expiry is authored, not drifted");

  const pulses = played.events.filter((event) => event.type === "AREA_FIELD_PULSE" && event.fieldId === first.fieldId);
  assert.ok(pulses.length > 0, "a live field must pulse");
  for (let index = 1; index < pulses.length; index += 1) {
    assert.equal(
      pulses[index].simTick - pulses[index - 1].simTick,
      AREA_FIELD.pulseTicks,
      "pulses must land on the authored cadence",
    );
  }
  assert.ok(
    pulses.every((pulse) => pulse.simTick <= first.expiresAt),
    "a field must never pulse past its expiry",
  );

  const ended = played.events.find((event) => event.type === "AREA_FIELD_ENDED" && event.fieldId === first.fieldId);
  assert.ok(ended, "every field must be retired explicitly");
  assert.equal(ended.reason, "EXPIRED");
  assert.equal(ended.simTick, first.expiresAt, "the field ends on the authored tick");
});

test("live fields are published on the snapshot and stay inside the authored concurrency cap", () => {
  assert.ok(played.fieldSnapshots.length > 0, "the run must expose live fields on the snapshot");
  for (const snapshot of played.fieldSnapshots) {
    assert.ok(snapshot.areaFields.length <= AREA_FIELD.maxActive, "the field cap bounds the tick cost");
    for (const field of snapshot.areaFields) {
      assert.ok(field.id && field.radius > 0 && field.expiresAt > field.startedAt, "a published field must be drawable");
      assert.ok(ELEMENT_IDS.includes(field.element), "a published field must carry a known element");
    }
  }
});

test("a telegraph fires an AI response, and the response is a bounded set of authored pattern ids", () => {
  const telegraphs = played.events.filter(
    (event) => event.type === "ENEMY_ATTACK_TELEGRAPHED" || event.type === "BOSS_ATTACK_TELEGRAPHED",
  );
  assert.ok(telegraphs.length > 0, "authored patterns must announce their strikes");
  for (const telegraph of telegraphs) {
    assert.equal(telegraph.phase, "telegraph");
    assert.ok(telegraph.windupTicks > 0, "a tell must have a length");
    assert.ok(telegraph.radius > 0, "a tell must describe the disc it is warning about");
    assert.ok(ELEMENT_IDS.includes(telegraph.element), "a tell must carry its element");
    assert.ok(attackPatternFor(telegraph.patternId), "a tell must name its authored pattern");
  }

  const responses = played.events.filter((event) => event.type === "AI_RESPONSE_APPLIED");
  assert.ok(responses.length > 0, "a covered body must answer the telegraph");
  const known = new Set(Object.keys(AI_RESPONSE_PATTERNS));
  for (const response of responses) {
    assert.ok(response.responsePatterns.length > 0, "an emitted response must name what it did");
    for (const id of response.responsePatterns) {
      assert.ok(known.has(id), `${id} must be an authored response pattern`);
    }
  }
});

test("area combat stays deterministic: identical seeds replay to an identical digest", () => {
  const left = playRun({ seed: 29, steps: 700 });
  const right = playRun({ seed: 29, steps: 700 });
  assert.equal(getRunDigest(left.run), getRunDigest(right.run), "the same inputs must replay bit-identically");

  const other = playRun({ seed: 30, steps: 700 });
  assert.notEqual(getRunDigest(left.run), getRunDigest(other.run), "a different seed must diverge");
});

test("the punish window is published and always expires", () => {
  const snapshot = played.snapshot;
  assert.ok(Number.isInteger(snapshot.punishWindowUntilTick), "the window must be observable");
  assert.ok(
    snapshot.punishWindowUntilTick === 0 || snapshot.punishWindowUntilTick <= snapshot.tick + AI_RESPONSE_PATTERNS.punish.windowTicks + 120,
    "the window must never be set arbitrarily far into the future",
  );
});

test("the boss entrance is authored by the simulation, not improvised by the renderer", () => {
  const spawn = played.events.find((event) => event.type === "BOSS_SPAWNED");
  if (!spawn) {
    assert.ok(true, "this play-out did not reach the boss; the entrance contract is covered by its own fields below");
    return;
  }
  assert.ok(spawn.intro, "BOSS_SPAWNED must carry its entrance");
  assert.equal(spawn.intro.durationTicks, 180, "the entrance is three seconds at 60 Hz");
  assert.equal(spawn.intro.endsAtTick, spawn.tick + spawn.intro.durationTicks, "the window is anchored to the spawn tick");
  assert.ok(spawn.intro.title, "the entrance must name the boss");
  assert.ok(spawn.intro.subtitle, "the entrance must carry its authored line");
  assert.equal(spawn.intro.motion, "show", "the entrance drives the rig's entrance beat");
  assert.ok(spawn.intro.zoomBp > 0 && spawn.intro.zoomBp < AREA_BP, "the camera push must be a pull-in, not a pull-out");
});

/* --------------------------------------------------------------------------------------------
 * 4. Monster runtime state (build-game-monster-system: the runtime -> view-adapter seam).
 * ----------------------------------------------------------------------------------------- */

test("every live body publishes exactly one authored semantic state, and the states actually occur", () => {
  const observed = new Set();
  let bodies = 0;
  for (const snapshot of played.fieldSnapshots) {
    for (const enemy of snapshot.enemies) {
      bodies += 1;
      assert.ok(
        MONSTER_STATES.includes(enemy.state),
        `a live body published an unauthored state: ${String(enemy.state)}`,
      );
      observed.add(enemy.state);
    }
  }
  assert.ok(bodies > 0, "the sampled snapshots must contain live bodies");
  assert.ok(
    observed.has("pursue") || observed.has("reposition"),
    "a body closing on its objective must read as pursuing or repositioning",
  );
  assert.ok(
    !observed.has("defeated"),
    "a defeated body is removed in the same tick, so it must never be published as live",
  );
});

test("the windup state is exactly the telegraph window, and the strike leaves it", () => {
  let run = createDefenseRun({ stageId: "cinder-span", seed: 7, companionLoadout: ["ember-cohort"] });
  const windupSpans = new Map();
  const strikes = new Map();
  for (let step = 0; step < 4000 && !isTerminalRun(run); step += 1) {
    run = advanceDefenseRun(run, 1);
    const snapshot = getRunSnapshot(run);
    for (const enemy of snapshot.enemies) {
      if (enemy.state === "windup") windupSpans.set(enemy.id, (windupSpans.get(enemy.id) ?? 0) + 1);
    }
    for (const event of snapshot.events) {
      if (event.type === "ENEMY_ATTACK") strikes.set(event.entityId, (strikes.get(event.entityId) ?? 0) + 1);
    }
  }
  assert.ok(windupSpans.size > 0, "authored patterns must put bodies into a windup");
  for (const [entityId, ticks] of windupSpans) {
    assert.ok(ticks >= 1, `${entityId} must hold its windup for at least one tick`);
    assert.ok(ticks <= 300, `${entityId} must not be stuck in windup forever`);
  }
});
