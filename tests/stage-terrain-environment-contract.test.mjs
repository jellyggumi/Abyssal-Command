// Contract: each canonical runtime terrain is a distinct, authored 3D environment,
// not a textured proxy slab or a stage-agnostic copy.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { STAGE_WORLD_PROFILES } from "../stage-world-catalog.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GLB_MAGIC = 0x46546c67;
const GLB_JSON_CHUNK = 0x4e4f534a;
const GLB_BINARY_CHUNK = 0x004e4942;
const IDENTITY = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const COMPONENTS_BY_TYPE = Object.freeze({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 });
const COMPONENT_TYPES = Object.freeze({
  5120: { bytes: 1, read: (buffer, offset) => buffer.readInt8(offset), normalize: (value) => Math.max(value / 127, -1) },
  5121: { bytes: 1, read: (buffer, offset) => buffer.readUInt8(offset), normalize: (value) => value / 255 },
  5122: { bytes: 2, read: (buffer, offset) => buffer.readInt16LE(offset), normalize: (value) => Math.max(value / 32767, -1) },
  5123: { bytes: 2, read: (buffer, offset) => buffer.readUInt16LE(offset), normalize: (value) => value / 65535 },
  5125: { bytes: 4, read: (buffer, offset) => buffer.readUInt32LE(offset), normalize: (value) => value / 4294967295 },
  5126: { bytes: 4, read: (buffer, offset) => buffer.readFloatLE(offset), normalize: (value) => value },
});

const CINDER_RESOURCE_MANIFEST_PATH = "assets/mesh/terrain/terrain-cinder-span/runtime/terrain-cinder-span-resources.manifest.json";
const CINDER_RUNTIME_GLBS = Object.freeze([
  "assets/mesh/terrain/terrain-cinder-span/runtime/terrain/terrain-cinder-span.glb",
  "assets/mesh/terrain/terrain-cinder-span/runtime/packs/terrain-cinder-span-features.glb",
  "assets/mesh/terrain/terrain-cinder-span/runtime/packs/terrain-cinder-span-props.glb",
]);







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

