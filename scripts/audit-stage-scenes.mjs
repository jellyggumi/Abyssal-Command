#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = '_workspace/20260726-stage1b-cinder-pressure-agency/engineering/stage-scene-audit.json';
const CATALOG_PATH = 'stage-world-catalog.js';
const ALL_MESH_PROVENANCE_PATH = '_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline/all-mesh-texture-candidates-v2/audit.json';
const TERRAIN_PROVENANCE_PATH = 'assets/images/battle/glb/terrain/build-provenance.json';
const CHARACTER_PROVENANCE_PATH = 'assets/images/battle/glb/character-build-provenance.json';
const RUNTIME_REGISTRY_PATH = 'scripts/defense-runtime-assets.mjs';
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function issue(code, path, message) {
  return { code, path, message };
}

function finiteVector(value, length) {
  return Array.isArray(value) && value.length === length && value.every(Number.isFinite);
}

function decodeDataUri(uri) {
  const match = /^data:([^,]*?),(.*)$/s.exec(uri);
  if (!match) throw new Error('malformed data URI');
  return match[1].endsWith(';base64')
    ? Buffer.from(match[2], 'base64')
    : Buffer.from(decodeURIComponent(match[2]), 'utf8');
}

function readReferencedBytes(uri, containingPath) {
  if (typeof uri !== 'string') throw new Error('URI is not a string');
  if (uri.includes('_workspace')) throw new Error('runtime asset references the candidate workspace');
  if (uri.startsWith('data:')) return decodeDataUri(uri);
  const target = resolve(dirname(containingPath), decodeURIComponent(uri));
  return readFileSync(target);
}

function textureSources(texture) {
  return [
    texture?.source,
    texture?.extensions?.KHR_texture_basisu?.source,
    texture?.extensions?.EXT_texture_webp?.source,
  ].filter((value) => Number.isInteger(value));
}

function parseGlb(assetPath) {
  const absolutePath = resolve(ROOT, assetPath);
  const bytes = readFileSync(absolutePath);
  if (bytes.length < 20) throw new Error('file is shorter than a GLB header and JSON chunk header');
  if (bytes.readUInt32LE(0) !== 0x46546c67) throw new Error('invalid GLB magic');
  const version = bytes.readUInt32LE(4);
  if (version !== 2) throw new Error(`unsupported GLB version ${version}`);
  const declaredLength = bytes.readUInt32LE(8);
  if (declaredLength !== bytes.length) throw new Error(`declared length ${declaredLength} differs from file length ${bytes.length}`);

  const chunks = [];
  let offset = 12;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new Error('truncated GLB chunk header');
    const byteLength = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + byteLength;
    if (end > bytes.length) throw new Error('GLB chunk exceeds declared file length');
    chunks.push({ type, bytes: bytes.subarray(start, end) });
    offset = end;
  }
  if (offset !== bytes.length) throw new Error('GLB chunks do not cover the declared file length');
  if (chunks.length === 0 || chunks[0].type !== JSON_CHUNK) throw new Error('first GLB chunk is not JSON');
  if (chunks.filter(({ type }) => type === JSON_CHUNK).length !== 1) throw new Error('GLB must contain exactly one JSON chunk');

  const json = JSON.parse(chunks[0].bytes.toString('utf8').replace(/[\u0000 ]+$/u, ''));
  if (json?.asset?.version !== '2.0') throw new Error(`glTF asset version is ${String(json?.asset?.version)}`);
  const binary = chunks.find(({ type }) => type === BIN_CHUNK)?.bytes ?? null;
  return { absolutePath, bytes, json, binary, version };
}

