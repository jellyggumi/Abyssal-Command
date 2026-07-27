#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CANONICAL_SEEDS = [401, 402, 403, 404, 405];
const G7_EVENT_TYPES = [
  "ELITE_PROMPT_VISIBLE",
  "MOVEMENT_INTO_EXTRACTION_ZONE",
  "HOLD_PROGRESS_COMPLETED",
  "EXTRACT_ELITE_ACCEPTED",
  "ELITE_EXTRACTED_VISIBLE",
  "EMBER_COHORT_PERSISTED_VISIBLE",
  "STAGING_RETURN_VISIBLE",
  "VOLUNTARY_REENTRY_DECISION",
];
const G7_PLAYER_ACTION_IDS = [
  "MOVE_TO_PRESSURE",
  "SELECT_GROWTH_OR_CAST_SKILL",
  "CHOOSE_FORMATION",
  "HOLD_AND_EXTRACT_ELITE",
];
const G7_REWARD_EVENT_IDS = ["ELITE_EXTRACTED"];
const G8_EVENT_TYPES = [
  "ELITE_PROMPT_VISIBLE",
  "OCCUPATION_HOLD_OBSERVED",
  "EXTRACTION_HOLD_OBSERVED",
  "EXTRACTION_CHOICE_OBSERVED",
  "RESULT_VISIBLE",
  "EMBER_COHORT_PERSISTENCE_OBSERVED",
  "STAGING_RETURN_VISIBLE",
  "RAW_IMPRESSION_SCORE_RECORDED",
];
const G8_TITLES = ["Arknights", "Kingdom Rush", "Dungeon Warfare 2", "Vampire Survivors", "Hades"];
const G8_IMPRESSION_QUESTION = "How distinctive and memorable was choosing to leave the fight to bind this elite for future runs?";
const G8_SOURCE_KINDS = [
  "OFFICIAL_SITE",
  "OFFICIAL_STORE",
  "OFFICIAL_DOCUMENTATION",
  "PRIMARY_GAME_CAPTURE",
  "SECONDARY_REFERENCE",
];
const SYMMETRIC_TERMINALS = ["DEFEAT", "INCOMPLETE_WINDOW", "VICTORY", "FINAL_COMPLETION"];
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;
const SHA256 = /^[0-9a-f]{64}$/;
const SHA1 = /^[0-9a-f]{40}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function usage(message) {
  if (message) console.error(`stage1b-gates: ${message}`);
  console.error(
    "Usage: node scripts/evaluate-stage1b-gates.mjs "
      + "--symmetric <artifact.json> --g3 <artifact.json> --pressure <artifact.json> "
      + "--persistence <artifact.json> [--g7 <artifact.json>] "
      + "[--g8-survey <artifact.json>] [--g8-impression <artifact.json>] "
      + "[--g6-provenance <artifact.json>] [--g6-scenario <artifact.json>] "
      + "[--g6-fullapp <artifact.json>] [--g6-leak <artifact.json>] "
      + "[--g6-soak <artifact.json>] --output <verdict.json>",
  );
  process.exit(2);
}

function parseArgs(argv) {
  const known = new Set([
    "--symmetric",
    "--g3",
    "--pressure",
    "--persistence",
    "--g7",
    "--g8-survey",
    "--g8-impression",
    "--g6-provenance",
    "--g6-scenario",
    "--g6-fullapp",
    "--g6-leak",
    "--g6-soak",
    "--output",
  ]);
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!known.has(flag)) usage(`unknown option ${flag ?? ""}`);
    if (!value || value.startsWith("--")) usage(`${flag} requires a path`);
    if (values[flag]) usage(`${flag} may be supplied only once`);
    values[flag] = resolve(value);
  }
  for (const required of ["--symmetric", "--g3", "--pressure", "--persistence", "--output"]) {
    if (!values[required]) usage(`${required} is required`);
  }
  return values;
}

function digest(raw) {
  return `sha256:${createHash("sha256").update(raw).digest("hex")}`;
}

async function loadArtifact(label, path) {
  if (!path) {
    return {
      label,
      source: { path: null, digest: null, readStatus: "NOT_SUPPLIED" },
      value: null,
      failures: [`${label}: artifact path was not supplied`],
    };
  }
  try {
    const raw = await readFile(path, "utf8");
    const source = { path: relative(REPOSITORY_ROOT, path), digest: digest(raw), readStatus: "READ" };
    try {
      const value = JSON.parse(raw);
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { label, source, value: null, failures: [`${label}: JSON root must be an object`] };
      }
      return { label, source, value, failures: [] };
    } catch (error) {
      return { label, source, value: null, failures: [`${label}: invalid JSON (${error.message})`] };
    }
  } catch (error) {
    return {
      label,
      source: { path: relative(REPOSITORY_ROOT, path), digest: null, readStatus: "UNREADABLE" },
      value: null,
      failures: [`${label}: could not read artifact (${error.code ?? error.message})`],
    };
  }
}

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
const isNonempty = (value) => typeof value === "string" && value.trim().length > 0;
const sameSet = (left, right) => left.length === right.length
  && new Set(left).size === left.length
  && left.every((value) => right.includes(value));

