import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { inflateSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PYTHON = process.env.PYTHON ?? "python3";
const BAKE_SCRIPT = "scripts/bake-character-albedo.py";
const PROVENANCE_PATH = "assets/images/battle/glb/character-build-provenance.json";
const LANE_MANIFEST = "_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline"
  + "/runtime-candidates/character-albedo/character-albedo.manifest.json";
const COMMANDER = "assets/images/battle/glb/commander/dusk-warden.glb";

const EXPECTED_CHARACTERS = 24;
const EXPECTED_BAKED = 23;
const ATLAS_SIZE = 1024;
const DILATION_TEXELS = 12;
// A flat tint would collapse to a handful of colours; authored banding does not.
const MIN_DISTINCT_COLOURS = 64;
const MIN_FILLED_COVERAGE = 0.6;
// Some atlas background has to survive, otherwise the padding assertion below
// would pass on an image that is simply filled edge to edge.
const MIN_BACKGROUND = 0.005;
const MAX_SAMPLED_TEXELS = 1500;

const provenance = JSON.parse(readFileSync(resolve(ROOT, PROVENANCE_PATH), "utf8"));

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseGlb(relativePath) {
  const bytes = readFileSync(resolve(ROOT, relativePath));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, `${relativePath}: invalid GLB magic`);
  assert.equal(bytes.readUInt32LE(4), 2, `${relativePath}: expected glTF 2.0`);
  let offset = 12;
  let json = null;
  let binary = null;
  while (offset < bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + length;
    assert.ok(end <= bytes.length, `${relativePath}: truncated GLB chunk`);
    if (type === 0x4e4f534a) {
      json = JSON.parse(bytes.subarray(start, end).toString("utf8").replace(/[\u0000 ]+$/u, ""));
    } else if (type === 0x004e4942) {
      binary = bytes.subarray(start, end);
    }
    offset = end;
  }
  assert.ok(json, `${relativePath}: GLB has no JSON chunk`);
  assert.ok(binary, `${relativePath}: GLB has no BIN chunk`);
  return { json, binary };
}

function imageBytes({ json, binary }, imageIndex, label) {
  const image = json.images[imageIndex];
  assert.ok(image?.bufferView !== undefined, `${label}: image #${imageIndex} is not embedded`);
  const view = json.bufferViews[image.bufferView];
  const start = view.byteOffset ?? 0;
  return binary.subarray(start, start + view.byteLength);
}

function baseColourImageIndex({ json }, label) {
  const material = json.materials[json.meshes[0].primitives[0].material];
  const texture = material?.pbrMetallicRoughness?.baseColorTexture;
  assert.ok(texture, `${label}: material has no base colour texture`);
  return json.textures[texture.index].source;
}

function normalImageIndex({ json }, label) {
  const material = json.materials[json.meshes[0].primitives[0].material];
  assert.ok(material?.normalTexture, `${label}: material has no normal texture`);
  return json.textures[material.normalTexture.index].source;
}

/** Minimal decoder for the non-interlaced 8-bit RGB PNGs this bake writes. */
function decodePng(bytes, label) {
  assert.deepEqual(
    [...bytes.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    `${label}: not a PNG`,
  );
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("latin1");
    const body = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      assert.equal(body[8], 8, `${label}: expected 8-bit channels`);
      assert.equal(body[9], 2, `${label}: expected truecolour RGB`);
      assert.equal(body[12], 0, `${label}: expected a non-interlaced PNG`);
    } else if (type === "IDAT") {
      idat.push(body);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  assert.ok(width > 0 && height > 0, `${label}: PNG has no dimensions`);
  const raw = inflateSync(Buffer.concat(idat));
  const channels = 3;
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? pixels[y * stride + x - channels] : 0;
      const b = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? pixels[(y - 1) * stride + x - channels] : 0;
      let value = line[x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else {
        assert.equal(filter, 0, `${label}: unsupported PNG filter ${filter}`);
      }
      pixels[y * stride + x] = value & 0xff;
    }
  }
  return { width, height, pixels };
}

