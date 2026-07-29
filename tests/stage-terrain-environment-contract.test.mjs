// Contract: each canonical runtime terrain is a distinct, authored 3D environment,
// not a textured proxy slab or a stage-agnostic copy.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, posix, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { STAGE_WORLD_PROFILES } from "../stage-world-catalog.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GLB_MAGIC = 0x46546c67;
const GLB_JSON_CHUNK = 0x4e4f534a;
const GLB_BINARY_CHUNK = 0x004e4942;
const IDENTITY = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const MATERIAL_ROLE_WORDS = new Set(["surface", "contour", "landmark", "hazard", "objective", "accent"]);
const COMPONENTS_BY_TYPE = Object.freeze({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 });
const COMPONENT_TYPES = Object.freeze({
  5120: { bytes: 1, read: (buffer, offset) => buffer.readInt8(offset), normalize: (value) => Math.max(value / 127, -1) },
  5121: { bytes: 1, read: (buffer, offset) => buffer.readUInt8(offset), normalize: (value) => value / 255 },
  5122: { bytes: 2, read: (buffer, offset) => buffer.readInt16LE(offset), normalize: (value) => Math.max(value / 32767, -1) },
  5123: { bytes: 2, read: (buffer, offset) => buffer.readUInt16LE(offset), normalize: (value) => value / 65535 },
  5125: { bytes: 4, read: (buffer, offset) => buffer.readUInt32LE(offset), normalize: (value) => value / 4294967295 },
  5126: { bytes: 4, read: (buffer, offset) => buffer.readFloatLE(offset), normalize: (value) => value },
});

const PROVENANCE_PATH = "assets/images/battle/glb/terrain/build-provenance.json";
const TERRAIN_BUILDER_PATH = "scripts/build-authored-stage-environments.py";
const ALL_MESH_PROVENANCE_PATH = "_workspace/archive/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline/all-mesh-texture-candidates-v2/audit.json";
const STAGE_SCENE_AUDIT_PATH = "scripts/audit-stage-scenes.mjs";
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

function assertExactObjectKeys(value, expectedKeys, label) {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), `${label}: expected an object`);
  assert.deepEqual(
    Object.keys(value).sort(),
    [...expectedKeys].sort(),
    `${label}: expected exactly ${expectedKeys.join(", ")}`,
  );
}

function assertRepositoryPath(path, label) {
  assert.equal(typeof path, "string", `${label}: expected a string path`);
  assert.notEqual(path, "", `${label}: path must not be empty`);
  assert.ok(!path.includes("\\"), `${label}: path must use POSIX separators`);
  assert.ok(!posix.isAbsolute(path), `${label}: path must be repository-relative`);
  assert.equal(posix.normalize(path), path, `${label}: path must be normalized and non-traversing`);
  assert.ok(
    path.split("/").every((part) => part !== "" && part !== "." && part !== ".."),
    `${label}: path must not contain empty, current-directory, or parent-directory segments`,
  );

  const absolutePath = resolve(ROOT, path);
  const repositoryRelativePath = relative(ROOT, absolutePath);
  assert.ok(
    repositoryRelativePath !== "" && !repositoryRelativePath.startsWith(`..${posix.sep}`) && !isAbsolute(repositoryRelativePath),
    `${label}: path must resolve inside the repository`,
  );
  return absolutePath;
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function assertFileDigest(path, expectedSha256, label) {
  assert.match(expectedSha256, SHA256_PATTERN, `${label}.sha256: expected a lowercase SHA-256 digest`);
  const absolutePath = assertRepositoryPath(path, `${label}.path`);
  assert.ok(existsSync(absolutePath), `${label}: missing referenced file ${path}`);
  assert.equal(sha256File(absolutePath), expectedSha256, `${label}: SHA-256 drift for ${path}`);
}

function sortJsonKeys(value) {
  if (Array.isArray(value)) return value.map(sortJsonKeys);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortJsonKeys(value[key])]),
  );
}

