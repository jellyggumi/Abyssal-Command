import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { STAGES } from "../campaign-state.js";

const SOURCE_ROOT = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, SOURCE_ROOT), "utf8");
}

function eagerRelativeImports(source) {
  const imports = new Set();
  const statement = /^import\s+(?:[\s\S]*?\sfrom\s+)?["'](?<specifier>\.[^"']+)["']\s*;?/gm;

  for (const match of source.matchAll(statement)) {
    imports.add(match.groups.specifier);
  }

  return [...imports].sort();
}

function archivePaths(workflow) {
  const archive = workflow.match(/git archive --format=tar "\$\{?PAGES_REVISION\}?" -- (?<paths>[^\n|]+) \| tar -x/);
  assert.ok(archive, "static Pages workflow must define its git archive artifact list");

  return new Set(archive.groups.paths.trim().split(/\s+/).map((path) => `./${path}`));
}

function coreAssetPaths(serviceWorker) {
  const declaration = serviceWorker.match(/const CORE_ASSETS = \[(?<assets>[\s\S]*?)\];/);
  assert.ok(declaration, "service worker must declare CORE_ASSETS");

  return new Set([...declaration.groups.assets.matchAll(/["'](?<path>\.[^"']+)["']/g)].map((match) => match.groups.path));
}

function rewardArtIds(app) {
  const declaration = app.match(/const REWARD_ART_IDS = new Set\(\[(?<ids>[\s\S]*?)\]\);/);
  assert.ok(declaration, "app.js must declare REWARD_ART_IDS");

  return [...declaration.groups.ids.matchAll(/["'](?<id>[^"']+)["']/g)].map((match) => match.groups.id);
}

test("every eager app module is shipped in the Pages artifact and precached offline", async () => {
  const [app, workflow, serviceWorker] = await Promise.all([
    readProjectFile("app.js"),
    readProjectFile(".github/workflows/static.yml"),
    readProjectFile("sw.js"),
  ]);
  const dependencies = eagerRelativeImports(app);

  assert.ok(dependencies.length > 0, "app.js must retain at least one eager relative ESM import");

  const pagesArtifact = archivePaths(workflow);
  const serviceWorkerCore = coreAssetPaths(serviceWorker);
  const missingFromArtifact = dependencies.filter((dependency) => !pagesArtifact.has(dependency));
  const missingFromServiceWorker = dependencies.filter((dependency) => !serviceWorkerCore.has(dependency));

  assert.deepEqual(
    missingFromArtifact,
    [],
    `Eager app modules missing from Pages git archive: ${missingFromArtifact.join(", ")}`,
  );
  assert.deepEqual(
    missingFromServiceWorker,
    [],
    `Eager app modules missing from service-worker CORE_ASSETS: ${missingFromServiceWorker.join(", ")}`,
  );
});

test("requested reward art belongs to a stage reward and exists in the release assets", async () => {
  const app = await readProjectFile("app.js");
  const artIds = rewardArtIds(app);
  const stageRewardIds = new Set(STAGES.flatMap((stage) => stage.rewards.map((reward) => reward.id)));

  const unknownStageRewardIds = artIds.filter((id) => !stageRewardIds.has(id));
  assert.ok(artIds.length > 0, "REWARD_ART_IDS must include at least one literal reward ID");
  assert.deepEqual(
    unknownStageRewardIds,
    [],
    `Reward art requested for IDs not offered by any stage: ${unknownStageRewardIds.join(", ")}`,
  );

  const missingArt = [];
  for (const id of artIds) {
    try {
      await readProjectFile(`assets/images/ui/reward-${id}.png`);
    } catch {
      missingArt.push(`assets/images/ui/reward-${id}.png`);
    }
  }

  assert.deepEqual(missingArt, [], `Reward art files missing from the release: ${missingArt.join(", ")}`);
});
