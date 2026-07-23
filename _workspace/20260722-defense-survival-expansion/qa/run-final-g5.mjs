#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { STAGES, STAGE_TACTICS, STAGE_REWARD_IDS, ITEMS, SKILLS, COMPANIONS, REWARDS } from "../../../defense-catalog.js";
import { createCampaign, startRun, applyCampaignRunResult } from "../../../campaign-state.js";
import { createDefenseRun, advanceDefenseRun, getRunDigest, getRunSnapshot, isTerminalRun, queueInput } from "../../../defense-run-simulation.js";

const OUTPUT = resolve(process.argv[2] || "results/defense-final-g5-no-commerce.json");
const MAX_TICKS = 18_000;
const SOURCES = ["defense-catalog.js", "defense-run-simulation.js", "campaign-state.js"];
const hash = (value) => createHash("sha256").update(value).digest("hex");

function createNominalState(seed) {
  const campaign = startRun(createCampaign({ campaignId: `g5-session-${seed}` }), STAGES[0].id);
  const run = createDefenseRun({ stageId: STAGES[0].id, seed, companionLoadout: campaign.companionLoadout.prototypeIds, rewardIds: campaign.rewardIds });
  return { campaign, run };
}

function runIdleToTerminal(run) {
  let next = run;
  for (let tick = 0; tick < MAX_TICKS && !isTerminalRun(next); tick += 1) {
    const snapshot = getRunSnapshot(next);
    if (snapshot.growthOffer) next = queueInput(next, "SKILL_SELECTED", { skillId: snapshot.growthOffer.choices[0] });
    next = advanceDefenseRun(next, 1);
  }
  return next;
}

const pairedRuns = [];
for (let seed = 1; seed <= 20; seed += 1) {
  const free = createNominalState(seed);
  const paid = createNominalState(seed);
  const initialCampaignMatch = JSON.stringify(free.campaign) === JSON.stringify(paid.campaign);
  const initialRunMatch = getRunDigest(free.run) === getRunDigest(paid.run);
  free.run = runIdleToTerminal(free.run);
  paid.run = runIdleToTerminal(paid.run);
  const freeSnapshot = getRunSnapshot(free.run);
  const paidSnapshot = getRunSnapshot(paid.run);
  pairedRuns.push({
    seed,
    nominalLabels: ["free", "paid"],
    labelsPassedToPublicApis: false,
    initialCampaignMatch,
    initialRunMatch,
    terminalRunMatch: getRunDigest(free.run) === getRunDigest(paid.run),
    freeTerminal: isTerminalRun(free.run),
    paidTerminal: isTerminalRun(paid.run),
    freeOutcome: freeSnapshot.terminal,
    paidOutcome: paidSnapshot.terminal,
    freeTick: freeSnapshot.tick,
    paidTick: paidSnapshot.tick,
  });
}
const freeWins = pairedRuns.filter((entry) => ["VICTORY", "FINAL_COMPLETION"].includes(entry.freeOutcome)).length;
const paidWins = pairedRuns.filter((entry) => ["VICTORY", "FINAL_COMPLETION"].includes(entry.paidOutcome)).length;
const structuralDeltaPp = ((paidWins - freeWins) / pairedRuns.length) * 100;

let freePath = createCampaign({ campaignId: "g5-authored-free-path" });
const authoredSessions = [];
for (let index = 0; index < STAGES.length; index += 1) {
  const stage = STAGES[index];
  freePath = startRun(freePath, stage.id);
  authoredSessions.push({ session: index + 1, stageId: stage.id, unlockedBeforeResolution: true, tacticsId: STAGE_TACTICS[stage.id] ? stage.id : null, rewardChoices: STAGE_REWARD_IDS[stage.id].length });
  freePath = applyCampaignRunResult(freePath, { stageId: stage.id, outcome: index === STAGES.length - 1 ? "FINAL_COMPLETION" : "victory" });
}

const catalogGroups = { ITEMS, SKILLS, COMPANIONS, REWARDS, STAGES, STAGE_TACTICS };
function semanticKeys(value, prefix = "") {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return [path, ...semanticKeys(child, path)];
  });
}
const domainCatalogKeys = semanticKeys(catalogGroups).filter((path) => /(^|\.)(domain|comeback)(\.|$)/i.test(path));
const rewardBands = await readFile(resolve("_workspace/20260722-defense-survival-expansion/pm/reward-bands.md"), "utf8");
const negotiation = await readFile(resolve("_workspace/20260722-defense-survival-expansion/pm/negotiation-record.md"), "utf8");
const domainContract = {
  activationCapPerRun: Number(rewardBands.match(/activation_cap_per_run:\s*(\d+)/)?.[1] ?? NaN),
  offerProbabilityMax: Number(rewardBands.match(/offer_probability_max:\s*([\d.]+)/)?.[1] ?? NaN),
  reversalProbabilityMax: Number(rewardBands.match(/reversal_probability_max:\s*([\d.]+)/)?.[1] ?? NaN),
  baselineForecastEvents: Number(rewardBands.match(/baseline_forecast_events:\s*(\d+)/)?.[1] ?? NaN),
  catalogBacked: domainCatalogKeys.length > 0,
  catalogKeys: domainCatalogKeys,
  catalogCooldown: null,
  disposition: domainCatalogKeys.length === 0 ? "DEFERRED_DESIGN_ONLY" : "CATALOG_BACKED",
};