function assertTerrainBuildProvenance(manifest) {
  assertExactObjectKeys(manifest, ["schemaVersion", "generator", "inputs", "stages"], "terrain provenance");
  assert.equal(manifest.schemaVersion, 1, "terrain provenance: unsupported schemaVersion");

  assertExactObjectKeys(
    manifest.generator,
    ["scriptPath", "scriptSha256", "blenderVersion"],
    "terrain provenance.generator",
  );
  assert.equal(
    manifest.generator.scriptPath,
    TERRAIN_BUILDER_PATH,
    "terrain provenance.generator.scriptPath: must reference the canonical terrain builder",
  );
  assert.equal(typeof manifest.generator.blenderVersion, "string", "terrain provenance.generator.blenderVersion: expected a string");
  assert.notEqual(manifest.generator.blenderVersion.trim(), "", "terrain provenance.generator.blenderVersion: must not be empty");
  assertFileDigest(
    manifest.generator.scriptPath,
    manifest.generator.scriptSha256,
    "terrain provenance.generator",
  );

  assertExactObjectKeys(manifest.inputs, ["surface", "normal"], "terrain provenance.inputs");
  for (const inputName of ["surface", "normal"]) {
    const input = manifest.inputs[inputName];
    assertExactObjectKeys(input, ["path", "sha256"], `terrain provenance.inputs.${inputName}`);
    assertFileDigest(input.path, input.sha256, `terrain provenance.inputs.${inputName}`);
  }
  assert.notEqual(
    manifest.inputs.surface.path,
    manifest.inputs.normal.path,
    "terrain provenance inputs: surface and normal must reference distinct files",
  );

  const canonicalStageIds = Object.keys(STAGE_WORLD_PROFILES).sort();
  assert.equal(canonicalStageIds.length, 10, "terrain provenance: expected ten canonical runtime stages");
  assertExactObjectKeys(manifest.stages, canonicalStageIds, "terrain provenance.stages");

  const conceptPaths = new Set();
  for (const stageId of canonicalStageIds) {
    const stage = manifest.stages[stageId];
    const label = `terrain provenance.stages.${stageId}`;
    assertExactObjectKeys(stage, ["outputPath", "outputSha256", "conceptPath", "conceptSha256"], label);
    assert.equal(
      stage.outputPath,
      STAGE_WORLD_PROFILES[stageId].terrainGlbPath,
      `${label}.outputPath: must equal the runtime terrain path`,
    );
    assertFileDigest(stage.outputPath, stage.outputSha256, `${label}.output`);
    assertFileDigest(stage.conceptPath, stage.conceptSha256, `${label}.concept`);
    conceptPaths.add(stage.conceptPath);
  }
  assert.equal(conceptPaths.size, 10, "terrain provenance: every stage must reference a distinct concept image");
}

