import assert from "node:assert/strict";
import test from "node:test";

import { STAGES, STAGE_ENCOUNTER_ROUTES } from "../defense-catalog.js";
import { stageStoryFor } from "../stage-story-catalog.js";
import {
  STAGE_WORLD_PROFILES,
  stageWorldFor,
} from "../stage-world-catalog.js";

const STAGE_IDS = ["cinder-span", "abyss-chancel", "echo-throne"];

const EXPECTED_WORLD_TOPOLOGY = {
  "cinder-span": {
    props: [
      "cinder-span:seal-brand",
      "cinder-span:forge-relic",
      "cinder-span:forge-arch",
      "cinder-span:collapsed-parapet-prop",
      "cinder-span:west-ash-wall-prop",
      "cinder-span:east-ash-wall-prop",
      "cinder-span:relay-debris-north-prop",
      "cinder-span:relay-debris-south-prop",
      "cinder-span:ingress-beacon-prop",
      "cinder-span:south-forge-teeth-prop",
      "cinder-span:north-ash-talon-prop",
      "cinder-span:gate-beacon-prop",
    ],
    obstacles: [
      "cinder-span:drowned-forge-arch",
      "cinder-span:collapsed-parapet",
      "cinder-span:west-ash-wall",
    ],
    meshColliders: [["cinder-span:walkable-support", [
      [[600, 800, 0], [23400, 800, 0], [23400, 11200, 0]],
      [[600, 800, 0], [23400, 11200, 0], [600, 11200, 0]],
    ]]],
    routes: [
      ["cinder-span:critical-route", "critical", 1200, [
        ["cinder-span:ingress", "ingress", 1800, 6000, 0],
        ["cinder-span:cinder-relay-crossing", "intermediate-objective", 7600, 6000, 0],
        ["cinder-span:cinder-forge-stand", "intermediate-gate", 14400, 6000, 0],
        ["cinder-span:final-gate", "final-gate", 22000, 6000, 0],
      ]],
      ["cinder-span:optional-detour", "optional-detour", 700, [
        ["cinder-span:detour-entry", "detour-entry", 5600, 7400, 0],
        ["cinder-span:ash-cache", "detour-objective", 9200, 10700, 0],
        ["cinder-span:detour-exit", "detour-exit", 16800, 10700, 0],
      ]],
    ],
  },
  "abyss-chancel": {
    props: [
      "abyss-chancel:oath-relic",
      "abyss-chancel:nave-blade",
      "abyss-chancel:oath-apse-prop",
      "abyss-chancel:nave-seal-prop",
      "abyss-chancel:west-colonnade-prop",
      "abyss-chancel:east-colonnade-prop",
      "abyss-chancel:vestry-debris-prop",
      "abyss-chancel:apse-wing-prop",
      "abyss-chancel:west-processional-lamp-prop",
      "abyss-chancel:south-nave-screen-prop",
      "abyss-chancel:east-processional-lamp-prop",
      "abyss-chancel:vestry-screen-prop",
    ],
    obstacles: [
      "abyss-chancel:oath-apse",
      "abyss-chancel:nave-seal",
      "abyss-chancel:west-colonnade",
      "abyss-chancel:east-colonnade",
      "abyss-chancel:vestry-debris",
      "abyss-chancel:apse-wing",
    ],
    meshColliders: [["abyss-chancel:walkable-nave", [
      [[600, 700, 0], [23400, 700, 0], [23400, 11300, 0]],
      [[600, 700, 0], [23400, 11300, 0], [600, 11300, 0]],
    ]]],
    routes: [
      ["abyss-chancel:critical-route", "critical", 1000, [
        ["abyss-chancel:ingress", "ingress", 1800, 6000, 0],
        ["abyss-chancel:chancel-nave-advance", "intermediate-objective", 7200, 4400, 0],
        ["abyss-chancel:chancel-transept-lock", "intermediate-gate", 14200, 6000, 0],
        ["abyss-chancel:final-gate", "final-gate", 22000, 6000, 0],
      ]],
      ["abyss-chancel:optional-detour", "optional-detour", 700, [
        ["abyss-chancel:detour-entry", "detour-entry", 5200, 7600, 0],
        ["abyss-chancel:vestry-cache", "detour-objective", 9000, 10400, 0],
        ["abyss-chancel:detour-exit", "detour-exit", 17800, 10400, 0],
      ]],
    ],
  },
  "echo-throne": {
    props: [
      "echo-throne:dais-relic",
      "echo-throne:aisle-blade",
      "echo-throne:fractured-dais-prop",
      "echo-throne:echo-aisle-prop",
      "echo-throne:west-fractured-wing-prop",
      "echo-throne:east-fractured-wing-prop",
      "echo-throne:gallery-debris-prop",
      "echo-throne:crown-shard-prop",
      "echo-throne:west-crown-light-prop",
      "echo-throne:court-crescent-prop",
      "echo-throne:east-crown-light-prop",
      "echo-throne:south-gallery-shard-prop",
    ],
    obstacles: [
      "echo-throne:fractured-dais",
      "echo-throne:echo-aisle",
      "echo-throne:west-fractured-wing",
      "echo-throne:east-fractured-wing",
      "echo-throne:gallery-debris",
      "echo-throne:crown-shard",
    ],
    meshColliders: [["echo-throne:walkable-court", [
      [[600, 600, 0], [23400, 600, 0], [23400, 11400, 0]],
      [[600, 600, 0], [23400, 11400, 0], [600, 11400, 0]],
    ]]],
    routes: [
      ["echo-throne:critical-route", "critical", 1100, [
        ["echo-throne:ingress", "ingress", 1800, 6000, 0],
        ["echo-throne:throne-aisle-break", "intermediate-objective", 7600, 6000, 0],
        ["echo-throne:throne-dais-stand", "intermediate-gate", 13800, 6000, 0],
        ["echo-throne:final-gate", "final-gate", 22000, 6000, 0],
      ]],
      ["echo-throne:optional-detour", "optional-detour", 700, [
        ["echo-throne:detour-entry", "detour-entry", 5600, 4400, 0],
        ["echo-throne:gallery-cache", "detour-objective", 9000, 1600, 0],
        ["echo-throne:detour-exit", "detour-exit", 17200, 1600, 0],
      ]],
    ],
  },
};

