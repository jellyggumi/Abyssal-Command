import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPOSITORY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../..",
);
const LIBRARY_PATH =
  "_workspace/current/engineering/asset-pipeline/character-motion-library";
const INDEX_PATH = `${LIBRARY_PATH}/handoff-index.json`;
const BUILDER_PATH =
  "_workspace/current/engineering/asset-pipeline/tools/build-character-motion-library-index.py";
const RUNTIME_LIBRARY_PATH = "assets/motion/ingame/characters";
const RIGHTS_RECEIPT_PATH = `${RUNTIME_LIBRARY_PATH}/rights-receipt.json`;
const REGISTRY_PATH = `${RUNTIME_LIBRARY_PATH}/registry.json`;
const MOTION_BENCH_PATH = "assets/motion/bench";

const ACTIONS = [
  "idle",
  "move",
  "run",
  "hit",
  "bighit",
  "attack",
  "critical",
  "avoid",
  "defence",
  "die",
  "show",
];

const OLDER_UNVERIFIED_ASSET_IDS = [
  "broken-court-monarch-boss",
  "broken-court-monarch-v04",
  "ember-cohort",
  "guard",
  "human-command-boss",
  "lantern-reaver",
];

const NEW_USER_ATTESTED_ASSET_IDS = [
  "possessed",
  "scout",
  "shade",
  "shadow-soldier-v04",
  "shadow-commander-boss",
];

const ASSET_IDS = [
  ...OLDER_UNVERIFIED_ASSET_IDS,
  ...NEW_USER_ATTESTED_ASSET_IDS,
];

// The single action promoted from an authored rig fallback instead of a
// retargeted motion-bench take.
const AUTHORED_FALLBACK_ACTION = "die";
const RETARGETED_ACTIONS = ACTIONS.filter(
  (action) => action !== AUTHORED_FALLBACK_ACTION,
);

const EXPECTED_MOTION_AUTHORITY = "derived-retargeted";
const EXPECTED_MOTION_LINEAGE = {
  authority: EXPECTED_MOTION_AUTHORITY,
  sourceRig: "mixamo-37",
  sourceLibrary: MOTION_BENCH_PATH,
  transformation: "retargeted-and-baked",
};

const EXPECTED_REGISTRY_COUNTS = {
  assets: ASSET_IDS.length,
  clips: ASSET_IDS.length * ACTIONS.length,
  retargetedClips: ASSET_IDS.length * RETARGETED_ACTIONS.length,
  authoredFallbackClips: ASSET_IDS.length,
};
const EXPECTED_REGISTRY_BYTES = 133242428;

// Provenance a retargeted clip must carry and an authored fallback must not:
// the fallback has no source frame range to cite.
const RETARGET_PROVENANCE_FIELDS = [
  "frameStart",
  "frameEnd",
  "sourceFps",
  "durationSeconds",
  "sourceRootTravel",
];

// Authoring-only fields the promotion step strips from runtime manifests.
const AUTHORING_ONLY_MANIFEST_FIELDS = [
  "generatedAt",
  "reviewBlend",
  "rigReport",
];

const COMPONENT_READERS = new Map([
  [5120, { bytes: 1, read: (buffer, offset) => buffer.readInt8(offset) }],
  [5121, { bytes: 1, read: (buffer, offset) => buffer.readUInt8(offset) }],
  [5122, { bytes: 2, read: (buffer, offset) => buffer.readInt16LE(offset) }],
  [5123, { bytes: 2, read: (buffer, offset) => buffer.readUInt16LE(offset) }],
  [5125, { bytes: 4, read: (buffer, offset) => buffer.readUInt32LE(offset) }],
  [5126, { bytes: 4, read: (buffer, offset) => buffer.readFloatLE(offset) }],
]);

const TYPE_COMPONENTS = new Map([
  ["SCALAR", 1],
  ["VEC2", 2],
  ["VEC3", 3],
  ["VEC4", 4],
  ["MAT2", 4],
  ["MAT3", 9],
  ["MAT4", 16],
]);

const hashCache = new Map();

