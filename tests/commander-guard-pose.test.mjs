import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream, stat } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, resolve, sep } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_GLB = resolve(
  ROOT,
  "_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline/all-mesh-texture-candidates-v2/commander/dusk-warden.glb",
);
const CANDIDATE_ROOT = resolve(
  ROOT,
  "_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline/player-combat-animation-candidate",
);
const CANDIDATE_GLB = resolve(CANDIDATE_ROOT, "dusk-warden.glb");
const CANDIDATE_AUDIT = resolve(CANDIDATE_ROOT, "audit.json");
const AUTHOR_SCRIPT = resolve(CANDIDATE_ROOT, "author_player_combat_clips.py");
const DEPLOYED_GLB = resolve(ROOT, "assets/images/battle/glb/commander/dusk-warden.glb");
const COMMANDER_CLIP_KEYS = [
  "attack", "avoid", "bighit", "critical", "defence", "die", "hit",
  "idle", "move", "run", "show", "attack_melee", "attack_ranged",
];
const STRIKE_ACTIONS = new Set(["attack", "critical", "attack_melee", "attack_ranged"]);

function parseGlb(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, "candidate must remain a GLB");
  let offset = 12;
  let document;
  let binary;
  while (offset < bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) document = JSON.parse(chunk.toString("utf8"));
    if (type === 0x004e4942) binary = chunk;
    offset += 8 + length;
  }
  assert.ok(document && binary, "candidate GLB must contain JSON and binary chunks");
  return { binary, document };
}

function float4Accessor({ binary, document }, accessorIndex) {
  const accessor = document.accessors[accessorIndex];
  assert.equal(accessor.componentType, 5126, `accessor ${accessorIndex} must contain floats`);
  assert.equal(accessor.type, "VEC4", `accessor ${accessorIndex} must contain quaternions`);
  assert.equal(accessor.sparse, undefined, `accessor ${accessorIndex} must remain dense`);
  const view = document.bufferViews[accessor.bufferView];
  const stride = view.byteStride ?? 16;
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  return Array.from({ length: accessor.count }, (_, row) => (
    Array.from({ length: 4 }, (_, component) => binary.readFloatLE(start + row * stride + component * 4))
  ));
}

function pythonFloat(value) {
  if (Object.is(value, -0)) return "-0.0";
  if (value === 0) return "0.0";
  const magnitude = Math.abs(value);
  let encoded = magnitude < 1e-4 || magnitude >= 1e16
    ? value.toExponential()
    : value.toString();
  encoded = encoded.replace(/e([+-]?)(\d+)$/, (_match, sign, exponent) => (
    `e${sign || "+"}${exponent.padStart(2, "0")}`
  ));
  if (!encoded.includes(".") && !encoded.includes("e")) encoded += ".0";
  return encoded;
}

function pythonJsonFloatRows(rows) {
  return `[${rows.map((row) => `[${row.map(pythonFloat).join(",")}]`).join(",")}]`;
}

function startServer() {
  const host = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === "/__commander-pose-test__") {
      response.writeHead(200, { "Content-Type": "text/html" });
      return response.end("<!doctype html><title>Commander pose test</title>");
    }
    const file = resolve(ROOT, `.${pathname}`);
    if (!file.startsWith(`${ROOT}${sep}`)) return response.writeHead(403).end();
    return stat(file, (error, metadata) => {
      if (error || !metadata.isFile()) return response.writeHead(404).end();
      const type = {
        ".glb": "model/gltf-binary",
        ".js": "text/javascript",
        ".png": "image/png",
      }[extname(file)] ?? "application/octet-stream";
      response.writeHead(200, { "Cache-Control": "no-store", "Content-Type": type });
      createReadStream(file).pipe(response);
    });
  });
  return new Promise((resolveServer, reject) => {
    host.listen(0, "127.0.0.1", () => resolveServer({
      host,
      url: `http://127.0.0.1:${host.address().port}`,
    })).on("error", reject);
  });
}

function distance(left, right) {
  return Math.hypot(...left.map((value, index) => value - right[index]));
}

