import { readFileSync } from 'node:fs';

const RAD_TO_DEG = 180 / Math.PI;
const EPSILON = 1e-12;

export class KinematicGateError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = 'KinematicGateError';
    this.code = code;
  }
}

function unit(quaternion) {
  if (!Array.isArray(quaternion) || quaternion.length !== 4) throw new KinematicGateError('KG_QUATERNION', 'a quaternion must have four components');
  const values = quaternion.map(Number);
  const magnitude = Math.hypot(...values);
  if (!Number.isFinite(magnitude) || magnitude <= EPSILON) throw new KinematicGateError('KG_QUATERNION', 'a quaternion must be finite and non-zero');
  return values.map(value => value / magnitude);
}

export function angularDistanceDegrees(left, right) {
  const a = unit(left), b = unit(right);
  const dot = Math.abs(a.reduce((total, value, index) => total + value * b[index], 0));
  return dot >= 1 - 1e-12 ? 0 : 2 * Math.acos(Math.max(0, Math.min(1, dot))) * RAD_TO_DEG;
}

export function measureQuaternionTrack(quaternions) {
  const frames = quaternions.map(unit);
  if (!frames.length) throw new KinematicGateError('KG_EMPTY_TRACK', 'at least one quaternion sample is required');
  const totals = frames.map(frame => frames.reduce((total, other) => total + angularDistanceDegrees(frame, other), 0));
  const medoidIndex = totals.reduce((best, total, index) => total < totals[best] ? index : best, 0);
  const peakDeg = Math.max(...frames.map(frame => angularDistanceDegrees(frame, frames[medoidIndex])));
  const stepDeg = frames.slice(1).reduce((maximum, frame, index) => Math.max(maximum, angularDistanceDegrees(frames[index], frame)), 0);
  return { peakDeg, stepDeg, medoidIndex };
}

export function validateBoundsJson(bounds) {
  const required = ['schemaVersion', 'sampleFps', 'referencePoseMethod', 'boundsFullCohort', 'boundsByExcludedSource'];
  const missing = required.filter(key => !(key in bounds));
  if (missing.length) throw new KinematicGateError('KG_BOUNDS_SCHEMA', `missing required bounds fields: ${missing.join(', ')}`);
  if (bounds.sampleFps !== 24 || bounds.referencePoseMethod !== 'angular-medoid-v1') throw new KinematicGateError('KG_BOUNDS_PROTOCOL', 'bounds do not use frozen 24-Hz angular-medoid-v1 protocol');
  return bounds;
}

function validateProvenance(provenance) {
  const required = ['assetId', 'clipName', 'action', 'actionClass', 'encoding', 'sourceGroup'];
  const missing = required.filter(key => !(key in provenance));
  if (missing.length) throw new KinematicGateError('KG_PROVENANCE', `missing provenance fields: ${missing.join(', ')}`);
  if (!['local-rest-relative-quaternion-deltas', 'absolute-local-rotation'].includes(provenance.encoding)) throw new KinematicGateError('KG_ENCODING', `unsupported encoding: ${provenance.encoding}`);
  if (!provenance.sourceGroup || (typeof provenance.sourceGroup !== 'object') || (!('repoRelativePath' in provenance.sourceGroup) && !('generator' in provenance.sourceGroup))) throw new KinematicGateError('KG_UNKNOWN_SOURCE', 'sourceGroup needs a bench path or authored generator');
  return provenance;
}

export function buildClipProvenanceOverlay(clip, assetId = 'unarmed-core') { return validateProvenance({ assetId, ...clip }); }
export function buildClipProvenanceCharacter(clip, assetId) { return validateProvenance({ assetId, ...clip }); }

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const TYPE_COUNTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const COMPONENT_SIZES = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 };
const COMPONENT_READERS = {
  5121: (buffer, offset) => buffer.readUInt8(offset),
  5123: (buffer, offset) => buffer.readUInt16LE(offset),
  5125: (buffer, offset) => buffer.readUInt32LE(offset),
  5126: (buffer, offset) => buffer.readFloatLE(offset),
};

