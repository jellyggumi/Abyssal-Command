#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { CUTSCENES, ITEMS, REWARDS, AUDIO_CUES, STAGES, ANIMATION_CLIPS } from "../../../defense-catalog.js";

const OUTPUT = resolve(process.argv[2] || "results/defense-final-content-audit.json");
const sourceText = await readFile(resolve("defense-catalog.js"), "utf8");
const simulationText = await readFile(resolve("defense-run-simulation.js"), "utf8");
const loreAudit = await readFile(resolve("_workspace/20260722-defense-survival-expansion/qa/lore-audit.md"), "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;

const cutsceneStrings = Object.values(CUTSCENES).flatMap((entry) => [...entry.intro, entry.elite, entry.victory, entry.defeat]);
const itemStrings = Object.values(ITEMS).flatMap((entry) => [entry.name, entry.description]);
const rewardStrings = Object.values(REWARDS).flatMap((entry) => [entry.name, entry.description]);
const audioEntries = Object.entries(AUDIO_CUES);
const stageStrings = STAGES.flatMap((stage) => [stage.name, stage.bossName]);
const animationEntries = Object.entries(ANIMATION_CLIPS).flatMap(([actor, clips]) => Object.keys(clips).map((clip) => `${actor}.${clip}`));
const groups = [
  { group: "CUTSCENES", expected: 55, entries: cutsceneStrings },
  { group: "ITEMS", expected: 10, entries: itemStrings },
  { group: "REWARDS", expected: 18, entries: rewardStrings },
  { group: "AUDIO_CUES", expected: 13, entries: audioEntries.map(([key, value]) => `${key}:${value}`) },
  { group: "STAGES", expected: 20, entries: stageStrings },
  { group: "ANIMATION_CLIPS", expected: 20, entries: animationEntries },
].map((entry) => ({ ...entry, audited: entry.entries.length, nonempty: entry.entries.filter(nonempty).length, pass: entry.entries.length === entry.expected && entry.entries.every(nonempty) }));

const requiredRuntimeEvents = [
  "STAGE_STARTED",
  "ENEMY_DEFEATED",
  "ELITE_CANDIDATE_AVAILABLE",
  "ELITE_EXTRACTED",
  "ITEM_COLLECTED",
  "GROWTH_OFFER",
  "SKILL_CAST",
  "BOSS_SPAWNED",
  "OCCUPATION_CAPTURED",
  "TERMINAL",
];
const runtimeEvents = requiredRuntimeEvents.map((type) => ({ type, authored: new RegExp(`[\"']${type}[\"']`).test(simulationText) }));
const traceIds = [...loreAudit.matchAll(/\| (TR-[A-Z]+-\d{3}) \|/g)].map((match) => match[1]);
const total = groups.reduce((sum, entry) => sum + entry.audited, 0);
const report = {
  schema: "abyssal-final-content-audit-v1",
  generatedAt: new Date().toISOString(),
  exactCommand: `node _workspace/20260722-defense-survival-expansion/qa/run-final-content-audit.mjs ${OUTPUT}`,
  source: { path: "defense-catalog.js", sha256: sha256(sourceText) },
  groups,
  inventory: { expected: 136, audited: total, nonempty: groups.reduce((sum, entry) => sum + entry.nonempty, 0), pass: total === 136 && groups.every((entry) => entry.pass) },
  loreTraceCrosscheck: { source: "_workspace/20260722-defense-survival-expansion/qa/lore-audit.md", uniqueTraceIds: new Set(traceIds).size, expected: 136, pass: new Set(traceIds).size === 136 },
  runtimeEvents: { required: requiredRuntimeEvents.length, authored: runtimeEvents.filter((entry) => entry.authored).length, pass: runtimeEvents.every((entry) => entry.authored), events: runtimeEvents },
  verdict: total === 136 && groups.every((entry) => entry.pass) && new Set(traceIds).size === 136 && runtimeEvents.every((entry) => entry.authored) ? "PASS_CATALOG_LIMB" : "FIX",
  evidenceBoundary: "Catalog inventory, existing exact-string W-01..W-05 trace ledger, and simulation emit-site presence. This is not an exhaustive full-app string audit or human presentation review.",
};
await writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ output: OUTPUT, inventory: report.inventory, loreTraceCrosscheck: report.loreTraceCrosscheck, runtimeEvents: report.runtimeEvents, verdict: report.verdict }, null, 2)}\n`);
if (report.verdict !== "PASS_CATALOG_LIMB") process.exitCode = 1;
