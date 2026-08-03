import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPOSITORY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../..",
);

// The tool under repair. It does not exist yet: every test below fails loudly
// on the missing-tool assertion rather than on a python3 "can't open file"
// exit, which would otherwise masquerade as the fail-closed exit 2 that the
// tamper tests assert.
const TOOL_PATH = "scripts/repair-static-rest-pose.py";

const POLICY_PATH =
  "_workspace/current/qa/motion-repair-20260803/static-pose-policy-v1.json";
const TARGET_RIG_PATH =
  "_workspace/current/engineering/asset-pipeline/motion-bench/target-rig/human-command-boss-def-humanoid-v1.glb";
const ACTORS_ROOT = "assets/motion/ingame/characters";
const EVIDENCE_MANIFEST_PATH =
  "_workspace/current/qa/motion-repair-20260803/pose-pairs-semantic-v3/render-manifest.json";

// The repair has landed: both production lanes now carry the repaired bytes,
// so the shipped tree is no longer a source of unrepaired input. The
// pre-repair blobs remain exactly recoverable from HEAD because the repair is
// uncommitted, via the same `git cat-file blob <rev>:<path>` idiom the
// target-rig provenance artifacts use. Both digests are pinned so a commit,
// amend or rebase that moves HEAD fails this suite loudly instead of silently
// re-feeding it repaired bytes and making every assertion below vacuous.
const UNREPAIRED_REV = "HEAD";
const PRE_REPAIR_SHA256 = {
  "ember-cohort":
    "4b59c24d94c9eb827ad3ff82e2450802250297d562d4ee4acd7d5411a249c5af",
  possessed:
    "e0e449903042f298a833da988e8e4e67a391db9253feaea0bfb9281f875be187",
};
const POST_REPAIR_SHA256 = {
  "ember-cohort":
    "8f2133868c49a55cc1c995fd029a74e7d7d04dd2e72ed7b29e30ed3bb7666345",
  possessed:
    "146f8194a7b030bc213fb80c4cc063a9c5546da4243b6e35a69931c052032e09",
};

const STDOUT_PREFIX = "STATIC_POSE_REPAIR_RESULT_JSON";

// Both requirements are 0.001 deg and the gate is max(world, local). A tool
// that only closes the local space leaves ember DEF-forearm.R at 8.116 deg of
// world error while reporting success.
const TOLERANCE_DEG = 0.001;

// The user-selected focus: two actors, seven bones each. Mirrors the policy but
// is restated here on purpose -- if the policy file is widened, the policy and
// this constant disagree and the widening test catches it.
const APPROVED_SET = {
  "ember-cohort": [
    "DEF-upper_arm.R",
    "DEF-forearm.R",
    "DEF-hand.R",
    "DEF-foot.L",
    "DEF-foot.R",
    "DEF-toe.L",
    "DEF-toe.R",
  ],
  possessed: [
    "DEF-foot.L",
    "DEF-foot.R",
    "DEF-toe.L",
    "DEF-toe.R",
    "DEF-forearm.L",
    "DEF-upper_arm.L",
    "DEF-hand.L",
  ],
};
const SELECTED_ACTORS = Object.keys(APPROVED_SET);
const SELECTED_BONE_COUNT = Object.values(APPROVED_SET).reduce(
  (total, bones) => total + bones.length,
  0,
);

// Bones whose LOCAL rest rotation already matches the target sub-gate; their
// pre-repair failure is purely inherited world error from an off-target
// ancestor. Measured from the shipped GLBs, not quoted from a report.
const SUB_GATE_LOCAL_SLOTS = new Set([
  "ember-cohort/DEF-forearm.R",
  "ember-cohort/DEF-hand.R",
  "possessed/DEF-forearm.L",
  "possessed/DEF-hand.L",
]);

// Deliberately out of policy scope: the opposite-side arm chain on each actor
// stays off-target. Any assertion phrased as a per-actor maximum would fail on
// these for a legitimate reason.
const OUT_OF_SCOPE_STILL_OFF_TARGET = {
  "ember-cohort": ["DEF-upper_arm.L", "DEF-forearm.L", "DEF-hand.L"],
  possessed: ["DEF-upper_arm.R", "DEF-forearm.R", "DEF-hand.R"],
};

const GLB_MAGIC = "glTF";
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

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

function sha256Of(absolutePath) {
  return createHash("sha256").update(readFileSync(absolutePath)).digest("hex");
}

function runtimeModelPath(assetId) {
  return `${ACTORS_ROOT}/${assetId}/model.glb`;
}

// ---------------------------------------------------------------------------
// Unrepaired input recovery. Fixtures must start from a genuinely off-target
// rig; sourcing them from the now-repaired working tree would turn "--write
// closes the residuals" into a no-op that passes by construction.
// ---------------------------------------------------------------------------

const unrepairedBytesCache = new Map();

function unrepairedModelBytes(assetId) {
  const cached = unrepairedBytesCache.get(assetId);
  if (cached) return cached;

  const expected = PRE_REPAIR_SHA256[assetId];
  assert.ok(expected, `no pinned pre-repair digest for ${assetId}`);

  const revision = `${UNREPAIRED_REV}:${runtimeModelPath(assetId)}`;
  const result = spawnSync("git", ["cat-file", "blob", revision], {
    cwd: REPOSITORY_ROOT,
    encoding: "buffer",
    maxBuffer: 256 * 1024 * 1024,
  });
  assert.equal(
    result.error,
    undefined,
    `git cat-file blob ${revision} failed to spawn: ${result.error?.message}`,
  );
  assert.equal(
    result.status,
    0,
    `git cat-file blob ${revision} exited ${result.status}: ${String(result.stderr ?? "")}`,
  );

  const bytes = result.stdout;
  const digest = createHash("sha256").update(bytes).digest("hex");
  assert.equal(
    digest,
    expected,
    `${assetId}: ${revision} is not the pinned pre-repair blob (got ${digest}); ` +
      "HEAD has moved, so this suite would be measuring repaired bytes",
  );

  unrepairedBytesCache.set(assetId, bytes);
  return bytes;
}

// Parsed fresh per call: parseGlbBytes hands back subarray views over the
// cached buffer, so callers get an independent document and never alias it.
function unrepairedGlb(assetId) {
  return parseGlbBytes(unrepairedModelBytes(assetId), `${assetId} (unrepaired)`);
}

// ---------------------------------------------------------------------------
// GLB reading -- deliberately independent of the tool. The gate is recomputed
// from the bytes the tool wrote, so a tool that reports a passing number it did
// not actually achieve still fails here.
// ---------------------------------------------------------------------------

function parseGlbBytes(bytes, label) {
  assert.ok(bytes.length >= 20, `${label}: truncated GLB`);
  assert.equal(bytes.toString("ascii", 0, 4), GLB_MAGIC, `${label}: magic`);
  assert.equal(bytes.readUInt32LE(4), 2, `${label}: GLB version`);
  assert.equal(bytes.readUInt32LE(8), bytes.length, `${label}: declared length`);

  const chunks = [];
  let offset = 12;
  while (offset < bytes.length) {
    assert.ok(offset + 8 <= bytes.length, `${label}: chunk header bounds`);
    const byteLength = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + byteLength;
    assert.ok(end <= bytes.length, `${label}: chunk payload bounds`);
    // A rewritten JSON chunk that forgets its 4-byte pad corrupts the BIN
    // chunk offset for every downstream reader.
    assert.equal(byteLength % 4, 0, `${label}: chunk ${type} is not 4-byte padded`);
    chunks.push({ type, bytes: bytes.subarray(start, end) });
    offset = end;
  }
  assert.equal(offset, bytes.length, `${label}: chunk layout`);

  const jsonChunks = chunks.filter((chunk) => chunk.type === CHUNK_JSON);
  const binaryChunks = chunks.filter((chunk) => chunk.type === CHUNK_BIN);
  assert.equal(jsonChunks.length, 1, `${label}: JSON chunk count`);
  assert.equal(binaryChunks.length, 1, `${label}: BIN chunk count`);

  const document = JSON.parse(
    jsonChunks[0].bytes.toString("utf8").replace(/[\0\x20]+$/u, ""),
  );
  const binary = binaryChunks[0].bytes;

  assert.equal(document.buffers?.length, 1, `${label}: buffer count`);
  assert.equal(document.buffers[0].uri, undefined, `${label}: external buffer`);
  assert.ok(
    document.buffers[0].byteLength <= binary.length &&
      binary.length - document.buffers[0].byteLength < 4,
    `${label}: embedded buffer length disagrees with the BIN chunk`,
  );

  return { document, binary, byteLength: bytes.length };
}

