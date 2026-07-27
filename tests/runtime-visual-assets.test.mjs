import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { STAGES } from "../campaign-state.js";
import { RETAINED_ASSET_PATHS } from "../scripts/defense-runtime-assets.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GLB_ROOT = join(ROOT, "assets/images/battle/glb");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GLB_MAGIC = 0x46546c67;
const GLB_JSON_CHUNK = 0x4e4f534a;
const GLB_BINARY_CHUNK = 0x004e4942;

const STAGE_ART_BY_ID = Object.freeze({
  "cinder-span": "assets/images/battle/ui/stages/cinder-span.png",
  "veil-citadel": "assets/images/battle/ui/stages/veil-citadel.png",
  "echo-throne": "assets/images/battle/ui/stages/echo-throne-steps.png",
  "sunken-bastion": "assets/images/battle/ui/stages/sunken-bastion.png",
  "howling-sprawl": "assets/images/battle/ui/stages/howling-sprawl.png",
  "glass-necropolis": "assets/images/battle/ui/stages/glass-necropolis.png",
  "starless-canal": "assets/images/battle/ui/stages/starless-canal.png",
  "shattered-causeway": "assets/images/battle/ui/stages/shattered-causeway.png",
  "abyss-chancel": "assets/images/battle/ui/stages/abyss-chancel.png",
  "gate-zenith": "assets/images/battle/ui/stages/gate-zenith.png",
});

const COMBAT_GLBS = Object.freeze([
  "assets/images/battle/glb/props/abyss-blade.glb",
  "assets/images/battle/glb/props/arc-caster.glb",
  "assets/images/battle/glb/vfx/abyss-orb.glb",
  "assets/images/battle/glb/vfx/melee-slash.glb",
  "assets/images/battle/glb/vfx/ranged-bolt.glb",
]);

const COMMANDER_ACTIONS = Object.freeze([
  "idle", "move", "run", "hit", "bighit", "attack", "critical",
  "avoid", "defence", "die", "show", "attack_melee", "attack_ranged",
]);