function parseGlb(path, label) {
  const bytes = readFileSync(path);
  assert.ok(bytes.length >= 20, `${label}: truncated GLB (${bytes.length} bytes)`);
  assert.equal(bytes.readUInt32LE(0), GLB_MAGIC, `${label}: invalid GLB magic`);
  assert.equal(bytes.readUInt32LE(4), 2, `${label}: expected glTF 2.0 GLB`);
  assert.equal(bytes.readUInt32LE(8), bytes.length, `${label}: GLB header length does not match file size`);

  const chunks = [];
  let offset = 12;
  while (offset < bytes.length) {
    assert.ok(bytes.length - offset >= 8, `${label}: truncated GLB chunk header at byte ${offset}`);
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const end = offset + 8 + length;
    assert.equal(length % 4, 0, `${label}: GLB chunk at byte ${offset} is not 4-byte aligned`);
    assert.ok(end <= bytes.length, `${label}: GLB chunk at byte ${offset} exceeds file length`);
    chunks.push({ type, bytes: bytes.subarray(offset + 8, end) });
    offset = end;
  }
  assert.equal(offset, bytes.length, `${label}: GLB chunks do not fill the declared file length`);
  assert.equal(chunks[0]?.type, GLB_JSON_CHUNK, `${label}: first GLB chunk must be JSON`);
  assert.equal(chunks.filter(({ type }) => type === GLB_JSON_CHUNK).length, 1,
    `${label}: GLB must contain exactly one JSON chunk`);
  assert.ok(chunks.filter(({ type }) => type === GLB_BINARY_CHUNK).length <= 1,
    `${label}: GLB contains multiple binary chunks`);

  let json;
  try {
    json = JSON.parse(chunks[0].bytes.toString("utf8").replace(/[\u0000 ]+$/u, ""));
  } catch (error) {
    assert.fail(`${label}: invalid GLB JSON (${error.message})`);
  }
  assert.equal(json.asset?.version, "2.0", `${label}: glTF asset.version must be 2.0`);
  return {
    binary: chunks.find(({ type }) => type === GLB_BINARY_CHUNK)?.bytes,
    bytes,
    chunks,
    json,
    path,
  };
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

function resolveUri(uri, containingPath, label) {
  assert.equal(typeof uri, "string", `${label}: URI must be a string`);
  assert.equal(uri.includes("_workspace"), false, `${label}: URI references _workspace`);
  return uri.startsWith("data:")
    ? decodeDataUri(uri, label)
    : readFileSync(resolve(dirname(containingPath), decodeURIComponent(uri)));
}

function resolveBuffers(glb, label) {
  return (glb.json.buffers ?? []).map((buffer, index) => {
    const bytes = buffer.uri === undefined
      ? (index === 0 && glb.binary)
      : resolveUri(buffer.uri, glb.path, `${label}: buffer ${index}`);
    assert.ok(bytes, `${label}: buffer ${index} has no binary data`);
    assert.ok(Number.isInteger(buffer.byteLength) && buffer.byteLength >= 0,
      `${label}: buffer ${index} has invalid byteLength`);
    assert.ok(bytes.length >= buffer.byteLength,
      `${label}: buffer ${index} has ${bytes.length} bytes, expected ${buffer.byteLength}`);
    return bytes;
  });
}

function assertIndex(index, values, label, target) {
  assert.ok(Number.isInteger(index) && index >= 0 && index < values.length,
    `${label}: ${target} index ${String(index)} is out of range (count ${values.length})`);
}

function textureSources(texture) {
  const sources = [];
  if (texture?.source !== undefined) sources.push(texture.source);
  for (const extension of Object.values(texture?.extensions ?? {})) {
    if (extension?.source !== undefined) sources.push(extension.source);
  }
  return sources;
}

function assertTextureReference(glb, buffers, textureIndex, label) {
  const { bufferViews = [], images = [], textures = [] } = glb.json;
  assertIndex(textureIndex, textures, label, "texture");
  const sources = textureSources(textures[textureIndex]);
  assert.ok(sources.length > 0, `${label}: texture ${textureIndex} has no image source`);
  for (const imageIndex of sources) {
    assertIndex(imageIndex, images, label, `texture ${textureIndex} image`);
    const image = images[imageIndex];
    let bytes;
    if (image.uri !== undefined) {
      bytes = resolveUri(image.uri, glb.path, `${label}: image ${imageIndex}`);
    } else {
      assertIndex(image.bufferView, bufferViews, label, `image ${imageIndex} bufferView`);
      const view = bufferViews[image.bufferView];
      assertIndex(view.buffer ?? 0, buffers, label, `image ${imageIndex} buffer`);
      const start = view.byteOffset ?? 0;
      const end = start + view.byteLength;
      assert.ok(Number.isInteger(view.byteLength) && start >= 0 && end <= buffers[view.buffer ?? 0].length,
        `${label}: image ${imageIndex} bufferView exceeds its buffer`);
      bytes = buffers[view.buffer ?? 0].subarray(start, end);
    }
    assert.ok(bytes.length > 0, `${label}: image ${imageIndex} is empty`);
  }
}

function readAccessor(glb, buffers, index, label) {
  const accessors = glb.json.accessors ?? [];
  const bufferViews = glb.json.bufferViews ?? [];
  assertIndex(index, accessors, label, "accessor");
  const accessor = accessors[index];
  const components = COMPONENTS_BY_TYPE[accessor.type];
  const component = COMPONENT_TYPES[accessor.componentType];
  assert.ok(components, `${label}: accessor ${index} has unsupported type ${String(accessor.type)}`);
  assert.ok(component, `${label}: accessor ${index} has unsupported component type ${String(accessor.componentType)}`);
  assert.ok(Number.isInteger(accessor.count) && accessor.count > 0,
    `${label}: accessor ${index} has invalid count ${String(accessor.count)}`);

  const values = new Float64Array(accessor.count * components);
  const readView = (viewIndex, byteOffset, count, destinationIndexes = null) => {
    assertIndex(viewIndex, bufferViews, label, `accessor ${index} bufferView`);
    const view = bufferViews[viewIndex];
    assertIndex(view.buffer ?? 0, buffers, label, `accessor ${index} buffer`);
    const buffer = buffers[view.buffer ?? 0];
    const packedSize = components * component.bytes;
    const stride = view.byteStride ?? packedSize;
    assert.ok(stride >= packedSize, `${label}: accessor ${index} byteStride is smaller than one element`);
    const start = (view.byteOffset ?? 0) + (byteOffset ?? 0);
    const finalByte = start + (count - 1) * stride + packedSize;
    assert.ok(start >= 0 && finalByte <= (view.byteOffset ?? 0) + view.byteLength && finalByte <= buffer.length,
      `${label}: accessor ${index} exceeds its bufferView`);
    for (let row = 0; row < count; row += 1) {
      const destination = destinationIndexes ? destinationIndexes[row] : row;
      assert.ok(Number.isInteger(destination) && destination >= 0 && destination < accessor.count,
        `${label}: accessor ${index} sparse index ${String(destination)} is out of range`);
      for (let column = 0; column < components; column += 1) {
        const raw = component.read(buffer, start + row * stride + column * component.bytes);
        values[destination * components + column] = accessor.normalized ? component.normalize(raw) : raw;
      }
    }
  };

  if (accessor.bufferView !== undefined) readView(accessor.bufferView, accessor.byteOffset, accessor.count);
  if (accessor.sparse) {
    const sparse = accessor.sparse;
    assert.ok(Number.isInteger(sparse.count) && sparse.count > 0 && sparse.count <= accessor.count,
      `${label}: accessor ${index} has invalid sparse count`);
    const sparseIndexType = COMPONENT_TYPES[sparse.indices?.componentType];
    assert.ok([5121, 5123, 5125].includes(sparse.indices?.componentType),
      `${label}: accessor ${index} has invalid sparse index component type`);
    assertIndex(sparse.indices.bufferView, bufferViews, label, `accessor ${index} sparse indices bufferView`);
    const indexView = bufferViews[sparse.indices.bufferView];
    assertIndex(indexView.buffer ?? 0, buffers, label, `accessor ${index} sparse indices buffer`);
    const indexBuffer = buffers[indexView.buffer ?? 0];
    const indexStart = (indexView.byteOffset ?? 0) + (sparse.indices.byteOffset ?? 0);
    const indexEnd = indexStart + sparse.count * sparseIndexType.bytes;
    assert.ok(indexEnd <= (indexView.byteOffset ?? 0) + indexView.byteLength && indexEnd <= indexBuffer.length,
      `${label}: accessor ${index} sparse indices exceed their bufferView`);
    const indexes = Array.from({ length: sparse.count }, (_, row) =>
      sparseIndexType.read(indexBuffer, indexStart + row * sparseIndexType.bytes));
    readView(sparse.values.bufferView, sparse.values.byteOffset, sparse.count, indexes);
  }
  assert.ok(values.every(Number.isFinite), `${label}: accessor ${index} contains a non-finite value`);
  return { accessor, components, values };
}

function multiplyMatrices(left, right) {
  const result = new Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let inner = 0; inner < 4; inner += 1) {
        result[column * 4 + row] += left[inner * 4 + row] * right[column * 4 + inner];
      }
    }
  }
  return result;
}