function repositoryPath(repositoryRelativePath) {
  assert.equal(
    isAbsolute(repositoryRelativePath),
    false,
    `repository reference must be relative: ${repositoryRelativePath}`,
  );
  const absolutePath = resolve(REPOSITORY_ROOT, repositoryRelativePath);
  const fromRoot = relative(REPOSITORY_ROOT, absolutePath);
  assert.ok(
    fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`),
    `repository reference escapes the root: ${repositoryRelativePath}`,
  );
  return absolutePath;
}

function readJson(repositoryRelativePath) {
  return JSON.parse(readFileSync(repositoryPath(repositoryRelativePath), "utf8"));
}

function assertFile(repositoryRelativePath) {
  assert.ok(
    statSync(repositoryPath(repositoryRelativePath)).isFile(),
    `expected file: ${repositoryRelativePath}`,
  );
}

function fileBytes(repositoryRelativePath) {
  return statSync(repositoryPath(repositoryRelativePath)).size;
}

function sha256Fresh(repositoryRelativePath) {
  return createHash("sha256")
    .update(readFileSync(repositoryPath(repositoryRelativePath)))
    .digest("hex");
}

function sha256(repositoryRelativePath) {
  const absolutePath = repositoryPath(repositoryRelativePath);
  if (!hashCache.has(absolutePath)) {
    hashCache.set(absolutePath, sha256Fresh(repositoryRelativePath));
  }
  return hashCache.get(absolutePath);
}

function assertChecksum(repositoryRelativePath, expected) {
  assert.match(expected, /^[a-f0-9]{64}$/);
  assert.equal(
    sha256(repositoryRelativePath),
    expected,
    `checksum mismatch: ${repositoryRelativePath}`,
  );
}

// Mirrors the builder: an authored fallback cites a repository-root path, a
// retargeted clip cites a bare take name inside the motion bench.
function clipSourcePath(clip) {
  return clip.kind === "authored-fallback"
    ? clip.source
    : `${MOTION_BENCH_PATH}/${clip.source}`;
}

function listFilesRecursively(repositoryRelativeRoot) {
  const absoluteRoot = repositoryPath(repositoryRelativeRoot);
  const found = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const child = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(child);
        continue;
      }
      found.push(relative(absoluteRoot, child).split(sep).join("/"));
    }
  };
  walk(absoluteRoot);
  return found.sort();
}

function collectStrings(value, found = []) {
  if (typeof value === "string") {
    found.push(value);
  } else if (Array.isArray(value)) {
    for (const entry of value) collectStrings(entry, found);
  } else if (value && typeof value === "object") {
    for (const entry of Object.values(value)) collectStrings(entry, found);
  }
  return found;
}

function parseGlb(repositoryRelativePath) {
  const bytes = readFileSync(repositoryPath(repositoryRelativePath));
  assert.ok(bytes.length >= 20, `${repositoryRelativePath}: truncated GLB`);
  assert.equal(bytes.toString("ascii", 0, 4), "glTF");
  assert.equal(bytes.readUInt32LE(4), 2, `${repositoryRelativePath}: GLB version`);
  assert.equal(
    bytes.readUInt32LE(8),
    bytes.length,
    `${repositoryRelativePath}: declared byte length`,
  );

  const chunks = [];
  let offset = 12;
  while (offset < bytes.length) {
    assert.ok(offset + 8 <= bytes.length, `${repositoryRelativePath}: chunk header`);
    const byteLength = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + byteLength;
    assert.ok(end <= bytes.length, `${repositoryRelativePath}: chunk bounds`);
    chunks.push({ type, bytes: bytes.subarray(start, end) });
    offset = end;
  }
  assert.equal(offset, bytes.length, `${repositoryRelativePath}: chunk layout`);

  const jsonChunks = chunks.filter(({ type }) => type === 0x4e4f534a);
  const binaryChunks = chunks.filter(({ type }) => type === 0x004e4942);
  assert.equal(jsonChunks.length, 1, `${repositoryRelativePath}: JSON chunk count`);
  assert.equal(binaryChunks.length, 1, `${repositoryRelativePath}: BIN chunk count`);

  const document = JSON.parse(
    jsonChunks[0].bytes.toString("utf8").replace(/[\0\x20]+$/u, ""),
  );
  const binary = binaryChunks[0].bytes;
  assert.equal(document.buffers?.length, 1, `${repositoryRelativePath}: buffer count`);
  assert.equal(document.buffers[0].uri, undefined, `${repositoryRelativePath}: external buffer`);
  assert.ok(
    document.buffers[0].byteLength <= binary.length &&
      binary.length - document.buffers[0].byteLength < 4,
    `${repositoryRelativePath}: embedded buffer length`,
  );

  for (const [index, image] of (document.images ?? []).entries()) {
    assert.equal(image.uri, undefined, `${repositoryRelativePath}: external image ${index}`);
    assert.ok(
      Number.isInteger(image.bufferView) &&
        image.bufferView >= 0 &&
        image.bufferView < (document.bufferViews?.length ?? 0),
      `${repositoryRelativePath}: image ${index} bufferView`,
    );
  }

  return { document, binary, byteLength: bytes.length };
}

function readAccessor(document, binary, accessorIndex, label) {
  assert.ok(
    Number.isInteger(accessorIndex) &&
      accessorIndex >= 0 &&
      accessorIndex < (document.accessors?.length ?? 0),
    `${label}: accessor reference`,
  );
  const accessor = document.accessors[accessorIndex];
  assert.equal(accessor.sparse, undefined, `${label}: sparse accessor is not direct-loadable`);
  assert.ok(Number.isInteger(accessor.bufferView), `${label}: missing bufferView`);
  assert.ok(
    accessor.bufferView >= 0 &&
      accessor.bufferView < (document.bufferViews?.length ?? 0),
    `${label}: bufferView reference`,
  );

  const view = document.bufferViews[accessor.bufferView];
  assert.equal(view.buffer ?? 0, 0, `${label}: external buffer reference`);
  const component = COMPONENT_READERS.get(accessor.componentType);
  const components = TYPE_COMPONENTS.get(accessor.type);
  assert.ok(component, `${label}: component type ${accessor.componentType}`);
  assert.ok(components, `${label}: accessor type ${accessor.type}`);
  assert.ok(Number.isInteger(accessor.count) && accessor.count > 0, `${label}: count`);

  const elementBytes = component.bytes * components;
  const stride = view.byteStride ?? elementBytes;
  assert.ok(stride >= elementBytes, `${label}: byteStride`);
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const viewEnd = (view.byteOffset ?? 0) + view.byteLength;
  const payloadEnd = start + (accessor.count - 1) * stride + elementBytes;
  assert.ok(start >= (view.byteOffset ?? 0), `${label}: byteOffset`);
  assert.ok(payloadEnd <= viewEnd && payloadEnd <= binary.length, `${label}: payload bounds`);

  return Array.from({ length: accessor.count }, (_, rowIndex) => {
    const rowStart = start + rowIndex * stride;
    return Array.from({ length: components }, (_, componentIndex) =>
      component.read(binary, rowStart + componentIndex * component.bytes),
    );
  });
}

function expectedClipName(assetId, action) {
  return `${assetId}::${action}::v01`;
}

function runtimeManifestPath(assetId) {
  return `${RUNTIME_LIBRARY_PATH}/${assetId}/manifest.json`;
}

function runtimeModelPath(assetId) {
  return `${RUNTIME_LIBRARY_PATH}/${assetId}/model.glb`;
}

function authoringManifestPath(assetId) {
  return `${LIBRARY_PATH}/${assetId}/manifest.json`;
}

function registryEntry(registry, assetId) {
  const entry = registry.assets.find((candidate) => candidate.assetId === assetId);
  assert.ok(entry, `registry entry missing: ${assetId}`);
  return entry;
}

test("handoff index exposes the exact shipped runtime asset and action contract", () => {
  const index = readJson(INDEX_PATH);

  assert.equal(index.artifactStatus, "shipped-runtime-asset-library");
  assert.equal(index.shipped, true);
  assert.deepEqual(index.actionOrder, ACTIONS);
  assert.equal(index.sourceFps, 24);
  assert.equal(index.sourceRig, "mixamo-37");
  assert.equal(index.targetRig, "def-humanoid-v1");
  assert.deepEqual(index.loaderContract, {
    strategy: "replace-character-model",
    pathScope: "repository-root-local-runtime",
    modelContainsMeshSkinAndAnimations: true,
    clipLookup: "clipNames[actionId]",
    loopingActions: ["idle", "move", "run"],
    inPlaceRootMotion: true,
    shipped: true,
  });
  assert.equal(index.promotion.targetRoot, RUNTIME_LIBRARY_PATH);
  assert.deepEqual(index.promotion.requiredBeforeShipping, [
    "record-redistribution-rights-receipt",
    "copy-models-to-tracked-runtime-paths",
    "register-retained-runtime-assets",
    "regenerate-defense-asset-manifest",
    "run-browser-playable-verification",
  ]);
  assert.deepEqual(
    index.assets.map(({ assetId }) => assetId),
    ASSET_IDS,
  );

  assertFile(RIGHTS_RECEIPT_PATH);
  assertFile(REGISTRY_PATH);
  const rightsReceipt = readJson(RIGHTS_RECEIPT_PATH);
  assert.equal(rightsReceipt.source, index.rights.source);
  assert.equal(
    rightsReceipt.redistributionStatus,
    index.rights.redistributionStatus,
  );
  assert.deepEqual(rightsReceipt.attestationScope, index.rights.attestationScope);
  assert.equal(
    rightsReceipt.attestationEvidence,
    index.rights.attestationEvidence,
  );

  const registry = readJson(REGISTRY_PATH);
  assert.equal(registry.rightsReceipt, RIGHTS_RECEIPT_PATH);
  assert.deepEqual(
    registry.assets.map(({ assetId }) => assetId),
    ASSET_IDS,
  );

  const assetDirectories = readdirSync(repositoryPath(RUNTIME_LIBRARY_PATH), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(assetDirectories, [...ASSET_IDS].sort());

  for (const asset of index.assets) {
    assert.equal(asset.model, runtimeModelPath(asset.assetId));
    assert.equal(asset.manifest, runtimeManifestPath(asset.assetId));
    assert.deepEqual(Object.keys(asset.clipNames), ACTIONS);
    assert.deepEqual(Object.keys(asset.clips), ACTIONS);
    assert.equal(asset.runtimeEligible, true);

    const registeredAsset = registryEntry(registry, asset.assetId);
    assert.equal(registeredAsset.model, asset.model);
    assert.equal(registeredAsset.modelSha256, asset.modelSha256);
    assert.equal(registeredAsset.manifest, asset.manifest);
    assert.deepEqual(registeredAsset.clipNames, asset.clipNames);
    assert.equal(registeredAsset.role, asset.role);
    assert.equal(registeredAsset.category, asset.category);
    assert.equal(registeredAsset.replaces, asset.replaces);
    assert.equal(registeredAsset.runtimeEligible, true);
    assert.equal(registeredAsset.rightsReceipt, RIGHTS_RECEIPT_PATH);

    for (const action of ACTIONS) {
      const expectedName = expectedClipName(asset.assetId, action);
      assert.equal(asset.clipNames[action], expectedName);
      assert.equal(asset.clips[action].action, action);
      assert.equal(asset.clips[action].clipName, expectedName);
    }

    for (const reference of [
      asset.replaces,
      asset.model,
      asset.manifest,
      asset.reviewBlend,
      asset.contactSheet,
    ]) {
      assertFile(reference);
    }

    const manifest = readJson(asset.manifest);
    assert.equal(manifest.assetId, asset.assetId);
    assert.equal(manifest.source, asset.replaces);
    assert.equal(manifest.model, asset.model);
    assert.equal(manifest.modelSha256, asset.modelSha256);
    assert.deepEqual(manifest.rights, index.rights);
    assert.equal(manifest.rightsReceipt, RIGHTS_RECEIPT_PATH);
    assert.equal(manifest.runtimeEligible, true);
    assert.deepEqual(manifest.gateErrors, []);
    assert.deepEqual(Object.keys(manifest.clips), ACTIONS);
    assert.deepEqual(manifest.clipNames, asset.clipNames);

    assertFile(manifest.source);
    assertFile(manifest.model);
    assertChecksum(manifest.source, manifest.sourceSha256);
    assertChecksum(manifest.model, manifest.modelSha256);
    assert.equal(fileBytes(manifest.model), manifest.modelBytes);

    for (const action of ACTIONS) {
      const manifestClip = manifest.clips[action];
      assert.deepEqual(manifestClip, asset.clips[action]);
      assertChecksum(clipSourcePath(manifestClip), manifestClip.sourceSha256);
    }
  }
});

test("each indexed GLB is a self-contained skinned mesh with the exact rotation clips", () => {
  const index = readJson(INDEX_PATH);

  for (const asset of index.assets) {
    const { document, binary, byteLength } = parseGlb(asset.model);
    const nodes = document.nodes ?? [];
    const meshes = document.meshes ?? [];
    const skins = document.skins ?? [];
    const animations = document.animations ?? [];
    const expectedAnimations = ACTIONS.map((action) => asset.clipNames[action]);

    assert.ok(meshes.length > 0, `${asset.assetId}: mesh`);
    assert.ok(
      nodes.some(
        (node) =>
          Number.isInteger(node.mesh) && node.mesh >= 0 && node.mesh < meshes.length,
      ),
      `${asset.assetId}: mesh node reference`,
    );
    assert.equal(skins.length, 1, `${asset.assetId}: skin count`);
    assert.ok(skins[0].joints.length > 0, `${asset.assetId}: skin joints`);
    for (const nodeIndex of skins[0].joints) {
      assert.ok(
        Number.isInteger(nodeIndex) && nodeIndex >= 0 && nodeIndex < nodes.length,
        `${asset.assetId}: skin joint node reference`,
      );
    }
    if (skins[0].skeleton !== undefined) {
      assert.ok(
        Number.isInteger(skins[0].skeleton) &&
          skins[0].skeleton >= 0 &&
          skins[0].skeleton < nodes.length,
        `${asset.assetId}: skin skeleton node reference`,
      );
    }

    const animationNames = animations.map(({ name }) => name);
    assert.equal(animationNames.length, expectedAnimations.length);
    assert.equal(new Set(animationNames).size, expectedAnimations.length);
    assert.deepEqual([...animationNames].sort(), [...expectedAnimations].sort());

    // The manifest's self-reported validation must describe the binary that
    // actually shipped, not a stale earlier bake.
    const manifest = readJson(asset.manifest);
    assert.equal(byteLength, manifest.modelBytes, `${asset.assetId}: manifest modelBytes`);
    assert.deepEqual(
      [...manifest.validation.animationNames].sort(),
      [...animationNames].sort(),
      `${asset.assetId}: manifest validation animation names`,
    );
    assert.equal(manifest.validation.meshCount, meshes.length);
    assert.equal(manifest.validation.skinCount, skins.length);
    assert.deepEqual(
      [...manifest.validation.jointNames].sort(),
      skins[0].joints.map((nodeIndex) => nodes[nodeIndex].name).sort(),
      `${asset.assetId}: manifest validation joint names`,
    );
    assert.deepEqual(
      [...manifest.targetBoneNames].sort(),
      [...manifest.validation.jointNames].sort(),
      `${asset.assetId}: declared target bones`,
    );

    for (const animation of animations) {
      assert.ok(animation.channels.length > 0, `${animation.name}: channels`);
      assert.ok(animation.samplers.length > 0, `${animation.name}: samplers`);
      const targetPaths = new Set();

      for (const [channelIndex, channel] of animation.channels.entries()) {
        const label = `${asset.assetId}/${animation.name}/channel-${channelIndex}`;
        assert.ok(
          Number.isInteger(channel.sampler) &&
            channel.sampler >= 0 &&
            channel.sampler < animation.samplers.length,
          `${label}: sampler reference`,
        );
        assert.ok(
          Number.isInteger(channel.target?.node) &&
            channel.target.node >= 0 &&
            channel.target.node < nodes.length,
          `${label}: target node reference`,
        );
        targetPaths.add(channel.target.path);
        assert.equal(channel.target.path, "rotation", `${label}: target path`);

        const sampler = animation.samplers[channel.sampler];
        assert.equal(sampler.interpolation, "LINEAR", `${label}: interpolation`);
        const inputAccessor = document.accessors?.[sampler.input];
        const outputAccessor = document.accessors?.[sampler.output];
        assert.equal(inputAccessor?.type, "SCALAR", `${label}: input type`);
        assert.equal(inputAccessor?.componentType, 5126, `${label}: input component`);
        assert.equal(outputAccessor?.type, "VEC4", `${label}: output type`);
        assert.equal(outputAccessor?.componentType, 5126, `${label}: output component`);

        const times = readAccessor(document, binary, sampler.input, `${label}/input`);
        const rotations = readAccessor(
          document,
          binary,
          sampler.output,
          `${label}/output`,
        );
        assert.equal(rotations.length, times.length, `${label}: keyframe count`);
        assert.ok(
          times.every((row) => row.every(Number.isFinite)) &&
            rotations.every((row) => row.every(Number.isFinite)),
          `${label}: finite accessor payloads`,
        );
      }

      assert.deepEqual([...targetPaths], ["rotation"]);
      assert.equal(targetPaths.has("translation"), false);
      assert.equal(targetPaths.has("scale"), false);
    }
  }
});

test("one 64-hex generation revision is stamped across every shipped artifact", () => {
  const carriers = [
    { label: "handoff", payload: readJson(INDEX_PATH) },
    { label: "registry", payload: readJson(REGISTRY_PATH) },
    { label: "rights receipt", payload: readJson(RIGHTS_RECEIPT_PATH) },
    ...ASSET_IDS.map((assetId) => ({
      label: `${assetId} runtime manifest`,
      payload: readJson(runtimeManifestPath(assetId)),
    })),
  ];

  assert.equal(carriers.length, ASSET_IDS.length + 3);

  for (const { label, payload } of carriers) {
    assert.equal(
      Object.hasOwn(payload, "generationId"),
      true,
      `${label}: generationId is not stamped`,
    );
    assert.match(
      payload.generationId,
      /^[a-f0-9]{64}$/,
      `${label}: generationId is not a 64-hex revision`,
    );
    assert.equal(payload.generatedBy, BUILDER_PATH, `${label}: generatedBy`);
    assert.equal(payload.schemaVersion, 1, `${label}: schemaVersion`);
  }

  const revisions = new Set(carriers.map(({ payload }) => payload.generationId));
  assert.equal(
    revisions.size,
    1,
    `shipped artifacts disagree on the content revision: ${[...revisions].join(", ")}`,
  );
});

test("the builder revalidates the shipped tree and reproduces the stamped revision without writing", () => {
  const trackedArtifacts = [
    INDEX_PATH,
    REGISTRY_PATH,
    RIGHTS_RECEIPT_PATH,
    ...ASSET_IDS.map(runtimeManifestPath),
    ...ASSET_IDS.map(runtimeModelPath),
  ];
  const digestsBefore = trackedArtifacts.map(sha256Fresh);

  let stdout;
  try {
    stdout = execFileSync("python3", [repositoryPath(BUILDER_PATH), "--check"], {
      cwd: tmpdir(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    assert.fail(
      `builder --check rejected the shipped tree: ${error.stderr || error.message}`,
    );
  }

  const summary = JSON.parse(stdout.trim());
  const registry = readJson(REGISTRY_PATH);
  const registeredBytes = registry.assets.reduce(
    (total, asset) => total + asset.bytes,
    0,
  );
  assert.equal(summary.mode, "check");
  assert.equal(summary.handoffIndex, INDEX_PATH);
  assert.equal(summary.assetCount, EXPECTED_REGISTRY_COUNTS.assets);
  assert.equal(summary.clipCount, EXPECTED_REGISTRY_COUNTS.clips);
  assert.equal(summary.totalBytes, registeredBytes);

  // The shipped revision must be what the builder recomputes from the current
  // config and staged inputs -- a stale stamp fails here.
  assert.equal(summary.generationId, readJson(INDEX_PATH).generationId);
  assert.equal(summary.generationId, readJson(REGISTRY_PATH).generationId);

  assert.deepEqual(
    trackedArtifacts.map(sha256Fresh),
    digestsBefore,
    "--check must not rewrite shipped artifacts",
  );
});

test("derived-retargeted authority and lineage are declared identically by every carrier", () => {
  const index = readJson(INDEX_PATH);
  const registry = readJson(REGISTRY_PATH);
  const rightsReceipt = readJson(RIGHTS_RECEIPT_PATH);

  assert.deepEqual(index.motionLineage, EXPECTED_MOTION_LINEAGE);
  assert.deepEqual(rightsReceipt.motionLineage, EXPECTED_MOTION_LINEAGE);
  assert.deepEqual(registry.motionLineage, EXPECTED_MOTION_LINEAGE);
  assert.equal(registry.motionAuthority, EXPECTED_MOTION_AUTHORITY);

  // The lineage must agree with the rig contract the handoff publishes.
  assert.equal(index.motionLineage.sourceRig, index.sourceRig);
  assert.equal(index.motionLineage.sourceLibrary, MOTION_BENCH_PATH);
  assert.ok(
    statSync(repositoryPath(index.motionLineage.sourceLibrary)).isDirectory(),
    "lineage sourceLibrary must be the motion bench directory",
  );

  for (const assetId of ASSET_IDS) {
    const manifest = readJson(runtimeManifestPath(assetId));
    assert.equal(manifest.motionAuthority, EXPECTED_MOTION_AUTHORITY, assetId);
    assert.deepEqual(manifest.motionLineage, EXPECTED_MOTION_LINEAGE, assetId);
    assert.equal(manifest.sourceRig, EXPECTED_MOTION_LINEAGE.sourceRig, assetId);
    assert.equal(
      registryEntry(registry, assetId).motionAuthority,
      EXPECTED_MOTION_AUTHORITY,
      assetId,
    );
  }
});

test("registry counts match the entries, the clip kinds, and the bytes on disk", () => {
  const registry = readJson(REGISTRY_PATH);

  assert.deepEqual(
    {
      assets: registry.counts.assets,
      clips: registry.counts.clips,
      retargetedClips: registry.counts.retargetedClips,
      authoredFallbackClips: registry.counts.authoredFallbackClips,
    },
    EXPECTED_REGISTRY_COUNTS,
  );
  assert.equal(registry.counts.bytes, EXPECTED_REGISTRY_BYTES, "counts.bytes must match exact registry bytes");
  assert.equal(registry.assets.length, registry.counts.assets);
  assert.equal(
    registry.counts.clips,
    registry.counts.assets * ACTIONS.length,
    "clip count must be every action of every asset",
  );
  assert.equal(
    registry.counts.retargetedClips + registry.counts.authoredFallbackClips,
    registry.counts.clips,
    "every clip must be either retargeted or an authored fallback",
  );

  const observedKinds = registry.assets.flatMap((entry) =>
    Object.values(entry.clipKinds),
  );
  assert.equal(
    observedKinds.filter((kind) => kind === "retargeted").length,
    registry.counts.retargetedClips,
  );
  assert.equal(
    observedKinds.filter((kind) => kind === "authored-fallback").length,
    registry.counts.authoredFallbackClips,
  );

  let summedBytes = 0;
  for (const entry of registry.assets) {
    const onDisk = fileBytes(entry.model);
    const manifest = readJson(entry.manifest);
    assert.equal(entry.bytes, onDisk, `${entry.assetId}: registry bytes vs model on disk`);
    assert.equal(manifest.modelBytes, onDisk, `${entry.assetId}: manifest bytes vs model`);
    assertChecksum(entry.model, entry.modelSha256);
    summedBytes += entry.bytes;
  }
  assert.equal(summedBytes, registry.counts.bytes, "counts.bytes must sum the entries");
});

test("every registry entry declares clipKinds with an authored-fallback die and ten retargeted clips", () => {
  const registry = readJson(REGISTRY_PATH);

  for (const assetId of ASSET_IDS) {
    const entry = registryEntry(registry, assetId);
    const manifest = readJson(runtimeManifestPath(assetId));

    assert.deepEqual(
      Object.keys(entry.clipKinds),
      ACTIONS,
      `${assetId}: clipKinds must cover every action in action order`,
    );
    assert.equal(
      entry.clipKinds[AUTHORED_FALLBACK_ACTION],
      "authored-fallback",
      `${assetId}: ${AUTHORED_FALLBACK_ACTION} must be the authored fallback`,
    );
    for (const action of RETARGETED_ACTIONS) {
      assert.equal(
        entry.clipKinds[action],
        "retargeted",
        `${assetId}/${action}: expected a retargeted clip kind`,
      );
    }

    // The registry kind is derived from the manifest clip, defaulting to
    // retargeted when the clip declares no kind.
    for (const action of ACTIONS) {
      const clip = manifest.clips[action];
      assert.equal(
        entry.clipKinds[action],
        clip.kind ?? "retargeted",
        `${assetId}/${action}: registry kind must derive from the manifest clip`,
      );
    }

    const fallbackClip = manifest.clips[AUTHORED_FALLBACK_ACTION];
    assert.equal(fallbackClip.kind, "authored-fallback");
    assert.equal(fallbackClip.loop, false);
    assert.equal(
      fallbackClip.source.startsWith(`${MOTION_BENCH_PATH}/`),
      false,
      "the authored fallback must not claim a motion-bench take",
    );
    assertFile(fallbackClip.source);
    assertChecksum(fallbackClip.source, fallbackClip.sourceSha256);
    for (const field of RETARGET_PROVENANCE_FIELDS) {
      assert.equal(
        Object.hasOwn(fallbackClip, field),
        false,
        `${assetId}: authored fallback must not claim retarget provenance (${field})`,
      );
    }

    for (const action of RETARGETED_ACTIONS) {
      const clip = manifest.clips[action];
      assert.equal(
        Object.hasOwn(clip, "kind"),
        false,
        `${assetId}/${action}: retargeted clips carry no kind override`,
      );
      assert.equal(
        clip.source.includes("/"),
        false,
        `${assetId}/${action}: retargeted source must be a bare motion-bench take`,
      );
      for (const field of RETARGET_PROVENANCE_FIELDS) {
        assert.equal(
          Object.hasOwn(clip, field),
          true,
          `${assetId}/${action}: missing retarget provenance (${field})`,
        );
      }
      assert.equal(clip.sourceFps, 24, `${assetId}/${action}: source fps`);
      assert.ok(
        Number.isInteger(clip.frameStart) &&
          Number.isInteger(clip.frameEnd) &&
          clip.frameEnd > clip.frameStart,
        `${assetId}/${action}: frame range`,
      );
      assert.ok(
        Number.isFinite(clip.durationSeconds) && clip.durationSeconds > 0,
        `${assetId}/${action}: duration`,
      );
      assertFile(clipSourcePath(clip));
    }
  }
});
test("authoring rig-report manifests are completed, natural, and free of legacy fields", () => {
  for (const assetId of ASSET_IDS) {
    const authoringManifest = readJson(authoringManifestPath(assetId));
    assertFile(authoringManifest.rigReport);
    const rigReport = readJson(authoringManifest.rigReport);

    assert.equal(rigReport.status, "completed", `${assetId}: rig report status`);
    assert.equal(rigReport.restPose, "natural", `${assetId}: rig report restPose`);
    assert.equal(rigReport.restPoseOk, true, `${assetId}: rig report restPoseOk`);
    assert.equal(Object.hasOwn(rigReport, "tposeOk"), false, `${assetId}: legacy tposeOk removed`);
  }
});
test("runtime manifests preserve older unverified rights and newly user-attested rights", () => {

  const receipt = readJson(RIGHTS_RECEIPT_PATH);
  assert.equal(receipt.redistributionStatus, "user-attested");
  assert.deepEqual(
    receipt.sourceAssetRedistributionStatuses,
    ["user-attested"],
  );

  for (const assetId of ASSET_IDS) {
    const runtimeManifest = readJson(runtimeManifestPath(assetId));
    const authoringManifest = readJson(authoringManifestPath(assetId));
    const sourceRightsStatus = "user-attested";
    const rigReport = readJson(authoringManifest.rigReport);

    assert.equal(rigReport.restPose, "natural", `${assetId}: rig report should be natural`);
    assert.equal(rigReport.restPoseOk, true, `${assetId}: rig report should be accepted as natural`);
    assertFile(authoringManifest.rigReport);

    for (const field of AUTHORING_ONLY_MANIFEST_FIELDS) {
      assert.equal(
        Object.hasOwn(authoringManifest, field),
        true,
        `${assetId}: authoring manifest should still carry ${field}`,
      );
      assert.equal(
        Object.hasOwn(runtimeManifest, field),
        false,
        `${assetId}: runtime manifest must omit authoring-only ${field}`,
      );
    }

    assert.equal(
      runtimeManifest.sourceAssetRights.redistributionStatus,
      sourceRightsStatus,
      `${assetId}: source redistribution status`,
    );
    assert.equal(
      authoringManifest.rights.redistributionStatus,
      sourceRightsStatus,
      `${assetId}: authoring manifest rights`,
    );
    assert.deepEqual(
      runtimeManifest.sourceAssetRights,
      authoringManifest.rights,
      `${assetId}: source rights must be carried over verbatim`,
    );
    assert.equal(runtimeManifest.rights.redistributionStatus, "user-attested");

    if (sourceRightsStatus === "unverified") {
      assert.notEqual(
        runtimeManifest.rights.redistributionStatus,
        runtimeManifest.sourceAssetRights.redistributionStatus,
        `${assetId}: published attestation must remain distinct from older source rights`,
      );
    } else {
      assert.equal(
        runtimeManifest.rights.redistributionStatus,
        runtimeManifest.sourceAssetRights.redistributionStatus,
        `${assetId}: newly attested source rights must remain user-attested`,
      );
    }

    assert.deepEqual(runtimeManifest.rights, {
      source: receipt.source,
      runtimeUseDirectedAt: receipt.runtimeUseDirectedAt,
      redistributionStatus: receipt.redistributionStatus,
      attestedBy: receipt.attestedBy,
      attestedAt: receipt.attestedAt,
      attestationScope: receipt.attestationScope,
      attestationEvidence: receipt.attestationEvidence,
    });

    assert.equal(runtimeManifest.rightsReceipt, RIGHTS_RECEIPT_PATH);
    assertFile(runtimeManifest.rightsReceipt);
    assert.equal(runtimeManifest.inPlaceRootMotion, true);

    // Nothing but the generator provenance may point runtime consumers back
    // into the untracked authoring workspace.
    const leaked = collectStrings({ ...runtimeManifest, generatedBy: undefined })
      .filter((value) => value.includes("_workspace/"));
    assert.deepEqual(leaked, [], `${assetId}: authoring paths leaked into runtime manifest`);
  }

  const registryLeaks = collectStrings({
    ...readJson(REGISTRY_PATH),
    generatedBy: undefined,
  }).filter((value) => value.includes("_workspace/"));
  assert.deepEqual(registryLeaks, [], "authoring paths leaked into the registry");
});

test("the promoted runtime tree is closed to exactly the declared files", () => {
  const registry = readJson(REGISTRY_PATH);
  const declared = new Set([
    "registry.json",
    "rights-receipt.json",
    ...registry.assets.flatMap((entry) => [
      `${entry.assetId}/model.glb`,
      `${entry.assetId}/manifest.json`,
    ]),
  ]);
  assert.equal(declared.size, 2 + ASSET_IDS.length * 2);

  const present = listFilesRecursively(RUNTIME_LIBRARY_PATH);
  assert.deepEqual(
    present,
    [...declared].sort(),
    "runtime tree must hold exactly the declared registry, receipt, models, and manifests",
  );

  // The builder's own closure check ignores dot-prefixed names, so a crashed
  // promotion could strand a temporary model that only this assertion catches.
  assert.deepEqual(
    present.filter((entry) => entry.split("/").some((part) => part.startsWith("."))),
    [],
    "no temporary or hidden files may remain in the runtime tree",
  );
});

test("runtime artifacts reference only contained, repository-relative files that exist", () => {
  const registry = readJson(REGISTRY_PATH);
  const references = new Set([registry.rightsReceipt]);

  for (const entry of registry.assets) {
    references.add(entry.model);
    references.add(entry.manifest);
    references.add(entry.replaces);
    references.add(entry.rightsReceipt);

    const manifest = readJson(entry.manifest);
    references.add(manifest.model);
    references.add(manifest.source);
    references.add(manifest.rightsReceipt);
    for (const action of ACTIONS) {
      references.add(clipSourcePath(manifest.clips[action]));
    }
  }

  assert.ok(references.size > 0);
  for (const reference of references) {
    assert.equal(isAbsolute(reference), false, `absolute reference: ${reference}`);
    assert.equal(
      reference.split("/").includes(".."),
      false,
      `escaping reference: ${reference}`,
    );
    assertFile(reference);
  }
});

test("runtime manifest gates are nonempty and exactly true", () => {
  for (const assetId of ASSET_IDS) {
    const manifest = readJson(runtimeManifestPath(assetId));
    const checks = manifest.checks;
    const validationChecks = manifest.validation.checks;

    assert.ok(
      checks && typeof checks === "object" && Object.keys(checks).length > 0,
      `${assetId}: manifest declares no gate checks`,
    );
    for (const [name, value] of Object.entries(checks)) {
      assert.equal(value, true, `${assetId}: check ${name} is not exactly true`);
    }

    assert.ok(
      validationChecks && Object.keys(validationChecks).length > 0,
      `${assetId}: validation declares no checks`,
    );
    for (const [name, value] of Object.entries(validationChecks)) {
      assert.equal(value, true, `${assetId}: validation check ${name} is not exactly true`);
      assert.equal(
        Object.hasOwn(checks, name),
        true,
        `${assetId}: validation check ${name} is absent from the gate summary`,
      );
      assert.equal(
        checks[name],
        value,
        `${assetId}: gate summary contradicts validation for ${name}`,
      );
    }

    assert.deepEqual(manifest.gateErrors, [], `${assetId}: gate errors`);
    assert.equal(manifest.runtimeEligible, true, `${assetId}: runtimeEligible`);
  }
});

test("reachability is declared consistently and matches its catalog binding shape", () => {
  const index = readJson(INDEX_PATH);
  const registry = readJson(REGISTRY_PATH);

  for (const asset of index.assets) {
    const { assetId, reachability } = asset;
    const manifest = readJson(runtimeManifestPath(assetId));
    const entry = registryEntry(registry, assetId);

    assert.deepEqual(manifest.reachability, reachability, `${assetId}: manifest reachability`);
    assert.ok(
      ["library-only", "catalog-bound"].includes(reachability.runtimeReachability),
      `${assetId}: unknown reachability ${reachability.runtimeReachability}`,
    );

    // The registry flattens reachability onto the entry rather than nesting it.
    assert.equal(entry.runtimeReachability, reachability.runtimeReachability, assetId);
    assert.equal(entry.reachability, undefined, `${assetId}: registry must flatten reachability`);
    assert.deepEqual(entry.entity, reachability.entity, `${assetId}: registry entity`);

    if (assetId === "human-command-boss") {
      assert.equal(
        reachability.runtimeReachability,
        "catalog-bound",
        `${assetId}: human-command-boss must be catalog-bound`,
      );
      assert.equal(
        reachability.entity.id,
        "commander",
        `${assetId}: human-command-boss must bind to commander`,
      );
    }

    if (assetId === "guard") {
      assert.equal(
        reachability.runtimeReachability,
        "library-only",
        `${assetId}: guard must remain library-only`,
      );
    }

    if (assetId === "shadow-soldier-v04") {
      assert.equal(
        reachability.runtimeReachability,
        "catalog-bound",
        `${assetId}: shadow-soldier-v04 must remain catalog-bound`,
      );
      if (Object.hasOwn(reachability.entity, "id")) {
        assert.equal(
          reachability.entity.id,
          "guardian",
          `${assetId}: shadow-soldier-v04 must bind to guardian`,
        );
      } else {
        assert.equal(
          reachability.entity.kind,
          "guardian",
          `${assetId}: shadow-soldier-v04 must bind to guardian`,
        );
      }
    }

    if (reachability.runtimeReachability === "catalog-bound") {
      assert.equal(Object.hasOwn(reachability, "entity"), true, `${assetId}: catalog-bound assets must claim a catalog entity`);
      if (
        Object.hasOwn(reachability.entity, "id") ||
        Object.hasOwn(reachability.entity, "companionId")
      ) {
        if (Object.hasOwn(reachability.entity, "id")) {
          assert.equal(
            typeof reachability.entity.id,
            "string",
            `${assetId}: catalog-bound assets must provide an entity id as a string`,
          );
          assert.ok(
            reachability.entity.id.length > 0,
            `${assetId}: catalog-bound assets must provide a non-empty entity id`,
          );
        }

        if (Object.hasOwn(reachability.entity, "companionId")) {
          assert.equal(
            typeof reachability.entity.companionId,
            "string",
            `${assetId}: catalog-bound assets must provide a companionId as a string`,
          );
          assert.ok(
            reachability.entity.companionId.length > 0,
            `${assetId}: catalog-bound assets must provide a non-empty companionId`,
          );
        }
      } else if (Object.hasOwn(reachability.entity, "kind")) {
        assert.equal(
          typeof reachability.entity.kind,
          "string",
          `${assetId}: catalog-bound assets that declare only kind must use a string`,
        );
        assert.ok(
          reachability.entity.kind.length > 0,
          `${assetId}: catalog-bound assets with only kind must provide a non-empty kind`,
        );
      } else {
        assert.fail(
          `${assetId}: catalog-bound assets must provide id, companionId, or kind`,
        );
      }

      if (Object.hasOwn(reachability.entity, "kind")) {
        assert.equal(
          typeof reachability.entity.kind,
          "string",
          `${assetId}: catalog-bound assets that declare kind must use a string`,
        );
        assert.ok(
          reachability.entity.kind.length > 0,
          `${assetId}: catalog-bound assets with kind must provide a non-empty kind`,
        );
      }
    } else {
      assert.equal(
        Object.hasOwn(reachability, "entity"),
        false,
        `${assetId}: library-only assets must not claim a catalog entity`,
      );
    }
  }
});