function normalizeProvenanceRecords(allMeshAudit, terrainBuildProvenance, characterBuildProvenance) {
  const allMeshByRelativePath = new Map((allMeshAudit.rows ?? []).map((row) => [
    row.relativePath,
    {
      auditPath: ALL_MESH_PROVENANCE_PATH,
      outputSha256: row.outputSha256,
      valid: row.status === 'ok'
        && row.checks
        && Object.values(row.checks).every((value) => value === true),
      report: {
        auditPath: ALL_MESH_PROVENANCE_PATH,
        candidateRelativePath: row.relativePath,
        sourceSha256: row.sourceSha256,
        verifiedOutputSha256: row.outputSha256,
        auditStatus: row.status,
      },
    },
  ]));
  const terrainByOutputPath = new Map(Object.values(terrainBuildProvenance.stages ?? {}).map((stage) => [
    stage.outputPath,
    {
      auditPath: TERRAIN_PROVENANCE_PATH,
      outputSha256: stage.outputSha256,
      valid: typeof stage.outputPath === 'string' && typeof stage.outputSha256 === 'string',
      report: {
        auditPath: TERRAIN_PROVENANCE_PATH,
        outputPath: stage.outputPath,
        verifiedOutputSha256: stage.outputSha256,
      },
    },
  ]));
  // Characters that were re-rigged and re-authored no longer come out of the
  // texture pass, so -- exactly like terrain -- they carry their own build
  // record and are verified against it instead.
  const characterByOutputPath = new Map(Object.values(characterBuildProvenance.assets ?? {}).map((asset) => [
    asset.outputPath,
    {
      auditPath: CHARACTER_PROVENANCE_PATH,
      outputSha256: asset.outputSha256,
      valid: typeof asset.outputPath === 'string' && typeof asset.outputSha256 === 'string',
      report: {
        auditPath: CHARACTER_PROVENANCE_PATH,
        outputPath: asset.outputPath,
        sourceCandidatePath: asset.sourceCandidatePath,
        verifiedOutputSha256: asset.outputSha256,
      },
    },
  ]));
  return { allMeshByRelativePath, terrainByOutputPath, characterByOutputPath };
}

