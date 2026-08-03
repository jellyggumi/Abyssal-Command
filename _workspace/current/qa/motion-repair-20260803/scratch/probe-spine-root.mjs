#!/usr/bin/env node
// READ-ONLY probe: explain the ~180 deg DEF-spine world residual.
// Reuses the repo's frozen gate math so numbers reproduce audit-kinematic-bounds.mjs exactly.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readGlb, angularDistanceDegrees } from '../../../engineering/asset-pipeline/motion-bench/lib/kinematic-gate.mjs';

const ROOT = resolve(process.cwd());
const RAD = 180 / Math.PI;

function quatMultiply(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}
function unit(q) {
  const m = Math.hypot(...q);
  return q.map(v => v / m);
}
// Deliberately WITHOUT abs(), to expose double-cover behaviour for comparison.
function angularNoAbs(l, r) {
  const a = unit(l), b = unit(r);
  const dot = a.reduce((t, v, i) => t + v * b[i], 0);
  return 2 * Math.acos(Math.max(0, Math.min(1, dot))) * RAD;
}

function topo(glb, label) {
  const nodes = glb.json.nodes ?? [];
  const parents = Array(nodes.length).fill(undefined);
  const byName = new Map();
  nodes.forEach((n, i) => {
    if (n.name) byName.set(n.name, i);
    for (const c of n.children ?? []) parents[c] = i;
  });
  return { nodes, parents, byName, label };
}
function localRot(t, i) { return unit(t.nodes[i]?.rotation ?? [0, 0, 0, 1]); }
function world(t, i, cache = new Map()) {
  if (cache.has(i)) return cache.get(i);
  const p = t.parents[i];
  const v = p === undefined ? localRot(t, i) : unit(quatMultiply(world(t, p, cache), localRot(t, i)));
  cache.set(i, v);
  return v;
}
function chain(t, i) {
  const out = [];
  let cur = i;
  while (cur !== undefined) { out.unshift(cur); cur = t.parents[cur]; }
  return out;
}
const fmt = q => `[${q.map(v => v.toFixed(6).padStart(10)).join(', ')}]`;

const TARGETS = {
  'human-command-boss-def-humanoid-v1': '_workspace/current/engineering/asset-pipeline/motion-bench/target-rig/human-command-boss-def-humanoid-v1.glb',
  'dusk-warden-def-humanoid-v1': '_workspace/current/engineering/asset-pipeline/motion-bench/target-rig/dusk-warden-def-humanoid-v1.glb',
};
const ACTORS = ['shadow-commander-boss', 'shadow-soldier-v04', 'guard'];
const BONES = ['DEF-spine', 'DEF-spine.001', 'DEF-foot.L', 'DEF-toe.L'];

const rigs = {};
for (const [name, path] of Object.entries(TARGETS)) {
  const glb = readGlb(resolve(ROOT, path));
  rigs[name] = topo(glb, name);
}
const actors = {};
for (const id of ACTORS) {
  const glb = readGlb(resolve(ROOT, `assets/motion/ingame/characters/${id}/model.glb`));
  actors[id] = topo(glb, id);
}

console.log('#'.repeat(100));
console.log('# 1. ANCESTRY ABOVE DEF-spine  (H2 probe: is the armature-object basis identical on both sides?)');
console.log('#'.repeat(100));
for (const [name, t] of [...Object.entries(rigs), ...Object.entries(actors)]) {
  const i = t.byName.get('DEF-spine');
  const c = chain(t, i);
  console.log(`\n${name}:`);
  for (const n of c) {
    const node = t.nodes[n];
    const r = node.rotation ? unit(node.rotation) : null;
    console.log(`   node[${String(n).padStart(3)}] ${String(node.name ?? '<unnamed>').padEnd(16)} rot=${r ? fmt(r) : 'identity (absent)'}`);
  }
}

console.log('\n' + '#'.repeat(100));
console.log('# 2. DEF-spine LOCAL + WORLD QUATERNIONS');
console.log('#'.repeat(100));
for (const bone of BONES) {
  console.log(`\n--- ${bone} ---`);
  for (const [name, t] of [...Object.entries(rigs), ...Object.entries(actors)]) {
    const i = t.byName.get(bone);
    if (i === undefined) { console.log(`   ${name.padEnd(36)} MISSING`); continue; }
    console.log(`   ${name.padEnd(36)} local=${fmt(localRot(t, i))}  world=${fmt(world(t, i))}`);
  }
}

console.log('\n' + '#'.repeat(100));
console.log('# 3. RESIDUALS: frozen contract (with abs) vs a hypothetical missing-abs implementation');
console.log('#'.repeat(100));
for (const [rigName, rig] of Object.entries(rigs)) {
  console.log(`\n=== canonical target rig: ${rigName} ===`);
  console.log(`${'actor'.padEnd(22)}${'bone'.padEnd(15)}${'world(abs)'.padStart(13)}${'local(abs)'.padStart(13)}${'world(noabs)'.padStart(14)}${'local(noabs)'.padStart(14)}`);
  for (const [aid, at] of Object.entries(actors)) {
    for (const bone of BONES) {
      const ci = rig.byName.get(bone), ai = at.byName.get(bone);
      if (ci === undefined || ai === undefined) continue;
      const wA = angularDistanceDegrees(world(at, ai), world(rig, ci));
      const lA = angularDistanceDegrees(at.nodes[ai].rotation ?? [0, 0, 0, 1], rig.nodes[ci].rotation ?? [0, 0, 0, 1]);
      const wN = angularNoAbs(world(at, ai), world(rig, ci));
      const lN = angularNoAbs(at.nodes[ai].rotation ?? [0, 0, 0, 1], rig.nodes[ci].rotation ?? [0, 0, 0, 1]);
      console.log(`${aid.padEnd(22)}${bone.padEnd(15)}${wA.toFixed(5).padStart(13)}${lA.toFixed(5).padStart(13)}${wN.toFixed(5).padStart(14)}${lN.toFixed(5).padStart(14)}`);
    }
  }
}

console.log('\n' + '#'.repeat(100));
console.log('# 4. FULL 22-BONE SPREAD PER CANONICAL RIG (uniform ~180 => H1/H2; scattered => H3)');
console.log('#'.repeat(100));
const POSE_BONES = JSON.parse(readFileSync(resolve(ROOT, '_workspace/current/engineering/asset-pipeline/motion-bench/target-rig/human-command-boss-def-humanoid-v1.provenance.json'), 'utf8')).poseAlignmentBones;
for (const [rigName, rig] of Object.entries(rigs)) {
  console.log(`\n=== ${rigName} ===`);
  for (const [aid, at] of Object.entries(actors)) {
    const vals = POSE_BONES.map(b => {
      const ci = rig.byName.get(b), ai = at.byName.get(b);
      if (ci === undefined || ai === undefined) return null;
      return { b, w: angularDistanceDegrees(world(at, ai), world(rig, ci)), l: angularDistanceDegrees(at.nodes[ai].rotation ?? [0, 0, 0, 1], rig.nodes[ci].rotation ?? [0, 0, 0, 1]) };
    }).filter(Boolean);
    const over90 = vals.filter(v => v.w > 90);
    console.log(`  ${aid}: n=${vals.length} worldMax=${Math.max(...vals.map(v => v.w)).toFixed(5)} localMax=${Math.max(...vals.map(v => v.l)).toFixed(5)} bonesOver90=${over90.length} [${over90.map(v => v.b).join(' ')}]`);
  }
}