function readUvs({ json, binary }, label) {
  const accessorIndex = json.meshes[0].primitives[0].attributes.TEXCOORD_0;
  const accessor = json.accessors[accessorIndex];
  assert.equal(accessor.componentType, 5126, `${label}: expected float UVs`);
  assert.equal(accessor.type, "VEC2", `${label}: expected VEC2 UVs`);
  const view = json.bufferViews[accessor.bufferView];
  const stride = view.byteStride ?? 8;
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const uvs = new Float32Array(accessor.count * 2);
  for (let index = 0; index < accessor.count; index += 1) {
    const at = start + index * stride;
    uvs[index * 2] = binary.readFloatLE(at);
    uvs[index * 2 + 1] = binary.readFloatLE(at + 4);
  }
  return uvs;
}

const bakedAssets = Object.values(provenance.assets).filter((asset) => asset.albedoBake?.baked);

test("the build record describes a three-stage character pipeline with a per-character albedo", () => {
  assert.equal(provenance.assetCount, EXPECTED_CHARACTERS);
  assert.deepEqual(provenance.pipeline, [
    "scripts/bind-static-lower-mesh.py",
    "scripts/author-wholebody-clips-blender.py",
    "scripts/bake-character-albedo.py",
  ]);
  assert.equal(bakedAssets.length, EXPECTED_BAKED, "23 characters had no albedo art and were baked");

  const commander = provenance.assets[COMMANDER];
  assert.equal(commander.albedoBake.baked, false, "the commander already owned authored albedo art");
  assert.match(commander.albedoBake.reason ?? "", /authored cartoon albedo/u);
});

test("the build record names where each body and each albedo actually came from", () => {
  const rodin = [];
  for (const [path, asset] of Object.entries(provenance.assets)) {
    assert.ok(asset.bodyOrigin?.stage, `${path}: no recorded body origin`);
    assert.ok(asset.bodyOrigin?.tool, `${path}: no recorded body-origin tool`);
    assert.ok(asset.albedoOrigin?.stage, `${path}: no recorded albedo origin`);
    assert.ok(asset.albedoOrigin?.tool, `${path}: no recorded albedo-origin tool`);
    if (asset.bodyOrigin.stage === "rodin-bridge") rodin.push(path);
  }
  // The Rodin bridge produced exactly one character body. Recording that keeps
  // the cast's real provenance auditable instead of assumed.
  assert.deepEqual(rodin, [COMMANDER], "only the commander body came through the Rodin bridge");
  for (const asset of bakedAssets) {
    assert.equal(asset.bodyOrigin.stage, "parametric-tpose-blockout");
    assert.equal(asset.bodyOrigin.tool, "scripts/tpose_blockout.py");
    assert.equal(asset.albedoOrigin.tool, "scripts/bake-character-albedo.py");
  }
});

test("no two characters share an albedo atlas any more", () => {
  const albedoHashes = new Map();
  const normalHashes = new Set();
  for (const path of Object.keys(provenance.assets)) {
    const glb = parseGlb(path);
    const albedo = sha256(imageBytes(glb, baseColourImageIndex(glb, path), path));
    const normal = sha256(imageBytes(glb, normalImageIndex(glb, path), path));
    const owner = albedoHashes.get(albedo);
    assert.equal(owner, undefined, `${path}: shares its albedo atlas with ${owner}`);
    albedoHashes.set(albedo, path);
    normalHashes.add(normal);
  }
  assert.equal(albedoHashes.size, EXPECTED_CHARACTERS, "every character owns a distinct albedo");
  // The normal map is still deliberately shared -- only the albedo became
  // per-character, so this documents the intended split.
  assert.equal(normalHashes.size, 1, "the toon normal map is still shared across the cast");
});