function readGlb(absolutePath, label) {
  return parseGlbBytes(readFileSync(absolutePath), label);
}

// ---------------------------------------------------------------------------
// Quaternion / rig math. Reproduces the shipped
// static-rest-residuals.json values exactly, so the numbers below are checked
// against a Blender-derived artifact rather than invented here.
// ---------------------------------------------------------------------------

function quaternionMultiply(a, b) {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

function quaternionLength(q) {
  return Math.sqrt(q.reduce((total, component) => total + component * component, 0));
}

function quaternionNormalize(q) {
  const length = quaternionLength(q);
  assert.ok(length > 0, "degenerate quaternion");
  return q.map((component) => component / length);
}

// Shortest-arc angle; q and -q are the same rotation, hence the abs().
function angleBetweenDeg(a, b) {
  const na = quaternionNormalize(a);
  const nb = quaternionNormalize(b);
  const dot = Math.min(1, Math.abs(na.reduce((sum, x, i) => sum + x * nb[i], 0)));
  return (2 * Math.acos(dot) * 180) / Math.PI;
}

function buildRig(document, label) {
  const parentOf = new Map();
  document.nodes.forEach((node, index) => {
    for (const child of node.children ?? []) {
      assert.ok(!parentOf.has(child), `${label}: node ${child} has two parents`);
      parentOf.set(child, index);
    }
  });

  const indexOfBone = new Map();
  document.nodes.forEach((node, index) => {
    if (node.name) indexOfBone.set(node.name, index);
  });

  const localOf = (index) => document.nodes[index].rotation ?? [0, 0, 0, 1];

  const worldOf = (index) => {
    let current = index;
    let rotation = localOf(current);
    const guard = new Set([current]);
    while (parentOf.has(current)) {
      current = parentOf.get(current);
      assert.ok(!guard.has(current), `${label}: cycle in the node hierarchy`);
      guard.add(current);
      rotation = quaternionMultiply(localOf(current), rotation);
    }
    return rotation;
  };

  return { document, parentOf, indexOfBone, localOf, worldOf, label };
}

function residualsFor(actorRig, targetRig, bone) {
  const actorIndex = actorRig.indexOfBone.get(bone);
  const targetIndex = targetRig.indexOfBone.get(bone);
  assert.ok(actorIndex !== undefined, `${actorRig.label}: missing bone ${bone}`);
  assert.ok(targetIndex !== undefined, `${targetRig.label}: missing bone ${bone}`);
  return {
    worldDeg: angleBetweenDeg(
      actorRig.worldOf(actorIndex),
      targetRig.worldOf(targetIndex),
    ),
    localDeg: angleBetweenDeg(
      actorRig.localOf(actorIndex),
      targetRig.localOf(targetIndex),
    ),
  };
}

function worstResidualDeg({ worldDeg, localDeg }) {
  return Math.max(worldDeg, localDeg);
}

// ---------------------------------------------------------------------------
// Fixtures. Every run happens against copies under a temp root so the shipped
// runtime and staged lanes are never the subject of a --write.
// ---------------------------------------------------------------------------

function copyInto(root, repositoryRelativePath) {
  const destination = join(root, repositoryRelativePath);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(repositoryPath(repositoryRelativePath), destination);
  return destination;
}

function createFixture({ actors = SELECTED_ACTORS } = {}) {
  const root = mkdtempSync(join(tmpdir(), "static-rest-pose-repair-"));
  // The relative layout is preserved so the policy's own relative evidence
  // reference (pose-pairs-semantic-v3/render-manifest.json) resolves inside the
  // fixture instead of reaching back into the repository.
  const policy = copyInto(root, POLICY_PATH);
  const targetRig = copyInto(root, TARGET_RIG_PATH);
  const manifest = copyInto(root, EVIDENCE_MANIFEST_PATH);
  // Sourced from the pre-repair blob, not the repaired working tree, so
  // `--write` has real residuals to close.
  const models = new Map(
    actors.map((assetId) => {
      const destination = join(root, runtimeModelPath(assetId));
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, unrepairedModelBytes(assetId));
      return [assetId, destination];
    }),
  );
  return {
    root,
    policy,
    targetRig,
    manifest,
    models,
    actorsRoot: join(root, ACTORS_ROOT),
    modelPath(assetId) {
      const path = models.get(assetId);
      assert.ok(path, `fixture has no copy of ${assetId}`);
      return path;
    },
  };
}

function defaultArgs(fixture) {
  return [
    "--policy",
    fixture.policy,
    "--target-rig",
    fixture.targetRig,
    "--actors-root",
    fixture.actorsRoot,
  ];
}