function auditGlb(assetPath, retainedPaths, provenanceRecords) {
  const errors = [];
  const checks = {
    exists: existsSync(resolve(ROOT, assetPath)),
    retainedRuntimeAsset: retainedPaths.has(assetPath),
    readableGlb2: false,
    buffersReadable: false,
    imagesReadable: false,
    allPrimitivesHavePosition: false,
    allPrimitivesHaveUv0: false,
    allPrimitivesHaveNormals: false,
    allPrimitivesHaveTexturedMaterials: false,
    accessorBoundsComplete: false,
    nonDegenerateBounds: false,
    verifiedProvenanceMatch: false,
  };
  if (!checks.exists) {
    errors.push(issue('runtime_asset_missing', assetPath, 'referenced runtime asset does not exist'));
    return { path: assetPath, checks, issues: errors, ok: false };
  }
  if (!checks.retainedRuntimeAsset) {
    errors.push(issue('runtime_asset_not_retained', assetPath, 'referenced asset is absent from RETAINED_ASSET_PATHS'));
  }

  let glb;
  try {
    glb = parseGlb(assetPath);
    checks.readableGlb2 = true;
  } catch (error) {
    errors.push(issue('glb_unreadable', assetPath, error.message));
    return { path: assetPath, bytes: statSync(resolve(ROOT, assetPath)).size, checks, issues: errors, ok: false };
  }

  const { json } = glb;
  const accessors = json.accessors ?? [];
  const bufferViews = json.bufferViews ?? [];
  const buffers = json.buffers ?? [];
  const images = json.images ?? [];
  const textures = json.textures ?? [];
  const materials = json.materials ?? [];
  const primitives = (json.meshes ?? []).flatMap((mesh) => mesh.primitives ?? []);
  const resolvedBuffers = [];

  try {
    for (let index = 0; index < buffers.length; index += 1) {
      const buffer = buffers[index];
      let resolved;
      if (buffer.uri === undefined) {
        if (index !== 0 || !glb.binary) throw new Error(`buffer ${index} has no readable GLB binary chunk`);
        resolved = glb.binary;
      } else {
        resolved = readReferencedBytes(buffer.uri, glb.absolutePath);
      }
      if (!Number.isInteger(buffer.byteLength) || resolved.length < buffer.byteLength) {
        throw new Error(`buffer ${index} is shorter than its declared byteLength`);
      }
      resolvedBuffers.push(resolved);
    }
    checks.buffersReadable = true;
  } catch (error) {
    errors.push(issue('glb_buffer_unreadable', assetPath, error.message));
  }

  try {
    for (let index = 0; index < images.length; index += 1) {
      const image = images[index];
      let imageBytes;
      if (image.uri !== undefined) {
        imageBytes = readReferencedBytes(image.uri, glb.absolutePath);
      } else {
        const view = bufferViews[image.bufferView];
        if (!view || !Number.isInteger(view.byteLength)) throw new Error(`image ${index} has no readable bufferView`);
        const buffer = resolvedBuffers[view.buffer ?? 0];
        const start = view.byteOffset ?? 0;
        const end = start + view.byteLength;
        if (!buffer || start < 0 || end > buffer.length) throw new Error(`image ${index} bufferView exceeds its buffer`);
        imageBytes = buffer.subarray(start, end);
      }
      if (imageBytes.length === 0) throw new Error(`image ${index} is empty`);
    }
    checks.imagesReadable = images.length > 0;
  } catch (error) {
    errors.push(issue('glb_image_unreadable', assetPath, error.message));
  }

  const validAccessor = (value) => Number.isInteger(value) && value >= 0 && value < accessors.length;
  const validMaterial = (value) => Number.isInteger(value) && value >= 0 && value < materials.length;
  const validTexture = (value) => Number.isInteger(value) && value >= 0 && value < textures.length;
  const validImage = (value) => Number.isInteger(value) && value >= 0 && value < images.length;
  checks.allPrimitivesHavePosition = primitives.length > 0 && primitives.every((primitive) => validAccessor(primitive.attributes?.POSITION));
  checks.allPrimitivesHaveUv0 = primitives.length > 0 && primitives.every((primitive) => validAccessor(primitive.attributes?.TEXCOORD_0));
  checks.allPrimitivesHaveNormals = primitives.length > 0 && primitives.every((primitive) => validAccessor(primitive.attributes?.NORMAL));
  checks.allPrimitivesHaveTexturedMaterials = primitives.length > 0 && primitives.every((primitive) => {
    if (!validMaterial(primitive.material)) return false;
    const material = materials[primitive.material];
    const baseTexture = material?.pbrMetallicRoughness?.baseColorTexture?.index;
    const normalTexture = material?.normalTexture?.index;
    if (!validTexture(baseTexture) || !validTexture(normalTexture)) return false;
    return [baseTexture, normalTexture].every((textureIndex) => {
      const sources = textureSources(textures[textureIndex]);
      return sources.length > 0 && sources.every(validImage);
    });
  });

  const positionAccessors = primitives
    .map((primitive) => accessors[primitive.attributes?.POSITION])
    .filter(Boolean);
  checks.accessorBoundsComplete = positionAccessors.length === primitives.length
    && positionAccessors.every((accessor) => accessor.type === 'VEC3'
      && finiteVector(accessor.min, 3)
      && finiteVector(accessor.max, 3)
      && accessor.min.every((value, index) => value <= accessor.max[index]));
  let bounds = null;
  if (checks.accessorBoundsComplete) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const accessor of positionAccessors) {
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], accessor.min[axis]);
        max[axis] = Math.max(max[axis], accessor.max[axis]);
      }
    }
    const size = max.map((value, axis) => value - min[axis]);
    checks.nonDegenerateBounds = size.some((value) => value > 0);
    bounds = { min, max, size };
  }

  for (const [name, passed] of Object.entries(checks)) {
    if (!passed && !['verifiedProvenanceMatch'].includes(name)) {
      errors.push(issue(`glb_${name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}`, assetPath, `structural check failed: ${name}`));
    }
  }

  const isTerrainAsset = assetPath.startsWith('assets/images/battle/glb/terrain/');
  const relativeGlbPath = assetPath.split('/glb/')[1];
  // A promoted character owns its build record; everything else still answers
  // to the texture pass that produced it.
  const characterProvenance = provenanceRecords.characterByOutputPath.get(assetPath);
  const provenance = isTerrainAsset
    ? provenanceRecords.terrainByOutputPath.get(assetPath)
    : (characterProvenance ?? provenanceRecords.allMeshByRelativePath.get(relativeGlbPath));
  const runtimeSha256 = sha256(glb.bytes);
  checks.verifiedProvenanceMatch = provenance?.valid === true
    && provenance.outputSha256 === runtimeSha256;
  if (!checks.verifiedProvenanceMatch) {
    const requirement = isTerrainAsset || characterProvenance
      ? 'the outputSha256 for its exact outputPath'
      : 'an all-green row for its relative GLB path';
    const auditPath = isTerrainAsset
      ? TERRAIN_PROVENANCE_PATH
      : (characterProvenance ? CHARACTER_PROVENANCE_PATH : ALL_MESH_PROVENANCE_PATH);
    errors.push(issue('provenance_mismatch', assetPath, `runtime SHA-256 does not match ${requirement} in ${auditPath}`));
  }

  errors.sort((left, right) => left.code.localeCompare(right.code));
  return {
    path: assetPath,
    bytes: glb.bytes.length,
    sha256: runtimeSha256,
    gltfVersion: json.asset.version,
    structure: {
      nodes: (json.nodes ?? []).length,
      meshes: (json.meshes ?? []).length,
      primitives: primitives.length,
      materials: materials.length,
      textures: textures.length,
      images: images.length,
      accessorBounds: bounds,
    },
    provenance: provenance?.report ?? null,
    checks,
    issues: errors,
    ok: errors.length === 0,
  };
}