export function readGlb(path) {
  const buffer = readFileSync(path);
  if (buffer.length < 20 || buffer.readUInt32LE(0) !== GLB_MAGIC) throw new KinematicGateError('KG_GLB', `${path} is not a GLB`);
  const totalLength = buffer.readUInt32LE(8);
  if (totalLength !== buffer.length) throw new KinematicGateError('KG_GLB', `${path} has an invalid total length`);
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < totalLength) {
    if (offset + 8 > totalLength) throw new KinematicGateError('KG_GLB', `${path} has a truncated chunk header`);
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    const end = offset + 8 + length;
    if (end > totalLength) throw new KinematicGateError('KG_GLB', `${path} has a truncated chunk`);
    const chunk = buffer.subarray(offset + 8, end);
    if (type === JSON_CHUNK) {
      if (json !== null) throw new KinematicGateError('KG_GLB', `${path} contains multiple JSON chunks`);
      try { json = JSON.parse(chunk.toString('utf8')); } catch (error) { throw new KinematicGateError('KG_GLB', `${path} has invalid JSON: ${error.message}`); }
    } else if (type === BIN_CHUNK) {
      if (bin !== null) throw new KinematicGateError('KG_GLB', `${path} contains multiple BIN chunks`);
      bin = chunk;
    }
    offset = end;
  }
  if (offset !== totalLength || !json || !bin) throw new KinematicGateError('KG_GLB', `${path} requires exactly one JSON and BIN chunk`);
  return { json, bin };
}

export function readAccessor(glb, index) {
  const accessor = glb.json.accessors?.[index];
  if (!accessor || accessor.sparse) throw new KinematicGateError('KG_GLB_ACCESSOR', `unsupported accessor ${index}`);
  const width = TYPE_COUNTS[accessor.type];
  const size = COMPONENT_SIZES[accessor.componentType];
  const reader = COMPONENT_READERS[accessor.componentType];
  const view = glb.json.bufferViews?.[accessor.bufferView];
  if (!width || !size || !reader || !view) throw new KinematicGateError('KG_GLB_ACCESSOR', `unsupported accessor ${index}`);
  const base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = view.byteStride ?? width * size;
  if (stride < width * size || base < 0 || base + Math.max(0, accessor.count - 1) * stride + width * size > glb.bin.length) throw new KinematicGateError('KG_GLB_ACCESSOR', `out-of-range accessor ${index}`);
  return Array.from({ length: accessor.count }, (_, row) => Array.from({ length: width }, (_, column) => reader(glb.bin, base + row * stride + column * size)));
}

function sampleQuaternion(times, values, interpolation, at) {
  if (times.length !== values.length || !times.length) throw new KinematicGateError('KG_GLB_ANIMATION', 'rotation sampler has mismatched input/output samples');
  if (interpolation === 'CUBICSPLINE') throw new KinematicGateError('KG_GLB_ANIMATION', 'CUBICSPLINE rotation samplers are unsupported by frozen linear protocol');
  if (values.some(value => value.length !== 4)) throw new KinematicGateError('KG_GLB_ANIMATION', 'rotation sampler must contain VEC4 quaternions');
  if (at <= times[0]) return unit(values[0]);
  if (at >= times.at(-1)) return unit(values.at(-1));
  const upper = times.findIndex(time => time >= at);
  const lower = upper - 1;
  if (!(times[upper] > times[lower])) throw new KinematicGateError('KG_GLB_ANIMATION', 'rotation times must be strictly increasing');
  if (interpolation === 'STEP') return unit(values[lower]);
  if (interpolation !== undefined && interpolation !== 'LINEAR') throw new KinematicGateError('KG_GLB_ANIMATION', `unsupported rotation interpolation: ${interpolation}`);
  return slerp(values[lower], values[upper], (at - times[lower]) / (times[upper] - times[lower]));
}

function samplesAt24Hz(times) {
  if (times.some((time, index) => !Number.isFinite(time) || (index && time <= times[index - 1]))) throw new KinematicGateError('KG_GLB_ANIMATION', 'rotation times must be finite and strictly increasing');
  const start = times[0], end = times.at(-1);
  const samples = [start];
  for (let frame = 1; start + frame / 24 < end - 1e-9; frame += 1) samples.push(start + frame / 24);
  if (end > start) samples.push(end);
  return samples;
}