function nodeMatrix(node) {
  if (node.matrix !== undefined) {
    assert.ok(Array.isArray(node.matrix) && node.matrix.length === 16 && node.matrix.every(Number.isFinite),
      "node matrix must contain 16 finite values");
    return node.matrix;
  }
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  assert.ok([x, y, z, w, sx, sy, sz, tx, ty, tz].every(Number.isFinite), "node TRS must be finite");
  return [
    (1 - 2 * (y * y + z * z)) * sx, (2 * (x * y + z * w)) * sx, (2 * (x * z - y * w)) * sx, 0,
    (2 * (x * y - z * w)) * sy, (1 - 2 * (x * x + z * z)) * sy, (2 * (y * z + x * w)) * sy, 0,
    (2 * (x * z + y * w)) * sz, (2 * (y * z - x * w)) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function transformPoint(matrix, x, y, z) {
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ];
}

function triangleCount(primitive, accessors) {
  const count = primitive.indices === undefined
    ? accessors[primitive.attributes.POSITION]?.count
    : accessors[primitive.indices]?.count;
  if (!Number.isInteger(count)) return 0;
  const mode = primitive.mode ?? 4;
  if (mode === 4) return Math.floor(count / 3);
  if (mode === 5 || mode === 6) return Math.max(0, count - 2);
  return 0;
}

function activeSceneRoots(json) {
  if ((json.scenes ?? []).length > 0) {
    const sceneIndex = json.scene ?? 0;
    assertIndex(sceneIndex, json.scenes, "terrain scene", "scene");
    return json.scenes[sceneIndex].nodes ?? [];
  }
  const children = new Set((json.nodes ?? []).flatMap((node) => node.children ?? []));
  return (json.nodes ?? []).map((_, index) => index).filter((index) => !children.has(index));
}

function architectureCounts(json, label) {
  const nodes = json.nodes ?? [];
  const meshes = json.meshes ?? [];
  let meshNodeCount = 0;
  let primitiveInstanceCount = 0;
  const visit = (nodeIndex, ancestors = new Set()) => {
    assertIndex(nodeIndex, nodes, label, "node");
    assert.equal(ancestors.has(nodeIndex), false, `${label}: node hierarchy contains a cycle at node ${nodeIndex}`);
    const nextAncestors = new Set(ancestors).add(nodeIndex);
    const node = nodes[nodeIndex];
    if (node.mesh !== undefined) {
      assertIndex(node.mesh, meshes, label, `node ${nodeIndex} mesh`);
      meshNodeCount += 1;
      primitiveInstanceCount += (meshes[node.mesh].primitives ?? []).length;
    }
    for (const child of node.children ?? []) visit(child, nextAncestors);
  };
  for (const root of activeSceneRoots(json)) visit(root);
  assert.ok(Math.max(meshNodeCount, primitiveInstanceCount) >= 20,
    `${label}: expected at least 20 mesh-bearing nodes or primitive instances, found ${meshNodeCount} nodes / ${primitiveInstanceCount} primitives`);
  return { meshNodeCount, primitiveInstanceCount };
}

function geometryEvidence(glb, buffers, label) {
  const { accessors = [], meshes = [], nodes = [] } = glb.json;
  const instances = [];
  const accessorCache = new Map();
  const positions = (index) => {
    if (!accessorCache.has(index)) accessorCache.set(index, readAccessor(glb, buffers, index, label));
    return accessorCache.get(index);
  };
  const visit = (nodeIndex, parentMatrix, ancestors = new Set()) => {
    assertIndex(nodeIndex, nodes, label, "node");
    assert.equal(ancestors.has(nodeIndex), false, `${label}: node hierarchy contains a cycle at node ${nodeIndex}`);
    const nextAncestors = new Set(ancestors).add(nodeIndex);
    const node = nodes[nodeIndex];
    const worldMatrix = multiplyMatrices(parentMatrix, nodeMatrix(node));
    if (node.mesh !== undefined) {
      assertIndex(node.mesh, meshes, label, `node ${nodeIndex} mesh`);
      for (const [primitiveIndex, primitive] of (meshes[node.mesh].primitives ?? []).entries()) {
        const location = `node ${nodeIndex} mesh ${node.mesh} primitive ${primitiveIndex}`;
        assertIndex(primitive.attributes?.POSITION, accessors, label, `${location} POSITION accessor`);
        const positionData = positions(primitive.attributes.POSITION);
        assert.equal(positionData.accessor.type, "VEC3", `${label}: ${location} POSITION must be VEC3`);
        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];
        for (let offset = 0; offset < positionData.values.length; offset += 3) {
          const point = transformPoint(worldMatrix,
            positionData.values[offset], positionData.values[offset + 1], positionData.values[offset + 2]);
          for (let axis = 0; axis < 3; axis += 1) {
            min[axis] = Math.min(min[axis], point[axis]);
            max[axis] = Math.max(max[axis], point[axis]);
          }
        }
        instances.push({
          location,
          min,
          max,
          triangles: triangleCount(primitive, accessors),
        });
      }
    }
    for (const child of node.children ?? []) visit(child, worldMatrix, nextAncestors);
  };
  for (const root of activeSceneRoots(glb.json)) visit(root, IDENTITY);
  assert.ok(instances.length > 0, `${label}: active scene has no mesh primitive instances`);
  return instances;
}

