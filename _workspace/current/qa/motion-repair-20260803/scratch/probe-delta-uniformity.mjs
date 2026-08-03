#!/usr/bin/env node
// READ-ONLY: is the dusk-warden offset a single constant frame delta (H2-flavoured)
// or a per-bone scatter (H3)?  Also exercises the real certification gate.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readGlb, angularDistanceDegrees } from '../../../engineering/asset-pipeline/motion-bench/lib/kinematic-gate.mjs';

const ROOT = resolve(process.cwd());
const RAD = 180 / Math.PI;
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const unit = q => { const m = Math.hypot(...q); return q.map(v => v / m); };
const conj = q => [-q[0], -q[1], -q[2], q[3]];

function topo(glb, label) {
  const nodes = glb.json.nodes ?? [];
  const parents = Array(nodes.length).fill(undefined);
  const byName = new Map();
  nodes.forEach((n, i) => { if (n.name) byName.set(n.name, i); for (const c of n.children ?? []) parents[c] = i; });
  return { nodes, parents, byName, label };
}
const lrot = (t, i) => unit(t.nodes[i]?.rotation ?? [0, 0, 0, 1]);
function world(t, i, cache = new Map()) {
  if (cache.has(i)) return cache.get(i);
  const p = t.parents[i];
  const v = p === undefined ? lrot(t, i) : unit(qmul(world(t, p, cache), lrot(t, i)));
  cache.set(i, v); return v;
}

const TR = '_workspace/current/engineering/asset-pipeline/motion-bench/target-rig';
const rigs = {
  'human-command-boss': topo(readGlb(resolve(ROOT, `${TR}/human-command-boss-def-humanoid-v1.glb`)), 'hcb'),
  'dusk-warden': topo(readGlb(resolve(ROOT, `${TR}/dusk-warden-def-humanoid-v1.glb`)), 'dw'),
};
const ACTORS = ['shadow-commander-boss', 'shadow-soldier-v04', 'guard'];
const actors = Object.fromEntries(ACTORS.map(id =>
  [id, topo(readGlb(resolve(ROOT, `assets/motion/ingame/characters/${id}/model.glb`)), id)]));
const BONES = JSON.parse(readFileSync(resolve(ROOT, `${TR}/human-command-boss-def-humanoid-v1.provenance.json`), 'utf8')).poseAlignmentBones;

// A pure reference-frame error yields ONE constant delta quaternion for every bone.
for (const [rigName, rig] of Object.entries(rigs)) {
  console.log(`\n${'='.repeat(96)}\nCANONICAL = ${rigName}\n${'='.repeat(96)}`);
  const actor = actors['shadow-commander-boss'];
  console.log(`${'bone'.padEnd(17)}${'worldDeg'.padStart(11)}${'localDeg'.padStart(11)}   worldDelta q(actor^-1 * canonical)`);
  const deltas = [];
  for (const b of BONES) {
    const ci = rig.byName.get(b), ai = actor.byName.get(b);
    if (ci === undefined || ai === undefined) { console.log(`${b.padEnd(17)}  MISSING`); continue; }
    const w = angularDistanceDegrees(world(actor, ai), world(rig, ci));
    const l = angularDistanceDegrees(actor.nodes[ai].rotation ?? [0, 0, 0, 1], rig.nodes[ci].rotation ?? [0, 0, 0, 1]);
    let d = unit(qmul(conj(world(actor, ai)), world(rig, ci)));
    if (d[3] < 0) d = d.map(v => -v);              // canonical double-cover representative
    deltas.push(d);
    console.log(`${b.padEnd(17)}${w.toFixed(5).padStart(11)}${l.toFixed(5).padStart(11)}   [${d.map(v => v.toFixed(4).padStart(8)).join(', ')}]`);
  }
  const spread = Math.max(...deltas.map(d => angularDistanceDegrees(d, deltas[0])));
  console.log(`\n  >> max spread of world-delta vs first bone = ${spread.toFixed(5)} deg`);
  console.log(`  >> ${spread < 1 ? 'UNIFORM  -> single constant frame delta (H2 signature)' : 'SCATTERED -> per-bone authoring difference (H3 signature)'}`);
}

// Exercise the real certification gate on both rigs.
console.log(`\n${'='.repeat(96)}\nCERTIFICATION GATE (loadCertifiedRig equivalent)\n${'='.repeat(96)}`);
const { execFileSync } = await import('node:child_process');
const { createHash } = await import('node:crypto');
for (const name of ['human-command-boss-def-humanoid-v1', 'dusk-warden-def-humanoid-v1']) {
  const glbPath = resolve(ROOT, `${TR}/${name}.glb`);
  const prov = JSON.parse(readFileSync(resolve(ROOT, `${TR}/${name}.provenance.json`), 'utf8'));
  const actual = createHash('sha256').update(readFileSync(glbPath)).digest('hex');
  const problems = [];
  if (prov.targetRigSha256 !== actual) problems.push('KG_TARGET_RIG_HASH: provenance hash != file hash');
  if (!/^[0-9a-f]{64}$/.test(prov.targetRigSha256 ?? '')) problems.push('KG_TARGET_RIG_PROVENANCE: targetRigSha256 not 64-hex');
  if (typeof prov.originCommit !== 'string' || typeof prov.originPath !== 'string') problems.push('KG_TARGET_RIG_PROVENANCE: lineage incomplete');
  let recovered = null;
  try { recovered = execFileSync('git', ['show', `${prov.originCommit}:${prov.originPath}`], { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 }); }
  catch { problems.push('KG_TARGET_RIG_PROVENANCE: unable to read certified origin blob'); }
  if (recovered) {
    if (recovered.length !== prov.targetRigBytes) problems.push(`KG_TARGET_RIG_PROVENANCE: origin blob ${recovered.length} bytes != declared ${prov.targetRigBytes}`);
    if (createHash('sha256').update(recovered).digest('hex') !== actual) problems.push('KG_TARGET_RIG_PROVENANCE: certified rig does not match recovered origin blob');
  }
  console.log(`\n${name}:`);
  console.log(`   originPath = ${prov.originPath}`);
  console.log(problems.length ? problems.map(p => `   FAIL  ${p}`).join('\n') : '   PASS  certification checks satisfied');
}