function inside(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function auditPlacement(stage) {
  const errors = [];
  const bounds = stage?.gameplay?.bounds;
  const obstacles = stage?.gameplay?.obstacles ?? [];
  const surfaces = stage?.gameplay?.surfaces ?? [];
  const props = stage?.presentation?.props ?? [];
  const npcs = stage?.presentation?.npcs ?? [];
  const boundsValid = bounds && [bounds.minX, bounds.maxX, bounds.minY, bounds.maxY].every(Number.isFinite)
    && bounds.minX < bounds.maxX && bounds.minY < bounds.maxY;
  const pointInside = ({ x, y } = {}) => boundsValid
    && inside(x, bounds.minX, bounds.maxX)
    && inside(y, bounds.minY, bounds.maxY);
  const obstacleFootprintsValid = boundsValid && obstacles.length > 0 && obstacles.every((entry) => {
    const footprint = entry?.footprint;
    return entry?.shape === 'circle' && Number.isFinite(footprint?.radius) && footprint.radius > 0
      && inside(footprint.x - footprint.radius, bounds.minX, bounds.maxX)
      && inside(footprint.x + footprint.radius, bounds.minX, bounds.maxX)
      && inside(footprint.y - footprint.radius, bounds.minY, bounds.maxY)
      && inside(footprint.y + footprint.radius, bounds.minY, bounds.maxY);
  });
  const elevationSurfacesValid = boundsValid && surfaces.some(({ type }) => type === 'ramp')
    && surfaces.some(({ type }) => type === 'platform')
    && surfaces.every((entry) => {
      const area = entry?.bounds;
      const elevation = entry?.elevation;
      return ['ramp', 'platform'].includes(entry?.type)
        && area && pointInside({ x: area.minX, y: area.minY }) && pointInside({ x: area.maxX, y: area.maxY })
        && area.minX < area.maxX && area.minY < area.maxY
        && ['x', 'y'].includes(elevation?.axis)
        && Number.isFinite(elevation.atMin) && Number.isFinite(elevation.atMax);
    });
  const propPlacementsValid = props.length > 0 && props.every((entry) => pointInside(entry?.placement)
    && Number.isFinite(entry?.placement?.elevation)
    && Number.isFinite(entry?.placement?.yawRadians)
    && typeof entry?.modelPath === 'string');
  const npcPlacementCoverage = npcs.length > 0 && npcs.every((entry) => pointInside(entry?.placement)
    && pointInside(entry?.presentationCue?.lookAt)
    && Number.isFinite(entry?.placement?.elevation)
    && Number.isFinite(entry?.placement?.yawRadians)
    && typeof entry?.actorId === 'string' && entry.actorId.length > 0
    && typeof entry?.modelPath === 'string'
    && entry?.presentationCue?.idleClip === 'idle'
    && entry?.presentationCue?.posture === 'watchful');
  const checks = { boundsValid, obstacleFootprintsValid, elevationSurfacesValid, propPlacementsValid, npcPlacementCoverage };
  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) errors.push(issue(`placement_${name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}`, stage.stageId, `placement check failed: ${name}`));
  }
  return {
    sourcePath: CATALOG_PATH,
    gameplayBounds: bounds,
    counts: { obstacles: obstacles.length, elevationSurfaces: surfaces.length, props: props.length, npcs: npcs.length },
    checks,
    issues: errors,
    ok: errors.length === 0,
  };
}