const CRC_TABLE = new Uint32Array(256);
for (let value = 0; value < CRC_TABLE.length; value += 1) {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  CRC_TABLE[value] = crc >>> 0;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function assertValidPng(path, label) {
  const bytes = readFileSync(path);
  assert.ok(bytes.length >= 33, `${label}: truncated PNG (${bytes.length} bytes)`);
  assert.ok(bytes.subarray(0, 8).equals(PNG_SIGNATURE), `${label}: invalid PNG signature`);

  let offset = 8;
  let chunkNumber = 0;
  let sawHeader = false;
  let sawImageData = false;
  let sawEnd = false;
  while (offset < bytes.length) {
    assert.ok(bytes.length - offset >= 12, `${label}: truncated PNG chunk header at byte ${offset}`);
    const length = bytes.readUInt32BE(offset);
    const chunkEnd = offset + 12 + length;
    assert.ok(chunkEnd <= bytes.length, `${label}: PNG chunk at byte ${offset} exceeds file length`);

    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const expectedCrc = bytes.readUInt32BE(offset + 8 + length);
    const actualCrc = crc32(bytes.subarray(offset + 4, offset + 8 + length));
    assert.equal(actualCrc, expectedCrc, `${label}: ${type} chunk has an invalid CRC`);
    if (chunkNumber === 0) assert.equal(type, "IHDR", `${label}: first PNG chunk must be IHDR`);

    if (type === "IHDR") {
      assert.equal(sawHeader, false, `${label}: PNG contains multiple IHDR chunks`);
      assert.equal(length, 13, `${label}: IHDR chunk must contain 13 bytes`);
      const width = bytes.readUInt32BE(offset + 8);
      const height = bytes.readUInt32BE(offset + 12);
      const bitDepth = bytes[offset + 16];
      const colorType = bytes[offset + 17];
      const validDepths = {
        0: [1, 2, 4, 8, 16],
        2: [8, 16],
        3: [1, 2, 4, 8],
        4: [8, 16],
        6: [8, 16],
      };
      assert.ok(width > 0 && width <= 0x7fffffff, `${label}: invalid PNG width ${width}`);
      assert.ok(height > 0 && height <= 0x7fffffff, `${label}: invalid PNG height ${height}`);
      assert.ok(validDepths[colorType]?.includes(bitDepth), `${label}: invalid PNG color type/bit depth ${colorType}/${bitDepth}`);
      assert.equal(bytes[offset + 18], 0, `${label}: unsupported PNG compression method`);
      assert.equal(bytes[offset + 19], 0, `${label}: unsupported PNG filter method`);
      assert.ok(bytes[offset + 20] === 0 || bytes[offset + 20] === 1, `${label}: invalid PNG interlace method`);
      sawHeader = true;
    } else if (type === "IDAT") {
      sawImageData = true;
    } else if (type === "IEND") {
      assert.equal(length, 0, `${label}: IEND chunk must be empty`);
      assert.equal(chunkEnd, bytes.length, `${label}: data follows the IEND chunk`);
      sawEnd = true;
    }

    offset = chunkEnd;
    chunkNumber += 1;
  }

  assert.equal(sawHeader, true, `${label}: missing IHDR chunk`);
  assert.equal(sawImageData, true, `${label}: missing IDAT chunk`);
  assert.equal(sawEnd, true, `${label}: missing IEND chunk`);
}

function parseGlb(path, label) {
  const bytes = readFileSync(path);
  assert.ok(bytes.length >= 20, `${label}: truncated GLB (${bytes.length} bytes)`);
  assert.equal(bytes.readUInt32LE(0), GLB_MAGIC, `${label}: invalid GLB magic`);
  assert.equal(bytes.readUInt32LE(4), 2, `${label}: expected glTF 2.0 GLB`);
  assert.equal(bytes.readUInt32LE(8), bytes.length, `${label}: GLB header length does not match file size`);

  let offset = 12;
  let chunkNumber = 0;
  let json;
  let binary;
  while (offset < bytes.length) {
    assert.ok(bytes.length - offset >= 8, `${label}: truncated GLB chunk header at byte ${offset}`);
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const chunkEnd = offset + 8 + length;
    assert.equal(length % 4, 0, `${label}: GLB chunk ${chunkNumber} is not 4-byte aligned`);
    assert.ok(chunkEnd <= bytes.length, `${label}: GLB chunk ${chunkNumber} exceeds file length`);
    if (chunkNumber === 0) assert.equal(type, GLB_JSON_CHUNK, `${label}: first GLB chunk must be JSON`);
    if (type === GLB_JSON_CHUNK) {
      assert.equal(json, undefined, `${label}: GLB contains multiple JSON chunks`);
      try {
        json = JSON.parse(bytes.toString("utf8", offset + 8, chunkEnd));
      } catch (error) {
        assert.fail(`${label}: invalid GLB JSON (${error.message})`);
      }
    } else if (type === GLB_BINARY_CHUNK) {
      assert.equal(binary, undefined, `${label}: GLB contains multiple binary chunks`);
      binary = bytes.subarray(offset + 8, chunkEnd);
    }
    offset = chunkEnd;
    chunkNumber += 1;
  }

  assert.equal(offset, bytes.length, `${label}: GLB chunks do not fill the declared file length`);
  assert.ok(json, `${label}: missing GLB JSON chunk`);
  assert.equal(json.asset?.version, "2.0", `${label}: glTF asset.version must be 2.0`);
  return { binary, json, path };
}

function deployedGlbPaths(directory = GLB_ROOT) {
  const paths = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...deployedGlbPaths(path));
    else if (entry.isFile() && entry.name.endsWith(".glb")) {
      paths.push(relative(ROOT, path).split(sep).join("/"));
    }
  }
  return paths.sort((left, right) => left.localeCompare(right));
}

function assertIndex(index, values, label, target) {
  assert.ok(Number.isInteger(index) && index >= 0 && index < values.length,
    `${label}: ${target} index ${String(index)} is out of range (count ${values.length})`);
}

function materialTextureReferences(material) {
  const references = [];
  function visit(value, location) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      const childLocation = location ? `${location}.${key}` : key;
      if (key.endsWith("Texture") && child && typeof child === "object" && "index" in child) {
        references.push({ index: child.index, location: childLocation });
      }
      visit(child, childLocation);
    }
  }
  visit(material, "material");
  return references;
}

