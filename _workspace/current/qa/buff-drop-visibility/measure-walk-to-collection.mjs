#!/usr/bin/env node
/**
 * QA gate tool — walk-to buff-drop collection (game-studio-harness).
 *
 * Proves the two properties the "field object, walk to collect" decision requires:
 *   A. PERSISTENCE — with enemy-only steering (player ignores drops), buff drops stay on the
 *      field well past the settle window instead of being vacuumed at 12000. Reported as the
 *      longest single-drop field lifetime and the count still on field / expired.
 *   B. WALK-TO — with drop-priority steering (player walks onto settled drops), drops are
 *      collected, proving the dedicated BUFF_PICKUP_RANGE radius actually admits a walked-to drop.
 *
 * Usage: node measure-walk-to-collection.mjs [stageId] [seed]
 */
import { createDefenseRun, advanceDefenseRun, queueInput, getRunSnapshot } from "../../../../defense-run-simulation.js";
import { TICK_RATE, BUFF_PICKUP_RANGE } from "../../../../defense-catalog.js";

const STAGE_ID = process.argv[2] || "echo-throne";
const SEED = Number(process.argv[3] || 42);
const MAX_TICKS = TICK_RATE * 60 * 8;

const OCT = [[0,-1,"UP"],[1,-1,"UP_RIGHT"],[1,0,"RIGHT"],[1,1,"DOWN_RIGHT"],[0,1,"DOWN"],[-1,1,"DOWN_LEFT"],[-1,0,"LEFT"],[-1,-1,"UP_LEFT"]];
function octantToward(dx, dy) {
  const a = Math.atan2(dy, dx);
  let bi = 0, bd = Infinity;
  for (let i = 0; i < OCT.length; i += 1) {
    const [ox, oy] = OCT[i];
    const oa = Math.atan2(oy, ox);
    let d = Math.abs(a - oa);
    if (d > Math.PI) d = 2 * Math.PI - d;
    if (d < bd) { bd = d; bi = i; }
  }
  return OCT[bi][2];
}

function drive({ chaseDrops }) {
  let game = createDefenseRun({ stageId: STAGE_ID, seed: SEED, abyssDepth: 0 });
  let lastMove = null, ticks = 0;
  let spawnCount = 0, collectCount = 0;
  const lifetimes = new Map();   // dropId -> ticks seen on field
  let maxLifetime = 0;

  while (ticks < MAX_TICKS) {
    const snap = getRunSnapshot(game);
    for (const e of snap.events ?? []) {
      if (e.type === "DROP_SPAWNED") spawnCount += 1;
      if (e.type === "ITEM_COLLECTED") collectCount += 1;
    }
    const buffs = (snap.pickups ?? []).filter((p) => p.kind === "buff");
    for (const b of buffs) {
      const n = (lifetimes.get(b.id) ?? 0) + 1;
      lifetimes.set(b.id, n);
      if (n > maxLifetime) maxLifetime = n;
    }

    if (snap.terminal) break;
    if (snap.growthOffer) {
      const c = snap.growthOffer.choices?.[0];
      if (c) { game = queueInput(game, "GROWTH_OFFER_SELECTED", c); game = advanceDefenseRun(game, 1); ticks += 1; continue; }
      break;
    }

    let desired = "IDLE";
    const cmd = snap.commander;
    let target = null;
    let fleeFrom = null;
    // Drop-priority steering (chase): walk onto the nearest settled buff drop when one exists.
    if (chaseDrops && cmd) {
      let bd = Infinity;
      for (const b of buffs) {
        if (Number.isInteger(b.collectableAtTick) && snap.tick < b.collectableAtTick) continue;
        const d = (b.x - cmd.x) ** 2 + (b.y - cmd.y) ** 2;
        if (d < bd) { bd = d; target = b; }
      }
    }
    // Persistence steering (flee): a player who kills and moves on. Walk AWAY from the nearest
    // settled drop so it is left on the field, proving it is not auto-vacuumed.
    if (!chaseDrops && cmd) {
      let bd = Infinity;
      for (const b of buffs) {
        const d = (b.x - cmd.x) ** 2 + (b.y - cmd.y) ** 2;
        if (d < bd) { bd = d; fleeFrom = b; }
      }
    }
    if (fleeFrom && cmd) {
      desired = octantToward(cmd.x - fleeFrom.x, cmd.y - fleeFrom.y);
    }
    if (!target && !fleeFrom && cmd) {
      let bd = Infinity;
      for (const e of snap.enemies ?? []) {
        if (!(e.hp > 0)) continue;
        const d = (e.x - cmd.x) ** 2 + (e.y - cmd.y) ** 2;
        if (d < bd) { bd = d; target = e; }
      }
    }
    if (target && cmd) desired = octantToward(target.x - cmd.x, target.y - cmd.y);
    if (desired !== lastMove) { game = queueInput(game, "MOVE", desired); lastMove = desired; }
    if (ticks % 10 === 0) game = queueInput(game, "ATTACK", null);
    game = advanceDefenseRun(game, 1);
    ticks += 1;
  }
  const final = getRunSnapshot(game);
  return {
    ticksRun: ticks, spawnCount, collectCount,
    stillOnField: (final.pickups ?? []).filter((p) => p.kind === "buff").length,
    maxSingleDropFieldLifetimeTicks: maxLifetime,
  };
}

const persistence = drive({ chaseDrops: false });
const walkTo = drive({ chaseDrops: true });

const report = {
  stage: STAGE_ID, seed: SEED, buffPickupRange: BUFF_PICKUP_RANGE,
  A_persistence_enemyOnlySteering: persistence,
  B_walkTo_dropPrioritySteering: walkTo,
  verdictA: persistence.maxSingleDropFieldLifetimeTicks > 60
    ? `PASS — a drop persisted ${persistence.maxSingleDropFieldLifetimeTicks} ticks (> 60 settle), i.e. NOT auto-vacuumed`
    : "INCONCLUSIVE — no drop outlived the settle window in this run",
  verdictB: walkTo.collectCount > 0
    ? `PASS — ${walkTo.collectCount} drop(s) collected by walking onto them within ${BUFF_PICKUP_RANGE}`
    : "FAIL — walking to drops collected none",
};
console.log(JSON.stringify(report, null, 2));
process.exit(walkTo.collectCount > 0 ? 0 : 1);