function pointInBounds({ x, y }, { minX, maxX, minY, maxY }) {
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}


function semanticWorldTopology(profile) {
  return {
    props: profile.presentation.props.map(({ id }) => id),
    obstacles: profile.gameplay.obstacles.map(({ id }) => id),
    meshColliders: profile.gameplay.meshColliders.map(({ id, triangles }) => [
      id,
      triangles.map((vertices) => vertices.map(({ x, y, elevation }) => [x, y, elevation])),
    ]),
    routes: profile.gameplay.routes.map(({ id, kind, corridorWidth, waypoints }) => [
      id,
      kind,
      corridorWidth,
      waypoints.map(({ id: waypointId, role, placement }) => [
        waypointId,
        role,
        placement.x,
        placement.y,
        placement.elevation,
      ]),
    ]),
  };
}

function worldObjectIds(profile) {
  const routes = profile.gameplay.routes.flatMap((entry) => [entry, ...entry.waypoints]);
  return [
    ...profile.gameplay.obstacles,
    ...profile.gameplay.meshColliders,
    ...routes,
    ...profile.presentation.props,
    ...(profile.presentation.visibilityAnchors ?? []),
    ...(profile.presentation.vfxCues ?? []),
    ...profile.presentation.npcs,
    ...profile.presentation.questPoints,
    ...profile.presentation.landmarks,
  ].map(({ id }) => id);
}