function assertStructuralVariety(instances, label) {
  const sceneMin = [Infinity, Infinity, Infinity];
  const sceneMax = [-Infinity, -Infinity, -Infinity];
  for (const instance of instances) {
    for (let axis = 0; axis < 3; axis += 1) {
      sceneMin[axis] = Math.min(sceneMin[axis], instance.min[axis]);
      sceneMax[axis] = Math.max(sceneMax[axis], instance.max[axis]);
    }
  }
  const sceneSize = sceneMax.map((value, axis) => value - sceneMin[axis]);
  assert.ok(sceneSize.every((value) => Number.isFinite(value) && value > 1e-5),
    `${label}: 3D bounds are degenerate (${sceneSize.join(" x ")})`);

  const shapeSignatures = new Set();
  const occupiedCells = new Set();
  let totalTriangles = 0;
  for (const instance of instances) {
    const size = instance.max.map((value, axis) => value - instance.min[axis]);
    const coverage = size.map((value, axis) => value / sceneSize[axis]);
    assert.equal(coverage.every((value) => value >= 0.85) && instance.triangles <= 24, false,
      `${label}: ${instance.location} is an oversized ${instance.triangles}-triangle proxy block spanning ${coverage.map((value) => value.toFixed(2)).join(" x ")} of the scene`);
    shapeSignatures.add(size.map((value, axis) => Math.round((value / sceneSize[axis]) * 100)).join("x"));
    const center = instance.min.map((value, axis) => (value + instance.max[axis]) / 2);
    occupiedCells.add(center.map((value, axis) =>
      Math.min(3, Math.max(0, Math.floor(((value - sceneMin[axis]) / sceneSize[axis]) * 4)))).join(":"));
    totalTriangles += instance.triangles;
  }
  assert.ok(shapeSignatures.size >= 6,
    `${label}: only ${shapeSignatures.size} distinct geometry extent signatures; expected at least 6 architectural shapes`);
  assert.ok(occupiedCells.size >= 8,
    `${label}: geometry occupies only ${occupiedCells.size} spatial cells; expected at least 8 for structural distribution`);
  assert.ok(totalTriangles >= 200,
    `${label}: only ${totalTriangles} rendered triangles; expected at least 200 for authored architecture`);
}