function runTool(fixture, args) {
  // Guard first: without the tool, python3 exits 2 on a missing file, which
  // would otherwise be indistinguishable from the tool's own fail-closed exit.
  assert.ok(
    existsSync(repositoryPath(TOOL_PATH)),
    `missing tool under repair: ${TOOL_PATH}`,
  );
  const result = spawnSync("python3", [repositoryPath(TOOL_PATH), ...args], {
    cwd: fixture.root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(result.error, undefined, `spawn failed: ${result.error?.message}`);
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function parseResultLine({ stdout, stderr, status }) {
  const line = stdout
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .find((entry) => entry.startsWith(`${STDOUT_PREFIX}:`));
  assert.ok(
    line,
    `stdout carried no ${STDOUT_PREFIX} line (status ${status}): ${stdout || stderr}`,
  );
  const payload = JSON.parse(line.slice(`${STDOUT_PREFIX}:`.length));
  assert.equal(payload.schemaVersion, 1, "result schemaVersion");
  assert.ok(Array.isArray(payload.actors), "result actors[]");
  assert.ok(Array.isArray(payload.failures), "result failures[] must never be null");
  assert.ok(
    Array.isArray(payload.unlistedDrift),
    "result unlistedDrift[] must never be null",
  );
  return payload;
}

function actorReport(payload, assetId) {
  const entry = payload.actors.find((actor) => actor.assetId === assetId);
  assert.ok(entry, `result carried no actor entry for ${assetId}`);
  assert.ok(Array.isArray(entry.bones), `${assetId}: bones[]`);
  return entry;
}

function boneReport(entry, bone) {
  const found = entry.bones.find((candidate) => candidate.bone === bone);
  assert.ok(found, `${entry.assetId}: result carried no bone entry for ${bone}`);
  return found;
}

let repairedFixtureCache;

// One --write drives tests 2-4; they read different invariants off the same
// mutation rather than paying for three 34 MB fixtures.
function repairedFixture() {
  if (!repairedFixtureCache) {
    const fixture = createFixture();
    const digestsBefore = new Map(
      SELECTED_ACTORS.map((assetId) => [
        assetId,
        sha256Of(fixture.modelPath(assetId)),
      ]),
    );
    const run = runTool(fixture, [...defaultArgs(fixture), "--write"]);
    repairedFixtureCache = {
      fixture,
      run,
      payload: parseResultLine(run),
      digestsBefore,
    };
  }
  return repairedFixtureCache;
}

function pristineRig(assetId) {
  return buildRig(unrepairedGlb(assetId).document, `${assetId} (unrepaired)`);
}

function targetRigDocument() {
  return buildRig(
    readGlb(repositoryPath(TARGET_RIG_PATH), "target rig").document,
    "target rig",
  );
}

function accessorByteRange(document, accessorIndex, label) {
  const accessor = document.accessors?.[accessorIndex];
  assert.ok(accessor, `${label}: accessor ${accessorIndex}`);
  assert.equal(accessor.sparse, undefined, `${label}: sparse accessor`);
  const view = document.bufferViews?.[accessor.bufferView];
  assert.ok(view, `${label}: bufferView ${accessor.bufferView}`);
  const componentBytes = {
    5120: 1,
    5121: 1,
    5122: 2,
    5123: 2,
    5125: 4,
    5126: 4,
  }[accessor.componentType];
  const components = {
    SCALAR: 1,
    VEC2: 2,
    VEC3: 3,
    VEC4: 4,
    MAT2: 4,
    MAT3: 9,
    MAT4: 16,
  }[accessor.type];
  assert.ok(componentBytes, `${label}: componentType ${accessor.componentType}`);
  assert.ok(components, `${label}: type ${accessor.type}`);
  const elementBytes = componentBytes * components;
  const stride = view.byteStride ?? elementBytes;
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const end = start + (accessor.count - 1) * stride + elementBytes;
  return { start, end };
}

function accessorBytes(glb, accessorIndex, label) {
  const { start, end } = accessorByteRange(glb.document, accessorIndex, label);
  assert.ok(end <= glb.binary.length, `${label}: accessor payload out of BIN bounds`);
  return glb.binary.subarray(start, end);
}

function samplerOutputAccessors(document) {
  const outputs = new Set();
  for (const animation of document.animations ?? []) {
    for (const sampler of animation.samplers ?? []) {
      outputs.add(sampler.output);
    }
  }
  return [...outputs].sort((a, b) => a - b);
}

function writePolicy(fixture, mutate) {
  const policy = JSON.parse(readFileSync(fixture.policy, "utf8"));
  mutate(policy);
  writeFileSync(fixture.policy, `${JSON.stringify(policy, null, 2)}\n`);
}

// ---------------------------------------------------------------------------

test("--check reports every focused bone as a pre-gate failure and writes nothing", () => {
  const fixture = createFixture();
  const digestsBefore = new Map(
    SELECTED_ACTORS.map((assetId) => [assetId, sha256Of(fixture.modelPath(assetId))]),
  );

  const run = runTool(fixture, [...defaultArgs(fixture), "--check"]);
  const payload = parseResultLine(run);

  assert.equal(payload.mode, "check");
  assert.equal(payload.pass, false, "--check must not pass on the unrepaired tree");
  assert.equal(run.status, 1, "gate failure is exit 1, with the result still on stdout");
  assert.equal(payload.toleranceWorldDeg, TOLERANCE_DEG);
  assert.equal(payload.toleranceLocalDeg, TOLERANCE_DEG);
  assert.equal(payload.policyDecision, "focused-ember-cohort-and-possessed");

  // The focus is exactly the user's selection: two actors, no more.
  assert.deepEqual(
    payload.actors.map((actor) => actor.assetId).sort(),
    [...SELECTED_ACTORS].sort(),
    "--check must scope to the policy actors only",
  );

  const target = targetRigDocument();
  let reported = 0;

  for (const [assetId, bones] of Object.entries(APPROVED_SET)) {
    const entry = actorReport(payload, assetId);
    assert.equal(entry.written, false, `${assetId}: --check must not write`);
    assert.equal(
      entry.sha256After,
      entry.sha256Before,
      `${assetId}: --check must report an unchanged digest`,
    );
    assert.deepEqual(
      entry.bones.map((bone) => bone.bone).sort(),
      [...bones].sort(),
      `${assetId}: reported bones must be exactly the policy bones`,
    );

    const actor = pristineRig(assetId);
    for (const bone of bones) {
      const measured = residualsFor(actor, target, bone);
      // Independently established: all 14 slots are out of gate before repair,
      // though four of them only in the world space.
      assert.ok(
        worstResidualDeg(measured) > TOLERANCE_DEG,
        `${assetId}/${bone}: expected a pre-repair gate failure, measured world=${measured.worldDeg} local=${measured.localDeg}`,
      );

      const boneEntry = boneReport(entry, bone);
      assert.equal(
        boneEntry.withinTolerance,
        false,
        `${assetId}/${bone}: must be reported out of tolerance before repair`,
      );
      // The report has to agree with the bytes, in both spaces.
      assert.ok(
        Math.abs(boneEntry.preWorldResidualDeg - measured.worldDeg) <= 1e-4,
        `${assetId}/${bone}: reported preWorld ${boneEntry.preWorldResidualDeg} disagrees with measured ${measured.worldDeg}`,
      );
      assert.ok(
        Math.abs(boneEntry.preLocalResidualDeg - measured.localDeg) <= 1e-4,
        `${assetId}/${bone}: reported preLocal ${boneEntry.preLocalResidualDeg} disagrees with measured ${measured.localDeg}`,
      );

      // A local-only gate would silently pass these four while they sit ~8 deg
      // and ~2.9 deg out in the world space.
      if (SUB_GATE_LOCAL_SLOTS.has(`${assetId}/${bone}`)) {
        assert.ok(
          measured.localDeg <= TOLERANCE_DEG,
          `${assetId}/${bone}: expected a sub-gate local residual`,
        );
        assert.ok(
          measured.worldDeg > TOLERANCE_DEG,
          `${assetId}/${bone}: expected inherited world error`,
        );
      }

      const failure = payload.failures.find(
        (candidate) => candidate.assetId === assetId && candidate.bone === bone,
      );
      assert.ok(failure, `${assetId}/${bone}: missing from failures[]`);
      reported += 1;
    }
  }

  assert.equal(reported, SELECTED_BONE_COUNT, "all 14 focused bones must be reported");
  assert.equal(
    payload.failures.length,
    SELECTED_BONE_COUNT,
    "failures[] must carry exactly the 14 focused bones",
  );

  for (const assetId of SELECTED_ACTORS) {
    assert.equal(
      sha256Of(fixture.modelPath(assetId)),
      digestsBefore.get(assetId),
      `${assetId}: --check rewrote the model`,
    );
  }
});

test("--write then --check closes both world and local residuals for all 14 focused bones", () => {
  const { fixture, run, payload, digestsBefore } = repairedFixture();

  assert.equal(payload.mode, "write");
  assert.equal(payload.pass, true, `--write did not reach a passing gate: ${run.stderr}`);
  assert.equal(run.status, 0, `--write exit status; stderr: ${run.stderr}`);
  assert.deepEqual(payload.failures, [], "a passing write reports no failures");
  assert.deepEqual(payload.unlistedDrift, [], "a passing write reports no unlisted drift");

  const target = targetRigDocument();

  for (const [assetId, bones] of Object.entries(APPROVED_SET)) {
    const entry = actorReport(payload, assetId);
    assert.equal(entry.written, true, `${assetId}: expected a write`);
    assert.notEqual(
      entry.sha256After,
      entry.sha256Before,
      `${assetId}: a repaired model must change digest`,
    );
    assert.equal(
      entry.sha256Before,
      digestsBefore.get(assetId),
      `${assetId}: reported sha256Before disagrees with the fixture input`,
    );
    assert.equal(
      entry.sha256After,
      sha256Of(fixture.modelPath(assetId)),
      `${assetId}: reported sha256After disagrees with the bytes on disk`,
    );

    // Recomputed from the bytes the tool wrote -- the tool's own numbers are
    // cross-checked against this, never trusted in its place.
    const repaired = buildRig(
      readGlb(fixture.modelPath(assetId), `${assetId} (repaired)`).document,
      `${assetId} (repaired)`,
    );

    for (const bone of bones) {
      const measured = residualsFor(repaired, target, bone);
      assert.ok(
        measured.worldDeg <= TOLERANCE_DEG,
        `${assetId}/${bone}: post-repair world residual ${measured.worldDeg} exceeds ${TOLERANCE_DEG}`,
      );
      assert.ok(
        measured.localDeg <= TOLERANCE_DEG,
        `${assetId}/${bone}: post-repair local residual ${measured.localDeg} exceeds ${TOLERANCE_DEG}`,
      );

      const boneEntry = boneReport(entry, bone);
      assert.equal(
        boneEntry.withinTolerance,
        true,
        `${assetId}/${bone}: must be reported within tolerance after repair`,
      );
      assert.ok(
        boneEntry.postWorldResidualDeg <= TOLERANCE_DEG,
        `${assetId}/${bone}: reported postWorld ${boneEntry.postWorldResidualDeg}`,
      );
      assert.ok(
        boneEntry.postLocalResidualDeg <= TOLERANCE_DEG,
        `${assetId}/${bone}: reported postLocal ${boneEntry.postLocalResidualDeg}`,
      );
      assert.ok(
        Math.abs(boneEntry.postWorldResidualDeg - measured.worldDeg) <= 1e-4,
        `${assetId}/${bone}: reported postWorld disagrees with the written bytes`,
      );
      // withinTolerance must be derived from BOTH reported spaces. A tool that
      // reports a world residual but gates only on the local one would satisfy
      // every assertion above while leaving the world requirement unenforced.
      assert.equal(
        boneEntry.withinTolerance,
        Math.max(boneEntry.postWorldResidualDeg, boneEntry.postLocalResidualDeg) <=
          TOLERANCE_DEG,
        `${assetId}/${bone}: withinTolerance is not max(world, local) <= tolerance`,
      );

      // A bone already locally correct must not be claimed as an effective
      // repair; its world fix came from the ancestor, not from this slot.
      assert.equal(
        boneEntry.effective,
        !SUB_GATE_LOCAL_SLOTS.has(`${assetId}/${bone}`),
        `${assetId}/${bone}: effective flag misreports whether this slot moved`,
      );
    }

    // Out-of-scope bones must remain untouched and therefore still off-target;
    // a tool that "helpfully" fixed them has widened the selection.
    for (const bone of OUT_OF_SCOPE_STILL_OFF_TARGET[assetId]) {
      const measured = residualsFor(repaired, target, bone);
      assert.ok(
        worstResidualDeg(measured) > TOLERANCE_DEG,
        `${assetId}/${bone}: out-of-scope bone was repaired; the selection was widened`,
      );
    }
  }

  // The gate has to hold under a fresh, independent --check of the written tree.
  const recheck = runTool(fixture, [...defaultArgs(fixture), "--check"]);
  const recheckPayload = parseResultLine(recheck);
  assert.equal(recheck.status, 0, `--check after --write; stderr: ${recheck.stderr}`);
  assert.equal(recheckPayload.mode, "check");
  assert.equal(recheckPayload.pass, true, "--check must pass on the repaired tree");
  assert.deepEqual(recheckPayload.failures, []);

  let verified = 0;
  for (const [assetId, bones] of Object.entries(APPROVED_SET)) {
    const entry = actorReport(recheckPayload, assetId);
    assert.equal(entry.written, false, `${assetId}: re-check must not write`);
    for (const bone of bones) {
      const boneEntry = boneReport(entry, bone);
      assert.ok(boneEntry.postWorldResidualDeg <= TOLERANCE_DEG);
      assert.ok(boneEntry.postLocalResidualDeg <= TOLERANCE_DEG);
      verified += 1;
    }
  }
  assert.equal(verified, SELECTED_BONE_COUNT);
});

test("--write moves only the selected node rotations and leaves every other node property intact", () => {
  const { fixture } = repairedFixture();
  const target = targetRigDocument();

  for (const [assetId, bones] of Object.entries(APPROVED_SET)) {
    const before = unrepairedGlb(assetId).document;
    const after = readGlb(fixture.modelPath(assetId), `${assetId} (repaired)`).document;

    assert.equal(
      after.nodes.length,
      before.nodes.length,
      `${assetId}: node count changed`,
    );

    const selected = new Set(bones);
    const changedRotations = [];

    for (const [index, beforeNode] of before.nodes.entries()) {
      const afterNode = after.nodes[index];
      const name = beforeNode.name;
      assert.equal(afterNode.name, name, `${assetId}: node ${index} was renamed`);

      // Everything that is not the rest rotation must survive byte-for-byte,
      // including translation, scale, children, skin and mesh bindings.
      const strip = (node) => {
        const { rotation, ...rest } = node;
        return rest;
      };
      assert.deepEqual(
        strip(afterNode),
        strip(beforeNode),
        `${assetId}: node ${index} (${name}) changed outside its rotation`,
      );

      const beforeRotation = beforeNode.rotation ?? null;
      const afterRotation = afterNode.rotation ?? null;
      const rotationChanged =
        JSON.stringify(beforeRotation) !== JSON.stringify(afterRotation);

      if (!selected.has(name)) {
        assert.equal(
          rotationChanged,
          false,
          `${assetId}: unselected node ${index} (${name}) had its rotation rewritten`,
        );
        continue;
      }

      if (rotationChanged) changedRotations.push(name);

      // Whatever was written must be a usable unit quaternion and must be the
      // target's local rest rotation, not an arbitrary value that happens to
      // satisfy the gate.
      assert.ok(Array.isArray(afterRotation), `${assetId}/${name}: rotation must exist`);
      assert.equal(afterRotation.length, 4, `${assetId}/${name}: rotation arity`);
      for (const component of afterRotation) {
        assert.equal(
          Number.isFinite(component),
          true,
          `${assetId}/${name}: non-finite rotation component`,
        );
      }
      assert.ok(
        Math.abs(quaternionLength(afterRotation) - 1) <= 1e-6,
        `${assetId}/${name}: rotation is not unit-norm (${quaternionLength(afterRotation)})`,
      );
      const targetIndex = target.indexOfBone.get(name);
      assert.ok(
        angleBetweenDeg(afterRotation, target.localOf(targetIndex)) <= TOLERANCE_DEG,
        `${assetId}/${name}: written rotation is not the target local rest rotation`,
      );
    }

    // The root and the rest of the hierarchy are untouched, so root motion and
    // the scene binding survive.
    assert.deepEqual(after.scenes, before.scenes, `${assetId}: scenes changed`);
    assert.equal(after.scene, before.scene, `${assetId}: default scene changed`);
    for (const rootIndex of before.scenes[before.scene ?? 0].nodes) {
      assert.deepEqual(
        after.nodes[rootIndex],
        before.nodes[rootIndex],
        `${assetId}: root node ${rootIndex} changed`,
      );
    }

    assert.ok(
      changedRotations.length > 0,
      `${assetId}: --write changed no rotation at all`,
    );
    for (const name of changedRotations) {
      assert.ok(
        selected.has(name),
        `${assetId}: ${name} changed but is not in the selection`,
      );
    }
  }
});

test("--write preserves the BIN payload, IBMs, animation samplers and clip names byte-for-byte", () => {
  const { fixture } = repairedFixture();

  for (const assetId of SELECTED_ACTORS) {
    const before = readGlb(
      repositoryPath(runtimeModelPath(assetId)),
      `${assetId} (shipped)`,
    );
    const after = readGlb(fixture.modelPath(assetId), `${assetId} (repaired)`);

    // The repair is a JSON-chunk edit. One byte of drift in the BIN chunk means
    // geometry, weights or keyframes were re-encoded.
    assert.equal(
      after.binary.length,
      before.binary.length,
      `${assetId}: BIN chunk length changed`,
    );
    assert.ok(
      after.binary.equals(before.binary),
      `${assetId}: BIN chunk payload is not byte-identical`,
    );

    // Accessor and bufferView tables address that payload; if they move, the
    // identical BIN bytes are being read as different data.
    assert.deepEqual(
      after.document.accessors,
      before.document.accessors,
      `${assetId}: accessor table changed`,
    );
    assert.deepEqual(
      after.document.bufferViews,
      before.document.bufferViews,
      `${assetId}: bufferView table changed`,
    );
    assert.deepEqual(
      after.document.buffers,
      before.document.buffers,
      `${assetId}: buffer table changed`,
    );

    // Inverse bind matrices: same accessor index and same bytes. Rewriting the
    // rest pose without touching IBMs is the whole point -- a tool that rebakes
    // them silently rebinds the skin.
    assert.equal(
      after.document.skins?.length,
      before.document.skins?.length,
      `${assetId}: skin count changed`,
    );
    for (const [skinIndex, beforeSkin] of before.document.skins.entries()) {
      const afterSkin = after.document.skins[skinIndex];
      assert.equal(
        afterSkin.inverseBindMatrices,
        beforeSkin.inverseBindMatrices,
        `${assetId}: skin ${skinIndex} IBM accessor index changed`,
      );
      assert.deepEqual(
        afterSkin.joints,
        beforeSkin.joints,
        `${assetId}: skin ${skinIndex} joint list changed`,
      );
      assert.equal(
        afterSkin.skeleton,
        beforeSkin.skeleton,
        `${assetId}: skin ${skinIndex} skeleton root changed`,
      );
      const label = `${assetId} skin ${skinIndex} IBM`;
      assert.ok(
        accessorBytes(after, afterSkin.inverseBindMatrices, label).equals(
          accessorBytes(before, beforeSkin.inverseBindMatrices, label),
        ),
        `${assetId}: skin ${skinIndex} inverse bind matrix payload changed`,
      );
    }

    // Clip names are the runtime contract; the registry looks clips up by name.
    const beforeClips = before.document.animations.map((clip) => clip.name);
    const afterClips = after.document.animations.map((clip) => clip.name);
    assert.deepEqual(afterClips, beforeClips, `${assetId}: animation clip names changed`);
    assert.equal(
      afterClips.length,
      11,
      `${assetId}: expected the shipped 11-clip contract`,
    );
    for (const name of afterClips) {
      assert.ok(
        name.startsWith(`${assetId}::`) && name.endsWith("::v01"),
        `${assetId}: clip name outside the shipped convention: ${name}`,
      );
    }

    // Sampler channels and their keyframe payloads: an edited rest pose must
    // not be "compensated" into the animation data.
    assert.deepEqual(
      after.document.animations.map((clip) => clip.channels),
      before.document.animations.map((clip) => clip.channels),
      `${assetId}: animation channel targets changed`,
    );
    assert.deepEqual(
      after.document.animations.map((clip) => clip.samplers),
      before.document.animations.map((clip) => clip.samplers),
      `${assetId}: animation sampler definitions changed`,
    );

    const outputs = samplerOutputAccessors(before.document);
    assert.deepEqual(
      samplerOutputAccessors(after.document),
      outputs,
      `${assetId}: sampler output accessor set changed`,
    );
    assert.ok(outputs.length > 0, `${assetId}: no animation sampler outputs found`);
    for (const accessorIndex of outputs) {
      const label = `${assetId} sampler output ${accessorIndex}`;
      assert.ok(
        accessorBytes(after, accessorIndex, label).equals(
          accessorBytes(before, accessorIndex, label),
        ),
        `${assetId}: sampler output accessor ${accessorIndex} payload changed`,
      );
    }

    assert.deepEqual(
      after.document.meshes,
      before.document.meshes,
      `${assetId}: mesh table changed`,
    );
    assert.deepEqual(
      after.document.asset,
      before.document.asset,
      `${assetId}: asset block changed`,
    );

    // Runtime-lane hygiene: an authoring path must never be baked into a
    // shipped GLB.
    assert.equal(
      JSON.stringify(after.document).includes("_workspace"),
      false,
      `${assetId}: an authoring path leaked into the runtime GLB`,
    );
  }
});

test("tampered evidence hashes fail closed before any write", () => {
  for (const scenario of [
    {
      name: "target rig digest",
      code: "SPR_TARGET_RIG_HASH",
      mutate: (fixture) =>
        writePolicy(fixture, (policy) => {
          policy.evidence.targetRigSha256 = "0".repeat(64);
        }),
    },
    {
      name: "evidence manifest digest",
      code: "SPR_POLICY_HASH",
      mutate: (fixture) =>
        writePolicy(fixture, (policy) => {
          policy.evidence.manifestSha256 = "0".repeat(64);
        }),
    },
    {
      name: "evidence manifest bytes",
      code: "SPR_POLICY_HASH",
      mutate: (fixture) => {
        const manifest = JSON.parse(readFileSync(fixture.manifest, "utf8"));
        manifest.tamperedByTest = true;
        writeFileSync(fixture.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
      },
    },
    {
      name: "target rig bytes",
      code: "SPR_TARGET_RIG_HASH",
      mutate: (fixture) => {
        const bytes = readFileSync(fixture.targetRig);
        // Flip a byte inside the JSON chunk payload, keeping the container
        // parseable so the failure is the digest and not a parse error.
        bytes[bytes.length - 1] = bytes[bytes.length - 1] === 0x20 ? 0x09 : 0x20;
        writeFileSync(fixture.targetRig, bytes);
      },
    },
  ]) {
    const fixture = createFixture({ actors: ["ember-cohort"] });
    const digestBefore = sha256Of(fixture.modelPath("ember-cohort"));
    scenario.mutate(fixture);

    const run = runTool(fixture, [...defaultArgs(fixture), "--write"]);
    assert.equal(
      run.status,
      2,
      `${scenario.name}: expected fail-closed exit 2, got ${run.status} (${run.stdout || run.stderr})`,
    );
    assert.equal(
      run.stdout.trim(),
      "",
      `${scenario.name}: fail-closed must not emit a result on stdout`,
    );
    assert.ok(
      run.stderr.includes(scenario.code),
      `${scenario.name}: expected ${scenario.code} on stderr, got: ${run.stderr}`,
    );
    assert.equal(
      sha256Of(fixture.modelPath("ember-cohort")),
      digestBefore,
      `${scenario.name}: the model was written despite failing closed`,
    );
  }
});

test("the selected-bone set cannot be widened through the policy file", () => {
  for (const scenario of [
    {
      name: "extra bone on a selected actor",
      mutate: (policy) => {
        policy.actors["ember-cohort"].bones.push("DEF-spine");
      },
    },
    {
      name: "extra actor",
      mutate: (policy) => {
        policy.actors.guard = { bones: ["DEF-foot.L"] };
        policy.excludedActors = policy.excludedActors.filter(
          (actorId) => actorId !== "guard",
        );
      },
    },
    {
      name: "swapped side on a selected bone",
      mutate: (policy) => {
        policy.actors.possessed.bones = policy.actors.possessed.bones.map((bone) =>
          bone === "DEF-upper_arm.L" ? "DEF-upper_arm.R" : bone,
        );
      },
    },
    {
      name: "dropped bone",
      mutate: (policy) => {
        policy.actors["ember-cohort"].bones = policy.actors["ember-cohort"].bones.filter(
          (bone) => bone !== "DEF-toe.R",
        );
      },
    },
  ]) {
    const fixture = createFixture({ actors: ["ember-cohort"] });
    const digestBefore = sha256Of(fixture.modelPath("ember-cohort"));
    writePolicy(fixture, scenario.mutate);

    const run = runTool(fixture, [...defaultArgs(fixture), "--write"]);
    assert.equal(
      run.status,
      2,
      `${scenario.name}: expected fail-closed exit 2, got ${run.status} (${run.stdout || run.stderr})`,
    );
    assert.equal(
      run.stdout.trim(),
      "",
      `${scenario.name}: fail-closed must not emit a result on stdout`,
    );
    assert.ok(
      run.stderr.includes("SPR_POLICY_SET"),
      `${scenario.name}: expected SPR_POLICY_SET on stderr, got: ${run.stderr}`,
    );
    assert.equal(
      sha256Of(fixture.modelPath("ember-cohort")),
      digestBefore,
      `${scenario.name}: the model was written despite a widened selection`,
    );
  }

  // An --asset-id outside the approved set must not become a side door.
  const fixture = createFixture({ actors: ["ember-cohort"] });
  const digestBefore = sha256Of(fixture.modelPath("ember-cohort"));
  const run = runTool(fixture, [
    ...defaultArgs(fixture),
    "--write",
    "--asset-id",
    "guard",
  ]);
  assert.notEqual(run.status, 0, "--asset-id outside the policy must not succeed");
  assert.equal(
    sha256Of(fixture.modelPath("ember-cohort")),
    digestBefore,
    "an out-of-policy --asset-id mutated a model",
  );
});

test("the shipped runtime and staged lanes are never the subject of a repair run", (t) => {
  // Containment can no longer be read off the production pose: the repair is a
  // fixed point, so an accidental in-place run would leave the digests exactly
  // where they are. The proof is therefore structural -- every path this suite
  // ever hands the tool resolves inside a mkdtemp root and outside the
  // repository -- and is paired with a pin on the landed production state.
  const probe = disposableFixture(t);

  for (const candidate of [probe.policy, probe.targetRig, probe.actorsRoot]) {
    const fromFixture = relative(probe.root, candidate);
    assert.ok(
      fromFixture !== ".." && !fromFixture.startsWith(`..${sep}`),
      `the tool was handed a path outside the fixture root: ${candidate}`,
    );
    const fromRepository = relative(REPOSITORY_ROOT, candidate);
    assert.ok(
      fromRepository === ".." || fromRepository.startsWith(`..${sep}`),
      `the tool was handed a repository path: ${candidate}`,
    );
  }

  // --actors-root is the only argument that selects what a --write may touch,
  // and every runTool call in this file spreads defaultArgs, so pinning it
  // pins the blast radius of the whole suite.
  const args = defaultArgs(probe);
  assert.equal(
    args[args.indexOf("--actors-root") + 1],
    probe.actorsRoot,
    "--actors-root is not the fixture actors root",
  );
  for (const assetId of SELECTED_ACTORS) {
    const fromFixture = relative(probe.root, repositoryPath(runtimeModelPath(assetId)));
    assert.ok(
      fromFixture === ".." || fromFixture.startsWith(`..${sep}`),
      `${assetId}: the production model is reachable inside the fixture root`,
    );
  }

  // The landed production state, pinned in both lanes.
  const stagedRoot =
    "_workspace/current/engineering/asset-pipeline/character-motion-library";
  const target = targetRigDocument();

  for (const assetId of SELECTED_ACTORS) {
    const runtime = repositoryPath(runtimeModelPath(assetId));
    const staged = repositoryPath(`${stagedRoot}/${assetId}/model.glb`);
    assert.ok(statSync(runtime).isFile(), `${assetId}: shipped runtime model missing`);
    assert.ok(statSync(staged).isFile(), `${assetId}: staged library model missing`);

    const runtimeDigest = sha256Of(runtime);
    assert.equal(
      runtimeDigest,
      POST_REPAIR_SHA256[assetId],
      `${assetId}: the shipped runtime lane is not the landed post-repair blob`,
    );
    assert.equal(
      sha256Of(staged),
      POST_REPAIR_SHA256[assetId],
      `${assetId}: the staged library lane is not the landed post-repair blob`,
    );
    assert.notEqual(
      runtimeDigest,
      PRE_REPAIR_SHA256[assetId],
      `${assetId}: the production lane still carries the pre-repair blob`,
    );

    // The repair actually holds in the bytes that shipped, measured the same
    // way the gate measures it rather than quoted from the tool's report.
    const actor = buildRig(
      readGlb(runtime, `${assetId} (shipped)`).document,
      `${assetId} (shipped)`,
    );
    for (const bone of APPROVED_SET[assetId]) {
      const measured = residualsFor(actor, target, bone);
      assert.ok(
        measured.worldDeg <= TOLERANCE_DEG,
        `${assetId}/${bone}: shipped world residual ${measured.worldDeg} exceeds ${TOLERANCE_DEG}`,
      );
      assert.ok(
        measured.localDeg <= TOLERANCE_DEG,
        `${assetId}/${bone}: shipped local residual ${measured.localDeg} exceeds ${TOLERANCE_DEG}`,
      );
    }

    // Out-of-scope bones were never in the selection and must still be
    // off-target in the lane that shipped.
    for (const bone of OUT_OF_SCOPE_STILL_OFF_TARGET[assetId]) {
      assert.ok(
        worstResidualDeg(residualsFor(actor, target, bone)) > TOLERANCE_DEG,
        `${assetId}/${bone}: an out-of-scope bone was repaired in the shipped lane`,
      );
    }
  }
});

// ===========================================================================
// Hardening regressions. Each block below pins one contract item the review
// found unenforced. Every malformed case is synthesized by editing a real
// copied GLB, never by mocking or stubbing the tool.
// ===========================================================================

import { readdirSync, rmSync } from "node:fs";

// createFixture leaves its mkdtemp root behind. Each fixture is 12-24 MB of
// copied GLB, and the blocks below allocate thirteen of them, so they are
// disposed per test rather than accumulating across runs.
function disposableFixture(t, options) {
  const fixture = createFixture(options);
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  return fixture;
}

// A chunk type outside the glTF 2.0 pair. The spec lets a *client* skip an
// unknown chunk; this tool may not, because it re-serializes to a two-chunk
// container and would silently drop whatever the third chunk carried.
const CHUNK_UNKNOWN = 0x4e4b4e55;

// Serialize a GLB from parts. `binary` is emitted verbatim with no re-padding
// so a deliberately misaligned BIN chunk can be constructed.
function serializeGlb({ document, binary, extraChunks = [] }) {
  const json = Buffer.from(JSON.stringify(document), "utf8");
  const jsonChunk = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const chunkOf = (type, payload) => {
    const head = Buffer.alloc(8);
    head.writeUInt32LE(payload.length, 0);
    head.writeUInt32LE(type, 4);
    return Buffer.concat([head, payload]);
  };
  const body = Buffer.concat([
    chunkOf(CHUNK_JSON, jsonChunk),
    chunkOf(CHUNK_BIN, binary),
    ...extraChunks.map((extra) => chunkOf(extra.type, extra.payload)),
  ]);
  const header = Buffer.alloc(12);
  header.write(GLB_MAGIC, 0, "ascii");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + body.length, 8);
  return Buffer.concat([header, body]);
}

// Read a fixture's model, let the caller deform it, write it back. The result
// is a real GLB built from the shipped bytes, not a hand-authored stub.
function rewriteActorModel(fixture, assetId, mutate) {
  const path = fixture.modelPath(assetId);
  const glb = readGlb(path, `${assetId} (fixture)`);
  const shaped = { document: glb.document, binary: glb.binary, extraChunks: [] };
  mutate(shaped);
  writeFileSync(path, serializeGlb(shaped));
  return path;
}

// glTF column-major TRS composition, so a node converted to `matrix` form
// still describes the same transform. The rig stays semantically identical and
// only its *encoding* changes -- which is exactly the case a rotation-only
// tool must refuse rather than silently misread as identity.
function composeTrsMatrix(node) {
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  const r = [
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w),
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w),
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y),
  ];
  return [
    r[0] * sx, r[1] * sx, r[2] * sx, 0,
    r[3] * sy, r[4] * sy, r[5] * sy, 0,
    r[6] * sz, r[7] * sz, r[8] * sz, 0,
    tx, ty, tz, 1,
  ];
}