function textureImageSources(texture) {
  const sources = [];
  if (texture.source !== undefined) sources.push([texture.source, "source"]);
  for (const [extension, value] of Object.entries(texture.extensions ?? {})) {
    if (value?.source !== undefined) sources.push([value.source, `extensions.${extension}.source`]);
  }
  return sources;
}

function decodeDataUri(uri, label) {
  const match = /^data:([^,]*?),(.*)$/s.exec(uri);
  assert.ok(match, `${label}: malformed data URI`);
  try {
    return match[1].endsWith(";base64")
      ? Buffer.from(match[2], "base64")
      : Buffer.from(decodeURIComponent(match[2]), "utf8");
  } catch (error) {
    assert.fail(`${label}: cannot decode data URI (${error.message})`);
  }
}

function gltfBufferBytes(glb, bufferIndex, label) {
  const buffer = glb.json.buffers?.[bufferIndex];
  assert.ok(buffer, `${label}: buffer ${bufferIndex} is missing`);
  if (buffer.uri !== undefined) {
    assert.equal(typeof buffer.uri, "string", `${label}: buffer ${bufferIndex} URI is not a string`);
    assert.equal(buffer.uri.includes("_workspace"), false, `${label}: buffer ${bufferIndex} URI references _workspace`);
  }
  let bytes;
  if (buffer.uri === undefined) {
    assert.equal(bufferIndex, 0, `${label}: only buffer 0 may use the GLB binary chunk`);
    assert.ok(glb.binary, `${label}: buffer 0 has no GLB binary chunk`);
    bytes = glb.binary;
  } else if (buffer.uri.startsWith("data:")) {
    bytes = decodeDataUri(buffer.uri, `${label}: buffer ${bufferIndex}`);
  } else {
    bytes = readFileSync(resolve(dirname(glb.path), decodeURIComponent(buffer.uri)));
  }
  assert.ok(bytes.length >= buffer.byteLength,
    `${label}: buffer ${bufferIndex} has ${bytes.length} bytes, expected at least ${buffer.byteLength}`);
  return bytes;
}

function gltfImageBytes(glb, imageIndex, label) {
  const image = glb.json.images[imageIndex];
  assert.ok(image, `${label}: image ${imageIndex} is missing`);
  if (image.uri !== undefined) {
    assert.equal(typeof image.uri, "string", `${label}: image ${imageIndex} URI is not a string`);
    assert.equal(image.uri.includes("_workspace"), false, `${label}: image ${imageIndex} URI references _workspace`);
  }
  if (image.uri !== undefined) {
    return image.uri.startsWith("data:")
      ? decodeDataUri(image.uri, `${label}: image ${imageIndex}`)
      : readFileSync(resolve(dirname(glb.path), decodeURIComponent(image.uri)));
  }

  const view = glb.json.bufferViews[image.bufferView];
  assert.ok(view, `${label}: image ${imageIndex} bufferView ${String(image.bufferView)} is missing`);
  const buffer = gltfBufferBytes(glb, view.buffer ?? 0, label);
  const start = view.byteOffset ?? 0;
  const end = start + view.byteLength;
  assert.ok(start >= 0 && end <= buffer.length,
    `${label}: image ${imageIndex} bufferView exceeds buffer length`);
  return buffer.subarray(start, end);
}

function imageDimensions(bytes, label) {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }

  if (bytes.length >= 10 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      assert.equal(bytes[offset], 0xff, `${label}: malformed JPEG marker at byte ${offset}`);
      while (bytes[offset] === 0xff) offset += 1;
      const marker = bytes[offset];
      offset += 1;
      if (marker === 0xd9 || marker === 0xda) break;
      const length = bytes.readUInt16BE(offset);
      assert.ok(length >= 2 && offset + length <= bytes.length, `${label}: malformed JPEG segment`);
      if (startOfFrame.has(marker)) {
        assert.ok(length >= 7, `${label}: truncated JPEG size segment`);
        return { width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3) };
      }
      offset += length;
    }
  }

  if (bytes.length >= 30 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    const format = bytes.toString("ascii", 12, 16);
    if (format === "VP8X") {
      return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
    }
    if (format === "VP8L" && bytes[20] === 0x2f) {
      const packed = bytes.readUInt32LE(21);
      return { width: 1 + (packed & 0x3fff), height: 1 + ((packed >>> 14) & 0x3fff) };
    }
    if (format === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
    }
  }

  assert.fail(`${label}: base-color image is not a decodable PNG, JPEG, or WebP`);
}

