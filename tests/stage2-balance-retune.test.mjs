import assert from "node:assert/strict";
import test from "node:test";

import { STAGE_BY_ID, STAGE_WAVE_DOCTRINE } from "../defense-catalog.js";
import { BOSS_RALLY_COOLDOWN_REDUCTION, STANCE_CONFIG } from "../rpg-catalog.js";

test("Stage 2 final retune data contract remains pinned in public catalogs", () => {
  const cinderSpan = STAGE_BY_ID["cinder-span"];

  assert.ok(cinderSpan, "Cinder Span must remain a public stage catalog entry");
  // SUPERSEDED (run-id 20260728-stage-playtime-doctrine): the 900-tick gate hold and the three-wave
  // CINDER_SPAN_WAVE_PLAN produced a ~40 s stage. The hold and the wave list now come from
  // STAGE_WAVE_DOCTRINE; see
  // _workspace/20260726-stage1b-cinder-pressure-agency/design/stage-playtime-doctrine.md.
  // What stays pinned from the stage-2 retune: the stance geometry, the boss-rally value, and every
  // stable catalog id and objective coordinate below.
  assert.equal(cinderSpan.gateTicks, STAGE_WAVE_DOCTRINE["cinder-span"].defenseTicks,
    "Cinder Span gate duration must come from its wave doctrine");
  assert.equal(cinderSpan.legacyGateTicks, 900,
    "the pre-doctrine 900-tick hold must stay recorded as the superseded value");
  assert.equal(cinderSpan.wavePlan.length, STAGE_WAVE_DOCTRINE["cinder-span"].waveCount,
    "Cinder Span must publish one wave per doctrine wave");

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
