// Contract: every character GLB the battle renderer can instantiate is rigged
// with 11 unique base clips; the commander adds exact melee/ranged delivery clips.
//
// This exists because the previous rig pipeline shipped defects that were
// invisible to every other test in this repo -- the models loaded, the scene
// rendered, and nothing threw:
//
//   * 4 boss GLBs had no skin and no animations at all, so their stage silently
//     rendered a static prop where an animated boss was intended.
//   * The other 20 bound to Rigify's stock metarig, scaled to mesh height but
//     never fitted to the mesh, so bone-heat fell back to nearest-bone weights.
//     guard.glb gave DEF-hand.R more total weight than its whole spine chain;
//     pack-herald.glb put 47% of all weight on one head bone. Both still
//     "animated" -- they just deformed from the wrong joints.
//
// The assertions defend both clip-library completeness and deformation weight shape.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GLB_DIR = join(ROOT, "assets/images/battle/glb");

const RIG_ACTION_KEYS = [
  "idle", "move", "run", "hit", "bighit", "attack", "critical", "avoid", "defence", "die", "show",
];
const COMMANDER_GLB = "commander/dusk-warden.glb";
const COMMANDER_DELIVERY_CLIPS = [
  "dusk-warden::attack_melee::v01",
  "dusk-warden::attack_ranged::v01",
];

// Mirrors battle-realtime-three.js BOSS_MODELS / ENEMY_MODELS /
// COMPANION_MODELS / COMMANDER_MODEL -- every path an actor can resolve to.
const CHARACTER_GLBS = [
  COMMANDER_GLB,
  "companions/ember-cohort.glb", "companions/rift-lens.glb", "companions/veil-vanguard.glb",
  "companions/anchor-shard.glb", "companions/throne-echo.glb", "companions/dawnless-crown.glb",
  "companions/pack-warden.glb", "companions/lantern-reaver.glb", "companions/requiem-warden.glb",
  "enemies/scout.glb", "enemies/shade.glb", "enemies/guard.glb", "enemies/possessed.glb",
  "bosses/cinder-warden.glb", "bosses/veil-tactician.glb", "bosses/gate-sovereign.glb",
  "bosses/tide-warden.glb", "bosses/pack-herald.glb", "bosses/requiem-choir.glb",
  "bosses/lantern-tyrant.glb", "bosses/bridge-colossus.glb", "bosses/veiled-concordat.glb",
  "bosses/abyss-regent.glb",
];

function readGlb(path) {
  const buf = readFileSync(path);
  assert.equal(buf.readUInt32LE(0), 0x46546c67, `${path}: not a GLB`);
  const total = buf.readUInt32LE(8);
  let off = 12;
  let json = null;
  let bin = null;
  while (off < total) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const chunk = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString("utf8"));
    else if (type === 0x004e4942) bin = chunk;
    off += 8 + len + ((4 - (len % 4)) % 4 === 4 ? 0 : 0);
    off = off - (8 + len) + 8 + len; // chunks are already 4-byte aligned by spec
  }
  return { json, bin };
}

const COMPONENT_READERS = {
  5121: (b, o) => b.readUInt8(o),
  5123: (b, o) => b.readUInt16LE(o),
  5125: (b, o) => b.readUInt32LE(o),
  5126: (b, o) => b.readFloatLE(o),
};
const COMPONENT_SIZES = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_COUNTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function readAccessor(json, bin, index) {
  const acc = json.accessors[index];
  const n = TYPE_COUNTS[acc.type];
  const size = COMPONENT_SIZES[acc.componentType];
  const read = COMPONENT_READERS[acc.componentType];
  const view = json.bufferViews[acc.bufferView];
  const base = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const stride = view.byteStride ?? size * n;
  const out = [];
  for (let i = 0; i < acc.count; i++) {
    const row = [];
    for (let c = 0; c < n; c++) row.push(read(bin, base + i * stride + c * size));
    out.push(row);
  }
  return { values: out, componentType: acc.componentType };
}