export function measureGlb(path) {
  const glb = readGlb(path);
  const rows = [];
  for (const animation of glb.json.animations ?? []) {
    for (const channel of animation.channels ?? []) {
      if (channel.target?.path !== 'rotation') continue;
      const sampler = animation.samplers?.[channel.sampler];
      const node = glb.json.nodes?.[channel.target.node];
      if (!sampler || !node?.name) throw new KinematicGateError('KG_GLB_ANIMATION', `animation ${animation.name ?? '<unnamed>'} has an invalid rotation channel`);
      const times = readAccessor(glb, sampler.input).map(row => row[0]);
      const values = readAccessor(glb, sampler.output);
      const quaternions = samplesAt24Hz(times).map(time => sampleQuaternion(times, values, sampler.interpolation ?? 'LINEAR', time));
      rows.push({ clipName: animation.name ?? `animation-${rows.length}`, bone: node.name, sampleFps: 24, ...measureQuaternionTrack(quaternions) });
    }
  }
  if (!rows.length) throw new KinematicGateError('KG_GLB_ANIMATION', `${path} has no rotation tracks`);
  return rows;
}

function slerp(left, right, ratio) {
  const a = unit(left); let b = unit(right);
  let dot = a.reduce((total, value, index) => total + value * b[index], 0);
  if (dot < 0) { b = b.map(value => -value); dot = -dot; }
  dot = Math.max(-1, Math.min(1, dot));
  if (dot > 0.9995) return unit(a.map((value, index) => (1 - ratio) * value + ratio * b[index]));
  const theta = Math.acos(dot), divisor = Math.sin(theta);
  return a.map((value, index) => (Math.sin((1 - ratio) * theta) * value + Math.sin(ratio * theta) * b[index]) / divisor);
}

export function redistributeStepShortestArc(quaternions, maxStepDegrees) {
  if (!(maxStepDegrees > 0)) throw new KinematicGateError('KG_REDISPATCH_WINDOW', 'maxStepDegrees must be positive');
  if (!quaternions.length) throw new KinematicGateError('KG_EMPTY_TRACK', 'at least one quaternion sample is required');
  const output = [unit(quaternions[0])];
  for (const current of quaternions.slice(1)) {
    const previous = output.at(-1);
    const steps = Math.max(1, Math.ceil(angularDistanceDegrees(previous, current) / maxStepDegrees));
    for (let index = 1; index <= steps; index += 1) output.push(slerp(previous, current, index / steps));
  }
  return output;
}

export function runConformanceVectors(pathOrPayload) {
  const payload = typeof pathOrPayload === 'string' ? JSON.parse(readFileSync(pathOrPayload, 'utf8')) : pathOrPayload;
  if (payload?.schemaVersion !== 1 || payload?.protocol !== 'angular-medoid-v1') throw new KinematicGateError('KG_VECTOR_SCHEMA', 'expected kinematic conformance vectors v1');
  const tolerance = Number(payload.angleToleranceDeg ?? 0.1);
  const results = (payload.vectors ?? []).map(vector => {
    if (!vector.id || vector.times?.length !== vector.quaternions?.length) throw new KinematicGateError('KG_VECTOR_SCHEMA', `invalid vector: ${vector.id ?? '<unnamed>'}`);
    const actual = measureQuaternionTrack(vector.quaternions);
    const expected = vector.expected;
    if (actual.medoidIndex !== expected.medoidIndex || ['peakDeg', 'stepDeg'].some(key => Math.abs(actual[key] - expected[key]) > tolerance)) throw new KinematicGateError('KG_CONFORMANCE', `${vector.id} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    return { id: vector.id, actual };
  });
  if (results.map(result => result.id).join(',') !== 'V1,V2,V3,V4,V5') throw new KinematicGateError('KG_VECTOR_SCHEMA', 'Stage A requires exactly V1–V5');
  return results;
}