function nodeIndexNamed(document, name, label) {
  const index = document.nodes.findIndex((node) => node.name === name);
  assert.notEqual(index, -1, `${label}: no node named ${name}`);
  return index;
}

function actorDirEntries(fixture, assetId) {
  return readdirSync(dirname(fixture.modelPath(assetId))).sort();
}

// Anything a half-finished write would leave behind next to the target.
const PARTIAL_SIBLING = /(\.tmp$|\.temp$|\.partial$|\.swp$|~$|^\.)/u;

function assertNoPartialSiblings(fixture, assetId, label) {
  for (const entry of actorDirEntries(fixture, assetId)) {
    assert.equal(
      PARTIAL_SIBLING.test(entry),
      false,
      `${label}: ${assetId} actor directory kept a partial-write sibling: ${entry}`,
    );
  }
}

function assertFailedClosed(run, { code, label }) {
  assert.equal(
    run.status,
    2,
    `${label}: expected fail-closed exit 2, got ${run.status} (${run.stdout || run.stderr})`,
  );
  assert.equal(
    run.stdout.trim(),
    "",
    `${label}: fail-closed must not emit a result on stdout`,
  );
  assert.ok(
    run.stderr.includes(code),
    `${label}: expected ${code} on stderr, got: ${run.stderr}`,
  );
}

