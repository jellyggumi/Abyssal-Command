#!/usr/bin/env node
/**
 * Cycle-9 extraction END-TO-END gate.
 *
 * The other extraction gate (`verify-cycle9-extraction-live.mjs`) asserts the
 * RULES: the grade table, the lock state on a fresh run, conditional presence,
 * capacity clamping, run-scoped ids. All of that is checkable without ever
 * playing the game.
 *
 * This gate is different: it drives a real run until a midboss actually dies and
 * requires the whole chain to fire in order —
 *
 *   EXTRACTION_UNLOCKED -> CORPSE_CREATED -> EXTRACTION_CHANNEL_STARTED
 *   -> CORPSE_EXTRACTED -> run.companions grows
 *
 * Why it exists: every other piece of evidence for the headline feature is
 * either a rule assertion or a unit test. Neither can tell "the loop works" from
 * "the loop is wired but never reachable in play" — e.g. a midboss that never
 * spawns, an unlock that never flips, or a channel that can never complete
 * because nothing ever brings the commander inside EXTRACTION.range of a corpse.
 *
 * The commander is steered deliberately: the sim has no auto-pathing to corpses,
 * so a passive run would prove nothing about the channel.
 *
 * Usage: node scripts/verify-cycle9-extraction-e2e.mjs [--json] [--seed N]
 * Exit 0 = the loop completed in a real run. Exit 1 = it did not.
 */

import {
  createDefenseRun,
  advanceDefenseRun,
  queueInput,
  getRunSnapshot,
} from "../defense-run-simulation.js";
import { EXTRACTION, TICK_RATE } from "../defense-catalog.js";

const asJson = process.argv.includes("--json");
const seedArg = process.argv.indexOf("--seed");
const SEED = seedArg > -1 ? Number(process.argv[seedArg + 1]) : 17;
const STAGE_ID = "cinder-span";
const MAX_TICKS = TICK_RATE * 60 * 6; // 6 simulated minutes