function validSessionRecordingName(fileName, buildSha, participantId, sortieSequence) {
  if (!isNonempty(fileName)) return false;
  const prefix = `${buildSha}__${participantId}__s${String(sortieSequence).padStart(2, "0")}__e000__session-recording.`;
  return ["webm", "mp4", "mov"].some((extension) => fileName === `${prefix}${extension}`);
}
function isValidIsoTimestamp(value) {
  if (typeof value !== "string" || !ISO_TIMESTAMP.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    && new Date(timestamp).toISOString().slice(0, 19) === value.slice(0, 19);
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function artifactResult(source, verdict, observed, failures, rawEvidenceReferences = []) {
  return { verdict, observed, source, rawEvidenceReferences, failures };
}

function terminalRank(terminal) {
  return terminal === "VICTORY" || terminal === "FINAL_COMPLETION"
    ? 2
    : terminal === "DEFEAT" ? 0 : 1;
}

function rawWinnerVector(outcome) {
  if (!isObject(outcome)
      || !SYMMETRIC_TERMINALS.includes(outcome.terminal)
      || !isFiniteNumber(outcome.totalDamageDealt) || outcome.totalDamageDealt < 0
      || !isObject(outcome.endIntegrity)
      || !isFiniteNumber(outcome.endIntegrity.commander) || outcome.endIntegrity.commander < 0
      || !isFiniteNumber(outcome.endIntegrity.gate) || outcome.endIntegrity.gate < 0
      || !Number.isInteger(outcome.tick) || outcome.tick < 0) return null;
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

function resolveOutcome(document, link, prefix, failures) {
  if (!isObject(link) || !isNonempty(link.outcomeRef) || !isNonempty(link.digestSha256)) {
    failures.push(`${prefix}: outcome reference or digest is missing`);
    return null;
  }
  const outcome = document.outcomeRecords?.[link.outcomeRef];
  if (!isObject(outcome)
      || outcome.digestSha256 !== link.digestSha256
      || outcome.digestMatched !== true) {
    failures.push(`${prefix}: outcome reference ${link.outcomeRef} is unresolved or fails digest verification`);
    return null;
  }
  if (!rawWinnerVector(outcome)) {
    failures.push(`${prefix}: outcome contains an unsupported terminal or invalid winner-vector values`);
    return null;
  }
  return outcome;
}

function pressureGateObservation(pressureArtifact, readiness) {
  const observed = {
    gateMinPctRange: [55.0, 80.0],
    defeats: 0,
    denominator: 0,
    allowedDefeats: [0, 3],
    measuredBossTtks: 0,
    bossTtkSecondsRange: [5.95, 8.05],
  };
  if (readiness.verdict !== "PASS") return { observed, blocked: [...readiness.failures], misses: [] };
  const rows = pressureArtifact.value.rows;
  observed.denominator = rows.length;
  observed.defeats = rows.filter((row) => row.terminal === "DEFEAT").length;
  observed.measuredBossTtks = rows.filter((row) => row.bossTtkStatus === "MEASURED").length;
  const blocked = [];
  const misses = [];
  for (const row of rows) {
    const key = `${row.stance}/${row.seed}`;
    if (row.gateMinPct < 55.0 || row.gateMinPct > 80.0) {
      misses.push(`G2: pressure row ${key} gateMinPct ${row.gateMinPct} is outside 55.0-80.0`);
    }
    if (row.bossTtkStatus === "MEASURED" && !isFiniteNumber(row.bossTtkSeconds)) {
      blocked.push(`G2: pressure row ${key} claims a measured boss TTK but omits its numeric seconds`);
    } else if (row.bossTtkStatus !== "MEASURED"
        || row.bossTtkSeconds < 5.95
        || row.bossTtkSeconds > 8.05) {
      misses.push(`G2: pressure row ${key} boss TTK is ${row.bossTtkStatus}/${row.bossTtkSeconds}; required MEASURED and 5.95-8.05 seconds`);
    }
  }
  if (observed.defeats < 0 || observed.defeats > 3) {
    misses.push(`G2: pressure rows observed ${observed.defeats}/15 defeats; required 0-3/15`);
  }
  return { observed, blocked, misses };
}

function evaluateG2(artifact, pressureArtifact, pressureReadiness) {
  const failures = [...artifact.failures];
  const document = artifact.value;
  const pressure = pressureGateObservation(pressureArtifact, pressureReadiness);
  const observed = {
    threshold: { minimumWins: 9, maximumWins: 11, denominator: 20 },
    archetypes: [],
    pressure: pressure.observed,
  };
  if (!document) {
    failures.push(...pressure.blocked);
    return artifactResult(
      { symmetric: artifact.source, pressure: pressureArtifact.source },
      "BLOCKED",
      observed,
      failures,
    );
  }
  failures.push(...pressure.blocked);

  const archetypes = document.trialPlan?.archetypes;
  const rows = document.rows;
  if (document.schemaVersion !== "stage1b-symmetric-trials-v1"
      || document.classification !== "deterministic-scripted-measurement-not-human-playtest"
      || document.controller?.kind !== "synthetic"
      || document.provenance?.stageId !== "cinder-span") {
    failures.push("G2: unsupported symmetric schema or provenance");
  }
  if (document.status !== "COMPLETE" || !Array.isArray(document.failures) || document.failures.length !== 0) {
    failures.push("G2: symmetric producer did not report a complete failure-free artifact");
  }
  if (!Array.isArray(archetypes) || archetypes.length !== 5 || new Set(archetypes).size !== 5 || archetypes.some((id) => !isNonempty(id))) {
    failures.push("G2: canonical trial plan must contain five unique archetypes");
  }
  if (!sameSet(document.trialPlan?.seeds ?? [], CANONICAL_SEEDS)
      || document.trialPlan?.pairsPerArchetype !== 20
      || document.trialPlan?.expectedRowCount !== 100
      || document.execution?.mode !== "CANONICAL"
      || document.execution?.symmetricCoverage !== "COMPLETE_ORDERED_REVERSE_PAIRS"
      || document.execution?.rowCount !== 100
      || !Array.isArray(rows)
      || rows.length !== 100
      || !isObject(document.outcomeRecords)) {
    failures.push("G2: symmetric artifact is missing canonical 5x20 coverage or keyed raw outcomes");
  }
  const planFingerprint = document.trialPlan?.valueBudgetFingerprint;
  if (!isNonempty(planFingerprint)) failures.push("G2: trial plan budget fingerprint is missing");

  if (!Array.isArray(archetypes) || !Array.isArray(rows)) {
    return artifactResult(
      { symmetric: artifact.source, pressure: pressureArtifact.source },
      "BLOCKED",
      observed,
      failures,
    );
  }

  const rowKeys = new Set();
  const computed = [];
  for (const [index, row] of rows.entries()) {
    const key = `${row?.archetypeId}/${row?.counterProfileId}/${row?.seed}`;
    if (!isObject(row)
        || !archetypes.includes(row.archetypeId)
        || !archetypes.includes(row.counterProfileId)
        || row.archetypeId === row.counterProfileId
        || !CANONICAL_SEEDS.includes(row.seed)) {
      failures.push(`G2: row ${index} has a non-canonical identity`);
      continue;
    }
    if (rowKeys.has(key)) failures.push(`G2: duplicate row ${key}`);
    rowKeys.add(key);
    if (!isNonempty(row.valueBudgetFingerprint)
        || row.valueBudgetFingerprint !== planFingerprint
        || !Array.isArray(row.pairedEntries)
        || row.pairedEntries.length !== 2
        || row.pairedEntries.some((entry) => !isObject(entry)
          || entry.valueBudgetFingerprint !== planFingerprint
          || entry.budgetId !== document.trialPlan?.valueBudget?.budgetId
          || !isNonempty(entry.outcomeRef)
          || !isNonempty(entry.digestSha256))) {
      failures.push(`G2: row ${key} has a missing or unequal budget/outcome fingerprint`);
    }
    const archetypeOutcome = resolveOutcome(document, row.rawOutcomes?.archetype, `G2 row ${key} archetype`, failures);
    const counterOutcome = resolveOutcome(document, row.rawOutcomes?.counter, `G2 row ${key} counter`, failures);
    const archetypeVector = rawWinnerVector(archetypeOutcome);
    const counterVector = rawWinnerVector(counterOutcome);
    if (!archetypeVector || !counterVector) {
      failures.push(`G2: row ${key} lacks recomputable raw outcomes`);
      continue;
    }
    const comparison = compareVectors(archetypeVector, counterVector);
    const winner = comparison > 0 ? row.archetypeId : comparison < 0 ? row.counterProfileId : "TIE";
    if (row.winner !== winner) failures.push(`G2: row ${key} producer winner disagrees with raw outcomes`);
    computed.push({ ...row, computedWinner: winner });
  }

  for (const archetypeId of archetypes) {
    for (const counterProfileId of archetypes) {
      if (counterProfileId === archetypeId) continue;
      for (const seed of CANONICAL_SEEDS) {
        const key = `${archetypeId}/${counterProfileId}/${seed}`;
        if (!rowKeys.has(key)) failures.push(`G2: missing canonical row ${key}`);
      }
    }
    const ownRows = computed.filter((row) => row.archetypeId === archetypeId);
    observed.archetypes.push({
      archetypeId,
      explicitWins: ownRows.filter((row) => row.computedWinner === archetypeId).length,
      ties: ownRows.filter((row) => row.computedWinner === "TIE").length,
      denominator: ownRows.length,
    });
  }

  const source = { symmetric: artifact.source, pressure: pressureArtifact.source };
  if (failures.length) return artifactResult(source, "BLOCKED", observed, failures);
  const misses = observed.archetypes.filter(({ explicitWins, denominator }) => denominator !== 20 || explicitWins < 9 || explicitWins > 11);
  failures.push(...misses.map(({ archetypeId, explicitWins, denominator }) =>
    `G2: ${archetypeId} observed ${explicitWins}/${denominator} explicit wins; required 9-11/20`));
  failures.push(...pressure.misses);
  return artifactResult(source, failures.length ? "FAIL" : "PASS", observed, failures);
}

function recomputeComboEv(document, row, index, failures) {
  if (!isObject(row) || row.legal !== true || !Array.isArray(row.orderedAbilityIds)
      || row.orderedAbilityIds.length < 2 || new Set(row.orderedAbilityIds).size !== row.orderedAbilityIds.length
      || !CANONICAL_SEEDS.includes(row.seed)) {
    failures.push(`G3: legal combo row ${index} is incomplete or non-canonical`);
    return null;
  }
  const outcome = resolveOutcome(document, row.rawOutcome, `G3 legal combo row ${index}`, failures);
  const events = outcome?.damageEvents?.filter(({ skillId }) => skillId !== null);
  if (!Array.isArray(events) || !events.length) {
    failures.push(`G3: legal combo row ${index} lacks deterministic raw damage events`);
    return null;
  }
  if (events.some((event) => !isObject(event)
    || !isFiniteNumber(event.finalDamage)
    || event.finalDamage < 0
    || !Number.isInteger(event.tick)
    || !Number.isInteger(event.eventSequence))) {
    failures.push(`G3: legal combo row ${index} contains malformed raw damage events`);
    return null;
  }
  return events.reduce((sum, event) => sum + event.finalDamage, 0);
}



function validateTransition(row, index, failures) {
  if (!isObject(row) || row.mode !== "rally-then-turret" || row.targetStance !== "TURRET"
      || !Number.isInteger(row.acceptedSwitchTick) || !Number.isInteger(row.switchEventSequence)
      || !Number.isInteger(row.stanceSwitchEventSequence) || !Array.isArray(row.events)
      || !Array.isArray(row.frontAfter)
      || !["EXPOSED", "NOT_EXPOSED"].includes(row.exposureStatus)) {
    failures.push(`G3: formation transition ${index} lacks an explicit accepted boundary, FRONT list, or exposure status`);
    return null;
  }
  const accepted = row.events.find((event) => event.type === "INPUT_ACCEPTED"
    && event.inputType === "STANCE_CYCLE" && event.eventSequence === row.switchEventSequence);
  const switched = row.events.find((event) => event.type === "STANCE_SWITCHED"
    && event.stance === "TURRET" && event.eventSequence === row.stanceSwitchEventSequence);
  if (!accepted || accepted.tick !== row.acceptedSwitchTick || !switched
      || switched.tick !== row.acceptedSwitchTick || switched.eventSequence >= accepted.eventSequence) {
    failures.push(`G3: formation transition ${index} accepted-switch boundary is not recomputable from raw events`);
    return null;
  }
  if (row.events.some((event) => event.phase !== (event.tick < row.acceptedSwitchTick ? "before" : "after"))) {
    failures.push(`G3: formation transition ${index} contains incorrect phase attribution`);
  }
  const damage = { before: 0, switchTick: 0, after: 0 };
  const downs = { before: 0, switchTick: 0, after: 0 };
  for (const event of row.events) {
    const phase = event.tick < row.acceptedSwitchTick ? "before" : "after";
    if (event.type === "COMPANION_DAMAGED") damage[phase] += event.damage ?? 0;
    if (event.type === "COMPANION_DOWNED") downs[phase] += 1;
  }
  for (const phase of ["before", "switchTick", "after"]) {
    if (row.companionDamageByPhase?.[phase] !== damage[phase]
        || row.downsByPhase?.[phase] !== downs[phase]) {
      failures.push(`G3: formation transition ${index} ${phase} totals disagree with raw events`);
    }
  }
  const nonGraceCount = row.pressureContext?.nonGracePressureEventCount;
  if (!Number.isInteger(nonGraceCount)
      || row.exposureStatus !== (nonGraceCount > 0 ? "EXPOSED" : "NOT_EXPOSED")) {
    failures.push(`G3: formation transition ${index} exposure status is not recomputable`);
  }
  const rallyEvents = row.events.filter((event) => event.type === "BOSS_RALLY_WINDOW");
  if (!rallyEvents.length || rallyEvents.some((event) => !isFiniteNumber(event.cooldownReductionBp))) {
    failures.push(`G3: formation transition ${index} lacks raw boss-rally cooldown reduction evidence`);
    return null;
  }
  return {
    postSwitchDamage: damage.after,
    frontCount: row.frontAfter.length,
    cooldownReductions: rallyEvents.map(({ cooldownReductionBp }) => cooldownReductionBp),
  };
}

function evaluateG3(symmetricArtifact, g3Artifact) {
  const failures = [...symmetricArtifact.failures, ...g3Artifact.failures];
  const symmetric = symmetricArtifact.value;
  const attribution = g3Artifact.value;
  const observed = {
    legalCombo: {
      sampleCount: 0,
      maxEV: null,
      medianEV: null,
      maxOverMedian: null,
      thresholdMaximumInclusive: 1.30,
    },
    attribution: {
      rallyToTurret: 0,
      vanguardControls: 0,
      splitControls: 0,
      exposed: 0,
      notExposed: 0,
      zeroDamageConversions: null,
      turretFrontCounts: [],
      controlCompanionsDowned: null,
      controlDefeats: null,
      controlDefeatRate: null,
      controlDefeatRateMaximumInclusive: 0.20,
      bossRallyCooldownReductionsBp: [],
    },
  };

  const comboRows = symmetric?.legalComboEv?.rows;
  const evValues = [];
  if (!symmetric) failures.push("G3: symmetric artifact is unavailable for legal-combo EV");
  if (symmetric && (symmetric.schemaVersion !== "stage1b-symmetric-trials-v1"
      || symmetric.status !== "COMPLETE"
      || !Array.isArray(symmetric.failures)
      || symmetric.failures.length !== 0
      || symmetric.controller?.kind !== "synthetic"
      || symmetric.provenance?.stageId !== "cinder-span"
      || !isObject(symmetric.outcomeRecords))) {
    failures.push("G3: symmetric legal-combo artifact provenance/status is incomplete");
  }
  if (!Array.isArray(comboRows) || comboRows.length !== 5
      || !sameSet(comboRows?.map((row) => row.seed) ?? [], CANONICAL_SEEDS)) {
    failures.push("G3: legal-combo evidence must contain one raw row for each canonical seed");
  } else {
    comboRows.forEach((row, index) => {
      const value = recomputeComboEv(symmetric, row, index, failures);
      if (value !== null) evValues.push(value);
    });
  }
  if (evValues.length === 5) {
    observed.legalCombo.sampleCount = evValues.length;
    observed.legalCombo.maxEV = Math.max(...evValues);
    observed.legalCombo.medianEV = median(evValues);
    observed.legalCombo.maxOverMedian = observed.legalCombo.medianEV === 0
      ? null
      : observed.legalCombo.maxEV / observed.legalCombo.medianEV;
    if (observed.legalCombo.medianEV === 0) failures.push("G3: legal-combo median EV is zero, so the ratio is not measurable");
  }

  const transitionMetrics = [];
  const controlMetrics = [];
  if (!attribution) {
    failures.push("G3: phase-attribution artifact is unavailable");
  } else {
    if (attribution.schemaVersion !== "stage1b-g3-formation-transition-v1"
        || attribution.controller?.kind !== "synthetic"
        || attribution.samplePlan?.stageId !== "cinder-span"
        || attribution.summary?.status !== "COMPLETE") {
      failures.push("G3: unsupported or incomplete phase-attribution artifact provenance");
    }

    const transitions = attribution.formationTransitions;
    const controls = attribution.controlRuns;
    if (!Array.isArray(transitions) || transitions.length < 50) {
      failures.push("G3: fewer than 50 rally-to-TURRET transitions were retained");
    } else {
      const transitionKeys = transitions.map((row) => `${row.seed}/${row.runId}`);
      if (new Set(transitionKeys).size !== transitionKeys.length) failures.push("G3: duplicate formation transitions detected");
      transitions.forEach((row, index) => {
        const metrics = validateTransition(row, index, failures);
        if (metrics) transitionMetrics.push(metrics);
      });
      observed.attribution.rallyToTurret = transitions.length;
      observed.attribution.exposed = transitions.filter((row) => row.exposureStatus === "EXPOSED").length;
      observed.attribution.notExposed = transitions.filter((row) => row.exposureStatus === "NOT_EXPOSED").length;
    }
    if (!Array.isArray(controls)) {
      failures.push("G3: control runs are missing");
    } else {
      const vanguard = controls.filter((row) => row.targetStance === "VANGUARD");
      const split = controls.filter((row) => row.targetStance === "SPLIT");
      observed.attribution.vanguardControls = vanguard.length;
      observed.attribution.splitControls = split.length;
      if (vanguard.length < 50 || split.length < 50) failures.push("G3: at least 50 VANGUARD and 50 SPLIT controls are required");
      const controlKeys = controls.map((row) => `${row.targetStance}/${row.seed}`);
      if (new Set(controlKeys).size !== controlKeys.length) failures.push("G3: duplicate control runs detected");
      controls.forEach((row, index) => {
        if (!isObject(row) || row.mode !== "control" || !["VANGUARD", "SPLIT"].includes(row.targetStance)
            || !Array.isArray(row.events) || !isFiniteNumber(row.companionDamageTaken)
            || !Number.isInteger(row.companionsDowned) || !Number.isInteger(row.defeatCount)
            || !isNonempty(row.terminal)) {
          failures.push(`G3: control row ${index} is incomplete`);
          return;
        }
        const recomputedDowns = row.events.filter((event) => event.type === "COMPANION_DOWNED").length;
        const recomputedDefeat = row.terminal === "DEFEAT" ? 1 : 0;
        if (row.companionsDowned !== recomputedDowns || row.defeatCount !== recomputedDefeat) {
          failures.push(`G3: control row ${index} summary disagrees with raw events/terminal`);
        }
        controlMetrics.push({ companionsDowned: recomputedDowns, defeatCount: recomputedDefeat });
      });
    }
  }

  if (transitionMetrics.length) {
    observed.attribution.zeroDamageConversions = transitionMetrics.filter(({ postSwitchDamage }) => postSwitchDamage <= 0).length;
    observed.attribution.turretFrontCounts = transitionMetrics.map(({ frontCount }) => frontCount);
    observed.attribution.bossRallyCooldownReductionsBp = transitionMetrics.flatMap(({ cooldownReductions }) => cooldownReductions);
  }
  if (controlMetrics.length) {
    observed.attribution.controlCompanionsDowned = controlMetrics.reduce((sum, row) => sum + row.companionsDowned, 0);
    observed.attribution.controlDefeats = controlMetrics.reduce((sum, row) => sum + row.defeatCount, 0);
    observed.attribution.controlDefeatRate = observed.attribution.controlDefeats / controlMetrics.length;
  }

  const source = { symmetric: symmetricArtifact.source, phaseAttribution: g3Artifact.source };
  if (failures.length) return artifactResult(source, "BLOCKED", observed, failures);
  if (observed.attribution.bossRallyCooldownReductionsBp.some((value) => value !== 0)) {
    failures.push("G3: at least one raw BOSS_RALLY_WINDOW cooldownReductionBp is nonzero; required 0");
  }
  if (observed.attribution.turretFrontCounts.some((count) => count !== 1)) {
    failures.push("G3: every accepted TURRET transition must expose exactly one FRONT companion");
  }
  if (observed.attribution.zeroDamageConversions !== 0) {
    failures.push(`G3: ${observed.attribution.zeroDamageConversions}/${observed.attribution.rallyToTurret} rally-to-TURRET conversions had zero post-switch damage`);
  }
  if (observed.attribution.controlCompanionsDowned < 1) {
    failures.push("G3: VANGUARD+SPLIT controls observed no COMPANION_DOWNED event");
  }
  if (observed.attribution.controlDefeatRate > 0.20) {
    failures.push(`G3: combined control defeat rate ${observed.attribution.controlDefeatRate} exceeds 0.20`);
  }
  if (observed.legalCombo.maxOverMedian > 1.30) {
    failures.push(`G3: recomputed maxEV/medianEV ${observed.legalCombo.maxOverMedian} exceeds 1.30`);
  }
  return artifactResult(source, failures.length ? "FAIL" : "PASS", observed, failures);
}

function evaluatePressureReadiness(artifact) {
  const failures = [...artifact.failures];
  const document = artifact.value;
  const observed = { runCount: 0, expectedRunCount: 15, packetCount: 0 };
  if (!document) return artifactResult(artifact.source, "BLOCKED", observed, failures);
  const rows = document.rows;
  if (document.schemaVersion !== 1
      || document.controller?.kind !== "synthetic"
      || document.classification !== "deterministic-synthetic-scripted-measurement-not-human-g7-or-g8-evidence"
      || document.samplePlan?.stageId !== "cinder-span"
      || !sameSet(document.samplePlan?.seeds ?? [], CANONICAL_SEEDS)
      || !sameSet(document.samplePlan?.stances ?? [], ["VANGUARD", "TURRET", "SPLIT"])
      || document.samplePlan?.expectedRunCount !== 15
      || !Array.isArray(rows)
      || rows.length !== 15) {
    failures.push("pressure-readiness: canonical 15-run sample plan is incomplete");
  }
  if (Array.isArray(rows)) {
    observed.runCount = rows.length;
    const keys = new Set();
    rows.forEach((row, rowIndex) => {
      const key = `${row?.stance}/${row?.seed}`;
      if (keys.has(key)) failures.push(`pressure-readiness: duplicate run ${key}`);
      keys.add(key);
      if (!CANONICAL_SEEDS.includes(row?.seed) || !["VANGUARD", "TURRET", "SPLIT"].includes(row?.stance)
          || row?.stageId !== "cinder-span" || !isFiniteNumber(row?.gateMinPct)
          || !isNonempty(row?.terminal) || !isNonempty(row?.terminalReason)
          || !isNonempty(row?.bossTtkStatus) || !isObject(row?.bossGrace)
          || !isObject(row?.terminalPressureSeparation) || !isObject(row?.aggregate)
          || !Array.isArray(row?.pressurePackets) || row.pressurePackets.length !== 3) {
        failures.push(`pressure-readiness: run ${rowIndex} is missing retained measurement fields`);
        return;
      }
      row.pressurePackets.forEach((packet, packetIndex) => {
        observed.packetCount += 1;
        if (packet?.packetIndex !== packetIndex || !isObject(packet?.authoredBoundary)
            || !Array.isArray(packet?.arrivalEvents) || packet.arrivalEvents.length === 0
            || !Array.isArray(packet?.pressureEvents) || !Array.isArray(packet?.terminalPressureEvents)
            || !Array.isArray(packet?.recoveryEvents) || !Array.isArray(packet?.agencyWindows)
            || !isObject(packet?.bossGrace)
            || !isFiniteNumber(packet?.gateIntegrityBefore) || !isFiniteNumber(packet?.gateIntegrityAfter)
            || !isFiniteNumber(packet?.commanderIntegrityBefore) || !isFiniteNumber(packet?.commanderIntegrityAfter)) {
          failures.push(`pressure-readiness: run ${rowIndex} packet ${packetIndex} is incomplete`);
        }
      });
    });
  }
  return artifactResult(artifact.source, failures.length ? "BLOCKED" : "PASS", observed, failures);
}

function evaluatePersistenceReadiness(artifact) {
  const failures = [...artifact.failures];
  const document = artifact.value;
  const observed = { scenarioCount: 0, acceptedHandoffs: 0 };
  if (!document) return artifactResult(artifact.source, "BLOCKED", observed, failures);
  const scenarios = document.scenarios;
  const expected = ["victory", "defeat-after-acceptance", "defeat-before-acceptance"];
  if (document.schemaVersion !== 1 || document.controller?.kind !== "synthetic"
      || document.classification !== "synthetic-scripted-evidence-not-human-g7-g8"
      || document.humanEvidenceStatus !== "NOT_CLAIMED"
      || !isObject(document.invariants)
      || Object.values(document.invariants).some((value) => value !== true)
      || document.stageId !== "cinder-span" || !Array.isArray(scenarios)
      || scenarios.length !== 3 || !sameSet(scenarios?.map((row) => row.scenario) ?? [], expected)) {
    failures.push("persistence-readiness: canonical three-scenario artifact is incomplete");
  }
  if (Array.isArray(scenarios)) {
    observed.scenarioCount = scenarios.length;
    scenarios.forEach((row, index) => {
      const acceptedExpected = row.scenario === "defeat-before-acceptance" ? 0 : 1;
      observed.acceptedHandoffs += Array.isArray(row.acceptedHandoffs) ? row.acceptedHandoffs.length : 0;
      if (row.realizationStatus !== "REALIZED" || row.eventTraceStatus !== "RETAINED"
          || !Array.isArray(row.events) || row.events.length === 0
          || !Array.isArray(row.campaignDiff) || row.campaignDiff.length === 0
          || !isObject(row.campaignBefore) || !isObject(row.campaignAfter)
          || !Array.isArray(row.acceptedHandoffs) || row.acceptedHandoffs.length !== acceptedExpected
          || !Array.isArray(row.writes) || row.writes.length !== acceptedExpected
          || row.acceptedEliteExtractCount !== acceptedExpected
          || !isObject(row.invariantChecks) || Object.values(row.invariantChecks).some((value) => value !== true)) {
        failures.push(`persistence-readiness: scenario ${index} lacks a complete retained trace/state diff`);
      }
      if (row.events.some((event, eventIndex) => !Number.isInteger(event.eventSequence)
        || (eventIndex > 0 && event.eventSequence <= row.events[eventIndex - 1].eventSequence))) {
        failures.push(`persistence-readiness: scenario ${index} event trace is unordered`);
      }
    });
  }
  return artifactResult(artifact.source, failures.length ? "BLOCKED" : "PASS", observed, failures);
}

function validEvidenceEvents(events, expectedTypes, buildSha, participantId, sortieSequence, failures, prefix) {
  if (!Array.isArray(events) || events.length !== expectedTypes.length) {
    failures.push(`${prefix}: evidence sequence must contain ${expectedTypes.length} raw events`);
    return [];
  }
  const references = [];
  events.forEach((event, index) => {
    const eventPrefix = `${buildSha}__${participantId}__s${String(sortieSequence).padStart(2, "0")}__e${String(index + 1).padStart(3, "0")}__`;
    const eventFileName = event?.evidence_file_name;
    const eventSuffix = isNonempty(eventFileName) && eventFileName.startsWith(eventPrefix)
      ? eventFileName.slice(eventPrefix.length)
      : "";
    if (event?.event_sequence !== index + 1 || event?.event_type !== expectedTypes[index]
        || event?.occurred !== true || event?.visible_in_rendered_build !== true
        || !Number.isInteger(event?.captured_at_recording_ms) || event.captured_at_recording_ms < 0
        || !/^[a-z0-9-]+\.(webm|mp4|mov|json|png)$/.test(eventSuffix)
        || !SHA256.test(event?.evidence_sha256 ?? "")) {
      failures.push(`${prefix}: event ${index + 1} is incomplete, unordered, or not tied to the session`);
    }
    if (/^[a-z0-9-]+\.(webm|mp4|mov|json|png)$/.test(eventSuffix)
        && SHA256.test(event?.evidence_sha256 ?? "")) {
      references.push({ path: eventFileName, digest: `sha256:${event.evidence_sha256}`, eventType: event.event_type });
    }
  });
  return references;
}

function evaluateG7(artifact) {
  const failures = [...artifact.failures];
  const document = artifact.value;
  const observed = {
    voluntaryReentries: 0,
    eligibleDecisions: 0,
    participants: 0,
    durationRangeSeconds: [30, 180],
    minimumPlayerActionsPerDecision: 3,
    minimumRewardEventsPerDecision: 1,
    playerActionCounts: [],
    rewardEventCounts: [],
  };
  const refs = [];
  if (!document) return artifactResult(artifact.source, "BLOCKED", observed, failures, refs);
  const participants = document.participants;
  const decisions = document.decisions;
  if (!["READY_FOR_REVIEW", "PASS"].includes(document.artifact_status)) {
    failures.push(`G7: artifact status ${document.artifact_status ?? "MISSING"} does not authorize evaluation`);
  }
  if (document.schema_version !== "1.0.0" || document.gate !== "G7"
      || !SHA1.test(document.build_sha ?? "")
      || !isNonempty(document.study_id) || !Array.isArray(participants) || participants.length !== 10
      || !Array.isArray(decisions) || decisions.length !== 20) {
    failures.push("G7: canonical study metadata, 10 participants, or 20 decisions are missing");
  }
  if (Array.isArray(participants)) {
    observed.participants = participants.length;
    const ids = participants.map((row) => row.participant_id);
    if (new Set(ids).size !== participants.length) failures.push("G7: participant IDs are not unique");
    participants.forEach((row, index) => {
      if (!isObject(row) || !/^G7-P\d{2}$/.test(row.participant_id ?? "") || row.human_confirmed !== true
          || row.consent_to_record_confirmed !== true || row.unique_for_build_confirmed !== true
          || row.controls_accessible_confirmed !== true || row.included !== true) {
        failures.push(`G7: participant ${index} is not a complete included human record`);
      }
    });
  }
  if (Array.isArray(decisions)) {
    observed.eligibleDecisions = decisions.length;
    observed.voluntaryReentries = decisions.filter((row) => row.voluntary_reentry === true).length;
    const keys = new Set();
    decisions.forEach((row, index) => {
      const prefix = `G7 decision ${index}`;
      const key = `${row?.participant_id}/${row?.sortie_sequence}`;
      if (keys.has(key)) failures.push(`${prefix}: duplicate participant/sortie`);
      keys.add(key);
      const duration = isFiniteNumber(row?.timing_start_recording_ms) && isFiniteNumber(row?.timing_end_recording_ms)
        ? (row.timing_end_recording_ms - row.timing_start_recording_ms) / 1000
        : null;
      const playerActionIds = row?.player_action_ids;
      const rewardEventIds = row?.reward_event_ids;
      const playerActionsComplete = Array.isArray(playerActionIds)
        && playerActionIds.length >= 3
        && new Set(playerActionIds).size === playerActionIds.length
        && playerActionIds.every((id) => G7_PLAYER_ACTION_IDS.includes(id));
      const rewardEventsComplete = Array.isArray(rewardEventIds)
        && rewardEventIds.length >= 1
        && new Set(rewardEventIds).size === rewardEventIds.length
        && rewardEventIds.every((id) => G7_REWARD_EVENT_IDS.includes(id));
      observed.playerActionCounts.push(Array.isArray(playerActionIds) ? playerActionIds.length : 0);
      observed.rewardEventCounts.push(Array.isArray(rewardEventIds) ? rewardEventIds.length : 0);
      if (!participants?.some((participant) => participant.participant_id === row?.participant_id)
          || ![1, 2].includes(row?.sortie_sequence) || row?.build_sha !== document.build_sha
          || row?.rendered_build_confirmed !== true || row?.synthetic_controller !== false
          || row?.eligible_decision !== true || row?.reached_post_result_staging_choice !== true
          || row?.facilitator_prompted_reentry !== false || row?.facilitator_selected_player_action !== false
          || row?.timing_start_definition_confirmed !== true || row?.timing_end_definition_confirmed !== true
          || !playerActionsComplete || !rewardEventsComplete
          || duration === null || duration < 30 || duration > 180
          || !isFiniteNumber(row?.circuit_duration_seconds) || Math.abs(row.circuit_duration_seconds - duration) > 0.001
          || !["EXTRACTION_SUCCESS", "EXTRACTION_DECLINED"].includes(row?.route_outcome)
          || typeof row?.voluntary_reentry !== "boolean" || !isNonempty(row?.observer_id)
          || !isNonempty(row?.observer_signed_at_utc)
          || !validSessionRecordingName(row?.screen_recording_file_name, document.build_sha, row?.participant_id, row?.sortie_sequence)
          || !SHA256.test(row?.screen_recording_sha256 ?? "")) {
        failures.push(`${prefix}: human, timing, eligibility, or recording fields are incomplete`);
      }
      if (isNonempty(row?.screen_recording_file_name) && SHA256.test(row?.screen_recording_sha256 ?? "")) {
        refs.push({ path: row.screen_recording_file_name, digest: `sha256:${row.screen_recording_sha256}`, kind: "session-recording" });
      }
      refs.push(...validEvidenceEvents(row?.evidence_events, G7_EVENT_TYPES, document.build_sha, row?.participant_id, row?.sortie_sequence, failures, prefix));
    });
    if (Array.isArray(participants)) {
      for (const participant of participants) {
        if (decisions.filter((row) => row.participant_id === participant.participant_id).length !== 2) {
          failures.push(`G7: ${participant.participant_id} does not have exactly two eligible decisions`);
        }
      }
    }
  }
  if (failures.length) return artifactResult(artifact.source, "BLOCKED", observed, failures, refs);
  if (observed.voluntaryReentries < 14) {
    failures.push(`G7: observed ${observed.voluntaryReentries}/${observed.eligibleDecisions} voluntary re-entries; required at least 14/20`);
    return artifactResult(artifact.source, "FAIL", observed, failures, refs);
  }
  return artifactResult(artifact.source, "PASS", observed, failures, refs);
}

function evaluateG8Survey(artifact) {
  const failures = [...artifact.failures];
  const document = artifact.value;
  const observed = { directFeatureCount: 0, titleCount: 0, denominator: 5, thresholdMaximum: 2 };
  const refs = [];
  if (!document) return artifactResult(artifact.source, "BLOCKED", observed, failures, refs);
  const rows = document.rows;
  if (!["READY_FOR_REVIEW", "PASS"].includes(document.artifact_status)) {
    failures.push(`G8 survey: artifact status ${document.artifact_status ?? "MISSING"} does not authorize evaluation`);
  }
  if (document.schema_version !== "1.0.0" || document.gate !== "G8"
      || document.candidate_id !== "pressure-bound-elite-extraction"
      || !sameSet(document.expected_titles ?? [], G8_TITLES)
      || !Array.isArray(rows) || rows.length !== 5
      || !sameSet(rows?.map((row) => row.title) ?? [], G8_TITLES)) {
    failures.push("G8 survey: canonical five-title collection is incomplete");
  }
  if (Array.isArray(rows)) {
    observed.titleCount = rows.length;
    rows.forEach((row, index) => {
      const exactFromCriteria = row?.live_pve_player_choice === "PRESENT"
        && row?.spatial_or_time_commitment_under_active_pressure === "PRESENT"
        && row?.persistent_ally_or_companion_into_later_play === "PRESENT";
      if (!isObject(row) || !G8_TITLES.includes(row.title) || !Array.isArray(row.sources) || row.sources.length === 0
          || !ISO_DATE.test(row.review_date ?? "") || !isNonempty(row.reviewer_id)
          || !["PRESENT", "ABSENT"].includes(row.live_pve_player_choice)
          || !["PRESENT", "ABSENT"].includes(row.spatial_or_time_commitment_under_active_pressure)
          || !["PRESENT", "ABSENT"].includes(row.persistent_ally_or_companion_into_later_play)
          || !["DIRECT", "ADJACENT", "ABSENT"].includes(row.taxonomy)
          || typeof row.exact_feature_present !== "boolean" || row.derivation_confirmed !== true
          || row.exact_feature_present !== exactFromCriteria
          || (row.taxonomy === "DIRECT") !== row.exact_feature_present) {
        failures.push(`G8 survey: title row ${index} is incomplete or taxonomy is not derivable from the three criteria`);
      }
      row?.sources?.forEach((source, sourceIndex) => {
        if (!isObject(source) || !/^https:\/\//.test(source.source_url ?? "")
            || !isNonempty(source.source_title) || !G8_SOURCE_KINDS.includes(source.source_kind)
            || !ISO_DATE.test(source.accessed_date ?? "") || !isNonempty(source.exact_quote_or_mechanical_evidence)) {
          failures.push(`G8 survey: title row ${index} source ${sourceIndex} is incomplete`);
        } else {
          refs.push({ url: source.source_url, title: source.source_title, accessedDate: source.accessed_date, kind: source.source_kind });
        }
      });
    });
    observed.directFeatureCount = rows.filter((row) => row.exact_feature_present === true).length;
  }
  if (failures.length) return artifactResult(artifact.source, "BLOCKED", observed, failures, refs);
  if (observed.directFeatureCount > 2) {
    failures.push(`G8 survey: observed ${observed.directFeatureCount}/5 direct features; required at most 2/5`);
    return artifactResult(artifact.source, "FAIL", observed, failures, refs);
  }
  return artifactResult(artifact.source, "PASS", observed, failures, refs);
}

function evaluateG8Impression(artifact) {
  const failures = [...artifact.failures];
  const document = artifact.value;
  const observed = { scoreCount: 0, median: null, denominator: 10, thresholdMinimum: 4.0 };
  const refs = [];
  if (!document) return artifactResult(artifact.source, "BLOCKED", observed, failures, refs);
  const participants = document.participants;
  const sessions = document.sessions;
  if (!["READY_FOR_REVIEW", "PASS"].includes(document.artifact_status)) {
    failures.push(`G8 impression: artifact status ${document.artifact_status ?? "MISSING"} does not authorize evaluation`);
  }
  const scale = document.scale;
  if (document.question !== G8_IMPRESSION_QUESTION
      || !isObject(scale)
      || !sameSet(Object.keys(scale), ["minimum", "maximum", "minimum_label", "maximum_label"])
      || scale.minimum !== 1 || scale.maximum !== 5
      || scale.minimum_label !== "not distinctive" || scale.maximum_label !== "very distinctive"
      || !isValidIsoTimestamp(document.collected_at_utc)) {
    failures.push("G8 impression: canonical question, scale, or collection timestamp is missing or invalid");
  }
  if (document.schema_version !== "1.0.0" || document.gate !== "G8"
      || document.candidate_id !== "pressure-bound-elite-extraction" || !SHA1.test(document.build_sha ?? "")
      || !isNonempty(document.study_id) || !Array.isArray(participants) || participants.length !== 10
      || !Array.isArray(sessions) || sessions.length !== 10) {
    failures.push("G8 impression: canonical ten-person first-exposure study is incomplete");
  }
  if (Array.isArray(participants)) {
    const ids = participants.map((row) => row.participant_id);
    if (new Set(ids).size !== participants.length) failures.push("G8 impression: participant IDs are not unique");
    participants.forEach((row, index) => {
      if (!isObject(row) || !/^G8-P\d{2}$/.test(row.participant_id ?? "") || row.human_confirmed !== true
          || row.consent_to_record_confirmed !== true || row.first_exposure_confirmed !== true
          || row.unique_for_build_confirmed !== true || row.controls_accessible_confirmed !== true
          || row.included !== true) failures.push(`G8 impression: participant ${index} is incomplete`);
    });
  }
  const scores = [];
  if (Array.isArray(sessions)) {
    const ids = sessions.map((row) => row.participant_id);
    if (new Set(ids).size !== sessions.length) failures.push("G8 impression: each participant must have exactly one session");
    sessions.forEach((row, index) => {
      const prefix = `G8 impression session ${index}`;
      if (!participants?.some((participant) => participant.participant_id === row?.participant_id)
          || row?.build_sha !== document.build_sha || row?.sortie_sequence !== 1
          || row?.rendered_build_confirmed !== true || row?.synthetic_controller !== false
          || row?.first_exposure_confirmed !== true || row?.first_extraction_opportunity_observed !== true
          || row?.choice_visible_to_participant !== true || row?.choice_comprehended !== true
          || row?.unresolved_comprehension_failure !== false || row?.question_asked_verbatim !== true
          || !["EXTRACTION_COMPLETED", "EXTRACTION_DELIBERATELY_DECLINED"].includes(row?.route_outcome)
          || !Number.isInteger(row?.raw_score) || row.raw_score < 1 || row.raw_score > 5
          || !validSessionRecordingName(row?.screen_recording_file_name, document.build_sha, row?.participant_id, 1)
          || !SHA256.test(row?.screen_recording_sha256 ?? "")
          || !isNonempty(row?.moderator_id) || !isNonempty(row?.observer_id) || !isNonempty(row?.recorded_at_utc)) {
        failures.push(`${prefix}: first-exposure, comprehension, score, or recording fields are incomplete`);
      } else scores.push(row.raw_score);
      if (isNonempty(row?.screen_recording_file_name) && SHA256.test(row?.screen_recording_sha256 ?? "")) {
        refs.push({ path: row.screen_recording_file_name, digest: `sha256:${row.screen_recording_sha256}`, kind: "session-recording" });
      }
      refs.push(...validEvidenceEvents(row?.evidence_events, G8_EVENT_TYPES, document.build_sha, row?.participant_id, 1, failures, prefix));
    });
  }
  observed.scoreCount = scores.length;
  observed.median = scores.length === 10 ? median(scores) : null;
  if (failures.length) return artifactResult(artifact.source, "BLOCKED", observed, failures, refs);
  if (observed.median < 4.0) {
    failures.push(`G8 impression: observed median ${observed.median}/5; required at least 4.0/5`);
    return artifactResult(artifact.source, "FAIL", observed, failures, refs);
  }
  return artifactResult(artifact.source, "PASS", observed, failures, refs);
}

function combineG8(survey, impression) {
  const failures = [...survey.failures, ...impression.failures];
  const verdict = survey.verdict === "BLOCKED" || impression.verdict === "BLOCKED"
    ? "BLOCKED"
    : survey.verdict === "FAIL" || impression.verdict === "FAIL" ? "FAIL" : "PASS";
  return {
    verdict,
    observed: { survey: survey.observed, impression: impression.observed },
    source: { survey: survey.source, impression: impression.source },
    rawEvidenceReferences: [...survey.rawEvidenceReferences, ...impression.rawEvidenceReferences],
    components: { survey: survey.verdict, impression: impression.verdict },
    failures,
  };
}

async function provenanceReference(claim, id, allowedStatuses, failures) {
  if (!isObject(claim)
      || !allowedStatuses.includes(claim.status)
      || !isNonempty(claim.path)
      || !/^sha256:[0-9a-f]{64}$/.test(claim.digest ?? "")) {
    failures.push(`G6: ${id} verified provenance with path and sha256 digest is missing`);
    return null;
  }
  const sourcePath = resolve(claim.path);
  try {
    const raw = await readFile(sourcePath);
    const observedDigest = digest(raw);
    if (observedDigest !== claim.digest) {
      failures.push(`G6: ${id} provenance digest mismatch for ${sourcePath}`);
      return null;
    }
  } catch (error) {
    failures.push(`G6: ${id} provenance source is unreadable (${error.code ?? error.message})`);
    return null;
  }
  return { path: relative(REPOSITORY_ROOT, sourcePath), digest: claim.digest, kind: id };
}

async function evaluateG6(provenanceArtifact, scenarioArtifact, fullappArtifact, leakArtifact, soakArtifact) {
  const blocked = [
    ...provenanceArtifact.failures,
    ...scenarioArtifact.failures,
    ...fullappArtifact.failures,
    ...soakArtifact.failures,
  ];
  const misses = [];
  const refs = [];
  const observed = {
    fullappTiers: [],
    scenarioTierCount: 0,
    measurementIsolation: { fullapp: false, soak: false },
    soak: {
      actualDurationMs: null,
      frameDeltaP95Ms: null,
      longFrameRatio: null,
      inputP95Ms: null,
      heapSlopeMiBPerMin: null,
      memoryStable: null,
    },
    supplementalLeak: { supplied: Boolean(leakArtifact.value), generations: null },
    thresholds: {
      frameDeltaP95MsMaximumInclusive: 16.7,
      longFrameRatioMaximumExclusive: 0.005,
      inputP95MsMaximumInclusive: 100,
      domNodesMaximumExclusive: 5000,
      soakDurationMsMinimumInclusive: 1_800_000,
    },
  };

  const provenance = provenanceArtifact.value;
  if (provenance) {
    if (provenance.schemaVersion !== 1
        || provenance.gate !== "G6"
        || provenance.classification !== "machine-measured-provenance-not-human-evidence") {
      blocked.push("G6: provenance artifact envelope is not canonical");
    }
    const claims = provenance.requirements ?? provenance.evidence ?? provenance;
    for (const [field, id, allowedStatuses] of [
      ["telemetryContract", "telemetry-contract", ["TESTED"]],
      ["rollbackRunbook", "rollback-runbook", ["TESTED"]],
      ["releaseReadiness", "release-readiness", ["PASS"]],
      ["uiBrowserGate", "ui-browser-gate", ["TESTED"]],
    ]) {
      const claim = claims[field] ?? (Array.isArray(claims)
        ? claims.find((entry) => entry?.id === id)
        : null);
      const reference = await provenanceReference(claim, id, allowedStatuses, blocked);
      if (reference) refs.push(reference);
    }
  }

  const scenario = scenarioArtifact.value;
  if (scenario) {
    if (scenario.mode !== "scenario" || !Array.isArray(scenario.passes) || scenario.passes.length < 3) {
      blocked.push("G6: scenario artifact is incomplete");
    } else {
      observed.scenarioTierCount = scenario.passes.length;
      scenario.passes.forEach((row, index) => {
        if (!isNonempty(row?.tier?.label) || !Array.isArray(row?.errors) || row.errors.length !== 0) {
          blocked.push(`G6: scenario tier ${index} is malformed or contains runtime errors`);
        }
      });
    }
  }

  const fullapp = fullappArtifact.value;
  const expectedFullappTiers = [
    "desktop-m2pro-dsf1",
    "shipped-mobile-dsf2",
    "midtier-mobile-proxy-dsf2-cpu4x",
    "low-mobile-proxy-dsf2-cpu6x",
  ];
  const fullappIsolated = fullapp?.isolatedMeasurement === true
    || fullapp?.measurementIsolation?.status === "ISOLATED";
  observed.measurementIsolation.fullapp = fullappIsolated;
  if (fullapp) {
    if (fullapp.mode !== "fullapp" || !Array.isArray(fullapp.passes)
        || !sameSet(fullapp.passes?.map((row) => row?.tier?.label) ?? [], expectedFullappTiers)) {
      blocked.push("G6: full-app artifact must retain all four required device tiers");
    } else {
      if (!fullappIsolated) {
        blocked.push("G6: BLOCKED_PENDING_ISOLATED_MEASUREMENT (full-app evidence is not marked isolated)");
      }
      fullapp.passes.forEach((row, index) => {
        const tier = row.tier.label;
        const frameP95 = row.frameDeltaMs?.p95;
        const longRatio = row.longFrameRatio;
        const inputP95 = row.inputLatencyMs?.p95;
        const domNodes = row.domNodes;
        observed.fullappTiers.push({ tier, frameDeltaP95Ms: frameP95, longFrameRatio: longRatio, inputP95Ms: inputP95, domNodes });
        if (![frameP95, longRatio, inputP95, domNodes].every(isFiniteNumber)
            || frameP95 < 0 || longRatio < 0 || longRatio > 1 || inputP95 < 0
            || !Number.isInteger(domNodes) || domNodes < 0
            || !Array.isArray(row.errors)) {
          blocked.push(`G6: full-app tier ${index} lacks valid raw frame/input/DOM measurements`);
          return;
        }
        if (fullappIsolated) {
          if (row.errors.length) misses.push(`G6: full-app tier ${tier} contains runtime errors`);
          if (frameP95 > 16.7) misses.push(`G6: full-app tier ${tier} frameDeltaMs.p95 ${frameP95} exceeds 16.7ms`);
          if (longRatio >= 0.005) misses.push(`G6: full-app tier ${tier} longFrameRatio ${longRatio} is not below 0.005`);
          if (inputP95 > 100) misses.push(`G6: full-app tier ${tier} inputLatencyMs.p95 ${inputP95} exceeds 100ms`);
          if (domNodes >= 5000) misses.push(`G6: full-app tier ${tier} DOM count ${domNodes} is not below 5000`);
        }
      });
    }
  }

  const soak = soakArtifact.value;
  const soakIsolated = soak?.isolatedMeasurement === true
    || soak?.measurementIsolation?.status === "ISOLATED";
  observed.measurementIsolation.soak = soakIsolated;
  if (soak) {
    const explicitMemoryStable = typeof soak.memoryStable === "boolean" ? soak.memoryStable : null;
    const statusMemoryStable = ["STABLE", "PASS"].includes(soak.memoryStatus)
      ? true
      : ["UNSTABLE", "FAIL"].includes(soak.memoryStatus) ? false : null;
    const slopeMemoryStable = isFiniteNumber(soak.heapSlopeMiBPerMin)
      ? soak.heapSlopeMiBPerMin <= 0
      : null;
    const memoryStable = explicitMemoryStable ?? statusMemoryStable ?? slopeMemoryStable;
    const memorySignals = [explicitMemoryStable, statusMemoryStable, slopeMemoryStable]
      .filter((value) => value !== null);
    const contradictoryMemorySignals = new Set(memorySignals).size > 1;
    observed.soak = {
      actualDurationMs: soak.actualDurationMs ?? null,
      frameDeltaP95Ms: soak.frameDeltaMs?.p95 ?? null,
      longFrameRatio: soak.longFrameRatio ?? null,
      inputP95Ms: soak.inputLatencyMs?.p95 ?? null,
      heapSlopeMiBPerMin: soak.heapSlopeMiBPerMin ?? null,
      memoryStable,
      memorySignals: {
        explicit: explicitMemoryStable,
        status: statusMemoryStable,
        slope: slopeMemoryStable,
        contradictory: contradictoryMemorySignals,
      },
    };
    if (!soakIsolated) {
      blocked.push("G6: BLOCKED_PENDING_ISOLATED_MEASUREMENT (soak evidence is not marked isolated)");
    }
    if (soak.mode !== "soak"
        || !isFiniteNumber(soak.actualDurationMs) || soak.actualDurationMs < 0
        || !isFiniteNumber(soak.frameDeltaMs?.p95) || soak.frameDeltaMs.p95 < 0
        || !isFiniteNumber(soak.longFrameRatio) || soak.longFrameRatio < 0 || soak.longFrameRatio > 1
        || !isFiniteNumber(soak.inputLatencyMs?.p95) || soak.inputLatencyMs.p95 < 0
        || !isFiniteNumber(soak.heapSlopeMiBPerMin)
        || (soak.memoryStatus !== undefined
          && !["STABLE", "PASS", "UNSTABLE", "FAIL"].includes(soak.memoryStatus))
        || !Array.isArray(soak.errors)) {
      blocked.push("G6: 30-minute soak artifact is incomplete or contains invalid measurements");
    } else if (soakIsolated) {
      if (soak.errors.length) misses.push("G6: soak artifact contains runtime errors");
      if (soak.actualDurationMs < 1_800_000) misses.push(`G6: soak duration ${soak.actualDurationMs}ms is below 1800000ms`);
      if (soak.frameDeltaMs.p95 > 16.7) misses.push(`G6: soak frameDeltaMs.p95 ${soak.frameDeltaMs.p95} exceeds 16.7ms`);
      if (soak.longFrameRatio >= 0.005) misses.push(`G6: soak longFrameRatio ${soak.longFrameRatio} is not below 0.005`);
      if (soak.inputLatencyMs.p95 > 100) misses.push(`G6: soak inputLatencyMs.p95 ${soak.inputLatencyMs.p95} exceeds 100ms`);
      if (contradictoryMemorySignals) {
        misses.push("G6: soak memoryStable, memoryStatus, and heap slope signals contradict each other");
      }
      if (!memoryStable) misses.push(`G6: soak heap slope/status does not establish stable memory (${soak.heapSlopeMiBPerMin} MiB/min)`);
    }
  }

  if (leakArtifact.value) {
    const leak = leakArtifact.value;
    observed.supplementalLeak.generations = leak.generations ?? null;
    if (leak.mode !== "leak" || !Array.isArray(leak.cycles) || !Array.isArray(leak.errors)) {
      blocked.push("G6: supplied supplemental leak artifact is malformed");
    } else if (leak.errors.length) {
      misses.push("G6: supplemental leak artifact contains runtime errors");
    }
  }

  const source = {
    provenance: provenanceArtifact.source,
    scenario: scenarioArtifact.source,
    fullapp: fullappArtifact.source,
    leak: leakArtifact.source,
    soak: soakArtifact.source,
  };
  if (misses.length) return artifactResult(source, "FAIL", observed, [...blocked, ...misses], refs);
  if (blocked.length) return artifactResult(source, "BLOCKED", observed, blocked, refs);
  return artifactResult(source, "PASS", observed, [], refs);
}

const args = parseArgs(process.argv.slice(2));
const [
  symmetric,
  g3,
  pressure,
  persistence,
  g7,
  g8Survey,
  g8Impression,
  g6Provenance,
  g6Scenario,
  g6Fullapp,
  g6Leak,
  g6Soak,
] = await Promise.all([
  loadArtifact("symmetric", args["--symmetric"]),
  loadArtifact("g3", args["--g3"]),
  loadArtifact("pressure", args["--pressure"]),
  loadArtifact("persistence", args["--persistence"]),
  loadArtifact("g7", args["--g7"]),
  loadArtifact("g8-survey", args["--g8-survey"]),
  loadArtifact("g8-impression", args["--g8-impression"]),
  loadArtifact("g6-provenance", args["--g6-provenance"]),
  loadArtifact("g6-scenario", args["--g6-scenario"]),
  loadArtifact("g6-fullapp", args["--g6-fullapp"]),
  loadArtifact("g6-leak", args["--g6-leak"]),
  loadArtifact("g6-soak", args["--g6-soak"]),
]);

const readiness = {
  pressureInstrumentation: evaluatePressureReadiness(pressure),
  persistenceInstrumentation: evaluatePersistenceReadiness(persistence),
};
const surveyVerdict = evaluateG8Survey(g8Survey);
const impressionVerdict = evaluateG8Impression(g8Impression);
const gates = {
  G2: evaluateG2(symmetric, pressure, readiness.pressureInstrumentation),
  G3: evaluateG3(symmetric, g3),
  G5: {
    verdict: "N_A",
    observed: { monetizationSurfaceIntroduced: false },
    source: null,
    rawEvidenceReferences: [],
    failures: [],
  },
  G6: await evaluateG6(g6Provenance, g6Scenario, g6Fullapp, g6Leak, g6Soak),
  G7: evaluateG7(g7),
  G8: combineG8(surveyVerdict, impressionVerdict),
};
const allVerdicts = [
  ...Object.values(readiness).map(({ verdict }) => verdict),
  ...Object.values(gates).map(({ verdict }) => verdict),
];
const overallDisposition = allVerdicts.includes("BLOCKED")
  ? "BLOCKED"
  : allVerdicts.includes("FAIL") ? "FAIL" : "PASS";
const failures = [
  ...Object.entries(readiness).flatMap(([id, result]) => result.failures.map((failure) => `${id}: ${failure}`)),
  ...Object.entries(gates).flatMap(([id, result]) => result.failures.map((failure) => `${id}: ${failure}`)),
];
const output = {
  schemaVersion: "stage1b-gate-verdict-v1",
  thresholds: {
    G2: "each archetype 9-11 explicit wins out of 20 canonical symmetric pairs; ties are not wins; 15 pressure rows each gateMinPct 55.0-80.0%, 0-3 defeats, and MEASURED boss TTK 5.95-8.05 seconds",
    G3: "BOSS_RALLY_COOLDOWN_REDUCTION=0, one TURRET FRONT, 50/50 post-switch damage conversions, at least one control COMPANION_DOWNED, combined control defeat rate <=20%, and legal combo maxEV/medianEV <=1.30",
    G6: "all full-app tiers and 30-minute soak p95 frame <=16.7ms, long-frame ratio <0.5%, input p95 <=100ms, stable soak memory; DOM <5000; telemetry, rollback, release-readiness, and UI-browser provenance complete",
    G7: "at least 14 voluntary re-entries out of 20 eligible decisions across 10 participants; every circuit 30-180 seconds inclusive with at least 3 unique canonical player actions and at least 1 ELITE_EXTRACTED reward event",
    G8: "five sourced titles with direct-feature count <=2/5 and ten first-exposure raw scores with median >=4.0/5",
  },
  inputs: Object.fromEntries([
    symmetric,
    g3,
    pressure,
    persistence,
    g7,
    g8Survey,
    g8Impression,
    g6Provenance,
    g6Scenario,
    g6Fullapp,
    g6Leak,
    g6Soak,
  ].map(({ label, source }) => [label, source])),
  readiness,
  gates,
  overallDisposition,
  failures,
};
const outputPath = args["--output"];
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
process.stdout.write(`stage1b-gates: ${overallDisposition}; output=${outputPath}\n`);