function auditShowcaseThumbnail(stageId, stage, retainedPaths) {
  if (!stage) {
    const errors = [issue('showcase_profile_missing', stageId, 'showcase stage has no world profile')];
    return { stageId, thumbnailPath: null, checks: { exists: false, retainedRuntimeAsset: false, readablePng: false }, issues: errors, ok: false };
  }
  const terrainName = stage.terrainGlbPath.split('/').at(-1);
  const thumbnailPath = `assets/images/battle/ui/stages/${terrainName.replace(/\.glb$/u, '.png')}`;
  const absolutePath = resolve(ROOT, thumbnailPath);
  const checks = {
    exists: existsSync(absolutePath),
    retainedRuntimeAsset: retainedPaths.has(thumbnailPath),
    readablePng: false,
  };
  const errors = [];
  let bytes = null;
  if (checks.exists) {
    bytes = readFileSync(absolutePath);
    checks.readablePng = bytes.length >= 24
      && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      && bytes.readUInt32BE(16) > 0
      && bytes.readUInt32BE(20) > 0;
  }
  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) errors.push(issue(`showcase_thumbnail_${name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}`, thumbnailPath, `showcase thumbnail check failed: ${name}`));
  }
  return {
    stageId,
    thumbnailPath,
    bytes: bytes?.length ?? null,
    sha256: bytes ? sha256(bytes) : null,
    checks,
    issues: errors,
    ok: errors.length === 0,
  };
}

function parseArguments(argumentsList) {
  if (argumentsList.length === 0) return { write: false };
  if (argumentsList.length === 1 && argumentsList[0] === '--write') return { write: true };
  throw new Error('usage: node scripts/audit-stage-scenes.mjs [--write]');
}

