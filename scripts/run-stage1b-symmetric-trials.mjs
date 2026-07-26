#!/usr/bin/env node
/**
 * Stage 1b deterministic symmetric evidence exporter.
 *
 * This is synthetic measurement, not human G7/G8 evidence. It only drives and
 * observes the shipped simulation with catalog-authored, equal-budget profiles.
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import * as Catalog from "../defense-catalog.js";
import {
  MEASUREMENT_FIXTURE_BUDGET_ID,
  MEASUREMENT_PROFILES,
  QA_MULTI_SKILL_MEASUREMENT_FIXTURE,
  QA_MULTI_SKILL_MEASUREMENT_FIXTURE_ID,
  RULES_VERSION,
  SKILLS,
} from "../defense-catalog.js";
import {
  advanceDefenseRun,
  createDefenseRun,
  getRunDigest,
  getRunSnapshot,
  isTerminalRun,
  queueInput,
} from "../defense-run-simulation.js";

const SCRIPT_ID = "run-stage1b-symmetric-trials.mjs";
const SCHEMA_VERSION = "stage1b-symmetric-trials-v1";
const STAGE_ID = "cinder-span";
const WINDOW_TICKS = 360;
const CANONICAL_SEEDS = Object.freeze([401, 402, 403, 404, 405]);
const ARCHETYPE_IDS = Object.freeze(Object.keys(MEASUREMENT_PROFILES).sort());
const CANONICAL_PAIRS_PER_ARCHETYPE = (ARCHETYPE_IDS.length - 1) * CANONICAL_SEEDS.length;
const WINNER_RULE = Object.freeze({
  id: "terminal-damage-integrity-ticks-lexicographic-v1",
  description: "Compare terminal disposition, then observed damage dealt, then retained commander plus gate integrity, then lower terminal tick; exact equality is TIE.",
  terminalRanks: Object.freeze({ DEFEAT: 0, INCOMPLETE_WINDOW: 1, VICTORY: 2, FINAL_COMPLETION: 2 }),
  tie: "TIE",
});

function failUsage(message) {
  if (message) console.error(`Error: ${message}`);
  console.error(`Usage: node scripts/${SCRIPT_ID} --output <path.json> [--seeds 401,402] [--pairs-per-archetype N]`);
  process.exit(1);
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) failUsage(`${name} requires a value`);
  if (args.indexOf(name, index + 1) !== -1) failUsage(`${name} may be supplied only once`);
  return value;
}

const args = process.argv.slice(2);
const knownArguments = new Set(["--output", "--seeds", "--pairs-per-archetype"]);
for (let index = 0; index < args.length; index += 2) {
  if (!knownArguments.has(args[index])) failUsage(`unknown argument ${args[index] ?? ""}`);
}

const output = optionValue(args, "--output");
if (!output || output.startsWith("-")) failUsage("--output <path.json> is required");

const seedsArgument = optionValue(args, "--seeds");
const executedSeeds = seedsArgument === null
  ? [...CANONICAL_SEEDS]
  : seedsArgument.split(",").map((value) => Number(value.trim()));
if (
  executedSeeds.length === 0
  || new Set(executedSeeds).size !== executedSeeds.length
  || executedSeeds.some((seed) => !Number.isInteger(seed) || !CANONICAL_SEEDS.includes(seed))
) {
  failUsage(`--seeds must be a unique subset of ${CANONICAL_SEEDS.join(",")}`);
}

const possiblePairsPerArchetype = (ARCHETYPE_IDS.length - 1) * executedSeeds.length;
const pairsArgument = optionValue(args, "--pairs-per-archetype");
const executedPairsPerArchetype = pairsArgument === null
  ? possiblePairsPerArchetype
  : Number(pairsArgument);
if (
  !Number.isInteger(executedPairsPerArchetype)
  || executedPairsPerArchetype < 1
  || executedPairsPerArchetype > possiblePairsPerArchetype
) {
  failUsage(`--pairs-per-archetype must be an integer from 1 to ${possiblePairsPerArchetype}`);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(typeof value === "string" ? value : canonicalJson(value)).digest("hex")}`;
}

const catalogDigest = sha256(Catalog);
const valueBudget = Object.freeze({
  budgetId: MEASUREMENT_FIXTURE_BUDGET_ID,
  rulesVersion: RULES_VERSION,
  source: "defense-catalog.js#MEASUREMENT_PROFILES[*].budgetId",
});
const valueBudgetFingerprint = sha256(valueBudget);

function validateCatalogContracts() {
  const failures = [];
  if (ARCHETYPE_IDS.length < 2) failures.push("ILLEGAL_COMBO: at least two measurement profiles are required");
  for (const archetypeId of ARCHETYPE_IDS) {
    const profile = MEASUREMENT_PROFILES[archetypeId];
    if (profile.id !== archetypeId) failures.push(`ILLEGAL_COMBO: profile key/id mismatch for ${archetypeId}`);
    if (profile.budgetId !== MEASUREMENT_FIXTURE_BUDGET_ID) {
      failures.push(`UNEQUAL_FINGERPRINT: ${archetypeId} has budget ${profile.budgetId ?? "MISSING"}`);
    }
    const skill = SKILLS[profile.activeSkillId];
    if (!skill || skill.kind !== "active") failures.push(`ILLEGAL_COMBO: ${archetypeId} has no legal active skill`);
  }

  const comboSkills = QA_MULTI_SKILL_MEASUREMENT_FIXTURE.activeSkillIds;
  if (
    QA_MULTI_SKILL_MEASUREMENT_FIXTURE.id !== QA_MULTI_SKILL_MEASUREMENT_FIXTURE_ID
    || QA_MULTI_SKILL_MEASUREMENT_FIXTURE.budgetId !== MEASUREMENT_FIXTURE_BUDGET_ID
    || !Array.isArray(comboSkills)
    || comboSkills.length < 2
    || new Set(comboSkills).size !== comboSkills.length
    || comboSkills.some((skillId) => !SKILLS[skillId] || SKILLS[skillId].kind !== "active")
  ) {
    failures.push("ILLEGAL_COMBO: QA multi-skill fixture does not expose distinct catalog active skills on the shared budget");
  }
  return failures;
}

function compactDamageEvent(event) {
  if (event.type === "SKILL_RESOLVED_DAMAGE" && event.sourceId === "commander") {
    return {
      eventSequence: event.eventSequence,
      tick: event.tick,
      type: event.type,
      skillId: event.skillId,
      targetId: event.targetId,
      finalDamage: event.finalDamage ?? event.damage ?? 0,
      critical: Boolean(event.critical),
    };
  }
  if (
    event.type === "PROJECTILE_IMPACT"
    && (event.sourceId === "commander" || event.owner === "commander")
    && event.hit !== false
  ) {
    return {
      eventSequence: event.eventSequence,
      tick: event.tick,
      type: event.type,
      skillId: null,
      targetId: event.targetId ?? null,
      finalDamage: event.finalDamage ?? event.damage ?? 0,
      critical: Boolean(event.critical),
    };
  }
  return null;
}

function executeWindow(measurementProfileId, seed) {
  const profile = measurementProfileId === QA_MULTI_SKILL_MEASUREMENT_FIXTURE_ID
    ? QA_MULTI_SKILL_MEASUREMENT_FIXTURE
    : MEASUREMENT_PROFILES[measurementProfileId];
  if (!profile) throw new Error(`ILLEGAL_COMBO: unknown measurement profile ${measurementProfileId}`);

  let run = createDefenseRun({ stageId: STAGE_ID, seed, measurementProfileId });
  const start = getRunSnapshot(run);
  const damageEvents = [];
  const inputOutcomes = [];
  let lastEventSequence = 0;

  while (run.tick < WINDOW_TICKS && !isTerminalRun(run)) {
    run = queueInput(run, "MOVE", "IDLE");
    for (const skillId of profile.activeSkillIds ?? [profile.activeSkillId]) {
      run = queueInput(run, "SKILL_CAST", { skillId });
    }
    run = advanceDefenseRun(run, 1);

    for (const event of run.events) {
      if ((event.eventSequence ?? 0) <= lastEventSequence) continue;
      lastEventSequence = event.eventSequence;
      const damageEvent = compactDamageEvent(event);
      if (damageEvent) damageEvents.push(damageEvent);
      if (event.type === "INPUT_ACCEPTED" || event.type === "INPUT_REJECTED") {
        inputOutcomes.push({
          eventSequence: event.eventSequence,
          tick: event.tick,
          type: event.type,
          inputType: event.inputType,
          reason: event.reason ?? null,
        });
      }
    }
  }

  const end = getRunSnapshot(run);
  const digest = getRunDigest(run);
  const totalDamageDealt = damageEvents.reduce((sum, event) => sum + event.finalDamage, 0);
  const skillDamageDealt = damageEvents
    .filter(({ skillId }) => skillId !== null)
    .reduce((sum, event) => sum + event.finalDamage, 0);
  return {
    profileId: measurementProfileId,
    seed,
    stageId: STAGE_ID,
    windowTicks: WINDOW_TICKS,
    terminal: end.terminal ?? "INCOMPLETE_WINDOW",
    tick: end.tick,
    startIntegrity: { commander: start.commander.integrity, gate: start.gate.integrity },
    endIntegrity: { commander: end.commander.integrity, gate: end.gate.integrity },
    totalDamageDealt,
    skillDamageDealt,
    damageEvents,
    inputOutcomes,
    digestSha256: sha256(digest),
  };
}

function executeVerifiedWindow(profileId, seed) {
  const observed = executeWindow(profileId, seed);
  const replay = executeWindow(profileId, seed);
  return {
    ...observed,
    replayDigestSha256: replay.digestSha256,
    digestMatched: observed.digestSha256 === replay.digestSha256,
  };
}

function terminalRank(terminal) {
  return WINNER_RULE.terminalRanks[terminal] ?? WINNER_RULE.terminalRanks.INCOMPLETE_WINDOW;
}

function winnerVector(outcome) {
  return [
    terminalRank(outcome.terminal),
    outcome.totalDamageDealt,
    outcome.endIntegrity.commander + outcome.endIntegrity.gate,
    -outcome.tick,
  ];
}

function compareVectors(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index] ? 1 : -1;
  }
  return 0;
}

function outcomeReference(profileId, seed) {
  return `${profileId}/seed:${seed}`;
}

function outcomeLink(profileId, rawOutcome) {
  return {
    outcomeRef: outcomeReference(profileId, rawOutcome.seed),
    digestSha256: rawOutcome.digestSha256,
  };
}

function profileEntry(side, profileId, rawOutcome) {
  return {
    side,
    profileId,
    budgetId: MEASUREMENT_PROFILES[profileId].budgetId,
    valueBudgetFingerprint,
    catalogProfileRef: `defense-catalog.js#MEASUREMENT_PROFILES.${profileId}`,
    ...outcomeLink(profileId, rawOutcome),
    winnerVector: winnerVector(rawOutcome),
  };
}

function trialRow(archetypeId, counterProfileId, seed, outcomes) {
  const archetypeOutcome = outcomes.get(`${archetypeId}/${seed}`);
  const counterOutcome = outcomes.get(`${counterProfileId}/${seed}`);
  const archetypeVector = winnerVector(archetypeOutcome);
  const counterVector = winnerVector(counterOutcome);
  const comparison = compareVectors(archetypeVector, counterVector);
  return {
    archetypeId,
    counterProfileId,
    seed,
    winner: comparison > 0 ? archetypeId : comparison < 0 ? counterProfileId : WINNER_RULE.tie,
    valueBudgetFingerprint,
    pairedEntries: [
      profileEntry("ARCHETYPE", archetypeId, archetypeOutcome),
      profileEntry("COUNTER", counterProfileId, counterOutcome),
    ],
    rawOutcomes: {
      archetype: outcomeLink(archetypeId, archetypeOutcome),
      counter: outcomeLink(counterProfileId, counterOutcome),
    },
    winnerDerivation: {
      ruleId: WINNER_RULE.id,
      archetypeVector,
      counterVector,
      comparison: comparison > 0 ? "ARCHETYPE_GREATER" : comparison < 0 ? "COUNTER_GREATER" : "EQUAL_TIE",
    },
  };
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const failures = validateCatalogContracts();
const requiredProfileSeedKeys = new Set();
const pairSpecsByArchetype = new Map();
for (const archetypeId of ARCHETYPE_IDS) {
  const available = ARCHETYPE_IDS
    .filter((counterProfileId) => counterProfileId !== archetypeId)
    .flatMap((counterProfileId) => executedSeeds.map((seed) => ({ archetypeId, counterProfileId, seed })));
  const selected = available.slice(0, executedPairsPerArchetype);
  pairSpecsByArchetype.set(archetypeId, selected);
  for (const { counterProfileId, seed } of selected) {
    requiredProfileSeedKeys.add(`${archetypeId}/${seed}`);
    requiredProfileSeedKeys.add(`${counterProfileId}/${seed}`);
  }
}

const outcomes = new Map();
for (const key of [...requiredProfileSeedKeys].sort()) {
  const separator = key.lastIndexOf("/");
  const profileId = key.slice(0, separator);
  const seed = Number(key.slice(separator + 1));
  const outcome = executeVerifiedWindow(profileId, seed);
  outcomes.set(key, outcome);
  if (!outcome.digestMatched) failures.push(`DETERMINISM_MISMATCH: ${key}`);
}

const rows = [];
for (const archetypeId of ARCHETYPE_IDS) {
  for (const spec of pairSpecsByArchetype.get(archetypeId)) {
    rows.push(trialRow(spec.archetypeId, spec.counterProfileId, spec.seed, outcomes));
  }
}

for (const archetypeId of ARCHETYPE_IDS) {
  const archetypeRows = rows.filter((row) => row.archetypeId === archetypeId);
  if (archetypeRows.length !== executedPairsPerArchetype) {
    failures.push(`MISSING_ROWS: ${archetypeId} has ${archetypeRows.length}, expected ${executedPairsPerArchetype}`);
  }
}
const rowKeys = rows.map(({ archetypeId, counterProfileId, seed }) => `${archetypeId}/${counterProfileId}/${seed}`);
if (new Set(rowKeys).size !== rowKeys.length) failures.push("MISSING_ROWS: duplicate archetype/counter/seed rows detected");
for (const row of rows) {
  if (
    row.pairedEntries.length !== 2
    || row.pairedEntries.some((entry) => entry.valueBudgetFingerprint !== row.valueBudgetFingerprint)
    || row.pairedEntries[0].valueBudgetFingerprint !== row.pairedEntries[1].valueBudgetFingerprint
  ) {
    failures.push(`UNEQUAL_FINGERPRINT: ${row.archetypeId}/${row.counterProfileId}/${row.seed}`);
  }
}

const fullCanonicalExecution = executedPairsPerArchetype === CANONICAL_PAIRS_PER_ARCHETYPE
  && canonicalJson([...executedSeeds].sort((left, right) => left - right)) === canonicalJson(CANONICAL_SEEDS);
if (fullCanonicalExecution) {
  for (const row of rows) {
    const reverseKey = `${row.counterProfileId}/${row.archetypeId}/${row.seed}`;
    if (!rowKeys.includes(reverseKey)) failures.push(`MISSING_ROWS: reverse symmetric row ${reverseKey}`);
  }
}

const comboId = QA_MULTI_SKILL_MEASUREMENT_FIXTURE.activeSkillIds.join(">");
const comboOutcomes = new Map();
const legalComboRows = executedSeeds.map((seed) => {
  const rawOutcome = executeVerifiedWindow(QA_MULTI_SKILL_MEASUREMENT_FIXTURE_ID, seed);
  const outcomeRef = outcomeReference(QA_MULTI_SKILL_MEASUREMENT_FIXTURE_ID, seed);
  comboOutcomes.set(outcomeRef, rawOutcome);
  if (!rawOutcome.digestMatched) failures.push(`DETERMINISM_MISMATCH: legal combo ${comboId}/${seed}`);
  const comboDamageEvents = rawOutcome.damageEvents.filter(({ skillId }) => skillId !== null);
  const ev = comboDamageEvents.reduce((sum, event) => sum + event.finalDamage, 0);
  return {
    comboId,
    seed,
    orderedAbilityIds: [...QA_MULTI_SKILL_MEASUREMENT_FIXTURE.activeSkillIds],
    legal: true,
    ev,
    evUnit: "observed-linked-skill-final-damage-per-window",
    rawOutcome: { outcomeRef, digestSha256: rawOutcome.digestSha256 },
  };
});
const evValues = legalComboRows.map(({ ev }) => ev);
const maxEV = Math.max(...evValues);
const medianEV = median(evValues);
const maxOverMedian = medianEV === 0 ? null : maxEV / medianEV;
const legalComboSummary = {
  sampleCount: legalComboRows.length,
  maxEV,
  medianEV,
  maxOverMedian,
  status: medianEV === 0
    ? "NOT_OBSERVED_ZERO_MEDIAN"
    : maxOverMedian <= 1.30
      ? "MEASURED_WITHIN_BOUND_PENDING_INDEPENDENT_REVIEW"
      : "MEASURED_THRESHOLD_VIOLATION_PENDING_INDEPENDENT_REVIEW",
  thresholdMaximumInclusive: 1.30,
};

const outcomeRecords = Object.fromEntries(
  [...outcomes.values(), ...comboOutcomes.values()]
    .sort((left, right) => outcomeReference(left.profileId, left.seed).localeCompare(outcomeReference(right.profileId, right.seed)))
    .map((outcome) => [outcomeReference(outcome.profileId, outcome.seed), outcome]),
);
for (const row of rows) {
  for (const link of Object.values(row.rawOutcomes)) {
    if (!outcomeRecords[link.outcomeRef] || outcomeRecords[link.outcomeRef].digestSha256 !== link.digestSha256) {
      failures.push(`MISSING_ROWS: unresolved outcome reference ${link.outcomeRef}`);
    }
  }
}
for (const row of legalComboRows) {
  const link = row.rawOutcome;
  if (!outcomeRecords[link.outcomeRef] || outcomeRecords[link.outcomeRef].digestSha256 !== link.digestSha256) {
    failures.push(`ILLEGAL_COMBO: unresolved outcome reference ${link.outcomeRef}`);
  }
}

const payload = {
  schemaVersion: SCHEMA_VERSION,
  scriptId: SCRIPT_ID,
  classification: "deterministic-scripted-measurement-not-human-playtest",
  controller: {
    kind: "synthetic",
    policy: "fixed-idle-cast-all-profile-skills",
    humanEvidenceStatus: "NOT_HUMAN_EVIDENCE",
  },
  provenance: {
    stageId: STAGE_ID,
    rulesVersion: RULES_VERSION,
    catalogDigest,
    windowTicks: WINDOW_TICKS,
    inputPolicy: "queue MOVE IDLE and every catalog profile active skill before each one-tick advance",
  },
  trialPlan: {
    archetypes: ARCHETYPE_IDS,
    seeds: CANONICAL_SEEDS,
    counterPolicy: "all other authored measurement profiles, ordered by id",
    pairsPerArchetype: CANONICAL_PAIRS_PER_ARCHETYPE,
    expectedRowCount: ARCHETYPE_IDS.length * CANONICAL_PAIRS_PER_ARCHETYPE,
    winnerRule: WINNER_RULE,
    valueBudget,
    valueBudgetFingerprint,
  },
  execution: {
    seeds: executedSeeds,
    pairsPerArchetype: executedPairsPerArchetype,
    rowCount: rows.length,
    mode: fullCanonicalExecution ? "CANONICAL" : "REDUCED_VERIFICATION_SAMPLE",
    symmetricCoverage: fullCanonicalExecution ? "COMPLETE_ORDERED_REVERSE_PAIRS" : "REDUCED_SAMPLE_NOT_CANONICAL_EVIDENCE",
  },
  outcomeRecords,
  rows,
  legalComboEv: {
    metric: "sum of retained SKILL_RESOLVED_DAMAGE finalDamage for the catalog-authored ordered active-skill fixture over the fixed window",
    rows: legalComboRows,
    summary: legalComboSummary,
  },
  status: failures.length === 0 ? "COMPLETE" : "FAILED",
  failures,
};

const outputPath = resolve(output);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
process.stdout.write(`${SCRIPT_ID}: ${payload.status}; rows=${rows.length}; output=${outputPath}\n`);
if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
}
