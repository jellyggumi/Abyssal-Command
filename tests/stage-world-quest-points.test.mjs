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
      "cinder-span:ash-gatehouse-north-prop",
      "cinder-span:ash-gatehouse-south-prop",
      "cinder-span:gate-beacon-prop",
    ],
    obstacles: [
      "cinder-span:relay-debris-north",
      "cinder-span:ash-gatehouse-south",
      "cinder-span:ash-gatehouse-north",
      "cinder-span:drowned-forge-arch",
      "cinder-span:collapsed-parapet",
      "cinder-span:relay-debris-south",
      "cinder-span:west-ash-wall",
      "cinder-span:east-ash-wall",
    ],
    meshColliders: [["cinder-span:walkable-support", [
      [[600, 800, 0], [8600, 800, 0], [8600, 11200, 0]],
      [[600, 800, 0], [8600, 11200, 0], [600, 11200, 0]],
      [[8600, 800, 0], [17000, 800, 0], [17000, 11200, 0]],
      [[8600, 800, 0], [17000, 11200, 0], [8600, 11200, 0]],
      [[17000, 800, 0], [23400, 800, 0], [23400, 11200, 0]],
      [[17000, 800, 0], [23400, 11200, 0], [17000, 11200, 0]],
    ]]],
    routes: [
      ["cinder-span:critical-route", "critical", 1400, [
        ["cinder-span:ingress", "ingress", 1800, 6000, 0],
        ["cinder-span:cinder-relay-crossing", "intermediate-objective", 14600, 5200, 0],
        ["cinder-span:cinder-forge-stand", "intermediate-gate", 17400, 6400, 0],
        ["cinder-span:final-gate", "final-gate", 22000, 6000, 0],
      ]],
      ["cinder-span:optional-detour", "optional-detour", 900, [
        ["cinder-span:detour-entry", "detour-entry", 6000, 10600, 0],
        ["cinder-span:ash-cache", "detour-objective", 13200, 10700, 0],
        ["cinder-span:detour-exit", "detour-exit", 19600, 10700, 0],
      ]],
    ],
  },
  "abyss-chancel": {
    props: [
      "abyss-chancel:west-processional-lamp-prop",
      "abyss-chancel:vestry-screen-prop",
      "abyss-chancel:narthex-colonnade-prop",
      "abyss-chancel:narthex-debris-prop",
      "abyss-chancel:nave-seal-prop",
      "abyss-chancel:transept-debris-prop",
      "abyss-chancel:crossing-lamp-prop",
      "abyss-chancel:nave-blade",
      "abyss-chancel:oath-ring-plinth-prop",
      "abyss-chancel:oath-relic",
      "abyss-chancel:apse-wing-prop",
      "abyss-chancel:east-colonnade-prop",
      "abyss-chancel:east-processional-lamp-prop",
    ],
    obstacles: [
      "abyss-chancel:narthex-colonnade",
      "abyss-chancel:narthex-debris",
      "abyss-chancel:nave-seal",
      "abyss-chancel:transept-debris",
      "abyss-chancel:oath-ring-plinth",
      "abyss-chancel:east-colonnade",
      "abyss-chancel:apse-wing",
    ],
    meshColliders: [["abyss-chancel:walkable-nave", [
      [[600, 700, 0], [8000, 700, 0], [8000, 11300, 0]],
      [[600, 700, 0], [8000, 11300, 0], [600, 11300, 0]],
      [[8000, 700, 0], [16400, 700, 0], [16400, 11300, 0]],
      [[8000, 700, 0], [16400, 11300, 0], [8000, 11300, 0]],
      [[16400, 700, 0], [23400, 700, 0], [23400, 7200, 0]],
      [[16400, 700, 0], [23400, 7200, 0], [16400, 7200, 0]],
      [[16400, 7200, 0], [23400, 7200, 0], [23400, 11300, 0]],
      [[16400, 7200, 0], [23400, 11300, 0], [16400, 11300, 0]],
    ]]],
    routes: [
      ["abyss-chancel:critical-route", "critical", 1400, [
        ["abyss-chancel:ingress", "ingress", 1800, 6000, 0],
        ["abyss-chancel:chancel-nave-advance", "intermediate-objective", 15000, 6000, 0],
        ["abyss-chancel:chancel-transept-lock", "intermediate-gate", 17600, 8200, 0],
        ["abyss-chancel:final-gate", "final-gate", 22000, 6000, 0],
      ]],
      ["abyss-chancel:optional-detour", "optional-detour", 900, [
        ["abyss-chancel:detour-entry", "detour-entry", 6200, 2600, 0],
        ["abyss-chancel:mirror-aisle-cache", "detour-objective", 12000, 1800, 0],
        ["abyss-chancel:detour-exit", "detour-exit", 19800, 2600, 0],
      ]],
    ],
  },
  "echo-throne": {
    props: [
      "echo-throne:narthex-shard-prop",
      "echo-throne:west-crown-light-prop",
      "echo-throne:west-fractured-wing-prop",
      "echo-throne:gallery-debris-prop",
      "echo-throne:south-fractured-wing-prop",
      "echo-throne:echo-aisle-prop",
      "echo-throne:compass-inlay-lamp-prop",
      "echo-throne:aisle-blade",
      "echo-throne:crown-shard-prop",
      "echo-throne:dais-relic",
      "echo-throne:fractured-dais-prop",
      "echo-throne:east-fractured-wing-prop",
      "echo-throne:east-crown-light-prop",
    ],
    obstacles: [
      "echo-throne:west-fractured-wing",
      "echo-throne:gallery-debris",
      "echo-throne:south-fractured-wing",
      "echo-throne:echo-aisle",
      "echo-throne:crown-shard",
      "echo-throne:fractured-dais",
      "echo-throne:east-fractured-wing",
    ],
    meshColliders: [["echo-throne:walkable-court", [
      [[600, 600, 0], [6800, 600, 0], [6800, 11400, 0]],
      [[600, 600, 0], [6800, 11400, 0], [600, 11400, 0]],
      [[6800, 600, 0], [16600, 600, 0], [16600, 4000, 0]],
      [[6800, 600, 0], [16600, 4000, 0], [6800, 4000, 0]],
      [[6800, 4000, 0], [16600, 4000, 0], [16600, 8000, 0]],
      [[6800, 4000, 0], [16600, 8000, 0], [6800, 8000, 0]],
      [[6800, 8000, 0], [16600, 8000, 0], [16600, 11400, 0]],
      [[6800, 8000, 0], [16600, 11400, 0], [6800, 11400, 0]],
      [[16600, 600, 0], [23400, 600, 0], [23400, 11400, 0]],
      [[16600, 600, 0], [23400, 11400, 0], [16600, 11400, 0]],
    ]]],
    routes: [
      ["echo-throne:critical-route", "critical", 1400, [
        ["echo-throne:ingress", "ingress", 1800, 6000, 0],
        ["echo-throne:throne-aisle-break", "intermediate-objective", 15200, 6000, 0],
        ["echo-throne:throne-dais-stand", "intermediate-gate", 18000, 6000, 0],
        ["echo-throne:final-gate", "final-gate", 22000, 6000, 0],
      ]],
      ["echo-throne:optional-detour", "optional-detour", 900, [
        ["echo-throne:detour-entry", "detour-entry", 7800, 2200, 0],
        ["echo-throne:mirror-gallery-cache", "detour-objective", 12400, 9800, 0],
        ["echo-throne:detour-exit", "detour-exit", 19200, 9200, 0],
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
