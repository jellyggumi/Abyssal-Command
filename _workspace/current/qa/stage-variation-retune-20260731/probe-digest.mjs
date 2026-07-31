import { createHash } from "node:crypto";
import { createDefenseRun, advanceDefenseRun, getRunDigest } from "../../../../defense-run-simulation.js";
const sha = (v) => createHash("sha256").update(v).digest("hex");
for (const [stageId, seed, steps] of [["echo-throne", 12, 500], ["cinder-span", 71, 500], ["abyss-chancel", 9, 500]]) {
  let run = createDefenseRun({ stageId, seed, companionLoadout: [] });
  run = advanceDefenseRun(run, steps);
  console.log(`${stageId}/${seed}/${steps} bare:`, sha(getRunDigest(run)));
}
