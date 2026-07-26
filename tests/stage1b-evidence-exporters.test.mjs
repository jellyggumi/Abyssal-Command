import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI_TIMEOUT_MS = 180_000;
const CANONICAL_SEEDS = [401, 402, 403, 404, 405];

function hasOwn(record, key) {
  return record !== null && typeof record === "object" && Object.hasOwn(record, key);
}

function assertOwn(record, key, context) {
  assert.ok(hasOwn(record, key), `${context} must explicitly expose ${key}`);
}

function assertFiniteNonNegative(value, context) {
  assert.ok(Number.isFinite(value) && value >= 0, `${context} must be a finite non-negative number`);
}

function assertSynthetic(document, context) {
  assert.equal(document.controller?.kind, "synthetic", `${context} must identify its controller as synthetic`);
}

function orderedEvents(events, context) {
  assert.ok(Array.isArray(events), `${context} must retain a raw events array`);
  for (let index = 1; index < events.length; index += 1) {
    assert.ok(
      events[index - 1].eventSequence < events[index].eventSequence,
      `${context} events must retain strict eventSequence order`,
    );
    assert.ok(events[index - 1].tick <= events[index].tick, `${context} events must retain tick order`);
  }
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

async function withExporter(scriptName, flags, inspect) {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "stage1b-evidence-"));
  const outputPath = join(temporaryDirectory, "evidence.json");
  const scriptPath = join(repositoryRoot, "scripts", scriptName);

  try {
    const result = spawnSync(process.execPath, [scriptPath, ...flags, "--output", outputPath], {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      timeout: CLI_TIMEOUT_MS,
    });

    assert.equal(
      result.error,
      undefined,
      `${scriptName} must finish within ${CLI_TIMEOUT_MS}ms: ${result.error?.message ?? "unknown spawn error"}`,
    );
    assert.equal(
      result.status,
      0,
      `${scriptName} must exit successfully\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );

    let payload;
    try {
      payload = JSON.parse(await readFile(outputPath, "utf8"));
    } catch (error) {
      assert.fail(`${scriptName} must write valid JSON to --output: ${error.message}`);
    }
    await inspect(payload);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

test("Stage 1b pressure exporter retains explicit TTK disposition and attributable packet evidence", async () => {
  await withExporter(
    "run-stage1b-pressure-packets.mjs",
    ["--seeds", "401", "--stances", "VANGUARD"],
    async (payload) => {
      assertSynthetic(payload, "pressure export");
      assertFiniteNonNegative(payload.bossPressureGraceTicks, "pressure export bossPressureGraceTicks metadata");
      assert.ok(Array.isArray(payload.rows) && payload.rows.length === 1, "reduced pressure export must contain its one requested Cinder row");

      const row = payload.rows[0];
      assert.equal(row.stageId, "cinder-span");
      assert.equal(row.seed, 401);
      assert.equal(row.stance, "VANGUARD");
      assert.equal(typeof row.runId, "string");
      assertFiniteNonNegative(row.gateMinPct, "pressure row gateMinPct");
      assertOwn(row, "terminal", "pressure row");
      assertOwn(row, "terminalReason", "pressure row");
      assert.equal(typeof row.terminalReason, "string", "pressure row terminalReason must never be omitted or null");
      assertOwn(row, "bossTtkStatus", "pressure row");
      assertOwn(row, "bossTtkTicks", "pressure row");
      assert.equal(typeof row.bossTtkStatus, "string");
      if (row.bossTtkStatus === "MEASURED") {
        assertFiniteNonNegative(row.bossTtkTicks, "MEASURED pressure row bossTtkTicks");
      } else {
        assert.match(row.bossTtkStatus, /^NOT_SPAWNED(?:_|$)/, "an unmeasured TTK must state an explicit non-spawn reason");
        assert.equal(row.bossTtkTicks, null, "an explicit non-spawn TTK must retain a null ticks field");
      }

      assert.ok(Array.isArray(row.pressurePackets) && row.pressurePackets.length > 0, "pressure row must retain per-packet evidence");
      let previousToTick = -1;
      for (const [index, packet] of row.pressurePackets.entries()) {
        const context = `pressure packet ${index}`;
        assert.equal(packet.runId, row.runId);
        assert.equal(packet.stageId, "cinder-span");
        assert.equal(packet.seed, 401);
        assert.ok(Number.isInteger(packet.packetIndex));
        assert.ok(packet.toTick > packet.fromTick, `${context} must cover a positive tick interval`);
        assert.ok(packet.fromTick >= previousToTick, `${context} must not overlap the preceding packet`);
        previousToTick = packet.toTick;

        for (const field of ["arrivals", "pressureEvents", "terminalPressureEvents", "recoveryEvents", "agencyWindows"]) {
          assert.ok(Array.isArray(packet[field]), `${context}.${field} must be retained as an array`);
        }
        assert.equal(packet.controller?.kind, "synthetic", `${context} must remain labelled synthetic`);

        const events = [...packet.pressureEvents, ...packet.terminalPressureEvents];
        for (const target of ["gate", "commander"]) {
          const title = target === "gate" ? "gateIntegrity" : "commanderIntegrity";
          assertFiniteNonNegative(packet[`${title}Before`], `${context}.${title}Before`);
          assertFiniteNonNegative(packet[`${title}After`], `${context}.${title}After`);
          assertFiniteNonNegative(packet[`${title}Loss`], `${context}.${title}Loss`);
          const attributableDamage = events
            .filter((event) => event.target === target)
            .reduce((total, event) => total + (Number.isFinite(event.damage) ? event.damage : 0), 0);
          assert.equal(
            packet[`${title}Loss`],
            attributableDamage,
            `${context} ${target} gross integrity loss must be recomputable from retained raw damage evidence`,
          );
          assert.equal(
            packet[`${target}NetIntegrityDelta`],
            packet[`${title}Before`] - packet[`${title}After`],
            `${context} ${target} net integrity delta must remain truthful when recovery occurs`,
          );
        }
      }
    },
  );
});

test("Stage 1b G3 exporter attributes conversion phases to the accepted switch event and reports non-exposure", async () => {
  await withExporter("run-g3-stance-events.mjs", ["--seeds", "401"], async (payload) => {
    assertSynthetic(payload, "G3 export");
    assert.ok(Array.isArray(payload.formationTransitions), "G3 export must expose formationTransitions");
    assert.ok(payload.formationTransitions.length >= 50, "G3 export must retain at least 50 rally-to-TURRET conversions");
    assert.ok(Array.isArray(payload.controlRuns), "G3 export must expose controlRuns");

    const controlCounts = { VANGUARD: 0, SPLIT: 0 };
    for (const [index, control] of payload.controlRuns.entries()) {
      const context = `G3 control run ${index}`;
      assert.ok(control.stance === "VANGUARD" || control.stance === "SPLIT", `${context} must be a required non-TURRET stance`);
      controlCounts[control.stance] += 1;
      assert.equal(typeof control.defeated, "boolean", `${context} must explicitly retain its defeat result`);
      assertFiniteNonNegative(control.companionsDowned, `${context}.companionsDowned`);
      assert.equal(typeof control.pressureContext?.bossGraceActive, "boolean", `${context} must retain boss-grace context`);
      assert.equal(typeof control.pressureContext?.nonBossPressureActive, "boolean", `${context} must retain non-boss pressure context`);
      orderedEvents(control.events, context);
      assert.equal(
        control.events.filter((event) => event.type === "COMPANION_DOWNED").length,
        control.companionsDowned,
        `${context} down count must be recomputable from retained events`,
      );
    }
    assert.ok(controlCounts.VANGUARD >= 50, "G3 export must retain at least 50 VANGUARD controls");
    assert.ok(controlCounts.SPLIT >= 50, "G3 export must retain at least 50 SPLIT controls");

    let notExposedCount = 0;
    for (const [index, transition] of payload.formationTransitions.entries()) {
      const context = `formation transition ${index}`;
      orderedEvents(transition.events, context);
      assert.equal(transition.mode, "rally-then-turret");
      assert.equal(transition.stanceAfter, "TURRET");
      assert.ok(Number.isInteger(transition.switchEventSequence), `${context} must expose switchEventSequence`);
      assert.ok(Number.isInteger(transition.acceptedSwitchTick), `${context} must expose acceptedSwitchTick`);
      assert.ok(Array.isArray(transition.frontBefore) && Array.isArray(transition.frontAfter), `${context} must retain FRONT membership before and after`);

      const acceptedSwitch = transition.events.find(
        (event) => event.eventSequence === transition.switchEventSequence
          && event.tick === transition.acceptedSwitchTick
          && event.type === "INPUT_ACCEPTED"
          && event.inputType === "STANCE_CYCLE",
      );
      assert.ok(acceptedSwitch, `${context} attribution boundary must key off the retained accepted STANCE_CYCLE event`);

      const damageBefore = transition.events
        .filter((event) => event.type === "COMPANION_DAMAGED" && event.tick < transition.acceptedSwitchTick)
        .reduce((total, event) => total + (event.damage ?? 0), 0);
      const damageAfter = transition.events
        .filter((event) => event.type === "COMPANION_DAMAGED" && event.tick >= transition.acceptedSwitchTick)
        .reduce((total, event) => total + (event.damage ?? 0), 0);
      const downsBefore = transition.events.filter(
        (event) => event.type === "COMPANION_DOWNED" && event.tick < transition.acceptedSwitchTick,
      ).length;
      const downsAfter = transition.events.filter(
        (event) => event.type === "COMPANION_DOWNED" && event.tick >= transition.acceptedSwitchTick,
      ).length;

      assert.equal(transition.companionDamageByPhase?.before, damageBefore, `${context} pre-switch damage must be recomputable`);
      assert.equal(transition.companionDamageByPhase?.after, damageAfter, `${context} switch-tick damage belongs to the post-switch phase`);
      assert.equal(transition.companionDamageByPhase?.switchTick, 0, `${context} must not divert switch-tick damage from the post-switch phase`);
      assert.equal(transition.downsByPhase?.before, downsBefore, `${context} pre-switch downs must be recomputable`);
      assert.equal(transition.downsByPhase?.after, downsAfter, `${context} switch-tick downs belong to the post-switch phase`);
      assert.equal(transition.downsByPhase?.switchTick, 0, `${context} must not divert switch-tick downs from the post-switch phase`);
      assert.equal(typeof transition.pressureContext?.bossGraceActive, "boolean");
      assert.equal(typeof transition.pressureContext?.nonBossPressureActive, "boolean");
      assert.ok(
        transition.exposureStatus === "EXPOSED" || transition.exposureStatus === "NOT_EXPOSED",
        `${context} must report an explicit exposure disposition`,
      );
      if (!transition.pressureContext.nonBossPressureActive) {
        assert.equal(transition.exposureStatus, "NOT_EXPOSED", `${context} cannot claim conversion evidence without non-grace pressure`);
      }
      if (transition.exposureStatus === "NOT_EXPOSED") notExposedCount += 1;
    }
    assert.ok(notExposedCount > 0, "G3 export must preserve NOT_EXPOSED outcomes instead of treating them as immunity evidence");
  });
});

test("Stage 1b persistence exporter proves all three paths without unaccepted Elite Extract writes", async () => {
  await withExporter("run-stage1b-persistence-scenarios.mjs", [], async (payload) => {
    assertSynthetic(payload, "persistence export");
    assert.equal(payload.scenarioCount, 3);
    assert.ok(Array.isArray(payload.scenarios) && payload.scenarios.length === 3, "persistence export must contain exactly three scenarios");
    assert.deepEqual(
      new Set(payload.scenarios.map(({ scenario }) => scenario)),
      new Set(["victory", "defeat-after-acceptance", "defeat-before-acceptance"]),
    );

    const expectedSeed = {
      victory: 901,
      "defeat-after-acceptance": 902,
      "defeat-before-acceptance": 903,
    };

    for (const scenario of payload.scenarios) {
      const context = `persistence scenario ${scenario.scenario}`;
      assert.equal(scenario.seed, expectedSeed[scenario.scenario]);
      assert.equal(scenario.controller?.kind, "synthetic", `${context} must remain labelled synthetic`);
      orderedEvents(scenario.events, context);
      assert.ok(scenario.campaignBefore && typeof scenario.campaignBefore === "object", `${context} must retain campaignBefore`);
      assert.ok(scenario.campaignAfter && typeof scenario.campaignAfter === "object", `${context} must retain campaignAfter`);
      assert.ok(Array.isArray(scenario.campaignBefore.capturedEliteIds), `${context} campaignBefore must expose capturedEliteIds`);
      assert.ok(Array.isArray(scenario.campaignAfter.capturedEliteIds), `${context} campaignAfter must expose capturedEliteIds`);
      assert.ok(
        scenario.campaignDiff && typeof scenario.campaignDiff === "object" && Object.keys(scenario.campaignDiff).length > 0,
        `${context} must retain a non-empty campaign diff proof`,
      );
      assert.ok(Array.isArray(scenario.writes), `${context} must retain its persistence writes`);
      assert.ok(Array.isArray(scenario.acceptedHandoffs), `${context} must retain accepted handoff evidence`);
      assert.ok(Array.isArray(scenario.inputAcceptedEvidence), `${context} must retain accepted input evidence`);
      assert.equal(scenario.invariants?.maxAcceptedHandoffs, 1, `${context} must declare the one-handoff invariant`);
      assert.equal(scenario.invariants?.writesWithoutAcceptedExtract, 0, `${context} must declare zero unaccepted writes`);
      assert.ok(
        Object.values(scenario.invariantChecks ?? {}).length > 0
          && Object.values(scenario.invariantChecks).every((value) => value === true),
        `${context} invariant checks must be explicit and true`,
      );

      const acceptedEvents = scenario.events.filter(
        (event) => event.type === "INPUT_ACCEPTED" && event.inputType === "EXTRACT_ELITE",
      );
      assert.equal(scenario.acceptedEliteExtractCount, acceptedEvents.length, `${context} accepted count must be recomputable from events`);
      assert.equal(scenario.inputAcceptedEvidence.length, acceptedEvents.length, `${context} accepted evidence must match the raw trace`);
      assert.ok(scenario.acceptedEliteExtractCount <= 1, `${context} must never accept more than one Elite Extract handoff`);
      assert.equal(scenario.acceptedHandoffs.length, scenario.acceptedEliteExtractCount, `${context} accepted handoffs must match accepted inputs`);
      assert.equal(
        scenario.writes.filter((write) => write.acceptedExtract !== true).length,
        0,
        `${context} must never issue an Elite persistence write without an accepted extract`,
      );

      const addedEliteIds = scenario.campaignAfter.capturedEliteIds.filter(
        (eliteId) => !scenario.campaignBefore.capturedEliteIds.includes(eliteId),
      );
      if (scenario.scenario === "defeat-before-acceptance") {
        assert.match(String(scenario.terminal).toLowerCase(), /defeat/);
        assert.equal(scenario.acceptedEliteExtractCount, 0);
        assert.equal(scenario.writes.length, 0, "defeat-before-acceptance must not manufacture an Elite persistence write");
        assert.deepEqual(addedEliteIds, [], "defeat-before-acceptance must not capture an Elite");
      } else {
        assert.equal(scenario.acceptedEliteExtractCount, 1, `${context} must prove one accepted Elite Extract`);
        assert.ok(scenario.writes.length > 0, `${context} must retain the resulting Elite persistence write`);
        assert.ok(addedEliteIds.length > 0, `${context} must prove the accepted Elite persisted in campaignAfter`);
        if (scenario.scenario === "victory") assert.match(String(scenario.terminal).toLowerCase(), /victory/);
        else assert.match(String(scenario.terminal).toLowerCase(), /defeat/);
      }
    }

    assert.ok(
      Object.values(payload.invariants ?? {}).length > 0
        && Object.values(payload.invariants).every((value) => value === true),
      "persistence export must expose passing aggregate write invariants",
    );
  });
});

test("Stage 1b symmetric exporter declares the canonical 20-pair plan and retains recomputable sampled outcomes and EV", async () => {
  await withExporter(
    "run-stage1b-symmetric-trials.mjs",
    ["--seeds", "401", "--pairs-per-archetype", "1"],
    async (payload) => {
      assertSynthetic(payload, "symmetric export");
      assert.deepEqual(payload.trialPlan?.seeds, CANONICAL_SEEDS, "trialPlan must retain the canonical fixed seed set");
      assert.equal(payload.trialPlan?.pairsPerArchetype, 20, "trialPlan must declare 20 paired trials per archetype");
      assert.ok(Array.isArray(payload.trialPlan?.archetypes) && payload.trialPlan.archetypes.length >= 1, "trialPlan must declare its archetypes");
      assert.equal(new Set(payload.trialPlan.archetypes).size, payload.trialPlan.archetypes.length, "trialPlan archetypes must be unique");
      assert.deepEqual(payload.execution?.seeds, [401], "reduced execution must disclose its sampled seed");
      assert.equal(payload.execution?.pairsPerArchetype, 1, "reduced execution must disclose its sampled pair count");
      assert.ok(Array.isArray(payload.rows) && payload.rows.length > 0, "symmetric export must retain sampled rows");

      const sampledArchetypes = new Set();
      for (const [index, row] of payload.rows.entries()) {
        const context = `symmetric row ${index}`;
        sampledArchetypes.add(row.archetypeId);
        assert.ok(payload.trialPlan.archetypes.includes(row.archetypeId), `${context} must use a declared archetypeId`);
        assert.ok(payload.trialPlan.archetypes.includes(row.counterProfileId), `${context} must use a declared counterProfileId`);
        assert.notEqual(row.archetypeId, row.counterProfileId, `${context} must compare distinct profiles`);
        assert.equal(row.seed, 401);
        assert.ok(
          row.winner === row.archetypeId || row.winner === row.counterProfileId || row.winner === "TIE",
          `${context} must report an explicit winner or TIE`,
        );
        assert.equal(typeof row.valueBudgetFingerprint, "string", `${context} must expose a value-budget fingerprint`);
        assert.ok(row.valueBudgetFingerprint.length > 0, `${context} fingerprint must not be empty`);
        assert.ok(Array.isArray(row.pairedEntries) && row.pairedEntries.length === 2, `${context} must retain both symmetric entries`);
        assert.ok(
          row.pairedEntries.every((entry) => entry.valueBudgetFingerprint === row.valueBudgetFingerprint),
          `${context} paired entries must have identical value-budget fingerprints`,
        );
        assert.ok(
          row.rawOutcomes && typeof row.rawOutcomes === "object" && Object.keys(row.rawOutcomes).length > 0,
          `${context} must retain raw outcomes used to derive winner`,
        );
        assert.ok(
          row.winnerDerivation && typeof row.winnerDerivation === "object" && Object.keys(row.winnerDerivation).length > 0,
          `${context} must retain winner derivation evidence`,
        );
      }
      assert.deepEqual(sampledArchetypes, new Set(payload.trialPlan.archetypes), "reduced execution must sample every declared archetype");

      const ev = payload.legalComboEv;
      assert.equal(typeof ev?.metric, "string", "legal-combo EV must name its metric");
      assert.ok(Array.isArray(ev?.rows) && ev.rows.length > 0, "legal-combo EV must retain a machine-readable series");
      for (const [index, row] of ev.rows.entries()) {
        assert.equal(typeof row.comboId, "string", `EV row ${index} must identify its combo`);
        assert.ok(Number.isFinite(row.ev), `EV row ${index} must expose a finite EV`);
        assertOwn(row, "rawOutcome", `EV row ${index}`);
      }

      const values = ev.rows.map(({ ev: value }) => value);
      const expectedMax = Math.max(...values);
      const expectedMedian = median(values);
      assert.equal(ev.summary?.maxEV, expectedMax, "maxEV must be recomputable from the retained EV rows");
      assert.equal(ev.summary?.medianEV, expectedMedian, "medianEV must be recomputable from the retained EV rows");
      assert.equal(typeof ev.summary?.status, "string", "EV summary must expose an explicit status");
      if (expectedMedian === 0) {
        assert.equal(ev.summary.maxOverMedian, null, "zero-median EV must not hide an undefined ratio");
        assert.notEqual(ev.summary.status, "MEASURED", "zero-median EV must expose a non-measured disposition");
      } else {
        assert.ok(
          Math.abs(ev.summary.maxOverMedian - expectedMax / expectedMedian) < 1e-12,
          "maxOverMedian must be recomputable from retained EV rows",
        );
      }
    },
  );
});