function assertTexturedMeshContract(glb, label) {
  const { json } = glb;
  const accessors = json.accessors ?? [];
  const meshes = json.meshes ?? [];
  const materials = json.materials ?? [];
  const textures = json.textures ?? [];
  const images = json.images ?? [];
  const bufferViews = json.bufferViews ?? [];
  assert.ok(meshes.length > 0, `${label}: no meshes`);

  let primitiveCount = 0;
  for (let meshIndex = 0; meshIndex < meshes.length; meshIndex += 1) {
    const primitives = meshes[meshIndex].primitives ?? [];
    for (let primitiveIndex = 0; primitiveIndex < primitives.length; primitiveIndex += 1) {
      primitiveCount += 1;
      const primitive = primitives[primitiveIndex];
      const location = `mesh ${meshIndex} primitive ${primitiveIndex}`;
      assertIndex(primitive.attributes?.NORMAL, accessors, label, `${location} NORMAL accessor`);
      assertIndex(primitive.attributes?.TEXCOORD_0, accessors, label, `${location} TEXCOORD_0 accessor`);
      if (primitive.material !== undefined) assertIndex(primitive.material, materials, label, `${location} material`);
    }
  }
  assert.ok(primitiveCount > 0, `${label}: meshes contain no primitives`);

  const texturedMaterial = materials.findIndex((material) =>
    material?.pbrMetallicRoughness?.baseColorTexture?.index !== undefined
      && material?.normalTexture?.index !== undefined);
  assert.notEqual(texturedMaterial, -1, `${label}: no material references both a base-color texture and a normal texture`);

  for (let materialIndex = 0; materialIndex < materials.length; materialIndex += 1) {
    const material = materials[materialIndex];
    for (const reference of materialTextureReferences(material)) {
      assertIndex(reference.index, textures, label, `material ${materialIndex} ${reference.location} texture`);
    }

    const baseColorTexture = material?.pbrMetallicRoughness?.baseColorTexture?.index;
    if (baseColorTexture === undefined) continue;
    assertIndex(baseColorTexture, textures, label, `material ${materialIndex} base-color texture`);
    const sources = textureImageSources(textures[baseColorTexture]);
    assert.ok(sources.length > 0, `${label}: material ${materialIndex} base-color texture has no image source`);
    for (const [source] of sources) {
      assertIndex(source, images, label, `material ${materialIndex} base-color image`);
      const dimensions = imageDimensions(
        gltfImageBytes(glb, source, label),
        `${label}: material ${materialIndex} base-color image ${source}`,
      );
      assert.ok(dimensions.width > 1 && dimensions.height > 1,
        `${label}: material ${materialIndex} base-color image ${source} is a ${dimensions.width}x${dimensions.height} factor swatch`);
    }
  }

  for (let textureIndex = 0; textureIndex < textures.length; textureIndex += 1) {
    const sources = textureImageSources(textures[textureIndex]);
    assert.ok(sources.length > 0, `${label}: texture ${textureIndex} has no image source`);
    for (const [source, location] of sources) assertIndex(source, images, label, `texture ${textureIndex} ${location} image`);
  }

  for (let imageIndex = 0; imageIndex < images.length; imageIndex += 1) {
    const image = images[imageIndex];
    if (image.uri !== undefined) {
      assert.equal(typeof image.uri, "string", `${label}: image ${imageIndex} URI is not a string`);
      assert.equal(image.uri.includes("_workspace"), false, `${label}: image ${imageIndex} URI references _workspace`);
    } else {
      assertIndex(image.bufferView, bufferViews, label, `image ${imageIndex} bufferView`);
    }
  }

  for (let bufferIndex = 0; bufferIndex < (json.buffers ?? []).length; bufferIndex += 1) {
    const uri = json.buffers[bufferIndex].uri;
    if (uri === undefined) continue;
    assert.equal(typeof uri, "string", `${label}: buffer ${bufferIndex} URI is not a string`);
    assert.equal(uri.includes("_workspace"), false, `${label}: buffer ${bufferIndex} URI references _workspace`);
  }
}