function assertNamedMeshNode(glb, nodeName, label) {
  assert.equal(typeof nodeName, "string", `${label}: requested modelNode must be a string`);
  assert.notEqual(nodeName.trim(), "", `${label}: requested modelNode must not be empty`);
  const nodes = glb.json.nodes ?? [];
  const reachable = new Set();
  const pending = [...activeSceneRoots(glb.json)];
  while (pending.length > 0) {
    const nodeIndex = pending.pop();
    if (reachable.has(nodeIndex)) continue;
    const node = nodes[nodeIndex];
    assert.ok(node, `${label}: active scene references missing node ${nodeIndex}`);
    reachable.add(nodeIndex);
    pending.push(...(node.children ?? []));
  }

  const rootIndex = [...reachable].find((nodeIndex) => nodes[nodeIndex].name === nodeName) ?? -1;
  assert.notEqual(rootIndex, -1, `${label}: active scene is missing requested node ${nodeName}`);
  const descendants = [rootIndex];
  const visited = new Set();
  let hasMesh = false;
  while (descendants.length > 0) {
    const nodeIndex = descendants.pop();
    if (visited.has(nodeIndex)) continue;
    visited.add(nodeIndex);
    const node = nodes[nodeIndex];
    assert.ok(node, `${label}: node ${nodeName} references missing child ${nodeIndex}`);
    hasMesh ||= node.mesh !== undefined;
    descendants.push(...(node.children ?? []));
  }
  assert.equal(hasMesh, true, `${label}: requested node ${nodeName} has no renderable mesh`);
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

test("promoted slab floors and retained offline sources both remain finite, textured GLBs", () => {
  const profiles = Object.values(STAGE_WORLD_PROFILES);
  assert.equal(profiles.length, 3, `terrain contract: expected 3 canonical stages, found ${profiles.length}`);
  const hashes = new Set();
  const cinderManifestPath = join(ROOT, CINDER_RESOURCE_MANIFEST_PATH);
  assert.ok(existsSync(cinderManifestPath), "Cinder Span: missing packaged resource manifest");
  const cinderManifest = JSON.parse(readFileSync(cinderManifestPath, "utf8"));
  assert.deepEqual(
    cinderManifest.promotionAudit?.resources?.map(({ path }) => path),
    CINDER_RUNTIME_GLBS,
    "Cinder Span: promotion audit must name the terrain GLB and both node-addressable pack GLBs",
  );
  const cinderProps = STAGE_WORLD_PROFILES["cinder-span"].presentation.props;
  for (const packPath of CINDER_RUNTIME_GLBS.slice(1)) {
    const pack = parseGlb(join(ROOT, packPath), packPath);
    const requestedNodes = cinderProps.filter(({ modelPath }) => modelPath === packPath).map(({ modelNode }) => modelNode);
    assert.ok(requestedNodes.length > 0, `${packPath}: no Cinder placements address this pack`);
    for (const modelNode of requestedNodes) assertNamedMeshNode(pack, modelNode, packPath);
  }

  for (const profile of profiles) {
    const candidatePath = profile.terrainSourceCandidatePath;
    const label = `${profile.stageId} (${candidatePath})`;
    assert.match(candidatePath, /^assets\/mesh\/terrain\//u, `${label}: must use a retained terrain source`);
    // Cycle 10 supersession: each stage now ships a composed slab floor, so the
    // promoted-terrain contract replaces the previous "nothing is eligible" guard.
    assert.equal(profile.terrainRuntimeEligible, true, `${label}: the composed slab floor is gameplay-eligible`);
    assert.match(profile.terrainGlbPath, /\/runtime\/.*-floor\.glb$/u, `${label}: gameplay terrain must be a promoted floor under runtime/`);
    assert.equal(profile.terrainFallback, undefined, `${label}: an eligible floor must not also carry a procedural fallback`);
    if (profile.stageId === "cinder-span") {
      assert.match(candidatePath, /\/runtime\/.*\.glb$/u, `${label}: promoted Cinder diorama must remain available for offline inspection`);
    } else {
      assert.match(candidatePath, /\/textured-candidate\/.*\.glb$/u, `${label}: rejected textured source must remain marked as a candidate`);
    }

    // Both subjects are inspected. Before cycle 10 `terrainGlbPath` was null and a
    // `??` fallback pointed this loop at the candidate; now that the floor is real,
    // the same expression would silently retarget onto it and leave the retained
    // diorama and both textured candidates unchecked anywhere in the suite. Iterate
    // the pair explicitly so promoting terrain cannot evaporate offline coverage.
    for (const [role, terrainSourcePath] of [["retained offline source", candidatePath], ["promoted gameplay floor", profile.terrainGlbPath]]) {
      const subject = `${profile.stageId} ${role} (${terrainSourcePath})`;
      const absolutePath = join(ROOT, terrainSourcePath);
      assert.ok(existsSync(absolutePath), `${subject}: missing terrain GLB`);
      const bytes = readFileSync(absolutePath);
      assert.ok(bytes.length > 1024, `${subject}: terrain GLB is unexpectedly small`);
      hashes.add(createHash("sha256").update(bytes).digest("hex"));

      const glb = parseGlb(absolutePath, subject);
      const buffers = resolveBuffers(glb, subject);
      const instances = geometryEvidence(glb, buffers, subject);
      assert.ok(instances.some(({ triangles }) => triangles > 0), `${subject}: GLB has no rendered triangles`);
      const renderedTriangles = instances.reduce((total, { triangles }) => total + triangles, 0);
      assert.ok(Number.isFinite(renderedTriangles) && renderedTriangles > 0, `${subject}: offline mesh integrity must report finite, nonzero triangles`);
      assert.equal(
        instances.every(({ min, max }) => [...min, ...max].every(Number.isFinite)),
        true,
        `${subject}: offline mesh bounds must remain finite`,
      );
      assert.ok(
        (glb.json.materials ?? []).some(({ pbrMetallicRoughness }) => pbrMetallicRoughness?.baseColorTexture),
        `${subject}: GLB needs a base-color texture`,
      );
    }
  }

  assert.equal(hashes.size, profiles.length * 2, "every retained source and promoted floor must have distinct bytes");
});

test("the architecture-count gate rejects a copied low-detail proxy mutation", () => {
  const profile = STAGE_WORLD_PROFILES["abyss-chancel"];
  const terrainSourcePath = profile.terrainSourceCandidatePath;
  const sourcePath = join(ROOT, terrainSourcePath);
  const source = parseGlb(sourcePath, terrainSourcePath);
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