/** Nearest octant string for a delta, matching OCTANT_VECTORS' 8 directions. */
function octantToward(dx, dy) {
  const names = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
  return names[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
}

function run() {
  const timeline = [];
  const seen = new Map();      // event type -> first tick observed
  let corpseTargetId = null;
  let channelPeak = 0;
  let growthSelections = 0;
  let inRangeDiagnosis = null;
  let companionsAfterExtract = null;

  let game = createDefenseRun({ stageId: STAGE_ID, seed: SEED, abyssDepth: 0 });
  const companionsAtStart = getRunSnapshot(game).companions.length;

  let lastMove = null;
  let ticks = 0;
  let endedBecause = null;

  while (ticks < MAX_TICKS) {
    const snap = getRunSnapshot(game);

    for (const event of snap.events ?? []) {
      if (!seen.has(event.type)) seen.set(event.type, snap.tick);
      if (["EXTRACTION_UNLOCKED", "CORPSE_CREATED", "EXTRACTION_CHANNEL_STARTED",
           "CORPSE_EXTRACTED", "EXTRACTION_CHANNEL_BROKEN", "CORPSE_EXPIRED"].includes(event.type)) {
        timeline.push({ tick: snap.tick, type: event.type, grade: event.grade ?? null });
      }
      if (event.type === "CORPSE_EXTRACTED" && companionsAfterExtract === null) {
        companionsAfterExtract = getRunSnapshot(game).companions.length;
      }
    }

    if (snap.extractionChannel) {
      channelPeak = Math.max(channelPeak, snap.extractionChannel.elapsedTicks ?? 0);
    }

    // Slot-availability diagnosis. `startExtractionChannel` bails at
    // `if (!extractionSlotAvailable(run)) return;` with NO event and no reason,
    // and one slot is RESERVED for the authored elite extraction while that
    // objective is unresolved (defense-run-simulation.js:716-733). So a full
    // roster silently prevents channelling. Without this capture, X3 would blame
    // range or steering for what is actually a slot shortage.
    if (!inRangeDiagnosis && snap.commander) {
      for (const corpse of snap.corpses ?? []) {
        if (corpse.extractable === false) continue;
        const d2 = (corpse.x - snap.commander.x) ** 2 + (corpse.y - snap.commander.y) ** 2;
        if (d2 <= EXTRACTION.range ** 2) {
          inRangeDiagnosis = {
            tick: snap.tick,
            corpseId: corpse.id,
            distance: Math.round(Math.sqrt(d2)),
            range: EXTRACTION.range,
            companions: snap.companions.length,
            resolvedCapacity: snap.companionCapacity ?? 3,
            eliteExtracted: snap.extracted === true,
            eliteObjectiveResolved: snap.objectives?.extraction?.completed === true,
            channelRunning: Boolean(snap.extractionChannel),
          };
          break;
        }
      }
    }

    if (seen.has("CORPSE_EXTRACTED")) { endedBecause = "loop-closed"; break; }
    if (snap.terminal) { endedBecause = `terminal at tick ${snap.tick}, phase ${snap.objectives?.phase}`; break; }

    // `tick()` opens with `if (run.growthOffer) return;` — the simulation HALTS
    // until a growth choice is made. A drive that ignores it freezes silently
    // (observed: 21600 iterations advanced the run only to tick 529) and then
    // every downstream assertion fails for the wrong reason.
    if (snap.growthOffer) {
      const choice = snap.growthOffer.choices?.[0];
      if (choice) {
        game = queueInput(game, "GROWTH_OFFER_SELECTED", choice);
        growthSelections += 1;
        game = advanceDefenseRun(game, 1);
        ticks += 1;
        continue;
      }
      endedBecause = `growth offer with no choices at tick ${snap.tick}`;
      break;
    }

    // Steering. The commander IS the damage source in this sim, so idling does
    // not "let waves resolve" — it lets the gate collapse. Priority: walk onto a
    // corpse to channel, else close on the nearest live enemy so waves clear and
    // the slot-3 midboss is actually reached.
    let desired = "IDLE";
    const corpses = (snap.corpses ?? []).filter((c) => c.extractable !== false);
    if (corpses.length && snap.commander) {
      let best = null;
      let bestDist = Infinity;
      for (const corpse of corpses) {
        const d = (corpse.x - snap.commander.x) ** 2 + (corpse.y - snap.commander.y) ** 2;
        if (d < bestDist) { bestDist = d; best = corpse; }
      }
      corpseTargetId = best.id;
      // Hold still once well inside range so drift cannot break the channel.
      desired = bestDist <= (EXTRACTION.range * 0.5) ** 2
        ? "IDLE"
        : octantToward(best.x - snap.commander.x, best.y - snap.commander.y);
    } else if (snap.commander) {
      let target = null;
      let bestDist = Infinity;
      for (const enemy of snap.enemies ?? []) {
        if (!(enemy.hp > 0)) continue;
        const d = (enemy.x - snap.commander.x) ** 2 + (enemy.y - snap.commander.y) ** 2;
        if (d < bestDist) { bestDist = d; target = enemy; }
      }
      if (target) {
        desired = octantToward(target.x - snap.commander.x, target.y - snap.commander.y);
      }
    }

    if (desired !== lastMove) {
      game = queueInput(game, "MOVE", desired);
      lastMove = desired;
    }
    // Attack on cadence so enemies actually die — no kills means no corpses and
    // no midboss death, so the loop could never close.
    if (ticks % 12 === 0) game = queueInput(game, "ATTACK", null);

    game = advanceDefenseRun(game, 1);
    ticks += 1;
  }

  const final = getRunSnapshot(game);
  return {
    seed: SEED, ticksRun: ticks, finalTick: final.tick,
    terminal: Boolean(final.terminal), endedBecause,
    phase: final.objectives?.phase ?? null,
    growthSelections,
    seen: Object.fromEntries(seen),
    timeline: timeline.slice(0, 24),
    corpseTargetId, channelPeak,
    channelRequired: EXTRACTION.channelTicks,
    companionsAtStart,
    companionsAfterExtract,
    companionsFinal: final.companions.length,
    extractionUnlocked: final.extractionUnlocked === true,
  };
}

const observed = run();
const checks = [];
const record = (id, description, ok, detail) => checks.push({ id, description, ok, detail });

record("X1", "a midboss died and EXTRACTION_UNLOCKED fired in a real run",
  observed.seen.EXTRACTION_UNLOCKED !== undefined,
  observed.seen.EXTRACTION_UNLOCKED !== undefined
    ? `unlocked at tick ${observed.seen.EXTRACTION_UNLOCKED}`
    : "never fired — the unlock is unreachable in play, or no midboss spawned within 6 simulated minutes");

record("X2", "a corpse was created from an eligible kill",
  observed.seen.CORPSE_CREATED !== undefined,
  observed.seen.CORPSE_CREATED !== undefined
    ? `first corpse at tick ${observed.seen.CORPSE_CREATED}`
    : "no corpse ever created");

record("X3", "the extraction channel started (commander reached a corpse in range)",
  observed.seen.EXTRACTION_CHANNEL_STARTED !== undefined,
  observed.seen.EXTRACTION_CHANNEL_STARTED !== undefined
    ? `channel started at tick ${observed.seen.EXTRACTION_CHANNEL_STARTED}, peak elapsed ${observed.channelPeak}/${observed.channelRequired}`
    : `channel never started (peak elapsed ${observed.channelPeak}) — corpse unreachable or range wrong`);

record("X4", "the channel completed and CORPSE_EXTRACTED fired",
  observed.seen.CORPSE_EXTRACTED !== undefined,
  observed.seen.CORPSE_EXTRACTED !== undefined
    ? `extracted at tick ${observed.seen.CORPSE_EXTRACTED}`
    : "channel never completed");

record("X5", "the legion actually grew (a companion entity was added)",
  observed.companionsAfterExtract !== null
    && observed.companionsAfterExtract > observed.companionsAtStart,
  `companions ${observed.companionsAtStart} -> ${observed.companionsAfterExtract ?? "n/a"} (final ${observed.companionsFinal})`);

record("X6", "unlock strictly preceded the first extraction (gating held in play)",
  observed.seen.EXTRACTION_UNLOCKED !== undefined
    && observed.seen.CORPSE_EXTRACTED !== undefined
    && observed.seen.EXTRACTION_UNLOCKED <= observed.seen.CORPSE_EXTRACTED,
  `unlock tick ${observed.seen.EXTRACTION_UNLOCKED ?? "n/a"} <= extract tick ${observed.seen.CORPSE_EXTRACTED ?? "n/a"}`);

const ok = checks.every((c) => c.ok);

if (asJson) {
  console.log(JSON.stringify({ ok, observed, checks }, null, 2));
} else {
  console.log(`cycle-9 extraction E2E gate — stage ${STAGE_ID}, seed ${observed.seed}, ${observed.ticksRun} ticks`);
  for (const c of checks) {
    console.log(`  ${c.id} ${c.ok ? "OK  " : "FAIL"} ${c.description}`);
    console.log(`        ${c.detail}`);
  }
  if (observed.timeline.length) {
    console.log("  timeline:");
    for (const t of observed.timeline) {
      console.log(`        t=${String(t.tick).padStart(5)}  ${t.type}${t.grade ? ` (${t.grade})` : ""}`);
    }
  }
  console.log(ok
    ? "\nPASS — the extraction loop closes in a real run: midboss -> unlock -> corpse -> channel -> companion."
    : "\nFAIL — the loop did not close. See failing checks above.");
}

process.exit(ok ? 0 : 1);