function paletteTokens(profile) {
  return Object.values(profile.presentation?.palette ?? {})
    .filter((value) => typeof value === "string" && !value.startsWith("#"))
    .flatMap((value) => value.toLowerCase().split(/[^a-z0-9]+/u))
    .filter((word) => word.length >= 4 && !MATERIAL_ROLE_WORDS.has(word));
}

function assertStageEnvironment(glb, profile) {
  const label = `${profile.stageId} (${profile.terrainGlbPath})`;
  const { accessors = [], materials = [], meshes = [] } = glb.json;
  const buffers = resolveBuffers(glb, label);
  architectureCounts(glb.json, label);

  const namedMaterials = new Set(materials.map(({ name }) => name?.trim()).filter(Boolean));
  assert.ok(namedMaterials.size >= 4,
    `${label}: expected at least 4 distinctly named materials, found ${namedMaterials.size} [${[...namedMaterials].join(", ")}]`);
  const expectedPaletteTokens = paletteTokens(profile);
  if (expectedPaletteTokens.length > 0) {
    const normalizedNames = [...namedMaterials].join(" ").toLowerCase();
    assert.ok(expectedPaletteTokens.some((token) => normalizedNames.includes(token)),
      `${label}: material names do not carry a stage palette token [${expectedPaletteTokens.join(", ")}]`);
  }

  let baseColorTexture;
  let normalTexture;
  for (const [meshIndex, mesh] of meshes.entries()) {
    for (const [primitiveIndex, primitive] of (mesh.primitives ?? []).entries()) {
      const location = `mesh ${meshIndex} primitive ${primitiveIndex}`;
      assertIndex(primitive.attributes?.POSITION, accessors, label, `${location} POSITION accessor`);
      assertIndex(primitive.attributes?.NORMAL, accessors, label, `${location} NORMAL accessor`);
      assertIndex(primitive.attributes?.TEXCOORD_0, accessors, label, `${location} TEXCOORD_0 accessor`);
      assertIndex(primitive.material, materials, label, `${location} material`);
      const material = materials[primitive.material];
      baseColorTexture ??= material?.pbrMetallicRoughness?.baseColorTexture?.index;
      normalTexture ??= material?.normalTexture?.index;
    }
  }
  assert.notEqual(baseColorTexture, undefined, `${label}: no primitive material references a base-color texture`);
  assert.notEqual(normalTexture, undefined, `${label}: no primitive material references a normal texture`);
  assertTextureReference(glb, buffers, baseColorTexture, `${label}: base-color`);
  assertTextureReference(glb, buffers, normalTexture, `${label}: normal-map`);
  assertStructuralVariety(geometryEvidence(glb, buffers, label), label);
}