function armChainLength(pose, side) {
  const point = (segment) => pose[`DEF-${segment}${side}`];
  return distance(point("shoulder"), point("upper_arm"))
    + distance(point("upper_arm"), point("forearm"))
    + distance(point("forearm"), point("hand"));
}

function guardSilhouette(pose) {
  const shoulder = (side) => pose[`DEF-shoulder${side}`];
  const hand = (side) => pose[`DEF-hand${side}`];
  const chain = {
    L: armChainLength(pose, "L"),
    R: armChainLength(pose, "R"),
  };
  const tPoseWidth = Math.abs(shoulder("L")[0] - shoulder("R")[0]) + chain.L + chain.R;
  return {
    drop: {
      L: (shoulder("L")[1] - hand("L")[1]) / chain.L,
      R: (shoulder("R")[1] - hand("R")[1]) / chain.R,
    },
    width: Math.abs(hand("L")[0] - hand("R")[0]) / tPoseWidth,
  };
}

function handTravel(from, to) {
  return Math.max(
    distance(from["DEF-handL"], to["DEF-handL"]),
    distance(from["DEF-handR"], to["DEF-handR"]),
  ) / ((armChainLength(from, "L") + armChainLength(from, "R")) / 2);
}

function handDepthSpan(pose) {
  return Math.abs(pose["DEF-handL"][2] - pose["DEF-handR"][2])
    / ((armChainLength(pose, "L") + armChainLength(pose, "R")) / 2);
}

function handSpan(pose) {
  return distance(pose["DEF-handL"], pose["DEF-handR"])
    / ((armChainLength(pose, "L") + armChainLength(pose, "R")) / 2);
}

function skinnedVertexTravel(from, to) {
  assert.equal(from.vertices.length, to.vertices.length, "skinned vertex samples must align");
  const meanTravel = from.vertices.reduce(
    (sum, vertex, index) => sum + distance(vertex, to.vertices[index]),
    0,
  ) / from.vertices.length;
  const armScale = ["L", "R"].reduce(
    (sum, side) => sum + armChainLength(from.bones, side) + armChainLength(to.bones, side),
    0,
  ) / 4;
  return meanTravel / armScale;
}