test("all three stage worlds bind one live quest giver to four ordered quest surfaces", () => {
  assert.deepEqual(STAGES.map(({ id }) => id), STAGE_IDS);
  assert.deepEqual(Object.keys(STAGE_WORLD_PROFILES), STAGE_IDS);

  const worldIds = [];
  for (const stageId of STAGE_IDS) {
    const profile = stageWorldFor(stageId);
    const story = stageStoryFor(stageId);
    const questGivers = profile.presentation.npcs.filter(({ questRole }) => questRole === "quest-giver");

    assert.equal(questGivers.length, 1, `${stageId} must expose one quest giver`);
    assert.equal(questGivers[0].id, story.quest.giverNpcId, `${stageId} must use the live story NPC id`);
    assert.equal(questGivers[0].questId, story.quest.id, `${stageId} giver must offer the authored story quest`);

    const questPoints = profile.presentation.questPoints;
    assert.equal(questPoints.length, 4, `${stageId} must expose four quest points`);
    assert.deepEqual(questPoints.map(({ order }) => order), [1, 2, 3, 4], `${stageId} quest points must be strictly ordered`);
    assert.deepEqual(
      questPoints.map(({ eventBinding }) => eventBinding),
      story.quest.objectives.map(({ event }) => event),
      `${stageId} quest points must bind one-to-one to the four ordered story objective events`,
    );
    const intermediatePlacements = STAGE_ENCOUNTER_ROUTES[stageId].objectives.map(({ point }) => ({
      x: point.x,
      y: point.y,
      elevation: 0,
    }));
    assert.equal(intermediatePlacements.length, 2, `${stageId} critical route must expose two intermediate objective placements`);
    assert.deepEqual(
      questPoints.slice(0, 2).map(({ placement }) => placement),
      intermediatePlacements,
      `${stageId} first two quest points must use the two ordered critical-route intermediate placements`,
    );

    for (const point of questPoints) {
      assert.equal(point.questId, story.quest.id, `${point.id} must advance the giver's quest`);
      assert.equal(point.placement.elevation, 0, `${point.id} must remain on the flat gameplay plane`);
      assert.equal(pointInBounds(point.placement, profile.gameplay.bounds), true, `${point.id} must remain in stage bounds`);
    }
    worldIds.push(...worldObjectIds(profile));
  }

  assert.equal(new Set(worldIds).size, worldIds.length, "world object ids must stay unique after adding quest metadata");
});

test("quest metadata is a presentation overlay that leaves world traversal topology unchanged", () => {
  for (const stageId of STAGE_IDS) {
    const profile = stageWorldFor(stageId);
    assert.deepEqual(profile.gameplay.surfaces, [], `${stageId} quest points must not add gameplay surfaces`);
    assert.deepEqual(
      semanticWorldTopology(profile),
      EXPECTED_WORLD_TOPOLOGY[stageId],
      `${stageId} quest metadata must not alter props, obstacles, routes, or flat mesh collision`,
    );
  }
});

test("stageWorldFor returns deeply frozen quest data", () => {
  for (const stageId of STAGE_IDS) {
    const profile = stageWorldFor(stageId);
    const questGiver = profile.presentation.npcs.find(({ questRole }) => questRole === "quest-giver");

    assert.equal(profile, STAGE_WORLD_PROFILES[stageId]);
    assert.equal(Object.isFrozen(profile), true, `${stageId} profile must be frozen`);
    assert.equal(Object.isFrozen(profile.presentation.questPoints), true, `${stageId} quest point list must be frozen`);
    assert.equal(Object.isFrozen(questGiver), true, `${stageId} quest giver must be frozen`);
    for (const point of profile.presentation.questPoints) {
      assert.equal(Object.isFrozen(point), true, `${point.id} must be frozen`);
      assert.equal(Object.isFrozen(point.placement), true, `${point.id} placement must be frozen`);
      assert.equal(Object.isFrozen(point.eventBinding), true, `${point.id} event binding must be frozen`);
    }
    assert.throws(
      () => profile.presentation.questPoints.push({ id: `${stageId}:mutable-point` }),
      TypeError,
      `${stageId} quest point list must reject mutation`,
    );
  }
});