function jointWeightTotals({ json, bin }) {
  const skin = json.skins?.[0];
  if (!skin) return null;
  const names = skin.joints.map((j) => json.nodes[j].name ?? `node${j}`);
  const totals = new Map();
  for (const node of json.nodes) {
    if (node.mesh === undefined || node.skin === undefined) continue;
    for (const prim of json.meshes[node.mesh].primitives) {
      const at = prim.attributes;
      if (at.JOINTS_0 === undefined || at.WEIGHTS_0 === undefined) continue;
      const J = readAccessor(json, bin, at.JOINTS_0);
      const W = readAccessor(json, bin, at.WEIGHTS_0);
      const denom = W.componentType === 5121 ? 255 : W.componentType === 5123 ? 65535 : 1;
      for (let i = 0; i < J.values.length; i++) {
        for (let c = 0; c < J.values[i].length; c++) {
          const w = W.values[i][c] / denom;
          if (w <= 1e-4) continue;
          const name = names[J.values[i][c]];
          totals.set(name, (totals.get(name) ?? 0) + w);
        }
      }
    }
  }
  return { names, totals };
}

for (const rel of CHARACTER_GLBS) {
  test(`${rel} is rigged with the full action library`, () => {
    const glb = readGlb(join(GLB_DIR, rel));
    const { json } = glb;

    assert.ok(json.skins?.length >= 1, `${rel}: no skin -- actor would render as a static prop`);
    assert.ok(json.skins[0].joints.length >= 12,
      `${rel}: only ${json.skins[0].joints.length} joints`);

    const keys = new Set();
    for (const anim of json.animations ?? []) {
      const parts = (anim.name ?? "").split("::");
      const key = parts.length >= 2 ? parts[1] : parts[0];
      if (RIG_ACTION_KEYS.includes(key)) keys.add(key);
    }
    const missing = RIG_ACTION_KEYS.filter((k) => !keys.has(k));
    assert.deepEqual(missing, [], `${rel}: missing clips ${missing.join(",")}`);

    const animationNames = (json.animations ?? []).map((animation) => animation.name);
    const expectedClipCount = rel === COMMANDER_GLB ? 13 : 11;
    assert.equal(animationNames.length, expectedClipCount,
      `${rel}: expected exactly ${expectedClipCount} clips, found ${animationNames.length}`);
    assert.equal(new Set(animationNames).size, expectedClipCount,
      `${rel}: clip names must be unique`);
    if (rel === COMMANDER_GLB) {
      for (const name of COMMANDER_DELIVERY_CLIPS) {
        assert.ok(animationNames.includes(name), `${rel}: missing exact delivery clip ${name}`);
      }
    }

    const wq = jointWeightTotals(glb);
    assert.ok(wq, `${rel}: no skin weights`);

    // The glTF exporter parks unweighted verts on a synthetic "neutral_bone";
    // those verts ignore every clip and tear away from the animated body.
    const neutral = wq.names.filter((n) => /neutral/i.test(n));
    assert.deepEqual(neutral, [], `${rel}: unweighted verts parked on ${neutral.join(",")}`);

    // No single joint may dominate. The old pipeline's worst case was 47% on
    // one bone (pack-herald head); a fitted rig spreads weight across the body.
    const total = [...wq.totals.values()].reduce((a, b) => a + b, 0);
    assert.ok(total > 0, `${rel}: zero total weight`);
    let topName = null;
    let topShare = 0;
    for (const [name, w] of wq.totals) {
      if (w / total > topShare) { topShare = w / total; topName = name; }
    }
    assert.ok(topShare < 0.40,
      `${rel}: ${topName} holds ${(topShare * 100).toFixed(1)}% of all weight (limit 40%)`);

    // The arm chain must own real weight, otherwise arm-driven clips (attack,
    // defence, show) visibly do nothing no matter how large the keyframes are.
    // Measured against the UPPER body, not the whole rig: an arm's ability to
    // move geometry does not depend on how much mass hangs below the hips, and
    // characters that carry a robe skirt or a companion beast in the same
    // skinned mesh (abyss-regent, pack-herald) would otherwise fail for owning
    // 7-9% of a much larger body while still driving 41-54% of everything above
    // the waist. Cast range at the time of writing: 41.1% - 87.8% of the upper
    // chain, 7.2% - 46.1% of the rig.
    let armWeight = 0;
    let upperWeight = 0;
    for (const [name, w] of wq.totals) {
      if (/upper_arm|forearm|hand|shoulder/.test(name)) armWeight += w;
      if (/upper_arm|forearm|hand|shoulder|spine|head|neck/.test(name)) upperWeight += w;
    }
    assert.ok(upperWeight > 0, `${rel}: no upper-body chain weight`);
    assert.ok(armWeight / upperWeight >= 0.25,
      `${rel}: arm chain owns only ${((armWeight / upperWeight) * 100).toFixed(1)}% of the upper body`);
    assert.ok(armWeight / total >= 0.05,
      `${rel}: arm chain owns only ${((armWeight / total) * 100).toFixed(1)}% of the whole rig`);
  });
}
