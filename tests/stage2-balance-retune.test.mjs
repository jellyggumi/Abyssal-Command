import assert from "node:assert/strict";
import test from "node:test";

import { CINDER_SPAN_WAVE_PLAN, STAGE_BY_ID } from "../defense-catalog.js";
import { BOSS_RALLY_COOLDOWN_REDUCTION, STANCE_CONFIG } from "../rpg-catalog.js";

test("Stage 2 final retune data contract remains pinned in public catalogs", () => {
  const cinderSpan = STAGE_BY_ID["cinder-span"];

  assert.ok(cinderSpan, "Cinder Span must remain a public stage catalog entry");
  assert.equal(cinderSpan.gateTicks, 900, "Cinder Span gate duration must remain 900 ticks");
  assert.equal(
    cinderSpan.wavePlan,
    CINDER_SPAN_WAVE_PLAN,
    "Cinder Span must publish the canonical authored wave plan",
  );
  assert.deepEqual(
    CINDER_SPAN_WAVE_PLAN.map(({ tick, primary, alternatives }) => ({
      tick,
      primary,
      alternatives: alternatives.map(({ id, composition }) => ({ id, composition })),
    })),
    [
      {
        tick: 0,
        primary: { enemy: "rusher", count: 14 },
        alternatives: [
          { id: "opening-rusher-pure", composition: [{ enemy: "rusher", count: 14 }] },
          { id: "opening-rusher-flanker", composition: [{ enemy: "rusher", count: 8 }, { enemy: "flanker", count: 6 }] },
        ],
      },
      {
        tick: 120,
        primary: { enemy: "flanker", count: 10 },
        alternatives: [
          { id: "pressure-flanker-pure", composition: [{ enemy: "flanker", count: 10 }] },
          { id: "pressure-flanker-rusher", composition: [{ enemy: "flanker", count: 7 }, { enemy: "rusher", count: 3 }] },
        ],
      },
      {
        tick: 240,
        primary: { enemy: "ranged", count: 8 },
        alternatives: [
          { id: "denial-ranged-pure", composition: [{ enemy: "ranged", count: 8 }] },
          { id: "denial-ranged-flanker", composition: [{ enemy: "ranged", count: 5 }, { enemy: "flanker", count: 3 }] },
        ],
      },
    ],
    "Cinder Span wave ticks, primaries, and alternatives must retain the final signed values",
  );
  assert.deepEqual(
    STANCE_CONFIG.TURRET.offsets[0],
    { x: -300, y: 0 },
    "TURRET's first offset must remain W scaled by 0.3",
  );
  assert.deepEqual(
    STANCE_CONFIG.VANGUARD.offsets.slice(0, 2),
    [
      { x: -1414, y: -1414 },
      { x: -1414, y: 1414 },
    ],
    "VANGUARD's first two offsets must remain their NW and SW vectors scaled by 2.0",
  );
  assert.equal(
    BOSS_RALLY_COOLDOWN_REDUCTION,
    0,
    "boss rally must not reduce companion cooldowns",
  );
  assert.equal(
    STANCE_CONFIG.TURRET.derivedFrontCount,
    1,
    "TURRET must derive one front companion",
  );
  assert.deepEqual(
    {
      stageId: cinderSpan.id,
      eliteId: cinderSpan.eliteId,
      eliteKind: cinderSpan.eliteKind,
      eliteCompanion: cinderSpan.eliteCompanion,
      occupation: cinderSpan.tactics.occupation,
      extraction: cinderSpan.tactics.extraction,
    },
    {
      stageId: "cinder-span",
      eliteId: "s1-ember-hunter",
      eliteKind: "rusher",
      eliteCompanion: "ember-cohort",
      occupation: {
        id: "cinder-seal",
        x: 17600,
        y: 6000,
        radius: 900,
        holdTicks: 180,
        effects: {
          moveMultiplier: 1.05,
          rangeMultiplier: 1.08,
          recoveryPerSecond: 4,
        },
      },
      extraction: {
        id: "cinder-bind",
        x: 15400,
        y: 6000,
        radius: 1000,
        windowTicks: 600,
      },
    },
    "Cinder extraction values and stable catalog IDs must remain frozen",
  );
});