test("the ten-stage catalog resolves to retained, structurally valid PNG artwork", async (t) => {
  const stageIds = STAGES.map(({ id }) => id);
  assert.equal(stageIds.length, 10, `stage art contract: expected 10 stages, found ${stageIds.length}`);
  assert.deepEqual(Object.keys(STAGE_ART_BY_ID), stageIds, "stage art contract: frozen mapping does not match the runtime stage catalog");
  assert.equal(STAGE_ART_BY_ID["echo-throne"], "assets/images/battle/ui/stages/echo-throne-steps.png",
    "stage art contract: echo-throne must resolve to echo-throne-steps.png");

  const retained = new Set(RETAINED_ASSET_PATHS);
  for (const stageId of stageIds) {
    const assetPath = STAGE_ART_BY_ID[stageId];
    await t.test(`${stageId} -> ${assetPath}`, () => {
      assert.ok(retained.has(assetPath), `${assetPath}: absent from the frozen runtime asset manifest`);
      assert.ok(existsSync(join(ROOT, assetPath)), `${assetPath}: missing runtime stage PNG`);
      assertValidPng(join(ROOT, assetPath), assetPath);
    });
  }
});

test("the five combat presentation assets are present glTF 2.0 GLBs", async (t) => {
  for (const assetPath of COMBAT_GLBS) {
    await t.test(assetPath, () => {
      const absolutePath = join(ROOT, assetPath);
      assert.ok(existsSync(absolutePath), `${assetPath}: missing required combat GLB`);
      parseGlb(absolutePath, assetPath);
    });
  }
});

test("every deployed battle GLB has textured normal-mapped mesh primitives", async (t) => {
  const actualPaths = deployedGlbPaths();
  const manifest = JSON.parse(readFileSync(join(ROOT, "assets/defense-asset-manifest.json"), "utf8"));
  const retainedPaths = RETAINED_ASSET_PATHS
    .filter((path) => path.startsWith("assets/images/battle/glb/") && path.endsWith(".glb"))
    .sort((left, right) => left.localeCompare(right));
  const declaredNonRuntimePaths = new Set([
    ...(manifest.rows ?? []),
    ...(manifest.historicalDeletionRows ?? []),
  ]
    .filter((row) => row.currentPath.startsWith("assets/images/battle/glb/")
      && row.currentPath.endsWith(".glb")
      && row.disposition === "delete")
    .map((row) => row.currentPath));
  const retained = new Set(retainedPaths);
  const runtimePaths = actualPaths.filter((path) => retained.has(path));

  await t.test("tree matches the frozen runtime asset manifest", () => {
    const actual = new Set(actualPaths);
    const missing = retainedPaths.filter((path) => !actual.has(path));
    const undeclared = actualPaths.filter((path) => !retained.has(path) && !declaredNonRuntimePaths.has(path));
    const summarize = (paths) => paths.slice(0, 5).join(", ") || "none";
    assert.equal(missing.length + undeclared.length, 0,
      `battle GLB tree differs from frozen manifest: missing runtime ${missing.length} [${summarize(missing)}]; undeclared extras ${undeclared.length} [${summarize(undeclared)}]`);
  });

  for (const assetPath of runtimePaths) {
    await t.test(assetPath, () => {
      const glb = parseGlb(join(ROOT, assetPath), assetPath);
      assertTexturedMeshContract(glb, assetPath);
    });
  }
});

test("dusk-warden has one skin and the exact thirteen-clip combat library", () => {
  const assetPath = "assets/images/battle/glb/commander/dusk-warden.glb";
  const { json } = parseGlb(join(ROOT, assetPath), assetPath);
  assert.equal(json.skins?.length, 1, `${assetPath}: expected exactly one skin, found ${json.skins?.length ?? 0}`);

  const names = (json.animations ?? []).map((animation) => animation.name);
  const uniqueNames = new Set(names);
  const expectedNames = COMMANDER_ACTIONS.map((action) => `dusk-warden::${action}::v01`);
  assert.equal(names.length, 13, `${assetPath}: expected 13 animations, found ${names.length}`);
  assert.equal(uniqueNames.size, 13, `${assetPath}: animation names must be unique (found ${uniqueNames.size} unique)`);
  assert.deepEqual([...uniqueNames].sort(), expectedNames.sort(), `${assetPath}: animation clip names do not match the required combat library`);
});