function encodeGlb(json, chunks) {
  const encodedJson = Buffer.from(JSON.stringify(json));
  const jsonPadding = Buffer.alloc((4 - (encodedJson.length % 4)) % 4, 0x20);
  const payloads = [
    { type: GLB_JSON_CHUNK, bytes: Buffer.concat([encodedJson, jsonPadding]) },
    ...chunks.filter(({ type }) => type !== GLB_JSON_CHUNK),
  ];
  const totalLength = 12 + payloads.reduce((sum, chunk) => sum + 8 + chunk.bytes.length, 0);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  return Buffer.concat([
    header,
    ...payloads.flatMap((chunk) => {
      const chunkHeader = Buffer.alloc(8);
      chunkHeader.writeUInt32LE(chunk.bytes.length, 0);
      chunkHeader.writeUInt32LE(chunk.type, 4);
      return [chunkHeader, chunk.bytes];
    }),
  ]);
}

test("all ten canonical runtime terrains are distinct authored environments", async (t) => {
  const profiles = Object.values(STAGE_WORLD_PROFILES);
  assert.equal(profiles.length, 10, `terrain contract: expected 10 canonical stages, found ${profiles.length}`);
  const hashes = new Map();

  for (const profile of profiles) {
    await t.test(`${profile.stageId} -> ${profile.terrainGlbPath}`, () => {
      const absolutePath = join(ROOT, profile.terrainGlbPath);
      assert.ok(existsSync(absolutePath), `${profile.stageId}: missing runtime terrain ${profile.terrainGlbPath}`);
      const glb = parseGlb(absolutePath, profile.terrainGlbPath);
      hashes.set(profile.stageId, createHash("sha256").update(glb.bytes).digest("hex"));
      assertStageEnvironment(glb, profile);
    });
  }

  await t.test("stage terrain bytes are pairwise distinct", () => {
    const duplicates = [];
    const stagesByHash = new Map();
    for (const [stageId, hash] of hashes) {
      const stages = stagesByHash.get(hash) ?? [];
      stages.push(stageId);
      stagesByHash.set(hash, stages);
    }
    for (const stages of stagesByHash.values()) if (stages.length > 1) duplicates.push(stages.join(" / "));
    assert.equal(hashes.size, 10, `terrain hash contract: only ${hashes.size}/10 terrain files parsed`);
    assert.deepEqual(duplicates, [], `terrain hash contract: duplicated terrain bytes for ${duplicates.join(", ")}`);
  });
});

test("terrain build provenance binds the builder, shared inputs, concepts, and deployed outputs", () => {
  const manifestPath = join(ROOT, PROVENANCE_PATH);
  assert.ok(existsSync(manifestPath), `terrain provenance: missing ${PROVENANCE_PATH}`);
  const manifestSource = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(manifestSource);
  assert.equal(
    manifestSource,
    `${JSON.stringify(sortJsonKeys(manifest), null, 2)}\n`,
    "terrain provenance: manifest must be deterministic sorted JSON with a trailing newline",
  );
  assertTerrainBuildProvenance(manifest);

  const firstStage = manifest.stages[Object.keys(STAGE_WORLD_PROFILES).sort()[0]];
  const driftCases = [
    ["builder", manifest.generator.scriptPath, manifest.generator.scriptSha256],
    ["surface input", manifest.inputs.surface.path, manifest.inputs.surface.sha256],
    ["normal input", manifest.inputs.normal.path, manifest.inputs.normal.sha256],
    ["concept", firstStage.conceptPath, firstStage.conceptSha256],
    ["output", firstStage.outputPath, firstStage.outputSha256],
  ];
  for (const [label, path, expectedSha256] of driftCases) {
    const mismatchedSha256 = `${expectedSha256[0] === "0" ? "1" : "0"}${expectedSha256.slice(1)}`;
    assert.throws(
      () => assertFileDigest(path, mismatchedSha256, `terrain provenance drift fixture ${label}`),
      /SHA-256 drift/u,
      `${label} drift must fail the provenance gate`,
    );
  }
});