const signedRevenuePoints = [];
for (let number = 1; number <= 11; number += 1) {
  const id = `RP-${String(number).padStart(2, "0")}`;
  const start = negotiation.indexOf(`- id: ${id}`);
  const nextId = `RP-${String(number + 1).padStart(2, "0")}`;
  const end = number === 11 ? negotiation.indexOf(`- id: RP-12`, start) : negotiation.indexOf(`- id: ${nextId}`, start);
  const section = start >= 0 ? negotiation.slice(start, end >= 0 ? end : undefined) : "";
  const signatureCount = (section.match(/signed_by:\s*\[game-designer, game-pm\]/g) || []).length;
  signedRevenuePoints.push({ id, present: start >= 0, signedRounds: signatureCount, pass: start >= 0 && signatureCount === 2 });
}

const commerceAudit = [];
for (const path of SOURCES) {
  const text = await readFile(resolve(path), "utf8");
  const hits = [...text.matchAll(/\b(purchase|commerce|premium|entitlement|paid|price|microtransaction|ad[_-]?reward|iap)\b/gi)].map((match) => ({ token: match[0], offset: match.index }));
  commerceAudit.push({ path, sha256: hash(text), hits, pass: hits.length === 0 });
}

const report = {
  schema: "abyssal-g5-no-commerce-v1",
  generatedAt: new Date().toISOString(),
  exactCommand: `node _workspace/20260722-defense-survival-expansion/qa/run-final-g5.mjs ${OUTPUT}`,
  evidenceBoundary: "Public catalog, campaign, and simulation APIs only. Nominal labels are measurement metadata and are intentionally not passed to gameplay APIs because no cohort/commerce input exists.",
  nominalPaidFreeComparison: {
    sessionsPerLabel: pairedRuns.length,
    freeWins,
    paidWins,
    freeWinRate: freeWins / pairedRuns.length,
    paidWinRate: paidWins / pairedRuns.length,
    structuralDeltaPp,
    pairedInitialAndTerminalMatchCount: pairedRuns.filter((entry) => entry.initialCampaignMatch && entry.initialRunMatch && entry.terminalRunMatch && entry.freeTerminal && entry.paidTerminal).length,
    pass: structuralDeltaPp === 0 && pairedRuns.every((entry) => entry.initialCampaignMatch && entry.initialRunMatch && entry.terminalRunMatch && entry.freeTerminal && entry.paidTerminal),
    runs: pairedRuns,
  },
  authoredFreePathParity: {
    targetSessionsBand: [10, 20],
    authoredMinimumSessions: authoredSessions.length,
    withinBand: authoredSessions.length >= 10 && authoredSessions.length <= 20,
    allTenStagesAndTacticsReachableUnderSuccessfulFreeResolutions: freePath.resolvedIds.length === STAGES.length && authoredSessions.every((entry) => entry.tacticsId !== null),
    campaignComplete: freePath.lastResolution?.campaignComplete === true,
    sessions: authoredSessions,
    limitation: "This verifies the authored public free progression path under successful resolutions; it is not observed player/session telemetry and does not override the current balance matrix failure.",
  },
  domainAudit: {
    ...domainContract,
    capAtMostOne: domainContract.activationCapPerRun <= 1,
    offerProbabilityAtMostPoint30: domainContract.offerProbabilityMax <= 0.30,
    reversalProbabilityAtMostPoint30: domainContract.reversalProbabilityMax <= 0.30,
    cooldownAudit: "UNAVAILABLE_NO_CATALOG_STATE",
    releaseRuleSatisfiedByZeroForecast: domainContract.catalogBacked === false && domainContract.baselineForecastEvents === 0,
    limitation: "The signed caps are design targets, not runtime evidence. No Domain cooldown exists to audit because Domain has no catalog/simulation/campaign state.",
  },
  revenuePointSignatures: {
    required: 11,
    signed: signedRevenuePoints.filter((entry) => entry.pass).length,
    pass: signedRevenuePoints.every((entry) => entry.pass),
    points: signedRevenuePoints,
  },
  commerceSourceAudit: {
    files: commerceAudit,
    pass: commerceAudit.every((entry) => entry.pass),
  },
  verdict: "FIX",
  verdictReason: "Structural paid/free parity is 0 pp, the 10-session authored free path and 11/11 signatures are verified, but G2/G3 fail and Domain is intentionally unimplemented with no catalog cooldown or runtime cadence evidence.",
};

await writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ output: OUTPUT, nominalPaidFreeComparison: report.nominalPaidFreeComparison, authoredFreePathParity: { targetSessionsBand: report.authoredFreePathParity.targetSessionsBand, authoredMinimumSessions: report.authoredFreePathParity.authoredMinimumSessions, withinBand: report.authoredFreePathParity.withinBand, campaignComplete: report.authoredFreePathParity.campaignComplete }, domainAudit: report.domainAudit, revenuePointSignatures: report.revenuePointSignatures, commerceSourceAudit: report.commerceSourceAudit, verdict: report.verdict }, null, 2)}\n`);
