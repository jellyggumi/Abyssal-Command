import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { COMMANDER, STAGES, STAGE_ENCOUNTER_ROUTES, STAGE_TACTICS } from "../defense-catalog.js";
import { STAGE_WORLD_PROFILES } from "../stage-world-catalog.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_PATH = path.join(ROOT, "stage-world-catalog.js");
const TELEGRAPH_TIERS = { deformation: [180], gate: [120, 90], mirror: [90], hazard: [60] };

async function importMutatedCatalog(mutate, label) {
  const source = await readFile(CATALOG_PATH, "utf8");
  const mutated = mutate(source);
  assert.notEqual(mutated, source, `${label}: mutation did not apply, so this proves nothing`);
  const directory = await mkdtemp(path.join(tmpdir(), "stage-gimmick-"));
  const file = path.join(directory, "mutated-catalog.mjs");
  await writeFile(file, mutated.replace('from "./defense-catalog.js"', `from ${JSON.stringify(pathToFileURL(path.join(ROOT, "defense-catalog.js")).href)}`));
  try {
    await import(pathToFileURL(file).href);
    return null;
  } catch (error) {
    return error;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("every stage binds one gimmick to each of its four authored objectives", () => {
  for (const { id } of STAGES) {
    const profile = STAGE_WORLD_PROFILES[id];
    const gimmicks = profile.gameplay.gimmicks;
    const expected = new Set([
      ...STAGE_ENCOUNTER_ROUTES[id].objectives.map((objective) => objective.id),
      STAGE_TACTICS[id].occupation.id,
      "boss-kill",
    ]);

    assert.ok(gimmicks.length >= expected.size, `${id}: needs at least one gimmick per objective`);
    assert.deepEqual(new Set(gimmicks.map(({ objectiveId }) => objectiveId)), expected,
      `${id}: gimmick objectives must cover exactly the authored objective set`);
    assert.deepEqual(gimmicks.map(({ order }) => order), gimmicks.map((_, index) => index + 1),
      `${id}: gimmick order must follow the authored sequence`);
    assert.equal(new Set(gimmicks.map(({ id: gimmickId }) => gimmickId)).size, gimmicks.length,
      `${id}: gimmick ids must be unique`);
  }
});

test("a gimmick never narrows a corridor below the width the commander physically fits", () => {
  const commanderDiameter = COMMANDER.radius * 2;
  assert.equal(commanderDiameter, 720, "this test is calibrated against the authored commander size");

  for (const { id } of STAGES) {
    for (const entry of STAGE_WORLD_PROFILES[id].gameplay.gimmicks) {
      const narrows = entry.corridorWidthBefore !== 0 || entry.corridorWidthAfter !== 0;
      if (!narrows) continue;
      assert.ok(entry.corridorWidthAfter >= 900,
        `${entry.id}: narrowed corridor ${entry.corridorWidthAfter} leaves no damage-free line`);
      assert.ok(entry.corridorWidthAfter > commanderDiameter,
        `${entry.id}: narrowed corridor is narrower than the commander`);
      if (entry.corridorWidthBefore !== 0) {
        assert.ok(entry.corridorWidthAfter <= entry.corridorWidthBefore,
          `${entry.id}: declares a narrowing but widens the corridor`);
      }
    }
  }
});

test("every gimmick footprint sits inside the slab it names, on the flat plane", () => {
  for (const { id } of STAGES) {
    const profile = STAGE_WORLD_PROFILES[id];
    const tiles = new Map(profile.gameplay.terrainTiles.map((tile) => [tile.id, tile]));

    for (const entry of profile.gameplay.gimmicks) {
      const tile = tiles.get(entry.slabId);
      assert.ok(tile, `${entry.id}: names slab ${entry.slabId}, which does not exist`);
      assert.ok(TELEGRAPH_TIERS[entry.gimmickClass]?.includes(entry.telegraphTicks),
        `${entry.id}: telegraph ${entry.telegraphTicks} is off the ${entry.gimmickClass} tier`);
      for (const placement of [entry.placement, ...entry.satellitePlacements]) {
        assert.equal(placement.elevation, 0, `${entry.id}: gimmicks stay on the flat plane`);
        assert.ok(placement.x >= tile.rect.minX && placement.x <= tile.rect.maxX
          && placement.y >= tile.rect.minY && placement.y <= tile.rect.maxY,
        `${entry.id}: footprint (${placement.x}, ${placement.y}) leaves ${tile.id}`);
      }
    }
  }
});

test("the ring gimmicks match the simulation geometry they gate", () => {
  const rings = [
    ["cinder-span", "cinder-span:gimmick-seal-oath-ring"],
    ["echo-throne", "echo-throne:gimmick-domain-command-ring"],
  ];
  for (const [stageId, gimmickId] of rings) {
    const entry = STAGE_WORLD_PROFILES[stageId].gameplay.gimmicks.find(({ id }) => id === gimmickId);
    const occupation = STAGE_TACTICS[stageId].occupation;
    assert.ok(entry, `${gimmickId} must exist`);
    assert.equal(entry.objectiveId, occupation.id, `${gimmickId} must gate the occupation point`);
    assert.equal(entry.radius, occupation.radius, `${gimmickId} radius must equal the occupation radius`);
    assert.deepEqual({ x: entry.placement.x, y: entry.placement.y }, { x: occupation.x, y: occupation.y },
      `${gimmickId} must sit on the occupation centre`);
  }
});

test("the gimmick clauses reject a sub-commander narrowing, a stray footprint, and an unknown slab", async () => {
  const narrowed = await importMutatedCatalog((source) => source.replace(
    '"warden-chain-fall", "deformation", "slab-03", "boss-kill", 4, 180, 19700, 6200, 1400, 1000',
    '"warden-chain-fall", "deformation", "slab-03", "boss-kill", 4, 180, 19700, 6200, 1400, 800',
  ), "sub-commander narrowing");
  assert.match(narrowed?.message ?? "", /narrows below the commander floor/,
    "a corridor narrower than the commander must be rejected");

  const strayed = await importMutatedCatalog((source) => source.replace(
    '"ash-causeway-collapse", "deformation", "slab-02", "cinder-relay-crossing", 1, 180, 11400, 5400',
    '"ash-causeway-collapse", "deformation", "slab-02", "cinder-relay-crossing", 1, 180, 18400, 5400',
  ), "stray footprint");
  assert.match(strayed?.message ?? "", /footprint leaves its own slab/,
    "a gimmick outside its declared chamber must be rejected");

  const unknownSlab = await importMutatedCatalog((source) => source.replace(
    '"seal-oath-ring", "gate", "slab-03"',
    '"seal-oath-ring", "gate", "slab-09"',
  ), "unknown slab");
  assert.match(unknownSlab?.message ?? "", /names an unknown slab/,
    "a gimmick pointing at a slab that does not exist must be rejected");

  const uncovered = await importMutatedCatalog((source) => source.replace(
    '"classification-craze", "deformation", "slab-03", "boss-kill", 4, 180',
    '"classification-craze", "deformation", "slab-03", "chancel-oath", 4, 180',
  ), "uncovered objective");
  assert.match(uncovered?.message ?? "", /Every authored objective needs a bound gimmick/,
    "leaving an objective without a gimmick must be rejected");
});
