import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PYTHON = process.env.PYTHON ?? "python3";
const SCRIPT = "scripts/author-wholebody-clips-blender.py";
const MANIFEST = resolve(
  ROOT,
  "_workspace/20260726-stage1b-cinder-pressure-agency/engineering/asset-pipeline",
  "runtime-candidates/wholebody-motion/wholebody-motion.manifest.json",
);

const EXPECTED_CHARACTERS = 24;
const MANIFEST_PRESENT = existsSync(MANIFEST);

function parseGlbJson(path) {
  const bytes = readFileSync(path);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, `${path}: invalid GLB magic`);
  let offset = 12;
  let json;
  while (offset < bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + length;
    if (type === 0x4e4f534a) {
      json = JSON.parse(bytes.subarray(start, end).toString("utf8").replace(/[\u0000 ]+$/u, ""));
    }
    offset = end;
  }
  assert.ok(json, `${path}: GLB has no JSON chunk`);
  return json;
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

test("author-wholebody-clips --check passes on the staged pack", { skip: !MANIFEST_PRESENT }, () => {
  const result = spawnSync(PYTHON, [SCRIPT, "--check"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.characters, EXPECTED_CHARACTERS);
});

test("no clip leaves half the body frozen", { skip: !MANIFEST_PRESENT }, async (t) => {
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  assert.equal(manifest.characterCount, EXPECTED_CHARACTERS);
  assert.equal(manifest.runtimeEligible, false);
  assert.equal(manifest.rows.length, EXPECTED_CHARACTERS);

  for (const row of manifest.rows) {
    await t.test(row.relativePath, () => {
      const candidate = resolve(ROOT, row.outputPath);
      assert.equal(existsSync(candidate), true, "candidate GLB missing");
      assert.equal(hashFile(resolve(ROOT, row.inputPath)), row.inputSha256, "input GLB drifted");
      assert.equal(hashFile(candidate), row.outputSha256, "candidate GLB drifted");

      assert.ok(Array.isArray(row.clipBalance) && row.clipBalance.length > 0, "no clip evidence");
      for (const clip of row.clipBalance) {
        assert.equal(
          clip.participates,
          true,
          `${clip.clip}: one half is a passenger (upper ${clip.upperTravel}, lower ${clip.lowerTravel})`,
        );
        assert.ok(clip.upperTravel > 0, `${clip.clip}: upper body never moves`);
        assert.ok(clip.lowerTravel > 0, `${clip.clip}: lower body never moves`);
      }

      // Structure is untouched: this pass only rewrites starved rotation curves.
      const source = parseGlbJson(resolve(ROOT, row.inputPath));
      const output = parseGlbJson(candidate);
      assert.equal(output.meshes.length, source.meshes.length, "mesh count changed");
      assert.equal(output.skins?.length, source.skins?.length, "skin count changed");
      assert.deepEqual(
        (output.animations ?? []).map((clip) => clip.name).sort(),
        (source.animations ?? []).map((clip) => clip.name).sort(),
        "clip library changed",
      );
    });
  }
});

test("clips that already used the whole body are left alone", { skip: !MANIFEST_PRESENT }, async () => {
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  const kept = manifest.rows.flatMap((row) =>
    (row.authoringLog ?? []).filter((entry) => entry.action === "kept-authored"),
  );
  assert.ok(kept.length > 0, "a balanced clip must be preserved rather than overwritten");
  for (const entry of kept) {
    assert.ok(
      entry.baselineBalance >= 0.25,
      `${entry.clip}: only already-balanced clips may be kept (${entry.baselineBalance})`,
    );
  }

  const authored = manifest.rows.flatMap((row) =>
    (row.authoringLog ?? []).filter((entry) => entry.action !== "kept-authored"),
  );
  assert.ok(authored.length > 0, "the starved clips must actually be authored");
  for (const entry of authored) {
    assert.ok(
      entry.baselineBalance < 0.25,
      `${entry.clip}: a balanced clip was rewritten (${entry.baselineBalance})`,
    );
    assert.ok(Array.isArray(entry.bones) && entry.bones.length > 0, `${entry.clip}: no bones authored`);
  }
});
