#!/usr/bin/env node
/** Stage-A numeric pose-alignment audit.  Bounds mode intentionally refuses without bounds. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { angularDistanceDegrees, KinematicGateError, readAccessor, readGlb, runConformanceVectors } from '../motion-bench/lib/kinematic-gate.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const POSE_ALIGNMENT_BONES = [
  'DEF-spine', 'DEF-spine.001', 'DEF-spine.002', 'DEF-spine.003', 'DEF-spine.004', 'DEF-spine.005',
  'DEF-shoulder.L', 'DEF-upper_arm.L', 'DEF-forearm.L', 'DEF-hand.L',
  'DEF-shoulder.R', 'DEF-upper_arm.R', 'DEF-forearm.R', 'DEF-hand.R',
  'DEF-thigh.L', 'DEF-shin.L', 'DEF-foot.L', 'DEF-toe.L',
  'DEF-thigh.R', 'DEF-shin.R', 'DEF-foot.R', 'DEF-toe.R',
];
const EXCLUDED_STATIC_BONES = ['DEF-pelvis.L', 'DEF-pelvis.R'];
const OBSERVED_BLENDER_VERSION = '5.1.2';

function argv() {
  const values = process.argv.slice(2); const result = { poseAlignment: false };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--pose-alignment') result.poseAlignment = true;
    else if (value.startsWith('--')) result[value.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = values[++index];
    else throw new KinematicGateError('KG_ARGUMENTS', `unexpected argument: ${value}`);
  }
  return result;
}

function repoPath(path, label) {
  const absolute = resolve(path);
  if (!absolute.startsWith(`${ROOT}/`)) throw new KinematicGateError('KG_PATH', `${label} must stay under repository root`);
  return absolute;
}
function hash(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
function writeJson(path, payload) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`); }
function quatMultiply(a, b) { return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]; }
function unit(q) {
  if (!Array.isArray(q) || q.length !== 4 || q.some(value => !Number.isFinite(value))) throw new KinematicGateError('KG_QUATERNION', 'quaternion must contain four finite components');
  const length = Math.hypot(...q);
  if (!Number.isFinite(length) || length <= 1e-12) throw new KinematicGateError('KG_QUATERNION', 'quaternion must be non-zero');
  return q.map(value => value / length);
}
function slerp(a, b, t) { a = unit(a); b = unit(b); let dot = a.reduce((sum, value, index) => sum + value * b[index], 0); if (dot < 0) { b = b.map(value => -value); dot = -dot; } if (dot > .9995) return unit(a.map((value, index) => value + t * (b[index] - value))); const theta = Math.acos(Math.min(1, dot)), divisor = Math.sin(theta); return a.map((value, index) => (Math.sin((1 - t) * theta) * value + Math.sin(t * theta) * b[index]) / divisor); }

function sampleSampler(glb, sampler, at) {
  const times = readAccessor(glb, sampler.input).map(row => row[0]), values = readAccessor(glb, sampler.output);
  if (!times.length || times.length !== values.length || values.some(value => value.length !== 4)) throw new KinematicGateError('KG_GLB_ANIMATION', 'rotation sampler must contain matching VEC4 samples');
  if (times.some((time, index) => !Number.isFinite(time) || (index && time <= times[index - 1]))) throw new KinematicGateError('KG_GLB_ANIMATION', 'rotation times must be finite and strictly increasing');
  if (sampler.interpolation === 'CUBICSPLINE') throw new KinematicGateError('KG_GLB_ANIMATION', 'CUBICSPLINE rotation samplers are unsupported by frozen linear protocol');
  if (at <= times[0]) return unit(values[0]); if (at >= times.at(-1)) return unit(values.at(-1));
  const upper = times.findIndex(time => time >= at), lower = upper - 1, fraction = (at - times[lower]) / (times[upper] - times[lower]);
  if (sampler.interpolation === 'STEP') return unit(values[lower]);
  if (sampler.interpolation && sampler.interpolation !== 'LINEAR') throw new KinematicGateError('KG_GLB_ANIMATION', `unsupported rotation interpolation: ${sampler.interpolation}`);
  return slerp(values[lower], values[upper], fraction);
}
function rigTopology(glb, label) {
  const nodes = glb.json.nodes ?? [];
  const parents = Array(nodes.length).fill(undefined);
  const byName = new Map();
  for (const [index, node] of nodes.entries()) {
    if (node.matrix !== undefined) throw new KinematicGateError('KG_POSE_TRANSFORM', `${label} node ${node.name ?? index} uses unsupported matrix transform`);
    for (const [field, expected] of [['translation', undefined], ['scale', [1, 1, 1]]]) {
      if (node[field] === undefined) continue;
      if (!Array.isArray(node[field]) || node[field].length !== 3 || node[field].some(value => !Number.isFinite(value))) throw new KinematicGateError('KG_POSE_TRANSFORM', `${label} node ${node.name ?? index} has invalid ${field}`);
      if (expected && (!node[field].every(value => value > 0) || node[field].some(value => Math.abs(value - node[field][0]) > 1e-6))) throw new KinematicGateError('KG_POSE_TRANSFORM', `${label} node ${node.name ?? index} has unsupported non-uniform or reflected scale`);
    }
    if (node.name) {
      if (byName.has(node.name)) throw new KinematicGateError('KG_POSE_HIERARCHY', `${label} has duplicate node name ${node.name}`);
      byName.set(node.name, index);
    }
    for (const child of node.children ?? []) {
      if (!Number.isInteger(child) || child < 0 || child >= nodes.length) throw new KinematicGateError('KG_POSE_HIERARCHY', `${label} has an invalid child index`);
      if (parents[child] !== undefined) throw new KinematicGateError('KG_POSE_HIERARCHY', `${label} has an ambiguous parent for node ${child}`);
      parents[child] = index;
    }
  }
  return { nodes, parents, byName, label };
}
function localRotation(topology, index, localDeltas) {
  const rotation = topology.nodes[index]?.rotation ?? [0, 0, 0, 1];
  if (!Array.isArray(rotation) || rotation.length !== 4) throw new KinematicGateError('KG_POSE_HIERARCHY', `${topology.label} has invalid local rotation`);
  const delta = localDeltas.get(topology.nodes[index]?.name);
  return delta ? unit(quatMultiply(rotation, delta)) : unit(rotation);
}
function worldOrientation(topology, index, localDeltas, cache = new Map(), active = new Set()) {
  if (cache.has(index)) return cache.get(index);
  if (active.has(index)) throw new KinematicGateError('KG_POSE_HIERARCHY', `${topology.label} has a cyclic node hierarchy`);
  if (!topology.nodes[index]) throw new KinematicGateError('KG_POSE_HIERARCHY', `${topology.label} references a missing node`);
  active.add(index);
  const parent = topology.parents[index];
  const value = parent === undefined ? localRotation(topology, index, localDeltas) : unit(quatMultiply(worldOrientation(topology, parent, localDeltas, cache, active), localRotation(topology, index, localDeltas)));
  active.delete(index); cache.set(index, value); return value;
}
function animationDeltas(glb, animation, at, topology) {
  const output = new Map();
  for (const channel of animation.channels ?? []) {
    if (channel.target?.path !== 'rotation') continue;
    const node = glb.json.nodes?.[channel.target.node];
    if (!node?.name || !topology.byName.has(node.name)) throw new KinematicGateError('KG_POSE_HIERARCHY', `animation ${animation.name ?? '<unnamed>'} targets an unnamed or missing node`);
    output.set(node.name, sampleSampler(glb, animation.samplers[channel.sampler], at));
  }
  return output;
}
function percentile(values, fraction) { if (!values.length) return 0; const ordered = [...values].sort((a, b) => a - b), point = (ordered.length - 1) * fraction, lower = Math.floor(point), upper = Math.ceil(point); return ordered[lower] + (ordered[upper] - ordered[lower]) * (point - lower); }

function loadCertifiedRig(targetRig) {
  const provenance = targetRig.replace(/\.glb$/, '.provenance.json');
  if (!existsSync(provenance)) throw new KinematicGateError('KG_TARGET_RIG_HASH', `certification provenance missing: ${provenance}`);
  const data = JSON.parse(readFileSync(provenance, 'utf8')), actual = hash(targetRig);
  if (data.targetRigSha256 !== actual) throw new KinematicGateError('KG_TARGET_RIG_HASH', `target rig hash mismatch: expected ${data.targetRigSha256}, got ${actual}`);
  if (data.blender?.version !== OBSERVED_BLENDER_VERSION) throw new KinematicGateError('KG_BLENDER_VERSION', `expected certified Blender ${OBSERVED_BLENDER_VERSION}, got ${data.blender?.version ?? '<missing>'}`);
  const manifest = JSON.parse(readFileSync(resolve(ROOT, 'assets/motion/ingame/manifest.json'), 'utf8'));
  const expectedTargetBones = manifest.targetBoneNames;
  if (!Array.isArray(expectedTargetBones) || expectedTargetBones.length !== 24 || new Set(expectedTargetBones).size !== 24 || !Array.isArray(data.targetBoneNames) || data.targetBoneNames.length !== 24 || new Set(data.targetBoneNames).size !== 24 || data.targetBoneNames.some(name => !expectedTargetBones.includes(name))) throw new KinematicGateError('KG_TARGET_RIG_PROVENANCE', 'certification must declare the exact 24 manifest targetBoneNames');
  if (JSON.stringify(data.poseAlignmentBones) !== JSON.stringify(POSE_ALIGNMENT_BONES)) throw new KinematicGateError('KG_TARGET_RIG_PROVENANCE', 'certification poseAlignmentBones must equal the code-owned 22-bone cohort');
  if (JSON.stringify(data.excludedStaticBones) !== JSON.stringify(EXCLUDED_STATIC_BONES)) throw new KinematicGateError('KG_TARGET_RIG_PROVENANCE', 'certification excludedStaticBones must equal DEF-pelvis.L and DEF-pelvis.R only');
  if (typeof data.originCommit !== 'string' || typeof data.originPath !== 'string' || !/^[0-9a-f]{64}$/.test(data.targetRigSha256)) throw new KinematicGateError('KG_TARGET_RIG_PROVENANCE', 'certification recovery lineage is incomplete');
  let recovered;
  try { recovered = execFileSync('git', ['show', `${data.originCommit}:${data.originPath}`], { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 }); }
  catch { throw new KinematicGateError('KG_TARGET_RIG_PROVENANCE', 'unable to read certified origin blob'); }
  if (recovered.length !== data.targetRigBytes || createHash('sha256').update(recovered).digest('hex') !== actual) throw new KinematicGateError('KG_TARGET_RIG_PROVENANCE', 'certified rig does not match recovered origin blob');
  return data;
}

export function collectWorldPoseAlignment(targetRig, certification) {
  if (JSON.stringify(certification.poseAlignmentBones) !== JSON.stringify(POSE_ALIGNMENT_BONES) || JSON.stringify(certification.excludedStaticBones) !== JSON.stringify(EXCLUDED_STATIC_BONES)) throw new KinematicGateError('KG_TARGET_RIG_PROVENANCE', 'pose cohort or excluded pelvis pair differs from the code-owned contract');
  const canonical = readGlb(targetRig), canonicalTopology = rigTopology(canonical, 'canonical target rig');
  const configPath = resolve(ROOT, '_workspace/current/engineering/asset-pipeline/character-motion-library/library-config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const manifestPath = resolve(ROOT, 'assets/motion/ingame/manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const expectedClipNames = (manifest.clipOverrides ?? []).map(clip => clip.clipName).sort();
  const overlayPath = resolve(ROOT, 'assets/motion/ingame/unarmed-core.glb');
  const overlay = readGlb(overlayPath), overlayTopology = rigTopology(overlay, 'overlay pack');
  const actualClipNames = (overlay.json.animations ?? []).map(animation => animation.name).sort();
  if (config.characters.length !== 11 || expectedClipNames.length !== 21 || new Set(expectedClipNames).size !== 21 || JSON.stringify(actualClipNames) !== JSON.stringify(expectedClipNames)) throw new KinematicGateError('KG_POSE_COMPLETENESS', `overlay clips do not exactly match the 21 manifest clipOverrides`);
  const rows = [], residualRows = [];
  for (const character of config.characters) {
    const modelPath = resolve(ROOT, `assets/motion/ingame/characters/${character.assetId}/model.glb`);
    if (!existsSync(modelPath)) throw new KinematicGateError('KG_ACTOR_MODEL', `missing actor model: ${relative(ROOT, modelPath)}`);
    const actor = readGlb(modelPath), actorTopology = rigTopology(actor, `${character.assetId} model`);
    for (const bone of certification.poseAlignmentBones) {
      const canonicalIndex = canonicalTopology.byName.get(bone), actorIndex = actorTopology.byName.get(bone);
      if (canonicalIndex === undefined || actorIndex === undefined) throw new KinematicGateError('KG_POSE_BONE', `${character.assetId} lacks required pose bone ${bone}`);
      const localRestResidualDeg = angularDistanceDegrees(actorTopology.nodes[actorIndex].rotation ?? [0, 0, 0, 1], canonicalTopology.nodes[canonicalIndex].rotation ?? [0, 0, 0, 1]);
      const restResidualDeg = angularDistanceDegrees(worldOrientation(actorTopology, actorIndex, new Map()), worldOrientation(canonicalTopology, canonicalIndex, new Map()));
      residualRows.push({
        actorId: character.assetId, bone, orientationSpace: 'world', localOrientationSpace: 'local',
        restResidualDeg, localRestResidualDeg,
      });
    }
    for (const animation of overlay.json.animations ?? []) {
      const rotationSamplers = (animation.channels ?? []).filter(channel => channel.target?.path === 'rotation').map(channel => animation.samplers?.[channel.sampler]);
      if (!rotationSamplers.length || rotationSamplers.some(sampler => !sampler)) throw new KinematicGateError('KG_GLB_ANIMATION', `clip ${animation.name} lacks rotation samples`);
      const times = rotationSamplers.flatMap(sampler => readAccessor(overlay, sampler.input).map(row => row[0]));
      if (!times.length) throw new KinematicGateError('KG_GLB_ANIMATION', `clip ${animation.name} has empty rotation samples`);
      const first = Math.min(...times), midpoint = (first + Math.max(...times)) / 2;
      for (const [frameTime, frameSample] of [[first, 'first'], [midpoint, 'midpoint']]) {
        const deltas = animationDeltas(overlay, animation, frameTime, overlayTopology);
        const actorCache = new Map(), canonicalCache = new Map();
        for (const bone of certification.poseAlignmentBones) {
          const canonicalIndex = canonicalTopology.byName.get(bone), actorIndex = actorTopology.byName.get(bone);
          if (canonicalIndex === undefined || actorIndex === undefined) throw new KinematicGateError('KG_POSE_BONE', `${character.assetId} lacks required pose bone ${bone}`);
          rows.push({
            actorId: character.assetId, clipName: animation.name, bone, frameTime, frameSample, orientationSpace: 'world',
            worldPoseResidualDeg: angularDistanceDegrees(worldOrientation(actorTopology, actorIndex, deltas, actorCache), worldOrientation(canonicalTopology, canonicalIndex, deltas, canonicalCache)),
          });
        }
      }
    }
  }
  const expectedStaticRows = config.characters.length * certification.poseAlignmentBones.length;
  const expectedWorldRows = expectedStaticRows * expectedClipNames.length * 2;
  if (residualRows.length !== expectedStaticRows || rows.length !== expectedWorldRows) throw new KinematicGateError('KG_POSE_COMPLETENESS', `expected ${expectedStaticRows} static and ${expectedWorldRows} world rows, got ${residualRows.length} and ${rows.length}`);
  return {
    config, rows, residualRows,
    bindings: {
      overlay: { path: relative(ROOT, overlayPath), sha256: hash(overlayPath), expectedClipNames },
      config: { path: relative(ROOT, configPath), sha256: hash(configPath) },
      completeness: { actorCount: config.characters.length, poseBoneCount: certification.poseAlignmentBones.length, clipCount: expectedClipNames.length, staticRows: residualRows.length, worldRows: rows.length, expectedStaticRows, expectedWorldRows },
    },
  };
}

function auditPoseAlignment(options) {
  for (const key of ['targetRig', 'vectors', 'baselineOut', 'residualsOut']) if (!options[key]) throw new KinematicGateError('KG_ARGUMENTS', `--${key.replace(/[A-Z]/g, value => `-${value.toLowerCase()}`)} is required in --pose-alignment mode`);
  const targetRig = repoPath(options.targetRig, 'target rig'), vectors = repoPath(options.vectors, 'vectors'), baselineOut = repoPath(options.baselineOut, 'baseline out'), residualsOut = repoPath(options.residualsOut, 'residuals out');
  runConformanceVectors(vectors);
  const certification = loadCertifiedRig(targetRig);
  const { config, rows, residualRows, bindings } = collectWorldPoseAlignment(targetRig, certification);
  if (rows.some(row => !Number.isFinite(row.worldPoseResidualDeg)) || residualRows.some(row => !Number.isFinite(row.restResidualDeg) || !Number.isFinite(row.localRestResidualDeg))) throw new KinematicGateError('KG_METRIC', 'pose metrics must be finite before artifact serialization');
  const perActor = Object.fromEntries(config.characters.map(character => {
    const actorRows = residualRows.filter(row => row.actorId === character.assetId);
    const localValues = actorRows.map(row => row.localRestResidualDeg), worldValues = actorRows.map(row => row.restResidualDeg);
    return [character.assetId, {
      maxDeg: Math.max(...localValues), p99Deg: percentile(localValues, .99), countOver2Deg: localValues.filter(value => value > 2).length,
      worldMaxDeg: Math.max(...worldValues), worldP99Deg: percentile(worldValues, .99), worldCountOver2Deg: worldValues.filter(value => value > 2).length,
    }];
  }));
  writeJson(baselineOut, { schemaVersion: 1, kind: 'pose-alignment-baseline', blender: certification.blender, orientationSpace: 'world', targetRig: relative(ROOT, targetRig), targetRigSha256: hash(targetRig), poseAlignmentBones: certification.poseAlignmentBones, bindings, rows, summary: { p99Deg: percentile(rows.map(row => row.worldPoseResidualDeg), .99) } });
  writeJson(residualsOut, {
    schemaVersion: 1, kind: 'static-rest-residuals', blender: certification.blender, orientationSpace: 'world', renderRankingMetric: 'restResidualDeg',
    numericGateMetric: 'localRestResidualDeg', targetRig: relative(ROOT, targetRig), targetRigSha256: hash(targetRig), bindings, rows: residualRows, perActor,
  });
  console.log(`KINEMATIC_POSE_ALIGNMENT_RESULT_JSON:${JSON.stringify({ baselineOut, residualsOut, actors: config.characters.length, rows: rows.length })}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = argv();
    if (!options.poseAlignment) throw new KinematicGateError('KG_BOUNDS_REQUIRED', 'default bounds audit is inert in Stage A and requires a bounds JSON');
    auditPoseAlignment(options);
  } catch (error) {
    console.error(error instanceof KinematicGateError ? error.message : error.stack ?? String(error));
    process.exitCode = 2;
  }
}