test("each baked atlas is authored art in the character's own UV space", async (t) => {
  for (const asset of bakedAssets) {
    await t.test(asset.outputPath, () => {
      const glb = parseGlb(asset.outputPath);
      const png = imageBytes(glb, baseColourImageIndex(glb, asset.outputPath), asset.outputPath);
      assert.equal(sha256(png), asset.albedoBake.atlasSha256, "atlas bytes drifted from the record");
      assert.equal(asset.albedoBake.atlasWidth, ATLAS_SIZE);
      assert.equal(asset.albedoBake.atlasHeight, ATLAS_SIZE);
      assert.equal(asset.albedoBake.dilationTexels, DILATION_TEXELS);

      const { width, height, pixels } = decodePng(png, asset.outputPath);
      assert.equal(width, ATLAS_SIZE);
      assert.equal(height, ATLAS_SIZE);

      let filled = 0;
      const colours = new Set();
      for (let index = 0; index < width * height; index += 1) {
        const r = pixels[index * 3];
        const g = pixels[index * 3 + 1];
        const b = pixels[index * 3 + 2];
        if (r !== 0 || g !== 0 || b !== 0) {
          filled += 1;
          colours.add((r << 16) | (g << 8) | b);
        }
      }
      const filledRatio = filled / (width * height);
      assert.ok(
        filledRatio >= MIN_FILLED_COVERAGE,
        `only ${(filledRatio * 100).toFixed(1)}% of the atlas is baked`,
      );
      assert.ok(
        1 - filledRatio >= MIN_BACKGROUND,
        "the atlas is filled edge to edge, so seam padding cannot be measured",
      );
      assert.ok(
        colours.size >= MIN_DISTINCT_COLOURS,
        `${colours.size} distinct colours reads as a flat tint, not authored banding`,
      );
      assert.ok(
        asset.albedoBake.uvCoverage > 0.3 && asset.albedoBake.uvCoverage < filledRatio,
        "the recorded UV coverage must sit inside the dilated coverage",
      );
    });
  }
});

test("every UV seam is padded, so filtering can never sample atlas background", async (t) => {
  for (const asset of bakedAssets) {
    await t.test(asset.outputPath, () => {
      const glb = parseGlb(asset.outputPath);
      const png = imageBytes(glb, baseColourImageIndex(glb, asset.outputPath), asset.outputPath);
      const { width, height, pixels } = decodePng(png, asset.outputPath);
      const uvs = readUvs(glb, asset.outputPath);

      const texels = new Set();
      for (let index = 0; index < uvs.length; index += 2) {
        const x = Math.min(Math.max(Math.floor(uvs[index] * width), 0), width - 1);
        const y = Math.min(Math.max(Math.floor(uvs[index + 1] * height), 0), height - 1);
        texels.add(y * width + x);
      }
      const ordered = [...texels].sort((left, right) => left - right);
      const step = Math.max(1, Math.floor(ordered.length / MAX_SAMPLED_TEXELS));
      const background = (x, y) => {
        const at = (y * width + x) * 3;
        return pixels[at] === 0 && pixels[at + 1] === 0 && pixels[at + 2] === 0;
      };

      let sampled = 0;
      for (let index = 0; index < ordered.length && sampled < MAX_SAMPLED_TEXELS; index += step) {
        const texel = ordered[index];
        const tx = texel % width;
        const ty = Math.floor(texel / width);
        sampled += 1;
        for (let dy = -DILATION_TEXELS; dy <= DILATION_TEXELS; dy += 1) {
          const y = Math.min(Math.max(ty + dy, 0), height - 1);
          for (let dx = -DILATION_TEXELS; dx <= DILATION_TEXELS; dx += 1) {
            const x = Math.min(Math.max(tx + dx, 0), width - 1);
            assert.equal(
              background(x, y),
              false,
              `unpadded seam at (${tx}, ${ty}): background within ${DILATION_TEXELS} texels`,
            );
          }
        }
      }
      assert.ok(sampled > 100, "too few UV texels were sampled to prove seam padding");
    });
  }
});

test("baked colour lives in the atlas, not in a material tint that would double it", () => {
  for (const asset of bakedAssets) {
    const { json } = parseGlb(asset.outputPath);
    const material = json.materials[json.meshes[0].primitives[0].material];
    const factor = material.pbrMetallicRoughness.baseColorFactor ?? [1, 1, 1, 1];
    assert.deepEqual(
      factor.slice(0, 3),
      [1, 1, 1],
      `${asset.outputPath}: a non-white baseColorFactor would re-tint the baked atlas`,
    );
  }
});

test("re-running the bake reproduces the shipped atlases byte for byte", (t) => {
  if (!existsSync(resolve(ROOT, LANE_MANIFEST))) {
    // The candidate lane is generated, local-only material (see .gitignore), so
    // a clean checkout cannot re-derive it. The shipped-bytes assertions above
    // still hold without it.
    t.skip("character-albedo candidate lane is not staged in this checkout");
    return;
  }
  const result = spawnSync(PYTHON, [BAKE_SCRIPT, "--check"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.characters, EXPECTED_CHARACTERS);
  assert.equal(payload.baked, EXPECTED_BAKED);
  assert.equal(payload.checked, true);
});