async function buildReport() {
  const [{ STAGES }, { STAGE_SHOWCASE_IDS, STAGE_WORLD_PROFILES }, { RETAINED_ASSET_PATHS }] = await Promise.all([
    import('../defense-catalog.js'),
    import('../stage-world-catalog.js'),
    import('./defense-runtime-assets.mjs'),
  ]);
  const [allMeshAudit, terrainBuildProvenance] = [
    ALL_MESH_PROVENANCE_PATH,
    TERRAIN_PROVENANCE_PATH,
  ].map((path) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')));
  // Optional: absent until the first character promotion, and every other
  // asset keeps answering to the texture-pass audit when it is missing.
  const characterBuildProvenance = existsSync(resolve(ROOT, CHARACTER_PROVENANCE_PATH))
    ? JSON.parse(readFileSync(resolve(ROOT, CHARACTER_PROVENANCE_PATH), 'utf8'))
    : { assets: {} };
  const provenanceRecords = normalizeProvenanceRecords(allMeshAudit, terrainBuildProvenance, characterBuildProvenance);
  const retainedPaths = new Set(RETAINED_ASSET_PATHS);
  const canonicalStageIds = STAGES.map(({ id }) => id);
  const assetPaths = new Set();
  const stages = canonicalStageIds.map((stageId) => {
    const stage = STAGE_WORLD_PROFILES[stageId];
    if (!stage) return { stageId, ok: false, issues: [issue('stage_profile_missing', stageId, 'canonical stage has no world profile')] };
    const runtimeAssets = [
      stage.terrainGlbPath,
      ...stage.presentation.props.map(({ modelPath }) => modelPath),
      ...stage.presentation.npcs.map(({ modelPath }) => modelPath),
    ].filter((path, index, paths) => typeof path === 'string' && paths.indexOf(path) === index);
    runtimeAssets.forEach((path) => assetPaths.add(path));
    const placement = auditPlacement(stage);
    return {
      stageId,
      sequence: stage.sequence,
      terrainGlbPath: stage.terrainGlbPath,
      runtimeAssets,
      placement,
      issues: [...placement.issues],
      ok: placement.ok,
    };
  });
  const assets = [...assetPaths]
    .sort((left, right) => left.localeCompare(right))
    .map((path) => auditGlb(path, retainedPaths, provenanceRecords));
  const assetsByPath = new Map(assets.map((asset) => [asset.path, asset]));
  for (const stage of stages) {
    for (const path of stage.runtimeAssets ?? []) {
      const asset = assetsByPath.get(path);
      if (!asset?.ok) stage.issues.push(issue('stage_runtime_asset_failed', path, `${stage.stageId} references an asset that failed structural or provenance checks`));
    }
    stage.issues.sort((left, right) => `${left.path}:${left.code}`.localeCompare(`${right.path}:${right.code}`));
    stage.ok = stage.issues.length === 0;
  }
  const showcases = STAGE_SHOWCASE_IDS.map((stageId) => auditShowcaseThumbnail(stageId, STAGE_WORLD_PROFILES[stageId], retainedPaths));
  const issues = [
    ...(canonicalStageIds.length === 10 ? [] : [issue('canonical_stage_count', 'defense-catalog.js', `expected 10 stages, found ${canonicalStageIds.length}`)]),
    ...(showcases.length === 3 ? [] : [issue('showcase_stage_count', CATALOG_PATH, `expected 3 showcase stages, found ${showcases.length}`)]),
    ...stages.flatMap((stage) => stage.issues.map((entry) => ({ ...entry, stageId: stage.stageId }))),
    ...assets.flatMap((asset) => asset.issues),
    ...showcases.flatMap((showcase) => showcase.issues),
  ].sort((left, right) => `${left.path}:${left.code}:${left.stageId ?? ''}`.localeCompare(`${right.path}:${right.code}:${right.stageId ?? ''}`));
  return {
    schemaVersion: 1,
    generatedBy: 'scripts/audit-stage-scenes.mjs',
    deterministic: true,
    sources: {
      stageCatalog: CATALOG_PATH,
      runtimeAssetRegistry: RUNTIME_REGISTRY_PATH,
      allMeshGlbAudit: ALL_MESH_PROVENANCE_PATH,
      terrainBuildProvenance: TERRAIN_PROVENANCE_PATH,
    },
    stageCount: stages.length,
    showcaseStageIds: [...STAGE_SHOWCASE_IDS],
    showcases,
    runtimeAssetCount: assets.length,
    stages,
    assets,
    issueCount: issues.length,
    issues,
    ok: issues.length === 0,
  };
}

async function main() {
  const { write } = parseArguments(process.argv.slice(2));
  const report = await buildReport();
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (write) writeFileSync(resolve(ROOT, OUTPUT_PATH), serialized);
  else process.stdout.write(serialized);
  return report.ok ? 0 : 1;
}

try {
  process.exitCode = await main();
} catch (error) {
  process.stderr.write(`stage scene audit failed: ${error.message}\n`);
  process.exitCode = 2;
}