test("deployed commander is the byte-exact audited guard-pose candidate", async () => {
  const [sourceBytes, candidateBytes, deployedBytes, auditText, authorBytes] = await Promise.all([
    readFile(SOURCE_GLB),
    readFile(CANDIDATE_GLB),
    readFile(DEPLOYED_GLB),
    readFile(CANDIDATE_AUDIT, "utf8"),
    readFile(AUTHOR_SCRIPT),
  ]);
  const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const sourceHash = sha256(sourceBytes);
  const candidateHash = sha256(candidateBytes);
  const deployedHash = sha256(deployedBytes);
  const audit = JSON.parse(auditText);
  const candidateGlb = parseGlb(candidateBytes);
  const requiredAnimationNames = COMMANDER_CLIP_KEYS.map((key) => `dusk-warden::${key}::v01`);

  assert.equal(sourceHash, audit.inputSha256, "the audit must identify the checked-in source GLB");
  assert.equal(audit.outputSha256, candidateHash, "the top-level audit hash must identify its own candidate");
  assert.equal(
    audit.guardPoseCorrection.outputGlbSha256,
    candidateHash,
    "the guard correction audit must identify its own candidate",
  );

  // The deployed commander is this candidate carried one stage further: the
  // whole-body pass gives every clip a working lower half without touching the
  // arm channels this audit describes. The build record has to close that link,
  // so the chain stays source -> authored strikes + guard -> whole body -> ship.
  const provenance = JSON.parse(
    await readFile(resolve(ROOT, "assets/images/battle/glb/character-build-provenance.json"), "utf8"),
  );
  const commander = provenance.assets["assets/images/battle/glb/commander/dusk-warden.glb"];
  assert.ok(commander, "the commander must appear in the character build record");
  assert.equal(commander.outputSha256, deployedHash, "the build record must identify the deployed GLB");
  assert.equal(
    commander.sourceInputSha256,
    candidateHash,
    "the whole-body pass must have consumed this authored candidate",
  );
  assert.equal(
    commander.upstreamPipeline,
    "_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline"
      + "/player-combat-animation-candidate/author_player_combat_clips.py",
    "the build record must name the authoring stage that produced the strikes and guard pose",
  );
  assert.equal(
    sha256(authorBytes),
    audit.authorScriptSha256,
    "the audit must come from the checked-in pose-authoring source",
  );
  assert.equal(audit.guardPoseCorrection.guardPoseDegrees, 95, "the audited local-Z guard correction");

  const skins = candidateGlb.document.skins ?? [];
  assert.equal(skins.length, 1, "the deployed commander must expose exactly one skin");
  assert.equal(skins[0].joints.length, 24, "the deployed commander skin must bind all 24 deform joints");
  assert.equal(audit.after.skins, skins.length, "the audit must describe the deployed skin count");
  assert.deepEqual(
    audit.after.skinJointCounts,
    [skins[0].joints.length],
    "the audit must describe the deployed skin's deform-joint count",
  );
  assert.equal(audit.after.deformJoints, 24, "the audit must identify the 24-joint deform rig");

  const animationNames = (candidateGlb.document.animations ?? []).map(({ name }) => name);
  assert.equal(animationNames.length, 13, "the deployed commander must expose exactly 13 action clips");
  assert.equal(new Set(animationNames).size, 13, "the deployed commander action names must be unique");
  assert.deepEqual(
    [...animationNames].sort(),
    [...requiredAnimationNames].sort(),
    "the deployed commander must expose the complete required action library",
  );
  assert.deepEqual(
    [...audit.after.animationNames].sort(),
    [...requiredAnimationNames].sort(),
    "the audit must account for every deployed action clip",
  );
  const channels = audit.guardPoseCorrection.channels;
  assert.equal(channels.length, 26, "the audit must record both corrected upper arms for all 13 actions");
  assert.deepEqual(
    [...new Set(channels.map(({ actionKey }) => actionKey))].sort(),
    [...COMMANDER_CLIP_KEYS].sort(),
    "guard correction must span every deployed action key",
  );
  for (const actionKey of COMMANDER_CLIP_KEYS) {
    const actionChannels = channels.filter((channel) => channel.actionKey === actionKey);
    assert.deepEqual(
      actionChannels.map(({ bone }) => bone).sort(),
      ["DEF-upper_arm.L", "DEF-upper_arm.R"],
      `${actionKey} must correct exactly the left and right upper-arm channels`,
    );
    for (const channel of actionChannels) {
      const payload = pythonJsonFloatRows(float4Accessor(candidateGlb, channel.valueAccessor));
      assert.equal(
        sha256(Buffer.from(payload)),
        channel.correctedValuePayloadSha256,
        `${actionKey} ${channel.bone} corrected accessor digest`,
      );
      const guardDegrees = channel.bone.endsWith(".L") ? -95 : 95;
      const strike = STRIKE_ACTIONS.has(actionKey);
      const [firstSample, lastSample] = channel.sampleTimeRangeSeconds;
      assert.ok(firstSample > 0 && lastSample > firstSample, `${actionKey} sampled time range`);
      if (strike) {
        assert.ok(
          channel.contactTimeSeconds >= firstSample && channel.contactTimeSeconds <= lastSample,
          `${actionKey} contact must be one of the exported channel samples`,
        );
        if (actionKey === "attack_melee" || actionKey === "attack_ranged") {
          assert.equal(channel.contactSource, "authored-frame-14", `${actionKey} contact source`);
          assert.equal(channel.contactFrame, 14, `${actionKey} contact frame`);
          assert.ok(
            Math.abs(channel.contactTimeSeconds - 14 / 30) < 1e-7,
            `${actionKey} contact time must evaluate authored frame 14`,
          );
        }
      } else {
        assert.equal(channel.contactTimeSeconds, null, `${actionKey} must not open a strike contact`);
      }
      assert.equal(channel.mode, strike ? "strike" : "guard", `${actionKey} correction mode`);
      assert.equal(channel.guardDegreesAtStart, guardDegrees, `${actionKey} ${channel.bone} start guard`);
      assert.equal(channel.guardDegreesAtRecovery, guardDegrees, `${actionKey} ${channel.bone} recovery guard`);
      if (strike) {
        assert.ok(channel.guardDegreesAtContact === 0, `${actionKey} ${channel.bone} contact correction`);
      } else {
        assert.equal(channel.guardDegreesAtContact, guardDegrees, `${actionKey} ${channel.bone} contact guard`);
      }
    }
  }
  assert.equal(
    audit.guardPoseCorrection.changedBytesOutsideCorrectedAccessors,
    0,
    "guard correction must not mutate bytes outside its declared quaternion accessors",
  );
  for (const [name, passed] of Object.entries(audit.checks)) {
    assert.equal(passed, true, `authored pipeline audit check failed: ${name}`);
  }
});