test("stage scene audit selects canonical terrain provenance without displacing auxiliary mesh provenance", () => {
  const report = JSON.parse(execFileSync(
    process.execPath,
    [resolve(ROOT, STAGE_SCENE_AUDIT_PATH)],
    { cwd: ROOT, encoding: "utf8" },
  ));
  const terrainManifest = JSON.parse(readFileSync(resolve(ROOT, PROVENANCE_PATH), "utf8"));
  const allMeshAudit = JSON.parse(readFileSync(resolve(ROOT, ALL_MESH_PROVENANCE_PATH), "utf8"));

  assert.equal(report.sources.terrainBuildProvenance, PROVENANCE_PATH);
  assert.equal(report.sources.allMeshGlbAudit, ALL_MESH_PROVENANCE_PATH);

  const terrainRecord = terrainManifest.stages["cinder-span"];
  const terrainAsset = report.assets.find(({ path }) => path === terrainRecord.outputPath);
  assert.ok(terrainAsset, `stage scene audit: missing ${terrainRecord.outputPath}`);
  assert.deepEqual(terrainAsset.provenance, {
    auditPath: PROVENANCE_PATH,
    outputPath: terrainRecord.outputPath,
    verifiedOutputSha256: terrainRecord.outputSha256,
  });
  assert.equal(terrainAsset.sha256, terrainRecord.outputSha256);
  assert.equal(terrainAsset.checks.verifiedProvenanceMatch, true);

  const auxiliaryPath = "props/bulwark-brand.glb";
  const auxiliaryRecord = allMeshAudit.rows.find(({ relativePath }) => relativePath === auxiliaryPath);
  assert.ok(auxiliaryRecord, `all-mesh audit: missing ${auxiliaryPath}`);
  assert.equal(auxiliaryRecord.status, "ok");
  assert.ok(Object.values(auxiliaryRecord.checks).every((value) => value === true));

  const auxiliaryAsset = report.assets.find(({ path }) => path === `assets/images/battle/glb/${auxiliaryPath}`);
  assert.ok(auxiliaryAsset, `stage scene audit: missing ${auxiliaryPath}`);
  assert.equal(auxiliaryAsset.provenance.auditPath, ALL_MESH_PROVENANCE_PATH);
  assert.equal(auxiliaryAsset.provenance.candidateRelativePath, auxiliaryPath);
  assert.equal(auxiliaryAsset.provenance.verifiedOutputSha256, auxiliaryRecord.outputSha256);
  assert.equal(auxiliaryAsset.provenance.auditStatus, auxiliaryRecord.status);
  assert.equal(auxiliaryAsset.sha256, auxiliaryRecord.outputSha256);
  assert.equal(auxiliaryAsset.checks.verifiedProvenanceMatch, true);
});


test("the architecture-count gate rejects a copied low-detail proxy mutation", () => {
  const profile = STAGE_WORLD_PROFILES["cinder-span"];
  const sourcePath = join(ROOT, profile.terrainGlbPath);
  const source = parseGlb(sourcePath, profile.terrainGlbPath);
  const sourceMeshNode = (source.json.nodes ?? []).find((node) => node.mesh !== undefined);
  assert.ok(sourceMeshNode, "mutation fixture source has no mesh node");

  const mutatedJson = structuredClone(source.json);
  mutatedJson.nodes = [{ ...structuredClone(sourceMeshNode), children: [] }];
  mutatedJson.scenes = [{ nodes: [0] }];
  mutatedJson.scene = 0;

  const directory = mkdtempSync(join(tmpdir(), "terrain-contract-"));
  const fixturePath = join(directory, "low-detail-proxy.glb");
  try {
    writeFileSync(fixturePath, encodeGlb(mutatedJson, source.chunks));
    const fixture = parseGlb(fixturePath, "temporary low-detail proxy fixture");
    assert.throws(
      () => architectureCounts(fixture.json, "temporary low-detail proxy fixture"),
      /expected at least 20 mesh-bearing nodes or primitive instances, found 1 nodes \/ \d+ primitives/u,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
