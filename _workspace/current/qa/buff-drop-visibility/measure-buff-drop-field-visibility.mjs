#!/usr/bin/env node
/**
 * QA gate tool — buff-drop field visibility (game-studio-harness Stage 2).
 *
 * Drives a real campaign run and measures whether buff field drops (`kind:"buff"`)
 * ever persist in `snapshot.pickups` for at least one tick. If they never do, the
 * renderer can never show the drop mesh or the spec §4.2 beacon — the dead-feature
 * this cycle exists to fix.
 *
 * Usage: node measure-buff-drop-field-visibility.mjs [stageId] [seed]
 * Exit 0 iff at least one buff drop was visible on the field for >=1 tick.
 */
import { createDefenseRun, advanceDefenseRun, queueInput, getRunSnapshot } from "../../../../defense-run-simulation.js";
import { TICK_RATE } from "../../../../defense-catalog.js";

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

let game = createDefenseRun({ stageId: STAGE_ID, seed: SEED, abyssDepth: 0 });
let lastMove = null, ticks = 0;
let spawnCount = 0, collectCount = 0, sameTickCollect = 0;
let maxBuffOnField = 0, ticksWithBuffOnField = 0;

while (ticks < MAX_TICKS) {
  const snap = getRunSnapshot(game);
  const evs = snap.events ?? [];
  const spawned = evs.filter((e) => e.type === "DROP_SPAWNED").length;
  const collected = evs.filter((e) => e.type === "ITEM_COLLECTED").length;
  spawnCount += spawned;
  collectCount += collected;
  if (spawned > 0 && collected > 0) sameTickCollect += Math.min(spawned, collected);
  const onField = (snap.pickups ?? []).filter((p) => p.kind === "buff").length;
  if (onField > maxBuffOnField) maxBuffOnField = onField;
  if (onField > 0) ticksWithBuffOnField += 1;

  if (snap.terminal) break;
  if (snap.growthOffer) {
    const c = snap.growthOffer.choices?.[0];
    if (c) { game = queueInput(game, "GROWTH_OFFER_SELECTED", c); game = advanceDefenseRun(game, 1); ticks += 1; continue; }
    break;
  }
  let desired = "IDLE";
  if (snap.commander) {
    let t = null, bd = Infinity;
    for (const e of snap.enemies ?? []) {
      if (!(e.hp > 0)) continue;
      const d = (e.x - snap.commander.x) ** 2 + (e.y - snap.commander.y) ** 2;
      if (d < bd) { bd = d; t = e; }
    }
    if (t) desired = octantToward(t.x - snap.commander.x, t.y - snap.commander.y);
  }
  if (desired !== lastMove) { game = queueInput(game, "MOVE", desired); lastMove = desired; }
  if (ticks % 10 === 0) game = queueInput(game, "ATTACK", null);
  game = advanceDefenseRun(game, 1);
  ticks += 1;
}

const visible = maxBuffOnField > 0;
const report = {
  stage: STAGE_ID, seed: SEED, ticksRun: ticks,
  spawnCount, collectCount, sameTickSpawnAndCollect: sameTickCollect,
  maxBuffDropsSimultaneouslyOnField: maxBuffOnField,
  ticksWithAnyBuffDropVisible: ticksWithBuffOnField,
  verdict: visible
    ? `PASS — buff drops visible on field (max ${maxBuffOnField}, across ${ticksWithBuffOnField} ticks)`
    : "FAIL — every drop collected the same tick it spawned; renderer can never show mesh/beacon",
};
console.log(JSON.stringify(report, null, 2));
process.exit(visible ? 0 : 1);