// ---------------------------------------------------------------------------
// 1. The certified digests are code constants, not policy inputs.
// ---------------------------------------------------------------------------

test("[hardening-1] a self-consistently re-declared evidence digest cannot redirect the certified inputs", (t) => {
  for (const scenario of [
    {
      name: "re-declared target rig digest",
      code: "SPR_TARGET_RIG_HASH",
      // Perturb the rig, then declare the perturbed rig's own digest. The
      // policy is now internally consistent, so a tool that only compares the
      // file against the policy sees nothing wrong. Only a pinned constant
      // catches that this is no longer the certified rig.
      mutate: (fixture) => {
        const bytes = readFileSync(fixture.targetRig);
        const last = bytes.length - 1;
        bytes[last] = bytes[last] === 0x20 ? 0x09 : 0x20;
        writeFileSync(fixture.targetRig, bytes);
        writePolicy(fixture, (policy) => {
          policy.evidence.targetRigSha256 = sha256Of(fixture.targetRig);
        });
      },
    },
    {
      name: "re-declared evidence manifest digest",
      code: "SPR_POLICY_HASH",
      mutate: (fixture) => {
        const manifest = JSON.parse(readFileSync(fixture.manifest, "utf8"));
        manifest.tamperedByTest = true;
        writeFileSync(fixture.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
        writePolicy(fixture, (policy) => {
          policy.evidence.manifestSha256 = sha256Of(fixture.manifest);
        });
      },
    },
  ]) {
    const fixture = disposableFixture(t, { actors: ["ember-cohort"] });
    scenario.mutate(fixture);

    // Self-consistency precondition: the policy now agrees with the bytes on
    // disk, so the only thing that can reject this run is a pinned constant.
    const policy = JSON.parse(readFileSync(fixture.policy, "utf8"));
    assert.equal(
      policy.evidence.targetRigSha256,
      sha256Of(fixture.targetRig),
      `${scenario.name}: fixture is not self-consistent on the target rig`,
    );
    assert.equal(
      policy.evidence.manifestSha256,
      sha256Of(fixture.manifest),
      `${scenario.name}: fixture is not self-consistent on the manifest`,
    );

    const digestBefore = sha256Of(fixture.modelPath("ember-cohort"));
    const run = runTool(fixture, [
      ...defaultArgs(fixture),
      "--write",
      "--asset-id",
      "ember-cohort",
    ]);

    assertFailedClosed(run, { code: scenario.code, label: scenario.name });
    assert.equal(
      sha256Of(fixture.modelPath("ember-cohort")),
      digestBefore,
      `${scenario.name}: the model was written against an uncertified input`,
    );
  }
});

// ---------------------------------------------------------------------------
// 2. Every requested actor is validated before the first byte is written.
// ---------------------------------------------------------------------------

test("[hardening-2] one unusable actor aborts the whole run before any actor is mutated", (t) => {
  // Missing model: the fixture simply never copies `possessed`, so the policy
  // still names two actors while only one exists on disk.
  const missing = disposableFixture(t, { actors: ["ember-cohort"] });
  const missingDigest = sha256Of(missing.modelPath("ember-cohort"));
  const missingRun = runTool(missing, [...defaultArgs(missing), "--write"]);

  assertFailedClosed(missingRun, { code: "SPR_ACTOR_MODEL", label: "missing actor model" });
  assert.equal(
    sha256Of(missing.modelPath("ember-cohort")),
    missingDigest,
    "missing actor model: ember-cohort was mutated before the run failed on possessed",
  );
  assertNoPartialSiblings(missing, "ember-cohort", "missing actor model");

  // Corrupt model: a real GLB whose declared length no longer matches its
  // size. The container is unreadable, but only for the second actor.
  const corrupt = disposableFixture(t);
  const digestsBefore = new Map(
    SELECTED_ACTORS.map((assetId) => [assetId, sha256Of(corrupt.modelPath(assetId))]),
  );
  const corruptBytes = readFileSync(corrupt.modelPath("possessed"));
  corruptBytes.writeUInt32LE(corruptBytes.length - 8, 8);
  writeFileSync(corrupt.modelPath("possessed"), corruptBytes);
  digestsBefore.set("possessed", sha256Of(corrupt.modelPath("possessed")));

  const corruptRun = runTool(corrupt, [...defaultArgs(corrupt), "--write"]);
  assertFailedClosed(corruptRun, { code: "SPR_GLB", label: "corrupt actor model" });

  // The point of the pre-flight: `ember-cohort` sorts first and is otherwise
  // perfectly repairable, so a tool that writes as it walks has already
  // mutated it by the time it reaches the corrupt actor.
  for (const assetId of SELECTED_ACTORS) {
    assert.equal(
      sha256Of(corrupt.modelPath(assetId)),
      digestsBefore.get(assetId),
      `corrupt actor model: ${assetId} was mutated despite the run failing closed`,
    );
    assertNoPartialSiblings(corrupt, assetId, "corrupt actor model");
  }
});

// ---------------------------------------------------------------------------
// 3. --report is a side artifact and never owns the run's outcome.
// ---------------------------------------------------------------------------

test("[hardening-3] --report mirrors the stdout result and an unwritable path never costs the result", (t) => {
  const fixture = disposableFixture(t, { actors: ["ember-cohort"] });
  const scoped = ["--asset-id", "ember-cohort"];
  const reportPath = join(fixture.root, "reports", "static-pose-repair.json");

  // A successful write: the report file must carry the same object the result
  // line carried, so downstream consumers cannot disagree about what happened.
  const write = runTool(fixture, [
    ...defaultArgs(fixture),
    "--write",
    ...scoped,
    "--report",
    reportPath,
  ]);
  const writePayload = parseResultLine(write);
  assert.equal(write.status, 0, `--write with --report; stderr: ${write.stderr}`);
  assert.ok(existsSync(reportPath), "--report did not produce a report file");
  assert.deepEqual(
    JSON.parse(readFileSync(reportPath, "utf8")),
    writePayload,
    "the report file and the stdout result line disagree",
  );

  // Baseline for the unwritable case, taken in --check mode so the tree is not
  // mutated again and the two payloads are directly comparable.
  const baseline = runTool(fixture, [...defaultArgs(fixture), "--check", ...scoped]);
  const baselinePayload = parseResultLine(baseline);
  assert.equal(baseline.status, 0, `--check baseline; stderr: ${baseline.stderr}`);
  assert.equal(baselinePayload.pass, true, "the repaired fixture must re-check clean");

  // An unwritable --report destination: the parent path exists but is a
  // regular file, so creating the report directory cannot succeed.
  const blocker = join(fixture.root, "not-a-directory");
  writeFileSync(blocker, "occupied by a regular file\n");
  const blocked = runTool(fixture, [
    ...defaultArgs(fixture),
    "--check",
    ...scoped,
    "--report",
    join(blocker, "static-pose-repair.json"),
  ]);

  assert.notEqual(
    blocked.status,
    1,
    `an unwritable --report must not be reported as a gate failure; stderr: ${blocked.stderr}`,
  );
  // The result line is emitted before the report is written, so a failed
  // report can never swallow it.
  const blockedPayload = parseResultLine(blocked);
  assert.deepEqual(
    blockedPayload,
    baselinePayload,
    "an unwritable --report changed the reported result",
  );
});

// ---------------------------------------------------------------------------
// 4. The commit is atomic and leaves nothing half-written behind.
// ---------------------------------------------------------------------------

test("[hardening-4] a repaired model is committed whole and leaves no partial siblings", (t) => {
  const fixture = disposableFixture(t, { actors: ["ember-cohort"] });
  const scoped = ["--asset-id", "ember-cohort"];
  const before = readGlb(fixture.modelPath("ember-cohort"), "ember-cohort (fixture)");
  const entriesBefore = actorDirEntries(fixture, "ember-cohort");

  const run = runTool(fixture, [...defaultArgs(fixture), "--write", ...scoped]);
  assert.equal(run.status, 0, `--write; stderr: ${run.stderr}`);

  // A tmp-then-rename commit that forgets to clean up, or that renames the
  // wrong way round, shows up here as an extra directory entry.
  assert.deepEqual(
    actorDirEntries(fixture, "ember-cohort"),
    entriesBefore,
    "the actor directory gained or lost an entry across the write",
  );
  assertNoPartialSiblings(fixture, "ember-cohort", "successful write");

  // What landed must be a complete container, not a truncated rename victim.
  // readGlb re-derives the declared length, the chunk layout, the 4-byte
  // padding and the single-buffer invariant from the committed bytes.
  const after = readGlb(fixture.modelPath("ember-cohort"), "ember-cohort (committed)");
  assert.equal(
    after.byteLength,
    statSync(fixture.modelPath("ember-cohort")).size,
    "the committed GLB declares a length that disagrees with the file on disk",
  );
  assert.ok(
    after.binary.equals(before.binary),
    "the committed GLB did not carry the input BIN chunk through intact",
  );

  // A write that fails its own verification must leave the original in place.
  // A BIN chunk that is not 4-byte aligned is refused at serialization time,
  // which is the one SPR_WRITE path reachable from a real file.
  const unaligned = disposableFixture(t, { actors: ["ember-cohort"] });
  rewriteActorModel(unaligned, "ember-cohort", (shaped) => {
    shaped.binary = Buffer.concat([shaped.binary, Buffer.alloc(2)]);
  });
  const unalignedDigest = sha256Of(unaligned.modelPath("ember-cohort"));
  const unalignedEntries = actorDirEntries(unaligned, "ember-cohort");

  const failed = runTool(unaligned, [...defaultArgs(unaligned), "--write", ...scoped]);
  assertFailedClosed(failed, { code: "SPR_WRITE", label: "unverifiable write" });
  assert.equal(
    sha256Of(unaligned.modelPath("ember-cohort")),
    unalignedDigest,
    "a write that failed verification still replaced the original model",
  );
  assert.deepEqual(
    actorDirEntries(unaligned, "ember-cohort"),
    unalignedEntries,
    "a failed write left the actor directory changed",
  );
  assertNoPartialSiblings(unaligned, "ember-cohort", "unverifiable write");
});

// ---------------------------------------------------------------------------
// 5. Repair is a fixed point.
// ---------------------------------------------------------------------------

test("[hardening-5] a second --write is a byte-identical no-op", (t) => {
  const fixture = disposableFixture(t, { actors: ["ember-cohort"] });
  const scoped = ["--asset-id", "ember-cohort"];

  const first = runTool(fixture, [...defaultArgs(fixture), "--write", ...scoped]);
  const firstPayload = parseResultLine(first);
  assert.equal(first.status, 0, `first --write; stderr: ${first.stderr}`);
  assert.equal(firstPayload.pass, true, "first --write must pass");
  const afterFirst = sha256Of(fixture.modelPath("ember-cohort"));
  const bytesAfterFirst = readFileSync(fixture.modelPath("ember-cohort"));

  const second = runTool(fixture, [...defaultArgs(fixture), "--write", ...scoped]);
  const secondPayload = parseResultLine(second);
  assert.equal(second.status, 0, `second --write; stderr: ${second.stderr}`);
  assert.equal(secondPayload.pass, true, "second --write must pass");

  // Byte-identical, not merely equivalent: a re-serialization that reorders
  // keys or re-rounds floats churns a 12 MB asset on every run and destroys
  // content-addressed caching downstream.
  assert.ok(
    readFileSync(fixture.modelPath("ember-cohort")).equals(bytesAfterFirst),
    "the second --write produced different bytes",
  );
  assert.equal(
    sha256Of(fixture.modelPath("ember-cohort")),
    afterFirst,
    "the second --write changed the model digest",
  );

  // The tool's own accounting has to agree that nothing moved.
  const entry = actorReport(secondPayload, "ember-cohort");
  assert.equal(
    entry.sha256Before,
    afterFirst,
    "the second --write did not read back the first write's bytes",
  );
  assert.equal(
    entry.sha256After,
    entry.sha256Before,
    "the second --write reported a digest change on an already-repaired model",
  );
  assertNoPartialSiblings(fixture, "ember-cohort", "idempotent write");
});

// ---------------------------------------------------------------------------
// 6. Structural proof lives in the tool, not in this suite.
// ---------------------------------------------------------------------------

test("[hardening-6] the tool itself refuses structurally unsupported rigs", (t) => {
  for (const scenario of [
    {
      name: "third GLB chunk",
      code: "SPR_GLB",
      // A two-chunk re-serializer silently drops whatever this carried.
      mutate: (shaped) => {
        shaped.extraChunks.push({
          type: CHUNK_UNKNOWN,
          payload: Buffer.from("TESTCHNK", "ascii"),
        });
      },
    },
    {
      name: "listed bone encoded as a matrix",
      code: "SPR_RIG",
      // DEF-toe.R is a listed leaf bone. Converting it to the equivalent
      // matrix form keeps the rig semantically identical, but a tool that
      // reads only `rotation` now measures it as identity and, on write,
      // leaves a node carrying both `matrix` and `rotation` -- invalid glTF.
      mutate: (shaped) => {
        const index = nodeIndexNamed(shaped.document, "DEF-toe.R", "matrix bone");
        const node = shaped.document.nodes[index];
        const matrix = composeTrsMatrix(node);
        delete node.rotation;
        delete node.translation;
        delete node.scale;
        node.matrix = matrix;
      },
    },
    {
      name: "duplicate node names among the listed bones",
      code: "SPR_RIG",
      // A second node answering to DEF-toe.R. Name lookup silently picks one
      // of them, so "the bone was repaired" stops being a well-formed claim.
      mutate: (shaped) => {
        const document = shaped.document;
        const original = document.nodes[nodeIndexNamed(document, "DEF-toe.R", "duplicate")];
        const armature = nodeIndexNamed(document, "ember-cohort_armature", "duplicate");
        const duplicateIndex = document.nodes.length;
        document.nodes.push({
          name: "DEF-toe.R",
          rotation: [...original.rotation],
          translation: [...original.translation],
        });
        document.nodes[armature].children = [
          ...(document.nodes[armature].children ?? []),
          duplicateIndex,
        ];
      },
    },
  ]) {
    const fixture = disposableFixture(t, { actors: ["ember-cohort"] });
    rewriteActorModel(fixture, "ember-cohort", scenario.mutate);
    const digestBefore = sha256Of(fixture.modelPath("ember-cohort"));

    const run = runTool(fixture, [
      ...defaultArgs(fixture),
      "--write",
      "--asset-id",
      "ember-cohort",
    ]);

    assertFailedClosed(run, { code: scenario.code, label: scenario.name });
    assert.equal(
      sha256Of(fixture.modelPath("ember-cohort")),
      digestBefore,
      `${scenario.name}: the model was rewritten despite an unsupported structure`,
    );
    assertNoPartialSiblings(fixture, "ember-cohort", scenario.name);
  }
});