test("deployed commander preserves readable idle, attack, critical, melee, and ranged silhouettes", async () => {
  const audit = JSON.parse(await readFile(CANDIDATE_AUDIT, "utf8"));
  const authoredMelee = audit.authoredActions["dusk-warden::attack_melee::v01"];
  const meleeContactFrame = authoredMelee.poseStages.find(({ stage }) => stage === "slash_contact")?.frame;
  assert.equal(meleeContactFrame, 14, "the silhouette contact sample must use the authored slash_contact frame");

  const correctionFor = (actionKey) => {
    const channels = audit.guardPoseCorrection.channels.filter((channel) => channel.actionKey === actionKey);
    assert.equal(channels.length, 2, `${actionKey} must expose left/right audited correction channels`);
    assert.equal(
      new Set(channels.map(({ contactTimeSeconds }) => contactTimeSeconds)).size,
      1,
      `${actionKey} correction channels must agree on the contact sample`,
    );
    return channels[0];
  };
  const corrections = {
    attack: correctionFor("attack"),
    critical: correctionFor("critical"),
    attackMelee: correctionFor("attack_melee"),
    attackRanged: correctionFor("attack_ranged"),
  };
  assert.deepEqual(
    {
      attack: [corrections.attack.contactSource, corrections.attack.contactSample],
      critical: [corrections.critical.contactSource, corrections.critical.contactSample],
      attackMelee: [corrections.attackMelee.contactSource, corrections.attackMelee.contactFrame],
      attackRanged: [corrections.attackRanged.contactSource, corrections.attackRanged.contactFrame],
    },
    {
      attack: ["source-max-hand-depth-sample-45", 45],
      critical: ["source-max-hand-depth-sample-29", 29],
      attackMelee: ["authored-frame-14", 14],
      attackRanged: ["authored-frame-14", 14],
    },
    "combat silhouettes must be sampled at the source-measured or authored contact poses",
  );
  const sampleTimes = Object.fromEntries(Object.entries(corrections).map(([name, channel]) => [
    name,
    {
      start: channel.sampleTimeRangeSeconds[0],
      contact: channel.contactTimeSeconds,
      recovery: channel.sampleTimeRangeSeconds[1],
    },
  ]));
  const hosting = await startServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`${hosting.url}/__commander-pose-test__`);
    const report = await page.evaluate(async (sampleTimes) => {
      const THREE = await import("/vendor/three.module.js");
      const { GLTFLoader } = await import("/vendor/loaders/GLTFLoader.js");
      const gltf = await new GLTFLoader().loadAsync("/assets/images/battle/glb/commander/dusk-warden.glb");
      const originalTransforms = new Map();
      gltf.scene.traverse((node) => {
        originalTransforms.set(node, {
          position: node.position.clone(),
          quaternion: node.quaternion.clone(),
          scale: node.scale.clone(),
        });
      });

      const resetPose = () => {
        for (const [node, transform] of originalTransforms) {
          node.position.copy(transform.position);
          node.quaternion.copy(transform.quaternion);
          node.scale.copy(transform.scale);
        }
      };
      const armBones = [];
      const skinnedMeshes = [];
      gltf.scene.traverse((node) => {
        if (node.isBone && /shoulder|upper_arm|forearm|hand/i.test(node.name)) armBones.push(node.name);
        if (node.isSkinnedMesh) skinnedMeshes.push(node);
      });
      if (skinnedMeshes.length !== 1) throw new Error(`expected one deployed SkinnedMesh, found ${skinnedMeshes.length}`);
      const skinnedMesh = skinnedMeshes[0];
      const skinIndex = skinnedMesh.geometry.getAttribute("skinIndex");
      const skinWeight = skinnedMesh.geometry.getAttribute("skinWeight");
      const indicesAt = (index) => [
        skinIndex.getX(index), skinIndex.getY(index), skinIndex.getZ(index), skinIndex.getW(index),
      ];
      const weightsAt = (index) => [
        skinWeight.getX(index), skinWeight.getY(index), skinWeight.getZ(index), skinWeight.getW(index),
      ];
      const candidates = { L: [], R: [] };
      for (let index = 0; index < skinWeight.count; index += 1) {
        const influence = { L: 0, R: 0 };
        const indices = indicesAt(index);
        const weights = weightsAt(index);
        for (let slot = 0; slot < 4; slot += 1) {
          const boneName = skinnedMesh.skeleton.bones[indices[slot]]?.name ?? "";
          if (!/upper_arm|forearm|hand/i.test(boneName)) continue;
          if (boneName.endsWith("L")) influence.L += weights[slot];
          if (boneName.endsWith("R")) influence.R += weights[slot];
        }
        for (const side of ["L", "R"]) {
          const other = side === "L" ? "R" : "L";
          if (influence[side] >= 0.5 && influence[side] > influence[other]) {
            candidates[side].push({ index, influence: influence[side], side });
          }
        }
      }
      const armVertices = ["L", "R"].flatMap((side) => (
        candidates[side].sort((left, right) => right.influence - left.influence).slice(0, 24)
      ));
      const samplePose = (clip, time) => {
        resetPose();
        const mixer = clip ? new THREE.AnimationMixer(gltf.scene) : null;
        if (mixer) {
          const action = mixer.clipAction(clip);
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
          action.play();
          mixer.setTime(time);
        }
        gltf.scene.updateMatrixWorld(true);
        const bones = Object.fromEntries(armBones.map((name) => [
          name,
          gltf.scene.getObjectByName(name).getWorldPosition(new THREE.Vector3()).toArray(),
        ]));
        const vertices = armVertices.map(({ index }) => (
          skinnedMesh.getVertexPosition(index, new THREE.Vector3())
            .applyMatrix4(skinnedMesh.matrixWorld)
            .toArray()
        ));
        if (mixer) {
          mixer.stopAllAction();
          mixer.uncacheRoot(gltf.scene);
        }
        return { bones, vertices };
      };
      const selectAction = (key) => gltf.animations.find((clip) => clip.name.split("::")[1] === key);
      const idle = selectAction("idle");
      const strikeClips = {
        attack: selectAction("attack"),
        critical: selectAction("critical"),
        attackMelee: selectAction("attack_melee"),
        attackRanged: selectAction("attack_ranged"),
      };
      const selected = {
        idle: idle?.name,
        ...Object.fromEntries(Object.entries(strikeClips).map(([name, clip]) => [name, clip?.name])),
      };
      if (!idle || Object.values(strikeClips).some((clip) => !clip)) return { selected };
      const strikes = Object.fromEntries(Object.entries(strikeClips).map(([name, clip]) => [
        name,
        {
          start: samplePose(clip, sampleTimes[name].start),
          contact: samplePose(clip, sampleTimes[name].contact),
          recovery: samplePose(clip, sampleTimes[name].recovery),
        },
      ]));
      return {
        armVertices,
        selected,
        poses: {
          bind: samplePose(null, 0),
          idle: samplePose(idle, idle.duration * 0.5),
          strikes,
        },
      };
    }, sampleTimes);

    assert.deepEqual(report.selected, {
      idle: "dusk-warden::idle::v01",
      attack: "dusk-warden::attack::v01",
      critical: "dusk-warden::critical::v01",
      attackMelee: "dusk-warden::attack_melee::v01",
      attackRanged: "dusk-warden::attack_ranged::v01",
    }, "runtime action keys must select the deployed commander's authored proof clips");

    assert.equal(
      report.armVertices.filter(({ side }) => side === "L").length,
      24,
      "left arm must expose enough materially influenced skinned vertices",
    );
    assert.equal(
      report.armVertices.filter(({ side }) => side === "R").length,
      24,
      "right arm must expose enough materially influenced skinned vertices",
    );
    assert.ok(
      report.armVertices.every(({ influence }) => influence >= 0.5),
      "sampled vertices must derive at least half their skin weight from upper-arm, forearm, or hand bones",
    );

    const guardSamples = { idle: report.poses.idle };
    for (const [name, poses] of Object.entries(report.poses.strikes)) {
      guardSamples[`${name} start`] = poses.start;
      guardSamples[`${name} recovery`] = poses.recovery;
    }
    const guardMetrics = {};
    for (const [name, pose] of Object.entries(guardSamples)) {
      const silhouette = guardSilhouette(pose.bones);
      guardMetrics[name] = silhouette;
      const rangedBrace = name.startsWith("attackRanged");
      assert.ok(
        silhouette.drop.L >= (rangedBrace ? 0.1 : 0.2)
          && silhouette.drop.R >= (rangedBrace ? 0.1 : 0.2),
        `${name} hands must sit materially below their shoulders; ${JSON.stringify(silhouette)}`,
      );
      if (rangedBrace) {
        assert.ok(
          Math.max(silhouette.drop.L, silhouette.drop.R) >= 0.3,
          `${name} must preserve the authored high/low ranged brace; ${JSON.stringify(silhouette)}`,
        );
      }
      assert.ok(
        silhouette.width <= 0.55,
        `${name} hands must stay materially closer than a straight-arm T-pose; ${JSON.stringify(silhouette)}`,
      );
    }

    const idleFromBind = skinnedVertexTravel(report.poses.bind, report.poses.idle);
    assert.ok(
      idleFromBind >= 0.2,
      `idle must visibly deform arm-influenced mesh vertices away from bind pose; ${idleFromBind}`,
    );

    const strikeThresholds = {
      attack: { handTravel: 0.35, vertexTravel: 0.15 },
      critical: { handTravel: 0.35, vertexTravel: 0.15 },
      attackMelee: { handTravel: 0.75, vertexTravel: 0.35 },
      attackRanged: { handTravel: 0.35, vertexTravel: 0.15 },
    };
    for (const [name, poses] of Object.entries(report.poses.strikes)) {
      const strikeMetrics = {
        depthSpan: handDepthSpan(poses.contact.bones),
        handSpan: handSpan(poses.contact.bones),
        travelFromStart: handTravel(poses.start.bones, poses.contact.bones),
        travelToRecovery: handTravel(poses.contact.bones, poses.recovery.bones),
        skinnedFromStart: skinnedVertexTravel(poses.start, poses.contact),
        skinnedToRecovery: skinnedVertexTravel(poses.contact, poses.recovery),
      };
      const threshold = strikeThresholds[name];
      assert.ok(
        name === "attackRanged"
          ? strikeMetrics.handSpan >= 0.75
          : strikeMetrics.depthSpan >= 0.2,
        `${name} contact must open a readable hand silhouette; ${JSON.stringify(strikeMetrics)}`,
      );
      assert.ok(
        strikeMetrics.travelFromStart >= threshold.handTravel
          && strikeMetrics.travelToRecovery >= threshold.handTravel,
        `${name} contact must trace a readable hand arc away from and back to guard; ${JSON.stringify(strikeMetrics)}`,
      );
      assert.ok(
        strikeMetrics.skinnedFromStart >= threshold.vertexTravel
          && strikeMetrics.skinnedToRecovery >= threshold.vertexTravel,
        `${name} contact must visibly deform the arm-influenced mesh out of and back into guard; ${JSON.stringify(strikeMetrics)}`,
      );
    }
  } finally {
    if (browser) await browser.close();
    await new Promise((resolveClose) => hosting.host.close(resolveClose));
  }
});
