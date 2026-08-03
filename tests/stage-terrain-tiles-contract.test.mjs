import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { STAGES } from "../defense-catalog.js";
import { STAGE_WORLD_PROFILES } from "../stage-world-catalog.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_PATH = path.join(ROOT, "stage-world-catalog.js");

/** Node names inside a .glb, read from its JSON chunk. */
async function glbNodeNames(relativePath) {
  const buffer = await readFile(path.join(ROOT, relativePath));
  const jsonLength = buffer.readUInt32LE(12);
  const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8"));
  return new Set((gltf.nodes ?? []).map(({ name }) => name).filter(Boolean));
}

/**
 * Import a mutated copy of the catalog and return the error it throws. The copy lives in a temp
 * directory and reaches the real modules through an absolute import rewrite, so the mutation is
 * evaluated by the live validator rather than by a re-implementation of it.
 */
async function importMutatedCatalog(mutate, label) {
  const source = await readFile(CATALOG_PATH, "utf8");
  const mutated = mutate(source);
  assert.notEqual(mutated, source, `${label}: mutation did not apply, so this proves nothing`);
  const directory = await mkdtemp(path.join(tmpdir(), "stage-tiles-"));
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

test("every stage tiles its walkable bounds exactly, with no gap and no overlap", () => {
  for (const { id } of STAGES) {
    const profile = STAGE_WORLD_PROFILES[id];
    const { minX, maxX, minY, maxY } = profile.gameplay.bounds;
    const tiles = profile.gameplay.terrainTiles;

    assert.ok(tiles.length >= 1, `${id}: requires authored terrain tiles`);
    const tiledArea = tiles.reduce((total, { rect }) =>
      total + ((rect.maxX - rect.minX) * (rect.maxY - rect.minY)), 0);
    assert.equal(tiledArea, (maxX - minX) * (maxY - minY), `${id}: tiles must cover the bounds exactly`);

    for (let left = 0; left < tiles.length; left += 1) {
      for (let right = left + 1; right < tiles.length; right += 1) {
        const a = tiles[left].rect;
        const b = tiles[right].rect;
        const overlap = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX))
          * Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));
        assert.equal(overlap, 0, `${id}: ${tiles[left].id} overlaps ${tiles[right].id}`);
      }
    }
  }
});

test("each tile owns the two support triangles it names, and the support mesh carries no others", () => {
  for (const { id } of STAGES) {
    const profile = STAGE_WORLD_PROFILES[id];
    const tiles = profile.gameplay.terrainTiles;
    const triangles = profile.gameplay.meshColliders[0].triangles;

    assert.equal(triangles.length, tiles.length * 2, `${id}: two triangles per tile`);
    const claimed = new Set();
    tiles.forEach((tile, index) => {
      assert.deepEqual(tile.colliderTriangleIndices, [index * 2, (index * 2) + 1],
        `${tile.id}: triangle indices must follow tile order`);
      for (const triangleIndex of tile.colliderTriangleIndices) {
        assert.equal(claimed.has(triangleIndex), false, `${tile.id}: triangle ${triangleIndex} claimed twice`);
        claimed.add(triangleIndex);
        for (const vertex of triangles[triangleIndex]) {
          assert.equal(vertex.elevation, 0, `${tile.id}: support stays on the flat plane`);
          assert.ok(vertex.x >= tile.rect.minX && vertex.x <= tile.rect.maxX
            && vertex.y >= tile.rect.minY && vertex.y <= tile.rect.maxY,
          `${tile.id}: support triangle leaves its own rect`);
        }
      }
    });
    assert.equal(claimed.size, triangles.length, `${id}: every support triangle belongs to a tile`);
  }
});

test("every authored plateNode resolves inside the promoted terrain GLB", async () => {
  for (const { id } of STAGES) {
    const profile = STAGE_WORLD_PROFILES[id];
    const names = await glbNodeNames(profile.terrainGlbPath);
    for (const tile of profile.gameplay.terrainTiles) {
      assert.equal(names.has(tile.plateNode), true,
        `${tile.id}: ${tile.plateNode} is missing from ${profile.terrainGlbPath}`);
    }
  }
});

test("the tiling clauses reject a gap, an overlap, and a missing support triangle", async () => {
  const overlap = await importMutatedCatalog((source) => source.replace(
    'terrainTile("cinder-span", 2, "Ember Relay Causeway", "basalt-ember", 8600, 17000, 800, 11200)',
    'terrainTile("cinder-span", 2, "Ember Relay Causeway", "basalt-ember", 8000, 17000, 800, 11200)',
  ), "overlap");
  assert.match(overlap?.message ?? "", /Terrain tiles overlap/, "an overlapping slab must be rejected");

  const gap = await importMutatedCatalog((source) => source.replace(
    'terrainTile("cinder-span", 3, "Drowned Forge Court", "forge-plate", 17000, 23400, 800, 11200)',
    'terrainTile("cinder-span", 3, "Drowned Forge Court", "forge-plate", 17200, 23400, 800, 11200)',
  ), "gap");
  assert.match(gap?.message ?? "", /tile the walkable bounds exactly/, "a gap in the floor must be rejected");

  const missingTriangles = await importMutatedCatalog((source) => source.replace(
    "        ...slabTriangles(17000, 23400, 800, 11200),\n",
    "",
  ), "missing support triangles");
  assert.match(missingTriangles?.message ?? "", /two triangles per terrain tile/,
    "a tile without its support triangles must be rejected");
});
